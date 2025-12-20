# Charge Customer Flow - Complete Documentation

## Overview

The Charge Customer feature (Option 7 in My Shop Menu) now includes:
- **Clear navigation at every step** (Back, Restart, Exit)
- **Automatic payment listener activation** when user navigates back after STK push
- **Real-time status updates** via Firestore listeners
- **Automatic return to My Shop Menu** after payment completes
- **Same session continuity** - all in one conversation thread

---

## User Journey Flow

### Entry Point: My Shop Menu
User selects Option 7: "Charge Customer 💰"

### Step 1: Enter Amount
- **State:** `CHARGE_CUSTOMER_AMOUNT`
- **User Inputs:** Amount in KES (e.g., 500, 1000, 5000)
- **Validation:** Amount must be between 1-100,000 KES
- **Navigation Options:**
  - `0` = Back (no previous state, shows error)
  - `00` = Start over (restart from this step)
  - `000` = Exit to Language Selection

**Response:**
```
✓ Amount: KES 500

Now enter customer phone number:
(e.g., 0712345678 or +254712345678)

📱 *Navigation:*
*0* = Back to previous step
*00* = Start over
*000* = Exit to main menu
```

---

### Step 2: Enter Customer Phone Number
- **State:** `CHARGE_CUSTOMER_PHONE`
- **User Inputs:** Customer's phone number (various formats supported)
- **Validation:** Phone number validation and normalization
- **Navigation Options:**
  - `0` = Back to Amount step
  - `00` = Start over from Amount
  - `000` = Exit to Language Selection

**Response:**
```
✓ Customer: +254712345678

Select payment network:

1️⃣ Safaricom M-Pesa
2️⃣ Airtel Money

📱 *Navigation:*
*0* = Back to previous step
*00* = Start over
*000* = Exit to main menu
```

---

### Step 3: Select Network & Send STK Push
- **State:** `CHARGE_CUSTOMER_NETWORK`
- **User Inputs:** Network selection (1 = Safaricom, 2 = Airtel)
- **Process:**
  1. Get shop's payment account
  2. Verify Paystack subaccount is configured
  3. Get or create split code (auto-routing to shop subaccount)
  4. Send STK push via Paystack mobile_money endpoint
  5. Save transaction to Firestore with status "pending"
  6. Update state to `CHARGE_CUSTOMER_PROCESSING`
  7. Keep all context data for listener

**Response:**
```
✅ STK Push Sent!

📱 Customer: +254712345678
💰 Amount: KES 500
🌐 Network: Safaricom M-Pesa

⏳ Customer should see prompt to enter PIN.

Once payment is complete, you'll receive a confirmation message.

Transaction ID: SHOP_shopid_timestamp

👈 You can go back to continue other operations. Payment status will update automatically.

📱 *Navigation:*
*0* = Back to previous step
*00* = Start over
*000* = Exit to main menu
```

---

### Step 4: Payment Processing (Automatic Listener)
- **State:** `CHARGE_CUSTOMER_PROCESSING`
- **What Happens:**
  - STK push is displayed to customer
  - Seller can navigate back (0) or exit
  - If seller navigates back (0):
    1. Payment listener is automatically activated
    2. Listener watches `shops/{shopId}/transactions/{reference}` in Firestore
    3. Seller is returned to MY_SHOP_MENU
    4. Seller can continue other operations

**When User Presses 0 (Back):**
```
🏪 Back to My Shop Menu

💡 Payment listener activated. You'll receive updates automatically as the customer completes payment.

What would you like to do?

*My Shop Menu*

1. Quick Commands 🚀
2. Today's Summary 📊
3. View Stock 📦
... [rest of menu]
```

**If User Sends Any Other Text While Processing:**
```
⏳ Still waiting for payment confirmation...

You can:
*0* = Go back to My Shop Menu (payment will update automatically)
*00* = Start over with new charge
*000* = Exit to main menu
```

---

## Backend Flow Architecture

### Transaction Lifecycle

#### Phase 1: STK Push Sent (CHARGE_CUSTOMER_NETWORK state)

