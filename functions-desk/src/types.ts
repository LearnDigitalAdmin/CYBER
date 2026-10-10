/** Backend-only document shapes. Client-visible shapes live in contract.ts. */
import type {
  AgentStatus, EntityKey, RentBatchResult, RentBatchStatus, LedgerKind, LedgerStatus, OtpAction, Product, Rank, Scope,
  ServiceType, SessionStatus, TicketStatus, TopAction, DocKind, RequestStatus, RequestResponse,
} from "./contract.js";

export interface AgentDoc {
  agentId: string; agentCode: string; name: string; phone: string; email: string; idHash: string; idNumberMasked: string;
  status: AgentStatus; rank: Rank; wardId: string; termsAcceptedAt?: number; createdAt: number;
  /** Paystack transfer recipient for automatic support payouts (created on first payout). */
  payoutRecipientCode?: string;
  statusReason?: string; closedAt?: number;
}
export interface CustomerDoc {
  entityKey: EntityKey; product: Product; ownerAgentId: string; attributedAt: number;
  firstPurchaseUsed: boolean;
  /** PAY reserves the first-purchase rule inside a transaction when a charge starts; the events trigger finalises it. */
  firstPurchaseReservedRef?: string; firstPurchaseReservedAt?: number;
  lastPaidAt?: number; selfOwned?: boolean; refunded?: boolean;
  /** Sorted unique "YYYY-MM" periods with a successful subscription payment (written only by the events trigger). */
  paidPeriods: string[];
}
export interface SessionDoc {
  sessionId: string; agentId: string; entityKey: EntityKey; scopes: Scope[];
  status: SessionStatus; otpHash?: string; otpAttempts: number; otpExpiresAt: number;
  otpVerifiedAt?: number; expiresAt: number; createdAt: number;
}
export interface ActionOtpDoc {
  actionId: string; sessionId: string; agentId: string; action: OtpAction; summary: string;
  otpHash: string; otpAttempts: number; otpExpiresAt: number; verifiedAt?: number; consumedAt?: number; createdAt: number;
}
export interface TicketDoc {
  ticketId: string; agentId: string; entityKey: EntityKey; sessionId: string;
  serviceType: ServiceType; amountMinor: number; draft: Record<string, unknown>;
  status: TicketStatus; paystackRef?: string; splitCode?: string;
  grossMinor?: number; feeMinor?: number; agentMinor?: number; platformMinor?: number;
  failureReason?: string; createdAt: number; updatedAt: number;
}

/**
 * Create-only facts written by PAY (and product repos) AFTER a split charge succeeds.
 * `eventId` = `<type>:<paystackRef>` so a replayed webhook can never double-count.
 */
export type DeskEventType =
  | "sms_purchase" | "subscription_payment" | "report_purchase" | "rent_payment" | "refund";
export interface DeskEventDoc {
  eventId: string; type: DeskEventType; product: Product; entityKey: EntityKey;
  agentId: string; paystackRef: string; grossMinor: number; feeMinor: number;
  /** The exact share % that was put into the Paystack split for the agent on this charge. */
  agentSharePct: number; paidAt: number;
  credits?: number; plan?: string; periodMonth?: string; originalRef?: string;
}

export interface LedgerDoc {
  entryId: string; agentId: string; kind: LedgerKind; amountMinor: number; status: LedgerStatus;
  product?: Product; entityKey?: EntityKey; paystackRef?: string; sourceId?: string;
  grossMinor?: number; feeMinor?: number; sharePct?: number; rule?: string; note?: string;
  createdAt: number; paidAt?: number; transferRef?: string; transferCode?: string;
}

export interface SessionContext {
  sessionId: string; agentId: string; entityKey: EntityKey; product: Product;
  scopes: Scope[]; expiresAt: number;
}
export interface AuditEntry {
  action: string; agentId?: string; entityKey?: EntityKey; sessionId?: string; meta?: Record<string, unknown>;
}
export interface RequireSessionArgs { sessionId: string; uid: string; scope: Scope; action?: OtpAction; actionId?: string }

export interface RentBatchDoc {
  batchId: string; agentId: string; sessionId: string; entityKey: EntityKey; tenantIds: string[];
  status: RentBatchStatus; results: RentBatchResult[]; createdAt: number; updatedAt: number;
}

export interface SupportDoc {
  id: string; agentId: string; entityKey: EntityKey; category: string; notes: string;
  codeHash: string; codeAttempts: number; codeExpiresAt: number;
  customerConfirmedAt?: number; paidMonth?: string; createdAt: number;
}

export interface TopOtpDoc {
  actionId: string; uid: string; action: TopAction; summary: string;
  otpHash: string; otpAttempts: number; otpExpiresAt: number; verifiedAt?: number; consumedAt?: number; createdAt: number;
}
export interface DocMetaDoc {
  id: string; uid: string; kind: DocKind; contentType: string; sizeBytes: number; path: string; uploadedAt: number;
}
/** Desk's copy of a support request, keyed `<source>_<entityCode>_<outboxId>` so a re-pull can never duplicate it. */
export interface DeskRequestDoc {
  id: string; source: Product | "desk"; entityCode: string; entityName: string;
  requesterName: string; requesterPhone: string; category: string; subject: string; message: string;
  status: RequestStatus; targetDeskCodes: string[]; responses: RequestResponse[];
  createdAt: number; updatedAt: number; outboxId?: string;
}
