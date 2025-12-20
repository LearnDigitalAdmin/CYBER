/**
 * Payment Charge Handler
 * Handles customer payment via STK push (Safaricom/Airtel)
 */

import { Session } from '../types/session.types';
import { updateSessionState, updateSessionContext, clearSessionContext } from '../services/session.service';
import { getPaymentAccount } from '../services/payment.setup.service';
import { sendStkPush, savePaymentTransaction } from '../services/payment.charge.service';
import { getOrCreateSplitCodeWithRetry } from '../services/payment.split.service';
import { startCustomerChargeListener } from '../services/payment.listener.service';
import { validatePhoneNumber, checkNavigationCommand } from '../utils/validator';
import { getMessage } from '../constants/messages';
import { STATE } from '../constants/states';
import { logger } from '../utils/logger';
import { PaymentNetwork } from '../types/shop.types';

/**
 * Helper: Handle navigation
 */
async function handleNavigation(
  phone: string,
  input: string,
  session: Session,
  previousState?: STATE
): Promise<{ response: string | null; handled: boolean }> {
  const nav = checkNavigationCommand(input);

  if (nav.type === 'exit') {
    await clearSessionContext(phone);
    await updateSessionState(phone, STATE.LANGUAGE_SELECTION, {});
    return { response: getMessage('CONFIRM_PAY', session.language), handled: true };
  }

  if (nav.type === 'restart') {
    await clearSessionContext(phone);
    await updateSessionState(phone, STATE.MY_SHOP_MENU, {});
    return { response: getMessage('CONFIRM_PAY', session.language), handled: true };
  }

  if (nav.type === 'back') {
    if (!previousState) {
      return { response: null, handled: false };
    }
    await updateSessionState(phone, previousState, {});
    return { response: null, handled: true };
  }

  return { response: null, handled: false };
}

/**
 * Step 1: Enter amount to charge
 */
export async function handleChargeCustomerAmount(phone: string, input: string, session: Session): Promise<string> {
  try {
    const nav = await handleNavigation(phone, input, session);
    if (nav.handled && nav.response) return nav.response;
    if (nav.handled) {
      const msg = session.language === 'en'
        ? '*Charge Customer* 💳\n\nEnter amount to charge:\n(e.g., 500, 1000, 5000)'
        : '*Kulipisha Mteja* 💳\n\nIngiza kiasi cha kulipisha:\n(mfano, 500, 1000, 5000)';
      return msg + getNavigationHelp(session.language);
    }

    const amountStr = input.trim();
    const amount = parseFloat(amountStr);

    if (isNaN(amount) || amount <= 0) {
      const msg = session.language === 'en'
        ? '❌ Invalid amount. Please enter a positive number.'
        : '❌ Kiasi sio sahihi. Ingiza namba chanya.';
      return msg + getNavigationHelp(session.language);
    }

    // Validate amount is reasonable (between 1 and 100,000 KES)
    if (amount < 1 || amount > 100000) {
      const msg = session.language === 'en'
        ? '❌ Amount must be between 1 and 100,000 KES.'
        : '❌ Kiasi lazima kiwe kati ya 1 na 100,000 KES.';
      return msg + getNavigationHelp(session.language);
    }

    await updateSessionContext(phone, { chargeAmount: amount });
    await updateSessionState(phone, STATE.CHARGE_CUSTOMER_PHONE, {});

    const msg = session.language === 'en'
      ? `✓ Amount: KES ${amount}\n\nNow enter customer phone number:\n(e.g., 0712345678 or +254712345678)`
      : `✓ Kiasi: KES ${amount}\n\nSasa ingiza namba ya mteja:\n(mfano, 0712345678 au +254712345678)`;
    return msg + getNavigationHelp(session.language);
  } catch (error) {
    logger.error('Error handling charge amount', { phone, error });
    return getMessage('SYSTEM_ERROR', session.language);
  }
}

/**
 * Step 2: Enter customer phone number
 */
