/**
 * Payment Setup Handler
 * Handles navigatable context for setting up payment accounts
 * Collects: payment method → account details → confirmation → sends to Cogvana
 */

import { Session } from '../types/session.types';
import { updateSessionState, updateSessionContext, clearSessionContext } from '../services/session.service';
import { savePaymentSetupRequest } from '../services/payment.setup.service';
import { validatePhoneNumber, checkNavigationCommand, validateTextInput } from '../utils/validator';
import { getMessage } from '../constants/messages';
import { STATE } from '../constants/states';
import { logger } from '../utils/logger';
import { PaymentMethod, MpesaAccount, AirtelAccount, BankAccount } from '../types/shop.types';
import { sendWhatsAppMessage, formatPhoneForWhatsApp } from '../services/whatsapp.service';

/**
 * Helper: Handle navigation commands
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
 * Step 1: Select payment method
 */
export async function handlePaymentSetupMethod(phone: string, input: string, session: Session): Promise<string> {
  try {
    const nav = await handleNavigation(phone, input, session);
    if (nav.handled && nav.response) return nav.response;
    if (nav.handled) {
      const msg = session.language === 'en'
        ? '*Choose Payment Method* 🏦\n\n1️⃣ M-Pesa (Safaricom)\n2️⃣ Airtel Money\n3️⃣ Bank Account\n\n0️⃣ Back'
        : '*Chagua Njia ya Kulipa* 🏦\n\n1️⃣ M-Pesa (Safaricom)\n2️⃣ Airtel Money\n3️⃣ Akaunti ya Benki\n\n0️⃣ Nyuma';
      return msg;
    }

    const option = input.trim();

    if (!['1', '2', '3'].includes(option)) {
      const msg = session.language === 'en'
        ? '❌ Invalid choice. Select 1, 2, or 3.'
        : '❌ Chaguo lisilofaa. Chagua 1, 2, au 3.';
      return msg;
    }

    let nextState: STATE;
    let paymentMethod: PaymentMethod;

    switch (option) {
      case '1':
        paymentMethod = 'mpesa';
        nextState = STATE.PAYMENT_SETUP_MPESA;
        break;
      case '2':
        paymentMethod = 'airtel';
        nextState = STATE.PAYMENT_SETUP_AIRTEL;
        break;
      case '3':
        paymentMethod = 'bank';
        nextState = STATE.PAYMENT_SETUP_BANK;
        break;
      default:
        return session.language === 'en' ? '❌ Invalid choice.' : '❌ Chaguo lisilofaa.';
    }

    await updateSessionContext(phone, { paymentMethod });
    await updateSessionState(phone, nextState, {});

    if (paymentMethod === 'mpesa') {
      const msg = session.language === 'en'
        ? '*M-Pesa Setup* 📱\n\nEnter your Paybill or Till number:\n(e.g., 123456 or 254123456)'
        : '*Msanidi M-Pesa* 📱\n\nIngiza namba yako ya Paybill au Till:\n(mfano, 123456 au 254123456)';
      return msg;
    } else if (paymentMethod === 'airtel') {
      const msg = session.language === 'en'
        ? '*Airtel Money Setup* 📱\n\nEnter your Airtel Business Number:\n(e.g., 1234567890)'
        : '*Msanidi Airtel Money* 📱\n\nIngiza namba yako ya Biashara ya Airtel:\n(mfano, 1234567890)';
      return msg;
    } else {
      const msg = session.language === 'en'
        ? '*Bank Setup* 🏦\n\nEnter your bank name:\n(e.g., KCB, Equity, Standard Chartered)'
        : '*Msanidi Benki* 🏦\n\nIngiza jina la benki yako:\n(mfano, KCB, Equity, Standard Chartered)';
      return msg;
    }
  } catch (error) {
    logger.error('Error handling payment setup method', { phone, error });
    return getMessage('SYSTEM_ERROR', session.language);
  }
}

/**
 * Step 2a: Collect M-Pesa details
 */
