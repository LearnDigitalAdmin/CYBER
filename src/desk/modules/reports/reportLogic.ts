/** Pure helpers for the Reports screen. No imports, so they run under node's test runner as well as Vite. */
export interface OptionRow { name: string; value: string }
export type OptionsResult = { ok: true; params: Record<string, string> } | { ok: false; error: string };

const NAME = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
export const MAX_OPTIONS = 20;
export const MAX_OPTION_VALUE = 200;

/**
 * The customer's service defines what a report accepts and entity info carries no parameter list, so options are free
 * name/value pairs sent as text. Same limits the server enforces. Fully blank rows are ignored.
 */
export function parseOptionRows(rows: readonly OptionRow[]): OptionsResult {
  const params: Record<string, string> = {};
  for (const r of rows) {
    const name = r.name.trim();
    const value = r.value.trim();
    if (!name && !value) continue;
    if (!name) return { ok: false, error: "Every option needs a name" };
    if (!NAME.test(name)) return { ok: false, error: `“${name.slice(0, 40)}” is not a valid option name (letters, digits and underscores, starting with a letter)` };
    if (name in params) return { ok: false, error: `The option “${name}” appears twice` };
    if (value.length > MAX_OPTION_VALUE) return { ok: false, error: `The value for “${name}” is too long (maximum ${MAX_OPTION_VALUE} characters)` };
    params[name] = value;
  }
  if (Object.keys(params).length > MAX_OPTIONS) return { ok: false, error: `Use at most ${MAX_OPTIONS} options` };
  return { ok: true, params };
}

/** The export kinds the desk knows how to ask the customer to approve, in the entity's own order. */
export function offeredExportKinds(offered: readonly string[], known: readonly string[]): string[] {
  return offered.filter((k, i) => known.includes(k) && offered.indexOf(k) === i);
}

export const EXPORT_LABEL: Record<string, string> = { members: "Members", students: "Students", tenants: "Tenants", reports: "Report data" };
export const exportLabel = (kind: string): string => EXPORT_LABEL[kind] ?? kind;

/** "mm:ss" left until a link expires, or null once it has. */
export function formatRemaining(expiresAt: number, now: number): string | null {
  const ms = expiresAt - now;
  if (ms <= 0) return null;
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** One request id per logical run, so a retry after a dropped connection is not charged twice. */
export function runKey(reportType: string, params: Record<string, string>): string {
  return JSON.stringify([reportType, Object.keys(params).sort().map((k) => [k, params[k]])]);
}
