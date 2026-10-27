/**
 * House to Rent handler.
 *
 *   HTR_AREA         type an area                           (0 main menu)
 *   HTR_RESULTS      vacant units in that area, paged       (0 new search)
 *   HTR_UNIT         one unit: Send Inquiry / Contact Manager   (0 results)
 *   HTR_CONTACT      the property management's details      (0 unit)
 *   HTR_INQ_PHONE    the number to pass on to the manager   (0 unit)
 *   HTR_INQ_CONFIRM  the exact SMS, then send               (0 phone)
 *
 * Typed shortcuts work everywhere: 0 back, 00 start over, 000 language, # main menu (the webhook handles #).
 * Every screen's buttons are equivalent to typing their value (see utils/ui.ts).
 */
import { Session } from '../types/session.types';
import { STATE } from '../constants/states';
import { getMessage } from '../constants/messages';
import { hlabel, hmsg, HouseMsgKey, unitConditionText, unitSizeText, unitTypeText } from '../constants/house.messages';
import { ulabel } from '../constants/ui.messages';
import { clearSessionContext, updateSessionState } from '../services/session.service';
import * as house from '../services/house.service';
import { areaTokens } from '../utils/house.match';
import { checkNavigationCommand } from '../utils/validator';
import { kes, parseYesNo, plain, toE164, normalizeKenyanPhone, truncate } from '../utils/watch.format';
import { btn, mainButton, mainMenuReply, pickerRows, Reply, uiButtons, uiList, welcomeReply, withNotice } from '../utils/ui';
import { logger } from '../utils/logger';

const CTX = 'htr';

type Lang = 'en' | 'sw';

/** What the session remembers: the search, the units found (so paging and picking need no new query) and the choices made. */
interface HtrCtx {
  area?: string;
  units?: house.VacantUnit[];
  page?: number;
  sel?: number;
  inquirer?: string;
}

const readCtx = (s: Session): HtrCtx => {
  const raw = s.context?.[CTX];
  return (raw && typeof raw === 'object' ? raw : {}) as HtrCtx;
};

const save = (phone: string, state: string, ctx: HtrCtx) => updateSessionState(phone, state, { [CTX]: ctx });

export const isHouseState = (state: string): boolean => state.startsWith('HTR_');

// ── Screens ──────────────────────────────────────────────────────────────

const areaScreen = (lang: Lang, notice?: string): Reply => {
  const screen = uiButtons(hmsg('ASK_AREA', lang), [btn('0', ulabel('BACK', lang)), mainButton(lang)]);
  return notice ? withNotice(screen, notice) : screen;
};

function resultsScreen(ctx: HtrCtx, lang: Lang, notice?: string): Reply {
  const units = ctx.units ?? [];
  const count = units.length === 1 ? hmsg('COUNT_ONE', lang) : hmsg('COUNT_MANY', lang, { n: units.length });
  const items = units.map((u) => ({
    title: truncate(unitSizeText(u.unitSize, lang), 24),
    description: truncate(`${u.unitNumber} · ${kes(u.rentAmount)} · ${plain(u.propertyName, 40)}`, 72),
  }));
  const { rows } = pickerRows(items, ctx.page ?? 0, lang, { back: true });
  const list = uiList(hmsg('RESULTS', lang, { count, area: ctx.area ?? '' }), ulabel('LIST_BUTTON', lang), rows);
  return notice ? withNotice(list, notice) : list;
}

function unitScreen(u: house.VacantUnit, lang: Lang, canInquire: boolean, notice?: string): Reply {
  const body = hmsg('UNIT', lang, {
    size: unitSizeText(u.unitSize, lang),
    unit: plain(u.unitNumber, 20),
    property: plain(u.propertyName, 60),
    address: plain(u.address, 80) || hmsg('NO_ADDRESS', lang),
    type: unitTypeText(u.unitType, lang),
    condition: unitConditionText(u.condition, lang),
    rent: kes(u.rentAmount),
    deposit: u.depositAmount > 0 ? kes(u.depositAmount) : hmsg('NO_DEPOSIT', lang),
  });
  const buttons = canInquire
    ? [btn('1', hlabel('SEND_INQUIRY', lang)), btn('2', hlabel('CONTACT_MANAGER', lang)), btn('0', ulabel('BACK', lang))]
    : [btn('2', hlabel('CONTACT_MANAGER', lang)), btn('0', ulabel('BACK', lang)), mainButton(lang)];
  const screen = uiButtons(body, buttons);
  return notice ? withNotice(screen, notice) : screen;
}

