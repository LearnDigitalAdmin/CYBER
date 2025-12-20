# Charge Customer Flow - Quick Start Guide

## What Changed?

### Before
- After STK push sent, user had to wait passively
- No clear navigation instructions at each step
- Payment listener was NOT automatically activated
- Seller didn't automatically return to menu after payment

### After ✨
- **Clear navigation at every step** (0=Back, 00=Restart, 000=Exit)
- **Automatic listener activation** when user navigates back
- **Real-time payment updates** sent to seller automatically
- **Automatic return to My Shop Menu** after payment completes
- **Same session continuity** - all in one conversation

---

## User Flow (Step-by-Step)

### 1️⃣ Start Charging
```
User: Selects Option 7 from My Shop Menu

Bot shows:
*Charge Customer* 💳

Enter amount to charge:
(e.g., 500, 1000, 5000)

📱 *Navigation:*
*0* = Back to previous step
*00* = Start over
*000* = Exit to main menu
```

### 2️⃣ Enter Amount
```
User: 500

Bot shows:
✓ Amount: KES 500

Now enter customer phone number:
(e.g., 0712345678 or +254712345678)

📱 *Navigation:*
*0* = Back to previous step
*00* = Start over
*000* = Exit to main menu
```

### 3️⃣ Enter Customer Phone
```
User: 0712345678

Bot shows:
✓ Customer: +254712345678

Select payment network:

1️⃣ Safaricom M-Pesa
2️⃣ Airtel Money

📱 *Navigation:*
*0* = Back to previous step
*00* = Start over
*000* = Exit to main menu
```

### 4️⃣ Select Network & Send STK
```
User: 1

Bot shows:
✅ STK Push Sent!

📱 Customer: +254712345678
💰 Amount: KES 500
🌐 Network: Safaricom M-Pesa

⏳ Customer should see prompt to enter PIN.

Once payment is complete, you'll receive a confirmation message.

Transaction ID: SHOP_8b7c9a2f_1731596234567

👈 You can go back to continue other operations. Payment status will update automatically.

📱 *Navigation:*
*0* = Back to previous step
*00* = Start over
*000* = Exit to main menu
```

### 5️⃣ Seller Goes Back (Optional)
```
User: 0

[Listener is automatically activated in background]

Bot shows:
🏪 Back to My Shop Menu

💡 Payment listener activated. You'll receive updates automatically as the customer completes payment.

What would you like to do?

*My Shop Menu*

1. Quick Commands 🚀
2. Today's Summary 📊
3. View Stock 📦
4. Weekly Report 📈
5. Monthly Report 📉
6. Setup Payment Account 💳
7. Charge Customer 💰
8. Help ❓
9. Back to Main Menu
```

### 6️⃣ Seller Continues Operations
```
User: Can now:
- Record sales (option 1)
- Check today's summary (option 2)
- View stock (option 3)
- Charge another customer
- Do anything else...

Meanwhile, payment listener is watching in background for customer's payment
```

### 7️⃣ Payment Success (Automatic)
```
When customer completes payment in Paystack:

Bot sends:
✅ *Payment Received!*

💰 Amount: KES 500
👤 Customer: +254712345678

The payment has been successfully processed.
```

### 8️⃣ Back to Menu (Automatic)
```
Seller automatically sees My Shop Menu again:

🏪 Back to My Shop Menu

What would you like to do?

*My Shop Menu*

1. Quick Commands 🚀
2. Today's Summary 📊
... [and so on]
```

---

## Key Features

| Feature | Benefit |
|---------|---------|
| **Navigation at Each Step** | Users can easily go back, restart, or exit |
| **Clear Instructions** | Every step explains what to enter and how to navigate |
| **Automatic Listener** | No polling - payment status updates automatically |
| **Background Updates** | Seller can do other work while waiting for payment |
| **Real-Time Messages** | Instant notification when payment succeeds/fails |
| **Session Continuity** | Same WhatsApp conversation, automatic menu return |
| **Error Messages** | Clear guidance if something goes wrong |

---

## Navigation Commands (Anywhere in Flow)

| Command | What It Does |
|---------|-------------|
| `0` | Go back to previous step |
| `00` | Start over (go back to amount entry) |
| `000` | Exit to Language Selection |

**Special at CHARGE_CUSTOMER_PROCESSING:**
- `0` = Go back to My Shop Menu (keeps listener active!)
- `00` = Go back to My Shop Menu (discard this charge)
- `000` = Exit to Language Selection
- Any other message = Shows wait message with options

---

## What Happens Behind the Scenes

### When STK Push is Sent
1. System sends STK push to customer's phone via Paystack
2. System saves transaction to Firestore with status "pending"
3. System keeps seller's phone and payment details in memory

### When Seller Navigates Back
1. System detects "0" (back) command
2. System activates **payment listener** in background
3. Seller is returned to My Shop Menu
4. Listener stays active, watching Firestore for updates

### When Customer Makes Payment
1. Customer enters PIN on their phone
2. Paystack processes the payment
3. Paystack sends webhook to update Firestore
4. Firestore listener **detects the change immediately**
5. Listener sends success message to seller
6. Listener automatically stops watching

### On Payment Failure
1. Similar flow but status becomes "failed"
2. Seller gets failure message
3. Seller can try charging again

---

## Example Scenarios

