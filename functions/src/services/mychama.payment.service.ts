/**
 * MyChama Payment Service
 *
 * Raises a payment intent in the mychama1 project and pushes an STK prompt via
 * Paystack's /charge mobile_money endpoint, routing funds to the chama through
 * its settlement split code.
 *
 * Guarantees given to the member (and to whoever reconciles later):
 *   - An intent is never created without the exact target it pays (loan,
 *     contribution or pot+period). An untargeted intent would be charged but
 *     could never be applied — the failure mode this file exists to prevent.
 *   - One STK prompt per identical pending payment, so a double-tap cannot
 *     charge the member twice.
 *
 * Deliberately NOT here: any balance mutation. The intent is the bot's only
 * financial write. MyChama's own Paystack webhook matches on `reference`,
 * applies the money to the contribution / instalment / pot period, and writes
 * the transaction. That single-writer rule is what makes a bot retry, a
 * duplicate webhook or a mid-flow crash all safe.
 */

import axios from 'axios';
import { MYCHAMA_PAYSTACK_SECRET_KEY, PAYSTACK_CONFIG } from '../config/paystack.config';
import { mychamaDb, mcPath, MC, MC_SECURITY } from '../config/mychama.config';
import {
  FeeBreakdown,
  IntentPurpose,
  PaymentIntent,
} from '../types/mychama.types';
import { normalizePhone } from './mychama.service';
import { logger } from '../utils/logger';

interface PaystackChargeResponse {
  status: boolean;
  message: string;
  data?: {
    reference?: string;
    status?: string;
    display_text?: string;
  };
}

export interface IntentTarget {
  purpose: IntentPurpose;
  contributionId?: string;
  loanId?: string;
  installmentNo?: number;
  potId?: string;
  potPeriod?: number;
  /** MGR only: pay this open arrear instead of the current period. */
  arrearId?: string;
  note?: string;
}

export interface InitiateResult {
  success: boolean;
  reference?: string;
  error?: string;
  /** True when an identical payment is already awaiting the member's PIN. */
  duplicate?: boolean;
}

/**
 * Every purpose must carry exactly the ids the webhook needs to apply it.
 * Returns an error string, or null when the target is complete.
 */
export function validateIntentTarget(target: IntentTarget): string | null {
  switch (target.purpose) {
    case 'contribution':
      return target.contributionId ? null : 'missing contributionId';
    case 'loan_repayment':
      return target.loanId ? null : 'missing loanId';
    case 'mgr_contribution':
      // An arrear payment needs the pot + arrear; a period payment needs
      // the pot + the period it is for. Either way PAY must be able to tell
      // exactly what this money settles.
      if (!target.potId) return 'missing potId';
      if (target.arrearId) return null;
      return typeof target.potPeriod === 'number' ? null : 'missing potPeriod';
    default:
      return 'unknown purpose';
  }
}

/**
 * A pending, unexpired intent for the same member, same target and same net
 * amount, raised in the last few minutes. STK prompts stay live on the
 * member's phone for a while — sending a second one for the same thing just
 * risks a double charge.
 */
export async function findDuplicatePendingIntent(
  chamaId: string,
  memberId: string,
  target: IntentTarget,
  net: number
): Promise<PaymentIntent | null> {
  const recent = await getPendingIntents(chamaId, memberId, 10);
  const cutoff = Date.now() - 3 * 60 * 1000;

  return (
    recent.find(
      (i) =>
        i.createdAt >= cutoff &&
        i.purpose === target.purpose &&
        Math.abs(i.amount - net) < 0.01 &&
        (i.contributionId || null) === (target.contributionId || null) &&
        (i.loanId || null) === (target.loanId || null) &&
        (i.potId || null) === (target.potId || null) &&
        (i.potPeriod ?? null) === (target.potPeriod ?? null) &&
        (i.arrearId || null) === (target.arrearId || null)
    ) || null
  );
}

/**
 * Reference format: MCW-{chamaId}-{purposeCode}-{timestamp}-{rand}
 * The MCW prefix lets the MyChama webhook tell WhatsApp-originated payments
 * apart from in-app ones without a lookup, and the chamaId lets it resolve the
 * intent document in one read.
 */
function buildReference(chamaId: string, purpose: IntentPurpose): string {
  const codes: Record<IntentPurpose, string> = {
    contribution: 'CNT',
    loan_repayment: 'LNR',
    mgr_contribution: 'MGR',
  };
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `MCW-${chamaId}-${codes[purpose]}-${Date.now()}-${rand}`;
}

/**
 * Rolling-hour guard so a confused or malicious sender cannot spray STK
 * prompts at a member's phone.
 */
export async function withinIntentRateLimit(chamaId: string, memberId: string): Promise<boolean> {
  const cutoff = Date.now() - 60 * 60 * 1000;

  const snap = await mychamaDb()
    .collection(mcPath.paymentIntents(chamaId))
    .where('memberId', '==', memberId)
    .where('createdAt', '>=', cutoff)
    .limit(MC_SECURITY.MAX_INTENTS_PER_HOUR + 1)
    .get();

  return snap.size < MC_SECURITY.MAX_INTENTS_PER_HOUR;
}

/**
 * Create the intent, then push the STK. If Paystack rejects the charge the
 * intent is marked `failed` immediately so it never lingers as a phantom
 * pending payment in the member's statement.
 */
