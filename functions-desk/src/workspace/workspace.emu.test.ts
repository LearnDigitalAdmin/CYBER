import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { emulatorEnabled, clearFirestore } from "../testing/emulator.js";
import { summaryExport, TENANT_PAGE_SIZE } from "../contract.js";
import { col } from "../db.js";
import { DeskError } from "../errors.js";
import { endSession } from "../sessions/access.js";
import { requestActionOtp, verifyActionOtp } from "../otp/handlers.js";
import { ADMIN_PHONE, clearChama, entityInfo, harness, lastOtp, openSession, rejects, seedAgent, type Harness } from "../connectors/harness.test.js";
import type { ActionOtpDoc } from "../types.js";
import { exportData, getEntityInfo, listTenants, runReport } from "./handlers.js";
import { EntityOfferError, NotPmsEntityError, ProductUnsupportedError } from "./errors.js";

const opts = { skip: !emulatorEnabled };
const CHAMA = "chama:SMC-0001";
const PMS = "pms:PYL-0001";
const LINK = () => ({ downloadUrl: "https://files.example/secret-link?sig=abc", expiresAt: Date.now() + 10 * 60_000 });
let h: Harness;
beforeEach(async () => { if (!emulatorEnabled) return; await clearFirestore(); await clearChama(); h = harness(); await seedAgent("1"); });

const actions = async (action: string) => (await col("audit").where("action", "==", action).get()).docs.map((d) => d.data());
const callsOf = (action: string) => h.calls.filter((c) => c.req.action === action);
/** Product double: entity_info as given, everything else answered by `rest`. */
const product = (info: Record<string, unknown>, rest: (action: string, req: Harness["calls"][number]["req"]) => unknown) =>
  (h.state.delegate = (_p, req) => (req.action === "entity_info" ? entityInfo(info) : rest(req.action, req)));
async function approvedExport(sid: string, kind = "members"): Promise<string> {
  const r = await requestActionOtp(h.deps, "1", { sessionId: sid, action: "export", summary: summaryExport(kind) });
  await verifyActionOtp(h.deps, "1", { actionId: r.actionId, otp: lastOtp(h) });
  return r.actionId;
}

// ------------------------------------------------------------ desk_getEntityInfo
test("entity info returns the plan's offers and never the admin's details", opts, async () => {
  h.state.delegate = () => entityInfo({ audiences: ["all", "arrears"], reportTypes: ["annual"], exportKinds: ["members", "reports"], creditsBalance: 480 });
  const sid = await openSession(h, "1", CHAMA, ["read"]);
  h.calls.length = 0;
  const out = await getEntityInfo(h.deps, "1", { sessionId: sid });
  assert.deepEqual(out, { plan: "pro", creditsBalance: 480, audiences: ["all", "arrears"], reportTypes: ["annual"], exportKinds: ["members", "reports"] });
  assert.ok(!JSON.stringify(out).includes(ADMIN_PHONE.slice(1)) && !JSON.stringify(out).includes("Chair"));
  assert.equal(callsOf("entity_info").length, 1);
  assert.equal(h.calls[0].req.entityCode, "SMC-0001"); assert.equal(h.calls[0].req.agentCode, "COG-0001");
  const rows = await actions("entity_info_viewed");
  assert.equal(rows.length, 1); assert.equal(rows[0].agentId, "1"); assert.equal(rows[0].entityKey, CHAMA); assert.equal(rows[0].sessionId, sid);
});
test("entity info needs the read scope, a live session of the caller's own, and a current grant", opts, async () => {
  const noRead = await openSession(h, "1", CHAMA, ["report"]);
  await rejects(getEntityInfo(h.deps, "1", { sessionId: noRead }), "permission_denied");
  const sid = await openSession(h, "1", CHAMA, ["read"]);
  await seedAgent("2");
  await rejects(getEntityInfo(h.deps, "2", { sessionId: sid }), "permission_denied");
  await rejects(getEntityInfo(h.deps, "1", { sessionId: "nope" }), "session_invalid");
  await rejects(getEntityInfo(h.deps, "1", {}), "invalid_argument");
  await rejects(getEntityInfo(h.deps, "1", null), "invalid_argument");
  h.state.delegate = () => entityInfo({ agentAuthorised: false });
  await rejects(getEntityInfo(h.deps, "1", { sessionId: sid }), "permission_denied", /Support Agents/);
  h.state.delegate = () => entityInfo();
  await endSession(h.deps, "1", { sessionId: sid });
  await rejects(getEntityInfo(h.deps, "1", { sessionId: sid }), "session_invalid");
  await col("agents").doc("1").update({ status: "suspended" });
  await rejects(getEntityInfo(h.deps, "1", { sessionId: sid }), "permission_denied");
  assert.equal((await actions("entity_info_viewed")).length, 0);
});

