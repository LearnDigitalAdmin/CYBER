/**
 * Shop Handler
 * Handles complete Add Shop flow with proper validation, error handling, and navigation
 */

import { Session } from '../types/session.types';
import { updateSessionState, updateSessionContext, clearSessionContext } from '../services/session.service';
import {
  validateTextInput,
  validateNationalId,
  validatePhoneNumber,
  validateEmail,
  validateEmployees,
  checkNavigationCommand,
  validateMenuSelection,
} from '../utils/validator';
import { getMessage } from '../constants/messages';
import { getMenu } from '../constants/menus';
import { STATE } from '../constants/states';
import { logger } from '../utils/logger';
import { createShop, getShopByNationalId } from '../services/shop.service';
import {
  handleShopCommandSummary,
  handleShopCommandViewStock,
  handleShopCommandHelp,
} from './shop.command.handler';
import {
  handleWeeklyReportMenu,
  handleMonthlyReportMenu,
} from './report.menu.handler';

/**
 * Helper: Handle navigation commands (0, 00, 000)
 * Returns response message or null if no navigation command
 */
async function handleNavigation(
  phone: string,
  input: string,
  session: Session,
  previousState?: STATE
): Promise<{ response: string | null; handled: boolean }> {
  const nav = checkNavigationCommand(input);

  if (nav.type === 'exit') {
    // 000: Exit to language selection - kill session
    logger.info('User exiting to language selection', { phone });
    await clearSessionContext(phone);
    await updateSessionState(phone, STATE.LANGUAGE_SELECTION, {});
    return {
      response: getMenu('WELCOME', session.language),
      handled: true,
    };
  }

  if (nav.type === 'restart') {
    // 00: Start over from beginning - clear context
    logger.info('User restarting shop creation', { phone });
    await clearSessionContext(phone);
    await updateSessionState(phone, STATE.ADD_SHOP_OWNER_NAME, {});
    const startMessage = session.language === 'en' ? "Let's set up your shop! 🏪\n\n" : "Hebu kusanidi duka lako! 🏪\n\n";
    return {
      response: startMessage + getMessage('ENTER_FULL_NAME', session.language) + getMessage('NAVIGATION_HELP', session.language),
      handled: true,
    };
  }

  if (nav.type === 'back') {
    // 0: Back to previous step
    if (!previousState) {
      // No previous state - show error
      return {
        response: getMessage('INVALID_INPUT', session.language),
        handled: true,
      };
    }

    logger.info('User going back', { phone, from: session.currentState, to: previousState });
    await updateSessionState(phone, previousState, {});

    // Return appropriate message for the previous state
    // This will be handled by the next message flow
    return {
      response: null, // Let the state handler generate the message
      handled: true,
    };
  }

  return { response: null, handled: false };
}

/**
 * Step 1: Collect shop owner name
 */
export async function handleAddShopOwnerName(phone: string, input: string, session: Session): Promise<string> {
  try {
    // Check for navigation commands
    const nav = await handleNavigation(phone, input, session);
    if (nav.handled && nav.response) return nav.response;
    if (nav.handled) {
      // Back command - but no previous state, so show this step again
      const msg = getMessage('ENTER_FULL_NAME', session.language) + getMessage('NAVIGATION_HELP', session.language);
      return msg;
    }

    // Validate input
    if (!validateTextInput(input, 2, 50)) {
      return getMessage('INVALID_INPUT', session.language) + getMessage('NAVIGATION_HELP', session.language);
    }

    const ownerName = input.trim();

    await updateSessionContext(phone, { ownerName });
    await updateSessionState(phone, STATE.ADD_SHOP_BUSINESS_TYPE, {});

    logger.info('Owner name collected', { ownerName });
    return getMenu('BUSINESS_TYPES', session.language) + getMessage('NAVIGATION_HELP', session.language);
  } catch (error) {
    logger.error('Error handling shop owner name', error);
    return getMessage('SYSTEM_ERROR', session.language);
  }
}

/**
 * Step 2: Collect business type
 */
