# Dual Charging System: Shop Customers + Platform Reports

## Overview

This document explains how the two independent charging systems work together in the same codebase without interfering with each other.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     PAYSTACK WEBHOOK                        │
│                     charge.success                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ├─ Check: event.data.reference
                       │           ↓
                       ├─────────┬──────────┬───────┬─────┬─────┐
                       │         │          │       │     │     │
                       ▼         ▼          ▼       ▼     ▼     ▼
                    REPORT_   SHOP_    CYBER_   SUB_  INV_  ?
                    charge    charge   charge   charge charge
                       │         │        │       │     │
                       ▼         ▼        ▼       ▼     ▼
                    Report    Shop      Agent   User   User
                   Revenue    Income    Income  Account Account
                     DB        DB        DB      DB      DB
```

---

## Side-by-Side Comparison

### SHOP CUSTOMER CHARGING (Existing)

**Trigger**: Shop owner manually initiates
```
Shop Owner Menu
  → "Charge Customer"
  → Enter amount (e.g., 5000 KES)
  → Enter customer phone
  → Select network (M-Pesa/Airtel)
  → STK push sent
```

**Payment Reference Format**:
```
SHOP_{shopId}_{timestamp}
SHOP_plot-shop-abc123_1699564800000
```

**Fund Routing**:
```
Customer pays 5000 KES
    ↓
Paystack deducts fees (~150 KES)
    ↓
Remaining 4850 KES
    ↓
SPLIT CODE routes to shop account
    ↓
Shop receives 4850 KES (100%)
```

**Firestore Location**:
```
shops/{shopId}/transactions/
  SHOP_plot-shop-abc123_1699564800000/
    - status: "success"
    - amount: 5000
    - network: "safaricom"
    - customerPhone: "+254712345678"
```

---

### PLATFORM REPORT CHARGING (New)

**Trigger**: User requests report
```
User selects Report Menu
  → "Weekly Reports"
  → "Last 7 Days"
  → System checks: "Do I already have this report?"
    → YES? → Generate FREE (no charge)
    → NO? → Prompt for phone → STK push sent
```

**Payment Reference Format**:
```
REPORT_{period}_{shopId}_{timestamp}
REPORT_WEEKLY_plot-shop-abc123_1699564800000
```

**Fund Routing**:
```
User pays 50 KES
    ↓
Paystack deducts fees (~1.5 KES)
    ↓
Remaining 48.5 KES
    ↓
NO SPLIT CODE - goes to platform account
    ↓
Platform receives 48.5 KES (100%)
```

**Firestore Location**:
```
report_charges/
  REPORT_WEEKLY_plot-shop-abc123_1699564800000/
    - status: "success"
    - chargeAmount: 50
    - reportPeriod: "weekly"
    - dateRange: "last7days"

shops/{shopId}/report_charges/
  REPORT_WEEKLY_plot-shop-abc123_1699564800000/
    - (mirrored from above)

platform_revenue/
  REPORT_WEEKLY_plot-shop-abc123_1699564800000/
    - grossAmount: 50
    - paystackFees: 1.5
    - platformRevenue: 48.5
```

---

## Side-by-Side Charging Table

| Aspect | Shop Customer Charge | Report Charge |
|--------|----------------------|---------------|
| **Who triggers?** | Shop owner | System/User |
| **Amount type** | Variable (owner decides) | Fixed (50 or 200) |
| **Payment Network** | M-Pesa or Airtel | M-Pesa only |
| **Reference prefix** | `SHOP_*` | `REPORT_*` |
| **Split Code** | YES (shop account) | NO (platform account) |
| **Fund recipient** | Shop account | Platform account |
| **Firestore collection** | shops/{id}/transactions | report_charges + platform_revenue |
| **Webhook handler** | `handleShopCustomerCharge()` | `handleReportCharge()` |
| **Double-charging** | Not applicable | Prevented by hasExistingReport() |
| **WhatsApp notification** | Sent to shop owner | Sent to report requester |
| **Metadata field** | `chargeType: "shop_charge"` | `chargeType: "report_charge"` |
| **Paystack split code** | `shop.paystackSplitCode` | None (platform default) |
| **Revenue tracking** | shops/{id}.totalChargeRevenue | platform_revenue collection |

---

## Webhook Routing Logic

```typescript
// In webhook.copy.ts - paystackCallback()

const reference = data.reference;
const metadata = data.metadata;
const chargeType = metadata.chargeType || determineChargeType(reference);

