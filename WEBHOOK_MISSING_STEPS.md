# Critical Issue: Webhook Missing Report Generation Trigger

## Current Status

The webhook.copy.ts file has **partial implementation**. It correctly:

✅ Verifies Paystack signature (HMAC-SHA512)
✅ Identifies charge type (REPORT_* vs SHOP_* vs others)
✅ Updates Firestore records with payment status
✅ Records platform revenue
✅ Has WhatsApp message templates (but not fully implemented)

❌ **MISSING**: Trigger actual report generation after payment success

---

## What's Missing

### For REPORT Charges
After webhook confirms payment success for REPORT_* charges:

**Current webhook does**:
```typescript
// Updates database
await db.collection("report_charges").doc(reference).update({
  status: "success"
});

// Sends template message (not fully implemented)
await sendReportChargeSuccessMessage(...);
```

**What's MISSING**:
```typescript
// MISSING: Actually generate the report!
await handleGenerateReport({
  shopId,
  period: metadata.reportPeriod,
  dateRange: metadata.reportDateRange,
  userPhone: metadata.userPhone
});

// MISSING: Send report download link to user via WhatsApp
await sendWhatsAppMessage(userPhone, `✅ Report ready: ${downloadLink}`);

// MISSING: Update user session state back to MY_SHOP_MENU
await updateSessionState(userPhone, STATE.MY_SHOP_MENU, {});
```

### For SHOP Customer Charges
Current implementation looks correct - updates transactions and sends message.

---

## Signature Verification (Prevents False Successes)

✅ **PROPERLY IMPLEMENTED** in webhook.copy.ts:

```typescript
// Line 62-76: Verify Paystack signature
const hash = req.headers["x-paystack-signature"]?.toString();
const rawBody = Buffer.from(req.rawBody || JSON.stringify(req.body));
const body = rawBody.toString();

const expectedHash = crypto
  .createHmac("sha512", PAYSTACK_SECRET_KEY.value())
  .update(body)
  .digest("hex");

if (hash !== expectedHash) {
  console.error("Invalid signature");
  res.status(400).json({ error: "Invalid signature" });
  return;
}
```

**This ensures**:
- ✅ Only real Paystack events are processed
- ✅ Webhook tampering is impossible
- ✅ False successes cannot happen (signature mismatch returns 400)

---

## Metadata Handling (Both Charge Types)

✅ **PROPERLY IMPLEMENTED**:

### For REPORT Charges
```typescript
const metadata = data.metadata || {};
// Contains:
{
  shopId: "shop-123",
  reportPeriod: "weekly",
  dateRange: "last7days",
  userPhone: "+254712345678",
  chargeType: "report_charge",
  chargeAmount: 50
}
```

### For SHOP Charges
```typescript
const metadata = data.metadata || {};
// Contains:
{
  shopId: "shop-123",
  customerPhone: "+254712345678",
  network: "safaricom",
  chargeType: "shop_charge"
}
```

**Both have sufficient metadata for identification** ✅

---

## Success Message Flow

### Currently Implemented
✅ Templates exist for both charge types
✅ Phone numbers are captured in metadata
✅ Message formatting is bilingual (English + Swahili)

### What's NOT Working Yet
❌ Messages not being sent (commented out or not called)
❌ Report link not included in message
❌ Session state not reset after payment

---

## Complete Fix Needed

### Step 1: Import Required Functions
Add to webhook.copy.ts:
```typescript
import { handleGenerateReport } from '../handlers/report.handler';
import { updateSessionState } from '../services/session.service';
import { STATE } from '../constants/states';
import { sendWhatsAppMessage } from '../services/whatsapp.service';
```

### Step 2: Update handleReportCharge() Function
After updating Firestore records, add:

```typescript
// GENERATE REPORT
try {
  console.log(`Generating report: ${reportPeriod} ${dateRange}`);

  const reportResult = await handleGenerateReport({
    shopId,
    period: reportPeriod,
    dateRange,
    userPhone
  });

  if (reportResult.success && reportResult.downloadUrl) {
    // Send success message with download link
    const successMessage =
      `✅ Your ${reportPeriod} report is ready!\n\n` +
      `📥 Download: ${reportResult.downloadUrl}\n\n` +
      `Thank you for using our platform.`;

    await sendWhatsAppMessage(userPhone, successMessage);

    // Reset user session state back to main menu
    await updateSessionState(userPhone, STATE.MY_SHOP_MENU, {});

    console.log(`Report generated and sent to ${userPhone}`);
  } else {
    // Report generation failed
    const errorMsg =
      `❌ Report generation failed: ${reportResult.error}\n\n` +
      `Please contact support.`;

    await sendWhatsAppMessage(userPhone, errorMsg);
  }
} catch (error) {
  console.error(`Error generating report after payment:`, error);
  // Notify user of error
  await sendWhatsAppMessage(userPhone,
    `❌ Error: Could not generate report. Please try again.`
  );
}
```

