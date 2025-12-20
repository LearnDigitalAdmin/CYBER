# Report Charge Implementation Guide

## Overview

This implementation adds the ability to charge users for generating reports:
- **Weekly Reports**: KES 50
- **Monthly Reports**: KES 200
- **Free Access**: Previous reports (no duplicate charges)

The system supports **TWO independent charging systems** working in parallel:

### 1. Shop-Customer Charging (Existing)
- Shop owner charges customers
- Funds routed via **Paystack Split Code** to shop account
- Reference prefix: `SHOP_*`
- Webhook metadata: `chargeType: 'shop_charge'`

### 2. Platform-Shop Report Charging (New)
- Platform charges shop for report access
- Funds go directly to **platform account** (no split code)
- Reference prefix: `REPORT_*`
- Webhook metadata: `chargeType: 'report_charge'`

Both work independently and are identified in the webhook by their reference prefix or metadata.

---

## 1. Implementation Steps

### Step 1: Copy Report Charge Service

The file `functions/src/services/report.charge.service.ts` is already created. It provides:

- `getReportChargeAmount()` - Returns 50 for weekly, 200 for monthly
- `hasExistingReport()` - Checks if user already has this report (free)
- `initiateReportCharge()` - Sends STK push via Paystack
- `updateReportChargeStatus()` - Updates charge status on success/failure

### Step 2: Update Session States

Add these new states to `functions/src/constants/states.ts`:

```typescript
export const STATE = {
  // ... existing states ...

  // Report charging flow
  REPORT_PAYMENT_MENU: 'report_payment_menu',           // Ask for payment confirmation
  REPORT_PAYMENT_PROMPT: 'report_payment_prompt',        // Enter phone number for payment
  REPORT_GENERATING: 'report_generating',                // Generate after payment success
};
```

### Step 3: Update Report Menu Handlers

Modify `functions/src/handlers/report.menu.handler.ts`:

Before generating a report, check if it's a new charge:

```typescript
// Inside handleWeeklyReportMenu / handleMonthlyReportMenu

// Check for existing report
const hasReport = await hasExistingReport(shopId, 'weekly', 'last7days');

if (!hasReport) {
  // New report - require payment
  const chargeAmount = getReportChargeAmount('weekly');

  const message =
    `📊 Weekly Report - Last 7 Days\n\n` +
    `💰 Charge: KES ${chargeAmount}\n\n` +
    `Type your M-Pesa phone number to proceed with payment:\n` +
    `(e.g., 254712345678 or 0712345678)`;

  await updateSessionState(phone, STATE.REPORT_PAYMENT_PROMPT, {});
  await updateSessionContext(phone, {
    reportPeriod: 'weekly',
    reportDateRange: 'last7days',
    reportChargeAmount: chargeAmount,
  });

  return message;
} else {
  // Existing report - generate free
  // ... generate and return report ...
}
```

### Step 4: Handle Report Payment Flow

Add new handlers in a separate file or existing handlers:

```typescript
// Handle REPORT_PAYMENT_PROMPT state
export async function handleReportPaymentPhone(
  phone: string,
  input: string,
  session: Session
): Promise<string> {
  const validation = validatePhoneNumber(input);

  if (!validation.valid) {
    return 'Invalid phone number. Please enter a valid M-Pesa phone number.';
  }

  const shopId = session.context.shopId as string;
  const reportPeriod = session.context.reportPeriod as string;
  const reportDateRange = session.context.reportDateRange as string;

  // Initiate report charge
  const result = await initiateReportCharge(
    shopId,
    validation.formatted,
    reportPeriod,
    reportDateRange
  );

  if (result.success) {
    await updateSessionState(phone, STATE.REPORT_GENERATING, {});

    return (
      `✅ Payment Request Sent!\n\n` +
      `📱 Phone: ${validation.formatted}\n` +
      `💰 Amount: KES ${session.context.reportChargeAmount}\n` +
      `📊 Report: ${reportPeriod.charAt(0).toUpperCase() + reportPeriod.slice(1)}\n\n` +
      `⏳ Enter your M-Pesa PIN to confirm payment.\n\n` +
      `Once confirmed, your report will be generated automatically.`
    );
  } else {
    return `❌ Failed to send payment request: ${result.error}`;
  }
}
```

### Step 5: Copy Webhook Handler

**IMPORTANT**: The webhook is provided in `webhook.copy.ts` at the project root.

Steps:
1. Copy `webhook.copy.ts` to your actual codebase at `functions/src/webhooks/paystack-callback.ts`
2. Update `functions/src/index.ts` to export it:

```typescript
import { paystackCallback } from './webhooks/paystack-callback';

exports.paystackCallback = paystackCallback;
```