export async function handlePaymentSetupMpesa(phone: string, input: string, session: Session): Promise<string> {
  try {
    const nav = await handleNavigation(phone, input, session, STATE.PAYMENT_SETUP_METHOD);
    if (nav.handled && nav.response) return nav.response;
    if (nav.handled) {
      return session.language === 'en'
        ? '*M-Pesa Setup* 📱\n\nEnter your Paybill or Till number:'
        : '*Msanidi M-Pesa* 📱\n\nIngiza namba yako ya Paybill au Till:';
    }

    const paybillOrTill = input.trim();

    if (!validateTextInput(paybillOrTill, 5, 20)) {
      const msg = session.language === 'en'
        ? '❌ Invalid Paybill/Till number. Please try again.'
        : '❌ Namba sio sahihi. Jaribu tena.';
      return msg;
    }

    await updateSessionContext(phone, { mpesaPaybillOrTill: paybillOrTill });
    await updateSessionState(phone, STATE.PAYMENT_SETUP_MPESA, {}); // Stay in this state for next step

    const msg = session.language === 'en'
      ? `✓ Paybill/Till: ${paybillOrTill}\n\nNow enter your Account Number:\n(Reference number for Paybill)`
      : `✓ Paybill/Till: ${paybillOrTill}\n\nSasa ingiza namba ya Akaunti yako:\n(Namba ya rejea kwa Paybill)`;
    return msg;
  } catch (error) {
    logger.error('Error handling M-Pesa setup', { phone, error });
    return getMessage('SYSTEM_ERROR', session.language);
  }
}

/**
 * Step 2b: Collect M-Pesa account number
 */
export async function handlePaymentSetupMpesaAccount(phone: string, input: string, session: Session): Promise<string> {
  try {
    const context = session.context;
    const mpesaPaybillOrTill = context.mpesaPaybillOrTill as string;

    if (!mpesaPaybillOrTill) {
      // Go back to first step
      await updateSessionState(phone, STATE.PAYMENT_SETUP_METHOD, {});
      return session.language === 'en'
        ? 'Session expired. Please select payment method again.'
        : 'Sehemu yaliyopotea. Chagua njia ya kulipa tena.';
    }

    const accountNumber = input.trim();

    if (!validateTextInput(accountNumber, 3, 20)) {
      const msg = session.language === 'en'
        ? '❌ Invalid account number. Please try again.'
        : '❌ Namba sio sahihi. Jaribu tena.';
      return msg;
    }

    // Create M-Pesa account object
    const mpesaAccount: MpesaAccount = {
      paybillOrTill: mpesaPaybillOrTill,
      accountNumber,
    };

    await updateSessionContext(phone, {
      paymentDetails: mpesaAccount,
      mpesaPaybillOrTill: undefined, // Clean up temp var
    });
    await updateSessionState(phone, STATE.PAYMENT_SETUP_CONFIRM, {});

    const msg = session.language === 'en'
      ? `✓ Account Number: ${accountNumber}\n\nPlease confirm your M-Pesa details:\n• Paybill/Till: ${mpesaPaybillOrTill}\n• Account: ${accountNumber}\n\nReply *YES* to confirm or *NO* to change`
      : `✓ Namba ya Akaunti: ${accountNumber}\n\nTafadhali thibitisha maelezo yako ya M-Pesa:\n• Paybill/Till: ${mpesaPaybillOrTill}\n• Akaunti: ${accountNumber}\n\nJibu *YES* kubaini au *NO* kubadilisha`;
    return msg;
  } catch (error) {
    logger.error('Error handling M-Pesa account setup', { phone, error });
    return getMessage('SYSTEM_ERROR', session.language);
  }
}

/**
 * Step 2c: Collect Airtel Money details
 */