export async function handleAddShopBusinessType(phone: string, input: string, session: Session): Promise<string> {
  try {
    // Check for navigation commands
    const nav = await handleNavigation(phone, input, session, STATE.ADD_SHOP_OWNER_NAME);
    if (nav.handled && nav.response) return nav.response;
    if (nav.handled) {
      // Back command - go to owner name
      const msg = getMessage('ENTER_FULL_NAME', session.language) + getMessage('NAVIGATION_HELP', session.language);
      return msg;
    }

    const option = parseInt(input.trim(), 10);

    if (isNaN(option) || option < 1 || option > 8) {
      return getMenu('BUSINESS_TYPES', session.language) + getMessage('NAVIGATION_HELP', session.language);
    }

    const businessType = input.trim();

    await updateSessionContext(phone, { businessType });
    await updateSessionState(phone, STATE.ADD_SHOP_NAME, {});

    logger.info('Business type collected', { businessType });
    return getMessage('ENTER_SHOP_NAME', session.language) + getMessage('NAVIGATION_HELP', session.language);
  } catch (error) {
    logger.error('Error handling shop business type', error);
    return getMessage('SYSTEM_ERROR', session.language);
  }
}

/**
 * Step 3: Collect shop name
 */
export async function handleAddShopName(phone: string, input: string, session: Session): Promise<string> {
  try {
    // Check for navigation commands
    const nav = await handleNavigation(phone, input, session, STATE.ADD_SHOP_BUSINESS_TYPE);
    if (nav.handled && nav.response) return nav.response;
    if (nav.handled) {
      return getMenu('BUSINESS_TYPES', session.language) + getMessage('NAVIGATION_HELP', session.language);
    }

    if (!validateTextInput(input, 2, 100)) {
      return getMessage('INVALID_INPUT', session.language) + getMessage('NAVIGATION_HELP', session.language);
    }

    const shopName = input.trim();

    await updateSessionContext(phone, { shopName });
    await updateSessionState(phone, STATE.ADD_SHOP_LOCATION, {});

    logger.info('Shop name collected', { shopName });
    return getMessage('ENTER_LOCATION', session.language) + getMessage('NAVIGATION_HELP', session.language);
  } catch (error) {
    logger.error('Error handling shop name', error);
    return getMessage('SYSTEM_ERROR', session.language);
  }
}

/**
 * Step 4: Collect shop location
 */
export async function handleAddShopLocation(phone: string, input: string, session: Session): Promise<string> {
  try {
    // Check for navigation commands
    const nav = await handleNavigation(phone, input, session, STATE.ADD_SHOP_NAME);
    if (nav.handled && nav.response) return nav.response;
    if (nav.handled) {
      return getMessage('ENTER_SHOP_NAME', session.language) + getMessage('NAVIGATION_HELP', session.language);
    }

    if (!validateTextInput(input, 2, 100)) {
      return getMessage('INVALID_LOCATION', session.language) + getMessage('NAVIGATION_HELP', session.language);
    }

    const location = input.trim();

    await updateSessionContext(phone, { location });
    await updateSessionState(phone, STATE.ADD_SHOP_EMPLOYEES, {});

    logger.info('Location collected', { location });
    return getMessage('ENTER_EMPLOYEES', session.language) + getMessage('NAVIGATION_HELP', session.language);
  } catch (error) {
    logger.error('Error handling shop location', error);
    return getMessage('SYSTEM_ERROR', session.language);
  }
}

/**
 * Step 5: Collect total employees
 */
export async function handleAddShopEmployees(phone: string, input: string, session: Session): Promise<string> {
  try {
    // Check for navigation commands
    const nav = await handleNavigation(phone, input, session, STATE.ADD_SHOP_LOCATION);
    if (nav.handled && nav.response) return nav.response;
    if (nav.handled) {
      return getMessage('ENTER_LOCATION', session.language) + getMessage('NAVIGATION_HELP', session.language);
    }

    const validation = validateEmployees(input);

    if (!validation.valid) {
      return getMessage('INVALID_EMPLOYEES', session.language) + getMessage('NAVIGATION_HELP', session.language);
    }

    await updateSessionContext(phone, { totalEmployees: validation.count });
    await updateSessionState(phone, STATE.ADD_SHOP_NATIONAL_ID, {});

    logger.info('Employees count collected', { totalEmployees: validation.count });
    return getMessage('ENTER_NATIONAL_ID', session.language) + getMessage('NAVIGATION_HELP', session.language);
  } catch (error) {
    logger.error('Error handling shop employees', error);
    return getMessage('SYSTEM_ERROR', session.language);
  }
}

