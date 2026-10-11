import { useState } from "react";
import { formatDateTime, formatKes, type EarningsByProduct } from "../api";
import { useAgent } from "../core/useAgent";
import { Badge, Card, DataTable, EmptyState, FormField, Page, Stat, StatGrid, buttonClass, inputClass, type Column } from "../ui";
import {
  cyberIncomeTotalKes, describeReconciliation, inRange, KIND_LABEL, milestoneView, payoutGroups, productLabel, RANGE_LABEL, reconcileDeskPayments, splitStatuses,
  STATUS_LABEL, streamLabel, type LedgerRow, type RangeKey,
} from "./model";
import { useEarnings } from "./useEarnings";

const RANGES: RangeKey[] = ["month", "30d", "90d", "year"];
const PAGE = 25;

export default function EarningsScreen() {
  const agent = useAgent();
  return (
    <Page title="Earnings" subtitle="What you've earned, what is waiting to be paid, and your milestone progress.">
      {agent === undefined ? <p className="py-10 text-center text-sm text-gray-500" role="status">Loading…</p>
        : agent === null ? <EmptyState title="Desk account not found" body="Sign in with your desk account to see your earnings." />
        : <Loaded agentId={agent.agentId} />}
    </Page>
  );
}

function Bar({ label, fraction, text }: { label: string; fraction: number; text: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 justify-between gap-3 text-sm"><span className="min-w-0 break-words text-gray-700">{label}</span><span className="shrink-0 font-semibold tabular-nums text-gray-900">{text}</span></div>
      <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className="h-full rounded-full bg-blue-600" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Loaded({ agentId }: { agentId: string }) {
  const [range, setRange] = useState<RangeKey>("month");
  const [shown, setShown] = useState(PAGE);
  const e = useEarnings(agentId, range);

  const select = (
    <FormField label="Period" htmlFor="earn-range">
      <select id="earn-range" className={inputClass} value={range} onChange={(ev) => { setRange(ev.target.value as RangeKey); setShown(PAGE); }}>
        {RANGES.map((r) => <option key={r} value={r}>{RANGE_LABEL[r]}</option>)}
      </select>
    </FormField>
  );
  if (e.totals.state === "error" && e.ledger.state === "error") return <Card><p role="alert" className="break-words text-sm text-red-700">{e.totals.message}</p></Card>;
  if (e.totals.state === "loading" || e.ledger.state === "loading") return <>{select}<p className="py-10 text-center text-sm text-gray-500" role="status">Loading your earnings…</p></>;
  if (e.totals.state === "error") return <>{select}<Card><p role="alert" className="break-words text-sm text-red-700">{e.totals.message}</p></Card></>;
  if (e.ledger.state === "error") return <>{select}<Card><p role="alert" className="break-words text-sm text-red-700">{e.ledger.message}</p></Card></>;

  const totals = e.totals.data;
  const { rows, truncated } = e.ledger.data;
  const inWindow = inRange(rows, e.from, e.to);
  const split = splitStatuses(totals, inWindow);
  const payouts = payoutGroups(inWindow);
  const m = milestoneView(totals.bonusProgress);
  const nothing = inWindow.length === 0 && totals.byProduct.length === 0;

  const ledgerColumns: Column<LedgerRow>[] = [
    { key: "date", header: "Date", primary: true, cell: (r) => formatDateTime(r.createdAt) },
    { key: "kind", header: "Kind", cell: (r) => KIND_LABEL[r.kind] ?? r.kind },
    { key: "product", header: "Product", cell: (r) => productLabel(r.product) },
    { key: "amount", header: "Amount", align: "right", cell: (r) => formatKes(r.amountMinor) },
    { key: "status", header: "Status", cell: (r) => <Badge tone={STATUS_LABEL[r.status]?.tone ?? "gray"}>{STATUS_LABEL[r.status]?.text ?? r.status}</Badge> },
  ];
  const streamColumns: Column<EarningsByProduct>[] = [
    { key: "s", header: "Source", primary: true, cell: (r) => streamLabel(r.product) },
    { key: "a", header: "Amount", align: "right", cell: (r) => formatKes(r.amountMinor) },
  ];
  const payoutRows = (["bonus", "support"] as const).map((k) => ({ key: k, label: k === "bonus" ? "Milestone bonuses" : "Support payouts", ...payouts[k] }));

  return (
    <>
      {select}
      <StatGrid>
        <Stat label="Auto-settled" value={formatKes(split.settledMinor)} hint="Paid to you automatically when the customer paid" tone="good" />
        <Stat label="Payable" value={formatKes(split.payableMinor)} hint="Waiting for the top desk to pay" tone={split.payableMinor > 0 ? "warn" : "default"} />
        <Stat label="Processing" value={formatKes(split.processingMinor)} hint="Payout started, not yet confirmed" />
        <Stat label="Paid" value={formatKes(split.paidMinor)} hint="Confirmed paid out" tone="good" />
      </StatGrid>
      {truncated && <p role="status" className="break-words rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">Showing your latest {rows.length} ledger entries. Totals above come from the full period.</p>}

      <Card title="Milestone bonus">
        <div className="min-w-0 space-y-4">
          {m.capReached
            ? <p className="break-words text-sm font-semibold text-emerald-800">You've reached the lifetime bonus limit.</p>
            : <Bar label={`Qualifying accounts toward your next bonus`} fraction={m.towardFraction} text={`${m.toward} of ${m.blockSize}`} />}
          <Bar label="Bonus banked (lifetime)" fraction={m.capFraction} text={`${formatKes(m.bankedMinor)} of ${formatKes(m.capMinor)}`} />
          <p className="break-words text-xs text-gray-500">{m.qualifyingAccounts} qualifying account{m.qualifyingAccounts === 1 ? "" : "s"} so far · {m.blocksPaid} bonus block{m.blocksPaid === 1 ? "" : "s"} earned.</p>
        </div>
      </Card>

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="By source">
          <DataTable columns={streamColumns} rows={totals.byProduct} rowKey={(r) => r.product} empty={<p className="py-4 text-center text-sm text-gray-500">No earnings in this period.</p>} />
        </Card>
        <Card title="Bonuses and support payouts">
          <DataTable
            columns={[
              { key: "k", header: "Type", primary: true, cell: (r: (typeof payoutRows)[number]) => r.label },
              { key: "p", header: "Payable", align: "right", cell: (r) => formatKes(r.payableMinor) },
              { key: "x", header: "Processing", align: "right", cell: (r) => formatKes(r.processingMinor) },
              { key: "d", header: "Paid", align: "right", cell: (r) => formatKes(r.paidMinor) },
            ]}
            rows={payoutRows} rowKey={(r) => r.key} />
        </Card>
      </div>

      <PayCheck e={e} />

      <Card title="Ledger">
        {nothing ? <EmptyState title="No earnings in this period" body="Your earnings appear here as customers pay for services you provide." /> : (
          <div className="min-w-0 space-y-4">
            <DataTable columns={ledgerColumns} rows={inWindow.slice(0, shown)} rowKey={(r) => r.entryId} />
            {inWindow.length > shown && <button type="button" className={buttonClass.secondary} onClick={() => setShown((n) => n + PAGE)}>Show more ({inWindow.length - shown} left)</button>}
          </div>
        )}
      </Card>
    </>
  );
}

/** PAY's own income records beside the ledger, and whether the desk payments in both agree. */
function PayCheck({ e }: { e: ReturnType<typeof useEarnings> }) {
  if (e.cyber.state === "loading") return <Card title="Payment records"><p className="text-sm text-gray-500" role="status">Checking payment records…</p></Card>;
  if (e.cyber.state === "error") return <Card title="Payment records"><p role="alert" className="break-words text-sm text-red-700">{e.cyber.message}</p></Card>;
  if (e.ledger.state !== "ready") return null;
  const cyber = e.cyber.data;
  const ledger = e.ledger.data;
  const r = reconcileDeskPayments(cyber.rows, ledger.rows, { cyberTruncated: cyber.truncated, ledgerTruncated: ledger.truncated });
  const income = cyberIncomeTotalKes(cyber.rows, e.from, e.to);
  const summary = describeReconciliation(r);
  return (
    <Card title="Payment records">
      <div className="min-w-0 space-y-3">
        <p className="break-words text-sm text-gray-800">Service income recorded by the payments system this period: <span className="font-semibold">{formatKes(Math.round(income * 100))}</span></p>
        <div className="min-w-0 space-y-1 text-sm" role="status">
          {summary.lines.map((line, i) => (
            <p key={i} className={`break-words ${summary.tone === "ok" ? "text-emerald-800" : summary.tone === "error" && i === 1 ? "text-red-700" : summary.tone === "warn" || summary.tone === "error" ? (i === 0 ? "text-gray-800" : "text-amber-800") : "text-gray-600"}`}>{line}</p>
          ))}
          {(summary.tone === "warn" || summary.tone === "error") && <p className="break-words text-xs text-gray-500">If this doesn't clear up, tell the top desk the references above.</p>}
        </div>
      </div>
    </Card>
  );
}
