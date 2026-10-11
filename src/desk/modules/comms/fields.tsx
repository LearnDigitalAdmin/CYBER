import { countSms, messageProblem, SMS_MAX_CHARS } from "./sms";
import { FormField, inputClass } from "../../ui";
import { textareaClass } from "./textarea";

/** Message box with the live character and segment counter. */
export function MessageField({ id, value, onChange, disabled }: { id: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const c = countSms(value);
  const problem = value.length > 0 ? messageProblem(value) : null;
  return (
    <FormField label="Message" htmlFor={id} error={problem}
      hint={c.encoding === "Unicode" && c.specials.length > 0 ? `“${c.specials.join(" ")}” switches this message to Unicode: only 70 characters fit in one SMS.` : undefined}>
      <textarea id={id} className={textareaClass} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} maxLength={SMS_MAX_CHARS + 50} />
      <p className="mt-1 break-words text-xs text-gray-600" aria-live="polite">
        {c.chars} character{c.chars === 1 ? "" : "s"} · {c.segments} SMS segment{c.segments === 1 ? "" : "s"} ({c.encoding}, {c.perSegment} per segment) · {c.remaining} left in this segment
      </p>
    </FormField>
  );
}

/** Only audiences the customer's account offers; nothing is preselected so a large send is always a deliberate choice. */
export function AudienceField({ id, value, onChange, audiences, disabled }: { id: string; value: string; onChange: (v: string) => void; audiences: string[]; disabled?: boolean }) {
  return (
    <FormField label="Who should receive it" htmlFor={id}>
      <select id={id} className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        <option value="">Choose an audience…</option>
        {audiences.map((a) => <option key={a} value={a}>{a}</option>)}
      </select>
    </FormField>
  );
}
