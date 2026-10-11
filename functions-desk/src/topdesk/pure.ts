/** Pure top-desk logic: OTP summary round-trips, input narrowing and search. */
import {
  DESK_TOP_CODE, summaryTopPayout, summaryTopRank, summaryTopStatus,
  type AgentStatus, type DeskSummaryRow, type Rank, type TopAction,
} from "../contract.js";
import { DeskError } from "../errors.js";
import type { AgentDoc } from "../types.js";

export const TOP_ACTIONS: readonly TopAction[] = ["set_desk_status", "set_rank", "payout"];
export const SETTABLE_STATUSES: readonly AgentStatus[] = ["active", "suspended", "closed"];
export const RANKS: readonly Rank[] = ["clerk", "senior", "lead"];
export const TOP_OTP_TTL_MS = 5 * 60_000;
export const TOP_OTP_REQUESTS_PER_HOUR = 10;
export const DESK_CODE_RE = /^COG-\d{4,}$/;
export const LIST_DESKS_MAX = 100;

export const isTopAction = (v: unknown): v is TopAction => typeof v === "string" && (TOP_ACTIONS as readonly string[]).includes(v);

/** "1234.50" -> 123450. Exact (no floats). */
export function kesTextToMinor(s: string): number {
  const [whole, frac] = s.split(".");
  return Number(whole) * 100 + Number(frac);
}

/**
 * The summary is the sentence texted to the top desk's phone, so it must be exactly what the contract builders produce.
 * Parse the variable parts, rebuild, compare; anything that does not round-trip is refused.
 */
export function checkTopSummary(action: TopAction, summary: unknown): { ok: true } | { ok: false; message: string } {
  const bad = { ok: false as const, message: "The confirmation text does not match the action" };
  if (typeof summary !== "string") return bad;
  if (action === "set_desk_status") {
    const m = /^Set desk (COG-\d{4,}) to (\S+)$/.exec(summary);
    return m && m[1] !== DESK_TOP_CODE && (SETTABLE_STATUSES as readonly string[]).includes(m[2]) && summary === summaryTopStatus(m[1], m[2]) ? { ok: true } : bad;
  }
  if (action === "set_rank") {
    const m = /^Set desk (COG-\d{4,}) rank to (\S+)$/.exec(summary);
    return m && m[1] !== DESK_TOP_CODE && (RANKS as readonly string[]).includes(m[2]) && summary === summaryTopRank(m[1], m[2]) ? { ok: true } : bad;
  }
  const m = /^Pay KES (\d{1,9}\.\d{2}) to (\d{1,4}) desks$/.exec(summary);
  if (!m) return bad;
  const total = kesTextToMinor(m[1]); const desks = Number(m[2]);
  return total > 0 && desks >= 1 && summary === summaryTopPayout(total, desks) ? { ok: true } : bad;
}

export function deskCodeInput(v: unknown): string {
  const code = typeof v === "string" ? v.trim().toUpperCase() : "";
  if (!DESK_CODE_RE.test(code)) throw new DeskError("invalid_argument", "Enter a desk code like COG-0001");
  return code;
}
export function statusInput(v: unknown): AgentStatus {
  if (typeof v !== "string" || !(SETTABLE_STATUSES as readonly string[]).includes(v)) throw new DeskError("invalid_argument", "Choose active, suspended or closed");
  return v as AgentStatus;
}
export function rankInput(v: unknown): Rank {
  if (typeof v !== "string" || !(RANKS as readonly string[]).includes(v)) throw new DeskError("invalid_argument", "Choose clerk, senior or lead");
  return v as Rank;
}
export function reasonInput(v: unknown): string {
  const r = typeof v === "string" ? v.trim() : "";
  if (r.length < 5 || r.length > 300) throw new DeskError("invalid_argument", "Give a reason of 5–300 characters");
  return r;
}

export type StatusMove = { ok: true } | { ok: false; message: string };
/** closed is final; active needs a not-yet-active, not-closed desk; suspended only from active. */
export function checkStatusMove(from: AgentStatus, to: AgentStatus): StatusMove {
  if (from === "closed") return { ok: false, message: "This desk is closed. Closing is final." };
  if (from === to) return { ok: false, message: `This desk is already ${to}` };
  if (to === "suspended" && from !== "active") return { ok: false, message: "Only an active desk can be suspended" };
  if (to === "active" && from === "suspended") return { ok: true };
  if (to === "active" && ["applied", "training", "certified"].includes(from)) return { ok: true };
  if (to === "closed") return { ok: true };
  return to === "suspended" ? { ok: true } : { ok: false, message: `A ${from} desk cannot be set to ${to}` };
}

export function summaryRow(a: AgentDoc, docsUploaded: number): DeskSummaryRow {
  return {
    deskCode: a.agentCode, agentId: a.agentId, name: a.name, phone: a.phone, email: a.email, status: a.status, rank: a.rank,
    wardId: a.wardId, createdAt: a.createdAt, docsUploaded,
  };
}

/** Case-insensitive match on code, name, phone or email (phone compared on digits only). */
export function matchesSearch(a: Pick<AgentDoc, "agentCode" | "name" | "phone" | "email">, term: string): boolean {
  const t = term.trim().toLowerCase();
  if (!t) return true;
  // Phones are stored as +254…; a search typed in local 07… form must still match, so the leading 0 is dropped.
  const raw = t.replace(/\D/g, "");
  const digits = raw.startsWith("0") ? raw.slice(1) : raw;
  return a.agentCode.toLowerCase().includes(t) || a.name.toLowerCase().includes(t) || a.email.toLowerCase().includes(t)
    || (digits.length >= 3 && a.phone.replace(/\D/g, "").includes(digits));
}

export function topOtpSmsText(summary: string, otp: string): string {
  return `Samuhia Desk top desk: ${summary}. Code ${otp}, valid 5 min. Share it with no one.`;
}
