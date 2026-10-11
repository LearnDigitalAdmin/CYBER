import { useState } from "react";
import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { auth } from "../../../services/firebaseService";
import { FormField, buttonClass, inputClass } from "../../ui";

/**
 * Top-desk work needs a sign-in from the last 15 minutes (the server checks the token's auth_time). Re-entering the password
 * and refreshing the token gives a new one, so the person does not have to sign out.
 */
export default function ReauthBox({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const u = auth.currentUser;
    if (busy) return;
    if (!u || !u.email) { setError("Please sign in again."); return; }
    if (!password) { setError("Enter your password."); return; }
    setBusy(true); setError(null);
    try {
      await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, password));
      await u.getIdToken(true);
      setPassword("");
      onDone();
    } catch (err) {
      const code = (err as { code?: string }).code;
      setError(code === "auth/too-many-requests" ? "Too many attempts. Wait a few minutes." : code === "auth/network-request-failed" ? "Network problem. Try again." : "That password is not correct.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="min-w-0 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
      <p className="break-words text-sm text-amber-900">For safety, top-desk actions need a recent sign-in. Enter your password to continue.</p>
      <FormField label="Password" htmlFor="top-reauth-pw" error={error}>
        <input id="top-reauth-pw" type="password" autoComplete="current-password" value={password} disabled={busy} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
      </FormField>
      <button type="submit" disabled={busy} className={buttonClass.primary}>{busy ? "Checking…" : "Confirm it is me"}</button>
    </form>
  );
}
