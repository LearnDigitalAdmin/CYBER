import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DESK_CONFIG as cfg } from "../config.js";
import {
  activeBookBonus, canDecide, canInvite, chainFromUpline, commissionableNet, customerIncentives, decisionMove, eligibleRoles, governIncentives,
  isInternalEmail, leastLoaded, monthsBetween, overrideEligible, paymentSmsText, planOverrides, prevMonth, qualityBonus, resolveGeo,
  roleForUplineCode, streakEndingAt,
} from "./pure.js";

test("geography resolves only real county/constituency/ward triples", () => {
  const g = resolveGeo("nakuru", "Naivasha", "Maiella");
  assert.equal(g.countyId, "nakuru");
  assert.equal(g.constituencyId, "nakuru/naivasha");
  assert.throws(() => resolveGeo("Nakuru", "Naivasha", "Not A Ward"));
  assert.throws(() => resolveGeo("Atlantis", "x", "y"));
});

test("internal email: only the two company domains, exactly", () => {
  assert.ok(isInternalEmail("a@samuhia.co.ke")); assert.ok(isInternalEmail("A@MyRegister.co.ke"));
  assert.ok(!isInternalEmail("a@samuhia.co.ke.evil.com")); assert.ok(!isInternalEmail("a@gmail.com")); assert.ok(!isInternalEmail("a@evilsamuhia.co.ke")); assert.ok(!isInternalEmail(undefined));
});

test("code -> role map and who may invite whom", () => {
  assert.equal(roleForUplineCode("senior"), "clerk"); assert.equal(roleForUplineCode("lead"), "senior");
  assert.equal(roleForUplineCode("admin"), "lead"); assert.equal(roleForUplineCode("internal"), "clerk"); assert.equal(roleForUplineCode("clerk"), null);
  assert.ok(!canInvite("clerk", "clerk")); assert.ok(canInvite("senior", "clerk")); assert.ok(!canInvite("senior", "senior"));
  assert.ok(canInvite("lead", "senior")); assert.ok(canInvite("lead", "clerk")); assert.ok(!canInvite("lead", "lead"));
  assert.ok(canInvite("admin", "lead")); assert.ok(!canInvite("admin", "admin")); assert.ok(canInvite("internal", "admin")); assert.ok(!canInvite("internal", "internal"));
});

test("approval permissions: admins stay in their county and never approve admins", () => {
  const admin = { agentId: "a", rank: "admin" as const, status: "active" as const, countyId: "nakuru" };
  assert.ok(canDecide(admin, { agentId: "t", rank: "clerk", countyId: "nakuru" }, "approve").ok);
  assert.ok(!canDecide(admin, { agentId: "t", rank: "clerk", countyId: "kiambu" }, "approve").ok);
  assert.ok(!canDecide(admin, { agentId: "t", rank: "admin", countyId: "nakuru" }, "approve").ok);
  assert.ok(!canDecide(admin, { agentId: "a", rank: "clerk", countyId: "nakuru" }, "approve").ok, "self");
  const internal = { agentId: "i", rank: "internal" as const, status: "active" as const };
  assert.ok(canDecide(internal, { agentId: "t", rank: "admin" }, "approve").ok);
  assert.ok(!canDecide(internal, { agentId: "x", rank: "internal" }, "suspend").ok);
  assert.ok(!canDecide({ ...admin, status: "suspended" }, { agentId: "t", rank: "clerk", countyId: "nakuru" }, "approve").ok);
  assert.ok(!canDecide({ agentId: "s", rank: "senior", status: "active" }, { agentId: "t", rank: "clerk" }, "approve").ok);
});

test("status moves", () => {
  assert.deepEqual(decisionMove("applied", "approve"), { ok: true, to: "training" });
  assert.deepEqual(decisionMove("training", "activate"), { ok: true, to: "active" });
  assert.equal(decisionMove("active", "approve").ok, false); assert.equal(decisionMove("suspended", "suspend").ok, false);
});

test("chain: skipping missing levels, internal has none", () => {
  assert.deepEqual(chainFromUpline(undefined), {});
  assert.deepEqual(chainFromUpline({ agentId: "s", rank: "senior", leadId: "l", adminId: "a" }), { uplineId: "s", seniorId: "s", leadId: "l", adminId: "a" });
  assert.deepEqual(chainFromUpline({ agentId: "l", rank: "lead", adminId: "a" }), { uplineId: "l", leadId: "l", adminId: "a" });
  assert.deepEqual(chainFromUpline({ agentId: "a", rank: "admin" }), { uplineId: "a", adminId: "a" });
});

test("even distribution picks the least loaded, then the oldest", () => {
  const r = leastLoaded([{ agentId: "a", downlineCount: 3, createdAt: 1 }, { agentId: "b", downlineCount: 1, createdAt: 9 }, { agentId: "c", downlineCount: 1, createdAt: 5 }]);
  assert.equal(r?.agentId, "c"); assert.equal(leastLoaded([]), undefined);
});

