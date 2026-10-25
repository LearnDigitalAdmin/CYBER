import { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, Loader2, LogOut, Search, ShieldAlert, X } from 'lucide-react';
import {
  clearSnapshotCache, getSnapshot, LwApiError, lookupProperty, normalizeOwnerId, OWNER_ID, unlockSendOtp, unlockVerifyOtp,
} from './api';
import OtpBox from './OtpBox';
import SnapshotView from './SnapshotView';
import TranscriptPanel from './TranscriptPanel';
import type { Lang, LookupResult, Snapshot } from './types';

/**
 * Landlord Watch (4th dashboard module). An operator looks a property up by its owner ID. Everything is masked until the
 * owner reads out a code sent to THEIR phone; tenant names and phone numbers stay masked even then.
 */
export default function LandlordWatchTab() {
  const [input, setInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [found, setFound] = useState<NonNullable<LookupResult['property']> | null>(null);

  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);
  const lang: Lang = 'en';

  const [otp, setOtp] = useState<{ sentTo: string; resendInSec: number } | null>(null);
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | undefined>();
  const [unlockBusy, setUnlockBusy] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async (ownerId: string, month: string | undefined, force = false) => {
    const mine = ++seq.current;
    setLoading(true); setViewError(null);
    try {
      const s = await getSnapshot(ownerId, month, lang, { force });
      if (mine === seq.current) setSnapshot(s);
    } catch (e) {
      if (mine === seq.current) setViewError((e as LwApiError).message);
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, []);

  // Nothing about a looked-up property is kept when the operator leaves this module.
  useEffect(() => () => { clearSnapshotCache(); }, []);

  const search = async () => {
    const ownerId = normalizeOwnerId(input);
    setSearchError(null);
    if (!OWNER_ID.test(ownerId)) { setSearchError('Enter the owner ID like PYP-0001.'); return; }
    setSearching(true);
    try {
      const r = await lookupProperty(ownerId);
      if (!r.found || !r.property) { setSearchError('No property found for that owner ID.'); return; }
      clearSnapshotCache();
      setFound(r.property); setSnapshot(null); setOtp(null); setOtpError(null);
      await load(r.property.ownerId, undefined, true);
    } catch (e) {
      const err = e as LwApiError;
      setSearchError(err.code === 'LW_RATE_LIMITED' && err.retryAfterSec ? `Too many lookups. Try again in ${Math.ceil(err.retryAfterSec / 60)} min.` : err.message);
    } finally {
      setSearching(false);
    }
  };

  const endSession = () => { seq.current++; clearSnapshotCache(); setFound(null); setSnapshot(null); setOtp(null); setInput(''); setViewError(null); };

  const sendCode = async () => {
    if (!found) return;
    setUnlockBusy(true); setOtpError(null); setAttemptsLeft(undefined);
    try {
      const r = await unlockSendOtp(found.ownerId, lang);
      setOtp({ sentTo: r.sentTo, resendInSec: r.resendInSec });
    } catch (e) {
      const err = e as LwApiError;
      setOtpError(err.code === 'LW_OTP_COOLDOWN' && err.retryAfterSec ? `Please wait ${err.retryAfterSec}s before asking for another code.` : err.message);
      // A cool-down means a code was already sent a moment ago: keep the entry box open.
      if (err.code === 'LW_OTP_COOLDOWN') setOtp((o) => o ?? { sentTo: found.ownerPhoneMasked, resendInSec: err.retryAfterSec ?? 60 });
    } finally {
      setUnlockBusy(false);
    }
  };

  const verify = async (code: string) => {
    if (!found) return;
    setOtpBusy(true); setOtpError(null); setAttemptsLeft(undefined);
    try {
      await unlockVerifyOtp(found.ownerId, code);
      setOtp(null);
      clearSnapshotCache();
      await load(found.ownerId, snapshot?.month, true);
    } catch (e) {
      const err = e as LwApiError;
      setOtpError(err.message); setAttemptsLeft(err.attemptsLeft);
      if (err.code === 'LW_OTP_EXPIRED' || err.code === 'LW_OTP_LOCKED') setOtp(null);
    } finally {
      setOtpBusy(false);
    }
  };

  const onExpired = useCallback(() => { if (found) { clearSnapshotCache(); void load(found.ownerId, snapshot?.month, true); } }, [found, load, snapshot?.month]);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="rounded-xl border border-gray-700/50 bg-gradient-to-br from-gray-800/50 to-gray-900/50 p-4 sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600 p-2.5 text-white"><Eye className="h-5 w-5" /></div>
          <div>
            <h2 className="text-lg font-bold text-white">Landlord Watch</h2>
            <p className="text-sm text-gray-400">Look a property up by its owner ID. Figures stay hidden until the owner confirms with a code.</p>
          </div>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); void search(); }} className="flex flex-col gap-2 sm:flex-row">
          <input
            value={input}
            onChange={(e) => { setInput(e.target.value.toUpperCase()); setSearchError(null); }}
            placeholder="PYP-0001"
            aria-label="Owner ID"
            autoComplete="off"
            spellCheck={false}
            className="flex-1 rounded-lg border border-gray-700 bg-gray-900/60 px-4 py-3 font-mono text-white placeholder-gray-600 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
          />
          <button type="submit" disabled={searching || !input.trim()} className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 px-5 py-3 font-semibold text-white disabled:opacity-50">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Look up
          </button>
        </form>
        {searchError && <p role="alert" className="mt-2 text-sm text-red-400">{searchError}</p>}
      </div>

      {found && (
        <>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><ShieldAlert className="h-3.5 w-3.5" /> Owner phone on file: {found.ownerPhoneMasked || 'none'}</span>
            <button onClick={endSession} className="flex items-center gap-1.5 text-gray-400 hover:text-white"><LogOut className="h-3.5 w-3.5" /> End session</button>
          </div>

          {otp && (
            <div className="rounded-xl border border-cyan-500/30 bg-gray-800/60 p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-white">Owner verification</h4>
                <button onClick={() => { setOtp(null); setOtpError(null); }} aria-label="Cancel" className="text-gray-400 hover:text-white"><X className="h-4 w-4" /></button>
              </div>
              <OtpBox sentTo={otp.sentTo} resendInSec={otp.resendInSec} busy={otpBusy} error={otpError} attemptsLeft={attemptsLeft} verifyLabel="Unlock" onVerify={verify} onResend={sendCode} />
            </div>
          )}
          {!otp && otpError && <p role="alert" className="text-sm text-red-400">{otpError}</p>}

          {viewError && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{viewError}</p>}
          {!snapshot && loading && <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-cyan-400" /></div>}

          {snapshot && (
            <>
              <SnapshotView
                snapshot={snapshot}
                loading={loading}
                unlockBusy={unlockBusy}
                onMonth={(m) => void load(found.ownerId, m)}
                onUnlock={() => void sendCode()}
                onExpired={onExpired}
              />
              <TranscriptPanel ownerId={found.ownerId} months={snapshot.months} currentMonth={snapshot.month} lang={lang} />
            </>
          )}
        </>
      )}
    </div>
  );
}
