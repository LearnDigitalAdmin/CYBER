import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Mail, RefreshCw } from "lucide-react";
import { deskApi, DeskApiError } from "../../api";
import type { RequestView } from "../../api";
import { useAgent } from "../../core/useAgent";
import { Badge, Card, DataTable, EmptyState, Page, buttonClass, cn } from "../../ui";
import type { Column } from "../../ui";
import ContactSamuhia from "./ContactSamuhia";
import RequestSheet from "./RequestSheet";
import {
  FILTERS, PAGE_SIZE, REFRESH_MS, SOURCE_LABEL, STATUS_LABEL, STATUS_TONE, categoryLabel, mergeRequests, nextCursor,
  replaceHead, timeAgo,
} from "./logic";
import type { StatusFilter } from "./logic";

const errText = (e: unknown): string => (e instanceof DeskApiError ? e.message : "Something went wrong. Please try again.");

export default function RequestsScreen() {
  const agent = useAgent();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [rows, setRows] = useState<RequestView[]>([]);
  const [newCount, setNewCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<RequestView | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [, tick] = useState(0);

  const generation = useRef(0);   // bumps on every filter change so late answers for an old filter are dropped
  const busy = useRef(false);     // one list call at a time
  const rowsRef = useRef<RequestView[]>([]);
  rowsRef.current = rows;

  /** mode "reset": first load for a filter. "background": timer / focus / manual refresh. */
  const load = useCallback(async (mode: "reset" | "background") => {
    if (busy.current && mode === "background") return;
    const gen = generation.current;
    busy.current = true;
    if (mode === "reset") setLoading(true); else setRefreshing(true);
    try {
      const out = await deskApi.listRequests({ status: filter === "all" ? undefined : filter, limit: PAGE_SIZE });
      if (gen !== generation.current) return;
      setRows(mode === "reset" ? mergeRequests([], out.requests) : replaceHead(rowsRef.current, out.requests, PAGE_SIZE));
      if (mode === "reset" || out.requests.length >= PAGE_SIZE) setHasMore(out.requests.length >= PAGE_SIZE);
      setNewCount(out.newCount);
      setFetchedAt(Date.now());
      setError(null);
    } catch (e) {
      if (gen !== generation.current) return;
      setError(errText(e));
    } finally {
      busy.current = false;
      if (gen === generation.current) { setLoading(false); setRefreshing(false); }
    }
  }, [filter]);

  // New filter: drop what we show and start over.
  useEffect(() => {
    generation.current += 1;
    busy.current = false;
    setRows([]); setHasMore(false); setError(null);
    void load("reset");
  }, [load]);

  // Refresh every 60 s while visible, and whenever the tab/window regains focus.
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") void load("background"); };
    const timer = window.setInterval(refresh, REFRESH_MS);
    const clock = window.setInterval(() => tick((n) => n + 1), 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer); window.clearInterval(clock);
      window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);

  async function loadMore() {
    const before = nextCursor(rows);
    if (!before || loadingMore) return;
    const gen = generation.current;
    setLoadingMore(true);
    try {
      const out = await deskApi.listRequests({ status: filter === "all" ? undefined : filter, limit: PAGE_SIZE, before });
      if (gen !== generation.current) return;
      setRows((cur) => mergeRequests(cur, out.requests));
      setHasMore(out.requests.length >= PAGE_SIZE);
      setNewCount(out.newCount);
    } catch (e) {
      if (gen === generation.current) setError(errText(e));
    } finally {
      setLoadingMore(false);
    }
  }

  // Keep the open sheet in step with the server copy, but let it outlive the list (a reply can move it to another filter).
  useEffect(() => {
    setSelected((cur) => (cur ? rows.find((r) => r.id === cur.id) ?? cur : cur));
  }, [rows]);

  if (agent === undefined) return <Spinner />;
  if (agent === null) {
    return <Page title="Requests"><EmptyState title="Desk accounts only" body="Requests are available once you have a Samuhia Desk account." /></Page>;
  }

  const columns: Column<RequestView>[] = [
    {
      key: "subject", header: "Request", primary: true,
      cell: (r) => (
        <button type="button" onClick={() => setSelected(r)} className="min-w-0 break-words text-left font-semibold text-blue-700 hover:underline">
          {r.subject || categoryLabel(r.category)}
        </button>
      ),
    },
    { key: "status", header: "Status", cell: (r) => <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge> },
    { key: "from", header: "From", cell: (r) => <span>{r.requesterName || "Unknown"}</span> },
    { key: "entity", header: "Customer", cell: (r) => <span>{r.entityName || r.entityCode}<span className="text-gray-500"> · {SOURCE_LABEL[r.source]}</span></span> },
    { key: "cat", header: "Topic", cell: (r) => <span>{categoryLabel(r.category)}</span> },
    { key: "when", header: "Received", cell: (r) => <span title={new Date(r.createdAt).toLocaleString()}>{timeAgo(r.createdAt)}</span> },
    {
      key: "open", header: "", align: "right",
      cell: (r) => <button type="button" onClick={() => setSelected(r)} className={cn(buttonClass.secondary, "h-9 px-3")}>Open</button>,
    },
  ];

  return (
    <Page
      title="Requests"
      subtitle="Customers of the chamas, schools and landlords you support write to you here."
      actions={
        <>
          <span className="inline-flex h-11 items-center" aria-live="polite">
            <Badge tone={newCount > 0 ? "blue" : "gray"}>{newCount} new</Badge>
          </span>
          <button type="button" onClick={() => void load("background")} disabled={refreshing || loading} className={buttonClass.secondary}>
            <RefreshCw size={16} className={cn(refreshing && "animate-spin")} /> Refresh
          </button>
          <button type="button" onClick={() => setContactOpen(true)} className={buttonClass.primary}>
            <Mail size={16} /> Contact Samuhia
          </button>
        </>
      }
    >
      {notice && (
        <div role="status" className="flex min-w-0 items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <span className="min-w-0 break-words">{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="shrink-0 font-semibold">Dismiss</button>
        </div>
      )}

      <div role="tablist" aria-label="Filter by status" className="flex min-w-0 flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f.value} type="button" role="tab" aria-selected={filter === f.value} onClick={() => setFilter(f.value)}
            className={cn("h-10 rounded-full border px-4 text-sm font-medium",
              filter === f.value ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50")}>
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" className="flex min-w-0 flex-col gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between">
          <span className="min-w-0 break-words">{error}{rows.length > 0 ? " Showing the last list we loaded." : ""}</span>
          <button type="button" onClick={() => void load(rows.length ? "background" : "reset")} className={cn(buttonClass.secondary, "h-9")}>Try again</button>
        </div>
      )}

      <Card>
        {loading ? (
          <Spinner inline />
        ) : rows.length === 0 && !error ? (
          <EmptyState
            title={filter === "all" ? "No requests yet" : `No ${STATUS_LABEL[filter].toLowerCase()} requests`}
            body={filter === "all"
              ? "When a customer you support asks for help, it appears here within about 30 minutes."
              : "Try another filter to see the rest."}
          />
        ) : (
          <>
            <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />
            {hasMore && (
              <div className="mt-4 flex justify-center">
                <button type="button" onClick={() => void loadMore()} disabled={loadingMore} className={buttonClass.secondary}>
                  {loadingMore ? "Loading…" : "Load older requests"}
                </button>
              </div>
            )}
          </>
        )}
      </Card>

      <p className="break-words text-xs text-gray-500">
        {fetchedAt ? `Updated ${timeAgo(fetchedAt)}. ` : ""}This list refreshes every minute and when you return to this tab.
        {" "}Need to change your sign-in details? <Link to="/desk/account" className="font-medium text-blue-700 hover:underline">Open Account</Link>.
      </p>

      <RequestSheet
        request={selected}
        agentCode={agent.agentCode}
        onClose={() => setSelected(null)}
        onChanged={(updated) => { setSelected(updated); setRows((cur) => cur.map((r) => (r.id === updated.id ? updated : r))); void load("background"); }}
      />
      <ContactSamuhia
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        onSent={() => { setContactOpen(false); setNotice("Your message was sent to Samuhia. We will reply here."); void load("background"); }}
      />
    </Page>
  );
}

function Spinner({ inline }: { inline?: boolean }) {
  return (
    <div className={cn("flex items-center justify-center", inline ? "py-10" : "min-h-[40vh]")} role="status" aria-label="Loading">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
    </div>
  );
}
