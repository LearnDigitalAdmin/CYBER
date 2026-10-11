import { useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Badge, Card, DataTable, EmptyState, FormField, Page, buttonClass, cn, inputClass } from "../../ui";
import type { Column } from "../../ui";
import { AgentGate, SessionBar, SessionGate } from "../../access/gates";
import { RECORD_NOUN, splitEntityKey } from "../../access/scopes";
import { buildDraft } from "../../access/service/payload";
import type { WorkRow } from "../../access/service/records";
import { ServiceCheckout } from "../../access/service/ServiceCheckout";
import { Stepper } from "../../access/service/Stepper";
import { ValidateRecords } from "../../access/service/ValidateRecords";
import type { StoredSession } from "../../access/sessionStore";
import { MAX_IMPORT_ROWS } from "../import/table";
import { cleanFields, emptyValues, fieldsProblem, isBlank, loadSavedFields, reshape, saveFields, toValue } from "./fields";

const STEPS = ["Fields", "Records", "Check", "Pay"] as const;
type Stage = 0 | 1 | 2 | 3;
type Mode = "single" | "sheet";

export default function ManualScreen() {
  return (
    <Page title="Manual entry" subtitle="Type records in for a customer, one by one or straight from a paper form.">
      <AgentGate>{() => (
        <SessionGate scope="manual_entry">{(session) => <Wizard key={session.sessionId} session={session} />}</SessionGate>
      )}</AgentGate>
    </Page>
  );
}

