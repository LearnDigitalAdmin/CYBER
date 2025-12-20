# WEBHOOK DEPLOYMENT - QUICK GUIDE

## TL;DR

1. Copy `webhook.copy.ts` from this project
2. Paste into your **other React project** → `functions/src/index.ts`
3. Find the Paystack webhook function and replace it
4. Deploy: `firebase deploy --only functions`
5. Done! Your webhook now has all 3 critical features

---

## Step-by-Step Instructions

### For Your Other React Project:

#### Step 1: Locate the webhook function in `functions/src/index.ts`

Find this section:
```typescript
export const paystackCallback = onRequest({
  // ... config
}, async (req, res) => {
  // old webhook code
});
```

OR search for the exports section:
```bash
grep -n "exports.paystackCallback\|export.*paystack" functions/src/index.ts
```

#### Step 2: Replace with Updated Code

Open `webhook.copy.ts` from **this** project and:

1. Copy the entire content
2. Replace the old Paystack webhook function with it
3. Ensure imports at top of index.ts include:
   ```typescript
   import * as admin from 'firebase-admin';
   import * as crypto from 'crypto';
   ```

#### Step 3: Save and Deploy

```bash
cd functions
npm run build          # Verify no TypeScript errors
firebase deploy --only functions
```

#### Step 4: Verify Deployment

Check Cloud Function logs:
```bash
firebase functions:log --only paystackCallback
```

Look for these logs:
```
✅ Signature verified - processing webhook
Step 2: Generating report after payment
Step 3: Sending WhatsApp message with report link
Step 4: Resetting user session state
✅ REPORT CHARGE COMPLETE
```

---

## What Each Step Does in the Webhook

### Step 1: Validate Payment ✅
- Checks HMAC-SHA512 signature
- Rejects invalid signatures with HTTP 400
- Prevents fake webhooks

### Step 2: Generate Report ✅
- Calls `handleGenerateReport()`
- Creates PDF report
- Returns download URL
- **This is what you asked for** 🎯

### Step 3: Send Message ✅
- Sends WhatsApp message to user
- Includes download link
- Formatted with emojis and report details
- **This is what you asked for** 🎯

### Step 4: Reset Session ✅
- Calls `updateSessionState()`
- Sets state to `MY_SHOP_MENU`
- User automatically returns to main menu
- **This is what you asked for** 🎯

---

## Expected Webhook Flow After Deployment

```
User pays (M-Pesa) → Paystack processes → Paystack webhook fires
  ↓
Your webhook receives charge.success
  ↓
[Step 1] Validate signature → Reject if invalid
  ↓
[Step 2] Generate report → Get download URL
  ↓
[Step 3] Send WhatsApp → "Your report ready: [link]"
  ↓
[Step 4] Reset session → Back to MY_SHOP_MENU
  ↓
User sees report download link in WhatsApp
```

---

## Files in This Project (For Reference)

| File | Purpose |
|------|---------|
| `webhook.copy.ts` | **Main file to copy** - Updated with all 3 features |
| `functions/src/webhooks/paystack-callback.ts` | Same content, actual webhook in this project |
| `WEBHOOK_CRITICAL_UPDATES_IMPLEMENTED.md` | Detailed explanation of all changes |
| This file | Quick deployment guide |

---

## Troubleshooting

### Issue: Webhook not triggering
- Check Paystack webhook URL in dashboard
- Verify URL is: `https://region-projectid.cloudfunctions.net/paystackCallback`
- Test with Paystack test mode

### Issue: Signature validation fails
- Ensure `PAYSTACK_SECRET_KEY` is set in Firebase Secrets
- Check secret matches Paystack dashboard
- Set via: `firebase functions:secrets:set PAYSTACK_SECRET_KEY`

### Issue: Report not generating
- Check if `handleGenerateReport()` exists in your project
- Check logs for report generation errors
- Verify Firestore permissions allow report creation

### Issue: WhatsApp message not sending
- Check if `sendWhatsAppMessage()` exists
- Verify WhatsApp service is initialized
- Check WhatsApp access token in secrets

### Issue: Session not resetting
- Check if `updateSessionState()` exists
- Verify `STATE.MY_SHOP_MENU` is defined
- Check session service permissions

---

## Key Differences from Old Webhook

| Feature | Old | New |
|---------|-----|-----|
| Signature validation | ❌ Missing | ✅ HMAC-SHA512 |
| Report generation | ❌ Manual | ✅ Automatic |
| Download link delivery | ❌ Not sent | ✅ WhatsApp message |
| Session reset | ❌ Manual | ✅ Automatic |
| Error handling | ⚠️ Basic | ✅ Comprehensive |

---

## Security Checklist

After deployment, verify:

- [ ] PAYSTACK_SECRET_KEY is set in Firebase Secrets
- [ ] Signature validation rejects invalid webhooks (HTTP 400)
- [ ] Logs show "✅ Signature verified"
- [ ] No fake webhooks process (check logs for rejections)
- [ ] Payment amounts match Firestore records
- [ ] Download URLs expire after reasonable time

---

## Support

If you encounter issues:

1. Check Cloud Function logs: `firebase functions:log`
2. Look for error messages in webhook processing
3. Verify all required services exist:
   - `handleGenerateReport()` in report.handler
   - `sendWhatsAppMessage()` in whatsapp.service
   - `updateSessionState()` in session.service
4. Check Firestore permissions allow updates

---

## Confirmation Checklist

After successful deployment, you should have:

- ✅ Signature verification preventing false successes
- ✅ Automatic report generation after payment
- ✅ WhatsApp message with download link
- ✅ Automatic session reset to MY_SHOP_MENU
- ✅ Comprehensive error handling
- ✅ Full audit trail in Firestore

All three of your original questions are now answered with working code! 🎉
