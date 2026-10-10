/**
 * SAMUHIA DESK — CONTRACT v2  (single source of truth)
 *
 * SELF-CONTAINED: no imports. Types, plain constants and tiny pure helpers only. The frontend copies this file verbatim to
 * src/desk/api/contract.ts via `npm run desk:sync-contract`. Do NOT edit it inside a task branch.
 *
 * All money is integer MINOR units (KES x 100). Timestamps are epoch milliseconds.
 * `agentId` IS the agent's Firebase Auth uid (desk_agents/{uid}); security rules rely on that.
 */

export const DESK_CONTRACT_VERSION = 4;
export const DESK_REGION = "africa-south1";

/** Desk charges use the existing CYBER_ payment reference family, so PAY's webhook already routes them. */
export const DESK_REF_PREFIX = "CYBER_DSK_";

/** Desk codes are COG-0001, COG-0002 … (zero-padded, at least 4 digits). COG-0000 is the company's top desk. */
export const DESK_CODE_PREFIX = "COG-";
export const DESK_TOP_CODE = "COG-0000";
/** Top-desk accounts must sign in with a verified address on this domain. */
export const SAMUHIA_EMAIL_DOMAIN = "samuhia.co.ke";

export type Product = "chama" | "school" | "pms";
export type Rank = "clerk" | "senior" | "lead";
export type AgentStatus = "applied" | "training" | "certified" | "active" | "suspended" | "closed";
export type SessionStatus = "pending" | "active" | "ended" | "expired";
export type TicketStatus =
  | "draft" | "awaiting_payment" | "paid" | "committed" | "failed" | "expired";
/**
 * settled  = already paid to the agent by Paystack's automatic split (recorded here for earnings/audit)
 * payable    = bonus / support payout waiting for the top desk to pay it
 * processing = Paystack transfer created, not yet confirmed
 * paid       = transfer confirmed against Paystack Transfers
 * void     = bonus withdrawn before payment
 */
export type LedgerStatus = "settled" | "payable" | "processing" | "paid" | "void";
export type LedgerKind = "service" | "commission" | "bonus" | "support" | "reversal";
export type ServiceType =
  | "import_excel" | "manual_entry" | "schedule_setup" | "bulk_reminder";
export type Scope =
  | "read" | "import" | "manual_entry" | "schedule" | "bulk_sms" | "report"
  | "export" | "rent_stk";
/** Actions that need a fresh per-action OTP on top of the session OTP. */
export type OtpAction = "bulk_sms" | "rent_stk" | "export";

/** "chama:SMC-0042" | "school:<KNEC code>" | "pms:<landlordCode>" */
export type EntityKey = string;

// ---------------------------------------------------------------- callables
export interface ApplyAgentIn { name: string; phone: string; idNumber: string; wardId: string }
export interface ApplyAgentOut { agentId: string; status: AgentStatus }

export interface ResolveEntityIn { code: string }
export interface ResolveEntityOut {
  entityKey: EntityKey; product: Product; displayName: string;
  adminPhoneMasked: string; agentHasGrant: boolean;
}

export interface RequestAccessIn { entityKey: EntityKey; scopes: Scope[] }
export interface RequestAccessOut { sessionId: string; otpSentTo: string }
export interface VerifyAccessIn { sessionId: string; otp: string }
export interface VerifyAccessOut { expiresAt: number }

export interface RequestActionOtpIn { sessionId: string; action: OtpAction; summary: string }
export interface RequestActionOtpOut { actionId: string }
export interface VerifyActionOtpIn { actionId: string; otp: string }
export interface VerifyActionOtpOut { ok: boolean }

export interface EndSessionIn { sessionId: string }
export interface EndSessionOut { ok: boolean }

export interface ImportRow { [column: string]: string | number | null }
export interface ImportError { row: number; field: string; reason: string; suggestion?: string }
export interface ValidateImportIn { sessionId: string; rows: ImportRow[] }
export interface ValidateImportOut { valid: ImportRow[]; errors: ImportError[] }

export interface QuoteServiceIn {
  sessionId: string; serviceType: ServiceType;
  /** import_excel: {rowCount}; manual_entry: {recordCount}; schedule_setup: {}; bulk_reminder: {audience, message} */
  params: Record<string, number | string>;
}
export interface QuoteBreakdownLine { label: string; amountMinor: number }
export interface QuoteServiceOut { ticketId: string; amountMinor: number; breakdown: QuoteBreakdownLine[] }

