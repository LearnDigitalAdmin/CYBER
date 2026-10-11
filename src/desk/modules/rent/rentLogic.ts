/** Pure helpers for rent collection: the tenant selection and how a batch's results read per tenant. No imports. */
export const MAX_TENANTS = 200;

export interface Tenant { tenantId: string; name: string; unit: string; phoneMasked: string; rentDueMinor?: number }
export type Selection = ReadonlyMap<string, Tenant>;

export const toggleTenant = (sel: Selection, t: Tenant): { selection: Selection; limited: boolean } => {
  const next = new Map(sel);
  if (next.has(t.tenantId)) { next.delete(t.tenantId); return { selection: next, limited: false }; }
  if (next.size >= MAX_TENANTS) return { selection: sel, limited: true };
  next.set(t.tenantId, t);
  return { selection: next, limited: false };
};

/** Adds as many as fit under the cap; `skipped` counts those left out. */
export const selectMany = (sel: Selection, tenants: readonly Tenant[]): { selection: Selection; skipped: number } => {
  const next = new Map(sel);
  let skipped = 0;
  for (const t of tenants) {
    if (next.has(t.tenantId)) continue;
    if (next.size >= MAX_TENANTS) { skipped++; continue; }
    next.set(t.tenantId, t);
  }
  return { selection: next, skipped };
};

/** Appends a page, keeping the first copy of any tenant seen twice (pages can overlap when the data moves). */
export const mergePage = (existing: readonly Tenant[], page: readonly Tenant[]): Tenant[] => {
  const seen = new Set(existing.map((t) => t.tenantId));
  return [...existing, ...page.filter((t) => !seen.has(t.tenantId))];
};

export type BatchStatus = "requested" | "processing" | "done" | "failed";
export interface BatchResult { tenantId: string; reference?: string; status: "sent" | "failed"; error?: string }
export type RowState = "sent" | "failed" | "waiting" | "no_result";
export interface BatchRow { tenantId: string; state: RowState; reference?: string; error?: string }
export interface BatchSummary { rows: BatchRow[]; sent: number; failed: number; waiting: number; noResult: number; finished: boolean }

/** One row per requested tenant. A finished batch with no result for a tenant says so rather than pretending it succeeded. */
export function summariseBatch(tenantIds: readonly string[], results: readonly BatchResult[], status: BatchStatus): BatchSummary {
  const byTenant = new Map(results.map((r) => [r.tenantId, r]));
  const finished = status === "done" || status === "failed";
  const rows: BatchRow[] = tenantIds.map((tenantId) => {
    const r = byTenant.get(tenantId);
    if (r) return { tenantId, state: r.status, ...(r.reference ? { reference: r.reference } : {}), ...(r.error ? { error: r.error } : {}) };
    return { tenantId, state: finished ? "no_result" : "waiting" };
  });
  const count = (s: RowState) => rows.filter((r) => r.state === s).length;
  return { rows, sent: count("sent"), failed: count("failed"), waiting: count("waiting"), noResult: count("no_result"), finished };
}