test("role options appear only when the hierarchy exists, and respect the caps", () => {
  const none = eligibleRoles({ activeSeniors: 0, seniorSlotsUsed: 0, activeLeads: 0, leadSlotsUsed: 0, activeAdmins: 0 }, cfg);
  assert.ok(none.every((o) => !o.available));
  const full = eligibleRoles({ activeSeniors: 4, seniorSlotsUsed: 4, activeLeads: 3, leadSlotsUsed: 3, activeAdmins: 1 }, cfg);
  assert.ok(full.find((o) => o.role === "clerk")?.available);
  assert.equal(full.find((o) => o.role === "senior")?.available, false); assert.equal(full.find((o) => o.role === "lead")?.available, false);
  const some = eligibleRoles({ activeSeniors: 1, seniorSlotsUsed: 1, activeLeads: 1, leadSlotsUsed: 1, activeAdmins: 1 }, cfg);
  assert.equal(some.find((o) => o.role === "senior")?.slotsLeft, 3); assert.equal(some.find((o) => o.role === "lead")?.slotsLeft, 2);
});

test("streaks and months", () => {
  assert.equal(prevMonth("2026-01"), "2025-12");
  assert.equal(streakEndingAt(["2026-09", "2026-10", "2026-11"], "2026-11"), 3);
  assert.equal(streakEndingAt(["2026-09", "2026-11"], "2026-11"), 1);
  assert.equal(streakEndingAt(["2026-09"], "2026-11"), 0);
  assert.equal(monthsBetween(Date.UTC(2026, 0, 15), Date.UTC(2026, 11, 15)), 11);
});

test("overrides: clerk sale pays senior 4% and lead 3% of net, from Samuhia's share", () => {
  const net = 100_000;
  const lines = planOverrides({ stream: "subscription", baseMinor: net, agentMinor: 25_000, ownerRank: "clerk", seniorId: "s", leadId: "l" }, cfg);
  assert.deepEqual(lines, [{ beneficiaryId: "s", rank: "senior", amountMinor: 4000 }, { beneficiaryId: "l", rank: "lead", amountMinor: 3000 }]);
});
test("overrides: a missing senior is skipped, nothing is re-routed to the lead", () => {
  const lines = planOverrides({ stream: "subscription", baseMinor: 100_000, agentMinor: 25_000, ownerRank: "clerk", leadId: "l" }, cfg);
  assert.deepEqual(lines, [{ beneficiaryId: "l", rank: "lead", amountMinor: 3000 }]);
  assert.deepEqual(planOverrides({ stream: "subscription", baseMinor: 100_000, agentMinor: 25_000, ownerRank: "clerk" }, cfg), []);
});
test("overrides: senior-owned pays only the lead; lead/admin-owned pay none", () => {
  assert.equal(planOverrides({ stream: "report", baseMinor: 100_000, agentMinor: 30_000, ownerRank: "senior", seniorId: "s", leadId: "l" }, cfg).length, 1);
  assert.equal(planOverrides({ stream: "report", baseMinor: 100_000, agentMinor: 30_000, ownerRank: "lead", leadId: "l" }, cfg).length, 0);
  assert.equal(planOverrides({ stream: "report", baseMinor: 100_000, agentMinor: 30_000, ownerRank: "admin" }, cfg).length, 0);
});
test("overrides: the per-event ceiling holds even if rates are mis-set", () => {
  const hot = { ...cfg, network: { ...cfg.network, overridePct: { senior: { subscription: 40, report: 40, rent: 40 }, lead: { subscription: 40, report: 40, rent: 40 } } } };
  const lines = planOverrides({ stream: "subscription", baseMinor: 100_000, agentMinor: 25_000, ownerRank: "clerk", seniorId: "s", leadId: "l" }, hot);
  const total = 25_000 + lines.reduce((s, l) => s + l.amountMinor, 0);
  assert.ok(total <= 46_000, `total ${total}`);
  assert.deepEqual(planOverrides({ stream: "subscription", baseMinor: 100_000, agentMinor: 50_000, ownerRank: "clerk", seniorId: "s" }, cfg), []);
});
test("rent: overrides apply to Plot Yangu's take and the owner + team stay inside 46%", () => {
  // KES 20,000 rent, 1.5% take = KES 300 of take; agent 40% of take = KES 120; PAY expresses the agent's slice as % of the rent.
  const gross = 2_000_000, fee = 30_000, takePct = 1.5, agentSharePct = Math.floor(takePct * cfg.rentDeskSharePct) / 100 * 1;
  const e = { type: "rent_payment" as const, grossMinor: gross, feeMinor: fee, agentSharePct: (takePct * cfg.rentDeskSharePct) / 100 };
  const base = commissionableNet(e, cfg);
  assert.ok(Math.abs(base - Math.floor(((gross - fee) * takePct) / 100)) <= 1, `base ${base}`);
  const agent = Math.floor(((gross - fee) * e.agentSharePct) / 100);
  const lines = planOverrides({ stream: "rent", baseMinor: base, agentMinor: agent, ownerRank: "clerk", seniorId: "s", leadId: "l" }, cfg);
  const total = agent + lines.reduce((s, l) => s + l.amountMinor, 0);
  assert.ok(total <= Math.floor((base * 46) / 100), `${total} vs ${base}`);
  assert.ok(agentSharePct >= 0);
});

