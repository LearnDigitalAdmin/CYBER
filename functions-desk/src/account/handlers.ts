import { getAuth } from "firebase-admin/auth";
import { getApps, initializeApp } from "firebase-admin/app";
import type { SyncEmailOut } from "../contract.js";
import { col, db } from "../db.js";
import { DeskError } from "../errors.js";
import { audit } from "../kernel/audit.js";
import type { AgentDoc } from "../types.js";

export interface AuthUserLite { email?: string; emailVerified: boolean }
export interface AccountDeps { getAuthUser(uid: string): Promise<AuthUserLite> }

export const defaultAccountDeps = (): AccountDeps => ({
  async getAuthUser(uid) {
    if (!getApps().some((a) => a.name === "[DEFAULT]")) initializeApp();
    const u = await getAuth().getUser(uid);
    return { email: u.email, emailVerified: u.emailVerified };
  },
});

/**
 * Reads the Auth user SERVER-side (never trusts a client-sent address), requires it to be verified and copies it to
 * desk_agents/{uid} and PAY's agents/{uid} when it differs. The UI calls it after a verified email change and on sign-in.
 */
export async function syncEmail(deps: AccountDeps, uid: string): Promise<SyncEmailOut> {
  const user = await deps.getAuthUser(uid);
  const email = user.email?.trim().toLowerCase();
  if (!email) throw new DeskError("failed_precondition", "Your account has no email address");
  if (!user.emailVerified) throw new DeskError("failed_precondition", "Verify your email address first, then try again");

  const agentRef = col("agents").doc(uid);
  const payRef = db().collection("agents").doc(uid);
  const out = await db().runTransaction(async (tx) => {
    const [a, p] = await Promise.all([tx.get(agentRef), tx.get(payRef)]);
    if (!a.exists) throw new DeskError("permission_denied", "You are not a Samuhia Desk agent");
    const agent = a.data() as AgentDoc;
    const deskDiffers = agent.email?.toLowerCase() !== email;
    const payDiffers = p.exists && String(p.data()?.email ?? "").toLowerCase() !== email;
    if (deskDiffers) tx.update(agentRef, { email });
    if (payDiffers) tx.update(payRef, { email });
    return { changed: deskDiffers || payDiffers, previous: agent.email, deskDiffers, payDiffers };
  });
  if (out.changed) await audit({ action: "email_synced", agentId: uid, meta: { desk: out.deskDiffers, pay: out.payDiffers } });
  return { email, changed: out.changed };
}
