# Report Charging - Quick Setup Guide

## TL;DR - What You Have

### New Files Created

1. **`functions/src/services/report.charge.service.ts`** (CREATED)
   - Handles report payment requests
   - Sends STK push via Paystack
   - Checks for existing reports (free access)
   - Updates charge status

2. **`webhook.copy.ts`** (CREATED at project root)
   - Universal webhook handler for ALL charge types:
     - `REPORT_*` = Platform charges for reports (NEW)
     - `SHOP_*` = Shop charges customers (EXISTING)
     - `CYBER_*` = Cyber services (EXISTING)
     - `SUB_*` = Subscriptions (EXISTING)
     - `INV_*` = Invoice payments (EXISTING)

3. **`REPORT_CHARGE_IMPLEMENTATION.md`** (CREATED)
   - Full implementation details
   - Firestore structure
   - Testing checklist

---

## Setup (Copy-Paste Steps)

### Step 1: Copy Webhook to Your Codebase

```bash
# Copy from project root to your functions
cp webhook.copy.ts functions/src/webhooks/paystack-callback.ts
```

### Step 2: Export Webhook in functions/src/index.ts

Add this at the top:
```typescript
import { paystackCallback } from './webhooks/paystack-callback';
```

Add this at the bottom:
```typescript
exports.paystackCallback = paystackCallback;
```

### Step 3: Add States to functions/src/constants/states.ts

```typescript
export const STATE = {
  // ... existing states ...

  REPORT_PAYMENT_MENU: 'report_payment_menu',
  REPORT_PAYMENT_PROMPT: 'report_payment_prompt',
  REPORT_GENERATING: 'report_generating',
};
```

### Step 4: Update Report Menu Handler

In `functions/src/handlers/report.menu.handler.ts`, before generating reports, add:

```typescript
import { hasExistingReport, getReportChargeAmount, initiateReportCharge } from '../services/report.charge.service';

// Inside handleWeeklyReportMenu (option 1: Last 7 days)
if (option === 1) {
  const hasReport = await hasExistingReport(shopId, 'weekly', 'last7days');

  if (!hasReport) {
    // Charge for report
    const chargeAmount = getReportChargeAmount('weekly');

    await updateSessionState(phone, STATE.REPORT_PAYMENT_PROMPT, {});
    await updateSessionContext(phone, {
      reportPeriod: 'weekly',
      reportDateRange: 'last7days',
      reportChargeAmount: chargeAmount,
    });

    return `📊 Weekly Report - Last 7 Days\n\n💰 Charge: KES ${chargeAmount}\n\nEnter your M-Pesa phone number to continue`;
  }

  // Existing report - generate for free
  // ... existing generation logic ...
}
```

### Step 5: Add Payment Handler State

Add handler for `REPORT_PAYMENT_PROMPT` state in session/state handler:

```typescript
async function handleReportPaymentPrompt(phone: string, input: string, session: Session): Promise<string> {
  const validation = validatePhoneNumber(input);

  if (!validation.valid) {
    return 'Invalid phone. Please enter a valid M-Pesa number (e.g., 0712345678)';
  }

  const shopId = session.context.shopId as string;
  const reportPeriod = session.context.reportPeriod as string;
  const reportDateRange = session.context.reportDateRange as string;
  const chargeAmount = session.context.reportChargeAmount as number;

  const result = await initiateReportCharge(
    shopId,
    validation.formatted,
    reportPeriod as 'weekly' | 'monthly',
    reportDateRange as 'last7days' | 'last30days'
  );

  if (result.success) {
    await updateSessionState(phone, STATE.REPORT_GENERATING, {});

    return (
      `✅ Payment Request Sent!\n\n` +
      `📱 Phone: ${validation.formatted}\n` +
      `💰 Amount: KES ${chargeAmount}\n\n` +
      `Enter your M-Pesa PIN to confirm.`
    );
  } else {
    return `❌ Payment failed: ${result.error}`;
  }
}
```

---

## How It Works

### User Flow: Weekly Report

```
1. User: "1" (Weekly Reports)
   ↓ System checks hasExistingReport()

2. NEW REPORT?
   ├─ YES → "Enter phone for payment"
   │         User enters phone
   │         ↓
   │         initiateReportCharge() → STK Push sent
   │         ↓
   │         User enters M-Pesa PIN
   │         ↓
   │         Webhook receives charge.success
   │         ↓
   │         Report is generated
   │         ↓
   │         "Report ready - download link"
   │
   └─ NO → Generate FREE (no duplicate charge)
           ↓
           "Report ready - download link"
```

### Webhook Flow: Report Charge

```
Paystack WebHook: charge.success
  ├─ Reference: "REPORT_WEEKLY_shopId_timestamp"
  ├─ Metadata.chargeType: "report_charge"
  │
  ↓ Webhook identifies as REPORT_ charge
  │
  ├─ Update: report_charges/{reference}.status = "success"
  ├─ Update: shops/{shopId}/report_charges/{reference}
  ├─ Record: platform_revenue/{reference}
  ├─ Increment: platform_stats.totalReportRevenue
  └─ Send: WhatsApp success message
```

