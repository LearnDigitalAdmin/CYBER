import { httpsCallable } from 'firebase/functions';
import { functionsAfrica } from '../../services/firebaseService';
import type { Lang, LookupResult, OtpSent, Quota, Snapshot, TranscriptRequest, MaskLevel } from './types';

/** Error raised by every Landlord Watch call. `code` is the contract's LW_* code. */
export class LwApiError extends Error {
  code: string;
  retryAfterSec?: number;
  attemptsLeft?: number;
  constructor(code: string, message: string, retryAfterSec?: number, attemptsLeft?: number) {
    super(message);
    this.name = 'LwApiError';
    this.code = code;
    this.retryAfterSec = retryAfterSec;
    this.attemptsLeft = attemptsLeft;
  }
}

function toLwError(e: unknown): LwApiError {
  const err = e as { message?: string; details?: { lw?: string; retryAfterSec?: number; attemptsLeft?: number } };
  const d = err?.details;
  const message = (err?.message || 'Something went wrong. Please try again.').replace(/^[a-z-]+\/\s*/i, '');
  return new LwApiError(d?.lw || 'LW_UNAVAILABLE', message, d?.retryAfterSec, d?.attemptsLeft);
}

async function call<T>(name: string, data: Record<string, unknown> = {}): Promise<T> {
  try {
    const res = await httpsCallable(functionsAfrica, name)({ channel: 'cyber', ...data });
    return res.data as T;
  } catch (e) {
    throw toLwError(e);
  }
}

export const OWNER_ID = /^PYP-\d{4,}$/;
export const normalizeOwnerId = (raw: string): string => raw.trim().toUpperCase().replace(/\s+/g, '');

export const lookupProperty = (ownerId: string) => call<LookupResult>('lwLookupProperty', { ownerId });
export const unlockSendOtp = (ownerId: string, lang: Lang) => call<OtpSent>('lwUnlockSendOtp', { ownerId, lang });
export const unlockVerifyOtp = (ownerId: string, code: string) =>
  call<{ unlocked: true; unlockedUntil: string; level: MaskLevel }>('lwUnlockVerifyOtp', { ownerId, code });

export type SnapshotReply = { notModified: true; etag: string } | { snapshot: Snapshot; etag: string };

// Session-only cache (this is often a shared counter computer, so nothing is written to disk). A cached copy is
// revalidated with ifNoneMatch, which costs almost nothing when nothing changed.
const cache = new Map<string, { etag: string; snapshot: Snapshot; at: number }>();
const FRESH_MS = 60_000;
export const clearSnapshotCache = () => cache.clear();

export async function getSnapshot(ownerId: string, month: string | undefined, lang: Lang, opts: { force?: boolean } = {}): Promise<Snapshot> {
  const key = `${ownerId}|${month ?? 'current'}|${lang}`;
  const hit = cache.get(key);
  if (hit && !opts.force && Date.now() - hit.at < FRESH_MS) return hit.snapshot;
  const reply = await call<SnapshotReply>('lwGetSnapshot', { ownerId, month, lang, ...(hit ? { ifNoneMatch: hit.etag } : {}) });
  if ('notModified' in reply && hit) {
    cache.set(key, { ...hit, at: Date.now() });
    return hit.snapshot;
  }
  if (!('snapshot' in reply)) throw new LwApiError('LW_UNAVAILABLE', 'Could not load the property. Please try again.');
  cache.set(key, { etag: reply.etag, snapshot: reply.snapshot, at: Date.now() });
  return reply.snapshot;
}

export const transcriptQuota = (ownerId: string) => call<Quota>('lwTranscriptQuota', { ownerId });
export const transcriptStart = (ownerId: string, month: string, lang: Lang) => call<TranscriptRequest>('lwTranscriptStart', { ownerId, month, lang });
export const transcriptResendOtp = (requestId: string) => call<OtpSent>('lwTranscriptResendOtp', { requestId });
export const transcriptVerifyOtp = (requestId: string, code: string) => call<TranscriptRequest>('lwTranscriptVerifyOtp', { requestId, code });
export const transcriptPay = (requestId: string, phone: string) => call<TranscriptRequest>('lwTranscriptPay', { requestId, phone });
export const transcriptStatus = (requestId: string) => call<TranscriptRequest>('lwTranscriptStatus', { requestId });
