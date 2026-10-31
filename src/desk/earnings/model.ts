/**
 * Pure earnings maths shared by the Earnings screen and the Income tab. Units, because two systems meet here:
 *   desk_ledger rows ........ integer MINOR units (KES x 100)
 *   agents/{uid}/cyber-income  KES in MAJOR units (PAY writes it; document id = the payment reference)
 */
import type { GetEarningsOut, LedgerEntryView, LedgerKind, LedgerStatus } from "../api/contract.ts";
import { DESK_REF_PREFIX } from "../api/contract.ts";
import { formatKes } from "../api/format.ts";

/** A ledger row as stored: the shared view plus the Paystack reference that links it to a PAY income record. */
export interface LedgerRow extends LedgerEntryView { paystackRef?: string }
export interface CyberIncomeRow { reference: string; service: string; agentNetIncomeKes: number; paidAt: number }

export const LEDGER_WINDOW = 500;
export const CYBER_WINDOW = 500;
/** Accounts needed per milestone block. The contract does not carry the server's setting; the build plan fixes it at 10. */
export const MILESTONE_BLOCK_SIZE = 10;

export const kesToMinor = (kes: number): number => Math.round(kes * 100);

// ------------------------------------------------------------------ ranges
export type RangeKey = "today" | "7d" | "month" | "30d" | "90d" | "year";
export const RANGE_LABEL: Record<RangeKey, string> = {
  today: "Today", "7d": "Last 7 days", month: "This month", "30d": "Last 30 days", "90d": "Last 90 days", year: "Last 12 months",
};
const DAY = 86_400_000;
const DAYS: Record<"7d" | "30d" | "90d" | "year", number> = { "7d": 7, "30d": 30, "90d": 90, year: 365 };

/** `to` runs a day past now so entries that arrive while the screen is open still fall inside the range. Max span stays under the server's 13 months. */
export function rangeFor(key: RangeKey, now: number): { from: number; to: number } {
  const to = now + DAY;
  const d = new Date(now);
  if (key === "today") return { from: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(), to };
  if (key === "month") return { from: new Date(d.getFullYear(), d.getMonth(), 1).getTime(), to };
  return { from: now - DAYS[key] * DAY, to };
}
export const inRange = <T extends { createdAt: number }>(rows: readonly T[], from: number, to: number): T[] => rows.filter((r) => r.createdAt >= from && r.createdAt <= to);

// ------------------------------------------------------------------ status split
export interface StatusSplit { settledMinor: number; payableMinor: number; processingMinor: number; paidMinor: number }

/**
 * The server's payable figure includes money whose payout transfer is already created (processing). The ledger rows tell them
 * apart: processing comes from the rows, payable is what is left of the server's number. Totals stay the server's.
 */
export function splitStatuses(server: Pick<GetEarningsOut, "settledMinor" | "payableMinor" | "paidMinor">, rowsInRange: readonly LedgerRow[]): StatusSplit {
  const processing = rowsInRange.filter((r) => r.status === "processing").reduce((n, r) => n + r.amountMinor, 0);
  const processingMinor = Math.max(0, Math.min(processing, server.payableMinor));
  return { settledMinor: server.settledMinor, payableMinor: server.payableMinor - processingMinor, processingMinor, paidMinor: server.paidMinor };
}

export interface PayoutGroup { payableMinor: number; processingMinor: number; paidMinor: number }
export type PayoutKind = "bonus" | "support";
/** Bonuses and support payouts, which are the money the top desk pays out, by where each is in that process. Void rows count nowhere. */
export function payoutGroups(rows: readonly LedgerRow[]): Record<PayoutKind, PayoutGroup> {
  const out: Record<PayoutKind, PayoutGroup> = {
    bonus: { payableMinor: 0, processingMinor: 0, paidMinor: 0 },
    support: { payableMinor: 0, processingMinor: 0, paidMinor: 0 },
  };
  for (const r of rows) {
    if (r.kind !== "bonus" && r.kind !== "support") continue;
    const g = out[r.kind];
    if (r.status === "payable") g.payableMinor += r.amountMinor;
    else if (r.status === "processing") g.processingMinor += r.amountMinor;
    else if (r.status === "paid") g.paidMinor += r.amountMinor;
  }
  return out;
}

