import { useEffect, useState, useSyncExternalStore } from "react";
import { watchSession } from "../api/watch";
import type { SessionView } from "../api/contract";
import { clearStoredSession, getStoredSession, subscribeStoredSession } from "./sessionStore";
import type { StoredSession } from "./sessionStore";

/** Re-renders every `everyMs` so countdowns stay live. */
export function useNow(everyMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), everyMs);
    return () => window.clearInterval(t);
  }, [everyMs]);
  return now;
}

/** The stored session for this tab, auto-dropped as soon as the server ends or expires it, or its time runs out. */
function useStoredSession(): StoredSession | null {
  const stored = useSyncExternalStore(subscribeStoredSession, getStoredSession, () => null);
  const id = stored?.sessionId;
  const expiresAt = stored?.expiresAt;

  useEffect(() => {
    if (!id) return;
    // A missing document is NOT treated as "ended" (an offline cold start can look the same); explicit states are.
    return watchSession(id, (s) => {
      if (s && (s.status === "ended" || s.status === "expired")) clearStoredSession(id);
    });
  }, [id]);

  useEffect(() => {
    if (!id || !expiresAt) return;
    const left = expiresAt - Date.now();
    if (left <= 0) { clearStoredSession(id); return; }
    // setTimeout caps near 24.8 days; sessions last an hour, but stay safe.
    const t = window.setTimeout(() => clearStoredSession(id), Math.min(left, 2_000_000_000));
    return () => window.clearTimeout(t);
  }, [id, expiresAt]);

  return stored && stored.expiresAt > Date.now() ? stored : null;
}

/**
 * Signature fixed by the build plan (W1-E codes against it). Both ids are null when no verified session is open
 * in this tab.
 */
export function useActiveSession(): { sessionId: string | null; entityKey: string | null } {
  const s = useStoredSession();
  return { sessionId: s?.sessionId ?? null, entityKey: s?.entityKey ?? null };
}

/** Richer view for screens that need the customer name, scopes or time left. */
export function useActiveSessionDetail(): StoredSession | null {
  return useStoredSession();
}

/** Live server copy of a session (status, scopes, expiry). `undefined` while loading, `null` if missing/unreadable. */
export function useSessionView(sessionId: string | null): SessionView | null | undefined {
  const [state, setState] = useState<{ id: string | null; view: SessionView | null | undefined }>({ id: null, view: undefined });
  useEffect(() => {
    if (!sessionId) return;
    return watchSession(sessionId, (v) => setState({ id: sessionId, view: v }));
  }, [sessionId]);
  if (!sessionId) return null;
  return state.id === sessionId ? state.view : undefined;
}
