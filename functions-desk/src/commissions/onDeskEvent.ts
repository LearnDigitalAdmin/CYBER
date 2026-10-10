import * as logger from "firebase-functions/logger";
import { FieldValue } from "firebase-admin/firestore";
import { col, db } from "../db.js";
import { audit } from "../kernel/audit.js";
import { appendLedger } from "../kernel/ledger.js";
import type { CustomerDoc, DeskEventDoc, LedgerDoc } from "../types.js";
import { planCommission, planCustomerUpdate, planReversals, validateEvent } from "./plan.js";

const customerRef = (entityKey: string) => col("customers").doc(entityKey.replace(/\//g, "_"));

/** Applies the customer patch in a transaction (read-modify-write: periods stay sorted-unique, lastPaidAt only moves forward). */
async function updateCustomer(e: DeskEventDoc): Promise<{ applied: boolean; exists: boolean; derivedPeriod?: boolean; firstPurchase: boolean }> {
  const ref = customerRef(e.entityKey);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { applied: false, exists: false, firstPurchase: false };
    const c = snap.data() as CustomerDoc;
    const firstPurchase = e.type === "sms_purchase" && c.firstPurchaseReservedRef === e.paystackRef;
    const patch = planCustomerUpdate(e, c);
    if (!patch) return { applied: false, exists: true, firstPurchase };
    const update: Record<string, unknown> = { ...patch.set };
    for (const f of patch.deleteFields) update[f] = FieldValue.delete();
    tx.update(ref, update);
    return { applied: true, exists: true, derivedPeriod: patch.derivedPeriod, firstPurchase };
  });
}

/** Was this charge's customer marked by PAY as a first purchase? (read before the reservation is cleared) */
async function wasFirstPurchase(e: DeskEventDoc): Promise<boolean> {
  if (e.type !== "sms_purchase") return false;
  const snap = await customerRef(e.entityKey).get();
  return snap.exists && (snap.data() as CustomerDoc).firstPurchaseReservedRef === e.paystackRef;
}

async function reverseRows(eventId: string, originalRef: string): Promise<number> {
  const snap = await col("ledger").where("paystackRef", "==", originalRef).get();
  let created = 0;
  for (const r of planReversals(snap.docs.map((d) => d.data() as LedgerDoc), eventId, originalRef)) {
    const res = await appendLedger({
      agentId: r.agentId, kind: "reversal", amountMinor: r.amountMinor, status: "settled", product: r.product, entityKey: r.entityKey,
      paystackRef: originalRef, sourceId: eventId, rule: "reversal", note: r.note, idempotencyParts: r.idempotencyParts,
    });
    if (res.created) created++;
  }
  return created;
}

/** A refund may be processed before the payment it refunds (triggers are unordered): the payment's commission then reverses itself. */
async function refundExistsFor(paystackRef: string): Promise<string | undefined> {
  const snap = await col("events").where("type", "==", "refund").where("originalRef", "==", paystackRef).limit(1).get();
  return snap.empty ? undefined : snap.docs[0].id;
}

export async function handleDeskEvent(eventId: string, raw: unknown): Promise<string> {
  const v = validateEvent(raw);
  if (!v.ok) {
    await audit({ action: "desk_event_rejected", meta: { eventId, reason: v.reason } });
    return "rejected";
  }
  const e = v.event;

  if (e.type === "refund") {
    const reversals = await reverseRows(eventId, e.originalRef as string);
    const cust = await updateCustomer(e);
    await audit({
      action: "refund_recorded", agentId: e.agentId, entityKey: e.entityKey,
      meta: { eventId, originalRef: e.originalRef, reversalRows: reversals, customerMarked: cust.applied, customerFound: cust.exists },
    });
    return "refund";
  }

  const firstPurchase = await wasFirstPurchase(e);
  const plan = planCommission(e, firstPurchase);
  let entryId: string | undefined;
  let created = false;
  if (plan && plan.agentMinor > 0) {
    const res = await appendLedger({
      agentId: e.agentId, kind: "commission", amountMinor: plan.agentMinor, status: "settled", product: e.product, entityKey: e.entityKey,
      paystackRef: e.paystackRef, sourceId: eventId, grossMinor: e.grossMinor, feeMinor: e.feeMinor, sharePct: e.agentSharePct,
      rule: plan.rule, note: plan.note, idempotencyParts: ["commission", eventId],
    });
    entryId = res.entryId; created = res.created;
    const refundEvent = await refundExistsFor(e.paystackRef);
    if (refundEvent) await reverseRows(refundEvent, e.paystackRef);
  }
  const cust = await updateCustomer(e);
  if (created || cust.applied || !cust.exists) {
    await audit({
      action: "commission_recorded", agentId: e.agentId, entityKey: e.entityKey,
      meta: { eventId, type: e.type, entryId: entryId ?? null, created, agentMinor: plan?.agentMinor ?? 0, customerUpdated: cust.applied,
        customerFound: cust.exists, derivedPeriod: cust.derivedPeriod ?? false },
    });
  }
  if (!cust.exists) logger.warn("desk event for an entity with no desk_customers document", { eventId, entityKey: e.entityKey });
  return created ? "recorded" : "replay";
}
