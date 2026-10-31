/**
 * Pure distribution-network logic. No Firebase imports, integer minor units only.
 *
 * ROLES (stored as `rank`): clerk < senior < lead < admin; `internal` is Samuhia staff.
 *   clerk   joins with a senior's code           (max 4 seniors per ward)
 *   senior  joins with a lead's code             (max 3 leads per constituency)
 *   lead    joins with an admin's code
 *   admin   assigned per county by internal staff, unlimited, salaried (earns only as a servicing agent)
 *   internal  verified @samuhia.co.ke / @myregister.co.ke email, no approval, ops only (never paid commissions)
 * A level that is missing is skipped; with nobody above, the money simply stays with Samuhia ("rolls up to internal").
 */
import { randomInt } from "node:crypto";
import type { DeskConfig, IncentiveConfig, OverrideStream } from "../config.js";
import type { AgentStatus, NetRoleOption, Rank } from "../contract.js";
import { DeskError } from "../errors.js";
import type { AgentDoc, DeskEventType } from "../types.js";
import { KENYA_ADMIN } from "./geo.data.js";

// ------------------------------------------------------------------ geography
export const slug = (s: string): string => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
export interface Geo { countyId: string; constituencyId: string; wardId: string }

/** Exact (case-insensitive) match against the same county -> constituency -> ward data the signup address pickers use. */
export function resolveGeo(county: string, constituency: string, ward: string): Geo {
  const eq = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const c = KENYA_ADMIN.find((x) => eq(x.n, county));
  const k = c?.k.find((x) => eq(x.n, constituency));
  const w = k?.w.find((x) => eq(x, ward));
  if (!c || !k || !w) throw new DeskError("invalid_argument", "Choose your county, constituency and ward from the lists");
  const countyId = slug(c.n);
  const constituencyId = `${countyId}/${slug(k.n)}`;
  return { countyId, constituencyId, wardId: `${constituencyId}/${slug(w)}` };
}

// ------------------------------------------------------------------ internal staff
export const INTERNAL_EMAIL_DOMAINS: readonly string[] = ["samuhia.co.ke", "myregister.co.ke"];
export function isInternalEmail(email: string | undefined): boolean {
  if (typeof email !== "string") return false;
  const m = /^[^@\s]+@([^@\s]+)$/.exec(email.trim().toLowerCase());
  return !!m && INTERNAL_EMAIL_DOMAINS.includes(m[1]);
}

// ------------------------------------------------------------------ roles and permissions
export const RANK_LEVEL: Record<Rank, number> = { clerk: 1, senior: 2, lead: 3, admin: 4, internal: 5 };
export const LIVE_STATUSES: readonly AgentStatus[] = ["applied", "training", "certified", "active", "suspended"];

/** Role a joiner gets from the code they used: senior's code -> clerk, lead's -> senior, admin's -> lead, internal's -> clerk. */
export function roleForUplineCode(uplineRank: Rank): "clerk" | "senior" | "lead" | null {
  switch (uplineRank) {
    case "senior": return "clerk";
    case "lead": return "senior";
    case "admin": return "lead";
    case "internal": return "clerk";
    default: return null;
  }
}

/** Any agent except clerks can add lower agents. Internal alone can add admins. Nobody adds internal staff (they join by verified email). */
export function canInvite(inviter: Rank, role: Rank): boolean {
  if (role === "internal" || inviter === "clerk") return false;
  if (role === "admin") return inviter === "internal";
  return RANK_LEVEL[inviter] > RANK_LEVEL[role];
}

export type Allowed = { ok: true } | { ok: false; message: string };
/**
 * Who may do what to whom. Admins act inside their own county on clerk/senior/lead; internal acts everywhere, and alone approves admins.
 * Nobody outside the top desk changes an internal agent, and nobody changes themselves.
 */
export function canDecide(actor: Pick<AgentDoc, "agentId" | "rank" | "status" | "countyId">, target: Pick<AgentDoc, "agentId" | "rank" | "countyId">, action: string): Allowed {
  if (actor.status !== "active") return { ok: false, message: "Your own desk must be active" };
  if (actor.agentId === target.agentId) return { ok: false, message: "You cannot change your own desk" };
  if (target.rank === "internal") return { ok: false, message: "Internal desks are managed by the top desk only" };
  if (actor.rank === "internal") return { ok: true };
  if (actor.rank !== "admin") return { ok: false, message: "Only admin and internal desks can approve and manage agents" };
  if (target.rank === "admin") return { ok: false, message: "Admin desks are approved by Samuhia internal staff" };
  if (!actor.countyId || actor.countyId !== target.countyId) return { ok: false, message: "That agent is outside your county" };
  return { ok: true };
}

