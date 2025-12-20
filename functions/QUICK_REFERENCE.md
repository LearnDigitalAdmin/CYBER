# WhatsApp Backend - Quick Reference Guide

## Folder Navigation

```
functions/src/
├── config/        → API credentials & initialization
├── constants/     → Menus, messages, states (bilingual)
├── handlers/      → Feature logic (route user interactions)
├── services/      → Database & API operations
├── types/         → TypeScript interfaces
├── utils/         → Helpers (validate, format, parse, log)
└── webhooks/      → WhatsApp entry points
```

## Adding a New Feature

### 1. Create States (if needed)
```typescript
// constants/states.ts
export enum STATE {
  MY_FEATURE = 'MY_FEATURE',
  MY_FEATURE_STEP_2 = 'MY_FEATURE_STEP_2',
}
```

### 2. Add Menu Text
```typescript
// constants/menus.ts
export const MENUS = {
  MY_FEATURE_MENU: {
    en: 'Select option:\n1. Option A\n2. Option B',
    sw: 'Chagua chaguo:\n1. Chaguo A\n2. Chaguo B',
  }
}
```

### 3. Add Error Messages
```typescript
// constants/messages.ts
export const MESSAGES = {
  MY_ERROR: {
    en: 'Something went wrong',
    sw: 'Kilicho kibaya',
  }
}
```

### 4. Create Handler
```typescript
// handlers/myfeature.handler.ts
export async function handleMyFeature(
  phone: string,
  input: string,
  session: Session
): Promise<string> {
  try {
    // Validate input
    if (!isValid(input)) {
      return getMessage('MY_ERROR', session.language);
    }

    // Update session
    await updateSessionState(phone, STATE.MY_FEATURE_STEP_2, {
      myData: processInput(input),
    });

    // Return response
    return 'Next step message';
  } catch (error) {
    logger.error('Feature error', error);
    return getMessage('SYSTEM_ERROR', session.language);
  }
}
```

### 5. Route in Menu Handler
```typescript
// handlers/menu.handler.ts
case 9: // My Feature
  await updateSessionState(phone, STATE.MY_FEATURE, {});
  return 'Let\'s start my feature!';
```

### 6. Add Case in Main Webhook
```typescript
// webhooks/whatsapp-webhook.ts
case STATE.MY_FEATURE:
  response = await handleMyFeature(phone, text, session);
  break;
```

## Common Patterns

### Input Validation
```typescript
import { validateNationalId, validatePhoneNumber, validateAmount } from '../utils/validator';

// National ID
if (!validateNationalId(input)) {
  return getMessage('INVALID_ID', language);
}

// Phone (Kenyan)
const { valid, formatted } = validatePhoneNumber(input);
if (!valid) return getMessage('INVALID_PHONE', language);

// Amount (10-1M KES)
const { valid, amount } = validateAmount(input);
if (!valid) return getMessage('INVALID_AMOUNT', language);
```

### Database Lookups
```typescript
import { getShopByNationalId } from '../services/shop.service';
import { getDailySummary } from '../services/transaction.service';

// Get shop
const shop = await getShopByNationalId(nationalId);
if (!shop) {
  return getMessage('SHOP_NOT_FOUND', language);
}

// Get summary
const summary = await getDailySummary(shopId);
```

### Data Formatting
```typescript
import { formatCurrency, formatDate, formatBusinessType } from '../utils/formatter';

const total = formatCurrency(1500); // "Ksh 1,500"
const date = formatDate(timestamp);  // "5 November 2024"
const type = formatBusinessType('1', 'en'); // "Retail Shop"
```

### Session Management
```typescript
import {
  updateSessionState,
  updateSessionContext,
  clearSessionContext,
  resetSessionToMainMenu,
} from '../services/session.service';

// Change state
await updateSessionState(phone, STATE.NEW_STATE, {});

// Update context
await updateSessionContext(phone, { key: 'value' });

// Clear and go back
await resetSessionToMainMenu(phone);
```

### Logging
```typescript
import { logger } from '../utils/logger';

logger.setContext({ phone, userId: '123' });
logger.info('Action completed', { amount: 500 });
logger.error('Failed to process', error);
logger.debug('Debug info', { data });
```

## Validation Rules Quick Reference

| Type | Format | Example | Helper |
|------|--------|---------|--------|
| National ID | 6-8 digits | 12345678 | `validateNationalId()` |
| Phone | 07XXXXXXXX or 01XXXXXXXX | 0712345678 | `validatePhoneNumber()` |
| Amount | 10-1,000,000 | 500 | `validateAmount()` |
| Menu | 1-8 (or range) | 3 | `validateMenuSelection()` |
| Text | 2-100 chars | "John Doe" | `validateTextInput()` |
| Confirmation | PAY/NDIYO/YES | pay | `isConfirmation()` |

