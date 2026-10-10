import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DESK_CONFIG } from "../config.js";
import { DEAD_PAYSTACK_STATUSES } from "../charge/port.js";
import { aggregateEarnings } from "./earnings.js";
import { decideTicket, planSettlement } from "./plan.js";
import { shouldProcessTransactionChange } from "./trigger.js";

const cfg = DEFAULT_DESK_CONFIG;

test("settlement uses Paystack's real fee and the stored share: agent 97.5% of (gross - fee)", () => {
  const p = planSettlement({ amountMinor: 20000, sharePct: 97.5 }, { amountMinor: 20000, feesMinor: 300, currency: "KES" }, cfg);
  assert.ok(p.ok);
  if (p.ok) { assert.equal(p.agentMinor, 19207); assert.equal(p.platformMinor, 493); assert.equal(p.agentMinor + p.platformMinor, 19700); assert.equal(p.feeMinor, 300); }
});
test("share defaults to the configured service plan when the ticket has none", () => {
  const p = planSettlement({ amountMinor: 10000 }, { amountMinor: 10000, feesMinor: 0 }, cfg);
  assert.ok(p.ok && p.sharePct === 97.5 && p.agentMinor === 9750);
});
test("amount or currency mismatch -> not ok, never settles", () => {
  assert.deepEqual(planSettlement({ amountMinor: 20000 }, { amountMinor: 19999, feesMinor: 0 }, cfg), { ok: false, reason: "amount mismatch" });
  assert.deepEqual(planSettlement({ amountMinor: 20000 }, { amountMinor: 20000, feesMinor: 0, currency: "NGN" }, cfg), { ok: false, reason: "amount mismatch" });
});
test("an impossible fee is an error, not a settlement", () => {
  assert.throws(() => planSettlement({ amountMinor: 100 }, { amountMinor: 100, feesMinor: 101 }, cfg), /invalid fee/);
});

test("reconciler decisions: any success settles; latest dead fails; pending ages into expiry", () => {
  const D = DEAD_PAYSTACK_STATUSES;
  assert.deepEqual(decideTicket([{ ref: "a", status: "pending" }, { ref: "b", status: "failed" }], 0, D), { action: "fail", reason: "Payment was not completed" });
  assert.deepEqual(decideTicket([{ ref: "a", status: "success" }, { ref: "b", status: "failed" }], 0, D), { action: "settle", ref: "a" });
  assert.deepEqual(decideTicket([{ ref: "a", status: "failed", reason: " Insufficient funds " }], 0, D), { action: "fail", reason: "Insufficient funds" });
  assert.deepEqual(decideTicket([{ ref: "a", status: "pending" }], 14 * 60_000, D), { action: "wait" });
  assert.deepEqual(decideTicket([{ ref: "a", status: "pending" }], 15 * 60_000, D), { action: "expire" });
  assert.deepEqual(decideTicket([{ ref: "a", status: "not_found" }], 16 * 60_000, D), { action: "expire" });
});

test("trigger filter: desk charges only; success always, failure only on change", () => {
  const ref = "CYBER_DSK_T1_1";
  assert.equal(shouldProcessTransactionChange("CYBER_u1_123", undefined, { status: "success", deskTicketId: "T1" }), false);
  assert.equal(shouldProcessTransactionChange(ref, undefined, { status: "success" }), false);
  assert.equal(shouldProcessTransactionChange(ref, { status: "pending" }, { status: "success", deskTicketId: "T1" }), true);
  assert.equal(shouldProcessTransactionChange(ref, { status: "success", deskTicketId: "T1" }, { status: "success", deskTicketId: "T1" }), true);
  assert.equal(shouldProcessTransactionChange(ref, { status: "pending", deskTicketId: "T1" }, { status: "failed", deskTicketId: "T1" }), true);
  assert.equal(shouldProcessTransactionChange(ref, { status: "failed", deskTicketId: "T1" }, { status: "failed", deskTicketId: "T1" }), false);
  assert.equal(shouldProcessTransactionChange(ref, undefined, { status: "pay_offline", deskTicketId: "T1" }), false);
  assert.equal(shouldProcessTransactionChange(ref, { status: "success", deskTicketId: "T1" }, undefined), false);
});

test("earnings: by status and stream; void ignored; processing counts as unpaid; reversals net out", () => {
  const t = aggregateEarnings([
    { kind: "service", status: "settled", amountMinor: 19000 },
    { kind: "commission", status: "settled", amountMinor: 5000, product: "chama" },
    { kind: "reversal", status: "settled", amountMinor: -5000, product: "chama" },
    { kind: "reversal", status: "settled", amountMinor: -1000 },
    { kind: "bonus", status: "payable", amountMinor: 200000 },
    { kind: "bonus", status: "processing", amountMinor: 200000 },
    { kind: "bonus", status: "paid", amountMinor: 200000 },
    { kind: "bonus", status: "void", amountMinor: 200000 },
    { kind: "support", status: "payable", amountMinor: 3000 },
  ]);
  assert.equal(t.settledMinor, 18000);
  assert.equal(t.payableMinor, 403000);
  assert.equal(t.paidMinor, 200000);
  assert.deepEqual(t.byProduct, [
    { product: "service", amountMinor: 18000 }, { product: "chama", amountMinor: 0 },
    { product: "bonus", amountMinor: 600000 }, { product: "support", amountMinor: 3000 },
  ]);
});
