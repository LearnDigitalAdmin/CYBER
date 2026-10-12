import { useCallback, useEffect, useRef, useState } from "react";
import { EmailAuthProvider, reauthenticateWithCredential, sendEmailVerification, verifyBeforeUpdateEmail } from "firebase/auth";
import type { User } from "firebase/auth";
import { deskApi, DeskApiError, formatDateTime } from "../../api";
import { Badge, Card, FormField, buttonClass, inputClass } from "../../ui";
import { auth } from "../../../services/firebaseService";
import Notice from "./Notice";
import { browserStore, hasPasswordSignIn } from "./useAuthUser";
import { authErrorMessage, clearPending, readPending, sameEmail, validateEmailChange, writePending } from "./logic";
import type { EmailChangeErrors, PendingEmail } from "./logic";

type Msg = { tone: "ok" | "error" | "info"; text: string } | null;
const codeOf = (e: unknown): string | undefined => (e as { code?: string } | null)?.code;

/**
 * Verifies the CURRENT sign-in email (no change needed) and handles sign-in email changes.
 *
 * Verify: `sendEmailVerification` mails a link to the address already on the account; once opened, `emailVerified` is true.
 *
 * Sign-in email change. Re-authenticate with the current password, then `verifyBeforeUpdateEmail`: Firebase mails a link to the
 * NEW address and only switches the sign-in email once it is opened. When the person comes back we reload the user and, once
 * the new address is the verified sign-in email, call `syncEmail` so the desk record follows.
 */
