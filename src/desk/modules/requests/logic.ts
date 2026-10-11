/** Pure helpers for the Requests screens (no React, no network). */
import type { RequestStatus, RequestView } from "../../api/contract";

export const REQUEST_STATUSES: readonly RequestStatus[] = ["new", "open", "answered", "closed"];
export type StatusFilter = RequestStatus | "all";
export const FILTERS: readonly { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" }, { value: "new", label: "New" }, { value: "open", label: "Open" },
  { value: "answered", label: "Answered" }, { value: "closed", label: "Closed" },
];

export const PAGE_SIZE = 50;
export const REPLY_MAX = 1000;
export const SUBJECT_MAX = 120;
export const MESSAGE_MAX = 2000;
export const REFRESH_MS = 60_000;

export const STATUS_LABEL: Record<RequestStatus, string> = { new: "New", open: "Open", answered: "Answered", closed: "Closed" };
export const STATUS_TONE: Record<RequestStatus, "blue" | "amber" | "green" | "gray"> = {
  new: "blue", open: "amber", answered: "green", closed: "gray",
};

export const SOURCE_LABEL: Record<RequestView["source"], string> = {
  chama: "MyChama", school: "MyRegister", pms: "Plot Yangu", desk: "Desk",
};

export const CATEGORY_LABEL: Record<string, string> = {
  setup: "Setup", import: "Import", sms: "SMS", payments: "Payments", reports: "Reports", account: "Account", other: "Other",
};
export const categoryLabel = (c: string): string => CATEGORY_LABEL[c] ?? (c ? c.charAt(0).toUpperCase() + c.slice(1) : "Other");

/** Which status actions make sense from the current status. */
export interface StatusAction { to: RequestStatus; label: string }
export function statusActions(from: RequestStatus): StatusAction[] {
  switch (from) {
    case "new": return [{ to: "open", label: "Mark as open" }, { to: "closed", label: "Close" }];
    case "open": return [{ to: "closed", label: "Close" }];
    case "answered": return [{ to: "open", label: "Reopen" }, { to: "closed", label: "Close" }];
    case "closed": return [{ to: "open", label: "Reopen" }];
  }
}

export type ValidationResult = { ok: true; value: string } | { ok: false; error: string };

export function validateReply(text: string): ValidationResult {
  const t = text.trim();
  if (!t) return { ok: false, error: "Write a reply first." };
  if (t.length > REPLY_MAX) return { ok: false, error: `Keep the reply under ${REPLY_MAX} characters.` };
  return { ok: true, value: t };
}

export interface NewRequestDraft { category: string; subject: string; message: string }
export interface NewRequestErrors { category?: string; subject?: string; message?: string }
export function validateNewRequest(d: NewRequestDraft, categories: readonly string[]): { ok: boolean; errors: NewRequestErrors; value: NewRequestDraft } {
  const errors: NewRequestErrors = {};
  const subject = d.subject.trim().replace(/\s+/g, " ");
  const message = d.message.trim();
  if (!categories.includes(d.category)) errors.category = "Choose a topic.";
  if (subject.length < 4) errors.subject = "Give a short subject (at least 4 characters).";
  else if (subject.length > SUBJECT_MAX) errors.subject = `Keep the subject under ${SUBJECT_MAX} characters.`;
  if (message.length < 10) errors.message = "Tell us a little more (at least 10 characters).";
  else if (message.length > MESSAGE_MAX) errors.message = `Keep the message under ${MESSAGE_MAX} characters.`;
  return { ok: Object.keys(errors).length === 0, errors, value: { category: d.category, subject, message } };
}

/** Newest first, de-duplicated by id (a later copy wins). */
export function mergeRequests(existing: RequestView[], incoming: RequestView[]): RequestView[] {
  const map = new Map<string, RequestView>();
  for (const r of existing) map.set(r.id, r);
  for (const r of incoming) map.set(r.id, r);
  return [...map.values()].sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id));
}

/**
 * A background refresh re-reads page one. If it came back short it IS the whole list, so it replaces everything (rows that
 * changed status or vanished disappear). If it came back full, only the rows older than it are kept from before.
 */
export function replaceHead(existing: RequestView[], head: RequestView[], pageSize: number): RequestView[] {
  if (head.length < pageSize) return mergeRequests([], head);
  const oldest = Math.min(...head.map((r) => r.createdAt));
  return mergeRequests(existing.filter((r) => r.createdAt < oldest), head);
}

/** The cursor for the next page: the oldest createdAt we hold. */
export const nextCursor = (rows: RequestView[]): number | undefined =>
  rows.length ? Math.min(...rows.map((r) => r.createdAt)) : undefined;

/** The response thread, oldest first. */
export const sortedThread = (r: RequestView) => [...r.responses].sort((a, b) => a.at - b.at);

/** "just now", "5 min ago", "3 h ago", "2 d ago", else a date. */
export function timeAgo(ms: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`;
  if (s < 7 * 86_400) return `${Math.round(s / 86_400)} d ago`;
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(new Date(ms));
}

/** Local patch that keeps the open sheet correct until the next server refresh replaces it. */
export function applyLocalUpdate(r: RequestView, status: RequestStatus, response: { text: string; byDeskCode: string; at: number } | undefined): RequestView {
  return { ...r, status, responses: response ? [...r.responses, response] : r.responses, updatedAt: response?.at ?? r.updatedAt };
}
