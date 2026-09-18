/**
 * MyChama Statement Service
 *
 * Builds plain-text statements sized for WhatsApp. WhatsApp hard-caps a text
 * body at 4096 characters, so every builder truncates by row count first and
 * the assembler trims again at the end — a member should always get a readable
 * statement, never a silently dropped message.
 */

import { Lang } from '../constants/mychama.messages';
import {
  Chama,
  ChamaMember,
  Contribution,
  Loan,
  MgrPot,
  MgrRecord,
  ChamaTransaction,
} from '../types/mychama.types';
import {
  kes,
  fmtDate,
  loanOutstanding,
  loanPaid,
  nextUnpaidInstallment,
  contributionDue,
} from './mychama.service';

export type StatementType = 'contributions' | 'loans' | 'mgr' | 'full';
export type StatementPeriod = 'month' | 'quarter' | 'year' | 'all';

const MAX_BODY = 3900;

const T = {
  header: { en: 'STATEMENT', sw: 'TAARIFA' },
  member: { en: 'Member', sw: 'Mwanachama' },
  generated: { en: 'Generated', sw: 'Imetolewa' },
  period: { en: 'Period', sw: 'Kipindi' },
  contributions: { en: 'CONTRIBUTIONS', sw: 'MICHANGO' },
  loans: { en: 'LOANS', sw: 'MIKOPO' },
  mgr: { en: 'MERRY-GO-ROUND', sw: 'MZUNGUKO' },
  payments: { en: 'PAYMENTS RECEIVED', sw: 'MALIPO YALIYOPOKELEWA' },
  totalContributed: { en: 'Total contributed', sw: 'Jumla ya michango' },
  credit: { en: 'Credit on file', sw: 'Salio la ziada' },
  outstanding: { en: 'Outstanding', sw: 'Deni' },
  nothing: { en: 'No records for this period.', sw: 'Hakuna kumbukumbu kwa kipindi hiki.' },
  paid: { en: 'paid', sw: 'imelipwa' },
  partial: { en: 'partial', sw: 'sehemu' },
  pending: { en: 'pending', sw: 'inasubiri' },
  overdue: { en: 'overdue', sw: 'imechelewa' },
  missed: { en: 'missed', sw: 'haikulipwa' },
  principal: { en: 'Principal', sw: 'Msingi' },
  repaid: { en: 'Repaid', sw: 'Imelipwa' },
  balance: { en: 'Balance', sw: 'Salio' },
  nextDue: { en: 'Next due', sw: 'Inayofuata' },
  status: { en: 'Status', sw: 'Hali' },
  truncated: {
    en: '… list trimmed. Open the MyChama app for the full history.',
    sw: '… orodha imepunguzwa. Fungua programu ya MyChama kwa historia kamili.',
  },
  footer: {
    en: 'This statement is generated from your chama records at the time shown above.',
    sw: 'Taarifa hii imetolewa kutoka kumbukumbu za chama chako kwa wakati ulioonyeshwa hapo juu.',
  },
} as const;

function t(key: keyof typeof T, lang: Lang): string {
  return T[key][lang] || T[key].en;
}

const STATUS_KEY: Record<string, keyof typeof T> = {
  paid: 'paid',
  partial: 'partial',
  pending: 'pending',
  overdue: 'overdue',
  missed: 'missed',
};

function statusLabel(status: string, lang: Lang): string {
  const key = STATUS_KEY[status];
  return key ? t(key, lang) : status;
}

export function periodLabel(period: StatementPeriod, lang: Lang): string {
  const labels: Record<StatementPeriod, Record<Lang, string>> = {
    month: { en: 'This month', sw: 'Mwezi huu' },
    quarter: { en: 'Last 3 months', sw: 'Miezi 3 iliyopita' },
    year: { en: 'This year', sw: 'Mwaka huu' },
    all: { en: 'All time', sw: 'Muda wote' },
  };
  return labels[period][lang];
}

/** Inclusive lower bound as an ISO date, or null for "all time". */
export function periodStartISO(period: StatementPeriod): string | null {
  const now = new Date();

  if (period === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  }
  if (period === 'quarter') {
    const d = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return d.toISOString().slice(0, 10);
  }
  if (period === 'year') {
    return new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
  }
  return null;
}

/** Same bound expressed as a YYYY-MM period key, for contributions. */
export function periodStartKey(period: StatementPeriod): string | null {
  const iso = periodStartISO(period);
  return iso ? iso.slice(0, 7) : null;
}

function section(title: string, body: string): string {
  return `\n*${title}*\n${'─'.repeat(Math.min(title.length + 2, 20))}\n${body}\n`;
}

