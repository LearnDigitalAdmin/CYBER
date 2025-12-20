# Multi-Word Product Names Support

## Overview

Enhanced the shop command system to support multi-word product names (e.g., "maize flour", "brown sugar", "wheat flour") with flexible input formatting. Users can now easily reference products with multiple words without complex escaping.

## Features

### ✅ Multi-Word Product Support

Users can now reference products with spaces in their names:
- **maize flour** - 2-word product
- **brown sugar** - 2-word product
- **wheat flour** - 2-word product
- **white sugar** - 2-word product
- **cooking oil** - 2-word product
- **palm oil** - 2-word product
- etc.

### ✅ Flexible Input Formats

All of these input formats are supported:

#### Format 1: Spaces (Most Natural)
```
sold maize flour 4kg 600
paid brown sugar 5000
add wheat flour 2kg
edit maize flour -1kg
```

#### Format 2: Hyphens (Compact)
```
sold maize-flour 4kg 600
paid brown-sugar 5000
add wheat-flour 2kg
edit maize-flour -1kg
```

#### Format 3: Dots (Alternative)
```
sold.maize.flour.4kg.600
paid.brown.sugar.5000
add.wheat.flour.2kg
edit.maize.flour.-1kg
```

#### Format 4: Mixed Hyphens + Spaces
```
sold maize-flour 4kg 600
add brown-sugar 2kg
```

**All formats normalize to the same product name internally:**
- `maize flour`, `maize-flour`, `MAIZE FLOUR` → stored as `maize flour`

### ✅ Intelligent Quantity & Unit Parsing

Supports multiple quantity formats:
- `4kg`, `4 kg` - weight in kilograms
- `2.5liters`, `2.5 liters`, `2.5l` - volume in liters
- `24pcs`, `24 pieces`, `24pc` - count in pieces
- `24` - plain numbers (defaults to pieces)
- `-1kg`, `-2.5kg` - negative values for edits

## Implementation Details

### Core Components

**File: `functions/src/utils/command.parser.ts`**

Three main functions handle parsing:

1. **`normalizeProductName(name)`**
   - Converts hyphens to spaces
   - Lowercases
   - Removes extra whitespace
   - Result: consistent product names

2. **`extractProductName(parts)`**
   - Intelligently matches product names from command parts
   - Supports known products list
   - Greedily matches longest product name first
   - Allows up to 4-word products
   - Returns product name and remaining parts

3. **`extractQuantityAndUnit(text)`**
   - Parses quantity and unit from remaining text
   - Handles all unit formats (kg, liters, pcs, pieces)
   - Supports decimals and negative values
   - Returns normalized quantity and unit

### Known Products List

Pre-configured common multi-word products for better parsing:

```typescript
const KNOWN_PRODUCTS = new Set([
  'maize flour',
  'brown sugar',
  'white sugar',
  'wheat flour',
  'maize meal',
  'cooking oil',
  'palm oil',
  'groundnut oil',
  'sunflower oil',
  'cooking gas',
  'rent',
  'utilities',
  'transport',
  'salary',
  'equipment',
  'supplies',
]);
```

**Why this helps:** Known products are matched first, ensuring correct parsing even in ambiguous cases.

**Easy to extend:** Add more products to this set as needed.

## Command Examples

### SOLD Commands (Sales)

```
sold maize flour 4kg 600
→ Product: "maize flour", Qty: 4kg, Price: 600/unit, Total: 2400

sold wheat-flour 2kg 500
→ Product: "wheat flour", Qty: 2kg, Price: 500/unit, Total: 1000

sold brown sugar 24 800
→ Product: "brown sugar", Qty: 24 pieces, Price: 800/unit, Total: 19200
```

### PAID Commands (Expenses)

```
paid rent 5000
→ Category: "rent", Amount: 5000

paid brown sugar 2000
→ Category: "brown sugar", Amount: 2000
```

### ADD Commands (Add Stock)

```
add maize flour 2kg
→ Product: "maize flour", Add: 2kg

add brown-sugar 24
→ Product: "brown sugar", Add: 24 pieces

add cooking oil 3.5liters
→ Product: "cooking oil", Add: 3.5 liters
```

### EDIT Commands (Adjust Stock)

