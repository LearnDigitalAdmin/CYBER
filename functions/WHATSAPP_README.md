# WhatsApp Backend - Property & Shop Manager

A comprehensive WhatsApp bot for managing properties, shops, and transactions. Built with Firebase Cloud Functions, TypeScript, and WhatsApp Cloud API.

## Features

### 1. **Pay Rent** (Option 1)
- Users provide National ID
- System looks up tenant in PMS database
- Shows rent amount and property details
- Initiates Paystack payment (M-Pesa/Card)
- Sends payment confirmation

### 2. **Get Rent Invoice** (Option 2)
- Users provide National ID
- Fetches current invoice from PMS
- Shows amount, due date, property details
- Links to payment option

### 3. **Add Shop** (Option 3) 🏪
- Multi-step registration flow:
  - Collect full name
  - Collect shop name
  - Collect National ID
  - Collect phone number
  - Select business type
- Creates Firebase auth account
- Stores shop data in Firestore
- Sends credentials via SMS

### 4. **My Shop** (Option 4)
- ID-based shop verification
- Sub-menu with options:
  - **Record Sale** - Track income transactions
  - **Record Expense** - Track expense transactions
  - **Today's Summary** - Daily P&L summary
  - **Weekly Report** - 7-day summary with charts
  - **Monthly Report** - 30-day summary with trends

### 5. **Pay Bill** (Option 5)
- Command format: `pay{amount}frm{phone}`
- Example: `pay500frm0712345678`
- Initiates Paystack payment
- Notifies both payer and payee

### 6. **Manage My Plot** (Option 6)
- Links to PMS platform:
  - Play Store (Android app)
  - Web portal
  - Cyber portal

### 7. **Help** (Option 8)
- Support contact information
- Support hours
- Links to guides

## Architecture

```
functions/src/
├── config/                 # Configuration files
│   ├── firebase.config.ts
│   ├── whatsapp.config.ts
│   └── paystack.config.ts
├── constants/              # Constants & enums
│   ├── states.ts          # Conversation states
│   ├── menus.ts           # UI text (EN/SW)
│   └── messages.ts        # Message templates
├── handlers/              # Feature handlers
│   ├── language.handler.ts
│   ├── menu.handler.ts
│   ├── shop.handler.ts
│   ├── transaction.handler.ts
│   ├── rent.handler.ts
│   └── bill.handler.ts
├── services/              # Core services
│   ├── session.service.ts  # Session management
│   ├── whatsapp.service.ts # WhatsApp API
│   ├── shop.service.ts     # Shop CRUD
│   └── transaction.service.ts
├── types/                 # TypeScript interfaces
│   ├── session.types.ts
│   ├── shop.types.ts
│   ├── transaction.types.ts
│   └── whatsapp.types.ts
├── utils/                 # Helper functions
│   ├── validator.ts       # Input validation
│   ├── formatter.ts       # Data formatting
│   ├── parser.ts          # Command parsing
│   └── logger.ts          # Logging
├── webhooks/              # Webhook handlers
│   ├── verify-webhook.ts  # Meta verification
│   └── whatsapp-webhook.ts # Message processor
└── index.ts               # Cloud Functions exports
```

## State Machine

The conversation follows a state machine pattern. Each user has a session with:
- Current state (e.g., `MAIN_MENU`, `ADD_SHOP_NAME`)
- Language preference (`en` or `sw`)
- Context data (intermediate values during multi-step flows)

### State Flow Example: Add Shop
```
INITIAL
  ↓
LANGUAGE_SELECTION → User selects language
  ↓
MAIN_MENU → User selects option 3
  ↓
ADD_SHOP_NAME → Collect owner name
  ↓
ADD_SHOP_BUSINESS_NAME → Collect shop name
  ↓
ADD_SHOP_ID → Collect National ID
  ↓
ADD_SHOP_PHONE → Collect phone
  ↓
ADD_SHOP_TYPE → Select business type
  ↓
ADD_SHOP_PROCESSING → Create shop + auth account
  ↓
MAIN_MENU → Show success message
```

## Database Structure

### Firestore Collections

