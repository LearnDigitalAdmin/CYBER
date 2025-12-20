/**
 * PAYMENT VERIFICATION SERVICE
 *
 * Listens to Firestore payment records from Paystack webhook
 * Triggers report generation and messaging when payment is confirmed
 *
 * FLOW:
 * 1. Other React project's webhook updates Firestore: report_charges/{ref} or shops/{id}/transactions/{ref}
 * 2. This service detects the update
 * 3. If payment successful: Generate report OR Send customer success message
 * 4. Reset user session state
 */

import * as admin from 'firebase-admin';
import { logger } from '../utils/logger';

const db = admin.firestore();

/**
 * Verify report charge payment and trigger generation
 * Called when report_charges/{reference} status changes to "success"
 */
export async function verifyAndProcessReportCharge(reference: string): Promise<void> {
  try {
    logger.info(`Verifying report charge: ${reference}`);

    // Get the charge record
    const chargeDoc = await db.collection("report_charges").doc(reference).get();

    if (!chargeDoc.exists) {
      logger.error(`Report charge not found: ${reference}`);
      return;
    }

    const chargeData = chargeDoc.data();

    if (chargeData?.status !== 'success') {
      logger.info(`Charge not yet successful: ${reference}`);
      return;
    }

    logger.info(`✅ Payment verified for report: ${reference}`);

    const shopId = chargeData.shopId;
    const userPhone = chargeData.userPhone;
    const reportPeriod = chargeData.reportPeriod || 'weekly';
    const dateRange = chargeData.dateRange || 'last7days';
    const chargeAmount = chargeData.chargeAmount || 0;

    // Generate report
    logger.info("Generating report after payment verification");

    try {
      const { handleGenerateReport } = require('../handlers/report.handler');

      const reportResult = await handleGenerateReport({
        shopId,
        period: reportPeriod,
        dateRange: dateRange,
        userPhone
      });

      if (reportResult.success && reportResult.downloadUrl) {
        logger.info("✅ Report generated successfully");

        // Send WhatsApp message with download link
        try {
          const { sendWhatsAppMessage } = require('../services/whatsapp.service');

          const successMessage =
            `✅ *Your Report is Ready!*\n\n` +
            `📊 Report Type: ${reportPeriod.charAt(0).toUpperCase() + reportPeriod.slice(1)}\n` +
            `📅 Period: ${dateRange === 'last7days' ? 'Last 7 Days' : 'Last 30 Days'}\n` +
            `💰 Amount Paid: KES ${chargeAmount}\n\n` +
            `📥 Download: ${reportResult.downloadUrl}\n\n` +
            `Thank you for using our platform!`;

          await sendWhatsAppMessage(userPhone, successMessage);
          logger.info("✅ Report download link sent to user");
        } catch (msgError) {
          logger.error("Error sending WhatsApp message:", msgError);
        }

        // Reset user session state
        try {
          const { updateSessionState } = require('../services/session.service');
          const { STATE } = require('../constants/states');

          await updateSessionState(userPhone, STATE.MY_SHOP_MENU, {});
          logger.info("✅ User session reset to MY_SHOP_MENU");
        } catch (stateError) {
          logger.error("Error resetting session state:", stateError);
        }

        logger.info(`✅ REPORT CHARGE COMPLETE: ${reference}`);
      } else {
        logger.error(`Report generation failed: ${reportResult.error}`);

        try {
          const { sendWhatsAppMessage } = require('../services/whatsapp.service');

          const errorMsg =
            `❌ Report Generation Failed\n\n` +
            `Your payment was successful (KES ${chargeAmount}), but we couldn't generate your report.\n\n` +
            `Error: ${reportResult.error}\n\n` +
            `Please try again or contact support.`;

          await sendWhatsAppMessage(userPhone, errorMsg);
        } catch (msgError) {
          logger.error("Error sending error message:", msgError);
        }
      }
    } catch (reportError) {
      logger.error("Error generating report:", reportError);

      try {
        const { sendWhatsAppMessage } = require('../services/whatsapp.service');

        const errorMsg =
          `❌ Error Generating Report\n\n` +
          `Your payment was received, but we encountered an error generating your report.\n\n` +
          `Please try again or contact support.`;

        await sendWhatsAppMessage(userPhone, errorMsg);
      } catch (msgError) {
        logger.error("Error sending error message:", msgError);
      }
    }
  } catch (error) {
    logger.error(`Error processing report charge ${reference}:`, error);
  }
}