test("override eligibility: subscriptions from the 2nd paid month, 24-month limit, never self-owned", () => {
  const t0 = Date.UTC(2026, 10, 5);
  const base = { stream: "subscription" as const, paidPeriodsAfter: 2, attributedAt: t0, paidAt: t0 + 40 * 86_400_000 };
  assert.ok(overrideEligible(base, cfg));
  assert.ok(!overrideEligible({ ...base, paidPeriodsAfter: 1 }, cfg));
  assert.ok(overrideEligible({ ...base, stream: "rent", paidPeriodsAfter: 1 }, cfg));
  assert.ok(!overrideEligible({ ...base, paidAt: Date.UTC(2028, 11, 5) }, cfg));
  assert.ok(!overrideEligible({ ...base, selfOwned: true }, cfg)); assert.ok(!overrideEligible({ ...base, refunded: true }, cfg));
});

test("incentives: acquisition, activation, retention and loyalty, once only where they should be", () => {
  const inc = cfg.incentives; const after = Date.UTC(2026, 10, 10); const before = Date.UTC(2026, 8, 1);
  const kinds = (periods: string[], month: string, attributedAt = after) => customerIncentives({ periods, attributedAt }, month, inc).map((x) => x.kind).sort();
  assert.deepEqual(kinds(["2026-11"], "2026-11"), ["acquisition"]);
  assert.deepEqual(kinds(["2026-11", "2026-12"], "2026-12"), ["acquisition", "activation"]);
  assert.deepEqual(kinds(["2026-11", "2026-12", "2027-01"], "2027-01"), ["acquisition", "activation", "loyalty"]);
  const six = ["2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-04"];
  assert.ok(kinds(six, "2027-04").includes("retention6")); assert.ok(!kinds(six, "2027-04").includes("retention12"));
  assert.deepEqual(kinds(["2026-09", "2026-10", "2026-11"], "2026-11", before), ["loyalty"], "pre-launch customers only earn loyalty");
  assert.deepEqual(kinds(["2026-10"], "2026-11"), [], "not paid this month");
  assert.deepEqual(customerIncentives({ periods: ["2026-11"], attributedAt: after, refunded: true }, "2026-11", inc), []);
  assert.deepEqual(customerIncentives({ periods: ["2026-11"], attributedAt: after, selfOwned: true }, "2026-11", inc), []);
});
test("active-book tiers and quality", () => {
  const t = cfg.incentives.activeBookTiers;
  assert.equal(activeBookBonus(9, t), 0); assert.equal(activeBookBonus(10, t), 20000); assert.equal(activeBookBonus(30, t), 60000); assert.equal(activeBookBonus(80, t), 150000);
  assert.equal(qualityBonus(5, 0, cfg.incentives), 30000); assert.equal(qualityBonus(4, 0, cfg.incentives), 0); assert.equal(qualityBonus(9, 1, cfg.incentives), 0);
});

test("governor: Samuhia keeps at least 54% however much is requested", () => {
  const base = 1_000_000;
  for (const requested of [0, 10_000, 100_000, 5_000_000]) {
    for (const recurring of [250_000, 330_000, 440_000]) {
      const r = governIncentives({ baseMinor: base, recurringCostMinor: recurring, otherCostMinor: 0, payoutCount: 10, eventCount: 200, requestedMinor: requested }, cfg);
      if (recurring + 10 * cfg.network.transferFeeEstimateMinor + 200 * cfg.incentives.smsReservePerEventMinor <= r.allowedMinor) {
        assert.ok(r.retainedPct >= 54, `retained ${r.retainedPct} for requested ${requested}, recurring ${recurring}`);
      }
      assert.ok(r.awardedMinor <= requested); assert.ok(r.scaleBps >= 0 && r.scaleBps <= 10_000);
    }
  }
});
test("governor: nothing requested costs nothing; a tiny month cannot overspend", () => {
  assert.equal(governIncentives({ baseMinor: 0, recurringCostMinor: 0, otherCostMinor: 0, payoutCount: 0, eventCount: 0, requestedMinor: 0 }, cfg).awardedMinor, 0);
  const r = governIncentives({ baseMinor: 10_000, recurringCostMinor: 3_000, otherCostMinor: 0, payoutCount: 1, eventCount: 3, requestedMinor: 50_000 }, cfg);
  assert.ok(r.awardedMinor === 0 || r.retainedPct >= 54);
});

test("payment SMS stays short and carries the snapshot", () => {
  const t = paymentSmsText({ kind: "commission", earnedMinor: 61500, count: 1, monthMinor: 615000, monthPayments: 12 });
  assert.ok(t.length <= 160, String(t.length)); assert.match(t, /\+KES 615/); assert.match(t, /12 payments/);
  const o = paymentSmsText({ kind: "override", earnedMinor: 9800, count: 3, monthMinor: 12000, monthPayments: 1 });
  assert.match(o, /team override from 3 payments/); assert.match(o, /1 payment\./);
});
