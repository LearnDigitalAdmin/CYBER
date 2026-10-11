/** Pure helpers that turn a parsed sheet into import rows. Everything stays text: a phone number must keep its leading zero. */
import type { ImportRow } from "../../api/contract";
import type { WorkRow } from "../../access/service/records";

export const MAX_IMPORT_ROWS = 5000;
export const MAX_COLUMNS = 60;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export function cellToString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return "";
    const iso = v.toISOString();
    return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso;
  }
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v).replace(/\u00a0/g, " ").trim();
}

/** Text grid with equal row width, no empty trailing columns and no fully empty rows. Returns the original line (1-based) of each row. */
export function normaliseGrid(raw: readonly (readonly unknown[])[]): { grid: string[][]; lines: number[] } {
  const grid: string[][] = []; const lines: number[] = [];
  raw.forEach((r, i) => {
    const cells = r.map(cellToString);
    if (cells.some((c) => c !== "")) { grid.push(cells); lines.push(i + 1); }
  });
  let width = 0;
  for (const r of grid) {
    let w = r.length;
    while (w > 0 && r[w - 1] === "") w--;
    width = Math.max(width, w);
  }
  return { grid: grid.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? "")), lines };
}

/** A first row of text labels (no phone-like or purely numeric cells) is probably a header. */
export function guessHasHeader(grid: string[][]): boolean {
  const first = grid[0];
  if (!first || first.every((c) => c === "")) return false;
  return !first.some((c) => /^\+?\d[\d\s-]{5,}$/.test(c));
}

export interface ColumnMap { index: number; header: string; field: string; include: boolean; samples: string[] }

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/** One entry per column: field name defaults to the header as written (the product defines its own names); duplicates get _2, _3. */
export function buildColumns(grid: string[][], hasHeader: boolean): ColumnMap[] {
  const width = grid[0]?.length ?? 0;
  const body = hasHeader ? grid.slice(1) : grid;
  const used = new Map<string, number>();
  const cols: ColumnMap[] = [];
  for (let i = 0; i < width; i++) {
    const header = hasHeader ? clean(grid[0][i] ?? "") : "";
    const base = header || `column_${i + 1}`;
    const n = (used.get(base.toLowerCase()) ?? 0) + 1;
    used.set(base.toLowerCase(), n);
    const samples = body.map((r) => r[i]).filter((v) => v !== "").slice(0, 3);
    cols.push({ index: i, header: header || `Column ${i + 1}`, field: n === 1 ? base : `${base}_${n}`, include: samples.length > 0, samples });
  }
  return cols;
}

/** null when the mapping can be used, otherwise a message for the agent. */
export function mappingProblem(cols: ColumnMap[]): string | null {
  const inc = cols.filter((c) => c.include);
  if (inc.length === 0) return "Tick at least one column to import.";
  const seen = new Set<string>();
  for (const c of inc) {
    const f = c.field.trim();
    if (f === "") return `Give “${c.header}” a field name, or untick it.`;
    if (f.length > 60) return `The field name for “${c.header}” is too long (60 characters at most).`;
    if (seen.has(f.toLowerCase())) return `Two columns use the field name “${f}”. Each field can come from one column only.`;
    seen.add(f.toLowerCase());
  }
  return null;
}

/** Rows for the ticked columns. Skips rows where every ticked cell is empty. `lines` are the sheet's own line numbers. */
export function buildRows(grid: string[][], lines: number[], hasHeader: boolean, cols: ColumnMap[]): WorkRow[] {
  const inc = cols.filter((c) => c.include);
  const out: WorkRow[] = [];
  for (let r = hasHeader ? 1 : 0; r < grid.length; r++) {
    const values: ImportRow = {};
    let any = false;
    for (const c of inc) {
      const v = grid[r][c.index] ?? "";
      if (v !== "") any = true;
      values[c.field.trim()] = v === "" ? null : v;
    }
    if (any) out.push({ line: lines[r] ?? r + 1, values });
  }
  return out;
}