/**
 * Step 6: Collect National ID
 */
export async function handleAddShopNationalId(phone: string, input: string, session: Session): Promise<string> {
  try {
    // Check for navigation commands
    const nav = await handleNavigation(phone, input, session, STATE.ADD_SHOP_EMPLOYEES);
    if (nav.handled && nav.response) return nav.response;
    if (nav.handled) {
      return getMessage('ENTER_EMPLOYEES', session.language) + getMessage('NAVIGATION_HELP', session.language);
    }

    if (!validateNationalId(input)) {
      return getMessage('INVALID_ID', session.language) + getMessage('NAVIGATION_HELP', session.language);
    }

    const nationalId = input.trim();

    // Check if shop already exists for this national ID
    const existingShop = await getShopByNationalId(nationalId);
    if (existingShop) {
      logger.warn('Duplicate shop national ID', { nationalId });
      return getMessage('SHOP_ALREADY_EXISTS', session.language) + getMessage('NAVIGATION_HELP', session.language);
    }

    await updateSessionContext(phone, { nationalId });
    await updateSessionState(phone, STATE.ADD_SHOP_EMAIL, {});

    logger.info('National ID collected', { nationalId });
    return getMessage('ENTER_EMAIL', session.language) + getMessage('NAVIGATION_HELP', session.language);
  } catch (error) {
    logger.error('Error handling shop national ID', error);
    return getMessage('SYSTEM_ERROR', session.language);
  }
}

/**
 * Step 7: Collect email
 */
export async function handleAddShopEmail(phone: string, input: string, session: Session): Promise<string> {
  try {
    // Check for navigation commands
    const nav = await handleNavigation(phone, input, session, STATE.ADD_SHOP_NATIONAL_ID);
    if (nav.handled && nav.response) return nav.response;
    if (nav.handled) {
      return getMessage('ENTER_NATIONAL_ID', session.language) + getMessage('NAVIGATION_HELP', session.language);
    }

    const email = input.trim().toLowerCase();

    if (!validateEmail(email)) {
      return getMessage('INVALID_EMAIL', session.language) + getMessage('NAVIGATION_HELP', session.language);
    }

    await updateSessionContext(phone, { email });
    await updateSessionState(phone, STATE.ADD_SHOP_PHONE, {});

    logger.info('Email collected', { email });
    return getMessage('ENTER_PHONE', session.language) + getMessage('NAVIGATION_HELP', session.language);
  } catch (error) {
    logger.error('Error handling shop email', error);
    return getMessage('SYSTEM_ERROR', session.language);
  }
}

/**
 * Step 8: Collect phone number
 */
export async function handleAddShopPhone(phone: string, input: string, session: Session): Promise<string> {
  try {
    // Check for navigation commands
    const nav = await handleNavigation(phone, input, session, STATE.ADD_SHOP_EMAIL);
    if (nav.handled && nav.response) return nav.response;
    if (nav.handled) {
      return getMessage('ENTER_EMAIL', session.language) + getMessage('NAVIGATION_HELP', session.language);
    }

    const validation = validatePhoneNumber(input);

    if (!validation.valid || !validation.formatted) {
      return getMessage('INVALID_PHONE', session.language) + getMessage('NAVIGATION_HELP', session.language);
    }

    await updateSessionContext(phone, { shopPhone: validation.formatted });
    await updateSessionState(phone, STATE.ADD_SHOP_CONFIRMATION, {});

    logger.info('Phone collected', { phone: validation.formatted });

    // Generate confirmation message
    const context = session.context;
    const ownerName = context.ownerName as string;
    const businessType = context.businessType as string;
    const shopName = context.shopName as string;
    const location = context.location as string;
    const totalEmployees = context.totalEmployees as number;
    const nationalId = context.nationalId as string;
    const email = context.email as string;

    const confirmationMessage = getMessage('SHOP_CONFIRMATION', session.language, {
      ownerName,
      businessType,
      shopName,
      location,
      employees: totalEmployees.toString(),
      nationalId,
      email,
      phone: validation.formatted,
    });

    return confirmationMessage + getMessage('NAVIGATION_HELP', session.language);
  } catch (error) {
    logger.error('Error handling shop phone', error);
    return getMessage('SYSTEM_ERROR', session.language);
  }
}