export default function EmailSection({ user }: { user: User }) {
  const store = browserStore();
  const [pending, setPending] = useState<PendingEmail | null>(() => readPending(store, user.uid));
  const [deskEmail, setDeskEmail] = useState<string | null>(null);
  const [currentEmail, setCurrentEmail] = useState<string | null>(user.email);
  const [verified, setVerified] = useState<boolean>(user.emailVerified);
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<EmailChangeErrors>({});
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState<"send" | "resend" | "check" | "verify" | null>(null);
  const checking = useRef(false);
  const canUsePassword = hasPasswordSignIn(user);

  /** Reload the user from Firebase; if the pending address has become the sign-in email, sync the desk record. */
  const check = useCallback(async (manual: boolean) => {
    if (checking.current) return;
    checking.current = true;
    if (manual) setBusy("check");
    try {
      try {
        await user.reload();
      } catch (e) {
        const c = codeOf(e);
        if (c === "auth/user-token-expired" || c === "auth/user-disabled") {
          setMsg({ tone: "info", text: "Your sign-in email was changed, so you need to sign in again with the new address. We will finish updating your desk record when you do." });
        } else if (manual) {
          setMsg({ tone: "error", text: authErrorMessage(c) });
        }
        return;
      }
      const fresh = auth.currentUser ?? user;
      setCurrentEmail(fresh.email);
      setVerified(fresh.emailVerified);
      const stored = readPending(store, user.uid);
      if (!stored && !fresh.emailVerified) {
        // Nothing pending and the current address is not verified yet: there is nothing to sync, so say so instead of erroring.
        if (manual) setMsg({ tone: "info", text: `${fresh.email ?? "Your email"} is not verified yet. Open the link we emailed, then check again.` });
        return;
      }
      const arrived = !!stored && sameEmail(fresh.email, stored.email);
      if (arrived) await fresh.getIdToken(true); // new token carries the new email + email_verified
      try {
        const out = await deskApi.syncEmail();
        setDeskEmail(out.email);
        if (arrived) {
          clearPending(store, user.uid); setPending(null);
          setMsg({ tone: "ok", text: `Your sign-in email is now ${out.email}.` });
        } else if (manual && stored) {
          setMsg({ tone: "info", text: `Still waiting for ${stored.email} to be verified. Open the link we emailed, then check again.` });
        } else if (manual) {
          setMsg({ tone: "ok", text: `Your email ${out.email} is verified.` });
        }
      } catch (e) {
        if (arrived || manual) setMsg({ tone: "error", text: e instanceof DeskApiError ? e.message : "Could not update your desk record." });
      }
    } finally {
      checking.current = false;
      if (manual) setBusy(null);
    }
  }, [store, user]);

  // On arrival and whenever the person returns to this tab (typically after clicking the emailed link).
  useEffect(() => {
    void check(false);
    const onFocus = () => { if (document.visibilityState === "visible") void check(false); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => { window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onFocus); };
  }, [check]);

  /** Verify the address the account already has. No password prompt: Firebase only mails a link to that inbox. */
  async function verifyCurrent() {
    const current = auth.currentUser;
    if (!current || !current.email) { setMsg({ tone: "error", text: "Please sign in again." }); return; }
    setBusy("verify"); setMsg(null);
    try {
      await sendEmailVerification(current);
      setMsg({ tone: "ok", text: `We sent a verification link to ${current.email}. Open it, then come back and tap "I have verified it".` });
    } catch (e) {
      setMsg({ tone: "error", text: authErrorMessage(codeOf(e)) });
    } finally {
      setBusy(null);
    }
  }

  async function sendVerification(target: string, kind: "send" | "resend") {
    const current = auth.currentUser;
    if (!current || !current.email) { setMsg({ tone: "error", text: "Please sign in again." }); return; }
    setBusy(kind); setMsg(null);
    try {
      await reauthenticateWithCredential(current, EmailAuthProvider.credential(current.email, password));
      await verifyBeforeUpdateEmail(current, target);
      const p = { email: target, sentAt: Date.now() };
      writePending(store, user.uid, p); setPending(p);
      setPassword(""); setNewEmail("");
      setMsg({ tone: "ok", text: `We sent a verification link to ${target}. Open it to finish the change. Your sign-in email stays the same until you do.` });
    } catch (e) {
      setMsg({ tone: "error", text: authErrorMessage(codeOf(e)) });
    } finally {
      setBusy(null);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const v = validateEmailChange({ currentEmail, newEmail, password });
    setErrors(v.errors);
    if (!v.ok) return;
    void sendVerification(v.email, "send");
  }

  function resend() {
    if (busy || !pending) return;
    if (!password) { setErrors({ password: "Enter your current password to resend." }); return; }
    setErrors({});
    void sendVerification(pending.email, "resend");
  }

  if (!canUsePassword) {
    return (
      <Card title="Sign-in email">
        <p className="break-words text-sm text-gray-700">You sign in with {currentEmail ?? "another provider"}. Its email can only be changed with that provider.</p>
      </Card>
    );
  }

  return (
    <Card title="Sign-in email">
      <div className="min-w-0 space-y-4">
        <dl className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 text-sm">
          <dt className="text-gray-500">Sign-in email</dt>
          <dd className="flex min-w-0 flex-wrap justify-end gap-2 text-right">
            <span className="min-w-0 break-all font-medium text-gray-900">{currentEmail ?? "—"}</span>
            <Badge tone={verified ? "green" : "amber"}>{verified ? "Verified" : "Not verified"}</Badge>
          </dd>
          {deskEmail && (
            <>
              <dt className="text-gray-500">Desk record</dt>
              <dd className="min-w-0 break-all text-right text-gray-900">{deskEmail}</dd>
            </>
          )}
        </dl>

        {!verified && (
          <div className="min-w-0 space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
            <p className="break-words text-sm text-blue-900">
              Your email <span className="break-all font-semibold">{currentEmail ?? "—"}</span> is not verified yet. You do not need to change it: we just send a link to it.
            </p>
            <div className="flex min-w-0 flex-wrap gap-2">
              <button type="button" onClick={() => void verifyCurrent()} disabled={!!busy} className={buttonClass.primary}>
                {busy === "verify" ? "Sending…" : "Send verification link"}
              </button>
              <button type="button" onClick={() => void check(true)} disabled={!!busy} className={buttonClass.secondary}>
                {busy === "check" ? "Checking…" : "I have verified it"}
              </button>
            </div>
          </div>
        )}

        {pending && !sameEmail(pending.email, currentEmail) && (
          <div className="min-w-0 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="break-words text-sm text-amber-900">
              <Badge tone="amber">Pending</Badge>{" "}
              Waiting for <span className="break-all font-semibold">{pending.email}</span> to be verified. Link sent {formatDateTime(pending.sentAt)}.
            </p>
            <div className="flex min-w-0 flex-wrap gap-2">
              <button type="button" onClick={() => void check(true)} disabled={!!busy} className={buttonClass.primary}>
                {busy === "check" ? "Checking…" : "I have verified it"}
              </button>
              <button type="button" onClick={resend} disabled={!!busy} className={buttonClass.secondary}>
                {busy === "resend" ? "Sending…" : "Resend verification"}
              </button>
              <button type="button" disabled={!!busy} className={buttonClass.secondary}
                onClick={() => { clearPending(store, user.uid); setPending(null); setMsg({ tone: "info", text: "Stopped tracking the change. If you open the old link later, your sign-in email will still change." }); }}>
                Stop tracking
              </button>
            </div>
            <p className="text-xs text-amber-900">To resend, type your current password in the box below first.</p>
          </div>
        )}

        <form onSubmit={submit} noValidate className="min-w-0 space-y-4">
          <FormField label="New sign-in email" htmlFor="acc-new-email" error={errors.email}>
            <input id="acc-new-email" type="email" autoComplete="email" inputMode="email" value={newEmail} disabled={!!busy}
              onChange={(e) => setNewEmail(e.target.value)} className={inputClass} placeholder="name@example.com" />
          </FormField>
          <FormField label="Current password" htmlFor="acc-email-pw" error={errors.password} hint="We ask again to be sure it is you.">
            <input id="acc-email-pw" type="password" autoComplete="current-password" value={password} disabled={!!busy}
              onChange={(e) => setPassword(e.target.value)} className={inputClass} />
          </FormField>
          <button type="submit" disabled={!!busy} className={buttonClass.primary}>{busy === "send" ? "Sending link…" : "Send verification link"}</button>
        </form>

        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      </div>
    </Card>
  );
}
