/**
 * What a confirmed payment does for the NETWORK, on top of the owner's commission (which PAY already settled through the Paystack split):
 *  - team overrides for the owner's active senior / lead, accrued from Samuhia's share (never the owner's), and
 *  - income counters (desk_stats) for the owner and everyone above them, which feed the dashboards and the payment SMS.
 * Everything runs in ONE transaction guarded by a create-only marker, so a retried or replayed event can never count twice.
 */
import { FieldValue } from "firebase-admin/firestore";
import { col, db, getConfig } from "../db.js";
import type { DeskConfig } from "../config.js";
import { audit } from "../kernel/audit.js";
import { notifyAgentOfPayment } from "../notify/payment.js";
import { OVERRIDE_TYPES, commissionableNet, governorBase, monthOf, overrideEligible, planOverrides } from "../network/pure.js";
import type { AccrualDoc, AgentDoc, CustomerDoc, DeskEventDoc } from "../types.js";

const statRef = (agentId: string, month: string) => col("stats").doc(`${agentId}_${month}`);

export interface NetworkEffectsResult { applied: boolean; overrides: number; overrideMinor: number }

export async function applyNetworkEffects(
  eventId: string, e: DeskEventDoc, agentMinor: number, customer: Partial<CustomerDoc> | undefined, refundedAlready: boolean, cfgIn?: DeskConfig,
): Promise<NetworkEffectsResult> {
  const none: NetworkEffectsResult = { applied: false, overrides: 0, overrideMinor: 0 };
  if (e.type === "refund" || agentMinor <= 0) return none;
  const cfg = cfgIn ?? (await getConfig());
  const ownerSnap = await col("agents").doc(e.agentId).get();
  const owner = ownerSnap.data() as AgentDoc | undefined;
  if (!owner || owner.rank === "internal") return none;

  const month = monthOf(e.paidAt);
  const base = governorBase(e, cfg);
  const stream = OVERRIDE_TYPES[e.type];
  const eligible = !!stream && !refundedAlready && !!customer && overrideEligible({
    stream, paidPeriodsAfter: customer.paidPeriods?.length ?? 0, attributedAt: customer.attributedAt ?? e.paidAt, paidAt: e.paidAt,
    selfOwned: customer.selfOwned, refunded: customer.refunded,
  }, cfg);

  // Only ACTIVE seniors / leads earn; a vacant or inactive level pays nothing, so its share stays with Samuhia.
  const active = async (id?: string): Promise<string | undefined> => {
    if (!id) return undefined;
    const a = (await col("agents").doc(id).get()).data() as AgentDoc | undefined;
    return a && a.status === "active" ? id : undefined;
  };
  const [seniorId, leadId] = eligible ? await Promise.all([active(owner.seniorId), active(owner.leadId)]) : [undefined, undefined];
  const lines = eligible && stream
    ? planOverrides({ stream, baseMinor: commissionableNet(e, cfg), agentMinor, ownerRank: owner.rank, seniorId, leadId }, cfg)
    : [];
  const isNewCustomer = e.type === "subscription_payment" && (customer?.paidPeriods?.length ?? 0) === 1;
  const chainIds = [owner.seniorId, owner.leadId, owner.adminId].filter((x): x is string => !!x);

  const marker = col("accruals").doc(`fx_${eventId}`);
  const applied = await db().runTransaction(async (tx) => {
    if ((await tx.get(marker)).exists) return false;
    const now = Date.now();
    tx.create(marker, { id: `fx_${eventId}`, eventId, createdAt: now });
    tx.set(statRef(owner.agentId, month), {
      agentId: owner.agentId, month, payments: FieldValue.increment(1), netMinor: FieldValue.increment(base), commissionMinor: FieldValue.increment(agentMinor),
      ...(isNewCustomer ? { newCustomers: FieldValue.increment(1) } : {}),
    }, { merge: true });
    for (const id of chainIds) {
      tx.set(statRef(id, month), {
        agentId: id, month, teamPayments: FieldValue.increment(1), teamNetMinor: FieldValue.increment(base),
        ...(isNewCustomer ? { teamNewCustomers: FieldValue.increment(1) } : {}),
      }, { merge: true });
    }
    for (const l of lines) {
      const id = `ov_${eventId}_${l.beneficiaryId}`;
      const acc: AccrualDoc = {
        id, beneficiaryId: l.beneficiaryId, beneficiaryRank: l.rank, ownerId: owner.agentId, paystackRef: e.paystackRef, eventId,
        stream: stream as "subscription" | "report" | "rent", baseMinor: commissionableNet(e, cfg), amountMinor: l.amountMinor, month, createdAt: now,
      };
      tx.create(col("accruals").doc(id), acc);
      tx.set(statRef(l.beneficiaryId, month), { agentId: l.beneficiaryId, month, overrideMinor: FieldValue.increment(l.amountMinor) }, { merge: true });
    }
    return true;
  });
  if (!applied) return none;

  const overrideMinor = lines.reduce((s, l) => s + l.amountMinor, 0);
  if (lines.length) await audit({ action: "override_accrued", agentId: owner.agentId, entityKey: e.entityKey, meta: { eventId, lines } });
  // payment SMS (best-effort, throttled): the owner, then each upline who earned an override
  await notifyAgentOfPayment({ agentId: owner.agentId, kind: "commission", earnedMinor: agentMinor, paidAt: e.paidAt });
  for (const l of lines) await notifyAgentOfPayment({ agentId: l.beneficiaryId, kind: "override", earnedMinor: l.amountMinor, paidAt: e.paidAt });
  return { applied: true, overrides: lines.length, overrideMinor };
}

/** A refund claws back the overrides that payment earned. The negative accrual lands in the CURRENT month's stats, so it nets against the next payout. */
export async function reverseOverrides(refundEventId: string, originalRef: string, nowMs: number): Promise<number> {
  const snap = await col("accruals").where("paystackRef", "==", originalRef).get();
  let n = 0;
  for (const d of snap.docs) {
    const a = d.data() as AccrualDoc;
    if (a.amountMinor <= 0 || a.reversalOf || !a.id.startsWith("ov_")) continue;
    const id = `rv_${a.id}`;
    const done = await db().runTransaction(async (tx) => {
      if ((await tx.get(col("accruals").doc(id))).exists) return false;
      const month = monthOf(nowMs);
      const rev: AccrualDoc = { ...a, id, amountMinor: -a.amountMinor, month, createdAt: nowMs, reversalOf: a.id, eventId: refundEventId };
      tx.create(col("accruals").doc(id), rev);
      tx.set(statRef(a.beneficiaryId, month), { agentId: a.beneficiaryId, month, overrideMinor: FieldValue.increment(-a.amountMinor) }, { merge: true });
      return true;
    });
    if (done) n++;
  }
  return n;
}
