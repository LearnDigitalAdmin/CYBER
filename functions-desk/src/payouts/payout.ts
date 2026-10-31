/**
 * Top-desk payouts of `payable` bonus/support ledger rows through Paystack Transfers (main balance).
 *
 * Safety model:
 *  - the per-day cap is a transactional counter (`desk_counters/payout_day_<YYYY-MM-DD>`): an entry's amount is RESERVED in the
 *    same transaction that moves it payable -> processing, so concurrent payouts can never exceed the cap;
 *  - the Paystack reference is `payout_<entryId>`: re-sending the same entry can never create a second transfer, and before any
 *    send the reference is looked up at Paystack first;
 *  - a row becomes `paid` only after Paystack's verify says success (and the amount matches);
 *  - a conclusive failure returns the row to `payable` and releases the reservation; an unknown outcome stays `processing`
 *    for the reconciler.
 */
import { FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import {
  summaryTopPayout, type TopListPayablesOut, type TopPayable, type TopPayoutOut, type TopPayoutResult,
} from "../contract.js";
import { col, db } from "../db.js";
import type { DeskConfig } from "../config.js";
import { DeskError } from "../errors.js";
import { audit } from "../kernel/audit.js";
import { requireTopDesk, type AuthLike } from "../kernel/topdesk.js";
import { record } from "../connectors/input.js";
import { runWithTopOtp } from "../topdesk/otp.js";
import type { AgentDoc, LedgerDoc } from "../types.js";
import type { TransferClient } from "./paystack.js";
import {
  classifyTransferStatus, fitsCap, MAX_PAYOUT_ENTRIES, nairobiDayKey, payoutMsisdn, payoutReference, remainingCap,
} from "./pure.js";

export interface PayoutDeps { now(): number; getConfig(): Promise<DeskConfig>; transfers: TransferClient }

/** Fields this area adds to a ledger row beyond the shared LedgerDoc. */
export interface PayoutLedgerExtra { processingAt?: number; payoutDay?: string; payoutAttempt?: number; payoutError?: string }
export type PayoutRow = LedgerDoc & PayoutLedgerExtra;

const ledgerRef = (id: string) => col("ledger").doc(id);
const dayRef = (key: string) => col("counters").doc(`payout_day_${key}`);
/** Kinds the top desk can pay by hand. `network` rows (overrides + incentives) are normally paid automatically by the monthly run. */
export const PAYOUT_KINDS: readonly string[] = ["bonus", "support", "network"];
/** Kinds the scheduler pays on its own. Bonus and support stay manual (OTP-approved by the top desk). */
export const AUTO_PAYOUT_KINDS: readonly string[] = ["network"];
export const OTP_SETUP_MESSAGE =
  "Paystack is asking for a confirmation code on this transfer. Turn off \"Confirm transfers before sending\" in Paystack Preferences; this transfer will expire and can then be sent again.";

async function sentToday(deps: PayoutDeps): Promise<{ key: string; sentMinor: number }> {
  const key = nairobiDayKey(deps.now());
  return { key, sentMinor: ((await dayRef(key).get()).data()?.sentMinor as number | undefined) ?? 0 };
}

// ------------------------------------------------------------------ list
export async function topListPayables(deps: PayoutDeps, auth: AuthLike | null | undefined): Promise<TopListPayablesOut> {
  const top = await requireTopDesk(auth);
  const cfg = await deps.getConfig();
  const snap = await col("ledger").where("status", "==", "payable").orderBy("createdAt", "asc").limit(500).get();
  const rows = snap.docs.map((d) => d.data() as PayoutRow).filter((r) => PAYOUT_KINDS.includes(r.kind));
  const agentIds = [...new Set(rows.map((r) => r.agentId))];
  const agents = new Map<string, AgentDoc>();
  for (let i = 0; i < agentIds.length; i += 300) {
    for (const s of await db().getAll(...agentIds.slice(i, i + 300).map((id) => col("agents").doc(id)))) if (s.exists) agents.set(s.id, s.data() as AgentDoc);
  }
  const payables: TopPayable[] = [];
  for (const r of rows) {
    const a = agents.get(r.agentId);
    if (!a) continue;
    const p: TopPayable = { entryId: r.entryId, agentId: r.agentId, deskCode: a.agentCode, name: a.name, kind: r.kind as "bonus" | "support", amountMinor: r.amountMinor, createdAt: r.createdAt };
    if (r.note) p.note = r.note;
    payables.push(p);
  }
  const { sentMinor } = await sentToday(deps);
  await audit({ action: "top_list_payables", agentId: top.agentId, meta: { count: payables.length } });
  return { payables, dailyCapMinor: cfg.topDesk.dailyPayoutCapMinor, paidTodayMinor: sentMinor };
}

// ------------------------------------------------------------------ state changes (all idempotent, all transactional)
type Reserved =
  | { ok: true; row: PayoutRow; agent: AgentDoc; info: { settlementBank?: string; accountNumber?: string } | undefined; reference: string }
  | { ok: false; reason: string };

/** payable -> processing, reserving the amount against today's cap, in ONE transaction. */
async function reserve(deps: PayoutDeps, entryId: string, capMinor: number): Promise<Reserved> {
  const key = nairobiDayKey(deps.now());
  return db().runTransaction(async (tx): Promise<Reserved> => {
    const rSnap = await tx.get(ledgerRef(entryId));
    if (!rSnap.exists) return { ok: false, reason: "This entry no longer exists" };
    const row = rSnap.data() as PayoutRow;
    if (!PAYOUT_KINDS.includes(row.kind)) return { ok: false, reason: "Only bonus, support and network earnings can be paid here" };
    if (row.status !== "payable") return { ok: false, reason: `This entry is already ${row.status}` };
    const [aSnap, pSnap, cSnap] = await Promise.all([tx.get(col("agents").doc(row.agentId)), tx.get(db().collection("agents").doc(row.agentId)), tx.get(dayRef(key))]);
    const agent = aSnap.exists ? (aSnap.data() as AgentDoc) : undefined;
    if (!agent || agent.status !== "active") return { ok: false, reason: "This desk is not active" };
    const sent = (cSnap.data()?.sentMinor as number | undefined) ?? 0;
    if (!fitsCap(capMinor, sent, row.amountMinor)) return { ok: false, reason: "This would exceed today's payout limit" };
    const reference = payoutReference(entryId, row.payoutAttempt ?? 0);
    tx.update(ledgerRef(entryId), { status: "processing", processingAt: deps.now(), transferRef: reference, payoutDay: key, payoutError: FieldValue.delete() });
    tx.set(dayRef(key), { sentMinor: sent + row.amountMinor, updatedAt: deps.now() }, { merge: true });
    const info = (pSnap.data()?.paymentInfo ?? undefined) as { settlementBank?: string; accountNumber?: string } | undefined;
    return { ok: true, row, agent, info, reference };
  });
}

/** processing -> payable: releases the reservation. `bump` is true only when Paystack concluded the transfer as failed/reversed. */
export async function returnToPayable(deps: PayoutDeps, entryId: string, reason: string, bump: boolean): Promise<boolean> {
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ledgerRef(entryId));
    const row = snap.data() as PayoutRow | undefined;
    if (!row || row.status !== "processing") return false;
    const dKey = row.payoutDay;
    const cSnap = dKey ? await tx.get(dayRef(dKey)) : undefined;
    tx.update(ledgerRef(entryId), {
      status: "payable", payoutError: reason, payoutAttempt: (row.payoutAttempt ?? 0) + (bump ? 1 : 0), processingAt: FieldValue.delete(),
    });
    if (dKey && cSnap) {
      const sent = (cSnap.data()?.sentMinor as number | undefined) ?? 0;
      tx.set(dayRef(dKey), { sentMinor: Math.max(0, sent - row.amountMinor), updatedAt: deps.now() }, { merge: true });
    }
    return true;
  });
}

