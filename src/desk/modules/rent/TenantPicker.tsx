import { useCallback, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { callDesk, formatKes } from "../../api";
import { Card, DataTable, EmptyState, FormField, buttonClass, inputClass, type Column } from "../../ui";
import { messageOf } from "../comms/lib/messages";
import { MAX_TENANTS, mergePage, selectMany, toggleTenant, type Selection, type Tenant } from "./rentLogic";

type Page = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; tenants: Tenant[]; nextCursor?: string; loadingMore: boolean; moreError?: string };

/** Pages through the landlord's tenants (search, load more) while the chosen tenants persist across searches. */
export function TenantPicker({ sessionId, selection, onSelection }: { sessionId: string; selection: Selection; onSelection: (s: Selection) => void }) {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState<Page>({ status: "loading" });
  const [note, setNote] = useState<string | null>(null);
  const token = useRef(0);

  useEffect(() => { const t = setTimeout(() => setQuery(input.trim()), 350); return () => clearTimeout(t); }, [input]);

  const load = useCallback(async () => {
    const mine = ++token.current;
    setPage({ status: "loading" });
    try {
      const out = await callDesk("desk_listTenants", { sessionId, ...(query ? { query } : {}) });
      if (mine === token.current) setPage({ status: "ready", tenants: out.tenants, nextCursor: out.nextCursor, loadingMore: false });
    } catch (e) { if (mine === token.current) setPage({ status: "error", message: messageOf(e) }); }
  }, [sessionId, query]);
  useEffect(() => { void load(); }, [load]);

  async function more() {
    if (page.status !== "ready" || !page.nextCursor || page.loadingMore) return;
    const mine = token.current;
    setPage({ ...page, loadingMore: true, moreError: undefined });
    try {
      const out = await callDesk("desk_listTenants", { sessionId, cursor: page.nextCursor, ...(query ? { query } : {}) });
      if (mine === token.current) setPage((p) => (p.status === "ready" ? { status: "ready", tenants: mergePage(p.tenants, out.tenants), nextCursor: out.nextCursor, loadingMore: false } : p));
    } catch (e) { if (mine === token.current) setPage((p) => (p.status === "ready" ? { ...p, loadingMore: false, moreError: messageOf(e) } : p)); }
  }

  const toggle = (t: Tenant) => {
    const r = toggleTenant(selection, t);
    setNote(r.limited ? `A rent request can include at most ${MAX_TENANTS} tenants.` : null);
    onSelection(r.selection);
  };
  const selectShown = (tenants: Tenant[]) => {
    const r = selectMany(selection, tenants);
    setNote(r.skipped > 0 ? `${r.skipped} tenant${r.skipped === 1 ? " was" : "s were"} left out: a rent request can include at most ${MAX_TENANTS} tenants.` : null);
    onSelection(r.selection);
  };

  const columns: Column<Tenant>[] = [
    {
      key: "name", header: "Tenant", primary: true,
      cell: (t) => (
        <label className="flex min-w-0 cursor-pointer items-center gap-3">
          <input type="checkbox" className="h-5 w-5 shrink-0" checked={selection.has(t.tenantId)} onChange={() => toggle(t)} aria-label={`Select ${t.name}`} />
          <span className="min-w-0 break-words">{t.name}</span>
        </label>
      ),
    },
    { key: "unit", header: "Unit", cell: (t) => t.unit || "—" },
    { key: "phone", header: "Phone", cell: (t) => t.phoneMasked },
    { key: "due", header: "Rent due", align: "right", cell: (t) => (t.rentDueMinor === undefined ? "—" : formatKes(t.rentDueMinor)) },
  ];

  return (
    <Card title="Choose tenants">
      <div className="min-w-0 space-y-4">
        <FormField label="Search by name or unit" htmlFor="tenant-search">
          <div className="relative min-w-0">
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input id="tenant-search" type="search" className={`${inputClass} pl-10`} value={input} onChange={(e) => setInput(e.target.value)} />
          </div>
        </FormField>
        {note && <p role="alert" className="break-words text-sm text-amber-800">{note}</p>}
        {page.status === "loading" && <p className="py-6 text-center text-sm text-gray-500" role="status">Loading tenants…</p>}
        {page.status === "error" && (
          <div className="min-w-0"><p role="alert" className="break-words text-sm text-red-700">{page.message}</p>
            <button type="button" className={`${buttonClass.secondary} mt-3`} onClick={() => void load()}>Try again</button></div>
        )}
        {page.status === "ready" && (
          <>
            <DataTable columns={columns} rows={page.tenants} rowKey={(t) => t.tenantId}
              empty={<EmptyState title={query ? "No tenants match your search" : "No tenants yet"} body={query ? "Try a different name or unit." : "This landlord has no tenants to collect rent from."} />} />
            {page.tenants.length > 0 && (
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                <button type="button" className={buttonClass.secondary} onClick={() => selectShown(page.tenants)}>Select all shown</button>
                {page.nextCursor && <button type="button" className={buttonClass.secondary} disabled={page.loadingMore} onClick={() => void more()}>{page.loadingMore ? "Loading…" : "Load more tenants"}</button>}
              </div>
            )}
            {page.moreError && <p role="alert" className="break-words text-sm text-red-700">{page.moreError}</p>}
          </>
        )}
      </div>
    </Card>
  );
}
