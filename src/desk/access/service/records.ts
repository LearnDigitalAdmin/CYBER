/**
 * The contract does not say whether ImportError.row counts from 0 or from 1. Rather than guess silently and put an error
 * on the wrong person, work it out from the evidence in the response, and fall back to 1 (the number a human would use).
 */
import type { ImportError, ImportRow } from "../../api/contract";

/** One record being prepared. `line` is a stable id (its line in the sheet, or its position in the manual list). */
export interface WorkRow { line: number; values: ImportRow }

export type RowBase = 0 | 1;

function similar(a: ImportRow, b: ImportRow): boolean {
  const keys = Object.keys(a).filter((k) => a[k] !== null && a[k] !== "");
  if (keys.length === 0) return false;
  const same = keys.filter((k) => b[k] !== undefined && b[k] !== null && String(b[k]).trim() === String(a[k]).trim()).length;
  return same / keys.length >= 0.5;
}

export function inferRowBase(errors: ImportError[], submitted: ImportRow[], valid: ImportRow[]): RowBase {
  const rows = [...new Set(errors.map((e) => e.row))];
  if (rows.length === 0) return 1;
  const n = submitted.length;
  const min = Math.min(...rows); const max = Math.max(...rows);
  const zero = min >= 0 && max <= n - 1;
  const one = min >= 1 && max <= n;
  if (zero && !one) return 0;
  if (one && !zero) return 1;
  if (!zero && !one) return 1;
  // Both fit: the rows the product accepted should line up, in order, with the rows that have no errors.
  if (valid.length !== n - rows.length) return 1;
  const score = (base: RowBase): number => {
    const bad = new Set(rows.map((r) => r - base));
    const good: ImportRow[] = submitted.filter((_, i) => !bad.has(i));
    return good.reduce((acc, row, j) => acc + (valid[j] && similar(row, valid[j]) ? 1 : 0), 0);
  };
  return score(0) > score(1) ? 0 : 1;
}

export interface GroupedErrors { byIndex: Map<number, ImportError[]>; unmatched: ImportError[] }

/** Errors keyed by index into the submitted rows; anything pointing outside the rows is returned in `unmatched`. */
export function groupErrors(errors: ImportError[], base: RowBase, rowCount: number): GroupedErrors {
  const byIndex = new Map<number, ImportError[]>(); const unmatched: ImportError[] = [];
  for (const e of errors) {
    const i = e.row - base;
    if (!Number.isInteger(i) || i < 0 || i >= rowCount) { unmatched.push(e); continue; }
    byIndex.set(i, [...(byIndex.get(i) ?? []), e]);
  }
  return { byIndex, unmatched };
}