### Scenario 1: Simple Charge
```
Seller: 7 (Charge Customer)
Seller: 500 (Amount)
Seller: 0712345678 (Phone)
Seller: 1 (Safaricom)
[STK sent]
Customer: Enters PIN → Payment successful
Bot: ✅ Payment Received!
Seller: Back in My Shop Menu
```

### Scenario 2: Charge + Other Operations
```
Seller: 7 (Charge Customer)
Seller: 1000 (Amount)
Seller: 0722222222 (Phone)
Seller: 2 (Airtel)
[STK sent]
Seller: 0 (Back)
[Listener activated]
Seller: 1 (Quick Commands)
Seller: sold maize flour 4kg 600 (Record sale)
[Meanwhile, customer makes payment...]
Bot: ✅ Payment Received! [Automatic]
Seller: Back in My Shop Menu [Automatic]
```

### Scenario 3: Navigation
```
Seller: 7 (Charge Customer)
Seller: 500 (Amount)
Seller: INVALID PHONE (Invalid)
Bot: ❌ Invalid phone. Please try again.
Seller: 0 (Back)
Seller: 800 (New amount - goes back to phone step)
Seller: 0 (Back again)
[Returns to amount entry]
Seller: 00 (Start over - same as above)
Seller: 000 (Exit to Language Selection)
```

---

## Error Messages & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| "Invalid amount" | Amount < 1 or > 100,000 | Enter valid amount |
| "Invalid phone" | Bad phone format | Use 0712345678 or +254712345678 |
| "Invalid choice" | Wrong network selection | Select 1 or 2 |
| "Payment account not configured" | Shop hasn't set up Paystack | Complete payment setup first |
| "Failed to send payment request" | Paystack error | Try again later |
| "Session error" | Missing data | Start from My Shop Menu again |

---

## Technical Summary

### States Used
- `CHARGE_CUSTOMER_AMOUNT` - Enter amount
- `CHARGE_CUSTOMER_PHONE` - Enter customer phone
- `CHARGE_CUSTOMER_NETWORK` - Select network & send STK
- `CHARGE_CUSTOMER_PROCESSING` - Wait for payment (listener active)

### Firestore Path Watched
```
shops/{shopId}/transactions/{SHOP_shopId_timestamp}
```

### What Listener Watches For
- Status changes from "pending" to "success" or "failed"
- Updates webhook data and timestamp

### Messages Sent
- STK push message to customer
- Status messages to seller (success/failed)
- Navigation and error messages throughout

---

## Testing with Sandbox

### Setup Paystack Sandbox
1. Go to https://paystack.com/docs/payments/mobile-money/
2. Use test phone: +234 801 000 0000
3. Use test PIN: 1234

### Test Flow
1. Customer enters test phone
2. Select test network
3. STK push sent
4. Simulate payment in Paystack dashboard
5. Verify seller gets notification
6. Verify seller is back in My Shop Menu

---

## Troubleshooting

### Payment Listener Not Firing?
- ✅ Verify transaction was saved to Firestore
- ✅ Check that reference format is SHOP_shopId_timestamp
- ✅ Confirm webhook is updating the status field
- ✅ Check Cloud Functions logs for listener registration

### Seller Not Getting Message?
- ✅ Verify seller's WhatsApp phone number is correct
- ✅ Check WhatsApp business account status
- ✅ Verify seller is not blocked
- ✅ Check error logs in Cloud Functions

### Seller Stuck in Processing State?
- ✅ Tell seller to press 0 (back) to return to menu
- ✅ Or press 00 to discard charge
- ✅ Or press 000 to exit

---

## Frequently Asked Questions

**Q: What if customer doesn't have money?**
A: Payment will fail, seller gets failure message, can try again.

**Q: Can seller charge multiple customers at once?**
A: No, one charge at a time. But seller can go back and start new charge.

**Q: What if seller loses connection?**
A: Session is saved in Firestore, will resume on reconnection.

**Q: Can seller see payment history?**
A: Not in this flow, but transactions are saved in Firestore for reports.

**Q: Does seller have to stay in WhatsApp?**
A: No! After pressing 0 (back), seller can leave. Message comes automatically when customer pays.

**Q: How long does listener stay active?**
A: Until payment succeeds/fails (usually instant to a few minutes).

**Q: What's the transaction reference for?**
A: Unique identifier for tracking payment in system and Paystack.

**Q: Does this work on bad internet?**
A: Yes, Firestore listeners work offline-first. They reconnect automatically.

---

## Best Practices

1. **Always verify customer's phone** before sending STK push
2. **Tell customer to be ready** to enter PIN within seconds
3. **Use clear instructions** when explaining the flow to customers
4. **Check payment account setup** before starting
5. **Keep transaction IDs** for reference and support
6. **Wait 2-3 minutes** before declaring payment failed
7. **Test in sandbox** before going live
8. **Monitor logs** for any listener issues

---

## Support & Help

If something goes wrong:
1. Check the troubleshooting section above
2. Review Cloud Functions logs
3. Verify Firestore transaction document
4. Check Paystack dashboard for webhook status
5. Contact support with transaction ID

---

## Summary

The new Charge Customer flow is:
- ✅ **Easy to use** - Clear instructions at every step
- ✅ **Flexible** - Navigate back/restart/exit anytime
- ✅ **Efficient** - No polling, real-time updates
- ✅ **Powerful** - Background listener, seamless integration
- ✅ **Reliable** - Error handling, timeout support
- ✅ **Scalable** - Works for any number of concurrent charges

Happy charging! 💰
