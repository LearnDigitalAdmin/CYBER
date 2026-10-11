import { useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { callDesk, type RunReportOut } from "../../api";
import { Card, FormField, buttonClass, inputClass } from "../../ui";
import { messageOf } from "../comms/lib/messages";
import { DownloadCard } from "./DownloadCard";
import { parseOptionRows, runKey, type OptionRow } from "./reportLogic";

export function RunReportCard({ sessionId, reportTypes }: { sessionId: string; reportTypes: string[] }) {
  const [type, setType] = useState("");
  const [rows, setRows] = useState<OptionRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<RunReportOut | null>(null);
  const attempt = useRef<{ key: string; id: string } | null>(null);

  const setRow = (i: number, patch: Partial<OptionRow>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  async function run() {
    const parsed = parseOptionRows(rows);
    if (!parsed.ok) { setError(parsed.error); return; }
    const key = runKey(type, parsed.params);
    // The same inputs after a failed attempt reuse the id, so the customer's report credits are not charged twice.
    if (attempt.current?.key !== key) attempt.current = { key, id: crypto.randomUUID() };
    const requestId = attempt.current.id;
    setBusy(true); setError(null); setFile(null);
    try {
      setFile(await callDesk("desk_runReport", { sessionId, reportType: type, params: parsed.params, requestId }));
      attempt.current = null;
    } catch (e) { setError(messageOf(e)); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-w-0 space-y-4">
      <Card title="Run a report">
        <div className="min-w-0 space-y-4">
          <FormField label="Report" htmlFor="rep-type">
            <select id="rep-type" className={inputClass} value={type} onChange={(e) => { setType(e.target.value); setFile(null); }} disabled={busy}>
              <option value="">Choose a report…</option>
              {reportTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </FormField>
          <details className="min-w-0 rounded-xl border border-gray-200 px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium text-gray-800">Report options (optional)</summary>
            <div className="mt-3 min-w-0 space-y-3">
              <p className="break-words text-xs text-gray-500">Add only the options this report asks for, as name and value. Values are sent as text.</p>
              {rows.map((r, i) => (
                <div key={i} className="flex min-w-0 items-start gap-2">
                  <input aria-label={`Option ${i + 1} name`} placeholder="name" className={inputClass} value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} disabled={busy} />
                  <input aria-label={`Option ${i + 1} value`} placeholder="value" className={inputClass} value={r.value} onChange={(e) => setRow(i, { value: e.target.value })} disabled={busy} />
                  <button type="button" aria-label={`Remove option ${i + 1}`} onClick={() => setRows((x) => x.filter((_, j) => j !== i))} disabled={busy} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-300"><X size={18} /></button>
                </div>
              ))}
              <button type="button" className={buttonClass.secondary} onClick={() => setRows((x) => [...x, { name: "", value: "" }])} disabled={busy || rows.length >= 20}><Plus size={16} /> Add option</button>
            </div>
          </details>
          {error && <p role="alert" className="break-words text-sm text-red-700">{error}</p>}
          <button type="button" className={buttonClass.primary} disabled={!type || busy} onClick={() => void run()}>{busy ? "Running…" : "Run report"}</button>
          <p className="break-words text-xs text-gray-500">The customer's own account runs the report and uses its own report credits.</p>
        </div>
      </Card>
      {file && <DownloadCard title="Your report is ready" url={file.downloadUrl} expiresAt={file.expiresAt} />}
    </div>
  );
}
