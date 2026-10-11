import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { deskApi, DeskApiError, formatDateTime } from "../../api";
import type { AgentStatus, DeskSummaryRow } from "../../api";
import { Badge, Card, DataTable, EmptyState, buttonClass, cn, inputClass } from "../../ui";
import type { Column } from "../../ui";
import Notice from "./Notice";
import ReauthBox from "./ReauthBox";
import { ALL_STATUSES, DESK_LIST_LIMIT, RANK_LABEL, SEARCH_DEBOUNCE_MS, STATUS_LABEL, STATUS_TONE, isStaleSignIn } from "./logic";

export default function DesksList() {
  const [status, setStatus] = useState<AgentStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [rows, setRows] = useState<DeskSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const gen = useRef(0);

  useEffect(() => { const t = window.setTimeout(() => setTerm(search.trim()), SEARCH_DEBOUNCE_MS); return () => window.clearTimeout(t); }, [search]);

  const load = useCallback(async () => {
    const g = ++gen.current;
    setLoading(true); setError(null); setStale(false);
    try {
      const out = await deskApi.top.listDesks({ ...(status === "all" ? {} : { status }), ...(term ? { search: term } : {}), limit: DESK_LIST_LIMIT });
      if (g === gen.current) setRows(out.desks);
    } catch (e) {
      if (g !== gen.current) return;
      const err = e as { code?: string; message?: string };
      if (isStaleSignIn(err.code, err.message)) setStale(true);
      else setError(e instanceof DeskApiError ? e.message : "Could not load desks.");
      setRows([]);
    } finally {
      if (g === gen.current) setLoading(false);
    }
  }, [status, term]);
  useEffect(() => { void load(); }, [load]);

  const columns: Column<DeskSummaryRow>[] = [
    { key: "code", header: "Desk", primary: true, cell: (r) => <Link to={`/desk/top/desks/${encodeURIComponent(r.deskCode)}`} className="font-semibold text-blue-700 hover:underline">{r.deskCode}</Link> },
    { key: "name", header: "Name", cell: (r) => <span>{r.name}</span> },
    { key: "phone", header: "Phone", cell: (r) => <span>{r.phone}</span> },
    { key: "status", header: "Status", cell: (r) => <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge> },
    { key: "rank", header: "Rank", cell: (r) => <span>{RANK_LABEL[r.rank]}</span> },
    { key: "docs", header: "Documents", cell: (r) => <Badge tone={r.docsUploaded >= 3 ? "green" : "amber"}>{r.docsUploaded}/3</Badge> },
    { key: "joined", header: "Joined", cell: (r) => <span>{formatDateTime(r.createdAt)}</span> },
    { key: "view", header: "", align: "right", cell: (r) => <Link to={`/desk/top/desks/${encodeURIComponent(r.deskCode)}`} className={cn(buttonClass.secondary, "h-9 px-3")}>View</Link> },
  ];

  return (
    <div className="min-w-0 space-y-4">
      <div className="relative min-w-0">
        <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search desks" placeholder="Search by name, phone, email or desk code" className={cn(inputClass, "pl-10")} />
      </div>
      <div role="tablist" aria-label="Filter by status" className="flex min-w-0 flex-wrap gap-2">
        {(["all", ...ALL_STATUSES] as const).map((s) => (
          <button key={s} type="button" role="tab" aria-selected={status === s} onClick={() => setStatus(s)}
            className={cn("h-10 rounded-full border px-4 text-sm font-medium", status === s ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50")}>
            {s === "all" ? "All" : STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      {stale && <ReauthBox onDone={() => void load()} />}
      {error && (
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Notice tone="error">{error}</Notice>
          <button type="button" onClick={() => void load()} className={buttonClass.secondary}>Try again</button>
        </div>
      )}
      <Card>
        {loading ? (
          <div className="flex justify-center py-10" role="status" aria-label="Loading"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" /></div>
        ) : rows.length === 0 && !error && !stale ? (
          <EmptyState title="No desks found" body={term || status !== "all" ? "Try a different search or filter." : "Desks appear here once agents apply."} />
        ) : (
          <>
            <DataTable columns={columns} rows={rows} rowKey={(r) => r.agentId} />
            {rows.length >= DESK_LIST_LIMIT && <p className="mt-3 text-center text-xs text-gray-500">Showing the first {DESK_LIST_LIMIT}. Search or filter to narrow the list.</p>}
          </>
        )}
      </Card>
    </div>
  );
}
