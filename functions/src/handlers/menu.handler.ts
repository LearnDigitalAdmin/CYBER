/**
 * Main Menu Handler
 * Routes user selections from the main menu
 */

import { Session } from '../types/session.types';
import { updateSessionState } from '../services/session.service';
import { validateMenuSelection } from '../utils/validator';
import { getMessage } from '../constants/messages';
import { getMenu } from '../constants/menus';
import { STATE } from '../constants/states';
import { logger } from '../utils/logger';

/**
 * Handle main menu selection
 * User can select from 1-8
 */
export async function handleMainMenu(phone: string, input: string, session: Session): Promise<string> {
  try {
    // Validate input (1-8)
    const validation = validateMenuSelection(input, 1, 8);

    if (!validation.valid || validation.option === undefined) {
      return getMenu('MAIN_MENU', session.language);
    }

    const option = validation.option;

    switch (option) {
      case 1: // Pay Rent
        await updateSessionState(phone, STATE.PAY_RENT_WAITING_ID, {});
        logger.info('Navigating to Pay Rent');
        return getMessage('ENTER_NATIONAL_ID', session.language);

      case 2: // Get Rent Invoice
        await updateSessionState(phone, STATE.GET_INVOICE_WAITING_ID, {});
        logger.info('Navigating to Get Invoice');
        return getMessage('ENTER_NATIONAL_ID', session.language);

      case 3: // Add Shop
        await updateSessionState(phone, STATE.ADD_SHOP_OWNER_NAME, {});
        logger.info('Navigating to Add Shop');
        const addShopMessage = session.language === 'en' ? "Let's set up your shop! 🏪\n\n" : "Hebu kusanidi duka lako! 🏪\n\n";
        return addShopMessage + getMessage('ENTER_FULL_NAME', session.language);

      case 4: // My Shop
        await updateSessionState(phone, STATE.MY_SHOP_AUTH, {});
        logger.info('Navigating to My Shop');
        return getMessage('ENTER_NATIONAL_ID', session.language);

      case 5: // Pay Bill
        await updateSessionState(phone, STATE.PAY_BILL_MENU, {});
        logger.info('Navigating to Pay Bill');
        return getMenu('PAY_BILL_MENU', session.language);

      case 6: // Manage My Plot
        logger.info('Showing PMS links');
        const label = session.language === 'en' ? 'Manage Your Property' : 'Simamia Kipande Chako';
        const message = session.language === 'en'
          ? `${label}\n\n📱 Mobile App (Android): https://play.google.com/store/apps/details?id=co.ke.cogvana.pms\n\n🌐 Web Portal: https://pms.cogvana.co.ke\n\n💻 Cyber Portal: https://cyber.cogvana.co.ke`
          : `${label}\n\n📱 Programu ya Simu (Android): https://play.google.com/store/apps/details?id=co.ke.cogvana.pms\n\n🌐 Portali ya Web: https://pms.cogvana.co.ke\n\n💻 Portali ya Cyber: https://cyber.cogvana.co.ke`;
        return message + '\n\n' + (session.language === 'en' ? 'Reply 0 to return to Main Menu' : 'Jibu 0 kurudi kwenye Menuu Kuu');

      case 7: // Exit
        await updateSessionState(phone, STATE.IDLE, {});
        logger.info('User exiting');
        return getMessage('GOODBYE', session.language);

      case 8: // Help
        await updateSessionState(phone, STATE.HELP_MENU, {});
        logger.info('Navigating to Help');
        return getMenu('HELP_MENU', session.language);

      default:
        return getMenu('MAIN_MENU', session.language);
    }
  } catch (error) {
    logger.error('Error handling main menu', error);
    return getMessage('SYSTEM_ERROR', session.language);
  }
}

/**
 * Handle returning to main menu (when user enters 0 from sub-menus)
 */
export async function returnToMainMenu(phone: string, session: Session): Promise<string> {
  try {
    await updateSessionState(phone, STATE.MAIN_MENU, {});
    logger.info('Returning to main menu');
    return getMenu('MAIN_MENU', session.language);
  } catch (error) {
    logger.error('Error returning to main menu', error);
    return getMessage('SYSTEM_ERROR', session.language);
  }
}
