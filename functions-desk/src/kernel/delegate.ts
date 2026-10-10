/**
 * Client for each product's private `deskDelegate` function. Desk never writes product data itself: the product runs its
 * OWN validation, limits, credit accounting and engines. Callers must have passed requireSession() first.
 * Auth: Cloud Run IAM. The CYBER compute service account is the only invoker; we send a Google ID token for the function URL.
 */
import { GoogleAuth } from "google-auth-library";
import { randomUUID } from "node:crypto";
import type { DeskConfig } from "../config.js";
import type { DelegateRequest, DelegateResponse, Product } from "../contract.js";
import { DeskError } from "../errors.js";

export interface DelegateOptions {
  /** Override for tests. Default: Google ID token for the audience via the runtime service account. */
  getIdToken?: (audience: string) => Promise<string>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export function delegateUrl(cfg: DeskConfig, product: Product): string {
  const raw = (cfg.delegate[product] ?? "").trim();
  if (!raw) throw new DeskError("failed_precondition", `The ${product} service is not connected yet`);
  let u: URL;
  try { u = new URL(raw); } catch { throw new DeskError("failed_precondition", `The ${product} service address is invalid`); }
  const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
  if (u.protocol !== "https:" && !(local && u.protocol === "http:")) throw new DeskError("failed_precondition", `The ${product} service must use https`);
  return u.toString();
}

/**
 * ID-token audience: Cloud Run / 2nd-gen functions on *.run.app use the service origin; a cloudfunctions.net URL uses the
 * full function URL. Query and hash never count.
 */
export function delegateAudience(url: string): string {
  const u = new URL(url);
  return u.hostname.endsWith(".run.app") ? u.origin : `${u.origin}${u.pathname}`;
}

const auth = new GoogleAuth();
async function defaultIdToken(audience: string): Promise<string> {
  const client = await auth.getIdTokenClient(audience);
  return client.idTokenProvider.fetchIdToken(audience);
}

export async function callDelegate<T>(
  cfg: DeskConfig, product: Product,
  req: Omit<DelegateRequest, "requestId"> & { requestId?: string },
  opts: DelegateOptions = {},
): Promise<T> {
  const url = delegateUrl(cfg, product);
  const body: DelegateRequest = { ...req, requestId: req.requestId ?? randomUUID() };
  const doFetch = opts.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 60_000);
  let res: Response;
  try {
    const token = await (opts.getIdToken ?? defaultIdToken)(delegateAudience(url));
    res = await doFetch(url, {
      method: "POST", signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new DeskError("internal", `Could not reach the ${product} service. Please try again.`);
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 401 || res.status === 403) throw new DeskError("permission_denied", `The ${product} service refused desk access`);
  let json: DelegateResponse<T>;
  try { json = (await res.json()) as DelegateResponse<T>; } catch {
    throw new DeskError("internal", `The ${product} service returned an unreadable response`);
  }
  if (!json || typeof json !== "object" || !("ok" in json)) throw new DeskError("internal", `The ${product} service returned an unexpected response`);
  if (json.ok) return json.result;
  const code = json.error.code === "invalid_argument" ? "invalid_argument"
    : json.error.code === "permission_denied" ? "permission_denied"
    : json.error.code === "not_found" ? "not_found" : "failed_precondition";
  throw new DeskError(code, json.error.message);
}
