import { useState } from "react";
import { deskApi, type QuoteServiceOut } from "../../api";
import { Card, FormField, buttonClass, inputClass } from "../../ui";
import { AudienceField, MessageField } from "./fields";
import { messageOf } from "./lib/messages";
import { buildSchedule, describeSchedule, nairobiNow, SCHEDULE_KINDS, WEEKDAYS, type BuiltSchedule, type ScheduleKind } from "./scheduleFormat";
import { messageProblem } from "./sms";
import { ServiceCheckout } from "./ServiceCheckout";

const KIND_LABEL: Record<ScheduleKind, string> = { once: "Once", daily: "Every day", weekly: "Every week", monthly: "Every month" };
const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

/** Schedule an SMS on the customer's account: quote → draft → pay → live status (no customer OTP: nothing is sent today). */
export function ScheduleForm({ sessionId, audiences }: { sessionId: string; audiences: string[] }) {
  const [name, setName] = useState("");
  const [audience, setAudience] = useState("");
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState<ScheduleKind>("once");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [days, setDays] = useState<number[]>([]);
  const [quote, setQuote] = useState<{ q: QuoteServiceOut; schedule: BuiltSchedule } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const text = message.trim();
  const label = name.trim();
  const toggleDay = (n: number) => setDays((d) => (d.includes(n) ? d.filter((x) => x !== n) : [...d, n]));
  const today = nairobiNow(Date.now()).slice(0, 10);

  async function review() {
    setError(null);
    const built = buildSchedule({ kind, date, time, days }, Date.now());
    if (!built.ok) { setError(built.error); return; }
    setBusy(true);
    try { setQuote({ q: await deskApi.quoteService({ sessionId, serviceType: "schedule_setup", params: {} }), schedule: built.schedule }); }
    catch (e) { setError(messageOf(e)); }
    finally { setBusy(false); }
  }

  if (quote) {
    const { q, schedule } = quote;
    return (
      <ServiceCheckout
        sessionId={sessionId} quote={q} label="Scheduled SMS" doneText="The message is scheduled on the customer's account."
        details={<><p><span className="font-semibold">{label}</span> · to {audience}</p><p className="mt-1">{describeSchedule(schedule)}</p><p className="mt-1 whitespace-pre-wrap break-words"><span className="font-semibold">Message:</span> {text}</p></>}
        saveDraft={async () => { await deskApi.saveDraft({ ticketId: q.ticketId, payload: { name: label, message: text, audience, schedule } }); }}
        onReset={() => { setQuote(null); setError(null); }}
      />
    );
  }
  const valid = label.length >= 1 && label.length <= 60 && audience !== "" && messageProblem(message) === null && time !== "";
  return (
    <Card title="Schedule an SMS">
      <div className="min-w-0 space-y-4">
        <FormField label="Name" htmlFor="sch-name" hint="Shown to the customer in their schedule list.">
          <input id="sch-name" className={inputClass} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} disabled={busy} />
        </FormField>
        <AudienceField id="sch-audience" value={audience} onChange={setAudience} audiences={audiences} disabled={busy} />
        <MessageField id="sch-message" value={message} onChange={setMessage} disabled={busy} />
        <FormField label="How often" htmlFor="sch-kind">
          <select id="sch-kind" className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as ScheduleKind)} disabled={busy}>
            {SCHEDULE_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
        </FormField>
        <div className="grid min-w-0 grid-cols-1 gap-4 min-[420px]:grid-cols-2">
          {kind === "once" && (
            <FormField label="Date" htmlFor="sch-date"><input id="sch-date" type="date" min={today} className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} disabled={busy} /></FormField>
          )}
          <FormField label="Time (Nairobi)" htmlFor="sch-time"><input id="sch-time" type="time" className={inputClass} value={time} onChange={(e) => setTime(e.target.value)} disabled={busy} /></FormField>
        </div>
        {kind === "weekly" && (
          <fieldset className="min-w-0"><legend className="mb-1 text-sm font-medium text-gray-800">On these days</legend>
            <div className="flex min-w-0 flex-wrap gap-2">
              {WEEKDAYS.map((d) => (
                <button key={d.n} type="button" aria-pressed={days.includes(d.n)} onClick={() => toggleDay(d.n)} disabled={busy}
                  className={`h-11 min-w-[3rem] rounded-xl border px-3 text-sm font-semibold ${days.includes(d.n) ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 bg-white text-gray-800"}`}>{d.label}</button>
              ))}
            </div>
          </fieldset>
        )}
        {kind === "monthly" && (
          <fieldset className="min-w-0"><legend className="mb-1 text-sm font-medium text-gray-800">On these days of the month</legend>
            <div className="grid min-w-0 grid-cols-7 gap-1.5">
              {MONTH_DAYS.map((n) => (
                <button key={n} type="button" aria-pressed={days.includes(n)} onClick={() => toggleDay(n)} disabled={busy}
                  className={`h-10 rounded-lg border text-sm font-semibold ${days.includes(n) ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 bg-white text-gray-800"}`}>{n}</button>
              ))}
            </div>
          </fieldset>
        )}
        {error && <p role="alert" className="break-words text-sm text-red-700">{error}</p>}
        <button type="button" className={buttonClass.primary} disabled={!valid || busy} onClick={() => void review()}>{busy ? "Checking…" : "Review price"}</button>
      </div>
    </Card>
  );
}