// ------------------------------------------------------------------ milestone
export interface MilestoneView {
  /** Qualifying accounts toward the NEXT block, 0–9. */
  toward: number; blockSize: number; qualifyingAccounts: number; blocksPaid: number;
  bankedMinor: number; capMinor: number; capReached: boolean; capFraction: number; towardFraction: number;
}
/** Blocks are earned at floor(accounts / 10) up to the lifetime cap, so progress to the next block is accounts mod 10. */
export function milestoneView(bp: GetEarningsOut["bonusProgress"]): MilestoneView {
  const capReached = bp.capMinor > 0 && bp.bankedMinor >= bp.capMinor;
  const toward = capReached ? 0 : Math.max(0, bp.qualifyingAccounts) % MILESTONE_BLOCK_SIZE;
  return {
    toward, blockSize: MILESTONE_BLOCK_SIZE, qualifyingAccounts: bp.qualifyingAccounts, blocksPaid: bp.blocksPaid,
    bankedMinor: bp.bankedMinor, capMinor: bp.capMinor, capReached,
    capFraction: bp.capMinor > 0 ? Math.min(1, Math.max(0, bp.bankedMinor / bp.capMinor)) : 0,
    towardFraction: toward / MILESTONE_BLOCK_SIZE,
  };
}

// ------------------------------------------------------------------ labels
export const KIND_LABEL: Record<LedgerKind, string> = {
  service: "Desk service", commission: "Commission", bonus: "Milestone bonus", support: "Support payout", reversal: "Reversal", network: "Network earnings",
};
export const STATUS_LABEL: Record<LedgerStatus, { text: string; tone: "green" | "amber" | "blue" | "gray" }> = {
  settled: { text: "Auto-settled", tone: "green" }, payable: { text: "Payable", tone: "amber" },
  processing: { text: "Processing", tone: "blue" }, paid: { text: "Paid", tone: "green" }, void: { text: "Void", tone: "gray" },
};
export const STREAM_LABEL: Record<string, string> = {
  service: "Desk services", chama: "MyChama", school: "MyRegister", pms: "Plot Yangu", bonus: "Milestone bonuses", support: "Support payouts", network: "Team & incentives",
};
export const streamLabel = (k: string): string => STREAM_LABEL[k] ?? k;
export const productLabel = (p: string | undefined): string => (p ? (STREAM_LABEL[p] ?? p) : "—");

// ------------------------------------------------------------------ reconciliation: desk payments in PAY's records vs the ledger
export interface PaymentDifference { reference: string; ledgerMinor: number; payMinor: number }
export interface Reconciliation {
  /** Desk payments seen on either side. */
  checked: number; agree: number;
  differ: PaymentDifference[];
  /** Paid and recorded by PAY, no desk_ledger row yet (it may still be settling). */
  notInLedger: string[];
  /** In desk_ledger, no PAY income record. */
  notInPay: string[];
  /** One side was cut off at its window, so older payments were not compared. */
  partial: boolean;
}

/**
 * Desk's payments carry the CYBER_DSK_ reference. Each should appear in PAY's cyber-income (KES) and as a settled `service` row
 * in desk_ledger (minor units), for the same amount. When either list was cut off at its window, only payments newer than the
 * older window's edge are compared, so a payment is never reported missing just because its other half is too old to be loaded.
 */
