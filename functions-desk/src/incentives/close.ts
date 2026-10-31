/**
 * Month close: turns a finished month into automatic, margin-safe payouts.
 *
 *  1. Requests incentives (create-only docs, so re-running never double-requests): per customer acquisition / activation / retention /
 *     loyalty, per agent active-book tier and quality.
 *  2. Runs the margin governor: total agent-network cost for the month may not exceed 100 - platformFloorPct - safety of the month's
 *     commissionable net. Commissions and overrides are already committed, so only incentives are scaled, pro-rata, to fit.
 *  3. Writes ONE payable `network` ledger row per agent (overrides + scaled incentives + anything carried over). Amounts under the
 *     minimum payout carry forward so a KES 20 transfer fee never eats a tiny payout. The scheduler then pays the rows by Paystack transfer.
 */
import * as logger from "firebase-functions/logger";
import { FieldPath } from "firebase-admin/firestore";
import { col, db, getConfig } from "../db.js";
import type { DeskConfig } from "../config.js";
import { audit } from "../kernel/audit.js";
import { appendLedger } from "../kernel/ledger.js";
import { activeBookBonus, customerIncentives, governIncentives, monthOf, monthStartMs, nextMonth, prevMonth, qualityBonus, scaleMinor } from "../network/pure.js";
import type { AgentDoc, CustomerDoc, DeskEventDoc, IncentiveDoc, LedgerDoc, StatsDoc, SupportDoc } from "../types.js";

const ALREADY_EXISTS = 6;
const created = async (id: string, doc: IncentiveDoc): Promise<boolean> => {
  try { await col("incentives").doc(id).create(doc); return true; } catch (err) { if ((err as { code?: number }).code === ALREADY_EXISTS) return false; throw err; }
};

export interface CloseResult { month: string; requested: number; awardedMinor: number; scaleBps: number; rows: number; carried: number; retainedPct: number }

