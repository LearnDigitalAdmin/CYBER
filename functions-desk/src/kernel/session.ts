/**
 * The ONE gate every desk action on customer data must pass. Cross-project writes use the Admin SDK, which
 * bypasses security rules, so this check is the security boundary.
 */
import { col, db } from "../db.js";
import { DeskError, type DeskErrorCode } from "../errors.js";
import { parseEntityKey } from "../entity.js";
import type { OtpAction } from "../contract.js";
import type { ActionOtpDoc, RequireSessionArgs, SessionContext, SessionDoc } from "../types.js";

/** A per-action OTP must be verified this recently and can be used exactly once. */
export const ACTION_OTP_FRESH_MS = 5 * 60_000;
export const OTP_ACTIONS: ReadonlySet<OtpAction> = new Set<OtpAction>(["bulk_sms", "rent_stk", "export"]);

export type Check = { ok: true } | { ok: false; code: DeskErrorCode; message: string };
const fail = (code: DeskErrorCode, message: string): Check => ({ ok: false, code, message });

export function evaluateSession(doc: SessionDoc | undefined, a: { uid: string; scope: string }, now: number): Check {
  if (!doc) return fail("session_invalid", "Session not found");
  if (doc.agentId !== a.uid) return fail("permission_denied", "This session belongs to another agent");
  if (doc.status !== "active") return fail("session_invalid", "Session is not active");
  if (!doc.otpVerifiedAt) return fail("otp_required", "Customer OTP not verified");
  if (doc.expiresAt <= now) return fail("session_invalid", "Session expired");
  if (!doc.scopes.includes(a.scope as never)) return fail("permission_denied", `Session does not allow "${a.scope}"`);
  return { ok: true };
}

export function evaluateActionOtp(
  doc: ActionOtpDoc | undefined, a: { sessionId: string; uid: string; action: OtpAction }, now: number,
): Check {
  if (!doc) return fail("otp_required", "Confirm this action with the customer's OTP first");
  if (doc.sessionId !== a.sessionId || doc.agentId !== a.uid || doc.action !== a.action)
    return fail("permission_denied", "OTP was issued for a different action");
  if (!doc.verifiedAt) return fail("otp_required", "Action OTP not verified");
  if (doc.consumedAt) return fail("otp_required", "Action OTP already used");
  if (now - doc.verifiedAt > ACTION_OTP_FRESH_MS) return fail("otp_required", "Action OTP expired");
  return { ok: true };
}

export async function requireSession(args: RequireSessionArgs): Promise<SessionContext> {
  const now = Date.now();
  const sRef = col("sessions").doc(args.sessionId);
  const snap = await sRef.get();
  const session = snap.exists ? (snap.data() as SessionDoc) : undefined;
  const res = evaluateSession(session, args, now);
  if (!res.ok) {
    if (session && session.status === "active" && session.expiresAt <= now) {
      await sRef.update({ status: "expired" }).catch(() => undefined);
    }
    throw new DeskError(res.code, res.message);
  }
  const s = session as SessionDoc;

  if (args.action) {
    if (!args.actionId) throw new DeskError("otp_required", "Confirm this action with the customer's OTP first");
    const aRef = col("actionOtps").doc(args.actionId);
    // Re-check and consume atomically so one OTP can authorise exactly one action.
    await db().runTransaction(async (tx) => {
      const aSnap = await tx.get(aRef);
      const check = evaluateActionOtp(
        aSnap.exists ? (aSnap.data() as ActionOtpDoc) : undefined,
        { sessionId: args.sessionId, uid: args.uid, action: args.action as OtpAction }, Date.now());
      if (!check.ok) throw new DeskError(check.code, check.message);
      tx.update(aRef, { consumedAt: Date.now() });
    });
  }
  return {
    sessionId: s.sessionId, agentId: s.agentId, entityKey: s.entityKey,
    product: parseEntityKey(s.entityKey).product, scopes: s.scopes, expiresAt: s.expiresAt,
  };
}
