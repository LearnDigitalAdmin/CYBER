import { useEffect, useState } from "react";
import { deskApi, DeskApiError } from "../../api";
import type { TopAction } from "../../api";
import { FormField, Modal, buttonClass, inputClass } from "../../ui";
import Notice from "./Notice";
import ReauthBox from "./ReauthBox";
import { OTP_RESEND_MS, isOtpShape, isStaleSignIn, needsNewCode } from "./logic";

/**
 * One reusable confirmation for every top-desk action: show exactly what will happen -> request a code (SMS to the top desk's
 * phone) -> enter it -> run the action with {actionId, otp}. The code is one-time, so the action runs at most once per code;
 * a failure that spent the code sends the person back to request a new one.
 */
export default function TopOtpDialog({ open, title, action, summary, confirmLabel, onClose, execute }: {
  open: boolean; title: string; action: TopAction; summary: string; confirmLabel: string;
  onClose: () => void;
  /** Runs the real action. Throw to show the error and keep the dialog open. Resolve to finish. */
  execute: (actionId: string, otp: string) => Promise<void>;
}) {
  const [step, setStep] = useState<"confirm" | "code">("confirm");
  const [actionId, setActionId] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState<"send" | "run" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  // Every time the dialog opens it starts from scratch.
  useEffect(() => {
    if (open) { setStep("confirm"); setActionId(null); setSentTo(""); setOtp(""); setBusy(null); setError(null); setStale(false); setSentAt(null); }
  }, [open, summary, action]);

  useEffect(() => {
    if (!open || sentAt === null) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [open, sentAt]);

  if (!open) return null;
  const resendIn = sentAt === null ? 0 : Math.max(0, Math.ceil((sentAt + OTP_RESEND_MS - now) / 1000));

  function fail(e: unknown, fallback: string) {
    const err = e as { code?: string; message?: string };
    const msg = e instanceof DeskApiError ? e.message : fallback;
    if (isStaleSignIn(err.code, err.message)) { setStale(true); setError(null); return; }
    setError(msg);
  }

  async function send() {
    if (busy) return;
    setBusy("send"); setError(null); setStale(false);
    try {
      const out = await deskApi.top.requestOtp({ action, summary });
      setActionId(out.actionId); setSentTo(out.otpSentTo); setOtp(""); setStep("code");
      const t = Date.now(); setSentAt(t); setNow(t);
    } catch (e) {
      fail(e, "Could not send the code. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function run() {
    if (busy || !actionId) return;
    if (!isOtpShape(otp)) { setError("Enter the 6-digit code."); return; }
    setBusy("run"); setError(null); setStale(false);
    try {
      await execute(actionId, otp.trim());
      onClose();
    } catch (e) {
      const err = e as { message?: string };
      if (needsNewCode(err.message)) { setStep("confirm"); setActionId(null); setOtp(""); }
      fail(e, "That did not work. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal open title={title} onClose={() => { if (!busy) onClose(); }}
      footer={
        step === "confirm" ? (
          <>
            <button type="button" onClick={() => void send()} disabled={!!busy} className={buttonClass.primary}>{busy === "send" ? "Sending code…" : "Send me a code"}</button>
            <button type="button" onClick={onClose} disabled={!!busy} className={buttonClass.secondary}>Cancel</button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => void run()} disabled={!!busy || !isOtpShape(otp)} className={buttonClass.primary}>{busy === "run" ? "Working…" : confirmLabel}</button>
            <button type="button" onClick={() => void send()} disabled={!!busy || resendIn > 0} className={buttonClass.secondary}>
              {busy === "send" ? "Sending…" : resendIn > 0 ? `New code in ${resendIn}s` : "Send a new code"}
            </button>
            <button type="button" onClick={onClose} disabled={!!busy} className={buttonClass.secondary}>Cancel</button>
          </>
        )
      }>
      <div className="min-w-0 space-y-4">
        <div className="min-w-0 rounded-xl bg-gray-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">You are about to</p>
          <p className="mt-1 break-words text-base font-semibold text-gray-900">{summary}</p>
        </div>

        {step === "confirm" ? (
          <p className="break-words text-sm text-gray-600">We will text a 6-digit code to your phone. Nothing happens until you enter it.</p>
        ) : (
          <FormField label="6-digit code" htmlFor="top-otp" error={error && !stale ? error : null} hint={sentTo ? `Sent to ${sentTo}. It expires in 5 minutes.` : undefined}>
            <input id="top-otp" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} value={otp} disabled={busy === "run"}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => { if (e.key === "Enter") void run(); }}
              className={`${inputClass} tracking-[0.4em]`} placeholder="••••••" />
          </FormField>
        )}

        {step === "confirm" && error && <Notice tone="error">{error}</Notice>}
        {stale && <ReauthBox onDone={() => { setStale(false); setError("You are signed in again. Please try once more."); }} />}
      </div>
    </Modal>
  );
}
