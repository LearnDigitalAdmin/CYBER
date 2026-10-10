import { test } from "node:test";
import assert from "node:assert/strict";
import type { DeskEventDoc, LedgerDoc } from "../types.js";
import { addPaidPeriod, monthKeyEAT, planCommission, planCustomerUpdate, planReversals, validateEvent } from "./plan.js";

const ev = (o: Partial<DeskEventDoc> = {}): DeskEventDoc => ({
  eventId: "sms_purchase:R1", type: "sms_purchase", product: "school", entityKey: "school:K1", agentId: "u1", paystackRef: "R1",
  grossMinor: 100000, feeMinor: 1500, agentSharePct: 40, paidAt: Date.UTC(2026, 8, 30, 22, 0), ...o,
});

test("validation rejects bad events instead of throwing", () => {
  assert.ok(validateEvent(ev()).ok);
  for (const bad of [null, ev({ type: "x" as never }), ev({ product: "x" as never }), ev({ feeMinor: 2e6 }), ev({ grossMinor: 1.5 }),
    ev({ agentSharePct: 100 }), ev({ agentSharePct: -1 }), ev({ paidAt: 0 }), ev({ agentId: "" }), ev({ type: "refund" }), ev({ periodMonth: "2026-13" })])
    assert.equal(validateEvent(bad).ok, false);
  assert.ok(validateEvent(ev({ type: "refund", originalRef: "R0" })).ok);
});

test("commission is the agent's share of (gross - REAL fee), with the rule by event type", () => {
  const p = planCommission(ev(), false)!;
  assert.equal(p.agentMinor, Math.floor(98500 * 4000 / 10000));
  assert.equal(p.rule, "sms_standard");
  assert.equal(planCommission(ev(), true)!.rule, "sms_first_purchase");
  assert.equal(planCommission(ev({ type: "subscription_payment" }), false)!.rule, "subscription");
  assert.equal(planCommission(ev({ type: "report_purchase" }), false)!.rule, "report");
  assert.equal(planCommission(ev({ type: "rent_payment" }), false)!.rule, "rent");
  assert.equal(planCommission(ev({ type: "refund", originalRef: "R0" }), false), undefined);
});

test("paid periods: sorted unique; period defaults to the Nairobi month of paidAt", () => {
  assert.deepEqual(addPaidPeriod(["2026-03", "2026-01"], "2026-02"), ["2026-01", "2026-02", "2026-03"]);
  assert.deepEqual(addPaidPeriod(["2026-01"], "2026-01"), ["2026-01"]);
  assert.equal(monthKeyEAT(Date.UTC(2026, 8, 30, 22, 0)), "2026-10"); // 01:00 on 1 Oct in Nairobi
  const sub = planCustomerUpdate(ev({ type: "subscription_payment" }), { paidPeriods: ["2026-09"] })!;
  assert.deepEqual(sub.set.paidPeriods, ["2026-09", "2026-10"]);
  assert.equal(sub.derivedPeriod, true);
  assert.equal(planCustomerUpdate(ev({ type: "subscription_payment", periodMonth: "2026-09" }), { paidPeriods: ["2026-09"] }), undefined);
});

test("SMS purchase sets firstPurchaseUsed and lastPaidAt (never backwards) and clears the reservation; ownership is never touched", () => {
  const p = planCustomerUpdate(ev(), { lastPaidAt: 1 })!;
  assert.equal(p.set.firstPurchaseUsed, true);
  assert.equal(p.set.lastPaidAt, Date.UTC(2026, 8, 30, 22, 0));
  assert.deepEqual(p.deleteFields, ["firstPurchaseReservedRef", "firstPurchaseReservedAt"]);
  assert.equal(planCustomerUpdate(ev(), { lastPaidAt: Date.UTC(2027, 0, 1) })!.set.lastPaidAt, Date.UTC(2027, 0, 1));
  for (const t of ["sms_purchase", "subscription_payment", "refund"] as const) {
    const s = planCustomerUpdate(ev({ type: t, originalRef: "R0" }), {})!.set as Record<string, unknown>;
    for (const k of ["ownerAgentId", "attributedAt", "selfOwned"]) assert.equal(k in s, false);
  }
  assert.deepEqual(planCustomerUpdate(ev({ type: "refund", originalRef: "R0" }), {})!.set, { refunded: true });
  assert.equal(planCustomerUpdate(ev({ type: "refund", originalRef: "R0" }), { refunded: true }), undefined);
});

test("refund reverses each positive, unreversed ledger row exactly once", () => {
  const row = (o: Partial<LedgerDoc>): LedgerDoc => ({ entryId: "e1", agentId: "u1", kind: "commission", amountMinor: 500, status: "settled", createdAt: 1, ...o });
  const out = planReversals([row({}), row({ entryId: "e2", kind: "reversal", amountMinor: -5 }), row({ entryId: "e3", status: "void" }), row({ entryId: "e4", agentId: "u2", amountMinor: 70, kind: "service" })], "refund:R9", "R0");
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((o) => o.amountMinor), [-500, -70]);
  assert.deepEqual(out[0].idempotencyParts, ["reversal", "e1"]);
  assert.equal(out[1].agentId, "u2");
});
