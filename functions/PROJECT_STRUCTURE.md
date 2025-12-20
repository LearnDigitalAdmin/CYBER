# WhatsApp Backend - Complete Project Structure

## Directory Tree

```
functions/
├── src/
│   ├── config/                          # 🔧 Configuration & Initialization
│   │   ├── firebase.config.ts           # Firebase Admin setup
│   │   ├── whatsapp.config.ts           # WhatsApp API config
│   │   └── paystack.config.ts           # Paystack payment config
│   │
│   ├── constants/                       # 📋 Application Constants
│   │   ├── states.ts                    # Conversation state enum (30+ states)
│   │   ├── menus.ts                     # UI menus (English + Swahili)
│   │   └── messages.ts                  # Message templates (bilingual)
│   │
│   ├── handlers/                        # 🎮 Feature Handlers
│   │   ├── language.handler.ts          # Language selection (EN/SW)
│   │   ├── menu.handler.ts              # Main menu routing (8 options)
│   │   ├── shop.handler.ts              # Add Shop flow (5 steps)
│   │   ├── transaction.handler.ts       # Record Sale/Expense (6 states)
│   │   ├── rent.handler.ts              # Pay Rent & Get Invoice (TODO)
│   │   └── bill.handler.ts              # Pay Bill flow
│   │
│   ├── services/                        # 🗄️ Core Services
│   │   ├── session.service.ts           # Session management
│   │   │   ├── createOrGetSession()
│   │   │   ├── updateSessionState()
│   │   │   ├── updateSessionContext()
│   │   │   └── deleteSession()
│   │   │
│   │   ├── whatsapp.service.ts          # WhatsApp API integration
│   │   │   ├── sendWhatsAppMessage()
│   │   │   ├── sendWhatsAppMessages()
│   │   │   └── formatPhoneForWhatsApp()
│   │   │
│   │   ├── shop.service.ts              # Shop CRUD operations
│   │   │   ├── createShop()
│   │   │   ├── getShopByNationalId()
│   │   │   ├── getShopByPhone()
│   │   │   └── updateShop()
│   │   │
│   │   └── transaction.service.ts       # Transaction management
│   │       ├── createTransaction()
│   │       ├── getDailySummary()
│   │       ├── getWeeklySummary()
│   │       └── getMonthlySummary()
│   │
│   ├── types/                           # 📝 TypeScript Interfaces
│   │   ├── session.types.ts             # Session & context interfaces
│   │   ├── shop.types.ts                # Shop entity
│   │   ├── transaction.types.ts         # Transaction & report types
│   │   └── whatsapp.types.ts            # WhatsApp message types
│   │
│   ├── utils/                           # 🛠️ Utility Functions
│   │   ├── validator.ts                 # Input validation
│   │   │   ├── validateNationalId()
│   │   │   ├── validatePhoneNumber()
│   │   │   ├── validateAmount()
│   │   │   └── validateMenuSelection()
│   │   │
│   │   ├── formatter.ts                 # Data formatting
│   │   │   ├── formatCurrency()
│   │   │   ├── formatDate()
│   │   │   └── formatBusinessType()
│   │   │
│   │   ├── parser.ts                    # Command parsing
│   │   │   ├── parsePayBillCommand()
│   │   │   ├── extractPhoneNumber()
│   │   │   └── parseTimeRange()
│   │   │
│   │   └── logger.ts                    # Structured logging
│   │       ├── info()
│   │       ├── error()
│   │       └── setContext()
│   │
│   ├── webhooks/                        # 🔗 Webhook Handlers
│   │   ├── verify-webhook.ts            # Meta verification (GET)
│   │   └── whatsapp-webhook.ts          # Message processor (POST)
│   │
│   └── index.ts                         # 🚀 Cloud Functions exports
│       └── exports.whatsappWebhook
│
├── lib/                                 # 📦 Compiled JavaScript (auto-generated)
├── node_modules/                        # 📚 Dependencies
├── .env.example                         # 🔐 Environment template
├── package.json                         # 📦 Dependencies & scripts
├── tsconfig.json                        # ⚙️ TypeScript config
├── WHATSAPP_README.md                   # 📖 Main documentation
├── IMPLEMENTATION_SUMMARY.md            # ✅ What's been built
├── QUICK_REFERENCE.md                   # ⚡ Developer quick reference
├── DEPLOYMENT_CHECKLIST.md              # 🚀 Deployment guide
├── PROJECT_STRUCTURE.md                 # 📋 This file
└── .gitignore                           # 🚫 Git ignore

```

## File Count & Statistics

| Category | Count | LOC | Purpose |
|----------|-------|-----|---------|
| **Config** | 3 | ~100 | API initialization |
| **Constants** | 3 | ~250 | Menus & messages |
| **Handlers** | 6 | ~500 | Feature logic |
| **Services** | 4 | ~600 | Core operations |
| **Types** | 4 | ~80 | TypeScript interfaces |
| **Utils** | 4 | ~400 | Validation, formatting |
| **Webhooks** | 2 | ~150 | Message entry point |
| **Docs** | 5 | ~1000 | Documentation |

