import { test } from "node:test";
import assert from "node:assert/strict";
import { ledgerEntryId } from "./ledger.js";

test("ledger ids are deterministic, fixed length and fact-specific", () => {
  const a = ledgerEntryId(["commission", "sms_purchase:ref1", "u1"]);
  assert.equal(a, ledgerEntryId(["commission", "sms_purchase:ref1", "u1"]));
  assert.notEqual(a, ledgerEntryId(["commission", "sms_purchase:ref2", "u1"]));
  assert.notEqual(a, ledgerEntryId(["commission", "sms_purchase:ref1", "u2"]));
  assert.equal(a.length, 28);
});
