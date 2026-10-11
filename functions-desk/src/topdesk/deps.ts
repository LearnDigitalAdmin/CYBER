import type { DeskConfig } from "../config.js";
import { getConfig } from "../db.js";
import { sendSms } from "../kernel/sms.js";
import { randomOtp } from "../connectors/deps.js";
import { bucketStore, type DocsStore } from "../docs/deps.js";

export interface TopDeps {
  now(): number;
  getConfig(): Promise<DeskConfig>;
  sendSms(phoneE164: string, message: string): Promise<void>;
  randomOtp(): string;
  store: Pick<DocsStore, "read">;
}
export const defaultTopDeps = (): TopDeps => ({ now: () => Date.now(), getConfig, sendSms, randomOtp, store: bucketStore });
