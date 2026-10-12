import { getApps, initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";

/** File storage behind an interface so tests can substitute it. Production uses the project's default bucket (Admin SDK, private). */
export interface DocsStore {
  save(path: string, bytes: Buffer, contentType: string): Promise<void>;
  read(path: string): Promise<Buffer>;
}
export interface DocsDeps { now(): number; store: DocsStore }

const bucket = () => { if (!getApps().some((a) => a.name === "[DEFAULT]")) initializeApp(); return getStorage().bucket(); };

export const bucketStore: DocsStore = {
  async save(path, bytes, contentType) {
    await bucket().file(path).save(bytes, { contentType, resumable: false, metadata: { cacheControl: "private, max-age=0" } });
  },
  async read(path) {
    const [data] = await bucket().file(path).download();
    return data;
  },
};

export const defaultDocsDeps = (): DocsDeps => ({ now: () => Date.now(), store: bucketStore });
