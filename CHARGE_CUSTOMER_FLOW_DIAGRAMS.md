# Charge Customer Flow - Visual Diagrams

## User Journey Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     MY SHOP MENU                             │
│  (Option 7: Charge Customer)                                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
        ┌────────────────────────┐
        │  CHARGE_CUSTOMER_AMOUNT  │
        │  Enter: Amount (KES)     │
        │  Nav: 0/00/000          │
        └────────┬─────────────────┘
                 │
                 ↓
        ┌────────────────────────┐
        │  CHARGE_CUSTOMER_PHONE  │
        │  Enter: Phone Number    │
        │  Nav: 0/00/000          │
        └────────┬─────────────────┘
                 │
                 ↓
        ┌────────────────────────┐
        │ CHARGE_CUSTOMER_NETWORK │
        │  Select: 1 or 2         │
        │  (Safaricom/Airtel)     │
        │  Nav: 0/00/000          │
        └────────┬─────────────────┘
                 │
                 ↓ [STK Push Sent]
                 │
        ┌────────────────────────┐
        │CHARGE_CUSTOMER_PROCESSING
        │  Message: STK Sent!     │
        │  Customer: Phone        │
        │  Amount: KES 500        │
        │  Nav: 0/00/000          │
        └────┬──────────────┬─────┘
             │              │
    User Presses 0      User Presses 00/000
    (Back to Menu)      (Cancel/Exit)
             │              │
             ↓              ↓
    ┌──────────────────┐   │
    │  MY SHOP MENU    │   │
    │ (Listener Active)│   │
    │                  │   │
    │ Seller can:      │   │
    │ • Record sales   │   │
    │ • Check summary  │   │
    │ • View stock     │   │
    │ • Do anything!   │   │
    └────────┬─────────┘   │
             │              │
    [In Background]        │
    Listener watches        │
    shops/{shopId}/txns/ref │
             │              │
      ┌──────┴───────┬──────┴──────┐
      ↓              ↓             ↓
  [Payment     [Cancel/Exit]  [Timeout]
   Succeeds]        │             │
      │              ↓             ↓
      │          ┌───────────┐   ┌───────────┐
      │          │Different  │   │Different  │
      │          │State      │   │State      │
      │          └───────────┘   └───────────┘
      │
      ↓ [Listener Fires]
   ┌────────────────┐
   │✅ Message Sent:│
   │ Payment        │
   │ Received!      │
   │                │
   │ Amount: 500    │
   │ Customer: Phone│
   └────────┬───────┘
            │
            ↓ [Listener Unsubscribes]
      ┌──────────────────┐
      │  MY SHOP MENU    │
      │(Automatic Return)│
      │                  │
      │ Ready for next   │
      │ operation!       │
      └──────────────────┘
