import { useState } from "react";
import { deskApi, SUPPORT_CATEGORIES, type ResolveEntityOut, type SupportCategory } from "../../api";
import { Card, FormField, buttonClass, inputClass } from "../../ui";
import { messageOf } from "../comms/lib/messages";
import { textareaClass } from "../comms/textarea";
import { CodeEntry } from "./CodeEntry";
import { categoryLabel, NOTES_MAX, notesProblem } from "./supportLogic";

type Step = { kind: "find" } | { kind: "details"; entity: ResolveEntityOut } | { kind: "code"; id: string; sentTo: string; entity: ResolveEntityOut } | { kind: "done"; entity: ResolveEntityOut };

/** Log a support visit for a customer, then confirm it with the code the customer reads out. */
export function LogVisitCard() {
  const [step, setStep] = useState<Step>({ kind: "find" });
  const [code, setCode] = useState("");
  const [category, setCategory] = useState<SupportCategory | "">("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => { setStep({ kind: "find" }); setCode(""); setCategory(""); setNotes(""); setError(null); };

  async function find() {
    setBusy(true); setError(null);
    try { setStep({ kind: "details", entity: await deskApi.resolveEntity({ code: code.trim() }) }); }
    catch (e) { setError(messageOf(e)); }
    finally { setBusy(false); }
  }
  async function log(entity: ResolveEntityOut) {
    if (!category) return;
    setBusy(true); setError(null);
    try {
      const out = await deskApi.logSupport({ entityKey: entity.entityKey, category, notes: notes.trim() });
      setStep({ kind: "code", id: out.id, sentTo: out.codeSentTo, entity });
    } catch (e) { setError(messageOf(e)); }
    finally { setBusy(false); }
  }

  return (
    <Card title="Log a support visit">
      <div className="min-w-0 space-y-4">
        {step.kind === "find" && (
          <>
            <FormField label="Customer code" htmlFor="sup-code" hint="SMC-0000 for a chama, the 8-digit KNEC code for a school, or PYL-0000 for a landlord.">
              <input id="sup-code" className={inputClass} value={code} autoCapitalize="characters" onChange={(e) => setCode(e.target.value)} disabled={busy} />
            </FormField>
            {error && <p role="alert" className="break-words text-sm text-red-700">{error}</p>}
            <button type="button" className={buttonClass.primary} disabled={code.trim().length < 4 || busy} onClick={() => void find()}>{busy ? "Looking up…" : "Find customer"}</button>
          </>
        )}
        {step.kind === "details" && (
          <>
            <p className="break-words text-sm text-gray-800"><span className="font-semibold">{step.entity.displayName}</span> · {step.entity.entityKey} · admin {step.entity.adminPhoneMasked}</p>
            {!step.entity.agentHasGrant ? (
              <p role="alert" className="break-words text-sm text-amber-800">This customer hasn't added your desk code yet. Ask them to add it under Settings → Support Agents, then look them up again.</p>
            ) : (
              <>
                <FormField label="What did you help with" htmlFor="sup-cat">
                  <select id="sup-cat" className={inputClass} value={category} onChange={(e) => setCategory(e.target.value as SupportCategory | "")} disabled={busy}>
                    <option value="">Choose a category…</option>
                    {SUPPORT_CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
                  </select>
                </FormField>
                <FormField label="Notes" htmlFor="sup-notes" error={notes.length > 0 ? notesProblem(notes) : null}>
                  <textarea id="sup-notes" className={textareaClass} value={notes} maxLength={NOTES_MAX + 100} onChange={(e) => setNotes(e.target.value)} disabled={busy} />
                </FormField>
                {error && <p role="alert" className="break-words text-sm text-red-700">{error}</p>}
                <button type="button" className={buttonClass.primary} disabled={!category || notesProblem(notes) !== null || busy} onClick={() => void log(step.entity)}>{busy ? "Sending code…" : "Log visit and send the customer a code"}</button>
              </>
            )}
            <button type="button" className={buttonClass.secondary} disabled={busy} onClick={reset}>Choose a different customer</button>
          </>
        )}
        {step.kind === "code" && (
          <>
            <p className="break-words text-sm text-gray-800">A 6-digit code was sent to {step.sentTo}. Ask {step.entity.displayName} to read it to you, then enter it below.</p>
            <CodeEntry id={step.id} onConfirmed={() => setStep({ kind: "done", entity: step.entity })} />
            <button type="button" className={buttonClass.secondary} onClick={reset}>Confirm later from the list</button>
          </>
        )}
        {step.kind === "done" && (
          <div className="min-w-0 space-y-3" role="status">
            <p className="break-words text-sm font-semibold text-emerald-800">{step.entity.displayName} confirmed this visit.</p>
            <button type="button" className={buttonClass.primary} onClick={reset}>Log another visit</button>
          </div>
        )}
      </div>
    </Card>
  );
}