async function markPaid(deps: PayoutDeps, entryId: string, v: { transferCode?: string; amountMinor: number; reference: string }): Promise<boolean> {
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ledgerRef(entryId));
    const row = snap.data() as PayoutRow | undefined;
    if (!row || row.status !== "processing") return false;
    if (v.amountMinor > 0 && v.amountMinor !== row.amountMinor) {
      tx.update(ledgerRef(entryId), { payoutError: "Paystack reports a different amount for this transfer. Check it in the Paystack dashboard." });
      return false;
    }
    const patch: Record<string, unknown> = { status: "paid", paidAt: deps.now(), transferRef: v.reference, payoutError: FieldValue.delete(), processingAt: FieldValue.delete() };
    if (v.transferCode) patch.transferCode = v.transferCode;
    tx.update(ledgerRef(entryId), patch);
    return true;
  });
}

async function notePayoutProblem(entryId: string, message: string): Promise<void> {
  await ledgerRef(entryId).update({ payoutError: message }).catch(() => undefined);
}

/** Applies what Paystack says about a transfer to its row. Shared by desk_top_payout and the reconciler. */
export async function applyTransferLookup(
  deps: PayoutDeps, entryId: string, v: { status: string; amountMinor: number; transferCode?: string; reference: string },
): Promise<{ status: TopPayoutResult["status"]; error?: string }> {
  const outcome = classifyTransferStatus(v.status);
  if (outcome === "paid") {
    if (await markPaid(deps, entryId, v)) return { status: "paid" };
    const now = (await ledgerRef(entryId).get()).data() as PayoutRow | undefined;
    return now?.status === "paid" ? { status: "paid" } : { status: "processing", error: "Waiting for confirmation" };
  }
  if (outcome === "failed") {
    const reason = `Paystack reported the transfer as ${v.status}. The entry is payable again.`;
    await returnToPayable(deps, entryId, reason, true);
    return { status: "failed", error: reason };
  }
  if (outcome === "otp") { await notePayoutProblem(entryId, OTP_SETUP_MESSAGE); return { status: "processing", error: OTP_SETUP_MESSAGE }; }
  return { status: "processing" };
}

