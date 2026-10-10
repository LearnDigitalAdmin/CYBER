import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { emulatorEnabled, clearFirestore } from "../testing/emulator.js";
import { summaryBulkSms, summaryRentStk } from "../contract.js";
import { col } from "../db.js";
import { initiateRentStk } from "./rent.js";
import { requestActionOtp, verifyActionOtp } from "../otp/handlers.js";
import { clearChama, harness, lastOtp, openSession, rejects, seedAgent, type Harness } from "../connectors/harness.test.js";

const opts = { skip: !emulatorEnabled };
const PMS = "pms:PYL-0001";
let h: Harness;
beforeEach(async () => { if (!emulatorEnabled) return; await clearFirestore(); await clearChama(); h = harness(); await seedAgent("1"); });

async function approved(sessionId: string, n: number): Promise<string> {
  const r = await requestActionOtp(h.deps, "1", { sessionId, action: "rent_stk", summary: summaryRentStk(n) });
  await verifyActionOtp(h.deps, "1", { actionId: r.actionId, otp: lastOtp(h) });
  return r.actionId;
}
const ids = (n: number) => Array.from({ length: n }, (_, i) => `t${i}`);

test("approved batch is written as requested and the OTP is consumed", opts, async () => {
  const sid = await openSession(h, "1", PMS, ["read", "rent_stk"]);
  const actionId = await approved(sid, 3);
  const out = await initiateRentStk(h.deps, "1", { sessionId: sid, actionId, tenantIds: ids(3) });
  assert.equal(out.count, 3);
  const b = (await col("rentBatches").doc(out.batchId).get()).data();
  assert.equal(b?.status, "requested"); assert.deepEqual(b?.tenantIds, ids(3)); assert.equal(b?.entityKey, PMS); assert.equal(b?.agentId, "1");
  assert.ok((await col("actionOtps").doc(actionId).get()).data()?.consumedAt);
  assert.equal((await col("audit").where("action", "==", "rent_stk_requested").get()).size, 1);
  await rejects(initiateRentStk(h.deps, "1", { sessionId: sid, actionId, tenantIds: ids(3) }), "otp_required");
  assert.equal((await col("rentBatches").get()).size, 1);
});
test("count must match the approved summary, and a mismatch does not burn the OTP", opts, async () => {
  const sid = await openSession(h, "1", PMS, ["rent_stk"]);
  const actionId = await approved(sid, 3);
  await rejects(initiateRentStk(h.deps, "1", { sessionId: sid, actionId, tenantIds: ids(4) }), "invalid_argument", /does not match/);
  assert.equal((await col("actionOtps").doc(actionId).get()).data()?.consumedAt, undefined);
  await initiateRentStk(h.deps, "1", { sessionId: sid, actionId, tenantIds: ids(3) });
});
test("validation: empty, duplicates, over 200, missing confirmation", opts, async () => {
  const sid = await openSession(h, "1", PMS, ["rent_stk"]);
  const actionId = await approved(sid, 2);
  await rejects(initiateRentStk(h.deps, "1", { sessionId: sid, actionId, tenantIds: [] }), "invalid_argument");
  await rejects(initiateRentStk(h.deps, "1", { sessionId: sid, actionId, tenantIds: ["a", "a"] }), "invalid_argument");
  await rejects(initiateRentStk(h.deps, "1", { sessionId: sid, actionId, tenantIds: ids(201) }), "invalid_argument");
  await rejects(initiateRentStk(h.deps, "1", { sessionId: sid, actionId: "nope", tenantIds: ids(2) }), "otp_required");
  assert.equal((await col("rentBatches").get()).size, 0);
});
test("an OTP approved for another action, an unverified OTP and a session without the scope are refused", opts, async () => {
  const sid = await openSession(h, "1", PMS, ["rent_stk", "bulk_sms"]);
  const other = await requestActionOtp(h.deps, "1", { sessionId: sid, action: "bulk_sms", summary: summaryBulkSms(2) });
  await verifyActionOtp(h.deps, "1", { actionId: other.actionId, otp: lastOtp(h) });
  await rejects(initiateRentStk(h.deps, "1", { sessionId: sid, actionId: other.actionId, tenantIds: ids(2) }), "invalid_argument");
  const r = await requestActionOtp(h.deps, "1", { sessionId: sid, action: "rent_stk", summary: summaryRentStk(2) });
  await rejects(initiateRentStk(h.deps, "1", { sessionId: sid, actionId: r.actionId, tenantIds: ids(2) }), "otp_required");
  const readOnly = await openSession(h, "1", PMS, ["read"]);
  await rejects(initiateRentStk(h.deps, "1", { sessionId: readOnly, actionId: r.actionId, tenantIds: ids(2) }), "permission_denied");
});
test("rent STK is only for Plot Yangu", opts, async () => {
  const sid = await openSession(h, "1", "chama:SMC-0001", ["rent_stk"]);
  await rejects(requestActionOtp(h.deps, "1", { sessionId: sid, action: "rent_stk", summary: summaryRentStk(2) }), "failed_precondition");
});