function Wizard({ session }: { session: StoredSession }) {
  const parts = splitEntityKey(session.entityKey);
  const product = parts?.product ?? "chama";
  const noun = RECORD_NOUN[product];
  const [stage, setStage] = useState<Stage>(0);
  const [mode, setMode] = useState<Mode>("single");
  const [fields, setFields] = useState<string[]>(() => loadSavedFields(product) ?? ["", ""]);
  const [rows, setRows] = useState<WorkRow[]>([]);
  const nextId = useRef(1);

  const newRow = (values = emptyValues(cleanFields(fields))): WorkRow => ({ line: nextId.current++, values });
  const done = cleanFields(fields);
  const label = (r: WorkRow) => `Record ${rows.findIndex((x) => x.line === r.line) + 1}`;
  const reset = () => { setStage(0); setRows([]); };

  return (
    <div className="min-w-0 space-y-4">
      <SessionBar session={session} />
      <Stepper steps={STEPS} current={stage} />

      {stage === 0 && (
        <FieldsStep fields={fields} onChange={setFields} hasRecords={rows.length > 0}
          onContinue={() => { const f = cleanFields(fields); setFields(f); saveFields(product, f); setRows((r) => reshape(r, f)); setStage(1); }} />
      )}

      {stage === 1 && (
        <Card title="Enter the records">
          <div className="min-w-0 space-y-4">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <div role="group" aria-label="Entry style" className="inline-flex min-w-0 rounded-xl border border-gray-300 p-0.5">
                {(["single", "sheet"] as const).map((m) => (
                  <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}
                    className={cn("min-h-10 rounded-lg px-3 text-sm font-medium", mode === m ? "bg-blue-600 text-white" : "text-gray-700")}>
                    {m === "single" ? "One by one" : "Paper form"}
                  </button>
                ))}
              </div>
              <Badge tone="blue">{rows.length} {rows.length === 1 ? noun.singular : noun.plural}</Badge>
              <button type="button" className="ml-auto min-h-11 text-sm font-medium text-blue-700 underline" onClick={() => setStage(0)}>Change fields</button>
            </div>

            {mode === "single"
              ? <SingleEntry fields={done} rows={rows} setRows={setRows} newRow={newRow} />
              : <SheetEntry fields={done} rows={rows} setRows={setRows} newRow={newRow} />}

            <div className="flex min-w-0 flex-wrap gap-2">
              <button type="button" className={`${buttonClass.primary} flex-1 sm:flex-none`} disabled={rows.filter((r) => !isBlank(r)).length === 0}
                onClick={() => { setRows((r) => r.filter((x) => !isBlank(x))); setStage(2); }}>
                Check {noun.plural}
              </button>
            </div>
          </div>
        </Card>
      )}

      {stage === 2 && (
        <ValidateRecords sessionId={session.sessionId} rows={rows} onRowsChange={setRows} plural={noun.plural}
          rowLabel={label} onReady={() => setStage(3)} onBack={() => setStage(1)} backLabel="Back to the records" />
      )}

      {stage === 3 && (
        <ServiceCheckout sessionId={session.sessionId} serviceType="manual_entry" params={{ recordCount: rows.length }}
          payload={buildDraft(rows.map((r) => r.values), "manual")} customerName={session.displayName}
          description={`Manual entry of ${rows.length} ${rows.length === 1 ? noun.singular : noun.plural}`}
          onBack={() => setStage(2)} onFinish={reset} />
      )}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ fields
function FieldsStep({ fields, onChange, hasRecords, onContinue }: {
  fields: string[]; onChange: (f: string[]) => void; hasRecords: boolean; onContinue: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const set = (i: number, v: string) => { setError(null); onChange(fields.map((f, j) => (j === i ? v : f))); };
  const next = () => { const p = fieldsProblem(fields); if (p) setError(p); else onContinue(); };
  return (
    <Card title="Name the fields">
      <div className="min-w-0 space-y-4">
        <p className="break-words text-sm text-gray-600">
          List what you will type for each person, using the names the account expects (for example <span className="font-medium">name</span>, <span className="font-medium">phone</span>). We remember them for next time.
        </p>
        <ul className="min-w-0 space-y-2">
          {fields.map((f, i) => (
            <li key={i} className="flex min-w-0 items-end gap-2">
              <div className="min-w-0 flex-1">
                <FormField label={`Field ${i + 1}`} htmlFor={`mf-${i}`}>
                  <input id={`mf-${i}`} className={inputClass} value={f} maxLength={60} autoCapitalize="none" autoCorrect="off" spellCheck={false} onChange={(e) => set(i, e.target.value)} />
                </FormField>
              </div>
              <button type="button" aria-label={`Remove field ${i + 1}`} className={`${buttonClass.secondary} w-11 shrink-0 px-0`} disabled={fields.length <= 1}
                onClick={() => onChange(fields.filter((_, j) => j !== i))}><Trash2 size={18} /></button>
            </li>
          ))}
        </ul>
        {hasRecords && <p className="break-words text-xs text-amber-800">Records you already typed keep the values of fields you keep; removed fields lose their values.</p>}
        {error && <p role="alert" className="break-words rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="flex min-w-0 flex-wrap gap-2">
          <button type="button" className={buttonClass.secondary} onClick={() => onChange([...fields, ""])} disabled={fields.length >= 60}><Plus size={16} /> Add field</button>
          <button type="button" className={`${buttonClass.primary} flex-1 sm:flex-none`} onClick={next}>Continue</button>
        </div>
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------------------------------------ one by one
interface EntryProps { fields: string[]; rows: WorkRow[]; setRows: (f: (r: WorkRow[]) => WorkRow[]) => void; newRow: () => WorkRow }

function SingleEntry({ fields, rows, setRows, newRow }: EntryProps) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const first = useRef<HTMLInputElement>(null);

  const values = () => Object.fromEntries(fields.map((f) => [f, toValue(draft[f] ?? "")]));
  const clear = () => { setDraft({}); setEditing(null); setError(null); first.current?.focus(); };

  const save = () => {
    const v = values();
    if (Object.values(v).every((x) => x === null)) { setError("Type at least one value."); return; }
    if (editing === null && rows.length >= MAX_IMPORT_ROWS) { setError(`You can add up to ${MAX_IMPORT_ROWS} records at a time.`); return; }
    if (editing !== null) setRows((r) => r.map((x) => (x.line === editing ? { ...x, values: v } : x)));
    else setRows((r) => [...r, { ...newRow(), values: v }]);
    clear();
  };

  const columns: Column<WorkRow>[] = [
    { key: "n", header: "#", primary: true, cell: (r) => `Record ${rows.findIndex((x) => x.line === r.line) + 1}` },
    ...fields.map((f) => ({ key: f, header: f, cell: (r: WorkRow) => String(r.values[f] ?? "") || "—" })),
    { key: "a", header: "", align: "right" as const, cell: (r: WorkRow) => (
      <span className="inline-flex flex-wrap justify-end gap-2">
        <button type="button" className={buttonClass.secondary} onClick={() => { setEditing(r.line); setDraft(Object.fromEntries(fields.map((f) => [f, String(r.values[f] ?? "")]))); setError(null); first.current?.focus(); }}>Edit</button>
        <button type="button" className={buttonClass.secondary} onClick={() => { setRows((x) => x.filter((y) => y.line !== r.line)); if (editing === r.line) clear(); }}>Remove</button>
      </span>) },
  ];

  return (
    <div className="min-w-0 space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="min-w-0 space-y-3 rounded-xl border border-gray-200 p-3" noValidate>
        <p className="text-sm font-semibold text-gray-900">{editing !== null ? "Edit record" : "New record"}</p>
        {fields.map((f, i) => (
          <FormField key={f} label={f} htmlFor={`se-${i}`}>
            <input id={`se-${i}`} ref={i === 0 ? first : undefined} className={inputClass} value={draft[f] ?? ""} autoComplete="off"
              onChange={(e) => { setError(null); setDraft((d) => ({ ...d, [f]: e.target.value })); }} />
          </FormField>
        ))}
        {error && <p role="alert" className="break-words text-sm text-red-600">{error}</p>}
        <div className="flex min-w-0 flex-wrap gap-2">
          <button type="submit" className={`${buttonClass.primary} flex-1 sm:flex-none`}>{editing !== null ? "Save changes" : "Add record"}</button>
          {editing !== null && <button type="button" className={buttonClass.secondary} onClick={clear}>Cancel</button>}
        </div>
      </form>
      {rows.length === 0
        ? <EmptyState title="No records yet" body="Add the first one above." />
        : <DataTable columns={columns} rows={rows} rowKey={(r) => String(r.line)} />}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ paper form grid
function SheetEntry({ fields, rows, setRows, newRow }: EntryProps) {
  const box = useRef<HTMLDivElement>(null);
  const focusCell = (line: number, col: number) => window.setTimeout(() => box.current?.querySelector<HTMLInputElement>(`[data-cell="${line}-${col}"]`)?.focus(), 0);

  const add = () => {
    if (rows.length >= MAX_IMPORT_ROWS) return;
    const r = newRow();
    setRows((x) => [...x, r]);
    focusCell(r.line, 0);
  };
  const edit = (line: number, f: string, text: string) =>
    setRows((x) => x.map((r) => (r.line === line ? { ...r, values: { ...r.values, [f]: toValue(text) } } : r)));

  const columns: Column<WorkRow>[] = [
    { key: "n", header: "#", primary: true, cell: (r) => `Record ${rows.findIndex((x) => x.line === r.line) + 1}` },
    ...fields.map((f, c) => ({ key: f, header: f, cell: (r: WorkRow) => (
      <input aria-label={`${f}, record ${rows.findIndex((x) => x.line === r.line) + 1}`} data-cell={`${r.line}-${c}`} className={`${inputClass} min-w-[8rem]`}
        value={String(r.values[f] ?? "")} autoComplete="off" onChange={(e) => edit(r.line, f, e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          const i = rows.findIndex((x) => x.line === r.line);
          if (c < fields.length - 1) focusCell(r.line, c + 1);
          else if (i < rows.length - 1) focusCell(rows[i + 1].line, 0);
          else add();
        }} />) })),
    { key: "a", header: "", align: "right" as const, cell: (r: WorkRow) => (
      <button type="button" aria-label="Remove record" className={`${buttonClass.secondary} w-11 px-0`} onClick={() => setRows((x) => x.filter((y) => y.line !== r.line))}><Trash2 size={18} /></button>) },
  ];

  return (
    <div ref={box} className="min-w-0 space-y-3">
      <p className="break-words text-sm text-gray-600">Type each person as a row. Press Enter to move to the next box; Enter in the last box adds a new row.</p>
      {rows.length === 0
        ? <EmptyState title="No rows yet" body="Add the first row to start typing." />
        : <DataTable columns={columns} rows={rows} rowKey={(r) => String(r.line)} />}
      <button type="button" className={buttonClass.secondary} onClick={add}><Plus size={16} /> Add row</button>
    </div>
  );
}
