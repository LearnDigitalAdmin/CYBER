# Shop Commands System - Technical Implementation Guide

## Architecture Overview

```
WhatsApp Message
       ↓
[whatsapp-webhook.ts] - Routes to MY_SHOP_COMMAND state
       ↓
[shop.command.handler.ts] - Orchestrates command handling
       ↓
[command.parser.ts] → [command.validator.ts] → [shop.transaction.service.ts]
       ↓
[Firestore] - Stores transactions, stock, summaries
```

---

## File Structure

### New Files Created

```
functions/src/
├── utils/
│   ├── command.parser.ts           ← Parse raw input
│   └── command.validator.ts        ← Validate & error messages
├── services/
│   └── shop.transaction.service.ts ← Firestore operations
├── handlers/
│   └── shop.command.handler.ts     ← Main command logic
├── types/
│   └── shop.types.ts               ← Updated with command types
└── constants/
    ├── states.ts                   ← Added MY_SHOP_COMMAND
    └── menus.ts                    ← Updated MY_SHOP_MENU
```

### Modified Files

```
functions/src/
├── webhooks/whatsapp-webhook.ts    ← Added MY_SHOP_COMMAND routing
├── handlers/shop.handler.ts        ← Updated MY_SHOP_MENU logic
├── types/shop.types.ts             ← Added command interfaces
└── constants/states.ts             ← Added MY_SHOP_COMMAND state
```

---

## Core Components

### 1. Command Parser (`command.parser.ts`)

**Purpose:** Convert user input to structured command object

**Key Functions:**
```typescript
parseCommand(rawInput: string): ParsedCommand | null
```

**Parsing Logic:**
```
Input: "sold rice 4kg 600"
       ↓
Split by whitespace
["sold", "rice", "4kg", "600"]
       ↓
Extract:
- Type: "sold" (index 0)
- Product: "rice" (index 1)
- Quantity: "4" (parse from "4kg")
- Unit: "kg" (extract from "4kg")
- Price: "600" (index 3)
       ↓
ParsedCommand {
  type: 'sold',
  productName: 'rice',
  quantity: 4,
  unit: 'kg',
  pricePerUnit: 600,
  totalPrice: 2400
}
```

**Regex Pattern:**
```typescript
const match = qtyStr.match(/^(-?\d+\.?\d*)([a-z]*)$/);
// "4kg" → ["4", "kg"]
// "3.5liters" → ["3.5", "liters"]
// "5" → ["5", ""]
```

### 2. Command Validator (`command.validator.ts`)

**Purpose:** Validate parsed command and provide error messages

**Key Functions:**
```typescript
validateCommand(rawInput: string): CommandValidation
getErrorMessage(errorCode: string, language: 'en' | 'sw'): string
getSuccessMessage(parsed: ParsedCommand, ...): string
```

**Validation Flow:**
```
ParsedCommand
    ↓
validateByType(command)
    ├─ Check product name length & format
    ├─ Type-specific validation
    │   ├─ SOLD: requires price, quantity > 0, valid unit
    │   ├─ PAID: amount > 0, integer only
    │   ├─ ADD: quantity > 0, valid unit
    │   └─ EDIT: quantity ≠ 0, valid unit
    └─ Return validation result
```

**Error Messages:**
```typescript
{
  INVALID_COMMAND_FORMAT: "❌ Invalid command format...",
  SOLD_MISSING_PRICE: "❌ Sale command requires price...",
  PAID_INVALID_AMOUNT: "❌ Amount must be positive...",
  ADD_INVALID_QUANTITY: "❌ Quantity must be positive...",
  ...
}
```

### 3. Transaction Service (`shop.transaction.service.ts`)

**Purpose:** Atomic Firestore operations for transactions and stock

**Key Functions:**

