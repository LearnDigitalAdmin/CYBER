# Shop Data Requirements for Charge Customer Feature

## What's Required When User Charges Customer (Option 7)

When a shop owner tries to charge a customer, the system checks for **ONE critical piece of shop data**:

### Required Shop Field

```typescript
shops/{shopId}.paymentAccount
```

**Must contain:**
```javascript
{
  type: "mpesa" | "airtel" | "bank",

  // One of these based on type:
  mpesa?: {
    paybillOrTill: string,
    accountNumber: string,
    reference?: string
  },
  airtel?: {
    businessNumber: string,
    accountDetails: string
  },
  bank?: {
    bankName: string,
    branch: string,
    accountNumber: string
  },

  // CRITICAL FOR STK PUSH:
  paystackSubaccountId: string,  // e.g., "ACT_xxxxxx"

  // Timestamps
  createdAt: number,
  updatedAt: number
}
```

---

## The Flow

### 1. User Selects Option 7: Charge Customer
```
My Shop Menu → 7 (Charge Customer)
↓
Enter amount
↓
Enter customer phone
↓
Select network (1=Safaricom, 2=Airtel)
↓
System checks: shop.paymentAccount.paystackSubaccountId exists?
```

### 2. If Payment Account NOT Set Up
```
❌ Payment account not configured. Please contact support.
↓
User must first do Option 6 (Setup Payment Account)
↓
Admin approves and adds paystackSubaccountId
```

### 3. If Payment Account IS Set Up
```
✅ System has paystackSubaccountId
↓
Calls Paystack API with:
  - shopId
  - amount
  - customerPhone
  - network (safaricom/airtel)
  - paystackSubaccountId ← FROM shop.paymentAccount
```

---

## Where Payment Account Comes From

### Setup Flow (Option 6)
```
Shop owner: Option 6 → Setup Payment Account
↓
Chooses method (M-Pesa/Airtel/Bank)
↓
Enters account details
↓
Confirms
↓
Saved to Firestore:
  paymentSetupRequests/{requestId} ← Admin review queue
↓
Admin approves via dashboard/script
↓
Admin creates Paystack sub-account (gets ACT_xxxx ID)
↓
Admin manually updates Firestore:
  shops/{shopId}.paymentAccount = {
    type: "mpesa",
    mpesa: {...},
    paystackSubaccountId: "ACT_xxxx",  ← ADMIN ADDS THIS
    createdAt: ...,
    updatedAt: ...
  }
```

---

## Admin Setup Script Example

When you approve a payment setup request, you need to:

1. **Get the setup request**:
```javascript
const requestDoc = await db.collection('paymentSetupRequests').doc(requestId).get();
const request = requestDoc.data();
```

2. **Create Paystack sub-account** (using Paystack API):
```javascript
const paystackResponse = await axios.post(
  'https://api.paystack.co/subaccount',
  {
    business_name: request.shopName,
    settlement_bank: 'code_for_bank', // if bank transfer
    account_number: request.paymentDetails.accountNumber,
    percentage_charge: 0, // or percentage you want
    // ... other fields
  },
  { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
);

const paystackSubaccountId = paystackResponse.data.data.subaccount_code;
```

3. **Save to shop document**:
```javascript
await db.collection('shops').doc(request.shopId).update({
  paymentAccount: {
    type: request.paymentMethod,
    mpesa: request.paymentMethod === 'mpesa' ? request.paymentDetails : undefined,
    airtel: request.paymentMethod === 'airtel' ? request.paymentDetails : undefined,
    bank: request.paymentMethod === 'bank' ? request.paymentDetails : undefined,
    paystackSubaccountId: paystackSubaccountId,  // From Paystack API
    createdAt: Math.floor(Date.now() / 1000),
    updatedAt: Math.floor(Date.now() / 1000)
  }
});
```

4. **Update the request status**:
```javascript
await db.collection('paymentSetupRequests').doc(requestId).update({
  status: 'approved',
  approvedAt: Math.floor(Date.now() / 1000)
});
```

---

## Checking What's Needed

### To verify a shop is ready for charging:

```typescript
// In code or script
const shop = await db.collection('shops').doc(shopId).get();
const hasPaymentAccount = !!shop.data()?.paymentAccount;
const hasPaystackId = !!shop.data()?.paymentAccount?.paystackSubaccountId;

if (!hasPaymentAccount) {
  console.log('❌ No payment account. User must do Option 6 first.');
}

if (!hasPaystackId) {
  console.log('❌ No Paystack sub-account ID. Admin must approve.');
}

if (hasPaymentAccount && hasPaystackId) {
  console.log('✅ Ready to charge customers!');
}
```

---

## Summary

| Step | Who | Action | Data Location |
|------|-----|--------|----------------|
| 1 | Shop Owner | Option 6: Setup Account | `paymentSetupRequests/{id}` |
| 2 | Admin | Create Paystack sub-account | Paystack Dashboard |
| 3 | Admin | Add sub-account ID to shop | `shops/{shopId}.paymentAccount.paystackSubaccountId` |
| 4 | Shop Owner | Option 7: Charge Customer | Reads from `shops/{shopId}.paymentAccount` |

---

## Firestore Data Structure (After Setup)

```
shops/
└─ 1234/                          ← Shop ID
   ├─ shopName: "Ali's Shop"
   ├─ ownerName: "Ali Mohammed"
   ├─ phone: "+254712345678"
   ├─ ... other shop fields
   └─ paymentAccount:             ← THIS FIELD
      ├─ type: "mpesa"
      ├─ mpesa: {
      │  ├─ paybillOrTill: "123456"
      │  └─ accountNumber: "ACC12345"
      │}
      ├─ paystackSubaccountId: "ACT_xxxxxx"  ← CRITICAL!
      ├─ createdAt: 1731411000
      └─ updatedAt: 1731411000
```

When user tries to charge:
1. System fetches: `shops/1234.paymentAccount`
2. Checks: `paymentAccount.paystackSubaccountId` exists
3. If YES → Sends STK push with this ID
4. If NO → Shows error "Payment account not configured"

---

## Common Issues & Solutions

**Issue**: "Payment account not configured" error
**Solution**: Admin needs to add `paystackSubaccountId` to `shop.paymentAccount`

**Issue**: User completed Option 6 but can't charge
**Solution**: Admin hasn't approved the setup yet. Check `paymentSetupRequests` collection.

**Issue**: STK push fails
**Solution**:
- Verify `paystackSubaccountId` format (should start with "ACT_")
- Check Paystack sub-account is active
- Verify phone number format

---

## Quick Checklist for Admin

Before shop owner can charge customers:
- [ ] Shop owner completed Option 6 (Setup Payment Account)
- [ ] Request appears in `paymentSetupRequests` collection
- [ ] You created Paystack sub-account (got `ACT_xxxx` ID)
- [ ] You updated `shops/{shopId}.paymentAccount` with all fields
- [ ] `paystackSubaccountId` is set correctly
- [ ] You marked request as `status: 'approved'` in `paymentSetupRequests`

Once all checks pass → Shop owner can use Option 7! ✅
