/** Pure payout logic: Nairobi calendar, daily-cap arithmetic, transfer references, recipient number, support-pay arithmetic. */
import type { DeskConfig } from "../config.js";
import { DeskError } from "../errors.js";
import { normalizeKenyaPhone } from "../paystack/phone.js";

export const NAIROBI_OFFSET_MS = 3 * 60 * 60_000; // Africa/Nairobi is UTC+3 all year (no DST)
export const MAX_PAYOUT_ENTRIES = 50;
export const RECONCILE_MIN_AGE_MS = 60_000;
/** A row stuck in `processing` this long with no transfer at Paystack was never sent (the process died before the call). */
export const ORPHAN_AFTER_MS = 5 * 60_000;
export const RECONCILE_BATCH = 100;

const pad = (n: number): string => String(n).padStart(2, "0");

/** "YYYY-MM-DD" of the Nairobi calendar day containing `ms`. */
export function nairobiDayKey(ms: number): string {
  const d = new Date(ms + NAIROBI_OFFSET_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Previous calendar month in Nairobi: its "YYYY-MM" label and [start, end) in epoch ms. */
export function previousNairobiMonth(ms: number): { month: string; startMs: number; endMs: number } {
  const local = new Date(ms + NAIROBI_OFFSET_MS);
  const y = local.getUTCFullYear(); const m = local.getUTCMonth();
  const py = m === 0 ? y - 1 : y; const pm = m === 0 ? 11 : m - 1;
  return { month: `${py}-${pad(pm + 1)}`, startMs: Date.UTC(py, pm, 1) - NAIROBI_OFFSET_MS, endMs: Date.UTC(y, m, 1) - NAIROBI_OFFSET_MS };
}

// ------------------------------------------------------------------ daily cap
export const remainingCap = (capMinor: number, sentTodayMinor: number): number => Math.max(0, capMinor - sentTodayMinor);
export const fitsCap = (capMinor: number, sentTodayMinor: number, addMinor: number): boolean =>
  Number.isSafeInteger(addMinor) && addMinor >= 0 && sentTodayMinor + addMinor <= capMinor;

// ------------------------------------------------------------------ references
/**
 * Paystack allows 16–50 chars of a-z 0-9 _ -. The first attempt is exactly `payout_<entryId>` (idempotent: a retry can never pay
 * twice). A new suffix is used only after Paystack has CONCLUSIVELY failed or reversed an earlier transfer for that entry.
 */
export function payoutReference(entryId: string, attempt: number): string {
  if (!/^[0-9a-f]{28}$/.test(entryId)) throw new DeskError("internal", "Unexpected ledger entry id");
  const ref = attempt <= 0 ? `payout_${entryId}` : `payout_${entryId}_${attempt}`;
  return ref;
}

export type TransferOutcome = "paid" | "failed" | "otp" | "pending";
/** Paystack transfer statuses: success | failed | reversed | otp | pending (anything else is treated as still in flight). */
export function classifyTransferStatus(status: string): TransferOutcome {
  const s = status.toLowerCase();
  if (s === "success") return "paid";
  if (s === "failed" || s === "reversed") return "failed";
  if (s === "otp") return "otp";
  return "pending";
}

// ------------------------------------------------------------------ recipient
const MPESA_BANK = /^(m-?pesa|mpesa)$/i;
/** The desk's M-Pesa number: the payout account's number when that account is M-Pesa, otherwise the desk's own phone. Local 07… form. */
export function payoutMsisdn(
  agentPhone: string, info: { settlementBank?: string; accountNumber?: string } | undefined,
): { e164: string; local: string } {
  const useAccount = Boolean(info?.settlementBank && MPESA_BANK.test(info.settlementBank.trim()) && info.accountNumber);
  const e164 = normalizeKenyaPhone(useAccount ? (info?.accountNumber as string) : agentPhone);
  return { e164, local: `0${e164.slice(4)}` };
}

// ------------------------------------------------------------------ support pay
/** Confirmed items capped per Nairobi day, then count x rate capped per month. A rate or cap of 0 pays nothing. */
export function supportAmount(confirmedAtMs: readonly number[], support: DeskConfig["support"]): { counted: number; amountMinor: number } {
  if (support.rateMinorPerConfirmed <= 0 || support.monthlyCapMinor <= 0 || support.maxConfirmedPerDay <= 0) return { counted: 0, amountMinor: 0 };
  const perDay = new Map<string, number>();
  for (const at of confirmedAtMs) {
    const k = nairobiDayKey(at);
    perDay.set(k, Math.min((perDay.get(k) ?? 0) + 1, support.maxConfirmedPerDay));
  }
  let counted = 0;
  for (const n of perDay.values()) counted += n;
  return { counted, amountMinor: Math.min(counted * support.rateMinorPerConfirmed, support.monthlyCapMinor) };
}
