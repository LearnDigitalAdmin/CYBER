/**
 * desk_reconcileTickets — recovers what the webhook trigger missed and clears what can never complete. At most 100 tickets per run.
 *   awaiting_payment older than 3 min : verify with Paystack -> paid (same settle path) / failed; pending > 15 min -> expired
 *   draft older than 24 h             : expired (its saved draft chunks are deleted)
 */
import * as logger from "firebase-functions/logger";
import { DEAD_PAYSTACK_STATUSES, isReferenceNotFound, resolveDeps, type DeskDeps } from "../charge/port.js";
import { MAX_CHARGE_ATTEMPTS } from "../charge/chargeTicket.js";
import { col, db } from "../db.js";
import { audit } from "../kernel/audit.js";
import { isSettled, type DeskTicket } from "../tickets/model.js";
import { decideTicket, type AttemptStatus } from "./plan.js";
import { failTicketAttempt, settleTicketReference } from "./settle.js";

export const RECONCILE_MAX_PER_RUN = 100;
export const AWAITING_MIN_AGE_MS = 3 * 60_000;
export const DRAFT_MAX_AGE_MS = 24 * 3_600_000;

export interface ReconcileSummary { checked: number; paid: number; failed: number; expired: number; draftsExpired: number; waiting: number; errors: number }

async function expireTicket(ticketId: string, expected: "awaiting_payment" | "draft", reason: string, d: ReturnType<typeof resolveDeps>): Promise<DeskTicket | undefined> {
  const ref = col("tickets").doc(ticketId);
  const cutoff = d.now() - (expected === "draft" ? DRAFT_MAX_AGE_MS : AWAITING_MIN_AGE_MS);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const t = snap.data() as DeskTicket | undefined;
    if (!t || t.status !== expected || t.updatedAt >= cutoff) return undefined;
    tx.update(ref, { status: "expired", failureReason: reason, updatedAt: d.now() });
    return t;
  });
}

async function deleteDraftChunks(ticketId: string): Promise<void> {
  const chunks = await col("tickets").doc(ticketId).collection("draft").get();
  if (chunks.empty) return;
  const batch = db().batch();
  for (const c of chunks.docs) batch.delete(c.ref);
  await batch.commit();
}

async function reconcileAwaiting(t: DeskTicket, d: ReturnType<typeof resolveDeps>, s: ReconcileSummary): Promise<void> {
  const refs = [...(t.attemptRefs ?? (t.paystackRef ? [t.paystackRef] : []))].slice(-MAX_CHARGE_ATTEMPTS);
  const attempts: AttemptStatus[] = [];
  let unreadable = false;
  for (const ref of refs) {
    try {
      const v = await d.port.verifyTransaction(ref);
      const reason = typeof v.raw.gateway_response === "string" ? v.raw.gateway_response : undefined;
      attempts.push({ ref, status: v.status, reason });
      if (v.status === "success") {
        const out = await settleTicketReference({ ticketId: t.ticketId, reference: ref, source: "reconciler", verified: v }, d);
        if (out.kind === "paid" || out.kind === "mismatch") { s[out.kind === "paid" ? "paid" : "failed"]++; return; }
        return;
      }
    } catch (err) {
      if (isReferenceNotFound(err)) attempts.push({ ref, status: "not_found" });
      else { unreadable = true; logger.warn("reconcile: could not verify", { ticketId: t.ticketId, ref }); }
    }
  }
  if (unreadable) { s.errors++; return; } // never expire or fail on a transient Paystack error
  const age = d.now() - (t.chargeStartedAt ?? t.updatedAt);
  const decision = decideTicket(attempts, age, DEAD_PAYSTACK_STATUSES);
  if (decision.action === "fail") {
    const live = t.paystackRef;
    if (live && (await failTicketAttempt({ ticketId: t.ticketId, reference: live, reason: decision.reason, source: "reconciler" }, d))) s.failed++;
  } else if (decision.action === "expire") {
    const done = await expireTicket(t.ticketId, "awaiting_payment", "Payment was not completed in time", d);
    if (done) {
      s.expired++;
      await audit({ action: "ticket_expired", agentId: done.agentId, entityKey: done.entityKey, meta: { ticketId: done.ticketId, was: "awaiting_payment", source: "reconciler" } });
    }
  } else {
    s.waiting++;
  }
}

export async function reconcileTickets(deps: DeskDeps = {}): Promise<ReconcileSummary> {
  const d = resolveDeps(deps);
  const s: ReconcileSummary = { checked: 0, paid: 0, failed: 0, expired: 0, draftsExpired: 0, waiting: 0, errors: 0 };
  let budget = RECONCILE_MAX_PER_RUN;

  const awaiting = await col("tickets").where("status", "==", "awaiting_payment")
    .where("updatedAt", "<", d.now() - AWAITING_MIN_AGE_MS).orderBy("updatedAt", "asc").limit(budget).get();
  for (const doc of awaiting.docs) {
    budget--; s.checked++;
    const t = doc.data() as DeskTicket;
    try { if (!isSettled(t.status)) await reconcileAwaiting(t, d, s); }
    catch (err) { s.errors++; logger.error("reconcile: ticket failed", { ticketId: t.ticketId, err }); }
  }

  if (budget > 0) {
    const drafts = await col("tickets").where("status", "==", "draft")
      .where("updatedAt", "<", d.now() - DRAFT_MAX_AGE_MS).orderBy("updatedAt", "asc").limit(budget).get();
    for (const doc of drafts.docs) {
      s.checked++;
      const t = doc.data() as DeskTicket;
      try {
        const done = await expireTicket(t.ticketId, "draft", "Draft expired after 24 hours", d);
        if (done) {
          await deleteDraftChunks(t.ticketId);
          s.draftsExpired++;
          await audit({ action: "ticket_expired", agentId: done.agentId, entityKey: done.entityKey, meta: { ticketId: done.ticketId, was: "draft", source: "reconciler" } });
        }
      } catch (err) { s.errors++; logger.error("reconcile: draft expiry failed", { ticketId: t.ticketId, err }); }
    }
  }
  logger.info("desk_reconcileTickets", s);
  return s;
}