export async function closeMonth(month: string, nowMs: number, cfgIn?: DeskConfig): Promise<CloseResult> {
  if (month >= monthOf(nowMs)) throw new Error(`cannot close ${month}: the month is not over`);
  const cfg = cfgIn ?? (await getConfig());
  const inc = cfg.incentives;
  const start = monthStartMs(month), end = monthStartMs(nextMonth(month));
  const agents = new Map<string, AgentDoc | null>();
  const agentOf = async (id: string): Promise<AgentDoc | null> => {
    if (!agents.has(id)) agents.set(id, ((await col("agents").doc(id).get()).data() as AgentDoc | undefined) ?? null);
    return agents.get(id) as AgentDoc | null;
  };
  const earns = (a: AgentDoc | null): a is AgentDoc => !!a && a.status === "active" && a.rank !== "internal";

  // ---- 1. requests
  const paidCount = new Map<string, number>();
  let after: string | undefined;
  for (;;) {
    let q = col("customers").where("paidPeriods", "array-contains", month).orderBy(FieldPath.documentId()).limit(500);
    if (after) q = q.startAfter(after);
    const page = await q.get();
    if (page.empty) break;
    for (const d of page.docs) {
      const c = d.data() as CustomerDoc;
      const owner = await agentOf(c.ownerAgentId);
      if (!earns(owner) || c.selfOwned || c.refunded) continue;
      paidCount.set(owner.agentId, (paidCount.get(owner.agentId) ?? 0) + 1);
      for (const cand of customerIncentives({ periods: c.paidPeriods, attributedAt: c.attributedAt, refunded: c.refunded, selfOwned: c.selfOwned }, month, inc)) {
        const id = cand.once ? `${cand.kind}_${d.id}` : `${cand.kind}_${d.id}_${month}`;
        await created(id, { id, agentId: owner.agentId, kind: cand.kind, month, requestedMinor: cand.minor, entityKey: c.entityKey, status: "requested", createdAt: nowMs });
      }
    }
    after = page.docs[page.docs.length - 1].id;
    if (page.size < 500) break;
  }
  for (const [agentId, n] of paidCount) {
    await col("stats").doc(`${agentId}_${month}`).set({ agentId, month, activeCustomers: n }, { merge: true });
    const minor = activeBookBonus(n, inc.activeBookTiers);
    if (minor > 0) { const id = `active_book_${agentId}_${month}`; await created(id, { id, agentId, kind: "active_book", month, requestedMinor: minor, status: "requested", createdAt: nowMs }); }
  }
  // quality: confirmed support with no refunds
  const confirmed = new Map<string, number>(), refunds = new Map<string, number>();
  for (const d of (await col("support").where("customerConfirmedAt", ">=", start).where("customerConfirmedAt", "<", end).get()).docs) {
    const s = d.data() as SupportDoc; confirmed.set(s.agentId, (confirmed.get(s.agentId) ?? 0) + 1);
  }
  for (const d of (await col("events").where("type", "==", "refund").where("paidAt", ">=", start).where("paidAt", "<", end).get()).docs) {
    const e = d.data() as DeskEventDoc; refunds.set(e.agentId, (refunds.get(e.agentId) ?? 0) + 1);
  }
  for (const [agentId, n] of confirmed) {
    if (!earns(await agentOf(agentId))) continue;
    const minor = qualityBonus(n, refunds.get(agentId) ?? 0, inc);
    if (minor > 0) { const id = `quality_${agentId}_${month}`; await created(id, { id, agentId, kind: "quality", month, requestedMinor: minor, status: "requested", createdAt: nowMs }); }
  }

  // ---- 2. governor
  const statSnap = await col("stats").where("month", "==", month).get();
  const stats = new Map<string, StatsDoc>();
  let baseMinor = 0, recurringCostMinor = 0, eventCount = 0;
  for (const d of statSnap.docs) {
    const s = d.data() as StatsDoc; stats.set(s.agentId, s);
    baseMinor += s.netMinor ?? 0; recurringCostMinor += (s.commissionMinor ?? 0) + (s.overrideMinor ?? 0); eventCount += s.payments ?? 0;
  }
  let otherCostMinor = 0;
  for (const d of (await col("ledger").where("createdAt", ">=", start).where("createdAt", "<", end).where("kind", "in", ["bonus", "support"]).get()).docs) otherCostMinor += (d.data() as LedgerDoc).amountMinor;

  const reqSnap = await col("incentives").where("month", "==", month).where("status", "==", "requested").get();
  const requests = reqSnap.docs.map((d) => d.data() as IncentiveDoc);
  const requestedMinor = requests.reduce((s, r) => s + r.requestedMinor, 0);
  const carryIn = new Map<string, number>();
  for (const d of (await col("stats").where("month", "==", prevMonth(month)).where("carryOutMinor", "!=", 0).get()).docs) { const s = d.data() as StatsDoc; carryIn.set(s.agentId, s.carryOutMinor ?? 0); }

  const byAgent = new Map<string, IncentiveDoc[]>();
  for (const r of requests) byAgent.set(r.agentId, [...(byAgent.get(r.agentId) ?? []), r]);
  const payees = new Set<string>([...byAgent.keys(), ...carryIn.keys(), ...[...stats.values()].filter((s) => (s.overrideMinor ?? 0) !== 0).map((s) => s.agentId)]);
  const gov = governIncentives({ baseMinor, recurringCostMinor, otherCostMinor, payoutCount: payees.size, eventCount, requestedMinor }, cfg);

  // ---- 3. one payable row per agent
  let rows = 0, carried = 0, awarded = 0;
  for (const agentId of payees) {
    if (stats.get(agentId)?.closedAt) continue; // already closed in an earlier run
    const a = await agentOf(agentId);
    const mine = byAgent.get(agentId) ?? [];
    const incentiveMinor = mine.reduce((s, r) => s + scaleMinor(r.requestedMinor, gov.scaleBps), 0);
    const overrideMinor = stats.get(agentId)?.overrideMinor ?? 0;
    const carriedMinor = carryIn.get(agentId) ?? 0;
    const total = incentiveMinor + overrideMinor + carriedMinor;
    const statRef = col("stats").doc(`${agentId}_${month}`);
    if (!a || a.status === "closed" || a.rank === "internal") { await statRef.set({ agentId, month, closedAt: nowMs, carryOutMinor: 0 }, { merge: true }); continue; }
    if (a.status === "active" && total >= cfg.network.minPayoutMinor) {
      const res = await appendLedger({
        agentId, kind: "network", amountMinor: total, status: "payable", rule: "network_monthly", month, overrideMinor, incentiveMinor, carriedMinor,
        note: `Network earnings ${month}: team overrides + retention/activity incentives${carriedMinor ? " + carried forward" : ""}`, idempotencyParts: ["network", agentId, month],
      });
      if (res.created) rows++;
      await statRef.set({ agentId, month, closedAt: nowMs, incentiveMinor, carryOutMinor: 0 }, { merge: true });
    } else {
      carried++;
      await statRef.set({ agentId, month, closedAt: nowMs, incentiveMinor, carryOutMinor: total }, { merge: true });
    }
    awarded += incentiveMinor;
    for (let i = 0; i < mine.length; i += 400) {
      const batch = db().batch();
      for (const r of mine.slice(i, i + 400)) batch.update(col("incentives").doc(r.id), { status: "awarded", awardedMinor: scaleMinor(r.requestedMinor, gov.scaleBps) });
      await batch.commit();
    }
  }
  await col("counters").doc(`gov_${month}`).set({ month, baseMinor, recurringCostMinor, otherCostMinor, requestedMinor, awardedMinor: awarded, costMinor: gov.costMinor, retainedPct: gov.retainedPct, scaleBps: gov.scaleBps, payees: payees.size, closedAt: nowMs }, { merge: true });
  await audit({ action: "month_closed", meta: { month, requestedMinor, awardedMinor: awarded, scaleBps: gov.scaleBps, rows, carried, retainedPct: gov.retainedPct } });
  logger.info("month closed", { month, rows, carried, retainedPct: gov.retainedPct, scaleBps: gov.scaleBps });
  return { month, requested: requests.length, awardedMinor: awarded, scaleBps: gov.scaleBps, rows, carried, retainedPct: gov.retainedPct };
}
