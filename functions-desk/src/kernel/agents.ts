import { col, db } from "../db.js";
import type { DeskConfig } from "../config.js";
import type { Product } from "../contract.js";
import { DeskError } from "../errors.js";
import type { AgentDoc, CustomerDoc } from "../types.js";

/** The agent must be a certified, active desk agent. */
export async function requireActiveAgent(uid: string): Promise<AgentDoc> {
  const snap = await col("agents").doc(uid).get();
  if (!snap.exists) throw new DeskError("permission_denied", "You are not a Samuhia Desk agent");
  const a = snap.data() as AgentDoc;
  if (a.status !== "active") throw new DeskError("permission_denied", `Agent account is ${a.status}`);
  return a;
}

export interface AgentPayment { uid: string; subaccountCode: string; email: string; pId: string; id: string }
type PaymentInfo = { accountId?: string; productAccounts?: Partial<Record<string, string>> };

/**
 * Paystack cannot split across separate accounts, so an agent has one subaccount PER Paystack account, all settling to the
 * same bank: `paymentInfo.accountId` (the main account, created by PAY's existing setup) and
 * `paymentInfo.productAccounts.<product>` for each product configured as "separate" (created by desk_syncPayoutAccounts).
 * `account` is "main" for every desk-service charge; a product name selects that product's account when it is separate.
 */
export function pickSubaccount(info: PaymentInfo | undefined, account: "main" | Product, cfg: DeskConfig): string {
  const separate = account !== "main" && cfg.paystackAccounts[account] === "separate";
  const code = separate ? info?.productAccounts?.[account] : info?.accountId;
  if (code) return code;
  throw new DeskError("failed_precondition", separate
    ? `Your ${account} payout account is not ready yet. Open Account → Payout accounts to finish setup.`
    : "Set up your payment account before charging customers");
}

/** CYBER agents live in PAY's `agents/{uid}` (this is exactly what PAY's chargeCustomer reads). */
export async function getAgentPayment(uid: string, account: "main" | Product, cfg: DeskConfig): Promise<AgentPayment> {
  const snap = await db().collection("agents").doc(uid).get();
  if (!snap.exists) throw new DeskError("not_found", "Agent payment profile not found");
  const d = snap.data() as { paymentInfo?: PaymentInfo; email?: string; pId?: string; id?: string };
  return { uid, subaccountCode: pickSubaccount(d.paymentInfo, account, cfg), email: d.email || `${uid}@samuhia.co.ke`, pId: d.pId || uid, id: d.id || uid };
}

export async function getCustomer(entityKey: string): Promise<CustomerDoc | undefined> {
  const snap = await col("customers").doc(entityKey.replace(/\//g, "_")).get();
  return snap.exists ? (snap.data() as CustomerDoc) : undefined;
}