#### recordSale()
```typescript
async recordSale(
  shopId: string,
  parsed: ParsedCommand,
  userPhone: string
): Promise<{
  success: boolean;
  saleId?: string;
  stockBefore?: number;
  stockAfter?: number;
  error?: string;
}>
```

**Process:**
1. Generate date code (DDMMYYYY) and unique saleId
2. Create SaleRecord object
3. Read current stock
4. Begin Firestore transaction:
   - Write sale to `sales/{dateCode}/transactions/{saleId}`
   - Update stock: decrement by quantity
   - Update daily summary: add to totalSales, increment transactionCount
5. Return success with stock info

#### recordExpense()
```typescript
async recordExpense(
  shopId: string,
  parsed: ParsedCommand,
  userPhone: string
): Promise<{
  success: boolean;
  expenseId?: string;
  error?: string;
}>
```

**Process:**
1. Generate date code and unique expenseId
2. Create ExpenseRecord object
3. Begin Firestore transaction:
   - Write expense to `expenses/{dateCode}/transactions/{expenseId}`
   - Update daily summary: add to totalExpenses, recalculate profit
4. Return success

#### addStock()
```typescript
async addStock(
  shopId: string,
  parsed: ParsedCommand,
  userPhone: string
): Promise<{
  success: boolean;
  stockAfter?: number;
  error?: string;
}>
```

**Process:**
1. Get current stock for product
2. Calculate new stock (current + quantity)
3. Begin Firestore transaction:
   - Update stock record with merge: true
   - Update stock history
   - Update daily summary: add to stockMovement.added
4. Return success

#### editStock()
```typescript
async editStock(
  shopId: string,
  parsed: ParsedCommand,
  userPhone: string
): Promise<{
  success: boolean;
  stockBefore?: number;
  stockAfter?: number;
  error?: string;
}>
```

**Process:**
1. Get current stock
2. Calculate new stock (current + change, min 0)
3. Begin Firestore transaction:
   - Update stock record with merge: true
   - Record change in history
   - Update daily summary
4. Return success

### 4. Command Handler (`shop.command.handler.ts`)

**Purpose:** Orchestrate user interaction and error handling

**Key Functions:**

#### handleShopCommand()
```typescript
export async function handleShopCommand(
  phone: string,
  input: string,
  session: Session
): Promise<string>
```

**Flow:**
```
Input (e.g., "sold rice 4kg 600")
    ↓
Check navigation commands (0, 00, 000, ?)
    ├─ If handled → return navigation response
    └─ Continue if not navigation
    ↓
Validate command
    ├─ If invalid → return error message with examples
    └─ Continue if valid
    ↓
Get shopId from session.context
    ├─ If missing → error
    └─ Continue
    ↓
Process by type:
    SOLD  → recordSale()
    PAID  → recordExpense()
    ADD   → addStock()
    EDIT  → editStock()
    ↓
Handle result:
    Success → format success response
    Error   → return error message
    ↓
Return formatted response with options
```

**Response Formatting:**
```typescript
function formatSuccessResponse(
  successMsg: string,
  shopName: string,
  language: 'en' | 'sw',
  additionalInfo?: string
): string

// Output:
✅ Sale recorded: 4kg rice @ 600 = 2400 | Remaining: 18kg

⚠️ Low stock: 18kg remaining

📋 Options:
• Send another command
• Reply 0 for menu
• Reply 00 for main menu
```

#### handleShopCommandSummary()
```typescript
async function handleShopCommandSummary(
  phone: string,
  session: Session
): Promise<string>
```

Retrieves daily summary from Firestore and displays:
- Total Sales
- Total Expenses
- Profit/Loss
- Transaction Count
- Stock Movement

#### handleShopCommandViewStock()
```typescript
async function handleShopCommandViewStock(
  phone: string,
  session: Session
): Promise<string>
```

Retrieves all products with current stock levels.

---

## State Management

### State Flow

