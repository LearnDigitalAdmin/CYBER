import type { EarningsByProduct, GetEarningsOut, GetEarningsIn } from "../contract.js";
import { col } from "../db.js";
import { DeskError } from "../errors.js";
import { requireActiveAgent } from "../kernel/agents.js";
import { countQualifyingAccounts, summariseBonusRows } from "../bonus/qualify.js";
import { resolveDeps, type DeskDeps } from "../charge/port.js";
import type { LedgerDoc } from "../types.js";

export const MAX_EARNINGS_RANGE_MS = 400 * 86_400_000;
const PAGE = 1000;
const MAX_ROWS = 50_000;

export interface Totals { settledMinor: number; payableMinor: number; paidMinor: number; byProduct: EarningsByProduct[] }

/**
 * Sums ledger rows by status and by earning stream. Void rows count nowhere. `processing` money (a payout transfer created but not
 * yet confirmed) is still unpaid, so it is part of payableMinor. Reversals are negative settled rows and net out the stream they
 * reverse (by product when the row has one, otherwise the service stream).
 */
export function aggregateEarnings(rows: readonly Pick<LedgerDoc, "kind" | "status" | "amountMinor" | "product">[]): Totals {
  let settledMinor = 0, payableMinor = 0, paidMinor = 0;
  const by = new Map<EarningsByProduct["product"], number>();
  for (const r of rows) {
    if (r.status === "void") continue;
    if (r.status === "settled") settledMinor += r.amountMinor;
    else if (r.status === "payable" || r.status === "processing") payableMinor += r.amountMinor;
    else if (r.status === "paid") paidMinor += r.amountMinor;
    const stream: EarningsByProduct["product"] =
      r.kind === "bonus" ? "bonus" : r.kind === "support" ? "support" : r.kind === "service" ? "service" : (r.product ?? "service");
    by.set(stream, (by.get(stream) ?? 0) + r.amountMinor);
  }
  const order: EarningsByProduct["product"][] = ["service", "chama", "school", "pms", "bonus", "support"];
  return {
    settledMinor, payableMinor, paidMinor,
    byProduct: order.filter((k) => by.has(k)).map((k) => ({ product: k, amountMinor: by.get(k) as number })),
  };
}

export function parseEarningsInput(data: unknown): GetEarningsIn {
  const { from, to } = (typeof data === "object" && data !== null ? data : {}) as Partial<GetEarningsIn>;
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || (from as number) < 0 || (to as number) < (from as number))
    throw new DeskError("invalid_argument", "Choose a valid date range");
  if ((to as number) - (from as number) > MAX_EARNINGS_RANGE_MS) throw new DeskError("invalid_argument", "Choose a range of at most 13 months");
  return { from: from as number, to: to as number };
}

/** desk_getEarnings: the caller's own ledger for a range (by createdAt) plus live milestone progress. */
export async function getEarnings(uid: string, data: unknown, deps: DeskDeps = {}): Promise<GetEarningsOut> {
  const d = resolveDeps(deps);
  const { from, to } = parseEarningsInput(data);
  await requireActiveAgent(uid);
  const cfg = await d.config();

  const rows: LedgerDoc[] = [];
  let last: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  for (;;) {
    let q = col("ledger").where("agentId", "==", uid).where("createdAt", ">=", from).where("createdAt", "<=", to)
      .orderBy("createdAt", "desc").limit(PAGE);
    if (last) q = q.startAfter(last);
    const page = await q.get();
    for (const doc of page.docs) rows.push(doc.data() as LedgerDoc);
    if (page.size < PAGE) break;
    last = page.docs[page.docs.length - 1];
    if (rows.length >= MAX_ROWS) throw new DeskError("invalid_argument", "That range has too many entries. Choose a shorter range.");
  }
  const totals = aggregateEarnings(rows);

  const bonusSnap = await col("ledger").where("agentId", "==", uid).where("kind", "==", "bonus").get();
  const history = summariseBonusRows(bonusSnap.docs.map((x) => x.data() as LedgerDoc));
  const qualifyingAccounts = await countQualifyingAccounts(uid, cfg);
  return {
    settledMinor: totals.settledMinor, payableMinor: totals.payableMinor, paidMinor: totals.paidMinor,
    byProduct: totals.byProduct,
    bonusProgress: {
      qualifyingAccounts, blocksPaid: history.nonVoidBlocks, bankedMinor: history.bankedMinor, capMinor: cfg.milestone.lifetimeCapMinor,
    },
  };
}
