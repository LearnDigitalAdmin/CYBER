# Shop Commands - Quick Reference Guide

## 🚀 Command Syntax at a Glance

| Command | Syntax | Example | Effect |
|---------|--------|---------|--------|
| **SOLD** | `sold <product> <qty><unit> <price>` | `sold rice 4kg 600` | Record sale, deduct stock |
| **PAID** | `paid <category> <amount>` | `paid rent 5000` | Record expense |
| **ADD** | `add <product> <qty><unit>` | `add salt 5` | Add to stock |
| **EDIT** | `edit <product> <±qty><unit>` | `edit rice -2kg` | Adjust stock |

---

## ✅ Valid Examples

### Sales
```
sold rice 4kg 600              ✓ 4kg rice at 600/kg = 2400
sold sugar 3.5kg 550           ✓ 3.5kg sugar at 550/kg = 1925
sold maizeflour 6 1200         ✓ 6 pieces at 1200 each = 7200
sold.oil.10liters.800          ✓ Dot-separated format
```

### Expenses
```
paid rent 5000                 ✓ Record 5000 expense for rent
paid utilities 1500            ✓ Record 1500 for utilities
paid staff 3000                ✓ Record 3000 for staff
paid.groceries.450             ✓ Dot-separated format
```

### Stock
```
add rice 25kg                  ✓ Add 25kg rice
add salt 5                     ✓ Add 5 pieces salt
add oil 10liters               ✓ Add 10 liters oil
edit rice -2kg                 ✓ Reduce rice by 2kg
edit salt 3                    ✓ Increase salt by 3 pieces
edit oil -5liters              ✓ Reduce oil by 5 liters
```

---

## ❌ Invalid Examples

```
sold rice 4kg                  ✗ Missing price
sold rice 600                  ✗ Missing quantity
paid rent                      ✗ Missing amount
add rice                       ✗ Missing quantity
sold rice@123 4kg 600          ✗ Invalid product name
sold rice 4kg 600.50           ✗ Price must be integer (sales)
paid utilities 1500.50         ✗ Amount must be integer (expenses)
edit rice 0kg                  ✗ Can't edit by zero
```

---

## 📝 Format Rules

### Product Names
- ✅ Lowercase: `rice`, `salt`, `maizeflour`
- ✅ With underscore: `baby_oil`, `corn_flour`
- ✅ Numbers: `rice2`, `oil5kg`
- ❌ Uppercase: `Rice`, `SALT`
- ❌ Spaces: `baby oil`
- ❌ Special chars: `rice@`, `salt#`

### Quantities
- ✅ Whole: `4kg`, `5`
- ✅ Decimal: `3.5kg`, `10.5liters`
- ✅ Negative (edit only): `-2kg`, `-5`
- ❌ No unit: `4` (for non-pieces, specify unit)

### Units
- **kg** - Weight
- **liters** - Volume
- **pieces** - Count (default)

### Prices (Sales Only)
- ✅ `600`, `550`, `1200`
- ❌ `600.50`, decimals not allowed
- ❌ `0`, must be positive

### Amounts (Expenses Only)
- ✅ `5000`, `1500`, `450`
- ❌ `5000.50`, decimals not allowed
- ❌ `0`, must be positive

---

## 🎯 Quick Commands Mode

1. **Enter Mode:** Select option 1 from My Shop menu
2. **Send Commands:** Type one command per message
3. **Get Feedback:** Receive instant confirmation
4. **Check Status:** Use options 2 & 3 for summary & stock
5. **Navigate:**
   - `0` = Back to My Shop menu
   - `00` = Back to Main menu
   - `000` = Exit to language selection
   - `?` = Show help

---

## 📊 What Gets Recorded

### On SOLD
```
✅ Sale record (product, qty, price, total)
✅ Stock deducted
✅ Daily summary updated (revenue, transaction count)
✅ If stock low (<5) → ⚠️ Warning shown
```

### On PAID
```
✅ Expense record (category, amount)
✅ Daily summary updated (expenses, profit)
✅ Profit recalculated
```

### On ADD
```
✅ Stock added
✅ Stock history updated
✅ Daily summary updated (transaction count)
```

### On EDIT
```
✅ Stock adjusted
✅ Stock history logged
✅ Daily summary updated
✅ If stock → 0 → ⚠️ Warning shown
```

---

## 🔄 Navigation Options (Anytime)

| Input | Action | Result |
|-------|--------|--------|
| `0` | Back | Return to My Shop menu |
| `00` | Restart | Go to Main menu |
| `000` | Exit | Language selection |
| `?` | Help | Show command examples |

---

## 📋 My Shop Menu Options

```
1. Quick Commands 🚀   → Enter command mode
2. Today's Summary 📊  → View daily totals
3. View Stock 📦      → See all products
4. Weekly Report 📈   → Coming soon
5. Monthly Report 📉  → Coming soon
6. Help ❓            → Show examples
7. Back to Main Menu  → Exit
```

---

## 💡 Pro Tips

### Tip 1: Use Consistent Names
Always use same spelling: `rice`, not `Rice`, `Ric`, `r1ce`