### Step 3: Update handleShopCustomerCharge() Function
For customer charges, add:

```typescript
// Send success message to shop owner
try {
  const shopDoc = await db.collection("shops").doc(shopId).get();
  const shopOwnerPhone = shopDoc.data()?.contactPhone;

  if (shopOwnerPhone) {
    const message =
      `✅ Payment Received\n\n` +
      `Customer: ${customerPhone}\n` +
      `Amount: KES ${chargeAmount}\n\n` +
      `The amount has been transferred to your account.`;

    await sendWhatsAppMessage(shopOwnerPhone, message);
  }
} catch (error) {
  console.error(`Error sending shop message:`, error);
}
```

---

## Complete Updated Flow

### REPORT CHARGE Flow
```
1. User requests report (charged)
   ↓
2. System sends STK push (REPORT_PAYMENT_PROMPT)
   ↓
3. User confirms M-Pesa payment
   ↓
4. Paystack webhook receives charge.success
   ↓
5. Webhook verifies signature ✅ (prevents false success)
   ↓
6. Webhook identifies charge type (REPORT_*) ✅
   ↓
7. Webhook updates Firestore (payment recorded) ✅
   ↓
8. Webhook generates report ❌ (MISSING - needs fix)
   ↓
9. Webhook sends report link to user ❌ (MISSING - needs fix)
   ↓
10. Webhook resets user state to MY_SHOP_MENU ❌ (MISSING - needs fix)
   ↓
11. User gets report download link ✅ (will work after fix)
```

### SHOP CHARGE Flow
```
1. Shop owner charges customer (CHARGE_CUSTOMER_PHONE)
   ↓
2. System sends STK push
   ↓
3. Customer confirms M-Pesa payment
   ↓
4. Paystack webhook receives charge.success
   ↓
5. Webhook verifies signature ✅ (prevents false success)
   ↓
6. Webhook identifies charge type (SHOP_*) ✅
   ↓
7. Webhook updates Firestore (payment recorded) ✅
   ↓
8. Webhook sends message to shop owner ❌ (MISSING implementation)
   ↓
9. Shop owner gets confirmation ✅ (will work after fix)
```

---

## Security: False Success Prevention

**✅ PROPERLY IMPLEMENTED**:

The webhook verifies every request using:
1. **HMAC-SHA512 signature** verification against Paystack secret key
2. **Error handling** - returns 400 if signature invalid
3. **Firestore updates** only after successful verification

**This means**:
- ✅ Someone cannot send fake `charge.success` events
- ✅ Only legitimate Paystack servers can trigger payment processing
- ✅ False successes are impossible without Paystack's secret key

---

## Summary

| Aspect | Status | Notes |
|--------|--------|-------|
| Signature verification | ✅ Complete | Prevents false successes |
| Charge type identification | ✅ Complete | REPORT_* vs SHOP_* |
| Metadata handling | ✅ Complete | Both charge types |
| Firestore updates | ✅ Complete | Records all payment data |
| Report generation trigger | ❌ MISSING | Need to call handleGenerateReport() |
| WhatsApp messages | ⚠️ Partial | Templates exist, not sent |
| Session state reset | ❌ MISSING | Need to reset to MY_SHOP_MENU |
| Download link delivery | ❌ Blocked | Depends on report generation |

---

## Action Items

1. **Update webhook.copy.ts** with report generation trigger
2. **Add missing imports** for report handler and state management
3. **Implement WhatsApp message sending** for both charge types
4. **Test end-to-end flow** with test Paystack account
5. **Copy updated webhook** to functions/src/webhooks/paystack-callback.ts
6. **Deploy and monitor** webhook logs

---

## Files That Need Updating

- `webhook.copy.ts` - Add report generation + messaging
- `functions/src/webhooks/paystack-callback.ts` - Copy updated version
- Any other webhook file if you have existing implementation

---

## Testing Checklist

After implementing fixes:
- [ ] Test REPORT charge creates report
- [ ] Test REPORT charge sends download link
- [ ] Test REPORT charge resets user state
- [ ] Test SHOP charge sends message
- [ ] Test invalid signature returns 400
- [ ] Test false signatures don't trigger payment
- [ ] Monitor webhook logs for errors
- [ ] Verify Firestore records created correctly
