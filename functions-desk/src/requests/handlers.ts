import * as logger from "firebase-functions/logger";
import type { Query } from "firebase-admin/firestore";
import {
  DESK_TOP_CODE, REQUEST_CATEGORIES, type CreateRequestOut, type ListRequestsOut, type RequestResponse, type RequestStatus,
  type RequestView, type UpdateRequestOut,
} from "../contract.js";
import { col, db } from "../db.js";
import { DeskError } from "../errors.js";
import { audit } from "../kernel/audit.js";
import { requireActiveAgent } from "../kernel/agents.js";
import { record, text } from "../connectors/input.js";
import { takeRates, type RateRule } from "../otp/core.js";
import type { RequestsDeps } from "./deps.js";
import {
  canTransition, hasProductOutbox, parseLimit, replySmsText, REQUEST_STATUSES, RESPONSE_MAX, smsAllowed, MESSAGE_MAX, SUBJECT_MAX, type RequestDoc,
} from "./pure.js";

const PRODUCT_OUTBOX = "desk_requests";
const CREATES_PER_DAY = 10;

const view = (r: RequestDoc): RequestView => ({
  id: r.id, source: r.source, entityCode: r.entityCode, entityName: r.entityName, requesterName: r.requesterName,
  requesterPhone: r.requesterPhone, category: r.category, subject: r.subject, message: r.message, status: r.status,
  targetDeskCodes: r.targetDeskCodes, responses: r.responses ?? [], createdAt: r.createdAt, updatedAt: r.updatedAt,
});

const asStatus = (v: unknown): RequestStatus | undefined => {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v !== "string" || !(REQUEST_STATUSES as readonly string[]).includes(v)) throw new DeskError("invalid_argument", "Unknown request status");
  return v as RequestStatus;
};

/** The desk's own queue (requests that target its code), newest first, plus how many are still new. */
export async function listRequests(uid: string, raw: unknown): Promise<ListRequestsOut> {
  const d = raw === undefined || raw === null ? {} : record(raw);
  const agent = await requireActiveAgent(uid);
  const status = asStatus(d.status);
  const limit = parseLimit(d.limit);
  if (d.before !== undefined && (typeof d.before !== "number" || !Number.isFinite(d.before))) throw new DeskError("invalid_argument", "Invalid page cursor");

  let q: Query = col("requests").where("targetDeskCodes", "array-contains", agent.agentCode);
  if (status) q = q.where("status", "==", status);
  q = q.orderBy("createdAt", "desc");
  if (typeof d.before === "number") q = q.startAfter(d.before);
  const page = await q.limit(limit).get();

  const count = await col("requests").where("targetDeskCodes", "array-contains", agent.agentCode).where("status", "==", "new").count().get();
  return { requests: page.docs.map((x) => view(x.data() as RequestDoc)), newCount: count.data().count };
}

/** Writes status + responses into the product's own outbox item. Returns false when it could not (the sweeper retries). */
async function writeBack(deps: RequestsDeps, r: RequestDoc): Promise<boolean> {
  if (!hasProductOutbox(r.source) || !r.outboxId) return true;
  try {
    const cfg = await deps.getConfig();
    await deps.productDb(cfg, r.source).collection(PRODUCT_OUTBOX).doc(r.outboxId).update({ deskStatus: r.status, responses: r.responses });
    return true;
  } catch (err) {
    logger.warn("desk_updateRequest: write-back failed, will retry", { id: r.id, err });
    return false;
  }
}

export async function updateRequest(deps: RequestsDeps, uid: string, raw: unknown): Promise<UpdateRequestOut> {
  const d = record(raw);
  const id = text(d.id, "Request", 1, 300);
  const to = asStatus(d.status);
  if (!to) throw new DeskError("invalid_argument", "Choose a status");
  const response = d.response === undefined || d.response === null || d.response === "" ? undefined : text(d.response, "Response", 1, RESPONSE_MAX);
  if (to === "answered" && !response) throw new DeskError("invalid_argument", `Write a reply of 1–${RESPONSE_MAX} characters to mark this answered`);
  const agent = await requireActiveAgent(uid);

  const ref = col("requests").doc(id);
  const out = await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    // A desk can only see and change requests that target it; anything else looks like it does not exist.
    if (!snap.exists || !(snap.data() as RequestDoc).targetDeskCodes.includes(agent.agentCode)) throw new DeskError("not_found", "Request not found");
    const r = snap.data() as RequestDoc;
    if (r.status === "closed") throw new DeskError("failed_precondition", "This request is closed");
    if (!canTransition(r.status, to)) throw new DeskError("failed_precondition", `A ${r.status} request cannot be set to ${to}`);
    const now = deps.now();
    const responses: RequestResponse[] = response ? [...(r.responses ?? []), { at: now, byDeskCode: agent.agentCode, text: response }] : (r.responses ?? []);
    const sendSms = Boolean(response) && smsAllowed(r.lastSmsAt, now);
    const next: RequestDoc = { ...r, status: to, responses, updatedAt: now };
    const patch: Record<string, unknown> = { status: to, responses, updatedAt: now, writeBackPending: hasProductOutbox(r.source) };
    if (sendSms) { patch.lastSmsAt = now; next.lastSmsAt = now; }
    tx.update(ref, patch);
    return { before: r, next, sendSms, response };
  });

  if (hasProductOutbox(out.next.source) && (await writeBack(deps, out.next))) await ref.update({ writeBackPending: false });
  if (out.sendSms && out.response) {
    try { await deps.sendSms(out.next.requesterPhone, replySmsText(out.next.subject, out.response)); }
    catch (err) { logger.warn("desk_updateRequest: requester SMS failed", { id, err }); }
  }
  await audit({
    action: "request_updated", agentId: uid,
    meta: { requestId: id, from: out.before.status, to, replied: Boolean(out.response), smsSent: out.sendSms, source: out.next.source },
  });
  return { ok: true };
}

const createRule = (uid: string): RateRule => ({
  key: `request-day:${uid}`, limit: CREATES_PER_DAY, windowMs: 24 * 60 * 60_000,
  message: () => "You have sent too many requests today. Please try again tomorrow.",
});

/** A desk asking the top desk for help. */
export async function createRequest(deps: RequestsDeps, uid: string, raw: unknown): Promise<CreateRequestOut> {
  const d = record(raw);
  if (typeof d.category !== "string" || !(REQUEST_CATEGORIES as readonly string[]).includes(d.category)) throw new DeskError("invalid_argument", "Choose a category");
  const subject = text(d.subject, "Subject", 1, SUBJECT_MAX);
  const message = text(d.message, "Message", 1, MESSAGE_MAX);
  const agent = await requireActiveAgent(uid);
  if (agent.agentCode === DESK_TOP_CODE) throw new DeskError("failed_precondition", "The top desk cannot send a request to itself");

  const taken = await takeRates([createRule(uid)], deps.now());
  const ref = col("requests").doc();
  const id = `desk_${agent.agentCode}_${ref.id}`;
  const now = deps.now();
  const doc: RequestDoc = {
    id, source: "desk", entityCode: agent.agentCode, entityName: agent.name, requesterName: agent.name, requesterPhone: agent.phone,
    category: d.category, subject, message, status: "new", targetDeskCodes: [DESK_TOP_CODE], responses: [], createdAt: now, updatedAt: now,
  };
  try { await col("requests").doc(id).create(doc); } catch (err) { await taken.release(); throw err; }
  await audit({ action: "request_created", agentId: uid, meta: { requestId: id, category: d.category } });
  return { id };
}
