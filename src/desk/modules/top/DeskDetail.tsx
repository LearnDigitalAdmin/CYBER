import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { DESK_TOP_CODE, DOC_KINDS, deskApi, DeskApiError, formatDateTime, formatKes, summaryTopRank, summaryTopStatus } from "../../api";
import type { AgentStatus, DocKind, Rank, TopGetDeskOut } from "../../api";
import { Badge, Card, EmptyState, FormField, Page, Stat, StatGrid, buttonClass, inputClass } from "../../ui";
import DocViewer from "./DocViewer";
import Notice from "./Notice";
import ReauthBox from "./ReauthBox";
import TopOtpDialog from "./TopOtpDialog";
import { DOC_NAMES, RANKS, RANK_LABEL, SETTABLE_STATUSES, STATUS_LABEL, STATUS_TONE, isStaleSignIn, validateReason } from "./logic";

const textareaClass =
  "block min-h-24 w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 placeholder-gray-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200";

type Pending = { kind: "status"; status: AgentStatus; reason: string } | { kind: "rank"; rank: Rank };

export default function DeskDetail() {
  const code = decodeURIComponent(useParams().code ?? "");
  const [data, setData] = useState<TopGetDeskOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [viewDoc, setViewDoc] = useState<DocKind | null>(null);
  const [newStatus, setNewStatus] = useState<AgentStatus>("active");
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [newRank, setNewRank] = useState<Rank>("clerk");
  const [pending, setPending] = useState<Pending | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null); setStale(false);
    try {
      const out = await deskApi.top.getDesk({ deskCode: code });
      setData(out); setNewStatus(out.desk.status === "applied" ? "training" : out.desk.status); setNewRank(out.desk.rank);
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (isStaleSignIn(err.code, err.message)) setStale(true);
      else setError(e instanceof DeskApiError ? e.message : "Could not load this desk.");
    } finally { setLoading(false); }
  }, [code]);
  useEffect(() => { void load(); }, [load]);

  const back = <Link to="/desk/top" className={buttonClass.secondary}><ArrowLeft size={16} /> All desks</Link>;

  if (loading && !data) return <Page title={code} actions={back}><div className="flex justify-center py-10" role="status" aria-label="Loading"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" /></div></Page>;
  if (!data) {
    return (
      <Page title={code} actions={back}>
        {stale && <ReauthBox onDone={() => void load()} />}
        {error && <><Notice tone="error">{error}</Notice><button type="button" onClick={() => void load()} className={buttonClass.secondary}>Try again</button></>}
      </Page>
    );
  }

  const { desk } = data;
  const isTop = desk.deskCode === DESK_TOP_CODE;

  function askStatus() {
    const v = validateReason(reason);
    if (!v.ok) { setReasonError(v.error); return; }
    setReasonError(null);
    setPending({ kind: "status", status: newStatus, reason: v.value });
  }

  const dialog = pending && {
    title: pending.kind === "status" ? "Change desk status" : "Change desk rank",
    action: pending.kind === "status" ? ("set_desk_status" as const) : ("set_rank" as const),
    summary: pending.kind === "status" ? summaryTopStatus(desk.deskCode, pending.status) : summaryTopRank(desk.deskCode, pending.rank),
  };

  return (
    <Page title={`${desk.deskCode} · ${desk.name}`} subtitle="Review this desk, then change its status or rank. Each change needs a code." actions={back}>
      {notice && <Notice tone="ok">{notice}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}

      <Card title="Profile">
        <dl className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
          <Row k="Status"><Badge tone={STATUS_TONE[desk.status]}>{STATUS_LABEL[desk.status]}</Badge></Row>
          <Row k="Rank">{RANK_LABEL[desk.rank]}</Row>
          <Row k="Phone">{desk.phone}</Row>
          <Row k="Email">{desk.email}</Row>
          <Row k="ID number">{desk.idNumberMasked}</Row>
          <Row k="Ward">{desk.wardId}</Row>
          <Row k="Applied">{formatDateTime(desk.createdAt)}</Row>
          <Row k="Terms accepted">{desk.termsAcceptedAt ? formatDateTime(desk.termsAcceptedAt) : "Not yet"}</Row>
          {desk.statusReason && <Row k="Last reason">{desk.statusReason}</Row>}
        </dl>
      </Card>

      <Card title="Documents">
        <ul className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
          {DOC_KINDS.map((k) => {
            const d = data.docs.find((x) => x.kind === k);
            return (
              <li key={k} className="min-w-0 space-y-2 rounded-xl border border-gray-200 p-3">
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <p className="min-w-0 break-words text-sm font-semibold text-gray-900">{DOC_NAMES[k]}</p>
                  <Badge tone={d?.uploadedAt ? "green" : "amber"}>{d?.uploadedAt ? "Uploaded" : "Missing"}</Badge>
                </div>
                {d?.uploadedAt && <p className="break-words text-xs text-gray-500">{formatDateTime(d.uploadedAt)}</p>}
                <button type="button" disabled={!d?.uploadedAt} onClick={() => setViewDoc(k)} className={buttonClass.secondary}>View</button>
              </li>
            );
          })}
        </ul>
      </Card>

      <StatGrid>
        <Stat label="Settled" value={formatKes(data.earnings.settledMinor)} hint="Paid by Paystack's split" />
        <Stat label="Payable" value={formatKes(data.earnings.payableMinor)} tone={data.earnings.payableMinor > 0 ? "warn" : "default"} hint="Waiting for you to pay" />
        <Stat label="Paid" value={formatKes(data.earnings.paidMinor)} tone="good" hint="Transfers confirmed" />
      </StatGrid>

      <Card title="Payout accounts">
        {data.payoutAccounts.length === 0 ? <p className="text-sm text-gray-500">No payout accounts yet.</p> : (
          <ul className="min-w-0 space-y-2">
            {data.payoutAccounts.map((a) => (
              <li key={a.account} className="flex min-w-0 flex-wrap items-start justify-between gap-2 text-sm">
                <span className="min-w-0 break-words font-medium text-gray-900">{a.account === "main" ? "Main account" : `${a.account} account`}</span>
                <span className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                  <Badge tone={a.ready ? "green" : "amber"}>{a.ready ? "Ready" : "Not ready"}</Badge>
                  {!a.ready && a.reason && <span className="min-w-0 break-words text-xs text-gray-600">{a.reason}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Actions">
        {isTop ? <p className="text-sm text-gray-600">The top desk's own status and rank cannot be changed here.</p> : (
          <div className="min-w-0 space-y-6">
            <div className="min-w-0 space-y-3">
              <FormField label="Set status" htmlFor="top-status">
                <select id="top-status" value={newStatus} onChange={(e) => setNewStatus(e.target.value as AgentStatus)} className={inputClass}>
                  {SETTABLE_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </FormField>
              <FormField label="Reason" htmlFor="top-reason" error={reasonError} hint="Kept in the audit log.">
                <textarea id="top-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={textareaClass} />
              </FormField>
              <button type="button" onClick={askStatus} disabled={newStatus === desk.status} className={buttonClass.primary}>Change status…</button>
              {newStatus === desk.status && <p className="text-xs text-gray-500">Pick a different status to continue.</p>}
            </div>
            <div className="min-w-0 space-y-3 border-t border-gray-100 pt-4">
              <FormField label="Set rank" htmlFor="top-rank">
                <select id="top-rank" value={newRank} onChange={(e) => setNewRank(e.target.value as Rank)} className={inputClass}>
                  {RANKS.map((r) => <option key={r} value={r}>{RANK_LABEL[r]}</option>)}
                </select>
              </FormField>
              <button type="button" onClick={() => setPending({ kind: "rank", rank: newRank })} disabled={newRank === desk.rank} className={buttonClass.primary}>Change rank…</button>
            </div>
          </div>
        )}
      </Card>

      <Card title="Recent activity">
        {data.recentAudit.length === 0 ? <EmptyState title="No activity yet" /> : (
          <ul className="min-w-0 divide-y divide-gray-100 text-sm">
            {data.recentAudit.map((a, i) => (
              <li key={`${a.at}-${i}`} className="flex min-w-0 flex-wrap justify-between gap-2 py-2">
                <span className="min-w-0 break-words text-gray-900">{a.action}</span>
                <span className="text-gray-500">{formatDateTime(a.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <DocViewer deskCode={desk.deskCode} kind={viewDoc} onClose={() => setViewDoc(null)} />
      {pending && dialog && (
        <TopOtpDialog open title={dialog.title} action={dialog.action} summary={dialog.summary}
          confirmLabel={pending.kind === "status" ? "Confirm status change" : "Confirm rank change"}
          onClose={() => setPending(null)}
          execute={async (actionId, otp) => {
            if (pending.kind === "status") await deskApi.top.setDeskStatus({ deskCode: desk.deskCode, status: pending.status, reason: pending.reason, actionId, otp });
            else await deskApi.top.setRank({ deskCode: desk.deskCode, rank: pending.rank, actionId, otp });
            setNotice(pending.kind === "status" ? `${desk.deskCode} is now ${STATUS_LABEL[pending.status].toLowerCase()}.` : `${desk.deskCode} is now ${RANK_LABEL[pending.rank]}.`);
            if (pending.kind === "status") setReason("");
            await load();
          }} />
      )}
    </Page>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return <><dt className="text-gray-500">{k}</dt><dd className="min-w-0 break-words text-right text-gray-900">{children}</dd></>;
}