export interface SaveDraftIn { ticketId: string; payload: Record<string, unknown> }
export interface SaveDraftOut { ok: boolean }

export interface ChargeTicketIn { ticketId: string; phone: string }
export interface ChargeTicketOut { reference: string; status: "awaiting_payment" }

export interface InitiateRentStkIn { sessionId: string; actionId: string; tenantIds: string[] }
export interface InitiateRentStkOut { batchId: string; count: number }
export type RentBatchStatus = "requested" | "processing" | "done" | "failed";
export interface RentBatchResult { tenantId: string; reference?: string; status: "sent" | "failed"; error?: string }
/** Written by desk (T5), executed by PAY (T9) which owns rent invoices and landlord subaccounts. */
export interface RentBatchView {
  batchId: string; entityKey: EntityKey; status: RentBatchStatus; count: number;
  results: RentBatchResult[]; createdAt: number; updatedAt: number;
}

export interface GetEarningsIn { from: number; to: number }
export interface EarningsByProduct { product: Product | "service" | "bonus" | "support"; amountMinor: number }
export interface GetEarningsOut {
  settledMinor: number; payableMinor: number; paidMinor: number;
  bonusProgress: { qualifyingAccounts: number; blocksPaid: number; bankedMinor: number; capMinor: number };
  byProduct: EarningsByProduct[];
}

export const SUPPORT_CATEGORIES = ["setup", "import", "sms", "payments", "reports", "other"] as const;
export type SupportCategory = typeof SUPPORT_CATEGORIES[number];
export interface LogSupportIn { entityKey: EntityKey; category: SupportCategory; notes: string }
/** A confirmation code is SMSed to the customer admin; the customer reads it to the agent, who enters it below. */
export interface LogSupportOut { id: string; codeSentTo: string }
export interface ConfirmSupportIn { id: string; code: string }
export interface ConfirmSupportOut { ok: boolean }

// ------------------------------------------------------------- documents, account, payout accounts
export const DOC_KINDS = ["id_front", "id_back", "selfie"] as const;
export type DocKind = typeof DOC_KINDS[number];
export const DOC_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export const DOC_MAX_BYTES = 4 * 1024 * 1024;
export interface UploadDocIn { kind: DocKind; contentType: typeof DOC_CONTENT_TYPES[number]; dataBase64: string }
export interface UploadDocOut { ok: boolean }
export interface DocStatus { kind: DocKind; uploadedAt?: number; contentType?: string; sizeBytes?: number }
export interface ListMyDocsIn { _?: never }
export interface ListMyDocsOut { docs: DocStatus[] }

/** One entry per Paystack account the agent needs a subaccount in ("main" plus any product with its own account). */
export interface PayoutAccountStatus { account: "main" | Product; ready: boolean; reason?: string }
export interface SyncPayoutAccountsIn { _?: never }
export interface SyncPayoutAccountsOut { accounts: PayoutAccountStatus[] }
export interface SyncEmailIn { _?: never }
export interface SyncEmailOut { email: string; changed: boolean }

// ------------------------------------------------------------- desk requests (support tab)
export type RequestStatus = "new" | "open" | "answered" | "closed";
export const REQUEST_CATEGORIES = ["setup", "import", "sms", "payments", "reports", "account", "other"] as const;
export interface RequestResponse { at: number; byDeskCode: string; text: string }
export interface RequestView {
  id: string; source: Product | "desk"; entityCode: string; entityName: string;
  requesterName: string; requesterPhone: string; category: string; subject: string; message: string;
  status: RequestStatus; targetDeskCodes: string[]; responses: RequestResponse[]; createdAt: number; updatedAt: number;
}
export interface ListRequestsIn { status?: RequestStatus; limit?: number; before?: number }
export interface ListRequestsOut { requests: RequestView[]; newCount: number }
export interface UpdateRequestIn { id: string; status: RequestStatus; response?: string }
export interface UpdateRequestOut { ok: boolean }
/** A desk asking the company's top desk for help. */
export interface CreateRequestIn { category: typeof REQUEST_CATEGORIES[number]; subject: string; message: string }
export interface CreateRequestOut { id: string }

/**
 * Products never call desk. Chama and Register write SUPPORT REQUESTS into their OWN `desk_requests` collection and desk's
 * 30-minute sweeper pulls them, then marks it `pulled` so it is never read twice (desk -> product access only, never the reverse).
 */