export async function handleChargeCustomerPhone(phone: string, input: string, session: Session): Promise<string> {
  try {
    const nav = await handleNavigation(phone, input, session, STATE.CHARGE_CUSTOMER_AMOUNT);
    if (nav.handled && nav.response) return nav.response;
    if (nav.handled) {
      const msg = session.language === 'en'
        ? '*Charge Customer* 💳\n\nEnter customer phone number:'
        : '*Kulipisha Mteja* 💳\n\nIngiza namba ya mteja:';
      return msg + getNavigationHelp(session.language);
    }

    const phoneInput = input.trim();
    const validation = validatePhoneNumber(phoneInput);

    if (!validation.valid || !validation.formatted) {
      const msg = session.language === 'en'
        ? '❌ Invalid phone number. Please try again.'
        : '❌ Namba sio sahihi. Jaribu tena.';
      return msg + getNavigationHelp(session.language);
    }

    await updateSessionContext(phone, { customerPhone: validation.formatted });
    await updateSessionState(phone, STATE.CHARGE_CUSTOMER_NETWORK, {});

    const msg = session.language === 'en'
      ? `✓ Customer: ${validation.formatted}\n\nSelect payment network:\n\n1️⃣ Safaricom M-Pesa\n2️⃣ Airtel Money`
      : `✓ Mteja: ${validation.formatted}\n\nChagua mtandao wa kulipa:\n\n1️⃣ Safaricom M-Pesa\n2️⃣ Airtel Money`;
    return msg + getNavigationHelp(session.language);
  } catch (error) {
    logger.error('Error handling customer phone', { phone, error });
    return getMessage('SYSTEM_ERROR', session.language);
  }
}

/**
 * Step 3: Select network and send STK push
 */
