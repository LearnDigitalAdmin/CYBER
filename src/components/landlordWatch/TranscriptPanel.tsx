import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download, FileText, Loader2, Phone } from 'lucide-react';
import { checkSafaricomPhone } from '../../utils/safaricom';
import { LwApiError, transcriptPay, transcriptQuota, transcriptResendOtp, transcriptStart, transcriptStatus, transcriptVerifyOtp } from './api';
import OtpBox from './OtpBox';
import { monthLabel } from './SnapshotView';
import type { Lang, Quota, TranscriptRequest } from './types';

interface Props { ownerId: string; months: string[]; currentMonth: string; lang: Lang }

/** Monthly transcript: pick a month, verify with the owner's code, download free or pay KES 99 by M-Pesa. */
export default function TranscriptPanel({ ownerId, months, currentMonth, lang }: Props) {
  const [month, setMonth] = useState(currentMonth);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [req, setReq] = useState<TranscriptRequest | null>(null);
  const [resend, setResend] = useState(60);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | undefined>();
  const [phone, setPhone] = useState('');
  const [language, setLanguage] = useState<Lang>(lang);
  const [slow, setSlow] = useState(false);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = useCallback(() => { if (poll.current) { clearInterval(poll.current); poll.current = null; } }, []);
  useEffect(() => stopPoll, [stopPoll]);
  useEffect(() => { setMonth(currentMonth); setReq(null); setError(null); stopPoll(); }, [ownerId, currentMonth, stopPoll]);
  useEffect(() => { transcriptQuota(ownerId).then(setQuota).catch(() => setQuota(null)); }, [ownerId, req?.state]);

  const fail = (e: unknown) => {
    const err = e as LwApiError;
    setError(err.message);
    setAttemptsLeft(err.attemptsLeft);
  };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(null); setAttemptsLeft(undefined);
    try { await fn(); } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const startPolling = (requestId: string) => {
    stopPoll(); setSlow(false);
    const started = Date.now();
    poll.current = setInterval(async () => {
      try {
        const r = await transcriptStatus(requestId);
        setReq(r);
        if (r.state === 'ready' || r.state === 'failed' || r.state === 'expired' || r.state === 'payment_required') stopPoll();
        else if (Date.now() - started > 90_000) { stopPoll(); setSlow(true); }
      } catch { /* keep polling; the next tick will retry */ }
    }, 3000);
  };

  const start = () => run(async () => {
    const r = await transcriptStart(ownerId, month, language);
    setReq(r); setResend(r.resendInSec ?? 60);
  });
  const verify = (code: string) => run(async () => {
    const r = await transcriptVerifyOtp(req!.requestId, code);
    setReq(r);
  });
  const resendCode = () => run(async () => { const r = await transcriptResendOtp(req!.requestId); setResend(r.resendInSec); });
  const pay = () => run(async () => {
    const check = checkSafaricomPhone(phone);
    if (!check.ok) throw new LwApiError('LW_PAYMENT_FAILED', check.message);
    const r = await transcriptPay(req!.requestId, check.e164);
    setReq(r); startPolling(r.requestId);
  });
  const checkNow = () => run(async () => { const r = await transcriptStatus(req!.requestId); setReq(r); if (r.state === 'payment_pending') startPolling(r.requestId); });
  const reset = () => { stopPoll(); setReq(null); setError(null); setSlow(false); };

  const selectable = months.length ? months : [currentMonth];
  const price = quota ? (quota.nextPriceKes === 0 ? 'Free this month' : `KES ${quota.nextPriceKes}`) : '';

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2"><FileText className="h-4 w-4 text-cyan-400" /><h4 className="text-sm font-semibold text-white">Monthly transcript</h4></div>

      {!req && (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">A PDF for the landlord: what was collected, the agent's commission and deductions, and the net payable. The owner confirms each download with a code.</p>
          <div className="flex flex-wrap items-center gap-2">
            <select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Transcript month" className="rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2 text-sm text-white">
              {selectable.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
            <select value={language} onChange={(e) => setLanguage(e.target.value as Lang)} aria-label="Transcript language" className="rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2 text-sm text-white">
              <option value="en">English</option><option value="sw">Kiswahili</option>
            </select>
            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">{price || 'Checking…'}</span>
          </div>
          {quota && <p className="text-xs text-gray-500">{quota.freeUsed >= quota.freeLimit ? 'The free transcript for this month has been used. Each extra one costs KES 99.' : 'One transcript per property each month is free.'}</p>}
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          <button onClick={start} disabled={busy} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Get transcript
          </button>
        </div>
      )}

      {req?.state === 'otp_pending' && (
        <OtpBox sentTo={req.sentTo ?? ''} resendInSec={resend} busy={busy} error={error} attemptsLeft={attemptsLeft} verifyLabel="Verify and continue" onVerify={verify} onResend={resendCode} />
      )}

      {req?.state === 'generating' && <p className="flex items-center gap-2 text-sm text-gray-300"><Loader2 className="h-4 w-4 animate-spin" /> Preparing the transcript…</p>}

      {req?.state === 'payment_required' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-300">This month's free transcript is already used. This one costs <b className="text-white">KES {req.priceKes}</b>, paid by M-Pesa.</p>
          {req.error && <p className="text-sm text-amber-300">{req.error.message}</p>}
          <label className="block text-xs text-gray-400" htmlFor="lw-pay-phone">M-Pesa number</label>
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input id="lw-pay-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712 345 678" className="w-full rounded-lg border border-gray-700 bg-gray-900/60 py-3 pl-10 pr-3 text-white placeholder-gray-600 focus:border-cyan-500 focus:outline-none" />
          </div>
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          <button onClick={pay} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-3 font-semibold text-white disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Pay KES {req.priceKes} with M-Pesa
          </button>
        </div>
      )}

      {(req?.state === 'payment_pending' || req?.state === 'paid') && (
        <div className="space-y-3 text-sm text-gray-300">
          <p className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin text-emerald-400" /> {req.message || 'Check your phone and enter your M-Pesa PIN.'}</p>
          {req.error && <p className="text-amber-300">{req.error.message}</p>}
          {slow && <p className="text-amber-300">Still waiting for the payment. If you have paid, check again.</p>}
          <button onClick={checkNow} disabled={busy} className="rounded-lg border border-gray-700 px-4 py-2 text-gray-200 hover:bg-gray-800 disabled:opacity-60">Check payment</button>
        </div>
      )}

      {req?.state === 'ready' && (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm text-emerald-300"><CheckCircle2 className="h-4 w-4" /> Your transcript for {monthLabel(req.month)} is ready.</p>
          <a href={req.url} target="_blank" rel="noopener noreferrer" className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 px-4 py-3 font-semibold text-white"><Download className="h-4 w-4" /> Download PDF</a>
          <p className="text-xs text-gray-500">You can download this one again for 24 hours at no charge. The link itself works for 15 minutes.</p>
          <button onClick={reset} className="text-sm text-gray-400 underline">Get another month</button>
        </div>
      )}

      {(req?.state === 'failed' || req?.state === 'expired') && (
        <div className="space-y-3">
          <p className="text-sm text-red-400">{req.error?.message ?? 'This request is no longer valid. Please start again.'}</p>
          <button onClick={reset} className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-200 hover:bg-gray-800">Start again</button>
        </div>
      )}
    </div>
  );
}
