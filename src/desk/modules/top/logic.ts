/** Pure helpers for the top-desk console (no React, no network). */
import { summaryTopPayout } from "../../api/contract";
import type { AgentStatus, Rank, TopPayable, TopPayoutResult } from "../../api/contract";

export const DESK_LIST_LIMIT = 100;
export const SEARCH_DEBOUNCE_MS = 350;
export const OTP_RESEND_MS = 30_000;
export const POLL_MS = 8_000;
export const POLL_MAX_MS = 10 * 60_000;
export const REASON_MIN = 5;
export const REASON_MAX = 300;

export const ALL_STATUSES: readonly AgentStatus[] = ["applied", "training", "certified", "active", "suspended", "closed"];
/** Statuses the top desk may set (`applied` is only ever the starting state). */
export const SETTABLE_STATUSES: readonly AgentStatus[] = ["training", "certified", "active", "suspended", "closed"];
export const RANKS: readonly Rank[] = ["clerk", "senior", "lead"];

export const STATUS_LABEL: Record<AgentStatus, string> = {
  applied: "Applied", training: "Training", certified: "Certified", active: "Active", suspended: "Suspended", closed: "Closed",
};
export const STATUS_TONE: Record<AgentStatus, "gray" | "blue" | "amber" | "green" | "red"> = {
  applied: "gray", training: "blue", certified: "amber", active: "green", suspended: "red", closed: "gray",
};
export const RANK_LABEL: Record<Rank, string> = { clerk: "Clerk", senior: "Senior", lead: "Lead" };

export type ReasonCheck = { ok: true; value: string } | { ok: false; error: string };
export function validateReason(reason: string): ReasonCheck {
  const t = reason.trim().replace(/\s+/g, " ");
  if (t.length < REASON_MIN) return { ok: false, error: `Give a reason (at least ${REASON_MIN} characters).` };
  if (t.length > REASON_MAX) return { ok: false, error: `Keep the reason under ${REASON_MAX} characters.` };
  return { ok: true, value: t };
}

export const isOtpShape = (v: string): boolean => /^\d{6}$/.test(v.trim());

/** Server says the sign-in is too old for top-desk work (it asks the person to sign in again). */
export const isStaleSignIn = (code: string | undefined, message: string | undefined): boolean =>
  code === "functions/unauthenticated" || /sign in again/i.test(message ?? "");

/** The server says the code is spent or the attempts are used up: a NEW code is needed. */
export const needsNewCode = (message: string | undefined): boolean => /request a new|expired|used|too many/i.test(message ?? "");

// ---------------------------------------------------------------- payables
export interface Selection { ids: string[]; count: number; totalMinor: number; desks: number; summary: string }
export function summariseSelection(payables: TopPayable[], selected: ReadonlySet<string>): Selection {
  const rows = payables.filter((p) => selected.has(p.entryId));
  const totalMinor = rows.reduce((a, r) => a + r.amountMinor, 0);
  const desks = new Set(rows.map((r) => r.agentId)).size;
  return { ids: rows.map((r) => r.entryId), count: rows.length, totalMinor, desks, summary: rows.length ? summaryTopPayout(totalMinor, desks) : "" };
}

export interface CapState { remainingMinor: number; usedPct: number; selectedPct: number; over: boolean; overByMinor: number }
export function capState(dailyCapMinor: number, paidTodayMinor: number, selectedMinor: number): CapState {
  const cap = Math.max(0, dailyCapMinor);
  const remainingMinor = Math.max(0, cap - paidTodayMinor);
  const pct = (n: number) => (cap <= 0 ? 0 : Math.min(100, Math.round((n / cap) * 100)));
  const overByMinor = Math.max(0, paidTodayMinor + selectedMinor - cap);
  return {
    remainingMinor, usedPct: pct(paidTodayMinor), selectedPct: pct(Math.min(selectedMinor, remainingMinor)),
    over: overByMinor > 0, overByMinor,
  };
}

/** Oldest first, take every row that still fits the remaining daily allowance. */
export function selectWithinCap(payables: TopPayable[], remainingMinor: number): Set<string> {
  const out = new Set<string>();
  let left = remainingMinor;
  for (const p of [...payables].sort((a, b) => a.createdAt - b.createdAt)) {
    if (p.amountMinor <= left) { out.add(p.entryId); left -= p.amountMinor; }
  }
  return out;
}

// ---------------------------------------------------------------- payout tracking
export interface TrackedPayout {
  entryId: string; agentId: string; deskCode: string; name: string; amountMinor: number;
  status: "processing" | "paid" | "failed"; reference: string; error?: string;
}

export function trackFromResults(rows: TopPayable[], results: TopPayoutResult[]): TrackedPayout[] {
  const byId = new Map(rows.map((r) => [r.entryId, r]));
  const out: TrackedPayout[] = [];
  for (const r of results) {
    const p = byId.get(r.entryId);
    if (!p) continue;
    out.push({ entryId: r.entryId, agentId: p.agentId, deskCode: p.deskCode, name: p.name, amountMinor: p.amountMinor, status: r.status, reference: r.reference, ...(r.error ? { error: r.error } : {}) });
  }
  return out;
}

/**
 * Settle `processing` rows from what the console can observe:
 *  - a row that is `payable` again was reversed: the transfer did not go through -> failed;
 *  - otherwise a desk's lifetime `paidMinor` rising above its pre-payout baseline (minus what the payout call itself already
 *    reported as paid) means Paystack confirmed transfers: that amount is allocated to the desk's processing rows in order.
 */
export function settleTracking(
  rows: TrackedPayout[], baselinePaid: Record<string, number>, currentPaid: Record<string, number>, payableNow: ReadonlySet<string>,
): TrackedPayout[] {
  const confirmedLeft: Record<string, number> = {};
  for (const code of new Set(rows.map((r) => r.deskCode))) {
    const base = baselinePaid[code]; const cur = currentPaid[code];
    if (base === undefined || cur === undefined) { confirmedLeft[code] = 0; continue; }
    const alreadyReported = rows.filter((r) => r.deskCode === code && r.status === "paid").reduce((a, r) => a + r.amountMinor, 0);
    confirmedLeft[code] = Math.max(0, cur - base - alreadyReported);
  }
  return rows.map((r) => {
    if (r.status !== "processing") return r;
    if (payableNow.has(r.entryId)) return { ...r, status: "failed" as const, error: "The transfer did not complete and the amount is payable again." };
    if (confirmedLeft[r.deskCode] >= r.amountMinor) {
      confirmedLeft[r.deskCode] -= r.amountMinor;
      return { ...r, status: "paid" as const };
    }
    return r;
  });
}

export const stillProcessing = (rows: TrackedPayout[]): boolean => rows.some((r) => r.status === "processing");

export const maskPhone = (p: string): string => (p.length > 6 ? `${p.slice(0, 4)}•••${p.slice(-3)}` : p);

export const DOC_NAMES: Record<string, string> = { id_front: "ID — front", id_back: "ID — back", selfie: "Selfie" };
