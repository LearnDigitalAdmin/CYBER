# Paystack Sub-Account Routing for USSD Charges

## The Issue

The current code is sending `subaccount` parameter in the USSD charge request:
```json
{
  "subaccount": "ACCT_03pp4w30rbe2hvs"
}
```

This causes a **400 Bad Request** from Paystack because **Paystack USSD charges don't accept the `subaccount` parameter directly**.

---

## How Sub-Account Routing Works in Paystack

### Option 1: Sub-Account API Keys (RECOMMENDED)
Each shop gets their own **Paystack API key** instead of storing a sub-account ID.

**Setup**:
1. Create Paystack sub-account for shop
2. Generate API key for that sub-account (in Paystack dashboard)
3. Store API key securely (using Firebase Secrets)
4. Use that key for API calls

**Advantage**: Direct authentication as the sub-account
**Disadvantage**: Manage multiple API keys

```typescript
// Instead of storing paystackSubaccountId, store:
shops/{shopId}.paymentAccount = {
  ...
  paystackApiKey: "sk_live_shop_specific_key"  // ← Replace subaccountId
}

// In payment.charge.service.ts:
const headers = {
  Authorization: `Bearer ${paymentAccount.paystackApiKey}`,  // ← Use shop's key
  'Content-Type': 'application/json'
}
```

---

### Option 2: Split Codes (If you have a business account with splits)
If your Paystack account supports splits, use split codes instead:

**Setup**:
1. Create split code in Paystack for each sub-account
2. Store split code instead of sub-account ID
3. Send split code in charge request

**Example**:
```typescript
shops/{shopId}.paymentAccount = {
  ...
  paystackSplitCode: "SPL_kXXXX"  // ← Instead of subaccountId
}

// In charge payload:
const payload = {
  type: 'ussd',
  ussd: { type: 'pt' },
  amount: 200000,
  phone: "254712345678",
  split: "SPL_kXXXX",  // ← Use split parameter
  metadata: { shopId, ... }
}
```

---

### Option 3: Central Account with Manual Settlement
Keep using central Paystack account for all charges, manually settle to shops later.

**Setup**:
1. All charges go through main Paystack account
2. Track which charges belong to which shop
3. Manually transfer funds to shops from dashboard

**Advantage**: Simplest to implement
**Disadvantage**: Manual settlement process

```typescript
// Don't store paystackSubaccountId at all
// Just track shopId in metadata

const payload = {
  type: 'ussd',
  ussd: { type: 'pt' },
  amount: 200000,
  phone: "254712345678",
  // No subaccount, split, or routing - all goes to main account
  metadata: { shopId, ... }  // For tracking purposes only
}
```

---

## Current Code Status

The code is already set up for **Option 1** or **Option 2**, but the parameter name is wrong.

### What to Change

In `payment.charge.service.ts`, you have two choices:

#### Choice A: Switch to Sub-Account API Keys (Recommended)

Change the shop data structure:
```typescript
// Old:
paymentAccount: {
  paystackSubaccountId: "ACCT_xxxxx"
}

// New:
paymentAccount: {
  paystackApiKey: "sk_live_shop_key"  // Generated from Paystack dashboard
}
```

Then use it:
```typescript
const response = await axios.post(
  `${PAYSTACK_API_BASE}/charge`,
  payload,
  {
    headers: {
      Authorization: `Bearer ${paystackApiKey}`,  // ← Shop's own key
      'Content-Type': 'application/json',
    },
  }
);
```

#### Choice B: Use Split Codes

Change the shop data structure:
```typescript
// Old:
paymentAccount: {
  paystackSubaccountId: "ACCT_xxxxx"
}

// New:
paymentAccount: {
  paystackSplitCode: "SPL_kXXXX"  // From Paystack split configuration
}
```