**In `payment.charge.handler.ts` → `handleChargeCustomerNetwork():`**
```typescript
1. Validate shop & context data
2. Get payment account with Paystack subaccount ID
3. Get or create split code (1.5% platform commission)
4. Send STK push via Paystack /charge endpoint with:
   - email: stk-push-{shopId}@cogvana.co.ke
   - amount: in cents
   - mobile_money: { phone, provider: 'mpesa'|'airtel' }
   - split_code: routes to shop's subaccount
   - reference: SHOP_{shopId}_{timestamp}
   - metadata: { shopId, network, customerPhone, type: 'shop_charge' }

5. Save transaction to Firestore:
   - Collection: shops/{shopId}/transactions
   - Doc: {reference}
   - Data: {
       id: reference,
       shopId,
       amount,
       customerPhone,
       network,
       transactionId: reference,
       timestamp,
       status: 'pending',
       createdVia: 'whatsapp'
     }

6. Update session context with:
   - chargeReference: reference
   - chargeType: 'shop_charge'

7. Update state to CHARGE_CUSTOMER_PROCESSING
```

**Paystack Flow:**
```
Customer receives STK push prompt
   ↓
Customer enters PIN
   ↓
Paystack processes payment
   ↓
Paystack webhook sends charge.success or charge.failed
   ↓
Webhook handler updates Firestore transaction status
```

#### Phase 2: User Navigates Back (CHARGE_CUSTOMER_PROCESSING state)

**In `payment.charge.handler.ts` → `handleChargeCustomerProcessing():`**
```typescript
User sends: 0

1. Extract context:
   - shopId
   - chargeReference
   - customerPhone
   - chargeAmount
   - language

2. Call startCustomerChargeListener() with:
   - shopId
   - chargeReference
   - userPhone (seller's phone)
   - customerPhone
   - chargeAmount
   - userLanguage

3. Update state to MY_SHOP_MENU

4. Return message confirming listener activation
```

#### Phase 3: Firestore Listener Activated

**In `payment.listener.service.ts` → `startCustomerChargeListener():`**

```typescript
// Listener watches this path:
db.collection('shops')
  .doc(shopId)
  .collection('transactions')
  .doc(reference)
  .onSnapshot(async (doc) => {

  const status = doc.data().status

  // On success
  if (status === 'success') {
    // Send success message to seller
    await sendWhatsAppMessage(
      userPhone,
      `✅ *Payment Received!*

       💰 Amount: KES ${chargeAmount}
       👤 Customer: ${customerPhone}

       The payment has been successfully processed.`
    )

    // Unsubscribe from updates
    unsubscribe()
    activeListeners.delete(listenerKey)
  }

  // On failed
  if (status === 'failed') {
    // Send failure message to seller
    await sendWhatsAppMessage(
      userPhone,
      `❌ *Payment Failed*

       💰 Amount: KES ${chargeAmount}
       👤 Customer: ${customerPhone}

       The payment was not processed. Please try again.`
    )

    // Unsubscribe
    unsubscribe()
    activeListeners.delete(listenerKey)
  }
})
```

**Key Points:**
- Listener is registered in a global `activeListeners` Map
- Prevents duplicate listeners for same transaction
- Listener runs in Firebase Cloud Functions context
- Uses Firebase Admin SDK (server-side, not client-side)
- Listens to Firestore in real-time via `onSnapshot()`
- Automatically unsubscribes when status changes to success/failed

#### Phase 4: Webhook Updates Transaction Status

**When Paystack webhook fires (external):**

```
Paystack sends POST to /webhook endpoint
   ↓
Webhook handler receives charge.success or charge.failed event
   ↓
Extracts reference: SHOP_{shopId}_{timestamp}
   ↓
Finds transaction in shops/{shopId}/transactions/{reference}
   ↓
Updates status field:
{
  status: 'success' | 'failed',
  webhookData: { ...paystack_response },
  updatedAt: timestamp
}
   ↓
Firestore listener (active) detects status change
   ↓
Listener callback executes:
   - Sends message to seller
   - Unsubscribes listener
```

---

## Code Structure

### Files Modified

#### 1. `src/handlers/payment.charge.handler.ts`

**New Exports:**
- `handleChargeCustomerAmount()` - Enhanced with navigation help
- `handleChargeCustomerPhone()` - Enhanced with navigation help
- `handleChargeCustomerNetwork()` - Enhanced with navigation help + listener setup
- `handleChargeCustomerProcessing()` - NEW: Handles CHARGE_CUSTOMER_PROCESSING state
- `getProcessingMessage()` - Helper for processing messages
- `getNavigationHelp()` - Helper: Returns navigation instructions in both languages

**Key Changes:**
```typescript
// Added navigation help to every step
return msg + getNavigationHelp(session.language);

// New handler for CHARGE_CUSTOMER_PROCESSING state
export async function handleChargeCustomerProcessing(
  phone: string,
  input: string,
  session: Session
): Promise<string>

// When user presses 0 (back), activate listener
startCustomerChargeListener(
  shopId,
  chargeReference,
  phone,           // seller's WhatsApp phone
  customerPhone,   // customer's phone (charged)
  chargeAmount,
  session.language
);
```

