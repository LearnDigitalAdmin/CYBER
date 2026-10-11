import { AlertCircle, Download, Loader, Wallet } from "lucide-react";
import { formatDateTime, formatKes } from "../../desk/api/format";
import { useAgent } from "../../desk/core/useAgent";
import {
  cyberIncomeTotalKes, deskLedgerCsv, describeReconciliation, inRange, KIND_LABEL, milestoneView, payoutGroups, productLabel,
  reconcileDeskPayments, splitStatuses, STATUS_LABEL, streamLabel, type RangeKey,
} from "../../desk/earnings/model";
import { useEarnings } from "../../desk/earnings/useEarnings";

export type IncomePeriod = "today" | "week" | "month";
/** The tab's periods mapped onto desk ranges (the tab's own month is the last 30 days). */
const RANGE_FOR: Record<IncomePeriod, RangeKey> = { today: "today", week: "7d", month: "30d" };

const panel = "bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-700/50 p-6";
const TONE: Record<string, string> = { green: "text-emerald-400", amber: "text-amber-400", blue: "text-cyan-400", gray: "text-gray-400" };

function Mini({ label, value, hint, color }: { label: string; value: string; hint: string; color: string }) {
  return (
    <div className="p-4 bg-gray-700/20 rounded-lg border border-gray-700/50 min-w-0">
      <div className="text-sm text-gray-400 mb-1">{label}</div>
      <div className={`text-xl font-bold break-words ${color}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{hint}</div>
    </div>
  );
}
function Bar({ label, fraction, text }: { label: string; fraction: number; text: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
  return (
    <div className="min-w-0">
      <div className="flex justify-between gap-3 text-sm"><span className="text-gray-400">{label}</span><span className="font-semibold text-white whitespace-nowrap">{text}</span></div>
      <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-gray-700/50" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className="h-full rounded-full bg-cyan-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Desk earnings (ledger + milestone + reconciliation with PAY's cyber-income). Shown only for people who have a desk account. */
export default function DeskIncomeSection({ period }: { period: IncomePeriod }) {
  const agent = useAgent();
  if (!agent) return null; // loading, or not a desk agent: this tab then looks exactly as it always has
  return <Loaded agentId={agent.agentId} period={period} />;
}

function Loaded({ agentId, period }: { agentId: string; period: IncomePeriod }) {
  const e = useEarnings(agentId, RANGE_FOR[period]);
  const title = (
    <div className="flex items-center gap-2 mb-6"><Wallet className="w-5 h-5 text-cyan-400" /><h3 className="text-lg font-semibold text-white">Desk Earnings ({period})</h3></div>
  );
  if (e.totals.state === "loading" || e.ledger.state === "loading") {
    return <div className={panel}>{title}<div className="flex items-center gap-3 text-gray-400"><Loader className="w-5 h-5 animate-spin text-cyan-500" /><span role="status">Loading desk earnings...</span></div></div>;
  }
  const failure = e.totals.state === "error" ? e.totals.message : e.ledger.state === "error" ? e.ledger.message : null;
  if (failure || e.totals.state !== "ready" || e.ledger.state !== "ready") {
    return <div className={panel}>{title}<div className="flex items-center gap-3"><AlertCircle className="w-5 h-5 text-red-400 shrink-0" /><span role="alert" className="text-red-400 break-words">{failure}</span></div></div>;
  }

  const totals = e.totals.data;
  const { rows, truncated } = e.ledger.data;
  const inWindow = inRange(rows, e.from, e.to);
  const split = splitStatuses(totals, inWindow);
  const payouts = payoutGroups(inWindow);
  const m = milestoneView(totals.bonusProgress);
  const rec = e.cyber.state === "ready"
    ? describeReconciliation(reconcileDeskPayments(e.cyber.data.rows, rows, { cyberTruncated: e.cyber.data.truncated, ledgerTruncated: truncated }))
    : null;
  const payIncome = e.cyber.state === "ready" ? cyberIncomeTotalKes(e.cyber.data.rows, e.from, e.to) : null;

  const download = () => {
    const blob = new Blob([deskLedgerCsv(inWindow)], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `desk-earnings-${period}-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url);
  };

  return (
    <div className={panel}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-2"><Wallet className="w-5 h-5 text-cyan-400" /><h3 className="text-lg font-semibold text-white">Desk Earnings ({period})</h3></div>
        <button onClick={download} disabled={inWindow.length === 0} className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-black rounded-lg hover:bg-cyan-400 transition-colors text-sm font-medium shadow-lg shadow-cyan-500/20 disabled:opacity-50">
          <Download className="w-4 h-4" /> Download Desk Statement
        </button>
      </div>

      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-4">
        <Mini label="Auto-settled" value={formatKes(split.settledMinor)} hint="Paid to you automatically" color="text-emerald-400" />
        <Mini label="Payable" value={formatKes(split.payableMinor)} hint="Waiting for the top desk" color="text-amber-400" />
        <Mini label="Processing" value={formatKes(split.processingMinor)} hint="Payout not yet confirmed" color="text-cyan-400" />
        <Mini label="Paid" value={formatKes(split.paidMinor)} hint="Confirmed paid out" color="text-emerald-400" />
      </div>
      {truncated && <p role="status" className="mt-3 text-xs text-amber-400">Showing your latest {rows.length} ledger entries. Totals come from the full period.</p>}

      <div className="mt-6 space-y-4">
        <h4 className="text-sm font-semibold text-cyan-400">Milestone bonus</h4>
        {m.capReached
          ? <p className="text-sm font-semibold text-emerald-400">You've reached the lifetime bonus limit.</p>
          : <Bar label="Qualifying accounts toward your next bonus" fraction={m.towardFraction} text={`${m.toward} of ${m.blockSize}`} />}
        <Bar label="Bonus banked (lifetime)" fraction={m.capFraction} text={`${formatKes(m.bankedMinor)} of ${formatKes(m.capMinor)}`} />
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="text-sm font-semibold text-cyan-400 mb-3">By source</h4>
          {totals.byProduct.length === 0 ? <p className="text-sm text-gray-500">No desk earnings in this period.</p> : (
            <div className="space-y-2">{totals.byProduct.map((p) => (
              <div key={p.product} className="flex justify-between gap-3 py-2 px-3 bg-gray-700/20 rounded border border-gray-700/50 text-sm"><span className="text-gray-300">{streamLabel(p.product)}</span><span className="font-semibold text-white">{formatKes(p.amountMinor)}</span></div>
            ))}</div>
          )}
        </div>
        <div>
          <h4 className="text-sm font-semibold text-cyan-400 mb-3">Bonuses and support payouts</h4>
          <div className="space-y-2">{(["bonus", "support"] as const).map((k) => (
            <div key={k} className="py-2 px-3 bg-gray-700/20 rounded border border-gray-700/50 text-sm">
              <div className="text-gray-300 mb-1">{k === "bonus" ? "Milestone bonuses" : "Support payouts"}</div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                <span>Payable <b className="text-amber-400">{formatKes(payouts[k].payableMinor)}</b></span>
                <span>Processing <b className="text-cyan-400">{formatKes(payouts[k].processingMinor)}</b></span>
                <span>Paid <b className="text-emerald-400">{formatKes(payouts[k].paidMinor)}</b></span>
              </div>
            </div>
          ))}</div>
        </div>
      </div>

      {rec && payIncome !== null && (
        <div className="mt-6 p-4 bg-gray-700/20 rounded-lg border border-gray-700/50" role="status">
          <h4 className="text-sm font-semibold text-cyan-400 mb-2">Checked against your payment records</h4>
          {rec.lines.map((line, i) => <p key={i} className={`text-sm break-words ${rec.tone === "ok" ? "text-emerald-400" : rec.tone === "error" && i === 1 ? "text-red-400" : i === 0 ? "text-gray-300" : "text-amber-400"}`}>{line}</p>)}
        </div>
      )}

      {inWindow.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-cyan-400 mb-3">Recent ledger entries</h4>
          <div className="space-y-2 max-h-72 overflow-y-auto">{inWindow.slice(0, 10).map((r) => (
            <div key={r.entryId} className="flex justify-between items-center gap-3 py-2 px-3 bg-gray-700/20 rounded border border-gray-700/50 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-gray-200 break-words">{KIND_LABEL[r.kind] ?? r.kind} · {productLabel(r.product)}</p>
                <p className="text-xs text-gray-500">{formatDateTime(r.createdAt)} · <span className={TONE[STATUS_LABEL[r.status]?.tone ?? "gray"]}>{STATUS_LABEL[r.status]?.text ?? r.status}</span></p>
              </div>
              <p className="font-semibold text-white whitespace-nowrap">{formatKes(r.amountMinor)}</p>
            </div>
          ))}</div>
        </div>
      )}
    </div>
  );
}
