import { useState } from "react";
import { deskApi, summaryRentStk, type SessionView } from "../../api";
import { Card, EmptyState, Page, buttonClass } from "../../ui";
import { ActionOtpDialog } from "../comms/lib/access";
import { messageOf } from "../comms/lib/messages";
import { hasScope, useDeskSession } from "../comms/lib/useDeskSession";
import { ScopeNotice, SessionNotice } from "../comms/lib/SessionNotice";
import { BatchResults } from "./BatchResults";
import { MAX_TENANTS, type Selection } from "./rentLogic";
import { TenantPicker } from "./TenantPicker";
import { clearBatch, loadBatch, saveBatch, type SavedBatch } from "./useRentBatch";

export default function RentScreen() {
  const s = useDeskSession();
  return (
    <Page title="Rent collection" subtitle="Send M-PESA rent prompts to a landlord's tenants.">
      {s.kind === "ready" ? <Ready session={s.session} /> : <SessionNotice state={s} />}
    </Page>
  );
}

function Ready({ session }: { session: SessionView }) {
  // Rent collection exists only for Plot Yangu landlords: for anyone else the actions are not shown.
  if (!session.entityKey.startsWith("pms:")) return <EmptyState title="Not available for this customer" body="Rent collection is only for Plot Yangu (landlord) accounts." />;
  if (!hasScope(session, "rent_stk")) return <ScopeNotice scope="Rent STK" what="rent collection" />;
  return <Collect key={session.sessionId} session={session} />;
}

function Collect({ session }: { session: SessionView }) {
  const [selection, setSelection] = useState<Selection>(new Map());
  const [saved, setSaved] = useState<SavedBatch | null>(() => loadBatch());
  const [otpOpen, setOtpOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const count = selection.size;

  async function send(actionId: string) {
    const tenants = [...selection.values()];
    setBusy(true); setError(null);
    try {
      const out = await deskApi.initiateRentStk({ sessionId: session.sessionId, actionId, tenantIds: tenants.map((t) => t.tenantId) });
      const batch: SavedBatch = { batchId: out.batchId, names: Object.fromEntries(tenants.map((t) => [t.tenantId, `${t.name}${t.unit ? ` (${t.unit})` : ""}`])) };
      saveBatch(batch); setSaved(batch); setSelection(new Map());
    } catch (e) { setError(messageOf(e)); }
    finally { setBusy(false); }
  }

  if (saved) return <BatchResults batchId={saved.batchId} names={saved.names} onDone={() => { clearBatch(); setSaved(null); }} />;
  return (
    <>
      <TenantPicker sessionId={session.sessionId} selection={selection} onSelection={setSelection} />
      <Card>
        <div className="min-w-0 space-y-3">
          <p className="break-words text-sm text-gray-800" aria-live="polite"><span className="font-semibold">{count}</span> of {MAX_TENANTS} tenants selected</p>
          {error && <p role="alert" className="break-words text-sm text-red-700">{error}</p>}
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
            <button type="button" className={buttonClass.primary} disabled={count === 0 || busy} onClick={() => setOtpOpen(true)}>
              {busy ? "Sending…" : count === 0 ? "Choose tenants first" : `Get landlord approval for ${count} tenant${count === 1 ? "" : "s"}`}
            </button>
            {count > 0 && <button type="button" className={buttonClass.secondary} disabled={busy} onClick={() => setSelection(new Map())}>Clear selection</button>}
          </div>
          <p className="break-words text-xs text-gray-500">The landlord receives a one-time code that names the exact number of tenants. Each code works once.</p>
        </div>
      </Card>
      <ActionOtpDialog open={otpOpen} sessionId={session.sessionId} action="rent_stk" summary={summaryRentStk(count)}
        onVerified={(actionId) => { setOtpOpen(false); void send(actionId); }} onClose={() => setOtpOpen(false)} />
    </>
  );
}