```

---

## State Machine Diagram

```
                          ┌─────────────────────┐
                          │  START              │
                          │  MY_SHOP_MENU       │
                          │  (User selects 7)   │
                          └──────────┬──────────┘
                                     │
                                     ↓
    ┌─────────────────────────────────────────────────────────┐
    │ STATE: CHARGE_CUSTOMER_AMOUNT                           │
    ├─────────────────────────────────────────────────────────┤
    │ Purpose: Collect amount from seller                     │
    │ Input: Numeric amount (KES)                             │
    │ Validation: 1 <= amount <= 100,000                      │
    │ Navigation:                                             │
    │   0   → Back (no previous, shows error)                 │
    │   00  → CHARGE_CUSTOMER_AMOUNT (restart)               │
    │   000 → LANGUAGE_SELECTION (exit)                       │
    └──────────┬───────────────────────────────────────────────┘
               │ [Valid Amount]
               ↓
    ┌─────────────────────────────────────────────────────────┐
    │ STATE: CHARGE_CUSTOMER_PHONE                            │
    ├─────────────────────────────────────────────────────────┤
    │ Purpose: Collect customer's phone                       │
    │ Input: Phone number (various formats)                   │
    │ Validation: Valid phone format                          │
    │ Storage: session.context.customerPhone                  │
    │ Navigation:                                             │
    │   0   → CHARGE_CUSTOMER_AMOUNT                          │
    │   00  → CHARGE_CUSTOMER_AMOUNT (restart)               │
    │   000 → LANGUAGE_SELECTION (exit)                       │
    └──────────┬───────────────────────────────────────────────┘
               │ [Valid Phone]
               ↓
    ┌─────────────────────────────────────────────────────────┐
    │ STATE: CHARGE_CUSTOMER_NETWORK                          │
    ├─────────────────────────────────────────────────────────┤
    │ Purpose: Select network and send STK push               │
    │ Input: 1 (Safaricom) or 2 (Airtel)                      │
    │ Actions:                                                │
    │   1. Get payment account with subaccount ID             │
    │   2. Get/create split code (1.5% commission)            │
    │   3. Send STK push via Paystack                         │
    │   4. Save transaction to Firestore (pending)            │
    │   5. Update state to CHARGE_CUSTOMER_PROCESSING         │
    │ Navigation:                                             │
    │   0   → CHARGE_CUSTOMER_PHONE                           │
    │   00  → CHARGE_CUSTOMER_AMOUNT (restart)               │
    │   000 → LANGUAGE_SELECTION (exit)                       │
    └──────────┬───────────────────────────────────────────────┘
               │ [STK Push Sent]
               ↓
    ┌─────────────────────────────────────────────────────────┐
    │ STATE: CHARGE_CUSTOMER_PROCESSING                       │
    ├─────────────────────────────────────────────────────────┤
    │ Purpose: Wait for payment, handle user navigation       │
    │ Input: Navigation commands or any text                  │
    │ Actions:                                                │
    │   - User presses 0:                                     │
    │     → startCustomerChargeListener() [BACKGROUND]        │
    │     → state = MY_SHOP_MENU                              │
    │     → Message: "Listener activated..."                  │
    │                                                         │
    │   - User presses 00:                                    │
    │     → state = MY_SHOP_MENU                              │
    │     → Message: "Charge discarded"                       │
    │                                                         │
    │   - User presses 000:                                   │
    │     → state = LANGUAGE_SELECTION                        │
    │     → Message: "Exiting..."                             │
    │                                                         │
    │   - Any other input:                                    │
    │     → Message: "Still waiting... (options)"             │
    │     → state = CHARGE_CUSTOMER_PROCESSING (unchanged)    │
    │                                                         │
    │ Background:                                             │
    │   - Listener watches:                                   │
    │     shops/{shopId}/transactions/{reference}             │
    │   - When status changes (success/failed):               │
    │     → Send message to seller                            │
    │     → Listener unsubscribes                             │
    └─────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

