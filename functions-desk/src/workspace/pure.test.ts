import { test } from "node:test";
import assert from "node:assert/strict";
import { TENANT_PAGE_SIZE } from "../contract.js";
import { DeskError } from "../errors.js";
import { EntityOfferError } from "./errors.js";
import {
  cleanCursor, cleanExportKind, cleanReportParams, cleanReportType, cleanTenantQuery, cleanTenantsPage, ensureMasked,
  exportRequestId, normaliseEntityInfo, reportRequestId, requireOffered, validateFileResult,
} from "./pure.js";

const code = (fn: () => unknown): string => { try { fn(); } catch (e) { return e instanceof DeskError ? e.code : "other"; } return "none"; };

test("entity info keeps only what the agent may see", () => {
  const out = normaliseEntityInfo({
    displayName: "Umoja", adminName: "Chair", adminPhone: "0722000111", agentAuthorised: true, plan: " pro ",
    creditsBalance: 12.9, audiences: ["all", " all ", "", 5, "arrears"], reportTypes: ["contributions"], exportKinds: ["members"],
  });
  assert.deepEqual(out, { plan: "pro", creditsBalance: 12, audiences: ["all", "arrears"], reportTypes: ["contributions"], exportKinds: ["members"] });
  assert.ok(!JSON.stringify(out).includes("0722000111"));
});
test("entity info tolerates a product that offers nothing", () => {
  assert.deepEqual(normaliseEntityInfo({ creditsBalance: -3 }), { plan: "", creditsBalance: 0, audiences: [], reportTypes: [], exportKinds: [] });
  assert.deepEqual(normaliseEntityInfo(null).audiences, []);
});

test("requireOffered raises a typed refusal naming what was asked for", () => {
  requireOffered("report", "a", ["a"]);
  for (const kind of ["audience", "report", "export"] as const) {
    try { requireOffered(kind, "zzz", ["a"]); assert.fail("should refuse"); } catch (e) {
      assert.ok(e instanceof EntityOfferError);
      assert.equal(e.code, "invalid_argument");
      assert.equal(e.kind, kind);
      assert.match(e.message, new RegExp(`doesn't offer the ${kind} "zzz"`));
    }
  }
});

test("report type and params are validated", () => {
  assert.equal(cleanReportType(" annual "), "annual");
  assert.equal(code(() => cleanReportType("")), "invalid_argument");
  assert.equal(code(() => cleanReportType(7)), "invalid_argument");
  assert.deepEqual(cleanReportParams(undefined), {});
  assert.deepEqual(cleanReportParams({ from: "2026-01-01", ids: ["a", 2, null], full: true }), { from: "2026-01-01", ids: ["a", 2, null], full: true });
  assert.equal(code(() => cleanReportParams([])), "invalid_argument");
  assert.equal(code(() => cleanReportParams({ "bad key": 1 })), "invalid_argument");
  assert.equal(code(() => cleanReportParams({ nested: { a: 1 } })), "invalid_argument");
  assert.equal(code(() => cleanReportParams({ n: Number.NaN })), "invalid_argument");
  assert.equal(code(() => cleanReportParams({ s: "x".repeat(201) })), "invalid_argument");
  assert.equal(code(() => cleanReportParams(Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`k${i}`, 1])))), "invalid_argument");
});

test("report request ids: key order does not matter, the minute window and the session do", () => {
  const base = { sessionId: "s1", reportType: "r", now: 120_000 };
  const a = reportRequestId({ ...base, params: { a: 1, b: [1, 2] } });
  assert.equal(a, reportRequestId({ ...base, params: { b: [1, 2], a: 1 } }));
  assert.equal(a, reportRequestId({ ...base, params: { a: 1, b: [1, 2] }, now: 179_999 }));
  assert.notEqual(a, reportRequestId({ ...base, params: { a: 1, b: [1, 2] }, now: 180_000 }));
  assert.notEqual(a, reportRequestId({ ...base, params: { a: 2, b: [1, 2] } }));
  assert.notEqual(a, reportRequestId({ ...base, sessionId: "s2", params: { a: 1, b: [1, 2] } }));
});
test("a client request id wins, is scoped to the session and must be well-formed", () => {
  const base = { reportType: "r", params: {}, now: 1 };
  const one = reportRequestId({ ...base, sessionId: "s1", requestId: "abcd1234" });
  assert.equal(one, reportRequestId({ ...base, sessionId: "s1", requestId: "abcd1234", now: 9_999_999 }));
  assert.notEqual(one, reportRequestId({ ...base, sessionId: "s2", requestId: "abcd1234" }));
  assert.equal(code(() => reportRequestId({ ...base, sessionId: "s1", requestId: "short" })), "invalid_argument");
  assert.equal(code(() => reportRequestId({ ...base, sessionId: "s1", requestId: "has space here" })), "invalid_argument");
  assert.equal(exportRequestId("act1"), "exp_act1");
});

