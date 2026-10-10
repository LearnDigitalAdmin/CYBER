/**
 * The kernel's appendLedger() writes with its own standalone create(), so it cannot join a transaction. Settling a ticket
 * must set the ticket paid AND write its ledger row atomically, so this builds the identical document (same deterministic
 * id from ledgerEntryId, same undefined-stripping) for use inside a transaction.
 */
import { col } from "../db.js";
import { ledgerEntryId, type NewLedgerEntry } from "../kernel/ledger.js";
import type { LedgerDoc } from "../types.js";

export function buildLedgerDoc(e: NewLedgerEntry, now: number): LedgerDoc {
  const { idempotencyParts, ...rest } = e;
  const doc: LedgerDoc = { ...rest, entryId: ledgerEntryId(idempotencyParts), createdAt: now };
  for (const k of Object.keys(doc) as (keyof LedgerDoc)[]) if (doc[k] === undefined) delete doc[k];
  return doc;
}
export const ledgerRef = (entryId: string) => col("ledger").doc(entryId);