#### 2. `src/webhooks/whatsapp-webhook.ts`

**Changes:**
- Import `handleChargeCustomerProcessing`
- Replace old polling logic with direct handler call:

```typescript
case STATE.CHARGE_CUSTOMER_PROCESSING:
  logger.info('Routing to charge customer processing handler');
  response = await handleChargeCustomerProcessing(phone, text, session);
  break;
```

#### 3. `lib/services/payment.listener.service.ts` (Already exists)

**Usage in charge flow:**
```typescript
// Called from handleChargeCustomerProcessing when user navigates back
startCustomerChargeListener(
  shopId,        // shops to watch
  reference,     // transaction doc to monitor
  userPhone,     // where to send updates
  customerPhone, // for the message
  chargeAmount,  // for the message
  userLanguage   // en | sw
);
```

---

## Navigation Commands

All charge customer steps support these navigation commands:

| Command | Effect | Next State |
|---------|--------|-----------|
| `0` | Back to previous step | Previous STATE or current if at start |
| `00` | Start over | CHARGE_CUSTOMER_AMOUNT |
| `000` | Exit to main menu | LANGUAGE_SELECTION |

**Special Behavior at CHARGE_CUSTOMER_PROCESSING:**
- `0` = Go back to MY_SHOP_MENU + activate listener
- `00` = Go back to MY_SHOP_MENU (discard current charge)
- `000` = Exit to Language Selection
- Any other text = Show wait message with options

---

## State Machine

```
MY_SHOP_MENU (option 7)
    ↓
CHARGE_CUSTOMER_AMOUNT
    ↓
CHARGE_CUSTOMER_PHONE
    ↓
CHARGE_CUSTOMER_NETWORK
    ↓
[STK Push Sent]
    ↓
CHARGE_CUSTOMER_PROCESSING
    ├─→ User presses 0 (back) → MY_SHOP_MENU [listener active]
    ├─→ User presses 00 (restart) → MY_SHOP_MENU
    └─→ User presses 000 (exit) → LANGUAGE_SELECTION

[Listener watches transaction]
    ├─→ Status: success → Send message + return to MY_SHOP_MENU
    └─→ Status: failed → Send message + return to MY_SHOP_MENU
```

---

## Key Features

### ✅ Navigation at Every Step
- Users can go back/restart/exit at any point
- Clear instructions shown in both English and Swahili
- Validation on input with helpful error messages

### ✅ Automatic Payment Listening
- When user navigates back after STK push, listener is activated
- Listener runs in background (Firebase Cloud Functions context)
- No polling required - real-time Firestore updates
- Prevents duplicate listeners with global Map

### ✅ Real-Time Status Updates
- Listener watches `shops/{shopId}/transactions/{reference}`
- When Paystack webhook updates status → listener detects change
- Instant message sent to seller: "✅ Payment Received!" or "❌ Payment Failed"
- Automatic unsubscribe after status change

### ✅ Session Continuity
- After payment result, seller automatically back in MY_SHOP_MENU
- Same conversation thread (same WhatsApp session)
- Can continue with other operations immediately
- No need for seller to restart menu navigation

### ✅ Bidirectional Communication
- Seller can interact while waiting (press 0/00/000)
- Listener can send messages independently (via Firestore updates)
- Both work in same session seamlessly

---

## Error Handling

### Missing Payment Account
```
❌ Payment account not configured. Please contact support.
→ Returns to MY_SHOP_MENU
```

### Failed Split Code Generation
```
❌ Failed to prepare payment routing. Please try again.
→ Returns to MY_SHOP_MENU
```

### STK Push Failed
```
❌ Failed to send payment request: [error details]
→ Returns to MY_SHOP_MENU
```

### Missing Session Context
```
❌ Error processing payment. Returning to My Shop Menu.
→ Returns to MY_SHOP_MENU
```

---

## Testing Checklist

### Test Case 1: Complete Flow
- [ ] Start charge customer (option 7)
- [ ] Enter amount: 500
- [ ] Enter customer phone: 0712345678
- [ ] Select network: 1 (Safaricom)
- [ ] See STK push sent message
- [ ] Wait for customer payment in Paystack sandbox
- [ ] Verify seller receives success message
- [ ] Verify seller is back in MY_SHOP_MENU
- [ ] Verify seller can continue with other operations

