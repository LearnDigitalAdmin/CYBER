import { useEffect, useRef, useState } from 'react';
import { Loader2, RefreshCw, ShieldCheck } from 'lucide-react';

interface Props {
  /** Masked owner phone the code was sent to (07•• ••• 123). */
  sentTo: string;
  /** Seconds until a new code may be requested (server cool-down). */
  resendInSec: number;
  busy: boolean;
  error: string | null;
  attemptsLeft?: number;
  verifyLabel?: string;
  onVerify: (code: string) => void;
  onResend: () => void;
}

/** Six-digit code entry with paste support, auto-focus and a visible resend cool-down. */
export default function OtpBox({ sentTo, resendInSec, busy, error, attemptsLeft, verifyLabel = 'Verify', onVerify, onResend }: Props) {
  const [code, setCode] = useState('');
  const [wait, setWait] = useState(resendInSec);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => { setWait(resendInSec); }, [resendInSec]);
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const clean = (v: string) => v.replace(/\D/g, '').slice(0, 6);

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-300">
        We sent a 6-digit code to the owner's phone <span className="font-semibold text-white">{sentTo}</span>. Ask the owner to read it to you.
      </p>
      <input
        ref={input}
        value={code}
        onChange={(e) => setCode(clean(e.target.value))}
        onPaste={(e) => { e.preventDefault(); setCode(clean(e.clipboardData.getData('text'))); }}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="••••••"
        aria-label="Verification code"
        className="w-full rounded-lg border border-gray-700 bg-gray-900/60 px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] text-white placeholder-gray-600 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
        onKeyDown={(e) => { if (e.key === 'Enter' && code.length === 6 && !busy) onVerify(code); }}
      />
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}{typeof attemptsLeft === 'number' ? ` (${attemptsLeft} ${attemptsLeft === 1 ? 'try' : 'tries'} left)` : ''}
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          onClick={() => onVerify(code)}
          disabled={busy || code.length !== 6}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {verifyLabel}
        </button>
        <button
          onClick={onResend}
          disabled={busy || wait > 0}
          className="flex items-center justify-center gap-2 rounded-lg border border-gray-700 px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" />
          {wait > 0 ? `Resend in ${wait}s` : 'Resend code'}
        </button>
      </div>
    </div>
  );
}