// Route to appropriate handler
if (chargeType === 'report_charge' || reference.startsWith('REPORT_')) {
  await handleReportCharge(reference, data, metadata);
  //       ↓
  //    Updates report_charges/
  //    Updates shops/{id}/report_charges/
  //    Records platform_revenue/
}

else if (chargeType === 'shop_charge' || reference.startsWith('SHOP_')) {
  await handleShopCustomerCharge(reference, data, metadata);
  //       ↓
  //    Updates shops/{id}/transactions/
  //    Updates shops/{id} income stats
}

else if (reference.startsWith('CYBER_')) {
  await handleCyberCharge(reference, data, metadata);
}

else if (reference.startsWith('SUB_')) {
  await handleSubscriptionCharge(reference, data, metadata);
}

else if (reference.startsWith('INV_')) {
  await handleAgentPayment(reference, data, metadata);
}
```

---

## Real-World Scenario

### Scenario: Shop "Mobile Paradise" with 3 Concurrent Transactions

**Timeline**:

**10:00 AM - Shop Customer Charge**
```
Shop owner: "Charge customer 5000 KES"
Reference: SHOP_mobile-paradise_1699564800000
Paystack receives: SHOP_ prefix
Webhook routes to: handleShopCustomerCharge()
Updates: shops/mobile-paradise/transactions/SHOP_...
Result: Shop receives 4850 KES (5000 - 150 fees)
```

**10:05 AM - Report Charge (New Weekly Report)**
```
Customer: Requests "Weekly Report - Last 7 Days"
System checks: hasExistingReport()?
Result: NO - first time requesting this report
Reference: REPORT_WEEKLY_mobile-paradise_1699564800000
Paystack receives: REPORT_ prefix
Webhook routes to: handleReportCharge()
Updates: report_charges/REPORT_WEEKLY_...
Updates: platform_revenue/REPORT_WEEKLY_...
Result: Platform receives 48.5 KES (50 - 1.5 fees)
```

**10:10 AM - Same Report Charge Again (Should be FREE)**
```
Customer: Requests "Weekly Report - Last 7 Days" again
System checks: hasExistingReport()?
Result: YES - we already have this report!
Action: Generate report FREE, no charge
Webhook: Not involved (no payment)
Database: No new transaction created
```

**10:15 AM - Shop Customer Charge (Different Customer)**
```
Shop owner: "Charge another customer 3000 KES"
Reference: SHOP_mobile-paradise_1699566200000
Paystack receives: SHOP_ prefix
Webhook routes to: handleShopCustomerCharge()
Updates: shops/mobile-paradise/transactions/SHOP_...
Result: Shop receives 2910 KES (3000 - 90 fees)
```

**Summary for Mobile Paradise (10:00-10:15 AM)**:
```
Shop Customer Charges:
  ├─ Transaction 1: Customer paid 5000 KES → Shop got 4850 KES
  └─ Transaction 2: Customer paid 3000 KES → Shop got 2910 KES
     Total: Shop received 7760 KES

Report Charges:
  ├─ Transaction 1: User paid 50 KES → Platform got 48.5 KES
  └─ Transaction 2: FREE (existing report)
     Total: Platform received 48.5 KES

Firestore Records:
  - shops/mobile-paradise/transactions/ has 2 SHOP_* records
  - shops/mobile-paradise/report_charges/ has 1 REPORT_* record
  - report_charges/ has 1 REPORT_* record
  - platform_revenue/ has 1 REPORT_* record
```

All handled independently by the same webhook! ✅

---

## Key Design Principles

### 1. Reference Prefix is Primary Identifier
```
Reference format tells webhook what to do:
  REPORT_* → Report charging
  SHOP_*   → Customer charging
  CYBER_*  → Cyber services
  etc.

No configuration needed - format determines behavior!
```

### 2. Metadata is Secondary Safety Net
```
If reference prefix doesn't match expected pattern:
  {
    "metadata": {
      "chargeType": "report_charge"  // Backup identifier
    }
  }

Webhook checks this if prefix detection fails.
```

### 3. Different Firestore Locations = No Conflicts
```
Shop charges go to:    shops/{id}/transactions/
Report charges go to:  report_charges/ + shops/{id}/report_charges/
Cyber charges go to:   agents/{id}/cyber-income/
etc.

Different locations = different queries = no confusion
```

### 4. Different Accounting Paths
```
Shop charges: shops/{id}.totalChargeRevenue (shop income)
Report charges: platform_revenue/ (platform income)
Different collections = different accounting