/**
 * Step 9: Confirm shop details
 */
export async function handleAddShopConfirmation(phone: string, input: string, session: Session): Promise<string> {
  try {
    // Check for navigation commands first
    const nav = await handleNavigation(phone, input, session, STATE.ADD_SHOP_PHONE);
    if (nav.handled && nav.response) return nav.response;
    if (nav.handled) {
      return getMessage('ENTER_PHONE', session.language) + getMessage('NAVIGATION_HELP', session.language);
    }

    const response = input.trim().toUpperCase();

    // Check for YES confirmation
    if (['YES', 'Y', 'NDIO', 'NDIYO'].includes(response)) {
      logger.info('Shop creation confirmed, processing');
      await updateSessionState(phone, STATE.ADD_SHOP_PROCESSING, {});
      return await completeShopCreation(phone, session);
    }

    // Check for EDIT request
    if (['EDIT', 'BAGUISHA', 'NO', 'N'].includes(response)) {
      logger.info('User requested edit, returning to owner name');
      await clearSessionContext(phone);
      await updateSessionState(phone, STATE.ADD_SHOP_OWNER_NAME, {});
      const startMessage = session.language === 'en' ? "Let's set up your shop again! 🏪\n\n" : "Hebu kusanidi duka tena! 🏪\n\n";
      return startMessage + getMessage('ENTER_FULL_NAME', session.language) + getMessage('NAVIGATION_HELP', session.language);
    }

    // Invalid response
    const context = session.context;
    return (
      getMessage('INVALID_INPUT', session.language) +
      '\n\n' +
      getMessage('SHOP_CONFIRMATION', session.language, {
        ownerName: context.ownerName as string,
        businessType: context.businessType as string,
        shopName: context.shopName as string,
        location: context.location as string,
        employees: (context.totalEmployees as number).toString(),
        nationalId: context.nationalId as string,
        email: context.email as string,
        phone: context.shopPhone as string,
      }) +
      getMessage('NAVIGATION_HELP', session.language)
    );
  } catch (error) {
    logger.error('Error handling shop confirmation', error);
    return getMessage('SYSTEM_ERROR', session.language);
  }
}

/**
 * Complete shop creation - save to database and create auth account
 */
async function completeShopCreation(phone: string, session: Session): Promise<string> {
  try {
    // Get all context data
    const context = session.context;
    const ownerName = context.ownerName as string;
    const shopName = context.shopName as string;
    const location = context.location as string;
    const totalEmployees = context.totalEmployees as number;
    const nationalId = context.nationalId as string;
    const email = context.email as string;
    const shopPhone = context.shopPhone as string;
    const businessType = context.businessType as string;

    // Validate all required fields exist
    if (!ownerName || !shopName || !location || totalEmployees === undefined || !nationalId || !email || !shopPhone || !businessType) {
      logger.error('Missing shop creation data', { context });
      await clearSessionContext(phone);
      await updateSessionState(phone, STATE.MAIN_MENU, {});
      return getMessage('SYSTEM_ERROR', session.language);
    }

    logger.info('Creating shop', {
      ownerName,
      shopName,
      nationalId,
      email,
    });

    // Create shop with Firebase Auth
    // Password is the national ID
    const shop = await createShop(
      {
        ownerName,
        shopName,
        location,
        totalEmployees,
        nationalId,
        phone: shopPhone,
        email,
        businessType,
      },
      nationalId // Use national ID as password
    );

    logger.info('Shop created successfully', {
      shopId: shop.id,
      ownerName,
      firebaseUid: shop.firebaseUid,
    });

    // Generate success message with all details
    const successMessage = getMessage('SHOP_CREATED_SUCCESS', session.language, {
      ownerName,
      shopName,
      location,
      employees: totalEmployees.toString(),
      businessType,
      email,
      password: nationalId,
    });

    // Clear session context and return to main menu
    await clearSessionContext(phone);
    await updateSessionState(phone, STATE.MAIN_MENU, {});

    // Add message to return to main menu
    const returnMsg = session.language === 'en' ? '\n\nReturning to Main Menu...' : '\n\nKurudi kwenye Menuu Kuu...';
    return successMessage + returnMsg;
  } catch (error) {
    logger.error('Error completing shop creation', error);

    // Clear session on error
    await clearSessionContext(phone);
    await updateSessionState(phone, STATE.MAIN_MENU, {});

    // Return specific error message
    if (error instanceof Error) {
      if (error.message.includes('already exists')) {
        return getMessage('SHOP_ALREADY_EXISTS', session.language);
      } else if (error.message.includes('email')) {
        return getMessage('EMAIL_ALREADY_EXISTS', session.language);
      }
    }

    return getMessage('SYSTEM_ERROR', session.language);
  }
}

