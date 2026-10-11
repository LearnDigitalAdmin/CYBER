import { Badge, Card, DataTable, buttonClass, type Column } from "../../ui";
import { summariseBatch, type BatchRow, type RowState } from "./rentLogic";
import { useRentBatch } from "./useRentBatch";

const LABEL: Record<RowState, { tone: "green" | "red" | "amber" | "gray"; text: string }> = {
  sent: { tone: "green", text: "Prompt sent" }, failed: { tone: "red", text: "Failed" },
  waiting: { tone: "amber", text: "Waiting" }, no_result: { tone: "gray", text: "No result reported" },
};

/** Live per-tenant outcome of a rent request. `names` maps tenant ids to what the agent saw when choosing them. */
export function BatchResults({ batchId, names, onDone }: { batchId: string; names: Record<string, string>; onDone: () => void }) {
  const live = useRentBatch(batchId);
  if (live.state === "loading") return <p className="py-8 text-center text-sm text-gray-500" role="status">Loading your rent request…</p>;
  if (live.state === "error") {
    return (
      <Card>
        <p role="alert" className="break-words text-sm text-red-700">{live.message}</p>
        <button type="button" className={`${buttonClass.secondary} mt-3`} onClick={onDone}>Back to tenants</button>
      </Card>
    );
  }
  const sum = summariseBatch(live.batch.tenantIds, live.batch.results, live.batch.status);
  const columns: Column<BatchRow>[] = [
    { key: "tenant", header: "Tenant", primary: true, cell: (r) => names[r.tenantId] ?? r.tenantId },
    { key: "state", header: "Result", cell: (r) => <Badge tone={LABEL[r.state].tone}>{LABEL[r.state].text}</Badge> },
    { key: "note", header: "Details", cell: (r) => r.error ?? r.reference ?? "—" },
  ];
  const headline =
    live.batch.status === "failed" ? "This rent request failed"
    : sum.finished ? "Rent request finished"
    : live.batch.status === "processing" ? "Sending rent prompts…" : "Rent request received";
  return (
    <Card title={headline}>
      <div className="min-w-0 space-y-4" aria-live="polite">
        <p className="break-words text-sm text-gray-700">
          {sum.sent} sent · {sum.failed} failed · {sum.waiting} waiting{sum.noResult > 0 ? ` · ${sum.noResult} with no result` : ""} (of {sum.rows.length})
        </p>
        <DataTable columns={columns} rows={sum.rows} rowKey={(r) => r.tenantId} />
        <button type="button" className={sum.finished ? buttonClass.primary : buttonClass.secondary} onClick={onDone}>
          {sum.finished ? "Choose more tenants" : "Back to tenants"}
        </button>
      </div>
    </Card>
  );
}
