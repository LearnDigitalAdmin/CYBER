/**
 * Report Charge Service
 * Handles charging users for report generation via Paystack
 * Weekly: KES 50, Monthly: KES 200
 */

import { db } from '../config/firebase.config';
import { PAYSTACK_SECRET_KEY } from '../config/paystack.config';
import { logger } from '../utils/logger';
import axios from 'axios';

const PAYSTACK_API_BASE = 'https://api.paystack.co';

export interface ReportChargeMetadata {
  shopId: string;
  reportPeriod: 'weekly' | 'monthly';
  dateRange: 'last7days' | 'last30days';
  userPhone: string;
  chargeType: 'report_charge';
  chargeAmount: number;
}

export interface PaystackChargeResponse {
  status: boolean;
  message: string;
  data?: {
    reference: string;
    authorization_url?: string;
    display_text?: string;
  };
}

/**
 * Get charge amount based on report period
 */
export function getReportChargeAmount(period: 'weekly' | 'monthly'): number {
  return period === 'weekly' ? 50 : 200; // Weekly: 50 KES, Monthly: 200 KES
}

/**
 * Check if user already has this report (free - no duplicate charges)
 */
export async function hasExistingReport(
  shopId: string,
  period: 'weekly' | 'monthly',
  dateRange: 'last7days' | 'last30days'
): Promise<boolean> {
  try {
    const reportsRef = db
      .collection('shops')
      .doc(shopId)
      .collection('reports');

    const query = await reportsRef
      .where('period', '==', period)
      .where('dateRange', '==', dateRange)
      .orderBy('generatedAt', 'desc')
      .limit(1)
      .get();

    return !query.empty;
  } catch (error) {
    logger.error('Error checking for existing report', {
      shopId,
      period,
      dateRange,
      error,
    });
    return false;
  }
}

/**
 * Create a report charge request for Paystack STK push
 * No split code needed - goes directly to platform account
 */
export async function initiateReportCharge(
  shopId: string,
  userPhone: string,
  period: 'weekly' | 'monthly',
  dateRange: 'last7days' | 'last30days'
): Promise<{ success: boolean; reference?: string; error?: string }> {
  try {
    // Validate inputs
    if (!PAYSTACK_SECRET_KEY.value()) {
      throw new Error('Paystack secret key not configured');
    }

    // Get charge amount
    const chargeAmount = getReportChargeAmount(period);

    // Normalize phone number
    const normalizedPhone = normalizePhoneNumber(userPhone);
    if (!normalizedPhone) {
      throw new Error('Invalid phone number format');
    }

    logger.info('Initiating report charge', {
      shopId,
      period,
      dateRange,
      amount: chargeAmount,
      phone: normalizedPhone,
    });

    // Convert amount to cents
    const amountInCents = Math.round(chargeAmount * 100);

    // Generate unique reference with REPORT prefix for tracking
    const reference = `REPORT_${period.toUpperCase()}_${shopId}_${Date.now()}`;

    // Prepare payload for STK push (no split code - platform account)
    const payload = {
      email: `report-${shopId}@cogvana.co.ke`,
      amount: amountInCents,
      currency: 'KES',
      mobile_money: {
        phone: normalizedPhone,
        provider: 'mpesa', // Reports charged via M-Pesa only
      },
      reference: reference,
      metadata: {
        shopId,
        reportPeriod: period,
        dateRange,
        userPhone,
        chargeType: 'report_charge',
        chargeAmount,
      },
    };

    logger.info('Sending report charge to Paystack', {
      shopId,
      reference,
      amount: chargeAmount,
      phone: normalizedPhone,
    });

    // Make request to Paystack /charge endpoint
    const response = await axios.post<PaystackChargeResponse>(
      `${PAYSTACK_API_BASE}/charge`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY.value()}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.data.status) {
      logger.warn('Paystack report charge failed', {
        shopId,
        message: response.data.message,
        reference,
      });

      return {
        success: false,
        error: response.data.message,
      };
    }

    logger.info('Report charge initiated successfully', {
      shopId,
      reference,
      amount: chargeAmount,
    });

    // Save charge request to Firestore
    await saveReportChargeRequest(
      shopId,
      reference, // Use our REPORT_WEEKLY_* prefixed reference, not Paystack's
      chargeAmount,
      normalizedPhone,
      period,
      dateRange
    );

    return {
      success: true,
      reference: reference, // Use our REPORT_WEEKLY_* prefixed reference, not Paystack's
    };
  } catch (error) {
    logger.error('Failed to initiate report charge', {
      shopId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Save report charge request to Firestore
 */
async function saveReportChargeRequest(
  shopId: string,
  reference: string,
  amount: number,
  userPhone: string,
  period: 'weekly' | 'monthly',
  dateRange: 'last7days' | 'last30days'
): Promise<void> {
  try {
    const chargeRecord = {
      reference,
      shopId,
      userPhone,
      reportPeriod: period,
      dateRange,
      chargeAmount: amount,
      status: 'pending',
      chargeType: 'report_charge',
      createdAt: new Date().toISOString(),
      createdAtTimestamp: Date.now(),
    };

    await db
      .collection('report_charges')
      .doc(reference)
      .set(chargeRecord);

    await db
      .collection('shops')
      .doc(shopId)
      .collection('report_charges')
      .doc(reference)
      .set(chargeRecord);

    logger.info('Report charge request saved', {
      shopId,
      reference,
      amount,
    });
  } catch (error) {
    logger.error('Failed to save report charge request', {
      shopId,
      reference,
      error,
    });
    throw error;
  }
}

/**
 * Get report charge by reference
 */
export async function getReportCharge(
  reference: string
): Promise<any | null> {
  try {
    const doc = await db
      .collection('report_charges')
      .doc(reference)
      .get();

    if (doc.exists) {
      return { id: doc.id, ...doc.data() };
    }
    return null;
  } catch (error) {
    logger.error('Failed to get report charge', {
      reference,
      error,
    });
    return null;
  }
}

/**
 * Update report charge status
 */
export async function updateReportChargeStatus(
  reference: string,
  status: 'success' | 'failed',
  shopId?: string
): Promise<void> {
  try {
    const updates = {
      status,
      updatedAt: new Date().toISOString(),
      updatedAtTimestamp: Date.now(),
    };

    await db
      .collection('report_charges')
      .doc(reference)
      .update(updates);

    if (shopId) {
      await db
        .collection('shops')
        .doc(shopId)
        .collection('report_charges')
        .doc(reference)
        .update(updates);
    }

    logger.info('Report charge status updated', {
      reference,
      status,
      shopId,
    });
  } catch (error) {
    logger.error('Failed to update report charge status', {
      reference,
      error,
    });
    throw error;
  }
}

/**
 * Normalize phone number to +254XXXXXXXXX format
 */
function normalizePhoneNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');

  if (digits.startsWith('254')) {
    return digits.length === 12 ? `+${digits}` : null;
  } else if (digits.startsWith('0')) {
    return digits.length === 10 ? `+254${digits.substring(1)}` : null;
  } else if (digits.length === 9) {
    return `+254${digits}`;
  }

  return null;
}