### Tip 2: Specify Units Clearly
- Weight items: `4kg rice`
- Liquid items: `10liters oil`
- Countable items: `5 salt` or just `5`

### Tip 3: One Command Per Message
Don't combine: `sold rice 4kg 600 and paid rent 5000`

### Tip 4: Check Stock First (Optional)
Use option 3 before selling high quantities

### Tip 5: Use EDIT for Recounts
If physical stock differs: `edit rice 18kg` (absolute adjustment)

---

## ⚠️ Common Mistakes

### Mistake 1: Wrong Unit
```
❌ sold rice 4 600              (Ambiguous - 4 what?)
✅ sold rice 4kg 600            (Clear: 4 kg)
```

### Mistake 2: Decimal Prices
```
❌ paid utilities 1500.50       (Not allowed)
✅ paid utilities 1500          (Use whole numbers)
```

### Mistake 3: Missing Price
```
❌ sold rice 4kg                (Missing price)
✅ sold rice 4kg 600            (Price included)
```

### Mistake 4: Vague Category
```
❌ paid xyz 500                 (What is xyz?)
✅ paid supplies 500            (Clear category)
```

### Mistake 5: Multiple Commands
```
❌ sold rice 4kg 600 add salt 5 (Two commands)
✅ sold rice 4kg 600             (One at a time)
✅ add salt 5                     (Send next)
```

---

## 📊 Daily Summary Shows

```
*My Duka* - Today's Summary 📊

💰 Total Sales: 5400
💸 Total Expenses: 5000
📈 Profit: 400
📝 Transactions: 3

Stock Movement:
• Added: 25kg rice, 5 pieces salt
• Sold: 4kg rice
```

---

## 📦 View Stock Shows

```
*My Duka* - Current Stock 📦

• rice: 18kg
• salt: 5pieces
• oil: 7liters
• maizeflour: 12pieces
```

---

## 🔔 Automatic Notifications

### Low Stock Alert
```
✅ Sale recorded: 3kg salt @ 200 = 600

⚠️ Low stock: 2 pieces remaining
```

### Stock Depletion Alert
```
✅ Stock edited: -2kg rice | New stock: 0kg

⚠️ Stock is now 0
```

### Stock Insufficient
```
✅ Sale recorded: 50kg rice @ 600 = 30000

⚠️ Warning: Stock may be insufficient
```

---

## 🛡️ Error Recovery

### If You Make a Mistake

```
User: "sold rice 4kg"
System: ❌ Sale command requires price. Example: sold rice 4kg 600

User: "sold rice 4kg 600"     ← Just resend correct command
System: ✅ Sale recorded...
```

### No Undo Needed
Just send a correction with EDIT:
```
User: "edit rice +4kg"        ← Adds 4kg back to stock
```

---

## 📞 Need Help?

While in commands:
- Reply `?` to see all examples
- Reply `0` to go back to menu
- Go to Help option in Main menu

Email: info@cogvana.co.ke
Hours: 9 AM - 5 PM (Weekdays)

---

## 🎓 Learning Path

### Beginner
- [ ] Learn 4 command types
- [ ] Try basic sales
- [ ] Check daily summary
- [ ] Use navigation (0, 00)

### Intermediate
- [ ] Record expenses
- [ ] Manage stock (add/edit)
- [ ] Use multiple products
- [ ] View stock levels

### Advanced
- [ ] Bulk operations
- [ ] Weekly reports
- [ ] Stock optimization
- [ ] Expense categorization

---

## 📈 Real-World Scenarios

### Scenario 1: Morning Restock
```
User: add rice 50kg
User: add salt 20
User: add oil 15liters
Result: Stock replenished, ready for day
```

### Scenario 2: Morning Sales
```
User: sold rice 4kg 600
User: sold salt 3 200
User: sold oil 2liters 800
Result: Morning revenue = 2800
```

### Scenario 3: Pay Bills
```
User: paid rent 5000
User: paid utilities 1500
User: paid staff 3000
Result: Total expenses = 9500
```

### Scenario 4: End of Day Summary
```
User: (Select option 2)
Result: See daily profit/loss
```

### Scenario 5: Stock Recount
```
User: edit rice 22kg         (Physical count: 22kg, but system shows 20kg)
Result: Stock corrected to 22kg
```

---

## 🔐 Data Security

All your data:
- ✅ Stored securely in Firestore
- ✅ Only accessible by you
- ✅ Timestamped for audits
- ✅ Grouped by date for privacy
- ✅ Encrypted in transit (HTTPS)

---

## 📱 Format Flexibility

All these work the same:
```
sold rice 4kg 600
sold.rice.4kg.600
sold rice 4kg 600
sold.rice.4kg.600
```

Choose whichever is easiest for you!

---

## 🎯 Success Indicators

✅ You're using this correctly if:
- Commands are confirmed immediately
- Stock updates reflect in "View Stock"
- Daily summary shows correct totals
- You can navigate using 0, 00, 000
- Error messages are clear and helpful

---

**Last Updated:** November 2025
**Version:** 1.0
**Status:** Production Ready ✅
