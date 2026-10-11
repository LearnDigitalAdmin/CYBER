import { useState } from "react";
import type { SessionView } from "../../api";
import { Card, EmptyState, Page, Stat, StatGrid } from "../../ui";
import { hasScope, useDeskSession } from "./lib/useDeskSession";
import { useEntityInfo } from "./lib/useEntityInfo";
import { EntityInfoNotice, ScopeNotice, SessionNotice } from "./lib/SessionNotice";
import { ReminderForm } from "./ReminderForm";
import { ScheduleForm } from "./ScheduleForm";

type Tab = "schedule" | "reminder";

export default function CommsScreen() {
  const s = useDeskSession();
  return (
    <Page title="Messages" subtitle="Schedule an SMS or send a reminder from the customer's own SMS credits.">
      {s.kind === "ready" ? <Ready session={s.session} /> : <SessionNotice state={s} />}
    </Page>
  );
}

function Ready({ session }: { session: SessionView }) {
  const entity = useEntityInfo(session.sessionId);
  const [tab, setTab] = useState<Tab>("schedule");
  if (entity.status !== "ready") return <EntityInfoNotice state={entity} />;
  const { info } = entity;
  if (info.audiences.length === 0) {
    return <EmptyState title="Nothing to message yet" body="This customer's account has no audiences to send to, so scheduling and reminders are not available." />;
  }
  const canSchedule = hasScope(session, "schedule");
  const canRemind = canSchedule && hasScope(session, "bulk_sms");
  return (
    <>
      <StatGrid>
        <Stat label="Customer plan" value={info.plan || "—"} />
        <Stat label="Customer SMS credits" value={info.creditsBalance.toLocaleString("en-KE")} />
        <Stat label="Audiences" value={info.audiences.length} />
      </StatGrid>
      <div role="tablist" aria-label="Messages" className="flex min-w-0 gap-2">
        {(["schedule", "reminder"] as const).map((t) => (
          <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`h-11 min-w-0 flex-1 rounded-xl px-4 text-sm font-semibold sm:flex-none ${tab === t ? "bg-blue-600 text-white" : "border border-gray-300 bg-white text-gray-800"}`}>
            {t === "schedule" ? "Schedule an SMS" : "Send a reminder"}
          </button>
        ))}
      </div>
      {/* key: switching customers or tabs never carries a half-filled form (or a stale quote) across. */}
      {tab === "schedule"
        ? canSchedule ? <ScheduleForm key={session.sessionId} sessionId={session.sessionId} audiences={info.audiences} /> : <ScopeNotice scope="Schedule" what="scheduling" />
        : canRemind ? <ReminderForm key={session.sessionId} sessionId={session.sessionId} audiences={info.audiences} /> : <ScopeNotice scope="Schedule and Bulk SMS" what="bulk reminders" />}
      <Card><p className="break-words text-xs text-gray-500">Customer: {session.entityKey}</p></Card>
    </>
  );
}
