/**
 * Session Service
 * CRUD operations for WhatsApp conversation sessions
 */

import { db } from '../config/firebase.config';
import { Session, SessionContext } from '../types/session.types';
import { logger } from '../utils/logger';
import { STATE } from '../constants/states';

const SESSIONS_COLLECTION = 'whatsapp_sessions';
const SESSION_TIMEOUT = 30 * 60; // 30 minutes in seconds

/**
 * Create or get existing session
 */
export async function createOrGetSession(phone: string): Promise<Session> {
  try {
    const docRef = db.collection(SESSIONS_COLLECTION).doc(phone);
    const doc = await docRef.get();

    if (doc.exists) {
      const session = doc.data() as Session;
      // Check if session is expired
      if (isSessionExpired(session)) {
        logger.info('Session expired, creating new one', { phone });
        return await createNewSession(phone);
      }
      return session;
    }

    return await createNewSession(phone);
  } catch (error) {
    logger.error('Failed to create or get session', error);
    throw error;
  }
}

/**
 * Create a new session and save it to Firestore
 */
async function createNewSession(phone: string): Promise<Session> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const session: Session = {
      phone,
      language: 'en', // Default language
      currentState: STATE.LANGUAGE_SELECTION,
      context: {},
      lastActive: now,
      createdAt: now,
    };

    // Save to Firestore
    const docRef = db.collection(SESSIONS_COLLECTION).doc(phone);
    await docRef.set(session);
    logger.info('New session created and saved', { phone });

    return session;
  } catch (error) {
    logger.error('Failed to create new session', error);
    throw error;
  }
}

/**
 * Get session by phone
 */
export async function getSession(phone: string): Promise<Session | null> {
  try {
    const doc = await db.collection(SESSIONS_COLLECTION).doc(phone).get();

    if (!doc.exists) {
      return null;
    }

    const session = doc.data() as Session;

    // Check if session is expired
    if (isSessionExpired(session)) {
      logger.info('Session expired, deleting', { phone });
      await deleteSession(phone);
      return null;
    }

    return session;
  } catch (error) {
    logger.error('Failed to get session', error);
    throw error;
  }
}

/**
 * Update session state and context
 */
export async function updateSessionState(
  phone: string,
  newState: string,
  contextUpdates?: Partial<SessionContext>
): Promise<Session> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const docRef = db.collection(SESSIONS_COLLECTION).doc(phone);

    const updateData: Partial<Session> = {
      currentState: newState,
      lastActive: now,
    };

    if (contextUpdates) {
      const currentDoc = await docRef.get();
      const currentContext = currentDoc.exists ? (currentDoc.data()?.context || {}) : {};
      updateData.context = { ...currentContext, ...contextUpdates };
    }

    // Use set with merge to create doc if it doesn't exist
    await docRef.set(updateData, { merge: true });

    const updatedDoc = await docRef.get();
    return updatedDoc.data() as Session;
  } catch (error) {
    logger.error('Failed to update session state', error);
    throw error;
  }
}

/**
 * Update session language
 */
export async function updateSessionLanguage(phone: string, language: 'en' | 'sw'): Promise<Session> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const docRef = db.collection(SESSIONS_COLLECTION).doc(phone);

    // Use set with merge to create doc if it doesn't exist
    await docRef.set({
      language,
      lastActive: now,
    }, { merge: true });

    const doc = await docRef.get();
    return doc.data() as Session;
  } catch (error) {
    logger.error('Failed to update session language', error);
    throw error;
  }
}

/**
 * Update session context
 */
export async function updateSessionContext(
  phone: string,
  contextUpdates: Partial<SessionContext>
): Promise<Session> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const docRef = db.collection(SESSIONS_COLLECTION).doc(phone);

    const doc = await docRef.get();
    const currentContext = doc.exists ? (doc.data()?.context || {}) : {};

    // Use set with merge to create doc if it doesn't exist
    await docRef.set({
      context: { ...currentContext, ...contextUpdates },
      lastActive: now,
    }, { merge: true });

    const updatedDoc = await docRef.get();
    return updatedDoc.data() as Session;
  } catch (error) {
    logger.error('Failed to update session context', error);
    throw error;
  }
}

/**
 * Clear session context
 */
export async function clearSessionContext(phone: string): Promise<Session> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const docRef = db.collection(SESSIONS_COLLECTION).doc(phone);

    // Use set with merge to create doc if it doesn't exist
    await docRef.set({
      context: {},
      lastActive: now,
    }, { merge: true });

    const doc = await docRef.get();
    return doc.data() as Session;
  } catch (error) {
    logger.error('Failed to clear session context', error);
    throw error;
  }
}

/**
 * Reset session to main menu
 */
export async function resetSessionToMainMenu(phone: string): Promise<Session> {
  try {
    return await updateSessionState(phone, STATE.MAIN_MENU, {});
  } catch (error) {
    logger.error('Failed to reset session', error);
    throw error;
  }
}

/**
 * Delete session
 */
export async function deleteSession(phone: string): Promise<void> {
  try {
    await db.collection(SESSIONS_COLLECTION).doc(phone).delete();
    logger.info('Session deleted', { phone });
  } catch (error) {
    logger.error('Failed to delete session', error);
    throw error;
  }
}

/**
 * Check if session is expired
 */
function isSessionExpired(session: Session): boolean {
  const now = Math.floor(Date.now() / 1000);
  return now - session.lastActive > SESSION_TIMEOUT;
}

/**
 * Get all active sessions (for admin purposes)
 */
export async function getAllActiveSessions(): Promise<Session[]> {
  try {
    const snapshot = await db.collection(SESSIONS_COLLECTION).get();
    const sessions: Session[] = [];

    snapshot.forEach((doc) => {
      const session = doc.data() as Session;
      if (!isSessionExpired(session)) {
        sessions.push(session);
      }
    });

    return sessions;
  } catch (error) {
    logger.error('Failed to get all active sessions', error);
    throw error;
  }
}
