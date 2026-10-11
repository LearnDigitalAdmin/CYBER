import { useState } from "react";
import { deskApi, DeskApiError, REQUEST_CATEGORIES } from "../../api";
import { FormField, Modal, buttonClass, inputClass } from "../../ui";
import { textareaClass } from "./RequestSheet";
import { MESSAGE_MAX, SUBJECT_MAX, categoryLabel, validateNewRequest } from "./logic";
import type { NewRequestErrors } from "./logic";

/** A desk asking the company's top desk for help (`createRequest`). */
export default function ContactSamuhia({ open, onClose, onSent }: { open: boolean; onClose: () => void; onSent: () => void }) {
  const [category, setCategory] = useState<string>(REQUEST_CATEGORIES[0]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<NewRequestErrors>({});
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    const v = validateNewRequest({ category, subject, message }, REQUEST_CATEGORIES);
    setErrors(v.errors);
    if (!v.ok) return;
    setBusy(true); setServerError(null);
    try {
      await deskApi.createRequest({ category: v.value.category as (typeof REQUEST_CATEGORIES)[number], subject: v.value.subject, message: v.value.message });
      setSubject(""); setMessage(""); setCategory(REQUEST_CATEGORIES[0]); setErrors({});
      onSent();
    } catch (e) {
      setServerError(e instanceof DeskApiError ? e.message : "Could not send your message. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title="Contact Samuhia" onClose={() => { if (!busy) onClose(); }}
      footer={
        <>
          <button type="button" onClick={() => void submit()} disabled={busy} className={buttonClass.primary}>{busy ? "Sending…" : "Send message"}</button>
          <button type="button" onClick={onClose} disabled={busy} className={buttonClass.secondary}>Cancel</button>
        </>
      }>
      <div className="min-w-0 space-y-4">
        <p className="break-words text-sm text-gray-600">Ask the Samuhia team for help with your desk, a customer or a payment. We reply in the Requests tab.</p>
        <FormField label="Topic" htmlFor="cs-category" error={errors.category}>
          <select id="cs-category" value={category} onChange={(e) => setCategory(e.target.value)} disabled={busy} className={inputClass}>
            {REQUEST_CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
          </select>
        </FormField>
        <FormField label="Subject" htmlFor="cs-subject" error={errors.subject}>
          <input id="cs-subject" value={subject} maxLength={SUBJECT_MAX + 20} disabled={busy} onChange={(e) => setSubject(e.target.value)} className={inputClass} placeholder="In a few words" />
        </FormField>
        <FormField label="Message" htmlFor="cs-message" error={errors.message} hint={`${message.trim().length}/${MESSAGE_MAX} characters`}>
          <textarea id="cs-message" value={message} maxLength={MESSAGE_MAX + 200} disabled={busy} onChange={(e) => setMessage(e.target.value)} className={textareaClass} placeholder="What do you need help with?" />
        </FormField>
        {serverError && <p role="alert" className="break-words rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{serverError}</p>}
      </div>
    </Modal>
  );
}
