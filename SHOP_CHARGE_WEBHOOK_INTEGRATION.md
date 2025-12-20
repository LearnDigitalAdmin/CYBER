# Shop Customer Charge - Paystack Webhook Integration

## Overview
This document shows how to integrate the new shop customer charge feature with your existing `paystackCallback` webhook.

## Integration Code

In your `paystackCallback` webhook handler in `functions/src/index.ts`, add this code block in the `charge.success` event handler:

```typescript
// ===== HANDLE SHOP CUSTOMER CHARGE =====
// Add this condition alongside existing isCyberCharge, isSubscription, isAgentPayment checks

const isShopCharge = metadata?.shopId && !reference.startsWith('CYBER_') && !reference.startsWith('SUB_') && !reference.startsWith('INV_');

if (isShopCharge) {
  console.log(`Processing as shop customer charge`);

  // Import at top of file:
  // import { findTransactionByReference, updateTransactionStatus, sendWhatsAppMessage, formatPhoneForWhatsApp } from './services/payment.charge.service';

  const transactionResult = await findTransactionByReference(reference);

  if (!transactionResult.found || !transactionResult.shopId || !transactionResult.transaction) {
    console.error(`Shop transaction not found for reference: ${reference}`);
    res.status(404).json({ error: "Shop transaction not found" });
    return;
  }

  const shopId = transactionResult.shopId;
  const transaction = transactionResult.transaction;

  // Update transaction status to success
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

  // Fetch shop details for notification
  const shopDoc = await db.collection('shops').doc(shopId).get();
  const shopData = shopDoc.data();
  const shopName = shopData?.shopName || 'Unknown Shop';
  const ownerPhone = shopData?.phone || transaction.customerPhone;

  // Build and send success message to shop owner
  const successMessage = `
✅ PAYMENT RECEIVED!

💰 Amount: KES ${transaction.amount}
📱 Customer: ${transaction.customerPhone}
🌐 Network: ${transaction.network === 'safaricom' ? 'Safaricom M-Pesa' : 'Airtel Money'}
⏱️ Time: ${new Date().toISOString()}
🎫 Transaction ID: ${reference}

Thank you for using Cogvana!
  `.trim();

  try {
    const formattedPhone = formatPhoneForWhatsApp(ownerPhone);
    await sendWhatsAppMessage(formattedPhone, successMessage);
    console.log(`Success notification sent to shop owner: ${shopId}`);
  } catch (notificationError) {
    console.error(`Failed to send success notification:`, notificationError);
    // Don't fail the webhook if notification fails
  }

  console.log(`Successfully processed shop customer charge: ${reference}`);
}
```

## Key Points

1. **Detection**: Identify shop charges by checking:
   - `metadata.shopId` exists
   - Reference doesn't start with `CYBER_`, `SUB_`, or `INV_`

2. **Transaction Lookup**: Use `findTransactionByReference()` to locate the transaction across all shops

3. **Status Update**: Call `updateTransactionStatus()` with `'success'` and webhook data

4. **Owner Notification**: Send WhatsApp message to shop owner with payment confirmation

5. **Error Handling**: Gracefully handle missing transactions without failing the webhook

## Required Imports

Add these imports at the top of your `index.ts`:

```typescript
import {
  findTransactionByReference,
  updateTransactionStatus
} from './services/payment.charge.service';
import {
  sendWhatsAppMessage,
  formatPhoneForWhatsApp
} from './services/whatsapp.service';
```

## Failure Handling (Optional)

For `charge.failed` events, add similar handling:

```typescript
if (event.event === "charge.failed") {
  const data = event.data;
  const reference = data.reference;
  const metadata = data.metadata;

  const isShopCharge = metadata?.shopId && !reference.startsWith('CYBER_') && !reference.startsWith('SUB_') && !reference.startsWith('INV_');

  if (isShopCharge) {
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
```

## Flow Summary

1. **Shop owner initiates charge** via WhatsApp:
   - Enters amount
   - Enters customer phone
   - Selects network
   - STK push sent via Paystack

2. **Paystack processes payment**:
   - Customer enters PIN
   - Payment succeeds/fails

3. **Webhook callback received**:
   - Your `paystackCallback` validates signature
   - Identifies as shop charge
   - Updates transaction status
   - Sends success message to shop owner

4. **Shop owner notified**:
   - Receives WhatsApp with payment confirmation
   - Includes amount, customer, network, timestamp, transaction ID

## Database Structure

**Transaction saved in Firestore**:
```
shops/{shopId}/transactions/{txnId}
├─ id: string
├─ shopId: string
├─ amount: number
├─ customerPhone: string
├─ network: 'safaricom' | 'airtel'
├─ transactionId: string (Paystack reference)
├─ timestamp: number
├─ status: 'pending' | 'success' | 'failed'
├─ createdVia: 'whatsapp'
└─ webhookData?: object (Paystack response)
```

**Updated on success**:
```
status: 'success'
webhookData: {full Paystack response}
updatedAt: timestamp
```
