import { DOC_KINDS, type DocStatus, type ListMyDocsOut, type UploadDocOut } from "../contract.js";
import { col, db } from "../db.js";
import { DeskError } from "../errors.js";
import { audit } from "../kernel/audit.js";
import { record } from "../connectors/input.js";
import type { AgentDoc, DocMetaDoc } from "../types.js";
import type { DocsDeps } from "./deps.js";
import { docMetaId, docStoragePath, parseUpload, uploadAllowed } from "./pure.js";

async function requireAgent(uid: string): Promise<AgentDoc> {
  const snap = await col("agents").doc(uid).get();
  if (!snap.exists) throw new DeskError("permission_denied", "Apply to become a Samuhia Desk agent first");
  return snap.data() as AgentDoc;
}

/** Stores one registration document privately (Admin SDK only) and records its metadata. */
export async function uploadDoc(deps: DocsDeps, uid: string, raw: unknown): Promise<UploadDocOut> {
  const up = parseUpload(record(raw));
  const agent = await requireAgent(uid);
  const metaRef = col("docs").doc(docMetaId(uid, up.kind));
  const existing = (await metaRef.get()).exists;
  const gate = uploadAllowed(agent.status, existing);
  if (!gate.ok) throw new DeskError("failed_precondition", gate.message);

  const path = docStoragePath(uid, up.kind);
  try { await deps.store.save(path, up.bytes, up.contentType); }
  catch { throw new DeskError("internal", "We could not save your document. Please try again."); }
  const meta: DocMetaDoc = { id: metaRef.id, uid, kind: up.kind, contentType: up.contentType, sizeBytes: up.bytes.length, path, uploadedAt: deps.now() };
  await metaRef.set(meta);
  await audit({ action: "doc_uploaded", agentId: uid, meta: { kind: up.kind, sizeBytes: up.bytes.length, contentType: up.contentType, replaced: existing } });
  return { ok: true };
}

/** What the desk has uploaded: one row per document kind, never the file itself. */
export async function listMyDocs(uid: string): Promise<ListMyDocsOut> {
  await requireAgent(uid);
  const snaps = await db().getAll(...DOC_KINDS.map((k) => col("docs").doc(docMetaId(uid, k))));
  const docs: DocStatus[] = DOC_KINDS.map((kind, i) => {
    const m = snaps[i].exists ? (snaps[i].data() as DocMetaDoc) : undefined;
    return m ? { kind, uploadedAt: m.uploadedAt, contentType: m.contentType, sizeBytes: m.sizeBytes } : { kind };
  });
  return { docs };
}
