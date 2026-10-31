import { AggregateField, type Query } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import {
  DESK_TOP_CODE, DOC_KINDS, summaryTopRank, summaryTopStatus,
  type AgentStatus, type DocStatus, type PayoutAccountStatus, type TopGetDeskOut, type TopGetDocOut, type TopListDesksOut,
  type TopRequestOtpOut, type TopSetDeskStatusOut, type TopSetRankOut,
} from "../contract.js";
import { col, db } from "../db.js";
import { DeskError } from "../errors.js";
import { audit } from "../kernel/audit.js";
import type { AuthLike } from "../kernel/topdesk.js";
import { requireTopDesk } from "../kernel/topdesk.js";
import { record } from "../connectors/input.js";
import { hashOtp, takeRates, type RateRule } from "../otp/core.js";
import { maskPhone, normalizeKenyaPhone } from "../paystack/phone.js";
import type { AgentDoc, DocMetaDoc } from "../types.js";
import { docMetaId } from "../docs/pure.js";
import type { TopDeps } from "./deps.js";
import { runWithTopOtp } from "./otp.js";
import { afterRankChange, releaseAgentSlot } from "../network/admin.js";
import {
  checkStatusMove, checkTopSummary, deskCodeInput, isTopAction, LIST_DESKS_MAX, matchesSearch, rankInput, reasonInput, statusInput,
  summaryRow, TOP_OTP_REQUESTS_PER_HOUR, TOP_OTP_TTL_MS, topOtpSmsText,
} from "./pure.js";

const SCAN_PAGE = 500;
const SCAN_MAX = 5000;

/** Resolves a desk by its public code. Throws not_found. */
export async function findDeskByCode(code: string): Promise<AgentDoc> {
  const q = await col("agents").where("agentCode", "==", code).limit(2).get();
  if (q.empty) throw new DeskError("not_found", `No desk with code ${code}`);
  return q.docs[0].data() as AgentDoc;
}

const otpRule = (uid: string): RateRule => ({
  key: `top-otp:${uid}`, limit: TOP_OTP_REQUESTS_PER_HOUR, windowMs: 60 * 60_000,
  message: () => "Too many confirmation codes were requested. Try again later.",
});

export async function topRequestOtp(deps: TopDeps, auth: AuthLike | null | undefined, raw: unknown): Promise<TopRequestOtpOut> {
  const top = await requireTopDesk(auth);
  const d = record(raw);
  if (!isTopAction(d.action)) throw new DeskError("invalid_argument", "Unknown action");
  const check = checkTopSummary(d.action, d.summary);
  if (!check.ok) throw new DeskError("invalid_argument", check.message);
  const summary = d.summary as string;
  const phone = normalizeKenyaPhone(top.phone);

  const taken = await takeRates([otpRule(top.agentId)], deps.now());
  const ref = col("topOtps").doc();
  const otp = deps.randomOtp();
  const now = deps.now();
  await ref.create({
    actionId: ref.id, uid: top.agentId, action: d.action, summary, otpHash: hashOtp(otp, ref.id),
    otpAttempts: 0, otpExpiresAt: now + TOP_OTP_TTL_MS, createdAt: now,
  });
  try { await deps.sendSms(phone, topOtpSmsText(summary, otp)); }
  catch {
    await ref.delete().catch(() => undefined);
    await taken.release();
    throw new DeskError("internal", "We could not send the confirmation code. Please try again.");
  }
  await audit({ action: "top_otp_requested", agentId: top.agentId, meta: { topAction: d.action, actionId: ref.id } });
  return { actionId: ref.id, otpSentTo: maskPhone(phone) };
}

async function docCounts(uids: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (let i = 0; i < uids.length; i += 100) {
    const chunk = uids.slice(i, i + 100);
    const refs = chunk.flatMap((u) => DOC_KINDS.map((k) => col("docs").doc(docMetaId(u, k))));
    const snaps = await db().getAll(...refs);
    chunk.forEach((u, j) => out.set(u, snaps.slice(j * DOC_KINDS.length, (j + 1) * DOC_KINDS.length).filter((s) => s.exists).length));
  }
  return out;
}

