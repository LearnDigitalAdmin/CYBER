import { useState } from "react";
import type { FormEvent } from "react";
import { deskApi, formatDateTime, formatKes } from "../api";
import type { NetDecision, NetDashboardOut, NetMember, NetworkRole, Rank } from "../api";
import { errorMessage } from "../access/errors";
import { Spinner } from "../access/gates";
import { sanitizePhoneInput, PHONE_MAX_INPUT_LENGTH } from "../access/phone";
import { useAgent } from "../core/useAgent";
import { Badge, Card, DataTable, EmptyState, FormField, Modal, Page, Stat, StatGrid, buttonClass, cn, inputClass, type Column } from "../ui";
import { useNetworkDashboard } from "./useNetwork";
import { ACTION_LABEL, ROLE_BLURB, ROLE_LABEL, STATUS_TONE, actionsFor, incentiveGuide, needsReason, series, tilesFor } from "./view";

const INVITABLE: Record<Rank, NetworkRole[]> = { clerk: [], senior: ["clerk"], lead: ["senior", "clerk"], admin: ["lead", "senior", "clerk"], internal: ["admin", "lead", "senior", "clerk"] };

export default function NetworkScreen() {
  const agent = useAgent();
  return (
    <Page title="Network" subtitle="Your role, your team and how you earn.">
      {agent === undefined ? <Spinner /> : agent === null
        ? <EmptyState title="Desk account not found" body="Apply to become a desk agent first." />
        : <Loaded agentId={agent.agentId} />}
    </Page>
  );
}

function Loaded({ agentId }: { agentId: string }) {
  const n = useNetworkDashboard(agentId);
  if (n.state === "loading") return <Spinner />;
  if (n.state === "error") return <Card><p role="alert" className="break-words text-sm text-red-700">{n.message}</p></Card>;
  return <Dashboard d={n.data} reload={n.reload} />;
}

