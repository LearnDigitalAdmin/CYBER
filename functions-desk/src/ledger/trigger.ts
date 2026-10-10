/** desk_onCyberTransaction logic: a PAY webhook (or desk) moved a desk charge's cyber-transactions document. */
import * as logger from "firebase-functions/logger";
import { parseDeskReference } from "../charge/reference.js";
import { DEAD_PAYSTACK_STATUSES, isReferenceNotFound, resolveDeps, type DeskDeps } from "../charge/port.js";
import { DESK_REF_PREFIX } from "../contract.js";
import { audit } from "../kernel/audit.js";
import { failTicketAttempt, settleTicketReference } from "./settle.js";

export interface CyberTxData { status?: unknown; deskTicketId?: unknown }
const FAILURE_STATUSES: ReadonlySet<string> = new Set(["failed", "abandoned"]);

/**
 * Desk charges only. Success is re-examined on every write (settlement is idempotent, so a replayed webhook is harmless and
 * a missed first invocation is recoverable); failure only when the status actually changed to it.
 */
export function shouldProcessTransactionChange(reference: string, before: CyberTxData | undefined, after: CyberTxData | undefined): boolean {
  if (!after || !reference.startsWith(DESK_REF_PREFIX)) return false;
  if (typeof after.deskTicketId !== "string" || after.deskTicketId.length === 0) return false;
  const status = String(after.status ?? "");
  if (status === "success") return true;
  return FAILURE_STATUSES.has(status) && before?.status !== after.status;
}

export async function handleCyberTransactionChange(
  reference: string, before: CyberTxData | undefined, after: CyberTxData | undefined, deps: DeskDeps = {},
): Promise<string> {
  if (!shouldProcessTransactionChange(reference, before, after)) return "ignored";
  const d = resolveDeps(deps);
  const ticketId = String(after!.deskTicketId);
  const parsed = parseDeskReference(reference);
  if (!parsed || parsed.ticketId !== ticketId) {
    await audit({ action: "ticket_reference_rejected", meta: { ticketId, reference, source: "webhook" } });
    return "rejected";
  }
  let verified;
  try {
    verified = await d.port.verifyTransaction(reference);
  } catch (err) {
    if (isReferenceNotFound(err)) {
      // the document claims a payment Paystack has never seen: record it, do not retry forever
      await audit({ action: "cyber_tx_unverifiable", meta: { ticketId, reference, claimed: String(after!.status) } });
      return "unverifiable";
    }
    throw err; // transient: the platform retries this invocation
  }
  if (verified.status === "success") {
    const out = await settleTicketReference({ ticketId, reference, source: "webhook", verified }, d);
    return out.kind;
  }
  if (DEAD_PAYSTACK_STATUSES.has(verified.status)) {
    const reason = typeof verified.raw.gateway_response === "string" && verified.raw.gateway_response.trim()
      ? verified.raw.gateway_response.trim() : "Payment was not completed";
    return (await failTicketAttempt({ ticketId, reference, reason, source: "webhook" }, d)) ? "failed" : "stale";
  }
  logger.info("desk charge not final at Paystack yet; the reconciler will settle it", { ticketId, reference, status: verified.status });
  return "pending";
}