export async function handlePaymentSetupAirtel(phone: string, input: string, session: Session): Promise<string> {
  try {
    const nav = await handleNavigation(phone, input, session, STATE.PAYMENT_SETUP_METHOD);
    if (nav.handled && nav.response) return nav.response;
    if (nav.handled) {
      return session.language === 'en'
        ? '*Airtel Money Setup* 📱\n\nEnter your Airtel Business Number:'
        : '*Msanidi Airtel Money* 📱\n\nIngiza namba yako ya Biashara ya Airtel:';
    }

    const businessNumber = input.trim();

    if (!validatePhoneNumber(businessNumber).valid) {
      const msg = session.language === 'en'
        ? '❌ Invalid phone number. Please try again.'
        : '❌ Namba sio sahihi. Jaribu tena.';
      return msg;
    }

    await updateSessionContext(phone, { airtelBusinessNumber: businessNumber });
    await updateSessionState(phone, STATE.PAYMENT_SETUP_AIRTEL, {});

    const msg = session.language === 'en'
      ? `✓ Business Number: ${businessNumber}\n\nNow enter Account Details:\n(Account holder name or business name)`
      : `✓ Namba ya Biashara: ${businessNumber}\n\nSasa ingiza Maelezo ya Akaunti:\n(Jina la mmiliki au jina la biashara)`;
    return msg;
  } catch (error) {
    logger.error('Error handling Airtel setup', { phone, error });
    return getMessage('SYSTEM_ERROR', session.language);
  }
}

/**
 * Step 2d: Collect Airtel account details
 */
export async function handlePaymentSetupAirtelAccount(phone: string, input: string, session: Session): Promise<string> {
  try {
    const context = session.context;
    const businessNumber = context.airtelBusinessNumber as string;

    if (!businessNumber) {
      await updateSessionState(phone, STATE.PAYMENT_SETUP_METHOD, {});
      return session.language === 'en'
        ? 'Session expired. Please select payment method again.'
        : 'Sehemu yaliyopotea. Chagua njia ya kulipa tena.';
    }

    const accountDetails = input.trim();

    if (!validateTextInput(accountDetails, 3, 100)) {
      const msg = session.language === 'en'
        ? '❌ Invalid account details. Please try again.'
        : '❌ Maelezo sio sahihi. Jaribu tena.';
      return msg;
    }

    const airtelAccount: AirtelAccount = {
      businessNumber,
      accountDetails,
    };

    await updateSessionContext(phone, {
      paymentDetails: airtelAccount,
      airtelBusinessNumber: undefined,
    });
    await updateSessionState(phone, STATE.PAYMENT_SETUP_CONFIRM, {});

    const msg = session.language === 'en'
      ? `✓ Account Details: ${accountDetails}\n\nPlease confirm your Airtel Money details:\n• Business Number: ${businessNumber}\n• Account: ${accountDetails}\n\nReply *YES* to confirm or *NO* to change`
      : `✓ Maelezo ya Akaunti: ${accountDetails}\n\nTafadhali thibitisha maelezo yako ya Airtel:\n• Namba ya Biashara: ${businessNumber}\n• Akaunti: ${accountDetails}\n\nJibu *YES* kubaini au *NO* kubadilisha`;
    return msg;
  } catch (error) {
    logger.error('Error handling Airtel account setup', { phone, error });
    return getMessage('SYSTEM_ERROR', session.language);
  }
}

/**
 * Step 2e: Collect Bank details
 */
export async function handlePaymentSetupBank(phone: string, input: string, session: Session): Promise<string> {
  try {
    const nav = await handleNavigation(phone, input, session, STATE.PAYMENT_SETUP_METHOD);
    if (nav.handled && nav.response) return nav.response;
    if (nav.handled) {
      return session.language === 'en'
        ? '*Bank Setup* 🏦\n\nEnter your bank name:'
        : '*Msanidi Benki* 🏦\n\nIngiza jina la benki yako:';
    }

    const bankName = input.trim();

    if (!validateTextInput(bankName, 2, 50)) {
      const msg = session.language === 'en'
        ? '❌ Invalid bank name. Please try again.'
        : '❌ Jina sio sahihi. Jaribu tena.';
      return msg;
    }

    await updateSessionContext(phone, { bankName });
    await updateSessionState(phone, STATE.PAYMENT_SETUP_BANK, {});

    const msg = session.language === 'en'
      ? `✓ Bank: ${bankName}\n\nNow enter your Bank Branch:\n(e.g., Nairobi CBD, Westlands)`
      : `✓ Benki: ${bankName}\n\nSasa ingiza Tawi la Benki:\n(mfano, Nairobi CBD, Westlands)`;
    return msg;
  } catch (error) {
    logger.error('Error handling bank setup', { phone, error });
    return getMessage('SYSTEM_ERROR', session.language);
  }
}

