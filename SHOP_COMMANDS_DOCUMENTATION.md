# Shop Commands System Documentation

## Overview

The Shop Commands System is a quick, intuitive way for shop managers to record sales, expenses, and stock movements via WhatsApp. Commands are simple, natural-language style:

```
sold rice 4kg 600
paid rent 5000
add salt 5
edit rice -2kg
```

---

## Command Types

### 1. SOLD (Record Sales)
Record a product sale with quantity and price.

**Syntax:**
```
sold <product> <quantity><unit> <price>
```

**Examples:**
```
sold rice 4kg 600          → 4kg of rice sold at 600 per kg (total: 2400)
sold sugar 3.5kg 550       → 3.5kg of sugar sold at 550 per kg (total: 1925)
sold maizeflour 6 1200     → 6 pieces of maizeflour sold at 1200 each (total: 7200)
```

**Validation:**
- ✅ Quantity must be positive
- ✅ Price must be provided and positive
- ✅ Unit auto-detected: kg, liters, or pieces
- ✅ Product name: letters, numbers, underscores only (1-50 chars)

**Response:**
```
✅ Sale recorded: 4kg rice @ 600 = 2400 | Remaining: 18kg

📋 Options:
• Send another command
• Reply 0 for menu
• Reply 00 for main menu
```

**Automatic Actions:**
- Deducts quantity from stock
- Records sale in daily transactions
- Updates daily summary (sales, revenue)
- Warns if stock goes below 5 units

---

### 2. PAID (Record Expenses)
Record an expense/payment for any category.

**Syntax:**
```
paid <category> <amount>
```

**Examples:**
```
paid rent 5000          → Paid 5000 for rent
paid utilities 1500     → Paid 1500 for utilities
paid xyz 450            → Paid 450 for category "xyz"
paid staff 3000         → Paid 3000 for staff
```

**Validation:**
- ✅ Amount must be positive integer
- ✅ Amount cannot have decimals
- ✅ Category name: letters, numbers, underscores only (1-50 chars)

**Response:**
```
✅ Expense recorded: rent - 5000

📋 Options:
• Send another command
• Reply 0 for menu
• Reply 00 for main menu
```

**Automatic Actions:**
- Records expense in daily transactions
- Updates daily summary (expenses, profit)

---

### 3. ADD (Add Stock)
Add new inventory to stock (restocking).

**Syntax:**
```
add <product> <quantity><unit>
```

**Examples:**
```
add rice 25kg           → Add 25kg of rice
add salt 5              → Add 5 pieces of salt
add oil 10liters        → Add 10 liters of oil
```

**Validation:**
- ✅ Quantity must be positive
- ✅ Unit auto-detected: kg, liters, or pieces (default: pieces)
- ✅ Product name: letters, numbers, underscores only (1-50 chars)

**Response:**
```
✅ Stock added: 25kg rice

📋 Options:
• Send another command
• Reply 0 for menu
• Reply 00 for main menu
```

**Automatic Actions:**
- Adds to product stock
- Records in daily summary
- Maintains stock history

---

### 4. EDIT (Adjust Stock)
Adjust existing stock by amount (positive to add, negative to reduce).

**Syntax:**
```
edit <product> <change><unit>
```

**Examples:**
```
edit rice -2kg          → Reduce rice by 2kg (e.g., spoilage, recount)
edit salt 10            → Add 10 pieces of salt (adjust count)
edit oil -5liters       → Reduce oil by 5 liters
```

**Validation:**
- ✅ Change cannot be zero
- ✅ Can be positive or negative
- ✅ Unit auto-detected: kg, liters, or pieces (default: pieces)
- ✅ Stock won't go below 0 (clamped)

**Response:**
```
✅ Stock edited: -2kg rice | New stock: 18kg

📋 Options:
• Send another command
• Reply 0 for menu
• Reply 00 for main menu
```

**Automatic Actions:**
- Adjusts product stock
- Records change in history
- Warns if stock goes to 0

---

## Command Format Variations

Commands are flexible and support multiple formats:

### Space-Separated (Recommended)
```
sold rice 4kg 600
paid rent 5000
add salt 5
edit rice -2kg
```

