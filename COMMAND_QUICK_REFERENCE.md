# Quick Command Reference - Shop Management

## Command Structure

All commands follow this pattern:
```
[COMMAND] [PRODUCT NAME] [QUANTITY + UNIT] [PRICE (sales only)]
```

## Supported Commands

### 🛒 SOLD - Record a Sale

Records when you sell products.

**Syntax:**
```
sold <product> <quantity> <price-per-unit>
```

**Examples:**
```
sold maize flour 4kg 600
sold wheat-flour 2kg 500
sold brown sugar 24pcs 800
sold rice 5liters 250
sold salt 100 50
```

**Database impact:** Adds sale record + deducts from stock

---

### 💰 PAID - Record an Expense

Records money spent on expenses, supplies, or rent.

**Syntax:**
```
paid <category> <amount>
```

**Examples:**
```
paid rent 5000
paid utilities 2000
paid brown sugar 1500
paid equipment 8000
paid supplies 3000
```

**Database impact:** Adds expense record

---

### ➕ ADD - Add Stock

Adds inventory to your warehouse/shop.

**Syntax:**
```
add <product> <quantity + unit>
```

**Examples:**
```
add maize flour 2kg
add brown-sugar 24pcs
add cooking oil 5liters
add rice 10kg
add salt 50
```

**Database impact:** Increases stock quantity

---

### ✏️ EDIT - Adjust Stock

Corrects or adjusts inventory (can be positive or negative).

**Syntax:**
```
edit <product> <+/- quantity + unit>
```

**Examples:**
```
edit maize flour -1kg
edit wheat-flour +2kg
edit brown sugar -5pcs
edit rice -3kg
```

**Database impact:** Increases/decreases stock by specified amount

---

## Product Name Formats

### Multi-Word Products

You can use product names with multiple words. All these formats work:

✅ **Spaces (Most natural):**
```
sold maize flour 4kg 600
add brown sugar 2kg
edit wheat flour -1kg
```

✅ **Hyphens (Compact):**
```
sold maize-flour 4kg 600
add brown-sugar 2kg
edit wheat-flour -1kg
```

✅ **Dots (Alternative):**
```
sold.maize.flour.4kg.600
add.brown.sugar.2kg
edit.wheat.flour.-1kg
```

✅ **Mixed:**
```
sold maize-flour 4kg 600
paid brown-sugar 5000
```

### Case Insensitive

All these are treated as the same product:
```
MAIZE FLOUR
Maize Flour
maize flour
maize-flour
MAIZE-FLOUR
```

---

## Quantity & Unit Formats

### Weight (Kilograms)
```
4kg        ✓
4 kg       ✓
2.5kg      ✓
2.5 kg     ✓
-1kg       ✓ (for edit/adjust)
```

### Volume (Liters)
```
5liters    ✓
5 liters   ✓
5l         ✓
3.5liters  ✓
3.5 liters ✓
```

### Count (Pieces)
```
24         ✓ (defaults to pieces)
24pcs      ✓
24pcs      ✓
24 pieces  ✓
100        ✓
-5         ✓ (for edit/adjust)
```

---

## Common Products

Pre-configured for easy use:

**Grains & Flour:**
- maize flour
- wheat flour
- maize meal

**Sugars:**
- brown sugar
- white sugar

**Oils:**
- cooking oil
- palm oil
- groundnut oil
- sunflower oil

**Utilities:**
- rent
- utilities
- transport
- cooking gas

**Other:**
- salary
- equipment
- supplies

---

## Real-World Examples

### Daily Transactions

```
Morning: Record opening inventory
add maize flour 5kg
add brown sugar 2kg

During day: Record sales
sold maize flour 4kg 600
sold brown sugar 24pcs 800
sold cooking oil 3liters 250

End of day: Record expenses
paid rent 2500
paid utilities 500

Next morning: Adjust for waste/error
edit maize flour -0.5kg
```

### Weekly Management

```
sold maize-flour 20kg 600
sold wheat-flour 15kg 550
sold brown-sugar 100pcs 800
paid rent 5000
paid utilities 1000
paid transport 2000
paid supplies 1500
add maize flour 10kg
edit brown sugar -5pcs
```

---

## Error Messages & Fixes

**❌ Invalid command format**
- Check spelling: `sold`, `paid`, `add`, `edit`
- Include all required parts
- Fix: `sold maize flour 4kg 600` ✓

**❌ Product name invalid**
- Product name too long or has special characters
- Fix: Use only letters, spaces, numbers, hyphens

**❌ Quantity must be positive**
- For `sold`, `add`, `paid` - quantities must be > 0
- For `edit` - quantity can be negative, but not zero
- Fix: `edit rice -2kg` ✓ (edit can be negative)

**❌ Sale requires price**
- `sold` command must include price per unit
- Fix: `sold rice 4kg 600` (600 is price) ✓

**⚠️ Stock may be insufficient**
- Warning: You're selling more than in stock
- It will record anyway, but warns you
- Fix: Check inventory first with "View Stock" option

---

## Tips & Tricks

### Shorthand with Hyphens
Instead of:
```
sold maize flour 4kg 600
```

Type:
```
sold maize-flour 4kg 600
```

### Decimal Quantities
```
add cooking oil 2.5liters ✓
sold wheat flour 3.5kg 600 ✓
edit rice -1.5kg ✓
```

### Quick Expenses
```
paid rent 5000
paid utilities 2000
paid salary 15000
```

### Batch Operations
```
add maize flour 10kg
add brown sugar 5kg
add cooking oil 3liters
```

### Corrections
```
edit maize flour -2kg  (remove 2kg)
edit brown sugar +10pcs (add 10pcs)
edit rice -1.5kg (remove 1.5kg)
```

---

## Navigation

**After each command:**
- `0` - Go back to menu
- `00` - Go to main menu
- `000` - Exit to language selection
- Or send another command to continue

---

## Support

**Need help?** Reply with `?` in the commands menu to see full help.

**Examples always available** in error messages.

**All formats supported** - use whatever is most convenient for you!

---

**Last Updated:** November 12, 2025