### Test Case 2: Navigate Back After STK
- [ ] Complete steps 1-3 (STK push sent)
- [ ] Press 0 (back)
- [ ] See confirmation: "Payment listener activated"
- [ ] See MY_SHOP_MENU
- [ ] Check logs for listener registration
- [ ] Make payment in Paystack
- [ ] Verify success message comes automatically
- [ ] Verify seller is in MY_SHOP_MENU

### Test Case 3: Navigation Commands
- [ ] At CHARGE_CUSTOMER_AMOUNT: Press 00 → Start over
- [ ] At CHARGE_CUSTOMER_PHONE: Press 0 → Back to amount
- [ ] At CHARGE_CUSTOMER_NETWORK: Press 000 → Exit to language
- [ ] At CHARGE_CUSTOMER_PROCESSING: Press 00 → Discard charge

### Test Case 4: Error Handling
- [ ] Enter invalid amount (negative, too high)
- [ ] Enter invalid phone format
- [ ] Select invalid network
- [ ] Simulate missing payment account
- [ ] Verify appropriate error messages

### Test Case 5: Multilingual
- [ ] Run flow in English
- [ ] Run flow in Swahili
- [ ] Verify all messages properly translated
- [ ] Verify navigation help in correct language

---

## Technical Specifications

### Transaction Reference Format
```
SHOP_{shopId}_{timestamp}
Example: SHOP_8b7c9a2f_1731596234567
```

### Firestore Document Path
```
shops/{shopId}/transactions/{reference}
```

### Transaction Document Structure
```json
{
  "id": "SHOP_8b7c9a2f_1731596234567",
  "shopId": "8b7c9a2f",
  "amount": 500,
  "customerPhone": "+254712345678",
  "network": "safaricom",
  "transactionId": "SHOP_8b7c9a2f_1731596234567",
  "timestamp": 1731596234,
  "status": "pending | success | failed",
  "createdVia": "whatsapp",
  "webhookData": { /* Paystack response */ },
  "updatedAt": 1731596240
}
```

### Paystack STK Push Payload
```json
{
  "email": "stk-push-{shopId}@cogvana.co.ke",
  "amount": 50000,
  "currency": "KES",
  "mobile_money": {
    "phone": "+254712345678",
    "provider": "mpesa | airtel"
  },
  "reference": "SHOP_shopId_timestamp",
  "split_code": "SPL_xyz123",
  "metadata": {
    "shopId": "8b7c9a2f",
    "network": "safaricom",
    "customerPhone": "+254712345678",
    "type": "shop_charge"
  }
}
```

---

## Performance Considerations

### Listener Management
- `activeListeners` Map prevents duplicate listeners
- Listeners auto-unsubscribe on status change
- Memory leak prevention: Unsubscribe called in try/catch

### Firestore Reads
- One read per transaction document per status check
- Real-time listener triggered only on actual data change
- No polling overhead

### Message Sending
- Single WhatsApp message per transaction result
- Sent immediately when Firestore updates
- No retries on listener callback errors

---

## Future Enhancements

1. **Timeout Handling**
   - Auto-unsubscribe after 30 minutes if no status change
   - Send timeout message to seller

2. **Retry Logic**
   - Auto-retry failed STK push after user confirmation
   - Track retry count in transaction

3. **Payment Receipts**
   - Send PDF receipt to customer after success
   - Send receipt copy to seller

4. **Batch Charging**
   - Charge multiple customers in one flow
   - Aggregated payment updates

5. **Payment Schedule**
   - Schedule charges for future date/time
   - Recurring charges for subscriptions

---

## Support & Debugging

### Enable Debug Logging
Check Cloud Functions logs for:
```
"Starting customer charge listener"
"Payment listener registered"
"Listener already active"
"Transaction status update"
"✅ Customer charge payment confirmed"
"Listener unsubscribed after payment success"
```

### Common Issues

**Issue:** Listener never fires
- Check if transaction status is actually updated in Firestore
- Verify reference format matches what was saved
- Check Paystack webhook is sending updates
- Verify listener is registered (check logs)

**Issue:** Seller doesn't get message
- Verify seller phone number is correct
- Check WhatsApp service availability
- Review error logs for send failures
- Verify seller is not blocked

**Issue:** User stuck in CHARGE_CUSTOMER_PROCESSING
- Check for missing context data (shopId, chargeReference)
- Verify navigation commands work (0/00/000)
- Check for errors in listener setup

---

## Conclusion

The enhanced Charge Customer flow provides a complete, user-friendly payment experience with:
- Clear navigation at every step
- Automatic background payment listening
- Real-time seller notifications
- Seamless session continuity
- Multi-language support
- Comprehensive error handling

All implemented in a production-ready, scalable architecture using Firebase Firestore listeners and Paystack webhook integration.
