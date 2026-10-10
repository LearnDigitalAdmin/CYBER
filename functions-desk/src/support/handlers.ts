import {
  SUPPORT_CATEGORIES, type ConfirmSupportOut, type LogSupportOut, type SupportCategory,
} from "../contract.js";
import { col, db } from "../db.js";
import { DeskError } from "../errors.js";
import { audit } from "../kernel/audit.js";
import { requireActiveAgent } from "../kernel/agents.js";
import { maskPhone } from "../paystack/phone.js";
import type { SupportDoc } from "../types.js";
import type { Deps } from "../connectors/deps.js";
import {
  adminPhoneE164, assertEntityKey, isSameNumber, lookupEntity, NOT_AUTHORISED_MESSAGE,
} from "../connectors/entities.js";
import { record, text } from "../connectors/input.js";
import { entityDailyRule, evaluateOtpAttempt, hashOtp, isOtpShape, MAX_OTP_ATTEMPTS, takeRates, wrongCodeMessage } from "../otp/core.js";
import { supportSmsText } from "../otp/messages.js";

export const SUPPORT_CODE_TTL_MS = 24 * 60 * 60_000;

/** Logs a support visit and SMSes a 6-digit confirmation code to the customer admin. */
export async function logSupport(deps: Deps, uid: string, raw: unknown): Promise<LogSupportOut> {
  const d = record(raw);
  const agent = await requireActiveAgent(uid);
  const entity = assertEntityKey(typeof d.entityKey === "string" ? d.entityKey : "");
  if (typeof d.category !== "string" || !(SUPPORT_CATEGORIES as readonly string[]).includes(d.category)) {
    throw new DeskError("invalid_argument", "Choose a support category");
  }
  const category = d.category as SupportCategory;
  const notes = text(d.notes, "Notes", 5, 1000);

  const cfg = await deps.getConfig();
  const lookup = await lookupEntity(deps, cfg, agent, entity.product, entity.code);
  if (!lookup.authorised) throw new DeskError("permission_denied", NOT_AUTHORISED_MESSAGE);
  const adminPhone = adminPhoneE164(lookup.info);
  if (isSameNumber(agent.phone, adminPhone)) {
    throw new DeskError("permission_denied", "You cannot log support for an account you administer yourself");
  }

  const taken = await takeRates([entityDailyRule(entity.entityKey)], deps.now());
  const ref = col("support").doc();
  const code = deps.randomOtp();
  const now = deps.now();
  const doc: SupportDoc = {
    id: ref.id, agentId: uid, entityKey: entity.entityKey, category, notes,
    codeHash: hashOtp(code, ref.id), codeAttempts: 0, codeExpiresAt: now + SUPPORT_CODE_TTL_MS, createdAt: now,
  };
  await ref.create(doc);
  try {
    await deps.sendSms(adminPhone, supportSmsText(agent.name, agent.agentCode, lookup.info.displayName, category, code));
  } catch {
    await ref.delete().catch(() => undefined);
    await taken.release();
    throw new DeskError("internal", "We could not send the confirmation code to the customer. Please try again.");
  }
  await audit({ action: "support_logged", agentId: uid, entityKey: entity.entityKey, meta: { id: ref.id, category } });
  return { id: ref.id, codeSentTo: maskPhone(adminPhone) };
}

type Outcome =
  | { kind: "ok"; entityKey: string; already: boolean } | { kind: "missing" } | { kind: "expired" } | { kind: "locked" }
  | { kind: "wrong"; attempts: number; locked: boolean };

export async function confirmSupport(deps: Deps, uid: string, raw: unknown): Promise<ConfirmSupportOut> {
  const d = record(raw);
  const id = typeof d.id === "string" ? d.id : "";
  if (!id) throw new DeskError("invalid_argument", "Support record is required");
  if (!isOtpShape(d.code)) throw new DeskError("invalid_argument", "Enter the 6-digit code");
  const code = (d.code as string).trim();
  const now = deps.now();
  const ref = col("support").doc(id);

  const out = await db().runTransaction(async (tx): Promise<Outcome> => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { kind: "missing" };
    const s = snap.data() as SupportDoc;
    if (s.agentId !== uid) return { kind: "missing" }; // never reveal another desk's record
    if (s.customerConfirmedAt) return { kind: "ok", entityKey: s.entityKey, already: true };
    const r = evaluateOtpAttempt({ hash: s.codeHash, attempts: s.codeAttempts, expiresAt: s.codeExpiresAt }, code, id, now);
    if (r.kind === "locked") return { kind: "locked" };
    if (r.kind === "expired") return { kind: "expired" };
    if (r.kind === "wrong") { tx.update(ref, { codeAttempts: r.attempts }); return r; }
    tx.update(ref, { codeAttempts: r.attempts, customerConfirmedAt: now });
    return { kind: "ok", entityKey: s.entityKey, already: false };
  });

  switch (out.kind) {
    case "ok":
      if (!out.already) await audit({ action: "support_confirmed", agentId: uid, entityKey: out.entityKey, meta: { id } });
      return { ok: true };
    case "missing": throw new DeskError("not_found", "Support record not found");
    case "expired": throw new DeskError("otp_invalid", "This code has expired.");
    case "locked": throw new DeskError("otp_invalid", `Too many wrong codes (${MAX_OTP_ATTEMPTS} allowed). This confirmation can no longer be completed.`);
    case "wrong": throw new DeskError("otp_invalid", wrongCodeMessage(out, "support record"));
  }
}