export type OutboxStatus = "new" | "pulled" | "rejected";
export interface OutboxSupportItem {
  kind: "support"; status: OutboxStatus; entityCode: string; entityName: string;
  requesterName: string; requesterPhone: string; category: string; subject: string; message: string;
  /** Always includes DESK_TOP_CODE when the customer chose it or has no connected desk. */
  targetDeskCodes: string[]; createdAt: number; pulledAt?: number; error?: string;
  /** Written back BY DESK after the sweep, so the customer sees progress. */
  deskStatus?: RequestStatus; responses?: RequestResponse[];
}
/** Payment facts never travel through the outbox: PAY's webhooks confirm every charge and write `desk_events` directly. */
export type OutboxItem = OutboxSupportItem;

/**
 * What DESK writes into the CHAMA project (desk -> product is the only direction). Chama charges through its own Paystack
 * account, so it needs the desk's subaccount IN THAT ACCOUNT at charge time. It records `deskCommission` on every intent it
 * splits, and PAY's MyChama webhook turns that into a `desk_events` row.
 *  - chama document field `deskOwner`: the owning desk and its subaccount in the MyChama Paystack account
 *  - document `desk_public_config/global`: the rates Chama must use when it builds a commission split
 * Register, Plot Yangu and desk services all charge through the MAIN account inside PAY, which reads `desk_customers` directly.
 */
export interface DeskOwnerInfo { agentCode: string; subaccountCode: string; rank: Rank; updatedAt: number }
export interface DeskPublicConfig {
  creditCostMinor: number; expectedPaystackFeePct: number; smsShareOfMarginPct: number; firstPurchaseThresholdMinor: number;
  subShareByRank: Record<Rank, number>; reportShareByRank: Record<Rank, number>; updatedAt: number;
}

// ------------------------------------------------------------- top desk (company desk COG-0000)
/** Every top-desk privilege is enforced server-side (verified @samuhia.co.ke account, recent sign-in, OTP). Never by rules. */
export type TopAction = "set_desk_status" | "set_rank" | "payout";
export const summaryTopStatus = (deskCode: string, status: string): string => `Set desk ${deskCode} to ${status}`;
export const summaryTopRank = (deskCode: string, rank: string): string => `Set desk ${deskCode} rank to ${rank}`;
export const summaryTopPayout = (totalMinor: number, desks: number): string =>
  `Pay KES ${(totalMinor / 100).toFixed(2)} to ${desks} desks`;

export interface TopRequestOtpIn { action: TopAction; summary: string }
export interface TopRequestOtpOut { actionId: string; otpSentTo: string }
export interface DeskSummaryRow {
  deskCode: string; agentId: string; name: string; phone: string; email: string;
  status: AgentStatus; rank: Rank; wardId: string; createdAt: number; docsUploaded: number;
}
export interface TopListDesksIn { status?: AgentStatus; search?: string; limit?: number }
export interface TopListDesksOut { desks: DeskSummaryRow[] }
export interface TopGetDeskIn { deskCode: string }
export interface TopGetDeskOut {
  desk: DeskSummaryRow & { idNumberMasked: string; termsAcceptedAt?: number; statusReason?: string };
  docs: DocStatus[];
  earnings: { settledMinor: number; payableMinor: number; paidMinor: number };
  payoutAccounts: PayoutAccountStatus[];
  recentAudit: { action: string; at: number }[];
}
export interface TopGetDocIn { deskCode: string; kind: DocKind }
export interface TopGetDocOut { contentType: string; dataBase64: string }
export interface TopSetDeskStatusIn { deskCode: string; status: AgentStatus; reason: string; actionId: string; otp: string }
export interface TopSetDeskStatusOut { ok: boolean }
export interface TopSetRankIn { deskCode: string; rank: Rank; actionId: string; otp: string }
export interface TopSetRankOut { ok: boolean }
export interface TopPayable {
  entryId: string; agentId: string; deskCode: string; name: string; kind: "bonus" | "support";
  amountMinor: number; note?: string; createdAt: number;
}
export interface TopListPayablesIn { _?: never }
export interface TopListPayablesOut { payables: TopPayable[]; dailyCapMinor: number; paidTodayMinor: number }
export interface TopPayoutIn { entryIds: string[]; actionId: string; otp: string }
export interface TopPayoutResult { entryId: string; status: "processing" | "paid" | "failed"; reference: string; error?: string }
export interface TopPayoutOut { results: TopPayoutResult[] }