/**
 * Verify shop customer charge payment and send success message
 * Called when shops/{shopId}/transactions/{reference} status changes to "success"
 */
export async function verifyAndProcessShopCharge(
  shopId: string,
  reference: string
): Promise<void> {
  try {
    logger.info(`Verifying shop charge: ${shopId}/${reference}`);

    // Get the transaction record
    const transactionDoc = await db
      .collection("shops")
      .doc(shopId)
      .collection("transactions")
      .doc(reference)
      .get();

    if (!transactionDoc.exists) {
      logger.error(`Transaction not found: ${shopId}/${reference}`);
      return;
    }

    const transactionData = transactionDoc.data();

    if (transactionData?.status !== 'success') {
      logger.info(`Transaction not yet successful: ${reference}`);
      return;
    }

    logger.info(`✅ Payment verified for shop charge: ${reference}`);

    const customerPhone = transactionData.customerPhone;
    const chargeAmount = transactionData.amount ? transactionData.amount / 100 : 0;

    // Send success message to shop owner
    try {
      const { sendWhatsAppMessage } = require('../services/whatsapp.service');
      const shopDoc = await db.collection("shops").doc(shopId).get();
      const shopOwnerPhone = shopDoc.data()?.contactPhone || shopDoc.data()?.phoneNumber;
      const shopName = shopDoc.data()?.shopName || 'Shop';

      if (shopOwnerPhone) {
        const message =
          `✅ *Payment Received*\n\n` +
          `💰 Amount: KES ${chargeAmount}\n` +
          `👤 Customer: ${customerPhone}\n` +
          `🏪 Shop: ${shopName}\n\n` +
          `The amount has been transferred to your account.`;

        await sendWhatsAppMessage(shopOwnerPhone, message);
        logger.info("✅ Shop owner notified of payment");
      }

      // Reset shop owner's session state
      try {
        const { updateSessionState } = require('../services/session.service');
        const { STATE } = require('../constants/states');

        // Get shop owner's phone to update their session
        const ownerPhone = shopDoc.data()?.contactPhone || shopDoc.data()?.phoneNumber;
        if (ownerPhone) {
          await updateSessionState(ownerPhone, STATE.MY_SHOP_MENU, {});
          logger.info("✅ Shop owner session reset to MY_SHOP_MENU");
        }
      } catch (stateError) {
        logger.error("Error resetting shop owner session state:", stateError);
      }

      logger.info(`✅ SHOP CHARGE COMPLETE: ${reference}`);
    } catch (msgError) {
      logger.error("Error processing shop charge notification:", msgError);
    }
  } catch (error) {
    logger.error(`Error processing shop charge ${reference}:`, error);
  }
}

/**
 * Poll Firestore for recent payment updates and process them
 * This runs when user is in a waiting state (REPORT_GENERATING, CHARGE_CUSTOMER_PROCESSING)
 */
export async function pollAndProcessPaymentUpdates(
  userPhone: string,
  sessionContext: any
): Promise<{ processed: boolean; status: string }> {
  try {
    const { chargeReference, chargeType } = sessionContext;

    if (!chargeReference) {
      return { processed: false, status: 'no_reference' };
    }

    logger.info(`Polling for payment update: ${chargeReference} (type: ${chargeType})`);

    if (chargeType === 'report_charge') {
      // Check report_charges collection
      const chargeDoc = await db.collection("report_charges").doc(chargeReference).get();

      if (chargeDoc.exists && chargeDoc.data()?.status === 'success') {
        logger.info(`Payment confirmed for report charge: ${chargeReference}`);
        await verifyAndProcessReportCharge(chargeReference);
        return { processed: true, status: 'success' };
      }
    } else if (chargeType === 'shop_charge') {
      // Check shops/{shopId}/transactions/{reference}
      const shopId = sessionContext.shopId;

      if (shopId) {
        const transactionDoc = await db
          .collection("shops")
          .doc(shopId)
          .collection("transactions")
          .doc(chargeReference)
          .get();

        if (transactionDoc.exists && transactionDoc.data()?.status === 'success') {
          logger.info(`Payment confirmed for shop charge: ${chargeReference}`);
          await verifyAndProcessShopCharge(shopId, chargeReference);
          return { processed: true, status: 'success' };
        }
      }
    }

    logger.info(`Payment not yet confirmed: ${chargeReference}`);
    return { processed: false, status: 'pending' };
  } catch (error) {
    logger.error(`Error polling payment updates:`, error);
    return { processed: false, status: 'error' };
  }
}
