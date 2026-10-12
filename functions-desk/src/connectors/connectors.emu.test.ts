import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { emulatorEnabled, clearFirestore } from "../testing/emulator.js";
import { DEFAULT_DESK_CONFIG } from "../config.js";
import { col, db } from "../db.js";
import { DeskError } from "../errors.js";
import { resolveEntity, validateImport } from "./resolve.js";
import { syncPayoutAccounts } from "./payout.js";
import { executePaidTicket, MAX_EXECUTION_ATTEMPTS } from "./tickets.js";
import { writeDeskOwner } from "./deskOwner.js";
import { ADMIN_PHONE, clearChama, entityInfo, harness, openSession, rejects, seedAgent, type Harness } from "./harness.test.js";
import type { AgentDoc, TicketDoc } from "../types.js";

const opts = { skip: !emulatorEnabled };
const KEY = "chama:SMC-0001";
let h: Harness;
beforeEach(async () => { if (!emulatorEnabled) return; await clearFirestore(); await clearChama(); h = harness(); await seedAgent("1"); });

// ---------------------------------------------------------------- resolve
test("resolve returns name, masked phone and grant; never the full phone", opts, async () => {
  const out = await resolveEntity(h.deps, "1", { code: "smc-0001" });
  assert.equal(out.entityKey, KEY); assert.equal(out.product, "chama"); assert.equal(out.displayName, "Umoja Chama"); assert.equal(out.agentHasGrant, true);
  assert.ok(!JSON.stringify(out).includes(ADMIN_PHONE.slice(1)));
  assert.equal(h.calls[0].req.action, "entity_info"); assert.equal(h.calls[0].req.agentCode, "COG-0001");
  assert.equal((await col("audit").where("action", "==", "entity_resolved").get()).size, 1);
});
test("resolve maps school and pms codes and reports a missing grant", opts, async () => {
  h.state.delegate = () => entityInfo({ agentAuthorised: false });
  assert.equal((await resolveEntity(h.deps, "1", { code: "01234567" })).product, "school");
  const pms = await resolveEntity(h.deps, "1", { code: "PYL-0009" });
  assert.equal(pms.product, "pms"); assert.equal(pms.agentHasGrant, false);
});
test("COG-0000 is authorised on every entity", opts, async () => {
  await seedAgent("0", { agentCode: "COG-0000" });
  h.state.delegate = () => entityInfo({ agentAuthorised: false });
  assert.equal((await resolveEntity(h.deps, "0", { code: KEY.split(":")[1] })).agentHasGrant, true);
});
test("resolve rejects other shapes, inactive agents and surfaces product refusals", opts, async () => {
  await rejects(resolveEntity(h.deps, "1", { code: "HELLO" }), "invalid_argument");
  await rejects(resolveEntity(h.deps, "1", {}), "invalid_argument");
  await col("agents").doc("1").update({ status: "suspended" });
  await rejects(resolveEntity(h.deps, "1", { code: "SMC-0001" }), "permission_denied");
  await col("agents").doc("1").update({ status: "active" });
  h.state.delegate = () => { throw new DeskError("not_found", "No chama with that code"); };
  await rejects(resolveEntity(h.deps, "1", { code: "SMC-0001" }), "not_found", /No chama/);
});

