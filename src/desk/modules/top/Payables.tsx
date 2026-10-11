import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { deskApi, DeskApiError, formatDateTime, formatKes } from "../../api";
import type { TopListPayablesOut, TopPayable } from "../../api";
import { Badge, Card, DataTable, EmptyState, buttonClass, cn } from "../../ui";
import type { Column } from "../../ui";
import Notice from "./Notice";
import ReauthBox from "./ReauthBox";
import TopOtpDialog from "./TopOtpDialog";
import { POLL_MAX_MS, POLL_MS, capState, isStaleSignIn, selectWithinCap, settleTracking, stillProcessing, summariseSelection, trackFromResults } from "./logic";
import type { TrackedPayout } from "./logic";

const TONE = { processing: "amber", paid: "green", failed: "red" } as const;
const LABEL = { processing: "Processing", paid: "Paid", failed: "Failed" } as const;

export default function Payables() {
  const [data, setData] = useState<TopListPayablesOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [otpOpen, setOtpOpen] = useState(false);
  const [tracked, setTracked] = useState<TrackedPayout[]>([]);
  const [polling, setPolling] = useState(false);
  const baseline = useRef<Record<string, number>>({});
  const trackedRef = useRef<TrackedPayout[]>([]);
  trackedRef.current = tracked;
  const pollStart = useRef(0);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null); setStale(false);
    try {
      const out = await deskApi.top.listPayables();
      setData(out);
      // Drop selections that are no longer payable.
      setSelected((cur) => new Set([...cur].filter((id) => out.payables.some((p) => p.entryId === id))));
      return out;
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (isStaleSignIn(err.code, err.message)) setStale(true);
      else setError(e instanceof DeskApiError ? e.message : "Could not load payables.");
      return null;
    } finally { if (!quiet) setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const payables = data?.payables ?? [];
  const sel = summariseSelection(payables, selected);
  const cap = data ? capState(data.dailyCapMinor, data.paidTodayMinor, sel.totalMinor) : null;

  const toggle = (id: string) => setSelected((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  /** Re-read desk earnings and the payable list; settle `processing` rows from what changed. */
  const refreshTracking = useCallback(async () => {
    const rows = trackedRef.current;
    if (!stillProcessing(rows)) { setPolling(false); return; }
    const codes = [...new Set(rows.map((r) => r.deskCode))];
    const [list, ...desks] = await Promise.all([deskApi.top.listPayables().catch(() => null), ...codes.map((c) => deskApi.top.getDesk({ deskCode: c }).catch(() => null))]);
    const current: Record<string, number> = {};
    codes.forEach((c, i) => { const d = desks[i]; if (d) current[c] = d.earnings.paidMinor; });
    const payableNow = new Set((list?.payables ?? []).map((p) => p.entryId));
    if (list) setData(list);
    setTracked(settleTracking(trackedRef.current, baseline.current, current, payableNow));
  }, []);

  // Poll while something is still processing (stops after 10 minutes; "Check now" stays available).
  useEffect(() => {
    if (!polling) return;
    const t = window.setInterval(() => {
      if (Date.now() - pollStart.current > POLL_MAX_MS) { setPolling(false); return; }
      void refreshTracking();
    }, POLL_MS);
    return () => window.clearInterval(t);
  }, [polling, refreshTracking]);
  useEffect(() => { if (polling && !stillProcessing(tracked)) setPolling(false); }, [polling, tracked]);

  async function pay(actionId: string, otp: string) {
    const chosen = payables.filter((p) => selected.has(p.entryId));
    // Pre-payout paid totals per desk: the yardstick for confirming `processing` rows afterwards.
    const codes = [...new Set(chosen.map((p) => p.deskCode))];
    const base: Record<string, number> = {};
    (await Promise.all(codes.map((c) => deskApi.top.getDesk({ deskCode: c }).catch(() => null)))).forEach((d, i) => { if (d) base[codes[i]] = d.earnings.paidMinor; });
    const out = await deskApi.top.payout({ entryIds: chosen.map((p) => p.entryId), actionId, otp });
    baseline.current = base;
    const rows = trackFromResults(chosen, out.results);
    setTracked(rows); setSelected(new Set());
    pollStart.current = Date.now(); setPolling(stillProcessing(rows));
    await load(true);
  }

  const columns: Column<TopPayable>[] = [
    { key: "pick", header: "Pay", primary: true, cell: (p) => (
      <label className="flex min-h-11 min-w-0 cursor-pointer items-center gap-3">
        <input type="checkbox" checked={selected.has(p.entryId)} onChange={() => toggle(p.entryId)} className="h-5 w-5 shrink-0" />
        <span className="min-w-0 break-words font-semibold">{p.deskCode} · {p.name}</span>
      </label>
    ) },
    { key: "kind", header: "Type", cell: (p) => <Badge tone={p.kind === "bonus" ? "blue" : "gray"}>{p.kind === "bonus" ? "Bonus" : "Support"}</Badge> },
    { key: "amount", header: "Amount", align: "right", cell: (p) => <span className="font-semibold">{formatKes(p.amountMinor)}</span> },
    { key: "note", header: "Note", cell: (p) => <span>{p.note ?? "—"}</span> },
    { key: "when", header: "Created", cell: (p) => <span>{formatDateTime(p.createdAt)}</span> },
  ];

  return (
    <div className="min-w-0 space-y-4">
      {stale && <ReauthBox onDone={() => void load()} />}
      {error && (
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Notice tone="error">{error}</Notice>
          <button type="button" onClick={() => void load()} className={buttonClass.secondary}>Try again</button>
        </div>
      )}

      {cap && data && (
        <Card title="Daily payout limit">
          <div className="min-w-0 space-y-2">
            <div className="flex min-w-0 flex-wrap justify-between gap-2 text-sm">
              <span className="text-gray-600">Paid today <span className="font-semibold text-gray-900">{formatKes(data.paidTodayMinor)}</span> of {formatKes(data.dailyCapMinor)}</span>
              <span className="text-gray-600">Left <span className="font-semibold text-gray-900">{formatKes(cap.remainingMinor)}</span></span>
            </div>
            <div className="flex h-3 w-full min-w-0 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-label="Daily payout limit used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={cap.usedPct}>
              <div className="h-full bg-blue-600" style={{ width: `${cap.usedPct}%` }} />
              <div className={cn("h-full", cap.over ? "bg-red-500" : "bg-amber-400")} style={{ width: `${cap.over ? 100 - cap.usedPct : cap.selectedPct}%` }} />
            </div>
            {sel.count > 0 && <p className="text-xs text-gray-500">Blue is paid today. {cap.over ? "Red" : "Amber"} is your selection.</p>}
          </div>
        </Card>
      )}

      <Card title="Waiting to be paid"
        footer={data && (
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-w-0 break-words text-sm text-gray-700" aria-live="polite">
              {sel.count === 0 ? "Select the rows to pay." : `${sel.count} selected · ${formatKes(sel.totalMinor)} to ${sel.desks} ${sel.desks === 1 ? "desk" : "desks"}`}
              {cap?.over && <span className="block text-red-700">That is {formatKes(cap.overByMinor)} over today's limit. Select fewer rows.</span>}
            </p>
            <button type="button" disabled={sel.count === 0 || !!cap?.over} onClick={() => setOtpOpen(true)} className={buttonClass.primary}>Pay selected…</button>
          </div>
        )}>
        {loading ? (
          <div className="flex justify-center py-10" role="status" aria-label="Loading"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" /></div>
        ) : payables.length === 0 && !error && !stale ? (
          <EmptyState title="Nothing to pay" body="Milestone bonuses and monthly support payouts appear here when they are due." />
        ) : (
          <div className="min-w-0 space-y-3">
            <div className="flex min-w-0 flex-wrap gap-2">
              <button type="button" className={cn(buttonClass.secondary, "h-9")} onClick={() => setSelected(cap ? selectWithinCap(payables, cap.remainingMinor) : new Set())}>Select what fits today</button>
              <button type="button" className={cn(buttonClass.secondary, "h-9")} onClick={() => setSelected(new Set())} disabled={selected.size === 0}>Clear</button>
              <button type="button" className={cn(buttonClass.secondary, "h-9")} onClick={() => void load(true)}><RefreshCw size={14} /> Refresh</button>
            </div>
            <DataTable columns={columns} rows={payables} rowKey={(p) => p.entryId} />
          </div>
        )}
      </Card>

      {tracked.length > 0 && (
        <Card title="Payout results"
          footer={<div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-gray-500">{polling ? "Checking with Paystack every few seconds…" : stillProcessing(tracked) ? "Automatic checking stopped. Use Check now." : "All transfers settled."}</p>
            <button type="button" className={cn(buttonClass.secondary, "h-9")} onClick={() => { pollStart.current = Date.now(); setPolling(true); void refreshTracking(); }}>Check now</button>
          </div>}>
          <ul className="min-w-0 divide-y divide-gray-100">
            {tracked.map((r) => (
              <li key={r.entryId} className="flex min-w-0 flex-wrap items-start justify-between gap-2 py-2 text-sm">
                <span className="min-w-0 break-words"><Link to={`/desk/top/desks/${encodeURIComponent(r.deskCode)}`} className="font-semibold text-blue-700 hover:underline">{r.deskCode}</Link> · {r.name}<span className="block break-all text-xs text-gray-500">{r.reference}</span>{r.error && <span className="block text-xs text-red-700">{r.error}</span>}</span>
                <span className="flex shrink-0 items-center gap-2"><span className="tabular-nums">{formatKes(r.amountMinor)}</span><Badge tone={TONE[r.status]}>{LABEL[r.status]}</Badge></span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <TopOtpDialog open={otpOpen} title="Pay selected" action="payout" summary={sel.summary} confirmLabel="Pay now"
        onClose={() => setOtpOpen(false)} execute={pay} />
    </div>
  );
}