### Dot-Separated
```
sold.rice.4kg.600
paid.rent.5000
add.salt.5
edit.rice.-2kg
```

### Mixed (Both)
```
sold rice 4kg 600       ← Works
sold.rice.4kg.600       ← Works
sold rice 4kg.600       ← Works
```

---

## Unit Auto-Detection

The system automatically detects units from the quantity:

```
4kg         → Unit: kg
3.5liters   → Unit: liters
5           → Unit: pieces (auto-default)
10.5kg      → Unit: kg
```

**Supported Units:**
- **kg** - For weight-based products (rice, sugar, salt, flour)
- **liters** - For liquid products (oil, milk, water)
- **pieces** - For discrete items (default if no unit specified)
- **amount** - For expenses (auto, not user-specified)

---

## Error Handling

### Invalid Command Format
```
User: "hello"
Response:
❌ Invalid command format.

Examples:
• sold rice 4kg 600
• paid rent 5000
• add salt 5
• edit rice -2kg
```

### Missing Price for Sale
```
User: "sold rice 4kg"
Response:
❌ Sale command requires price. Example: sold rice 4kg 600
```

### Invalid Product Name
```
User: "sold rice@123 4kg 600"
Response:
❌ Product name contains invalid characters. Use only letters, numbers, underscores.
```

### Insufficient Stock (Warning)
```
User: "sold rice 50kg 600"
Response:
✅ Sale recorded: 50kg rice @ 600 = 30000

⚠️ Warning: Stock may be insufficient for this sale.
```

---

## Firestore Data Structure

### Sales Collection
```
shops/{shopId}/sales/{dateCode}/transactions/{saleId}
{
  id: "1699670400_a1b2c3d4e",
  shopId: "shop123",
  productName: "rice",
  quantity: 4,
  unit: "kg",
  pricePerUnit: 600,
  totalPrice: 2400,
  timestamp: 1699670400,
  createdVia: "whatsapp",
  userPhone: "254791234567"
}
```

### Expenses Collection
```
shops/{shopId}/expenses/{dateCode}/transactions/{expenseId}
{
  id: "1699670400_f5g6h7i8j",
  shopId: "shop123",
  category: "rent",
  amount: 5000,
  timestamp: 1699670400,
  createdVia: "whatsapp",
  userPhone: "254791234567"
}
```

### Stock Collection
```
shops/{shopId}/stocks/{dateCode}
{
  rice: {
    quantity: 18,
    unit: "kg",
    lastUpdated: 1699670400,
    updatedVia: "whatsapp",
    history: [
      { change: -4, type: "sold", timestamp: 1699670400, amount: 2400 },
      { change: 25, type: "add", timestamp: 1699670100 }
    ]
  },
  salt: {
    quantity: 5,
    unit: "pieces",
    ...
  }
}
```

### Daily Summary
```
shops/{shopId}/summaries/{dateCode}
{
  shopId: "shop123",
  dateCode: "10112025",
  totalSales: 2400,
  totalExpenses: 5000,
  profit: -2600,
  stockMovement: {
    added: { rice: 25, salt: 5 },
    sold: { rice: 4 }
  },
  transactionCount: 3,
  lastUpdated: 1699670400
}
```

---

## Features & Capabilities

### 1. Automatic Calculations
- **Sale Total:** Quantity × Price Per Unit
- **Daily Profit:** Total Sales - Total Expenses
- **Stock Tracking:** Updated automatically on each sale

### 2. Data Persistence
- All transactions stored in Firestore
- Daily summaries auto-generated
- Historical records maintained per transaction

### 3. Stock Management
- Current stock displayed after transactions
- Low stock warnings (< 5 units)
- Negative stock prevented
- Complete transaction history per product

### 4. User Feedback
- Immediate confirmation of each transaction
- Clear error messages with examples
- Stock balance shown
- Navigation options always available

### 5. Atomic Operations
- Sales + stock deductions are atomic
- No partial updates
- Data consistency guaranteed
- Transaction rollback on errors

---

## Navigation & Context

### Navigation Commands
While in command mode, users can:
- **Reply `0`** → Back to My Shop menu
- **Reply `00`** → Back to Main menu
- **Reply `000`** → Exit to language selection
- **Reply `?`** → Show help with examples