```
edit maize flour -1kg
→ Product: "maize flour", Adjust: -1kg

edit wheat-flour +2kg
→ Product: "wheat flour", Adjust: +2kg

edit brown sugar -5
→ Product: "brown sugar", Adjust: -5 pieces
```

## Validation Rules

All product names:
- ✓ Contain only letters, numbers, spaces, hyphens
- ✓ Length between 1-100 characters
- ✓ Normalized to lowercase with single spaces
- ✓ Support up to 4-word products

All quantities:
- ✓ Can be decimal (e.g., 2.5kg)
- ✓ Can be negative (for edits)
- ✓ Must be provided for every command
- ✓ Unit auto-detected or specified

## Error Messages Updated

Error messages now show examples with multi-word products:

**English:**
```
❌ Invalid command format.

Examples:
• sold maize flour 4kg 600
• sold rice-flour 2kg 500
• paid rent 5000
• add brown sugar 2kg
• edit maize flour -1kg
```

**Swahili:**
```
❌ Muundo wa amri haupo sahihi.

Mifano:
• sold maize flour 4kg 600
• sold rice-flour 2kg 500
• paid rent 5000
• add brown sugar 2kg
• edit maize flour -1kg
```

## Files Modified

1. **`functions/src/utils/command.parser.ts`**
   - Completely rewritten to support multi-word products
   - Added product normalization
   - Enhanced quantity/unit parsing
   - Added known products list

2. **`functions/src/utils/command.validator.ts`**
   - Updated regex to allow spaces and hyphens: `^[a-z0-9\s-]+$`
   - Increased max length from 50 to 100 characters
   - Updated error messages with multi-word examples

3. **`functions/src/handlers/shop.command.handler.ts`**
   - Updated help messages and examples
   - Shows multi-word product examples

4. **`functions/src/handlers/shop.handler.ts`**
   - Updated initial quick command help
   - Shows multi-word product examples

## Database Impact

✅ **No changes to database schema** - Product names are stored as-is (after normalization)

✅ **Backward compatible** - Single-word products still work exactly as before

✅ **Consistent storage** - All variations of a product name normalize to the same format
- `maize flour`, `maize-flour`, `MAIZE FLOUR` all stored as `maize flour`

## Example Workflow

```
User sends: "sold maize-flour 4kg 600"
Parser normalizes: "maize flour" (hyphens → spaces)
Stored as: "maize flour" in database
Saved to: shops/{shopId}/sales/{saleId}

Later, user sends: "add maize flour 2kg"
Parser normalizes: "maize flour"
Matched to same product
Stock updated for: "maize flour"
```

## Benefits

✅ **Natural language** - Users type how they speak
✅ **Flexible input** - Multiple valid formats
✅ **No learning curve** - Works intuitively
✅ **Case insensitive** - "MAIZE FLOUR", "maize flour", "Maize Flour" all work
✅ **No special escaping** - No quotes or special characters needed
✅ **Backward compatible** - Existing single-word commands still work
✅ **Extensible** - Easy to add more known products

## Testing

Example test cases that all work:

| Input | Product | Qty | Unit | Price |
|-------|---------|-----|------|-------|
| `sold maize flour 4kg 600` | maize flour | 4 | kg | 600 |
| `sold maize-flour 4kg 600` | maize flour | 4 | kg | 600 |
| `sold.maize.flour.4kg.600` | maize flour | 4 | kg | 600 |
| `sold MAIZE FLOUR 4kg 600` | maize flour | 4 | kg | 600 |
| `add brown sugar 2kg` | brown sugar | 2 | kg | - |
| `add brown-sugar 2kg` | brown sugar | 2 | kg | - |
| `edit maize flour -1kg` | maize flour | -1 | kg | - |
| `paid rent 5000` | rent | 5000 | amount | - |

## Build Status

✅ **TypeScript:** 0 errors
✅ **Compilation:** Success
✅ **Production Ready:** Yes

## Future Enhancements

Possible future improvements:
- [ ] Fuzzy matching for typos (e.g., "maiz flour" → "maize flour")
- [ ] Autocomplete suggestions based on known products
- [ ] Custom product name aliases per shop
- [ ] Product abbreviations (e.g., "mf" → "maize flour")
- [ ] Language-specific product names

---

**Status:** ✅ COMPLETE AND PRODUCTION READY
**Date:** November 12, 2025
**Build:** SUCCESS