function contactScreen(u: house.VacantUnit, m: house.Manager | null, lang: Lang, canInquire: boolean): Reply {
  const lines: string[] = [];
  if (m?.name) lines.push(hmsg('CONTACT_NAME', lang, { v: plain(m.name, 60) }));
  if (m?.company) lines.push(hmsg('CONTACT_COMPANY', lang, { v: plain(m.company, 60) }));
  if (m?.phone) lines.push(hmsg('CONTACT_PHONE', lang, { v: plain(m.phone, 30) }));
  if (m?.email) lines.push(hmsg('CONTACT_EMAIL', lang, { v: plain(m.email, 60) }));
  const body = hmsg('CONTACT', lang, {
    lines: lines.join('\n'),
    size: unitSizeText(u.unitSize, lang),
    unit: plain(u.unitNumber, 20),
    property: plain(u.propertyName, 60),
  });
  const buttons = canInquire
    ? [btn('1', hlabel('SEND_INQUIRY', lang)), btn('0', ulabel('BACK', lang)), mainButton(lang)]
    : [btn('0', ulabel('BACK', lang)), mainButton(lang)];
  return uiButtons(body, buttons);
}

const phoneScreen = (lang: Lang, waLocalPhone: string | null, notice?: string): Reply => {
  const buttons = [
    ...(waLocalPhone ? [btn('1', hlabel('USE_NUMBER', lang, { phone: waLocalPhone }))] : []),
    btn('0', ulabel('BACK', lang)),
    mainButton(lang),
  ];
  const screen = uiButtons(hmsg('ASK_PHONE', lang), buttons);
  return notice ? withNotice(screen, notice) : screen;
};

/** The WhatsApp number as a Kenyan number to offer on the button, or null when it is not one. */
function waNumber(phone: string): string | null {
  const e164 = normalizeKenyanPhone(toE164(phone));
  return e164 ? house.toLocalPhone(e164) : null;
}

// ── Transitions (each saves the session state it lands in) ───────────────

async function showArea(phone: string, lang: Lang, notice?: string): Promise<Reply> {
  await save(phone, STATE.HTR_AREA, {});
  return areaScreen(lang, notice);
}

async function showResults(phone: string, ctx: HtrCtx, lang: Lang, notice?: string): Promise<Reply> {
  if (!ctx.units?.length) return showArea(phone, lang, notice);
  const next = { area: ctx.area, units: ctx.units, page: ctx.page ?? 0 };
  await save(phone, STATE.HTR_RESULTS, next);
  return resultsScreen(next, lang, notice);
}

async function showUnit(phone: string, ctx: HtrCtx, lang: Lang, notice?: string): Promise<Reply> {
  const unit = ctx.units?.[ctx.sel ?? -1];
  if (!unit) return showResults(phone, ctx, lang, notice);
  const canInquire = house.canSendInquiry(await house.getManager(unit.userId));
  await save(phone, STATE.HTR_UNIT, { area: ctx.area, units: ctx.units, page: ctx.page, sel: ctx.sel });
  return unitScreen(unit, lang, canInquire, notice);
}

/** A search from anywhere that takes an area: validates it, looks it up, lands on results or on "none found". */
async function search(phone: string, rawArea: string, lang: Lang): Promise<Reply> {
  const area = plain(rawArea, 40);
  if (areaTokens(area).length === 0) return showArea(phone, lang, hmsg('BAD_AREA', lang));
  const units = await house.findVacantUnits(area);
  logger.info('House to Rent: search', { found: units.length });
  if (!units.length) return showArea(phone, lang, hmsg('NONE', lang, { area }));
  return showResults(phone, { area, units, page: 0 }, lang);
}

// ── Entry and dispatcher ─────────────────────────────────────────────────

/** Main menu entry. */
export async function beginHouseToRent(phone: string, session: Session): Promise<Reply> {
  return showArea(phone, session.language);
}

