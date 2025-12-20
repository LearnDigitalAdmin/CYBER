/**
 * Language Selection Handler
 * Handles user language selection (English or Swahili)
 */

import { Session } from '../types/session.types';
import { updateSessionLanguage, updateSessionState } from '../services/session.service';
import { validateMenuSelection } from '../utils/validator';
import { getMessage } from '../constants/messages';
import { getMenu } from '../constants/menus';
import { STATE } from '../constants/states';
import { logger } from '../utils/logger';

/**
 * Handle language selection
 * User replies with 1 (English) or 2 (Swahili)
 */
export async function handleLanguageSelection(phone: string, input: string, session: Session): Promise<string> {
  try {
    // Validate input (1 or 2)
    const validation = validateMenuSelection(input, 1, 2);

    if (!validation.valid || validation.option === undefined) {
      return getMenu('WELCOME', session.language);
    }

    const option = validation.option;
    const language: 'en' | 'sw' = option === 1 ? 'en' : 'sw';

    // Update session with selected language and move to main menu
    await updateSessionLanguage(phone, language);
    await updateSessionState(phone, STATE.MAIN_MENU, {});

    logger.info('Language selected', { language });

    // Show main menu in selected language
    return getMenu('MAIN_MENU', language);
  } catch (error) {
    logger.error('Error handling language selection', error);
    return getMessage('SYSTEM_ERROR', session.language);
  }
}
