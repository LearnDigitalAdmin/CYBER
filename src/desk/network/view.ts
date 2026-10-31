/** Pure presentation logic for the network dashboards (no React, no Firebase), so it is easy to test. */
import type { AgentStatus, NetDashboardOut, NetDecision, NetIncentiveRules, NetMember, NetMonthStat, Rank } from "../api/contract";
import { formatKes } from "../api/format";

export const ROLE_LABEL: Record<Rank, string> = { clerk: "Clerk", senior: "Senior", lead: "Lead", admin: "Admin", internal: "Internal" };
export const ROLE_BLURB: Record<Rank, string> = {
  clerk: "You find customers and help them pay and stay. You report to a senior agent, or to Samuhia until one is assigned.",
  senior: "You manage the clerks in your ward and earn a team override on their paying, retained customers.",
  lead: "You manage the senior agents in your constituency, and through them their clerks.",
  admin: "You are Samuhia's agent for your county: you train and approve other agents. Your income is salaried, plus your own servicing work.",
  internal: "Samuhia operations. You approve agents and watch network health. You are not paid commissions.",
};
export const STATUS_TONE: Record<AgentStatus, "blue" | "green" | "amber" | "red"> = { applied: "blue", training: "blue", certified: "blue", active: "green", suspended: "amber", closed: "red" };

export interface Tile { label: string; value: string; hint?: string; tone?: "default" | "good" | "warn" }

const current = (d: NetDashboardOut): NetMonthStat => d.stats[0];
const last = (d: NetDashboardOut): NetMonthStat | undefined => d.stats[1];

/** Share of last month's paying customers who paid again this month (0..1), or undefined when there is no base yet. */
export function retention(d: Pick<NetDashboardOut, "customers">): number | undefined {
  const { paidLastMonth, paidThisMonth } = d.customers;
  return paidLastMonth > 0 ? Math.min(1, paidThisMonth / paidLastMonth) : undefined;
}
export const pct = (f: number | undefined): string => (f === undefined ? "n/a" : `${Math.round(f * 100)}%`);

/** The four behaviours the incentives reward: find, get paid, keep active, support. Tiles are the same for every role; teams add their own. */
export function tilesFor(d: NetDashboardOut): Tile[] {
  const m = current(d); const prev = last(d);
  const base: Tile[] = [
    { label: "Customers", value: String(d.customers.owned), hint: `${m.newCustomers} new this month` },
    { label: "Paid this month", value: String(d.customers.paidThisMonth), hint: `${d.customers.paidLastMonth} last month` },
    { label: "Kept paying", value: pct(retention(d)), hint: "Of last month's payers", tone: (retention(d) ?? 1) >= 0.8 ? "good" : "warn" },
    { label: "Commission", value: formatKes(m.commissionMinor), hint: `${m.payments} payments this month`, tone: "good" },
  ];
  if (d.role === "clerk") base.push({ label: "Incentives", value: formatKes(prev?.incentiveMinor ?? 0), hint: "Paid for last month" });
  if (d.role === "senior" || d.role === "lead") base.push({ label: "Team overrides", value: formatKes(m.overrideMinor), hint: "From your team's paying customers", tone: "good" });
  if (d.role !== "clerk" && d.team) {
    base.push(
      { label: "Team revenue", value: formatKes(m.teamNetMinor), hint: `${m.teamPayments} team payments` },
      { label: "Team size", value: String(d.team.clerks + d.team.seniors + d.team.leads), hint: `${d.team.active} active, ${d.team.suspended} suspended` },
      { label: "Awaiting approval", value: String(d.team.pendingApproval), tone: d.team.pendingApproval > 0 ? "warn" : "default" },
    );
  }
  base.push({ label: "Carried to next payout", value: formatKes(d.payout.carryMinor), hint: `Paid automatically once it reaches ${formatKes(d.payout.minPayoutMinor)}` });
  return base;
}

/** What each behaviour pays, for the "how you earn" panel. */
export function incentiveGuide(r: NetIncentiveRules): { behaviour: string; rule: string }[] {
  const tier = [...r.activeBookTiers].sort((a, b) => a.min - b.min).map((t) => `${t.min}+ paying customers: ${formatKes(t.minor)}`).join(", ");
  return [
    { behaviour: "Find suitable customers", rule: `${formatKes(r.acquisitionMinor)} when a customer you brought makes their first payment` },
    { behaviour: "Get them to pay", rule: `${formatKes(r.activationMinor)} when they pay a second month running` },
    { behaviour: "Keep them active", rule: `${formatKes(r.retention6Minor)} at 6 months and ${formatKes(r.retention12Minor)} at 12 months in a row, plus ${formatKes(r.loyaltyMonthlyMinor)} every month from month ${r.loyaltyMinStreak}. Monthly book bonus: ${tier}` },
    { behaviour: "Deliver good support", rule: `${formatKes(r.qualityMinor)} a month for ${r.qualityMinConfirmed}+ customer-confirmed support visits with no refunds` },
  ];
}

/** Actions an approver may offer for a team member in a given status. */
export function actionsFor(status: AgentStatus, rank: Rank, viewer: Rank): NetDecision[] {
  if (viewer !== "admin" && viewer !== "internal") return [];
  if (rank === "admin" && viewer !== "internal") return [];
  switch (status) {
    case "applied": return ["approve", "reject", "assign"];
    case "training": case "certified": return ["activate", "assign"];
    case "active": return ["suspend", "assign"];
    case "suspended": return ["reinstate"];
    default: return [];
  }
}
export const ACTION_LABEL: Record<NetDecision, string> = { approve: "Approve for training", activate: "Activate", reject: "Reject", suspend: "Suspend", reinstate: "Reinstate", assign: "Move under…" };
export const needsReason = (a: NetDecision): boolean => a === "reject" || a === "suspend";

/** Bar-chart series (oldest first) from the last six months, for any money field. */
export function series(d: NetDashboardOut, pick: (s: NetMonthStat) => number): { month: string; minor: number }[] {
  return [...d.stats].reverse().map((s) => ({ month: s.month, minor: pick(s) }));
}
export const memberLine = (m: NetMember): string => `${m.deskCode} · ${ROLE_LABEL[m.rank]} · ${m.customers} customers`;
