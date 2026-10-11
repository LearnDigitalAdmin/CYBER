import { useState } from "react";
import { deskApi } from "../../api";
import { buttonClass, inputClass } from "../../ui";
import { messageOf } from "../comms/lib/messages";
import { isConfirmationCode } from "./supportLogic";

/** The customer reads the 6-digit code they were SMSed to the agent, who enters it here. */
export function CodeEntry({ id, onConfirmed }: { id: string; onConfirmed: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function confirm() {
    setBusy(true); setError(null);
    try { await deskApi.confirmSupport({ id, code: code.trim() }); setCode(""); onConfirmed(); }
    catch (e) { setError(messageOf(e)); }
    finally { setBusy(false); }
  }
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex min-w-0 items-start gap-2">
        <input aria-label="Customer's 6-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6-digit code"
          className={inputClass} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} disabled={busy} />
        <button type="button" className={buttonClass.primary} disabled={!isConfirmationCode(code) || busy} onClick={() => void confirm()}>{busy ? "Checking…" : "Confirm"}</button>
      </div>
      {error && <p role="alert" className="break-words text-xs text-red-700">{error}</p>}
    </div>
  );
}
