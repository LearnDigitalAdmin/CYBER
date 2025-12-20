/**
 * Command Parser
 * Parses user commands with multi-word product names
 * Examples:
 * - sold maize flour 4kg 600 → maize flour 4kg at 600
 * - sold maize-flour 2kg 600 → maize flour 2kg at 600
 * - sold.maize-flour.2kg.600 → same (dots as separators)
 * - paid rent 5000 → rent expense 5000
 * - add brown sugar 2kg → brown sugar 2kg to stock
 * - edit maize-flour -1kg → reduce maize flour by 1kg
 */

import { ParsedCommand, CommandType, TransactionUnit } from '../types/shop.types';
import { logger } from './logger';

/**
 * Common multi-word products (for intelligent parsing)
 * Maps common product names to normalized versions
 */
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

/**
 * Normalize product name (remove hyphens, extra spaces, lowercase)
 */
function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .replace(/-+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Try to match product name from parts (handles multi-word products)
 * Returns { productName, remainingParts, startIndex }
 */
function extractProductName(
  parts: string[]
): { productName: string; remainingParts: string[]; matched: boolean } {
  if (parts.length < 2) {
    return { productName: '', remainingParts: parts, matched: false };
  }

  // Try to match known products (greedily match longest first)
  for (let length = Math.min(4, parts.length - 1); length >= 1; length--) {
    const candidate = parts.slice(1, 1 + length).join(' ');
    const normalized = normalizeProductName(candidate);

    // Check if it's a known product
    if (KNOWN_PRODUCTS.has(normalized)) {
      return {
        productName: normalized,
        remainingParts: parts.slice(1 + length),
        matched: true,
      };
    }

    // Also accept if all parts are alphabetic (not numbers or special chars)
    if (/^[a-z\s-]+$/.test(candidate)) {
      return {
        productName: normalized,
        remainingParts: parts.slice(1 + length),
        matched: true,
      };
    }
  }

  // Single word product (fallback)
  const singleWord = parts[1];
  if (/^[a-z0-9_-]+$/.test(singleWord)) {
    return {
      productName: normalizeProductName(singleWord),
      remainingParts: parts.slice(2),
      matched: false,
    };
  }

  return { productName: '', remainingParts: parts, matched: false };
}

/**
 * Extract quantity and unit from text
 * Handles formats like: 4kg, 2.5kg, 2 kg, 24pcs, 24 pieces, etc.
 */
function extractQuantityAndUnit(text: string): { quantity: number | null; unit: TransactionUnit } {
  // Try formats like "4kg", "2.5liters", "24pcs"
  let match = text.match(/^(-?\d+\.?\d*)\s*(kg|liters|liter|l|pcs|pieces|pc)s?$/i);

  if (match) {
    const quantity = parseFloat(match[1]);
    const unitStr = match[2].toLowerCase();

    let unit: TransactionUnit = 'pieces';
    if (['kg'].includes(unitStr)) {
      unit = 'kg';
    } else if (['liters', 'liter', 'l'].includes(unitStr)) {
      unit = 'liters';
    } else if (['pcs', 'pieces', 'pc'].includes(unitStr)) {
      unit = 'pieces';
    }

    return { quantity, unit };
  }

  // Try format with space: "4 kg", "2 liters"
  match = text.match(/^(-?\d+\.?\d*)\s+(kg|liters?|pcs?|pieces?)$/i);
  if (match) {
    const quantity = parseFloat(match[1]);
    const unitStr = match[2].toLowerCase();

    let unit: TransactionUnit = 'pieces';
    if (unitStr === 'kg') {
      unit = 'kg';
    } else if (['liters', 'liter'].includes(unitStr)) {
      unit = 'liters';
    } else if (['pcs', 'pc', 'pieces'].includes(unitStr)) {
      unit = 'pieces';
    }

    return { quantity, unit };
  }

  // Try just a number
  const num = parseFloat(text);
  if (!isNaN(num)) {
    return { quantity: num, unit: 'pieces' };
  }

  return { quantity: null, unit: 'pieces' };
}

/**
 * Parse command input into structured data
 */
export function parseCommand(rawInput: string): ParsedCommand | null {
  try {
    const input = rawInput.trim().toLowerCase();

    // Ensure input is not empty
    if (!input.length) {
      return null;
    }

    // Replace dots with spaces to normalize input format
    // Keep hyphens for product names
    const cleanInput = input.replace(/\./g, ' ').trim();
    const parts = cleanInput.split(/\s+/).filter(p => p.length > 0);

    if (parts.length < 2) {
      return null;
    }

    // First part: command type
    const typeStr = parts[0] as CommandType;
    if (!['sold', 'paid', 'add', 'edit'].includes(typeStr)) {
      return null;
    }
    const type: CommandType = typeStr;

    // Extract product name (handles multi-word products)
    const { productName, remainingParts } = extractProductName(parts);

    if (!productName || productName.length < 1 || productName.length > 100) {
      return null;
    }

    // Parse quantity and unit from remaining parts
    let quantity: number | null = null;
    let unit: TransactionUnit = 'pieces';
    let pricePerUnit: number | undefined;
    let totalPrice: number | undefined;

    if (remainingParts.length >= 1) {
      // First remaining part should be quantity (with optional unit)
      const qtyAndUnit = extractQuantityAndUnit(remainingParts[0]);
      quantity = qtyAndUnit.quantity;
      unit = qtyAndUnit.unit;

      // For 'sold' command, price is in next part
      if (type === 'sold' && remainingParts.length >= 2) {
        const priceStr = remainingParts[1];
        const price = parseFloat(priceStr);
        if (!isNaN(price) && price > 0) {
          pricePerUnit = price;
          totalPrice = quantity! * pricePerUnit;
        }
      }
    }

    // If we couldn't parse quantity, return null
    if (quantity === null || isNaN(quantity)) {
      return null;
    }

    // Validation: sold requires price
    if (type === 'sold' && !pricePerUnit) {
      return null;
    }

    // Validation: quantities should be positive for add/edit (but edit can be negative)
    if (type === 'add' && quantity <= 0) {
      return null;
    }

    // Validation: paid and quantities should be positive
    if (type === 'paid' && quantity <= 0) {
      return null;
    }

    // Validation: sold quantity should be positive
    if (type === 'sold' && quantity <= 0) {
      return null;
    }

    // For paid (expense), override unit to 'amount'
    if (type === 'paid') {
      unit = 'amount';
    }

    return {
      type,
      productName,
      quantity,
      unit,
      pricePerUnit,
      totalPrice,
      rawInput: rawInput.trim(),
    };
  } catch (error) {
    logger.error('Error parsing command', { input: rawInput, error });
    return null;
  }
}

/**
 * Get unit display name
 */
export function getUnitDisplay(unit: TransactionUnit): string {
  switch (unit) {
    case 'kg':
      return 'kg';
    case 'liters':
      return 'liters';
    case 'pieces':
      return 'pieces';
    case 'amount':
      return '';
    default:
      return unit;
  }
}

/**
 * Format quantity with unit
 */
export function formatQuantity(quantity: number, unit: TransactionUnit): string {
  if (unit === 'amount') {
    return quantity.toString();
  }
  return `${quantity}${unit}`;
}

/**
 * Get command display name
 */
export function getCommandDisplay(type: CommandType): string {
  switch (type) {
    case 'sold':
      return 'Sale';
    case 'paid':
      return 'Expense';
    case 'add':
      return 'Stock Add';
    case 'edit':
      return 'Stock Edit';
    default:
      return type;
  }
}
