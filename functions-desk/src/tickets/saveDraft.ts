import type { SaveDraftOut } from "../contract.js";
import { FieldValue } from "firebase-admin/firestore";
import { col, db } from "../db.js";
import { DeskError } from "../errors.js";
import { audit } from "../kernel/audit.js";
import { requireSession } from "../kernel/session.js";
import { resolveDeps, type DeskDeps } from "../charge/port.js";
import { chunkDraft, chunkId } from "./draft.js";
import { SERVICE_SCOPE, type DeskTicket } from "./model.js";

const bad = (m: string) => new DeskError("invalid_argument", m);

/** Rows in the draft may never exceed what the ticket was quoted for (the price depends on the count). */
function checkAgainstQuote(t: DeskTicket, payload: Record<string, unknown>): void {
  const rows = (payload as { rows?: unknown }).rows;
  if (!Array.isArray(rows)) return;
  const quoted = t.serviceType === "import_excel" ? t.params.rowCount : t.serviceType === "manual_entry" ? t.params.recordCount : undefined;
  if (typeof quoted === "number" && rows.length > quoted)
    throw bad(`This draft has ${rows.length} rows but the quote covers ${quoted}. Request a new quote.`);
}

/** desk_saveDraft: the caller's own draft ticket, session still valid, chunks replaced atomically. */
export async function saveDraft(uid: string, data: unknown, deps: DeskDeps = {}): Promise<SaveDraftOut> {
  const d = resolveDeps(deps);
  if (typeof data !== "object" || data === null) throw bad("Invalid request");
  const { ticketId, payload } = data as { ticketId?: unknown; payload?: unknown };
  if (typeof ticketId !== "string" || !/^[A-Za-z0-9]{1,128}$/.test(ticketId)) throw bad("Invalid ticket");
  const { chunks, bytes } = chunkDraft(payload);

  const ticketRef = col("tickets").doc(ticketId);
  const pre = await ticketRef.get();
  if (!pre.exists) throw new DeskError("not_found", "Ticket not found");
  const t = pre.data() as DeskTicket;
  if (t.agentId !== uid) throw new DeskError("permission_denied", "This ticket belongs to another agent");
  await requireSession({ sessionId: t.sessionId, uid, scope: SERVICE_SCOPE[t.serviceType] });
  checkAgainstQuote(t, payload as Record<string, unknown>);

  const draftCol = ticketRef.collection("draft");
  await db().runTransaction(async (tx) => {
    const [cur, old] = await Promise.all([tx.get(ticketRef), tx.get(draftCol)]);
    const ct = cur.data() as DeskTicket | undefined;
    if (!cur.exists || !ct || ct.agentId !== uid) throw new DeskError("not_found", "Ticket not found");
    if (ct.status !== "draft") throw new DeskError("failed_precondition", "This ticket can no longer be edited");
    const keep = new Set(chunks.map((c) => chunkId(c.index)));
    for (const o of old.docs) if (!keep.has(o.id)) tx.delete(o.ref);
    for (const c of chunks) tx.set(draftCol.doc(chunkId(c.index)), { index: c.index, total: c.total, json: c.json });
    tx.update(ticketRef, { draftChunks: chunks.length, draftBytes: bytes, updatedAt: d.now(), failureReason: FieldValue.delete() });
  });
  await audit({
    action: "ticket_draft_saved", agentId: uid, entityKey: t.entityKey, sessionId: t.sessionId,
    meta: { ticketId, chunks: chunks.length, bytes },
  });
  return { ok: true };
}
