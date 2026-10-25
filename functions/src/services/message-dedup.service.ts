/**
 * Idempotent handling by WhatsApp message id.
 * Keeps the last few ids on the sender's existing session document (`processedIds`) and claims an id inside a
 * transaction, so a retried webhook delivery is dropped even if two instances receive it at the same moment.
 * Fails open: if Firestore is unavailable the message is processed rather than lost.
 */
import { db } from '../config/firebase.config';
import { dedupDecision } from '../utils/dedup';
import { logger } from '../utils/logger';

export async function claimMessage(phone: string, messageId: string): Promise<boolean> {
  if (!messageId) return true;
  try {
    const ref = db.collection('whatsapp_sessions').doc(phone);
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const { duplicate, next } = dedupDecision(snap.exists ? snap.data()?.processedIds : undefined, messageId);
      if (duplicate) return false;
      tx.set(ref, { processedIds: next }, { merge: true });
      return true;
    });
  } catch (err) {
    logger.warn('Message dedup unavailable, processing anyway', { name: (err as Error)?.name });
    return true;
  }
}