```
┌──────────────────┐
│ SELLER (WhatsApp)│
└────────┬─────────┘
         │
    Message: 7
         │
         ↓
┌────────────────────────┐
│ WhatsApp Webhook       │
│ handleIncomingMessage()│
└────────┬───────────────┘
         │
         ↓
    ┌─────────────────┐
    │ Get Session     │
    │ from Firestore  │
    └────────┬────────┘
             │
             ↓
    ┌─────────────────────┐     ┌──────────────────┐
    │ Route to Handler    │────→│ State Machine    │
    │ based on State      │     │ Transitions      │
    └────────┬────────────┘     └──────────────────┘
             │
         AMOUNT ENTRY
         PHONE ENTRY
         NETWORK SELECTION
             │
             ↓
    ┌────────────────────────────┐
    │ handleChargeCustomerNetwork()
    └────────┬───────────────────┘
             │
    ┌────────┴────────────────────────┐
    │                                  │
    ↓                                  ↓
┌─────────────────────┐      ┌─────────────────────┐
│ Paystack Service    │      │ Firestore Database  │
│                     │      │                     │
│ STK Push Request:   │      │ Save Transaction:   │
│ • phone             │      │ • id (reference)    │
│ • amount            │      │ • shopId            │
│ • split_code        │      │ • amount            │
│ • provider (network)│      │ • customerPhone     │
│ • reference         │      │ • network           │
│ • metadata          │      │ • status: pending   │
└────────┬────────────┘      └──────────┬──────────┘
         │                              │
         │ [STK Sent]                   │ [Transaction Saved]
         │                              │
         ↓                              ↓
    Customer's Phone              Session Context Updated
    (Receives STK Prompt)          • chargeReference
                                   • chargeType
                                   • Stored in Firestore

                                   ↓
                        ┌──────────────────────────┐
                        │ User presses 0 (back)    │
                        └──────────┬───────────────┘
                                   │
                                   ↓
                        ┌──────────────────────────┐
                        │ startCustomerChargeListener()
                        │                          │
                        │ Set up real-time watch:  │
                        │ shops/{shopId}/txns/{ref}│
                        └──────────┬───────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │ Listener now in background  │
                    └──────────────┬──────────────┘
                                   │
                    [Seller continues work]
                    [In MY_SHOP_MENU]
                                   │
                    ┌──────────────┴────────────────────┐
                    │                                   │
                    ↓ [Customer enters PIN]             │
                    │                                   │
                Paystack processes payment              │
                    │                                   │
                    ↓                                   │
            Paystack Webhook Fires                      │
            (charge.success event)                      │
                    │                                   │
                    ↓                                   │
        ┌──────────────────────────────┐              │
        │ Update Firestore Transaction │              │
        │ • status: success             │              │
        │ • webhookData: {...}          │              │
        │ • updatedAt: timestamp        │              │
        └──────────────┬────────────────┘              │
                       │                               │
                       │ [Real-time update!]           │
                       │                               │
                       ↓                               │
        ┌──────────────────────────────┐              │
        │ Listener onSnapshot() fires   │              │
        │ (Status changed to success)   │              │
        └──────────────┬────────────────┘              │
                       │                               │
                       ↓                               │
        ┌──────────────────────────────┐              │
        │ Send WhatsApp Message:        │              │
        │ ✅ Payment Received!          │              │
        │ Amount: 500 KES               │              │
        │ Customer: +254712345678       │              │
        └──────────────┬────────────────┘              │
                       │                               │
                       ↓                               │
        ┌──────────────────────────────┐              │
        │ Listener Unsubscribes         │              │
        │ activeListeners.delete(key)   │              │
        └──────────────┬────────────────┘              │
                       │                               │
                       ↓                               │
    ┌──────────────────────────────────┐              │
    │ SELLER sees message              │              │
    │ in MY_SHOP_MENU                  │              │
    │ (Where they were before)          │              │
    │                                   │──────────────┘
    │ Can continue with next operation  │
    │ (Record sales, charge another, etc)
    └──────────────────────────────────┘
```

---

## Listener Lifecycle Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ LISTENER LIFECYCLE                                          │
└─────────────────────────────────────────────────────────────┘

TIME:    T0              T1              T2              T3
         │               │               │               │
         ↓               ↓               ↓               ↓

┌────────────────────────────────────────────────────────────┐
│ T0: STK Push Sent                                          │
├────────────────────────────────────────────────────────────┤
│ • Transaction saved: status = "pending"                    │
│ • Session context: chargeReference, chargeType            │
│ • Seller in CHARGE_CUSTOMER_PROCESSING state              │
└────────────────────────────────────────────────────────────┘

         ↓

