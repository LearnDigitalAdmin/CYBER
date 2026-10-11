/**
 * Per-action OTP for the top desk. The executing callable recomputes the summary from its own inputs and the stored one must
 * equal it; the OTP is verified and CONSUMED inside the same Firestore transaction that applies the action's own writes
 * (or, for a multi-step action like a payout, before the first step), so a code can authorise exactly one action.
 */
import type { Transaction } from "firebase-admin/firestore";
import type { TopAction } from "../contract.js";
import { col, db } from "../db.js";
import { DeskError } from "../errors.js";
import { evaluateOtpAttempt, isOtpShape, wrongCodeMessage } from "../otp/core.js";
import type { TopOtpDoc } from "../types.js";

export interface TopOtpArgs { uid: string; actionId: unknown; otp: unknown; action: TopAction; expectedSummary: string }

export type TopOtpVerdict =
  | { kind: "ok"; attempts: number } | { kind: "missing" } | { kind: "foreign" } | { kind: "mismatch" } | { kind: "used" }
  | { kind: "expired" } | { kind: "locked" } | { kind: "wrong"; attempts: number; locked: boolean };

/** Pure decision. The summary/action check comes first and does not count as an attempt. */
export function evaluateTopOtp(
  doc: TopOtpDoc | undefined, a: { uid: string; action: TopAction; expectedSummary: string; otp: string; actionId: string }, now: number,
): TopOtpVerdict {
  if (!doc) return { kind: "missing" };
  if (doc.uid !== a.uid) return { kind: "foreign" };
  if (doc.action !== a.action || doc.summary !== a.expectedSummary) return { kind: "mismatch" };
  if (doc.consumedAt) return { kind: "used" };
  const r = evaluateOtpAttempt({ hash: doc.otpHash, attempts: doc.otpAttempts, expiresAt: doc.otpExpiresAt }, a.otp, a.actionId, now);
  return r.kind === "ok" ? { kind: "ok", attempts: r.attempts } : r;
}

export function throwForVerdict(v: Exclude<TopOtpVerdict, { kind: "ok" }>): never {
  switch (v.kind) {
    case "missing": throw new DeskError("otp_required", "Request a confirmation code first");
    case "foreign": throw new DeskError("permission_denied", "This code was issued to another account");
    case "mismatch": throw new DeskError("permission_denied", "This code was issued for a different action. Request a new one.");
    case "used": throw new DeskError("otp_required", "This code was already used. Request a new one.");
    case "expired": throw new DeskError("otp_invalid", "This code has expired. Request a new one.");
    case "locked": throw new DeskError("otp_invalid", "Too many wrong codes. Request a new confirmation code.");
    case "wrong": throw new DeskError("otp_invalid", wrongCodeMessage(v, "confirmation code"));
  }
}

/**
 * `reads` runs first (a transaction must read before it writes); `writes` runs only if the code is right and applies the
 * action together with the consumption of the OTP. Business refusals thrown from `reads` leave the code untouched.
 */
export async function runWithTopOtp<R, T>(
  a: TopOtpArgs, now: number, reads: (tx: Transaction) => Promise<R>, writes: (tx: Transaction, r: R) => T,
): Promise<T> {
  if (typeof a.actionId !== "string" || !a.actionId) throw new DeskError("invalid_argument", "Request a confirmation code first");
  if (!isOtpShape(a.otp)) throw new DeskError("invalid_argument", "Enter the 6-digit code");
  const actionId = a.actionId; const otp = (a.otp as string).trim();
  const ref = col("topOtps").doc(actionId);

  const out = await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const r = await reads(tx);
    const verdict = evaluateTopOtp(snap.exists ? (snap.data() as TopOtpDoc) : undefined, { uid: a.uid, action: a.action, expectedSummary: a.expectedSummary, otp, actionId }, now);
    if (verdict.kind === "wrong") {
      tx.update(ref, verdict.locked ? { otpAttempts: verdict.attempts, otpExpiresAt: now } : { otpAttempts: verdict.attempts });
      return { verdict } as const;
    }
    if (verdict.kind !== "ok") return { verdict } as const;
    tx.update(ref, { otpAttempts: verdict.attempts, verifiedAt: now, consumedAt: now });
    return { verdict, value: writes(tx, r) } as const;
  });
  if (out.verdict.kind !== "ok") throwForVerdict(out.verdict);
  return (out as { value: T }).value;
}
