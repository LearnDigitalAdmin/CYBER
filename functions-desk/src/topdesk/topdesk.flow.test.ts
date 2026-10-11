/**
 * Top-desk callables end to end through their handlers: access checks, per-action OTP, status/rank changes, listing, documents.
 * Runs on the real Firestore emulator when FIRESTORE_EMULATOR_HOST is set (npm run desk:test:emu), otherwise on the in-memory double.
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { summaryTopRank, summaryTopStatus } from "../contract.js";
import { col } from "../db.js";
import { DeskError } from "../errors.js";
import { hashOtp } from "../otp/core.js";
import { useStore } from "../requests/memstore.test.js";
import { rejects, seedAgent, seedTop, seedTopOtp, topAuth, TOP_UID } from "../requests/fixtures.test.js";
import type { TopDeps } from "./deps.js";
import {
  topGetDesk, topGetDoc, topListDesks, topRequestOtp, topSetDeskStatus, topSetRank,
} from "./handlers.js";
import { DEFAULT_DESK_CONFIG } from "../config.js";

const store = useStore();
const sms: { to: string; message: string }[] = [];
const files = new Map<string, Buffer>();
let smsFails = false;
const deps: TopDeps = {
  now: () => Date.now(), getConfig: async () => DEFAULT_DESK_CONFIG, randomOtp: () => "654321",
  sendSms: async (to, message) => { if (smsFails) throw new DeskError("internal", "down"); sms.push({ to, message }); },
  store: { read: async (p) => { const b = files.get(p); if (!b) throw new Error("missing"); return b; } },
};
beforeEach(async () => { await store.reset(); sms.length = 0; files.clear(); smsFails = false; await seedTop(); });

const auditCount = async (action: string) => (await col("audit").where("action", "==", action).get()).size;
const seedDocs = async (uid: string, kinds = ["id_front", "id_back", "selfie"]) => {
  for (const kind of kinds) await col("docs").doc(`${uid}_${kind}`).set({ id: `${uid}_${kind}`, uid, kind, contentType: "image/png", sizeBytes: 3, path: `desk-docs/${uid}/${kind}`, uploadedAt: 5 });
};

// ------------------------------------------------------------------ access
test("every top-desk call refuses non-top, non-samuhia, unverified and stale sessions", async () => {
  await seedAgent("5");
  const calls = (a: ReturnType<typeof topAuth>) => [
    topListDesks(a, {}), topGetDesk(deps, a, { deskCode: "COG-0005" }), topGetDoc(deps, a, { deskCode: "COG-0005", kind: "selfie" }),
    topRequestOtp(deps, a, { action: "set_rank", summary: summaryTopRank("COG-0005", "senior") }),
    topSetDeskStatus(deps, a, { deskCode: "COG-0005", status: "suspended", reason: "fraud suspected", actionId: "x", otp: "123456" }),
    topSetRank(deps, a, { deskCode: "COG-0005", rank: "senior", actionId: "x", otp: "123456" }),
  ];
  for (const [label, a, code] of [
    ["agent", topAuth({ uid: "5", email: "a@samuhia.co.ke" }), "permission_denied"],
    ["wrong domain", topAuth({ email: "boss@gmail.com" }), "permission_denied"],
    ["lookalike domain", topAuth({ email: "boss@samuhia.co.ke.evil.com" }), "permission_denied"],
    ["unverified", topAuth({ verified: false }), "permission_denied"],
    ["stale sign-in", topAuth({ authTime: Math.floor(Date.now() / 1000) - 16 * 60 }), "unauthenticated"],
  ] as const) for (const p of calls(a)) await rejects(p, code, undefined).catch((e) => { throw new Error(`${label}: ${e.message}`); });
  await rejects(topListDesks(null, {}), "unauthenticated");
  await col("agents").doc(TOP_UID).update({ status: "suspended" });
  await rejects(topListDesks(topAuth(), {}), "permission_denied");
});

// ------------------------------------------------------------------ OTP request
test("requestOtp texts the code to the top desk's own phone and stores only a hash and the summary", async () => {
  await seedAgent("5");
  const summary = summaryTopStatus("COG-0005", "suspended");
  const r = await topRequestOtp(deps, topAuth(), { action: "set_desk_status", summary });
  assert.equal(sms.length, 1); assert.equal(sms[0].to, "+254700000001"); assert.match(sms[0].message, /Code 654321/); assert.match(sms[0].message, /COG-0005 to suspended/);
  assert.ok(!r.otpSentTo.includes("700000"));
  const d = (await col("topOtps").doc(r.actionId).get()).data()!;
  assert.equal(d.otpHash, hashOtp("654321", r.actionId)); assert.equal(d.summary, summary); assert.equal(d.uid, TOP_UID); assert.equal(d.otpAttempts, 0);
  assert.ok(Math.abs(d.otpExpiresAt - d.createdAt - 300_000) < 1000);
  assert.equal(JSON.stringify(d).includes("654321"), false);
  assert.equal(await auditCount("top_otp_requested"), 1);
});
test("requestOtp refuses bad actions and summaries, and undoes itself when the SMS fails", async () => {
  await rejects(topRequestOtp(deps, topAuth(), { action: "wire_money", summary: "x" }), "invalid_argument");
  await rejects(topRequestOtp(deps, topAuth(), { action: "set_rank", summary: "Set desk COG-0005 rank to god" }), "invalid_argument");
  await rejects(topRequestOtp(deps, topAuth(), { action: "set_desk_status", summary: summaryTopStatus("COG-0000", "closed") }), "invalid_argument");
  await rejects(topRequestOtp(deps, topAuth(), {}), "invalid_argument");
  assert.equal(sms.length, 0); assert.equal((await col("topOtps").get()).size, 0);
  smsFails = true;
  await rejects(topRequestOtp(deps, topAuth(), { action: "set_rank", summary: summaryTopRank("COG-0005", "senior") }), "internal", /could not send/);
  assert.equal((await col("topOtps").get()).size, 0);
});
test("requestOtp is rate limited", async () => {
  for (let i = 0; i < 10; i++) await topRequestOtp(deps, topAuth(), { action: "set_rank", summary: summaryTopRank("COG-0005", "senior") });
  await rejects(topRequestOtp(deps, topAuth(), { action: "set_rank", summary: summaryTopRank("COG-0005", "senior") }), "failed_precondition", /Too many/);
});

// ------------------------------------------------------------------ set status
const suspendArgs = (o: Record<string, unknown> = {}) => ({ deskCode: "COG-0005", status: "suspended", reason: "reported by customers", actionId: "act1", otp: "123456", ...o });

test("suspend: right code applies the change, consumes the code and ends the desk's sessions", async () => {
  await seedAgent("5");
  await seedAgent("6");
  await seedTopOtp("act1", "set_desk_status", summaryTopStatus("COG-0005", "suspended"));
  for (const [id, agentId, status] of [["s1", "5", "active"], ["s2", "5", "pending"], ["s3", "5", "ended"], ["s4", "6", "active"]])
    await col("sessions").doc(id).set({ sessionId: id, agentId, status, entityKey: "chama:SMC-0001", scopes: [], otpAttempts: 0, otpExpiresAt: 0, expiresAt: Date.now() + 1e6, createdAt: 1 });
  assert.deepEqual(await topSetDeskStatus(deps, topAuth(), suspendArgs()), { ok: true });
  const a = (await col("agents").doc("5").get()).data()!;
  assert.equal(a.status, "suspended"); assert.equal(a.statusReason, "reported by customers");
  const o = (await col("topOtps").doc("act1").get()).data()!;
  assert.ok(o.consumedAt && o.verifiedAt);
  assert.equal((await col("sessions").doc("s1").get()).data()!.status, "ended"); assert.equal((await col("sessions").doc("s2").get()).data()!.status, "ended");
  assert.equal((await col("sessions").doc("s4").get()).data()!.status, "active");
  const au = (await col("audit").where("action", "==", "top_set_desk_status").get()).docs[0].data();
  assert.equal(au.agentId, TOP_UID); assert.equal(au.meta.sessionsEnded, 2); assert.equal(au.meta.from, "active"); assert.equal(au.meta.to, "suspended");
  // the code cannot be used again (the desk is already suspended, so the business check refuses first)
  await rejects(topSetDeskStatus(deps, topAuth(), suspendArgs()), "failed_precondition", /already suspended/);
});
test("wrong code: attempts counted, nothing changes, locks after 5, and the right code no longer works", async () => {
  await seedAgent("5");
  await seedTopOtp("act1", "set_desk_status", summaryTopStatus("COG-0005", "suspended"));
  for (let i = 0; i < 5; i++) await rejects(topSetDeskStatus(deps, topAuth(), suspendArgs({ otp: "000000" })), "otp_invalid");
  assert.equal((await col("topOtps").doc("act1").get()).data()!.otpAttempts, 5);
  await rejects(topSetDeskStatus(deps, topAuth(), suspendArgs()), "otp_invalid");
  assert.equal((await col("agents").doc("5").get()).data()!.status, "active");
});
test("a code for a different action, target or status does not authorise this one, and is not consumed", async () => {
  await seedAgent("5");
  await seedAgent("6");
  await seedTopOtp("act1", "set_desk_status", summaryTopStatus("COG-0005", "suspended"));
  await rejects(topSetDeskStatus(deps, topAuth(), suspendArgs({ deskCode: "COG-0006" })), "permission_denied", /different action/);
  await rejects(topSetDeskStatus(deps, topAuth(), suspendArgs({ status: "closed" })), "permission_denied", /different action/);
  await rejects(topSetRank(deps, topAuth(), { deskCode: "COG-0005", rank: "senior", actionId: "act1", otp: "123456" }), "permission_denied", /different action/);
  const o = (await col("topOtps").doc("act1").get()).data()!;
  assert.equal(o.consumedAt, undefined); assert.equal(o.otpAttempts, 0);
  assert.equal((await col("agents").doc("5").get()).data()!.status, "active");
});
test("missing, expired and someone else's code are refused", async () => {
  await seedAgent("5");
  await rejects(topSetDeskStatus(deps, topAuth(), suspendArgs({ actionId: "nope" })), "otp_required");
  await rejects(topSetDeskStatus(deps, topAuth(), suspendArgs({ actionId: undefined })), "invalid_argument");
  await rejects(topSetDeskStatus(deps, topAuth(), suspendArgs({ otp: "12" })), "invalid_argument");
  await seedTopOtp("exp", "set_desk_status", summaryTopStatus("COG-0005", "suspended"), "123456", { otpExpiresAt: Date.now() - 1 });
  await rejects(topSetDeskStatus(deps, topAuth(), suspendArgs({ actionId: "exp" })), "otp_invalid", /expired/);
  await seedTopOtp("alien", "set_desk_status", summaryTopStatus("COG-0005", "suspended"), "123456", { uid: "someone-else" });
  await rejects(topSetDeskStatus(deps, topAuth(), suspendArgs({ actionId: "alien" })), "permission_denied");
});
test("never COG-0000, never yourself; reason 5–300; closed is final; suspend only from active", async () => {
  await seedAgent("5");
  await seedTopOtp("act1", "set_desk_status", summaryTopStatus("COG-0000", "suspended"));
  await rejects(topSetDeskStatus(deps, topAuth(), suspendArgs({ deskCode: "COG-0000" })), "permission_denied");
  await rejects(topSetDeskStatus(deps, topAuth(), suspendArgs({ reason: "no" })), "invalid_argument");
  await rejects(topSetDeskStatus(deps, topAuth(), suspendArgs({ status: "applied" })), "invalid_argument");
  await rejects(topSetDeskStatus(deps, topAuth(), suspendArgs({ deskCode: "COG-0099" })), "not_found");
  // another account with the top code is still refused for its own record
  await seedAgent("7", { status: "certified" });
  await seedTopOtp("act2", "set_desk_status", summaryTopStatus("COG-0007", "suspended"));
  await rejects(topSetDeskStatus(deps, topAuth(), suspendArgs({ deskCode: "COG-0007", actionId: "act2" })), "failed_precondition", /Only an active desk/);
  assert.equal((await col("topOtps").doc("act2").get()).data()!.consumedAt, undefined); // business refusal leaves the code usable
  await seedTopOtp("act3", "set_desk_status", summaryTopStatus("COG-0005", "closed"));
  await topSetDeskStatus(deps, topAuth(), suspendArgs({ status: "closed", actionId: "act3" }));
  assert.ok((await col("agents").doc("5").get()).data()!.closedAt);
  await seedTopOtp("act4", "set_desk_status", summaryTopStatus("COG-0005", "active"));
  await rejects(topSetDeskStatus(deps, topAuth(), suspendArgs({ status: "active", actionId: "act4" })), "failed_precondition", /closed/);
});
test("activation needs all three documents and a ready main payout account", async () => {
  await seedAgent("8", { status: "certified" });
  const act = (id: string) => seedTopOtp(id, "set_desk_status", summaryTopStatus("COG-0008", "active"));
  const run = (id: string) => topSetDeskStatus(deps, topAuth(), { deskCode: "COG-0008", status: "active", reason: "documents checked", actionId: id, otp: "123456" });
  await act("a1"); await rejects(run("a1"), "failed_precondition", /three registration documents/);
  await seedDocs("8", ["id_front", "id_back"]); await rejects(run("a1"), "failed_precondition", /three registration documents/);
  await seedDocs("8");
  await col("agents").doc("8").update({ status: "certified" });
  await (await import("../db.js")).db().collection("agents").doc("8").set({ email: "8@x.co", paymentInfo: { settlementBank: "mpesa" } }); // no accountId
  await rejects(run("a1"), "failed_precondition", /payout account/);
  await (await import("../db.js")).db().collection("agents").doc("8").set({ email: "8@x.co", paymentInfo: { accountId: "ACCT_x" } });
  assert.deepEqual(await run("a1"), { ok: true });
  assert.equal((await col("agents").doc("8").get()).data()!.status, "active");
  // suspended <-> active
  await seedTopOtp("a2", "set_desk_status", summaryTopStatus("COG-0008", "suspended"));
  await topSetDeskStatus(deps, topAuth(), { deskCode: "COG-0008", status: "suspended", reason: "under review", actionId: "a2", otp: "123456" });
  await act("a3"); await run("a3");
  assert.equal((await col("agents").doc("8").get()).data()!.status, "active");
});

// ------------------------------------------------------------------ rank
test("setRank changes the rank with a matching code, audits it, and never touches COG-0000", async () => {
  await seedAgent("5");
  await seedTopOtp("r1", "set_rank", summaryTopRank("COG-0005", "senior"));
  assert.deepEqual(await topSetRank(deps, topAuth(), { deskCode: "COG-0005", rank: "senior", actionId: "r1", otp: "123456" }), { ok: true });
  assert.equal((await col("agents").doc("5").get()).data()!.rank, "senior");
  assert.equal((await col("audit").where("action", "==", "top_set_rank").get()).docs[0].data().meta.to, "senior");
  await col("agents").doc("5").update({ rank: "clerk" }); // so only the used code stands in the way
  await rejects(topSetRank(deps, topAuth(), { deskCode: "COG-0005", rank: "senior", actionId: "r1", otp: "123456" }), "otp_required", /already used/);
  assert.equal((await col("agents").doc("5").get()).data()!.rank, "clerk");
  await seedTopOtp("r2", "set_rank", summaryTopRank("COG-0005", "senior"));
  await topSetRank(deps, topAuth(), { deskCode: "COG-0005", rank: "senior", actionId: "r2", otp: "123456" });
  await seedTopOtp("r3", "set_rank", summaryTopRank("COG-0005", "senior"));
  await rejects(topSetRank(deps, topAuth(), { deskCode: "COG-0005", rank: "senior", actionId: "r3", otp: "123456" }), "failed_precondition", /already/);
  await rejects(topSetRank(deps, topAuth(), { deskCode: "COG-0000", rank: "clerk", actionId: "r2", otp: "123456" }), "permission_denied");
  await rejects(topSetRank(deps, topAuth(), { deskCode: "COG-0005", rank: "boss", actionId: "r2", otp: "123456" }), "invalid_argument");
});

// ------------------------------------------------------------------ list / get
test("listDesks: status filter, search by code/name/phone/email, limit, docs count", async () => {
  await seedAgent("1", { name: "Wanjiru Kamau", phone: "+254722000111", email: "wk@x.co", status: "applied" });
  await seedAgent("2", { name: "Otieno Odhiambo", status: "active" });
  await seedAgent("3", { name: "Kamau Njoroge", status: "active" });
  await seedDocs("2", ["id_front"]);
  const names = async (i: object) => (await topListDesks(topAuth(), i)).desks.map((d) => d.name).sort();
  assert.deepEqual(await names({}), ["Top Desk", "Kamau Njoroge", "Otieno Odhiambo", "Wanjiru Kamau"].sort());
  assert.deepEqual(await names({ status: "active" }), ["Top Desk", "Kamau Njoroge", "Otieno Odhiambo"].sort());
  assert.deepEqual(await names({ search: "kamau" }), ["Kamau Njoroge", "Wanjiru Kamau"]);
  assert.deepEqual(await names({ search: "0722 000 111" }), ["Wanjiru Kamau"]);
  assert.deepEqual(await names({ search: "COG-0003" }), ["Kamau Njoroge"]);
  assert.deepEqual(await names({ search: "wk@x" }), ["Wanjiru Kamau"]);
  assert.equal((await topListDesks(topAuth(), { limit: 2 })).desks.length, 2);
  assert.equal((await topListDesks(topAuth(), { search: "otieno" })).desks[0].docsUploaded, 1);
  await rejects(topListDesks(topAuth(), { status: "boss" }), "invalid_argument");
  assert.ok(await auditCount("top_list_desks") >= 1);
});
test("getDesk: masked ID, doc status, earnings sums, payout accounts, last 20 audit rows", async () => {
  await seedAgent("5", { termsAcceptedAt: 77, statusReason: "ok" });
  await seedDocs("5", ["selfie"]);
  const L = async (id: string, status: string, amountMinor: number) => col("ledger").doc(id).set({ entryId: id, agentId: "5", kind: "service", status, amountMinor, createdAt: 1 });
  await L("l1", "settled", 1000); await L("l2", "settled", 500); await L("l3", "payable", 200_000); await L("l4", "processing", 30_000); await L("l5", "paid", 70_000); await L("l6", "void", 99_999);
  await col("ledger").doc("other").set({ entryId: "other", agentId: "6", kind: "service", status: "settled", amountMinor: 123456, createdAt: 1 });
  for (let i = 0; i < 25; i++) await col("audit").doc().set({ action: `a${i}`, agentId: "5", at: 1000 + i, meta: {} });
  const r = await topGetDesk(deps, topAuth(), { deskCode: "cog-0005" });
  assert.equal(r.desk.idNumberMasked, "****1234"); assert.equal(r.desk.termsAcceptedAt, 77); assert.equal(r.desk.statusReason, "ok"); assert.equal(r.desk.docsUploaded, 1);
  assert.deepEqual(r.docs.map((d) => [d.kind, Boolean(d.uploadedAt)]), [["id_front", false], ["id_back", false], ["selfie", true]]);
  assert.deepEqual(r.earnings, { settledMinor: 1500, payableMinor: 230_000, paidMinor: 70_000 });
  assert.deepEqual(r.payoutAccounts, [{ account: "main", ready: true }]);
  assert.equal(r.recentAudit.length, 20); assert.equal(r.recentAudit[0].action, "a24");
  assert.equal(JSON.stringify(r).includes("idHash"), false);
  await rejects(topGetDesk(deps, topAuth(), { deskCode: "COG-0404" }), "not_found");
  await rejects(topGetDesk(deps, topAuth(), { deskCode: "x" }), "invalid_argument");
});
test("getDoc returns the file as base64 and writes an audit row EVERY time", async () => {
  await seedAgent("5"); await seedDocs("5", ["selfie"]);
  files.set("desk-docs/5/selfie", Buffer.from([1, 2, 3, 4]));
  for (let i = 1; i <= 3; i++) {
    assert.deepEqual(await topGetDoc(deps, topAuth(), { deskCode: "COG-0005", kind: "selfie" }), { contentType: "image/png", dataBase64: "AQIDBA==" });
    assert.equal(await auditCount("top_get_doc"), i);
  }
  const au = (await col("audit").where("action", "==", "top_get_doc").get()).docs[0].data();
  assert.equal(au.agentId, TOP_UID); assert.equal(au.meta.deskCode, "COG-0005"); assert.equal(au.meta.kind, "selfie");
  await rejects(topGetDoc(deps, topAuth(), { deskCode: "COG-0005", kind: "id_back" }), "not_found");
  await rejects(topGetDoc(deps, topAuth(), { deskCode: "COG-0005", kind: "passport" }), "invalid_argument");
  files.clear();
  await rejects(topGetDoc(deps, topAuth(), { deskCode: "COG-0005", kind: "selfie" }), "internal", /could not load/);
});
