import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DESK_CONFIG } from "../config.js";
import { milestoneNewBlocks } from "../money.js";
import { blockNumberOf, customerQualifies, longestConsecutiveRun, summariseBonusRows } from "./qualify.js";

const cfg = DEFAULT_DESK_CONFIG;

test("consecutive months: gaps break runs, year ends join, junk and duplicates ignored", () => {
  assert.equal(longestConsecutiveRun([]), 0);
  assert.equal(longestConsecutiveRun(["2026-01", "2026-03"]), 1);
  assert.equal(longestConsecutiveRun(["2025-12", "2026-01"]), 2);
  assert.equal(longestConsecutiveRun(["2026-03", "2026-01", "2026-02", "2026-02", "nope", 5]), 3);
});

test("qualification: chama or pms, not self-owned, not refunded, >= 2 consecutive paid months", () => {
  const ok = { product: "chama" as const, paidPeriods: ["2026-08", "2026-09"] };
  assert.equal(customerQualifies(ok, cfg), true);
  assert.equal(customerQualifies({ ...ok, product: "pms" }, cfg), true);
  assert.equal(customerQualifies({ ...ok, product: "school" }, cfg), false);
  assert.equal(customerQualifies({ ...ok, selfOwned: true }, cfg), false);
  assert.equal(customerQualifies({ ...ok, refunded: true }, cfg), false);
  assert.equal(customerQualifies({ ...ok, paidPeriods: ["2026-07", "2026-09"] }, cfg), false);
  assert.equal(customerQualifies({ ...ok, paidPeriods: ["2026-09"] }, cfg), false);
  assert.equal(customerQualifies(ok, { ...cfg, milestone: { ...cfg.milestone, minPaidMonths: 3 } }), false);
});

test("blocks: 10th account earns the first, the 6th block never appears; void rows keep their number", () => {
  assert.equal(milestoneNewBlocks(9, 0, cfg).newBlocks, 0);
  assert.equal(milestoneNewBlocks(10, 0, cfg).newBlocks, 1);
  assert.equal(milestoneNewBlocks(10, 1, cfg).newBlocks, 0);
  assert.equal(milestoneNewBlocks(60, 5, cfg).newBlocks, 0);
  assert.equal(milestoneNewBlocks(100, 0, cfg).newBlocks, 5);
  const h = summariseBonusRows([
    { status: "paid", amountMinor: 200000, sourceId: "bonus-block-1" },
    { status: "void", amountMinor: 200000, sourceId: "bonus-block-2" },
    { status: "payable", amountMinor: 200000, note: "Milestone block 3" },
  ]);
  assert.deepEqual(h, { nonVoidBlocks: 2, bankedMinor: 400000, highestBlockNumber: 3 });
  assert.equal(blockNumberOf({ sourceId: "bonus-block-7" }), 7);
});