/**
 * Per-action OTP summaries. The customer reads this text in their SMS, so it must describe what will really happen:
 * desk_requestActionOtp rejects any other format, and the executing function re-derives it and compares.
 */
export const EXPORT_KINDS = ["members", "students", "tenants", "reports"] as const;
export const summaryRentStk = (tenants: number): string => `Rent STK to ${tenants} tenants`;
export const summaryBulkSms = (recipients: number): string => `SMS to ${recipients} recipients`;
export const summaryExport = (kind: string): string => `Export ${kind}`;

// ---------------------------------------------------------------- delegate API (implemented BY each product)
/**
 * Desk never writes product data itself. Each product (Chama, Register, PMS) exposes ONE private HTTPS function
 * named exactly `deskdelegate` (lowercase, so the Cloud Run service name equals the function name) (Cloud Run invoker restricted to the CYBER compute service account) that runs the product's OWN
 * rules, limits, credit accounting and engines. Desk calls it with a Google ID token after requireSession().
 * The product also re-checks that `agentCode` is in the entity's supportAgents (defence in depth).
 */
export type DelegateAction =
  | "entity_info" | "validate_records" | "commit_records"
  | "schedule_sms" | "send_sms_now" | "run_report" | "export_data";
export interface DelegateRequest {
  action: DelegateAction;
  entityCode: string;          // SMC-0042 | KNEC code | PYL-0007
  agentCode: string;           // AGT-00012
  requestId: string;           // idempotency: a repeated requestId must not repeat the effect
  payload: Record<string, unknown>;
}
export interface DelegateError { code: string; message: string }
export type DelegateResponse<T> = { ok: true; result: T } | { ok: false; error: DelegateError };
export interface DelegateEntityInfo {
  /** Reject unless agentAuthorised; COG-0000 (top desk) is always authorised and cannot be removed by the customer. */
  displayName: string; adminName: string; adminPhone: string; agentAuthorised: boolean; plan: string;
  creditsBalance: number; audiences: string[]; reportTypes: string[]; exportKinds: string[];
}
export interface DelegateValidateResult { valid: ImportRow[]; errors: ImportError[] }
export interface DelegateCommitPayload { rows: ImportRow[]; source: "excel" | "manual" }
export interface DelegateCommitResult { created: number; skipped: number; errors: ImportError[] }
export interface DelegateSchedulePayload {
  name: string; message: string; audience: string; memberIds?: string[];
  schedule: { kind: "once" | "daily" | "weekly" | "monthly"; at: string; days?: number[] };
}
export interface DelegateScheduleResult { scheduleId: string; recipients: number; creditsPerRun: number }
/** dryRun: count recipients and credits WITHOUT sending or charging (used to quote and to build the OTP summary). */
export interface DelegateSendPayload { message: string; audience: string; memberIds?: string[]; dryRun?: boolean }
export interface DelegateSendResult { queued: number; creditsUsed: number; creditsRemaining: number }
export interface DelegateReportPayload { reportType: string; params: Record<string, unknown> }
export interface DelegateFileResult { downloadUrl: string; expiresAt: number }
export interface DelegateExportPayload { kind: string }

/** Product-side callables (Chama / Register / PMS repos) */
export interface SupportAgentIn { agentCode: string }
export interface SupportAgentOut { ok: boolean }
export interface SupportAgentView { agentCode: string; name: string; addedAt: number }
export interface ListSupportAgentsOut { agents: SupportAgentView[] }

