/**
 * MyChama Cross-Project Configuration
 *
 * The WhatsApp bot lives in the CYBER project (plot-9fd6e) but MyChama data
 * lives in a separate Firebase project (mychama1).
 *
 * Access model:
 *   The CYBER default compute service account has been granted the
 *   "Firebase Admin" role on the mychama1 project via IAM. Because of that,
 *   Application Default Credentials (the runtime identity of this function)
 *   can talk to mychama1's Firestore with no service-account JSON anywhere
 *   in this repository and no extra secrets to rotate.
 *
 * We initialise a NAMED secondary Admin app so the default app (plot-9fd6e)
 * is untouched. Initialisation is lazy + idempotent so cold starts that never
 * touch MyChama pay nothing for it.
 */

import { getApps, getApp, initializeApp, applicationDefault, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

export const MYCHAMA_PROJECT_ID = 'mychama1';
const MYCHAMA_APP_NAME = 'mychama';

/** Collection names — single source of truth, mirrored in firestoreData.json. */
export const MC = {
  CHAMAS: 'chamas',
  MEMBERS: 'members',
  LOAN_PRODUCTS: 'loanProducts',
  CONTRIBUTIONS: 'contributions',
  LOANS: 'loans',
  TRANSACTIONS: 'transactions',
  MGR_POTS: 'mgrPots',
  MGR_RECORDS: 'records',
  MGR_PAYOUTS: 'payouts',
  PAYMENT_INTENTS: 'paymentIntents',
  USER_CHAMAS: 'userChamas',
  MEMBERSHIPS: 'memberships',
  WHATSAPP_AUDIT: 'whatsappAuditLog',
  WHATSAPP_RATE_LIMITS: 'whatsappRateLimits',
} as const;

let cachedApp: App | null = null;
let cachedDb: Firestore | null = null;

/**
 * Get (and lazily create) the secondary Admin app bound to mychama1.
 */
export function getMyChamaApp(): App {
  if (cachedApp) {
    return cachedApp;
  }

  const existing = getApps().find((a) => a.name === MYCHAMA_APP_NAME);
  if (existing) {
    cachedApp = getApp(MYCHAMA_APP_NAME);
    return cachedApp;
  }

  cachedApp = initializeApp(
    {
      credential: applicationDefault(),
      projectId: MYCHAMA_PROJECT_ID,
    },
    MYCHAMA_APP_NAME
  );

  return cachedApp;
}

/**
 * Firestore handle for the mychama1 project.
 * Settings are applied exactly once, on first construction.
 */
export function mychamaDb(): Firestore {
  if (cachedDb) {
    return cachedDb;
  }

  cachedDb = getFirestore(getMyChamaApp());
  cachedDb.settings({ ignoreUndefinedProperties: true });

  return cachedDb;
}

/** Convenience path builders — keeps string concatenation out of the services. */
export const mcPath = {
  chama: (chamaId: string) => `${MC.CHAMAS}/${chamaId}`,
  members: (chamaId: string) => `${MC.CHAMAS}/${chamaId}/${MC.MEMBERS}`,
  member: (chamaId: string, memberId: string) => `${MC.CHAMAS}/${chamaId}/${MC.MEMBERS}/${memberId}`,
  loanProducts: (chamaId: string) => `${MC.CHAMAS}/${chamaId}/${MC.LOAN_PRODUCTS}`,
  contributions: (chamaId: string) => `${MC.CHAMAS}/${chamaId}/${MC.CONTRIBUTIONS}`,
  loans: (chamaId: string) => `${MC.CHAMAS}/${chamaId}/${MC.LOANS}`,
  transactions: (chamaId: string) => `${MC.CHAMAS}/${chamaId}/${MC.TRANSACTIONS}`,
  mgrPots: (chamaId: string) => `${MC.CHAMAS}/${chamaId}/${MC.MGR_POTS}`,
  mgrRecords: (chamaId: string, potId: string) =>
    `${MC.CHAMAS}/${chamaId}/${MC.MGR_POTS}/${potId}/${MC.MGR_RECORDS}`,
  mgrPayouts: (chamaId: string, potId: string) =>
    `${MC.CHAMAS}/${chamaId}/${MC.MGR_POTS}/${potId}/${MC.MGR_PAYOUTS}`,
  paymentIntents: (chamaId: string) => `${MC.CHAMAS}/${chamaId}/${MC.PAYMENT_INTENTS}`,
};

/**
 * Fee engine constants.
 * These MUST stay identical to the MyChama web app (see firestoreData.json →
 * feeEngine) or a member would be quoted one figure on WhatsApp and another
 * in the app for the same payment.
 */
export const FEES = {
  PAYSTACK_FEE_RATE: 0.015,
  PAYSTACK_FEE_CAP: 3000,
  CONTRIBUTION_MARKUP_RATE: 0.005,
  LOAN_MARKUP_RATE: {
    free: null,
    starter: 0.015,
    basic: 0.011,
    growth: 0.007,
    max: 0.007,
  } as Record<string, number | null>,
  MGR_PAYOUT_MARKUP_RATE: {
    free: null,
    starter: 0.015,
    basic: 0.011,
    growth: 0.007,
    max: 0.007,
  } as Record<string, number | null>,
} as const;

/** Session security windows specific to the MyChama flow. */
export const MC_SECURITY = {
  /** Re-verify identity if the member has been idle in MyChama this long. */
  REAUTH_AFTER_SECONDS: 15 * 60,
  /** Wrong-ID attempts allowed before a cooldown. */
  MAX_AUTH_ATTEMPTS: 3,
  /** Cooldown applied once attempts are exhausted. */
  AUTH_LOCKOUT_SECONDS: 15 * 60,
  /** Maximum payment intents a single phone may raise per rolling hour. */
  MAX_INTENTS_PER_HOUR: 10,
} as const;