// ---------------------------------------------------------------- validate import
test("validateImport passes the product's result through unchanged", opts, async () => {
  const sid = await openSession(h, "1", KEY, ["import"]);
  const product = { valid: [{ name: "A", phone: "0712345678" }], errors: [{ row: 2, field: "phone", message: "Bad phone" }] };
  h.state.delegate = (_p, req) => (req.action === "validate_records" ? product : entityInfo());
  const out = await validateImport(h.deps, "1", { sessionId: sid, rows: [{ name: "A", phone: "0712345678" }, { name: "B", phone: "x" }] });
  assert.deepEqual(out, product);
  const call = h.calls.find((c) => c.req.action === "validate_records")!;
  assert.equal(call.req.entityCode, "SMC-0001");
  assert.equal((await col("audit").where("action", "==", "import_validated").get()).size, 1);
});
test("validateImport needs the import scope, rows and an active session", opts, async () => {
  const readOnly = await openSession(h, "1", KEY, ["read"]);
  await rejects(validateImport(h.deps, "1", { sessionId: readOnly, rows: [{ a: 1 }] }), "permission_denied");
  const sid = await openSession(h, "1", KEY, ["import"]);
  await rejects(validateImport(h.deps, "1", { sessionId: sid, rows: [] }), "invalid_argument");
  await rejects(validateImport(h.deps, "1", { sessionId: sid, rows: ["x"] }), "invalid_argument");
  await rejects(validateImport(h.deps, "1", { sessionId: sid, rows: Array.from({ length: 5001 }, () => ({})) }), "invalid_argument", /Too many/);
  await rejects(validateImport(h.deps, "1", { sessionId: "nope", rows: [{}] }), "session_invalid");
});

// ---------------------------------------------------------------- payout accounts
const chamaSeparate = () => { h.state.cfg = { ...DEFAULT_DESK_CONFIG, projects: { chama: "demo-chama", school: "" }, paystackAccounts: { ...DEFAULT_DESK_CONFIG.paystackAccounts, chama: "separate" } }; };
const profile = async (uid = "1") => (await db().collection("agents").doc(uid).get()).data()!;

test("no main subaccount: ready=false with the reason, nothing created", opts, async () => {
  await seedAgent("5", {}, false);
  chamaSeparate();
  const out = await syncPayoutAccounts(h.deps, "5");
  assert.equal(out.accounts[0].account, "main"); assert.equal(out.accounts[0].ready, false); assert.match(out.accounts[0].reason!, /payment account/i);
  assert.equal(h.state.subaccountCalls, 0);
});
test("chama on the main account: only main is reported and nothing is created", opts, async () => {
  const out = await syncPayoutAccounts(h.deps, "1");
  assert.deepEqual(out.accounts, [{ account: "main", ready: true }]);
  assert.equal(h.state.subaccountCalls, 0);
});
test("separate chama account is created once, even for concurrent calls", opts, async () => {
  chamaSeparate();
  const [a, b] = await Promise.all([syncPayoutAccounts(h.deps, "1"), syncPayoutAccounts(h.deps, "1")]);
  assert.equal(h.state.subaccountCalls, 1);
  assert.ok([a, b].some((r) => r.accounts.find((x) => x.account === "chama")?.ready === true));
  assert.equal((await profile()).paymentInfo.productAccounts.chama, "ACCT_chama1");
  assert.equal((await profile()).paymentInfo.accountId, "ACCT_main_1"); // main untouched
  const again = await syncPayoutAccounts(h.deps, "1");
  assert.equal(h.state.subaccountCalls, 1);
  assert.deepEqual(again.accounts, [{ account: "main", ready: true }, { account: "chama", ready: true }]);
});
test("Paystack failure is reported, nothing is stored and the claim is released", opts, async () => {
  chamaSeparate(); h.state.subaccountFails = true;
  const out = await syncPayoutAccounts(h.deps, "1");
  assert.equal(out.accounts[1].ready, false); assert.match(out.accounts[1].reason!, /Paystack said no/);
  assert.equal((await profile()).paymentInfo.productAccounts, undefined);
  h.state.subaccountFails = false;
  assert.equal((await syncPayoutAccounts(h.deps, "1")).accounts[1].ready, true);
});
test("incomplete bank details are reported, not guessed", opts, async () => {
  chamaSeparate();
  await db().collection("agents").doc("1").update({ "paymentInfo.accountNumber": null });
  const out = await syncPayoutAccounts(h.deps, "1");
  assert.equal(out.accounts[1].ready, false); assert.equal(h.state.subaccountCalls, 0);
});
test("sync writes deskOwner on every chama this desk owns, using the chama subaccount", opts, async () => {
  chamaSeparate();
  for (const [id, code] of [["c1", "SMC-0001"], ["c2", "SMC-0002"], ["c3", "SMC-0003"]]) await h.chama.collection("chamas").doc(id).set({ publicCode: code });
  for (const code of ["SMC-0001", "SMC-0002"]) await col("customers").doc(`chama:${code}`).set({ entityKey: `chama:${code}`, product: "chama", ownerAgentId: "1", attributedAt: 1, firstPurchaseUsed: false, paidPeriods: [] });
  await col("customers").doc("chama:SMC-0003").set({ entityKey: "chama:SMC-0003", product: "chama", ownerAgentId: "other", attributedAt: 1, firstPurchaseUsed: false, paidPeriods: [] });
  await syncPayoutAccounts(h.deps, "1");
  const owner = async (id: string) => (await h.chama.collection("chamas").doc(id).get()).data()?.deskOwner;
  assert.equal((await owner("c1")).subaccountCode, "ACCT_chama1"); assert.equal((await owner("c2")).agentCode, "COG-0001");
  assert.equal(await owner("c3"), undefined);
});
test("writeDeskOwner writes nothing when the account is not ready, with the reason", opts, async () => {
  chamaSeparate();
  await h.chama.collection("chamas").doc("c1").set({ publicCode: "SMC-0001" });
  await col("customers").doc(KEY).set({ entityKey: KEY, product: "chama", ownerAgentId: "1", attributedAt: 1, firstPurchaseUsed: false, paidPeriods: [] });
  const agent = (await col("agents").doc("1").get()).data() as AgentDoc;
  const r = await writeDeskOwner(h.deps, h.state.cfg, agent, "SMC-0001");
  assert.equal(r.written, false); assert.match(r.reason!, /not ready/);
  assert.equal((await h.chama.collection("chamas").doc("c1").get()).data()?.deskOwner, undefined);
});
test("writeDeskOwner refuses a chama this desk does not own", opts, async () => {
  await h.chama.collection("chamas").doc("c1").set({ publicCode: "SMC-0001" });
  const agent = (await col("agents").doc("1").get()).data() as AgentDoc;
  assert.equal((await writeDeskOwner(h.deps, h.state.cfg, agent, "SMC-0001")).written, false);
});

