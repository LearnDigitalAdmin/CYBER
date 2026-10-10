import type { Product, Rank } from "./contract.js";

/** Runtime-editable in `desk_config/global` (admin dash only). Money in minor units, rates in percent. */
export interface DeskConfig {
  creditCostMinor: number;               // what Samuhia pays per SMS credit: KES 0.20 = 20
  platformCutPct: number;                // CYBER_ charge cut, taken after Paystack fees (PAY chargeCustomer uses 2.5)
  expectedPaystackFeePct: number;        // only used to derive SMS margin shares (1.5)
  smsShareOfMarginPct: number;           // 40
  firstPurchaseThresholdMinor: number;   // 20000 = KES 200
  subShareByRank: Record<Rank, number>;  // % of net after fees
  reportShareByRank: Record<Rank, number>;
  rentDeskSharePct: number;              // 30 (% of Plot Yangu's take)
  rentTakeCapMinor: number;              // 25000 = KES 250 per transaction
  milestone: { blockSize: number; bonusMinor: number; lifetimeCapMinor: number; minPaidMonths: number };
  /** Which Paystack account each product charges through. "separate" = its own account (agent needs a subaccount there too). */
  paystackAccounts: Record<Product, "main" | "separate">;
  /** Firebase project IDs of the Chama and Register projects (desk reads them; they never access desk). */
  projects: { chama: string; school: string };
  /** Top-desk controls. */
  topDesk: { dailyPayoutCapMinor: number };
  /** Base URL of each product's private `deskDelegate` function. Set by the owner after the product patch is deployed. */
  delegate: Record<Product, string>;
  /** Support payouts (automatic monthly Paystack transfer). A rate of 0 disables payouts. */
  support: { rateMinorPerConfirmed: number; maxConfirmedPerDay: number; monthlyCapMinor: number };
  prices: {
    importMinor: number;                 // 20000
    manualTiers: { upToRecords: number; priceMinor: number }[];
    manualCapMinor: number;              // 100000
    manualServiceFeeMinor: number;       // 20000
    commsMinor: number;                  // 10000
  };
}

export const DEFAULT_DESK_CONFIG: DeskConfig = {
  creditCostMinor: 20,
  platformCutPct: 2.5,
  expectedPaystackFeePct: 1.5,
  smsShareOfMarginPct: 40,
  firstPurchaseThresholdMinor: 20000,
  subShareByRank: { clerk: 25, senior: 30, lead: 30 },
  reportShareByRank: { clerk: 25, senior: 30, lead: 30 },
  rentDeskSharePct: 30,
  rentTakeCapMinor: 25000,
  milestone: { blockSize: 10, bonusMinor: 200000, lifetimeCapMinor: 1000000, minPaidMonths: 2 },
  paystackAccounts: { chama: "main", school: "main", pms: "main" },
  projects: { chama: "", school: "" },
  topDesk: { dailyPayoutCapMinor: 5_000_000 },
  delegate: { chama: "", school: "", pms: "" },
  support: { rateMinorPerConfirmed: 0, maxConfirmedPerDay: 5, monthlyCapMinor: 0 },
  prices: {
    importMinor: 20000,
    manualTiers: [
      { upToRecords: 10, priceMinor: 20000 },
      { upToRecords: 25, priceMinor: 40000 },
      { upToRecords: 50, priceMinor: 60000 },
      { upToRecords: 100, priceMinor: 80000 },
      { upToRecords: 1_000_000, priceMinor: 100000 },
    ],
    manualCapMinor: 100000,
    manualServiceFeeMinor: 20000,
    commsMinor: 10000,
  },
};

/** Deep-merge stored overrides over defaults. Pure. */
export function mergeConfig(stored: Partial<DeskConfig> | undefined): DeskConfig {
  const s = stored ?? {};
  return {
    ...DEFAULT_DESK_CONFIG,
    ...s,
    subShareByRank: { ...DEFAULT_DESK_CONFIG.subShareByRank, ...s.subShareByRank },
    reportShareByRank: { ...DEFAULT_DESK_CONFIG.reportShareByRank, ...s.reportShareByRank },
    milestone: { ...DEFAULT_DESK_CONFIG.milestone, ...s.milestone },
    paystackAccounts: { ...DEFAULT_DESK_CONFIG.paystackAccounts, ...s.paystackAccounts },
    projects: { ...DEFAULT_DESK_CONFIG.projects, ...s.projects },
    topDesk: { ...DEFAULT_DESK_CONFIG.topDesk, ...s.topDesk },
    delegate: { ...DEFAULT_DESK_CONFIG.delegate, ...s.delegate },
    support: { ...DEFAULT_DESK_CONFIG.support, ...s.support },
    prices: { ...DEFAULT_DESK_CONFIG.prices, ...s.prices },
  };
}

type ReadDoc = () => Promise<Partial<DeskConfig> | undefined>;
let cache: { at: number; cfg: DeskConfig } | null = null;

/** Cached 60 s. */
export async function loadDeskConfig(read: ReadDoc, now = Date.now()): Promise<DeskConfig> {
  if (cache && now - cache.at < 60_000) return cache.cfg;
  const cfg = mergeConfig(await read());
  cache = { at: now, cfg };
  return cfg;
}
export function clearConfigCache(): void { cache = null; }
