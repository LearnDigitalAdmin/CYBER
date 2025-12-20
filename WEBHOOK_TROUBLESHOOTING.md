# WhatsApp Webhook Troubleshooting - NO LOGS ISSUE

## Problem: Sending message but getting NO logs

This usually means one of these:

### 1. **Webhook URL is WRONG or not registered in Meta**

Check your Meta App Dashboard:
- Settings → Webhooks
- Is there a callback URL set?
- Does it match your Cloud Function URL exactly?

Your Cloud Function URL should be something like:
```
https://us-central1-plot-9fd6e.cloudfunctions.net/whatsappWebhook
```

OR

```
https://whatsappwebhook-pwbsdm2yxa-uc.a.run.app
```

**ACTION:** Verify the exact URL in Meta matches your deployed function URL

---

### 2. **Webhook Verification Failed**

Meta needs to verify your webhook BEFORE it sends messages.

Test manually:
```bash
curl -X GET "https://YOUR_FUNCTION_URL?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test_challenge"
```

Expected response: `test_challenge`

If you get an error, the webhook verification handler is broken.

**ACTION:**
1. Check WHATSAPP_VERIFY_TOKEN environment variable
2. Make sure it's set correctly in Firebase

---

### 3. **Messages Not Subscribed**

Even if webhook is verified, Meta won't send messages if you didn't subscribe to the `messages` field.

**ACTION:**
In Meta App Dashboard:
1. Go Settings → Webhooks
2. Under "Webhook fields" or "Subscribe to more fields"
3. Make sure ✅ `messages` is selected
4. Save changes

Without this, Meta verifies your webhook but NEVER sends messages to it.

---

### 4. **Phone Number Not Configured**

Did you actually add your phone number to the WhatsApp Business Account?

**ACTION:**
1. Go to Meta App Dashboard
2. WhatsApp → Settings → Phone Numbers
3. Add your test phone number
4. Verify you have access (usually via code)

---

### 5. **Check Cloud Function Logs Directly**

Since Firebase CLI log command is having issues, check in Google Cloud Console:

1. Go to: https://console.cloud.google.com
2. Select your project
3. Cloud Functions
4. Find `whatsappWebhook`
5. Click on it
6. Go to "Logs" tab
7. Look for recent entries

---

### 6. **Test Webhook Directly**

Send a test request to your webhook:

```bash
# Test GET (verification)
curl -X GET "https://YOUR_FUNCTION_URL?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=TEST"

# Test POST (simulate message)
curl -X POST https://YOUR_FUNCTION_URL \
  -H "Content-Type: application/json" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "254712345678",
            "id": "wamid.test",
            "timestamp": "1234567890",
            "type": "text",
            "text": {
              "body": "Hello"
            }
          }]
        }
      }]
    }]
  }'
```

---

## Checklist

- [ ] Cloud Function URL is correct
- [ ] Webhook URL is registered in Meta Dashboard
- [ ] Verify token matches
- [ ] Webhook verification test passes
- [ ] "messages" field is subscribed in Meta
- [ ] Phone number is added to WhatsApp Business Account
- [ ] Environment variables are set (WHATSAPP_VERIFY_TOKEN, WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID)

---

## Key URLs

**Meta App Dashboard:** https://developers.facebook.com/apps
**Google Cloud Console:** https://console.cloud.google.com
**Firebase Console:** https://console.firebase.google.com

---

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| 403 Forbidden on webhook verify | Verify token is wrong |
| 404 on webhook URL | URL doesn't exist, deploy failed |
| Webhook verifies but no messages | "messages" field not subscribed |
| All logs say "No messages in payload" | Meta sending status updates, not messages |
| "INVALID_PARAMETER" in Meta | Phone number ID is wrong |

---

## Get Your Exact Function URL

```bash
cd functions
firebase deploy --only functions:whatsappWebhook 2>&1 | grep "https://"
```

This will show the exact deployed URL.

---

## Next Steps

1. **Verify webhook** using the curl command above
2. **Check Cloud Console logs** for any errors
3. **Confirm Meta configuration** matches your function
4. **Test with curl** to simulate a message
5. **Send real message** once everything is verified

