/**
 * Landlord Watch: snapshot to WhatsApp text. Pure functions.
 * Every number is the server's `d` string, rendered as-is. Nothing here recomputes money, percentages, masking or quota.
 */

import { Lang, Snapshot, TenantRow } from '../types/watch.types';
import { wmsg } from '../constants/watch.messages';
import { dateLong, dateShort, monthLabel, nairobiToday, Page, paginate, plain } from './watch.format';

export const TENANT_PAGE_SIZE = 8;

const d = (n: { d: string } | undefined): string => plain(n?.d ?? '', 30);

export function isOpen(s: Snapshot): boolean {
  return s.mask.level === 'open';
}

/** Hidden-tenant note, only when the user could actually unlock. */
export function lockedNote(s: Snapshot, lang: Lang): string {
  return !isOpen(s) && s.mask.canUnlock ? wmsg('HIDDEN_NOTE', lang) : '';
}

export function renderSummary(s: Snapshot, lang: Lang): string {
  const x = s.summary;
  const lines = [
    wmsg('SUMMARY', lang, {
      name: plain(s.property.name, 60),
      month: monthLabel(s.month, lang),
      active: d(x.tenants.active),
      occupied: d(x.tenants.occupiedUnits),
      vacant: d(x.tenants.vacantUnits),
      occupancy: d(x.tenants.occupancyPct),
      billed: d(x.billed),
      collected: d(x.collected),
      rate: d(x.collectionRatePct),
      pending: d(x.pending),
      commissionRate: d(x.commission.ratePct),
      commission: d(x.commission.onCollected),
      net: d(x.net.payable),
      stillToReceive: d(x.net.stillToCollect),
      dueDate: dateLong(x.remittance.dueDate, lang),
      netByDue: d(x.remittance.netByDue),
      netAfterDue: d(x.remittance.netAfterDue),
    }),
  ];
  if (x.statement.source === 'estimate') lines.push('', wmsg('ESTIMATE_NOTE', lang));
  const note = lockedNote(s, lang);
  if (note) lines.push('', note);
  return lines.join('\n');
}

export function renderMoney(s: Snapshot, lang: Lang): string {
  const x = s.summary;
  const st = x.statement;
  const out: string[] = [
    wmsg('MONEY_HEAD', lang, {
      month: monthLabel(s.month, lang),
      billed: d(x.billed),
      collected: d(x.collected),
      pending: d(x.pending),
      rate: d(x.commission.ratePct),
      baseCollected: d(x.baseRent.collected),
      onCollected: d(x.commission.onCollected),
      baseBilled: d(x.baseRent.billed),
      onExpected: d(x.commission.onExpected),
    }),
  ];

  if (st.source === 'estimate') out.push(wmsg('ESTIMATE_NOTE', lang));
  else if (st.status) out.push(wmsg('MONEY_STATUS', lang, { status: wmsg(`STATUS_${st.status}` as const, lang) }));

  const income = st.items.filter((i) => i.kind === 'income');
  const deductions = st.items.filter((i) => i.kind === 'deduction');
  if (income.length) {
    out.push('', `*${wmsg('STATEMENT_INCOME', lang)}* (${d(st.income)})`);
    for (const i of income) out.push(`• ${plain(i.label, 60)}: ${d(i.amount)}`);
  }
  if (deductions.length) {
    out.push('', `*${wmsg('STATEMENT_DEDUCTIONS', lang)}* (${d(st.deductions)})`);
    for (const i of deductions) out.push(`• ${plain(i.label, 60)}: ${d(i.amount)}`);
  }
  out.push('', wmsg('STATEMENT_NET', lang, { net: d(st.netPayable) }));
  if (st.notes) out.push(wmsg('STATEMENT_NOTES', lang, { notes: plain(st.notes, 300) }));
  out.push('', wmsg('MONEY_IF_ALL', lang, { expected: d(x.net.expected) }));
  return out.join('\n');
}

export function renderTrend(s: Snapshot, lang: Lang): string {
  const rows = s.trend.map((t) =>
    wmsg('TREND_ROW', lang, {
      month: monthLabel(t.month, lang),
      billed: d(t.billed),
      collected: d(t.collected),
      pending: d(t.pending),
      net: d(t.netPayable),
    })
  );
  return [wmsg('TREND_HEAD', lang, { name: plain(s.property.name, 60) }), rows.join('\n\n')].join('\n\n');
}

// ── Who has / hasn't paid ────────────────────────────────────────────────

export type TenantListKind = 'paid' | 'unpaid';

/** "Who hasn't paid" also includes part-payments. Tenants without an invoice are reported separately. */
export function selectTenants(s: Snapshot, kind: TenantListKind): TenantRow[] {
  return s.tenants.filter((t) => (kind === 'paid' ? t.status === 'paid' : t.status === 'unpaid' || t.status === 'partial'));
}

function renderTenantRow(t: TenantRow, n: number, lang: Lang, today: string): string {
  const who = plain(t.name, 40) + (t.unit ? ` (${plain(t.unit, 8)})` : '');
  const phone = plain(t.phone, 20);
  if (t.status === 'paid') {
    const date = dateShort(t.paidOn, lang);
    return wmsg('ROW_PAID', lang, {
      n,
      who,
      phone,
      paid: d(t.paid),
      paidOn: date ? wmsg('PAID_ON', lang, { date }) : '',
      timing: t.paidOnTime === true ? wmsg('ON_TIME', lang) : t.paidOnTime === false ? wmsg('LATE', lang) : '',
    });
  }
  const due = dateShort(t.dueDate, lang);
  const overdue = !!t.dueDate && t.dueDate < today;
  const dueText = (due ? wmsg('DUE', lang, { date: due }) : '') + (overdue ? wmsg('OVERDUE', lang) : '');
  if (t.status === 'partial') {
    return wmsg('ROW_PARTIAL', lang, { n, who, phone, paid: d(t.paid), billed: d(t.billed), balance: d(t.balance), due: dueText });
  }
  return wmsg('ROW_UNPAID', lang, { n, who, phone, balance: d(t.balance), due: dueText });
}

export interface RenderedTenantList {
  text: string;
  page: Page<TenantRow>;
}

export function renderTenantList(s: Snapshot, kind: TenantListKind, lang: Lang, page: number, nowMs: number): RenderedTenantList {
  const all = selectTenants(s, kind);
  const pg = paginate(all, page, TENANT_PAGE_SIZE);
  const today = nairobiToday(nowMs);
  const header = wmsg(kind === 'paid' ? 'PAID_HEADER' : 'UNPAID_HEADER', lang, { month: monthLabel(s.month, lang), count: all.length });
  const parts: string[] = [header, ''];

  if (all.length === 0) {
    parts.push(wmsg(kind === 'paid' ? 'EMPTY_PAID' : 'EMPTY_UNPAID', lang));
  } else {
    pg.items.forEach((t, i) => parts.push(renderTenantRow(t, pg.page * TENANT_PAGE_SIZE + i + 1, lang, today)));
    if (pg.pages > 1) parts.push('', wmsg('PAGE_FOOTER', lang, { page: pg.page + 1, pages: pg.pages }));
  }
  if (kind === 'unpaid' && s.summary.invoices.noInvoice.v !== 0) {
    parts.push('', wmsg('NO_INVOICE_NOTE', lang, { count: d(s.summary.invoices.noInvoice) }));
  }
  const note = lockedNote(s, lang);
  if (note) parts.push('', note);
  return { text: parts.join('\n'), page: pg };
}
