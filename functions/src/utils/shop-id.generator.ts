/**
 * Shop ID Generator
 * Generates sequential numeric shop IDs while skipping easy-to-guess patterns
 * FIXED: Added attempts++ to enable retry logic
 */

import { db } from '../config/firebase.config';
import { logger } from './logger';

/**
 * Patterns to skip (easy-to-guess numbers)
 * Examples: 1111, 2222, 1234, 1122, 1010, etc.
 */
function isEasyPattern(id: number): boolean {
  const str = String(id).padStart(4, '0');

  // Pattern 1: All same digits (1111, 2222, etc.)
  if (/^(.)\1{3,}$/.test(str)) {
    return true;
  }

  // Pattern 2: Sequential ascending (1234, 2345, 5678, etc.)
  if (/^(?:0123|1234|2345|3456|4567|5678|6789)/.test(str)) {
    return true;
  }

  // Pattern 3: Sequential descending (4321, 3210, etc.)
  if (/^(?:4321|3210|9876|8765|7654|6543)/.test(str)) {
    return true;
  }

  // Pattern 4: Alternating pairs (1122, 2233, 3344, 1212, 2121, etc.)
  if (/^(..)(?:\1|(?!.*\1)..)$/.test(str) || /^(.)(.)(?:\1\2|\2\1)$/.test(str)) {
    return true;
  }

  // Pattern 5: Mirror patterns (1221, 1331, 2332, etc.)
  if (/^(.)(.)(?:\2\1)$/.test(str)) {
    return true;
  }

  // Pattern 6: Simple increment pairs (1123, 1234, 2345, etc.)
  if (/^(.)(.)(.)\3$/.test(str) || /^(.)(.)(.)(.?)$/.test(str)) {
    const chars = str.split('');
    let isIncrement = true;
    for (let i = 1; i < chars.length; i++) {
      const diff = parseInt(chars[i]) - parseInt(chars[i - 1]);
      if (diff !== 1 && diff !== 0) {
        isIncrement = false;
        break;
      }
    }
    if (isIncrement && str !== '0000') {
      return true;
    }
  }

  // Pattern 7: All zeros (0000) and very low numbers (0001-0010)
  if (id <= 10) {
    return true;
  }

  return false;
}

/**
 * Get the next valid shop ID
 * Reads current counter from Firestore and generates next valid ID
 * FIXED: Now properly increments attempts counter
 */
export async function generateNextShopId(): Promise<string> {
  const counterDocRef = db.collection('_metadata').doc('shopIdCounter');
  let attempts = 0;
  const maxAttempts = 10000;

  try {
    while (attempts < maxAttempts) {
      attempts++; // ← FIX: INCREMENT THE COUNTER!
      
      // Use transaction to ensure atomicity
      const result = await db.runTransaction(async (transaction) => {
        // Read current counter
        const counterDoc = await transaction.get(counterDocRef);
        let currentCount = 1000; // Start from 1000 (4-digit numbers)

        if (counterDoc.exists) {
          const data = counterDoc.data();
          currentCount = data?.currentCount || 1000;
        }

        // Find next valid ID
        let nextId = currentCount + 1;
        let validIdFound = false;

        while (!validIdFound && nextId <= currentCount + 1000) {
          if (!isEasyPattern(nextId)) {
            validIdFound = true;
            break;
          }
          nextId++;
        }

        if (!validIdFound) {
          throw new Error('Could not find valid shop ID after 1000 attempts');
        }

        // Update counter in transaction
        transaction.set(counterDocRef, { currentCount: nextId }, { merge: true });

        return nextId;
      });

      logger.info('Generated new shop ID', { shopId: result });
      return String(result);
    }

    throw new Error(`Could not generate valid shop ID after ${maxAttempts} attempts`);
  } catch (error) {
    logger.error('Failed to generate shop ID', { error });
    throw error;
  }
}

/**
 * Get the next valid shop ID synchronously (for testing)
 * Note: This is for testing only. Use generateNextShopId() in production.
 */
export function getNextValidId(startFrom: number = 1000): number {
  let id = startFrom;

  while (isEasyPattern(id) && id < startFrom + 10000) {
    id++;
  }

  return id;
}

/**
 * Check if an ID matches an easy pattern
 */
export function isPattern(id: number): boolean {
  return isEasyPattern(id);
}

/**
 * Get statistics on pattern skipping
 */
export function getPatternStats(startFrom: number = 1000, endAt: number = 2000): {
  total: number;
  patterns: number;
  valid: number;
} {
  let patterns = 0;
  let valid = 0;

  for (let id = startFrom; id < endAt; id++) {
    if (isEasyPattern(id)) {
      patterns++;
    } else {
      valid++;
    }
  }

  return {
    total: endAt - startFrom,
    patterns,
    valid,
  };
}