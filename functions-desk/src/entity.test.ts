import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEntityKey, parseEntityKey } from "./entity.js";

test("entity keys round-trip and normalise case", () => {
  const k = makeEntityKey("chama", " smc-0042 ");
  assert.equal(k, "chama:SMC-0042");
  assert.deepEqual(parseEntityKey(k), { product: "chama", code: "SMC-0042" });
});
test("invalid entity keys are rejected", () => {
  assert.throws(() => parseEntityKey("shop:ABC-1"));
  assert.throws(() => parseEntityKey("chama:"));
  assert.throws(() => parseEntityKey("nocolon"));
  assert.throws(() => makeEntityKey("school", "a/b"));
});