/**
 * Step 2f: Collect Bank branch
 */
export async function handlePaymentSetupBankBranch(phone: string, input: string, session: Session): Promise<string> {
  try {
    const context = session.context;
    const bankName = context.bankName as string;

    if (!bankName) {
      await updateSessionState(phone, STATE.PAYMENT_SETUP_METHOD, {});
      return session.language === 'en'
        ? 'Session expired. Please select payment method again.'
        : 'Sehemu yaliyopotea. Chagua njia ya kulipa tena.';
    }

    const branch = input.trim();

    if (!validateTextInput(branch, 2, 50)) {
      const msg = session.language === 'en'
        ? '❌ Invalid branch name. Please try again.'
        : '❌ Jina sio sahihi. Jaribu tena.';
      return msg;
    }

    await updateSessionContext(phone, { bankBranch: branch });
    await updateSessionState(phone, STATE.PAYMENT_SETUP_BANK, {});

    const msg = session.language === 'en'
      ? `✓ Branch: ${branch}\n\nNow enter your Account Number:\n(e.g., 0123456789)`
      : `✓ Tawi: ${branch}\n\nSasa ingiza Namba ya Akaunti:\n(mfano, 0123456789)`;
    return msg;
  } catch (error) {
    logger.error('Error handling bank branch setup', { phone, error });
    return getMessage('SYSTEM_ERROR', session.language);
  }
}

/**
 * Step 2g: Collect Bank account number
 */
export async function handlePaymentSetupBankAccount(phone: string, input: string, session: Session): Promise<string> {
  try {
    const context = session.context;
    const bankName = context.bankName as string;
    const bankBranch = context.bankBranch as string;

    if (!bankName || !bankBranch) {
      await updateSessionState(phone, STATE.PAYMENT_SETUP_METHOD, {});
      return session.language === 'en'
        ? 'Session expired. Please start again.'
        : 'Sehemu yaliyopotea. Jaribu tena.';
    }

    const accountNumber = input.trim();

    if (!validateTextInput(accountNumber, 5, 20)) {
      const msg = session.language === 'en'
        ? '❌ Invalid account number. Please try again.'
        : '❌ Namba sio sahihi. Jaribu tena.';
      return msg;
    }

    const bankAccount: BankAccount = {
      bankName,
      branch: bankBranch,
      accountNumber,
    };

    await updateSessionContext(phone, {
      paymentDetails: bankAccount,
      bankName: undefined,
      bankBranch: undefined,
    });
    await updateSessionState(phone, STATE.PAYMENT_SETUP_CONFIRM, {});

    const msg = session.language === 'en'
      ? `✓ Account: ${accountNumber}\n\nPlease confirm your Bank details:\n• Bank: ${bankName}\n• Branch: ${bankBranch}\n• Account: ${accountNumber}\n\nReply *YES* to confirm or *NO* to change`
      : `✓ Akaunti: ${accountNumber}\n\nTafadhali thibitisha maelezo yako ya Benki:\n• Benki: ${bankName}\n• Tawi: ${bankBranch}\n• Akaunti: ${accountNumber}\n\nJibu *YES* kubaini au *NO* kubadilisha`;
    return msg;
  } catch (error) {
    logger.error('Error handling bank account setup', { phone, error });
    return getMessage('SYSTEM_ERROR', session.language);
  }
}

/**
 * Step 3: Confirmation and send to Cogvana
 */
