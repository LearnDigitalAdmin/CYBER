/** Pure input/output hygiene for the workspace callables. Nothing here touches Firestore or the network. */
import { createHash } from "node:crypto";
import {
  EXPORT_KINDS, TENANT_PAGE_SIZE,
  type GetEntityInfoOut, type ReportParamValue, type TenantRow,
} from "../contract.js";
import { DeskError } from "../errors.js";
import { maskPhone, normalizeKenyaPhone } from "../paystack/phone.js";
import { EntityOfferError, type OfferKind } from "./errors.js";

const isStr = (v: unknown): v is string => typeof v === "string";
const cleanList = (v: unknown, maxItems: number, maxLen: number): string[] => {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    if (!isStr(item)) continue;
    const t = item.trim();
    if (t && t.length <= maxLen && !out.includes(t)) out.push(t);
    if (out.length >= maxItems) break;
  }
  return out;
};

/** The product's entity_info reduced to what the agent may see. Admin name and phone never leave the server. */
export function normaliseEntityInfo(info: unknown): GetEntityInfoOut {
  const o = (info && typeof info === "object" ? info : {}) as Record<string, unknown>;
  const credits = typeof o.creditsBalance === "number" && Number.isFinite(o.creditsBalance) && o.creditsBalance >= 0 ? Math.floor(o.creditsBalance) : 0;
  return {
    plan: isStr(o.plan) ? o.plan.trim().slice(0, 60) : "",
    creditsBalance: credits,
    audiences: cleanList(o.audiences, 50, 80),
    reportTypes: cleanList(o.reportTypes, 50, 80),
    exportKinds: cleanList(o.exportKinds, 20, 40),
  };
}

/** The entity must offer what was asked for; checked BEFORE anything is delegated or consumed. */
export function requireOffered(kind: OfferKind, value: string, offered: readonly string[]): void {
  if (!offered.includes(value)) throw new EntityOfferError(kind, value);
}

export function cleanReportType(v: unknown): string {
  if (!isStr(v) || !v.trim() || v.trim().length > 80) throw new DeskError("invalid_argument", "Choose a report to run");
  return v.trim();
}

const PARAM_KEY = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
const MAX_PARAMS = 20;
const MAX_PARAM_JSON = 4000;
const primitive = (x: unknown): x is string | number | boolean | null =>
  x === null || typeof x === "boolean" || (typeof x === "number" && Number.isFinite(x)) || (isStr(x) && x.length <= 200);

/** Flat parameters only. What they mean is the product's business; desk only keeps them small and well-formed. */
export function cleanReportParams(v: unknown): Record<string, ReportParamValue> {
  if (v === undefined || v === null) return {};
  if (typeof v !== "object" || Array.isArray(v)) throw new DeskError("invalid_argument", "The report options are not valid");
  const entries = Object.entries(v as Record<string, unknown>);
  if (entries.length > MAX_PARAMS) throw new DeskError("invalid_argument", `A report can have at most ${MAX_PARAMS} options`);
  const out: Record<string, ReportParamValue> = {};
  for (const [key, val] of entries) {
    if (!PARAM_KEY.test(key)) throw new DeskError("invalid_argument", `"${key.slice(0, 40)}" is not a valid report option name`);
    if (Array.isArray(val)) {
      if (val.length > 50 || !val.every(primitive)) throw new DeskError("invalid_argument", `The report option "${key}" is not valid`);
      out[key] = val as ReportParamValue;
    } else if (primitive(val)) {
      out[key] = val;
    } else {
      throw new DeskError("invalid_argument", `The report option "${key}" is not valid`);
    }
  }
  if (JSON.stringify(out).length > MAX_PARAM_JSON) throw new DeskError("invalid_argument", "The report options are too long");
  return out;
}

