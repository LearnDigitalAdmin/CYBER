/**
 * Payment Split Code Service
 * Handles automatic creation and caching of Paystack split codes
 * Platform takes 1.5% commission after Paystack fees, rest goes to shop
 */

import { db } from '../config/firebase.config';
import { PAYSTACK_SECRET_KEY } from '../config/paystack.config';
import { CachedSplitCode } from '../types/shop.types';
import { logger } from '../utils/logger';
import axios from 'axios';
import * as admin from 'firebase-admin';

const PAYSTACK_API_BASE = 'https://api.paystack.co';
const SPLIT_CODES_COLLECTION = 'splitCodes';
const PLATFORM_COMMISSION_RATE = 1.5; // 1.5% platform commission after Paystack fees

/**
 * Get or create a split code for a shop
 * Automatically creates split codes and caches them to avoid duplication
 *
 * How it works:
 * 1. Paystack takes its fee (~1.99% for M-Pesa)
 * 2. Remaining amount is split:
 *    - Shop gets: 98.5% (remaining amount after platform fee)
 *    - Platform gets: 1.5% (remaining amount after platform fee)
 */
export async function getOrCreateSplitCode(
  shopId: string,
  subaccountId: string,
  commissionRate: number = PLATFORM_COMMISSION_RATE
): Promise<string> {
  try {
    if (!PAYSTACK_SECRET_KEY.value()) {
      throw new Error('Paystack secret key not configured');
    }

    // Check cache first (fast path)
    const splitDoc = await db
      .collection(SPLIT_CODES_COLLECTION)
      .doc(shopId)
      .get();

    if (splitDoc.exists) {
      const data = splitDoc.data() as CachedSplitCode;

      // Verify split code exists and commission rate matches
      if (data?.splitCode && data?.commissionRate === commissionRate) {
        logger.info('Using cached split code', {
          shopId,
          splitCode: data.splitCode,
          subaccountId: data.subaccountId,
        });

        // Update last accessed time
        await db
          .collection(SPLIT_CODES_COLLECTION)
          .doc(shopId)
          .update({
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          })
          .catch(() => {
            // Ignore errors on update timestamp
          });

        return data.splitCode;
      }

      // Commission rate changed or invalid data - need new split code
      logger.warn('Split code needs recreation', {
        shopId,
        reason: !data?.splitCode ? 'no split code' : 'commission rate changed',
        oldRate: data?.commissionRate,
        newRate: commissionRate,
      });
    }

    // Create new split code
    const shopShare = 100 - commissionRate; // Shop gets rest after platform commission

    const splitPayload = {
      name: `Shop_${shopId}_Split`,
      type: 'percentage',
      currency: 'KES',
      subaccounts: [
        {
          subaccount: subaccountId,
          share: shopShare, // Shop gets this percentage
        },
      ],
      bearer_type: 'all-proportional',
    };

    logger.info('Creating split code via Paystack API', {
      shopId,
      subaccountId,
      shopShare,
      platformCommission: commissionRate,
    });

    const response = await axios.post(
      `${PAYSTACK_API_BASE}/split`,
      splitPayload,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY.value()}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000, // 10 second timeout
      }
    );

    if (!response.data.status) {
      throw new Error(
        `Paystack API returned status false: ${response.data.message}`
      );
    }

    const splitCode = response.data.data?.split_code;

    if (!splitCode) {
      throw new Error('No split code returned from Paystack API');
    }

    // Cache the split code in Firestore
    const now = Math.floor(Date.now() / 1000);
    const cachedSplit: CachedSplitCode = {
      shopId,
      splitCode,
      subaccountId,
      commissionRate,
      createdAt: now,
      updatedAt: now,
    };

    await db
      .collection(SPLIT_CODES_COLLECTION)
      .doc(shopId)
      .set(cachedSplit, { merge: false });

    logger.info('Split code created and cached successfully', {
      shopId,
      splitCode,
      subaccountId,
      commissionRate,
    });

    return splitCode;
  } catch (error) {
    logger.error('Failed to get/create split code', {
      shopId,
      subaccountId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Validate a split code exists in Paystack
 * Useful for health checks
 */
export async function validateSplitCode(splitCode: string): Promise<boolean> {
  try {
    if (!PAYSTACK_SECRET_KEY.value()) {
      logger.warn('Cannot validate split code: secret key not configured');
      return false;
    }

    const response = await axios.get(
      `${PAYSTACK_API_BASE}/split/${splitCode}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY.value()}`,
        },
        timeout: 5000,
      }
    );

    return response.data.status === true;
  } catch (error) {
    logger.warn('Split code validation failed', {
      splitCode,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Get cached split code for a shop
 * Returns null if not cached
 */
export async function getCachedSplitCode(
  shopId: string
): Promise<CachedSplitCode | null> {
  try {
    const doc = await db
      .collection(SPLIT_CODES_COLLECTION)
      .doc(shopId)
      .get();

    if (!doc.exists) {
      return null;
    }

    return doc.data() as CachedSplitCode;
  } catch (error) {
    logger.error('Failed to get cached split code', {
      shopId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Invalidate a cached split code (useful if commission rate changes)
 */
export async function invalidateSplitCodeCache(shopId: string): Promise<boolean> {
  try {
    await db
      .collection(SPLIT_CODES_COLLECTION)
      .doc(shopId)
      .delete();

    logger.info('Split code cache invalidated', { shopId });
    return true;
  } catch (error) {
    logger.error('Failed to invalidate split code cache', {
      shopId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Get all cached split codes (admin utility)
 */
export async function getAllCachedSplitCodes(
  limit: number = 100
): Promise<CachedSplitCode[]> {
  try {
    const snapshot = await db
      .collection(SPLIT_CODES_COLLECTION)
      .limit(limit)
      .get();

    const splits: CachedSplitCode[] = [];
    snapshot.forEach((doc) => {
      splits.push(doc.data() as CachedSplitCode);
    });

    return splits;
  } catch (error) {
    logger.error('Failed to get all cached split codes', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return [];
  }
}

/**
 * Retry wrapper for split code creation with exponential backoff
 * Useful for handling transient Paystack API failures
 */
export async function getOrCreateSplitCodeWithRetry(
  shopId: string,
  subaccountId: string,
  maxRetries: number = 3,
  commissionRate: number = PLATFORM_COMMISSION_RATE
): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await getOrCreateSplitCode(
        shopId,
        subaccountId,
        commissionRate
      );
    } catch (error) {
      const isLastAttempt = attempt === maxRetries - 1;

      if (isLastAttempt) {
        logger.error('Split code creation failed after all retries', {
          shopId,
          attempts: maxRetries,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delayMs = 1000 * Math.pow(2, attempt);
      logger.warn('Split code creation failed, retrying', {
        shopId,
        attempt: attempt + 1,
        maxRetries,
        delayMs,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error('Max retries exceeded for split code creation');
}
