import { useEffect, useState } from "react";
import { EmailAuthProvider, reauthenticateWithCredential, sendPasswordResetEmail, updatePassword } from "firebase/auth";
import type { User } from "firebase/auth";
import { Card, FormField, buttonClass, inputClass } from "../../ui";
import { auth } from "../../../services/firebaseService";
import Notice from "./Notice";
import { hasPasswordSignIn } from "./useAuthUser";
import { authErrorMessage, cooldownLeft, validatePasswordChange } from "./logic";
import type { PasswordErrors } from "./logic";

type Msg = { tone: "ok" | "error" | "info"; text: string } | null;
const codeOf = (e: unknown): string | undefined => (e as { code?: string } | null)?.code;

/** Forgot password (reset link by email) and change password (re-authenticate, then updatePassword). */
export default function PasswordSection({ user }: { user: User }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<PasswordErrors>({});
  const [busy, setBusy] = useState<"change" | "reset" | null>(null);
  const [changeMsg, setChangeMsg] = useState<Msg>(null);
  const [resetMsg, setResetMsg] = useState<Msg>(null);
  const [lastReset, setLastReset] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (lastReset === null) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [lastReset]);

  if (!hasPasswordSignIn(user)) {
    return <Card title="Password"><p className="break-words text-sm text-gray-700">You sign in with another provider, so your password is managed there.</p></Card>;
  }

  const wait = Math.ceil(cooldownLeft(lastReset, now) / 1000);

  async function sendReset() {
    if (busy || wait > 0 || !user.email) return;
    setBusy("reset"); setResetMsg(null);
    try {
      await sendPasswordResetEmail(auth, user.email);
      const t = Date.now(); setLastReset(t); setNow(t);
      setResetMsg({ tone: "ok", text: `We sent a password reset link to ${user.email}. Check your inbox and spam folder.` });
    } catch (e) {
      setResetMsg({ tone: "error", text: authErrorMessage(codeOf(e)) });
    } finally {
      setBusy(null);
    }
  }

  async function change(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const v = validatePasswordChange({ current, next, confirm });
    setErrors(v.errors);
    if (!v.ok) return;
    const u = auth.currentUser;
    if (!u || !u.email) { setChangeMsg({ tone: "error", text: "Please sign in again." }); return; }
    setBusy("change"); setChangeMsg(null);
    try {
      await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, current));
      await updatePassword(u, next);
      setCurrent(""); setNext(""); setConfirm("");
      setChangeMsg({ tone: "ok", text: "Your password was changed." });
    } catch (err) {
      setChangeMsg({ tone: "error", text: authErrorMessage(codeOf(err)) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card title="Password">
      <div className="min-w-0 space-y-6">
        <form onSubmit={(e) => void change(e)} noValidate className="min-w-0 space-y-4">
          <FormField label="Current password" htmlFor="acc-pw-current" error={errors.current}>
            <input id="acc-pw-current" type="password" autoComplete="current-password" value={current} disabled={!!busy} onChange={(e) => setCurrent(e.target.value)} className={inputClass} />
          </FormField>
          <FormField label="New password" htmlFor="acc-pw-next" error={errors.next} hint="At least 8 characters.">
            <input id="acc-pw-next" type="password" autoComplete="new-password" value={next} disabled={!!busy} onChange={(e) => setNext(e.target.value)} className={inputClass} />
          </FormField>
          <FormField label="Confirm new password" htmlFor="acc-pw-confirm" error={errors.confirm}>
            <input id="acc-pw-confirm" type="password" autoComplete="new-password" value={confirm} disabled={!!busy} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
          </FormField>
          <button type="submit" disabled={!!busy} className={buttonClass.primary}>{busy === "change" ? "Changing…" : "Change password"}</button>
          {changeMsg && <Notice tone={changeMsg.tone}>{changeMsg.text}</Notice>}
        </form>

        <div className="min-w-0 space-y-3 border-t border-gray-100 pt-4">
          <p className="break-words text-sm text-gray-700">Forgot your password? We will email a reset link to <span className="break-all font-medium">{user.email}</span>.</p>
          <button type="button" onClick={() => void sendReset()} disabled={!!busy || wait > 0} className={buttonClass.secondary}>
            {busy === "reset" ? "Sending…" : wait > 0 ? `Send again in ${wait}s` : "Email me a reset link"}
          </button>
          {resetMsg && <Notice tone={resetMsg.tone}>{resetMsg.text}</Notice>}
        </div>
      </div>
    </Card>
  );
}