export async function handleChargeCustomerNetwork(phone: string, input: string, session: Session): Promise<string> {
  try {
    const nav = await handleNavigation(phone, input, session, STATE.CHARGE_CUSTOMER_PHONE);
    if (nav.handled && nav.response) return nav.response;
    if (nav.handled) {
      const msg = session.language === 'en'
        ? 'Select payment network:\n\n1️⃣ Safaricom M-Pesa\n2️⃣ Airtel Money'
        : 'Chagua mtandao wa kulipa:\n\n1️⃣ Safaricom M-Pesa\n2️⃣ Airtel Money';
      return msg;
    }

    const option = input.trim();

    if (!['1', '2'].includes(option)) {
      const msg = session.language === 'en'
        ? '❌ Invalid choice. Select 1 or 2.'
        : '❌ Chaguo lisilofaa. Chagua 1 au 2.';
      return msg + getNavigationHelp(session.language);
    }

    const network: PaymentNetwork = option === '1' ? 'safaricom' : 'airtel';

    // Get shop info
    const shopId = session.context.shopId as string;
    const chargeAmount = session.context.chargeAmount as number;
    const customerPhone = session.context.customerPhone as string;

    if (!shopId || !chargeAmount || !customerPhone) {
      logger.error('Missing charge details in context', {
        phone,
        shopId,
        chargeAmount,
        customerPhone,
      });
      await clearSessionContext(phone);
      await updateSessionState(phone, STATE.MY_SHOP_MENU, {});

      const errorMsg = session.language === 'en'
        ? '❌ Session error. Please try again from the menu.'
        : '❌ Hitilafu ya mkutano. Tafadhali jaribu tena kutokea kwa menyu.';
      return errorMsg;
    }

    // Get payment account with subaccount ID
    const paymentAccount = await getPaymentAccount(shopId);

    if (!paymentAccount || !paymentAccount.paystackSubaccountId) {
      const msg = session.language === 'en'
        ? '❌ Payment account not configured. Please contact support.'
        : '❌ Akaunti ya kulipa haijaandaliwa. Tafadhali wasiliana na msaada.';
      await clearSessionContext(phone);
      await updateSessionState(phone, STATE.MY_SHOP_MENU, {});
      return msg;
    }

    // Get or create split code automatically
    let splitCode: string;
    try {
      logger.info("Getting or creating split code for shop", { shopId });
      splitCode = await getOrCreateSplitCodeWithRetry(
        shopId,
        paymentAccount.paystackSubaccountId,
        3, // max retries
        1.5 // platform commission rate (1.5%)
      );
      logger.info("Split code ready for STK push", { shopId, splitCode });
    } catch (splitError) {
      logger.error("Failed to get/create split code", {
        shopId,
        error: splitError instanceof Error ? splitError.message : "Unknown error",
      });

      await clearSessionContext(phone);
      await updateSessionState(phone, STATE.MY_SHOP_MENU, {});

      const errorMsg = session.language === "en"
        ? "❌ Failed to prepare payment routing. Please try again."
        : "❌ Ombi la kulipa halikuweza kuandaliwa. Jaribu tena.";
      return errorMsg;
    }

    // Update state to processing
    await updateSessionState(phone, STATE.CHARGE_CUSTOMER_PROCESSING, {});
    await updateSessionContext(phone, { network });

    // Send STK push
    const result = await sendStkPush(
      shopId,
      chargeAmount,
      customerPhone,
      network,
      splitCode
    );

    if (!result.success) {
      logger.error('STK push failed', { shopId, error: result.error });

      await clearSessionContext(phone);
      await updateSessionState(phone, STATE.MY_SHOP_MENU, {});

      const errorMsg = session.language === 'en'
        ? `❌ Failed to send payment request: ${result.error}`
        : `❌ Ombi la kulipa halikuweza kutumwa: ${result.error}`;
      return errorMsg;
    }

    // Save transaction
    const transaction = await savePaymentTransaction(
      shopId,
      chargeAmount,
      customerPhone,
      network,
      result.reference || `stk-${Date.now()}`
    );

    // KEEP the charge reference and type in context for polling
    // DON'T clear the context - we need it to poll for payment updates
    await updateSessionContext(phone, {
      chargeReference: result.reference,
      chargeType: 'shop_charge',
    });

    logger.info('Session context updated for polling', {
      phone,
      chargeReference: result.reference,
      chargeType: 'shop_charge',
    });

    // Success message with navigation instructions
    const successMsg = session.language === 'en'
      ? `✅ STK Push Sent!\n\n📱 Customer: ${customerPhone}\n💰 Amount: KES ${chargeAmount}\n🌐 Network: ${network === 'safaricom' ? 'Safaricom M-Pesa' : 'Airtel Money'}\n\n⏳ Customer should see prompt to enter PIN.\n\nOnce payment is complete, you'll receive a confirmation message.\n\nTransaction ID: ${transaction.id}\n\n👈 You can go back to continue other operations. Payment status will update automatically.`
      : `✅ Ombi Lilitumwa!\n\n📱 Mteja: ${customerPhone}\n💰 Kiasi: KES ${chargeAmount}\n🌐 Mtandao: ${network === 'safaricom' ? 'Safaricom M-Pesa' : 'Airtel Money'}\n\n⏳ Mteja anakwanzia kuona ombi la kuingiza PIN.\n\nBaada ya kulipa, utakamatia ujumbe wa uthibitisho.\n\nKimli cha Muamala: ${transaction.id}\n\n👈 Unaweza kurudi kusambaza shughuli nyingine. Hadharinzo ya malipo itabadilika kiotomatiki.`;

    // DON'T return to MY_SHOP_MENU yet - stay in CHARGE_CUSTOMER_PROCESSING
    // so we can poll for payment updates when user responds or navigates back
    // Just show the success message and keep the state

    return successMsg + getNavigationHelp(session.language);
  } catch (error) {
    logger.error('Error handling charge network selection', { phone, error });

    await clearSessionContext(phone);
    await updateSessionState(phone, STATE.MY_SHOP_MENU, {});
    return getMessage('SYSTEM_ERROR', session.language);
  }
}

/**
 * Helper: Get navigation instructions
 */
function getNavigationHelp(language: 'en' | 'sw'): string {
  return language === 'en'
    ? '\n\n📱 *Navigation:*\n*0* = Back to previous step\n*00* = Start over\n*000* = Exit to main menu'
    : '\n\n📱 *Kusambaza:*\n*0* = Rudi kwenye hatua iliyotangulia\n*00* = Kuanza tena\n*000* = Toka kwa menuu kuu';
}

