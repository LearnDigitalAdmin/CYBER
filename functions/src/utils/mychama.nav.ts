/**
 * MyChama Navigation & Session Helpers
 *
 * Every MyChama state gets identical navigation semantics, so it is
 * implemented once here rather than copy-pasted into twenty handlers:
 *
 *   0    → back one step (true back-stack, not a hardcoded parent)
 *   00   → back to the My Chama menu
 *   000  → exit to language selection (full sign-out of MyChama)
 *   #    → back to the SAMUHIA main menu
 *
 * Text aliases (back / nyuma / menu / exit / toka) are honoured too, because
 * plenty of users type rather than tap.
 */

import { Session } from '../types/session.types';
import { updateSessionContext, updateSessionState } from '../services/session.service';
import { MyChamaSessionContext } from '../types/mychama.types';
import { STATE } from '../constants/states';
import { logger } from '../utils/logger';

export type McNavType = 'back' | 'mychama' | 'exit' | 'mainmenu' | null;

/** Read the MyChama slice of the session context. */
export function getMc(session: Session): MyChamaSessionContext {
  const raw = session.context?.mc;
  return (raw && typeof raw === 'object' ? raw : {}) as MyChamaSessionContext;
}

/**
 * Merge-write the MyChama slice. The parent context is a shallow merge, so we
 * always hand back the *whole* mc object with the patch folded in.
 */
export async function setMc(
  phone: string,
  session: Session,
  patch: Partial<MyChamaSessionContext>
): Promise<MyChamaSessionContext> {
  const next = { ...getMc(session), ...patch };
  await updateSessionContext(phone, { mc: next });
  // Keep the in-memory session aligned so later reads in the same turn are correct.
  session.context = { ...(session.context || {}), mc: next };
  return next;
}

/** Wipe every MyChama value from the session — used on exit and on sign-out. */
export async function clearMc(phone: string, session: Session): Promise<void> {
  await updateSessionContext(phone, { mc: {} });
  session.context = { ...(session.context || {}), mc: {} };
}

/**
 * Move to a new state, pushing the state we are leaving onto the back-stack.
 * The stack is capped so a user bouncing around a menu for an hour cannot
 * grow the session document without bound.
 */
export async function pushState(
  phone: string,
  session: Session,
  nextState: STATE,
  patch: Partial<MyChamaSessionContext> = {}
): Promise<void> {
  const mc = getMc(session);
  const stack = Array.isArray(mc.stack) ? mc.stack.slice() : [];

  if (session.currentState && session.currentState !== String(nextState)) {
    stack.push(session.currentState);
  }

  await setMc(phone, session, { ...patch, stack: stack.slice(-12) });
  await updateSessionState(phone, nextState, {});
  session.currentState = String(nextState);
}

/**
 * Replace the current state without growing the stack — for re-prompts and
 * for lateral moves inside the same logical step.
 */
export async function replaceState(
  phone: string,
  session: Session,
  nextState: STATE,
  patch: Partial<MyChamaSessionContext> = {}
): Promise<void> {
  if (Object.keys(patch).length > 0) {
    await setMc(phone, session, patch);
  }
  await updateSessionState(phone, nextState, {});
  session.currentState = String(nextState);
}

/** Pop the back-stack and return the state we landed on, or null if empty. */
export async function popState(phone: string, session: Session): Promise<string | null> {
  const mc = getMc(session);
  const stack = Array.isArray(mc.stack) ? mc.stack.slice() : [];
  const previous = stack.pop();

  await setMc(phone, session, { stack });

  if (!previous) {
    return null;
  }

  await updateSessionState(phone, previous, {});
  session.currentState = previous;
  return previous;
}

/** Classify an incoming message as a navigation command, if it is one. */
export function checkMcNavigation(input: string): McNavType {
  const cleaned = input.trim().toLowerCase();

  if (cleaned === '000' || cleaned === 'exit' || cleaned === 'toka' || cleaned === 'quit') {
    return 'exit';
  }
  if (cleaned === '#' || cleaned === 'main' || cleaned === 'main menu' || cleaned === 'menu kuu') {
    return 'mainmenu';
  }
  if (cleaned === '00' || cleaned === 'menu' || cleaned === 'chama') {
    return 'mychama';
  }
  if (cleaned === '0' || cleaned === 'back' || cleaned === 'nyuma') {
    return 'back';
  }

  return null;
}

/**
 * Store the option list that was just rendered, so the next numeric reply can
 * be mapped back to a document ID. This is what makes "reply 3" safe: the user
 * never types a document ID, and we never trust a raw index against a freshly
 * re-queried list that may have shifted.
 */
export async function setOptions(
  phone: string,
  session: Session,
  ids: string[]
): Promise<void> {
  await setMc(phone, session, { options: ids.slice(0, 30) });
}

/** Resolve a numeric reply against the stored option list. */
export function resolveOption(session: Session, input: string): string | null {
  const mc = getMc(session);
  const options = Array.isArray(mc.options) ? mc.options : [];
  const cleaned = input.trim();

  if (!/^\d{1,2}$/.test(cleaned)) {
    return null;
  }

  const index = parseInt(cleaned, 10) - 1;
  if (index < 0 || index >= options.length) {
    return null;
  }

  logger.debug('Resolved MyChama option', { input: cleaned, id: options[index] });
  return options[index];
}

/** Parse a plain numeric menu choice within a range. */
export function parseChoice(input: string, min: number, max: number): number | null {
  const cleaned = input.trim();
  if (!/^\d{1,2}$/.test(cleaned)) {
    return null;
  }
  const num = parseInt(cleaned, 10);
  return num >= min && num <= max ? num : null;
}

/** Numbered list renderer used by every picker in the flow. */
export function numberedList(lines: string[]): string {
  return lines.map((line, i) => `${i + 1}. ${line}`).join('\n');
}
