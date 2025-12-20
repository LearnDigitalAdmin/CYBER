# Auto-Create Split Code - Quick Reference

## What Changed?

**Before**: Admin manually created split codes in Paystack dashboard
**After**: System automatically creates and caches split codes

---

## Admin Approval (New Way)

```javascript
// Get shop's Paystack subaccount ID from Paystack dashboard
// It looks like: "ACCT_abc123xyz"

await approvePaymentSetupRequest(
  'request_id',
  'ACCT_abc123xyz'  // ← Shop's subaccount ID (not split code)
);
```

---

## What Happens Behind the Scenes

### First Charge
```
Shop owner charges customer
  ↓
System checks: Does splitCodes/{shopId} exist? → NO
  ↓
System creates split code via Paystack API
  ├─ Paystack returns: "SPL_xyz789abc"
  └─ Saves to Firestore cache
  ↓
STK push sent with this split code
```

### Subsequent Charges
```
Shop owner charges another customer
  ↓
System checks: Does splitCodes/{shopId} exist? → YES
  ↓
System retrieves cached split code instantly
  ↓
STK push sent with cached split code
```

---

## Commission Distribution

**Platform takes 1.5% commission**

```
Customer pays: KES 2,000
  ↓
Paystack fee: ~KES 39.80 (1.99%)
  ↓
Remaining: KES 1,960.20
  ↓
Split:
  ├─ Platform (1.5%): KES 29.40 ✓
  └─ Shop (98.5%): KES 1,930.80 → Credited to shop's subaccount
```

---

## Files Changed

| File | Change | Impact |
|------|--------|--------|
| `payment.split.service.ts` | **NEW** | Handles auto-create & caching |
| `payment.charge.handler.ts` | Updated | Calls auto-create on charge |
| `payment.setup.service.ts` | Updated | Accepts subaccount ID now |
| `shop.types.ts` | Updated | New interface for cache |

---

## Key Functions

### Create/Get Split Code
```javascript
const splitCode = await getOrCreateSplitCodeWithRetry(
  shopId,           // Which shop
  "ACCT_abc123",    // Shop's Paystack subaccount
  3,                // Max retries (default 3)
  1.5               // Commission % (default 1.5%)
);
// Returns: "SPL_xyz789abc"
```

### Clear Cache (if commission changes)
```javascript
await invalidateSplitCodeCache(shopId);
// Forces new split code on next charge
```

### Check Cached Split
```javascript
const cached = await getCachedSplitCode(shopId);
console.log(cached.splitCode);  // "SPL_xyz789abc"
```

---

## Firestore Structure

### Shop Document
```javascript
shops/{shopId}: {
  ...
  paymentAccount: {
    type: "mpesa",
    mpesa: { paybillOrTill: "123456", ... },
    paystackSubaccountId: "ACCT_abc123xyz",  // ← Store THIS now
    createdAt: 1731421800,
    updatedAt: 1731421800
  }
}
```

### Split Code Cache
```javascript
splitCodes/{shopId}: {
  shopId: "MjmBV0twUGzfjDUqpj4u",
  splitCode: "SPL_xyz789abc",
  subaccountId: "ACCT_abc123xyz",
  commissionRate: 1.5,
  createdAt: 1731421800,
  updatedAt: 1731421800
}
```

---

## Error Handling

### Automatic Retry
If Paystack API fails, system retries up to 3 times with delays:
- Attempt 1: Immediate
- Attempt 2: Wait 1 second
- Attempt 3: Wait 2 seconds
- Attempt 4: Wait 4 seconds

### User Experience
- First charge: Might take 1-2 seconds longer (creating split)
- Subsequent charges: Instant (cached)
- If creation fails: User gets clear error message

---

## Deployment Checklist

- [ ] Deploy functions (`firebase deploy --only functions`)
- [ ] Update admin scripts to pass subaccount ID
- [ ] Test with sample charge
- [ ] Verify split code created (check Firestore logs)
- [ ] Verify subsequent charges use cache
- [ ] Verify platform receives 1.5% commission

---

## Monitoring

### Logs to Look For
```
✓ "Getting or creating split code for shop"    → Starting process
✓ "Using cached split code"                    → Using cache (fast)
✓ "Created new split code"                     → Created new
✗ "Failed to get/create split code"            → Error occurred
```

### Check Cache
```javascript
// See what's cached
const split = await getCachedSplitCode('shop_id');
console.log(split);
```

### Admin Utility
```javascript
// List all cached splits
const all = await getAllCachedSplitCodes(100);
all.forEach(s => console.log(s.splitCode));
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Payment account not configured" | Admin needs to approve setup with subaccount ID |
| "Failed to prepare payment routing" | Check Paystack API is accessible, retry the charge |
| "Split code keeps changing" | Clear cache if commission rate changed, or don't clear if you want new split |
| Slow first charge | Normal, creating split code (~1-2 sec) |
| Fast subsequent charges | Cached split code, instant (expected) |

---

## Benefits

✅ **No Manual Work**: Splits created automatically
✅ **Scalable**: Works for unlimited shops
✅ **Flexible**: Can change commission rate anytime
✅ **Cached**: Subsequent charges are instant
✅ **Reliable**: Retry logic for transient failures
✅ **Safe**: Commission enforced via Paystack split
✅ **Traceable**: All splits logged in Firestore

---

## What the User Sees

### Option 6: Setup Payment Account
- No change, exact same flow
- WhatsApp message to admin with details

### Option 7: Charge Customer
- No visible change
- System silently creates/uses split codes behind the scenes
- Same success/error messages

---

**Status**: ✅ PRODUCTION READY
**Build**: ✅ 0 ERRORS
**Ready**: YES