// ------------------------------------------------------------ desk_runReport
test("a report the entity offers runs through the product and is audited without the link", opts, async () => {
  const sid = await openSession(h, "1", CHAMA, ["report"]);
  product({ reportTypes: ["annual"] }, () => LINK());
  const out = await runReport(h.deps, "1", { sessionId: sid, reportType: "annual", params: { year: 2026, ids: ["a", "b"] } });
  assert.equal(out.downloadUrl, "https://files.example/secret-link?sig=abc"); assert.ok(out.expiresAt > Date.now());
  const call = callsOf("run_report")[0];
  assert.deepEqual(call.req.payload, { reportType: "annual", params: { year: 2026, ids: ["a", "b"] } });
  assert.equal(call.req.entityCode, "SMC-0001"); assert.equal(call.req.agentCode, "COG-0001");
  assert.match(String(call.req.requestId), /^rpt_[0-9a-f]{32}$/);
  const [row] = await actions("report_run");
  assert.deepEqual((row.meta as Record<string, unknown>).paramKeys, ["year", "ids"]);
  assert.equal((row.meta as Record<string, unknown>).linkWithinLimit, true);
  assert.ok(!JSON.stringify(row).includes("secret-link") && !JSON.stringify(row).includes("2026"));
});
test("a report the entity does not offer is refused before anything reaches the product", opts, async () => {
  const sid = await openSession(h, "1", CHAMA, ["report"]);
  product({ reportTypes: ["annual"] }, () => LINK());
  await assert.rejects(runReport(h.deps, "1", { sessionId: sid, reportType: "payroll", params: {} }), (e: unknown) =>
    e instanceof EntityOfferError && e.reason === "no_such_report" && /doesn't offer the report "payroll"/.test(e.message));
  product({ reportTypes: [] }, () => LINK());
  await assert.rejects(runReport(h.deps, "1", { sessionId: sid, reportType: "annual", params: {} }), EntityOfferError);
  assert.equal(callsOf("run_report").length, 0);
  assert.equal((await actions("report_run")).length, 0);
});
test("report inputs, scope and session are enforced", opts, async () => {
  const sid = await openSession(h, "1", CHAMA, ["report"]);
  product({ reportTypes: ["annual"] }, () => LINK());
  await rejects(runReport(h.deps, "1", { sessionId: sid, params: {} }), "invalid_argument");
  await rejects(runReport(h.deps, "1", { sessionId: sid, reportType: "annual", params: { nested: { a: 1 } } }), "invalid_argument");
  await rejects(runReport(h.deps, "1", { sessionId: sid, reportType: "annual", params: {}, requestId: "x" }), "invalid_argument");
  const readOnly = await openSession(h, "1", CHAMA, ["read"]);
  await rejects(runReport(h.deps, "1", { sessionId: readOnly, reportType: "annual", params: {} }), "permission_denied");
  await rejects(runReport(h.deps, "1", { sessionId: "nope", reportType: "annual", params: {} }), "session_invalid");
  assert.equal(callsOf("run_report").length, 0);
});
test("running the same report twice sends the same request id so the product can de-duplicate; a client id is honoured", opts, async () => {
  const sid = await openSession(h, "1", CHAMA, ["report"]);
  product({ reportTypes: ["annual"] }, () => LINK());
  const pinned = Date.now();
  h.deps.now = () => pinned; // the de-duplication window is a minute of the injected clock
  await runReport(h.deps, "1", { sessionId: sid, reportType: "annual", params: { b: 1, a: 2 } });
  await runReport(h.deps, "1", { sessionId: sid, reportType: "annual", params: { a: 2, b: 1 } });
  h.deps.now = () => pinned + 61_000;
  await runReport(h.deps, "1", { sessionId: sid, reportType: "annual", params: { a: 2, b: 1 } });
  const [first, second, later] = callsOf("run_report").map((c) => c.req.requestId);
  assert.equal(first, second);
  assert.notEqual(first, later);
  await runReport(h.deps, "1", { sessionId: sid, reportType: "annual", params: {}, requestId: "retry-0001" });
  h.deps.now = () => pinned + 5 * 60_000;
  await runReport(h.deps, "1", { sessionId: sid, reportType: "annual", params: { changed: true }, requestId: "retry-0001" });
  const [c1, c2] = callsOf("run_report").slice(3).map((c) => c.req.requestId);
  assert.equal(c1, c2);
});
test("a failing or unsupported report leaves a failure audit row and a readable error", opts, async () => {
  const sid = await openSession(h, "1", CHAMA, ["report"]);
  product({ reportTypes: ["annual"] }, () => { throw new DeskError("failed_precondition", "Not enough report credits"); });
  await rejects(runReport(h.deps, "1", { sessionId: sid, reportType: "annual", params: {} }), "failed_precondition", /report credits/);
  product({ reportTypes: ["annual"] }, () => { throw new ProductUnsupportedError("chama"); });
  await assert.rejects(runReport(h.deps, "1", { sessionId: sid, reportType: "annual", params: {} }), ProductUnsupportedError);
  product({ reportTypes: ["annual"] }, () => ({ downloadUrl: "http://insecure.example/x", expiresAt: Date.now() + 60_000 }));
  await rejects(runReport(h.deps, "1", { sessionId: sid, reportType: "annual", params: {} }), "internal", /invalid download link/);
  const failed = await actions("report_failed");
  assert.equal(failed.length, 3);
  assert.match(String((failed[0].meta as Record<string, unknown>).error), /report credits/);
  assert.equal((await actions("report_run")).length, 0);
});

// ------------------------------------------------------------ desk_exportData
test("an approved export is requested once, bound to the OTP, and the OTP is spent", opts, async () => {
  const sid = await openSession(h, "1", CHAMA, ["export"]);
  const actionId = await approvedExport(sid);
  product({ exportKinds: ["members"] }, () => LINK());
  const out = await exportData(h.deps, "1", { sessionId: sid, actionId, kind: "members" });
  assert.equal(out.downloadUrl, "https://files.example/secret-link?sig=abc");
  const call = callsOf("export_data")[0];
  assert.deepEqual(call.req.payload, { kind: "members" });
  assert.equal(call.req.requestId, `exp_${actionId}`);
  assert.ok(((await col("actionOtps").doc(actionId).get()).data() as ActionOtpDoc).consumedAt);
  const [row] = await actions("data_exported");
  assert.equal((row.meta as Record<string, unknown>).kind, "members"); assert.ok(!JSON.stringify(row).includes("secret-link"));
  await rejects(exportData(h.deps, "1", { sessionId: sid, actionId, kind: "members" }), "otp_required", /already used/);
  assert.equal(callsOf("export_data").length, 1);
});
test("an export the entity does not offer, or the customer did not approve, never burns the OTP", opts, async () => {
  const sid = await openSession(h, "1", CHAMA, ["export"]);
  const actionId = await approvedExport(sid, "members");
  const spent = async () => Boolean(((await col("actionOtps").doc(actionId).get()).data() as ActionOtpDoc).consumedAt);
  product({ exportKinds: ["members"] }, () => LINK());
  await assert.rejects(exportData(h.deps, "1", { sessionId: sid, actionId, kind: "reports" }), (e: unknown) =>
    e instanceof EntityOfferError && e.reason === "no_such_export");
  assert.equal(await spent(), false);
  product({ exportKinds: ["members", "reports"] }, () => LINK());
  await rejects(exportData(h.deps, "1", { sessionId: sid, actionId, kind: "reports" }), "invalid_argument", /does not match/);
  assert.equal(await spent(), false);
  await rejects(exportData(h.deps, "1", { sessionId: sid, actionId, kind: "passwords" }), "invalid_argument");
  await rejects(exportData(h.deps, "1", { sessionId: sid, kind: "members" }), "invalid_argument");
  await rejects(exportData(h.deps, "1", { sessionId: sid, actionId: "missing", kind: "members" }), "otp_required");
  assert.equal(await spent(), false); assert.equal(callsOf("export_data").length, 0);
});
test("an unverified export OTP, a foreign agent and a missing scope are refused", opts, async () => {
  const sid = await openSession(h, "1", CHAMA, ["export"]);
  product({ exportKinds: ["members"] }, () => LINK());
  const r = await requestActionOtp(h.deps, "1", { sessionId: sid, action: "export", summary: summaryExport("members") });
  await rejects(exportData(h.deps, "1", { sessionId: sid, actionId: r.actionId, kind: "members" }), "otp_required", /not verified/);
  await verifyActionOtp(h.deps, "1", { actionId: r.actionId, otp: lastOtp(h) });
  await seedAgent("2");
  await rejects(exportData(h.deps, "2", { sessionId: sid, actionId: r.actionId, kind: "members" }), "permission_denied");
  const readOnly = await openSession(h, "1", CHAMA, ["read"]);
  await rejects(exportData(h.deps, "1", { sessionId: readOnly, actionId: r.actionId, kind: "members" }), "permission_denied");
  assert.equal(callsOf("export_data").length, 0);
});
test("a failing export is audited; the spent OTP means the customer must approve again", opts, async () => {
  const sid = await openSession(h, "1", CHAMA, ["export"]);
  const actionId = await approvedExport(sid);
  product({ exportKinds: ["members"] }, () => { throw new DeskError("internal", "Could not reach the chama service. Please try again."); });
  await rejects(exportData(h.deps, "1", { sessionId: sid, actionId, kind: "members" }), "internal");
  assert.equal((await actions("export_failed")).length, 1); assert.equal((await actions("data_exported")).length, 0);
  product({ exportKinds: ["members"] }, () => LINK());
  await rejects(exportData(h.deps, "1", { sessionId: sid, actionId, kind: "members" }), "otp_required");
  const again = await approvedExport(sid);
  assert.ok((await exportData(h.deps, "1", { sessionId: sid, actionId: again, kind: "members" })).downloadUrl);
});

// ------------------------------------------------------------ desk_listTenants
const tenants = (n: number) => Array.from({ length: n }, (_, i) => ({ tenantId: `t${i}`, name: `Tenant ${i}`, unit: `U${i}`, phoneMasked: "+2547•• ••• 123", rentDueMinor: 100000 + i }));
test("tenants are listed page by page for a landlord, with search, and audited without the search text", opts, async () => {
  const sid = await openSession(h, "1", PMS, ["rent_stk"]);
  h.state.delegate = (_p, req) => (req.action === "list_tenants" ? { tenants: tenants(2), nextCursor: "c2" } : entityInfo());
  const out = await listTenants(h.deps, "1", { sessionId: sid, query: " Wanjiru ", cursor: "c1" });
  assert.equal(out.tenants.length, 2); assert.equal(out.nextCursor, "c2"); assert.equal(out.tenants[1].rentDueMinor, 100001);
  const call = callsOf("list_tenants")[0];
  assert.deepEqual(call.req.payload, { limit: TENANT_PAGE_SIZE, cursor: "c1", query: "Wanjiru" });
  assert.equal(call.req.entityCode, "PYL-0001"); assert.equal(call.product, "pms");
  const [row] = await actions("tenants_listed");
  assert.deepEqual(row.meta, { count: 2, dropped: 0, searched: true, paged: true });
  assert.ok(!JSON.stringify(row).includes("Wanjiru"));
  h.state.delegate = (_p, req) => (req.action === "list_tenants" ? { tenants: tenants(1) } : entityInfo());
  const last = await listTenants(h.deps, "1", { sessionId: sid });
  assert.equal(last.nextCursor, undefined);
  assert.deepEqual(callsOf("list_tenants")[1].req.payload, { limit: TENANT_PAGE_SIZE });
});
test("tenant phones from the product are masked again before they reach the agent", opts, async () => {
  const sid = await openSession(h, "1", PMS, ["rent_stk"]);
  h.state.delegate = (_p, req) => (req.action === "list_tenants" ? { tenants: [{ tenantId: "t1", name: "Amina", unit: "A1", phoneMasked: "0712345678" }] } : entityInfo());
  const out = await listTenants(h.deps, "1", { sessionId: sid });
  assert.equal(out.tenants[0].phoneMasked, "+2547•• ••• 678");
  assert.ok(!JSON.stringify(out).includes("12345678"));
});
test("tenant lists are for landlords only, need the rent scope, and say so when the product lacks the action", opts, async () => {
  const chama = await openSession(h, "1", CHAMA, ["rent_stk"]);
  await assert.rejects(listTenants(h.deps, "1", { sessionId: chama }), (e: unknown) =>
    e instanceof NotPmsEntityError && e.reason === "not_pms_entity" && e.code === "failed_precondition" && /Plot Yangu/.test(e.message));
  assert.equal(callsOf("list_tenants").length, 0);
  const noScope = await openSession(h, "1", PMS, ["read"]);
  await rejects(listTenants(h.deps, "1", { sessionId: noScope }), "permission_denied");
  const sid = await openSession(h, "1", PMS, ["rent_stk"]);
  await rejects(listTenants(h.deps, "1", { sessionId: sid, cursor: "x".repeat(301) }), "invalid_argument");
  await rejects(listTenants(h.deps, "1", { sessionId: sid, query: "y".repeat(61) }), "invalid_argument");
  h.state.delegate = (_p, req) => { if (req.action === "list_tenants") throw new ProductUnsupportedError("pms"); return entityInfo(); };
  await assert.rejects(listTenants(h.deps, "1", { sessionId: sid }), ProductUnsupportedError);
  assert.equal((await actions("tenants_listed")).length, 0);
});
