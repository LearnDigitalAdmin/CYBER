/**
 * desk_sweepRequests: pulls each product's `desk_requests` outbox into desk, pushes the public config into each product
 * project, and retries unfinished write-backs. Desk reaches the products; they never reach desk.
 */
import * as logger from "firebase-functions/logger";
import { col } from "../db.js";
import type { DeskConfig } from "../config.js";
import { DESK_COLLECTIONS } from "../contract.js";
import { type RequestsDeps } from "./deps.js";
import {
  buildPublicConfig, hasProductOutbox, hashPublicConfig, requestDocId, sanitiseOutboxItem, SWEEP_PER_PRODUCT, SWEPT_PRODUCTS,
  type RequestDoc, type SweptProduct,
} from "./pure.js";

const ALREADY_EXISTS = 6;
const PRODUCT_OUTBOX = DESK_COLLECTIONS.requests; // each product keeps its own collection with this name
const PUBLIC_CONFIG_COLLECTION = "desk_public_config";

export interface SweepSummary {
  pulled: number; alreadyHad: number; rejected: number; failed: number; configPushed: number; writeBacks: number; timedOut: boolean;
}

async function sweepProduct(deps: RequestsDeps, cfg: DeskConfig, product: SweptProduct, deadline: number, s: SweepSummary): Promise<void> {
  const pdb = deps.productDb(cfg, product);
  const snap = await pdb.collection(PRODUCT_OUTBOX).where("status", "==", "new").orderBy("createdAt").limit(SWEEP_PER_PRODUCT).get();
  for (const doc of snap.docs) {
    if (deps.now() > deadline) { s.timedOut = true; return; }
    try {
      const check = sanitiseOutboxItem(doc.data(), deps.now());
      if (!check.ok) {
        await doc.ref.update({ status: "rejected", error: check.error, pulledAt: deps.now() });
        s.rejected++;
        continue;
      }
      const it = check.item;
      const id = requestDocId(product, it.entityCode, doc.id);
      const now = deps.now();
      const request: RequestDoc = {
        id, source: product, entityCode: it.entityCode, entityName: it.entityName, requesterName: it.requesterName,
        requesterPhone: it.requesterPhone, category: it.category, subject: it.subject, message: it.message,
        status: "new", targetDeskCodes: it.targetDeskCodes, responses: [], createdAt: it.createdAt, updatedAt: now, outboxId: doc.id,
      };
      try {
        await col("requests").doc(id).create(request);
        s.pulled++;
      } catch (err) {
        if ((err as { code?: number }).code !== ALREADY_EXISTS) throw err;
        s.alreadyHad++; // an earlier run crashed between the two writes: the copy exists, so just mark the item
      }
      await doc.ref.update({ status: "pulled", pulledAt: deps.now() });
    } catch (err) {
      s.failed++;
      logger.error("desk_sweepRequests: item failed", { product, itemId: doc.id, err });
    }
  }
}

/** Pushes `desk_public_config/global` into a product project when its hash differs from the last pushed one. */
async function pushPublicConfig(deps: RequestsDeps, cfg: DeskConfig, product: SweptProduct): Promise<boolean> {
  const payload = buildPublicConfig(cfg, deps.now());
  const hash = hashPublicConfig(payload);
  const stateRef = col("counters").doc(`publicconfig_${product}`);
  const last = (await stateRef.get()).data() as { hash?: string; projectId?: string } | undefined;
  const projectId = cfg.projects[product];
  if (last?.hash === hash && last.projectId === projectId) return false;
  await deps.productDb(cfg, product).collection(PUBLIC_CONFIG_COLLECTION).doc("global").set(payload);
  await stateRef.set({ hash, projectId, pushedAt: deps.now() });
  return true;
}

/** Retries the product-side status/responses write for requests whose first write-back failed. */
export async function retryWriteBacks(deps: RequestsDeps, cfg: DeskConfig, deadline: number): Promise<number> {
  const pending = await col("requests").where("writeBackPending", "==", true).limit(100).get();
  let done = 0;
  for (const doc of pending.docs) {
    if (deps.now() > deadline) break;
    const r = doc.data() as RequestDoc;
    try {
      if (!hasProductOutbox(r.source) || !r.outboxId) { await doc.ref.update({ writeBackPending: false }); continue; }
      await deps.productDb(cfg, r.source).collection(PRODUCT_OUTBOX).doc(r.outboxId)
        .update({ deskStatus: r.status, responses: r.responses });
      await doc.ref.update({ writeBackPending: false });
      done++;
    } catch (err) {
      logger.warn("desk_sweepRequests: write-back still failing", { id: doc.id, err });
    }
  }
  return done;
}

export async function sweepRequests(deps: RequestsDeps, budgetMs: number): Promise<SweepSummary> {
  const deadline = deps.now() + budgetMs;
  const s: SweepSummary = { pulled: 0, alreadyHad: 0, rejected: 0, failed: 0, configPushed: 0, writeBacks: 0, timedOut: false };
  const cfg = await deps.getConfig();
  for (const product of SWEPT_PRODUCTS) {
    if (!(cfg.projects[product] ?? "").trim()) continue;
    try {
      if (!s.timedOut) await sweepProduct(deps, cfg, product, deadline, s);
      if (await pushPublicConfig(deps, cfg, product)) s.configPushed++;
    } catch (err) {
      s.failed++;
      logger.error("desk_sweepRequests: product failed", { product, err });
    }
  }
  s.writeBacks = await retryWriteBacks(deps, cfg, deadline);
  logger.info("desk_sweepRequests", s);
  return s;
}