function Bars({ d }: { d: NetDashboardOut }) {
  const s = series(d, (x) => x.commissionMinor + x.overrideMinor + x.incentiveMinor);
  const max = Math.max(1, ...s.map((x) => x.minor));
  return (
    <div className="flex h-28 min-w-0 items-end gap-2" role="img" aria-label="Earnings for the last six months">
      {s.map((x) => (
        <div key={x.month} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
          <div className="w-full rounded-t bg-blue-600" style={{ height: `${Math.max(2, Math.round((x.minor / max) * 100))}%` }} title={`${x.month}: ${formatKes(x.minor)}`} />
          <span className="text-[10px] text-gray-500">{x.month.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

function Dashboard({ d, reload }: { d: NetDashboardOut; reload: () => void }) {
  const canInvite = INVITABLE[d.role].length > 0 && d.status === "active";
  const manages = d.role !== "clerk";
  const approver = (d.role === "admin" || d.role === "internal") && d.status === "active";
  return (
    <div className="min-w-0 space-y-4">
      <Card>
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Your role</p>
            <p className="text-2xl font-bold text-gray-900">{ROLE_LABEL[d.role]} <span className="text-base font-medium text-gray-500">{d.deskCode}</span></p>
            <p className="mt-1 break-words text-sm text-gray-600">{ROLE_BLURB[d.role]}</p>
            {d.upline && <p className="mt-1 break-words text-sm text-gray-600">Reports to {d.upline.name} ({d.upline.deskCode}, {ROLE_LABEL[d.upline.rank]})</p>}
            {!d.upline && d.role !== "internal" && d.role !== "admin" && <p className="mt-1 text-sm text-gray-600">Reports to Samuhia until a team lead is assigned.</p>}
          </div>
          <Badge tone={STATUS_TONE[d.status]}>{d.status}</Badge>
        </div>
      </Card>

      <StatGrid>{tilesFor(d).map((t) => <Stat key={t.label} label={t.label} value={t.value} hint={t.hint} tone={t.tone} />)}</StatGrid>

      <Card title="Earnings, last six months (commission + overrides + incentives)"><Bars d={d} /></Card>

      {d.margin && (
        <Card title={`Network margin, ${d.margin.month}`}>
          <p className="break-words text-sm text-gray-700">
            Samuhia kept <strong>{d.margin.retainedPct}%</strong> of {formatKes(d.margin.baseMinor)} net after {formatKes(d.margin.costMinor)} of agent-network costs (floor {d.margin.floorPct}%).
            {d.margin.scale < 1 ? ` Incentives were scaled to ${Math.round(d.margin.scale * 100)}% to protect the floor.` : " Incentives were paid in full."}
          </p>
        </Card>
      )}

      {d.slots && manages && (
        <Card title="Capacity">
          <p className="break-words text-sm text-gray-700">Seniors in your ward: {d.slots.seniorsInWard} of {d.slots.seniorsMax}. Leads in your constituency: {d.slots.leadsInConstituency} of {d.slots.leadsMax}.</p>
        </Card>
      )}

      {approver && d.pending.length > 0 && <Pending d={d} reload={reload} />}
      {manages && <Team d={d} reload={reload} approver={approver} />}
      {canInvite && <Invite role={d.role} />}

      <Card title="How you earn">
        <ul className="min-w-0 space-y-2">
          {incentiveGuide(d.rules.incentives).map((r) => (
            <li key={r.behaviour} className="min-w-0 break-words text-sm text-gray-700"><span className="font-semibold text-gray-900">{r.behaviour}.</span> {r.rule}</li>
          ))}
          {d.rules.overridePct && <li className="break-words text-sm text-gray-700"><span className="font-semibold text-gray-900">Team override.</span> {d.rules.overridePct.subscription}% of subscription and report net, {d.rules.overridePct.rent}% of rent income, from your team&apos;s paying customers. It never reduces your clerks&apos; pay.</li>}
        </ul>
        <p className="mt-3 break-words text-xs text-gray-500">Overrides and incentives are added up on the 2nd and paid automatically to your M-PESA number from {formatKes(d.payout.minPayoutMinor)}. Smaller amounts carry forward. Next run: {d.payout.nextRun}.</p>
      </Card>
    </div>
  );
}

// ----------------------------------------------------------------------------------- approvals and team
function Pending({ d, reload }: { d: NetDashboardOut; reload: () => void }) {
  const [act, setAct] = useState<{ code: string; name: string; rank: Rank; action: NetDecision } | null>(null);
  return (
    <Card title={`Waiting for approval (${d.pending.length})`}>
      <ul className="min-w-0 divide-y divide-gray-100">
        {d.pending.map((p) => (
          <li key={p.deskCode} className="flex min-w-0 flex-wrap items-center justify-between gap-2 py-2">
            <div className="min-w-0"><p className="break-words text-sm font-semibold text-gray-900">{p.name} <span className="font-normal text-gray-500">{p.deskCode}</span></p><p className="break-words text-xs text-gray-500">{ROLE_LABEL[p.rank]} · applied {formatDateTime(p.createdAt)}</p></div>
            <div className="flex gap-2"><button type="button" className={buttonClass.primary} onClick={() => setAct({ code: p.deskCode, name: p.name, rank: p.rank, action: "approve" })}>Approve</button><button type="button" className={buttonClass.secondary} onClick={() => setAct({ code: p.deskCode, name: p.name, rank: p.rank, action: "reject" })}>Reject</button></div>
          </li>
        ))}
      </ul>
      <ActionModal act={act} onClose={() => setAct(null)} onDone={() => { setAct(null); reload(); }} />
    </Card>
  );
}

function Team({ d, reload, approver }: { d: NetDashboardOut; reload: () => void; approver: boolean }) {
  const [members, setMembers] = useState<NetMember[] | null>(null);
  const [cursor, setCursor] = useState<number | undefined>();
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [act, setAct] = useState<{ code: string; name: string; rank: Rank; action: NetDecision } | null>(null);

  const load = async (more: boolean) => {
    setBusy(true); setError(null);
    try {
      const r = await deskApi.net.team({ ...(search.trim() ? { search: search.trim() } : {}), ...(more && cursor ? { cursor } : {}) });
      setMembers((cur) => (more && cur ? [...cur, ...r.members] : r.members)); setCursor(r.nextCursor);
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  const cols: Column<NetMember>[] = [
    { key: "who", header: "Agent", primary: true, cell: (m) => <span className="break-words">{m.name} <span className="text-gray-500">{m.deskCode}</span></span> },
    { key: "role", header: "Role", cell: (m) => ROLE_LABEL[m.rank] },
    { key: "status", header: "Status", cell: (m) => <Badge tone={STATUS_TONE[m.status]}>{m.status}</Badge> },
    { key: "cust", header: "Customers", align: "right", cell: (m) => m.customers },
    { key: "rev", header: "This month", align: "right", cell: (m) => `${formatKes(m.monthNetMinor)} (${m.monthPayments})` },
    ...(approver ? [{ key: "act", header: "", cell: (m: NetMember) => (
      <div className="flex min-w-0 flex-wrap gap-1">
        {actionsFor(m.status, m.rank, d.role).map((a) => <button key={a} type="button" className={cn(buttonClass.secondary, "px-2 py-1 text-xs")} onClick={() => setAct({ code: m.deskCode, name: m.name, rank: m.rank, action: a })}>{ACTION_LABEL[a]}</button>)}
      </div>) }] : []),
  ];
  return (
    <Card title="My team">
      <form className="mb-3 flex min-w-0 gap-2" onSubmit={(ev: FormEvent) => { ev.preventDefault(); void load(false); }}>
        <input className={inputClass} placeholder="Search name, code or phone" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search team" />
        <button type="submit" className={buttonClass.primary} disabled={busy}>{members === null ? "Show team" : "Search"}</button>
      </form>
      {error && <p role="alert" className="mb-2 break-words text-sm text-red-700">{error}</p>}
      {members !== null && <DataTable columns={cols} rows={members} rowKey={(m) => m.deskCode} empty={<p className="py-6 text-center text-sm text-gray-500">No agents in your team yet. Invite someone below.</p>} />}
      {cursor !== undefined && <button type="button" className={cn(buttonClass.secondary, "mt-3")} disabled={busy} onClick={() => void load(true)}>Load more</button>}
      <ActionModal act={act} onClose={() => setAct(null)} onDone={() => { setAct(null); reload(); void load(false); }} />
    </Card>
  );
}

function ActionModal({ act, onClose, onDone }: { act: { code: string; name: string; rank: Rank; action: NetDecision } | null; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState(""); const [upline, setUpline] = useState(""); const [contract, setContract] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  if (!act) return null;
  const submit = async () => {
    setBusy(true); setError(null);
    try {
      await deskApi.net.decide({ deskCode: act.code, action: act.action, ...(reason.trim() ? { reason: reason.trim() } : {}), ...(act.action === "assign" ? { uplineCode: upline.trim() } : {}), ...(contract.trim() ? { contractRef: contract.trim() } : {}) });
      setReason(""); setUpline(""); setContract(""); onDone();
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Modal open title={`${ACTION_LABEL[act.action]}: ${act.name}`} onClose={onClose}
      footer={<button type="button" className={cn(buttonClass.primary, "w-full")} disabled={busy} onClick={() => void submit()}>{busy ? "Working…" : "Confirm"}</button>}>
      <div className="min-w-0 space-y-3">
        <p className="break-words text-sm text-gray-700">{act.code} · {ROLE_LABEL[act.rank]}</p>
        {needsReason(act.action) && <FormField label="Reason" htmlFor="net-reason"><input id="net-reason" className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} /></FormField>}
        {act.action === "assign" && <FormField label="New upline's desk code" htmlFor="net-up" hint="A senior for a clerk, a lead for a senior, an admin for a lead."><input id="net-up" className={inputClass} value={upline} onChange={(e) => setUpline(e.target.value.toUpperCase())} placeholder="COG-0123" /></FormField>}
        {act.action === "approve" && act.rank === "admin" && <FormField label="Signed contract reference" htmlFor="net-contract"><input id="net-contract" className={inputClass} value={contract} onChange={(e) => setContract(e.target.value)} maxLength={80} /></FormField>}
        {error && <p role="alert" className="break-words rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------------------------------- invite
function Invite({ role }: { role: Rank }) {
  const roles = INVITABLE[role];
  const [r, setR] = useState<NetworkRole>(roles[roles.length - 1]);
  const [phone, setPhone] = useState(""); const [name, setName] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [done, setDone] = useState<string | null>(null);
  const send = async (ev: FormEvent) => {
    ev.preventDefault(); setBusy(true); setError(null); setDone(null);
    try {
      const out = await deskApi.net.invite({ role: r, phone, ...(name.trim() ? { name: name.trim() } : {}) });
      setDone(`Invite ${out.inviteCode} created${out.smsSent ? " and sent by SMS" : ". The SMS could not be sent, so share the code yourself"}. It expires ${formatDateTime(out.expiresAt)}.`);
      setPhone(""); setName("");
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Card title="Invite an agent">
      <form className="min-w-0 space-y-3" onSubmit={(ev) => void send(ev)} noValidate>
        <p className="break-words text-sm text-gray-600">They finish a normal sign-up with email or phone verification, and still need approval, whoever adds them. Safaricom numbers only.</p>
        <FormField label="Role" htmlFor="inv-role"><select id="inv-role" className={inputClass} value={r} onChange={(e) => setR(e.target.value as NetworkRole)}>{roles.map((x) => <option key={x} value={x}>{ROLE_LABEL[x]}</option>)}</select></FormField>
        <FormField label="Their name (optional)" htmlFor="inv-name"><input id="inv-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></FormField>
        <FormField label="Their Safaricom number" htmlFor="inv-phone"><input id="inv-phone" className={inputClass} value={phone} onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))} type="tel" inputMode="tel" maxLength={PHONE_MAX_INPUT_LENGTH} placeholder="0712 345 678" /></FormField>
        {error && <p role="alert" className="break-words rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {done && <p role="status" className="break-words rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{done}</p>}
        <button type="submit" className={buttonClass.primary} disabled={busy || !phone}>{busy ? "Sending…" : "Send invite"}</button>
      </form>
    </Card>
  );
}
