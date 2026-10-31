/** Keeps the network's counters and denormalised chains truthful when an agent's desk closes, is re-ranked or is re-assigned. */
import { FieldValue } from "firebase-admin/firestore";
import { col, db } from "../db.js";
import type { Rank } from "../contract.js";
import type { AgentDoc } from "../types.js";
import { slotOf, slotRef } from "./hierarchy.js";
import { chainFromUpline, type Chain } from "./pure.js";

const CHAIN_FIELDS = ["uplineId", "seniorId", "leadId", "adminId"] as const;
const chainPatch = (c: Chain): Record<string, unknown> =>
  Object.fromEntries(CHAIN_FIELDS.map((k) => [k, c[k] ?? FieldValue.delete()]));

/** Idempotent. After a desk closes: free its ward/constituency slot and take it off its upline's downline count. */
export async function releaseAgentSlot(agentId: string, now: number): Promise<void> {
  await db().runTransaction(async (tx) => {
    const ref = col("agents").doc(agentId);
    const a = (await tx.get(ref)).data() as AgentDoc | undefined;
    if (!a || a.status !== "closed" || a.slotReleased) return;
    const slot = slotOf(a);
    const sref = slot ? slotRef(slot.role, slot.scopeId) : undefined;
    const sdoc = sref ? await tx.get(sref) : undefined;
    const up = a.uplineId ? await tx.get(col("agents").doc(a.uplineId)) : undefined;
    if (sref && sdoc) tx.set(sref, { used: Math.max(0, ((sdoc.data()?.used as number | undefined) ?? 0) - 1), updatedAt: now }, { merge: true });
    if (up?.exists) tx.update(up.ref, { downlineCount: Math.max(0, ((up.data() as AgentDoc).downlineCount ?? 0) - 1) });
    tx.update(ref, { slotReleased: true });
  });
}

/** Top-desk rank change: moves slot usage between ranks and drops chain links that no longer make sense (a senior has no senior). */
export async function afterRankChange(agentId: string, from: Rank, to: Rank, now: number): Promise<void> {
  await db().runTransaction(async (tx) => {
    const ref = col("agents").doc(agentId);
    const a = (await tx.get(ref)).data() as AgentDoc | undefined;
    if (!a) return;
    const was = slotOf({ ...a, rank: from }), will = slotOf({ ...a, rank: to });
    const reads = await Promise.all([was, will].map((s) => (s ? tx.get(slotRef(s.role, s.scopeId)) : undefined)));
    const patch: Record<string, unknown> = {};
    if (to !== "clerk") patch.seniorId = FieldValue.delete();
    if (to === "lead" || to === "admin") patch.leadId = FieldValue.delete();
    if (to === "admin") patch.adminId = FieldValue.delete();
    patch.uplineId = to === "senior" ? (a.leadId ?? FieldValue.delete()) : to === "lead" ? (a.adminId ?? FieldValue.delete()) : to === "admin" ? FieldValue.delete() : a.uplineId ?? FieldValue.delete();
    // slot counters (a top-desk change may exceed a cap on purpose; it is audited)
    if (was && reads[0]) tx.set(slotRef(was.role, was.scopeId), { used: Math.max(0, ((reads[0].data()?.used as number | undefined) ?? 0) - 1), updatedAt: now }, { merge: true });
    if (will && reads[1]) tx.set(slotRef(will.role, will.scopeId), { used: ((reads[1].data()?.used as number | undefined) ?? 0) + 1, updatedAt: now }, { merge: true });
    tx.update(ref, patch);
  });
}

/** After an agent's chain changes, everyone beneath them inherits the new senior / lead / admin links. Batched; idempotent. */
export async function cascadeChain(agent: Pick<AgentDoc, "agentId" | "rank" | "leadId" | "adminId">): Promise<number> {
  if (agent.rank === "clerk" || agent.rank === "internal") return 0;
  const field = agent.rank === "senior" ? "seniorId" : agent.rank === "lead" ? "leadId" : "adminId";
  const snap = await col("agents").where(field, "==", agent.agentId).get();
  let n = 0;
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = db().batch();
    for (const d of snap.docs.slice(i, i + 400)) {
      const m = d.data() as AgentDoc;
      const patch: Record<string, unknown> = {};
      if (agent.rank === "senior") { patch.leadId = agent.leadId ?? FieldValue.delete(); patch.adminId = agent.adminId ?? FieldValue.delete(); }
      else if (agent.rank === "lead") { patch.adminId = agent.adminId ?? FieldValue.delete(); }
      if (Object.keys(patch).length) { batch.update(d.ref, patch); n++; }
      void m;
    }
    await batch.commit();
  }
  return n;
}
export { chainPatch, chainFromUpline };
