/**
 * Payment Charge Service
 * Handles STK push requests via Paystack for Safaricom and Airtel
 */

import { db } from '../config/firebase.config';
import { PAYSTACK_SECRET_KEY } from '../config/paystack.config';
import { PaymentTransaction, PaymentNetwork } from '../types/shop.types';
import { logger } from '../utils/logger';
import axios from 'axios';

//const PAYSTACK_SECRET_KEY = PAYSTACK_SECRET_KEY || '';
const PAYSTACK_API_BASE = 'https://api.paystack.co';
// process.env.
interface PaystackChargeResponse {
  status: boolean;
  message: string;
  data?: {
    reference: string;
    authorization_url?: string;
    display_text?: string;
    account_reference?: string;
  };
}

/**
 * Send STK push via Paystack using mobile_money endpoint
 * Works for both Safaricom and Airtel M-Pesa
 * Uses split_code for shop sub-account routing
 */
export async function sendStkPush(
  shopId: string,
  amount: number,
  customerPhone: string,
  network: PaymentNetwork,
  paystackSplitCode?: string
): Promise<{ success: boolean; reference?: string; error?: string }> {
  try {
    // Validate inputs
    if (!PAYSTACK_SECRET_KEY.value()) {
      throw new Error('Paystack secret key not configured');
    }

    if (!paystackSplitCode) {
      throw new Error('Paystack split code not configured for this shop');
    }

    // Normalize phone number to +254XXXXXXXXX format
    const normalizedPhone = normalizePhoneNumber(customerPhone);

    logger.info('Preparing STK push via Paystack', {
      shopId,
      amount,
      network,
      phone: normalizedPhone,
      splitCode: paystackSplitCode,
    });

    // Convert amount to cents
    const amountInCents = Math.round(amount * 100);

    // Generate unique reference with REPORT prefix for tracking (matches MyDuka pattern)
    const reference = `REPORT_${shopId}_${Date.now()}`;

    // Prepare payload using mobile_money endpoint (matches working implementation)
    const payload = {
      email: `shop-${shopId}@cogvana.co.ke`,
      amount: amountInCents,
      currency: 'KES',
      mobile_money: {
        phone: normalizedPhone,
        provider: network === 'safaricom' ? 'mpesa' : 'airtel',
      },
      reference: reference,
      split_code: paystackSplitCode, // Routes funds to shop's account
      metadata: {
        shopId,
        network,
        customerPhone,
        type: 'shop_charge',
      },
    };

    logger.info('Sending mobile_money charge to Paystack', {
      shopId,
      reference,
      amount,
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
      logger.warn('Paystack STK push failed', {
        shopId,
        message: response.data.message,
        reference,
      });

      return {
        success: false,
        error: response.data.message,
      };
    }

    const displayText = response.data.data?.display_text;

    logger.info('STK push sent successfully', {
      shopId,
      reference,
      displayText,
    });

    return {
      success: true,
      reference: reference, // Use our REPORT_ prefixed reference, not Paystack's
    };
  } catch (error) {
    logger.error('Failed to send STK push', {
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
 * Save payment transaction to Firestore
 */
export async function savePaymentTransaction(
  shopId: string,
  amount: number,
  customerPhone: string,
  network: PaymentNetwork,
  transactionId: string
): Promise<PaymentTransaction> {
  try {
    const now = Math.floor(Date.now() / 1000);
    // Use the reference directly (which is REPORT_shopId_timestamp format)
    // Don't concatenate - the reference is already unique and properly formatted
    const txnId = transactionId;

    const transaction: PaymentTransaction = {
      id: txnId,
      shopId,
      amount,
      customerPhone,
      network,
      transactionId,
      timestamp: now,
      status: 'pending',
      createdVia: 'whatsapp',
    };

    await db
      .collection('shops')
      .doc(shopId)
      .collection('transactions')
      .doc(txnId)
      .set(transaction);

    logger.info('Payment transaction saved', {
      shopId,
      txnId,
      amount,
    });

    return transaction;
  } catch (error) {
    logger.error('Failed to save payment transaction', {
      shopId,
      error,
    });
    throw error;
  }
}

/**
 * Get payment transaction
 */
export async function getPaymentTransaction(shopId: string, txnId: string): Promise<PaymentTransaction | null> {
  try {
    const doc = await db
      .collection('shops')
      .doc(shopId)
      .collection('transactions')
      .doc(txnId)
      .get();

    if (!doc.exists) {
      return null;
    }

    return doc.data() as PaymentTransaction;
  } catch (error) {
    logger.error('Failed to get payment transaction', {
      shopId,
      txnId,
      error,
    });
    return null;
  }
}

/**
 * Update transaction status (called from webhook)
 */
export async function updateTransactionStatus(
  shopId: string,
  txnId: string,
  status: 'success' | 'failed',
  webhookData?: Record<string, any>
): Promise<boolean> {
  try {
    const docRef = db
      .collection('shops')
      .doc(shopId)
      .collection('transactions')
      .doc(txnId);

    await docRef.update({
      status,
      webhookData,
      updatedAt: Math.floor(Date.now() / 1000),
    });

    logger.info('Transaction status updated', {
      shopId,
      txnId,
      status,
    });

    return true;
  } catch (error) {
    logger.error('Failed to update transaction status', {
      shopId,
      txnId,
      error,
    });
    return false;
  }
}

/**
 * Get recent transactions for a shop
 */
export async function getRecentTransactions(
  shopId: string,
  limit: number = 10
): Promise<PaymentTransaction[]> {
  try {
    const snapshot = await db
      .collection('shops')
      .doc(shopId)
      .collection('transactions')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    const transactions: PaymentTransaction[] = [];
    snapshot.forEach((doc) => {
      transactions.push(doc.data() as PaymentTransaction);
    });

    return transactions;
  } catch (error) {
    logger.error('Failed to get recent transactions', {
      shopId,
      error,
    });
    return [];
  }
}

/**
 * Verify transaction with Paystack
 * Useful for manual verification if webhook fails
 */
export async function verifyPaystackTransaction(reference: string): Promise<{
  status: boolean;
  message: string;
  data?: any;
}> {
  try {
    if (!PAYSTACK_SECRET_KEY.value()) {
      throw new Error('Paystack secret key not configured');
    }

    const response = await axios.get(`${PAYSTACK_API_BASE}/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY.value()}`,
      },
    });

    return response.data;
  } catch (error) {
    logger.error('Failed to verify Paystack transaction', {
      reference,
      error,
    });

    return {
      status: false,
      message: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}

/**
 * Find transaction by Paystack reference
 * Used by webhook to find shop and transaction details
 */
export async function findTransactionByReference(reference: string): Promise<{
  found: boolean;
  shopId?: string;
  transaction?: PaymentTransaction;
}> {
  try {
    // Reference format from Paystack (e.g., "pystack_ref_12345")
    // The transaction was saved as: `${shopId}-${transactionId}`
    // We need to search across all shops

    const shopsSnapshot = await db.collection('shops').get();

    for (const shopDoc of shopsSnapshot.docs) {
      const transactionsSnapshot = await shopDoc.ref
        .collection('transactions')
        .where('transactionId', '==', reference)
        .get();

      if (!transactionsSnapshot.empty) {
        const transactionDoc = transactionsSnapshot.docs[0];
        return {
          found: true,
          shopId: shopDoc.id,
          transaction: transactionDoc.data() as PaymentTransaction,
        };
      }
    }

    return { found: false };
  } catch (error) {
    logger.error('Failed to find transaction by reference', {
      reference,
      error,
    });
    return { found: false };
  }
}

/**
 * Normalize phone number to Paystack format
 * Expected format: +254XXXXXXXXX (with + prefix)
 */
function normalizePhoneNumber(phone: string): string {
  let normalized = phone.replace(/\D/g, ''); // Remove non-digits

  // Remove leading 0 if present
  if (normalized.startsWith('0')) {
    normalized = normalized.substring(1);
  }

  // Ensure Kenya country code
  if (!normalized.startsWith('254')) {
    normalized = `254${normalized}`;
  }

  // Add + prefix for Paystack
  return `+${normalized}`;
}