// ------------------------------------------------------------------ recipient
async function ensureRecipient(deps: PayoutDeps, agent: AgentDoc, info: { settlementBank?: string; accountNumber?: string } | undefined): Promise<string> {
  const { local } = payoutMsisdn(agent.phone, info);
  const stored = agent as AgentDoc & { payoutRecipientMsisdn?: string };
  if (stored.payoutRecipientCode && stored.payoutRecipientMsisdn === local) return stored.payoutRecipientCode;
  const { recipientCode } = await deps.transfers.createRecipient({ name: agent.name.slice(0, 80), accountNumberLocal: local });
  await col("agents").doc(agent.agentId).update({ payoutRecipientCode: recipientCode, payoutRecipientMsisdn: local });
  return recipientCode;
}

// ------------------------------------------------------------------ one entry
export async function payEntry(deps: PayoutDeps, entryId: string, capMinor: number): Promise<TopPayoutResult> {
  const r = await reserve(deps, entryId, capMinor);
  if (!r.ok) return { entryId, status: "failed", reference: "", error: r.reason };
  const { row, agent, info, reference } = r;

  // Phase A: nothing has been sent yet, so any failure here is safe to hand back as payable.
  let recipientCode: string;
  try {
    const existing = await deps.transfers.verify(reference);
    if (existing.found) { // an earlier attempt already created it: never create another
      const res = await applyTransferLookup(deps, entryId, existing);
      return { entryId, reference, ...res };
    }
    recipientCode = await ensureRecipient(deps, agent, info);
  } catch (err) {
    const reason = err instanceof DeskError ? err.message : "Could not prepare the payout";
    await returnToPayable(deps, entryId, reason, false);
    return { entryId, status: "failed", reference, error: reason };
  }

  // Phase B: from here Paystack may have the money; an unclear result stays `processing` for the reconciler.
  try {
    let init: { status: string; transferCode?: string } | undefined;
    let initError: string | undefined;
    try {
      init = await deps.transfers.initiate({ amountMinor: row.amountMinor, recipientCode, reference, reason: `Samuhia Desk ${row.kind} payout` });
    } catch (err) { initError = err instanceof DeskError ? err.message : "Paystack request failed"; }

    if (initError || !init) {
      const lookup = await deps.transfers.verify(reference).catch(() => undefined);
      if (lookup?.found) { const res = await applyTransferLookup(deps, entryId, lookup); return { entryId, reference, ...res }; }
      if (lookup && !lookup.found) { // Paystack has no such transfer, so nothing left the balance
        await returnToPayable(deps, entryId, initError ?? "Paystack did not create the transfer", false);
        return { entryId, status: "failed", reference, error: initError ?? "Paystack did not create the transfer" };
      }
      return { entryId, status: "processing", reference, error: "Paystack did not answer. The result will be confirmed automatically." };
    }

    if (classifyTransferStatus(init.status) === "otp") {
      await notePayoutProblem(entryId, OTP_SETUP_MESSAGE);
      return { entryId, status: "processing", reference, error: OTP_SETUP_MESSAGE };
    }
    // Confirm against Paystack before claiming `paid`.
    const confirmed = await deps.transfers.verify(reference);
    if (!confirmed.found) return { entryId, status: "processing", reference };
    const res = await applyTransferLookup(deps, entryId, { ...confirmed, transferCode: confirmed.transferCode ?? init.transferCode });
    return { entryId, reference, ...res };
  } catch (err) {
    logger.error("desk_top_payout: outcome unclear, left processing", { entryId, err });
    return { entryId, status: "processing", reference, error: "The result will be confirmed automatically." };
  }
}