/**
 * My Shop Authentication - Verify user by National ID
 */
export async function handleMyShopAuth(phone: string, input: string, session: Session): Promise<string> {
  try {
    // Check for navigation commands
    const nav = await handleNavigation(phone, input, session);
    if (nav.handled && nav.response) return nav.response;
    if (nav.handled) {
      return getMessage('ENTER_NATIONAL_ID', session.language) + getMessage('NAVIGATION_HELP', session.language);
    }

    // Validate national ID (7-10 digits)
    if (!validateNationalId(input)) {
      return getMessage('INVALID_INPUT', session.language) + '\n\n' + getMessage('ENTER_NATIONAL_ID', session.language) + getMessage('NAVIGATION_HELP', session.language);
    }

    const nationalId = input.trim();
    logger.info('Authenticating shop by national ID', { nationalId });

    // Find shop by national ID
    const shop = await getShopByNationalId(nationalId);

    if (!shop) {
      logger.warn('Shop not found for national ID', { nationalId });
      return (
        getMessage('SHOP_NOT_FOUND', session.language) +
        '\n\n' +
        getMessage('ENTER_NATIONAL_ID', session.language) +
        getMessage('NAVIGATION_HELP', session.language)
      );
    }

    logger.info('Shop found', { shopId: shop.id, shopName: shop.shopName });

    // Store shop info in session context
    await updateSessionContext(phone, {
      shopId: shop.id,
      shopName: shop.shopName,
      ownerName: shop.ownerName,
      businessType: shop.businessType,
      location: shop.location,
      totalEmployees: shop.totalEmployees,
      shopPhone: shop.phone,
      shopEmail: shop.email,
    });

    // Move to shop menu
    await updateSessionState(phone, STATE.MY_SHOP_MENU, {});

    // Return shop details
    const shopDetails = session.language === 'en'
      ? `*Shop Details* 🏪\n\n*Owner:* ${shop.ownerName}\n*Shop:* ${shop.shopName}\n*Location:* ${shop.location}\n*Business Type:* ${shop.businessType}\n*Employees:* ${shop.totalEmployees}\n*Phone:* ${shop.phone}\n*Email:* ${shop.email}`
      : `*Maelezo ya Duka* 🏪\n\n*Mmiliki:* ${shop.ownerName}\n*Duka:* ${shop.shopName}\n*Mahali:* ${shop.location}\n*Aina ya Biashara:* ${shop.businessType}\n*Wafanyakazi:* ${shop.totalEmployees}\n*Simu:* ${shop.phone}\n*Barua:* ${shop.email}`;

    return shopDetails + '\n\n' + getMenu('MY_SHOP_MENU', session.language) + getMessage('NAVIGATION_HELP', session.language);
  } catch (error) {
    logger.error('Error authenticating shop', error);
    return getMessage('SYSTEM_ERROR', session.language);
  }
}

/**
 * Handle My Shop Menu selection
 */
