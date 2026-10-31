/**
 * Payment SMS for agents ("+KES 615 commission. This month: KES 6,150 from 12 payments."). Best-effort and cheap: at most one SMS per
 * agent per `notify.minGapMs`; payments that arrive inside that window are folded into the next message. Never throws.
 */
import * as logger from "firebase-functions/logger";
import { col, db, getConfig } from "../db.js";
import { sendSms } from "../kernel/sms.js";
import { monthOf, paymentSmsText } from "../network/pure.js";
import type { AgentDoc, StatsDoc } from "../types.js";

export interface NotifyInput { agentId: string; kind: "commission" | "override"; earnedMinor: number; paidAt: number }

export async function notifyAgentOfPayment(n: NotifyInput, nowMs: number = Date.now()): Promise<boolean> {
  try {
    const cfg = await getConfig();
    if (!cfg.notify.enabled || n.earnedMinor <= 0) return false;
    const month = monthOf(n.paidAt);
    const ref = col("stats").doc(`${n.agentId}_${month}`);
    const plan = await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const s = (snap.data() ?? {}) as Partial<StatsDoc>;
      const unsentMinor = (s.unsentMinor ?? 0) + n.earnedMinor;
      const unsentPayments = (s.unsentPayments ?? 0) + 1;
      if (s.lastSmsAt !== undefined && nowMs - s.lastSmsAt < cfg.notify.minGapMs) {
        tx.set(ref, { unsentMinor, unsentPayments }, { merge: true });
        return undefined;
      }
      tx.set(ref, { lastSmsAt: nowMs, unsentMinor: 0, unsentPayments: 0 }, { merge: true });
      return { earnedMinor: unsentMinor, count: unsentPayments, monthMinor: (s.commissionMinor ?? 0) + (s.overrideMinor ?? 0), monthPayments: n.kind === "override" ? (s.teamPayments ?? 0) : (s.payments ?? 0) };
    });
    if (!plan) return false;
    const agent = (await col("agents").doc(n.agentId).get()).data() as AgentDoc | undefined;
    if (!agent || agent.status !== "active" || agent.notifySms === false || agent.rank === "internal") return false;
    await sendSms(agent.phone, paymentSmsText({ kind: n.kind, ...plan }));
    return true;
  } catch (err) {
    logger.warn("payment sms failed", { agentId: n.agentId, err: String(err) });
    return false;
  }
}
