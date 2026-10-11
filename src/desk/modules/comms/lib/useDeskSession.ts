import { useEffect, useState } from "react";
import { watchSession, type Scope, type SessionView } from "../../../api";
import { useActiveSession } from "./access";

export type SessionState =
  | { kind: "none" }
  | { kind: "loading" }
  | { kind: "closed"; reason: "missing" | "pending" | "ended" | "expired" }
  | { kind: "ready"; session: SessionView };

/** Pure: what a session document means for the screen, given the clock. */
export function describeSession(view: SessionView | null | undefined, now: number): SessionState {
  if (view === undefined) return { kind: "loading" };
  if (view === null) return { kind: "closed", reason: "missing" };
  if (view.status === "pending") return { kind: "closed", reason: "pending" };
  if (view.status === "ended") return { kind: "closed", reason: "ended" };
  if (view.status === "expired" || view.expiresAt <= now) return { kind: "closed", reason: "expired" };
  return { kind: "ready", session: view };
}

export const hasScope = (s: SessionView, scope: Scope): boolean => s.scopes.includes(scope);

/** The agent's active customer session, live: ends the moment it is ended or expires. */
export function useDeskSession(): SessionState {
  const { sessionId } = useActiveSession();
  const [view, setView] = useState<SessionView | null | undefined>(undefined);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setView(undefined);
    if (!sessionId) return;
    return watchSession(sessionId, setView);
  }, [sessionId]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);
  if (!sessionId) return { kind: "none" };
  return describeSession(view, now);
}