### Session Context
Shop information maintained in session:
```javascript
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

---

## Related Features

### 1. Today's Summary (Option 2)
Shows:
- Total Sales (Revenue)
- Total Expenses
- Profit/Loss
- Number of Transactions
- Stock Movement (Added vs Sold)

### 2. View Stock (Option 3)
Shows:
- All products with current quantities
- Unit for each product

### 3. Help/Examples (Option 6)
Shows:
- Complete command examples
- All supported formats
- Command structure guide

---

## Error Codes Reference

| Code | Message | Solution |
|------|---------|----------|
| `INVALID_COMMAND_FORMAT` | Invalid format | Use examples provided |
| `SOLD_MISSING_PRICE` | Sale needs price | Add price: `sold rice 4kg 600` |
| `PAID_INVALID_AMOUNT` | Expense amount invalid | Use positive integer |
| `ADD_INVALID_QUANTITY` | Stock quantity invalid | Use positive value: `add salt 5` |
| `INVALID_PRODUCT_FORMAT` | Product name invalid | Use letters/numbers/underscore only |
| `EDIT_ZERO_CHANGE` | Can't edit by 0 | Use positive/negative: `edit rice -2kg` |
| `VALIDATION_ERROR` | General error | Try again or contact support |

---

## Best Practices

### 1. Consistent Product Names
```
✅ rice, salt, flour, oil
❌ Rice, SALT, Flour, OIL
```
Use lowercase consistently for better tracking.

### 2. Use Appropriate Units
```
✅ sold rice 4kg 600       → Weight-based
❌ sold rice 4 600         → Ambiguous (pieces or kg?)
```

### 3. One Command Per Message
```
✅ sold rice 4kg 600
❌ sold rice 4kg 600 and paid rent 5000
```
Send separate messages for multiple transactions.

### 4. Accurate Quantities
```
✅ sold rice 4kg 600       → 4kg at 600 per kg
❌ sold rice 4kg 2400      → Ambiguous if 2400 is price/unit or total
```

### 5. Clear Expense Categories
```
✅ paid rent 5000
✅ paid utilities 1500
❌ paid xyz 5000           → Too vague
```

---

## Testing Scenarios

### Test Case 1: Basic Sale
```
User: sold rice 4kg 600
Expected:
✅ Sale recorded: 4kg rice @ 600 = 2400 | Remaining: 18kg
```

### Test Case 2: Low Stock Warning
```
User: sold salt 8
Expected:
✅ Sale recorded: 8 pieces salt @ 200 = 1600

⚠️ Low stock: 2 pieces remaining
```

### Test Case 3: Invalid Command
```
User: sold rice 4kg
Expected:
❌ Sale command requires price. Example: sold rice 4kg 600
```

### Test Case 4: Navigation
```
User: (in command mode) -> 0
Expected: Returns to My Shop menu
```

---

## Performance Optimizations

### 1. Transaction Batching
- Single atomic operation for sale + stock update
- No race conditions

### 2. Daily Grouping
- Documents grouped by date (DDMMYYYY)
- Faster queries for daily reports
- Automatic summary generation

### 3. Merge Operations
- Uses Firestore `merge: true`
- Multiple products in one document
- No field overwrites

### 4. Increment Operations
- Uses `fieldValue.increment()`
- Handles concurrent updates safely

---

## Future Enhancements

- [ ] Weekly/Monthly reports with charts
- [ ] Product pricing auto-suggestions
- [ ] Stock alerts (low, expired)
- [ ] Product categories
- [ ] Multi-currency support
- [ ] Bulk import/export
- [ ] Mobile app integration

---

## Support & Troubleshooting

### Issue: Command not recognized
**Solution:** Check spacing, use lowercase, no special characters

### Issue: Stock showing incorrect
**Solution:** Use `edit <product> <newQty>` to adjust manually

### Issue: Transaction not recorded
**Solution:** Check internet connection, wait and retry

### Issue: Price calculation wrong
**Solution:** Verify you entered price correctly (price per unit, not total)

### Contact
For issues, contact: info@cogvana.co.ke
Support Hours: 9 AM - 5 PM (Weekdays)
