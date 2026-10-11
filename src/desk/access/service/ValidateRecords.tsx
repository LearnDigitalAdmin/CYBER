import { useEffect, useRef, useState } from "react";
import { deskApi } from "../../api";
import type { ImportError } from "../../api";
import { Badge, Card, DataTable, EmptyState, FormField, buttonClass, inputClass } from "../../ui";
import type { Column } from "../../ui";
import { errorMessage } from "../errors";
import { groupErrors, inferRowBase } from "./records";
import type { WorkRow } from "./records";

const PAGE = 25;

interface Check { errors: ImportError[]; byLine: Map<number, ImportError[]>; unmatched: ImportError[]; checkedCount: number; stale: boolean }

export interface ValidateRecordsProps {
  sessionId: string;
  rows: WorkRow[];
  onRowsChange: (rows: WorkRow[]) => void;
  /** "members" / "students" / "tenants" */
  plural: string;
  /** How a record is named in the fix list, e.g. "Row 14" (sheet line) or "Record 3". */
  rowLabel: (row: WorkRow) => string;
  onReady: () => void;
  onBack: () => void;
  backLabel: string;
}

/** Runs the account's own validation (through validateImport), lets the agent fix or drop what it rejects, and gates payment. */
export function ValidateRecords(p: ValidateRecordsProps) {
  const [check, setCheck] = useState<Check | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);
  const started = useRef(false);
  const busyRef = useRef(false);

  const run = async () => {
    if (busyRef.current || p.rows.length === 0) return;
    busyRef.current = true; setBusy(true); setError(null);
    const snapshot = p.rows;
    try {
      const out = await deskApi.validateImport({ sessionId: p.sessionId, rows: snapshot.map((r) => r.values) });
      const base = inferRowBase(out.errors, snapshot.map((r) => r.values), out.valid);
      const g = groupErrors(out.errors, base, snapshot.length);
      const byLine = new Map<number, ImportError[]>();
      g.byIndex.forEach((errs, i) => byLine.set(snapshot[i].line, errs));
      setCheck({ errors: out.errors, byLine, unmatched: g.unmatched, checkedCount: snapshot.length, stale: false });
      setShown(PAGE);
    } catch (e) {
      setError(errorMessage(e));
    } finally { busyRef.current = false; setBusy(false); }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stale = () => setCheck((c) => (c ? { ...c, stale: true } : c));
  const setValue = (line: number, field: string, value: string) => {
    p.onRowsChange(p.rows.map((r) => (r.line === line ? { ...r, values: { ...r.values, [field]: value.trim() === "" ? null : value } } : r)));
    stale();
  };
  const drop = (line: number) => { p.onRowsChange(p.rows.filter((r) => r.line !== line)); stale(); };
  const acceptAll = () => {
    if (!check) return;
    const bySuggestion = new Map<number, ImportError[]>();
    check.byLine.forEach((errs, line) => bySuggestion.set(line, errs.filter((e) => e.suggestion !== undefined && e.suggestion !== "")));
    p.onRowsChange(p.rows.map((r) => {
      const fixes = bySuggestion.get(r.line) ?? [];
      return fixes.length ? { ...r, values: { ...r.values, ...Object.fromEntries(fixes.map((e) => [e.field, e.suggestion as string])) } } : r;
    }));
    stale();
  };

  if (p.rows.length === 0) {
    return (
      <EmptyState title={check ? `Nothing left to add` : "No records"} body="Every row was dropped or empty."
        action={<button type="button" className={buttonClass.secondary} onClick={p.onBack}>{p.backLabel}</button>} />
    );
  }

  const flagged = check ? p.rows.filter((r) => check.byLine.has(r.line)) : [];
  const suggestionCount = check ? flagged.reduce((n, r) => n + (check.byLine.get(r.line) ?? []).filter((e) => e.suggestion).length, 0) : 0;
  const clean = check !== null && !check.stale && check.errors.length === 0;

  const columns: Column<WorkRow>[] = [
    { key: "who", header: "Record", primary: true, cell: (r) => (
      <div className="min-w-0"><p className="break-words">{p.rowLabel(r)}</p>
        <p className="break-words text-xs font-normal text-gray-500">{summarise(r)}</p></div>) },
    { key: "fix", header: "To fix", cell: (r) => (
      <ul className="min-w-0 space-y-3">
        {(check?.byLine.get(r.line) ?? []).map((e, i) => (
          <li key={`${e.field}-${i}`} className="min-w-0 text-left">
            <FormField label={e.field} htmlFor={`fix-${r.line}-${i}`} error={e.reason}>
              <input id={`fix-${r.line}-${i}`} className={inputClass} value={String(r.values[e.field] ?? "")}
                onChange={(ev) => setValue(r.line, e.field, ev.target.value)} />
            </FormField>
            {e.suggestion !== undefined && e.suggestion !== "" && String(r.values[e.field] ?? "") !== e.suggestion && (
              <button type="button" className="mt-1 min-h-11 break-all text-left text-sm font-medium text-blue-700 underline" onClick={() => setValue(r.line, e.field, e.suggestion as string)}>
                Use “{e.suggestion}”
              </button>
            )}
          </li>
        ))}
      </ul>) },
    { key: "act", header: "", align: "right", cell: (r) => (
      <button type="button" className={buttonClass.secondary} onClick={() => drop(r.line)}>Drop {p.rowLabel(r).toLowerCase()}</button>) },
  ];

  return (
    <Card title="Check the records">
      <div className="min-w-0 space-y-4">
        {busy && !check && <p role="status" className="text-sm text-gray-700">Checking {p.rows.length} {p.plural}…</p>}
        {error && <p role="alert" className="break-words rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {check && !check.stale && check.errors.length === 0 && (
          <div role="status" className="min-w-0 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
            <p className="break-words font-semibold">All {check.checkedCount} {p.plural} passed the check.</p>
          </div>
        )}

        {check && check.errors.length > 0 && (
          <div className="min-w-0 space-y-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Badge tone="amber">{flagged.length > 0 ? `${flagged.length} of ${p.rows.length} need fixing` : "Problems found"}</Badge>
              {check.stale && <Badge tone="blue">You made changes: check again</Badge>}
            </div>
            <p className="break-words text-sm text-gray-700">Fix each problem, use the suggestion, or drop the record. Records you drop are not added.</p>
          </div>
        )}

        {check && check.unmatched.length > 0 && (
          <div className="min-w-0 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="break-words font-semibold">Problems we could not tie to one record</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {check.unmatched.slice(0, 10).map((e, i) => <li key={i} className="break-words">{e.field ? `${e.field}: ` : ""}{e.reason}</li>)}
            </ul>
            <p className="mt-1 break-words">{p.backLabel} to correct these.</p>
          </div>
        )}

        {check && flagged.length > 0 && (
          <div className="min-w-0 space-y-3">
            {suggestionCount > 0 && (
              <button type="button" className={buttonClass.secondary} onClick={acceptAll}>Use all {suggestionCount} suggestions</button>
            )}
            <DataTable columns={columns} rows={flagged.slice(0, shown)} rowKey={(r) => String(r.line)} />
            {flagged.length > shown && (
              <button type="button" className={buttonClass.secondary} onClick={() => setShown((n) => n + PAGE)}>
                Show more ({flagged.length - shown} left)
              </button>
            )}
          </div>
        )}

        <div className="flex min-w-0 flex-wrap gap-2">
          {clean ? (
            <button type="button" className={`${buttonClass.primary} flex-1 sm:flex-none`} onClick={p.onReady}>Continue to payment</button>
          ) : (
            <button type="button" className={`${buttonClass.primary} flex-1 sm:flex-none`} disabled={busy} onClick={() => void run()}>
              {busy ? "Checking…" : check ? "Check again" : "Check records"}
            </button>
          )}
          <button type="button" className={buttonClass.secondary} onClick={p.onBack} disabled={busy}>{p.backLabel}</button>
        </div>
      </div>
    </Card>
  );
}

function summarise(r: WorkRow): string {
  return Object.values(r.values).filter((v) => v !== null && v !== "").slice(0, 3).map(String).join(" · ");
}
