/** Pure helpers for manual entry. The account defines its own field names, so the agent names the fields once and types records. */
import type { ImportRow } from "../../api/contract";
import type { WorkRow } from "../../access/service/records";
import { MAX_COLUMNS } from "../import/table";

export const MAX_FIELD_LENGTH = 60;

export const cleanFields = (fields: readonly string[]): string[] => fields.map((f) => f.trim().replace(/\s+/g, " ")).filter((f) => f !== "");

/** null when the field list can be used, otherwise a message for the agent. */
export function fieldsProblem(fields: readonly string[]): string | null {
  const f = cleanFields(fields);
  if (f.length === 0) return "Add at least one field.";
  if (f.length > MAX_COLUMNS) return `Use at most ${MAX_COLUMNS} fields.`;
  const seen = new Set<string>();
  for (const name of f) {
    if (name.length > MAX_FIELD_LENGTH) return `“${name.slice(0, 20)}…” is too long (${MAX_FIELD_LENGTH} characters at most).`;
    if (seen.has(name.toLowerCase())) return `The field “${name}” appears twice.`;
    seen.add(name.toLowerCase());
  }
  return null;
}

export const emptyValues = (fields: readonly string[]): ImportRow => Object.fromEntries(fields.map((f) => [f, null]));

/** True when no field holds anything. */
export const isBlank = (r: WorkRow): boolean => Object.values(r.values).every((v) => v === null || String(v).trim() === "");

/** Re-shape records to a changed field list: kept fields keep their values, new fields start empty, removed fields are dropped. */
export function reshape(rows: readonly WorkRow[], fields: readonly string[]): WorkRow[] {
  return rows.map((r) => ({ line: r.line, values: Object.fromEntries(fields.map((f) => [f, r.values[f] ?? null])) }));
}

/** Typed text -> stored value (blank becomes null). */
export const toValue = (text: string): string | null => (text.trim() === "" ? null : text);

// ---- remembered field names (not sensitive: only the labels, per product), so repeat work starts ready
const key = (product: string) => `desk.manual.fields.v1:${product}`;

export function loadSavedFields(product: string): string[] | null {
  try {
    const raw = window.localStorage.getItem(key(product));
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((x) => typeof x === "string")) return parsed as string[];
  } catch { /* storage blocked or corrupt: start empty */ }
  return null;
}
export function saveFields(product: string, fields: readonly string[]): void {
  try { window.localStorage.setItem(key(product), JSON.stringify(fields)); } catch { /* not remembering is fine */ }
}