const stable = (v: unknown): string => {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stable(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
};
const sha = (s: string): string => createHash("sha256").update(s).digest("hex").slice(0, 32);
const CLIENT_REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;
export const REPORT_DEDUPE_WINDOW_MS = 60_000;

/**
 * Idempotency key for a report run. A client-supplied id is scoped to the session so one agent cannot collide with another.
 * Without one, identical runs inside the same minute share a key, so a double tap cannot charge the customer's credits twice.
 */
export function reportRequestId(a: { sessionId: string; reportType: string; params: Record<string, ReportParamValue>; requestId?: unknown; now: number }): string {
  if (a.requestId !== undefined && a.requestId !== null) {
    if (!isStr(a.requestId) || !CLIENT_REQUEST_ID.test(a.requestId)) throw new DeskError("invalid_argument", "The request id is not valid");
    return `rpt_${sha(`${a.sessionId}|${a.requestId}`)}`;
  }
  return `rpt_${sha(`${a.sessionId}|${a.reportType}|${stable(a.params)}|${Math.floor(a.now / REPORT_DEDUPE_WINDOW_MS)}`)}`;
}

export const exportRequestId = (actionId: string): string => `exp_${actionId}`;

export function cleanExportKind(v: unknown): string {
  const kind = isStr(v) ? v.trim() : "";
  if (!(EXPORT_KINDS as readonly string[]).includes(kind)) throw new DeskError("invalid_argument", "Choose what to export");
  return kind;
}

export const MAX_LINK_LIFETIME_MS = 15 * 60_000;
export interface FileResult { downloadUrl: string; expiresAt: number }

/** A download link must be https and still valid; anything else is refused rather than handed to the agent. */
export function validateFileResult(raw: unknown, now: number): FileResult {
  const bad = new DeskError("internal", "The customer's service returned an invalid download link. Please try again.");
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (!isStr(o.downloadUrl) || o.downloadUrl.length > 2048) throw bad;
  let url: URL;
  try { url = new URL(o.downloadUrl); } catch { throw bad; }
  if (url.protocol !== "https:") throw bad;
  if (typeof o.expiresAt !== "number" || !Number.isFinite(o.expiresAt) || o.expiresAt <= now) throw bad;
  return { downloadUrl: url.toString(), expiresAt: Math.floor(o.expiresAt) };
}

export function cleanTenantQuery(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (!isStr(v)) throw new DeskError("invalid_argument", "The search text is not valid");
  const t = v.trim();
  if (!t) return undefined;
  if (t.length > 60) throw new DeskError("invalid_argument", "The search text is too long");
  return t;
}
export function cleanCursor(v: unknown): string | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  if (!isStr(v) || v.length > 300) throw new DeskError("invalid_argument", "The page marker is not valid");
  return v;
}

/** The product is asked for masked phones; if one ever arrives unmasked it is masked here, never passed on. */
export function ensureMasked(phone: unknown): string {
  const raw = isStr(phone) ? phone.trim().slice(0, 40) : "";
  if (!raw) return "•••";
  if (!/\d{7,}/.test(raw.replace(/[\s-]/g, ""))) return raw;
  try { return maskPhone(normalizeKenyaPhone(raw)); } catch { return "•••"; }
}

export interface TenantsPage { tenants: TenantRow[]; nextCursor?: string; dropped: number }
/** Rows the UI cannot use (no id or name) are dropped and counted; rent amounts must be whole minor units. */
export function cleanTenantsPage(raw: unknown): TenantsPage {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const rows = Array.isArray(o.tenants) ? o.tenants : [];
  const tenants: TenantRow[] = [];
  const seen = new Set<string>();
  let dropped = 0;
  for (const r of rows.slice(0, TENANT_PAGE_SIZE)) {
    const t = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
    const id = isStr(t.tenantId) ? t.tenantId.trim() : "";
    const name = isStr(t.name) ? t.name.trim().slice(0, 120) : "";
    if (!id || id.length > 120 || !name || seen.has(id)) { dropped++; continue; }
    seen.add(id);
    const row: TenantRow = { tenantId: id, name, unit: isStr(t.unit) ? t.unit.trim().slice(0, 60) : "", phoneMasked: ensureMasked(t.phoneMasked) };
    if (typeof t.rentDueMinor === "number" && Number.isSafeInteger(t.rentDueMinor) && t.rentDueMinor >= 0) row.rentDueMinor = t.rentDueMinor;
    tenants.push(row);
  }
  dropped += Math.max(0, rows.length - TENANT_PAGE_SIZE);
  const cursor = isStr(o.nextCursor) && o.nextCursor && o.nextCursor.length <= 300 ? o.nextCursor : undefined;
  return { tenants, ...(cursor && tenants.length > 0 ? { nextCursor: cursor } : {}), dropped };
}
