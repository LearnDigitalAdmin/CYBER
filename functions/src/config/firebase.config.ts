/**
 * Firebase Configuration
 * Initializes Firebase Admin SDK
 */

import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

// Initialize Firebase Admin (uses default credentials from environment)
if (getApps().length === 0) {
  initializeApp();
}

export const db = getFirestore();
export const auth = getAuth();
export const bucket = getStorage().bucket();

// Set Firestore settings for better handling
db.settings({ ignoreUndefinedProperties: true });
