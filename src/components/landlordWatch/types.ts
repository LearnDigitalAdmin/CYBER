// Wire types of the Landlord Watch contract (v1.1). The server decides what is masked; this module only renders it.
export type MaskLevel = 'full' | 'tenant' | 'open';
export type Lang = 'en' | 'sw';

/** A number that can be masked. Always render `d`; `v` is null when masked. */
export interface N { v: number | null; d: string }

export type TenantStatus = 'paid' | 'partial' | 'unpaid' | 'no_invoice' | 'masked';

export interface TenantRow {
  ref: string; name: string; phone: string; unit: string | null; status: TenantStatus;
  rent: N; billed: N; paid: N; balance: N;
  dueDate: string | null; paidOn: string | null; paidOnTime: boolean | null;
}

export interface Statement {
  source: 'agent' | 'estimate';
  status: 'draft' | 'finalized' | 'sent' | 'acknowledged' | null;
  notes: string | null;
  items: { label: string; kind: 'income' | 'deduction'; amount: N }[];
  income: N; deductions: N; netPayable: N;
}

export interface Snapshot {
  schema: 1; ownerId: string; month: string; generatedAt: string;
  mask: { level: MaskLevel; reason: 'locked' | 'otp' | 'auth_phone_match' | 'channel_policy'; unlockedUntil: string | null; canUnlock: boolean };
  property: { name: string; address: string | null; maxUnits: N; commissionRatePct: N; managedByAgency: boolean };
  months: string[];
  summary: {
    tenants: { active: N; occupiedUnits: N; vacantUnits: N; occupancyPct: N };
    invoices: { total: N; paid: N; partial: N; unpaid: N; noInvoice: N };
    billed: N; collected: N; pending: N; collectionRatePct: N;
    baseRent: { billed: N; collected: N };
    commission: { ratePct: N; onCollected: N; onExpected: N };
    net: { expected: N; payable: N; stillToCollect: N };
    statement: Statement;
    remittance: { dueDate: string; collectedByDue: N; collectedAfterDue: N; netByDue: N; netAfterDue: N };
  };
  tenants: TenantRow[];
  trend: { month: string; billed: N; collected: N; pending: N; netPayable: N }[];
}

export interface LookupResult {
  found: boolean;
  property?: { ownerId: string; name: string; address: string | null; ownerPhoneMasked: string; managedByAgency: boolean };
}

export interface OtpSent { sentTo: string; expiresInSec: number; resendInSec: number }

export interface Quota { period: string; freeLimit: 1; freeUsed: number; nextPriceKes: 0 | 99 }

export type TranscriptState =
  | 'otp_pending' | 'payment_required' | 'payment_pending' | 'paid' | 'generating' | 'ready' | 'failed' | 'expired';

export interface TranscriptRequest {
  requestId: string; ownerId: string; month: string; state: TranscriptState; priceKes: 0 | 99;
  sentTo?: string; expiresInSec?: number; resendInSec?: number;
  url?: string; expiresAt?: string; reference?: string; message?: string;
  error?: { code: string; message: string }; createdAt: string;
}
