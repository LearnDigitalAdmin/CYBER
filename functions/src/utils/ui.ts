/**
 * Interactive UI toolkit shared by every flow except Landlord Watch (which has its own engine): language, main menu,
 * Pay Rent, Invoice, Help and My Chama. Pure functions, no I/O.
 *
 * A handler returns a `Reply`: plain text, one WhatsApp message (text, reply buttons or list) or several, in order.
 *
 * Tapping a button or list row is EQUIVALENT TO TYPING A VALUE. Ids are `ui:<STATE>:<value>`; the webhook hands
 * `<value>` to the handler of the state the user is in, so every handler keeps its typed-input parsing and old habits
 * (`0` back, `00` My Chama menu, `#` main menu, `FULL`, option numbers) keep working.
 *
 * `<STATE>` is the state the message was sent in. Handlers build ids with the placeholder `*`; the sender stamps the
 * real state (read after the handler ran). A tap whose state no longer matches belongs to an old screen and is
 * answered with a "no longer active" notice instead of being acted on.
 */

import { Lang, Outbound, WaButton, WaRow } from '../types/watch.types';
import { STATE } from '../constants/states';
import { MAIN_MENU_ROWS, ulabel, umsg } from '../constants/ui.messages';
import { Page, paginate } from './watch.format';

export type Reply = string | Outbound | Outbound[];

// ── Ids ──────────────────────────────────────────────────────────────────

export const UI_PREFIX = 'ui:';
export const ANY_STATE = '*';
const UNSTAMPED = `${UI_PREFIX}${ANY_STATE}:`;
const TAP_RE = /^ui:([A-Z][A-Z0-9_]*):([\s\S]+)$/;

export const uiId = (value: string, state: string = ANY_STATE): string => `${UI_PREFIX}${state}:${value}`;

export const btn = (value: string, title: string, state?: string): WaButton => ({ id: uiId(value, state), title });

export const row = (value: string, title: string, description?: string, state?: string): WaRow => ({
  id: uiId(value, state),
  title,
  ...(description ? { description } : {}),
});

// ── Message builders ─────────────────────────────────────────────────────

export const uiText = (text: string): Outbound => ({ kind: 'text', text });

/** At most 3 reply buttons (a WhatsApp limit): extras are dropped from the END, so put the primary action first. */
export const uiButtons = (body: string, bs: WaButton[]): Outbound => ({ kind: 'buttons', body, buttons: bs.slice(0, 3) });

export const uiList = (body: string, button: string, rows: WaRow[]): Outbound => ({
  kind: 'list',
  body,
  button,
  rows: rows.slice(0, 10),
});

/** Put a short notice above an interactive message's body (one bubble instead of two). */
export function withNotice(o: Outbound, notice: string): Outbound {
  if (o.kind === 'buttons' || o.kind === 'list') return { ...o, body: `${notice}\n\n${o.body}` };
  if (o.kind === 'text') return { ...o, text: `${notice}\n\n${o.text}` };
  return o;
}

export function toOutbounds(reply: Reply): Outbound[] {
  if (typeof reply === 'string') return reply ? [{ kind: 'text', text: reply }] : [];
  return Array.isArray(reply) ? reply : [reply];
}

/** Message kinds only: safe to log (bodies can carry names, amounts or codes). */
export function describeReply(reply: Reply): string {
  return toOutbounds(reply)
    .map((o) => o.kind)
    .join(',');
}

// ── Stamping and taps ────────────────────────────────────────────────────

const idsOf = (o: Outbound): string[] => (o.kind === 'buttons' ? o.buttons.map((b) => b.id) : o.kind === 'list' ? o.rows.map((r) => r.id) : []);

/** True when some id still carries the `*` placeholder and so needs the session's real state. */
export function needsState(reply: Reply): boolean {
  return toOutbounds(reply).some((o) => idsOf(o).some((id) => id.startsWith(UNSTAMPED)));
}

