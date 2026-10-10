/**
 * The `cyber-transactions/{reference}` document and the Paystack metadata, in exactly the shape PAY's chargeCustomer writes
 * (LearnDigitalAdmin/PAY functions/src/index.ts): same field names and the same units. `amount` and `metadata.originalAmount`
 * are KES (major units) as in PAY; the Paystack request itself carries minor units. Desk adds deskTicketId, deskAgentId,
 * entityKey and serviceType. PAY's webhook (handleCyberCharge) reads `uid`, `pId` and `service` from this document.
 */
import { FieldValue } from "firebase-admin/firestore";
import type { AgentPayment } from "../kernel/agents.js";
import type { DeskTicket } from "../tickets/model.js";

export const CYBER_TRANSACTIONS = "cyber-transactions";
/** PAY's chargeType for CYBER_ charges. */
export const CYBER_CHARGE_TYPE = "cyber_service";

export interface CyberChargeFacts {
  pay: AgentPayment; ticket: DeskTicket; reference: string; phoneE164: string; splitCode: string; commissionRate: number;
}
const kes = (minor: number): number => minor / 100;

export function buildChargeMetadata(f: CyberChargeFacts): Record<string, unknown> {
  return {
    pId: f.pay.pId,
    uid: f.pay.uid,
    agentId: f.pay.id,
    service: f.ticket.serviceType,
    originalAmount: kes(f.ticket.amountMinor),
    chargeType: CYBER_CHARGE_TYPE,
    commissionRate: f.commissionRate,
    deskTicketId: f.ticket.ticketId,
    deskAgentId: f.ticket.agentId,
    entityKey: f.ticket.entityKey,
    serviceType: f.ticket.serviceType,
  };
}

export function buildCyberTransaction(f: CyberChargeFacts): Record<string, unknown> {
  return {
    pId: f.pay.pId,
    uid: f.pay.uid,
    agentId: f.pay.id,
    service: f.ticket.serviceType,
    phone: f.phoneE164,
    amount: kes(f.ticket.amountMinor),
    currency: "KES",
    status: "pending",
    reference: f.reference,
    splitCode: f.splitCode,
    subaccountCode: f.pay.subaccountCode,
    commissionRate: f.commissionRate,
    createdAt: FieldValue.serverTimestamp(),
    deskTicketId: f.ticket.ticketId,
    deskAgentId: f.ticket.agentId,
    entityKey: f.ticket.entityKey,
    serviceType: f.ticket.serviceType,
  };
}
