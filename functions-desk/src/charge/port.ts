/**
 * The three Paystack operations the money backend needs, behind an interface so tests can inject a double.
 * The live implementation is the kernel's real client; a double exists only in test files.
 */
import { getConfig } from "../db.js";
import type { DeskConfig } from "../config.js";
import type { DelegateOptions } from "../kernel/delegate.js";
import {
  chargeMpesa, verifyTransaction, type MpesaChargeInput, type MpesaChargeResult, type VerifiedTransaction,
} from "../paystack/client.js";
import { getOrCreateSplitCode, type SplitSub } from "../paystack/splits.js";
import { DeskError } from "../errors.js";

export interface PaystackPort {
  chargeMpesa(i: MpesaChargeInput): Promise<MpesaChargeResult>;
  verifyTransaction(reference: string): Promise<VerifiedTransaction>;
  getOrCreateSplitCode(subs: readonly SplitSub[], label: string): Promise<string>;
}
export const livePaystack: PaystackPort = { chargeMpesa, verifyTransaction, getOrCreateSplitCode };

/** Injection points shared by every handler. Production passes nothing and gets the real implementations. */
export interface DeskDeps {
  port?: PaystackPort;
  delegate?: DelegateOptions;
  now?: () => number;
  config?: () => Promise<DeskConfig>;
}
export interface ResolvedDeps {
  port: PaystackPort; delegate?: DelegateOptions; now: () => number; config: () => Promise<DeskConfig>;
}
export function resolveDeps(d: DeskDeps = {}): ResolvedDeps {
  return { port: d.port ?? livePaystack, delegate: d.delegate, now: d.now ?? Date.now, config: d.config ?? getConfig };
}

/**
 * Paystack answers an unknown reference with HTTP 404 "Transaction reference not found"; the kernel's verifyTransaction
 * surfaces Paystack's own message. That is the only case treated as "this reference never reached Paystack".
 */
export function isReferenceNotFound(err: unknown): boolean {
  return err instanceof DeskError && /not found/i.test(err.message);
}

/** Statuses after which Paystack will never take money for the attempt. */
export const DEAD_PAYSTACK_STATUSES: ReadonlySet<string> = new Set(["failed", "abandoned", "reversed"]);