export type DecisionMove = { ok: true; to: AgentStatus } | { ok: false; message: string };
export function decisionMove(from: AgentStatus, action: string): DecisionMove {
  const bad = (m: string): DecisionMove => ({ ok: false, message: m });
  switch (action) {
    case "approve": return from === "applied" ? { ok: true, to: "training" } : bad("Only a new application can be approved");
    case "activate": return from === "training" || from === "certified" ? { ok: true, to: "active" } : bad("Only an approved agent in training can be activated");
    case "reject": return from === "applied" ? { ok: true, to: "closed" } : bad("Only a new application can be rejected");
    case "suspend": return from === "active" ? { ok: true, to: "suspended" } : bad("Only an active agent can be suspended");
    case "reinstate": return from === "suspended" ? { ok: true, to: "active" } : bad("Only a suspended agent can be reinstated");
    default: return bad("Unknown action");
  }
}

// ------------------------------------------------------------------ chain
export interface Chain { uplineId?: string; seniorId?: string; leadId?: string; adminId?: string }
/** The chain a new member inherits from their immediate upline. `undefined` upline = internal (no chain). */
export function chainFromUpline(up: Pick<AgentDoc, "agentId" | "rank" | "leadId" | "adminId"> | undefined): Chain {
  if (!up || up.rank === "internal" || up.rank === "clerk") return {};
  const out: Chain = { uplineId: up.agentId };
  if (up.rank === "senior") { out.seniorId = up.agentId; if (up.leadId) out.leadId = up.leadId; if (up.adminId) out.adminId = up.adminId; }
  else if (up.rank === "lead") { out.leadId = up.agentId; if (up.adminId) out.adminId = up.adminId; }
  else if (up.rank === "admin") out.adminId = up.agentId;
  return out;
}

/** Even distribution: the upline with the fewest direct members, the longest-standing one on a tie. */
export function leastLoaded<T extends { agentId: string; downlineCount?: number; createdAt: number }>(candidates: readonly T[]): T | undefined {
  return [...candidates].sort((a, b) => (a.downlineCount ?? 0) - (b.downlineCount ?? 0) || a.createdAt - b.createdAt || a.agentId.localeCompare(b.agentId))[0];
}

export interface HierarchyContext {
  activeSeniors: number; seniorSlotsUsed: number;   // in the ward
  activeLeads: number; leadSlotsUsed: number;       // in the constituency
  activeAdmins: number;                             // in the county
}
/** Role options shown to a joiner: a role is offered only when the people it would sit under exist. Default is always clerk under internal. */
export function eligibleRoles(h: HierarchyContext, cfg: Pick<DeskConfig, "network">): NetRoleOption[] {
  const seniorLeft = Math.max(0, cfg.network.seniorsPerWard - h.seniorSlotsUsed);
  const leadLeft = Math.max(0, cfg.network.leadsPerConstituency - h.leadSlotsUsed);
  return [
    h.activeSeniors > 0
      ? { role: "clerk", available: true, assignedTo: "senior" }
      : h.activeLeads > 0
        ? { role: "clerk", available: true, assignedTo: "lead" }
        : { role: "clerk", available: false, reason: "No senior in your ward yet. You will join as a clerk under Samuhia until one is assigned." },
    h.activeLeads === 0
      ? { role: "senior", available: false, reason: "No lead in your constituency yet" }
      : seniorLeft === 0
        ? { role: "senior", available: false, reason: "Your ward already has its maximum number of seniors", slotsLeft: 0 }
        : { role: "senior", available: true, slotsLeft: seniorLeft, assignedTo: "lead" },
    h.activeAdmins === 0
      ? { role: "lead", available: false, reason: "No admin in your county yet" }
      : leadLeft === 0
        ? { role: "lead", available: false, reason: "Your constituency already has its maximum number of leads", slotsLeft: 0 }
        : { role: "lead", available: true, slotsLeft: leadLeft, assignedTo: "admin" },
  ];
}

const INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function newInviteCode(): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)];
  return s;
}
export const isInviteCode = (v: unknown): v is string => typeof v === "string" && /^[A-HJKMNP-Z2-9]{8}$/.test(v.trim().toUpperCase());

