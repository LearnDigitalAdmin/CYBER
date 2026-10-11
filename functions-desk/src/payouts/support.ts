import * as logger from "firebase-functions/logger";
import type { DeskConfig } from "../config.js";
import { col, db } from "../db.js";
import { audit } from "../kernel/audit.js";
import { appendLedger } from "../kernel/ledger.js";
import type { AgentDoc, SupportDoc } from "../types.js";
import { previousNairobiMonth, supportAmount } from "./pure.js";

export interface SupportPayablesSummary { month: string; agents: number; created: number; skipped: number; errors: number }
const PAGE = 200;

/**
 * 1st of the month: one `support` payable row per desk for the PREVIOUS Nairobi month, from customer-confirmed support items
 * (at most support.maxConfirmedPerDay per day), amount min(count x rate, monthly cap). A rate or cap of 0 creates nothing.
 * Idempotent: the ledger id is derived from (support, agent, month). Never moves money: the top desk pays it with an OTP.
 */
export async function prepareSupportPayables(deps: { now(): number; getConfig(): Promise<DeskConfig> }): Promise<SupportPayablesSummary> {
  const cfg = await deps.getConfig();
  const { month, startMs, endMs } = previousNairobiMonth(deps.now());
  const s: SupportPayablesSummary = { month, agents: 0, created: 0, skipped: 0, errors: 0 };
  if (cfg.support.rateMinorPerConfirmed <= 0 || cfg.support.monthlyCapMinor <= 0) { logger.info("desk_prepareSupportPayables: rate or cap is 0, nothing to do", { month }); return s; }

  let last: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  for (;;) {
    let q = col("agents").where("status", "==", "active").orderBy("__name__").limit(PAGE);
    if (last) q = q.startAfter(last);
    const page = await q.get();
    if (page.empty) break;
    for (const doc of page.docs) {
      const agent = doc.data() as AgentDoc;
      s.agents++;
      try {
        const items = await col("support").where("agentId", "==", agent.agentId)
          .where("customerConfirmedAt", ">=", startMs).where("customerConfirmedAt", "<", endMs).get();
        const confirmed = items.docs.map((d) => (d.data() as SupportDoc).customerConfirmedAt as number);
        const { counted, amountMinor } = supportAmount(confirmed, cfg.support);
        if (amountMinor <= 0) { s.skipped++; continue; }
        const res = await appendLedger({
          agentId: agent.agentId, kind: "support", amountMinor, status: "payable", sourceId: month,
          note: `Support quality bonus ${month}`, idempotencyParts: ["support", agent.agentId, month],
        });
        for (let i = 0; i < items.docs.length; i += 400) {
          const batch = db().batch();
          for (const d of items.docs.slice(i, i + 400)) batch.update(d.ref, { paidMonth: month });
          await batch.commit();
        }
        if (res.created) {
          s.created++;
          await audit({ action: "support_payable_prepared", agentId: agent.agentId, meta: { entryId: res.entryId, month, confirmed: confirmed.length, counted, amountMinor, deskCode: agent.agentCode } });
        } else s.skipped++;
      } catch (err) {
        s.errors++;
        logger.error("desk_prepareSupportPayables: agent failed", { agentId: agent.agentId, err });
      }
    }
    last = page.docs[page.docs.length - 1];
    if (page.size < PAGE) break;
  }
  logger.info("desk_prepareSupportPayables", s);
  return s;
}
