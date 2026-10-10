import { test } from "node:test";
import assert from "node:assert/strict";
import { validateScopes, validateTenantIds } from "./pure.js";

test("scopes: non-empty subset, deduplicated", () => {
  assert.deepEqual(validateScopes(["import", "read", "read"]), ["read", "import"]);
  assert.throws(() => validateScopes([])); assert.throws(() => validateScopes(undefined)); assert.throws(() => validateScopes(["read", "root"]));
  assert.throws(() => validateScopes([1]));
});
test("tenant ids: 1–max, trimmed, unique", () => {
  assert.deepEqual(validateTenantIds([" t1 ", "t2"], 200), ["t1", "t2"]);
  assert.throws(() => validateTenantIds([], 200));
  assert.throws(() => validateTenantIds(["a", "a"], 200));
  assert.throws(() => validateTenantIds(["a", " a"], 200));
  assert.throws(() => validateTenantIds(["a/b"], 200));
  assert.throws(() => validateTenantIds([""], 200));
  assert.throws(() => validateTenantIds(Array.from({ length: 201 }, (_, i) => `t${i}`), 200));
  assert.equal(validateTenantIds(Array.from({ length: 200 }, (_, i) => `t${i}`), 200).length, 200);
});
