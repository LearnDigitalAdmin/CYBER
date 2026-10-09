import { col, db } from "../db.js";
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

/**
 * CYBER agents already live in PAY's `agents/{uid}` with a Paystack subaccount at `paymentInfo.accountId`
 * (this is exactly what PAY's chargeCustomer reads). Automatic settlement pays that subaccount.
 */
export async function getAgentPayment(uid: string): Promise<AgentPayment> {
  const snap = await db().collection("agents").doc(uid).get();
  if (!snap.exists) throw new DeskError("not_found", "Agent payment profile not found");
  const d = snap.data() as { paymentInfo?: { accountId?: string }; email?: string; pId?: string; id?: string };
  const subaccountCode = d.paymentInfo?.accountId;
  if (!subaccountCode) throw new DeskError("failed_precondition", "Set up your payment account before charging customers");
  return { uid, subaccountCode, email: d.email || `${uid}@samuhia.co.ke`, pId: d.pId || uid, id: d.id || uid };
}

export async function getCustomer(entityKey: string): Promise<CustomerDoc | undefined> {
  const snap = await col("customers").doc(entityKey.replace(/\//g, "_")).get();
  return snap.exists ? (snap.data() as CustomerDoc) : undefined;
}
