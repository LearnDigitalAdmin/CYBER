import { test } from "node:test";
import assert from "node:assert/strict";

const ls = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: { getItem: (k: string) => ls.get(k) ?? null, setItem: (k: string, v: string) => { ls.set(k, v); }, removeItem: (k: string) => { ls.delete(k); } },
};
const f = await import("../../src/desk/modules/manual/fields");

test("fieldsProblem: needs a field, unique names, sane length", () => {
  assert.equal(f.fieldsProblem(["name", "phone"]), null);
  assert.match(f.fieldsProblem([]) ?? "", /at least one/);
  assert.match(f.fieldsProblem(["  ", ""]) ?? "", /at least one/);
  assert.match(f.fieldsProblem(["Name", "name"]) ?? "", /twice/);
  assert.match(f.fieldsProblem(["x".repeat(61)]) ?? "", /too long/);
  assert.match(f.fieldsProblem(Array.from({ length: 61 }, (_, i) => `f${i}`)) ?? "", /at most/);
});
test("cleanFields: trims, collapses spaces, drops blanks", () => {
  assert.deepEqual(f.cleanFields([" full  name ", "", "phone "]), ["full name", "phone"]);
});
test("reshape: keeps shared fields, adds new ones empty, drops removed ones, keeps ids", () => {
  const rows = [{ line: 7, values: { name: "Mary", phone: "0712" } }];
  assert.deepEqual(f.reshape(rows, ["phone", "email"]), [{ line: 7, values: { phone: "0712", email: null } }]);
});
test("isBlank / toValue / emptyValues", () => {
  assert.equal(f.isBlank({ line: 1, values: { a: null, b: "  " } }), true);
  assert.equal(f.isBlank({ line: 1, values: { a: null, b: "x" } }), false);
  assert.equal(f.toValue("  "), null);
  assert.equal(f.toValue(" a "), " a ");
  assert.deepEqual(f.emptyValues(["a", "b"]), { a: null, b: null });
});
test("saved fields round-trip per product; corrupt storage is ignored", () => {
  assert.equal(f.loadSavedFields("chama"), null);
  f.saveFields("chama", ["name", "phone"]);
  assert.deepEqual(f.loadSavedFields("chama"), ["name", "phone"]);
  assert.equal(f.loadSavedFields("school"), null);
  ls.set("desk.manual.fields.v1:pms", "{oops");
  assert.equal(f.loadSavedFields("pms"), null);
  ls.set("desk.manual.fields.v1:pms", JSON.stringify([1, 2]));
  assert.equal(f.loadSavedFields("pms"), null);
});