export async function topListDesks(auth: AuthLike | null | undefined, raw: unknown): Promise<TopListDesksOut> {
  const top = await requireTopDesk(auth);
  const d = raw === undefined || raw === null ? {} : record(raw);
  const status = d.status === undefined || d.status === "" ? undefined : statusOrAny(d.status);
  const search = typeof d.search === "string" ? d.search.trim().slice(0, 80) : "";
  const limit = Math.min(Math.max(typeof d.limit === "number" && Number.isInteger(d.limit) ? d.limit : LIST_DESKS_MAX, 1), LIST_DESKS_MAX);

  const found: AgentDoc[] = [];
  // A full desk code is looked up directly (1 read) instead of scanning up to SCAN_MAX agents; no exact hit falls through to the scan.
  let direct = false;
  if (/^COG-\d{4,}$/i.test(search)) {
    const hit = await col("agents").where("agentCode", "==", search.toUpperCase()).limit(1).get();
    const a = hit.docs[0]?.data() as AgentDoc | undefined;
    if (a) { direct = true; if (!status || a.status === status) found.push(a); }
  }
  let scanned = 0;
  let last: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  while (!direct && found.length < limit && scanned < SCAN_MAX) {
    let q: Query = col("agents");
    if (status) q = q.where("status", "==", status);
    q = q.orderBy("createdAt", "desc");
    if (last) q = q.startAfter(last);
    const page = await q.limit(SCAN_PAGE).get();
    for (const doc of page.docs) {
      const a = doc.data() as AgentDoc;
      if (matchesSearch(a, search)) { found.push(a); if (found.length === limit) break; }
    }
    scanned += page.size;
    last = page.docs[page.docs.length - 1];
    if (page.size < SCAN_PAGE) break;
  }
  const counts = await docCounts(found.map((a) => a.agentId));
  await audit({ action: "top_list_desks", agentId: top.agentId, meta: { status: status ?? null, searched: search.length > 0, returned: found.length } });
  return { desks: found.map((a) => summaryRow(a, counts.get(a.agentId) ?? 0)) };
}
function statusOrAny(v: unknown): AgentStatus {
  const all: AgentStatus[] = ["applied", "training", "certified", "active", "suspended", "closed"];
  if (typeof v !== "string" || !all.includes(v as AgentStatus)) throw new DeskError("invalid_argument", "Unknown status");
  return v as AgentStatus;
}

async function earningsSums(uid: string): Promise<{ settledMinor: number; payableMinor: number; paidMinor: number }> {
  const sum = async (status: string): Promise<number> => {
    const r = await col("ledger").where("agentId", "==", uid).where("status", "==", status).aggregate({ s: AggregateField.sum("amountMinor") }).get();
    return r.data().s ?? 0;
  };
  const [settled, payable, processing, paid] = await Promise.all([sum("settled"), sum("payable"), sum("processing"), sum("paid")]);
  return { settledMinor: settled, payableMinor: payable + processing, paidMinor: paid };
}

/** Last 20 audit rows for the desk. Falls back to a bounded scan until the (agentId, at) index is deployed. */
async function recentAudit(uid: string): Promise<{ action: string; at: number }[]> {
  const pick = (rows: FirebaseFirestore.QueryDocumentSnapshot[]) => rows.map((r) => ({ action: String(r.data().action), at: Number(r.data().at) }));
  try {
    return pick((await col("audit").where("agentId", "==", uid).orderBy("at", "desc").limit(20).get()).docs);
  } catch (err) {
    if ((err as { code?: number }).code !== 9) throw err; // 9 = FAILED_PRECONDITION: index missing
    logger.warn("desk_top_getDesk: audit index missing, using bounded scan");
    const rows = pick((await col("audit").where("agentId", "==", uid).limit(500).get()).docs);
    return rows.sort((a, b) => b.at - a.at).slice(0, 20);
  }
}

