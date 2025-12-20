# WhatsApp Backend - Deployment Checklist

## Pre-Deployment

### Environment Variables
- [ ] Copy `.env.example` to `.env`
- [ ] Get WhatsApp Phone Number ID from Meta App Dashboard
- [ ] Get WhatsApp Access Token from Meta App Dashboard
- [ ] Generate random verify token for webhook (32+ characters)
- [ ] Get Paystack Secret Key from Paystack dashboard
- [ ] Get Paystack Public Key from Paystack dashboard
- [ ] Verify all keys are correct (no typos)
- [ ] `.env` file is in `.gitignore` (NEVER commit secrets)

### Code Review
- [ ] All TypeScript compiles without errors (`npm run build`)
- [ ] No console.log statements (use logger instead)
- [ ] All error cases have error messages
- [ ] All user inputs are validated
- [ ] Session timeouts are handled
- [ ] All async operations have try-catch

### Testing
- [ ] Test language selection flow locally
- [ ] Test main menu navigation locally
- [ ] Test input validation (invalid ID, phone, amount)
- [ ] Test session persistence across messages
- [ ] Check logs for errors or warnings
- [ ] Verify timestamp handling is correct

### Firebase Setup
- [ ] Firebase project created
- [ ] Firestore database enabled
- [ ] Cloud Functions enabled
- [ ] Service account configured
- [ ] Authentication enabled (for future Firebase auth)
- [ ] Collections prepared (or auto-created on first write):
  - [ ] `whatsapp_sessions`
  - [ ] `shops`
  - [ ] `shops/{shopId}/transactions`

### Security Checklist
- [ ] All API keys are environment variables
- [ ] `.env` is in `.gitignore`
- [ ] No secrets in code comments
- [ ] Input validation is strict
- [ ] Session tokens are random
- [ ] Rate limiting is considered (for production)
- [ ] Logging doesn't include sensitive data

## Deployment Steps

### 1. Build & Test
```bash
cd functions
npm run build
# Verify no errors and lib/ folder is created
```

### 2. Deploy to Firebase
```bash
# Option A: Using Firebase CLI
firebase deploy --only functions

# Option B: Deploy specific function
firebase deploy --only functions:whatsappWebhook
```

### 3. Get Function URL
```bash
firebase functions:describe whatsappWebhook
# Copy the trigger URL, it will look like:
# https://us-central1-your-project.cloudfunctions.net/whatsappWebhook
```

### 4. Configure WhatsApp Webhook

In Meta App Dashboard:
1. Go to your App → Messaging → Configuration
2. Click "Edit" next to Webhooks
3. Set **Callback URL**: `https://us-central1-your-project.cloudfunctions.net/whatsappWebhook`
4. Set **Verify Token**: `YOUR_WHATSAPP_VERIFY_TOKEN` (from .env)
5. Click "Verify and Save"
6. Meta will send GET request to verify ownership

### 5. Subscribe to Webhooks

Still in Meta App Dashboard:
1. In the same Configuration page, find "Webhook fields"
2. Click "Subscribe to more fields"
3. Select:
   - [ ] `messages` (required)
   - [ ] `message_status` (optional, for delivery confirmations)
4. Save

### 6. Test Webhook
```bash
# Verify webhook is accessible
curl -X GET "https://whatsappwebhook-pwbsdm2yxa-uc.a.run.app?hub.mode=subscribe&hub.verify_token=abujubujuTOTO&hub.challenge=test_challenge"

# Should return: test_challenge
```

### 7. Send Test Message
1. In your Meta App Dashboard → Settings, find your phone number
2. Use Telegram, WhatsApp, or any WhatsApp client to send a message to that number
3. Check Cloud Functions logs: `firebase functions:log`
4. Should see "Received message" log entry

### 8. Verify End-to-End Flow
- [ ] User sends message
- [ ] Bot receives message
- [ ] Bot responds with language menu
- [ ] User selects language
- [ ] Bot shows main menu
- [ ] No errors in function logs

## Post-Deployment

### Monitoring
- [ ] Set up Firebase Cloud Functions monitoring
- [ ] Monitor execution time (should be < 5 seconds)
- [ ] Monitor memory usage (should be < 256MB)
- [ ] Set up alerts for errors
- [ ] Monitor WhatsApp API quota usage