3. **Remove old webhook** if you have one, or integrate this into existing webhook

### Step 6: Update Firebase Firestore Indexes

The system uses these collections:

```
report_charges/
  - {reference}
    - status: 'pending' | 'success' | 'failed'
    - shopId
    - reportPeriod: 'weekly' | 'monthly'
    - dateRange: 'last7days' | 'last30days'
    - chargeAmount
    - createdAt
    - updatedAt

shops/{shopId}/report_charges/
  - {reference} (same structure as above)

shops/{shopId}/transactions/
  - {SHOP_* references} (for customer charges)

platform_revenue/
  - {reference} (report charge records)
  - totalReportCharges
  - totalReportRevenue
```

---

## 2. Webhook Charge Type Identification

The webhook in `webhook.copy.ts` handles **5 charge types**:

### Reference Prefix System

| Prefix | Type | Account | Metadata |
|--------|------|---------|----------|
| `REPORT_*` | Report charge | Platform | `chargeType: 'report_charge'` |
| `SHOP_*` | Customer charge | Shop (split) | `chargeType: 'shop_charge'` |
| `CYBER_*` | Service charge | Agent | N/A (existing) |
| `SUB_*` | Subscription | User | N/A (existing) |
| `INV_*` | Invoice/Agent | User | N/A (existing) |

### Example Reference Patterns

```
REPORT_WEEKLY_plot-shop-123_1699564800000
REPORT_MONTHLY_plot-shop-456_1699564800000

SHOP_plot-shop-123_1699564800000
SHOP_plot-shop-456_1699564800000

CYBER_user-789_1699564800000
SUB_user-101_1699564800000
INV_invoice-202_1699564800000
```

### Webhook Metadata Structure

**Report Charge Metadata:**
```json
{
  "chargeType": "report_charge",
  "shopId": "plot-shop-123",
  "reportPeriod": "weekly",
  "dateRange": "last7days",
  "userPhone": "+254712345678",
  "chargeAmount": 50
}
```

**Shop Customer Charge Metadata (existing):**
```json
{
  "chargeType": "shop_charge",
  "shopId": "plot-shop-123",
  "customerPhone": "+254712345678",
  "network": "safaricom"
}
```

---

## 3. Webhook Processing Flow

### For Report Charges (NEW)

```
charge.success (REPORT_*)
  ↓
updateReportChargeStatus(reference, "success")
  ↓
updateShopReportCharge(shopId, reference, "success")
  ↓
recordPlatformRevenue()
  ↓
updatePlatformStats()
  ↓
sendReportChargeSuccessMessage(userPhone)
```

Records created:
- `report_charges/{reference}` - Status: success
- `shops/{shopId}/report_charges/{reference}` - Status: success
- `platform_revenue/{reference}` - Revenue tracking

### For Shop Customer Charges (EXISTING)

```
charge.success (SHOP_*)
  ↓
updateTransaction(reference, "success")
  ↓
recordShopIncome()
  ↓
updateShopStats()
  ↓
sendShopChargeSuccessMessage(shopOwnerPhone)
```

Records created:
- `shops/{shopId}/transactions/{reference}` - Status: success

### For Cyber Service Charges (EXISTING)

```
charge.success (CYBER_*)
  ↓
updateCyberTransaction(reference, "success")
  ↓
recordAgentIncome()
  ↓
splitFunds(80% agent, 20% platform)
  ↓
updateAgentStats()
```

---

## 4. Firestore Collection Structure

### report_charges Collection (Platform)
```typescript
{
  reference: "REPORT_WEEKLY_shopId_timestamp",
  shopId: "plot-shop-123",
  userPhone: "+254712345678",
  reportPeriod: "weekly" | "monthly",
  dateRange: "last7days" | "last30days",
  chargeAmount: 50 | 200,
  status: "pending" | "success" | "failed",
  chargeType: "report_charge",
  createdAt: "2024-01-01T10:00:00Z",
  updatedAt: "2024-01-01T10:05:00Z",
  paystackReference?: "ref_xxxxx",
  failureReason?: "error message"
}
```

### shops/{shopId}/report_charges Collection
```typescript
{
  // Same structure as above
  // Mirrored for quick shop-level queries
}
```

### platform_revenue Collection
```typescript
{
  reference: "REPORT_WEEKLY_shopId_timestamp",
  shopId: "plot-shop-123",
  userPhone: "+254712345678",
  reportPeriod: "weekly",
  dateRange: "last7days",
  chargeAmount: 50,
  grossAmount: 50.00,
  paystackFees: 1.50,
  platformRevenue: 48.50,
  currency: "KES",
  status: "success",
  type: "report_charge",
  createdAt: FieldValue.serverTimestamp(),
  paidAt: FieldValue.serverTimestamp()
}
```

