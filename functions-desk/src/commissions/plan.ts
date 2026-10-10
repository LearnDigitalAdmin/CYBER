/** Pure planning for desk_onDeskEvent: validation, commission rows, customer field updates, refund reversals. */
import type { Product } from "../contract.js";
import { isPeriod } from "../bonus/qualify.js";
import { settledAmounts, type SplitRule } from "../money.js";
import type { CustomerDoc, DeskEventDoc, DeskEventType, LedgerDoc } from "../types.js";

const TYPES: readonly DeskEventType[] = ["sms_purchase", "subscription_payment", "report_purchase", "rent_payment", "refund"];
const PRODUCTS: readonly Product[] = ["chama", "school", "pms"];
const isMinor = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;

/** Returns the event, or the reason it cannot be processed (never throws: a bad event must not be retried forever). */
export function validateEvent(raw: unknown): { ok: true; event: DeskEventDoc } | { ok: false; reason: string } {
  if (typeof raw !== "object" || raw === null) return { ok: false, reason: "event is empty" };
  const e = raw as Partial<DeskEventDoc>;
  if (!TYPES.includes(e.type as DeskEventType)) return { ok: false, reason: "unknown event type" };
  if (!PRODUCTS.includes(e.product as Product)) return { ok: false, reason: "unknown product" };
  if (typeof e.entityKey !== "string" || e.entityKey.length === 0) return { ok: false, reason: "missing entityKey" };
  if (typeof e.agentId !== "string" || e.agentId.length === 0) return { ok: false, reason: "missing agentId" };
  if (typeof e.paystackRef !== "string" || e.paystackRef.length === 0) return { ok: false, reason: "missing paystackRef" };
  if (!isMinor(e.grossMinor) || !isMinor(e.feeMinor) || e.feeMinor > e.grossMinor) return { ok: false, reason: "invalid gross or fee" };
  if (typeof e.agentSharePct !== "number" || !(e.agentSharePct >= 0 && e.agentSharePct < 100)) return { ok: false, reason: "invalid agentSharePct" };
  if (typeof e.paidAt !== "number" || !Number.isFinite(e.paidAt) || e.paidAt <= 0) return { ok: false, reason: "invalid paidAt" };
  if (e.type === "refund" && (typeof e.originalRef !== "string" || e.originalRef.length === 0)) return { ok: false, reason: "refund without originalRef" };
  if (e.periodMonth !== undefined && !isPeriod(e.periodMonth)) return { ok: false, reason: "invalid periodMonth" };
  return { ok: true, event: e as DeskEventDoc };
}

/** "YYYY-MM" of an instant in Africa/Nairobi (UTC+3, no daylight saving). */
export function monthKeyEAT(ms: number): string {
  const d = new Date(ms + 3 * 3_600_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Sorted, unique. */
export function addPaidPeriod(periods: readonly string[], month: string): string[] {
  return [...new Set([...periods.filter(isPeriod), month])].sort();
}

export interface CommissionPlan { agentMinor: number; rule: SplitRule; note: string }
const NOTES: Record<Exclude<DeskEventType, "refund">, string> = {
  sms_purchase: "SMS credit commission",
  subscription_payment: "Subscription commission",
  report_purchase: "Report commission",
  rent_payment: "Rent collection commission",
};

/** Commission from the event's REAL gross, fee and the share % that went into the split. `firstPurchase` = PAY reserved this ref as the first purchase. */
export function planCommission(e: DeskEventDoc, firstPurchase: boolean): CommissionPlan | undefined {
  if (e.type === "refund") return undefined;
  const { agentMinor } = settledAmounts({ grossMinor: e.grossMinor, feeMinor: e.feeMinor, agentSharePct: e.agentSharePct });
  const rule: SplitRule =
    e.type === "sms_purchase" ? (firstPurchase ? "sms_first_purchase" : "sms_standard")
    : e.type === "subscription_payment" ? "subscription"
    : e.type === "report_purchase" ? "report" : "rent";
  return { agentMinor, rule, note: NOTES[e.type] };
}

/** The customer fields this event may change. Returns undefined when nothing changes. Never ownerAgentId, attributedAt or selfOwned. */
export interface CustomerPatch { set: Partial<CustomerDoc>; deleteFields: ("firstPurchaseReservedRef" | "firstPurchaseReservedAt")[]; derivedPeriod?: boolean }
export function planCustomerUpdate(e: DeskEventDoc, c: Partial<CustomerDoc>): CustomerPatch | undefined {
  switch (e.type) {
    case "subscription_payment": {
      const month = e.periodMonth ?? monthKeyEAT(e.paidAt);
      const next = addPaidPeriod(c.paidPeriods ?? [], month);
      if (next.length === (c.paidPeriods ?? []).length && next.every((p, i) => p === (c.paidPeriods ?? [])[i])) return undefined;
      return { set: { paidPeriods: next }, deleteFields: [], derivedPeriod: e.periodMonth === undefined };
    }
    case "sms_purchase":
      return { set: { firstPurchaseUsed: true, lastPaidAt: Math.max(c.lastPaidAt ?? 0, e.paidAt) }, deleteFields: ["firstPurchaseReservedRef", "firstPurchaseReservedAt"] };
    case "refund":
      return c.refunded === true ? undefined : { set: { refunded: true }, deleteFields: [] };
    default:
      return undefined;
  }
}

/** One negative `reversal` row per ledger row that paid out of the refunded charge. Reversal rows, voids and reversed rows are skipped. */
export function planReversals(rows: readonly LedgerDoc[], eventId: string, originalRef: string):
  { agentId: string; amountMinor: number; entryId: string; product?: Product; entityKey?: string; idempotencyParts: string[]; note: string }[] {
  return rows
    .filter((r) => r.kind !== "reversal" && r.status !== "void" && r.amountMinor > 0)
    .map((r) => ({
      agentId: r.agentId, amountMinor: -r.amountMinor, entryId: r.entryId, product: r.product, entityKey: r.entityKey,
      // one reversal per ledger row, ever: a second refund event for the same charge can never reverse it twice
      idempotencyParts: ["reversal", r.entryId],
      note: `Refund of ${originalRef} (event ${eventId})`,
    }));
}
