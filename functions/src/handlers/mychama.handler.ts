/**
 * MyChama Handlers
 *
 * The complete WhatsApp state machine for the My Chama option:
 *   auth → chama picker → menu → { contributions | loans | MGR | statements }
 *
 * Shared behaviour lives in helpers at the top of the file rather than being
 * repeated per state:
 *   - guard()          navigation, lockout and idle re-auth, in that order
 *   - startPayment()   the one payment sub-flow used by all three payable flows
 *   - failSoft()       never strands a member in a dead state on an error
 */

import { Session } from '../types/session.types';
import { STATE } from '../constants/states';
import { getMenu } from '../constants/menus';
import { mcMsg, mcMenu, Lang } from '../constants/mychama.messages';
import { updateSessionState } from '../services/session.service';
import { logger } from '../utils/logger';
import {
  getMc,
  setMc,
  clearMc,
  pushState,
  replaceState,
  popState,
  checkMcNavigation,
  setOptions,
  resolveOption,
  parseChoice,
  numberedList,
} from '../utils/mychama.nav';
import { MC_SECURITY } from '../config/mychama.config';
import {
  findMembershipsByPhone,
  getChama,
  getMember,
  verifyIdLast4,
  getOutstandingContributions,
  getContribution,
  getContributionHistory,
  contributionDue,
  getLoanProducts,
  getMemberLoans,
  getLoan,
  loanOutstanding,
  loanPaid,
  nextUnpaidInstallment,
  createLoanApplication,
  buildSchedule,
  getMemberPots,
  getPot,
  getPotRecordsForMember,
  potPoolEstimate,
  queuePosition,
  getMemberTransactions,
  feesFor,
  canCollectOnline,
  productRateLabel,
  normalizePhone,
  localPhone,
  detectProvider,
  kes,
  fmtDate,
  auditWhatsApp,
  getOpenArrearForMember,
  getArrear,
  getAuthLock,
  recordAuthFailure,
  clearAuthFailures,
  isClaimBlocked,
  recordClaimFailure,
} from '../services/mychama.service';
import {
  initiateMyChamaPayment,
  withinIntentRateLimit,
  getPendingIntents,
  IntentTarget,
} from '../services/mychama.payment.service';
import {
  buildContributionSection,
  buildLoanSection,
  buildMgrSection,
  buildTransactionSection,
  assembleStatement,
  periodStartISO,
  periodStartKey,
  StatementPeriod,
  StatementType,
} from '../services/mychama.statement.service';
import {
  Chama,
  ChamaMember,
  LoanProduct,
  IntentPurpose,
  MgrPot,
  MgrRecord,
  MgrArrear,
} from '../types/mychama.types';

const MIN_PAYMENT = 10;

/* ================================================================== *
 * Shared helpers
 * ================================================================== */

function nav(lang: Lang): string {
  return mcMsg('NAV_HINT', lang);
}