No mixing of revenue streams!
```

---

## Webhook Decision Tree

```
Webhook receives charge.success
         │
         ├─ Is reference REPORT_*?
         │  ├─ YES → handleReportCharge()
         │  └─ NO → Continue
         │
         ├─ Is reference SHOP_*?
         │  ├─ YES → handleShopCustomerCharge()
         │  └─ NO → Continue
         │
         ├─ Is reference CYBER_*?
         │  ├─ YES → handleCyberCharge()
         │  └─ NO → Continue
         │
         ├─ Is reference SUB_*?
         │  ├─ YES → handleSubscriptionCharge()
         │  └─ NO → Continue
         │
         ├─ Is reference INV_*?
         │  ├─ YES → handleAgentPayment()
         │  └─ NO → Continue
         │
         ├─ Check metadata.chargeType
         │  ├─ "report_charge" → handleReportCharge()
         │  ├─ "shop_charge" → handleShopCustomerCharge()
         │  └─ ? → Log error, skip processing
         │
         └─ End
```

---

## Testing: Both Systems Together

### Test Case 1: Concurrent Shop and Report Charges

```
Scenario: Shop owner charges customer (5000 KES)
          while user requests report (50 KES)

1. Shop owner: "Charge Customer" → 5000 KES
   Reference: SHOP_shop123_1699564800000

2. User: "Weekly Report" → 50 KES
   Reference: REPORT_WEEKLY_shop123_1699564800000

3. Both STK pushes sent simultaneously

4. Both payments succeed within seconds

5. Webhook processes BOTH:
   ├─ SHOP_... → shops/shop123/transactions/SHOP_...
   ├─ REPORT_... → report_charges/REPORT_...
   └─ BOTH record to their respective Firestore locations

6. Results:
   ├─ Shop income updated: +4850 KES
   ├─ Platform revenue updated: +48.5 KES
   └─ Both properly separated and tracked
```

### Test Case 2: Report Duplicate Protection

```
Scenario: Same user requests same report twice

1. First request: "Weekly Report - Last 7 Days"
   hasExistingReport() = FALSE
   Charge: KES 50
   Reference: REPORT_WEEKLY_shop_1699564800000
   Status: success

2. Second request: "Weekly Report - Last 7 Days"
   hasExistingReport() = TRUE
   Charge: FREE (no new charge)
   No webhook involved
   No reference created

3. Results:
   ├─ Only 1 charge recorded in platform_revenue
   ├─ Only 1 payment processed through Paystack
   └─ User can access report unlimited times free
```

---

## Firestore Structure Summary

```
ROOT COLLECTIONS:
├── report_charges/                    ← Report payment tracking
│   └── REPORT_WEEKLY_shop123_1699.../
│       ├─ status: "success"
│       ├─ shopId, reportPeriod, dateRange
│       ├─ chargeAmount: 50
│       └─ timestamps
│
├── platform_revenue/                  ← Platform earnings
│   └── REPORT_WEEKLY_shop123_1699.../
│       ├─ grossAmount: 50
│       ├─ paystackFees: 1.5
│       ├─ platformRevenue: 48.5
│       └─ type: "report_charge"
│
├── platform_stats/                    ← Platform totals
│   └── totals/
│       ├─ totalReportCharges: 42
│       ├─ totalReportRevenue: 1950.50
│       └─ lastReportChargeDate: timestamp
│
└── shops/{shopId}/
    ├── transactions/                  ← Customer charges
    │   └── SHOP_shop123_1699.../
    │       ├─ status: "success"
    │       ├─ amount: 5000
    │       ├─ customerPhone
    │       └─ timestamps
    │
    ├── report_charges/                ← Mirrored report data
    │   └── REPORT_WEEKLY_shop123.../
    │       └─ (same as report_charges/)
    │
    └── (metadata with income totals)
        ├─ totalChargeRevenue: 47650
        ├─ totalChargesCollected: 18
        └─ lastChargeAmount: 5000
```

---

## Summary

**Two charging systems work independently in the same codebase:**

1. **Shop Customer Charges** (`SHOP_*`)
   - Shop owner initiates
   - Variable amount
   - Split code routes to shop account
   - Tracked in `shops/{id}/transactions/`

2. **Report Charges** (`REPORT_*`)
   - System/user initiates
   - Fixed amount (50/200)
   - No split code (direct to platform)
   - Tracked in `report_charges/` and `platform_revenue/`

**The webhook handles both using:**
- Reference prefix (primary identifier)
- Metadata field (backup)
- Different handlers for different charge types
- Different Firestore locations for different money flows

**Result:**
- ✅ No conflicts
- ✅ No confusion
- ✅ Proper fund routing
- ✅ Clear accounting separation
- ✅ Easy to extend with more charge types

**Implementation is complete and ready to deploy!**
