/** Firestore-facing hierarchy helpers: who is in a ward / constituency / county, and the transactional slot counters behind the caps. */
import { FieldValue, type Transaction } from "firebase-admin/firestore";
import type { DeskConfig } from "../config.js";
import type { Rank } from "../contract.js";
import { col } from "../db.js";
import { DeskError } from "../errors.js";
import type { AgentDoc } from "../types.js";
import { eligibleRoles, type Geo, type HierarchyContext } from "./pure.js";

export type SlotRole = "senior" | "lead";
/** Capacity scope: seniors are capped per ward, leads per constituency. */
export const slotScopeId = (role: SlotRole, geo: Pick<Geo, "wardId" | "constituencyId">): string => (role === "senior" ? geo.wardId : geo.constituencyId);
export const slotRef = (role: SlotRole, scopeId: string) => col("counters").doc(`cap_${role}_${scopeId.replace(/\//g, "~").slice(0, 120)}`);
export const slotMax = (role: SlotRole, cfg: Pick<DeskConfig, "network">): number => (role === "senior" ? cfg.network.seniorsPerWard : cfg.network.leadsPerConstituency);

/** Read half of a claim. Call before any write in the transaction. */
export async function readSlot(tx: Transaction, role: SlotRole, scopeId: string, cfg: Pick<DeskConfig, "network">): Promise<{ used: number; ref: FirebaseFirestore.DocumentReference }> {
  const ref = slotRef(role, scopeId);
  const snap = await tx.get(ref);
  const used = (snap.data()?.used as number | undefined) ?? 0;
  if (used >= slotMax(role, cfg)) {
    throw new DeskError("failed_precondition", role === "senior"
      ? "This ward already has its maximum number of senior agents"
      : "This constituency already has its maximum number of lead agents");
  }
  return { used, ref };
}
export const writeSlot = (tx: Transaction, s: { used: number; ref: FirebaseFirestore.DocumentReference }, now: number): void => {
  tx.set(s.ref, { used: s.used + 1, updatedAt: now }, { merge: true });
};
/** Frees a slot (rejected, closed or re-ranked). Never goes below zero. */
export async function releaseSlot(tx: Transaction, role: SlotRole, scopeId: string, now: number): Promise<void> {
  const ref = slotRef(role, scopeId);
  const snap = await tx.get(ref);
  const used = (snap.data()?.used as number | undefined) ?? 0;
  tx.set(ref, { used: Math.max(0, used - 1), updatedAt: now }, { merge: true });
}
/** Scope of an existing agent's slot, if it holds one. Legacy agents without geo fall back to their ward label. */
export function slotOf(a: Pick<AgentDoc, "rank" | "wardId" | "constituencyId">): { role: SlotRole; scopeId: string } | undefined {
  if (a.rank === "senior") return { role: "senior", scopeId: a.wardId };
  if (a.rank === "lead" && a.constituencyId) return { role: "lead", scopeId: a.constituencyId };
  return undefined;
}

const activeIn = async (field: "wardId" | "constituencyId" | "countyId", value: string, rank: Rank): Promise<AgentDoc[]> =>
  (await col("agents").where(field, "==", value).where("rank", "==", rank).where("status", "==", "active").limit(50).get()).docs.map((d) => d.data() as AgentDoc);

export interface Hierarchy { seniors: AgentDoc[]; leads: AgentDoc[]; admins: AgentDoc[]; ctx: HierarchyContext }
export async function loadHierarchy(geo: Geo): Promise<Hierarchy> {
  const [seniors, leads, admins, sSlot, lSlot] = await Promise.all([
    activeIn("wardId", geo.wardId, "senior"), activeIn("constituencyId", geo.constituencyId, "lead"), activeIn("countyId", geo.countyId, "admin"),
    slotRef("senior", geo.wardId).get(), slotRef("lead", geo.constituencyId).get(),
  ]);
  return {
    seniors, leads, admins,
    ctx: {
      activeSeniors: seniors.length, seniorSlotsUsed: (sSlot.data()?.used as number | undefined) ?? 0,
      activeLeads: leads.length, leadSlotsUsed: (lSlot.data()?.used as number | undefined) ?? 0, activeAdmins: admins.length,
    },
  };
}
export const optionsFor = (h: Hierarchy, cfg: Pick<DeskConfig, "network">) => eligibleRoles(h.ctx, cfg);

export async function findAgentByCode(code: string): Promise<AgentDoc | undefined> {
  const q = await col("agents").where("agentCode", "==", code).limit(1).get();
  return q.empty ? undefined : (q.docs[0].data() as AgentDoc);
}
export const bumpDownline = (tx: Transaction, uplineId: string, by: 1 | -1): void => {
  tx.update(col("agents").doc(uplineId), { downlineCount: FieldValue.increment(by) });
};
