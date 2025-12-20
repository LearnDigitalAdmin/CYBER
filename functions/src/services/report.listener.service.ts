/**
 * REPORT LISTENER SERVICE
 *
 * CRITICAL: Listens to Firestore report charge payment updates in real-time
 * When payment succeeds, AUTOMATICALLY triggers report generation and sends link to user
 * Then AUTOMATICALLY navigates user back to MY_SHOP_MENU
 *
 * This is the CORE of the report charging flow - NO ERRORS ALLOWED
 */

import * as admin from 'firebase-admin';
import { logger } from '../utils/logger';
import { sendWhatsAppMessage } from './whatsapp.service';
import { handleGenerateReport } from '../handlers/report.handler';
import { updateSessionState } from './session.service';
import { STATE } from '../constants/states';

const db = admin.firestore();

// Store active listeners to prevent duplicates
const activeReportListeners = new Map<string, () => void>();

/**
 * CRITICAL: Start listening for report payment updates
 *
 * Flow:
 * 1. User pays for report via STK push
 * 2. Paystack webhook updates Firestore: report_charges/{reference}
 * 3. This listener detects status change (success/failed)
 * 4. If success: Generates report, sends link, returns to MY_SHOP_MENU
 * 5. If failed: Sends failure message, returns to MY_SHOP_MENU
 *
 * @param reference - Unique report charge reference (REPORT_WEEKLY_shopId_timestamp)
 * @param shopId - Shop making the charge
 * @param userPhone - User's WhatsApp phone (for status messages and reports)
 * @param reportPeriod - 'weekly' or 'monthly'
 * @param dateRange - 'last7days' or 'last30days'
 * @param chargeAmount - Amount charged (50 for weekly, 200 for monthly)
 * @param userLanguage - 'en' or 'sw'
 */
