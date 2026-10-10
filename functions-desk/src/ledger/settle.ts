/**
 * The single code path that turns a CONFIRMED Paystack payment into a paid desk ticket. Used by the webhook trigger, the
 * reconciler and the re-prompt check, so all three behave identically:
 *   - Paystack is asked (verifyTransaction); the cyber-transactions document is never trusted on its own.
 *   - success + amount equal to the ticket -> one transaction sets the ticket paid and writes ONE service ledger row.
 *   - a replay changes nothing; a second payment on an already-paid ticket is flagged for refund, never double-counted.
 *   - amount mismatch -> ticket failed ("amount mismatch"), audited, no ledger row.
 */
import { FieldValue } from "firebase-admin/firestore";
import { parseDeskReference } from "../charge/reference.js";
import { resolveDeps, type DeskDeps } from "../charge/port.js";
import { col, db } from "../db.js";
import { audit } from "../kernel/audit.js";
import type { VerifiedTransaction } from "../paystack/client.js";
import { isSettled, type DeskTicket } from "../tickets/model.js";
import { AMOUNT_MISMATCH, planSettlement } from "./plan.js";
import { buildLedgerDoc, ledgerRef } from "./txLedger.js";
import { ledgerEntryId } from "../kernel/ledger.js";

export type SettleSource = "webhook" | "reconciler" | "reprompt";
export type SettleOutcome =
  | { kind: "paid"; changed: boolean }
  | { kind: "duplicate"; changed: boolean }
  | { kind: "mismatch"; changed: boolean }
  | { kind: "not_success"; status: string }
  | { kind: "missing_ticket" }
  | { kind: "wrong_ticket" };

export async function settleTicketReference(
  args: { ticketId: string; reference: string; source: SettleSource; verified?: VerifiedTransaction },
  deps: DeskDeps = {},
): Promise<SettleOutcome> {
  const d = resolveDeps(deps);
  const { ticketId, reference, source } = args;
  const ticketRef = col("tickets").doc(ticketId);

  const parsed = parseDeskReference(reference);
  if (!parsed || parsed.ticketId !== ticketId) {
    await audit({ action: "ticket_reference_rejected", meta: { ticketId, reference, source } });
    return { kind: "wrong_ticket" };
  }
  const pre = await ticketRef.get();
  if (!pre.exists) {
    await audit({ action: "ticket_settle_orphan", meta: { ticketId, reference, source } });
    return { kind: "missing_ticket" };
  }
  const first = pre.data() as DeskTicket;
  if (isSettled(first.status) && first.paystackRef === reference) return { kind: "paid", changed: false };

  const v = args.verified ?? await d.port.verifyTransaction(reference);
  if (v.status !== "success") return { kind: "not_success", status: v.status };

  const cfg = await d.config();
  const currency = typeof v.raw.currency === "string" ? v.raw.currency : undefined;
  const plan = planSettlement(first, { amountMinor: v.amountMinor, feesMinor: v.feesMinor, currency }, cfg);
  const now = d.now();

  const result = await db().runTransaction(async (tx): Promise<SettleOutcome> => {
    const snap = await tx.get(ticketRef);
    if (!snap.exists) return { kind: "missing_ticket" };
    const t = snap.data() as DeskTicket;
    const lRef = ledgerRef(ledgerEntryId(["service", ticketId]));
    const lSnap = await tx.get(lRef);

    if (isSettled(t.status)) {
      if (t.paystackRef === reference) return { kind: "paid", changed: false };
      // A different reference already paid this ticket and this one succeeded too: the customer paid twice.
      if ((t.duplicateRefs ?? []).includes(reference)) return { kind: "duplicate", changed: false };
      tx.update(ticketRef, { duplicateRefs: FieldValue.arrayUnion(reference), updatedAt: now });
      return { kind: "duplicate", changed: true };
    }
    if (!plan.ok) {
      if (t.status === "failed" && t.failureReason === AMOUNT_MISMATCH && t.paystackRef === reference) return { kind: "mismatch", changed: false };
      tx.update(ticketRef, { status: "failed", failureReason: AMOUNT_MISMATCH, paystackRef: reference, updatedAt: now });
      return { kind: "mismatch", changed: true };
    }
    tx.update(ticketRef, {
      status: "paid", paystackRef: reference, grossMinor: plan.grossMinor, feeMinor: plan.feeMinor,
      agentMinor: plan.agentMinor, platformMinor: plan.platformMinor, sharePct: plan.sharePct,
      paidAt: now, updatedAt: now, failureReason: FieldValue.delete(),
    });
    if (!lSnap.exists) {
      tx.create(lRef, buildLedgerDoc({
        agentId: t.agentId, kind: "service", amountMinor: plan.agentMinor, status: "settled",
        entityKey: t.entityKey, paystackRef: reference, sourceId: ticketId,
        grossMinor: plan.grossMinor, feeMinor: plan.feeMinor, sharePct: plan.sharePct, rule: "service",
        note: `Desk service: ${t.serviceType}`, idempotencyParts: ["service", ticketId],
      }, now));
    }
    return { kind: "paid", changed: true };
  });

  if (result.kind === "paid" && result.changed) {
    await audit({
      action: "ticket_paid", agentId: first.agentId, entityKey: first.entityKey, sessionId: first.sessionId,
      meta: { ticketId, reference, source, grossMinor: plan.ok ? plan.grossMinor : undefined, feeMinor: plan.ok ? plan.feeMinor : undefined,
        agentMinor: plan.ok ? plan.agentMinor : undefined, platformMinor: plan.ok ? plan.platformMinor : undefined },
    });
  } else if (result.kind === "mismatch" && result.changed) {
    await audit({
      action: "ticket_amount_mismatch", agentId: first.agentId, entityKey: first.entityKey,
      meta: { ticketId, reference, source, expectedMinor: first.amountMinor, receivedMinor: v.amountMinor, currency: currency ?? null },
    });
  } else if (result.kind === "duplicate" && result.changed) {
    await audit({
      action: "ticket_duplicate_payment", agentId: first.agentId, entityKey: first.entityKey,
      meta: { ticketId, reference, source, amountMinor: v.amountMinor, note: "The ticket was already paid; this payment needs a manual refund" },
    });
  }
  return result;
}

/** A confirmed-dead attempt (failed / abandoned / reversed) fails the ticket, but only while that attempt is the live one. */
export async function failTicketAttempt(
  args: { ticketId: string; reference: string; reason: string; source: SettleSource },
  deps: DeskDeps = {},
): Promise<boolean> {
  const d = resolveDeps(deps);
  const ticketRef = col("tickets").doc(args.ticketId);
  const now = d.now();
  const changed = await db().runTransaction(async (tx) => {
    const snap = await tx.get(ticketRef);
    if (!snap.exists) return undefined;
    const t = snap.data() as DeskTicket;
    if (t.status !== "awaiting_payment" || t.paystackRef !== args.reference) return undefined;
    tx.update(ticketRef, { status: "failed", failureReason: args.reason, updatedAt: now });
    return t;
  });
  if (!changed) return false;
  await audit({
    action: "ticket_payment_failed", agentId: changed.agentId, entityKey: changed.entityKey,
    meta: { ticketId: args.ticketId, reference: args.reference, reason: args.reason, source: args.source },
  });
  return true;
}
