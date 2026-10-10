/**
 * Top desk (COG-0000) access control. EVERY privilege is enforced here, in server code, never by security rules:
 * the caller must be the top desk's own agent record, active, signed in with a verified @samuhia.co.ke address and a
 * recent sign-in. Money movement and desk suspension additionally need a per-action OTP (implemented by the top-desk job).
 */
import { DESK_TOP_CODE, SAMUHIA_EMAIL_DOMAIN } from "../contract.js";
import { col } from "../db.js";
import { DeskError } from "../errors.js";
import type { AgentDoc } from "../types.js";
import type { Check } from "./session.js";

export const TOP_RECENT_AUTH_SECONDS = 15 * 60;

export interface AuthLike { uid: string; token: { email?: string; email_verified?: boolean; auth_time?: number } }

export function isSamuhiaEmail(email: string | undefined): boolean {
  return typeof email === "string" && new RegExp(`^[^@\\s]+@${SAMUHIA_EMAIL_DOMAIN.replace(/\./g, "\\.")}$`, "i").test(email.trim());
}
export const isTopDeskCode = (code: string | undefined): boolean => code === DESK_TOP_CODE;

export function evaluateTopAccess(agent: AgentDoc | undefined, auth: AuthLike, nowSec: number): Check {
  if (!agent || !isTopDeskCode(agent.agentCode) || agent.agentId !== auth.uid)
    return { ok: false, code: "permission_denied", message: "Top desk access only" };
  if (agent.status !== "active") return { ok: false, code: "permission_denied", message: "Top desk account is not active" };
  if (!isSamuhiaEmail(auth.token.email) || auth.token.email_verified !== true)
    return { ok: false, code: "permission_denied", message: `Top desk needs a verified @${SAMUHIA_EMAIL_DOMAIN} account` };
  if (!auth.token.auth_time || nowSec - auth.token.auth_time > TOP_RECENT_AUTH_SECONDS)
    return { ok: false, code: "unauthenticated", message: "Please sign in again to continue" };
  return { ok: true };
}

export async function requireTopDesk(auth: AuthLike | undefined | null): Promise<AgentDoc> {
  if (!auth) throw new DeskError("unauthenticated", "Please sign in");
  const snap = await col("agents").doc(auth.uid).get();
  const agent = snap.exists ? (snap.data() as AgentDoc) : undefined;
  const res = evaluateTopAccess(agent, auth, Math.floor(Date.now() / 1000));
  if (!res.ok) throw new DeskError(res.code, res.message);
  return agent as AgentDoc;
}