┌────────────────────────────────────────────────────────────┐
│ T0+: User presses 0 (back)                                 │
├────────────────────────────────────────────────────────────┤
│ • handleChargeCustomerProcessing() detects "0" input      │
│ • Calls: startCustomerChargeListener()                    │
│   └─ shopId: extracted from session.context               │
│   └─ chargeReference: extracted from session.context      │
│   └─ userPhone: seller's WhatsApp number                 │
│   └─ customerPhone: customer's number (from charge)       │
│   └─ chargeAmount: amount charged (from charge)           │
│   └─ userLanguage: seller's language (en/sw)             │
│                                                           │
│ • Listener registration:                                  │
│   db.collection('shops')                                  │
│     .doc(shopId)                                          │
│     .collection('transactions')                           │
│     .doc(chargeReference)                                 │
│     .onSnapshot(async (doc) => { ... })                  │
│                                                           │
│ • Added to activeListeners Map:                          │
│   activeListeners.set(`${shopId}_${ref}`, unsubscribe)  │
│                                                           │
│ • State transition: CHARGE_CUSTOMER_PROCESSING            │
│                    ↓                                       │
│                    MY_SHOP_MENU                           │
│                                                           │
│ • Message sent: "Listener activated..."                   │
└────────────────────────────────────────────────────────────┘

         ↓

┌────────────────────────────────────────────────────────────┐
│ T1 to T2: Listener Waiting [IN BACKGROUND]                │
├────────────────────────────────────────────────────────────┤
│ • Listener registered: YES                                 │
│ • Monitoring: shops/{shopId}/transactions/{reference}      │
│ • Status: LISTENING (waiting for data changes)             │
│ • Seller: In MY_SHOP_MENU, doing other work               │
│ • Memory: Stored in activeListeners Map                    │
│                                                           │
│ What listener watches for:                                │
│   doc.data().status ===                                   │
│       'success' → Trigger success callback                │
│       'failed'  → Trigger failure callback                │
│       'pending' → No action (still waiting)               │
└────────────────────────────────────────────────────────────┘

         ↓

┌────────────────────────────────────────────────────────────┐
│ T2: Webhook Updates Firestore (Payment Succeeds)          │
├────────────────────────────────────────────────────────────┤
│ • Paystack webhook fires (charge.success event)           │
│ • Webhook handler finds transaction by reference          │
│ • Updates Firestore document:                             │
│   {                                                       │
│     status: 'success',                                    │
│     webhookData: { ... paystack response ... },           │
│     updatedAt: timestamp                                  │
│   }                                                       │
│                                                           │
│ • Firestore detects change:                               │
│   onSnapshot() callback FIRES (real-time!)                │
└────────────────────────────────────────────────────────────┘

         ↓

┌────────────────────────────────────────────────────────────┐
│ T2+: Listener Callback Executes                            │
├────────────────────────────────────────────────────────────┤
│ onSnapshot(async (doc) => {                               │
│   const status = doc.data().status // "success"           │
│                                                           │
│   if (status === 'success') {                             │
│     // 1. Prepare message                                 │
│     const message = `✅ *Payment Received!*\n...`         │
│                                                           │
│     // 2. Send to seller                                  │
│     await sendWhatsAppMessage(userPhone, message)         │
│                                                           │
│     // 3. Unsubscribe                                     │
│     unsubscribe()                                         │
│     activeListeners.delete(listenerKey)                   │
│     // STATUS: UNSUBSCRIBED                               │
│   }                                                       │
│ })                                                        │
└────────────────────────────────────────────────────────────┘

         ↓