Then use it in the payload:
```typescript
const payload = {
  type: 'ussd',
  ussd: { type: network === 'safaricom' ? 'pt' : 'at' },
  amount: Math.round(amount * 100),
  phone: normalizedPhone,
  email: `stk-push-${shopId}@cogvana.co.ke`,
  split: paystackSplitCode,  // ← Use split parameter instead
  metadata: { shopId, network, customerPhone }
};
```

#### Choice C: Use Central Account (Simplest)

Keep main API key, don't send any routing parameter:
```typescript
const payload = {
  type: 'ussd',
  ussd: { type: network === 'safaricom' ? 'pt' : 'at' },
  amount: Math.round(amount * 100),
  phone: normalizedPhone,
  email: `stk-push-${shopId}@cogvana.co.ke`,
  // No subaccount, split, or routing parameters
  metadata: { shopId, network, customerPhone }
};
```

---

## Recommendation: Which Option?

**For your use case** (multiple shops charging customers):

### Use Option 1: Sub-Account API Keys ✅

**Why**:
- Direct routing (funds go directly to shop's account)
- Most secure (each shop has isolated credentials)
- Automatic settlement (no manual transfers needed)
- Paystack handles split at API key level

**Implementation Steps**:

1. **In Paystack Dashboard**:
   - Create sub-account for shop
   - Generate API key for that sub-account
   - Copy the key (format: `sk_live_xxxxx`)

2. **In Firestore**:
   ```javascript
   shops/{shopId}.paymentAccount = {
     type: "mpesa",
     mpesa: { paybillOrTill, accountNumber },
     paystackApiKey: "sk_live_xxxxx",  // From dashboard
     createdAt: timestamp,
     updatedAt: timestamp
   }
   ```

3. **In payment.charge.service.ts**:
   ```typescript
   const response = await axios.post(
     `${PAYSTACK_API_BASE}/charge`,
     payload,
     {
       headers: {
         Authorization: `Bearer ${paymentAccount.paystackApiKey}`,  // ← Use this!
         'Content-Type': 'application/json',
       },
     }
   );
   ```

---

## Current Code Fix (Temporary)

The code has been updated to remove the invalid `subaccount` parameter from the USSD payload.

Now you need to choose which routing method you want and update accordingly.

---

## Paystack Sub-Account vs Split

| Feature | Sub-Account API Key | Split Code |
|---------|-------------------|-----------|
| Setup | Create sub-account, generate key | Create split rule |
| Funds Routing | Direct to sub-account | Split from main account |
| Settlement | Automatic | Manual from main account |
| Isolation | Full isolation | Tracked in main account |
| Complexity | Medium | Low |
| Security | Better | Lower |
| Cost | Same fees | Same fees |

---

## What Paystack Actually Requires

For USSD charges to work, one of these must be true:

```javascript
// Option 1: Using sub-account's API key
headers: {
  Authorization: `Bearer sk_live_shop_specific_key`  // ← Authenticated as sub-account
}

// Option 2: Using split code
payload: {
  split: "SPL_code"  // ← Split configuration
}

// Option 3: Central account
headers: {
  Authorization: `Bearer sk_live_main_key`  // ← Authenticated as main account
}
payload: {
  // No routing - goes to main account
}
```

You cannot use `subaccount` parameter in the payload for USSD charges. That's only for certain other endpoints.

---

## Next Step

1. **Decide**: Which routing method do you want?
   - Sub-Account API Keys (Recommended)
   - Split Codes
   - Central Account

2. **Update**: `shops/{shopId}.paymentAccount` structure accordingly

3. **Update**: `payment.charge.service.ts` to use the correct parameter/key

4. **Test**: Send STK push again

---

## Test Request After Fix

Once you implement Option 1 (recommended):

```javascript
// Should work:
{
  "type": "ussd",
  "ussd": { "type": "pt" },
  "amount": 1000,
  "phone": "254791286165",
  "email": "stk@cogvana.co.ke",
  "metadata": { "shopId": "1234" }
}

// Sent with:
Authorization: Bearer sk_live_shop_key  // ← This is the routing
```

No `subaccount` field needed!
