import { Link } from "react-router-dom";
import { Card, EmptyState, buttonClass } from "../../../ui";
import type { EntityInfoState } from "./useEntityInfo";
import type { SessionState } from "./useDeskSession";

const OPEN_ACCESS = <Link to="/desk/access" className={buttonClass.primary}>Open customer access</Link>;

/** Shown instead of a workspace screen whenever there is no usable customer session. */
export function SessionNotice({ state }: { state: Exclude<SessionState, { kind: "ready" }> }) {
  if (state.kind === "loading") return <p className="py-10 text-center text-sm text-gray-500" role="status">Checking your customer session…</p>;
  const copy = state.kind === "none"
    ? { title: "No customer session", body: "Open a customer's account first. Their admin confirms with a one-time code, then this screen unlocks." }
    : state.reason === "pending"
      ? { title: "Waiting for the customer's code", body: "This session isn't confirmed yet. Enter the code the customer received on the Access screen." }
      : state.reason === "missing"
        ? { title: "Session not found", body: "That session no longer exists. Open the customer's account again." }
        : { title: state.reason === "ended" ? "Session ended" : "Session expired", body: "Open the customer's account again to continue." };
  return <EmptyState title={copy.title} body={copy.body} action={OPEN_ACCESS} />;
}

/** Entity-info loading and failure, so every screen handles them the same way. Returns null once the info is ready. */
export function EntityInfoNotice({ state }: { state: EntityInfoState }) {
  if (state.status === "ready") return null;
  if (state.status === "loading") return <p className="py-10 text-center text-sm text-gray-500" role="status">Loading what this customer's plan offers…</p>;
  return (
    <Card>
      <p role="alert" className="break-words text-sm text-red-700">{state.message}</p>
      <button type="button" onClick={state.retry} className={`${buttonClass.secondary} mt-3`}>Try again</button>
    </Card>
  );
}

export function ScopeNotice({ scope, what }: { scope: string; what: string }) {
  return (
    <EmptyState
      title={`This session doesn't include ${what}`}
      body={`Open the customer's account again and tick “${scope}” when choosing what you need.`}
      action={OPEN_ACCESS}
    />
  );
}