export async function payoutAccountStatuses(uid: string, cfg: { paystackAccounts: { chama: string } }): Promise<PayoutAccountStatus[]> {
  const snap = await db().collection("agents").doc(uid).get();
  const info = (snap.data()?.paymentInfo ?? {}) as { accountId?: string; productAccounts?: { chama?: string } };
  const out: PayoutAccountStatus[] = [info.accountId
    ? { account: "main", ready: true } : { account: "main", ready: false, reason: "No main payout account yet" }];
  if (cfg.paystackAccounts.chama === "separate") {
    out.push(info.productAccounts?.chama ? { account: "chama", ready: true } : { account: "chama", ready: false, reason: "No MyChama payout account yet" });
  }
  return out;
}

async function docStatuses(uid: string): Promise<DocStatus[]> {
  const snaps = await db().getAll(...DOC_KINDS.map((k) => col("docs").doc(docMetaId(uid, k))));
  return DOC_KINDS.map((kind, i) => {
    const m = snaps[i].exists ? (snaps[i].data() as DocMetaDoc) : undefined;
    return m ? { kind, uploadedAt: m.uploadedAt, contentType: m.contentType, sizeBytes: m.sizeBytes } : { kind };
  });
}

export async function topGetDesk(deps: TopDeps, auth: AuthLike | null | undefined, raw: unknown): Promise<TopGetDeskOut> {
  const top = await requireTopDesk(auth);
  const code = deskCodeInput(record(raw).deskCode);
  const a = await findDeskByCode(code);
  const cfg = await deps.getConfig();
  const [docs, earnings, payoutAccounts, recent] = await Promise.all([docStatuses(a.agentId), earningsSums(a.agentId), payoutAccountStatuses(a.agentId, cfg), recentAudit(a.agentId)]);
  await audit({ action: "top_get_desk", agentId: top.agentId, meta: { deskCode: code } });
  const desk: TopGetDeskOut["desk"] = { ...summaryRow(a, docs.filter((x) => x.uploadedAt).length), idNumberMasked: a.idNumberMasked };
  if (a.termsAcceptedAt) desk.termsAcceptedAt = a.termsAcceptedAt;
  if (a.statusReason) desk.statusReason = a.statusReason;
  return { desk, docs, earnings, payoutAccounts, recentAudit: recent };
}

/** Returns a registration document. The audit row is written FIRST and every time: no audit, no document. */
export async function topGetDoc(deps: TopDeps, auth: AuthLike | null | undefined, raw: unknown): Promise<TopGetDocOut> {
  const top = await requireTopDesk(auth);
  const d = record(raw);
  const code = deskCodeInput(d.deskCode);
  if (typeof d.kind !== "string" || !(DOC_KINDS as readonly string[]).includes(d.kind)) throw new DeskError("invalid_argument", "Choose a document");
  const kind = d.kind as typeof DOC_KINDS[number];
  const a = await findDeskByCode(code);
  const metaSnap = await col("docs").doc(docMetaId(a.agentId, kind)).get();
  if (!metaSnap.exists) throw new DeskError("not_found", "This document has not been uploaded");
  const meta = metaSnap.data() as DocMetaDoc;
  await audit({ action: "top_get_doc", agentId: top.agentId, meta: { deskCode: code, kind } });
  let bytes: Buffer;
  try { bytes = await deps.store.read(meta.path); }
  catch { throw new DeskError("internal", "We could not load this document. Please try again."); }
  return { contentType: meta.contentType, dataBase64: bytes.toString("base64") };
}

export async function endSessions(uid: string, nowMs: number): Promise<number> {
  let ended = 0;
  for (const status of ["pending", "active"]) {
    const snap = await col("sessions").where("agentId", "==", uid).where("status", "==", status).get();
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = db().batch();
      for (const s of snap.docs.slice(i, i + 400)) batch.update(s.ref, { status: "ended", endedAt: nowMs });
      await batch.commit();
    }
    ended += snap.size;
  }
  return ended;
}

