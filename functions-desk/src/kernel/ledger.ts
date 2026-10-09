import { createHash } from "node:crypto";
import { col } from "../db.js";
import type { LedgerDoc } from "../types.js";

/** Deterministic id: the same business fact can never produce two ledger rows (webhook retries, replays). */
export function ledgerEntryId(parts: readonly string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 28);
}

export type NewLedgerEntry = Omit<LedgerDoc, "entryId" | "createdAt"> & { idempotencyParts: readonly string[] };

/** Create-only. Returns created=false when the fact was already recorded. */
export async function appendLedger(e: NewLedgerEntry): Promise<{ entryId: string; created: boolean }> {
  const { idempotencyParts, ...rest } = e;
  const entryId = ledgerEntryId(idempotencyParts);
  const doc: LedgerDoc = { ...rest, entryId, createdAt: Date.now() };
  for (const k of Object.keys(doc) as (keyof LedgerDoc)[]) if (doc[k] === undefined) delete doc[k];
  try {
    await col("ledger").doc(entryId).create(doc);
    return { entryId, created: true };
  } catch (err) {
    if ((err as { code?: number }).code === 6) return { entryId, created: false }; // ALREADY_EXISTS
    throw err;
  }
}