export interface DeskCallableMap {
  desk_applyAgent: { in: ApplyAgentIn; out: ApplyAgentOut };
  desk_resolveEntity: { in: ResolveEntityIn; out: ResolveEntityOut };
  desk_requestAccess: { in: RequestAccessIn; out: RequestAccessOut };
  desk_verifyAccess: { in: VerifyAccessIn; out: VerifyAccessOut };
  desk_requestActionOtp: { in: RequestActionOtpIn; out: RequestActionOtpOut };
  desk_verifyActionOtp: { in: VerifyActionOtpIn; out: VerifyActionOtpOut };
  desk_endSession: { in: EndSessionIn; out: EndSessionOut };
  desk_validateImport: { in: ValidateImportIn; out: ValidateImportOut };
  desk_quoteService: { in: QuoteServiceIn; out: QuoteServiceOut };
  desk_saveDraft: { in: SaveDraftIn; out: SaveDraftOut };
  desk_chargeTicket: { in: ChargeTicketIn; out: ChargeTicketOut };
  desk_initiateRentStk: { in: InitiateRentStkIn; out: InitiateRentStkOut };
  desk_getEarnings: { in: GetEarningsIn; out: GetEarningsOut };
  desk_logSupport: { in: LogSupportIn; out: LogSupportOut };
  desk_confirmSupport: { in: ConfirmSupportIn; out: ConfirmSupportOut };
  desk_uploadDoc: { in: UploadDocIn; out: UploadDocOut };
  desk_listMyDocs: { in: ListMyDocsIn; out: ListMyDocsOut };
  desk_syncPayoutAccounts: { in: SyncPayoutAccountsIn; out: SyncPayoutAccountsOut };
  desk_syncEmail: { in: SyncEmailIn; out: SyncEmailOut };
  desk_listRequests: { in: ListRequestsIn; out: ListRequestsOut };
  desk_updateRequest: { in: UpdateRequestIn; out: UpdateRequestOut };
  desk_createRequest: { in: CreateRequestIn; out: CreateRequestOut };
  desk_top_requestOtp: { in: TopRequestOtpIn; out: TopRequestOtpOut };
  desk_top_listDesks: { in: TopListDesksIn; out: TopListDesksOut };
  desk_top_getDesk: { in: TopGetDeskIn; out: TopGetDeskOut };
  desk_top_getDoc: { in: TopGetDocIn; out: TopGetDocOut };
  desk_top_setDeskStatus: { in: TopSetDeskStatusIn; out: TopSetDeskStatusOut };
  desk_top_setRank: { in: TopSetRankIn; out: TopSetRankOut };
  desk_top_listPayables: { in: TopListPayablesIn; out: TopListPayablesOut };
  desk_top_payout: { in: TopPayoutIn; out: TopPayoutOut };
}
export type DeskCallableName = keyof DeskCallableMap;

export const DESK_CALLABLES = [
  "desk_applyAgent", "desk_resolveEntity", "desk_requestAccess", "desk_verifyAccess",
  "desk_requestActionOtp", "desk_verifyActionOtp", "desk_endSession", "desk_validateImport",
  "desk_quoteService", "desk_saveDraft", "desk_chargeTicket", "desk_initiateRentStk",
  "desk_getEarnings", "desk_logSupport", "desk_confirmSupport",
  "desk_uploadDoc", "desk_listMyDocs", "desk_syncPayoutAccounts", "desk_syncEmail",
  "desk_listRequests", "desk_updateRequest", "desk_createRequest",
  "desk_top_requestOtp", "desk_top_listDesks", "desk_top_getDesk", "desk_top_getDoc",
  "desk_top_setDeskStatus", "desk_top_setRank", "desk_top_listPayables", "desk_top_payout",
] as const;

// ------------------------------------------------- client-visible Firestore views
export interface AgentView {
  agentId: string; agentCode: string; name: string; status: AgentStatus; rank: Rank; wardId: string;
}
export interface SessionView {
  sessionId: string; entityKey: EntityKey; scopes: Scope[]; status: SessionStatus; expiresAt: number;
}
export interface TicketView {
  ticketId: string; entityKey: EntityKey; serviceType: ServiceType; amountMinor: number;
  status: TicketStatus; paystackRef?: string; failureReason?: string; updatedAt: number;
}
export interface LedgerEntryView {
  entryId: string; kind: LedgerKind; amountMinor: number; status: LedgerStatus;
  product?: Product; entityKey?: EntityKey; note?: string; createdAt: number; paidAt?: number;
}

/** Collection names (prefix `desk_` is mandatory: the Firebase project is shared with PAY and PMS). */
export const DESK_COLLECTIONS = {
  config: "desk_config",
  agents: "desk_agents",
  customers: "desk_customers",
  sessions: "desk_sessions",
  actionOtps: "desk_actionOtps",
  audit: "desk_audit",
  tickets: "desk_tickets",
  events: "desk_events",
  ledger: "desk_ledger",
  support: "desk_support",
  counters: "desk_counters",
  rentBatches: "desk_rent_batches",
  requests: "desk_requests",
  docs: "desk_docs",
  topOtps: "desk_topOtps",
  splitCodes: "desk_split_codes",
} as const;
