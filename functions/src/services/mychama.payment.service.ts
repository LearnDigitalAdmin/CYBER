/**
 * MyChama Payment Service
 *
 * Raises a payment intent in the mychama1 project and pushes an STK prompt via
 * Paystack's /charge mobile_money endpoint, routing funds to the chama through
 * its settlement split code.
 *
 * Deliberately NOT here: any balance mutation. The intent is the bot's only
 * financial write. MyChama's own Paystack webhook matches on `reference`,
 * applies the money to the contribution / instalment / pot period, and writes
 * the transaction. That single-writer rule is what makes a bot retry, a
 * duplicate webhook or a mid-flow crash all safe.
 */

import axios from 'axios';
import { PAYSTACK_SECRET_KEY, PAYSTACK_CONFIG } from '../config/paystack.config';
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
  note?: string;
}

export interface InitiateResult {
  success: boolean;
  reference?: string;
  error?: string;
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
    if (!PAYSTACK_SECRET_KEY.value()) {
      throw new Error('Paystack secret key not configured');
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
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY.value()}`,
          'Content-Type': 'application/json',
        },
        timeout: 20000,
      }
    );

    if (!response.data.status) {
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
