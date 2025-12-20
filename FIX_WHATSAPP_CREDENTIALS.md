# FIX: WhatsApp API Credentials Not Set

## Problem Found ❌

Your function is running and receiving messages, but **failing to send responses** because the WhatsApp API credentials are NOT SET.

### The Error
```
ERROR: Failed to send WhatsApp message
Status code 400 - Request failed with status code 400
```

This happens at line: `sendWhatsAppMessage()` in whatsapp.service.ts

### Why it's failing
The function is trying to call WhatsApp API but:
- `WHATSAPP_PHONE_NUMBER_ID` is empty or wrong
- `WHATSAPP_ACCESS_TOKEN` is empty or wrong

---

## Fix: Set Environment Variables via Firebase Secrets

### Step 1: Get your credentials from Meta

Go to: **Meta App Dashboard → Settings → Webhooks**

You need:
1. **Phone Number ID** - The ID of your phone number (looks like: `123456789012345`)
2. **Access Token** - Your WhatsApp API token (long string starting with `EAA...`)

**Where to find them:**
- Phone Number ID: Settings → Phone Numbers (copy the ID)
- Access Token: Settings → App Roles → Tokens (Generate or copy existing)

---

### Step 2: Set Secrets in Firebase

Run these commands with YOUR actual values (replace `YOUR_...`):

```bash
cd C:\Users\na\Desktop\Cyber

firebase functions:config:set whatsapp.phone_id="YOUR_PHONE_NUMBER_ID"
firebase functions:config:set whatsapp.access_token="YOUR_ACCESS_TOKEN"
firebase functions:config:set whatsapp.verify_token="YOUR_VERIFY_TOKEN"
```

Example:
```bash
firebase functions:config:set whatsapp.phone_id="123456789012345"
firebase functions:config:set whatsapp.access_token="EAABsbCS1iHgBOZCxxxxxxxxxxxxxxxxxxx"
firebase functions:config:set whatsapp.verify_token="abujubujuTOTO"
```

---

### Step 3: Redeploy the function

```bash
cd functions
npm run build
firebase deploy --only functions:whatsappWebhook
```

---

### Step 4: Test again

Send a message to your WhatsApp number and check the logs:

```bash
gcloud functions logs read whatsappWebhook --limit=10
```

You should now see:
```
INFO: Received message
INFO: WhatsApp message sent successfully
```

---

## Alternative: Set via Environment Variables

If Firebase secrets don't work, you can set environment variables directly in your code or at deploy time.

Create a `.env.local` file (in the functions folder):

```
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_ACCESS_TOKEN=EAABsbCS1iHgBOZCxxxxxxxxxxx
WHATSAPP_VERIFY_TOKEN=abujubujuTOTO
```

Then deploy with:

```bash
firebase deploy --only functions:whatsappWebhook
```

---

## How to Get These Values

### Phone Number ID:
1. Meta App Dashboard
2. WhatsApp → Settings → Phone Numbers
3. Click on your phone number
4. Copy the "Phone Number ID" (NOT the phone number itself)

Example: `123456789012345`

### Access Token:
1. Meta App Dashboard
2. Settings → Developers
3. Get Token or generate new one
4. It looks like: `EAABsbCS1iHgBOZCxxxxxxxxxxxxxxxxxxxxxY`

### Verify Token:
- You create this (any random string)
- Used in webhook verification
- Example: `abujubujuTOTO` (or generate a random one)

---

## Test Commands

After setting credentials and redeploying:

```bash
# Check logs
gcloud functions logs read whatsappWebhook --limit=20

# Send test message (curl)
curl -X POST "https://whatsappwebhook-pwbsdm2yxa-uc.a.run.app" \
  -H "Content-Type: application/json" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "254712345678",
            "text": { "body": "Hi" },
            "id": "test",
            "timestamp": "123"
          }]
        }
      }]
    }]
  }'

# You should see in logs:
# INFO: Received message
# INFO: Language selected
# INFO: WhatsApp message sent successfully
```

---

## Summary

1. Get Phone Number ID from Meta Dashboard
2. Get Access Token from Meta Dashboard
3. Run: `firebase functions:config:set whatsapp.phone_id="..."`
4. Run: `firebase functions:config:set whatsapp.access_token="..."`
5. Run: `firebase deploy --only functions:whatsappWebhook`
6. Test with curl or send real WhatsApp message
7. Check logs: `gcloud functions logs read whatsappWebhook`

Once credentials are set, the function will:
1. Receive your message ✓
2. Create a session ✓
3. Show language menu ✓
4. Work through the flow ✓