const FAILURE_COPY: Record<house.InquiryFailure, HouseMsgKey> = {
  gone: 'GONE',
  no_sms: 'SMS_UNAVAILABLE',
  no_credits: 'SMS_UNAVAILABLE',
  limit: 'LIMIT',
  duplicate: 'DUPLICATE',
  failed: 'SEND_FAILED',
};

/** Any message received while the session is in an HTR_* state. */
export async function handleHouseToRent(phone: string, input: string, session: Session): Promise<Reply> {
  const lang = session.language;
  try {
    const ctx = readCtx(session);
    const text = input.trim();

    // 000 language screen, 00 start over, 0 back one screen
    const nav = checkNavigationCommand(text);
    if (nav.type === 'exit') {
      await clearSessionContext(phone);
      await updateSessionState(phone, STATE.LANGUAGE_SELECTION, {});
      return welcomeReply();
    }
    if (nav.type === 'restart') return showArea(phone, lang);
    if (nav.type === 'back') return goBack(phone, session.currentState, ctx, lang);

    switch (session.currentState) {
      case STATE.HTR_AREA:
        return search(phone, text, lang);
      case STATE.HTR_RESULTS:
        return onResults(phone, text, ctx, lang);
      case STATE.HTR_UNIT:
        return onUnit(phone, text, ctx, lang);
      case STATE.HTR_CONTACT:
        return onContact(phone, text, ctx, lang);
      case STATE.HTR_INQ_PHONE:
        return onInquiryPhone(phone, text, ctx, lang);
      case STATE.HTR_INQ_CONFIRM:
        return onInquiryConfirm(phone, text, ctx, lang);
      default:
        return showArea(phone, lang);
    }
  } catch (error) {
    logger.error('Error in House to Rent', error);
    return getMessage('SYSTEM_ERROR', lang);
  }
}

async function goBack(phone: string, state: string, ctx: HtrCtx, lang: Lang): Promise<Reply> {
  switch (state) {
    case STATE.HTR_RESULTS:
      return showArea(phone, lang);
    case STATE.HTR_UNIT:
      return showResults(phone, ctx, lang);
    case STATE.HTR_CONTACT:
    case STATE.HTR_INQ_PHONE:
      return showUnit(phone, ctx, lang);
    case STATE.HTR_INQ_CONFIRM: {
      await save(phone, STATE.HTR_INQ_PHONE, { ...ctx, inquirer: undefined });
      return phoneScreen(lang, waNumber(phone));
    }
    default: {
      // HTR_AREA (the first screen) leaves to the main menu
      await clearSessionContext(phone);
      await updateSessionState(phone, STATE.MAIN_MENU, {});
      return mainMenuReply(lang);
    }
  }
}

// ── Per-state handlers ───────────────────────────────────────────────────

async function onResults(phone: string, text: string, ctx: HtrCtx, lang: Lang): Promise<Reply> {
  const units = ctx.units ?? [];

  const paged = /^pg:(\d{1,3})$/.exec(text);
  if (paged) return showResults(phone, { ...ctx, page: Number(paged[1]) }, lang);

  if (/^\d{1,3}$/.test(text)) {
    const index = Number(text) - 1;
    const unit = units[index];
    if (!unit) return resultsScreen(ctx, lang);
    // The list can be minutes old: check the unit is still free before showing it
    if (!(await house.isStillVacant(unit))) {
      const rest = units.filter((_, i) => i !== index);
      return showResults(phone, { area: ctx.area, units: rest, page: 0 }, lang, hmsg('GONE', lang));
    }
    return showUnit(phone, { ...ctx, sel: index }, lang);
  }

  // Anything else typed here is a new area
  return search(phone, text, lang);
}

async function onUnit(phone: string, text: string, ctx: HtrCtx, lang: Lang): Promise<Reply> {
  const unit = ctx.units?.[ctx.sel ?? -1];
  if (!unit) return showResults(phone, ctx, lang);
  const c = text.toLowerCase();

  if (c === '1' || c === 'inquiry' || c === 'maulizo') return startInquiry(phone, ctx, unit, lang);

  if (c === '2' || c === 'contact' || c === 'mawasiliano') {
    const manager = await house.getManager(unit.userId);
    await save(phone, STATE.HTR_CONTACT, ctx);
    return contactScreen(unit, manager, lang, house.canSendInquiry(manager));
  }
  return showUnit(phone, ctx, lang);
}

