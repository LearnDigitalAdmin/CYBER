/**
 * Payout accounts. An agent has ONE subaccount per Paystack account, all settling to the same bank:
 *  - main  : `agents/{uid}.paymentInfo.accountId` (created by PAY's existing setupAccount),
 *  - chama : `paymentInfo.productAccounts.chama`, only when `desk_config.paystackAccounts.chama` is "separate".
 * Desk creates the chama one itself, inside MyChama's own Paystack account, from the bank details PAY stored.
 */
import type { DeskConfig } from "../config.js";
import type { PayoutAccountStatus, SyncPayoutAccountsOut } from "../contract.js";
import { col, db } from "../db.js";
import { DeskError } from "../errors.js";
import { audit } from "../kernel/audit.js";
import { requireActiveAgent } from "../kernel/agents.js";
import type { AgentDoc } from "../types.js";
import type { Deps } from "./deps.js";
import { writeDeskOwner } from "./deskOwner.js";

export const MAIN_MISSING_REASON = "Set up your payment account first (Account → Payout), then try again.";
const LOCK_MS = 2 * 60_000;

interface PaymentInfo {
  accountId?: string; productAccounts?: Record<string, string | undefined>;
  businessName?: string; settlementBank?: string; accountNumber?: string; name?: string; email?: string; phone?: string;
}

/** The fields Paystack needs; undefined when anything is missing. Pure. */
export function subaccountDetailsFrom(info: PaymentInfo): { ok: true; d: Required<Pick<PaymentInfo, "businessName" | "settlementBank" | "accountNumber" | "name" | "email" | "phone">> } | { ok: false } {
  const { businessName, settlementBank, accountNumber, name, email, phone } = info;
  if (!businessName || !settlementBank || !accountNumber || !name || !email || !phone) return { ok: false };
  return { ok: true, d: { businessName, settlementBank, accountNumber, name, email, phone } };
}

const agentProfileRef = (uid: string) => db().collection("agents").doc(uid);
const lockRef = (uid: string) => col("counters").doc(`payout_${uid}_chama`);

async function ensureChamaSubaccount(deps: Deps, agent: AgentDoc, info: PaymentInfo): Promise<PayoutAccountStatus> {
  if (info.productAccounts?.chama) return { account: "chama", ready: true };
  const details = subaccountDetailsFrom(info);
  if (!details.ok) {
    return { account: "chama", ready: false, reason: "Your payout details are incomplete. Update your payment account, then try again." };
  }

  // Claim the right to create it. A second call during the claim window creates nothing.
  const claimed = await db().runTransaction(async (tx) => {
    const [profile, lock] = await Promise.all([tx.get(agentProfileRef(agent.agentId)), tx.get(lockRef(agent.agentId))]);
    const existing = (profile.data()?.paymentInfo as PaymentInfo | undefined)?.productAccounts?.chama;
    if (existing) return { kind: "exists" as const };
    const at = lock.data()?.lockedAt as number | undefined;
    if (at && at > deps.now() - LOCK_MS) return { kind: "busy" as const };
    tx.set(lockRef(agent.agentId), { lockedAt: deps.now() });
    return { kind: "claimed" as const };
  });
  if (claimed.kind === "exists") return { account: "chama", ready: true };
  if (claimed.kind === "busy") return { account: "chama", ready: false, reason: "Your MyChama payout account is being set up. Try again in a minute." };

  let code: string;
  try {
    const bank = await deps.chamaPaystack.resolveBankCode(details.d.settlementBank);
    code = await deps.chamaPaystack.createSubaccount({
      businessName: details.d.businessName, settlementBank: bank, accountNumber: details.d.accountNumber,
      contactName: details.d.name, contactEmail: details.d.email, contactPhone: details.d.phone,
      metadata: { deskCode: agent.agentCode, agentId: agent.agentId },
    });
  } catch (err) {
    await lockRef(agent.agentId).delete().catch(() => undefined);
    const reason = err instanceof DeskError ? err.message : "Could not create your MyChama payout account";
    return { account: "chama", ready: false, reason };
  }

  // Merge the code in a transaction; a value that appeared meanwhile wins and is never overwritten.
  const finalCode = await db().runTransaction(async (tx) => {
    const profile = await tx.get(agentProfileRef(agent.agentId));
    const existing = (profile.data()?.paymentInfo as PaymentInfo | undefined)?.productAccounts?.chama;
    if (existing) { tx.delete(lockRef(agent.agentId)); return existing; }
    tx.update(agentProfileRef(agent.agentId), { "paymentInfo.productAccounts.chama": code });
    tx.delete(lockRef(agent.agentId));
    return code;
  });
  await audit({ action: "payout_subaccount_created", agentId: agent.agentId, meta: { account: "chama", subaccountCode: finalCode, kept: finalCode === code } });
  return { account: "chama", ready: true };
}

export async function syncPayoutAccounts(deps: Deps, uid: string): Promise<SyncPayoutAccountsOut> {
  const agent = await requireActiveAgent(uid);
  const cfg: DeskConfig = await deps.getConfig();
  const separate = cfg.paystackAccounts.chama === "separate";

  const snap = await agentProfileRef(uid).get();
  const info = (snap.exists ? (snap.data()?.paymentInfo as PaymentInfo | undefined) : undefined) ?? {};
  if (!info.accountId) {
    const accounts: PayoutAccountStatus[] = [{ account: "main", ready: false, reason: MAIN_MISSING_REASON }];
    if (separate) accounts.push({ account: "chama", ready: false, reason: "Finish your main payout account first." });
    await audit({ action: "payout_accounts_synced", agentId: uid, meta: { ready: false } });
    return { accounts };
  }

  const accounts: PayoutAccountStatus[] = [{ account: "main", ready: true }];
  let chamaReady = true;
  if (separate) {
    const status = await ensureChamaSubaccount(deps, agent, info);
    accounts.push(status);
    chamaReady = status.ready;
  }

  // Every chama this desk owns gets its deskOwner written (or refreshed: rank and subaccount may have changed).
  const failures: string[] = [];
  let written = 0;
  if (chamaReady) {
    const owned = await col("customers").where("ownerAgentId", "==", uid).where("product", "==", "chama").get();
    for (const doc of owned.docs) {
      const code = (doc.data().entityKey as string).split(":")[1];
      try {
        const r = await writeDeskOwner(deps, cfg, agent, code);
        if (r.written) written++; else failures.push(r.reason ?? `Could not update ${code}`);
      } catch {
        failures.push(`Could not update ${code}`);
      }
    }
  }
  if (failures.length > 0) {
    const reason = `${failures.length} MyChama account${failures.length === 1 ? "" : "s"} could not be updated: ${failures[0]}`;
    const target = accounts.find((a) => a.account === "chama") ?? accounts[0];
    target.reason = reason;
    if (target.account === "chama") target.ready = false;
  }
  await audit({ action: "payout_accounts_synced", agentId: uid, meta: { ready: true, chamasUpdated: written, failures: failures.length } });
  return { accounts };
}
