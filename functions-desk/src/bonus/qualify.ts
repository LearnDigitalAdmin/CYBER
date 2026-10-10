/** Milestone qualification. Pure helpers plus the one query that counts an agent's qualifying accounts. */
import type { DeskConfig } from "../config.js";
import { col } from "../db.js";
import type { LedgerDoc, CustomerDoc } from "../types.js";

const PERIOD = /^(\d{4})-(0[1-9]|1[0-2])$/;
export const isPeriod = (p: unknown): p is string => typeof p === "string" && PERIOD.test(p);
/** "2026-03" -> a month index (year * 12 + month) so consecutive months differ by exactly 1. */
const monthIndex = (p: string): number => { const m = PERIOD.exec(p)!; return Number(m[1]) * 12 + Number(m[2]) - 1; };

/** Longest run of consecutive calendar months in a list of "YYYY-MM" periods (duplicates and bad values ignored). */
export function longestConsecutiveRun(periods: readonly unknown[]): number {
  const idx = [...new Set(periods.filter(isPeriod).map(monthIndex))].sort((a, b) => a - b);
  let best = 0, run = 0;
  for (let i = 0; i < idx.length; i++) {
    run = i > 0 && idx[i] === idx[i - 1] + 1 ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

/** Owned by the agent (caller's query), chama or pms, not self-owned, not refunded, >= minPaidMonths consecutive paid months. */
export function customerQualifies(c: Partial<CustomerDoc>, cfg: DeskConfig): boolean {
  if (c.product !== "chama" && c.product !== "pms") return false;
  if (c.selfOwned === true || c.refunded === true) return false;
  return longestConsecutiveRun(c.paidPeriods ?? []) >= cfg.milestone.minPaidMonths;
}

export async function countQualifyingAccounts(agentId: string, cfg: DeskConfig): Promise<number> {
  const snap = await col("customers").where("ownerAgentId", "==", agentId).where("product", "in", ["chama", "pms"]).get();
  return snap.docs.reduce((n, d) => n + (customerQualifies(d.data() as CustomerDoc, cfg) ? 1 : 0), 0);
}

const BLOCK_SOURCE = /^bonus-block-(\d+)$/;
const BLOCK_NOTE = /^Milestone block (\d+)$/;
export const blockSourceId = (n: number): string => `bonus-block-${n}`;
export const blockNote = (n: number): string => `Milestone block ${n}`;
export function blockNumberOf(row: Pick<LedgerDoc, "sourceId" | "note">): number | undefined {
  const m = BLOCK_SOURCE.exec(row.sourceId ?? "") ?? BLOCK_NOTE.exec(row.note ?? "");
  return m ? Number(m[1]) : undefined;
}

export interface BonusHistory { nonVoidBlocks: number; bankedMinor: number; highestBlockNumber: number }
/** From an agent's bonus ledger rows. Void rows free their slot against the lifetime cap but never reuse their block number. */
export function summariseBonusRows(rows: readonly Pick<LedgerDoc, "status" | "amountMinor" | "sourceId" | "note">[]): BonusHistory {
  let nonVoidBlocks = 0, bankedMinor = 0, highestBlockNumber = 0;
  rows.forEach((r, i) => {
    const n = blockNumberOf(r) ?? i + 1;
    if (n > highestBlockNumber) highestBlockNumber = n;
    if (r.status !== "void") { nonVoidBlocks++; bankedMinor += r.amountMinor; }
  });
  return { nonVoidBlocks, bankedMinor, highestBlockNumber };
}

export async function loadBonusHistory(agentId: string): Promise<BonusHistory> {
  const snap = await col("ledger").where("agentId", "==", agentId).where("kind", "==", "bonus").get();
  return summariseBonusRows(snap.docs.map((d) => d.data() as LedgerDoc));
}
