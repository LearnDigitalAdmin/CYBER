/**
 * MyChama Data Service
 *
 * Every read and write against the mychama1 project goes through here.
 * Handlers never touch Firestore directly — that keeps the schema contract in
 * one file and means a schema change is a one-file change.
 *
 * Money rules enforced in this layer:
 *   - The bot never mutates balances. It writes payment INTENTS; the MyChama
 *     Paystack webhook applies them. That makes a double-delivered webhook or
 *     a bot retry harmless.
 *   - The only member-originated business document the bot creates is a loan
 *     application, which carries no money and lands in `pending_approval`.
 */

import { Timestamp } from 'firebase-admin/firestore';
import { mychamaDb, mcPath, FEES, MC } from '../config/mychama.config';
import {
  Chama,
  ChamaMember,
  Contribution,
  Loan,
  LoanProduct,
  LoanInstallment,
  MgrPot,
  MgrRecord,
  ChamaTransaction,
  ChamaPlan,
  FeeBreakdown,
} from '../types/mychama.types';
import { logger } from '../utils/logger';

/* ------------------------------------------------------------------ *
 * Formatting & normalisation
 * ------------------------------------------------------------------ */

export function kes(amount: number): string {
  return 'KES ' + Math.round(amount).toLocaleString('en-KE');
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Normalise any Kenyan phone spelling to E.164 (+2547XXXXXXXX).
 * Members are indexed on this exact form, so both the app and the bot must
 * produce identical output — hence one shared implementation.
 */
export function normalizePhone(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');

  if (/^254[17]\d{8}$/.test(digits)) return '+' + digits;
  if (/^0[17]\d{8}$/.test(digits)) return '+254' + digits.substring(1);
  if (/^[17]\d{8}$/.test(digits)) return '+254' + digits;

  return digits ? '+' + digits : '';
}

/** Local display form (07XXXXXXXX) for anything shown to a member. */
export function localPhone(e164: string): string {
  const digits = String(e164 || '').replace(/\D/g, '');
  return digits.startsWith('254') ? '0' + digits.substring(3) : digits;
}

export function detectProvider(phone: string): 'mpesa' | 'airtel' {
  const local = localPhone(normalizePhone(phone));
  const prefix3 = local.slice(0, 3);
  const airtel = ['073', '075', '078'];
  return airtel.includes(prefix3) ? 'airtel' : 'mpesa';
}

/** Human month key used to sort contribution periods reliably. */
export function periodKeyOf(date: Date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

/* ------------------------------------------------------------------ *
 * Fee engine — must mirror the MyChama app exactly
 * ------------------------------------------------------------------ */

export type { FeeBreakdown };

export function paystackFeeFor(amount: number): number {
  return Math.min(amount * FEES.PAYSTACK_FEE_RATE, FEES.PAYSTACK_FEE_CAP);
}

/**
 * Gross-up: find the charge that leaves exactly `net` in the chama account
 * after Paystack's fee and the MyChama markup are both taken from the charge.
 */
export function grossUpForFees(net: number, ourRate: number): FeeBreakdown {
  let gross = net / (1 - FEES.PAYSTACK_FEE_RATE - ourRate);
  let pFee = gross * FEES.PAYSTACK_FEE_RATE;

  if (pFee > FEES.PAYSTACK_FEE_CAP) {
    gross = (net + FEES.PAYSTACK_FEE_CAP) / (1 - ourRate);
    pFee = FEES.PAYSTACK_FEE_CAP;
  }

  const ourFee = gross * ourRate;

  return {
    net,
    gross: Math.round(gross * 100) / 100,
    paystackFee: Math.round(pFee * 100) / 100,
    ourFee: Math.round(ourFee * 100) / 100,
  };
}

export function contributionFees(net: number): FeeBreakdown {
  return grossUpForFees(net, FEES.CONTRIBUTION_MARKUP_RATE);
}

export function loanRepaymentFees(net: number, plan: ChamaPlan): FeeBreakdown {
  const rate = FEES.LOAN_MARKUP_RATE[plan];
  return grossUpForFees(net, rate ?? 0);
}

export function canCollectOnline(plan: ChamaPlan): boolean {
  return plan !== 'free';
}

/* ------------------------------------------------------------------ *
 * Loan schedule maths — byte-for-byte the app's formulas
 * ------------------------------------------------------------------ */

export interface ScheduleResult {
  installment: number;
  totalInterest: number;
  totalPay: number;
  schedule: LoanInstallment[];
}

export function calcFlatSchedule(
  principal: number,
  monthlyRatePct: number,
  term: number
): ScheduleResult {
  const totalInterest = principal * (monthlyRatePct / 100) * term;
  const totalPay = principal + totalInterest;
  const installment = totalPay / term;
  const schedule: LoanInstallment[] = [];
  let bal = totalPay;

  for (let i = 1; i <= term; i++) {
    const closing = Math.max(0, bal - installment);
    schedule.push({
      n: i,
      due: installment,
      principalPart: principal / term,
      interestPart: totalInterest / term,
      opening: bal,
      closing,
      paid: false,
      paidAmount: 0,
      dueDate: addDaysISO(i * 30),
    });
    bal = closing;
  }

  return { installment, totalInterest, totalPay, schedule };
}

export function calcReducingSchedule(
  principal: number,
  annualRatePct: number,
  term: number
): ScheduleResult {
  const r = annualRatePct / 100 / 12;
  const installment =
    r === 0 ? principal / term : (principal * r * Math.pow(1 + r, term)) / (Math.pow(1 + r, term) - 1);

  let bal = principal;
  let totalInterest = 0;
  const schedule: LoanInstallment[] = [];

  for (let i = 1; i <= term; i++) {
    const interest = bal * r;
    const principalPart = installment - interest;
    const closing = Math.max(0, bal - principalPart);
    totalInterest += interest;

    schedule.push({
      n: i,
      due: installment,
      principalPart,
      interestPart: interest,
      opening: bal,
      closing,
      paid: false,
      paidAmount: 0,
      dueDate: addDaysISO(i * 30),
    });

    bal = closing;
  }

  return { installment, totalInterest, totalPay: principal + totalInterest, schedule };
}

export function buildSchedule(product: LoanProduct, principal: number, term: number): ScheduleResult {
  return product.type === 'flat'
    ? calcFlatSchedule(principal, product.rate, term)
    : calcReducingSchedule(principal, product.rate, term);
}

export function productRateLabel(p: LoanProduct, language: 'en' | 'sw'): string {
  if (p.type === 'flat') {
    return language === 'en'
      ? `${p.rate}% per month (flat)`
      : `${p.rate}% kwa mwezi (tambarare)`;
  }
  return language === 'en'
    ? `${p.rate}% p.a. (reducing balance)`
    : `${p.rate}% kwa mwaka (salio linalopungua)`;
}

/* ------------------------------------------------------------------ *
 * Membership lookup
 * ------------------------------------------------------------------ */

export interface Membership {
  chamaId: string;
  chamaName: string;
  member: ChamaMember;
}

/**
 * Find every chama this WhatsApp number belongs to.
 *
 * Uses a collection-group query on `members.phoneNormalized` rather than a
 * denormalised phone→member index, so there is no second document to drift out
 * of sync when a treasurer edits a member's number in the app.
 */
export async function findMembershipsByPhone(phone: string): Promise<Membership[]> {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    return [];
  }

  const db = mychamaDb();
  const snapshot = await db
    .collectionGroup(MC.MEMBERS)
    .where('phoneNormalized', '==', normalized)
    .limit(10)
    .get();

  if (snapshot.empty) {
    return [];
  }

  const memberships: Membership[] = [];

  for (const doc of snapshot.docs) {
    // Path shape: chamas/{chamaId}/members/{memberId}
    const chamaRef = doc.ref.parent.parent;
    if (!chamaRef) continue;

    const chamaSnap = await chamaRef.get();
    if (!chamaSnap.exists) continue;

    const chama = chamaSnap.data() as Chama;
    if (chama.status === 'suspended') continue;

    memberships.push({
      chamaId: chamaRef.id,
      chamaName: chama.name,
      member: { ...(doc.data() as ChamaMember), id: doc.id, memberId: doc.id },
    });
  }

  return memberships;
}

export async function getChama(chamaId: string): Promise<Chama | null> {
  const snap = await mychamaDb().doc(mcPath.chama(chamaId)).get();
  if (!snap.exists) return null;
  return { ...(snap.data() as Chama), id: snap.id };
}

export async function getMember(chamaId: string, memberId: string): Promise<ChamaMember | null> {
  const snap = await mychamaDb().doc(mcPath.member(chamaId, memberId)).get();
  if (!snap.exists) return null;
  return { ...(snap.data() as ChamaMember), id: snap.id, memberId: snap.id };
}

/**
 * Constant-time-ish comparison of the last 4 ID digits.
 * Not cryptographic, but it keeps the answer independent of how early a
 * mismatch occurs, and it tolerates stored values that were saved masked.
 */
export function verifyIdLast4(member: ChamaMember, input: string): boolean {
  const supplied = String(input || '').replace(/\D/g, '');
  if (supplied.length !== 4) return false;

  const stored = String(member.idLast4 || member.idNumber || '').replace(/\D/g, '');
  const expected = stored.slice(-4);
  if (expected.length !== 4) return false;

  let diff = 0;
  for (let i = 0; i < 4; i++) {
    diff |= supplied.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

/* ------------------------------------------------------------------ *
 * Contributions
 * ------------------------------------------------------------------ */

export async function getOutstandingContributions(
  chamaId: string,
  memberId: string
): Promise<Contribution[]> {
  const snap = await mychamaDb()
    .collection(mcPath.contributions(chamaId))
    .where('memberId', '==', memberId)
    .where('status', 'in', ['pending', 'partial', 'overdue'])
    .orderBy('periodKey', 'asc')
    .limit(12)
    .get();

  return snap.docs.map((d) => ({ ...(d.data() as Contribution), id: d.id }));
}

export async function getContribution(
  chamaId: string,
  contributionId: string
): Promise<Contribution | null> {
  const snap = await mychamaDb().collection(mcPath.contributions(chamaId)).doc(contributionId).get();
  if (!snap.exists) return null;
  return { ...(snap.data() as Contribution), id: snap.id };
}

export async function getContributionHistory(
  chamaId: string,
  memberId: string,
  sincePeriodKey: string | null,
  limit = 24
): Promise<Contribution[]> {
  let query = mychamaDb()
    .collection(mcPath.contributions(chamaId))
    .where('memberId', '==', memberId)
    .orderBy('periodKey', 'desc')
    .limit(limit);

  if (sincePeriodKey) {
    query = mychamaDb()
      .collection(mcPath.contributions(chamaId))
      .where('memberId', '==', memberId)
      .where('periodKey', '>=', sincePeriodKey)
      .orderBy('periodKey', 'desc')
      .limit(limit);
  }

  const snap = await query.get();
  return snap.docs.map((d) => ({ ...(d.data() as Contribution), id: d.id }));
}

export function contributionDue(c: Contribution): number {
  return Math.max(0, (c.amount || 0) - (c.paidAmount || 0));
}

/* ------------------------------------------------------------------ *
 * Loans
 * ------------------------------------------------------------------ */

export async function getLoanProducts(chamaId: string): Promise<LoanProduct[]> {
  const snap = await mychamaDb()
    .collection(mcPath.loanProducts(chamaId))
    .where('active', '==', true)
    .get();

  return snap.docs.map((d) => ({ ...(d.data() as LoanProduct), id: d.id }));
}

export async function getMemberLoans(
  chamaId: string,
  memberId: string,
  statuses?: string[]
): Promise<Loan[]> {
  let query = mychamaDb()
    .collection(mcPath.loans(chamaId))
    .where('memberId', '==', memberId)
    .orderBy('requestedOn', 'desc')
    .limit(20);

  if (statuses && statuses.length > 0) {
    query = mychamaDb()
      .collection(mcPath.loans(chamaId))
      .where('memberId', '==', memberId)
      .where('status', 'in', statuses)
      .orderBy('requestedOn', 'desc')
      .limit(20);
  }

  const snap = await query.get();
  return snap.docs.map((d) => ({ ...(d.data() as Loan), id: d.id }));
}

export async function getLoan(chamaId: string, loanId: string): Promise<Loan | null> {
  const snap = await mychamaDb().collection(mcPath.loans(chamaId)).doc(loanId).get();
  if (!snap.exists) return null;
  return { ...(snap.data() as Loan), id: snap.id };
}

export function loanOutstanding(loan: Loan): number {
  return (loan.schedule || []).reduce(
    (sum, s) => sum + Math.max(0, (s.due || 0) - (s.paidAmount || 0)),
    0
  );
}

export function loanPaid(loan: Loan): number {
  return (loan.schedule || []).reduce((sum, s) => sum + (s.paidAmount || 0), 0);
}

/** The first instalment that still has a balance — what a repayment targets. */
export function nextUnpaidInstallment(loan: Loan): LoanInstallment | null {
  return (loan.schedule || []).find((s) => (s.due || 0) - (s.paidAmount || 0) > 0.009) || null;
}

/**
 * Create a loan application. Status is always `pending_approval` with both
 * approvals false — the bot can request a loan, never grant one.
 */
export async function createLoanApplication(params: {
  chamaId: string;
  memberId: string;
  product: LoanProduct;
  principal: number;
  term: number;
  purpose: string;
}): Promise<{ loanId: string; schedule: ScheduleResult }> {
  const { chamaId, memberId, product, principal, term, purpose } = params;
  const calc = buildSchedule(product, principal, term);
  const now = Date.now();

  const loan: Omit<Loan, 'id'> & { createdAt: number; updatedAt: number } = {
    memberId,
    productId: product.id,
    principal,
    term,
    purpose,
    status: 'pending_approval',
    approvals: { chair: false, treasurer: false },
    requestedOn: todayISO(),
    disbursedOn: null,
    method: null,
    installment: calc.installment,
    totalInterest: calc.totalInterest,
    totalPay: calc.totalPay,
    schedule: calc.schedule,
    source: 'whatsapp',
    createdAt: now,
    updatedAt: now,
  };

  const ref = await mychamaDb().collection(mcPath.loans(chamaId)).add(loan);

  logger.info('MyChama loan application created', {
    chamaId,
    memberId,
    loanId: ref.id,
    principal,
    term,
  });

  return { loanId: ref.id, schedule: calc };
}

/* ------------------------------------------------------------------ *
 * Merry-go-round
 * ------------------------------------------------------------------ */

export async function getMemberPots(chamaId: string, memberId: string): Promise<MgrPot[]> {
  const snap = await mychamaDb()
    .collection(mcPath.mgrPots(chamaId))
    .where('memberIds', 'array-contains', memberId)
    .where('status', 'in', ['active', 'draft'])
    .limit(10)
    .get();

  return snap.docs.map((d) => ({ ...(d.data() as MgrPot), id: d.id }));
}

export async function getPot(chamaId: string, potId: string): Promise<MgrPot | null> {
  const snap = await mychamaDb().collection(mcPath.mgrPots(chamaId)).doc(potId).get();
  if (!snap.exists) return null;
  return { ...(snap.data() as MgrPot), id: snap.id };
}

export async function getPotRecordsForMember(
  chamaId: string,
  potId: string,
  memberId: string,
  limit = 50
): Promise<MgrRecord[]> {
  const snap = await mychamaDb()
    .collection(mcPath.mgrRecords(chamaId, potId))
    .where('memberId', '==', memberId)
    .orderBy('period', 'desc')
    .limit(limit)
    .get();

  return snap.docs.map((d) => ({ ...(d.data() as MgrRecord), id: d.id }));
}

export function potPoolEstimate(pot: MgrPot): number {
  return (pot.amount || 0) * (pot.memberIds?.length || 0) * (pot.periodsPerRound || 1);
}

export function queuePosition(pot: MgrPot, memberId: string): number {
  const idx = (pot.queue || []).indexOf(memberId);
  return idx === -1 ? 0 : idx + 1;
}

/* ------------------------------------------------------------------ *
 * Transactions (read-only from the bot)
 * ------------------------------------------------------------------ */

export async function getMemberTransactions(
  chamaId: string,
  memberId: string,
  sinceISO: string | null,
  limit = 40
): Promise<ChamaTransaction[]> {
  let query = mychamaDb()
    .collection(mcPath.transactions(chamaId))
    .where('memberId', '==', memberId)
    .orderBy('date', 'desc')
    .limit(limit);

  if (sinceISO) {
    query = mychamaDb()
      .collection(mcPath.transactions(chamaId))
      .where('memberId', '==', memberId)
      .where('date', '>=', sinceISO)
      .orderBy('date', 'desc')
      .limit(limit);
  }

  const snap = await query.get();
  return snap.docs.map((d) => ({ ...(d.data() as ChamaTransaction), id: d.id }));
}

/* ------------------------------------------------------------------ *
 * Audit trail
 * ------------------------------------------------------------------ */

export async function auditWhatsApp(entry: {
  phone: string;
  chamaId?: string;
  memberId?: string;
  action: string;
  outcome: 'success' | 'failure' | 'denied';
  detail?: Record<string, unknown>;
}): Promise<void> {
  try {
    await mychamaDb()
      .collection(MC.WHATSAPP_AUDIT)
      .add({
        ...entry,
        detail: entry.detail || {},
        channel: 'whatsapp',
        at: Timestamp.now(),
        createdAt: Date.now(),
      });
  } catch (error) {
    // Auditing must never break the member's conversation.
    logger.warn('Failed to write MyChama audit entry', { action: entry.action });
  }
}
