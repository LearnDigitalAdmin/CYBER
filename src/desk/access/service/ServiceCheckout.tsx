import { useRef, useState } from "react";
import { deskApi, formatDateTime, formatKes } from "../../api";
import type { QuoteServiceOut, ServiceType } from "../../api";
import { Badge, Card, FormField, buttonClass, inputClass } from "../../ui";
import { errorMessage } from "../errors";
import { normalizeKenyaPhone, phoneProblem, sanitizePhoneInput, PHONE_MAX_INPUT_LENGTH } from "../phone";
import { useNow } from "../useActiveSession";
import { payloadProblem } from "./payload";
import { useTicket } from "./useTicket";

const RESEND_AFTER_MS = 45_000;
const STALL_AFTER_MS = 25_000;

export interface ServiceCheckoutProps {
  sessionId: string;
  serviceType: ServiceType;
  /** Quote parameters per the contract: import_excel {rowCount}; manual_entry {recordCount}. */
  params: Record<string, number | string>;
  /** Saved as the ticket draft once quoted; executed by the backend only after payment succeeds. */
  payload: Record<string, unknown>;
  customerName: string;
  /** What is being bought, for the receipt, e.g. "Import of 120 members". */
  description: string;
  /** Lets the agent change the records. Only offered before money is requested, or after a failed attempt. */
  onBack: () => void;
  /** After a completed service: start another. */
  onFinish: () => void;
}

type Prep = { k: "idle" } | { k: "quoting" } | { k: "saving"; quote: QuoteServiceOut } | { k: "ready"; quote: QuoteServiceOut }
  | { k: "charging"; quote: QuoteServiceOut } | { k: "sent"; quote: QuoteServiceOut; sentAt: number };

