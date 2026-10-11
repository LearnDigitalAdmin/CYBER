/** Everything the requests area needs from outside, behind one interface so emulator tests can substitute SMS and the product databases. */
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import type { DeskConfig } from "../config.js";
import { getConfig } from "../db.js";
import { DeskError } from "../errors.js";
import { sendSms } from "../kernel/sms.js";
import type { SweptProduct } from "./pure.js";

export interface RequestsDeps {
  now(): number;
  getConfig(): Promise<DeskConfig>;
  sendSms(phoneE164: string, message: string): Promise<void>;
  /** Admin SDK handle on a product's Firestore. Desk reaches products; products never reach desk. */
  productDb(cfg: DeskConfig, product: SweptProduct): Firestore;
}

/** Same named-app convention the Chama connector uses, so one app per project is shared inside an instance. */
export function productFirestore(cfg: DeskConfig, product: SweptProduct): Firestore {
  const projectId = (cfg.projects[product] ?? "").trim();
  if (!projectId) throw new DeskError("failed_precondition", `The ${product} project is not connected yet`);
  const name = `desk-${product}-${projectId}`;
  const app = getApps().find((a) => a.name === name) ?? initializeApp({ projectId }, name);
  return getFirestore(app);
}

export const defaultRequestsDeps = (): RequestsDeps => ({ now: () => Date.now(), getConfig, sendSms, productDb: productFirestore });
