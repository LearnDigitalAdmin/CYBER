/**
 * Writes `deskOwner` onto a chama document in the Chama project (desk -> product is the only direction; Chama never reaches
 * desk). Chama builds its commission split from this field at charge time.
 */
import type { DeskConfig } from "../config.js";
import type { DeskOwnerInfo } from "../contract.js";
import { getAgentPayment, getCustomer } from "../kernel/agents.js";
import { DeskError } from "../errors.js";
import type { AgentDoc } from "../types.js";
import type { Deps } from "./deps.js";

/** Chama collection holding chama documents (functions/shared/constants.py: MC.CHAMAS). */
export const CHAMA_COLLECTION = "chamas";
/**
 * Field on a chama document that holds its public SMC-… code. The current Chama repo has no such field yet (the SMC code
 * scheme is delivered by Chama's own patch), so this is the single place to change if that patch names it differently.
 */
export const CHAMA_CODE_FIELD = "code";

export interface DeskOwnerResult { written: boolean; reason?: string }

export async function writeDeskOwner(deps: Deps, cfg: DeskConfig, agent: AgentDoc, chamaCode: string): Promise<DeskOwnerResult> {
  if (agent.status !== "active") return { written: false, reason: "This desk is not active" };

  // Defence in depth: only the recorded owner desk may be written onto a chama.
  const customer = await getCustomer(`chama:${chamaCode}`);
  if (!customer || customer.ownerAgentId !== agent.agentId) {
    return { written: false, reason: `${chamaCode} is not owned by this desk` };
  }

  let subaccountCode: string;
  try {
    subaccountCode = (await getAgentPayment(agent.agentId, "chama", cfg)).subaccountCode;
  } catch (err) {
    if (err instanceof DeskError) return { written: false, reason: err.message };
    throw err;
  }

  let chamaDb;
  try { chamaDb = deps.chamaDb(cfg); } catch (err) {
    if (err instanceof DeskError) return { written: false, reason: err.message };
    throw err;
  }
  const found = await chamaDb.collection(CHAMA_COLLECTION).where(CHAMA_CODE_FIELD, "==", chamaCode).limit(2).get();
  if (found.empty) return { written: false, reason: `Chama ${chamaCode} was not found in the MyChama project` };
  if (found.size > 1) return { written: false, reason: `More than one chama carries the code ${chamaCode}` };

  const owner: DeskOwnerInfo = { agentCode: agent.agentCode, subaccountCode, rank: agent.rank, updatedAt: deps.now() };
  await found.docs[0].ref.update({ deskOwner: owner });
  return { written: true };
}