async function onContact(phone: string, text: string, ctx: HtrCtx, lang: Lang): Promise<Reply> {
  const unit = ctx.units?.[ctx.sel ?? -1];
  if (!unit) return showResults(phone, ctx, lang);
  if (text === '1') return startInquiry(phone, ctx, unit, lang);
  const manager = await house.getManager(unit.userId);
  return contactScreen(unit, manager, lang, house.canSendInquiry(manager));
}

/** Send Inquiry: only when the manager can receive and pay for an SMS; then ask for the number to pass on. */
async function startInquiry(phone: string, ctx: HtrCtx, unit: house.VacantUnit, lang: Lang): Promise<Reply> {
  if (!house.canSendInquiry(await house.getManager(unit.userId))) {
    return showUnit(phone, ctx, lang, hmsg('SMS_UNAVAILABLE', lang));
  }
  await save(phone, STATE.HTR_INQ_PHONE, ctx);
  return phoneScreen(lang, waNumber(phone));
}

async function onInquiryPhone(phone: string, text: string, ctx: HtrCtx, lang: Lang): Promise<Reply> {
  const unit = ctx.units?.[ctx.sel ?? -1];
  if (!unit) return showResults(phone, ctx, lang);

  const inquirer = text === '1' ? normalizeKenyanPhone(toE164(phone)) : normalizeKenyanPhone(text);
  if (!inquirer) return phoneScreen(lang, waNumber(phone), hmsg('BAD_PHONE', lang));

  const preview = await house.previewInquiry(unit, inquirer);
  if (!preview.ok) return afterFailure(phone, ctx, preview.reason, lang);

  await save(phone, STATE.HTR_INQ_CONFIRM, { ...ctx, inquirer });
  return uiButtons(hmsg('CONFIRM', lang, { name: plain(preview.managerName, 60), sms: plain(preview.sms, 400) }), [
    btn('1', hlabel('SEND_NOW', lang)),
    btn('0', ulabel('BACK', lang)),
    mainButton(lang),
  ]);
}

async function onInquiryConfirm(phone: string, text: string, ctx: HtrCtx, lang: Lang): Promise<Reply> {
  const unit = ctx.units?.[ctx.sel ?? -1];
  if (!unit || !ctx.inquirer) return showResults(phone, ctx, lang);

  const answer = text === '1' ? 'yes' : parseYesNo(text);
  if (answer === 'no') return showUnit(phone, ctx, lang);
  if (answer !== 'yes') {
    // Not an answer: show the same screen again with a fresh preview
    const preview = await house.previewInquiry(unit, ctx.inquirer);
    if (!preview.ok) return afterFailure(phone, ctx, preview.reason, lang);
    return uiButtons(hmsg('CONFIRM', lang, { name: plain(preview.managerName, 60), sms: plain(preview.sms, 400) }), [
      btn('1', hlabel('SEND_NOW', lang)),
      btn('0', ulabel('BACK', lang)),
      mainButton(lang),
    ]);
  }

  const result = await house.sendInquiry(unit, ctx.inquirer);
  if (!result.ok) return afterFailure(phone, ctx, result.reason, lang);

  logger.info('House to Rent: inquiry sent');
  // Back on the unit (same state), so Contact Manager and Back keep working; no second inquiry is offered.
  await save(phone, STATE.HTR_UNIT, { area: ctx.area, units: ctx.units, page: ctx.page, sel: ctx.sel });
  return uiButtons(hmsg('SENT', lang, { name: plain(result.managerName, 60), phone: house.toLocalPhone(ctx.inquirer) }), [
    btn('2', hlabel('CONTACT_MANAGER', lang)),
    btn('0', ulabel('BACK', lang)),
    mainButton(lang),
  ]);
}

/** Explain why the inquiry did not go, then put the tenant back where they can do something else. */
async function afterFailure(phone: string, ctx: HtrCtx, reason: house.InquiryFailure, lang: Lang): Promise<Reply> {
  const notice = hmsg(FAILURE_COPY[reason], lang, { max: house.MAX_INQUIRIES_PER_DAY });
  if (reason === 'gone') {
    const rest = (ctx.units ?? []).filter((_, i) => i !== ctx.sel);
    return showResults(phone, { area: ctx.area, units: rest, page: 0 }, lang, notice);
  }
  return showUnit(phone, ctx, lang, notice);
}