**Total: ~3,000 lines of code**

## Key Components Explained

### 1. Config Layer
- **Purpose**: Centralize API credentials and initialization
- **Files**: `firebase.config.ts`, `whatsapp.config.ts`, `paystack.config.ts`
- **Use**: Imported in services to avoid hardcoding secrets
- **Tip**: Keep these minimal, don't add business logic

### 2. Types Layer
- **Purpose**: Define all TypeScript interfaces
- **Files**: `session.types.ts`, `shop.types.ts`, `transaction.types.ts`, `whatsapp.types.ts`
- **Use**: Imported everywhere for type safety
- **Tip**: Keep interfaces simple and focused

### 3. Constants Layer
- **Purpose**: Store all user-facing text and states
- **Files**: `states.ts`, `menus.ts`, `messages.ts`
- **Use**: For bilingual support and easy updates
- **Tip**: Easy to translate without touching code

### 4. Utils Layer
- **Purpose**: Reusable helper functions
- **Modules**:
  - `validator.ts` - All input validation
  - `formatter.ts` - Data formatting
  - `parser.ts` - Command parsing
  - `logger.ts` - Structured logging
- **Use**: Called from handlers
- **Tip**: Pure functions, no side effects

### 5. Services Layer
- **Purpose**: Business logic & data operations
- **Types**:
  - **Session Service** - Manages user sessions
  - **WhatsApp Service** - API communication
  - **Shop Service** - Shop management
  - **Transaction Service** - Financial operations
- **Use**: Called from handlers, isolated from UI
- **Tip**: Each service is independent

### 6. Handlers Layer
- **Purpose**: Feature logic & state transitions
- **Structure**:
  - One handler per feature
  - Each handler = one state or step
  - Export async functions that return response string
- **Use**: Called from webhook based on session state
- **Tip**: Handlers should be thin, delegate to services

### 7. Webhooks Layer
- **Purpose**: Entry point for WhatsApp messages
- **Files**:
  - `verify-webhook.ts` - Handle Meta verification
  - `whatsapp-webhook.ts` - Process incoming messages
- **Use**: Imported by Cloud Function
- **Tip**: Keep validation light, delegate to handlers

### 8. Root Layer
- **Purpose**: Export Cloud Functions
- **File**: `index.ts`
- **Content**: `exports.whatsappWebhook = onRequest(...)`
- **Use**: Deployed as serverless function
- **Tip**: This is the public API endpoint

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────┐
│                   User on WhatsApp                  │
└────────────────────┬────────────────────────────────┘
                     │ Sends message
                     ↓
┌─────────────────────────────────────────────────────┐
│           Meta WhatsApp Cloud API                   │
│      (receives message, sends to webhook)           │
└────────────────────┬────────────────────────────────┘
                     │ Webhook POST request
                     ↓
┌─────────────────────────────────────────────────────┐
│           Cloud Function: whatsappWebhook           │
│    (entry point, verifies payload structure)        │
└────────────────────┬────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │ Extract message details │
        │ (phone, text, ID)       │
        └────────────┬────────────┘
                     ↓
┌─────────────────────────────────────────────────────┐
│    Session Service: getOrCreateSession()            │
│  (retrieve or create session from Firestore)        │
└────────────────────┬────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │   Check current state   │
        │   (MAIN_MENU, etc)      │
        └────────────┬────────────┘
                     ↓
┌─────────────────────────────────────────────────────┐
│      Handler (based on state)                       │
│  ├── Language Handler                               │
│  ├── Menu Handler                                   │
│  ├── Shop Handler                                   │
│  ├── Transaction Handler                           │
│  ├── Rent Handler                                   │
│  └── Bill Handler                                   │
└────────────────────┬────────────────────────────────┘
                     │ Handler calls services to:
        ┌────────────┼────────────┬────────────┐
        │            │            │            │
        ↓            ↓            ↓            ↓
   Validate     Update        Access      Generate
    Input      Session      Database     Response
        │            │            │            │
        │      Session Service   Service       │
        │      Shop Service      Functions    │
        │      Transaction       Utils        │
        │      WhatsApp Service               │
        │            │            │            │
        └────────────┼────────────┴────────────┘
                     ↓