┌────────────────────────────────────────────────────────────┐
│ T3: Listener Cleanup Complete                              │
├────────────────────────────────────────────────────────────┤
│ • Listener unsubscribed: YES                               │
│ • activeListeners: Entry deleted                           │
│ • Memory freed: YES                                        │
│ • Next message: Seller now in MY_SHOP_MENU                │
│ • Status: READY FOR NEXT OPERATION                        │
└────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────┐
│ KEY POINTS                                                  │
├─────────────────────────────────────────────────────────────┤
│ ✓ onSnapshot() = Real-time listener (not polling)          │
│ ✓ Fires only when data changes (efficient)                 │
│ ✓ Prevents duplicate listeners with Map                    │
│ ✓ Auto-unsubscribes on completion (memory safe)           │
│ ✓ Message sent independently (seller not waiting)          │
│ ✓ No user input needed after payment (fully automatic)      │
└─────────────────────────────────────────────────────────────┘
```

---

## Navigation Command Flow

```
┌──────────────────────────────────────────┐
│ User Input at ANY Step                   │
└─────────────────┬────────────────────────┘
                  │
                  ↓
         ┌────────────────────┐
         │ checkNavigationCommand()
         │ Checks if input is:
         │ • "0"   → type: 'back'
         │ • "00"  → type: 'restart'
         │ • "000" → type: 'exit'
         │ • Other → type: 'none'
         └────────┬───────────┘
                  │
      ┌───────────┼───────────┬──────────────┬──────────┐
      │           │           │              │          │
      ↓           ↓           ↓              ↓          ↓
    type:      type:      type:           type:      type:
    'back'    'restart'   'exit'          'none'     (invalid)
      │         │           │              │          │
      ↓         ↓           ↓              ↓          ↓
  ┌────────┐┌────────┐┌──────────┐┌──────────────┐┌────────┐
  │ Go to  ││  Reset ││  Exit to ││ Validate &   ││ Show  │
  │Previous││ to 1st ││ Language ││ Process      ││ Error │
  │ State  ││ State  ││Selection ││ Input       ││Message│
  └────────┘└────────┘└──────────┘└──────────────┘└────────┘


AT CHARGE_CUSTOMER_AMOUNT:
  0   → (no previous, show error)
  00  → CHARGE_CUSTOMER_AMOUNT (restart)
  000 → LANGUAGE_SELECTION
  else → Validate amount, continue

AT CHARGE_CUSTOMER_PHONE:
  0   → CHARGE_CUSTOMER_AMOUNT
  00  → CHARGE_CUSTOMER_AMOUNT (restart)
  000 → LANGUAGE_SELECTION
  else → Validate phone, continue

AT CHARGE_CUSTOMER_NETWORK:
  0   → CHARGE_CUSTOMER_PHONE
  00  → CHARGE_CUSTOMER_AMOUNT (restart)
  000 → LANGUAGE_SELECTION
  else → Send STK, continue

AT CHARGE_CUSTOMER_PROCESSING:
  0   → MY_SHOP_MENU + activate listener
  00  → MY_SHOP_MENU (discard charge)
  000 → LANGUAGE_SELECTION
  else → Show wait message
