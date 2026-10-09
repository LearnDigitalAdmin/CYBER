import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { loadDeskConfig, type DeskConfig } from "./config.js";
import { DESK_COLLECTIONS } from "./contract.js";

export function db(): Firestore {
  if (getApps().length === 0) initializeApp();
  return getFirestore();
}
export const col = (name: keyof typeof DESK_COLLECTIONS) => db().collection(DESK_COLLECTIONS[name]);

export function getConfig(): Promise<DeskConfig> {
  return loadDeskConfig(async () => {
    const snap = await db().collection(DESK_COLLECTIONS.config).doc("global").get();
    return snap.exists ? (snap.data() as Partial<DeskConfig>) : undefined;
  });
}
