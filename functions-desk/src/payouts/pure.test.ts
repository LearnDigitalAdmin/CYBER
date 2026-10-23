import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DESK_CONFIG } from "../config.js";
import { DeskError } from "../errors.js";
import {
  classifyTransferStatus, fitsCap, nairobiDayKey, payoutMsisdn, payoutReference, previousNairobiMonth, remainingCap, supportAmount,
} from "./pure.js";

const ID = "a".repeat(28);
test("daily cap arithmetic", () => {
  const cap = 5_000_000;
  assert.equal(remainingCap(cap, 1_000_000), 4_000_000); assert.equal(remainingCap(cap, 6_000_000), 0);
  assert.ok(fitsCap(cap, 0, cap)); assert.ok(fitsCap(cap, 4_999_999, 1)); assert.ok(!fitsCap(cap, 4_999_999, 2)); assert.ok(!fitsCap(cap, cap, 1));
  assert.ok(!fitsCap(cap, 0, -1)); assert.ok(!fitsCap(cap, 0, 1.5)); assert.ok(!fitsCap(cap, 0, Number.NaN));
});
test("Nairobi day boundaries (UTC+3)", () => {
  assert.equal(nairobiDayKey(Date.UTC(2026, 0, 31, 20, 59, 59)), "2026-01-31");
  assert.equal(nairobiDayKey(Date.UTC(2026, 0, 31, 21, 0, 0)), "2026-02-01");
  assert.equal(nairobiDayKey(Date.UTC(2026, 11, 31, 21, 0, 0)), "2027-01-01");
});
test("previous Nairobi month and its range", () => {
  const m = previousNairobiMonth(Date.UTC(2026, 9, 1, 3, 0, 0)); // 1 Oct 06:00 Nairobi
  assert.equal(m.month, "2026-09"); assert.equal(m.startMs, Date.UTC(2026, 8, 1) - 3 * 3600_000); assert.equal(m.endMs, Date.UTC(2026, 9, 1) - 3 * 3600_000);
  const j = previousNairobiMonth(Date.UTC(2027, 0, 1, 3, 0, 0));
  assert.equal(j.month, "2026-12");
  // 30 Sep 22:00 UTC is already 1 Oct in Nairobi
  assert.equal(previousNairobiMonth(Date.UTC(2026, 8, 30, 22, 0, 0)).month, "2026-09");
});
test("transfer references satisfy Paystack's rules and are deterministic", () => {
  const first = payoutReference(ID, 0);
  assert.equal(first, `payout_${ID}`); assert.equal(payoutReference(ID, 0), first);
  assert.match(first, /^[a-z0-9_-]{16,50}$/); assert.match(payoutReference(ID, 3), /^[a-z0-9_-]{16,50}$/);
  assert.notEqual(payoutReference(ID, 1), first);
  assert.throws(() => payoutReference("NOT-A-LEDGER-ID", 0), DeskError);
});
test("Paystack transfer statuses", () => {
  assert.equal(classifyTransferStatus("success"), "paid"); assert.equal(classifyTransferStatus("failed"), "failed"); assert.equal(classifyTransferStatus("reversed"), "failed");
  assert.equal(classifyTransferStatus("otp"), "otp"); assert.equal(classifyTransferStatus("pending"), "pending"); assert.equal(classifyTransferStatus("received"), "pending");
});
test("recipient number: M-Pesa payout account wins, otherwise the desk phone; local 07 form", () => {
  assert.deepEqual(payoutMsisdn("+254711000000", { settlementBank: "mpesa", accountNumber: "0722 000 111" }), { e164: "+254722000111", local: "0722000111" });
  assert.equal(payoutMsisdn("+254711000000", { settlementBank: "M-Pesa", accountNumber: "254713000222" }).local, "0713000222");
  assert.equal(payoutMsisdn("+254711000000", { settlementBank: "equity", accountNumber: "0123456789" }).local, "0711000000");
  assert.equal(payoutMsisdn("+254711000000", undefined).local, "0711000000");
  assert.throws(() => payoutMsisdn("+254711000000", { settlementBank: "mpesa", accountNumber: "12" }), DeskError);
});
const T = (day: number, h = 12) => Date.UTC(2026, 8, day, h - 3); // h:00 Nairobi
test("support amount: per-day cap, rate, monthly cap; 0 rate or cap pays nothing", () => {
  const sup = { rateMinorPerConfirmed: 5000, maxConfirmedPerDay: 5, monthlyCapMinor: 100000 };
  assert.deepEqual(supportAmount([], sup), { counted: 0, amountMinor: 0 });
  assert.deepEqual(supportAmount([T(1), T(1, 13), T(2)], sup), { counted: 3, amountMinor: 15000 });
  assert.equal(supportAmount(Array.from({ length: 9 }, (_, i) => T(1, 6 + i)), sup).counted, 5);
  assert.equal(supportAmount(Array.from({ length: 30 }, (_, i) => T(1 + i % 15, 8)), sup).amountMinor, 100000); // 30 x 5000 = 150000 -> capped
  assert.equal(supportAmount([T(1)], { ...sup, rateMinorPerConfirmed: 0 }).amountMinor, 0);
  assert.equal(supportAmount([T(1)], { ...sup, monthlyCapMinor: 0 }).amountMinor, 0);
  assert.equal(supportAmount([T(1)], DEFAULT_DESK_CONFIG.support).amountMinor, 0);
  // 21:30 UTC on the 1st is the 2nd in Nairobi: a different day, so no per-day collision
  assert.equal(supportAmount([Date.UTC(2026, 8, 1, 21, 30), T(2, 12)], { ...sup, maxConfirmedPerDay: 1 }).counted, 1);
});
