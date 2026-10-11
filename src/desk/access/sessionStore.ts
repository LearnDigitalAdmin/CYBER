/**
 * The browser-tab's active customer session. Lives in sessionStorage so it survives a refresh but never leaks to
 * another tab or outlives the tab. The server stays the authority: this only remembers which session to use.
 */
import type { EntityKey, Scope } from "../api/contract";

export interface StoredSession {
  sessionId: string;
  entityKey: EntityKey;
  displayName: string;
  scopes: Scope[];
  expiresAt: number;
}

const KEY = "desk.activeSession.v1";
const listeners = new Set<() => void>();

let memoryRaw: string | null = null; // used when sessionStorage is unavailable (private mode, blocked storage)
let cachedRaw: string | null | undefined;
let cachedValue: StoredSession | null = null;

function readRaw(): string | null {
  try { return window.sessionStorage.getItem(KEY); } catch { return memoryRaw; }
}
function writeRaw(raw: string | null): void {
  memoryRaw = raw;
  try {
    if (raw === null) window.sessionStorage.removeItem(KEY);
    else window.sessionStorage.setItem(KEY, raw);
  } catch { /* memory copy above is the fallback */ }
}

export function isStoredSession(v: unknown): v is StoredSession {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  return typeof s.sessionId === "string" && s.sessionId.length > 0
    && typeof s.entityKey === "string" && s.entityKey.length > 0
    && typeof s.displayName === "string"
    && Array.isArray(s.scopes) && s.scopes.every((x) => typeof x === "string")
    && typeof s.expiresAt === "number" && Number.isFinite(s.expiresAt);
}

/** Stable snapshot for useSyncExternalStore: the same object is returned until the stored text changes. */
export function getStoredSession(): StoredSession | null {
  const raw = readRaw();
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    cachedValue = isStoredSession(parsed) ? parsed : null;
  } catch { cachedValue = null; }
  return cachedValue;
}

function emit(): void { listeners.forEach((l) => l()); }

export function setStoredSession(s: StoredSession): void { writeRaw(JSON.stringify(s)); emit(); }

/** Only clears when `sessionId` still matches, so a late callback for an old session cannot wipe a newer one. */
export function clearStoredSession(sessionId?: string): void {
  const cur = getStoredSession();
  if (sessionId && cur && cur.sessionId !== sessionId) return;
  if (readRaw() === null) return;
  writeRaw(null); emit();
}

export function subscribeStoredSession(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
