/**
 * Command Validator
 * Validates parsed commands and provides detailed error messages
 */

import { ParsedCommand, CommandValidation } from '../types/shop.types';
import { parseCommand } from './command.parser';
import { logger } from './logger';

/**
 * Validate a raw command input
 * Returns validation result with error message if invalid
 */
export function validateCommand(rawInput: string): CommandValidation {
  try {
    // Parse the command
    const parsed = parseCommand(rawInput);

    if (!parsed) {
      return {
        valid: false,
        error: 'INVALID_COMMAND_FORMAT',
      };
    }

    // Additional validation based on type
    const typeValidation = validateByType(parsed);
    if (!typeValidation.valid) {
      return typeValidation;
    }

    return {
      valid: true,
      command: parsed,
    };
  } catch (error) {
    logger.error('Error validating command', { input: rawInput, error });
    return {
      valid: false,
      error: 'VALIDATION_ERROR',
    };
  }
}

/**
 * Validate command based on type-specific rules
 */
function validateByType(command: ParsedCommand): CommandValidation {
  const { type, quantity, unit, pricePerUnit, productName } = command;

  // Validate product name
  if (!productName || productName.length < 1 || productName.length > 100) {
    return {
      valid: false,
      error: 'INVALID_PRODUCT_NAME',
      command,
    };
  }

  // Validate product name contains only alphanumeric, spaces, and hyphens
  // Supports multi-word products like "maize flour", "brown sugar", "white flour"
  if (!/^[a-z0-9\s-]+$/.test(productName)) {
    return {
      valid: false,
      error: 'INVALID_PRODUCT_FORMAT',
      command,
    };
  }

  // Type-specific validation
  switch (type) {
    case 'sold':
      // Sold requires price and positive quantity
      if (!pricePerUnit || pricePerUnit <= 0) {
        return {
          valid: false,
          error: 'SOLD_MISSING_PRICE',
          command,
        };
      }
      if (quantity <= 0) {
        return {
          valid: false,
          error: 'SOLD_INVALID_QUANTITY',
          command,
        };
      }
      if (!['kg', 'liters', 'pieces'].includes(unit)) {
        return {
          valid: false,
          error: 'SOLD_INVALID_UNIT',
          command,
        };
      }
      break;

    case 'paid':
      // Paid (expense) requires positive amount
      if (quantity <= 0) {
        return {
          valid: false,
          error: 'PAID_INVALID_AMOUNT',
          command,
        };
      }
      // Amount must be integer
      if (!Number.isFinite(quantity) || quantity !== Math.floor(quantity)) {
        return {
          valid: false,
          error: 'PAID_AMOUNT_NOT_INTEGER',
          command,
        };
      }
      break;

    case 'add':
      // Add requires positive quantity
      if (quantity <= 0) {
        return {
          valid: false,
          error: 'ADD_INVALID_QUANTITY',
          command,
        };
      }
      if (!['kg', 'liters', 'pieces'].includes(unit)) {
        return {
          valid: false,
          error: 'ADD_INVALID_UNIT',
          command,
        };
      }
      break;

    case 'edit':
      // Edit can be positive or negative
      if (quantity === 0) {
        return {
          valid: false,
          error: 'EDIT_ZERO_CHANGE',
          command,
        };
      }
      if (!['kg', 'liters', 'pieces'].includes(unit)) {
        return {
          valid: false,
          error: 'EDIT_INVALID_UNIT',
          command,
        };
      }
      break;

    default:
      return {
        valid: false,
        error: 'INVALID_COMMAND_TYPE',
        command,
      };
  }

  return {
    valid: true,
    command,
  };
}

/**
 * Get user-friendly error message based on error code
 */