```
MY_SHOP_MENU (User selects option 1)
    ↓
MY_SHOP_COMMAND (Enter command mode)
    ├─ User enters command → handled
    ├─ User enters 0 → back to MY_SHOP_MENU
    ├─ User enters 00 → to MAIN_MENU
    └─ User enters 000 → to LANGUAGE_SELECTION
```

### Session Context

```typescript
session.context = {
  shopId: "shop123",
  shopName: "Kama Duka",
  ownerName: "Ahmed",
  businessType: "Retail Shop",
  location: "Nairobi",
  totalEmployees: 2,
  shopPhone: "+254791234567",
  shopEmail: "shop@example.com"
}
```

Updated in `MY_SHOP_AUTH` handler when user authenticates.

---

## Firestore Schema

### Collections

```
shops/
├── {shopId}/
│   ├── (shop details)
│   ├── sales/
│   │   └── {dateCode}/
│   │       └── transactions/
│   │           └── {saleId}: SaleRecord
│   ├── expenses/
│   │   └── {dateCode}/
│   │       └── transactions/
│   │           └── {expenseId}: ExpenseRecord
│   ├── stocks/
│   │   └── {dateCode}: {
│   │       {productName}: StockRecord,
│   │       {productName}: StockRecord,
│   │       ...
│   │   }
│   └── summaries/
│       └── {dateCode}: DailySummary
```

### Date Code Format
```
DDMMYYYY
Example: 10112025 (November 10, 2025)

Generated by:
const generateDateCode = (date: Date = new Date()): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}${month}${year}`;
}
```

---

## Atomic Operations

All Firestore operations use transactions for consistency:

```typescript
const result = await db.runTransaction(async (transaction) => {
  // Read phase
  const stockDoc = await transaction.get(stockDocRef);

  // Write phase
  transaction.set(saleDocRef, saleRecord);
  transaction.set(stockDocRef, updatedStock, { merge: true });
  transaction.set(summaryDocRef, updatedSummary);

  return { success: true, saleId };
});
```

**Benefits:**
- ✅ All-or-nothing: no partial updates
- ✅ Isolation: no dirty reads
- ✅ Consistency: no race conditions
- ✅ Atomicity: failure rolls back all changes

---

## Error Handling Strategy

### Three-Layer Validation

**Layer 1: Command Parser**
- Checks basic syntax
- Returns null if unparseable

**Layer 2: Command Validator**
- Type-specific rules
- Returns error code

**Layer 3: Transaction Service**
- Firestore operations
- Network/auth errors

### Error Flow

```
Parser fails → "INVALID_COMMAND_FORMAT"
    ↓
Validator fails → "SOLD_MISSING_PRICE", "INVALID_PRODUCT_FORMAT", etc.
    ↓
Service fails → "VALIDATION_ERROR", generic fallback
    ↓
User gets friendly message with examples
```

### User-Facing Error Messages

All error messages include:
- ❌ Clear problem statement
- 📝 Correct usage examples
- 📋 Navigation options (0, 00)

```
❌ Sale command requires price.

Examples:
• sold rice 4kg 600
• sold sugar 3.5kg 550

📋 Options:
• Reply 0 for menu
• Reply 00 for main menu
```

---

## Success Response Format

```
✅ Action Description | Additional Info

📋 Options:
• Send another command
• Reply 0 for menu
• Reply 00 for main menu
```

**Examples:**

**Sale:**
```
✅ Sale recorded: 4kg rice @ 600 = 2400 | Remaining: 18kg

📋 Options:
• Send another command
• Reply 0 for menu
• Reply 00 for main menu
```

**With Warning:**
```
✅ Sale recorded: 8pieces salt @ 200 = 1600

⚠️ Low stock: 2 pieces remaining

📋 Options:
• Send another command
• Reply 0 for menu
• Reply 00 for main menu
```

---

## Integration Points

### 1. WhatsApp Webhook
```typescript
// whatsapp-webhook.ts
case STATE.MY_SHOP_COMMAND:
  response = await handleShopCommand(phone, text, session);
  break;