┌─────────────────────────────────────────────────────┐
│        Send Response via WhatsApp Service           │
│   (sendWhatsAppMessage → WhatsApp API)              │
└────────────────────┬────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────┐
│           Meta WhatsApp Cloud API                   │
│    (forwards message to user's phone)               │
└────────────────────┬────────────────────────────────┘
                     │ Message delivered
                     ↓
┌─────────────────────────────────────────────────────┐
│                   User receives message             │
│              (on WhatsApp app)                       │
└─────────────────────────────────────────────────────┘
```

## Interaction Patterns

### Pattern 1: Simple State Handler
```
User input
    ↓
Handler validates
    ↓
Service operates (if needed)
    ↓
Update session state
    ↓
Return response
```

### Pattern 2: Multi-Step Feature
```
Step 1: Collect input → State 1 → Update context
Step 2: Collect input → State 2 → Update context
Step 3: Collect input → State 3 → Process all data
        Call service to save
        Return to main menu
```

### Pattern 3: Menu Navigation
```
Show menu options
    ↓
User selects option
    ↓
Validate selection
    ↓
Route to appropriate state
    ↓
Show next menu or prompt
```

## Database Collections

### Collection: `whatsapp_sessions`
```
Document ID: phone number (e.g., "254712345678")
├── phone: string
├── language: "en" | "sw"
├── currentState: string
├── context: {
│   └── [dynamic fields based on flow]
├── lastActive: number
└── createdAt: number
```

### Collection: `shops`
```
Document ID: auto-generated
├── id: string (matches doc ID)
├── ownerName: string
├── shopName: string
├── nationalId: string (unique)
├── phone: string
├── email: string
├── businessType: string
├── createdAt: number
├── createdVia: "whatsapp" | "cyber"
└── status: "active" | "suspended"
```

### Collection: `shops/{shopId}/transactions`
```
Document ID: auto-generated
├── id: string
├── type: "income" | "expense"
├── amount: number
├── category: string
├── paymentMethod?: string
├── description?: string
├── date: number (timestamp)
├── createdVia: "whatsapp" | "cyber"
└── userPhone: string
```

## Message Flow Example: Add Shop

```
User: "Hi"
│
├─→ Cloud Function receives message
├─→ Session Service: Create new session (state: LANGUAGE_SELECTION)
├─→ Handler: Language selection
├─→ Response: "Select language: 1. English 2. Swahili"

User: "1"
│
├─→ Cloud Function receives message
├─→ Session Service: Get session (state: LANGUAGE_SELECTION)
├─→ Handler: Language handler sets language to EN, move to MAIN_MENU
├─→ Response: "Main Menu: 1. Pay Rent ..."

User: "3"
│
├─→ Cloud Function receives message
├─→ Session Service: Get session (state: MAIN_MENU)
├─→ Handler: Menu handler, option 3 → ADD_SHOP_NAME
├─→ Response: "What is your full name?"

User: "John Doe"
│
├─→ Cloud Function receives message
├─→ Session Service: Get session (state: ADD_SHOP_NAME)
├─→ Handler: Shop handler collects name, move to ADD_SHOP_BUSINESS_NAME
├─→ Session: {ownerName: "John Doe"}
├─→ Response: "What is your shop name?"

[... continues for each field ...]

User: "1" (business type)
│
├─→ Cloud Function receives message
├─→ Session Service: Get session (state: ADD_SHOP_TYPE)
├─→ Handler: Shop handler, complete shop creation
├─→ Services:
│   ├─ Shop Service: createShop()
│   ├─ Firebase Auth: Create user account
│   ├─ WhatsApp Service: Send credentials
├─→ Response: "Success! Your shop is created. Credentials: ..."
├─→ State: MAIN_MENU
```

## API Endpoints

### Cloud Function Endpoint
```
Endpoint: /whatsappWebhook
Methods:
├── GET  → Verify webhook (Meta verification)
└── POST → Receive messages (Message processing)
```

### External APIs Used
```
1. WhatsApp Cloud API
   POST /v18.0/{PHONE_NUMBER_ID}/messages

2. Firebase Cloud Firestore
   GET/POST/UPDATE /databases/{db}/documents/{collection}/{doc}

3. Paystack (TODO)
   POST /charge (for STK push)

4. PMS Database (TODO)
   GET tenant details by National ID
```

## Dependencies

### Core
- `firebase-admin` - Firestore, Auth
- `firebase-functions` - Cloud Functions
- `axios` - HTTP requests
- `typescript` - Type safety

### Development
- `typescript` - Language
- `@types/node` - Node types
- `firebase-functions-test` - Testing

## Memory & Performance

### Typical Execution
- Cold start: 2-5 seconds
- Warm execution: 200-500ms
- Memory usage: 60-150MB
- Timeout: 60 seconds

### Optimization Tips
1. Reuse connections (Firebase, HTTP)
2. Cache session data
3. Minimize external API calls
4. Use indexes for queries
5. Batch operations when possible

## Security Layers

1. **Input Validation** - All inputs checked before processing
2. **Rate Limiting** - Per-phone message limits (future)
3. **Session Timeout** - Auto-expire after 30 minutes
4. **Environment Secrets** - API keys in .env
5. **Firestore Rules** - Restrict access (needs setup)
6. **HTTPS Only** - Firebase enforces

## Monitoring Points

1. **Function Logs** - `firebase functions:log`
2. **Error Rate** - CloudFunctions dashboard
3. **Execution Time** - Performance metrics
4. **Firestore Reads/Writes** - Cost tracking
5. **WhatsApp API Quota** - Message limits
6. **Session Count** - Active users

---

**Last Updated:** 2024
**Version:** 1.0
**Maintainer:** Development Team
