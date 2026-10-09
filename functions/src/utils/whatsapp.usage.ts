/**
 * WhatsApp usage meter (read by the KPI pipeline).
 *
 * Writes ONE document per Nairobi day to `whatsapp_usage/{YYYY-MM-DD}`:
 *   { day, inbound, outbound, outboundFailed, sessionsStarted, users: { "<16-hex hash>": true }, updatedAt }
 *
 * - Phone numbers are never stored: users are keyed by a salted SHA-256 prefix. Set WA_USAGE_SALT
 *   (any long random string) in the functions environment so the keys cannot be reversed by guessing numbers.
 * - Fire-and-forget: a metering failure is logged and NEVER affects the bot.
 * - One document per day is updated on every message; Firestore sustains ~1 write/second per document,
 *   far above this bot's traffic. If volume ever grows 10x, shard by hour.
 */
import * as admin from 'firebase-admin';
import { createHash } from 'crypto';
import { db } from '../config/firebase.config';
import { logger } from './logger';

const USAGE_COLLECTION = 'whatsapp_usage';
const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000; // Kenya is UTC+3 all year

export type WhatsAppUsageEvent =
  | { kind: 'inbound'; phone: string }
  | { kind: 'sessionStarted'; phone: string }
  | { kind: 'outbound'; ok: boolean };

function nairobiDay(nowMs: number): string {
  return new Date(nowMs + NAIROBI_OFFSET_MS).toISOString().slice(0, 10);
}

function userKey(phone: string): string {
  const salt = process.env.WA_USAGE_SALT || '';
  return createHash('sha256').update(salt + phone.replace(/\D/g, '')).digest('hex').slice(0, 16);
}

export function recordWhatsAppUsage(event: WhatsAppUsageEvent): void {
  try {
    const day = nairobiDay(Date.now());
    const inc = admin.firestore.FieldValue.increment;
    const update: Record<string, unknown> = {
      day,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (event.kind === 'inbound') {
      update.inbound = inc(1);
      update.users = { [userKey(event.phone)]: true };
    } else if (event.kind === 'sessionStarted') {
      update.sessionsStarted = inc(1);
    } else {
      update.outbound = inc(1);
      if (!event.ok) update.outboundFailed = inc(1);
    }

    void db
      .collection(USAGE_COLLECTION)
      .doc(day)
      .set(update, { merge: true })
      .catch((err: unknown) => logger.warn('WhatsApp usage meter write failed', err));
  } catch (err) {
    logger.warn('WhatsApp usage meter failed', err);
  }
}
