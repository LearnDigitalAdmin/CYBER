/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import { exportLabel, formatRemaining, offeredExportKinds, parseOptionRows, runKey } from "./reportLogic.ts";

test("option rows become flat text parameters; blank rows are ignored", () => {
  assert.deepEqual(parseOptionRows([{ name: " year ", value: " 2026 " }, { name: "", value: "" }, { name: "term_no", value: "2" }]), { ok: true, params: { year: "2026", term_no: "2" } });
  assert.deepEqual(parseOptionRows([]), { ok: true, params: {} });
});
test("bad option rows are refused with a readable reason", () => {
  assert.match(String((parseOptionRows([{ name: "", value: "x" }]) as { error: string }).error), /needs a name/);
  assert.equal(parseOptionRows([{ name: "1abc", value: "x" }]).ok, false);
  assert.equal(parseOptionRows([{ name: "a b", value: "x" }]).ok, false);
  assert.match(String((parseOptionRows([{ name: "a", value: "1" }, { name: "a", value: "2" }]) as { error: string }).error), /twice/);
  assert.equal(parseOptionRows([{ name: "a", value: "x".repeat(201) }]).ok, false);
  assert.equal(parseOptionRows(Array.from({ length: 21 }, (_, i) => ({ name: `k${i}`, value: "1" }))).ok, false);
});
test("only export kinds the desk can get approved are offered, once each", () => {
  assert.deepEqual(offeredExportKinds(["members", "payroll", "members", "reports"], ["members", "students", "tenants", "reports"]), ["members", "reports"]);
  assert.deepEqual(offeredExportKinds([], ["members"]), []);
  assert.equal(exportLabel("tenants"), "Tenants");
  assert.equal(exportLabel("other"), "other");
});
test("link countdown", () => {
  assert.equal(formatRemaining(10_000, 10_000), null);
  assert.equal(formatRemaining(10_000, 20_000), null);
  assert.equal(formatRemaining(61_000, 0), "1:01");
  assert.equal(formatRemaining(900_000, 0), "15:00");
  assert.equal(formatRemaining(1_001, 0), "0:02");
});
test("a run key ignores option order and changes with any input", () => {
  assert.equal(runKey("r", { a: "1", b: "2" }), runKey("r", { b: "2", a: "1" }));
  assert.notEqual(runKey("r", { a: "1" }), runKey("r", { a: "2" }));
  assert.notEqual(runKey("r", {}), runKey("s", {}));
});