## Testing Flows

### Test Language Selection
1. User sends any message
2. Bot shows language menu
3. Reply "1" for English
4. Should show main menu

### Test Add Shop
1. Reply "3" from main menu
2. Enter owner name → "John Doe"
3. Enter shop name → "John's Shop"
4. Enter ID → "12345678"
5. Enter phone → "0712345678"
6. Select business type → "1"
7. Should see success message

### Test Record Sale
1. Reply "4" to go to My Shop
2. Enter National ID (must exist)
3. Select "1" for Record Sale
4. Enter amount → "500"
5. Select payment method → "1"
6. Confirm description or SKIP
7. Should see transaction recorded

### Test Pay Bill
1. Reply "5" from main menu
2. Select "1" for Pay My Bill
3. Enter command → "pay500frm0712345678"
4. Should show confirmation
5. Reply "PAY" to confirm

## Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| Invalid National ID | Format wrong | Use 6-8 digits only |
| Invalid phone | Format wrong | Use 07XXXXXXXX format |
| Invalid amount | Out of range | Use 10-1,000,000 |
| Shop not found | ID doesn't exist | Check national ID |
| Session expired | Timeout (30 min) | Send any message to start new |
| System error | Backend error | Check logs, try again |

## Debugging Tips

### Check Session State
```typescript
const session = await getSession(phone);
console.log('Current state:', session?.currentState);
console.log('Context:', session?.context);
```

### View Logs
```bash
firebase functions:log --limit 50
# Or in Firebase Console → Cloud Functions → Logs
```

### Test Locally
```bash
npm run serve
# Then use ngrok to expose: ngrok http 5001
# Update webhook URL in Meta dashboard to ngrok URL
```

### Simulate Message
```typescript
// In code, call directly instead of via webhook
await handleIncomingMessage({
  body: {
    entry: [{
      changes: [{
        value: {
          messages: [{
            from: '0712345678',
            text: { body: 'test' },
            id: 'wamid.123',
            type: 'text',
            timestamp: Math.floor(Date.now() / 1000).toString(),
          }],
        },
      }],
    }],
  }
}, mockResponse);
```

## Environment Variables Checklist

- [ ] WHATSAPP_PHONE_NUMBER_ID
- [ ] WHATSAPP_ACCESS_TOKEN
- [ ] WHATSAPP_VERIFY_TOKEN
- [ ] PAYSTACK_SECRET_KEY
- [ ] PAYSTACK_PUBLIC_KEY
- [ ] DEBUG (optional, set to 'true' to enable debug logs)

## File Change Checklist

When modifying code:

1. **Adding new state?**
   - [ ] Add to `constants/states.ts`
   - [ ] Add case in `webhooks/whatsapp-webhook.ts`

2. **Adding new handler?**
   - [ ] Create `handlers/feature.handler.ts`
   - [ ] Import and use in webhook
   - [ ] Add test cases

3. **Adding new message?**
   - [ ] Add to `constants/messages.ts` (EN + SW)
   - [ ] Use `getMessage()` helper function

4. **Adding new menu?**
   - [ ] Add to `constants/menus.ts` (EN + SW)
   - [ ] Use `getMenu()` helper function

5. **Changing database?**
   - [ ] Update type in `types/*.ts`
   - [ ] Update service method
   - [ ] Update Firestore indexes if needed

## Performance Tips

1. **Minimize Firestore reads:**
   - Cache shop data in session context
   - Batch reads when possible
   - Use indexes for common queries

2. **Optimize message delivery:**
   - Send related messages together (with delay)
   - Use short, formatted messages
   - Avoid large blobs of text

3. **Handle timeouts gracefully:**
   - Set 10-second timeout for external APIs
   - Return user-friendly error messages
   - Log errors for debugging

4. **Clean up sessions:**
   - Auto-delete sessions after 30 minutes
   - Clear context when moving to new states
   - Don't store large objects in context

## Code Style Guidelines

```typescript
// Use async/await, not .then()
const result = await getShop(id);

// Always validate input before processing
if (!validate(input)) return error;

// Use constants for strings
return getMessage('KEY', language);

// Log significant operations
logger.info('Action', { details });

// Handle errors explicitly
try {
  // Do something
} catch (error) {
  logger.error('Failed', error);
  return getMessage('SYSTEM_ERROR', language);
}

// Use TypeScript types
async function handler(
  phone: string,
  input: string,
  session: Session
): Promise<string>
```

## Useful Links

- [Meta WhatsApp API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api/)
- [Firebase Documentation](https://firebase.google.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Paystack API Docs](https://paystack.com/developers/api)

---

**Last Updated:** 2024
**Version:** 1.0