```

### 2. Shop Handler
```typescript
// shop.handler.ts → handleMyShopMenu()
case 1: // Quick Commands
  await updateSessionState(phone, STATE.MY_SHOP_COMMAND, {});
  return helpMsg;
```

### 3. Session Service
Used to:
- Get/create session
- Update state
- Update context

---

## Testing Checklist

### Unit Tests

- [ ] Command Parser
  - [x] Valid inputs
  - [x] Invalid formats
  - [x] Unit detection
  - [x] Edge cases (decimals, negatives)

- [ ] Command Validator
  - [x] Type validation
  - [x] Field validation
  - [x] Error codes
  - [x] Error messages

- [ ] Transaction Service
  - [x] recordSale()
  - [x] recordExpense()
  - [x] addStock()
  - [x] editStock()
  - [x] Data consistency

### Integration Tests

- [ ] Full command flow
  - [ ] Parse → Validate → Execute
  - [ ] Error handling
  - [ ] Navigation (0, 00, 000)

- [ ] Firestore operations
  - [ ] Daily summary auto-generation
  - [ ] Stock history tracking
  - [ ] Transaction atomicity

- [ ] Session context
  - [ ] State transitions
  - [ ] Context preservation
  - [ ] Navigation options

### User Acceptance Tests

- [ ] Command variations (space, dot, mixed)
- [ ] Unit auto-detection
- [ ] Error messages clarity
- [ ] Stock tracking accuracy
- [ ] Daily summary correctness
- [ ] Navigation (back, menu, exit)

---

## Performance Considerations

### Query Optimization
- Date-grouped documents reduce query size
- Product names in single document (merge)
- Indexed by shopId + dateCode

### Read/Write Distribution
- ~1 write per transaction (fast)
- Optional reads for stock info (cached)
- Summary auto-generated (single write)

### Firestore Costs
- ~3-4 writes per sale (sale + stock + summary)
- ~2 writes per expense (expense + summary)
- ~2 writes per stock op (stock + summary)

---

## Logging & Monitoring

### Log Levels

**INFO:**
- Command received
- Parse successful
- Transaction completed
- Navigation actions

**WARN:**
- Low stock
- Negative stock prevented
- Invalid state transitions

**ERROR:**
- Parse failures
- Validation failures
- Firestore errors
- Session missing

### Log Context
```typescript
logger.setContext({
  phone,
  state: session.currentState,
  shopId: session.context.shopId
});
```

---

## Security Considerations

### Input Validation
- Product names: alphanumeric + underscore only
- Quantities: positive/negative as appropriate
- Prices: positive integers only
- Shop ID: verified from session

### Data Privacy
- Transactions linked to user phone
- Shop ID verified before operations
- No sensitive data in logs

### Firestore Rules
```
match /shops/{shopId}/sales/{document=**} {
  allow read, write: if isShopOwner(shopId);
}
match /shops/{shopId}/expenses/{document=**} {
  allow read, write: if isShopOwner(shopId);
}
```

---

## Deployment Checklist

- [ ] All files created and integrated
- [ ] Types exported correctly
- [ ] No circular dependencies
- [ ] Error messages reviewed
- [ ] Navigation commands working
- [ ] Session context updated
- [ ] Firestore indexes created (if needed)
- [ ] Logging configured
- [ ] Tests passing
- [ ] Documentation complete

---

## Future Enhancements

### Phase 2
- [ ] Weekly/Monthly reports
- [ ] Product categories
- [ ] Price history
- [ ] Bulk operations

### Phase 3
- [ ] Analytics dashboard
- [ ] Inventory alerts
- [ ] Multi-currency
- [ ] PDF export

### Phase 4
- [ ] Mobile app
- [ ] API endpoints
- [ ] Third-party integrations
- [ ] Advanced reporting
