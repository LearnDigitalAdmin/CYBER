import { createHash } from "node:crypto";
import { col } from "../db.js";
import { DeskError } from "../errors.js";
import { toBps } from "../money.js";
import { PAYSTACK_SECRET_KEY, paystackMessage } from "./client.js";
import axios from "axios";

export interface SplitSub { subaccount: string; sharePct: number }

/** Stable cache key: same subaccounts + same shares (to 0.01%) -> same Paystack split code. */
export function splitKey(subs: readonly SplitSub[]): string {
  const canon = [...subs].map((s) => `${s.subaccount}:${toBps(s.sharePct)}`).sort().join("|");
  return createHash("sha256").update(canon).digest("hex").slice(0, 32);
}

export function validateSplit(subs: readonly SplitSub[]): void {
  if (subs.length === 0) throw new DeskError("invalid_argument", "Split needs at least one subaccount");
  let total = 0;
  for (const s of subs) {
    if (!s.subaccount.startsWith("ACCT_")) throw new DeskError("invalid_argument", "Invalid Paystack subaccount code");
    if (!(s.sharePct > 0 && s.sharePct < 100)) throw new DeskError("invalid_argument", "Split share must be between 0 and 100");
    total += toBps(s.sharePct);
  }
  // Samuhia's main account is the remainder, so it must keep something.
  if (total >= 10000) throw new DeskError("invalid_argument", "Split shares leave nothing for the platform");
}

/**
 * Get or create a Paystack percentage split (bearer "all-proportional": the fee is shared in proportion, so every
 * party receives its share of the amount AFTER Paystack's real fee). The main account takes the remainder.
 */
export async function getOrCreateSplitCode(subs: readonly SplitSub[], label: string): Promise<string> {
  validateSplit(subs);
  const key = splitKey(subs);
  const ref = col("splitCodes").doc(key);
  const cached = await ref.get();
  if (cached.exists) return (cached.data() as { splitCode: string }).splitCode;

  let splitCode: string;
  try {
    const res = await axios.post("https://api.paystack.co/split", {
      name: `Desk ${label} ${key.slice(0, 8)}`.slice(0, 100),
      type: "percentage",
      currency: "KES",
      subaccounts: subs.map((s) => ({ subaccount: s.subaccount, share: s.sharePct })),
      bearer_type: "all-proportional",
    }, { timeout: 15_000, headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY.value()}`, "Content-Type": "application/json" } });
    if (!res.data?.status || !res.data?.data?.split_code) throw new DeskError("payment_failed", res.data?.message ?? "Could not create split");
    splitCode = res.data.data.split_code as string;
  } catch (err) {
    if (err instanceof DeskError) throw err;
    throw new DeskError("payment_failed", paystackMessage(err));
  }
  try {
    await ref.create({ splitCode, subs: subs.map((s) => ({ ...s })), label, createdAt: Date.now() });
    return splitCode;
  } catch (err) {
    if ((err as { code?: number }).code === 6) { // a concurrent request cached first: use the stored code
      return ((await ref.get()).data() as { splitCode: string }).splitCode;
    }
    throw err;
  }
}
