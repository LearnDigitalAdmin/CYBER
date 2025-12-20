/**
 * Transaction Handler
 * Handles recording sales and expenses for shops
 */

import { Session } from '../types/session.types';
import { updateSessionState, updateSessionContext } from '../services/session.service';
import { validateAmount, validateTextInput } from '../utils/validator';
import { getMessage } from '../constants/messages';
import { getMenu } from '../constants/menus';
import { STATE } from '../constants/states';
import { logger } from '../utils/logger';

/**
 * Step 1: Collect sale amount
 */
export async function handleRecordSaleAmount(phone: string, input: string, session: Session): Promise<string> {
  try {
    const validation = validateAmount(input);

    if (!validation.valid || validation.amount === undefined) {
      return getMessage('INVALID_AMOUNT', session.language);
    }

    const amount = validation.amount;

    await updateSessionContext(phone, { saleAmount: amount });
    await updateSessionState(phone, STATE.RECORD_SALE_METHOD, {});

    logger.info('Sale amount collected', { amount });
    return getMenu('PAYMENT_METHODS', session.language);
  } catch (error) {
    logger.error('Error handling sale amount', error);
    return getMessage('SYSTEM_ERROR', session.language);
  }
}

/**
 * Step 2: Collect payment method
 */
export async function handleRecordSaleMethod(phone: string, input: string, session: Session): Promise<string> {
  try {
    const option = parseInt(input.trim(), 10);

    if (isNaN(option) || option < 1 || option > 4) {
      return getMenu('PAYMENT_METHODS', session.language);
    }

    const paymentMethod = input.trim();

    await updateSessionContext(phone, { paymentMethod });
    await updateSessionState(phone, STATE.RECORD_SALE_DESCRIPTION, {});

    logger.info('Payment method collected', { paymentMethod });

    const prompt = session.language === 'en' ? 'Add a description (optional, reply SKIP to skip):' : 'Ongeza maelezo (isimu, jibu SKIP kuacha):';
    return prompt;
  } catch (error) {
    logger.error('Error handling sale payment method', error);
    return getMessage('SYSTEM_ERROR', session.language);
  }
}

/**
 * Step 3: Collect optional description and complete sale
 */
export async function handleRecordSaleDescription(phone: string, input: string, session: Session): Promise<string> {
  try {
    const context = session.context;
    let saleDescription = '';

    if (input.trim().toUpperCase() !== 'SKIP') {
      if (!validateTextInput(input, 0, 200)) {
        const prompt = session.language === 'en'
          ? 'Description too long (max 200 chars). Try again or reply SKIP:'
          : 'Maelezo ni marefu sana (upeo 200). Jaribu tena au jibu SKIP:';
        return prompt;
      }
      saleDescription = input.trim();
    }

    // TODO: Save transaction to Firestore
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-KE', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const successMessage = getMessage('TRANSACTION_RECORDED', session.language, {
      amount: context.saleAmount?.toString() || '0',
      type: session.language === 'en' ? 'Sale' : 'Mauzo',
      time: timeStr,
    });

    await updateSessionState(phone, STATE.MY_SHOP_MENU, {});

    logger.info('Sale recorded', { amount: context.saleAmount, description: saleDescription });

    // Show menu again
    return successMessage + '\n\n' + getMenu('MY_SHOP_MENU', session.language);
  } catch (error) {
    logger.error('Error handling sale description', error);
    return getMessage('SYSTEM_ERROR', session.language);
  }
}

/**
 * Step 1: Collect expense amount
 */
export async function handleRecordExpenseAmount(phone: string, input: string, session: Session): Promise<string> {
  try {
    const validation = validateAmount(input);

    if (!validation.valid || validation.amount === undefined) {
      return getMessage('INVALID_AMOUNT', session.language);
    }

    const amount = validation.amount;

    await updateSessionContext(phone, { expenseAmount: amount });
    await updateSessionState(phone, STATE.RECORD_EXPENSE_CATEGORY, {});

    logger.info('Expense amount collected', { amount });
    return getMenu('EXPENSE_CATEGORIES', session.language);
  } catch (error) {
    logger.error('Error handling expense amount', error);
    return getMessage('SYSTEM_ERROR', session.language);
  }
}

/**
 * Step 2: Collect expense category
 */
export async function handleRecordExpenseCategory(phone: string, input: string, session: Session): Promise<string> {
  try {
    const option = parseInt(input.trim(), 10);

    if (isNaN(option) || option < 1 || option > 5) {
      return getMenu('EXPENSE_CATEGORIES', session.language);
    }

    const category = input.trim();

    await updateSessionContext(phone, { expenseCategory: category });
    await updateSessionState(phone, STATE.RECORD_EXPENSE_DESCRIPTION, {});

    logger.info('Expense category collected', { category });

    const prompt = session.language === 'en' ? 'Add a description (optional, reply SKIP to skip):' : 'Ongeza maelezo (isimu, jibu SKIP kuacha):';
    return prompt;
  } catch (error) {
    logger.error('Error handling expense category', error);
    return getMessage('SYSTEM_ERROR', session.language);
  }
}

/**
 * Step 3: Collect optional description and complete expense
 */
export async function handleRecordExpenseDescription(phone: string, input: string, session: Session): Promise<string> {
  try {
    const context = session.context;
    let expenseDescription = '';

    if (input.trim().toUpperCase() !== 'SKIP') {
      if (!validateTextInput(input, 0, 200)) {
        const prompt = session.language === 'en'
          ? 'Description too long (max 200 chars). Try again or reply SKIP:'
          : 'Maelezo ni marefu sana (upeo 200). Jaribu tena au jibu SKIP:';
        return prompt;
      }
      expenseDescription = input.trim();
    }

    // TODO: Save transaction to Firestore
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-KE', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const successMessage = getMessage('TRANSACTION_RECORDED', session.language, {
      amount: context.expenseAmount?.toString() || '0',
      type: session.language === 'en' ? 'Expense' : 'Matumizi',
      time: timeStr,
    });

    await updateSessionState(phone, STATE.MY_SHOP_MENU, {});

    logger.info('Expense recorded', { amount: context.expenseAmount, description: expenseDescription });

    // Show menu again
    return successMessage + '\n\n' + getMenu('MY_SHOP_MENU', session.language);
  } catch (error) {
    logger.error('Error handling expense description', error);
    return getMessage('SYSTEM_ERROR', session.language);
  }
}