```

---

## Paystack Integration Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ PAYSTACK STK PUSH FLOW                                      │
└─────────────────────────────────────────────────────────────┘

SELLER INPUT:
  Amount: 500
  Phone: 0712345678
  Network: Safaricom
      │
      ↓
┌─────────────────────────────────────┐
│ handleChargeCustomerNetwork()        │
├─────────────────────────────────────┤
│ • Get payment account (with         │
│   Paystack subaccount ID)           │
│ • Get/create split code             │
│   (1.5% platform commission)        │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────────────────────────┐
│ Prepare STK Push Request                                │
├─────────────────────────────────────────────────────────┤
│ POST https://api.paystack.co/charge                     │
│                                                         │
│ {                                                       │
│   email: "stk-push-{shopId}@cogvana.co.ke",           │
│   amount: 50000,              // In cents               │
│   currency: "KES",                                      │
│   mobile_money: {                                       │
│     phone: "+254712345678",                            │
│     provider: "mpesa"         // or "airtel"            │
│   },                                                    │
│   reference: "SHOP_8b7c9a2f_1731596234567",           │
│   split_code: "SPL_xyz123",   // Routes to subaccount  │
│   metadata: {                                           │
│     shopId: "8b7c9a2f",                                │
│     network: "safaricom",                              │
│     customerPhone: "+254712345678",                     │
│     type: "shop_charge"                                 │
│   }                                                     │
│ }                                                       │
│                                                         │
│ Headers:                                                │
│   Authorization: Bearer {PAYSTACK_SECRET_KEY}          │
│   Content-Type: application/json                        │
└──────────────┬──────────────────────────────────────────┘
               │
               ↓ [Network Request]
               │
        ┌──────────────────┐
        │ Paystack Server  │
        │                  │
        │ Processes STK    │
        │ Push Request     │
        └──────────┬───────┘
                   │
                   ↓ [If Successful]
                   │
        ┌──────────────────────────────┐
        │ Response: 200 OK             │
        │ {                            │
        │   status: true,              │
        │   message: "Charge sent",    │
        │   data: {                    │
        │     display_text: "Enter PIN"│
        │   }                          │
        │ }                            │
        └──────────┬───────────────────┘
                   │
                   ↓
        ┌──────────────────────────────┐
        │ Save Transaction to Firestore│
        ├──────────────────────────────┤
        │ Collection:                  │
        │   shops/{shopId}/transactions│
        │ Document ID:                 │
        │   SHOP_8b7c9a2f_1731596234567
        │ Data:                        │
        │   {                          │
        │     id: reference,           │
        │     shopId,                  │
        │     amount: 500,             │
        │     customerPhone,           │
        │     network: "safaricom",    │
        │     status: "pending",       │
        │     timestamp: now,          │
        │     createdVia: "whatsapp"   │
        │   }                          │
        └──────────┬───────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        ↓ [To Customer]       ↓ [To Firestore]
   ┌─────────────┐       ┌──────────────┐
   │ Customer's  │       │ Listener     │
   │ Phone:      │       │ will watch   │
   │ STK Prompt  │       │ this doc     │
   │             │       │              │
   │ "Enter PIN" │       │ for status   │
   │ for amount  │       │ changes      │
   └────┬────────┘       └──────┬───────┘
        │                       │
        ↓ [Customer enters PIN] │
   ┌──────────────────┐         │
   │ Customer pays    │         │
   │ via their mobile │         │
   │ money provider   │         │
   └────┬─────────────┘         │
        │                       │
        ↓ [Payment confirmed]   │
   ┌──────────────────────────┐ │
   │ Paystack processes       │ │
   │ payment                  │ │
   │ • Deducts from customer  │ │
   │ • Adds to shop account   │ │
   │ • Applies split          │ │
   │   (98.5% to shop,        │ │
   │    1.5% platform fee)    │ │
   └────┬─────────────────────┘ │
        │                       │
        ↓ [Success/Failed]      │
   ┌──────────────────────────┐ │
   │ Paystack Webhook Fires   │ │
   │ POST to: {WEBHOOK_URL}   │ │
   │ Event: charge.success    │ │
   │ or charge.failed         │ │
   │ Payload:                 │ │
   │   reference: "pystack_..." │
   │   status: "success"      │ │
   │   amount: 50000          │ │
   │   customer: {...}        │ │
   └────┬─────────────────────┘ │
        │                       │
        ↓ [Network]            │
   ┌──────────────────────────┐ │
   │ Firebase Cloud Function  │ │
   │ Webhook Handler          │ │
   │ • Receives webhook       │ │
   │ • Finds transaction by   │ │
   │   reference              │ │
   │ • Updates Firestore:     │ │
   │   status: "success"      │ │
   └────┬─────────────────────┘ │
        │                       │
        │ [Updates doc]         │
        │                       │
        └───────────┬───────────┘
                    │
                    ↓ [Firestore Triggers]
             ┌──────────────┐
             │ Listener's   │
             │ onSnapshot() │
             │ Callback     │
             │              │
             │ Detects:     │
             │ status has   │
             │ changed to   │
             │ "success"    │
             └──────┬───────┘
                    │
                    ↓
             ┌──────────────────────────┐
             │ Send Message to Seller:  │
             │                          │
             │ ✅ Payment Received!     │
             │ 💰 Amount: KES 500       │
             │ 👤 Customer: +254...     │
             │                          │
             │ Delivered via WhatsApp   │
             └──────┬───────────────────┘
                    │
                    ↓
             ┌──────────────────────────┐
             │ Listener Unsubscribes    │
             │ Cleanup complete         │
             │ Memory freed             │
             └──────────────────────────┘
```