/** Quote -> save the draft -> customer's M-Pesa prompt -> live status -> receipt. Nothing is committed before payment. */
export function ServiceCheckout(p: ServiceCheckoutProps) {
  const [prep, setPrep] = useState<Prep>({ k: "idle" });
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const quote = prep.k === "idle" || prep.k === "quoting" ? null : prep.quote;
  const ticket = useTicket(quote?.ticketId ?? null);
  const now = useNow(1000);

  const saveDraft = async (q: QuoteServiceOut) => {
    setPrep({ k: "saving", quote: q }); setError(null);
    try {
      await deskApi.saveDraft({ ticketId: q.ticketId, payload: p.payload });
      setPrep({ k: "ready", quote: q });
    } catch (e) {
      setError(errorMessage(e)); setPrep({ k: "saving", quote: q });
    }
  };

  const getPrice = async () => {
    if (busy.current) return;
    const tooBig = payloadProblem(p.payload);
    if (tooBig) { setError(tooBig); return; }
    busy.current = true; setPrep({ k: "quoting" }); setError(null);
    try {
      const q = await deskApi.quoteService({ sessionId: p.sessionId, serviceType: p.serviceType, params: p.params });
      busy.current = false;
      await saveDraft(q);
    } catch (e) {
      setError(errorMessage(e)); setPrep({ k: "idle" });
    } finally { busy.current = false; }
  };

  const pay = async (q: QuoteServiceOut) => {
    if (busy.current) return;
    const normal = normalizeKenyaPhone(phone.trim());
    if (!normal) { setPhoneError(phoneProblem(phone)); return; }
    setPhoneError(null); setError(null); busy.current = true;
    setPrep({ k: "charging", quote: q });
    try {
      await deskApi.chargeTicket({ ticketId: q.ticketId, phone: normal });
      setPrep({ k: "sent", quote: q, sentAt: Date.now() });
    } catch (e) {
      setError(errorMessage(e)); setPrep({ k: "ready", quote: q });
    } finally { busy.current = false; }
  };

  const status = ticket?.status;

  // ------------------------------------------------------------------ committed: receipt
  if (quote && status === "committed" && ticket) {
    return <Receipt p={p} quote={quote} paidAt={ticket.updatedAt} reference={ticket.paystackRef} ticketId={ticket.ticketId} />;
  }

  // ------------------------------------------------------------------ before any quote
  if (prep.k === "idle" || prep.k === "quoting") {
    return (
      <Card title="Review and pay">
        <div className="min-w-0 space-y-4">
          <p className="break-words text-sm text-gray-700">{p.description} for <span className="font-semibold">{p.customerName}</span>.</p>
          <p className="break-words text-sm text-gray-600">
            You will see the price next. Nothing is added to the customer's account until the payment succeeds.
          </p>
          {error && <p role="alert" className="break-words rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <div className="flex min-w-0 flex-wrap gap-2">
            <button type="button" className={`${buttonClass.primary} flex-1 sm:flex-none`} disabled={prep.k === "quoting"} onClick={() => void getPrice()}>
              {prep.k === "quoting" ? "Getting price…" : "Get price"}
            </button>
            <button type="button" className={buttonClass.secondary} onClick={p.onBack} disabled={prep.k === "quoting"}>Change records</button>
          </div>
        </div>
      </Card>
    );
  }

  const q = prep.quote;
  const waiting = status === "awaiting_payment" || (prep.k === "sent" && (status === undefined || status === "draft"));
  const sentAt = prep.k === "sent" ? prep.sentAt : 0;
  const sinceSent = sentAt ? now - sentAt : 0;

  return (
    <Card title="Review and pay">
      <div className="min-w-0 space-y-4">
        <PriceLines quote={q} />

        {prep.k === "saving" && (
          <div className="min-w-0 space-y-3">
            {error ? (
              <>
                <p role="alert" className="break-words rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
                <button type="button" className={buttonClass.primary} onClick={() => void saveDraft(q)}>Try saving again</button>
              </>
            ) : (
              <p role="status" className="text-sm text-gray-700">Saving your records…</p>
            )}
          </div>
        )}

        {(prep.k === "ready" || prep.k === "charging") && !waiting && status !== "paid" && status !== "failed" && status !== "expired" && (
          <div className="min-w-0 space-y-3">
            <FormField label="Customer's M-Pesa number" htmlFor="pay-phone" hint="They get a prompt on this phone and enter their M-Pesa PIN." error={phoneError}>
              <input id="pay-phone" className={inputClass} type="tel" inputMode="tel" autoComplete="tel" placeholder="0712 345 678"
                value={phone} onChange={(e) => { setPhone(sanitizePhoneInput(e.target.value)); setPhoneError(null); }} maxLength={PHONE_MAX_INPUT_LENGTH} disabled={prep.k === "charging"} />
            </FormField>
            {error && <p role="alert" className="break-words rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <div className="flex min-w-0 flex-wrap gap-2">
              <button type="button" className={`${buttonClass.primary} flex-1 sm:flex-none`} disabled={prep.k === "charging"} onClick={() => void pay(q)}>
                {prep.k === "charging" ? "Sending prompt…" : `Pay ${formatKes(q.amountMinor)} with M-Pesa`}
              </button>
              <button type="button" className={buttonClass.secondary} onClick={p.onBack} disabled={prep.k === "charging"}>Change records</button>
            </div>
          </div>
        )}

        {waiting && (
          <div className="min-w-0 space-y-3" role="status" aria-live="polite">
            <div className="flex min-w-0 items-center gap-3 rounded-xl bg-blue-50 p-3">
              <div className="h-6 w-6 shrink-0 animate-spin rounded-full border-b-2 border-blue-600" />
              <p className="min-w-0 break-words text-sm text-blue-900">Waiting for the customer to enter their M-Pesa PIN…</p>
            </div>
            {ticket === undefined && sinceSent > STALL_AFTER_MS && (
              <p className="break-words text-sm text-amber-800">We cannot read the payment status yet. Do not charge again. Refresh this page, or check with Samuhia.</p>
            )}
            {sinceSent > RESEND_AFTER_MS && (
              <div className="min-w-0 space-y-2">
                <p className="break-words text-sm text-gray-600">No prompt on the phone? You can send it again.</p>
                {error && <p role="alert" className="break-words text-sm text-red-600">{error}</p>}
                <button type="button" className={buttonClass.secondary} disabled={prep.k === "charging"} onClick={() => void pay(q)}>
                  {prep.k === "charging" ? "Sending…" : "Send prompt again"}
                </button>
              </div>
            )}
          </div>
        )}

        {status === "paid" && (
          <div className="flex min-w-0 items-center gap-3 rounded-xl bg-emerald-50 p-3" role="status" aria-live="polite">
            <div className="h-6 w-6 shrink-0 animate-spin rounded-full border-b-2 border-emerald-600" />
            <p className="min-w-0 break-words text-sm text-emerald-900">Payment received. Adding the records to {p.customerName}'s account…</p>
          </div>
        )}

        {status === "expired" && (
          <div className="min-w-0 space-y-3">
            <p role="alert" className="break-words rounded-xl bg-amber-50 p-3 text-sm text-amber-900">The payment request expired before it was paid.</p>
            {error && <p role="alert" className="break-words text-sm text-red-600">{error}</p>}
            <div className="flex min-w-0 flex-wrap gap-2">
              <button type="button" className={buttonClass.primary} disabled={prep.k === "charging"} onClick={() => void pay(q)}>Send a new prompt</button>
              <button type="button" className={buttonClass.secondary} onClick={p.onBack}>Change records</button>
            </div>
          </div>
        )}

        {status === "failed" && (
          <div className="min-w-0 space-y-3" role="alert">
            <div className="min-w-0 rounded-xl bg-red-50 p-3 text-sm text-red-800">
              <p className="break-words font-semibold">This could not be completed.</p>
              <p className="mt-1 break-words">{ticket?.failureReason || "The service did not finish."}</p>
            </div>
            <p className="break-words text-sm text-gray-700">
              If the customer's money was taken, do not charge them again. Contact Samuhia and quote reference{" "}
              <span className="font-mono font-semibold">{ticket?.paystackRef ?? ticket?.ticketId}</span>.
            </p>
            <button type="button" className={buttonClass.secondary} onClick={p.onBack}>Back to the records</button>
          </div>
        )}
      </div>
    </Card>
  );
}

function PriceLines({ quote }: { quote: QuoteServiceOut }) {
  return (
    <dl className="min-w-0 rounded-xl border border-gray-200 p-3 text-sm">
      {quote.breakdown.map((l) => (
        <div key={l.label} className="flex min-w-0 justify-between gap-3 py-1">
          <dt className="min-w-0 break-words text-gray-600">{l.label}</dt>
          <dd className="shrink-0 tabular-nums text-gray-900">{formatKes(l.amountMinor)}</dd>
        </div>
      ))}
      <div className="mt-1 flex min-w-0 justify-between gap-3 border-t border-gray-100 pt-2 font-semibold">
        <dt>Total</dt><dd className="shrink-0 tabular-nums">{formatKes(quote.amountMinor)}</dd>
      </div>
    </dl>
  );
}

function Receipt({ p, quote, paidAt, reference, ticketId }: {
  p: ServiceCheckoutProps; quote: QuoteServiceOut; paidAt: number; reference?: string; ticketId: string;
}) {
  const [copied, setCopied] = useState(false);
  const text = [
    "Samuhia Desk receipt", p.description, `Customer: ${p.customerName}`, `Amount: ${formatKes(quote.amountMinor)}`,
    `Date: ${formatDateTime(paidAt)}`, `Reference: ${reference ?? ticketId}`,
  ].join("\n");
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); }
  };
  return (
    <Card title="Done">
      <div className="min-w-0 space-y-4">
        <div className="flex min-w-0 items-center gap-2"><Badge tone="green">Paid and added</Badge></div>
        <dl className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
          <dt className="text-gray-500">Service</dt><dd className="min-w-0 break-words text-right text-gray-900">{p.description}</dd>
          <dt className="text-gray-500">Customer</dt><dd className="min-w-0 break-words text-right text-gray-900">{p.customerName}</dd>
          <dt className="text-gray-500">Amount</dt><dd className="min-w-0 text-right font-semibold tabular-nums text-gray-900">{formatKes(quote.amountMinor)}</dd>
          <dt className="text-gray-500">Date</dt><dd className="min-w-0 text-right text-gray-900">{formatDateTime(paidAt)}</dd>
          <dt className="text-gray-500">Reference</dt><dd className="min-w-0 break-all text-right font-mono text-xs text-gray-900">{reference ?? ticketId}</dd>
        </dl>
        <div className="flex min-w-0 flex-wrap gap-2">
          <button type="button" className={`${buttonClass.primary} flex-1 sm:flex-none`} onClick={p.onFinish}>Do another</button>
          <button type="button" className={buttonClass.secondary} onClick={() => void copy()}>{copied ? "Copied" : "Copy receipt"}</button>
        </div>
      </div>
    </Card>
  );
}