export async function initiateMyChamaPayment(params: {
  chamaId: string;
  chamaName: string;
  memberId: string;
  memberName: string;
  phone: string;
  provider: 'mpesa' | 'airtel';
  fees: FeeBreakdown;
  splitCode: string;
  target: IntentTarget;
}): Promise<InitiateResult> {
  const { chamaId, chamaName, memberId, memberName, phone, provider, fees, splitCode, target } =
    params;

  const targetError = validateIntentTarget(target);
  if (targetError) {
    logger.error('MyChama intent refused: incomplete target', { chamaId, memberId, purpose: target.purpose, targetError });
    return { success: false, error: targetError };
  }

  const duplicate = await findDuplicatePendingIntent(chamaId, memberId, target, fees.net);
  if (duplicate) {
    return { success: false, duplicate: true, reference: duplicate.reference, error: 'duplicate_pending' };
  }

  const reference = buildReference(chamaId, target.purpose);
  const normalized = normalizePhone(phone);
  const now = Date.now();

  const intent: Omit<PaymentIntent, 'id'> = {
    chamaId,
    memberId,
    purpose: target.purpose,
    reference,
    amount: fees.net,
    grossAmount: fees.gross,
    paystackFee: fees.paystackFee,
    ourFee: fees.ourFee,
    currency: 'KES',
    phone: normalized,
    provider,
    status: 'pending',
    channel: 'whatsapp',
    contributionId: target.contributionId,
    loanId: target.loanId,
    installmentNo: target.installmentNo,
    potId: target.potId,
    potPeriod: target.potPeriod,
    arrearId: target.arrearId,
    splitCode,
    createdAt: now,
    updatedAt: now,
    expiresAt: now + 30 * 60 * 1000,
  };

  // Reference is the document ID: idempotent by construction, and the webhook
  // can fetch the intent with a single get() instead of a query.
  const intentRef = mychamaDb().collection(mcPath.paymentIntents(chamaId)).doc(reference);
  await intentRef.set(intent);

  try {
    if (!MYCHAMA_PAYSTACK_SECRET_KEY.value()) {
      throw new Error('MyChama Paystack secret key not configured');
    }

    const payload = {
      email: `member-${memberId}@mychama.co.ke`,
      amount: Math.round(fees.gross * 100),
      currency: 'KES',
      mobile_money: {
        phone: normalized,
        provider: provider === 'airtel' ? 'airtel' : 'mpesa',
      },
      reference,
      split_code: splitCode,
      metadata: {
        // Same routing keys the app's initiatePayment sends, so the webhook
        // classifies bot and app payments identically instead of relying on
        // the reference prefix alone.
        chargeType: 'mychama_payment',
        targetProject: 'mychama1',
        chamaId,
        chamaName,
        memberId,
        memberName,
        purpose: target.purpose,
        contributionId: target.contributionId || null,
        loanId: target.loanId || null,
        installmentNo: target.installmentNo ?? null,
        potId: target.potId || null,
        potPeriod: target.potPeriod ?? null,
        arrearId: target.arrearId || null,
        netAmount: fees.net,
        paystackFee: fees.paystackFee,
        ourFee: fees.ourFee,
        channel: 'whatsapp',
        note: target.note || null,
      },
    };

    logger.info('Sending MyChama STK push', {
      chamaId,
      memberId,
      reference,
      purpose: target.purpose,
      gross: fees.gross,
    });

    const response = await axios.post<PaystackChargeResponse>(
      `${PAYSTACK_CONFIG.BASE_URL}/charge`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${MYCHAMA_PAYSTACK_SECRET_KEY.value()}`,
          'Content-Type': 'application/json',
        },
        timeout: 20000,
      }
    );

    const chargeStatus = response.data.data?.status;
    if (!response.data.status || chargeStatus === 'failed') {
      await intentRef.update({
        status: 'failed',
        paystackMessage: response.data.message || 'Charge rejected',
        updatedAt: Date.now(),
      });

      logger.warn('MyChama STK push rejected by Paystack', {
        reference,
        message: response.data.message,
      });

      return { success: false, error: response.data.message || 'Charge rejected' };
    }

    await intentRef.update({
      paystackMessage: response.data.data?.display_text || response.data.message || '',
      updatedAt: Date.now(),
    });

    logger.info('MyChama STK push accepted', { reference });

    return { success: true, reference };
  } catch (error) {
    const message =
      axios.isAxiosError(error)
        ? error.response?.data?.message || error.message
        : error instanceof Error
        ? error.message
        : 'Unknown error';

    await intentRef
      .update({ status: 'failed', paystackMessage: message, updatedAt: Date.now() })
      .catch(() => undefined);

    logger.error('MyChama STK push failed', { reference, message });

    return { success: false, error: message };
  }
}

/** Used by the statement flow to surface payments still awaiting confirmation. */
export async function getPendingIntents(
  chamaId: string,
  memberId: string,
  limit = 5
): Promise<PaymentIntent[]> {
  const snap = await mychamaDb()
    .collection(mcPath.paymentIntents(chamaId))
    .where('memberId', '==', memberId)
    .where('status', '==', 'pending')
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  return snap.docs
    .map((d) => ({ ...(d.data() as PaymentIntent), id: d.id }))
    .filter((i) => i.expiresAt > Date.now());
}

export const MYCHAMA_INTENTS_COLLECTION = MC.PAYMENT_INTENTS;
