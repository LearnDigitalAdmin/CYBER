/**
 * PAYMENT LISTENER SERVICE
 *
 * Listens to Firestore payment updates in real-time
 * When a payment succeeds, automatically sends message to user
 * Works in the background independently of user state/context
 *
 * This is triggered when STK push is sent and reference is saved to session context
 */

import * as admin from 'firebase-admin';
import { logger } from '../utils/logger';
import { sendWhatsAppMessage } from './whatsapp.service';

const db = admin.firestore();

// Store active listeners to prevent duplicates
const activeListeners = new Map<string, () => void>();

/**
 * Start listening for customer charge payment updates
 * Watches shops/{shopId}/transactions/{reference} for status changes
 */
export function startCustomerChargeListener(
  shopId: string,
  reference: string,
  userPhone: string,
  customerPhone: string,
  chargeAmount: number,
  userLanguage: 'en' | 'sw'
): void {
  try {
    const listenerKey = `${shopId}_${reference}`;

    // Don't create duplicate listeners
    if (activeListeners.has(listenerKey)) {
      logger.info('Listener already active', { listenerKey });
      return;
    }

    logger.info('Starting customer charge payment listener', {
      shopId,
      reference,
      userPhone,
    });

    // Listen to the transaction document
    const unsubscribe = db
      .collection('shops')
      .doc(shopId)
      .collection('transactions')
      .doc(reference)
      .onSnapshot(
        async (doc) => {
          if (!doc.exists) {
            logger.warn('Transaction document does not exist', {
              shopId,
              reference,
            });
            return;
          }

          const data = doc.data();
          const status = data?.status;

          logger.info('Transaction status update', {
            shopId,
            reference,
            status,
          });

          // Only process on successful payment
          if (status === 'success') {
            logger.info('✅ Customer charge payment confirmed', {
              shopId,
              reference,
            });

            try {
              // Send success message to shop owner
              const successMessage = userLanguage === 'en'
                ? `✅ *Payment Received!*\n\n💰 Amount: KES ${chargeAmount}\n👤 Customer: ${customerPhone}\n\nThe payment has been successfully processed.`
                : `✅ *Malipo Umestifu!*\n\n💰 Kiasi: KES ${chargeAmount}\n👤 Mteja: ${customerPhone}\n\nMalipo yamekubali kwa mafanikio.`;

              await sendWhatsAppMessage(userPhone, successMessage);
              logger.info('✅ Success message sent to shop owner', {
                userPhone,
              });
            } catch (msgError) {
              logger.error('Failed to send success message:', msgError);
            }

            // Unsubscribe after successful payment
            try {
              unsubscribe();
              activeListeners.delete(listenerKey);
              logger.info('Listener unsubscribed after payment success', {
                listenerKey,
              });
            } catch (unsubError) {
              logger.error('Error unsubscribing listener:', unsubError);
            }
          } else if (status === 'failed') {
            logger.info('❌ Customer charge payment failed', {
              shopId,
              reference,
            });

            try {
              // Send failure message to shop owner
              const failureMessage = userLanguage === 'en'
                ? `❌ *Payment Failed*\n\n💰 Amount: KES ${chargeAmount}\n👤 Customer: ${customerPhone}\n\nThe payment was not processed. Please try again.`
                : `❌ *Malipo Umeshindwa*\n\n💰 Kiasi: KES ${chargeAmount}\n👤 Mteja: ${customerPhone}\n\nMalipo halikukubali. Tafadhali jaribu tena.`;

              await sendWhatsAppMessage(userPhone, failureMessage);
              logger.info('Failure message sent to shop owner', {
                userPhone,
              });
            } catch (msgError) {
              logger.error('Failed to send failure message:', msgError);
            }

            // Unsubscribe after failure
            try {
              unsubscribe();
              activeListeners.delete(listenerKey);
              logger.info('Listener unsubscribed after payment failure', {
                listenerKey,
              });
            } catch (unsubError) {
              logger.error('Error unsubscribing listener:', unsubError);
            }
          }
        },
        (error) => {
          logger.error('Error in customer charge listener:', error);
          // Try to unsubscribe on error
          try {
            unsubscribe();
            activeListeners.delete(listenerKey);
          } catch (e) {
            logger.error('Error unsubscribing on error:', e);
          }
        }
      );

    // Store the unsubscribe function
    activeListeners.set(listenerKey, unsubscribe);
    logger.info('Customer charge listener registered', { listenerKey });
  } catch (error) {
    logger.error('Failed to start customer charge listener:', error);
  }
}

/**
 * Start listening for report charge payment updates
 * Watches report_charges/{reference} for status changes
 */