### platform_stats Collection
```typescript
{
  totals: {
    totalReportCharges: 125,
    totalReportRevenue: 5234.50,
    lastReportChargeDate: FieldValue.serverTimestamp()
  }
}
```

---

## 5. WhatsApp Messaging

### Report Charge Success Message (To Shop Owner)

```
✅ *Report Payment Successful*

Thank you for your payment!

📊 Report Type: Weekly
💰 Amount Paid: KES 50
🏪 Shop: Your Shop Name

Your report is now being generated. You will receive it shortly.

Ref: shop-id-xxx
```

### Shop Customer Charge Success Message (To Shop Owner)

```
✅ *Payment Received*

Customer payment successful!

👤 Customer: +254712345678
💰 Amount: KES 5000
🏪 Shop: Your Shop Name

The amount has been transferred to your account.
```

### Charge Failure Message

```
❌ *Payment Failed*

The payment request could not be processed.

💰 Amount: KES 50
📊 Report: Weekly Report
🏪 Shop: Your Shop Name

Please try again or contact support.
```

---

## 6. Testing Checklist

- [ ] Report charge service initializes correctly
- [ ] STK push is sent with correct reference and metadata
- [ ] Webhook receives charge.success event with REPORT_* reference
- [ ] Webhook correctly identifies charge type from reference
- [ ] Report charge status updates to success in Firestore
- [ ] Platform revenue is recorded
- [ ] Platform stats are updated
- [ ] WhatsApp messages are sent (or logged)
- [ ] Both shop customer charges and report charges work in parallel
- [ ] Free access works for existing reports (no duplicate charges)
- [ ] Failed payments are properly tracked
- [ ] Phone number normalization works correctly

---

## 7. Error Handling

### Common Issues

**Issue**: Webhook not receiving events
- Check Paystack webhook URL configuration
- Verify signature validation logic
- Check PAYSTACK_SECRET_KEY is set

**Issue**: Report not generated after payment
- Check report generation handler is called on STATE.REPORT_GENERATING
- Verify session context is preserved
- Check report.handler.handleGenerateReport() is called

**Issue**: Duplicate charges
- Verify hasExistingReport() is checking all reports
- Ensure Firestore indexes are created
- Check dateRange parameter matching

**Issue**: Split code or account routing issues**
- Report charges use NO split code (platform account only)
- Shop charges use split code (shop account)
- Verify reference prefix is correct
- Check metadata chargeType field

---

## 8. Key Differences from Shop Charging

| Aspect | Shop Charge | Report Charge |
|--------|-----------|---------------|
| **Initiator** | Shop owner | System |
| **Receiver** | Shop account | Platform account |
| **Amount** | Variable | Fixed (50/200) |
| **Split Code** | Yes (shop sub-account) | No (platform account) |
| **Reference** | `SHOP_*` | `REPORT_*` |
| **Menu Flow** | Shop menu → charge customer | Report menu → charge for access |
| **Previous Access** | N/A | Free (no duplicate charge) |
| **Metadata** | `chargeType: 'shop_charge'` | `chargeType: 'report_charge'` |

---

## 9. Database Migration (if needed)

If you have an existing codebase without these collections:

```typescript
// Create Firestore indexes for reports (if needed)
// Path: Firestore Console → Indexes → Create Composite Index
//
// Index 1:
// Collection: shops
// Fields:
//   - period (Ascending)
//   - dateRange (Ascending)
//   - generatedAt (Descending)
//
// Index 2:
// Collection: report_charges
// Fields:
//   - shopId (Ascending)
//   - createdAt (Descending)
```

---

## 10. Final Notes

1. **Both systems work independently**: Shop can charge customers while platform charges for reports
2. **Reference prefixes are critical**: They determine which handler processes the webhook
3. **Metadata carries charge type**: Belt-and-suspenders approach for reliability
4. **No split code for reports**: Platform keeps 100% of report charges
5. **Previous reports are free**: Check hasExistingReport() before charging
6. **WhatsApp feedback is automatic**: Users get instant confirmation of payment success
7. **Firestore is source of truth**: All status updates go to Firestore immediately

---

## 11. Next Steps

1. Copy `webhook.copy.ts` to `functions/src/webhooks/paystack-callback.ts`
2. Update `functions/src/constants/states.ts` with new states
3. Update report menu handlers with payment flow
4. Test with real Paystack credentials
5. Deploy to Firebase Functions
6. Monitor webhook logs for any issues
7. Send reports for testing (weekly and monthly)
