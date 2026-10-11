import * as logger from "firebase-functions/logger";
import { col } from "../db.js";
import { audit } from "../kernel/audit.js";
import { applyTransferLookup, returnToPayable, type PayoutDeps, type PayoutRow } from "./payout.js";
import { ORPHAN_AFTER_MS, RECONCILE_BATCH, RECONCILE_MIN_AGE_MS } from "./pure.js";

export interface ReconcileSummary { checked: number; paid: number; returned: number; waiting: number; errors: number }

/**
 * Every 10 minutes: asks Paystack (verify by reference) about `processing` payouts older than a minute.
 * success -> paid; failed/reversed -> payable again with the reason; unknown -> left alone; a row that Paystack has never heard of
 * after ORPHAN_AFTER_MS was never sent (the process died before the call) -> payable again with nothing reserved.
 */
export async function reconcilePayouts(deps: PayoutDeps): Promise<ReconcileSummary> {
  const s: ReconcileSummary = { checked: 0, paid: 0, returned: 0, waiting: 0, errors: 0 };
  const snap = await col("ledger").where("status", "==", "processing").orderBy("createdAt", "asc").limit(RECONCILE_BATCH).get();
  for (const doc of snap.docs) {
    const row = doc.data() as PayoutRow;
    const age = deps.now() - (row.processingAt ?? row.createdAt);
    if (age < RECONCILE_MIN_AGE_MS) continue;
    s.checked++;
    try {
      const lookup = row.transferRef ? await deps.transfers.verify(row.transferRef) : { found: false as const };
      let outcome: string;
      if (!lookup.found) {
        if (age < ORPHAN_AFTER_MS) { s.waiting++; continue; }
        const back = await returnToPayable(deps, row.entryId, "Paystack has no record of this transfer, so nothing was sent. The entry is payable again.", false);
        if (!back) continue;
        s.returned++; outcome = "never_sent";
      } else {
        const res = await applyTransferLookup(deps, row.entryId, lookup);
        if (res.status === "paid") { s.paid++; outcome = "paid"; }
        else if (res.status === "failed") { s.returned++; outcome = "failed"; }
        else { s.waiting++; continue; }
      }
      await audit({ action: "payout_reconciled", agentId: row.agentId, meta: { entryId: row.entryId, outcome, reference: row.transferRef ?? null } });
    } catch (err) {
      s.errors++;
      logger.error("desk_reconcilePayouts: row failed", { entryId: row.entryId, err });
    }
  }
  logger.info("desk_reconcilePayouts", s);
  return s;
}
