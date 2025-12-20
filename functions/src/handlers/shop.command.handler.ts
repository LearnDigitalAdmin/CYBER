/**
 * Shop Command Handler
 * Handles quick commands for sales, expenses, and stock management
 * Examples: sold rice 4kg 600, paid rent 5000, add salt 5, edit rice -2kg
 */

import { Session } from '../types/session.types';
import { updateSessionState } from '../services/session.service';
import { validateCommand, getErrorMessage, getSuccessMessage } from '../utils/command.validator';
import {
  recordSale,
  recordExpense,
  addStock,
  editStock,
  getDailySummary,
  getAllProductsStock,
} from '../services/shop.transaction.service';
import { getMessage } from '../constants/messages';
import { getMenu } from '../constants/menus';
import { STATE } from '../constants/states';
import { logger } from '../utils/logger';
import { checkNavigationCommand } from '../utils/validator';

/**
 * Handle navigation commands in MY_SHOP_COMMAND state
 * 0: back to menu, 00: restart, 000: exit
 */
async function handleCommandNavigation(
  phone: string,
  input: string,
  session: Session
): Promise<{ response: string | null; handled: boolean }> {
  const nav = checkNavigationCommand(input);

  if (nav.type === 'exit') {
    // 000: Exit to language selection
    logger.info('User exiting shop commands', { phone });
    await updateSessionState(phone, STATE.LANGUAGE_SELECTION, {});
    return {
      response: getMenu('WELCOME', session.language),
      handled: true,
    };
  }

  if (nav.type === 'restart') {
    // 00: Back to main menu
    logger.info('User restarting from commands', { phone });
    await updateSessionState(phone, STATE.MAIN_MENU, {});
    return {
      response: getMenu('MAIN_MENU', session.language),
      handled: true,
    };
  }

  if (nav.type === 'back') {
    // 0: Back to shop menu
    logger.info('User going back to shop menu', { phone });
    const shopName = session.context.shopName as string;
    await updateSessionState(phone, STATE.MY_SHOP_MENU, {});

    const backMsg =
      session.language === 'en'
        ? `Returned to *${shopName}* menu.\n\n`
        : `Kurudi kwenye menyu ya *${shopName}*.\n\n`;

    return {
      response: backMsg + getMenu('MY_SHOP_MENU', session.language) + getMessage('NAVIGATION_HELP', session.language),
      handled: true,
    };
  }

  return { response: null, handled: false };
}

/**
 * Format success response with navigation options
 */
function formatSuccessResponse(
  successMsg: string,
  shopName: string,
  language: 'en' | 'sw' = 'en',
  additionalInfo?: string
): string {
  const navigationText =
    language === 'en'
      ? '\n\n📋 Options:\n• Send another command\n• Reply *0* for menu\n• Reply *00* for main menu'
      : '\n\n📋 Chaguo:\n• Tuma amri nyingine\n• Jibu *0* kwa menyu\n• Jibu *00* kwa menyu kuu';

  let response = successMsg;
  if (additionalInfo) {
    response += '\n\n' + additionalInfo;
  }
  response += navigationText;

  return response;
}

/**
 * Format error response with examples and navigation
 */
function formatErrorResponse(
  errorMsg: string,
  language: 'en' | 'sw' = 'en'
): string {
  const exampleText =
    language === 'en'
      ? '\n\n📝 Examples:\n• sold maize flour 4kg 600\n• sold wheat-flour 2kg 500\n• paid rent 5000\n• add brown sugar 2kg\n• edit maize flour -1kg\n\n📋 Options:\n• Reply *0* for menu\n• Reply *00* for main menu'
      : '\n\n📝 Mifano:\n• sold maize flour 4kg 600\n• sold wheat-flour 2kg 500\n• paid rent 5000\n• add brown sugar 2kg\n• edit maize flour -1kg\n\n📋 Chaguo:\n• Jibu *0* kwa menyu\n• Jibu *00* kwa menyu kuu';

  return errorMsg + exampleText;
}

