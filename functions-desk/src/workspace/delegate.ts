/**
 * Product delegate for the workspace callables. It is `callDelegate` (kernel, unchanged) plus one thing the kernel cannot do:
 * callDelegate folds every product error into a handful of codes, so a product's "I don't know this action" reply would
 * look like an ordinary failure. Here the raw reply is observed and mapped to ProductUnsupportedError.
 */
import { DELEGATE_UNSUPPORTED_CODES } from "../contract.js";
import { DeskError } from "../errors.js";
import { callDelegate, type DelegateOptions } from "../kernel/delegate.js";
import { defaultDeps, type Deps } from "../connectors/deps.js";
import { ProductUnsupportedError } from "./errors.js";

export interface ObservedReply { status: number; code?: string; message?: string }

const UNKNOWN_ACTION_TEXT = /\b(unknown|unsupported|unrecognised|unrecognized)\s+action\b|action\b.*\bnot (supported|implemented|recognised|recognized)\b|\bnot implemented\b/i;

/** True when the product answered that it does not implement the requested action. Pure. */
export function isUnsupportedReply(r: ObservedReply): boolean {
  if (r.status === 501) return true;
  if (r.code && (DELEGATE_UNSUPPORTED_CODES as readonly string[]).includes(r.code.toLowerCase())) return true;
  // Products that predate the contract answer an unknown action with a generic code and a telling message.
  return (r.code === "invalid_argument" || r.code === "not_found") && UNKNOWN_ACTION_TEXT.test(r.message ?? "");
}

export function makeProductDelegate(opts: DelegateOptions = {}): Deps["delegate"] {
  return async <T>(cfg: Parameters<Deps["delegate"]>[0], product: Parameters<Deps["delegate"]>[1], req: Parameters<Deps["delegate"]>[2]): Promise<T> => {
    let seen: ObservedReply | undefined;
    const base = opts.fetchImpl ?? fetch;
    const fetchImpl: typeof fetch = async (input, init) => {
      const res = await base(input, init);
      seen = { status: res.status };
      try {
        const json = (await res.clone().json()) as { ok?: unknown; error?: { code?: unknown; message?: unknown } };
        if (json && json.ok === false && json.error) {
          seen.code = typeof json.error.code === "string" ? json.error.code : undefined;
          seen.message = typeof json.error.message === "string" ? json.error.message : undefined;
        }
      } catch { /* not JSON: callDelegate reports it; the status alone is still checked */ }
      return res;
    };
    try {
      return await callDelegate<T>(cfg, product, req, { ...opts, fetchImpl });
    } catch (err) {
      if (err instanceof DeskError && seen && isUnsupportedReply(seen)) throw new ProductUnsupportedError(product);
      throw err;
    }
  };
}

/** Production wiring: everything from the connectors' defaults, with the observing delegate. Test doubles replace `delegate`. */
export function workspaceDeps(timeoutMs?: number): Deps {
  return { ...defaultDeps(), delegate: makeProductDelegate(timeoutMs ? { timeoutMs } : {}) };
}