// ------------------------------------------------------------------ months (Africa/Nairobi, UTC+3, no DST)
export const isMonth = (s: unknown): s is string => typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
export function monthStartMs(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return Date.UTC(y, m - 1, 1) - 3 * 3_600_000;
}
export function prevMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}
export function nextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}
export function monthOf(ms: number): string {
  const d = new Date(ms + 3 * 3_600_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
export function monthsBetween(fromMs: number, toMs: number): number {
  const a = monthOf(fromMs).split("-").map(Number); const b = monthOf(toMs).split("-").map(Number);
  return (b[0] - a[0]) * 12 + (b[1] - a[1]);
}
/** Consecutive paid months ending at `month` (0 when `month` itself was not paid). */
export function streakEndingAt(periods: readonly string[], month: string): number {
  const have = new Set(periods);
  let n = 0;
  for (let m = month; have.has(m); m = prevMonth(m)) n++;
  return n;
}

// ------------------------------------------------------------------ team overrides
export const OVERRIDE_TYPES: Partial<Record<DeskEventType, OverrideStream>> = {
  subscription_payment: "subscription", report_purchase: "report", rent_payment: "rent",
};

/**
 * The net the percentages apply to: subscriptions and reports, the net after Paystack's fee; rent, Plot Yangu's take (net of its share
 * of the fee), recovered from the agent's own slice so it matches what PAY split. Nothing else carries overrides.
 */
export function commissionableNet(e: { type: DeskEventType; grossMinor: number; feeMinor: number; agentSharePct: number }, cfg: DeskConfig): number {
  const net = Math.max(0, e.grossMinor - e.feeMinor);
  if (e.type === "subscription_payment" || e.type === "report_purchase") return net;
  if (e.type === "rent_payment") return cfg.rentDeskSharePct > 0 ? Math.floor((net * e.agentSharePct) / cfg.rentDeskSharePct) : 0;
  return 0;
}
/** Net used for the margin governor: also counts SMS (margin after the credit cost). Service charges are excluded by design. */
export function governorBase(e: { type: DeskEventType; grossMinor: number; feeMinor: number; agentSharePct: number; credits?: number }, cfg: DeskConfig): number {
  if (e.type === "refund") return 0;
  if (e.type === "sms_purchase") return Math.max(0, e.grossMinor - e.feeMinor - (e.credits ?? 0) * cfg.creditCostMinor);
  return commissionableNet(e, cfg);
}

export interface OverrideEligibility {
  stream: OverrideStream; paidPeriodsAfter: number; attributedAt: number; paidAt: number; selfOwned?: boolean; refunded?: boolean;
}
/** Subscriptions pay overrides from the customer's 2nd paid month (an activated customer); every stream stops after the time limit. */
export function overrideEligible(x: OverrideEligibility, cfg: DeskConfig): boolean {
  if (x.selfOwned || x.refunded) return false;
  if (x.stream === "subscription" && x.paidPeriodsAfter < 2) return false;
  return monthsBetween(x.attributedAt, x.paidAt) < cfg.network.overrideMonthsLimit;
}

export interface OverrideLine { beneficiaryId: string; rank: "senior" | "lead"; amountMinor: number }
/**
 * Overrides for one payment. Only an ACTIVE senior/lead in the owner's chain is paid; a missing or inactive level pays nothing, so that
 * share stays with Samuhia. The sum with the owner's own slice can never exceed `maxRecurringPct` of the net (hard per-event ceiling).
 */
export function planOverrides(
  p: { stream: OverrideStream; baseMinor: number; agentMinor: number; ownerRank: Rank; seniorId?: string; leadId?: string }, cfg: DeskConfig,
): OverrideLine[] {
  if (p.baseMinor <= 0) return [];
  let budget = Math.max(0, Math.floor((p.baseMinor * cfg.network.maxRecurringPct) / 100) - p.agentMinor);
  const out: OverrideLine[] = [];
  const add = (id: string | undefined, rank: "senior" | "lead", pct: number) => {
    if (!id || budget <= 0 || pct <= 0) return;
    const amount = Math.min(budget, Math.floor((p.baseMinor * Math.round(pct * 100)) / 10_000));
    if (amount <= 0) return;
    budget -= amount;
    out.push({ beneficiaryId: id, rank, amountMinor: amount });
  };
  if (p.ownerRank === "clerk") add(p.seniorId, "senior", cfg.network.overridePct.senior[p.stream]);
  if (p.ownerRank === "clerk" || p.ownerRank === "senior") add(p.leadId, "lead", cfg.network.overridePct.lead[p.stream]);
  return out;
}

// ------------------------------------------------------------------ automatic incentives
export type IncentiveKind = "acquisition" | "activation" | "retention6" | "retention12" | "loyalty";
export interface IncentiveCandidate { kind: IncentiveKind; minor: number; once: boolean }

/**
 * What one customer earns their owner for a closing month. Acquisition, activation and retention only apply to customers attributed on
 * or after `startMonth`, are paid once per customer, and never for refunded or self-owned customers. Loyalty pays every month the
 * customer is in a streak of `loyaltyMinStreak` or more.
 */
export function customerIncentives(
  c: { periods: readonly string[]; attributedAt: number; refunded?: boolean; selfOwned?: boolean }, month: string, inc: IncentiveConfig,
): IncentiveCandidate[] {
  if (c.refunded || c.selfOwned) return [];
  const streak = streakEndingAt(c.periods, month);
  if (streak === 0) return [];
  const out: IncentiveCandidate[] = [];
  if (c.attributedAt >= monthStartMs(inc.startMonth)) {
    if (inc.acquisitionMinor > 0) out.push({ kind: "acquisition", minor: inc.acquisitionMinor, once: true });
    if (streak >= 2 && inc.activationMinor > 0) out.push({ kind: "activation", minor: inc.activationMinor, once: true });
    if (streak >= 6 && inc.retention6Minor > 0) out.push({ kind: "retention6", minor: inc.retention6Minor, once: true });
    if (streak >= 12 && inc.retention12Minor > 0) out.push({ kind: "retention12", minor: inc.retention12Minor, once: true });
  }
  if (streak >= inc.loyaltyMinStreak && inc.loyaltyMonthlyMinor > 0) out.push({ kind: "loyalty", minor: inc.loyaltyMonthlyMinor, once: false });
  return out;
}

/** Highest tier whose minimum the count reaches (tiers are not cumulative). */
export function activeBookBonus(paidCustomers: number, tiers: readonly { min: number; minor: number }[]): number {
  let best = 0;
  for (const t of tiers) if (paidCustomers >= t.min && t.minor > best) best = t.minor;
  return best;
}

/** Quality: enough customer-confirmed support in the month and no refunded customers. */
export function qualityBonus(confirmedInMonth: number, refundedCustomers: number, inc: IncentiveConfig): number {
  return confirmedInMonth >= inc.qualityMinConfirmed && refundedCustomers === 0 ? inc.qualityMinor : 0;
}

// ------------------------------------------------------------------ the margin governor
export interface GovernorInput {
  baseMinor: number;            // the month's commissionable net across subscriptions, reports, rent and SMS margin
  recurringCostMinor: number;   // owner commissions + overrides already committed for the month (net of reversals)
  otherCostMinor: number;       // manual bonuses/support created in the month
  payoutCount: number;          // transfers the month-end run will make
  eventCount: number;           // payments (each may send an SMS notification)
  requestedMinor: number;       // incentives asked for
}
export interface GovernorResult {
  poolMinor: number; scaleBps: number; awardedMinor: number; costMinor: number; retainedPct: number; allowedMinor: number;
}
/**
 * Samuhia keeps at least `platformFloorPct` of the month's net after EVERY agent-network cost (commissions, overrides, bonuses, the
 * Paystack transfer fees of the payout run and the payment SMS). Incentives are the only flexible cost: they are paid from what is left
 * under that ceiling, scaled down pro-rata if the month asked for more. Scaling is the only lever, so the floor cannot be breached.
 */
export function governIncentives(g: GovernorInput, cfg: DeskConfig): GovernorResult {
  const ceilingPct = Math.max(0, 100 - cfg.network.platformFloorPct - cfg.network.governorSafetyPct);
  const allowedMinor = Math.floor((g.baseMinor * ceilingPct) / 100);
  const fixed = g.recurringCostMinor + g.otherCostMinor + g.payoutCount * cfg.network.transferFeeEstimateMinor + g.eventCount * cfg.incentives.smsReservePerEventMinor;
  const poolMinor = Math.max(0, allowedMinor - fixed);
  const scaleBps = g.requestedMinor <= 0 ? 10_000 : Math.min(10_000, Math.floor((poolMinor * 10_000) / g.requestedMinor));
  const awardedMinor = Math.floor((g.requestedMinor * scaleBps) / 10_000);
  const costMinor = fixed + awardedMinor;
  const retainedPct = g.baseMinor > 0 ? Math.round((1 - costMinor / g.baseMinor) * 10_000) / 100 : 100;
  return { poolMinor, scaleBps, awardedMinor, costMinor, retainedPct, allowedMinor };
}
export const scaleMinor = (minor: number, scaleBps: number): number => Math.floor((minor * scaleBps) / 10_000);

// ------------------------------------------------------------------ payment SMS
const kes = (minor: number): string => {
  const v = minor / 100;
  return `KES ${Number.isInteger(v) ? v.toLocaleString("en-KE") : v.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
/** One short SMS (plain GSM text, well under 160 characters) with an income snapshot attached. */
export function paymentSmsText(p: { kind: "commission" | "override"; earnedMinor: number; count: number; monthMinor: number; monthPayments: number }): string {
  const what = p.kind === "override" ? "team override" : "commission";
  const n = p.count > 1 ? ` from ${p.count} payments` : "";
  return `Samuhia Desk: +${kes(p.earnedMinor)} ${what}${n}. This month: ${kes(p.monthMinor)} from ${p.monthPayments} payment${p.monthPayments === 1 ? "" : "s"}. See Income for details.`;
}