/**
 * Processing state message (shown while STK push is being sent)
 */
export function getProcessingMessage(language: 'en' | 'sw'): string {
  return language === 'en'
    ? '⏳ Processing payment request... Please wait.'
    : '⏳ Inakubadilisha ombi la kulipa... Tafadhali subiri.';
}

/**
 * Handle payment processing state - user may interact while waiting for payment confirmation
 * If user navigates back, starts listener and returns to MY_SHOP_MENU
 */
export async function handleChargeCustomerProcessing(
  phone: string,
  input: string,
  session: Session
): Promise<string> {
  try {
    const nav = checkNavigationCommand(input);

    // Handle exit
    if (nav.type === 'exit') {
      await clearSessionContext(phone);
      await updateSessionState(phone, STATE.LANGUAGE_SELECTION, {});
      const msg = session.language === 'en'
        ? '👋 Exiting to Language Selection...'
        : '👋 Inakwenda kwa Chaguo la Lugha...';
      return msg;
    }

    // Handle restart
    if (nav.type === 'restart') {
      await clearSessionContext(phone);
      await updateSessionState(phone, STATE.MY_SHOP_MENU, {});
      const msg = session.language === 'en'
        ? '🏪 Restarting - Back to My Shop Menu...'
        : '🏪 Inakuanza tena - Rudi kwa Menuu ya Duka Langu...';
      return msg;
    }

    // Handle back - user wants to go back to shop menu while payment processes
    if (nav.type === 'back') {
      const shopId = session.context.shopId as string;
      const chargeReference = session.context.chargeReference as string;
      const customerPhone = session.context.customerPhone as string;
      const chargeAmount = session.context.chargeAmount as number;

      if (!shopId || !chargeReference) {
        logger.error('Missing payment context for listener', { phone, shopId, chargeReference });
        await clearSessionContext(phone);
        await updateSessionState(phone, STATE.MY_SHOP_MENU, {});
        return (session.language === 'en'
          ? '🏪 Back to My Shop Menu'
          : '🏪 Rudi kwa Menuu ya Duka Langu');
      }

      // Start the payment listener to watch for status updates
      logger.info('Starting customer charge listener after user navigated back', {
        phone,
        shopId,
        chargeReference,
      });

      startCustomerChargeListener(
        shopId,
        chargeReference,
        phone,
        customerPhone,
        chargeAmount,
        session.language
      );

      // Return user to MY_SHOP_MENU while listener watches in background
      await updateSessionState(phone, STATE.MY_SHOP_MENU, {});

      const returnMsg = session.language === 'en'
        ? `🏪 Back to My Shop Menu\n\n💡 Payment listener activated. You'll receive updates automatically as the customer completes payment.\n\nWhat would you like to do?`
        : `🏪 Rudi kwa Menuu ya Duka Langu\n\n💡 Kisimu cha malipo kimeshuka. Utakamatia hadharinzo kiotomatiki kadri mteja akamilisha kulipa.\n\nUnataka kufanya nini?`;

      return returnMsg;
    }

    // If they send any other text while processing, keep them in the processing state
    // and let them know payment is still being processed
    const waitMsg = session.language === 'en'
      ? `⏳ Still waiting for payment confirmation...\n\nYou can:\n*0* = Go back to My Shop Menu (payment will update automatically)\n*00* = Start over with new charge\n*000* = Exit to main menu`
      : `⏳ Bado inangoja uthibitisho wa malipo...\n\nUnaweza:\n*0* = Rudi kwa Menuu ya Duka Langu (malipo yatabadilika kiotomatiki)\n*00* = Kuanza tena na kulipisha mpya\n*000* = Toka kwa menuu kuu`;

    return waitMsg;

  } catch (error) {
    logger.error('Error handling charge processing state', { phone, error });

    await clearSessionContext(phone);
    await updateSessionState(phone, STATE.MY_SHOP_MENU, {});

    return (session.language === 'en'
      ? '❌ Error processing payment. Returning to My Shop Menu.'
      : '❌ Hitilafu katika kuchunguza malipo. Kurudi kwa Menuu ya Duka Langu.');
  }
}