// ------------------------------------------------------------------ the callable
function entryIdsInput(v: unknown): string[] {
  if (!Array.isArray(v) || v.length < 1) throw new DeskError("invalid_argument", "Choose at least one entry to pay");
  if (v.length > MAX_PAYOUT_ENTRIES) throw new DeskError("invalid_argument", `Pay at most ${MAX_PAYOUT_ENTRIES} entries at a time`);
  const ids = v.map((x) => (typeof x === "string" ? x.trim() : ""));
  if (ids.some((x) => !/^[0-9a-f]{28}$/.test(x))) throw new DeskError("invalid_argument", "One of the entries is not valid");
  if (new Set(ids).size !== ids.length) throw new DeskError("invalid_argument", "An entry was chosen twice");
  return ids;
}

export async function topPayout(deps: PayoutDeps, auth: AuthLike | null | undefined, raw: unknown): Promise<TopPayoutOut> {
  const top = await requireTopDesk(auth);
  const d = record(raw);
  const ids = entryIdsInput(d.entryIds);
  const cfg = await deps.getConfig();
  const cap = cfg.topDesk.dailyPayoutCapMinor;

  const snaps = await db().getAll(...ids.map(ledgerRef));
  const rows = snaps.map((s) => (s.exists ? (s.data() as PayoutRow) : undefined));
  if (rows.some((r) => !r || !PAYOUT_KINDS.includes(r.kind) || r.status !== "payable" || r.amountMinor <= 0)) {
    throw new DeskError("failed_precondition", "Some entries are no longer payable. Refresh the list and try again.");
  }
  const valid = rows as PayoutRow[];
  const agentIds = [...new Set(valid.map((r) => r.agentId))];
  const agentSnaps = await db().getAll(...agentIds.map((id) => col("agents").doc(id)));
  if (agentSnaps.some((s) => !s.exists || (s.data() as AgentDoc).status !== "active")) {
    throw new DeskError("failed_precondition", "Every desk being paid must be active");
  }
  const totalMinor = valid.reduce((sum, r) => sum + r.amountMinor, 0);
  const { sentMinor } = await sentToday(deps);
  if (!fitsCap(cap, sentMinor, totalMinor)) {
    throw new DeskError("failed_precondition", `This is more than today's remaining payout limit (KES ${(remainingCap(cap, sentMinor) / 100).toFixed(2)} left).`);
  }

  // The summary is recomputed here from the real entries; the stored one must equal it. The code is consumed before any money moves.
  await runWithTopOtp(
    { uid: top.agentId, actionId: d.actionId, otp: d.otp, action: "payout", expectedSummary: summaryTopPayout(totalMinor, agentIds.length) }, deps.now(),
    async () => undefined, () => undefined,
  );

  const codes = new Map(agentSnaps.map((s) => [s.id, (s.data() as AgentDoc).agentCode]));
  const results: TopPayoutResult[] = [];
  for (const id of ids) {
    let res: TopPayoutResult;
    try { res = await payEntry(deps, id, cap); }
    catch (err) {
      logger.error("desk_top_payout: entry failed unexpectedly", { entryId: id, err });
      res = { entryId: id, status: "failed", reference: "", error: "Something went wrong with this entry. Refresh to see its state." };
    }
    results.push(res);
    const row = valid[ids.indexOf(id)];
    await audit({
      action: "top_payout_entry", agentId: top.agentId,
      meta: { entryId: id, deskCode: codes.get(row.agentId), amountMinor: row.amountMinor, status: res.status, reference: res.reference, error: res.error ?? null },
    });
  }
  await audit({
    action: "top_payout", agentId: top.agentId,
    meta: { entries: ids.length, totalMinor, desks: agentIds.length, paid: results.filter((r) => r.status === "paid").length, processing: results.filter((r) => r.status === "processing").length, failed: results.filter((r) => r.status === "failed").length },
  });
  return { results };
}
