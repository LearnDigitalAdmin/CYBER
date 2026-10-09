import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Shown as the bold title line of each mobile card (use for exactly one column). */
  primary?: boolean;
  /** Align numbers right on the desktop table. */
  align?: "left" | "right";
}

/**
 * md+ : a real <table> inside its own overflow-x-auto wrapper (the only place horizontal scroll is allowed).
 * <md : each row becomes a stacked card, so nothing ever scrolls sideways on a phone.
 */
export function DataTable<T>({ columns, rows, rowKey, empty }: {
  columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string; empty?: ReactNode;
}) {
  if (rows.length === 0) return <>{empty ?? <p className="py-6 text-center text-sm text-gray-500">Nothing here yet.</p>}</>;
  const primary = columns.find((c) => c.primary) ?? columns[0];
  const rest = columns.filter((c) => c !== primary);
  return (
    <div className="min-w-0">
      <div className="hidden min-w-0 overflow-x-auto md:block">
        <table className="w-full min-w-0 table-auto text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
              {columns.map((c) => <th key={c.key} className={`px-3 py-2 font-medium ${c.align === "right" ? "text-right" : ""}`}>{c.header}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={rowKey(r)} className="border-b border-gray-100 last:border-0">
                {columns.map((c) => <td key={c.key} className={`max-w-[18rem] break-words px-3 py-2.5 align-top ${c.align === "right" ? "text-right tabular-nums" : ""}`}>{c.cell(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="min-w-0 space-y-3 md:hidden">
        {rows.map((r) => (
          <li key={rowKey(r)} className="min-w-0 rounded-xl border border-gray-200 bg-white p-3">
            <div className="min-w-0 break-words text-sm font-semibold text-gray-900">{primary.cell(r)}</div>
            <dl className="mt-2 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
              {rest.map((c) => (
                <div key={c.key} className="contents">
                  <dt className="text-gray-500">{c.header}</dt>
                  <dd className="min-w-0 break-words text-right text-gray-800">{c.cell(r)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