export function buildContributionSection(
  contributions: Contribution[],
  member: ChamaMember,
  lang: Lang
): string {
  const rows = contributions.slice(0, 14);

  if (rows.length === 0) {
    return section(t('contributions', lang), t('nothing', lang));
  }

  const lines = rows.map((c) => {
    const paidPart =
      c.status === 'paid'
        ? kes(c.amount)
        : `${kes(c.paidAmount || 0)} / ${kes(c.amount)}`;
    const when = c.paidOn ? ` · ${fmtDate(c.paidOn)}` : '';
    return `• ${c.period} — ${paidPart} (${statusLabel(c.status, lang)})${when}`;
  });

  const outstanding = contributions.reduce((s, c) => s + contributionDue(c), 0);

  lines.push('');
  lines.push(`${t('totalContributed', lang)}: *${kes(member.totalContributed || 0)}*`);
  if (outstanding > 0.5) {
    lines.push(`${t('outstanding', lang)}: *${kes(outstanding)}*`);
  }
  if ((member.creditBalance || 0) > 0.5) {
    lines.push(`${t('credit', lang)}: ${kes(member.creditBalance)}`);
  }
  if (contributions.length > rows.length) {
    lines.push(t('truncated', lang));
  }

  return section(t('contributions', lang), lines.join('\n'));
}

export function buildLoanSection(loans: Loan[], lang: Lang): string {
  if (loans.length === 0) {
    return section(t('loans', lang), t('nothing', lang));
  }

  const blocks = loans.slice(0, 6).map((loan) => {
    const outstanding = loanOutstanding(loan);
    const repaid = loanPaid(loan);
    const next = nextUnpaidInstallment(loan);

    const parts = [
      `• ${loan.productId} · ${fmtDate(loan.requestedOn)}`,
      `  ${t('principal', lang)}: ${kes(loan.principal)} · ${loan.term}m`,
      `  ${t('repaid', lang)}: ${kes(repaid)} · ${t('balance', lang)}: *${kes(outstanding)}*`,
      `  ${t('status', lang)}: ${loan.status}`,
    ];

    if (next && (loan.status === 'active' || loan.status === 'overdue')) {
      parts.push(
        `  ${t('nextDue', lang)}: ${kes(next.due - (next.paidAmount || 0))} · ${fmtDate(next.dueDate)}`
      );
    }

    return parts.join('\n');
  });

  if (loans.length > 6) {
    blocks.push(t('truncated', lang));
  }

  return section(t('loans', lang), blocks.join('\n\n'));
}

export function buildMgrSection(
  entries: Array<{ pot: MgrPot; records: MgrRecord[] }>,
  lang: Lang
): string {
  if (entries.length === 0) {
    return section(t('mgr', lang), t('nothing', lang));
  }

  const blocks = entries.slice(0, 5).map(({ pot, records }) => {
    const paid = records.filter((r) => r.status === 'paid');
    const missed = records.filter((r) => r.status === 'missed');
    const contributed = paid.reduce((s, r) => s + (r.amount || 0), 0);

    const recent = records
      .slice(0, 6)
      .map((r) => `  · P${r.period} ${kes(r.amount)} (${statusLabel(r.status, lang)})`)
      .join('\n');

    return [
      `• ${pot.name} — ${kes(pot.amount)} ${pot.frequency}`,
      `  ${t('totalContributed', lang)}: *${kes(contributed)}* (${paid.length} ${t('paid', lang)}, ${missed.length} ${t('missed', lang)})`,
      recent,
    ]
      .filter(Boolean)
      .join('\n');
  });

  return section(t('mgr', lang), blocks.join('\n\n'));
}

export function buildTransactionSection(txns: ChamaTransaction[], lang: Lang): string {
  if (txns.length === 0) {
    return section(t('payments', lang), t('nothing', lang));
  }

  const rows = txns.slice(0, 15).map((tx) => {
    const sign = tx.direction === 'in' ? '+' : '−';
    return `• ${fmtDate(tx.date)} ${sign}${kes(tx.amount)} ${tx.type.replace(/_/g, ' ')}${
      tx.ref ? ` · ${tx.ref}` : ''
    }`;
  });

  if (txns.length > rows.length) {
    rows.push(t('truncated', lang));
  }

  return section(t('payments', lang), rows.join('\n'));
}

/** Assemble the final message and hard-trim to WhatsApp's limit. */
export function assembleStatement(params: {
  chama: Chama;
  member: ChamaMember;
  period: StatementPeriod;
  sections: string[];
  lang: Lang;
}): string {
  const { chama, member, period, sections, lang } = params;

  const head =
    `📄 *${chama.name} — ${t('header', lang)}*\n` +
    `${t('member', lang)}: ${member.name}\n` +
    `${t('period', lang)}: ${periodLabel(period, lang)}\n` +
    `${t('generated', lang)}: ${fmtDate(new Date().toISOString())}\n`;

  const foot = `\n_${t('footer', lang)}_`;

  let body = head + sections.join('') + foot;

  if (body.length > MAX_BODY) {
    body = body.slice(0, MAX_BODY - foot.length - 4) + '…\n' + foot;
  }

  return body;
}