/**
 * Main handler for MY_SHOP_COMMAND state
 * Processes quick commands (sold, paid, add, edit)
 */
export async function handleShopCommand(phone: string, input: string, session: Session): Promise<string> {
  try {
    // Check navigation commands first
    const nav = await handleCommandNavigation(phone, input, session);
    if (nav.handled && nav.response) return nav.response;
    if (nav.handled) {
      // Navigation handled but no response needed - shouldn't happen
      return getMenu('MY_SHOP_MENU', session.language) + getMessage('NAVIGATION_HELP', session.language);
    }

    // Get shop info from context
    const shopId = session.context.shopId as string;
    const shopName = session.context.shopName as string;

    if (!shopId || !shopName) {
      logger.error('Shop info not found in session context', { phone });
      await updateSessionState(phone, STATE.MY_SHOP_AUTH, {});
      return getMessage('SHOP_NOT_FOUND', session.language);
    }

    // Validate and parse command
    const validation = validateCommand(input);

    if (!validation.valid) {
      const errorMsg = getErrorMessage(validation.error || 'INVALID_COMMAND_FORMAT', session.language as 'en' | 'sw');
      return formatErrorResponse(errorMsg, session.language as 'en' | 'sw');
    }

    const command = validation.command!;
    logger.info('Processing shop command', {
      phone,
      shopId,
      type: command.type,
      product: command.productName,
    });

    // Process command based on type
    let response = '';
    let successMsg = '';
    let additionalInfo = '';

    switch (command.type) {
      case 'sold': {
        const result = await recordSale(shopId, command, phone);

        if (!result.success) {
          const errorMsg = getErrorMessage('VALIDATION_ERROR', session.language as 'en' | 'sw');
          return formatErrorResponse(errorMsg, session.language as 'en' | 'sw');
        }

        // Check if stock was low
        if (result.stockAfter !== undefined && result.stockAfter < 5) {
          additionalInfo =
            session.language === 'en'
              ? `⚠️ Low stock: ${result.stockAfter}${command.unit} remaining`
              : `⚠️ Hifadhi chache: ${result.stockAfter}${command.unit} imebaki`;
        }

        successMsg = getSuccessMessage(command, result.stockBefore, result.stockAfter, session.language as 'en' | 'sw');
        response = formatSuccessResponse(successMsg, shopName, session.language as 'en' | 'sw', additionalInfo);

        logger.info('Sale recorded successfully', {
          phone,
          shopId,
          product: command.productName,
          saleId: result.saleId,
        });
        break;
      }

      case 'paid': {
        const result = await recordExpense(shopId, command, phone);

        if (!result.success) {
          const errorMsg = getErrorMessage('VALIDATION_ERROR', session.language as 'en' | 'sw');
          return formatErrorResponse(errorMsg, session.language as 'en' | 'sw');
        }

        successMsg = getSuccessMessage(command, undefined, undefined, session.language as 'en' | 'sw');
        response = formatSuccessResponse(successMsg, shopName, session.language as 'en' | 'sw');

        logger.info('Expense recorded successfully', {
          phone,
          shopId,
          category: command.productName,
          expenseId: result.expenseId,
        });
        break;
      }

      case 'add': {
        const result = await addStock(shopId, command, phone);

        if (!result.success) {
          const errorMsg = getErrorMessage('VALIDATION_ERROR', session.language as 'en' | 'sw');
          return formatErrorResponse(errorMsg, session.language as 'en' | 'sw');
        }

        successMsg = getSuccessMessage(command, undefined, result.stockAfter, session.language as 'en' | 'sw');
        response = formatSuccessResponse(successMsg, shopName, session.language as 'en' | 'sw');

        logger.info('Stock added successfully', {
          phone,
          shopId,
          product: command.productName,
          quantity: command.quantity,
        });
        break;
      }

      case 'edit': {
        const result = await editStock(shopId, command, phone);

        if (!result.success) {
          const errorMsg = getErrorMessage('VALIDATION_ERROR', session.language as 'en' | 'sw');
          return formatErrorResponse(errorMsg, session.language as 'en' | 'sw');
        }

        // Warn if stock went below 0
        if (result.stockAfter !== undefined && result.stockAfter === 0 && command.quantity < 0) {
          additionalInfo =
            session.language === 'en'
              ? '⚠️ Stock is now 0'
              : '⚠️ Hifadhi sasa ni 0';
        }

        successMsg = getSuccessMessage(command, result.stockBefore, result.stockAfter, session.language as 'en' | 'sw');
        response = formatSuccessResponse(successMsg, shopName, session.language as 'en' | 'sw', additionalInfo);

        logger.info('Stock edited successfully', {
          phone,
          shopId,
          product: command.productName,
          change: command.quantity,
        });
        break;
      }

      default:
        return formatErrorResponse(
          getErrorMessage('INVALID_COMMAND_TYPE', session.language as 'en' | 'sw'),
          session.language as 'en' | 'sw'
        );
    }

    return response;
  } catch (error) {
    logger.error('Error handling shop command', { phone, input, error });
    return getMessage('SYSTEM_ERROR', session.language);
  }
}