export async function handleMyShopMenu(phone: string, input: string, session: Session): Promise<string> {
  try {
    // Check for navigation commands
    const nav = await handleNavigation(phone, input, session);
    if (nav.handled && nav.response) return nav.response;
    if (nav.handled) {
      return getMenu('MY_SHOP_MENU', session.language) + getMessage('NAVIGATION_HELP', session.language);
    }

    // Validate menu selection (1-9)
    const validation = validateMenuSelection(input, 1, 9);

    if (!validation.valid || validation.option === undefined) {
      return getMenu('MY_SHOP_MENU', session.language) + getMessage('NAVIGATION_HELP', session.language);
    }

    const option = validation.option;
    const shopName = session.context.shopName as string;

    switch (option) {
      case 1: // Quick Commands (Record Sale/Expense/Stock)
        logger.info('User entering quick commands mode', { phone, shopName });
        await updateSessionState(phone, STATE.MY_SHOP_COMMAND, {});
        const helpMsg = session.language === 'en'
          ? `*${shopName}* - Enter Quick Command 🚀\n\nExamples:\n• sold maize flour 4kg 600\n• sold wheat-flour 2kg 500\n• paid rent 5000\n• add brown sugar 2kg\n• edit maize flour -1kg\n\nType your command or reply *?* for help`
          : `*${shopName}* - Ingiza Amri ya Haraka 🚀\n\nMifano:\n• sold maize flour 4kg 600\n• sold wheat-flour 2kg 500\n• paid rent 5000\n• add brown sugar 2kg\n• edit maize flour -1kg\n\nKunguza amri yako au jibu *?* kwa msaada`;
        return helpMsg + '\n\n' + getMessage('NAVIGATION_HELP', session.language);

      case 2: // Today's Summary
        logger.info('User viewing today summary', { phone, shopName });
        return await handleShopCommandSummary(phone, session);

      case 3: // Current Stock
        logger.info('User viewing stock levels', { phone, shopName });
        return await handleShopCommandViewStock(phone, session);

      case 4: // Weekly Report
        logger.info('User accessing weekly reports', { phone, shopName });
        await updateSessionState(phone, STATE.REPORT_WEEKLY_MENU, {});
        return await handleWeeklyReportMenu(phone, '', session);

      case 5: // Monthly Report
        logger.info('User accessing monthly reports', { phone, shopName });
        await updateSessionState(phone, STATE.REPORT_MONTHLY_MENU, {});
        return await handleMonthlyReportMenu(phone, '', session);

      case 6: // Setup Payment Account
        logger.info('User setting up payment account', { phone, shopName });
        await updateSessionState(phone, STATE.PAYMENT_SETUP_METHOD, {});
        const setupMsg = session.language === 'en'
          ? '*Setup Payment Account* 💳\n\nChoose payment method:\n\n1️⃣ M-Pesa (Safaricom)\n2️⃣ Airtel Money\n3️⃣ Bank Account'
          : '*Msanidi Akaunti ya Kulipa* 💳\n\nChagua njia ya kulipa:\n\n1️⃣ M-Pesa (Safaricom)\n2️⃣ Airtel Money\n3️⃣ Akaunti ya Benki';
        return setupMsg + '\n\n' + getMessage('NAVIGATION_HELP', session.language);

      case 7: // Charge Customer
        logger.info('User charging customer', { phone, shopName });
        await updateSessionState(phone, STATE.CHARGE_CUSTOMER_AMOUNT, {});
        const chargeMsg = session.language === 'en'
          ? '*Charge Customer* 💳\n\nEnter amount to charge:\n(e.g., 500, 1000, 5000)'
          : '*Kulipisha Mteja* 💳\n\nIngiza kiasi cha kulipisha:\n(mfano, 500, 1000, 5000)';
        return chargeMsg + '\n\n' + getMessage('NAVIGATION_HELP', session.language);

      case 8: // Help
        logger.info('User viewing command help', { phone, shopName });
        const help = await handleShopCommandHelp(phone, session);
        return help + '\n\n' + getMenu('MY_SHOP_MENU', session.language) + getMessage('NAVIGATION_HELP', session.language);

      case 9: // Back to Main Menu
        await clearSessionContext(phone);
        await updateSessionState(phone, STATE.MAIN_MENU, {});
        logger.info('Returning to main menu');
        return getMenu('MAIN_MENU', session.language);

      default:
        return getMenu('MY_SHOP_MENU', session.language) + getMessage('NAVIGATION_HELP', session.language);
    }
  } catch (error) {
    logger.error('Error handling shop menu', error);
    return getMessage('SYSTEM_ERROR', session.language);
  }
}