/** Replace the `*` placeholder in every ui id with `state`. Ids that are already stamped (or not ours) are untouched. */
export function stampReply(reply: Reply, state: string): Outbound[] {
  const stamp = (id: string): string => (id.startsWith(UNSTAMPED) ? uiId(id.slice(UNSTAMPED.length), state) : id);
  return toOutbounds(reply).map((o): Outbound => {
    if (o.kind === 'buttons') return { ...o, buttons: o.buttons.map((b) => ({ ...b, id: stamp(b.id) })) };
    if (o.kind === 'list') return { ...o, rows: o.rows.map((r) => ({ ...r, id: stamp(r.id) })) };
    return o;
  });
}

export type Tap = { kind: 'input'; value: string } | { kind: 'stale' };

/** null when the id is not one of ours. Otherwise the value to feed the handler, or `stale` if the screen has moved on. */
export function resolveTap(interactiveId: string | undefined, currentState: string): Tap | null {
  if (!interactiveId || !interactiveId.startsWith(UI_PREFIX)) return null;
  const m = TAP_RE.exec(interactiveId);
  if (!m || m[1] !== currentState) return { kind: 'stale' };
  return { kind: 'input', value: m[2] };
}

/**
 * What a user would type to choose this item when only plain text can be sent (Meta rejected the interactive form).
 * ui ids use their value (`1`, `0`, `FULL`, `#`); paging rows have no typed equivalent and return null.
 */
export function typedKey(id: string, index: number): string | null {
  const m = TAP_RE.exec(id);
  if (!m) return String(index + 1);
  return /^[A-Za-z0-9#]{1,8}$/.test(m[2]) ? m[2] : null;
}

// ── Pickers ──────────────────────────────────────────────────────────────

export interface PickItem {
  title: string;
  description?: string;
}

/** 7 items + Previous + More + Back = the 10-row WhatsApp list limit. */
export const PICKER_PAGE_SIZE = 7;

/**
 * Rows for a list of choices. An item's value is its 1-based position in the WHOLE list (not the page), so typing
 * "12" works exactly like tapping the 12th item, whichever page is showing. Paging rows carry `pg:<n>`.
 */
export function pickerRows(items: PickItem[], page: number, lang: Lang, opts: { back?: boolean } = {}): { rows: WaRow[]; page: Page<PickItem> } {
  const pg = paginate(items, page, PICKER_PAGE_SIZE);
  const rows: WaRow[] = pg.items.map((it, i) => row(String(pg.page * PICKER_PAGE_SIZE + i + 1), it.title, it.description));
  if (pg.hasPrev) rows.push(row(`pg:${pg.page - 1}`, ulabel('PREV', lang)));
  if (pg.hasNext) rows.push(row(`pg:${pg.page + 1}`, ulabel('MORE', lang)));
  if (opts.back) rows.push(row('0', ulabel('BACK', lang)));
  return { rows, page: pg };
}

// ── Common screens ───────────────────────────────────────────────────────

export const mainButton = (lang: Lang): WaButton => btn('#', ulabel('MAIN', lang));

/** Language chooser. Ids are pre-stamped: it is also sent when a session has just expired. */
export function welcomeReply(): Outbound {
  return uiButtons(umsg('WELCOME', 'en'), [
    btn('1', ulabel('ENGLISH', 'en'), STATE.LANGUAGE_SELECTION),
    btn('2', ulabel('KISWAHILI', 'en'), STATE.LANGUAGE_SELECTION),
  ]);
}

/** The main menu as a WhatsApp list. Pre-stamped, so it can also be sent from outside the webhook (Landlord Watch). */
export function mainMenuReply(lang: Lang): Outbound {
  return uiList(
    umsg('MAIN_MENU', lang),
    ulabel('LIST_BUTTON', lang),
    MAIN_MENU_ROWS.map((r) => row(r.value, r.title[lang], r.desc[lang], STATE.MAIN_MENU))
  );
}

export const helpReply = (lang: Lang): Outbound => uiButtons(umsg('HELP', lang), [mainButton(lang)]);
export const plotReply = (lang: Lang): Outbound => uiButtons(umsg('PLOT', lang), [mainButton(lang)]);
export const staleReply = (lang: Lang): Outbound => uiButtons(umsg('STALE', lang), [mainButton(lang)]);
