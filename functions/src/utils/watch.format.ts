/**
 * Landlord Watch: pure helpers (no Firebase, no I/O).
 * Money, percentages, masking and quota are NEVER computed here: the server's `d` strings are rendered as-is.
 * The only formatting done locally is for plain dates, month names, Kenyan phone input and the quota price
 * (which the contract returns as a bare number, not an `N`).
 */

import { Lang } from '../types/watch.types';

// ── Owner ID ─────────────────────────────────────────────────────────────

const OWNER_ID_RE = /^PYP-\d{4,}$/;

/**
 * Validate and normalise a typed Owner ID. Accepts `PYP-0001`, `pyp-0001`, `PYP 0001`, `PYP0001`
 * and typographic dashes. Returns null when it cannot be a valid `PYP-NNNN`.
 */
export function normalizeOwnerId(input: string): string | null {
  const cleaned = (input || '')
    .normalize('NFKC')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/\s+/g, '')
    .toUpperCase();
  const m = /^PYP-?(\d{4,12})$/.exec(cleaned);
  if (!m) return null;
  const id = `PYP-${m[1]}`;
  return OWNER_ID_RE.test(id) ? id : null;
}

// ── Phones ───────────────────────────────────────────────────────────────

/** WhatsApp `from` (digits only, e.g. 254712345678) to E.164. */
export function toE164(waId: string): string {
  return '+' + (waId || '').replace(/\D/g, '');
}

/** Typed Kenyan mobile number to E.164 (`+2547XXXXXXXX` / `+2541XXXXXXXX`), or null. */
export function normalizeKenyanPhone(input: string): string | null {
  const digits = (input || '').replace(/[\s\-().]/g, '').replace(/^\+/, '');
  if (!/^\d+$/.test(digits)) return null;
  let national: string;
  if (/^254[17]\d{8}$/.test(digits)) national = digits.slice(3);
  else if (/^0[17]\d{8}$/.test(digits)) national = digits.slice(1);
  else if (/^[17]\d{8}$/.test(digits)) national = digits;
  else return null;
  return '+254' + national;
}

export function isSafaricomE164(phone: string): boolean {
  return /^\+254[17]\d{8}$/.test(phone);
}

// ── Text safety / sizing ─────────────────────────────────────────────────

/**
 * Server strings are plain text. Strip control characters and the characters WhatsApp treats as
 * formatting so a tenant name can never bold, strike or code-block the rest of the message.
 */