export function startReportChargeListener(
  reference: string,
  userPhone: string,
  reportPeriod: string,
  chargeAmount: number,
  userLanguage: 'en' | 'sw'
): void {
  try {
    const listenerKey = `report_${reference}`;

    // Don't create duplicate listeners
    if (activeListeners.has(listenerKey)) {
      logger.info('Report listener already active', { listenerKey });
      return;
    }

    logger.info('Starting report charge payment listener', {
      reference,
      userPhone,
    });

    // Listen to the report charge document
    const unsubscribe = db
      .collection('report_charges')
      .doc(reference)
      .onSnapshot(
        async (doc) => {
          if (!doc.exists) {
            logger.warn('Report charge document does not exist', { reference });
            return;
          }

          const data = doc.data();
          const status = data?.status;

          logger.info('Report charge status update', {
            reference,
            status,
          });

          // Only process on successful payment
          if (status === 'success') {
            logger.info('✅ Report charge payment confirmed', { reference });

            try {
              // Send report ready message
              const successMessage = userLanguage === 'en'
                ? `✅ *Your Report is Ready!*\n\n📊 Report: ${reportPeriod.charAt(0).toUpperCase() + reportPeriod.slice(1)}\n💰 Amount Paid: KES ${chargeAmount}\n\nCheck your messages for the download link!`
                : `✅ *Ripoti Yako Imeandaliwa!*\n\n📊 Ripoti: ${reportPeriod.charAt(0).toUpperCase() + reportPeriod.slice(1)}\n💰 Kiasi Kulipwa: KES ${chargeAmount}\n\nAngalia ujumbe wako kwa kiungo cha kupakua!`;

              await sendWhatsAppMessage(userPhone, successMessage);
              logger.info('✅ Report ready message sent to user', { userPhone });
            } catch (msgError) {
              logger.error('Failed to send report message:', msgError);
            }

            // Unsubscribe after successful payment
            try {
              unsubscribe();
              activeListeners.delete(listenerKey);
              logger.info('Report listener unsubscribed after payment success', {
                listenerKey,
              });
            } catch (unsubError) {
              logger.error('Error unsubscribing listener:', unsubError);
            }
          } else if (status === 'failed') {
            logger.info('❌ Report charge payment failed', { reference });

            try {
              // Send failure message
              const failureMessage = userLanguage === 'en'
                ? `❌ *Report Payment Failed*\n\n📊 Report: ${reportPeriod.charAt(0).toUpperCase() + reportPeriod.slice(1)}\n💰 Amount: KES ${chargeAmount}\n\nThe payment was not processed. Please try again.`
                : `❌ *Malipo ya Ripoti Umeshindwa*\n\n📊 Ripoti: ${reportPeriod.charAt(0).toUpperCase() + reportPeriod.slice(1)}\n💰 Kiasi: KES ${chargeAmount}\n\nMalipo halikukubali. Tafadhali jaribu tena.`;

              await sendWhatsAppMessage(userPhone, failureMessage);
              logger.info('Report failure message sent to user', { userPhone });
            } catch (msgError) {
              logger.error('Failed to send failure message:', msgError);
            }

            // Unsubscribe after failure
            try {
              unsubscribe();
              activeListeners.delete(listenerKey);
              logger.info('Report listener unsubscribed after payment failure', {
                listenerKey,
              });
            } catch (unsubError) {
              logger.error('Error unsubscribing listener:', unsubError);
            }
          }
        },
        (error) => {
          logger.error('Error in report charge listener:', error);
          // Try to unsubscribe on error
          try {
            unsubscribe();
            activeListeners.delete(listenerKey);
          } catch (e) {
            logger.error('Error unsubscribing on error:', e);
          }
        }
      );

    // Store the unsubscribe function
    activeListeners.set(listenerKey, unsubscribe);
    logger.info('Report charge listener registered', { listenerKey });
  } catch (error) {
    logger.error('Failed to start report charge listener:', error);
  }
}

/**
 * Stop listening for a specific payment
 */
export function stopPaymentListener(reference: string): void {
  try {
    const unsubscribe = activeListeners.get(reference);
    if (unsubscribe) {
      unsubscribe();
      activeListeners.delete(reference);
      logger.info('Payment listener stopped', { reference });
    }
  } catch (error) {
    logger.error('Error stopping payment listener:', error);
  }
}

/**
 * Stop all active listeners
 */
export function stopAllListeners(): void {
  try {
    activeListeners.forEach((unsubscribe, key) => {
      try {
        unsubscribe();
        logger.info('Listener stopped', { key });
      } catch (error) {
        logger.error('Error stopping listener:', { key, error });
      }
    });
    activeListeners.clear();
    logger.info('All payment listeners stopped');
  } catch (error) {
    logger.error('Error stopping all listeners:', error);
  }
}
