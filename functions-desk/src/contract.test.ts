import { test } from "node:test";
import assert from "node:assert/strict";
import { DESK_CALLABLES, DESK_CODE_PREFIX, DESK_TOP_CODE, SUPPORT_CATEGORIES, summaryBulkSms, summaryExport, summaryRentStk, summaryTopPayout, summaryTopRank, summaryTopStatus } from "./contract.js";

test("summary builders produce the exact customer-facing text", () => {
  assert.equal(summaryRentStk(12), "Rent STK to 12 tenants");
  assert.equal(summaryBulkSms(250), "SMS to 250 recipients");
  assert.equal(summaryExport("members"), "Export members");
});
test("callable list is unique and every name is desk_-prefixed", () => {
  assert.equal(new Set(DESK_CALLABLES).size, DESK_CALLABLES.length);
  assert.ok(DESK_CALLABLES.every((n) => n.startsWith("desk_")));
  assert.equal(SUPPORT_CATEGORIES.length, 6);
});

test("top-desk summaries and codes", () => {
  assert.equal(summaryTopStatus("COG-0007", "suspended"), "Set desk COG-0007 to suspended");
  assert.equal(summaryTopRank("COG-0007", "senior"), "Set desk COG-0007 rank to senior");
  assert.equal(summaryTopPayout(450000, 3), "Pay KES 4500.00 to 3 desks");
  assert.equal(DESK_TOP_CODE, `${DESK_CODE_PREFIX}0000`);
});
