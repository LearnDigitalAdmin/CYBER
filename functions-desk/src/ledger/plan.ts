/** Pure settlement planning for a desk service ticket, from Paystack's VERIFIED figures (never from the webhook document). */
import type { DeskConfig } from "../config.js";
import { DeskError } from "../errors.js";
import { servicePlan, settledAmounts } from "../money.js";
import type { DeskTicket } from "../tickets/model.js";

export const AMOUNT_MISMATCH = "amount mismatch";

export interface VerifiedFigures { amountMinor: number; feesMinor: number; currency?: string }
export type SettlementPlan =
  | { ok: true; grossMinor: number; feeMinor: number; agentMinor: number; platformMinor: number; sharePct: number }
  | { ok: false; reason: typeof AMOUNT_MISMATCH };

export function planSettlement(t: Pick<DeskTicket, "amountMinor" | "sharePct">, v: VerifiedFigures, cfg: DeskConfig): SettlementPlan {
  if (v.amountMinor !== t.amountMinor || (v.currency !== undefined && v.currency.toUpperCase() !== "KES"))
    return { ok: false, reason: AMOUNT_MISMATCH };
  if (!Number.isSafeInteger(v.feesMinor) || v.feesMinor < 0 || v.feesMinor > v.amountMinor)
    throw new DeskError("internal", "Paystack reported an invalid fee for this payment");
  const sharePct = t.sharePct ?? servicePlan(cfg).agentSharePct;
  const s = settledAmounts({ grossMinor: v.amountMinor, feeMinor: v.feesMinor, agentSharePct: sharePct });
  return { ok: true, grossMinor: v.amountMinor, feeMinor: v.feesMinor, agentMinor: s.agentMinor, platformMinor: s.platformMinor, sharePct };
}

export type AttemptStatus = { ref: string; status: string; reason?: string };
export type TicketDecision =
  | { action: "settle"; ref: string }
  | { action: "fail"; reason: string }
  | { action: "expire" }
  | { action: "wait" };

export const PENDING_EXPIRY_MS = 15 * 60_000;

/**
 * What the reconciler does with an awaiting_payment ticket. `attempts` is ordered oldest -> newest and holds Paystack's
 * verified status per reference ("not_found" when Paystack has never seen it). A success on ANY attempt settles the ticket
 * (money first); otherwise the latest attempt decides.
 */
export function decideTicket(attempts: readonly AttemptStatus[], ageMs: number, deadStatuses: ReadonlySet<string>): TicketDecision {
  for (let i = attempts.length - 1; i >= 0; i--) if (attempts[i].status === "success") return { action: "settle", ref: attempts[i].ref };
  const latest = attempts[attempts.length - 1];
  if (latest && deadStatuses.has(latest.status)) return { action: "fail", reason: latest.reason?.trim() || "Payment was not completed" };
  return ageMs >= PENDING_EXPIRY_MS ? { action: "expire" } : { action: "wait" };
}
