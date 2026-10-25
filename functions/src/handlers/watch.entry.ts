/**
 * Landlord Watch: production wiring (session service, WhatsApp Cloud API, real clock).
 * The conversation logic itself is in watch.handler.ts.
 */
import { Session } from '../types/session.types';
import { Lang, Outbound, WatchCtx } from '../types/watch.types';
import { STATE } from '../constants/states';
import { getMenu } from '../constants/menus';
import { wmsg } from '../constants/watch.messages';
import { getSession, updateSessionLanguage, updateSessionState } from '../services/session.service';
import { formatPhoneForWhatsApp } from '../services/whatsapp.service';
import { getWhatsAppApiUrl, getWhatsAppHeaders } from '../config/whatsapp.config';
import { createWatchApi } from '../services/watch.api';
import { sendWatchOutbound } from '../services/watch.sender';
import { recordWhatsAppUsage } from '../utils/whatsapp.usage';
import { insideServiceWindow, toE164 } from '../utils/watch.format';
import { realSleep } from '../utils/watch.poll';
import { ACTION_PREFIX, Incoming, WatchDeps, WatchFlow, WatchStore } from './watch.handler';
import { logger } from '../utils/logger';

function readCtx(session: Session): WatchCtx {
  const raw = session.context?.lw;
  return (raw && typeof raw === 'object' ? raw : {}) as WatchCtx;
}

function buildDeps(phone: string, session: Session): WatchDeps {
  const store: WatchStore = {
    async read() {
      const s = await getSession(phone);
      return { state: s?.currentState ?? '', ctx: s ? readCtx(s) : {} };
    },
    async write(state, ctx) {
      await updateSessionState(phone, state, { lw: ctx });
    },
    async setLanguage(lang: Lang) {
      await updateSessionLanguage(phone, lang);
    },
    async leave() {
      await updateSessionState(phone, STATE.MAIN_MENU, { lw: {} });
    },
  };
  const to = formatPhoneForWhatsApp(phone);
  return {
    api: createWatchApi(toE164(phone)),
    send: (o: Outbound) =>
      sendWatchOutbound(to, o, {
        url: getWhatsAppApiUrl,
        headers: getWhatsAppHeaders,
        meter: (ok) => recordWhatsAppUsage({ kind: 'outbound', ok }),
      }),
    store,
    now: () => Date.now(),
    sleep: realSleep,
    actorPhone: toE164(phone),
    mainMenuText: (lang) => getMenu('MAIN_MENU', lang),
  };
}

/** Main menu entry ("Landlord Watch" or a keyword). Sends its own replies; returns '' so the webhook sends nothing more. */
export async function beginWatch(phone: string, session: Session): Promise<string> {
  const flow = new WatchFlow(buildDeps(phone, session), { lang: session.language, state: session.currentState, ctx: {} });
  await flow.start();
  return '';
}

/** Any message received while the session is in a WATCH_* state. */
export async function handleWatchMessage(
  phone: string,
  inc: Incoming,
  session: Session,
  inboundTimestampSec?: number | string
): Promise<void> {
  if (!insideServiceWindow(inboundTimestampSec, Date.now())) {
    logger.warn('Watch: inbound message outside the 24 h window, not replying');
    return;
  }
  const flow = new WatchFlow(buildDeps(phone, session), {
    lang: session.language,
    state: session.currentState,
    ctx: readCtx(session),
  });
  await flow.handle(inc);
}

/** A Landlord Watch button tapped after the user already left the module. */
export async function handleStaleWatchTap(phone: string, session: Session): Promise<void> {
  const deps = buildDeps(phone, session);
  await deps.send({ kind: 'text', text: wmsg('STALE_BUTTON', session.language) });
  await deps.send({ kind: 'text', text: getMenu('MAIN_MENU', session.language) });
}

export const isWatchButtonId = (id: string | undefined): boolean => !!id && id.startsWith(ACTION_PREFIX);