// ---------------------------------------------------------------- tickets
async function ticket(id: string, serviceType: TicketDoc["serviceType"], draft: Record<string, unknown>, status: TicketDoc["status"] = "paid") {
  const t: TicketDoc = { ticketId: id, agentId: "1", entityKey: KEY, sessionId: "s", serviceType, amountMinor: 100, draft, status, createdAt: 1, updatedAt: 1 };
  await col("tickets").doc(id).set(t);
}
const tk = async (id: string) => (await col("tickets").doc(id).get()).data() as TicketDoc & Record<string, unknown>;

test("paid import commits through commit_records with requestId = ticketId, rows rebuilt from chunks", opts, async () => {
  await ticket("t1", "import_excel", { rows: [{ name: "A" }] });
  await col("tickets").doc("t1").collection("draft").doc("0001").set({ rows: [{ name: "C" }] });
  await col("tickets").doc("t1").collection("draft").doc("0000").set({ rows: [{ name: "B" }] });
  h.state.delegate = () => ({ created: 3, skipped: 0, errors: [] });
  assert.equal(await executePaidTicket(h.deps, "t1"), "committed");
  const call = h.calls[0];
  assert.equal(call.req.action, "commit_records"); assert.equal(call.req.requestId, "t1");
  assert.deepEqual((call.req.payload as { rows: { name: string }[] }).rows.map((r) => r.name), ["A", "B", "C"]);
  const t = await tk("t1");
  assert.equal(t.status, "committed"); assert.deepEqual(t.productResult, { created: 3, skipped: 0, errors: [] });
  assert.equal((await col("audit").where("action", "==", "ticket_committed").get()).size, 1);
});
test("each service type uses its delegate action", opts, async () => {
  h.state.delegate = () => ({ ok: true });
  await ticket("m", "manual_entry", { rows: [{ name: "A" }] });
  await ticket("s", "schedule_setup", { name: "n", message: "m", audience: "all", schedule: { kind: "daily", at: "09:00" } });
  await ticket("b", "bulk_reminder", { message: "m", audience: "all" });
  for (const id of ["m", "s", "b"]) await executePaidTicket(h.deps, id);
  assert.deepEqual(h.calls.map((c) => c.req.action), ["commit_records", "schedule_sms", "send_sms_now"]);
  assert.equal((h.calls[2].req.payload as { dryRun: boolean }).dryRun, false);
});
test("a product refusal fails the ticket with the product's message and an audit row", opts, async () => {
  await ticket("t2", "bulk_reminder", { message: "m", audience: "all" });
  h.state.delegate = () => { throw new DeskError("failed_precondition", "Not enough SMS credits"); };
  assert.equal(await executePaidTicket(h.deps, "t2"), "failed");
  const t = await tk("t2");
  assert.equal(t.status, "failed"); assert.equal(t.failureReason, "Not enough SMS credits");
  assert.equal((await col("audit").where("action", "==", "ticket_failed").get()).size, 1);
});
test("execution is idempotent: committed, failed and unpaid tickets are not run again", opts, async () => {
  await ticket("t3", "manual_entry", { rows: [{ name: "A" }] });
  h.state.delegate = () => ({ created: 1 });
  assert.equal(await executePaidTicket(h.deps, "t3"), "committed");
  assert.equal(await executePaidTicket(h.deps, "t3"), "skipped");
  await ticket("t4", "manual_entry", { rows: [{ name: "A" }] }, "awaiting_payment");
  assert.equal(await executePaidTicket(h.deps, "t4"), "skipped");
  assert.equal(await executePaidTicket(h.deps, "missing"), "skipped");
  assert.equal(h.calls.length, 1);
});
test("concurrent duplicate deliveries end with one committed status and one audit row", opts, async () => {
  await ticket("t5", "manual_entry", { rows: [{ name: "A" }] });
  h.state.delegate = () => ({ created: 1 });
  const r = await Promise.all([executePaidTicket(h.deps, "t5"), executePaidTicket(h.deps, "t5")]);
  assert.equal(r.filter((x) => x === "committed").length, 1);
  assert.equal((await col("audit").where("action", "==", "ticket_committed").get()).size, 1);
  assert.ok(h.calls.every((c) => c.req.requestId === "t5"));
});
test("an incomplete draft fails the ticket without calling the product", opts, async () => {
  await ticket("t6", "import_excel", {});
  assert.equal(await executePaidTicket(h.deps, "t6"), "failed");
  assert.equal(h.calls.length, 0); assert.match((await tk("t6")).failureReason!, /incomplete/);
});
test("an unreachable product is retried, then failed after the attempt limit", opts, async () => {
  await ticket("t7", "manual_entry", { rows: [{ name: "A" }] });
  h.state.delegate = () => { throw new DeskError("internal", "timeout"); };
  for (let i = 1; i < MAX_EXECUTION_ATTEMPTS; i++) {
    await rejects(executePaidTicket(h.deps, "t7"), "internal");
    assert.equal((await tk("t7")).status, "paid");
  }
  assert.equal(await executePaidTicket(h.deps, "t7"), "failed");
  assert.match((await tk("t7")).failureReason!, /could not be reached/);
});
test("a large product result is stored bounded", opts, async () => {
  await ticket("t8", "manual_entry", { rows: [{ name: "A" }] });
  h.state.delegate = () => ({ created: 0, skipped: 0, errors: Array.from({ length: 900 }, (_, i) => ({ row: i, field: "x", message: "m" })) });
  await executePaidTicket(h.deps, "t8");
  const r = (await tk("t8")).productResult as { errors: unknown[]; errorsTotal: number };
  assert.equal(r.errors.length, 200); assert.equal(r.errorsTotal, 900);
});
