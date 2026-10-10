import { test } from "node:test";
import assert from "node:assert/strict";
import { adminPhoneE164, assertEntityKey, classifyEntityCode, customerDocId, isSameNumber } from "./entities.js";
import { matchBankCode } from "./deps.js";
import { assembleDraft, buildDelegateCall, compactResult } from "./tickets.js";
import { subaccountDetailsFrom } from "./payout.js";

const info = (adminPhone: string) => ({ displayName: "x", adminName: "a", adminPhone, agentAuthorised: true, plan: "p", creditsBalance: 0, audiences: [], reportTypes: [], exportKinds: [] });

test("code shapes map to products; others are rejected", () => {
  assert.deepEqual(classifyEntityCode(" smc-0042 "), { product: "chama", code: "SMC-0042" });
  assert.deepEqual(classifyEntityCode("PYL-0007"), { product: "pms", code: "PYL-0007" });
  assert.deepEqual(classifyEntityCode("01234567"), { product: "school", code: "01234567" });
  for (const bad of ["", "SMC-1", "XYZ-0001", "COG-0001", "1234567", "123456789", "SMC-00A1", "PYL0001"]) assert.throws(() => classifyEntityCode(bad), bad);
});
test("entity key product must match its code shape", () => {
  assert.equal(assertEntityKey("chama:SMC-0001").entityKey, "chama:SMC-0001");
  assert.throws(() => assertEntityKey("school:SMC-0001"));
  assert.throws(() => assertEntityKey("chama:01234567"));
  assert.equal(customerDocId("chama:SMC-0001"), "chama:SMC-0001");
});
test("admin phone is normalised; self-owned detected", () => {
  assert.equal(adminPhoneE164(info("0712345678")), "+254712345678");
  assert.throws(() => adminPhoneE164(info("nope")));
  assert.ok(isSameNumber("+254712345678", "+254712345678"));
  assert.ok(!isSameNumber("+254712345678", "+254722222222"));
});
test("bank code matching mirrors PAY", () => {
  const banks = [{ code: "MPESA", name: "M-PESA" }, { code: "63", name: "Equity Bank" }];
  assert.equal(matchBankCode(banks, "mpesa"), "MPESA");
  assert.equal(matchBankCode(banks, "equity"), "63");
  assert.equal(matchBankCode(banks, "Unknown"), "unknown");
});
test("payout details need every field", () => {
  const full = { businessName: "b", settlementBank: "mpesa", accountNumber: "0712345678", name: "n", email: "e@x.co", phone: "254712345678" };
  assert.ok(subaccountDetailsFrom(full).ok);
  assert.ok(!subaccountDetailsFrom({ ...full, email: undefined }).ok);
});
test("drafts assemble inline rows then chunks in order", () => {
  const d = assembleDraft({ rows: [{ a: 1 }], x: 1 }, [{ rows: [{ a: 2 }] }, { rows: [{ a: 3 }] }]);
  assert.deepEqual(d.rows, [{ a: 1 }, { a: 2 }, { a: 3 }]); assert.equal(d.x, 1);
  assert.deepEqual(assembleDraft(undefined, []), {});
});
test("service types map to the right delegate action", () => {
  assert.equal(buildDelegateCall("import_excel", { rows: [{ name: "a" }] }).action, "commit_records");
  assert.equal(buildDelegateCall("import_excel", { rows: [{ name: "a" }] }).payload.source, "excel");
  assert.equal(buildDelegateCall("manual_entry", { rows: [{ name: "a" }] }).payload.source, "manual");
  assert.equal(buildDelegateCall("schedule_setup", { name: "n", message: "m", audience: "all", schedule: { kind: "weekly", at: "09:00", days: [1] } }).action, "schedule_sms");
  const send = buildDelegateCall("bulk_reminder", { message: "m", audience: "all" });
  assert.equal(send.action, "send_sms_now"); assert.equal(send.payload.dryRun, false);
});
test("incomplete drafts are refused", () => {
  assert.throws(() => buildDelegateCall("import_excel", {}));
  assert.throws(() => buildDelegateCall("import_excel", { rows: [] }));
  assert.throws(() => buildDelegateCall("schedule_setup", { name: "n", message: "m", audience: "all", schedule: { kind: "hourly", at: "x" } }));
  assert.throws(() => buildDelegateCall("bulk_reminder", { message: "" , audience: "all" }));
});
test("stored product results are bounded", () => {
  const r = compactResult({ created: 1, errors: Array.from({ length: 500 }, (_, i) => i) }) as { errors: number[]; errorsTotal: number };
  assert.equal(r.errors.length, 200); assert.equal(r.errorsTotal, 500);
  assert.deepEqual(compactResult({ created: 2 }), { created: 2 });
});