export async function handlePaymentSetupConfirm(phone: string, input: string, session: Session): Promise<string> {
  try {
    const response = input.trim().toUpperCase();
    const context = session.context;
    const shopId = context.shopId as string;
    const shopName = context.shopName as string;
    const ownerName = context.ownerName as string;
    const paymentMethod = context.paymentMethod as PaymentMethod;
    const paymentDetails = context.paymentDetails as any;

    if (!['YES', 'Y', 'NDIO', 'NDIYO'].includes(response)) {
      if (['NO', 'N'].includes(response)) {
        // Go back to method selection
        await clearSessionContext(phone);
        await updateSessionState(phone, STATE.PAYMENT_SETUP_METHOD, {});
        const msg = session.language === 'en'
          ? '*Choose Payment Method* 🏦\n\n1️⃣ M-Pesa (Safaricom)\n2️⃣ Airtel Money\n3️⃣ Bank Account'
          : '*Chagua Njia ya Kulipa* 🏦\n\n1️⃣ M-Pesa (Safaricom)\n2️⃣ Airtel Money\n3️⃣ Akaunti ya Benki';
        return msg;
      }

      const msg = session.language === 'en'
        ? '❌ Please reply *YES* to confirm or *NO* to change.'
        : '❌ Jibu *YES* kubaini au *NO* kubadilisha.';
      return msg;
    }

    // Save setup request
    await updateSessionState(phone, STATE.PAYMENT_SETUP_PROCESSING, {});

    const request = await savePaymentSetupRequest(
      shopId,
      shopName,
      ownerName,
      phone,
      paymentMethod,
      paymentDetails
    );

    // Build WhatsApp message to Cogvana
    const whatsappMsg = buildPaymentSetupMessage(shopId, shopName, ownerName, phone, paymentMethod, paymentDetails);

    logger.info('Payment setup request created, sending to Cogvana', {
      shopId,
      requestId: request.id,
      paymentMethod,
    });

    // Send WhatsApp message to Cogvana admin
    try {
      const cogvanaPhone = formatPhoneForWhatsApp('254791286165'); // +254791286165
      await sendWhatsAppMessage(cogvanaPhone, whatsappMsg);
      logger.info('Payment setup message sent to Cogvana', {
        shopId,
        requestId: request.id,
        cogvanaPhone,
      });
    } catch (error) {
      logger.error('Failed to send WhatsApp to Cogvana', {
        shopId,
        error,
      });
      // Don't fail the user request if Cogvana message fails to send
      // The request is already saved in Firestore
    }

    // Clear context and return to menu
    await clearSessionContext(phone);
    await updateSessionState(phone, STATE.MY_SHOP_MENU, {});

    const successMsg = session.language === 'en'
      ? `✅ Setup request sent successfully!\n\nWe'll review your payment setup and contact you within 24 hours with next steps.\n\n📞 Shop ID: ${shopId}`
      : `✅ Ombi liliingizwa kwa mafanikio!\n\nTutachunguza mpango wako wa kulipa na kukupigia simu ndani ya saa 24.\n\n📞 ID ya Duka: ${shopId}`;

    return successMsg + '\n\n' + getMessage('NAVIGATION_HELP', session.language);
  } catch (error) {
    logger.error('Error confirming payment setup', { phone, error });
    return getMessage('SYSTEM_ERROR', session.language);
  }
}

/**
 * Build WhatsApp message to send to Cogvana
 */
function buildPaymentSetupMessage(
  shopId: string,
  shopName: string,
  ownerName: string,
  ownerPhone: string,
  paymentMethod: PaymentMethod,
  paymentDetails: any
): string {
  let details = '';

  if (paymentMethod === 'mpesa') {
    details = `🏦 *M-Pesa Account*\nPaybill/Till: ${paymentDetails.paybillOrTill}\nAccount: ${paymentDetails.accountNumber}`;
  } else if (paymentMethod === 'airtel') {
    details = `📱 *Airtel Money Account*\nBusiness #: ${paymentDetails.businessNumber}\nAccount: ${paymentDetails.accountDetails}`;
  } else if (paymentMethod === 'bank') {
    details = `🏛️ *Bank Account*\nBank: ${paymentDetails.bankName}\nBranch: ${paymentDetails.branch}\nAccount: ${paymentDetails.accountNumber}`;
  }

  return `
*🔔 NEW PAYMENT SETUP REQUEST*

*Shop Details:*
Shop ID: ${shopId}
Shop Name: ${shopName}
Owner: ${ownerName}
Phone: ${ownerPhone}

${details}

*Action Required:*
1. Review details
2. Set up Paystack sub-account ID
3. Approve in admin dashboard

Timestamp: ${new Date().toISOString()}
  `.trim();
}
