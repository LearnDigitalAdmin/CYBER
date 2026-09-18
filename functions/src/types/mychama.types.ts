/**
 * MyChama Types
 *
 * These interfaces are the TypeScript mirror of firestoreData.json.
 * If you change a field here, change it there too — the live MyChama app is
 * built from that file and the WhatsApp bot is built from this one.
 */

export type ChamaPlan = 'free' | 'starter' | 'basic' | 'growth' | 'max';
export type MemberRole = 'chair' | 'treasurer' | 'secretary' | 'member';
export type PayMethod = 'paystack' | 'manual' | null;

export interface Chama {
  id: string;
  name: string;
  motto?: string;
  plan: ChamaPlan;
  planExpiry?: string;
  autoRenew?: boolean;
  contributionAmount: number;
  contributionCycle: 'daily' | 'weekly' | 'monthly';
  smsCredits?: number;
  settlementAccount?: string;
  settlementSplitCode?: string;
  autoSettle?: boolean;
  settlementFreq?: 'daily' | 'weekly' | 'monthly';
  lastSettlement?: string;
  minutesExportsUsedThisMonth?: number;
  status: 'active' | 'suspended';
  whatsappEnabled?: boolean;
}

export interface ChamaMember {
  id: string;
  memberId: string;
  chamaId?: string;
  uid?: string | null;
  name: string;
  phone: string;
  phoneNormalized: string;
  role: MemberRole;
  isAdmin: boolean;
  idNumber: string;
  idLast4: string;
  nationalIdMasked: string;
  joinDate: string;
  status: 'active' | 'inactive' | 'suspended';
  totalContributed: number;
  creditBalance: number;
  avatarColor?: string;
  initial?: string;
  whatsappOptIn?: boolean;
}

export interface LoanProduct {
  id: string;
  name: string;
  type: 'flat' | 'reducing';
  rate: number;
  maxAmount: number;
  maxTerm: number;
  desc: string;
  active: boolean;
}

export type ContributionStatus = 'pending' | 'partial' | 'paid' | 'overdue';

export interface Contribution {
  id: string;
  memberId: string;
  period: string;
  periodKey: string;
  amount: number;
  paidAmount: number;
  status: ContributionStatus;
  method: PayMethod;
  paidOn: string | null;
  ref: string | null;
  dueDate?: string;
}

export interface LoanInstallment {
  n: number;
  due: number;
  principalPart: number;
  interestPart: number;
  opening: number;
  closing: number;
  paid: boolean;
  paidAmount: number;
  dueDate: string;
}

export type LoanStatus =
  | 'pending_approval'
  | 'awaiting_treasurer'
  | 'approved'
  | 'active'
  | 'overdue'
  | 'completed'
  | 'rejected';

export interface Loan {
  id: string;
  memberId: string;
  productId: string;
  principal: number;
  term: number;
  purpose?: string;
  status: LoanStatus;
  approvals: { chair: boolean; treasurer: boolean };
  requestedOn: string;
  disbursedOn: string | null;
  method: PayMethod;
  installment: number;
  totalInterest: number;
  totalPay: number;
  schedule: LoanInstallment[];
  source?: 'app' | 'whatsapp';
}

export interface MgrPot {
  id: string;
  name: string;
  amount: number;
  frequency: 'daily' | 'weekly' | 'monthly';
  periodsPerRound: number;
  recipientsPerRound: number;
  memberIds: string[];
  queue: string[];
  drawDone: boolean;
  drawMethod: 'smart' | 'random' | null;
  autoDemoteLate: boolean;
  status: 'draft' | 'active' | 'completed';
  cycleNumber: number;
  period: number;
  createdOn: string;
}

export interface MgrRecord {
  id: string;
  period: number;
  memberId: string;
  status: 'paid' | 'missed' | 'pending';
  amount: number;
  date: string | null;
  method: PayMethod;
  ref?: string | null;
}

export interface MgrPayout {
  id: string;
  memberId: string;
  round: number;
  amount: number;
  date: string;
  method: PayMethod;
  ref?: string | null;
}

export type TransactionType =
  | 'contribution'
  | 'loan_disbursement'
  | 'loan_repayment'
  | 'mgr_contribution'
  | 'mgr_payout';

export interface ChamaTransaction {
  id: string;
  type: TransactionType;
  memberId: string;
  amount: number;
  grossAmount?: number;
  paystackFee?: number;
  ourFee?: number;
  method: PayMethod;
  ref: string;
  date: string;
  settled: boolean;
  direction: 'in' | 'out';
  note?: string;
  channel?: 'app' | 'whatsapp';
}

/** Result of the gross-up calculation quoted to a member before they pay. */
export interface FeeBreakdown {
  /** Amount that must land in the chama account. */
  net: number;
  /** Amount the member is actually charged. */
  gross: number;
  paystackFee: number;
  ourFee: number;
}

export type IntentPurpose = 'contribution' | 'loan_repayment' | 'mgr_contribution';
export type IntentStatus = 'pending' | 'success' | 'failed' | 'abandoned' | 'expired';

/**
 * A payment intent is the ONLY financial document the WhatsApp bot writes.
 * It records what the member asked to pay and the exact fee split quoted to
 * them. The MyChama Paystack webhook is what actually credits contributions,
 * loans and pots — so a bot outage can never leave money unaccounted for, and
 * a replayed webhook can never double-credit (reference is the idempotency key).
 */
export interface PaymentIntent {
  id: string;
  chamaId: string;
  memberId: string;
  purpose: IntentPurpose;
  reference: string;
  /** Net amount that must land in the chama account. */
  amount: number;
  /** What the member is actually charged (net + fees). */
  grossAmount: number;
  paystackFee: number;
  ourFee: number;
  currency: 'KES';
  phone: string;
  provider: 'mpesa' | 'airtel';
  status: IntentStatus;
  channel: 'whatsapp';
  /** Target of the payment — exactly one of these is set. */
  contributionId?: string;
  loanId?: string;
  installmentNo?: number;
  potId?: string;
  potPeriod?: number;
  splitCode?: string;
  paystackMessage?: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
}

/** Everything the bot keeps in the WhatsApp session for a MyChama conversation. */
export interface MyChamaSessionContext {
  chamaId?: string;
  chamaName?: string;
  memberId?: string;
  memberName?: string;
  role?: MemberRole;
  plan?: ChamaPlan;
  /** Unix seconds when identity was last verified. */
  authAt?: number;
  authAttempts?: number;
  lockedUntil?: number;
  /** Navigation back-stack of STATE values. */
  stack?: string[];
  /** Options rendered on the last numbered list, in display order. */
  options?: string[];
  /** Working values for the in-flight sub-flow. */
  contributionId?: string;
  loanId?: string;
  installmentNo?: number;
  potId?: string;
  potPeriod?: number;
  productId?: string;
  amount?: number;
  term?: number;
  purpose?: string;
  /** Shared payment sub-flow (phone → provider → confirm). */
  payPurpose?: IntentPurpose;
  payNet?: number;
  payLabel?: string;
  payPhone?: string;
  provider?: 'mpesa' | 'airtel';
  statementType?: 'contributions' | 'loans' | 'mgr' | 'full';
  /** Chama memberships discovered during auth, for the picker. */
  candidates?: Array<{ chamaId: string; chamaName: string; memberId: string }>;
}