### Logging
- [ ] Check logs for errors: `firebase functions:log --limit 100`
- [ ] Review first 24 hours of logs
- [ ] Look for any validation errors
- [ ] Check for API failures

### Performance
- [ ] Measure cold start time
- [ ] Monitor message delivery latency
- [ ] Check database query times
- [ ] Optimize slow queries if needed

### User Testing
- [ ] Send messages from multiple numbers
- [ ] Test all menu options
- [ ] Verify responses are in correct language
- [ ] Test edge cases (invalid inputs, timeouts)
- [ ] Get feedback from users

## Scaling Considerations

### Rate Limiting
```typescript
// Implement per-phone rate limiting:
// - Max 1 message per second
// - Max 100 messages per hour
// - Max 1000 messages per day
```

### Database Optimization
- [ ] Create Firestore indexes for:
  - `whatsapp_sessions` compound queries
  - `shops` by `nationalId`
  - `shops/{shopId}/transactions` by date range
- [ ] Monitor Firestore costs
- [ ] Consider caching frequently accessed data

### Function Optimization
- [ ] Increase memory if cold start is slow
- [ ] Consider function warmup if needed
- [ ] Cache external API responses
- [ ] Batch database writes

## Rollback Plan

If something goes wrong:

```bash
# Disable function (prevent new requests)
firebase functions:delete whatsappWebhook --region us-central1

# Or deploy previous version
git checkout previous-commit
firebase deploy --only functions

# Check logs for issues
firebase functions:log --limit 50 --follow
```

## Troubleshooting

### Webhook not receiving messages
- [ ] Verify callback URL is correct
- [ ] Check verify token matches
- [ ] Ensure webhook is subscribed to `messages` field
- [ ] Check CloudFunctions logs for errors
- [ ] Test webhook with curl

### Messages not being sent back
- [ ] Verify WhatsApp access token is correct
- [ ] Check phone number is formatted correctly
- [ ] Verify recipient has business account
- [ ] Check Paystack/WhatsApp API status
- [ ] Review function logs

### Firestore errors
- [ ] Verify collections exist
- [ ] Check security rules allow reads/writes
- [ ] Verify indexes are created
- [ ] Check quota/billing is active

### Session issues
- [ ] Verify sessions are being saved to Firestore
- [ ] Check session timeout (30 minutes)
- [ ] Verify context data is persisting
- [ ] Clear old sessions manually if needed

## Ongoing Maintenance

### Daily
- [ ] Check error logs
- [ ] Monitor function execution time
- [ ] Verify messages are being delivered

### Weekly
- [ ] Review Firestore usage and costs
- [ ] Check WhatsApp API metrics
- [ ] Review user feedback
- [ ] Monitor error spikes

### Monthly
- [ ] Analyze user statistics
- [ ] Review performance metrics
- [ ] Plan feature improvements
- [ ] Update documentation

### Security
- [ ] Rotate API keys quarterly
- [ ] Review access logs
- [ ] Update dependencies
- [ ] Conduct security audit

## Rollback Procedure

```bash
# If current deployment has critical issues:

# 1. Disable the function
firebase functions:delete whatsappWebhook --region us-central1

# 2. Update Meta webhook settings to different URL (or remove)
# Do this manually in Meta App Dashboard

# 3. Deploy previous stable version
git checkout stable-tag
firebase deploy --only functions

# 4. Update Meta webhook settings back to new URL
# Do this manually in Meta App Dashboard

# 5. Test thoroughly
# Send test messages and verify responses

# 6. Monitor logs closely
firebase functions:log --limit 100 --follow
```

## Emergency Contacts

- **Meta Support**: https://developers.facebook.com/support
- **Firebase Support**: https://firebase.google.com/support
- **Paystack Support**: support@paystack.com
- **Internal Team**: your-team-slack or email

## Sign-Off

- [ ] Deployment approved by tech lead
- [ ] User acceptance testing passed
- [ ] Documentation updated
- [ ] Team is aware of deployment
- [ ] Monitoring is set up
- [ ] Runbooks are prepared

**Deployment Date**: _______________
**Deployed By**: _______________
**Verified By**: _______________

---

**Emergency Hotline:** +254791286165
**Support Email:** info@cogvana.co.ke
