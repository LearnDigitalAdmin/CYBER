/**
 * One implementation of the OTP rules shared by access sessions, per-action OTPs and support confirmation codes:
 * sha256(otp:id) storage, constant-time compare, at most 5 attempts, expiry. Plus a rolling-window rate limiter kept in
 * `desk_counters` (server-only), so limits hold across instances without extra indexes.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { col, db } from "../db.js";
import { DeskError } from "../errors.js";

export const OTP_TTL_MS = 5 * 60_000;
export const SESSION_TTL_MS = 60 * 60_000;
export const MAX_OTP_ATTEMPTS = 5;
export const ACCESS_REQUESTS_PER_HOUR = 3;
export const OTP_MESSAGES_PER_ENTITY_PER_DAY = 10;
const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;

export const isOtpShape = (v: unknown): v is string => typeof v === "string" && /^\d{6}$/.test(v.trim());

/** Only the hash is stored: sha256("<otp>:<id>"). */
export const hashOtp = (otp: string, id: string): string => createHash("sha256").update(`${otp}:${id}`).digest("hex");

export function otpMatches(storedHashHex: string | undefined, otp: string, id: string): boolean {
  if (!storedHashHex || !/^[0-9a-f]{64}$/.test(storedHashHex)) return false;
  const a = Buffer.from(storedHashHex, "hex");
  const b = Buffer.from(hashOtp(otp, id), "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export type AttemptResult =
  | { kind: "ok"; attempts: number }
  | { kind: "wrong"; attempts: number; locked: boolean }
  | { kind: "expired" }
  | { kind: "locked" };

/** Pure decision for one OTP attempt. A correct code on the 5th try still counts. */
export function evaluateOtpAttempt(
  state: { hash?: string; attempts: number; expiresAt: number }, otp: string, id: string, now: number,
): AttemptResult {
  if (state.attempts >= MAX_OTP_ATTEMPTS) return { kind: "locked" };
  if (state.expiresAt <= now) return { kind: "expired" };
  const attempts = state.attempts + 1;
  if (otpMatches(state.hash, otp, id)) return { kind: "ok", attempts };
  return { kind: "wrong", attempts, locked: attempts >= MAX_OTP_ATTEMPTS };
}

export function wrongCodeMessage(r: Extract<AttemptResult, { kind: "wrong" }>, what: string): string {
  return r.locked
    ? `Too many wrong codes. Request a new ${what}.`
    : `That code is not correct. ${MAX_OTP_ATTEMPTS - r.attempts} ${MAX_OTP_ATTEMPTS - r.attempts === 1 ? "try" : "tries"} left.`;
}

// ------------------------------------------------------------------ rate limiting
export interface RateRule { key: string; limit: number; windowMs: number; message: (retryAfterMs: number) => string }
export interface RateTaken { release(): Promise<void> }

const rateDocId = (key: string): string => `rl_${createHash("sha256").update(key).digest("hex").slice(0, 40)}`;
const minutes = (ms: number): number => Math.max(1, Math.ceil(ms / 60_000));

/** Rolling-window slot: true and recorded, or false with how long until a slot frees up. */
async function takeOne(rule: RateRule, now: number): Promise<{ ok: true; stamp: number } | { ok: false; retryAfterMs: number }> {
  const ref = col("counters").doc(rateDocId(rule.key));
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const stamps = ((snap.data()?.stamps as number[] | undefined) ?? []).filter((t) => t > now - rule.windowMs);
    if (stamps.length >= rule.limit) return { ok: false as const, retryAfterMs: Math.min(...stamps) + rule.windowMs - now };
    stamps.push(now);
    tx.set(ref, { stamps, updatedAt: now });
    return { ok: true as const, stamp: now };
  });
}

async function releaseOne(rule: RateRule, stamp: number): Promise<void> {
  const ref = col("counters").doc(rateDocId(rule.key));
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const stamps = (snap.data()?.stamps as number[] | undefined) ?? [];
    const i = stamps.indexOf(stamp);
    if (i < 0) return;
    stamps.splice(i, 1);
    tx.set(ref, { stamps, updatedAt: Date.now() });
  });
}

/** Takes a slot in every rule or none (a later refusal releases the earlier slots). */
export async function takeRates(rules: readonly RateRule[], now: number): Promise<RateTaken> {
  const taken: { rule: RateRule; stamp: number }[] = [];
  const release = async () => { for (const t of taken) await releaseOne(t.rule, t.stamp).catch(() => undefined); };
  for (const rule of rules) {
    const r = await takeOne(rule, now);
    if (!r.ok) {
      await release();
      throw new DeskError("failed_precondition", rule.message(r.retryAfterMs));
    }
    taken.push({ rule, stamp: r.stamp });
  }
  return { release };
}

/** The per-entity daily cap on codes sent to a customer admin (access OTPs, action OTPs and support codes share it). */
export const entityDailyRule = (entityKey: string): RateRule => ({
  key: `otp-day:${entityKey}`, limit: OTP_MESSAGES_PER_ENTITY_PER_DAY, windowMs: DAY_MS,
  message: () => "Too many codes have been sent to this customer today. Please try again tomorrow.",
});

export const accessHourRule = (uid: string, entityKey: string): RateRule => ({
  key: `access-hour:${uid}:${entityKey}`, limit: ACCESS_REQUESTS_PER_HOUR, windowMs: HOUR_MS,
  message: (ms) => `You have asked this customer for access too many times. Try again in ${minutes(ms)} minute${minutes(ms) === 1 ? "" : "s"}.`,
});
