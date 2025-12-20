/**
 * Bill Handler
 * Handles Pay Bill flows
 */

import { Session } from '../types/session.types';
import { updateSessionState } from '../services/session.service';
import { parsePayBillCommand } from '../utils/parser';
import { getMessage } from '../constants/messages';
import { STATE } from '../constants/states';
import { logger } from '../utils/logger';

/**
 * Handle pay bill menu selection
 */
export async function handlePayBillMenu(phone: string, input: string, session: Session): Promise<string> {
  try {
    const option = parseInt(input.trim(), 10);

    if (isNaN(option) || option < 1 || option > 3) {
      const label = session.language === 'en' ? '*Pay Bill*' : '*Lipa Bill*';
      const message = session.language === 'en'
        ? `${label}\n\n1. Pay My Bill\n2. Charge Customer\n3. Back to Main Menu`
        : `${label}\n\n1. Lipa Bill Yangu\n2. Chaji Mteja\n3. Rudi kwenye Menuu Kuu`;
      return message;
    }

    switch (option) {
      case 1: // Pay My Bill
        await updateSessionState(phone, STATE.PAY_BILL_COMMAND, {});
        logger.info('User starting Pay My Bill');
        return session.language === 'en'
          ? 'Enter payment command: pay{amount}frm{phone}\n\nExample: pay500frm0712345678'
          : 'Ingiza amri ya malipo: pay{kiasi}frm{simu}\n\nMfano: pay500frm0712345678';

      case 2: // Charge Customer
        await updateSessionState(phone, STATE.PAY_BILL_COMMAND, {});
        logger.info('User starting Charge Customer');
        return session.language === 'en'
          ? 'Enter command: pay{amount}frm{customer_phone}\n\nExample: pay500frm0712345678'
          : 'Ingiza amri: pay{kiasi}frm{simu_ya_mteja}\n\nMfano: pay500frm0712345678';

      case 3: // Back to Main Menu
        await updateSessionState(phone, STATE.MAIN_MENU, {});
        return session.language === 'en'
          ? '*Main Menu*\n\n1. Pay Rent\n2. Get Rent Invoice\n3. Add Shop\n4. My Shop\n5. Pay Bill\n6. Manage My Plot\n7. Exit\n8. Help'
          : '*Menuu Kuu*\n\n1. Lipa Kodi\n2. Pata Ankara ya Kodi\n3. Ongeza Duka\n4. Duka Langu\n5. Lipa Bill\n6. Simamia Kipande Changu\n7. Toka\n8. Msaada';

      default:
        return getMessage('INVALID_INPUT', session.language);
    }
  } catch (error) {
    logger.error('Error handling pay bill menu', error);
    return getMessage('SYSTEM_ERROR', session.language);
  }
}

/**
 * Handle pay bill command
 */
export async function handlePayBillCommand(phone: string, input: string, session: Session): Promise<string> {
  try {
    // Parse the command
    const parsed = parsePayBillCommand(input);

    if (!parsed.valid) {
      logger.info('Invalid pay bill command', { input });
      return session.language === 'en'
        ? 'Invalid format. Please use: pay{amount}frm{phone}\n\nExample: pay500frm0712345678'
        : 'Muundo si sahihi. Tafadhali tumia: pay{kiasi}frm{simu}\n\nMfano: pay500frm0712345678';
    }

    // Move to confirmation state
    await updateSessionState(phone, STATE.PAY_BILL_CONFIRM, {
      billAmount: parsed.amount,
      billPayer: parsed.phone,
    });

    logger.info('Pay bill command parsed', { amount: parsed.amount, phone: parsed.phone });

    const amount = parsed.amount;
    const confirmMessage = session.language === 'en'
      ? `Confirm payment:\n\nAmount: Ksh ${amount}\nRecipient: ${parsed.phone}\n\n${getMessage('CONFIRM_PAY', session.language)}`
      : `Baini malipo:\n\nKiasi: Ksh ${amount}\nMpokea: ${parsed.phone}\n\n${getMessage('CONFIRM_PAY', session.language)}`;

    return confirmMessage;
  } catch (error) {
    logger.error('Error handling pay bill command', error);
    return getMessage('SYSTEM_ERROR', session.language);
  }
}