/**
 * Show command examples and help
 */
export async function handleShopCommandHelp(phone: string, session: Session): Promise<string> {
  const shopName = session.context.shopName as string;

  const helpText =
    session.language === 'en'
      ? `*${shopName}* - Quick Commands 🚀\n\n` +
        `*📊 Sales:*\n` +
        `sold rice 4kg 600\n` +
        `sold sugar 3.5kg 550\n` +
        `sold maizeflour 6 1200\n\n` +
        `*💰 Expenses:*\n` +
        `paid rent 5000\n` +
        `paid utilities 1500\n` +
        `paid xyz 450\n\n` +
        `*📦 Stock Add:*\n` +
        `add rice 25kg\n` +
        `add salt 5\n` +
        `add oil 10liters\n\n` +
        `*✏️ Stock Edit:*\n` +
        `edit rice -2kg (reduce)\n` +
        `edit salt 10 (add)\n` +
        `edit rice 0kg (recount)\n\n` +
        `*Commands Format:*\n` +
        `• space-separated: paid rent 5000\n` +
        `• or dot-separated: paid.rent.5000\n` +
        `• units auto-detect: 4kg, 3.5liters, or just 5\n\n` +
        `📋 Reply *0* for menu or *00* for main menu`
      : `*${shopName}* - Amri za Haraka 🚀\n\n` +
        `*📊 Mauzo:*\n` +
        `sold rice 4kg 600\n` +
        `sold sugar 3.5kg 550\n` +
        `sold maizeflour 6 1200\n\n` +
        `*💰 Matumizi:*\n` +
        `paid rent 5000\n` +
        `paid utilities 1500\n` +
        `paid xyz 450\n\n` +
        `*📦 Ongeza Hifadhi:*\n` +
        `add rice 25kg\n` +
        `add salt 5\n` +
        `add oil 10liters\n\n` +
        `*✏️ Hariri Hifadhi:*\n` +
        `edit rice -2kg (kupunguza)\n` +
        `edit salt 10 (kuongeza)\n` +
        `edit rice 0kg (kuhesabu)\n\n` +
        `*Muundo wa Amri:*\n` +
        `• kwa nafasi: paid rent 5000\n` +
        `• au kwa nukta: paid.rent.5000\n` +
        `• vipimo vya otomatiki: 4kg, 3.5liters, au tu 5\n\n` +
        `📋 Jibu *0* kwa menyu au *00* kwa menyu kuu`;

  return helpText;
}

/**
 * Show today's summary with sales, expenses, and profit
 */
