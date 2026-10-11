/** Pure helpers for the Account screens (no React, no network, no Firebase). */
import { DOC_CONTENT_TYPES, DOC_MAX_BYTES } from "../../api/contract";
import type { DocKind } from "../../api/contract";

export type DocContentType = (typeof DOC_CONTENT_TYPES)[number];

export const MIN_PASSWORD_LENGTH = 8;
export const RESET_COOLDOWN_MS = 60_000;

export const isEmail = (s: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());
export const sameEmail = (a: string | null | undefined, b: string | null | undefined): boolean =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

// ---------------------------------------------------------------- email change
export interface EmailChangeErrors { email?: string; password?: string }
export function validateEmailChange(input: { currentEmail: string | null; newEmail: string; password: string }): { ok: boolean; errors: EmailChangeErrors; email: string } {
  const errors: EmailChangeErrors = {};
  const email = input.newEmail.trim().toLowerCase();
  if (!isEmail(email)) errors.email = "Enter a valid email address.";
  else if (sameEmail(email, input.currentEmail)) errors.email = "That is already your sign-in email.";
  if (!input.password) errors.password = "Enter your current password.";
  return { ok: Object.keys(errors).length === 0, errors, email };
}

// ---------------------------------------------------------------- password change
export interface PasswordErrors { current?: string; next?: string; confirm?: string }
export function validatePasswordChange(input: { current: string; next: string; confirm: string }): { ok: boolean; errors: PasswordErrors } {
  const errors: PasswordErrors = {};
  if (!input.current) errors.current = "Enter your current password.";
  if (input.next.length < MIN_PASSWORD_LENGTH) errors.next = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  else if (input.next === input.current) errors.next = "Choose a password you have not used just now.";
  if (input.confirm !== input.next) errors.confirm = "The two passwords do not match.";
  return { ok: Object.keys(errors).length === 0, errors };
}

/** Cooldown left (ms) before another reset / verification mail may be requested. */
export const cooldownLeft = (lastAt: number | null, now: number, windowMs = RESET_COOLDOWN_MS): number =>
  lastAt === null ? 0 : Math.max(0, lastAt + windowMs - now);

// ---------------------------------------------------------------- Firebase Auth errors -> words
export function authErrorMessage(code: string | undefined): string {
  switch (code) {
    case "auth/wrong-password":
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials": return "That password is not correct.";
    case "auth/too-many-requests": return "Too many attempts. Wait a few minutes and try again.";
    case "auth/email-already-in-use": return "Another account already uses that email.";
    case "auth/invalid-email": return "That email address is not valid.";
    case "auth/weak-password": return "That password is too weak. Use a longer one.";
    case "auth/requires-recent-login": return "For your security, please sign in again and retry.";
    case "auth/network-request-failed": return "Network problem. Check your connection and try again.";
    case "auth/operation-not-allowed": return "Changing the sign-in email is not enabled for this project yet. Please contact Samuhia.";
    case "auth/unauthorized-continue-uri": return "The verification link could not be created. Please contact Samuhia.";
    case "auth/user-token-expired":
    case "auth/user-disabled":
    case "auth/user-not-found": return "Your sign-in has expired. Please sign in again.";
    default: return "Something went wrong. Please try again.";
  }
}

// ---------------------------------------------------------------- pending email marker
// Firebase does not tell the browser which address is waiting for verification, so we remember it per user.
export interface PendingEmail { email: string; sentAt: number }
export type KeyValueStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const pendingKey = (uid: string) => `desk.pendingEmail.${uid}`;

export function readPending(store: KeyValueStore | null, uid: string): PendingEmail | null {
  try {
    const raw = store?.getItem(pendingKey(uid));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<PendingEmail>;
    return typeof v.email === "string" && isEmail(v.email) && typeof v.sentAt === "number" ? { email: v.email, sentAt: v.sentAt } : null;
  } catch { return null; }
}
export function writePending(store: KeyValueStore | null, uid: string, p: PendingEmail): void {
  try { store?.setItem(pendingKey(uid), JSON.stringify(p)); } catch { /* private mode: the marker is a convenience only */ }
}
export function clearPending(store: KeyValueStore | null, uid: string): void {
  try { store?.removeItem(pendingKey(uid)); } catch { /* ignore */ }
}

// ---------------------------------------------------------------- documents
export const DOC_LABEL: Record<DocKind, string> = { id_front: "ID card — front", id_back: "ID card — back", selfie: "Selfie holding your ID" };
export const DOC_HINT: Record<DocKind, string> = {
  id_front: "A clear photo or PDF of the front of your national ID.",
  id_back: "A clear photo or PDF of the back of your national ID.",
  selfie: "A recent photo of your face. Photos only (JPG, PNG or WebP).",
};

/** Identify the real file type from its first bytes; the browser's `file.type` comes from the extension and can lie. */
export function sniffContentType(b: Uint8Array): DocContentType | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  if (b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) return "application/pdf";
  return null;
}

export const formatBytes = (n: number): string =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`;

export type DocCheck = { ok: true; contentType: DocContentType } | { ok: false; error: string };
export function checkDocFile(kind: DocKind, sizeBytes: number, head: Uint8Array): DocCheck {
  if (sizeBytes <= 0) return { ok: false, error: "That file is empty." };
  if (sizeBytes > DOC_MAX_BYTES) return { ok: false, error: `That file is ${formatBytes(sizeBytes)}. The limit is ${formatBytes(DOC_MAX_BYTES)}.` };
  const contentType = sniffContentType(head);
  if (!contentType) return { ok: false, error: "Use a JPG, PNG, WebP or PDF file." };
  if (kind === "selfie" && contentType === "application/pdf") return { ok: false, error: "The selfie must be a photo (JPG, PNG or WebP)." };
  return { ok: true, contentType };
}

export const ACCOUNT_LABEL: Record<string, string> = {
  main: "Main account", chama: "MyChama account", school: "MyRegister account", pms: "Plot Yangu account",
};
export const ACCOUNT_NOTE: Record<string, string> = {
  main: "Used for desk services, MyRegister and Plot Yangu.",
  chama: "MyChama is paid through its own Paystack account.",
  school: "MyRegister is paid through its own Paystack account.",
  pms: "Plot Yangu is paid through its own Paystack account.",
};
