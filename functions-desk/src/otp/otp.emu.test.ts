import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { emulatorEnabled, clearFirestore } from "../testing/emulator.js";
import { summaryBulkSms, summaryExport } from "../contract.js";
import { col } from "../db.js";
import { requireSession } from "../kernel/session.js";
import { requestActionOtp, verifyActionOtp } from "./handlers.js";
import { clearChama, entityInfo, harness, lastOtp, openSession, rejects, seedAgent, type Harness } from "../connectors/harness.test.js";

const opts = { skip: !emulatorEnabled };
const KEY = "chama:SMC-0001";
let h: Harness; let sid: string;
beforeEach(async () => {
  if (!emulatorEnabled) return;
  await clearFirestore(); await clearChama(); h = harness();
  await seedAgent("1"); await seedAgent("2");
  sid = await openSession(h, "1", KEY, ["read", "bulk_sms", "export"]);
});

test("request SMS repeats the summary and stores only a hash", opts, async () => {
  const r = await requestActionOtp(h.deps, "1", { sessionId: sid, action: "bulk_sms", summary: summaryBulkSms(25) });
  const m = h.sms[h.sms.length - 1].message;
  assert.ok(m.includes("SMS to 25 recipients") && m.includes("valid 5 min"));
  const a = (await col("actionOtps").doc(r.actionId).get()).data()!;
  assert.ok(a.otpHash && !JSON.stringify(a).includes(lastOtp(h)));
  assert.ok(Math.abs(a.otpExpiresAt - (a.createdAt + 5 * 60_000)) < 1000);
  assert.equal(a.sessionId, sid); assert.equal(a.agentId, "1"); assert.equal(a.action, "bulk_sms");
});
test("verify then requireSession consumes it exactly once", opts, async () => {
  const r = await requestActionOtp(h.deps, "1", { sessionId: sid, action: "export", summary: summaryExport("members") });
  assert.deepEqual(await verifyActionOtp(h.deps, "1", { actionId: r.actionId, otp: lastOtp(h) }), { ok: true });
  assert.deepEqual(await verifyActionOtp(h.deps, "1", { actionId: r.actionId, otp: lastOtp(h) }), { ok: true }); // double submit
  await requireSession({ sessionId: sid, uid: "1", scope: "export", action: "export", actionId: r.actionId });
  await rejects(requireSession({ sessionId: sid, uid: "1", scope: "export", action: "export", actionId: r.actionId }), "otp_required");
  await rejects(verifyActionOtp(h.deps, "1", { actionId: r.actionId, otp: lastOtp(h) }), "otp_required", /already used/);
});
test("the summary must equal the contract builder's output", opts, async () => {
  for (const [action, summary] of [["bulk_sms", "SMS to 0 recipients"], ["bulk_sms", "send everything"], ["export", "Export secrets"], ["rent_stk", summaryBulkSms(2)]] as const) {
    await rejects(requestActionOtp(h.deps, "1", { sessionId: sid, action, summary }), "invalid_argument");
  }
  assert.equal((await col("actionOtps").get()).size, 0);
});
test("the session must include the action's scope and belong to the agent", opts, async () => {
  const readOnly = await openSession(h, "1", "chama:SMC-0002", ["read"]);
  await rejects(requestActionOtp(h.deps, "1", { sessionId: readOnly, action: "bulk_sms", summary: summaryBulkSms(2) }), "permission_denied");
  await rejects(requestActionOtp(h.deps, "2", { sessionId: sid, action: "bulk_sms", summary: summaryBulkSms(2) }), "permission_denied");
  await rejects(requestActionOtp(h.deps, "1", { sessionId: sid, action: "refund", summary: "x" }), "invalid_argument");
});
test("an authorisation removed by the customer stops new action OTPs", opts, async () => {
  h.state.delegate = () => entityInfo({ agentAuthorised: false });
  await rejects(requestActionOtp(h.deps, "1", { sessionId: sid, action: "bulk_sms", summary: summaryBulkSms(2) }), "permission_denied");
});
test("wrong codes: 5 attempts then dead, even for the right code", opts, async () => {
  const r = await requestActionOtp(h.deps, "1", { sessionId: sid, action: "bulk_sms", summary: summaryBulkSms(3) });
  const good = lastOtp(h); const bad = good === "000000" ? "111111" : "000000";
  for (let i = 0; i < 4; i++) await rejects(verifyActionOtp(h.deps, "1", { actionId: r.actionId, otp: bad }), "otp_invalid", /not correct/);
  await rejects(verifyActionOtp(h.deps, "1", { actionId: r.actionId, otp: bad }), "otp_invalid", /Too many/);
  await rejects(verifyActionOtp(h.deps, "1", { actionId: r.actionId, otp: good }), "otp_invalid");
});
test("expired, foreign, unknown and malformed", opts, async () => {
  const r = await requestActionOtp(h.deps, "1", { sessionId: sid, action: "bulk_sms", summary: summaryBulkSms(3) });
  await rejects(verifyActionOtp(h.deps, "2", { actionId: r.actionId, otp: lastOtp(h) }), "permission_denied");
  await rejects(verifyActionOtp(h.deps, "1", { actionId: "nope", otp: "123456" }), "otp_required");
  await rejects(verifyActionOtp(h.deps, "1", { actionId: r.actionId, otp: "abc" }), "invalid_argument");
  await col("actionOtps").doc(r.actionId).update({ otpExpiresAt: Date.now() - 1 });
  await rejects(verifyActionOtp(h.deps, "1", { actionId: r.actionId, otp: lastOtp(h) }), "otp_invalid", /expired/);
});
test("an ended session invalidates its pending action OTP", opts, async () => {
  const r = await requestActionOtp(h.deps, "1", { sessionId: sid, action: "bulk_sms", summary: summaryBulkSms(3) });
  await col("sessions").doc(sid).update({ status: "ended" });
  await rejects(verifyActionOtp(h.deps, "1", { actionId: r.actionId, otp: lastOtp(h) }), "session_invalid");
});
test("SMS failure deletes the OTP and says so", opts, async () => {
  h.state.smsFails = true;
  await rejects(requestActionOtp(h.deps, "1", { sessionId: sid, action: "bulk_sms", summary: summaryBulkSms(3) }), "internal", /could not send/);
  assert.equal((await col("actionOtps").get()).size, 0);
});
