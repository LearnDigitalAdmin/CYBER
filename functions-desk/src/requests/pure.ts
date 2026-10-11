/** Pure logic for desk requests: outbox validation, ids, state machine, SMS throttle, public-config hashing. No I/O. */
import { createHash } from "node:crypto";
import type { DeskConfig } from "../config.js";
import {
  DESK_TOP_CODE, REQUEST_CATEGORIES, type DeskPublicConfig, type Product, type RequestStatus,
} from "../contract.js";
import { normalizeKenyaPhone } from "../paystack/phone.js";
import type { DeskRequestDoc } from "../types.js";

export const SUBJECT_MAX = 120;
export const MESSAGE_MAX = 2000;
export const RESPONSE_MAX = 1000;
export const NAME_MAX = 80;
export const MAX_TARGET_CODES = 3;
export const SWEEP_PER_PRODUCT = 200;
export const LIST_MAX = 50;
export const SMS_MIN_GAP_MS = 60 * 60_000;
export type SweptProduct = Exclude<Product, "pms">;
export const SWEPT_PRODUCTS: readonly SweptProduct[] = ["chama", "school"];
/** Chama and Register keep an outbox that desk pulls and writes progress back to. Plot Yangu (pms) writes straight into desk's collection, so it has none. */
export const hasProductOutbox = (source: string): source is SweptProduct => source === "chama" || source === "school";

/** Request docs carry two backend-only fields beyond the shared type. */
export interface RequestDoc extends DeskRequestDoc { writeBackPending?: boolean; lastSmsAt?: number }

const DESK_CODE = /^COG-\d{4,}$/;
const ENTITY_CODE = /^[A-Za-z0-9-]{3,40}$/;

/** Strips control characters, collapses runs of spaces/tabs, trims. */
export function cleanText(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/[ \t]+/g, " ").trim();
}
const clip = (s: string, n: number): string => (s.length > n ? s.slice(0, n).trimEnd() : s);

/** Epoch ms from a number or a Firestore Timestamp-like value; undefined when neither. */
export function toMillis(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  const t = v as { toMillis?: () => number } | null;
  if (t && typeof t.toMillis === "function") { const n = t.toMillis(); return Number.isFinite(n) ? n : undefined; }
  return undefined;
}

/** 1–3 valid desk codes (upper-cased, de-duplicated, in order). None valid -> the top desk. */
export function normaliseDeskCodes(v: unknown): string[] {
  const out: string[] = [];
  if (Array.isArray(v)) {
    for (const c of v) {
      if (typeof c !== "string") continue;
      const code = c.trim().toUpperCase();
      if (DESK_CODE.test(code) && !out.includes(code)) out.push(code);
      if (out.length === MAX_TARGET_CODES) break;
    }
  }
  return out.length > 0 ? out : [DESK_TOP_CODE];
}

export interface CleanItem {
  entityCode: string; entityName: string; requesterName: string; requesterPhone: string;
  category: string; subject: string; message: string; targetDeskCodes: string[]; createdAt: number;
}
export type ItemCheck = { ok: true; item: CleanItem } | { ok: false; error: string };

/**
 * Strict validation of one product outbox item. Over-long subject/message are cut to the limit (the customer's request is not
 * thrown away for being wordy); anything structurally wrong is rejected with a reason and never retried.
 */
export function sanitiseOutboxItem(raw: unknown, now: number): ItemCheck {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "Item is not an object" };
  const d = raw as Record<string, unknown>;
  if (d.kind !== "support") return { ok: false, error: "Unknown item kind" };
  const entityCode = typeof d.entityCode === "string" ? d.entityCode.trim().toUpperCase() : "";
  if (!ENTITY_CODE.test(entityCode)) return { ok: false, error: "Invalid entity code" };
  const subject = clip(cleanText(d.subject), SUBJECT_MAX);
  if (!subject) return { ok: false, error: "Subject is empty" };
  const message = clip(cleanText(d.message), MESSAGE_MAX);
  if (!message) return { ok: false, error: "Message is empty" };
  let requesterPhone: string;
  try { requesterPhone = normalizeKenyaPhone(typeof d.requesterPhone === "string" ? d.requesterPhone : ""); }
  catch { return { ok: false, error: "Invalid requester phone" }; }
  const requesterName = clip(cleanText(d.requesterName), NAME_MAX);
  if (!requesterName) return { ok: false, error: "Requester name is empty" };
  const category = typeof d.category === "string" && (REQUEST_CATEGORIES as readonly string[]).includes(d.category.trim())
    ? d.category.trim() : "other";
  return {
    ok: true,
    item: {
      entityCode, entityName: clip(cleanText(d.entityName), SUBJECT_MAX) || entityCode, requesterName, requesterPhone,
      category, subject, message, targetDeskCodes: normaliseDeskCodes(d.targetDeskCodes), createdAt: toMillis(d.createdAt) ?? now,
    },
  };
}

/** `<product>_<entityCode>_<itemId>`: re-pulling the same item can only hit the same document. */
export const requestDocId = (product: Product, entityCode: string, itemId: string): string => `${product}_${entityCode}_${itemId}`;

/** new -> open|answered|closed; open -> answered|closed; answered -> answered (follow-up) | closed; closed is final. */
const NEXT: Record<RequestStatus, readonly RequestStatus[]> = {
  new: ["open", "answered", "closed"], open: ["answered", "closed"], answered: ["answered", "closed"], closed: [],
};
export const canTransition = (from: RequestStatus, to: RequestStatus): boolean => NEXT[from].includes(to);
export const REQUEST_STATUSES: readonly RequestStatus[] = ["new", "open", "answered", "closed"];

/** True when the requester has not been texted about this request within the last hour. */
export const smsAllowed = (lastSmsAt: number | undefined, now: number): boolean => !lastSmsAt || now - lastSmsAt >= SMS_MIN_GAP_MS;

export function replySmsText(subject: string, response: string): string {
  const s = subject.length > 40 ? `${subject.slice(0, 39).trimEnd()}.` : subject;
  const r = response.length > 160 ? `${response.slice(0, 159).trimEnd()}.` : response;
  return `Samuhia Desk: reply to your request "${s}": ${r} Open the app for the full thread.`;
}

/** The rates products need. `updatedAt` is excluded from the hash so an unchanged config is never re-pushed. */
export function buildPublicConfig(cfg: DeskConfig, now: number): DeskPublicConfig {
  return {
    creditCostMinor: cfg.creditCostMinor, expectedPaystackFeePct: cfg.expectedPaystackFeePct,
    smsShareOfMarginPct: cfg.smsShareOfMarginPct, firstPurchaseThresholdMinor: cfg.firstPurchaseThresholdMinor,
    subShareByRank: { ...cfg.subShareByRank }, reportShareByRank: { ...cfg.reportShareByRank }, updatedAt: now,
  };
}
export function hashPublicConfig(p: DeskPublicConfig): string {
  const { updatedAt: _u, ...rest } = p;
  const stable = (o: unknown): unknown => o && typeof o === "object" && !Array.isArray(o)
    ? Object.fromEntries(Object.entries(o as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, stable(v)]))
    : o;
  return createHash("sha256").update(JSON.stringify(stable(rest))).digest("hex");
}

export const parseLimit = (v: unknown): number => {
  const n = typeof v === "number" && Number.isInteger(v) ? v : LIST_MAX;
  return Math.min(Math.max(n, 1), LIST_MAX);
};
