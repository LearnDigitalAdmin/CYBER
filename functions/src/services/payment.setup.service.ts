/**
 * Payment Setup Service
 * Handles storing and managing payment account setup requests
 */

import { db } from '../config/firebase.config';
import { PaymentSetupRequest, PaymentAccount, MpesaAccount, AirtelAccount, BankAccount, PaymentMethod } from '../types/shop.types';
import { logger } from '../utils/logger';

const SETUP_REQUESTS_COLLECTION = 'paymentSetupRequests';
const PAYMENT_ACCOUNTS_COLLECTION = 'paymentAccounts';

/**
 * Save payment setup request to Firestore (for admin review)
 */
export async function savePaymentSetupRequest(
  shopId: string,
  shopName: string,
  ownerName: string,
  ownerPhone: string,
  paymentMethod: PaymentMethod,
  paymentDetails: MpesaAccount | AirtelAccount | BankAccount
): Promise<PaymentSetupRequest> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const requestId = `${shopId}-${Date.now()}`;

    const request: PaymentSetupRequest = {
      id: requestId,
      shopId,
      shopName,
      ownerName,
      ownerPhone,
      paymentMethod,
      paymentDetails,
      createdAt: now,
      status: 'pending',
    };

    await db
      .collection(SETUP_REQUESTS_COLLECTION)
      .doc(requestId)
      .set(request);

    logger.info('Payment setup request saved', {
      requestId,
      shopId,
      paymentMethod,
    });

    return request;
  } catch (error) {
    logger.error('Failed to save payment setup request', {
      shopId,
      error,
    });
    throw error;
  }
}

/**
 * Save payment account to shop document (after admin approval)
 * Called manually by admin via script with Paystack subaccount ID
 * Split codes will be created automatically on first charge
 */
export async function savePaymentAccount(
  shopId: string,
  paymentMethod: PaymentMethod,
  paymentDetails: MpesaAccount | AirtelAccount | BankAccount,
  paystackSubaccountId: string
): Promise<PaymentAccount> {
  try {
    const now = Math.floor(Date.now() / 1000);

    const account: PaymentAccount = {
      type: paymentMethod,
      mpesa: paymentMethod === 'mpesa' ? (paymentDetails as MpesaAccount) : undefined,
      airtel: paymentMethod === 'airtel' ? (paymentDetails as AirtelAccount) : undefined,
      bank: paymentMethod === 'bank' ? (paymentDetails as BankAccount) : undefined,
      paystackSubaccountId,
      createdAt: now,
      updatedAt: now,
    };

    await db
      .collection('shops')
      .doc(shopId)
      .update({
        paymentAccount: account,
      });

    logger.info('Payment account saved to shop', {
      shopId,
      paymentMethod,
      paystackSubaccountId,
    });

    return account;
  } catch (error) {
    logger.error('Failed to save payment account', {
      shopId,
      error,
    });
    throw error;
  }
}

/**
 * Get payment account for a shop
 */
export async function getPaymentAccount(
  shopId: string,
  paymentMethod?: PaymentMethod
): Promise<PaymentAccount | null> {
  try {
    const doc = await db.collection('shops').doc(shopId).get();

    if (!doc.exists) {
      return null;
    }

    const shop = doc.data();
    const account = shop?.paymentAccount as PaymentAccount | undefined;

    if (!account) {
      return null;
    }

    // Filter by payment method if specified
    if (paymentMethod && account.type !== paymentMethod) {
      return null;
    }

    return account;
  } catch (error) {
    logger.error('Failed to get payment account', {
      shopId,
      paymentMethod,
      error,
    });
    return null;
  }
}

/**
 * Get all payment accounts for a shop
 */
export async function getAllPaymentAccounts(shopId: string): Promise<PaymentAccount[]> {
  try {
    const snapshot = await db
      .collection('shops')
      .doc(shopId)
      .collection(PAYMENT_ACCOUNTS_COLLECTION)
      .where('status', '==', 'active')
      .get();

    const accounts: PaymentAccount[] = [];
    snapshot.forEach((doc) => {
      accounts.push(doc.data() as PaymentAccount);
    });

    return accounts;
  } catch (error) {
    logger.error('Failed to get all payment accounts', {
      shopId,
      error,
    });
    return [];
  }
}

/**
 * Update payment account with Paystack sub-account ID (admin action)
 */
export async function updatePaymentAccountWithPaystackId(
  shopId: string,
  accountId: string,
  paystackSubaccountId: string
): Promise<PaymentAccount | null> {
  try {
    const docRef = db
      .collection('shops')
      .doc(shopId)
      .collection(PAYMENT_ACCOUNTS_COLLECTION)
      .doc(accountId);

    await docRef.update({
      paystackSubaccountId,
      updatedAt: Math.floor(Date.now() / 1000),
    });

    const updatedDoc = await docRef.get();
    return updatedDoc.data() as PaymentAccount;
  } catch (error) {
    logger.error('Failed to update payment account with Paystack ID', {
      shopId,
      accountId,
      error,
    });
    return null;
  }
}

/**
 * Approve payment setup request (admin action)
 * Now requires Paystack subaccount ID instead of split code
 * Split codes will be created automatically on first charge
 */
export async function approvePaymentSetupRequest(
  requestId: string,
  paystackSubaccountId?: string
): Promise<boolean> {
  try {
    const now = Math.floor(Date.now() / 1000);

    const requestDoc = await db
      .collection(SETUP_REQUESTS_COLLECTION)
      .doc(requestId)
      .get();

    if (!requestDoc.exists) {
      logger.warn('Setup request not found', { requestId });
      return false;
    }

    const request = requestDoc.data() as PaymentSetupRequest;

    // Save payment account (paystackSubaccountId is required)
    if (!paystackSubaccountId) {
      logger.warn('Paystack subaccount ID required for approval', { requestId });
      return false;
    }

    await savePaymentAccount(
      request.shopId,
      request.paymentMethod,
      request.paymentDetails,
      paystackSubaccountId
    );

    // Update request status
    await db
      .collection(SETUP_REQUESTS_COLLECTION)
      .doc(requestId)
      .update({
        status: 'approved',
        approvedAt: now,
      });

    logger.info('Payment setup request approved', {
      requestId,
      shopId: request.shopId,
      paystackSubaccountId,
    });

    return true;
  } catch (error) {
    logger.error('Failed to approve payment setup request', {
      requestId,
      error,
    });
    return false;
  }
}

/**
 * Get pending payment setup requests (admin view)
 */
export async function getPendingSetupRequests(limit: number = 50): Promise<PaymentSetupRequest[]> {
  try {
    const snapshot = await db
      .collection(SETUP_REQUESTS_COLLECTION)
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const requests: PaymentSetupRequest[] = [];
    snapshot.forEach((doc) => {
      requests.push(doc.data() as PaymentSetupRequest);
    });

    return requests;
  } catch (error) {
    logger.error('Failed to get pending setup requests', { error });
    return [];
  }
}