export function startReportPaymentListener(
  reference: string,
  shopId: string,
  userPhone: string,
  reportPeriod: 'weekly' | 'monthly',
  dateRange: 'last7days' | 'last30days',
  chargeAmount: number,
  userLanguage: 'en' | 'sw'
): void {
  try {
    const listenerKey = `${shopId}_${reference}`;

    // Prevent duplicate listeners
    if (activeReportListeners.has(listenerKey)) {
      logger.info('Report listener already active', { listenerKey });
      return;
    }

    logger.info('🔄 STARTING REPORT PAYMENT LISTENER', {
      reference,
      shopId,
      reportPeriod,
      userPhone,
    });

    // Watch: report_charges/{reference}
    const unsubscribe = db
      .collection('report_charges')
      .doc(reference)
      .onSnapshot(
        async (doc) => {
          try {
            if (!doc.exists) {
              logger.warn('⚠️ Report charge document does not exist', {
                reference,
              });
              return;
            }

            const data = doc.data();
            const status = data?.status;

            logger.info('📊 Report charge status update', {
              reference,
              status,
              reportPeriod,
              userPhone,
            });

            // =====================================================
            // SUCCESS: Payment completed, generate report
            // =====================================================
            if (status === 'success') {
              logger.info('✅ REPORT PAYMENT SUCCESS - TRIGGERING REPORT GENERATION', {
                reference,
                shopId,
                reportPeriod,
              });

              try {
                // Step 1: Generate the report
                logger.info('📄 Generating report...', {
                  shopId,
                  period: reportPeriod,
                  dateRange,
                });

                const reportResult = await handleGenerateReport({
                  shopId,
                  period: reportPeriod,
                  dateRange,
                  userPhone,
                });

                if (!reportResult.success) {
                  logger.error('❌ Report generation failed', {
                    shopId,
                    error: reportResult.error,
                  });

                  // Send failure message
                  const failureMsg =
                    userLanguage === 'en'
                      ? `❌ *Report Generation Failed*\n\n📊 ${reportPeriod.charAt(0).toUpperCase() + reportPeriod.slice(1)} Report\n💰 Amount Charged: KES ${chargeAmount}\n\n⚠️ The report could not be generated. Please contact support.\n\nError: ${reportResult.error}`
                      : `❌ *Kuundwa kwa Ripoti Kumeshindwa*\n\n📊 Ripoti ya ${reportPeriod.charAt(0).toUpperCase() + reportPeriod.slice(1)}\n💰 Kiasi Kulipwa: KES ${chargeAmount}\n\n⚠️ Ripoti haiwezi kuundwa. Tafadhali wasiliana na msaada.\n\nHitilafu: ${reportResult.error}`;

                  await sendWhatsAppMessage(userPhone, failureMsg);

                  // Cleanup
                  cleanupReportListener(reference, listenerKey);
                  return;
                }

                // Step 2: Report generated successfully - send to user
                logger.info('✅ Report generated successfully', {
                  shopId,
                  downloadUrl: reportResult.downloadUrl,
                });

                const successMsg =
                  userLanguage === 'en'
                    ? `✅ *Your ${reportPeriod.charAt(0).toUpperCase() + reportPeriod.slice(1)} Report is Ready!*\n\n📊 Report: ${reportPeriod.charAt(0).toUpperCase() + reportPeriod.slice(1)}\n📅 Period: ${dateRange === 'last7days' ? 'Last 7 Days' : 'Last 30 Days'}\n💰 Amount Charged: KES ${chargeAmount}\n\n📥 *Download Your Report:*\n${reportResult.downloadUrl}\n\n✨ Report automatically delivered to your shop dashboard`
                    : `✅ *Ripoti Yako imeandaliwa!*\n\n📊 Ripoti: ${reportPeriod.charAt(0).toUpperCase() + reportPeriod.slice(1)}\n📅 Kipindi: ${dateRange === 'last7days' ? 'Siku 7 Zilizopita' : 'Siku 30 Zilizopita'}\n💰 Kiasi Kulipwa: KES ${chargeAmount}\n\n📥 *Pakua Ripoti Yako:*\n${reportResult.downloadUrl}\n\n✨ Ripoti imetumiwa kwa otomatiki kwa dashboard ya duka lako`;

                await sendWhatsAppMessage(userPhone, successMsg);

                logger.info('✅ Success message sent to user', {
                  userPhone,
                });

                // Step 3: Return user to MY_SHOP_MENU in same session/state
                logger.info('🔄 Returning user to MY_SHOP_MENU', {
                  userPhone,
                });

                // CRITICAL: Use the stored userPhone (not the reference) as the session key
                await updateSessionState(userPhone, STATE.MY_SHOP_MENU, {});

                // Clear report context but keep shop context
                // This maintains the session for the seller to continue operations
                logger.info('📋 Session context maintained for next operation', {
                  userPhone,
                  newState: STATE.MY_SHOP_MENU,
                });

                // Cleanup listener
                cleanupReportListener(reference, listenerKey);

                logger.info(
                  '🎉 REPORT DELIVERY COMPLETE - USER READY FOR NEXT OPERATION',
                  {
                    userPhone,
                    state: STATE.MY_SHOP_MENU,
                  }
                );
              } catch (genError) {
                logger.error('💥 CRITICAL ERROR IN REPORT GENERATION', {
                  reference,
                  error: genError instanceof Error ? genError.message : 'Unknown',
                });

                // Send error message to user
                const errorMsg =
                  userLanguage === 'en'
                    ? `❌ *Report Processing Error*\n\nPayment received but report generation encountered an error. Please contact support with reference: ${reference}`
                    : `❌ *Hitilafu ya Kuchunguza Ripoti*\n\nMalipo yakipokea lakini kuundwa kwa ripoti kulishindwa. Tafadhali wasiliana na msaada kwa kumbukumbu: ${reference}`;

                await sendWhatsAppMessage(userPhone, errorMsg);

                // Still return to menu
                await updateSessionState(userPhone, STATE.MY_SHOP_MENU, {});
                cleanupReportListener(reference, listenerKey);
              }
            }

            // =====================================================
            // FAILED: Payment failed, notify user
            // =====================================================
            else if (status === 'failed') {
              logger.info('❌ REPORT PAYMENT FAILED', {
                reference,
                shopId,
                reportPeriod,
              });

              try {
                const failureMsg =
                  userLanguage === 'en'
                    ? `❌ *Payment Failed*\n\n📊 ${reportPeriod.charAt(0).toUpperCase() + reportPeriod.slice(1)} Report\n💰 Amount: KES ${chargeAmount}\n\n⚠️ The payment could not be processed. Please try again.\n\nReference: ${reference}`
                    : `❌ *Malipo Umeshindwa*\n\n📊 Ripoti ya ${reportPeriod.charAt(0).toUpperCase() + reportPeriod.slice(1)}\n💰 Kiasi: KES ${chargeAmount}\n\n⚠️ Malipo haiwezi kuchakuliwa. Tafadhali jaribu tena.\n\nKumbukumbu: ${reference}`;

                await sendWhatsAppMessage(userPhone, failureMsg);

                logger.info('Failure message sent to user', {
                  userPhone,
                });

                // Return user to MY_SHOP_MENU
                await updateSessionState(userPhone, STATE.MY_SHOP_MENU, {});

                logger.info('User returned to MY_SHOP_MENU after failed payment', {
                  userPhone,
                });

                // Cleanup listener
                cleanupReportListener(reference, listenerKey);
              } catch (failError) {
                logger.error('Error sending failure message', {
                  reference,
                  error: failError,
                });

                // Still return to menu
                await updateSessionState(userPhone, STATE.MY_SHOP_MENU, {});
                cleanupReportListener(reference, listenerKey);
              }
            }

            // Still pending - do nothing, wait for next update
          } catch (callbackError) {
            logger.error('💥 CRITICAL ERROR IN LISTENER CALLBACK', {
              reference,
              error: callbackError instanceof Error ? callbackError.message : 'Unknown',
            });

            try {
              // Try to return user to menu on error
              await updateSessionState(userPhone, STATE.MY_SHOP_MENU, {});
              cleanupReportListener(reference, listenerKey);
            } catch (cleanupErr) {
              logger.error('Error during cleanup after callback error', {
                reference,
                error: cleanupErr,
              });
            }
          }
        },
        (error) => {
          logger.error('❌ ERROR IN REPORT LISTENER', {
            reference,
            error: error.message,
          });

          // Try to cleanup on error
          try {
            unsubscribe();
            activeReportListeners.delete(listenerKey);
          } catch (cleanupErr) {
            logger.error('Error unsubscribing on listener error', {
              reference,
              error: cleanupErr,
            });
          }
        }
      );

    // Store the unsubscribe function
    activeReportListeners.set(listenerKey, unsubscribe);

    logger.info('✅ REPORT LISTENER REGISTERED AND ACTIVE', {
      reference,
      listenerKey,
      shopId,
      reportPeriod,
    });
  } catch (error) {
    logger.error('❌ FAILED TO START REPORT LISTENER', {
      reference,
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}

/**
 * Helper: Cleanup listener
 */
function cleanupReportListener(reference: string, listenerKey: string): void {
  try {
    const unsubscribe = activeReportListeners.get(listenerKey);
    if (unsubscribe) {
      unsubscribe();
      activeReportListeners.delete(listenerKey);
      logger.info('✅ Report listener cleaned up', { listenerKey });
    }
  } catch (error) {
    logger.error('Error cleaning up report listener', {
      reference,
      error,
    });
  }
}

/**
 * Stop listening for a specific report payment
 */
export function stopReportListener(reference: string): void {
  try {
    const keys = Array.from(activeReportListeners.keys()).filter((k) =>
      k.includes(reference)
    );

    keys.forEach((key) => {
      const unsubscribe = activeReportListeners.get(key);
      if (unsubscribe) {
        unsubscribe();
        activeReportListeners.delete(key);
        logger.info('Report listener stopped', { reference, key });
      }
    });
  } catch (error) {
    logger.error('Error stopping report listener', { reference, error });
  }
}

/**
 * Stop all active report listeners
 */
export function stopAllReportListeners(): void {
  try {
    activeReportListeners.forEach((unsubscribe, key) => {
      try {
        unsubscribe();
        logger.info('Report listener stopped', { key });
      } catch (error) {
        logger.error('Error stopping listener', { key, error });
      }
    });

    activeReportListeners.clear();
    logger.info('All report listeners stopped');
  } catch (error) {
    logger.error('Error stopping all report listeners', { error });
  }
}
