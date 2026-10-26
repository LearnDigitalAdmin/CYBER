/**
 * Language Selection Handler
 * Handles user language selection (English or Swahili) from the welcome buttons (typed 1 / 2 also work).
 */

import { Session } from '../types/session.types';
import { updateSessionLanguage, updateSessionState } from '../services/session.service';
import { validateMenuSelection } from '../utils/validator';
import { getMessage } from '../constants/messages';
import { STATE } from '../constants/states';
import { logger } from '../utils/logger';
import { mainMenuReply, Reply, welcomeReply } from '../utils/ui';

/**
 * Handle language selection
 * User taps English / Kiswahili (or replies with 1 / 2)
 */
export async function handleLanguageSelection(phone: string, input: string, session: Session): Promise<Reply> {
  try {
    // Validate input (1 or 2)
    const validation = validateMenuSelection(input, 1, 2);

    if (!validation.valid || validation.option === undefined) {
      return welcomeReply();
    }

    const option = validation.option;
    const language: 'en' | 'sw' = option === 1 ? 'en' : 'sw';

    // Update session with selected language and move to main menu
    await updateSessionLanguage(phone, language);
    await updateSessionState(phone, STATE.MAIN_MENU, {});

    logger.info('Language selected', { language });

    // Show main menu in selected language
    return mainMenuReply(language);
  } catch (error) {
    logger.error('Error handling language selection', error);
    return getMessage('SYSTEM_ERROR', session.language);
  }
}