function now(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Where a member stands on the CURRENT period of a pot. Mirrors the app's
 * recordCashMgrPayment: only a 'partial' record's amount counts as already
 * paid toward the period, 'paid' means done, anything else means nothing yet.
 */
function mgrProgress(
  pot: MgrPot,
  records: MgrRecord[]
): { mine: MgrRecord | undefined; paid: number; remaining: number; done: boolean } {
  const mine = records.find((r) => r.period === pot.period);
  const paid = mine && (mine.status === 'paid' || mine.status === 'partial') ? mine.amount || 0 : 0;
  const remaining = Math.max(0, Math.round((pot.amount - paid) * 100) / 100);
  return { mine, paid, remaining, done: mine?.status === 'paid' || remaining <= 0.009 };
}

/**
 * One-line note about payments still waiting on the member's PIN or on
 * Paystack, so a payment that has been charged but not yet applied is visible
 * instead of looking like it vanished. Never throws — this is decoration.
 */
async function pendingNote(
  ctx: { chama: Chama; member: ChamaMember },
  lang: Lang,
  purposes: IntentPurpose[]
): Promise<string> {
  try {
    const pending = (await getPendingIntents(ctx.chama.id, ctx.member.memberId, 5)).filter((i) =>
      purposes.includes(i.purpose)
    );
    if (pending.length === 0) return '';
    const list = pending.map((i) => `${kes(i.amount)} (${i.reference.slice(-6)})`).join(', ');
    return mcMsg('PENDING_PAYMENTS', lang, { list });
  } catch (error) {
    logger.warn('MyChama pending-intent lookup failed', error);
    return '';
  }
}

/**
 * Re-check, at the moment money is about to be requested, that the thing being
 * paid still exists, still belongs to this member and still owes at least
 * this much. The session can be minutes old and the treasurer may have
 * recorded a cash payment in the meantime; charging against stale numbers is
 * how a payment ends up over the balance.
 */
async function paymentTargetStillValid(
  ctx: { chama: Chama; member: ChamaMember },
  mc: ReturnType<typeof getMc>
): Promise<boolean> {
  const net = mc.payNet || 0;
  const memberId = ctx.member.memberId;

  switch (mc.payPurpose) {
    case 'loan_repayment': {
      if (!mc.loanId) return false;
      const loan = await getLoan(ctx.chama.id, mc.loanId);
      return (
        !!loan &&
        loan.memberId === memberId &&
        (loan.status === 'active' || loan.status === 'overdue') &&
        net <= loanOutstanding(loan) + 0.01
      );
    }
    case 'contribution': {
      if (!mc.contributionId) return false;
      const c = await getContribution(ctx.chama.id, mc.contributionId);
      return !!c && c.memberId === memberId && net <= contributionDue(c) + 0.01;
    }
    case 'mgr_contribution': {
      if (!mc.potId) return false;
      const pot = await getPot(ctx.chama.id, mc.potId);
      if (!pot || !(pot.memberIds || []).includes(memberId)) return false;

      if (mc.arrearId) {
        const arrear = await getArrear(ctx.chama.id, mc.potId, mc.arrearId);
        return !!arrear && arrear.memberId === memberId && arrear.status === 'open' && net <= arrear.amount + 0.01;
      }

      if (typeof mc.potPeriod !== 'number' || pot.status !== 'active' || pot.period !== mc.potPeriod) return false;
      const records = await getPotRecordsForMember(ctx.chama.id, pot.id, memberId);
      return net <= mgrProgress(pot, records).remaining + 0.01;
    }
    default:
      return false;
  }
}

/** Error exit that always leaves the member somewhere they can act. */
async function failSoft(phone: string, session: Session, where: string, error: unknown): Promise<string> {
  logger.error(`MyChama error in ${where}`, error);
  await updateSessionState(phone, STATE.MYCHAMA_MENU, {});
  return mcMsg('UNAVAILABLE', session.language) + nav(session.language);
}

/** Minutes left on a durable lock, rounded up, never below 1. */
function lockMinutes(lockedUntilMs: number): number {
  return Math.max(1, Math.ceil((lockedUntilMs - Date.now()) / 60000));
}

/**
 * Sends a locked-out sender back to the main menu with the remaining time.
 * The lock itself lives in Firestore (see getAuthLock), so clearing the
 * session or re-entering My Chama cannot reset it.
 */
async function lockedResponse(
  phone: string,
  session: Session,
  lockedUntilMs: number
): Promise<string> {
  await clearMc(phone, session);
  await updateSessionState(phone, STATE.MAIN_MENU, {});
  return mcMsg('AUTH_LOCKED', session.language, { minutes: lockMinutes(lockedUntilMs) });
}

type GuardResult =
  | { done: true; response: string }
  | { done: false };

/**
 * Runs before every MyChama state handler.
 * Order matters: a locked-out number must not be able to navigate, and an
 * idle session must re-verify before any data is read or written.
 */
async function guard(
  phone: string,
  input: string,
  session: Session,
  options: { skipReauth?: boolean } = {}
): Promise<GuardResult> {
  const lang = session.language;
  const mc = getMc(session);

  // 1. Lockout
  if (mc.lockedUntil && mc.lockedUntil > now()) {
    const minutes = Math.ceil((mc.lockedUntil - now()) / 60);
    return { done: true, response: mcMsg('AUTH_LOCKED', lang, { minutes }) };
  }

  // 2. Navigation
  const command = checkMcNavigation(input);

  if (command === 'exit') {
    await clearMc(phone, session);
    await updateSessionState(phone, STATE.LANGUAGE_SELECTION, {});
    return { done: true, response: getMenu('WELCOME', lang) };
  }

  if (command === 'mainmenu') {
    await clearMc(phone, session);
    await updateSessionState(phone, STATE.MAIN_MENU, {});
    return { done: true, response: getMenu('MAIN_MENU', lang) };
  }

  // While the identity prompt is on screen — whether this is first entry or a
  // stale-session re-check — 'back' and 'mychama' must not be able to jump
  // straight into a resumed or cached state. That would let anyone holding an
  // unlocked phone skip the ID check entirely. Only a full cancel (mainmenu /
  // exit, handled above) is allowed until the ID is verified.
  if (
    (session.currentState === STATE.MYCHAMA_AUTH_ID ||
      session.currentState === STATE.MYCHAMA_AUTH_PHONE) &&
    (command === 'back' || command === 'mychama')
  ) {
    await clearMc(phone, session);
    await updateSessionState(phone, STATE.MAIN_MENU, {});
    return { done: true, response: getMenu('MAIN_MENU', lang) };
  }

  if (command === 'mychama') {
    if (!mc.chamaId || !mc.memberId) {
      return { done: true, response: await beginMyChama(phone, session) };
    }
    await replaceState(phone, session, STATE.MYCHAMA_MENU, { stack: [], options: [] });
    return { done: true, response: myChamaMenu(session) };
  }

  if (command === 'back') {
    const previous = await popState(phone, session);
    if (!previous) {
      await clearMc(phone, session);
      await updateSessionState(phone, STATE.MAIN_MENU, {});
      return { done: true, response: getMenu('MAIN_MENU', lang) };
    }
    return { done: true, response: await renderState(phone, session, previous) };
  }

  // 3. Idle re-authentication
  if (!options.skipReauth) {
    const stale = !mc.authAt || now() - mc.authAt > MC_SECURITY.REAUTH_AFTER_SECONDS;
    if (stale && mc.memberId) {
      await pushState(phone, session, STATE.MYCHAMA_AUTH_ID, { authAttempts: 0 });
      return { done: true, response: mcMsg('AUTH_REAUTH', lang) };
    }
    if (stale && !mc.memberId) {
      return { done: true, response: await beginMyChama(phone, session) };
    }
  }

  return { done: false };
}

/**
 * Re-render whichever state the back-stack landed on.
 * Every state that displays a list must be re-derivable from the session, so
 * "back" shows live data rather than a stale snapshot.
 */
async function renderState(phone: string, session: Session, state: string): Promise<string> {
  switch (state) {
    case STATE.MYCHAMA_MENU:
      return myChamaMenu(session);
    case STATE.MYCHAMA_SELECT_CHAMA:
      return await renderChamaPicker(phone, session);
    case STATE.MYCHAMA_CONTRIB_SELECT:
      return await renderContributionPicker(phone, session);
    case STATE.MYCHAMA_LOAN_PRODUCT:
      return await renderLoanProducts(phone, session);
    case STATE.MYCHAMA_LOAN_AMOUNT:
      return await renderLoanAmountPrompt(session);
    case STATE.MYCHAMA_LOAN_TERM:
      return await renderLoanTermPrompt(session);
    case STATE.MYCHAMA_LOAN_PURPOSE:
      return mcMsg('LOAN_ASK_PURPOSE', session.language) + nav(session.language);
    case STATE.MYCHAMA_LOAN_PAY_SELECT:
      return await renderLoanPayPicker(phone, session);
    case STATE.MYCHAMA_MGR_SELECT:
      return await renderPotPicker(phone, session);
    case STATE.MYCHAMA_MGR_DETAIL:
      return await renderPotDetail(phone, session);
    case STATE.MYCHAMA_MGR_PAY_AMOUNT:
      return await renderMgrPayAmount(phone, session);
    case STATE.MYCHAMA_STATEMENT_TYPE:
      return mcMenu('STATEMENT_TYPE', session.language) + nav(session.language);
    case STATE.MYCHAMA_STATEMENT_PERIOD:
      return mcMenu('STATEMENT_PERIOD', session.language) + nav(session.language);
    case STATE.MYCHAMA_PAY_PHONE:
      return renderPayPhonePrompt(session);
    case STATE.MYCHAMA_PAY_PROVIDER:
      return renderPayProviderPrompt(session);
    case STATE.MYCHAMA_PAY_CONFIRM:
      return await renderPayConfirm(phone, session);
    default:
      await updateSessionState(phone, STATE.MYCHAMA_MENU, {});
      return myChamaMenu(session);
  }
}

function myChamaMenu(session: Session): string {
  const mc = getMc(session);
  return mcMenu('MYCHAMA_MENU', session.language, {
    chamaName: mc.chamaName || '',
    memberName: mc.memberName || '',
  });
}

/** Load chama + member fresh on every action that needs them. */
async function loadContext(
  session: Session
): Promise<{ chama: Chama; member: ChamaMember } | null> {
  const mc = getMc(session);
  if (!mc.chamaId || !mc.memberId) return null;

  const [chama, member] = await Promise.all([
    getChama(mc.chamaId),
    getMember(mc.chamaId, mc.memberId),
  ]);

  if (!chama || !member) return null;
  return { chama, member };
}

/* ================================================================== *
 * Entry & authentication
 *
 * Two factors, always:
 *   1. Something that FINDS the member — the WhatsApp number, or (when that
 *      number is not on file) the number registered in the chama, typed by
 *      the sender.
 *   2. Something that CONFIRMS them — the last 4 digits of the National ID,
 *      checked against every membership that number resolves to.
 *
 * Neither factor is enough alone, failures are throttled durably per sender
 * (see getAuthLock), and the bot is MEMBER-CENTRIC on purpose: an officer
 * who signs in here is treated exactly like any other member. Officer
 * powers live in the app, where roles are enforced server-side.
 * ================================================================== */

/** Candidate memberships → session, ready for the ID prompt. */
function candidatesFrom(
  memberships: Array<{ chamaId: string; chamaName: string; member: ChamaMember }>
): NonNullable<ReturnType<typeof getMc>['candidates']> {
  return memberships.map((m) => ({
    chamaId: m.chamaId,
    chamaName: m.chamaName,
    memberId: m.member.memberId,
  }));
}

/**
 * Called from the main menu. Resolves membership from the WhatsApp number;
 * if that number is unknown, asks for the number registered in the chama
 * before continuing to the ID check.
 */
export async function beginMyChama(phone: string, session: Session): Promise<string> {
  const lang = session.language;

  try {
    const lockedUntil = await getAuthLock(phone);
    if (lockedUntil) {
      return await lockedResponse(phone, session, lockedUntil);
    }

    const memberships = await findMembershipsByPhone(phone);

    if (memberships.length === 0) {
      // Not on file under this WhatsApp number → ask for the registered one.
      await auditWhatsApp({ phone, action: 'auth.lookup', outcome: 'denied' });
      await clearMc(phone, session);
      await setMc(phone, session, { phoneAttempts: 0, stack: [], options: [] });
      await updateSessionState(phone, STATE.MYCHAMA_AUTH_PHONE, {});
      session.currentState = STATE.MYCHAMA_AUTH_PHONE;
      return mcMsg('AUTH_ASK_PHONE', lang) + mcMsg('NAV_HINT_TOP', lang);
    }

    const active = memberships.filter((m) => m.member.status === 'active');

    if (active.length === 0) {
      const first = memberships[0];
      await updateSessionState(phone, STATE.MAIN_MENU, {});
      return (
        mcMsg('AUTH_INACTIVE', lang, {
          chamaName: first.chamaName,
          status: first.member.status,
        }) +
        '\n\n' +
        getMenu('MAIN_MENU', lang)
      );
    }

    const primary = active[0];

    await setMc(phone, session, {
      candidates: candidatesFrom(active),
      memberId: primary.member.memberId,
      memberName: primary.member.name,
      chamaId: primary.chamaId,
      chamaName: primary.chamaName,
      role: primary.member.role,
      memberPhone: primary.member.phoneNormalized || normalizePhone(phone),
      claimedPhone: '',
      phoneAttempts: 0,
      authAt: 0,
      authAttempts: 0,
      stack: [],
      options: [],
    });

    await updateSessionState(phone, STATE.MYCHAMA_AUTH_ID, {});
    session.currentState = STATE.MYCHAMA_AUTH_ID;

    return mcMsg('AUTH_ASK_ID', lang, { memberName: primary.member.name.split(' ')[0] });
  } catch (error) {
    logger.error('MyChama entry failed', error);
    await updateSessionState(phone, STATE.MAIN_MENU, {});
    return mcMsg('UNAVAILABLE', lang) + '\n\n' + getMenu('MAIN_MENU', lang);
  }
}

/**
 * Extra layer for senders whose WhatsApp number is not the one registered in
 * the chama. They type the registered number; if it resolves to an active
 * membership we proceed to the normal ID check — WITHOUT revealing the
 * member's name, because at this point the sender has proven nothing.
 *
 * Every failure looks identical (unknown number, inactive member, claim route
 * closed) so the prompt cannot be used to discover who belongs to a chama.
 */
export async function handleMyChamaAuthPhone(
  phone: string,
  input: string,
  session: Session
): Promise<string> {
  const lang = session.language;

  const g = await guard(phone, input, session, { skipReauth: true });
  if (g.done) return g.response;

  try {
    const lockedUntil = await getAuthLock(phone);
    if (lockedUntil) {
      return await lockedResponse(phone, session, lockedUntil);
    }

    const claimed = normalizePhone(input.trim());
    if (!/^\+254[17]\d{8}$/.test(claimed)) {
      return mcMsg('AUTH_PHONE_FORMAT', lang);
    }

    // The WhatsApp number itself already came back empty; retyping it can only fail.
    const memberships =
      claimed === normalizePhone(phone) ? [] : await findMembershipsByPhone(claimed);

    const usable: typeof memberships = [];
    for (const m of memberships) {
      if (m.member.status !== 'active') continue;
      if (await isClaimBlocked(m.chamaId, m.member.memberId)) continue;
      usable.push(m);
    }

    if (usable.length === 0) {
      const failure = await recordAuthFailure(phone);
      await auditWhatsApp({
        phone,
        action: 'auth.phone_claim',
        outcome: 'failure',
        detail: { attempts: failure.attempts },
      });

      if (failure.lockedUntil) {
        return await lockedResponse(phone, session, failure.lockedUntil);
      }
      return mcMsg('AUTH_PHONE_NOT_MATCHED', lang, { remaining: failure.remaining });
    }

    const primary = usable[0];

    await auditWhatsApp({
      phone,
      chamaId: primary.chamaId,
      memberId: primary.member.memberId,
      action: 'auth.phone_claim',
      outcome: 'success',
      detail: { claimedLast3: claimed.slice(-3) },
    });

    await setMc(phone, session, {
      candidates: candidatesFrom(usable),
      memberId: primary.member.memberId,
      memberName: primary.member.name,
      chamaId: primary.chamaId,
      chamaName: primary.chamaName,
      role: primary.member.role,
      memberPhone: primary.member.phoneNormalized || claimed,
      claimedPhone: claimed,
      phoneAttempts: 0,
      authAt: 0,
      authAttempts: 0,
      stack: [],
      options: [],
    });

    await updateSessionState(phone, STATE.MYCHAMA_AUTH_ID, {});
    session.currentState = STATE.MYCHAMA_AUTH_ID;

    return mcMsg('AUTH_ASK_ID_CLAIM', lang);
  } catch (error) {
    return await failSoft(phone, session, 'handleMyChamaAuthPhone', error);
  }
}

export async function handleMyChamaAuthId(
  phone: string,
  input: string,
  session: Session
): Promise<string> {
  const lang = session.language;

  const g = await guard(phone, input, session, { skipReauth: true });
  if (g.done) return g.response;

  try {
    const lockedUntil = await getAuthLock(phone);
    if (lockedUntil) {
      return await lockedResponse(phone, session, lockedUntil);
    }

    const mc = getMc(session);
    const cleaned = input.trim();

    if (!/^\d{4}$/.test(cleaned)) {
      return mcMsg('AUTH_ID_FORMAT', lang);
    }

    if (!mc.chamaId || !mc.memberId) {
      return await beginMyChama(phone, session);
    }

    // Verify the ID against EVERY membership this number resolved to and keep
    // only those that match. Verifying just the first one would let a correct
    // ID for chama A unlock chama B's (different) member record.
    const candidates = mc.candidates || [];
    const matched: typeof candidates = [];
    const matchedMembers = new Map<string, ChamaMember>();

    for (const c of candidates) {
      const m = await getMember(c.chamaId, c.memberId);
      if (m && m.status === 'active' && verifyIdLast4(m, cleaned)) {
        matched.push(c);
        matchedMembers.set(c.chamaId + '/' + c.memberId, m);
      }
    }

    // On a mid-session re-check the member we were already acting as must be
    // among the matches, otherwise someone else's ID would resume this session.
    const currentStillValid = matched.some(
      (c) => c.chamaId === mc.chamaId && c.memberId === mc.memberId
    );
    const isReauth = (mc.stack || []).length > 0;

    if (matched.length === 0 || (isReauth && !currentStillValid)) {
      const failure = await recordAuthFailure(phone);

      // Reached through a number that isn't the member's own: also count
      // against the member, so the claim route can close for them.
      if (mc.claimedPhone) {
        for (const c of candidates) {
          await recordClaimFailure(c.chamaId, c.memberId);
        }
      }

      await auditWhatsApp({
        phone,
        chamaId: mc.chamaId,
        memberId: mc.memberId,
        action: 'auth.verify',
        outcome: 'failure',
        detail: { attempts: failure.attempts, viaClaimedPhone: !!mc.claimedPhone },
      });

      if (failure.lockedUntil) {
        return await lockedResponse(phone, session, failure.lockedUntil);
      }

      await setMc(phone, session, { authAttempts: failure.attempts });
      return mcMsg('AUTH_ID_INVALID', lang, { remaining: failure.remaining });
    }

    await clearAuthFailures(phone);

    // First match becomes the working chama unless we're resuming one that matched.
    const working = currentStillValid
      ? { chamaId: mc.chamaId, memberId: mc.memberId }
      : { chamaId: matched[0].chamaId, memberId: matched[0].memberId };
    const workingMember = matchedMembers.get(working.chamaId + '/' + working.memberId)!;
    const workingCandidate = matched.find(
      (c) => c.chamaId === working.chamaId && c.memberId === working.memberId
    )!;

    await setMc(phone, session, {
      candidates: matched,
      chamaId: workingCandidate.chamaId,
      chamaName: workingCandidate.chamaName,
      memberId: workingCandidate.memberId,
      memberName: workingMember.name,
      role: workingMember.role,
      memberPhone: workingMember.phoneNormalized || mc.memberPhone,
      authAt: now(),
      authAttempts: 0,
      lockedUntil: 0,
    });

    await auditWhatsApp({
      phone,
      chamaId: workingCandidate.chamaId,
      memberId: workingCandidate.memberId,
      action: 'auth.verify',
      outcome: 'success',
      detail: { viaClaimedPhone: !!mc.claimedPhone },
    });

    // Re-auth mid-session: drop straight back where they were.
    const stack = getMc(session).stack || [];
    const resume = stack.length > 0 ? await popState(phone, session) : null;
    if (resume) {
      return await renderState(phone, session, resume);
    }

    if (matched.length > 1) {
      await replaceState(phone, session, STATE.MYCHAMA_SELECT_CHAMA, {});
      return await renderChamaPicker(phone, session);
    }

    await replaceState(phone, session, STATE.MYCHAMA_MENU, { stack: [] });
    return myChamaMenu(session);
  } catch (error) {
    return await failSoft(phone, session, 'handleMyChamaAuthId', error);
  }
}

async function renderChamaPicker(phone: string, session: Session): Promise<string> {
  const mc = getMc(session);
  const candidates = mc.candidates || [];

  await setOptions(phone, session, candidates.map((c) => c.chamaId));

  const list = numberedList(candidates.map((c) => c.chamaName));
  return mcMsg('SELECT_CHAMA', session.language, { list }) + mcMsg('NAV_HINT_TOP', session.language);
}

export async function handleMyChamaSelectChama(
  phone: string,
  input: string,
  session: Session
): Promise<string> {
  const g = await guard(phone, input, session);
  if (g.done) return g.response;

  try {
    const chamaId = resolveOption(session, input);
    if (!chamaId) {
      return mcMsg('PICK_NUMBER', session.language);
    }

    const mc = getMc(session);
    const chosen = (mc.candidates || []).find((c) => c.chamaId === chamaId);
    if (!chosen) {
      return mcMsg('PICK_NUMBER', session.language);
    }

    // Candidates were ID-verified at sign-in, so switching needs no new check.
    await replaceState(phone, session, STATE.MYCHAMA_MENU, {
      chamaId: chosen.chamaId,
      chamaName: chosen.chamaName,
      memberId: chosen.memberId,
      stack: [],
      options: [],
    });

    const member = await getMember(chosen.chamaId, chosen.memberId);
    if (member) {
      await setMc(phone, session, {
        memberName: member.name,
        role: member.role,
        memberPhone: member.phoneNormalized || getMc(session).memberPhone,
      });
    }

    return myChamaMenu(session);
  } catch (error) {
    return await failSoft(phone, session, 'handleMyChamaSelectChama', error);
  }
}

/* ================================================================== *
 * My Chama menu
 * ================================================================== */

export async function handleMyChamaMenu(
  phone: string,
  input: string,
  session: Session
): Promise<string> {
  const lang = session.language;

  const g = await guard(phone, input, session);
  if (g.done) return g.response;

  try {
    const choice = parseChoice(input, 1, 8);
    if (choice === null) {
      return mcMsg('PICK_NUMBER', lang) + '\n\n' + myChamaMenu(session);
    }

    switch (choice) {
      case 1:
        await pushState(phone, session, STATE.MYCHAMA_CONTRIB_SELECT);
        return await renderContributionPicker(phone, session);

      case 2:
        await pushState(phone, session, STATE.MYCHAMA_LOAN_PRODUCT);
        return await renderLoanProducts(phone, session);

      case 3:
        await pushState(phone, session, STATE.MYCHAMA_LOAN_PAY_SELECT);
        return await renderLoanPayPicker(phone, session);

      case 4:
        await pushState(phone, session, STATE.MYCHAMA_LOAN_BALANCE);
        return await renderLoanBalance(session);

      case 5:
        await pushState(phone, session, STATE.MYCHAMA_MGR_SELECT);
        return await renderPotPicker(phone, session);

      case 6:
        await pushState(phone, session, STATE.MYCHAMA_STATEMENT_TYPE);
        return mcMenu('STATEMENT_TYPE', lang) + nav(lang);

      case 7: {
        const mc = getMc(session);
        if ((mc.candidates || []).length < 2) {
          return mcMsg('PICK_NUMBER', lang) + '\n\n' + myChamaMenu(session);
        }
        await pushState(phone, session, STATE.MYCHAMA_SELECT_CHAMA);
        return await renderChamaPicker(phone, session);
      }

      case 8:
      default:
        await clearMc(phone, session);
        await updateSessionState(phone, STATE.MAIN_MENU, {});
        return getMenu('MAIN_MENU', lang);
    }
  } catch (error) {
    return await failSoft(phone, session, 'handleMyChamaMenu', error);
  }
}

/* ================================================================== *
 * Contributions
 * ================================================================== */

async function renderContributionPicker(phone: string, session: Session): Promise<string> {
  const lang = session.language;
  const ctx = await loadContext(session);
  if (!ctx) return await beginMyChama(phone, session);

  const outstanding = await getOutstandingContributions(ctx.chama.id, ctx.member.memberId);

  if (outstanding.length === 0) {
    const credit =
      (ctx.member.creditBalance || 0) > 0.5
        ? (lang === 'en' ? 'Credit on file: ' : 'Salio la ziada: ') + kes(ctx.member.creditBalance)
        : '';
    return (
      mcMsg('CONTRIB_NONE_DUE', lang, {
        total: kes(ctx.member.totalContributed || 0),
        credit,
      }) +
      (await pendingNote(ctx, lang, ['contribution'])) +
      nav(lang)
    );
  }

  await setOptions(phone, session, outstanding.map((c) => c.id));

  const list = numberedList(
    outstanding.map((c) => {
      const due = contributionDue(c);
      const partial =
        (c.paidAmount || 0) > 0 ? ` (${kes(c.paidAmount)} ${lang === 'en' ? 'paid' : 'imelipwa'})` : '';
      return `${c.period} — ${kes(due)}${partial}`;
    })
  );

  return (
    mcMsg('CONTRIB_SELECT', lang, { list }) +
    (await pendingNote(ctx, lang, ['contribution'])) +
    nav(lang)
  );
}

export async function handleContributionSelect(
  phone: string,
  input: string,
  session: Session
): Promise<string> {
  const lang = session.language;

  const g = await guard(phone, input, session);
  if (g.done) return g.response;

  try {
    const contributionId = resolveOption(session, input);
    if (!contributionId) {
      return mcMsg('PICK_NUMBER', lang);
    }

    const ctx = await loadContext(session);
    if (!ctx) return await beginMyChama(phone, session);

    if (!canCollectOnline(ctx.chama.plan)) {
      return mcMsg('PAY_NOT_ON_PLAN', lang) + nav(lang);
    }

    const contribution = await getContribution(ctx.chama.id, contributionId);
    if (!contribution || contribution.memberId !== ctx.member.memberId) {
      return mcMsg('PICK_NUMBER', lang);
    }

    const due = contributionDue(contribution);

    await pushState(phone, session, STATE.MYCHAMA_CONTRIB_AMOUNT, {
      contributionId,
      amount: due,
    });

    return (
      mcMsg('CONTRIB_AMOUNT', lang, { period: contribution.period, due: kes(due) }) + nav(lang)
    );
  } catch (error) {
    return await failSoft(phone, session, 'handleContributionSelect', error);
  }
}

export async function handleContributionAmount(
  phone: string,
  input: string,
  session: Session
): Promise<string> {
  const lang = session.language;

  const g = await guard(phone, input, session);
  if (g.done) return g.response;

  try {
    const mc = getMc(session);
    const ctx = await loadContext(session);
    if (!ctx || !mc.contributionId) return await beginMyChama(phone, session);

    const contribution = await getContribution(ctx.chama.id, mc.contributionId);
    if (!contribution || contribution.memberId !== ctx.member.memberId) {
      return await beginMyChama(phone, session);
    }

    const due = contributionDue(contribution);
    const cleaned = input.trim().toUpperCase();

    let amount: number;
    if (cleaned === 'FULL' || cleaned === 'ZOTE' || cleaned === 'YOTE') {
      amount = due;
    } else {
      const parsed = Number(input.trim());
      if (!Number.isFinite(parsed) || parsed < MIN_PAYMENT) {
        return mcMsg('ENTER_VALID_AMOUNT', lang) + nav(lang);
      }
      amount = Math.round(parsed);
    }

    if (amount > due + 0.01) {
      return (
        mcMsg('CONTRIB_AMOUNT_TOO_HIGH', lang, {
          period: contribution.period,
          due: kes(due),
        }) + nav(lang)
      );
    }

    const label =
      lang === 'en'
        ? `Contribution · ${contribution.period}`
        : `Mchango · ${contribution.period}`;

    return await startPayment(phone, session, {
      purpose: 'contribution',
      net: amount,
      label,
      contributionId: contribution.id,
    });
  } catch (error) {
    return await failSoft(phone, session, 'handleContributionAmount', error);
  }
}

/* ================================================================== *
 * Loan application
 * ================================================================== */

async function renderLoanProducts(phone: string, session: Session): Promise<string> {
  const lang = session.language;
  const ctx = await loadContext(session);
  if (!ctx) return await beginMyChama(phone, session);

  const pending = await getMemberLoans(ctx.chama.id, ctx.member.memberId, [
    'pending_approval',
    'awaiting_treasurer',
  ]);

  if (pending.length > 0) {
    const l = pending[0];
    const summary = `${kes(l.principal)} · ${l.term}m · ${fmtDate(l.requestedOn)}`;
    return mcMsg('LOAN_PENDING_EXISTS', lang, { summary }) + nav(lang);
  }

  const products = await getLoanProducts(ctx.chama.id);
  if (products.length === 0) {
    return mcMsg('LOAN_NO_PRODUCTS', lang) + nav(lang);
  }

  await setOptions(phone, session, products.map((p) => p.id));

  const list = numberedList(
    products.map(
      (p) => `*${p.name}* — ${productRateLabel(p, lang)}\n   ${lang === 'en' ? 'Up to' : 'Hadi'} ${kes(p.maxAmount)} / ${p.maxTerm}m`
    )
  );

  return mcMsg('LOAN_PRODUCTS', lang, { list }) + nav(lang);
}

async function resolveProduct(session: Session): Promise<LoanProduct | null> {
  const mc = getMc(session);
  if (!mc.chamaId || !mc.productId) return null;
  const products = await getLoanProducts(mc.chamaId);
  return products.find((p) => p.id === mc.productId) || null;
}

async function renderLoanAmountPrompt(session: Session): Promise<string> {
  const lang = session.language;
  const product = await resolveProduct(session);
  if (!product) return mcMsg('UNAVAILABLE', lang);

  return (
    mcMsg('LOAN_ASK_AMOUNT', lang, {
      productName: product.name,
      rateLabel: productRateLabel(product, lang),
      maxAmount: kes(product.maxAmount),
      maxTerm: product.maxTerm,
    }) + nav(lang)
  );
}

export async function handleLoanProduct(
  phone: string,
  input: string,
  session: Session
): Promise<string> {
  const lang = session.language;

  const g = await guard(phone, input, session);
  if (g.done) return g.response;

  try {
    const productId = resolveOption(session, input);
    if (!productId) {
      return mcMsg('PICK_NUMBER', lang);
    }

    await pushState(phone, session, STATE.MYCHAMA_LOAN_AMOUNT, { productId });
    return await renderLoanAmountPrompt(session);
  } catch (error) {
    return await failSoft(phone, session, 'handleLoanProduct', error);
  }
}

export async function handleLoanAmount(
  phone: string,
  input: string,
  session: Session
): Promise<string> {
  const lang = session.language;

  const g = await guard(phone, input, session);
  if (g.done) return g.response;

  try {
    const product = await resolveProduct(session);
    if (!product) return await beginMyChama(phone, session);

    const parsed = Number(input.trim());
    if (!Number.isFinite(parsed) || parsed < 500 || parsed > product.maxAmount) {
      return (
        mcMsg('LOAN_AMOUNT_RANGE', lang, {
          min: kes(500),
          maxAmount: kes(product.maxAmount),
        }) + nav(lang)
      );
    }

    const amount = Math.round(parsed);
    await pushState(phone, session, STATE.MYCHAMA_LOAN_TERM, { amount });
    return await renderLoanTermPrompt(session);
  } catch (error) {
    return await failSoft(phone, session, 'handleLoanAmount', error);
  }
}

async function renderLoanTermPrompt(session: Session): Promise<string> {
  const lang = session.language;
  const mc = getMc(session);
  const product = await resolveProduct(session);
  if (!product) return mcMsg('UNAVAILABLE', lang);

  return (
    mcMsg('LOAN_ASK_TERM', lang, {
      amount: kes(mc.amount || 0),
      maxTerm: product.maxTerm,
    }) + nav(lang)
  );
}

export async function handleLoanTerm(
  phone: string,
  input: string,
  session: Session
): Promise<string> {
  const lang = session.language;

  const g = await guard(phone, input, session);
  if (g.done) return g.response;

  try {
    const product = await resolveProduct(session);
    if (!product) return await beginMyChama(phone, session);

    const parsed = parseInt(input.trim(), 10);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > product.maxTerm) {
      return mcMsg('LOAN_TERM_RANGE', lang, { maxTerm: product.maxTerm }) + nav(lang);
    }

    await pushState(phone, session, STATE.MYCHAMA_LOAN_PURPOSE, { term: parsed });
    return mcMsg('LOAN_ASK_PURPOSE', lang) + nav(lang);
  } catch (error) {
    return await failSoft(phone, session, 'handleLoanTerm', error);
  }
}