export function getErrorMessage(errorCode: string, language: 'en' | 'sw' = 'en'): string {
  const messages: Record<string, Record<string, string>> = {
    INVALID_COMMAND_FORMAT: {
      en: '❌ Invalid command format.\n\nExamples:\n• sold maize flour 4kg 600\n• sold rice-flour 2kg 500\n• paid rent 5000\n• add brown sugar 2kg\n• edit maize flour -1kg',
      sw: '❌ Muundo wa amri haupo sahihi.\n\nMifano:\n• sold maize flour 4kg 600\n• sold rice-flour 2kg 500\n• paid rent 5000\n• add brown sugar 2kg\n• edit maize flour -1kg',
    },
    INVALID_PRODUCT_NAME: {
      en: '❌ Product name invalid. Use letters, numbers, spaces, hyphens (1-100 chars).',
      sw: '❌ Jina la bidhaa sio sahihi. Tumia herufi, namba, nafasi, mistari (1-100 tarakimu).',
    },
    INVALID_PRODUCT_FORMAT: {
      en: '❌ Product name contains invalid characters. Use letters, numbers, spaces, or hyphens.',
      sw: '❌ Jina la bidhaa lina herufi zisizofaa. Tumia herufi, namba, nafasi, au mistari.',
    },
    SOLD_MISSING_PRICE: {
      en: '❌ Sale command requires price. Example: sold rice 4kg 600',
      sw: '❌ Amri ya kuuza inahitaji bei. Mfano: sold rice 4kg 600',
    },
    SOLD_INVALID_QUANTITY: {
      en: '❌ Quantity must be positive. Example: sold rice 4kg 600',
      sw: '❌ Kiasi lazima kiwe chanya. Mfano: sold rice 4kg 600',
    },
    SOLD_INVALID_UNIT: {
      en: '❌ Invalid unit for sale. Use: kg, liters, or pieces. Example: sold rice 4kg 600',
      sw: '❌ Kipimo kisicho sahihi kwa mauzo. Tumia: kg, liters, au pieces. Mfano: sold rice 4kg 600',
    },
    PAID_INVALID_AMOUNT: {
      en: '❌ Amount must be positive. Example: paid rent 5000',
      sw: '❌ Kiasi lazima kiwe chanya. Mfano: paid rent 5000',
    },
    PAID_AMOUNT_NOT_INTEGER: {
      en: '❌ Amount must be a whole number. Example: paid xyz 500',
      sw: '❌ Kiasi lazima kiwe namba kamili. Mfano: paid xyz 500',
    },
    ADD_INVALID_QUANTITY: {
      en: '❌ Quantity must be positive. Example: add salt 5',
      sw: '❌ Kiasi lazima kiwe chanya. Mfano: add salt 5',
    },
    ADD_INVALID_UNIT: {
      en: '❌ Invalid unit. Use: kg, liters, or pieces. Example: add salt 5kg',
      sw: '❌ Kipimo kisicho sahihi. Tumia: kg, liters, au pieces. Mfano: add salt 5kg',
    },
    EDIT_ZERO_CHANGE: {
      en: '❌ Change cannot be zero. Use positive or negative value. Example: edit rice -2kg',
      sw: '❌ Badiliko haliwezi kuwa sifuri. Tumia thamani chanya au hasi. Mfano: edit rice -2kg',
    },
    EDIT_INVALID_UNIT: {
      en: '❌ Invalid unit. Use: kg, liters, or pieces. Example: edit rice -2kg',
      sw: '❌ Kipimo kisicho sahihi. Tumia: kg, liters, au pieces. Mfano: edit rice -2kg',
    },
    INVALID_COMMAND_TYPE: {
      en: '❌ Unknown command. Use: sold, paid, add, or edit.',
      sw: '❌ Amri isiyojulikana. Tumia: sold, paid, add, au edit.',
    },
    VALIDATION_ERROR: {
      en: '❌ Error validating command. Please try again.',
      sw: '❌ Hitilafu katika uthibitisho wa amri. Jaribu tena.',
    },
    INSUFFICIENT_STOCK: {
      en: '⚠️ Warning: Stock may be insufficient for this sale.',
      sw: '⚠️ Onyo: Hifadhi inaweza kuwa haitoshi kwa mauzo haya.',
    },
    STOCK_NOT_FOUND: {
      en: '⚠️ Product not in stock. Recording sale anyway.',
      sw: '⚠️ Bidhaa sio katika hifadhi. Akiba mauzo hata hivyo.',
    },
  };

  return messages[errorCode]?.[language] || messages[errorCode]?.['en'] || '❌ An error occurred.';
}

/**
 * Get user-friendly success message based on command type
 */
export function getSuccessMessage(
  parsed: ParsedCommand,
  stockBefore?: number,
  stockAfter?: number,
  language: 'en' | 'sw' = 'en'
): string {
  const { type, productName, quantity, unit, pricePerUnit, totalPrice } = parsed;

  const unitDisplay = unit === 'amount' ? '' : unit;
  const qtyDisplay = unit === 'amount' ? `${quantity}` : `${quantity}${unitDisplay}`;

  switch (type) {
    case 'sold':
      const stockMsg = stockAfter !== undefined
        ? ` | Remaining: ${stockAfter}${unitDisplay}`
        : '';
      return language === 'en'
        ? `✅ Sale recorded: ${quantity}${unitDisplay} ${productName} @ ${pricePerUnit} = ${totalPrice}${stockMsg}`
        : `✅ Mauzo yaliandikwa: ${quantity}${unitDisplay} ${productName} @ ${pricePerUnit} = ${totalPrice}${stockMsg}`;

    case 'paid':
      return language === 'en'
        ? `✅ Expense recorded: ${productName} - ${quantity}`
        : `✅ Matumizi yaliandikwa: ${productName} - ${quantity}`;

    case 'add':
      return language === 'en'
        ? `✅ Stock added: ${qtyDisplay} ${productName}`
        : `✅ Hifadhi iliongezwa: ${qtyDisplay} ${productName}`;

    case 'edit':
      const sign = quantity > 0 ? '+' : '';
      const stockChangeMsg = stockAfter !== undefined
        ? ` | New stock: ${stockAfter}${unitDisplay}`
        : '';
      return language === 'en'
        ? `✅ Stock edited: ${sign}${qtyDisplay} ${productName}${stockChangeMsg}`
        : `✅ Hifadhi ilihairiwa: ${sign}${qtyDisplay} ${productName}${stockChangeMsg}`;

    default:
      return '✅ Command recorded.';
  }
}
