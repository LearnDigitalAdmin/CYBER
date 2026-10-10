import { DeskError } from "../errors.js";

/** Callable payloads arrive untyped; every handler narrows them here before touching anything. */
export function record(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new DeskError("invalid_argument", "The request is not valid");
  return v as Record<string, unknown>;
}

/** Trimmed string with a length range. A `min` of 0 allows empty. */
export function text(v: unknown, label: string, min: number, max: number): string {
  if (typeof v !== "string") throw new DeskError("invalid_argument", `${label} is required`);
  const t = v.trim();
  if (t.length < min || t.length > max) {
    throw new DeskError("invalid_argument", min <= 1 ? `${label} must be 1–${max} characters` : `${label} must be ${min}–${max} characters`);
  }
  return t;
}

export function digits(v: unknown, label: string, len: number): string {
  if (typeof v !== "string" || !new RegExp(`^\\d{${len}}$`).test(v.trim())) {
    throw new DeskError("invalid_argument", `${label} must be ${len} digits`);
  }
  return v.trim();
}
