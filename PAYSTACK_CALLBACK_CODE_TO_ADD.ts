/**
 * SHOP CHARGE HANDLING CODE FOR PAYSTACK CALLBACK
 *
 * Copy this code into your paystackCallback webhook handler
 * in functions/src/index.ts inside the "charge.success" event handler
 *
 * This should be added alongside your existing conditions for:
 * - isCyberCharge
 * - isSubscription
 * - isAgentPayment
 */

// ===== HANDLE SHOP CUSTOMER CHARGE =====
// Add this right after checking if (isAgentPayment) { ... }

if (event.event === "charge.success") {
  const data = event.data;
  const reference = data.reference;
  const metadata = data.metadata;

  // Determine if this is a shop customer charge
  const isShopCharge =
    metadata?.shopId &&
    !reference.startsWith('CYBER_') &&
    !reference.startsWith('SUB_') &&
    !reference.startsWith('INV_');

  if (isShopCharge) {
    console.log(`Processing as shop customer charge`);

    // Find the transaction across all shops
    const transactionResult = await findTransactionByReference(reference);

    if (!transactionResult.found || !transactionResult.shopId || !transactionResult.transaction) {
      console.error(`Shop transaction not found for reference: ${reference}`);
      res.status(404).json({ error: "Shop transaction not found" });
      return;
    }

    const shopId = transactionResult.shopId;
    const transaction = transactionResult.transaction;

    console.log(`Found shop transaction: shopId=${shopId}, txnId=${transaction.id}`);

    // ===== UPDATE TRANSACTION STATUS =====
    const updateSuccess = await updateTransactionStatus(
      shopId,
      transaction.id,
      'success',
      data
    );

    if (!updateSuccess) {
      console.error(`Failed to update transaction status: ${reference}`);
      res.status(500).json({ error: "Failed to update transaction" });
      return;
    }

    console.log(`Transaction status updated to success: ${reference}`);

    // ===== FETCH SHOP DETAILS FOR NOTIFICATION =====
    const shopDoc = await db.collection('shops').doc(shopId).get();
    const shopData = shopDoc.data();
    const shopName = shopData?.shopName || 'Your Shop';
    const ownerPhone = shopData?.phone || transaction.customerPhone;

    // ===== BUILD SUCCESS MESSAGE =====
    const successMessage = `✅ PAYMENT RECEIVED!

💰 Amount: KES ${transaction.amount}
📱 Customer: ${transaction.customerPhone}
🌐 Network: ${transaction.network === 'safaricom' ? 'Safaricom M-Pesa' : 'Airtel Money'}
⏱️ Time: ${new Date().toISOString()}
🎫 Transaction ID: ${reference}

Thank you for using Cogvana!`;

    // ===== SEND NOTIFICATION TO SHOP OWNER =====
    try {
      const formattedPhone = formatPhoneForWhatsApp(ownerPhone);
      await sendWhatsAppMessage(formattedPhone, successMessage);
      console.log(`Success notification sent to shop owner: ${shopId} (${ownerPhone})`);
    } catch (notificationError) {
      console.error(`Failed to send success notification:`, notificationError);
      // Don't fail the webhook if notification fails - the transaction is already updated
    }

    console.log(`Successfully processed shop customer charge: ${reference}`);
  }
}

// ===== ALSO HANDLE CHARGE FAILURES =====
// Add this in the charge.failed event handler (if you have one)

if (event.event === "charge.failed") {
  const data = event.data;
  const reference = data.reference;
  const metadata = data.metadata;

  const isShopCharge =
    metadata?.shopId &&
    !reference.startsWith('CYBER_') &&
    !reference.startsWith('SUB_') &&
    !reference.startsWith('INV_');

  if (isShopCharge) {
    console.log(`Processing failed shop charge`);

    const transactionResult = await findTransactionByReference(reference);

    if (transactionResult.found && transactionResult.shopId && transactionResult.transaction) {
      await updateTransactionStatus(
        transactionResult.shopId,
        transactionResult.transaction.id,
        'failed',
        data
      );

      console.log(`Shop charge marked as failed: ${reference}`);
    }
  }
}

/**
 * REQUIRED IMPORTS
 *
 * Add these to the top of your index.ts file
 */

// import {
//   findTransactionByReference,
//   updateTransactionStatus,
// } from './services/payment.charge.service';
// import {
//   sendWhatsAppMessage,
//   formatPhoneForWhatsApp,
// } from './services/whatsapp.service';

/**
 * LOCATION IN FILE
 *
 * The "charge.success" block should go:
 *
 * export const paystackCallback = onRequest({...}, async (req, res) => {
 *   // ... existing code ...
 *
 *   if (event.event === "charge.success") {
 *     const data = event.data;
 *     const reference = data.reference;
 *
 *     if (isCyberCharge) {
 *       // ... existing cyber charge handling ...
 *     } else if (isSubscription) {
 *       // ... existing subscription handling ...
 *     } else if (isAgentPayment) {
 *       // ... existing agent payment handling ...
 *     } else if (isShopCharge) {
 *       // ===== ADD THE CODE ABOVE HERE =====
 *       // YOUR SHOP CHARGE HANDLING CODE
 *     }
 *   }
 * });
 */

/**
 * KEY POINTS
 *
 * 1. Detection:
 *    - metadata.shopId must exist
 *    - reference must NOT start with CYBER_, SUB_, or INV_
 *
 * 2. Transaction Lookup:
 *    - findTransactionByReference() searches all shops
 *    - Returns shopId and transaction details
 *
 * 3. Status Update:
 *    - updateTransactionStatus() marks transaction as 'success'
 *    - Stores full Paystack webhook data for audit trail
 *
 * 4. Notification:
 *    - sendWhatsAppMessage() sends to shop owner
 *    - Includes amount, customer, network, timestamp, reference
 *    - Uses shop owner's phone from shop document
 *
 * 5. Error Handling:
 *    - If transaction not found, return 404 (shouldn't happen)
 *    - If notification fails, log error but don't fail webhook
 *    - Transaction is already updated before notification
 */