export async function handleLoanPurpose(
  phone: string,
  input: string,
  session: Session
): Promise<string> {
  const lang = session.language;

  const g = await guard(phone, input, session);
  if (g.done) return g.response;

  try {
    const cleaned = input.trim();
    const skipped = ['SKIP', 'RUKA'].includes(cleaned.toUpperCase());

    // Reject anything that looks like an injection attempt into stored text.
    const purpose = skipped ? '' : cleaned.replace(/[<>{}$`]/g, '').slice(0, 140);

    if (!skipped && purpose.length < 3) {
      return mcMsg('LOAN_ASK_PURPOSE', lang) + nav(lang);
    }

    await pushState(phone, session, STATE.MYCHAMA_LOAN_CONFIRM, { purpose });
    return await renderLoanConfirm(session);
  } catch (error) {
    return await failSoft(phone, session, 'handleLoanPurpose', error);
  }
}

async function renderLoanConfirm(session: Session): Promise<string> {
  const lang = session.language;
  const mc = getMc(session);
  const product = await resolveProduct(session);
  if (!product || !mc.amount || !mc.term) return mcMsg('UNAVAILABLE', lang);

  const calc = buildSchedule(product, mc.amount, mc.term);

  return mcMsg('LOAN_CONFIRM', lang, {
    productName: product.name,
    principal: kes(mc.amount),
    term: mc.term,
    rateLabel: productRateLabel(product, lang),
    totalInterest: kes(calc.totalInterest),
    totalPay: kes(calc.totalPay),
    installment: kes(calc.installment),
    purpose: mc.purpose || (lang === 'en' ? 'Not stated' : 'Haijaelezwa'),
  });
}

export async function handleLoanConfirm(
  phone: string,
  input: string,
  session: Session
): Promise<string> {
  const lang = session.language;

  const g = await guard(phone, input, session);
  if (g.done) return g.response;

  try {
    const cleaned = input.trim().toUpperCase();
    if (!['YES', 'Y', 'NDIYO', 'NDIO', 'OK', 'CONFIRM'].includes(cleaned)) {
      return await renderLoanConfirm(session);
    }

    const mc = getMc(session);
    const ctx = await loadContext(session);
    const product = await resolveProduct(session);

    if (!ctx || !product || !mc.amount || !mc.term) {
      return await beginMyChama(phone, session);
    }

    // Re-check for a race: another device may have filed an application while
    // this one was mid-flow.
    const pending = await getMemberLoans(ctx.chama.id, ctx.member.memberId, [
      'pending_approval',
      'awaiting_treasurer',
    ]);
    if (pending.length > 0) {
      const l = pending[0];
      await replaceState(phone, session, STATE.MYCHAMA_MENU, { stack: [] });
      return (
        mcMsg('LOAN_PENDING_EXISTS', lang, {
          summary: `${kes(l.principal)} · ${l.term}m · ${fmtDate(l.requestedOn)}`,
        }) +
        '\n\n' +
        myChamaMenu(session)
      );
    }

    const { loanId } = await createLoanApplication({
      chamaId: ctx.chama.id,
      memberId: ctx.member.memberId,
      product,
      principal: mc.amount,
      term: mc.term,
      purpose: mc.purpose || '',
    });

    await auditWhatsApp({
      phone,
      chamaId: ctx.chama.id,
      memberId: ctx.member.memberId,
      action: 'loan.apply',
      outcome: 'success',
      detail: { loanId, principal: mc.amount, term: mc.term },
    });

    await replaceState(phone, session, STATE.MYCHAMA_MENU, {
      stack: [],
      productId: undefined,
      amount: undefined,
      term: undefined,
      purpose: undefined,
    });

    return (
      mcMsg('LOAN_SUBMITTED', lang, {
        ref: loanId.slice(-8).toUpperCase(),
        principal: kes(mc.amount),
        term: mc.term,
      }) +
      '\n\n' +
      myChamaMenu(session)
    );
  } catch (error) {
    return await failSoft(phone, session, 'handleLoanConfirm', error);
  }
}

/* ================================================================== *
 * Loan repayment
 * ================================================================== */

async function renderLoanPayPicker(phone: string, session: Session): Promise<string> {
  const lang = session.language;
  const ctx = await loadContext(session);
  if (!ctx) return await beginMyChama(phone, session);

  const loans = await getMemberLoans(ctx.chama.id, ctx.member.memberId, ['active', 'overdue']);

  if (loans.length === 0) {
    return mcMsg('LOAN_NONE_REPAYABLE', lang) + nav(lang);
  }

  if (!canCollectOnline(ctx.chama.plan)) {
    return mcMsg('PAY_NOT_ON_PLAN', lang) + nav(lang);
  }

  await setOptions(phone, session, loans.map((l) => l.id));

  const list = numberedList(
    loans.map((l) => {
      const next = nextUnpaidInstallment(l);
      const flag = l.status === 'overdue' ? ' ⚠️' : '';
      const nextPart = next
        ? `\n   ${lang === 'en' ? 'Next' : 'Inayofuata'}: ${kes(next.due - (next.paidAmount || 0))} · ${fmtDate(next.dueDate)}`
        : '';
      return `${l.productId}${flag} — ${lang === 'en' ? 'balance' : 'salio'} ${kes(loanOutstanding(l))}${nextPart}`;
    })
  );

  return mcMsg('LOAN_PAY_SELECT', lang, { list }) + nav(lang);
}

export async function handleLoanPaySelect(
  phone: string,
  input: string,
  session: Session
): Promise<string> {
  const lang = session.language;

  const g = await guard(phone, input, session);
  if (g.done) return g.response;

  try {
    const loanId = resolveOption(session, input);
    if (!loanId) return mcMsg('PICK_NUMBER', lang);

    const ctx = await loadContext(session);
    if (!ctx) return await beginMyChama(phone, session);

    const loan = await getLoan(ctx.chama.id, loanId);
    if (
      !loan ||
      loan.memberId !== ctx.member.memberId ||
      (loan.status !== 'active' && loan.status !== 'overdue')
    ) {
      return mcMsg('PICK_NUMBER', lang);
    }

    const next = nextUnpaidInstallment(loan);
    if (!next) {
      return mcMsg('LOAN_NONE_REPAYABLE', lang) + nav(lang);
    }

    const products = await getLoanProducts(ctx.chama.id);
    const product = products.find((p) => p.id === loan.productId);

    await pushState(phone, session, STATE.MYCHAMA_LOAN_PAY_AMOUNT, {
      loanId,
      installmentNo: next.n,
    });

    return (
      mcMsg('LOAN_PAY_AMOUNT', lang, {
        productName: product?.name || loan.productId,
        n: next.n,
        total: loan.schedule.length,
        dueDate: fmtDate(next.dueDate),
        due: kes(next.due - (next.paidAmount || 0)),
        loanBalance: kes(loanOutstanding(loan)),
      }) + nav(lang)
    );
  } catch (error) {
    return await failSoft(phone, session, 'handleLoanPaySelect', error);
  }
}

export async function handleLoanPayAmount(
  phone: string,
  input: string,
  session: Session
): Promise<string> {
  const lang = session.language;

  const g = await guard(phone, input, session);
  if (g.done) return g.response;

  try {
    const mc = getMc(session);
    const ctx = await loadContext(session);
    if (!ctx || !mc.loanId) return await beginMyChama(phone, session);

    const loan = await getLoan(ctx.chama.id, mc.loanId);
    if (!loan || loan.memberId !== ctx.member.memberId) return await beginMyChama(phone, session);
    if (loan.status !== 'active' && loan.status !== 'overdue') {
      return mcMsg('LOAN_NONE_REPAYABLE', lang) + nav(lang);
    }

    const next = nextUnpaidInstallment(loan);
    if (!next) return mcMsg('LOAN_NONE_REPAYABLE', lang) + nav(lang);

    const instalmentDue = next.due - (next.paidAmount || 0);
    const balance = loanOutstanding(loan);
    const cleaned = input.trim().toUpperCase();

    let amount: number;
    if (cleaned === 'FULL' || cleaned === 'ZOTE') {
      amount = instalmentDue;
    } else if (cleaned === 'CLEAR' || cleaned === 'MALIZA') {
      amount = balance;
    } else {
      const parsed = Number(input.trim());
      if (!Number.isFinite(parsed) || parsed < MIN_PAYMENT) {
        return mcMsg('ENTER_VALID_AMOUNT', lang) + nav(lang);
      }
      amount = Math.round(parsed);
    }

    if (amount > balance + 0.01) {
      return mcMsg('LOAN_PAY_TOO_HIGH', lang, { loanBalance: kes(balance) }) + nav(lang);
    }

    const label =
      lang === 'en'
        ? `Loan repayment · instalment ${next.n}`
        : `Malipo ya mkopo · awamu ${next.n}`;

    return await startPayment(phone, session, {
      purpose: 'loan_repayment',
      net: amount,
      label,
      loanId: loan.id,
      installmentNo: next.n,
    });
  } catch (error) {
    return await failSoft(phone, session, 'handleLoanPayAmount', error);
  }
}

/* ================================================================== *
 * Loan balance
 * ================================================================== */

async function renderLoanBalance(session: Session): Promise<string> {
  const lang = session.language;
  const mc = getMc(session);
  const ctx = await loadContext(session);
  if (!ctx) return mcMsg('UNAVAILABLE', lang);

  const loans = await getMemberLoans(ctx.chama.id, ctx.member.memberId);

  if (loans.length === 0) {
    return mcMsg('LOAN_BALANCE_NONE', lang, { chamaName: mc.chamaName || '' }) + nav(lang);
  }

  const products = await getLoanProducts(ctx.chama.id);
  const nameOf = (id: string) => products.find((p) => p.id === id)?.name || id;

  const active = loans.filter((l) => l.status === 'active' || l.status === 'overdue');
  const totalOutstanding = active.reduce((s, l) => s + loanOutstanding(l), 0);

  const header =
    lang === 'en'
      ? `*Loan Balance* — ${ctx.chama.name}\n\nTotal outstanding: *${kes(totalOutstanding)}*\n`
      : `*Salio la Mkopo* — ${ctx.chama.name}\n\nJumla ya deni: *${kes(totalOutstanding)}*\n`;

  const blocks = loans.slice(0, 6).map((l) => {
    const next = nextUnpaidInstallment(l);
    const paidInstalments = l.schedule.filter((s) => s.paid).length;

    const lines = [
      `\n*${nameOf(l.productId)}*`,
      `${lang === 'en' ? 'Status' : 'Hali'}: ${l.status}${l.status === 'overdue' ? ' ⚠️' : ''}`,
      `${lang === 'en' ? 'Principal' : 'Msingi'}: ${kes(l.principal)} · ${l.term}m`,
      `${lang === 'en' ? 'Repaid' : 'Imelipwa'}: ${kes(loanPaid(l))} (${paidInstalments}/${l.schedule.length})`,
      `${lang === 'en' ? 'Balance' : 'Salio'}: *${kes(loanOutstanding(l))}*`,
    ];

    if (next) {
      lines.push(
        `${lang === 'en' ? 'Next instalment' : 'Awamu inayofuata'}: ${kes(
          next.due - (next.paidAmount || 0)
        )} · ${fmtDate(next.dueDate)}`
      );
    }

    return lines.join('\n');
  });

  return header + blocks.join('\n') + (await pendingNote(ctx, lang, ['loan_repayment'])) + nav(lang);
}

export async function handleLoanBalance(
  phone: string,
  input: string,
  session: Session
): Promise<string> {
  const g = await guard(phone, input, session);
  if (g.done) return g.response;

  // Terminal display state: any non-navigation input just re-renders.
  try {
    return await renderLoanBalance(session);
  } catch (error) {
    return await failSoft(phone, session, 'handleLoanBalance', error);
  }
}

/* ================================================================== *
 * Merry-go-round
 * ================================================================== */

async function renderPotPicker(phone: string, session: Session): Promise<string> {
  const lang = session.language;
  const mc = getMc(session);
  const ctx = await loadContext(session);
  if (!ctx) return await beginMyChama(phone, session);

  const pots = await getMemberPots(ctx.chama.id, ctx.member.memberId);

  if (pots.length === 0) {
    return mcMsg('MGR_NONE', lang, { chamaName: mc.chamaName || '' }) + nav(lang);
  }

  await setOptions(phone, session, pots.map((p) => p.id));

  const list = numberedList(
    pots.map(
      (p) =>
        `*${p.name}* — ${kes(p.amount)} ${p.frequency}` +
        (p.status === 'draft' ? ` (${lang === 'en' ? 'draft' : 'rasimu'})` : '')
    )
  );

  return mcMsg('MGR_SELECT', lang, { list }) + nav(lang);
}

export async function handleMgrSelect(
  phone: string,
  input: string,
  session: Session
): Promise<string> {
  const lang = session.language;

  const g = await guard(phone, input, session);
  if (g.done) return g.response;

  try {
    const potId = resolveOption(session, input);
    if (!potId) return mcMsg('PICK_NUMBER', lang);

    await pushState(phone, session, STATE.MYCHAMA_MGR_DETAIL, { potId });
    return await renderPotDetail(phone, session);
  } catch (error) {
    return await failSoft(phone, session, 'handleMgrSelect', error);
  }
}

async function renderPotDetail(phone: string, session: Session): Promise<string> {
  const lang = session.language;
  const mc = getMc(session);
  const ctx = await loadContext(session);
  if (!ctx || !mc.potId) return await beginMyChama(phone, session);

  const pot = await getPot(ctx.chama.id, mc.potId);
  if (!pot) return await renderPotPicker(phone, session);

  if (pot.status === 'draft' || !pot.drawDone) {
    return mcMsg('MGR_DRAFT', lang) + nav(lang);
  }

  // Members only ever see their OWN pots and records; a pot the member is not
  // in is treated as absent even if its id somehow ended up in the session.
  if (!(pot.memberIds || []).includes(ctx.member.memberId)) {
    return await renderPotPicker(phone, session);
  }

  const records = await getPotRecordsForMember(ctx.chama.id, pot.id, ctx.member.memberId);
  const progress = mgrProgress(pot, records);
  const paidCount = records.filter((r) => r.status === 'paid').length;
  const missedCount = records.filter((r) => r.status === 'missed').length;

  const nextIds = (pot.queue || []).slice(0, pot.recipientsPerRound || 1);
  const nextNames = await Promise.all(
    nextIds.map(async (id) => (await getMember(ctx.chama.id, id))?.name || id)
  );

  const myStatus = progress.done
    ? `✅ ${kes(progress.paid || pot.amount)} ${lang === 'en' ? 'paid' : 'imelipwa'}`
    : progress.paid > 0
    ? `⏳ ${kes(progress.paid)} ${lang === 'en' ? 'of' : 'kati ya'} ${kes(pot.amount)} ${
        lang === 'en' ? 'paid — part payment' : 'imelipwa — malipo ya sehemu'
      }`
    : progress.mine?.status === 'missed'
    ? `⚠️ ${lang === 'en' ? 'not paid' : 'haijalipwa'}`
    : `⏳ ${lang === 'en' ? 'not paid yet' : 'bado haijalipwa'}`;

  // Money is only accepted while the pot is collecting; the webhook applies
  // to an active pot only, so offering payment on a closed one would charge
  // the member for nothing. An open arrear, however, can be paid any time —
  // it is a standing debt to the chama, not tied to this period's window.
  const collecting = pot.status === 'active';
  const payable = collecting && !progress.done;
  const arrear = await getOpenArrearForMember(ctx.chama.id, pot.id, ctx.member.memberId);

  // Build the numbered action list to match what's actually offered — never
  // a fixed 1/2/3 that could point at the wrong thing once an arrear or a
  // closed period changes which actions apply.
  const optionIds: string[] = [];
  const lines: string[] = [];
  if (payable) {
    optionIds.push('pay_period');
    lines.push(
      lang === 'en'
        ? `Pay for this period — full or part (${kes(progress.remaining)} still due)`
        : `Lipa kwa kipindi hiki — kamili au sehemu (${kes(progress.remaining)} bado inadaiwa)`
    );
  }
  if (arrear) {
    optionIds.push('pay_arrear');
    lines.push(
      lang === 'en'
        ? `Pay arrears — full or part (${kes(arrear.amount)} owed)`
        : `Lipa malimbikizo — kamili au sehemu (${kes(arrear.amount)} yanadaiwa)`
    );
  }
  optionIds.push('history');
  lines.push(lang === 'en' ? 'View my payment history' : 'Angalia historia yangu ya malipo');

  await setOptions(phone, session, optionIds);
  await setMc(phone, session, { potPeriod: pot.period });

  const actionsBlock =
    numberedList(lines) + '\n\n' + (lang === 'en' ? '*0* Back  *00* My Chama menu' : '*0* Nyuma  *00* Menyu ya My Chama');

  const arrearLine = arrear
    ? mcMsg('MGR_ARREAR_LINE', lang, { amount: kes(arrear.amount) })
    : '';

  return (
    mcMsg('MGR_DETAIL', lang, {
      name: pot.name,
      amount: kes(pot.amount),
      frequency: pot.frequency,
      memberCount: pot.memberIds?.length || 0,
      cycle: pot.cycleNumber,
      period: pot.period,
      next: nextNames.join(' & ') || '—',
      position: queuePosition(pot, ctx.member.memberId) || '—',
      pool: kes(potPoolEstimate(pot)),
      myStatus,
      paidCount,
      missedCount,
      actions: arrearLine + actionsBlock,
    }) + (await pendingNote(ctx, lang, ['mgr_contribution']))
  );
}

export async function handleMgrDetail(
  phone: string,
  input: string,
  session: Session
): Promise<string> {
  const lang = session.language;

  const g = await guard(phone, input, session);
  if (g.done) return g.response;

  try {
    const mc = getMc(session);
    const ctx = await loadContext(session);
    if (!ctx || !mc.potId) return await beginMyChama(phone, session);

    const pot = await getPot(ctx.chama.id, mc.potId);
    if (!pot || !(pot.memberIds || []).includes(ctx.member.memberId)) {
      return await renderPotPicker(phone, session);
    }

    const action = resolveOption(session, input);
    if (!action) {
      return mcMsg('PICK_NUMBER', lang) + '\n\n' + (await renderPotDetail(phone, session));
    }

    if (action === 'history') {
      const records = await getPotRecordsForMember(ctx.chama.id, pot.id, ctx.member.memberId);
      await pushState(phone, session, STATE.MYCHAMA_MGR_HISTORY);
      const rows = records
        .slice(0, 15)
        .map(
          (r) =>
            `• ${lang === 'en' ? 'Period' : 'Kipindi'} ${r.period} — ${kes(r.amount)} (${r.status})${
              r.date ? ` · ${fmtDate(r.date)}` : ''
            }`
        );
      const head = `*${pot.name}* — ${lang === 'en' ? 'my payment history' : 'historia yangu ya malipo'}\n\n`;
      return head + (rows.join('\n') || (lang === 'en' ? 'No records yet.' : 'Hakuna kumbukumbu.')) + nav(lang);
    }

    if (!canCollectOnline(ctx.chama.plan)) {
      return mcMsg('PAY_NOT_ON_PLAN', lang) + nav(lang);
    }

    if (action === 'pay_arrear') {
      const arrear = await getOpenArrearForMember(ctx.chama.id, pot.id, ctx.member.memberId);
      if (!arrear) return mcMsg('PICK_NUMBER', lang) + '\n\n' + (await renderPotDetail(phone, session));

      await pushState(phone, session, STATE.MYCHAMA_MGR_PAY_AMOUNT, {
        potId: pot.id,
        potPeriod: undefined,
        arrearId: arrear.id,
      });
      return await renderMgrPayAmount(phone, session);
    }

    if (action === 'pay_period') {
      const records = await getPotRecordsForMember(ctx.chama.id, pot.id, ctx.member.memberId);
      const progress = mgrProgress(pot, records);
      if (pot.status !== 'active' || progress.done) {
        return mcMsg('PICK_NUMBER', lang) + '\n\n' + (await renderPotDetail(phone, session));
      }
      await pushState(phone, session, STATE.MYCHAMA_MGR_PAY_AMOUNT, {
        potId: pot.id,
        potPeriod: pot.period,
        arrearId: undefined,
      });
      return await renderMgrPayAmount(phone, session);
    }

    return mcMsg('PICK_NUMBER', lang) + '\n\n' + (await renderPotDetail(phone, session));
  } catch (error) {
    return await failSoft(phone, session, 'handleMgrDetail', error);
  }
}

/**
 * Resolves what the pending MGR amount step is actually for — the current
 * period, or (when the session carries an arrearId) an open arrear — and how
 * much is still owed on it. Centralised so render and handle can never
 * disagree about the target or the remaining amount.
 */
async function mgrAmountTarget(
  ctx: { chama: Chama; member: ChamaMember },
  mc: ReturnType<typeof getMc>
): Promise<
  | { kind: 'period'; pot: MgrPot; remaining: number; paid: number }
  | { kind: 'arrear'; pot: MgrPot; arrear: MgrArrear; remaining: number }
  | null
> {
  if (!mc.potId) return null;
  const pot = await getPot(ctx.chama.id, mc.potId);
  if (!pot || !(pot.memberIds || []).includes(ctx.member.memberId)) return null;

  if (mc.arrearId) {
    const arrear = await getArrear(ctx.chama.id, pot.id, mc.arrearId);
    if (!arrear || arrear.memberId !== ctx.member.memberId || arrear.status !== 'open') return null;
    return { kind: 'arrear', pot, arrear, remaining: arrear.amount };
  }

  if (pot.status !== 'active') return null;
  const records = await getPotRecordsForMember(ctx.chama.id, pot.id, ctx.member.memberId);
  const progress = mgrProgress(pot, records);
  if (progress.done) return null;
  return { kind: 'period', pot, remaining: progress.remaining, paid: progress.paid };
}

/** Amount prompt for a merry-go-round contribution or arrear — full or part. */
async function renderMgrPayAmount(phone: string, session: Session): Promise<string> {
  const lang = session.language;
  const mc = getMc(session);
  const ctx = await loadContext(session);
  if (!ctx) return await beginMyChama(phone, session);

  const target = await mgrAmountTarget(ctx, mc);
  if (!target) return await renderPotDetail(phone, session);

  if (target.kind === 'arrear') {
    return (
      mcMsg('MGR_ARREAR_PAY_AMOUNT', lang, {
        name: target.pot.name,
        remaining: kes(target.remaining),
      }) + nav(lang)
    );
  }

  return (
    mcMsg('MGR_PAY_AMOUNT', lang, {
      name: target.pot.name,
      period: target.pot.period,
      amount: kes(target.pot.amount),
      paid: kes(target.paid),
      remaining: kes(target.remaining),
    }) + nav(lang)
  );
}

export async function handleMgrPayAmount(
  phone: string,
  input: string,
  session: Session
): Promise<string> {
  const lang = session.language;

  const g = await guard(phone, input, session);
  if (g.done) return g.response;

  try {
    const mc = getMc(session);
    const ctx = await loadContext(session);
    if (!ctx) return await beginMyChama(phone, session);

    const target = await mgrAmountTarget(ctx, mc);
    if (!target) return await renderPotDetail(phone, session);

    const cleaned = input.trim().toUpperCase();
    let amount: number;
    if (cleaned === 'FULL' || cleaned === 'ZOTE' || cleaned === 'YOTE') {
      amount = target.remaining;
    } else {
      const parsed = Number(input.trim());
      if (!Number.isFinite(parsed) || parsed < MIN_PAYMENT) {
        return mcMsg('ENTER_VALID_AMOUNT', lang) + nav(lang);
      }
      amount = Math.round(parsed);
    }

    if (amount > target.remaining + 0.01) {
      return mcMsg('MGR_PAY_TOO_HIGH', lang, { remaining: kes(target.remaining) }) + nav(lang);
    }

    if (target.kind === 'arrear') {
      const label =
        lang === 'en' ? `${target.pot.name} · arrears` : `${target.pot.name} · malimbikizo`;
      return await startPayment(phone, session, {
        purpose: 'mgr_contribution',
        net: amount,
        label,
        potId: target.pot.id,
        arrearId: target.arrear.id,
      });
    }

    const label =
      lang === 'en'
        ? `${target.pot.name} · period ${target.pot.period}`
        : `${target.pot.name} · kipindi ${target.pot.period}`;

    return await startPayment(phone, session, {
      purpose: 'mgr_contribution',
      net: amount,
      label,
      potId: target.pot.id,
      potPeriod: target.pot.period,
    });
  } catch (error) {
    return await failSoft(phone, session, 'handleMgrPayAmount', error);
  }
}

export async function handleMgrHistory(
  phone: string,
  input: string,
  session: Session
): Promise<string> {
  const g = await guard(phone, input, session);
  if (g.done) return g.response;

  return mcMsg('PICK_NUMBER', session.language) + nav(session.language);
}

/* ================================================================== *
 * Statements
 * ================================================================== */

export async function handleStatementType(
  phone: string,
  input: string,
  session: Session
): Promise<string> {
  const lang = session.language;

  const g = await guard(phone, input, session);
  if (g.done) return g.response;

  try {
    const choice = parseChoice(input, 1, 4);
    if (choice === null) {
      return mcMsg('PICK_NUMBER', lang) + '\n\n' + mcMenu('STATEMENT_TYPE', lang);
    }

    const types: StatementType[] = ['contributions', 'loans', 'mgr', 'full'];
    await pushState(phone, session, STATE.MYCHAMA_STATEMENT_PERIOD, {
      statementType: types[choice - 1],
    });

    return mcMenu('STATEMENT_PERIOD', lang) + nav(lang);
  } catch (error) {
    return await failSoft(phone, session, 'handleStatementType', error);
  }
}

export async function handleStatementPeriod(
  phone: string,
  input: string,
  session: Session
): Promise<string> {
  const lang = session.language;

  const g = await guard(phone, input, session);
  if (g.done) return g.response;

  try {
    const choice = parseChoice(input, 1, 4);
    if (choice === null) {
      return mcMsg('PICK_NUMBER', lang) + '\n\n' + mcMenu('STATEMENT_PERIOD', lang);
    }

    const periods: StatementPeriod[] = ['month', 'quarter', 'year', 'all'];
    const period = periods[choice - 1];

    const ctx = await loadContext(session);
    if (!ctx) return await beginMyChama(phone, session);

    const mc = getMc(session);
    const type: StatementType = mc.statementType || 'full';

    const statement = await buildStatement(ctx.chama, ctx.member, type, period, lang);

    await auditWhatsApp({
      phone,
      chamaId: ctx.chama.id,
      memberId: ctx.member.memberId,
      action: 'statement.generate',
      outcome: 'success',
      detail: { type, period },
    });

    await replaceState(phone, session, STATE.MYCHAMA_STATEMENT_VIEW, {});

    return statement + nav(lang);
  } catch (error) {
    return await failSoft(phone, session, 'handleStatementPeriod', error);
  }
}

export async function handleStatementView(
  phone: string,
  input: string,
  session: Session
): Promise<string> {
  const g = await guard(phone, input, session);
  if (g.done) return g.response;

  await replaceState(phone, session, STATE.MYCHAMA_MENU, { stack: [] });
  return myChamaMenu(session);
}

async function buildStatement(
  chama: Chama,
  member: ChamaMember,
  type: StatementType,
  period: StatementPeriod,
  lang: Lang
): Promise<string> {
  const sinceISO = periodStartISO(period);
  const sinceKey = periodStartKey(period);
  const sections: string[] = [];

  if (type === 'contributions' || type === 'full') {
    const contributions = await getContributionHistory(chama.id, member.memberId, sinceKey);
    sections.push(buildContributionSection(contributions, member, lang));
  }

  if (type === 'loans' || type === 'full') {
    const loans = await getMemberLoans(chama.id, member.memberId);
    const scoped = sinceISO ? loans.filter((l) => l.requestedOn >= sinceISO || loanOutstanding(l) > 0) : loans;
    sections.push(buildLoanSection(scoped, lang));
  }

  if (type === 'mgr' || type === 'full') {
    const pots = await getMemberPots(chama.id, member.memberId);
    const entries = await Promise.all(
      pots.map(async (pot) => ({
        pot,
        records: await getPotRecordsForMember(chama.id, pot.id, member.memberId),
      }))
    );
    sections.push(buildMgrSection(entries, lang));
  }

  if (type === 'full') {
    const txns = await getMemberTransactions(chama.id, member.memberId, sinceISO);
    sections.push(buildTransactionSection(txns, lang));
  }

  return assembleStatement({ chama, member, period, sections, lang });
}

/* ================================================================== *
 * Shared payment sub-flow
 * ================================================================== */

/**
 * Entered from contributions, loan repayment and MGR alike. Stores what is
 * being paid, then walks phone → provider → confirm.
 */
async function startPayment(
  phone: string,
  session: Session,
  params: {
    purpose: IntentPurpose;
    net: number;
    label: string;
    contributionId?: string;
    loanId?: string;
    installmentNo?: number;
    potId?: string;
    potPeriod?: number;
    arrearId?: string;
  }
): Promise<string> {
  await pushState(phone, session, STATE.MYCHAMA_PAY_PHONE, {
    payPurpose: params.purpose,
    payNet: params.net,
    payLabel: params.label,
    contributionId: params.contributionId,
    loanId: params.loanId,
    installmentNo: params.installmentNo,
    potId: params.potId,
    potPeriod: params.potPeriod,
    arrearId: params.arrearId,
  });

  return renderPayPhonePrompt(session);
}

function renderPayPhonePrompt(session: Session): string {
  const lang = session.language;
  // Default to the number REGISTERED for the member. When they reached My
  // Chama from a different WhatsApp number (phone-claim path) those differ,
  // and the prompt must not silently charge the WhatsApp number instead.
  const mc = getMc(session);
  const registered = mc.memberPhone || normalizePhone(session.phone);
  return mcMsg('PAY_ASK_PHONE', lang, { registered: localPhone(registered) }) + nav(lang);
}

export async function handlePayPhone(
  phone: string,
  input: string,
  session: Session
): Promise<string> {
  //const lang = session.language;

  const g = await guard(phone, input, session);
  if (g.done) return g.response;

  try {
    const cleaned = input.trim();
    let target: string;

    if (cleaned === '1') {
      target = getMc(session).memberPhone || normalizePhone(session.phone);
    } else {
      const normalized = normalizePhone(cleaned);
      if (!/^\+254[17]\d{8}$/.test(normalized)) {
        return renderPayPhonePrompt(session);
      }
      target = normalized;
    }

    await pushState(phone, session, STATE.MYCHAMA_PAY_PROVIDER, {
      payPhone: target,
      provider: detectProvider(target),
    });

    return renderPayProviderPrompt(session);
  } catch (error) {
    return await failSoft(phone, session, 'handlePayPhone', error);
  }
}

function renderPayProviderPrompt(session: Session): string {
  const mc = getMc(session);
  return (
    mcMenu('PROVIDER', session.language, { phone: localPhone(mc.payPhone || '') }) +
    nav(session.language)
  );
}

export async function handlePayProvider(
  phone: string,
  input: string,
  session: Session
): Promise<string> {
  //const lang = session.language;

  const g = await guard(phone, input, session);
  if (g.done) return g.response;

  try {
    const choice = parseChoice(input, 1, 2);
    if (choice === null) {
      return renderPayProviderPrompt(session);
    }

    await pushState(phone, session, STATE.MYCHAMA_PAY_CONFIRM, {
      provider: choice === 1 ? 'mpesa' : 'airtel',
    });

    return await renderPayConfirm(phone, session);
  } catch (error) {
    return await failSoft(phone, session, 'handlePayProvider', error);
  }
}

async function renderPayConfirm(phone: string, session: Session): Promise<string> {
  const lang = session.language;
  const mc = getMc(session);
  const ctx = await loadContext(session);

  if (!ctx || !mc.payNet || !mc.payPurpose) {
    return await beginMyChama(phone, session);
  }

  const fees = feesFor(mc.payPurpose, mc.payNet, ctx.chama.plan);

  return mcMsg('PAY_CONFIRM', lang, {
    label: mc.payLabel || '',
    chamaName: ctx.chama.name,
    net: kes(fees.net),
    paystackFee: kes(fees.paystackFee),
    ourFee: kes(fees.ourFee),
    gross: kes(fees.gross),
    phone: localPhone(mc.payPhone || ''),
    provider: mc.provider === 'airtel' ? 'Airtel Money' : 'M-Pesa',
  });
}

export async function handlePayConfirm(
  phone: string,
  input: string,
  session: Session
): Promise<string> {
  const lang = session.language;

  const g = await guard(phone, input, session);
  if (g.done) return g.response;

  try {
    const cleaned = input.trim().toUpperCase();
    if (!['PAY', 'LIPA', 'YES', 'NDIYO', 'NDIO', 'OK'].includes(cleaned)) {
      return await renderPayConfirm(phone, session);
    }

    const mc = getMc(session);
    const ctx = await loadContext(session);

    if (!ctx || !mc.payNet || !mc.payPurpose || !mc.payPhone) {
      return await beginMyChama(phone, session);
    }

    if (!canCollectOnline(ctx.chama.plan)) {
      await replaceState(phone, session, STATE.MYCHAMA_MENU, { stack: [] });
      return mcMsg('PAY_NOT_ON_PLAN', lang) + '\n\n' + myChamaMenu(session);
    }

    if (!ctx.chama.settlementSplitCode) {
      await replaceState(phone, session, STATE.MYCHAMA_MENU, { stack: [] });
      return mcMsg('PAY_NO_SPLIT', lang) + '\n\n' + myChamaMenu(session);
    }

    // A split code without settlementSplitKeyVersion === 2 belongs to the OLD Paystack
    // account; the MyChama key can't use it, so Paystack would reject the charge.
    if (ctx.chama.settlementSplitKeyVersion !== 2 || !ctx.chama.settlementSubaccountCode) {
      await replaceState(phone, session, STATE.MYCHAMA_MENU, { stack: [] });
      return mcMsg('PAY_SPLIT_RELINK', lang) + '\n\n' + myChamaMenu(session);
    }

    // Re-validate against live data before asking Paystack for money.
    if (!(await paymentTargetStillValid(ctx, mc))) {
      await auditWhatsApp({
        phone,
        chamaId: ctx.chama.id,
        memberId: ctx.member.memberId,
        action: 'payment.initiate',
        outcome: 'denied',
        detail: { reason: 'stale_target', purpose: mc.payPurpose, net: mc.payNet },
      });
      await replaceState(phone, session, STATE.MYCHAMA_MENU, {
        stack: [],
        payPurpose: undefined,
        payNet: undefined,
        payLabel: undefined,
        payPhone: undefined,
        contributionId: undefined,
        loanId: undefined,
        installmentNo: undefined,
        potId: undefined,
        potPeriod: undefined,
        arrearId: undefined,
      });
      return mcMsg('PAY_STALE_TARGET', lang) + '\n\n' + myChamaMenu(session);
    }

    const allowed = await withinIntentRateLimit(ctx.chama.id, ctx.member.memberId);
    if (!allowed) {
      await auditWhatsApp({
        phone,
        chamaId: ctx.chama.id,
        memberId: ctx.member.memberId,
        action: 'payment.initiate',
        outcome: 'denied',
        detail: { reason: 'rate_limit' },
      });
      await replaceState(phone, session, STATE.MYCHAMA_MENU, { stack: [] });
      return mcMsg('PAY_RATE_LIMITED', lang) + '\n\n' + myChamaMenu(session);
    }

    const fees = feesFor(mc.payPurpose, mc.payNet, ctx.chama.plan);

    const target: IntentTarget = {
      purpose: mc.payPurpose,
      contributionId: mc.contributionId,
      loanId: mc.loanId,
      installmentNo: mc.installmentNo,
      potId: mc.potId,
      potPeriod: mc.potPeriod,
      arrearId: mc.arrearId,
      note: mc.payLabel,
    };

    const result = await initiateMyChamaPayment({
      chamaId: ctx.chama.id,
      chamaName: ctx.chama.name,
      memberId: ctx.member.memberId,
      memberName: ctx.member.name,
      phone: mc.payPhone,
      provider: mc.provider || 'mpesa',
      fees,
      splitCode: ctx.chama.settlementSplitCode,
      subaccountCode: ctx.chama.settlementSubaccountCode,
      target,
    });

    await auditWhatsApp({
      phone,
      chamaId: ctx.chama.id,
      memberId: ctx.member.memberId,
      action: 'payment.initiate',
      outcome: result.success ? 'success' : 'failure',
      detail: {
        purpose: mc.payPurpose,
        net: fees.net,
        gross: fees.gross,
        reference: result.reference,
        duplicate: !!result.duplicate,
        error: result.success ? undefined : result.error,
      },
    });

    await replaceState(phone, session, STATE.MYCHAMA_MENU, {
      stack: [],
      payPurpose: undefined,
      payNet: undefined,
      payLabel: undefined,
      payPhone: undefined,
      contributionId: undefined,
      loanId: undefined,
      installmentNo: undefined,
      potId: undefined,
      potPeriod: undefined,
      arrearId: undefined,
    });

    if (result.duplicate) {
      return (
        mcMsg('PAY_DUPLICATE', lang, {
          net: kes(fees.net),
          ref: (result.reference || '').slice(-10),
        }) +
        '\n\n' +
        myChamaMenu(session)
      );
    }

    if (!result.success) {
      return (
        mcMsg('PAY_FAILED', lang, { reason: result.error || 'unknown' }) +
        '\n\n' +
        myChamaMenu(session)
      );
    }

    return (
      mcMsg('PAY_SENT', lang, {
        phone: localPhone(mc.payPhone),
        ref: (result.reference || '').slice(-10),
      }) +
      '\n\n' +
      myChamaMenu(session)
    );
  } catch (error) {
    return await failSoft(phone, session, 'handlePayConfirm', error);
  }
}
