/** Pure helpers for the Support screen. No imports, so they run under node's test runner as well as Vite. */
export interface SupportItem {
  id: string; entityKey: string; category: string; notes: string; createdAt: number;
  confirmedAt?: number; codeExpiresAt: number; codeAttempts: number;
}
export type ConfirmationState = "confirmed" | "awaiting" | "expired" | "locked";

/** Wrong codes allowed per visit (mirrors the backend's MAX_OTP_ATTEMPTS). */
export const MAX_CODE_ATTEMPTS = 5;

export function confirmationState(i: Pick<SupportItem, "confirmedAt" | "codeExpiresAt" | "codeAttempts">, now: number): ConfirmationState {
  if (i.confirmedAt) return "confirmed";
  if (i.codeAttempts >= MAX_CODE_ATTEMPTS) return "locked";
  if (i.codeExpiresAt <= now) return "expired";
  return "awaiting";
}

export const STATE_LABEL: Record<ConfirmationState, { tone: "green" | "amber" | "gray" | "red"; text: string }> = {
  confirmed: { tone: "green", text: "Customer confirmed" },
  awaiting: { tone: "amber", text: "Waiting for the customer's code" },
  expired: { tone: "gray", text: "Code expired" },
  locked: { tone: "red", text: "Too many wrong codes" },
};

export const CATEGORY_LABEL: Record<string, string> = {
  setup: "Setup", import: "Importing data", sms: "SMS", payments: "Payments", reports: "Reports", other: "Other",
};
export const categoryLabel = (c: string): string => CATEGORY_LABEL[c] ?? c;

export const NOTES_MIN = 5;
export const NOTES_MAX = 1000;
export const notesProblem = (notes: string): string | null => {
  const n = notes.trim().length;
  return n < NOTES_MIN ? `Describe what you helped with (at least ${NOTES_MIN} characters)` : n > NOTES_MAX ? `Notes are too long (maximum ${NOTES_MAX} characters)` : null;
};

export const isConfirmationCode = (v: string): boolean => /^\d{6}$/.test(v.trim());

/** Reads a support document into the fields the screen needs. The confirmation code's hash and anything money-related are never copied. */
export function toSupportItem(id: string, d: Record<string, unknown>): SupportItem {
  const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
  return {
    id,
    entityKey: typeof d.entityKey === "string" ? d.entityKey : "",
    category: typeof d.category === "string" ? d.category : "other",
    notes: typeof d.notes === "string" ? d.notes : "",
    createdAt: num(d.createdAt, 0),
    ...(typeof d.customerConfirmedAt === "number" ? { confirmedAt: d.customerConfirmedAt } : {}),
    codeExpiresAt: num(d.codeExpiresAt, 0),
    codeAttempts: num(d.codeAttempts, 0),
  };
}