export function plain(value: string | null | undefined, max = 60): string {
  const s = (value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[*_~`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return truncate(s, max);
}

export function truncate(s: string, max: number): string {
  if (max <= 0) return '';
  if (s.length <= max) return s;
  if (max === 1) return '…';
  return s.slice(0, max - 1).trimEnd() + '…';
}

/** Split a long text on line breaks so every chunk stays under `max` characters (WhatsApp hard limit 4,096). */
export function chunkText(text: string, max = 3500): string[] {
  if (text.length <= max) return [text];
  const chunks: string[] = [];
  let current = '';
  for (const line of text.split('\n')) {
    const piece = line.length > max ? line.slice(0, max) : line;
    if (current && current.length + 1 + piece.length > max) {
      chunks.push(current);
      current = piece;
    } else {
      current = current ? current + '\n' + piece : piece;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/** Replace `{name}` placeholders. Unknown placeholders are left untouched. */
export function fill(template: string, params: Record<string, string | number | undefined> = {}): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const v = params[key];
    return v === undefined ? whole : String(v);
  });
}

/** `KES 99`. Only used for the quota price, which the contract returns as a bare number. */
export function kes(amount: number): string {
  const s = Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace(/\.?0+$/, '');
  const [int, dec] = s.split('.');
  return `KES ${int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${dec ? '.' + dec : ''}`;
}

// ── Pagination ───────────────────────────────────────────────────────────

export interface Page<T> {
  items: T[];
  page: number;
  pages: number;
  total: number;
  hasPrev: boolean;
  hasNext: boolean;
}

export function paginate<T>(items: T[], page: number, size: number): Page<T> {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / Math.max(1, size)));
  const p = Math.min(Math.max(0, Math.trunc(page) || 0), pages - 1);
  return {
    items: items.slice(p * size, p * size + size),
    page: p,
    pages,
    total,
    hasPrev: p > 0,
    hasNext: p < pages - 1,
  };
}

// ── Dates (Africa/Nairobi, UTC+3 all year) ───────────────────────────────

const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000;

const MONTHS: Record<Lang, string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  sw: ['Januari', 'Februari', 'Machi', 'Aprili', 'Mei', 'Juni', 'Julai', 'Agosti', 'Septemba', 'Oktoba', 'Novemba', 'Desemba'],
};
const MONTHS_SHORT: Record<Lang, string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  sw: ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ago', 'Sep', 'Okt', 'Nov', 'Des'],
};

/** `YYYY-MM-DD` for "today" in Nairobi. */
export function nairobiToday(nowMs: number): string {
  return new Date(nowMs + NAIROBI_OFFSET_MS).toISOString().slice(0, 10);
}

/** `2026-10` to `October 2026` / `Oktoba 2026`. Falls back to the input when malformed. */
export function monthLabel(ym: string, lang: Lang, short = false): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!m) return plain(ym, 20);
  const idx = parseInt(m[2], 10) - 1;
  if (idx < 0 || idx > 11) return plain(ym, 20);
  return `${(short ? MONTHS_SHORT : MONTHS)[lang][idx]} ${m[1]}`;
}

/** `2026-10-15` to `15 October 2026` / `15 Oktoba 2026`. */
export function dateLong(isoDate: string | null | undefined, lang: Lang): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate ?? '');
  if (!m) return '';
  const idx = parseInt(m[2], 10) - 1;
  if (idx < 0 || idx > 11) return '';
  return `${parseInt(m[3], 10)} ${MONTHS[lang][idx]} ${m[1]}`;
}

/** `2026-10-04` to `4 Oct` / `4 Okt`. */
export function dateShort(isoDate: string | null | undefined, lang: Lang): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate ?? '');
  if (!m) return '';
  const idx = parseInt(m[2], 10) - 1;
  if (idx < 0 || idx > 11) return '';
  return `${parseInt(m[3], 10)} ${MONTHS_SHORT[lang][idx]}`;
}

/** ISO timestamp to `24 Oct 2026, 14:30` in Nairobi time. */
export function dateTimeNairobi(iso: string | null | undefined, lang: Lang): string {
  const t = Date.parse(iso ?? '');
  if (Number.isNaN(t)) return '';
  const d = new Date(t + NAIROBI_OFFSET_MS);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${d.getUTCDate()} ${MONTHS_SHORT[lang][d.getUTCMonth()]} ${d.getUTCFullYear()}, ${hh}:${mm}`;
}

// ── WhatsApp service window ──────────────────────────────────────────────

const WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Free-form replies are only allowed within 24 h of the user's last message.
 * `inboundTimestampSec` is the Meta message timestamp (seconds since epoch).
 */
export function insideServiceWindow(inboundTimestampSec: number | string | undefined, nowMs: number): boolean {
  const ts = Number(inboundTimestampSec);
  if (!Number.isFinite(ts) || ts <= 0) return true; // unknown: let Meta decide
  return nowMs - ts * 1000 < WINDOW_MS;
}

// ── Command parsing ──────────────────────────────────────────────────────

export type NavCommand = 'back' | 'main' | 'help' | 'language' | 'resend' | 'cancel' | null;

/** Typed shortcuts understood in every Landlord Watch state. */
export function parseNavCommand(input: string): NavCommand {
  const c = (input || '').trim().toLowerCase();
  if (c === '0' || c === 'back' || c === 'nyuma') return 'back';
  if (c === '#' || c === '000' || c === 'main' || c === 'main menu' || c === 'menu kuu' || c === 'exit' || c === 'toka') return 'main';
  if (c === 'help' || c === 'msaada') return 'help';
  if (c === 'lang' || c === 'language' || c === 'lugha') return 'language';
  if (c === 'resend' || c === 'tuma tena') return 'resend';
  if (c === 'cancel' || c === 'ghairi') return 'cancel';
  return null;
}

/** Keyword shortcuts from the SAMUHIA main menu into Landlord Watch. */
export function isWatchKeyword(input: string): boolean {
  const c = (input || '').trim().replace(/\s+/g, ' ').toUpperCase();
  return c === 'WATCH' || c === 'LANDLORD' || c === 'MWENYE NYUMBA' || c === 'LANDLORD WATCH';
}

/** Yes / No in both languages (typed fallback for the reply buttons). */
export function parseYesNo(input: string): 'yes' | 'no' | null {
  const c = (input || '').trim().toLowerCase();
  if (['yes', 'y', 'ndiyo', 'ndio', 'ok', 'confirm', 'sawa'].includes(c)) return 'yes';
  if (['no', 'n', 'hapana', 'la'].includes(c)) return 'no';
  return null;
}

/** An OTP is exactly six digits; spaces and dashes (from copy/paste) are tolerated. */
export function parseOtp(input: string): string | null {
  const c = (input || '').replace(/[\s-]/g, '');
  return /^\d{6}$/.test(c) ? c : null;
}
