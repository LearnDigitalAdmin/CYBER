import { useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import { Badge, Card, FormField, Page, buttonClass, cn, inputClass } from "../../ui";
import { AgentGate, SessionBar, SessionGate } from "../../access/gates";
import { PRODUCT_LABEL, RECORD_NOUN, splitEntityKey } from "../../access/scopes";
import { errorMessage } from "../../access/errors";
import { buildDraft } from "../../access/service/payload";
import type { WorkRow } from "../../access/service/records";
import { ServiceCheckout } from "../../access/service/ServiceCheckout";
import { Stepper } from "../../access/service/Stepper";
import { ValidateRecords } from "../../access/service/ValidateRecords";
import type { StoredSession } from "../../access/sessionStore";
import { fileProblem, loadFile } from "./readFile";
import { MAX_COLUMNS, MAX_IMPORT_ROWS, buildColumns, buildRows, guessHasHeader, mappingProblem, normaliseGrid } from "./table";
import type { ColumnMap } from "./table";

const STEPS = ["File", "Columns", "Check", "Pay"] as const;
type Stage = 0 | 1 | 2 | 3;

interface Source { file: File; sheets: string[]; sheetIndex: number; grid: string[][]; lines: number[] }

export default function ImportScreen() {
  return (
    <Page title="Import" subtitle="Add members, students or tenants from an Excel or CSV file.">
      <AgentGate>{() => (
        <SessionGate scope="import">{(session) => <Wizard key={session.sessionId} session={session} />}</SessionGate>
      )}</AgentGate>
    </Page>
  );
}

function Wizard({ session }: { session: StoredSession }) {
  const parts = splitEntityKey(session.entityKey);
  const noun = parts ? RECORD_NOUN[parts.product] : { plural: "records", singular: "record" };
  const [stage, setStage] = useState<Stage>(0);
  const [src, setSrc] = useState<Source | null>(null);
  const [hasHeader, setHasHeader] = useState(true);
  const [cols, setCols] = useState<ColumnMap[]>([]);
  const [rows, setRows] = useState<WorkRow[]>([]);

  const reset = () => { setStage(0); setSrc(null); setCols([]); setRows([]); setHasHeader(true); };

  return (
    <div className="min-w-0 space-y-4">
      <SessionBar session={session} />
      <Stepper steps={STEPS} current={stage} />

      {stage === 0 && (
        <PickFile noun={noun.plural} product={parts ? PRODUCT_LABEL[parts.product] : ""}
          onLoaded={(s) => {
            const header = guessHasHeader(s.grid);
            setSrc(s); setHasHeader(header); setCols(buildColumns(s.grid, header)); setStage(1);
          }} />
      )}

      {stage === 1 && src && (
        <MapColumns src={src} hasHeader={hasHeader} cols={cols}
          onSource={(s) => { setSrc(s); setCols(buildColumns(s.grid, hasHeader)); }}
          onHeader={(h) => { setHasHeader(h); setCols(buildColumns(src.grid, h)); }}
          onCols={setCols} onChangeFile={reset}
          onContinue={(built) => { setRows(built); setStage(2); }} />
      )}

      {stage === 2 && (
        <ValidateRecords sessionId={session.sessionId} rows={rows} onRowsChange={setRows} plural={noun.plural}
          rowLabel={(r) => `Row ${r.line}`} onReady={() => setStage(3)} onBack={() => setStage(1)} backLabel="Back to columns" />
      )}

      {stage === 3 && (
        <ServiceCheckout sessionId={session.sessionId} serviceType="import_excel" params={{ rowCount: rows.length }}
          payload={buildDraft(rows.map((r) => r.values), "excel")} customerName={session.displayName}
          description={`Import of ${rows.length} ${rows.length === 1 ? noun.singular : noun.plural}`}
          onBack={() => setStage(2)} onFinish={reset} />
      )}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ 1. file
function PickFile({ noun, product, onLoaded }: { noun: string; product: string; onLoaded: (s: Source) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const token = useRef(0);

  const take = async (file: File | undefined) => {
    if (!file) return;
    const problem = fileProblem(file);
    if (problem) { setError(problem); return; }
    const mine = ++token.current;
    setBusy(true); setError(null);
    try {
      const loaded = await loadFile(file, 0);
      if (mine !== token.current) return;
      const { grid, lines } = normaliseGrid(loaded.raw);
      if (grid.length === 0 || grid[0].length === 0) { setError("We found no data in that file."); return; }
      if (grid[0].length > MAX_COLUMNS) { setError(`That file has more than ${MAX_COLUMNS} columns. Remove the ones you do not need and try again.`); return; }
      if (grid.length - 1 > MAX_IMPORT_ROWS) { setError(`That file has more than ${MAX_IMPORT_ROWS} rows. Split it into smaller files and import them one by one.`); return; }
      onLoaded({ file, sheets: loaded.sheets, sheetIndex: 0, grid, lines });
    } catch (e) {
      if (mine === token.current) setError(errorMessage(e));
    } finally { if (mine === token.current) setBusy(false); }
  };

  const onInput = (ev: ChangeEvent<HTMLInputElement>) => { const f = ev.target.files?.[0]; ev.target.value = ""; void take(f); };
  const onDrop = (ev: DragEvent<HTMLLabelElement>) => { ev.preventDefault(); setOver(false); void take(ev.dataTransfer.files?.[0]); };

  return (
    <Card title="Choose the file">
      <div className="min-w-0 space-y-3">
        <label htmlFor="import-file"
          onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}
          className={cn("flex min-h-40 min-w-0 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center focus-within:ring-2 focus-within:ring-blue-300",
            over ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white hover:border-blue-400")}>
          <Upload size={28} className="text-blue-600" aria-hidden />
          <span className="break-words text-sm font-semibold text-gray-900">{busy ? "Reading the file…" : "Tap to choose a file, or drop it here"}</span>
          <span className="break-words text-xs text-gray-600">Excel (.xlsx) or CSV. Up to {MAX_IMPORT_ROWS.toLocaleString("en-KE")} rows.</span>
          <input id="import-file" type="file" className="sr-only" disabled={busy}
            accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={onInput} />
        </label>
        {error && <p role="alert" className="break-words rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <p className="break-words text-xs text-gray-500">
          One row per person{product ? ` for ${product}` : ""}, with a header row naming each column. The file is read on this device; the {noun} are only sent for checking in the next steps.
        </p>
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------------------------------------ 2. columns
function MapColumns({ src, hasHeader, cols, onSource, onHeader, onCols, onChangeFile, onContinue }: {
  src: Source; hasHeader: boolean; cols: ColumnMap[];
  onSource: (s: Source) => void; onHeader: (h: boolean) => void; onCols: (c: ColumnMap[]) => void;
  onChangeFile: () => void; onContinue: (rows: WorkRow[]) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const count = Math.max(0, src.grid.length - (hasHeader ? 1 : 0));

  const patch = (i: number, p: Partial<ColumnMap>) => { setError(null); onCols(cols.map((c) => (c.index === i ? { ...c, ...p } : c))); };

  const changeSheet = async (idx: number) => {
    setBusy(true); setError(null);
    try {
      const loaded = await loadFile(src.file, idx);
      const { grid, lines } = normaliseGrid(loaded.raw);
      if (grid.length === 0 || grid[0].length === 0) { setError("That sheet has no data."); return; }
      if (grid[0].length > MAX_COLUMNS || grid.length - 1 > MAX_IMPORT_ROWS) { setError("That sheet is too large. Keep it under the row and column limits."); return; }
      onSource({ ...src, sheetIndex: idx, grid, lines });
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };

  const next = () => {
    const problem = mappingProblem(cols);
    if (problem) { setError(problem); return; }
    const built = buildRows(src.grid, src.lines, hasHeader, cols);
    if (built.length === 0) { setError("There are no rows to import with these columns."); return; }
    onContinue(built);
  };

  return (
    <Card title="Match the columns">
      <div className="min-w-0 space-y-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <FileSpreadsheet size={18} className="shrink-0 text-gray-500" aria-hidden />
          <span className="min-w-0 break-all text-sm font-medium text-gray-900">{src.file.name}</span>
          <Badge tone="blue">{count} {count === 1 ? "row" : "rows"}</Badge>
          <button type="button" className="ml-auto min-h-11 text-sm font-medium text-blue-700 underline" onClick={onChangeFile}>Change file</button>
        </div>

        {src.sheets.length > 1 && (
          <FormField label="Sheet" htmlFor="import-sheet">
            <select id="import-sheet" className={inputClass} value={src.sheetIndex} disabled={busy} onChange={(e) => void changeSheet(Number(e.target.value))}>
              {src.sheets.map((s, i) => <option key={`${s}-${i}`} value={i}>{s}</option>)}
            </select>
          </FormField>
        )}

        <label className="flex min-h-11 min-w-0 cursor-pointer items-start gap-3">
          <input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={hasHeader} onChange={(e) => onHeader(e.target.checked)} />
          <span className="min-w-0 break-words text-sm text-gray-800">The first row holds column names</span>
        </label>

        <p className="break-words text-sm text-gray-600">
          Each ticked column is sent under the field name you see. Use the names the account expects (for example <span className="font-medium">name</span> and <span className="font-medium">phone</span>); the check in the next step tells you about any it does not recognise.
        </p>

        <ul className="min-w-0 space-y-3">
          {cols.map((c) => (
            <li key={c.index} className={cn("min-w-0 rounded-xl border p-3", c.include ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50")}>
              <label className="flex min-h-11 min-w-0 cursor-pointer items-start gap-3">
                <input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={c.include} onChange={(e) => patch(c.index, { include: e.target.checked })} />
                <span className="min-w-0">
                  <span className="block break-words text-sm font-semibold text-gray-900">{c.header}</span>
                  <span className="block break-words text-xs text-gray-500">{c.samples.length ? c.samples.join(" · ") : "No values"}</span>
                </span>
              </label>
              {c.include && (
                <div className="mt-2 min-w-0">
                  <FormField label="Field name" htmlFor={`field-${c.index}`}>
                    <input id={`field-${c.index}`} className={inputClass} value={c.field} maxLength={60} autoCapitalize="none" autoCorrect="off" spellCheck={false}
                      onChange={(e) => patch(c.index, { field: e.target.value })} />
                  </FormField>
                </div>
              )}
            </li>
          ))}
        </ul>

        {error && <p role="alert" className="break-words rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="flex min-w-0 flex-wrap gap-2">
          <button type="button" className={`${buttonClass.primary} flex-1 sm:flex-none`} disabled={busy} onClick={next}>Continue to check</button>
          <button type="button" className={buttonClass.secondary} onClick={onChangeFile}>Start over</button>
        </div>
      </div>
    </Card>
  );
}
