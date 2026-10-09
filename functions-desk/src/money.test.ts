import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DESK_CONFIG as C, mergeConfig } from "./config.js";
import {
  creditsFor, floorPct2, formatKes, manualEntryPrice, milestoneNewBlocks, rentPlan, rentTake,
  servicePlan, settledAmounts, sharePlan, smsPlan,
} from "./money.js";

test("A. service: agent share is 100 minus the 2.5% CYBER_ cut", () => {
  assert.deepEqual(servicePlan(C), { agentSharePct: 97.5, rule: "service" });
});
test("A. service KES 200, real fee 3.00: agent nets 97.5% of KES 197", () => {
  const s = settledAmounts({ grossMinor: 20000, feeMinor: 300, agentSharePct: 97.5 });
  assert.deepEqual(s, { netMinor: 19700, agentMinor: 19207, platformMinor: 493 });
  assert.equal(formatKes(s.agentMinor), "KES 192.07");
});

test("manual entry price is tier + KES 200 service fee, never above KES 1,200", () => {
  assert.deepEqual(manualEntryPrice(8, C), { tierMinor: 20000, serviceFeeMinor: 20000, totalMinor: 40000 });
  assert.equal(manualEntryPrice(5000, C).totalMinor, 120000);
  assert.throws(() => manualEntryPrice(0, C), RangeError);
});

test("B. SMS first purchase (KES 150 at 0.70): agent nets the whole margin, within KES 0.02", () => {
  const credits = creditsFor(15000, 70);
  assert.equal(credits, 214);
  const plan = smsPlan({ grossMinor: 15000, credits, firstPurchaseEligible: true }, C);
  assert.equal(plan.rule, "sms_first_purchase");
  assert.equal(plan.agentSharePct, 71.03);
  const fee = 225;                                             // real fee 1.5%
  const s = settledAmounts({ grossMinor: 15000, feeMinor: fee, agentSharePct: plan.agentSharePct });
  const margin = 15000 - fee - credits * C.creditCostMinor;     // 10495
  assert.ok(Math.abs(s.agentMinor - margin) <= 2, `agent ${s.agentMinor} vs margin ${margin}`);
  assert.ok(s.platformMinor >= credits * C.creditCostMinor - 2, "Samuhia still recovers the SMS cost");
});
test("B. SMS standard purchase (KES 500 at 0.70): agent nets 40% of margin, within KES 0.02", () => {
  const credits = creditsFor(50000, 70);
  const plan = smsPlan({ grossMinor: 50000, credits, firstPurchaseEligible: false }, C);
  assert.equal(plan.rule, "sms_standard");
  const s = settledAmounts({ grossMinor: 50000, feeMinor: 750, agentSharePct: plan.agentSharePct });
  const target = Math.floor(0.4 * (50000 - 750 - credits * C.creditCostMinor));  // 13988
  assert.ok(Math.abs(s.agentMinor - target) <= 2, `agent ${s.agentMinor} vs ${target}`);
});
test("B. a first purchase at or above KES 200 uses the standard share", () => {
  const p = smsPlan({ grossMinor: 20000, credits: 285, firstPurchaseEligible: true }, C);
  assert.equal(p.rule, "sms_standard");
});
test("B. nothing left after cost means no agent share", () => {
  assert.deepEqual(smsPlan({ grossMinor: 1000, credits: 100, firstPurchaseEligible: false }, C), { agentSharePct: 0, rule: "no_margin" });
});

test("C. subscription / report shares by rank", () => {
  assert.equal(sharePlan("senior", "subscription", C).agentSharePct, 30);
  assert.equal(sharePlan("clerk", "report", C).agentSharePct, 25);
  const s = settledAmounts({ grossMinor: 99900, feeMinor: 1499, agentSharePct: 30 });
  assert.equal(s.netMinor, 98401);
  assert.equal(s.agentMinor, 29520);
});

test("D. rent take is capped at KES 250", () => {
  assert.equal(rentTake(800000, 1.5, C), 12000);
  assert.equal(rentTake(2000000, 2, C), 25000);
});
test("D. rent split: landlord keeps 100 - take, desk gets 30% of the take, Samuhia the rest", () => {
  const p = rentPlan({ rentMinor: 800000, takeMinor: 12000 }, C);
  assert.deepEqual(p, { landlordSharePct: 98.5, agentSharePct: 0.45, platformSharePct: 1.05, takeMinor: 12000 });
  const capped = rentPlan({ rentMinor: 2000000, takeMinor: 40000 }, C);
  assert.equal(capped.takeMinor, 25000);
  assert.equal(capped.landlordSharePct, 98.75);
  assert.equal(capped.agentSharePct, 0.37);
  assert.ok(Math.abs(capped.landlordSharePct + capped.agentSharePct + capped.platformSharePct - 100) < 1e-9);
});
test("D. rent: agent nets 30% of the take after the proportional fee", () => {
  const plan = rentPlan({ rentMinor: 800000, takeMinor: 12000 }, C);
  const fee = 12000;                                               // 1.5% of rent
  const s = settledAmounts({ grossMinor: 800000, feeMinor: fee, agentSharePct: plan.agentSharePct });
  const takeNet = 12000 - Math.round((fee * 12000) / 800000);      // 11820
  assert.ok(Math.abs(s.agentMinor - Math.floor(takeNet * 0.3)) <= 2);
});

test("E. milestone: one bonus per block of 10, lifetime cap KES 10,000", () => {
  assert.deepEqual(milestoneNewBlocks(9, 0, C), { newBlocks: 0, bonusMinor: 0, maxBlocks: 5 });
  assert.equal(milestoneNewBlocks(10, 0, C).bonusMinor, 200000);
  assert.equal(milestoneNewBlocks(27, 1, C).newBlocks, 1);
  assert.equal(milestoneNewBlocks(500, 0, C).newBlocks, 5);
  assert.equal(milestoneNewBlocks(500, 5, C).newBlocks, 0);
});

test("floorPct2 survives binary float artefacts", () => {
  assert.equal(floorPct2(71.03), 71.03);
  assert.equal(floorPct2(0.375), 0.37);
});
test("config merge keeps defaults for unspecified nested keys", () => {
  const m = mergeConfig({ subShareByRank: { clerk: 20 } as never });
  assert.equal(m.subShareByRank.clerk, 20);
  assert.equal(m.subShareByRank.senior, 30);
});

test("conservation: agent + platform = net for 3,000 pseudo-random charges and shares", () => {
  let seed = 4242;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < 3000; i++) {
    const gross = 100 + Math.floor(rnd() * 500000);
    const fee = Math.floor(gross * (0.005 + rnd() * 0.03));
    const share = floorPct2(rnd() * 99);
    const s = settledAmounts({ grossMinor: gross, feeMinor: fee, agentSharePct: share });
    assert.equal(s.agentMinor + s.platformMinor, s.netMinor);
    assert.ok(s.agentMinor >= 0 && s.platformMinor >= 0);
  }
});
test("SMS shares never exceed the configured ceiling and never go negative across the price range", () => {
  for (let g = 3000; g <= 500000; g += 1777) {
    for (const rate of [90, 75, 70, 60, 50, 40]) {
      const credits = creditsFor(g, rate);
      for (const first of [true, false]) {
        const p = smsPlan({ grossMinor: g, credits, firstPurchaseEligible: first }, C);
        assert.ok(p.agentSharePct >= 0 && p.agentSharePct < 100);
        if (!(first && g < C.firstPurchaseThresholdMinor)) assert.ok(p.agentSharePct <= 40);
      }
    }
  }
});