test("export kind must be one the contract knows", () => {
  assert.equal(cleanExportKind("members"), "members");
  assert.equal(code(() => cleanExportKind("passwords")), "invalid_argument");
  assert.equal(code(() => cleanExportKind(undefined)), "invalid_argument");
});

test("download links must be https, well-formed and still valid", () => {
  const now = 1_000;
  assert.deepEqual(validateFileResult({ downloadUrl: "https://files.example/x?sig=1", expiresAt: 5_000.7 }, now), { downloadUrl: "https://files.example/x?sig=1", expiresAt: 5_000 });
  for (const bad of [
    null, {}, { downloadUrl: "http://files.example/x", expiresAt: 5_000 }, { downloadUrl: "javascript:alert(1)", expiresAt: 5_000 },
    { downloadUrl: "not a url", expiresAt: 5_000 }, { downloadUrl: "https://f.example/x", expiresAt: 1_000 }, { downloadUrl: "https://f.example/x" },
    { downloadUrl: `https://f.example/${"x".repeat(2100)}`, expiresAt: 5_000 },
  ]) assert.equal(code(() => validateFileResult(bad, now)), "internal");
});

test("tenant search text and cursor are bounded", () => {
  assert.equal(cleanTenantQuery("  Wanjiru "), "Wanjiru");
  assert.equal(cleanTenantQuery("   "), undefined);
  assert.equal(cleanTenantQuery(undefined), undefined);
  assert.equal(code(() => cleanTenantQuery("x".repeat(61))), "invalid_argument");
  assert.equal(code(() => cleanTenantQuery(5)), "invalid_argument");
  assert.equal(cleanCursor(""), undefined);
  assert.equal(cleanCursor("abc"), "abc");
  assert.equal(code(() => cleanCursor("x".repeat(301))), "invalid_argument");
});

test("phones are always masked on the way out", () => {
  assert.equal(ensureMasked("+2547•• ••• 123"), "+2547•• ••• 123");
  assert.equal(ensureMasked("07•• ••• 123"), "07•• ••• 123");
  assert.equal(ensureMasked("0712345678"), "+2547•• ••• 678");
  assert.equal(ensureMasked("+254 712 345 678"), "+2547•• ••• 678");
  assert.equal(ensureMasked("12345678901234"), "•••");
  assert.equal(ensureMasked(undefined), "•••");
});

test("tenant pages: unusable rows dropped and counted, duplicates removed, money whole, cursor only with rows", () => {
  const page = cleanTenantsPage({
    tenants: [
      { tenantId: "t1", name: " Amina ", unit: "A1", phoneMasked: "0712345678", rentDueMinor: 1500000 },
      { tenantId: "t2", name: "Brian", phoneMasked: "+2547•• ••• 999", rentDueMinor: 12.5 },
      { tenantId: "t1", name: "Dup", unit: "A1", phoneMasked: "x" },
      { tenantId: "", name: "No id" }, { tenantId: "t3" }, null,
      { tenantId: "t4", name: "Neg", rentDueMinor: -1 },
    ],
    nextCursor: "c2",
  });
  assert.deepEqual(page.tenants.map((t) => t.tenantId), ["t1", "t2", "t4"]);
  assert.equal(page.tenants[0].name, "Amina");
  assert.equal(page.tenants[0].phoneMasked, "+2547•• ••• 678");
  assert.equal(page.tenants[0].rentDueMinor, 1500000);
  assert.equal(page.tenants[1].rentDueMinor, undefined);
  assert.equal(page.tenants[2].rentDueMinor, undefined);
  assert.equal(page.dropped, 4);
  assert.equal(page.nextCursor, "c2");
  assert.equal(cleanTenantsPage({ tenants: [], nextCursor: "c" }).nextCursor, undefined);
  assert.deepEqual(cleanTenantsPage("garbage").tenants, []);
});
test("a product that over-delivers is capped to one page", () => {
  const many = Array.from({ length: TENANT_PAGE_SIZE + 5 }, (_, i) => ({ tenantId: `t${i}`, name: `N${i}`, phoneMasked: "•••" }));
  const page = cleanTenantsPage({ tenants: many });
  assert.equal(page.tenants.length, TENANT_PAGE_SIZE);
  assert.equal(page.dropped, 5);
});
