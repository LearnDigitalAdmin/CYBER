import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { emulatorEnabled, clearFirestore } from "../testing/emulator.js";
import { col } from "../db.js";
import { requestAccess, verifyAccess, endSession } from "./access.js";
import { ADMIN_PHONE, clearChama, entityInfo, harness, lastOtp, openSession, rejects, seedAgent, type Harness } from "../connectors/harness.test.js";
import { hashOtp } from "../otp/core.js";
import type { CustomerDoc, SessionDoc } from "../types.js";

const opts = { skip: !emulatorEnabled };
const KEY = "chama:SMC-0001";
let h: Harness;
beforeEach(async () => {
  if (!emulatorEnabled) return;
  await clearFirestore(); await clearChama(); h = harness();
  await seedAgent("1"); await seedAgent("2"); await seedAgent("0", { agentCode: "COG-0000", rank: "lead" });
});
const session = async (id: string) => (await col("sessions").doc(id).get()).data() as SessionDoc;
const customer = async (key = KEY) => (await col("customers").doc(key).get()).data() as CustomerDoc | undefined;

test("request sends the agreed SMS, stores only a hash and a 5-minute expiry", opts, async () => {
  const before = Date.now();
  const r = await requestAccess(h.deps, "1", { entityKey: KEY, scopes: ["read", "import"] });
  assert.equal(h.sms.length, 1); assert.equal(h.sms[0].to, "+254722000111");
  assert.match(h.sms[0].message, /^Samuhia Desk: Agent 1 \(COG-0001\) asks to access Umoja Chama\. Code \d{6}, valid 5 min\. Share it ONLY if you asked for help\.$/);
  assert.equal(r.otpSentTo.includes("0111") || r.otpSentTo.includes("111"), true);
  assert.ok(!r.otpSentTo.includes("722000"));
  const s = await session(r.sessionId);
  assert.equal(s.status, "pending"); assert.deepEqual(s.scopes, ["read", "import"]);
  assert.equal(s.otpHash, hashOtp(lastOtp(h), r.sessionId));
  assert.ok(s.otpExpiresAt >= before + 5 * 60_000 - 1000 && s.otpExpiresAt <= Date.now() + 5 * 60_000);
  assert.ok(!JSON.stringify(s).includes(lastOtp(h)));
});
test("verify activates for 60 minutes and claims ownership once", opts, async () => {
  const id = await openSession(h, "1", KEY, ["read"]);
  const s = await session(id);
  assert.equal(s.status, "active"); assert.ok(s.otpVerifiedAt); assert.equal(s.otpHash, undefined);
  assert.ok(Math.abs(s.expiresAt - (s.otpVerifiedAt! + 60 * 60_000)) < 1000);
  const c = await customer();
  assert.equal(c?.ownerAgentId, "1"); assert.equal(c?.selfOwned, false); assert.equal(c?.firstPurchaseUsed, false); assert.deepEqual(c?.paidPeriods, []);
  const first = c!.attributedAt;
  await openSession(h, "2", KEY, ["read"]);
  const again = await customer();
  assert.equal(again?.ownerAgentId, "1"); assert.equal(again?.attributedAt, first);
});
test("COG-0000 never claims ownership", opts, async () => {
  await openSession(h, "0", KEY, ["read"]);
  assert.equal(await customer(), undefined);
});
test("COG-0000 is authorised even when the product says no", opts, async () => {
  h.state.delegate = () => entityInfo({ agentAuthorised: false });
  await requestAccess(h.deps, "0", { entityKey: KEY, scopes: ["read"] });
  assert.equal(h.sms.length, 1);
});
test("a verified chama claim writes deskOwner into the Chama project", opts, async () => {
  await h.chama.collection("chamas").doc("c1").set({ code: "SMC-0001", name: "Umoja" });
  await openSession(h, "1", KEY, ["read"]);
  const owner = (await h.chama.collection("chamas").doc("c1").get()).data()?.deskOwner;
  assert.equal(owner?.agentCode, "COG-0001"); assert.equal(owner?.rank, "clerk"); assert.equal(owner?.subaccountCode, "ACCT_main_1");
});
test("other products need nothing written", opts, async () => {
  await openSession(h, "1", "pms:PYL-0001", ["read"]);
  assert.equal((await customer("pms:PYL-0001"))?.ownerAgentId, "1");
  assert.equal(h.chama && (await h.chama.collection("chamas").get()).size, 0);
});
test("a failed deskOwner write does not fail verification and leaves an audit trail", opts, async () => {
  await openSession(h, "1", KEY, ["read"]); // no chama doc exists
  assert.equal((await customer())?.ownerAgentId, "1");
  assert.equal((await col("audit").where("action", "==", "desk_owner_pending").get()).size, 1);
});
test("refusals: desk not authorised, bad key, bad scopes, inactive agent", opts, async () => {
  h.state.delegate = () => entityInfo({ agentAuthorised: false });
  await rejects(requestAccess(h.deps, "1", { entityKey: KEY, scopes: ["read"] }), "permission_denied", /Settings → Support Agents/);
  h.state.delegate = () => entityInfo();
  await rejects(requestAccess(h.deps, "1", { entityKey: "chama:nope", scopes: ["read"] }), "invalid_argument");
  await rejects(requestAccess(h.deps, "1", { entityKey: KEY, scopes: [] }), "invalid_argument");
  await rejects(requestAccess(h.deps, "1", { entityKey: KEY, scopes: ["root"] }), "invalid_argument");
  await col("agents").doc("2").update({ status: "suspended" });
  await rejects(requestAccess(h.deps, "2", { entityKey: KEY, scopes: ["read"] }), "permission_denied");
  assert.equal(h.sms.length, 0);
});
test("self-owned: agent phone equal to admin phone is refused", opts, async () => {
  await col("agents").doc("1").update({ phone: "+254" + ADMIN_PHONE.slice(1) });
  await rejects(requestAccess(h.deps, "1", { entityKey: KEY, scopes: ["read"] }), "permission_denied");
  assert.equal(h.sms.length, 0);
});
test("at most 3 requests per desk and entity per hour", opts, async () => {
  for (let i = 0; i < 3; i++) await requestAccess(h.deps, "1", { entityKey: KEY, scopes: ["read"] });
  await rejects(requestAccess(h.deps, "1", { entityKey: KEY, scopes: ["read"] }), "failed_precondition", /too many times/);
  await requestAccess(h.deps, "2", { entityKey: KEY, scopes: ["read"] }); // other desk unaffected
});
test("at most 10 OTP messages per entity per day", opts, async () => {
  const ids = Array.from({ length: 5 }, (_, i) => String(10 + i));
  for (const id of ids) await seedAgent(id);
  let sent = 0;
  for (const id of ids) for (let i = 0; i < 3; i++) { try { await requestAccess(h.deps, id, { entityKey: KEY, scopes: ["read"] }); sent++; } catch { break; } }
  assert.equal(sent, 10);
  await rejects(requestAccess(h.deps, "2", { entityKey: KEY, scopes: ["read"] }), "failed_precondition", /today/);
});
test("an SMS failure deletes the session, says so and frees the rate slot", opts, async () => {
  h.state.smsFails = true;
  await rejects(requestAccess(h.deps, "1", { entityKey: KEY, scopes: ["read"] }), "internal", /could not send/);
  assert.equal((await col("sessions").get()).size, 0);
  h.state.smsFails = false;
  for (let i = 0; i < 3; i++) await requestAccess(h.deps, "1", { entityKey: KEY, scopes: ["read"] });
});
test("a new request ends older pending sessions for the same desk and entity", opts, async () => {
  const a = await requestAccess(h.deps, "1", { entityKey: KEY, scopes: ["read"] });
  const oldOtp = lastOtp(h);
  await requestAccess(h.deps, "1", { entityKey: KEY, scopes: ["read"] });
  await rejects(verifyAccess(h.deps, "1", { sessionId: a.sessionId, otp: oldOtp }), "session_invalid");
});
test("wrong codes: counted, 5th ends the session even for the right code", opts, async () => {
  const r = await requestAccess(h.deps, "1", { entityKey: KEY, scopes: ["read"] });
  const good = lastOtp(h); const bad = good === "000000" ? "111111" : "000000";
  await rejects(verifyAccess(h.deps, "1", { sessionId: r.sessionId, otp: bad }), "otp_invalid", /4 tries left/);
  for (let i = 0; i < 3; i++) await rejects(verifyAccess(h.deps, "1", { sessionId: r.sessionId, otp: bad }), "otp_invalid");
  await rejects(verifyAccess(h.deps, "1", { sessionId: r.sessionId, otp: bad }), "otp_invalid", /Too many/);
  assert.equal((await session(r.sessionId)).status, "ended");
  await rejects(verifyAccess(h.deps, "1", { sessionId: r.sessionId, otp: good }), "session_invalid");
  assert.equal(await customer(), undefined);
});
test("expired code is refused and the session expires", opts, async () => {
  const r = await requestAccess(h.deps, "1", { entityKey: KEY, scopes: ["read"] });
  await col("sessions").doc(r.sessionId).update({ otpExpiresAt: Date.now() - 1 });
  await rejects(verifyAccess(h.deps, "1", { sessionId: r.sessionId, otp: lastOtp(h) }), "otp_invalid", /expired/);
  assert.equal((await session(r.sessionId)).status, "expired");
});
test("another agent cannot verify or end my session; malformed codes are refused", opts, async () => {
  const r = await requestAccess(h.deps, "1", { entityKey: KEY, scopes: ["read"] });
  await rejects(verifyAccess(h.deps, "2", { sessionId: r.sessionId, otp: lastOtp(h) }), "permission_denied");
  await rejects(endSession(h.deps, "2", { sessionId: r.sessionId }), "permission_denied");
  await rejects(verifyAccess(h.deps, "1", { sessionId: r.sessionId, otp: "12" }), "invalid_argument");
  await rejects(verifyAccess(h.deps, "1", { sessionId: "nope", otp: "123456" }), "session_invalid");
});
test("verify twice is harmless (idempotent) and does not claim twice", opts, async () => {
  const r = await requestAccess(h.deps, "1", { entityKey: KEY, scopes: ["read"] });
  const otp = lastOtp(h);
  const a = await verifyAccess(h.deps, "1", { sessionId: r.sessionId, otp });
  const b = await verifyAccess(h.deps, "1", { sessionId: r.sessionId, otp });
  assert.equal(a.expiresAt, b.expiresAt);
  assert.equal((await col("audit").where("action", "==", "ownership_claimed").get()).size, 1);
});
test("end session is idempotent and audited once", opts, async () => {
  const id = await openSession(h, "1", KEY, ["read"]);
  assert.deepEqual(await endSession(h.deps, "1", { sessionId: id }), { ok: true });
  assert.deepEqual(await endSession(h.deps, "1", { sessionId: id }), { ok: true });
  assert.equal((await session(id)).status, "ended");
  assert.equal((await col("audit").where("action", "==", "session_ended").get()).size, 1);
  await rejects(endSession(h.deps, "1", { sessionId: "missing" }), "session_invalid");
});