---

## Transaction Lifecycle

```
T = 0:    CREATED (STK Push Sent)
│
├─ Document created:
│  └─ Path: shops/{shopId}/transactions/{SHOP_shopId_timestamp}
│
├─ Initial data:
│  ├─ id: SHOP_shopId_timestamp
│  ├─ shopId: seller's shop ID
│  ├─ amount: 500
│  ├─ customerPhone: +254712345678
│  ├─ network: safaricom
│  ├─ status: "pending" ← INITIAL STATUS
│  ├─ timestamp: T0
│  ├─ createdVia: "whatsapp"
│  └─ (no webhookData yet)
│
T = T0 to T2:    PENDING (Waiting for payment)
│
├─ Listener activated: YES (watching this doc)
├─ Seller action: User presses 0 (back)
├─ Seller state: MY_SHOP_MENU (doing other work)
├─ Document status: unchanged ("pending")
├─ Listener action: Polling Firestore (real-time)
│
T = T2:    WEBHOOK UPDATES (Payment completes)
│
├─ Event: Paystack sends charge.success webhook
├─ Action: Webhook handler updates document:
│  ├─ status: "success" ← STATUS CHANGED
│  ├─ webhookData: { ...paystack_response... }
│  └─ updatedAt: T2
│
T = T2+:    LISTENER FIRES (Real-time detection)
│
├─ Listener onSnapshot() detects change
├─ Callback executes:
│  ├─ Reads status = "success"
│  ├─ Sends message to seller
│  ├─ Unsubscribes listener
│  └─ Deletes from activeListeners Map
│
T = T3:    COMPLETED (Transaction done)
│
├─ Listener status: UNSUBSCRIBED
├─ Document status: "success" (final)
├─ Seller notification: SENT
├─ Seller state: MY_SHOP_MENU (ready for next)
└─ Memory cleaned up: YES
```

---

## Error Handling Flowchart

```
┌─────────────────────────────┐
│ User Input at Any Step      │
└──────────────┬──────────────┘
               │
      ┌────────┴────────┐
      ↓                 ↓
   Valid?          Invalid?
      │                 │
      ↓                 ↓
   Continue       ┌──────────────┐
                  │ Show Error   │
                  │ Message:     │
                  │ "Invalid..." │
                  │              │
                  │ Show         │
                  │ Navigation   │
                  │ Help         │
                  └──────┬───────┘
                         │
                         ↓
                    Retry Input
                    (Same State)

SPECIFIC ERRORS:

Amount < 1 or > 100,000:
  → "Amount must be between 1-100,000 KES"
  → Stay in CHARGE_CUSTOMER_AMOUNT
  → Show navigation help

Invalid phone format:
  → "Invalid phone number. Please try again."
  → Stay in CHARGE_CUSTOMER_PHONE
  → Show navigation help

Invalid network (not 1 or 2):
  → "Invalid choice. Select 1 or 2."
  → Stay in CHARGE_CUSTOMER_NETWORK
  → Show navigation help

Payment account not configured:
  → "Payment account not configured. Contact support."
  → Go to MY_SHOP_MENU
  → Clear context

Failed to get split code:
  → "Failed to prepare payment routing. Try again."
  → Go to MY_SHOP_MENU
  → Clear context

STK push failed:
  → "Failed to send payment request: {error}"
  → Go to MY_SHOP_MENU
  → Clear context

Missing context:
  → "Error processing. Returning to menu."
  → Go to MY_SHOP_MENU
  → Clear context

All errors → USER BACK TO SAFE STATE
```

---

These diagrams provide a complete visual understanding of the Charge Customer flow, data flow, state transitions, and error handling!