export async function handleShopCommandSummary(phone: string, session: Session): Promise<string> {
  try {
    const shopId = session.context.shopId as string;
    const shopName = session.context.shopName as string;

    if (!shopId) {
      return getMessage('SYSTEM_ERROR', session.language);
    }

    const summary = await getDailySummary(shopId);

    if (!summary) {
      const msg =
        session.language === 'en'
          ? `*${shopName}* - Today's Summary 📊\n\nNo transactions yet today.`
          : `*${shopName}* - Muhtasari wa Leo 📊\n\nHakuna miamala leo.`;

      return (
        msg +
        '\n\n' +
        getMenu('MY_SHOP_MENU', session.language) +
        getMessage('NAVIGATION_HELP', session.language)
      );
    }

    const stockMovementText =
      session.language === 'en'
        ? `Stock Movement:\n• Added: ${Object.entries(summary.stockMovement.added)
            .map(([name, qty]) => `${qty}${name}`)
            .join(', ') || 'None'}\n• Sold: ${Object.entries(summary.stockMovement.sold)
            .map(([name, qty]) => `${qty}${name}`)
            .join(', ') || 'None'}`
        : `Harakati ya Hifadhi:\n• Ongezwa: ${Object.entries(summary.stockMovement.added)
            .map(([name, qty]) => `${qty}${name}`)
            .join(', ') || 'Hakuna'}\n• Kuuzwa: ${Object.entries(summary.stockMovement.sold)
            .map(([name, qty]) => `${qty}${name}`)
            .join(', ') || 'Hakuna'}`;

    const summaryText =
      session.language === 'en'
        ? `*${shopName}* - Today's Summary 📊\n\n` +
          `💰 Total Sales: ${summary.totalSales}\n` +
          `💸 Total Expenses: ${summary.totalExpenses}\n` +
          `📈 Profit: ${summary.profit}\n` +
          `📝 Transactions: ${summary.transactionCount}\n\n` +
          stockMovementText
        : `*${shopName}* - Muhtasari wa Leo 📊\n\n` +
          `💰 Jumla ya Mauzo: ${summary.totalSales}\n` +
          `💸 Jumla ya Matumizi: ${summary.totalExpenses}\n` +
          `📈 Faida: ${summary.profit}\n` +
          `📝 Miamala: ${summary.transactionCount}\n\n` +
          stockMovementText;

    return (
      summaryText +
      '\n\n' +
      getMenu('MY_SHOP_MENU', session.language) +
      getMessage('NAVIGATION_HELP', session.language)
    );
  } catch (error) {
    logger.error('Error getting summary', { phone, error });
    return getMessage('SYSTEM_ERROR', session.language);
  }
}

/**
 * Show current stock levels
 */
export async function handleShopCommandViewStock(phone: string, session: Session): Promise<string> {
  try {
    const shopId = session.context.shopId as string;
    const shopName = session.context.shopName as string;

    if (!shopId) {
      return getMessage('SYSTEM_ERROR', session.language);
    }

    const stocks = await getAllProductsStock(shopId);

    if (Object.keys(stocks).length === 0) {
      const msg =
        session.language === 'en'
          ? `*${shopName}* - Current Stock 📦\n\nNo stock recorded yet.`
          : `*${shopName}* - Hifadhi ya Sasa 📦\n\nHakuna hifadhi iliyoandikwa.`;

      return (
        msg +
        '\n\n' +
        getMenu('MY_SHOP_MENU', session.language) +
        getMessage('NAVIGATION_HELP', session.language)
      );
    }

    const stockList = Object.entries(stocks)
      .map(([name, record]) => `• ${name}: ${record.quantity}${record.unit}`)
      .join('\n');

    const stockText =
      session.language === 'en'
        ? `*${shopName}* - Current Stock 📦\n\n${stockList}`
        : `*${shopName}* - Hifadhi ya Sasa 📦\n\n${stockList}`;

    return (
      stockText +
      '\n\n' +
      getMenu('MY_SHOP_MENU', session.language) +
      getMessage('NAVIGATION_HELP', session.language)
    );
  } catch (error) {
    logger.error('Error getting stock', { phone, error });
    return getMessage('SYSTEM_ERROR', session.language);
  }
}