export function reconcileDeskPayments(
  cyber: readonly CyberIncomeRow[], ledger: readonly LedgerRow[], opts: { cyberTruncated: boolean; ledgerTruncated: boolean },
): Reconciliation {
  const oldest = (xs: number[]) => (xs.length ? Math.min(...xs) : 0);
  const since = Math.max(
    opts.cyberTruncated ? oldest(cyber.map((c) => c.paidAt)) : 0,
    opts.ledgerTruncated ? oldest(ledger.map((l) => l.createdAt)) : 0,
  );
  const pay = new Map<string, number>();
  for (const c of cyber) if (c.reference.startsWith(DESK_REF_PREFIX) && c.paidAt >= since) pay.set(c.reference, (pay.get(c.reference) ?? 0) + kesToMinor(c.agentNetIncomeKes));
  const led = new Map<string, number>();
  for (const l of ledger) {
    if (l.kind !== "service" || l.status === "void" || !l.paystackRef?.startsWith(DESK_REF_PREFIX) || l.createdAt < since) continue;
    led.set(l.paystackRef, (led.get(l.paystackRef) ?? 0) + l.amountMinor);
  }
  const differ: PaymentDifference[] = [];
  const notInLedger: string[] = [];
  const notInPay: string[] = [];
  let agree = 0;
  for (const [reference, payMinor] of pay) {
    const ledgerMinor = led.get(reference);
    if (ledgerMinor === undefined) notInLedger.push(reference);
    else if (ledgerMinor === payMinor) agree++;
    else differ.push({ reference, ledgerMinor, payMinor });
  }
  for (const reference of led.keys()) if (!pay.has(reference)) notInPay.push(reference);
  return { checked: new Set([...pay.keys(), ...led.keys()]).size, agree, differ, notInLedger, notInPay, partial: opts.cyberTruncated || opts.ledgerTruncated };
}

export const cyberIncomeTotalKes = (rows: readonly CyberIncomeRow[], from: number, to: number): number =>
  rows.filter((r) => r.paidAt >= from && r.paidAt <= to).reduce((n, r) => n + r.agentNetIncomeKes, 0);

/** The same words wherever the check is shown (desk Earnings screen and the Income tab). */
export function describeReconciliation(r: Reconciliation): { tone: "none" | "ok" | "warn" | "error"; lines: string[] } {
  if (r.checked === 0) return { tone: "none", lines: ["No desk payments to compare yet."] };
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
  if (r.differ.length === 0 && r.notInLedger.length === 0 && r.notInPay.length === 0) {
    return { tone: "ok", lines: [`All ${r.agree} desk ${plural(r.agree, "payment matches", "payments match")} your ledger${r.partial ? " (recent payments only)" : ""}.`] };
  }
  const lines = [`${r.agree} of ${r.checked} desk payments match your ledger.`];
  if (r.differ.length > 0) {
    lines.push(`${r.differ.length} differ in amount: ${r.differ.slice(0, 3).map((d) => `${d.reference} (ledger ${formatKes(d.ledgerMinor)}, payment ${formatKes(d.payMinor)})`).join("; ")}${r.differ.length > 3 ? "…" : ""}`);
  }
  if (r.notInLedger.length > 0) lines.push(`${r.notInLedger.length} ${plural(r.notInLedger.length, "payment is", "payments are")} not in your ledger yet; it can take a moment to settle.`);
  if (r.notInPay.length > 0) lines.push(`${r.notInPay.length} ${plural(r.notInPay.length, "ledger entry has", "ledger entries have")} no payment record yet.`);
  return { tone: r.differ.length > 0 ? "error" : "warn", lines };
}

// ------------------------------------------------------------------ CSV
const csvCell = (v: string | number): string => {
  const t = String(v);
  // a leading = + - @ can make a spreadsheet run the cell as a formula
  const safe = /^[=+\-@\t\r]/.test(t) && typeof v === "string" ? `'${t}` : t;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
export function deskLedgerCsv(rows: readonly LedgerRow[]): string {
  const head = ["Date", "Kind", "Product", "Amount (KES)", "Status", "Reference"].map(csvCell).join(",");
  const lines = rows.map((r) => [
    new Date(r.createdAt).toISOString(), KIND_LABEL[r.kind] ?? r.kind, productLabel(r.product), (r.amountMinor / 100).toFixed(2),
    STATUS_LABEL[r.status]?.text ?? r.status, r.paystackRef ?? "",
  ].map(csvCell).join(","));
  return [head, ...lines].join("\n");
}
