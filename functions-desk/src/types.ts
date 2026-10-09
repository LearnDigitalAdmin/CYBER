/** Backend-only document shapes. Client-visible shapes live in contract.ts. */
import type {
  AgentStatus, EntityKey, RentBatchResult, RentBatchStatus, LedgerKind, LedgerStatus, OtpAction, Product, Rank, Scope,
  ServiceType, SessionStatus, TicketStatus,
} from "./contract.js";

export interface AgentDoc {
  agentId: string; agentCode: string; name: string; phone: string; idHash: string;
  status: AgentStatus; rank: Rank; wardId: string; termsAcceptedAt?: number; createdAt: number;
}
export interface CustomerDoc {
  entityKey: EntityKey; product: Product; ownerAgentId: string; attributedAt: number;
  firstPurchaseUsed: boolean; paidMonths: number; lastPaidAt?: number; selfOwned?: boolean; refunded?: boolean;
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
