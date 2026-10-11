import { useState } from "react";
import { formatDateTime } from "../../api";
import { useAgent } from "../../core/useAgent";
import { Badge, Card, DataTable, EmptyState, Page, buttonClass, type Column } from "../../ui";
import { CodeEntry } from "./CodeEntry";
import { LogVisitCard } from "./LogVisitCard";
import { categoryLabel, confirmationState, STATE_LABEL, type SupportItem } from "./supportLogic";
import { useSupportItems } from "./useSupportItems";

export default function SupportScreen() {
  const agent = useAgent();
  return (
    <Page title="Support visits" subtitle="Log the help you give a customer, then confirm it with the code they read to you.">
      <LogVisitCard />
      {agent === undefined ? <p className="py-6 text-center text-sm text-gray-500" role="status">Loading…</p>
        : agent === null ? <EmptyState title="Desk account not found" body="Sign in with your desk account to see your visits." />
        : <Visits agentId={agent.agentId} />}
    </Page>
  );
}

function Visits({ agentId }: { agentId: string }) {
  const live = useSupportItems(agentId);
  const [open, setOpen] = useState<string | null>(null);
  const now = Date.now();
  if (live.state === "loading") return <p className="py-6 text-center text-sm text-gray-500" role="status">Loading your visits…</p>;
  if (live.state === "error") return <Card><p role="alert" className="break-words text-sm text-red-700">{live.message}</p></Card>;

  const columns: Column<SupportItem>[] = [
    { key: "when", header: "Date", primary: true, cell: (i) => formatDateTime(i.createdAt) },
    { key: "who", header: "Customer", cell: (i) => i.entityKey },
    { key: "cat", header: "Category", cell: (i) => categoryLabel(i.category) },
    { key: "notes", header: "Notes", cell: (i) => <span className="whitespace-pre-wrap">{i.notes}</span> },
    {
      key: "state", header: "Status",
      cell: (i) => {
        const s = confirmationState(i, now);
        return (
          <div className="flex min-w-0 flex-col items-end gap-2 md:items-start">
            <Badge tone={STATE_LABEL[s].tone}>{STATE_LABEL[s].text}</Badge>
            {s === "awaiting" && (open === i.id
              ? <CodeEntry id={i.id} onConfirmed={() => setOpen(null)} />
              : <button type="button" className={buttonClass.secondary} onClick={() => setOpen(i.id)}>Enter the customer's code</button>)}
          </div>
        );
      },
    },
  ];
  return (
    <Card title="Your support visits">
      <DataTable columns={columns} rows={live.items} rowKey={(i) => i.id}
        empty={<EmptyState title="No visits logged yet" body="Visits you log above appear here with their confirmation status." />} />
    </Card>
  );
}
