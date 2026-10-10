import * as logger from "firebase-functions/logger";
import { getConfig, col } from "../db.js";
import type { DeskConfig } from "../config.js";
import { audit } from "../kernel/audit.js";
import { appendLedger } from "../kernel/ledger.js";
import { milestoneNewBlocks } from "../money.js";
import type { AgentDoc } from "../types.js";
import { blockNote, blockSourceId, countQualifyingAccounts, loadBonusHistory } from "./qualify.js";

export interface MilestoneSummary { agents: number; bonusesCreated: number; errors: number }

/** One agent: qualifying accounts vs bonus blocks already awarded -> one payable bonus row per new block. */
export async function evaluateAgent(agent: Pick<AgentDoc, "agentId" | "agentCode">, cfg: DeskConfig): Promise<number> {
  const qualifying = await countQualifyingAccounts(agent.agentId, cfg);
  const history = await loadBonusHistory(agent.agentId);
  const { newBlocks } = milestoneNewBlocks(qualifying, history.nonVoidBlocks, cfg);
  let created = 0;
  for (let i = 1; i <= newBlocks; i++) {
    const blockNumber = history.highestBlockNumber + i;
    const res = await appendLedger({
      agentId: agent.agentId, kind: "bonus", amountMinor: cfg.milestone.bonusMinor, status: "payable",
      sourceId: blockSourceId(blockNumber), note: blockNote(blockNumber),
      idempotencyParts: ["bonus", agent.agentId, String(blockNumber)],
    });
    if (res.created) {
      created++;
      await audit({
        action: "bonus_awarded", agentId: agent.agentId,
        meta: { entryId: res.entryId, blockNumber, amountMinor: cfg.milestone.bonusMinor, qualifyingAccounts: qualifying, agentCode: agent.agentCode },
      });
    }
  }
  return created;
}

const PAGE = 200;
/** Every active desk agent, in pages. A failure on one agent never stops the others. */
export async function evaluateMilestones(): Promise<MilestoneSummary> {
  const cfg = await getConfig();
  const s: MilestoneSummary = { agents: 0, bonusesCreated: 0, errors: 0 };
  let last: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  for (;;) {
    let q = col("agents").where("status", "==", "active").orderBy("__name__").limit(PAGE);
    if (last) q = q.startAfter(last);
    const page = await q.get();
    if (page.empty) break;
    for (const doc of page.docs) {
      s.agents++;
      try { s.bonusesCreated += await evaluateAgent(doc.data() as AgentDoc, cfg); }
      catch (err) { s.errors++; logger.error("milestones: agent failed", { agentId: doc.id, err }); }
    }
    last = page.docs[page.docs.length - 1];
    if (page.size < PAGE) break;
  }
  logger.info("desk_evaluateMilestones", s);
  return s;
}
