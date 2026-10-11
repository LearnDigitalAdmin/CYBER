/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import type { TopPayable } from "../../api/contract";
import { capState, isOtpShape, isStaleSignIn, needsNewCode, selectWithinCap, settleTracking, stillProcessing, summariseSelection, trackFromResults, validateReason } from "./logic";

const pay = (entryId: string, agentId: string, deskCode: string, amountMinor: number, createdAt = 1): TopPayable =>
  ({ entryId, agentId, deskCode, name: deskCode, kind: "bonus", amountMinor, createdAt });
const P = [pay("e1", "a1", "COG-0001", 200_000, 1), pay("e2", "a1", "COG-0001", 100_000, 2), pay("e3", "a2", "COG-0002", 300_000, 3)];

test("selection summary uses the contract wording with distinct desks", () => {
  const s = summariseSelection(P, new Set(["e1", "e2", "e3"]));
  assert.equal(s.totalMinor, 600_000); assert.equal(s.desks, 2);
  assert.equal(s.summary, "Pay KES 6000.00 to 2 desks");
  assert.equal(summariseSelection(P, new Set()).summary, "");
});

test("cap meter", () => {
  const c = capState(5_000_000, 1_000_000, 500_000);
  assert.equal(c.remainingMinor, 4_000_000); assert.equal(c.usedPct, 20); assert.equal(c.selectedPct, 10); assert.equal(c.over, false);
  const o = capState(5_000_000, 4_800_000, 500_000);
  assert.equal(o.over, true); assert.equal(o.overByMinor, 300_000);
  assert.equal(capState(0, 0, 0).usedPct, 0);
});

test("select what fits takes oldest first and skips rows that do not fit", () => {
  assert.deepEqual([...selectWithinCap(P, 350_000)].sort(), ["e1", "e2"]);
  assert.deepEqual([...selectWithinCap(P, 300_000)].sort(), ["e1", "e2"]);
  assert.deepEqual([...selectWithinCap(P, 50_000)], []);
});

test("reason, otp and error classification", () => {
  assert.equal(validateReason("no").ok, false);
  assert.equal(validateReason("x".repeat(301)).ok, false);
  const r = validateReason("  Failed   checks ");
  assert.ok(r.ok && r.value === "Failed checks");
  assert.equal(isOtpShape("123456"), true); assert.equal(isOtpShape("12345"), false); assert.equal(isOtpShape("12a456"), false);
  assert.equal(isStaleSignIn("functions/unauthenticated", "x"), true);
  assert.equal(isStaleSignIn("functions/permission-denied", "Please sign in again to continue"), true);
  assert.equal(isStaleSignIn("functions/permission-denied", "wrong code"), false);
  assert.equal(needsNewCode("Too many wrong codes. Request a new code."), true);
  assert.equal(needsNewCode("That code is not correct. 3 tries left."), false);
});

test("tracking: processing rows settle from the desk's paid delta, in order", () => {
  const rows = trackFromResults(P, [
    { entryId: "e1", status: "processing", reference: "r1" }, { entryId: "e2", status: "processing", reference: "r2" },
    { entryId: "e3", status: "paid", reference: "r3" }, { entryId: "gone", status: "paid", reference: "x" },
  ]);
  assert.equal(rows.length, 3); assert.equal(stillProcessing(rows), true);
  const base = { "COG-0001": 0, "COG-0002": 0 };
  // Nothing confirmed yet.
  assert.equal(stillProcessing(settleTracking(rows, base, { "COG-0001": 0, "COG-0002": 300_000 }, new Set())), true);
  // Enough for e1 only.
  const one = settleTracking(rows, base, { "COG-0001": 200_000, "COG-0002": 300_000 }, new Set());
  assert.deepEqual(one.map((r) => r.status), ["paid", "processing", "paid"]);
  // Both.
  assert.equal(stillProcessing(settleTracking(rows, base, { "COG-0001": 300_000, "COG-0002": 300_000 }, new Set())), false);
});

test("tracking: a row that is payable again failed; missing data never marks paid", () => {
  const rows = trackFromResults(P, [{ entryId: "e1", status: "processing", reference: "r1" }, { entryId: "e2", status: "processing", reference: "r2" }]);
  const failed = settleTracking(rows, { "COG-0001": 0 }, { "COG-0001": 300_000 }, new Set(["e2"]));
  assert.deepEqual(failed.map((r) => r.status), ["paid", "failed"]);
  const unknown = settleTracking(rows, {}, { "COG-0001": 999_999_999 }, new Set());
  assert.deepEqual(unknown.map((r) => r.status), ["processing", "processing"]);
});
