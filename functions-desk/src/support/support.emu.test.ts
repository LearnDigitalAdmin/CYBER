import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { SUPPORT_CATEGORIES } from "../contract.js";
import { emulatorEnabled, clearFirestore } from "../testing/emulator.js";
import { col } from "../db.js";
import { confirmSupport, logSupport } from "./handlers.js";
import { ADMIN_PHONE, clearChama, entityInfo, harness, lastOtp, rejects, seedAgent, type Harness } from "../connectors/harness.test.js";
import { hashOtp } from "../otp/core.js";

const opts = { skip: !emulatorEnabled };
const KEY = "chama:SMC-0001";
const CAT = SUPPORT_CATEGORIES[0];
let h: Harness;
beforeEach(async () => { if (!emulatorEnabled) return; await clearFirestore(); await clearChama(); h = harness(); await seedAgent("1"); await seedAgent("2"); });
const log = (uid = "1", o = {}) => logSupport(h.deps, uid, { entityKey: KEY, category: CAT, notes: "Helped add members", ...o });

test("log creates the record and SMSes a hashed 24h code with no mention of rewards", opts, async () => {
  const r = await log();
  const s = (await col("support").doc(r.id).get()).data()!;
  assert.equal(s.agentId, "1"); assert.equal(s.category, CAT); assert.equal(s.codeHash, hashOtp(lastOtp(h), r.id));
  assert.ok(Math.abs(s.codeExpiresAt - (s.createdAt + 24 * 3_600_000)) < 1000); assert.equal(s.codeAttempts, 0);
  assert.equal(h.sms[0].to, "+254722000111");
  assert.doesNotMatch(h.sms[0].message, /reward|bonus|commission|earn|pay|KES/i);
  assert.ok(!r.codeSentTo.includes("722000"));
});
test("confirm with the right code sets customerConfirmedAt once", opts, async () => {
  const r = await log();
  assert.deepEqual(await confirmSupport(h.deps, "1", { id: r.id, code: lastOtp(h) }), { ok: true });
  const at = (await col("support").doc(r.id).get()).data()?.customerConfirmedAt;
  assert.ok(at);
  await confirmSupport(h.deps, "1", { id: r.id, code: lastOtp(h) });
  assert.equal((await col("support").doc(r.id).get()).data()?.customerConfirmedAt, at);
  assert.equal((await col("audit").where("action", "==", "support_confirmed").get()).size, 1);
});
test("wrong codes: 5 attempts then locked for good", opts, async () => {
  const r = await log(); const good = lastOtp(h); const bad = good === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++) await rejects(confirmSupport(h.deps, "1", { id: r.id, code: bad }), "otp_invalid");
  await rejects(confirmSupport(h.deps, "1", { id: r.id, code: good }), "otp_invalid");
  assert.equal((await col("support").doc(r.id).get()).data()?.customerConfirmedAt, undefined);
});
test("expired, other desk's record, unknown id", opts, async () => {
  const r = await log();
  await rejects(confirmSupport(h.deps, "2", { id: r.id, code: lastOtp(h) }), "not_found");
  await rejects(confirmSupport(h.deps, "1", { id: "nope", code: "123456" }), "not_found");
  await col("support").doc(r.id).update({ codeExpiresAt: Date.now() - 1 });
  await rejects(confirmSupport(h.deps, "1", { id: r.id, code: lastOtp(h) }), "otp_invalid", /expired/);
});
test("desk must be authorised; self-owned refused; inputs validated", opts, async () => {
  h.state.delegate = () => entityInfo({ agentAuthorised: false });
  await rejects(log(), "permission_denied", /Support Agents/);
  h.state.delegate = () => entityInfo();
  await col("agents").doc("2").update({ phone: "+254" + ADMIN_PHONE.slice(1) });
  await rejects(log("2"), "permission_denied");
  await rejects(log("1", { category: "free-money" }), "invalid_argument");
  await rejects(log("1", { notes: "hi" }), "invalid_argument");
  await rejects(log("1", { notes: "x".repeat(1001) }), "invalid_argument");
  assert.equal((await col("support").get()).size, 0); assert.equal(h.sms.length, 0);
});
test("COG-0000 is authorised everywhere", opts, async () => {
  await seedAgent("0", { agentCode: "COG-0000" });
  h.state.delegate = () => entityInfo({ agentAuthorised: false });
  await log("0");
  assert.equal(h.sms.length, 1);
});
test("SMS failure deletes the record and says so", opts, async () => {
  h.state.smsFails = true;
  await rejects(log(), "internal", /could not send/);
  assert.equal((await col("support").get()).size, 0);
});
