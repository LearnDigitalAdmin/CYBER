import React, { useEffect, useRef, useState } from "react";
import { Phone, KeyRound } from "lucide-react";
import {
  GoogleAuthProvider,
  sendEmailVerification,
  signInWithCustomToken,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "../../services/firebaseService";
import { useAuth } from "../../context/authContext";
import { apiMessage, ensureAgentProfile, sendSignupOtp, verifySignupOtp } from "../../services/signupApi";
import { toLocalKePhone } from "../../utils/phone";

interface Props {
  /** Called once the user is signed in and agents/{uid} exists. */
  onSuccess: (isNew: boolean) => void;
}

const RESEND_SECONDS = 60;

/**
 * Google + phone (SMS code) sign-in. Used by both /signup and /signin: a new person simply gets an account,
 * an existing one is signed in. No roles, no verification uploads, no location capture here.
 */
const AuthMethods: React.FC<Props> = ({ onSuccess }) => {
  const { refreshUser } = useAuth();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState<"google" | "send" | "verify" | null>(null);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    timer.current = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [cooldown]);

  const handleGoogle = async () => {
    setError("");
    setBusy("google");
    try {
      // If this Google email already belongs to an account here, Firebase signs that same account in
      // (same uid), so its existing data is kept: that is the merge.
      const cred = await signInWithPopup(auth, new GoogleAuthProvider());
      if (cred.user.email && !cred.user.emailVerified) {
        await sendEmailVerification(cred.user).catch(() => undefined);
      }
      const { isNew } = await ensureAgentProfile();
      await refreshUser();
      onSuccess(isNew);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return;
      if (code === "auth/account-exists-with-different-credential") {
        setError("This email is already registered with another sign-in method. Sign in with that method first.");
      } else if (code === "auth/popup-blocked") {
        setError("Your browser blocked the Google window. Allow pop-ups for this site and try again.");
      } else {
        setError(apiMessage(err, "Google sign-in failed. Please try again."));
      }
    } finally {
      setBusy(null);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError("");
    const local = toLocalKePhone(phone);
    if (!local) {
      setError("Enter a valid Kenyan mobile number, e.g. 0712345678");
      return;
    }
    setBusy("send");
    try {
      await sendSignupOtp(local);
      setCodeSent(true);
      setCode("");
      setCooldown(RESEND_SECONDS);
    } catch (err: unknown) {
      setError(apiMessage(err, "We could not send the code. Please try again."));
    } finally {
      setBusy(null);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const local = toLocalKePhone(phone);
    if (!local || code.length !== 6) {
      setError("Enter the 6-digit code we sent you");
      return;
    }
    setBusy("verify");
    try {
      const { token, isNew } = await verifySignupOtp(local, code);
      await signInWithCustomToken(auth, token);
      await refreshUser();
      onSuccess(isNew);
    } catch (err: unknown) {
      setError(apiMessage(err, "That code did not work. Please try again."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleGoogle}
        disabled={busy !== null}
        className="w-full flex items-center justify-center gap-3 bg-white text-gray-800 font-semibold py-2.5 rounded-lg hover:bg-gray-100 transition disabled:opacity-60"
      >
        <svg className="w-5 h-5" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z" />
          <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z" />
          <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
        </svg>
        {busy === "google" ? "Connecting..." : "Continue with Google"}
      </button>

      <div className="flex items-center my-5 text-xs text-gray-400">
        <div className="flex-1 h-px bg-gray-600" />
        <span className="px-3">or use your phone</span>
        <div className="flex-1 h-px bg-gray-600" />
      </div>

      {!codeSent ? (
        <form onSubmit={handleSend}>
          <div className="flex items-center bg-gray-800 rounded-lg px-3 py-2 mb-3">
            <Phone className="w-5 h-5 text-gray-400 mr-2" />
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="Phone number, e.g. 0712345678"
              className="bg-transparent flex-1 outline-none text-white"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            disabled={busy !== null}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 rounded-lg transition disabled:opacity-60"
          >
            {busy === "send" ? "Sending code..." : "Send me a code"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerify}>
          <p className="text-sm text-gray-300 mb-3">
            We sent a 6-digit code to <span className="font-semibold">{toLocalKePhone(phone) ?? phone}</span>.
          </p>
          <div className="flex items-center bg-gray-800 rounded-lg px-3 py-2 mb-3">
            <KeyRound className="w-5 h-5 text-gray-400 mr-2" />
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="6-digit code"
              className="bg-transparent flex-1 outline-none text-white tracking-widest"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
            />
          </div>
          <button
            type="submit"
            disabled={busy !== null || code.length !== 6}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 rounded-lg transition disabled:opacity-60"
          >
            {busy === "verify" ? "Checking..." : "Continue"}
          </button>
          <div className="flex justify-between mt-3 text-sm">
            <button
              type="button"
              onClick={() => {
                setCodeSent(false);
                setError("");
              }}
              className="text-gray-400 hover:underline"
            >
              Change number
            </button>
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={cooldown > 0 || busy !== null}
              className="text-green-400 hover:underline disabled:text-gray-500 disabled:no-underline"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
            </button>
          </div>
        </form>
      )}

      {error && <p className="mt-3 text-sm text-center text-yellow-300">{error}</p>}
    </div>
  );
};

export default AuthMethods;
