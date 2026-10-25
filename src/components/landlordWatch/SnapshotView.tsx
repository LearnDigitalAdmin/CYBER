import { useEffect, useState } from 'react';
import { AlertTriangle, CalendarClock, Eye, EyeOff, Home, Loader2, Lock, ShieldCheck, Unlock } from 'lucide-react';
import type { N, Snapshot, TenantStatus } from './types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1] ?? m} ${m.slice(0, 4)}`;
const dayLabel = (d: string) => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1] ?? ''} ${d.slice(0, 4)}`;

/** A server-formatted number. Masked values (v === null) look hidden and cannot be selected. */
function Val({ n, className = '' }: { n: N; className?: string }) {
  return <span className={`${n.v === null ? 'select-none text-gray-500' : ''} ${className}`} aria-label={n.v === null ? 'hidden' : undefined}>{n.d}</span>;
}

function Tile({ label, n, sub, tone = 'cyan' }: { label: string; n: N; sub?: string; tone?: 'cyan' | 'emerald' | 'amber' | 'violet' }) {
  const ring = { cyan: 'border-cyan-500/30', emerald: 'border-emerald-500/30', amber: 'border-amber-500/30', violet: 'border-violet-500/30' }[tone];
  return (
    <div className={`rounded-xl border ${ring} bg-gradient-to-br from-gray-800/50 to-gray-900/50 p-4`}>
      <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-1 text-xl font-bold text-white sm:text-2xl"><Val n={n} /></div>
      {sub && <div className="mt-0.5 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

const STATUS: Record<TenantStatus, { label: string; cls: string }> = {
  paid: { label: 'Paid', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  partial: { label: 'Part-paid', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  unpaid: { label: 'Not paid', cls: 'bg-red-500/15 text-red-300 border-red-500/30' },
  no_invoice: { label: 'No invoice', cls: 'bg-gray-500/15 text-gray-300 border-gray-500/30' },
  masked: { label: 'Hidden', cls: 'bg-gray-700/40 text-gray-400 border-gray-600/40' },
};

function useCountdown(until: string | null): string | null {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!until) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [until]);
  if (!until) return null;
  const s = Math.max(0, Math.floor((new Date(until).getTime() - now) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

interface Props {
  snapshot: Snapshot;
  loading: boolean;
  unlockBusy: boolean;
  onMonth: (m: string) => void;
  onUnlock: () => void;
  onExpired: () => void;
}

export default function SnapshotView({ snapshot: s, loading, unlockBusy, onMonth, onUnlock, onExpired }: Props) {
  const left = useCountdown(s.mask.unlockedUntil);
  useEffect(() => { if (left === '00:00' && s.mask.level !== 'full') onExpired(); }, [left, s.mask.level, onExpired]);

  const hidden = s.mask.level === 'full';
  const months = s.months.includes(s.month) ? s.months : [s.month, ...s.months];
  const sm = s.summary;
  const maxTrend = Math.max(1, ...s.trend.map((t) => t.billed.v ?? 0));

  return (
    <div className="space-y-5">
      {/* Property + unlock state */}
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-lg bg-cyan-500/10 p-2.5"><Home className="h-5 w-5 text-cyan-400" /></div>
            <div className="min-w-0">
              <h3 className="truncate text-lg font-bold text-white">{s.property.name}</h3>
              <p className="truncate text-sm text-gray-400">{s.property.address ?? 'No address on file'}</p>
            </div>
          </div>
          <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 font-mono text-xs text-cyan-300">{s.ownerId}</span>
        </div>

        {hidden ? (
          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2 text-sm text-amber-200">
              <Lock className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Everything is hidden. The owner must confirm with a code sent to their phone before figures are shown.</span>
            </div>
            {s.mask.canUnlock ? (
              <button onClick={onUnlock} disabled={unlockBusy} className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-gray-900 disabled:opacity-60">
                {unlockBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlock className="h-4 w-4" />} Unlock with owner's code
              </button>
            ) : (
              <span className="text-xs text-amber-300">This property has no owner phone on file, so it cannot be unlocked. The owner must add one in their PMS app.</span>
            )}
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Unlocked by the owner. Tenant names and phone numbers always stay hidden here.</span>
            {left && <span className="font-mono text-xs text-emerald-300">Session ends in {left}</span>}
          </div>
        )}
      </div>

      {/* Month */}
      <div className="flex items-center gap-3">
        <CalendarClock className="h-4 w-4 text-gray-400" />
        <select
          value={s.month}
          onChange={(e) => onMonth(e.target.value)}
          disabled={loading}
          aria-label="Billing month"
          className="rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
        >
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />}
      </div>

      {/* Collection */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Billed" n={sm.billed} tone="cyan" />
        <Tile label="Collected" n={sm.collected} tone="emerald" />
        <Tile label="Pending" n={sm.pending} tone="amber" />
        <Tile label="Collection rate" n={sm.collectionRatePct} tone="violet" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Tenants (units occupied)" n={sm.tenants.occupiedUnits} sub={`of ${s.property.maxUnits.d} units`} />
        <Tile label="Vacant units" n={sm.tenants.vacantUnits} />
        <Tile label="Occupancy" n={sm.tenants.occupancyPct} />
        <Tile label="Paid / part / unpaid" n={{ v: null, d: hidden ? '••' : `${sm.invoices.paid.d} / ${sm.invoices.partial.d} / ${sm.invoices.unpaid.d}` }} sub={hidden ? undefined : `${sm.invoices.noInvoice.d} without an invoice`} />
      </div>

      {/* Commission and net */}
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 p-4 sm:p-5">
        <h4 className="mb-3 text-sm font-semibold text-white">What the landlord receives</h4>
        <div className="grid gap-3 sm:grid-cols-3">
          <Tile label="Expected (after commission)" n={sm.net.expected} tone="cyan" />
          <Tile label="Payable now" n={sm.net.payable} tone="emerald" sub={sm.statement.source === 'estimate' ? 'Estimate' : 'From the agent statement'} />
          <Tile label="Still to collect" n={sm.net.stillToCollect} tone="amber" />
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Agent commission ({sm.commission.ratePct.d}) is charged on base rent only, never on water, power or other charges. Commission on rent collected:{' '}
          <Val n={sm.commission.onCollected} className="text-gray-300" /> (base rent collected: <Val n={sm.baseRent.collected} className="text-gray-300" />).
        </p>
      </div>

      {/* Agent statement */}
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-white">Agent statement</h4>
          <span className={`rounded-full border px-2.5 py-0.5 text-xs ${sm.statement.source === 'agent' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'}`}>
            {sm.statement.source === 'agent' ? 'Issued by the agent' : 'Estimate: the agent has not issued this statement yet'}
          </span>
        </div>
        <div className="divide-y divide-gray-700/50 text-sm">
          {sm.statement.items.map((it, i) => (
            <div key={i} className="flex items-center justify-between gap-3 py-2">
              <span className={`min-w-0 truncate ${hidden ? 'select-none text-gray-500' : 'text-gray-300'}`}>{it.label}</span>
              <span className={it.kind === 'income' ? 'text-emerald-300' : 'text-red-300'}>{it.kind === 'income' ? '' : '− '}<Val n={it.amount} /></span>
            </div>
          ))}
          <div className="flex items-center justify-between py-2 font-bold text-white"><span>Net payable to landlord</span><Val n={sm.statement.netPayable} /></div>
        </div>
        {sm.statement.notes && <p className="mt-2 text-xs text-gray-400">Agent note: {sm.statement.notes}</p>}
      </div>

      {/* Remittance */}
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 p-4 sm:p-5">
        <h4 className="mb-3 text-sm font-semibold text-white">Agency remittance, due by {dayLabel(sm.remittance.dueDate)}</h4>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div><div className="text-xs text-gray-500">Collected by the due date</div><Val n={sm.remittance.collectedByDue} className="font-semibold text-white" /></div>
          <div><div className="text-xs text-gray-500">Net by the due date</div><Val n={sm.remittance.netByDue} className="font-semibold text-emerald-300" /></div>
          <div><div className="text-xs text-gray-500">Collected after</div><Val n={sm.remittance.collectedAfterDue} className="font-semibold text-white" /></div>
          <div><div className="text-xs text-gray-500">Net after</div><Val n={sm.remittance.netAfterDue} className="font-semibold text-amber-300" /></div>
        </div>
      </div>

      {/* Trend */}
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 p-4 sm:p-5">
        <h4 className="mb-3 text-sm font-semibold text-white">Last 6 months</h4>
        <div className="flex h-28 items-end gap-2">
          {s.trend.map((t) => {
            const billed = t.billed.v, collected = t.collected.v;
            return (
              <div key={t.month} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-24 w-full items-end gap-0.5">
                  <div className={`w-1/2 rounded-t ${billed === null ? 'bg-gray-700/50' : 'bg-cyan-500/50'}`} style={{ height: `${billed === null ? 40 : Math.max(4, (billed / maxTrend) * 100)}%` }} title={`Billed ${t.billed.d}`} />
                  <div className={`w-1/2 rounded-t ${collected === null ? 'bg-gray-700/50' : 'bg-emerald-500/70'}`} style={{ height: `${collected === null ? 30 : Math.max(4, ((collected ?? 0) / maxTrend) * 100)}%` }} title={`Collected ${t.collected.d}`} />
                </div>
                <span className="text-[10px] text-gray-500">{MONTHS[Number(t.month.slice(5, 7)) - 1]}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex gap-4 text-xs text-gray-500"><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-cyan-500/50" /> Billed</span><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-emerald-500/70" /> Collected</span></div>
      </div>

      {/* Tenants */}
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-white">Tenants</h4>
          <span className="flex items-center gap-1 text-xs text-gray-500">{hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} Names and phone numbers are hidden</span>
        </div>
        {hidden && s.tenants.length > 0 && <p className="mb-2 flex items-center gap-1 text-xs text-gray-500"><AlertTriangle className="h-3.5 w-3.5" /> A sample of hidden rows is shown so you can see the layout.</p>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-gray-500">
              <tr><th className="py-2 pr-3">Tenant</th><th className="pr-3">Unit</th><th className="pr-3 text-right">Rent</th><th className="pr-3 text-right">Paid</th><th className="pr-3 text-right">Balance</th><th className="pr-3">Status</th><th>Paid on</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-700/40">
              {s.tenants.map((t) => (
                <tr key={t.ref}>
                  <td className="py-2 pr-3 text-gray-300"><div className="select-none">{t.name}</div><div className="select-none text-xs text-gray-500">{t.phone}</div></td>
                  <td className="pr-3 text-gray-400">{t.unit ?? '—'}</td>
                  <td className="pr-3 text-right"><Val n={t.rent} /></td>
                  <td className="pr-3 text-right"><Val n={t.paid} /></td>
                  <td className="pr-3 text-right"><Val n={t.balance} /></td>
                  <td className="pr-3"><span className={`rounded-full border px-2 py-0.5 text-xs ${STATUS[t.status].cls}`}>{STATUS[t.status].label}</span></td>
                  <td className="text-xs text-gray-400">{t.paidOn ? dayLabel(t.paidOn) : '—'}{t.paidOnTime === false ? ' (late)' : ''}</td>
                </tr>
              ))}
              {s.tenants.length === 0 && <tr><td colSpan={7} className="py-4 text-center text-gray-500">No tenants for this month.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