**`whatsapp_sessions`**
```typescript
{
  phone: string;
  language: "en" | "sw";
  currentState: string;
  context: object; // Intermediate data
  lastActive: number; // timestamp
  createdAt: number; // timestamp
}
```

**`shops`**
```typescript
{
  id: string;
  ownerName: string;
  shopName: string;
  nationalId: string; // unique
  phone: string;
  email: string;
  businessType: string;
  createdAt: number;
  createdVia: "whatsapp" | "cyber";
  status: "active" | "suspended";
}
```

**`shops/{shopId}/transactions`**
```typescript
{
  id: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  paymentMethod?: string; // For income
  description?: string;
  date: number; // timestamp
  createdVia: "whatsapp" | "cyber";
  userPhone: string;
}
```

**`shops/{shopId}/reports`**
```typescript
{
  id: string;
  period: "daily" | "weekly" | "monthly";
  startDate: number;
  endDate: number;
  totalIncome: number;
  totalExpenses: number;
  profit: number;
  transactionCount: number;
  generatedAt: number;
}
```

## Setup Instructions

### 1. Install Dependencies

```bash
cd functions
npm install
```

### 2. Configure Environment Variables

Create `.env` file in `functions/` directory:

```bash
cp .env.example .env
```

Update with your credentials:
- WhatsApp phone number ID
- WhatsApp access token
- WhatsApp webhook verify token
- Paystack secret key
- Paystack public key

### 3. Deploy to Firebase

```bash
# Build TypeScript
npm run build

# Deploy only functions
npm run deploy

# Or use firebase-tools
firebase deploy --only functions
```

### 4. Configure WhatsApp Webhook

In Meta App Dashboard:
1. Go to Configuration → Webhooks
2. Set callback URL to: `https://YOUR_FUNCTION_URL/whatsappWebhook`
3. Set verify token (same as `WHATSAPP_VERIFY_TOKEN`)
4. Subscribe to `messages` webhook

### 5. Test the Webhook

```bash
# Verify webhook is working
curl -X GET "https://YOUR_FUNCTION_URL/whatsappWebhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test_challenge"
```

## Validation Rules

### National ID
- 6-8 digits
- No all zeros (00000000)
- No sequential patterns (12345678)

### Phone Number
- Kenyan format: 07XX or 01XX (10 digits)
- Auto-formatted to international: +254XXXXXXXXX

### Amount
- Minimum: KES 10
- Maximum: KES 1,000,000
- Integer only (no decimals)

### Text Input
- Min length: 2 characters
- Max length: 100 characters
- Alphanumeric + spaces + basic punctuation

## Language Support

Currently supports:
- **English (en)** - Default
- **Kiswahili (sw)**

All user-facing text is stored in `constants/menus.ts` and `constants/messages.ts`

## Error Handling

All handlers have try-catch blocks and return user-friendly error messages. Errors are logged with context (phone number, state) for debugging.

## Next Steps

To complete the implementation:

1. **Implement Shop Service** - CRUD operations for shops
2. **Implement Transaction Service** - Save/retrieve transactions
3. **Implement PMS Integration** - Connect to PMS database for tenant lookup
4. **Implement Paystack Integration** - Complete payment flow
5. **Implement My Shop Menu** - Add report generation
6. **Add Image Support** - Charts for reports
7. **Add Multi-language SMS** - Send credentials in user's language
8. **Add Admin Dashboard** - Monitor all users and transactions

## Testing Locally

```bash
# Start Firebase emulator
npm run serve

# In another terminal, test with ngrok or local webhook
ngrok http 5001

# Then test messaging flow
```

## Troubleshooting

### Webhook not receiving messages
- Check verify token in Meta dashboard
- Ensure webhook URL is correctly configured
- Check Firebase Cloud Functions logs

### Payment failures
- Verify Paystack credentials
- Check amount validation (min 10, max 1M)
- Review Paystack logs for API errors

### Session timeouts
- Default timeout: 30 minutes
- Users can refresh by sending any message

## Support

For issues or questions:
- 📞 Phone: +254791286165
- 📧 Email: info@cogvana.co.ke
- 🌐 Web: www.cogvana.co.ke