export async function topSetDeskStatus(deps: TopDeps, auth: AuthLike | null | undefined, raw: unknown): Promise<TopSetDeskStatusOut> {
  const top = await requireTopDesk(auth);
  const d = record(raw);
  const code = deskCodeInput(d.deskCode);
  const to = statusInput(d.status);
  const reason = reasonInput(d.reason);
  if (code === DESK_TOP_CODE) throw new DeskError("permission_denied", "The top desk cannot be changed");
  const target = await findDeskByCode(code);
  if (target.agentId === top.agentId) throw new DeskError("permission_denied", "You cannot change your own desk");
  const targetRef = col("agents").doc(target.agentId);
  const now = deps.now();

  const result = await runWithTopOtp(
    { uid: top.agentId, actionId: d.actionId, otp: d.otp, action: "set_desk_status", expectedSummary: summaryTopStatus(code, to) }, now,
    async (tx) => {
      const [snap, ...rest] = await Promise.all([
        tx.get(targetRef),
        ...DOC_KINDS.map((k) => tx.get(col("docs").doc(docMetaId(target.agentId, k)))),
        tx.get(db().collection("agents").doc(target.agentId)),
      ]);
      const current = snap.data() as AgentDoc | undefined;
      if (!current) throw new DeskError("not_found", `No desk with code ${code}`);
      const move = checkStatusMove(current.status, to);
      if (!move.ok) throw new DeskError("failed_precondition", move.message);
      if (to === "active") {
        const docsOk = rest.slice(0, DOC_KINDS.length).every((s) => s.exists);
        if (!docsOk) throw new DeskError("failed_precondition", "All three registration documents must be uploaded before activating this desk");
        const payInfo = (rest[DOC_KINDS.length].data()?.paymentInfo ?? {}) as { accountId?: string };
        if (!payInfo.accountId) throw new DeskError("failed_precondition", "This desk has no ready main payout account yet");
      }
      return { from: current.status };
    },
    (tx, r) => {
      const patch: Record<string, unknown> = { status: to, statusReason: reason };
      if (to === "closed") patch.closedAt = now;
      tx.update(targetRef, patch);
      return r.from;
    },
  );
  const sessionsEnded = to === "active" ? 0 : await endSessions(target.agentId, now);
  if (to === "closed") await releaseAgentSlot(target.agentId, now);
  await audit({ action: "top_set_desk_status", agentId: top.agentId, meta: { deskCode: code, from: result, to, reason, sessionsEnded } });
  return { ok: true };
}

export async function topSetRank(deps: TopDeps, auth: AuthLike | null | undefined, raw: unknown): Promise<TopSetRankOut> {
  const top = await requireTopDesk(auth);
  const d = record(raw);
  const code = deskCodeInput(d.deskCode);
  const rank = rankInput(d.rank);
  if (code === DESK_TOP_CODE) throw new DeskError("permission_denied", "The top desk cannot be changed");
  const target = await findDeskByCode(code);
  const targetRef = col("agents").doc(target.agentId);

  const from = await runWithTopOtp(
    { uid: top.agentId, actionId: d.actionId, otp: d.otp, action: "set_rank", expectedSummary: summaryTopRank(code, rank) }, deps.now(),
    async (tx) => {
      const snap = await tx.get(targetRef);
      const current = snap.data() as AgentDoc | undefined;
      if (!current) throw new DeskError("not_found", `No desk with code ${code}`);
      if (current.status === "closed") throw new DeskError("failed_precondition", "This desk is closed");
      if (current.rank === rank) throw new DeskError("failed_precondition", `This desk is already ${rank}`);
      return current.rank;
    },
    (tx, previous) => { tx.update(targetRef, { rank }); return previous; },
  );
  await afterRankChange(target.agentId, from, rank, deps.now());
  await audit({ action: "top_set_rank", agentId: top.agentId, meta: { deskCode: code, from, to: rank } });
  return { ok: true };
}
