import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Badge, Card, EmptyState, buttonClass } from "../ui";
import type { AgentView, Scope, SessionView } from "../api";
import { useAgent } from "../core/useAgent";
import { useActiveSessionDetail, useNow, useSessionView } from "./useActiveSession";
import type { StoredSession } from "./sessionStore";
import { formatClock } from "./time";
import { SCOPE_LABEL } from "./scopes";

export const Spinner = () => (
  <div className="flex min-h-[30vh] items-center justify-center" role="status" aria-label="Loading">
    <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
  </div>
);

/** Renders children only for an `active` desk agent; everyone else gets a clear next step. */
export function AgentGate({ children }: { children: (agent: AgentView) => ReactNode }) {
  const agent = useAgent();
  if (agent === undefined) return <Spinner />;
  if (agent === null) {
    return (
      <EmptyState title="You are not a desk agent yet" body="Apply to become a Samuhia desk agent to serve customers."
        action={<Link to="/desk/onboarding" className={buttonClass.primary}>Start your application</Link>} />
    );
  }
  if (agent.status !== "active") {
    return (
      <EmptyState title={`Your desk is ${agent.status}`}
        body="Customer tools open once Samuhia has activated your desk. See your onboarding page for what happens next."
        action={<Link to="/desk/onboarding" className={buttonClass.primary}>View my status</Link>} />
    );
  }
  return <>{children(agent)}</>;
}

/** Live "who am I serving" strip for screens that work inside a session. */
export function SessionBar({ session }: { session: StoredSession }) {
  const now = useNow(1000);
  const left = session.expiresAt - now;
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
      <span className="min-w-0 break-words font-semibold text-emerald-900">{session.displayName}</span>
      <span className="min-w-0 break-all text-emerald-800">{session.entityKey.split(":")[1]}</span>
      <span className="text-emerald-800">· {left > 0 ? `${formatClock(left)} left` : "expired"}</span>
      <Link to="/desk/access" className="ml-auto text-sm font-medium text-emerald-900 underline">Manage session</Link>
    </div>
  );
}

/**
 * Renders children only while this tab has a verified session that allows `scope`. The server re-checks every call;
 * this only keeps people from walking into an error.
 */
export function SessionGate({ scope, children }: {
  scope: Scope; children: (session: StoredSession, view: SessionView | null | undefined) => ReactNode;
}) {
  const session = useActiveSessionDetail();
  const view = useSessionView(session?.sessionId ?? null);
  if (!session) {
    return (
      <EmptyState title="Open a customer session first"
        body="Ask the customer for permission, then open a session with their OTP."
        action={<Link to="/desk/access" className={buttonClass.primary}>Open a session</Link>} />
    );
  }
  const scopes = view?.scopes ?? session.scopes;
  if (!scopes.includes(scope)) {
    return (
      <Card title="This session does not allow that">
        <p className="break-words text-sm text-gray-700">
          The session with {session.displayName} was opened without “{SCOPE_LABEL[scope]}”. End it and open a new one with that option ticked.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {scopes.map((s) => <Badge key={s} tone="gray">{SCOPE_LABEL[s]}</Badge>)}
        </div>
        <Link to="/desk/access" className={`${buttonClass.primary} mt-4`}>Go to Access</Link>
      </Card>
    );
  }
  return <>{children(session, view)}</>;
}