---

## Charging Rules

| Scenario | Charge? | Amount | Notes |
|----------|---------|--------|-------|
| New weekly report | ✅ Yes | 50 KES | First time |
| New monthly report | ✅ Yes | 200 KES | First time |
| Existing weekly report | ❌ No | Free | Already paid |
| Existing monthly report | ❌ No | Free | Already paid |
| Failed payment | ❌ No | - | Retry possible |

---

## What's Different from Shop Charging?

### Shop Charging (Existing - SHOP_*)
```
Shop Owner: "Charge Customer"
   ↓
Shop enters amount (VARIABLE)
   ↓
Uses Paystack SPLIT CODE (routes to shop account)
   ↓
Reference: SHOP_shopId_timestamp
```

### Report Charging (New - REPORT_*)
```
User: Requests Report
   ↓
System charges FIXED amount (50 or 200)
   ↓
NO SPLIT CODE (routes to platform account)
   ↓
Reference: REPORT_PERIOD_shopId_timestamp
```

**Both work independently and are handled by the same webhook!**

---

## Webhook Reference Identification

The webhook uses **TWO systems** to identify charge type:

### 1. Reference Prefix (Primary)
```
REPORT_* → handleReportCharge()
SHOP_*   → handleShopCustomerCharge()
CYBER_*  → handleCyberCharge()
SUB_*    → handleSubscriptionCharge()
INV_*    → handleAgentPayment()
```

### 2. Metadata Field (Backup)
```json
{
  "metadata": {
    "chargeType": "report_charge"  // or "shop_charge"
  }
}
```

If reference prefix doesn't match, it falls back to metadata field.

---

## Testing

### Test Report Charge

1. Get your test Paystack credentials
2. Run locally or deploy
3. Send WhatsApp: Request weekly report
4. Enter phone number
5. STK push should appear on phone
6. Complete payment
7. Check Firestore:
   - `report_charges/{reference}` should exist
   - Status should be "success"
   - `shops/{shopId}/report_charges/{reference}` should mirror it
8. Check `platform_revenue/{reference}` exists

### Check Webhook Logs

```bash
firebase functions:log --region africa-south1
```

Look for:
```
Received webhook event: charge.success
Identified charge type: report_charge
Processing report charge: REPORT_WEEKLY_...
✅ Report charge processed: ...
```

---

## Firestore Collections (Automatic)

These are created automatically by the service:

```
report_charges/
  REPORT_WEEKLY_shop123_timestamp/
    - reference
    - shopId
    - reportPeriod: "weekly"
    - dateRange: "last7days"
    - chargeAmount: 50
    - status: "success"
    - createdAt
    - updatedAt

shops/{shopId}/report_charges/
  REPORT_WEEKLY_shop123_timestamp/
    - (same as above)

platform_revenue/
  REPORT_WEEKLY_shop123_timestamp/
    - reference
    - shopId
    - grossAmount: 50
    - paystackFees: 1.5
    - platformRevenue: 48.5
    - status: "success"

platform_stats/
  totals/
    - totalReportCharges: 125
    - totalReportRevenue: 5234.50
```

---

## Troubleshooting

### Charge initiated but no STK push
- Check Paystack credentials
- Verify phone number format (should be +254... or 0...)
- Check logs for "Failed to send STK push"
- Test with test Paystack account first

### Webhook not updating status
- Verify signature validation (check PAYSTACK_SECRET_KEY)
- Ensure webhook URL is registered in Paystack dashboard
- Check webhook region is `africa-south1`
- Look for "Invalid signature" errors in logs

### Report not generating after payment
- Verify STATE.REPORT_GENERATING handler is implemented
- Check session context is preserved
- Look for errors in report generation handler
- Verify report.handler.handleGenerateReport() is called

### Duplicate charges on same report
- Verify hasExistingReport() is being called before charge
- Check Firestore indexes are created
- Ensure dateRange parameter matches exactly

---

## Key Files

- ✅ `functions/src/services/report.charge.service.ts` - Charge logic (CREATED)
- ✅ `webhook.copy.ts` - Universal webhook handler (CREATED)
- 📝 `REPORT_CHARGE_IMPLEMENTATION.md` - Full details (CREATED)
- 🔧 `functions/src/constants/states.ts` - Add states (YOU UPDATE)
- 🔧 `functions/src/handlers/report.menu.handler.ts` - Add payment flow (YOU UPDATE)
- 🔧 `functions/src/index.ts` - Export webhook (YOU UPDATE)

---

## Done! 🎉

All the heavy lifting is done. Just:
1. Copy webhook to your codebase
2. Add states
3. Update handlers
4. Test

The system handles:
- ✅ Report charging
- ✅ Shop customer charging (existing, still works)
- ✅ Webhook identification of both
- ✅ Proper fund routing (split vs. direct)
- ✅ WhatsApp feedback
- ✅ Firestore recording
- ✅ Platform revenue tracking
