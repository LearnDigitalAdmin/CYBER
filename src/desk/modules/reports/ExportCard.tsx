import { useState } from "react";
import { callDesk, summaryExport, type ExportDataOut } from "../../api";
import { Card, FormField, buttonClass, inputClass } from "../../ui";
import { ActionOtpDialog } from "../comms/lib/access";
import { messageOf } from "../comms/lib/messages";
import { DownloadCard } from "./DownloadCard";
import { exportLabel } from "./reportLogic";

/** Exports hand over customer data, so the customer approves the exact export with a one-time code first. */
export function ExportCard({ sessionId, kinds }: { sessionId: string; kinds: string[] }) {
  const [kind, setKind] = useState("");
  const [otpOpen, setOtpOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<ExportDataOut | null>(null);

  async function exportNow(actionId: string) {
    setBusy(true); setError(null); setFile(null);
    try { setFile(await callDesk("desk_exportData", { sessionId, actionId, kind })); }
    catch (e) { setError(messageOf(e)); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-w-0 space-y-4">
      <Card title="Export data">
        <div className="min-w-0 space-y-4">
          <FormField label="What to export" htmlFor="exp-kind">
            <select id="exp-kind" className={inputClass} value={kind} onChange={(e) => { setKind(e.target.value); setFile(null); }} disabled={busy}>
              <option value="">Choose what to export…</option>
              {kinds.map((k) => <option key={k} value={k}>{exportLabel(k)}</option>)}
            </select>
          </FormField>
          {error && <p role="alert" className="break-words text-sm text-red-700">{error}</p>}
          <button type="button" className={buttonClass.primary} disabled={!kind || busy} onClick={() => setOtpOpen(true)}>{busy ? "Exporting…" : "Get customer approval and export"}</button>
          <p className="break-words text-xs text-gray-500">The customer receives a one-time code that names this export. Each code works once.</p>
        </div>
      </Card>
      {file && <DownloadCard title={`${exportLabel(kind)} export is ready`} url={file.downloadUrl} expiresAt={file.expiresAt} />}
      <ActionOtpDialog open={otpOpen} sessionId={sessionId} action="export" summary={summaryExport(kind)}
        onVerified={(actionId) => { setOtpOpen(false); void exportNow(actionId); }} onClose={() => setOtpOpen(false)} />
    </div>
  );
}
