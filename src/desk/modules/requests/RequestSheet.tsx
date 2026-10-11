import { useEffect, useState } from "react";
import { Phone } from "lucide-react";
import { deskApi, DeskApiError, formatDateTime } from "../../api";
import type { RequestStatus, RequestView } from "../../api";
import { Badge, FormField, Modal, buttonClass } from "../../ui";
import {
  REPLY_MAX, SOURCE_LABEL, STATUS_LABEL, STATUS_TONE, applyLocalUpdate, categoryLabel, sortedThread, statusActions, validateReply,
} from "./logic";

export const textareaClass =
  "block min-h-28 w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 placeholder-gray-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-gray-100";

/** Detail sheet: who asked, what they said, our replies, a reply form and the status actions. */
export default function RequestSheet({ request, agentCode, onClose, onChanged }: {
  request: RequestView | null; agentCode: string; onClose: () => void; onChanged: (updated: RequestView) => void;
}) {
  const [reply, setReply] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = request?.id;

  // A different request starts with a clean form.
  useEffect(() => { setReply(""); setReplyError(null); setError(null); setBusy(null); }, [id]);

  if (!request) return null;

  async function run(label: string, status: RequestStatus, response?: string) {
    if (!request || busy) return;
    setBusy(label); setError(null);
    try {
      await deskApi.updateRequest({ id: request.id, status, ...(response ? { response } : {}) });
      const at = Date.now();
      onChanged(applyLocalUpdate(request, status, response ? { text: response, byDeskCode: agentCode, at } : undefined));
      if (response) setReply("");
    } catch (e) {
      setError(e instanceof DeskApiError ? e.message : "Could not update this request. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  function sendReply(status: RequestStatus) {
    const v = validateReply(reply);
    if (!v.ok) { setReplyError(v.error); return; }
    setReplyError(null);
    void run(status === "closed" ? "reply-close" : "reply", status, v.value);
  }

  const thread = sortedThread(request);
  const actions = statusActions(request.status);
  const canReply = request.status !== "closed";

  return (
    <Modal open title={request.subject || categoryLabel(request.category)} onClose={() => { if (!busy) onClose(); }}
      footer={
        <>
          {canReply && (
            <>
              <button type="button" disabled={!!busy} onClick={() => sendReply("answered")} className={buttonClass.primary}>
                {busy === "reply" ? "Sending…" : "Send reply"}
              </button>
              <button type="button" disabled={!!busy} onClick={() => sendReply("closed")} className={buttonClass.secondary}>
                {busy === "reply-close" ? "Sending…" : "Reply & close"}
              </button>
            </>
          )}
          {actions.map((a) => (
            <button key={a.to} type="button" disabled={!!busy} onClick={() => void run(a.to, a.to)} className={buttonClass.secondary}>
              {busy === a.to ? "Saving…" : a.label}
            </button>
          ))}
        </>
      }
    >
      <div className="min-w-0 space-y-4">
        <div className="flex min-w-0 flex-wrap gap-2">
          <Badge tone={STATUS_TONE[request.status]}>{STATUS_LABEL[request.status]}</Badge>
          <Badge>{SOURCE_LABEL[request.source]}</Badge>
          <Badge>{categoryLabel(request.category)}</Badge>
        </div>

        <dl className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
          <dt className="text-gray-500">From</dt>
          <dd className="min-w-0 break-words text-right font-medium text-gray-900">{request.requesterName || "Unknown"}</dd>
          <dt className="text-gray-500">Phone</dt>
          <dd className="min-w-0 break-words text-right">
            {request.requesterPhone ? (
              <a href={`tel:${request.requesterPhone}`} className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline">
                <Phone size={14} />{request.requesterPhone}
              </a>
            ) : "Not given"}
          </dd>
          <dt className="text-gray-500">Customer</dt>
          <dd className="min-w-0 break-words text-right text-gray-900">{request.entityName || "—"} {request.entityCode && <span className="text-gray-500">({request.entityCode})</span>}</dd>
          <dt className="text-gray-500">Received</dt>
          <dd className="min-w-0 break-words text-right text-gray-900">{formatDateTime(request.createdAt)}</dd>
        </dl>

        <section aria-label="Message">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Message</h3>
          <p className="whitespace-pre-wrap break-words rounded-xl bg-gray-50 p-3 text-sm text-gray-900">{request.message}</p>
        </section>

        <section aria-label="Replies">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Replies</h3>
          {thread.length === 0 ? (
            <p className="text-sm text-gray-500">No replies yet.</p>
          ) : (
            <ol className="min-w-0 space-y-2">
              {thread.map((t, i) => (
                <li key={`${t.at}-${i}`} className="min-w-0 rounded-xl border border-gray-200 p-3">
                  <p className="text-xs text-gray-500">{t.byDeskCode} · {formatDateTime(t.at)}</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-900">{t.text}</p>
                </li>
              ))}
            </ol>
          )}
        </section>

        {canReply ? (
          <FormField label="Your reply" htmlFor="req-reply" error={replyError} hint={`${reply.trim().length}/${REPLY_MAX} characters. The customer sees this in their app.`}>
            <textarea id="req-reply" value={reply} maxLength={REPLY_MAX + 200} disabled={!!busy} onChange={(e) => setReply(e.target.value)}
              className={textareaClass} placeholder="Write your answer…" />
          </FormField>
        ) : (
          <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-600">This request is closed. Reopen it to reply.</p>
        )}

        {error && <p role="alert" className="break-words rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      </div>
    </Modal>
  );
}
