import { useState } from "react";
import { deskApi, summaryBulkSms, type QuoteServiceOut } from "../../api";
import { Card, buttonClass } from "../../ui";
import { AudienceField, MessageField } from "./fields";
import { messageOf } from "./lib/messages";
import { messageProblem } from "./sms";
import { ServiceCheckout } from "./ServiceCheckout";

/** Send a bulk reminder now: quote (the product counts the real recipients) → draft → customer OTP → pay → live status. */
export function ReminderForm({ sessionId, audiences }: { sessionId: string; audiences: string[] }) {
  const [audience, setAudience] = useState("");
  const [message, setMessage] = useState("");
  const [quote, setQuote] = useState<QuoteServiceOut | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const text = message.trim();
  const valid = audience !== "" && messageProblem(message) === null;

  async function check() {
    setBusy(true); setError(null);
    try { setQuote(await deskApi.quoteService({ sessionId, serviceType: "bulk_reminder", params: { audience, message: text } })); }
    catch (e) { setError(messageOf(e)); }
    finally { setBusy(false); }
  }

  if (quote) {
    return (
      <ServiceCheckout
        sessionId={sessionId} quote={quote} label="Bulk reminder" doneText="Your reminder has been sent to the customer's recipients."
        details={<><p><span className="font-semibold">To:</span> {audience}</p><p className="mt-1 whitespace-pre-wrap break-words"><span className="font-semibold">Message:</span> {text}</p></>}
        saveDraft={async () => { await deskApi.saveDraft({ ticketId: quote.ticketId, payload: { audience, message: text } }); }}
        otpSummary={summaryBulkSms}
        onReset={() => { setQuote(null); setError(null); }}
      />
    );
  }
  return (
    <Card title="Send a reminder now">
      <div className="min-w-0 space-y-4">
        <AudienceField id="rem-audience" value={audience} onChange={setAudience} audiences={audiences} disabled={busy} />
        <MessageField id="rem-message" value={message} onChange={setMessage} disabled={busy} />
        {error && <p role="alert" className="break-words text-sm text-red-700">{error}</p>}
        <button type="button" className={buttonClass.primary} disabled={!valid || busy} onClick={() => void check()}>
          {busy ? "Checking…" : "Check recipients and cost"}
        </button>
        <p className="break-words text-xs text-gray-500">The customer's own account counts the recipients, and the customer must approve the exact number with a one-time code before anything is sent.</p>
      </div>
    </Card>
  );
}
