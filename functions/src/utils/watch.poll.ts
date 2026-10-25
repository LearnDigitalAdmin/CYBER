/**
 * Landlord Watch: polling of a transcript request while a payment / PDF generation is in progress.
 * Pure (time and I/O injected) so the timing rules are unit-testable with a fake clock.
 *
 * Rules (contract section 9): poll every 3 s for up to 90 s; send one "still waiting" nudge; after that the caller
 * offers "Check status" / "Cancel". Keep polling through `paid` / `generating`.
 */

import { TranscriptRequest } from '../types/watch.types';
import { isLwError } from '../services/watch.api';

export const POLL_INTERVAL_MS = 3000;
export const POLL_MAX_MS = 90_000;
export const POLL_SLOW_AFTER_MS = 45_000;
const MAX_CONSECUTIVE_ERRORS = 3;

export type PollOutcome =
  | { kind: 'ready'; request: TranscriptRequest }
  | { kind: 'failed'; request?: TranscriptRequest }
  | { kind: 'expired'; request: TranscriptRequest }
  | { kind: 'payment_required'; request: TranscriptRequest }
  | { kind: 'timeout'; request?: TranscriptRequest }
  | { kind: 'cancelled' }
  | { kind: 'error'; error: unknown };

export interface PollOptions {
  fetch: () => Promise<TranscriptRequest>;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  intervalMs?: number;
  maxMs?: number;
  slowAfterMs?: number;
  /** Called once when the wait has gone on for `slowAfterMs`. */
  onSlow?: () => Promise<void> | void;
  /** Checked before every request; return false to stop quietly (user cancelled or moved on). */
  shouldContinue?: () => Promise<boolean> | boolean;
  maxConsecutiveErrors?: number;
}

export async function pollTranscript(o: PollOptions): Promise<PollOutcome> {
  const interval = o.intervalMs ?? POLL_INTERVAL_MS;
  const maxMs = o.maxMs ?? POLL_MAX_MS;
  const slowAfter = o.slowAfterMs ?? POLL_SLOW_AFTER_MS;
  const maxErrors = o.maxConsecutiveErrors ?? MAX_CONSECUTIVE_ERRORS;

  const start = o.now();
  let last: TranscriptRequest | undefined;
  let errors = 0;
  let nudged = false;

  for (;;) {
    const elapsed = o.now() - start;
    if (elapsed >= maxMs) return { kind: 'timeout', request: last };

    await o.sleep(Math.min(interval, maxMs - elapsed));

    if (o.shouldContinue && !(await o.shouldContinue())) return { kind: 'cancelled' };

    try {
      last = await o.fetch();
      errors = 0;
    } catch (err) {
      if (isLwError(err) && err.code === 'LW_PAYMENT_FAILED') return { kind: 'failed', request: last };
      errors += 1;
      if (errors >= maxErrors) return { kind: 'error', error: err };
      continue;
    }

    switch (last.state) {
      case 'ready':
        return { kind: 'ready', request: last };
      case 'failed':
        return { kind: 'failed', request: last };
      case 'expired':
        return { kind: 'expired', request: last };
      case 'payment_required':
        return { kind: 'payment_required', request: last };
      default:
        break; // payment_pending | paid | generating | otp_pending: keep waiting
    }

    if (!nudged && o.now() - start >= slowAfter) {
      nudged = true;
      await o.onSlow?.();
    }
  }
}

export const realSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
