/**
 * WhatsApp Webhook Handler
 * Main entry point for processing incoming WhatsApp messages
 */

import { Request, Response } from 'express';
import { WhatsAppWebhookPayload, WhatsAppMessage } from '../types/whatsapp.types';
import { createOrGetSession, updateSessionState } from '../services/session.service';
import { sendWhatsAppMessage, formatPhoneForWhatsApp } from '../services/whatsapp.service';
import { handleLanguageSelection } from '../handlers/language.handler';
import { handleMainMenu } from '../handlers/menu.handler';
import {
  handleAddShopOwnerName,
  handleAddShopBusinessType,
  handleAddShopName,
  handleAddShopLocation,
  handleAddShopEmployees,
  handleAddShopNationalId,
  handleAddShopEmail,
  handleAddShopPhone,
  handleAddShopConfirmation,
  handleMyShopAuth,
  handleMyShopMenu,
} from '../handlers/shop.handler';
import { handleShopCommand } from '../handlers/shop.command.handler';
import {
  handleWeeklyReportMenu,
  handleMonthlyReportMenu,
  handleReportPaymentPrompt,
} from '../handlers/report.menu.handler';
import {
  handlePaymentSetupMethod,
  handlePaymentSetupMpesa,
  handlePaymentSetupMpesaAccount,
  handlePaymentSetupAirtel,
  handlePaymentSetupAirtelAccount,
  handlePaymentSetupBank,
  handlePaymentSetupBankBranch,
  handlePaymentSetupBankAccount,
  handlePaymentSetupConfirm,
} from '../handlers/payment.setup.handler';
import {
  handleChargeCustomerAmount,
  handleChargeCustomerPhone,
  handleChargeCustomerNetwork,
  handleChargeCustomerProcessing,
} from '../handlers/payment.charge.handler';
import {
  handleMyChamaAuthId,
  handleMyChamaSelectChama,
  handleMyChamaMenu,
  handleContributionSelect,
  handleContributionAmount,
  handleLoanProduct,
  handleLoanAmount,
  handleLoanTerm,
  handleLoanPurpose,
  handleLoanConfirm,
  handleLoanPaySelect,
  handleLoanPayAmount,
  handleLoanBalance,
  handleMgrSelect,
  handleMgrDetail,
  handleMgrHistory,
  handleStatementType,
  handleStatementPeriod,
  handleStatementView,
  handlePayPhone,
  handlePayProvider,
  handlePayConfirm,
} from '../handlers/mychama.handler';
import {
  handlePayRentId,
  handlePayRentConfirm,
  handlePayRentMpesa,
  handlePayRentAmount,
  handlePayRentProcessing,
  handlePayRentConfirmAmount,
  handleGetInvoiceId,
  handleGetInvoiceMenu,
} from '../handlers/rent.handler';
import { logger } from '../utils/logger';
import { STATE } from '../constants/states';
import { getMessage } from '../constants/messages';
import { getMenu } from '../constants/menus';
import { checkNavigationCommand } from '../utils/validator';

/**
 * Main webhook handler for incoming WhatsApp messages
 */
export async function handleIncomingMessage(req: Request, res: Response): Promise<void> {
  try {
    // Log raw webhook receipt FIRST
    logger.info('WhatsApp webhook received', {
      method: req.method,
      contentType: req.get('content-type'),
      hasBody: !!req.body,
    });

    // Parse the incoming webhook payload
    const payload = req.body as WhatsAppWebhookPayload;

    // Log full payload structure for debugging
    logger.info('Webhook payload structure', {
      hasEntry: !!payload.entry,
      entryLength: payload.entry?.length,
      hasChanges: !!payload.entry?.[0]?.changes,
      changesLength: payload.entry?.[0]?.changes?.length,
      hasMessages: !!payload.entry?.[0]?.changes?.[0]?.value?.messages,
      messageCount: (payload.entry?.[0]?.changes?.[0]?.value?.messages || []).length,
    });

    // Validate payload structure
    if (!payload.entry?.[0]?.changes?.[0]?.value?.messages) {
      logger.warn('No messages in webhook payload - likely a status update or other event', {
        hasEntry: !!payload.entry,
        eventType: payload.entry?.[0]?.changes?.[0]?.value?.statuses ? 'status_update' : 'unknown',
      });
      res.status(200).send('ok');
      return;
    }

    // Process each message
    const messages = payload.entry[0].changes[0].value.messages || [];
    logger.info(`Processing ${messages.length} message(s)`);

    for (const message of messages) {
      await processMessage(message);
    }

    // Acknowledge successful processing
    res.status(200).send('ok');
  } catch (error) {
    logger.error('Error processing webhook', error);
    res.status(200).send('ok'); // Still return 200 to prevent retries
  }
}

/**
 * Process a single incoming message
 */
async function processMessage(message: WhatsAppMessage): Promise<void> {
  try {
    const phone = message.from;
    const text = message.text?.body || '';
    const messageId = message.id;

    logger.setContext({ phone });
    logger.info('Processing WhatsApp message', {
      messageId,
      phone,
      textLength: text.length,
      textPreview: text.substring(0, 50),
      messageType: message.type,
    });

    // Get or create session
    let session = await createOrGetSession(phone);
    logger.info('Session retrieved/created', {
      phone,
      sessionId: phone,
      currentState: session.currentState,
      language: session.language,
    });
    logger.setContext({ phone, state: session.currentState });

    // Route to appropriate handler based on current state
    let response: string | null = null;

    switch (session.currentState) {
      case STATE.LANGUAGE_SELECTION:
        logger.info('Routing to language selection handler');
        response = await handleLanguageSelection(phone, text, session);
        break;

      case STATE.MAIN_MENU:
        logger.info('Routing to main menu handler');
        response = await handleMainMenu(phone, text, session);
        break;

      // Add Shop flow
      case STATE.ADD_SHOP_OWNER_NAME:
        logger.info('Routing to add shop owner name handler');
        response = await handleAddShopOwnerName(phone, text, session);
        break;

      case STATE.ADD_SHOP_BUSINESS_TYPE:
        logger.info('Routing to add shop business type handler');
        response = await handleAddShopBusinessType(phone, text, session);
        break;

      case STATE.ADD_SHOP_NAME:
        logger.info('Routing to add shop name handler');
        response = await handleAddShopName(phone, text, session);
        break;

      case STATE.ADD_SHOP_LOCATION:
        logger.info('Routing to add shop location handler');
        response = await handleAddShopLocation(phone, text, session);
        break;

      case STATE.ADD_SHOP_EMPLOYEES:
        logger.info('Routing to add shop employees handler');
        response = await handleAddShopEmployees(phone, text, session);
        break;

      case STATE.ADD_SHOP_NATIONAL_ID:
        logger.info('Routing to add shop national ID handler');
        response = await handleAddShopNationalId(phone, text, session);
        break;

      case STATE.ADD_SHOP_EMAIL:
        logger.info('Routing to add shop email handler');
        response = await handleAddShopEmail(phone, text, session);
        break;

      case STATE.ADD_SHOP_PHONE:
        logger.info('Routing to add shop phone handler');
        response = await handleAddShopPhone(phone, text, session);
        break;

      case STATE.ADD_SHOP_CONFIRMATION:
        logger.info('Routing to add shop confirmation handler');
        response = await handleAddShopConfirmation(phone, text, session);
        break;

      case STATE.MY_SHOP_AUTH:
        logger.info('Routing to my shop authentication handler');
        response = await handleMyShopAuth(phone, text, session);
        break;

      case STATE.MY_SHOP_MENU:
        logger.info('Routing to my shop menu handler');
        response = await handleMyShopMenu(phone, text, session);
        break;

      case STATE.MY_SHOP_COMMAND:
        logger.info('Routing to my shop command handler');
        response = await handleShopCommand(phone, text, session);
        break;

      case STATE.REPORT_WEEKLY_MENU:
        logger.info('Routing to weekly report menu handler');
        response = await handleWeeklyReportMenu(phone, text, session);
        break;

      case STATE.REPORT_MONTHLY_MENU:
        logger.info('Routing to monthly report menu handler');
        response = await handleMonthlyReportMenu(phone, text, session);
        break;

      case STATE.REPORT_PAYMENT_PROMPT:
        logger.info('Routing to report payment phone handler');
        response = await handleReportPaymentPrompt(phone, text, session);
        break;

      case STATE.REPORT_GENERATING:
        logger.info('💼 REPORT_GENERATING state - listening for payment completion', {
          phone,
        });

        // Check navigation commands (exit, back, restart)
        const reportNav = checkNavigationCommand(text);

        // Back: Return to MY_SHOP_MENU
        if (reportNav.type === 'back') {
          logger.info(
            '👈 User navigating back from report generation',
            { phone }
          );
          await updateSessionState(phone, STATE.MY_SHOP_MENU, {});

          const backMsg =
            session.language === 'en'
              ? `👈 Back to My Shop Menu\n\nYour report will be delivered automatically once payment is confirmed.\n\n${getMenu('MY_SHOP_MENU', session.language)}`
              : `👈 Rudi kwa Menuu ya Duka Langu\n\nRipoti yako itakamatia kiotomatiki baada ya malipo kuakikishwa.\n\n${getMenu('MY_SHOP_MENU', session.language)}`;

          response = backMsg;
          break;
        }

        // Exit: Go to language selection
        if (reportNav.type === 'exit') {
          logger.info(
            '👋 User exiting from report generation',
            { phone }
          );
          await updateSessionState(phone, STATE.LANGUAGE_SELECTION, {});
          response = getMenu('WELCOME', session.language);
          break;
        }

        // Restart: Go back to MY_SHOP_MENU
        if (reportNav.type === 'restart') {
          logger.info(
            '🔄 User restarting from report generation',
            { phone }
          );
          await updateSessionState(phone, STATE.MY_SHOP_MENU, {});

          const restartMsg =
            session.language === 'en'
              ? `🏪 Back to My Shop Menu\n\nYour report will be delivered automatically once payment is confirmed.\n\n${getMenu('MY_SHOP_MENU', session.language)}`
              : `🏪 Rudi kwa Menuu ya Duka Langu\n\nRipoti yako itakamatia kiotomatiki baada ya malipo kuakikishwa.\n\n${getMenu('MY_SHOP_MENU', session.language)}`;

          response = restartMsg;
          break;
        }

        // Any other input: Show waiting message
        // NOTE: The listener is active in the background (via startReportPaymentListener)
        // It will handle the payment status change and delivery automatically
        response =
          session.language === 'en'
            ? `⏳ *Report Generation in Progress*\n\nWe're listening for your payment confirmation...\n\nOnce you complete payment, your report will be:\n1. Generated automatically\n2. Sent to you via WhatsApp\n3. You'll be returned to My Shop Menu\n\nYou can:\n*0* = Go back to My Shop Menu (report will still be generated)\n*00* = Restart\n*000* = Exit to Main Menu\n\n💡 No need to wait here - we'll notify you when it's ready!`
            : `⏳ *Kuundwa kwa Ripoti inayoendelea*\n\nTunasikilia uthibitisho wa malipo yako...\n\nBaada ya kukamilisha malipo, ripoti yako itakuwa:\n1. Kuundwa kwa otomatiki\n2. Kutumiwa kwako kupitia WhatsApp\n3. Utarudi kwa Menuu ya Duka Langu\n\nUnaweza:\n*0* = Rudi kwa Menuu ya Duka Langu (ripoti bado itaundwa)\n*00* = Kuanza tena\n*000* = Toka kwa Menuu Kuu\n\n💡 Hakuna haja ya kusubiri hapa - tutakujuliza baada ya kuandaliwa!`;
        break;

      // Payment Setup flow
      case STATE.PAYMENT_SETUP_METHOD:
        logger.info('Routing to payment setup method handler');
        response = await handlePaymentSetupMethod(phone, text, session);
        break;

      case STATE.PAYMENT_SETUP_MPESA:
        logger.info('Routing to payment setup M-Pesa handler');
        const mpesaPaybillOrTill = session.context.mpesaPaybillOrTill as string;
        if (mpesaPaybillOrTill) {
          response = await handlePaymentSetupMpesaAccount(phone, text, session);
        } else {
          response = await handlePaymentSetupMpesa(phone, text, session);
        }
        break;

      case STATE.PAYMENT_SETUP_AIRTEL:
        logger.info('Routing to payment setup Airtel handler');
        const airtelBusinessNumber = session.context.airtelBusinessNumber as string;
        if (airtelBusinessNumber) {
          response = await handlePaymentSetupAirtelAccount(phone, text, session);
        } else {
          response = await handlePaymentSetupAirtel(phone, text, session);
        }
        break;

      case STATE.PAYMENT_SETUP_BANK:
        logger.info('Routing to payment setup Bank handler');
        const bankBranch = session.context.bankBranch as string;
        if (bankBranch) {
          response = await handlePaymentSetupBankAccount(phone, text, session);
        } else if (session.context.bankName) {
          response = await handlePaymentSetupBankBranch(phone, text, session);
        } else {
          response = await handlePaymentSetupBank(phone, text, session);
        }
        break;

      case STATE.PAYMENT_SETUP_CONFIRM:
        logger.info('Routing to payment setup confirmation handler');
        response = await handlePaymentSetupConfirm(phone, text, session);
        break;

      case STATE.PAYMENT_SETUP_PROCESSING:
        logger.info('Payment setup processing');
        response = (session.language === 'en'
          ? '⏳ Processing your payment setup request...'
          : '⏳ Inakubadilisha ombi lako la msanidi akaunti...');
        break;

      // Charge Customer flow
      case STATE.CHARGE_CUSTOMER_AMOUNT:
        logger.info('Routing to charge customer amount handler');
        response = await handleChargeCustomerAmount(phone, text, session);
        break;

      case STATE.CHARGE_CUSTOMER_PHONE:
        logger.info('Routing to charge customer phone handler');
        response = await handleChargeCustomerPhone(phone, text, session);
        break;

      case STATE.CHARGE_CUSTOMER_NETWORK:
        logger.info('Routing to charge customer network handler');
        response = await handleChargeCustomerNetwork(phone, text, session);
        break;

      case STATE.CHARGE_CUSTOMER_PROCESSING:
        logger.info('Routing to charge customer processing handler');
        response = await handleChargeCustomerProcessing(phone, text, session);
        break;

      // Pay Rent flow
      case STATE.PAY_RENT_WAITING_ID:
        logger.info('Routing to pay rent ID handler');
        response = await handlePayRentId(phone, text, session);
        break;

      case STATE.PAY_RENT_CONFIRM:
        logger.info('Routing to pay rent confirm handler');
        response = await handlePayRentConfirm(phone, text, session);
        break;

      case STATE.PAY_RENT_MPESA:
        logger.info('Routing to pay rent M-Pesa handler');
        response = await handlePayRentMpesa(phone, text, session);
        break;

      case STATE.PAY_RENT_AMOUNT:
        logger.info('Routing to pay rent amount handler');
        response = await handlePayRentAmount(phone, text, session);
        break;

      case STATE.PAY_RENT_PROCESSING:
        logger.info('Routing to pay rent processing handler');
        response = await handlePayRentProcessing(phone, text, session);
        break;

      case STATE.PAY_RENT_CONFIRM_AMOUNT:
        logger.info('Routing to pay rent confirm amount handler');
        response = await handlePayRentConfirmAmount(phone, text, session);
        break;

      case STATE.GET_INVOICE_WAITING_ID:
        logger.info('Routing to get invoice handler');
        // Check if this is the first request (just entered this state) or a follow-up
        const isFirstInvoiceRequest = session.context.tenantId === undefined;
        if (isFirstInvoiceRequest) {
          response = await handleGetInvoiceId(phone, text, session);
        } else {
          response = await handleGetInvoiceMenu(phone, text, session);
        }
        break;

      // ── My Chama flow (cross-project: mychama1) ──
      case STATE.MYCHAMA_AUTH_ID:
        logger.info('Routing to My Chama identity verification');
        response = await handleMyChamaAuthId(phone, text, session);
        break;

      case STATE.MYCHAMA_SELECT_CHAMA:
        logger.info('Routing to My Chama selector');
        response = await handleMyChamaSelectChama(phone, text, session);
        break;

      case STATE.MYCHAMA_MENU:
        logger.info('Routing to My Chama menu');
        response = await handleMyChamaMenu(phone, text, session);
        break;

      case STATE.MYCHAMA_CONTRIB_SELECT:
        logger.info('Routing to My Chama contribution selector');
        response = await handleContributionSelect(phone, text, session);
        break;

      case STATE.MYCHAMA_CONTRIB_AMOUNT:
        logger.info('Routing to My Chama contribution amount');
        response = await handleContributionAmount(phone, text, session);
        break;

      case STATE.MYCHAMA_LOAN_PRODUCT:
        logger.info('Routing to My Chama loan product');
        response = await handleLoanProduct(phone, text, session);
        break;

      case STATE.MYCHAMA_LOAN_AMOUNT:
        logger.info('Routing to My Chama loan amount');
        response = await handleLoanAmount(phone, text, session);
        break;

      case STATE.MYCHAMA_LOAN_TERM:
        logger.info('Routing to My Chama loan term');
        response = await handleLoanTerm(phone, text, session);
        break;

      case STATE.MYCHAMA_LOAN_PURPOSE:
        logger.info('Routing to My Chama loan purpose');
        response = await handleLoanPurpose(phone, text, session);
        break;

      case STATE.MYCHAMA_LOAN_CONFIRM:
        logger.info('Routing to My Chama loan confirmation');
        response = await handleLoanConfirm(phone, text, session);
        break;

      case STATE.MYCHAMA_LOAN_PAY_SELECT:
        logger.info('Routing to My Chama loan repayment selector');
        response = await handleLoanPaySelect(phone, text, session);
        break;

      case STATE.MYCHAMA_LOAN_PAY_AMOUNT:
        logger.info('Routing to My Chama loan repayment amount');
        response = await handleLoanPayAmount(phone, text, session);
        break;

      case STATE.MYCHAMA_LOAN_BALANCE:
        logger.info('Routing to My Chama loan balance');
        response = await handleLoanBalance(phone, text, session);
        break;

      case STATE.MYCHAMA_MGR_SELECT:
        logger.info('Routing to My Chama merry-go-round selector');
        response = await handleMgrSelect(phone, text, session);
        break;

      case STATE.MYCHAMA_MGR_DETAIL:
        logger.info('Routing to My Chama merry-go-round detail');
        response = await handleMgrDetail(phone, text, session);
        break;

      case STATE.MYCHAMA_MGR_HISTORY:
        logger.info('Routing to My Chama merry-go-round history');
        response = await handleMgrHistory(phone, text, session);
        break;

      case STATE.MYCHAMA_STATEMENT_TYPE:
        logger.info('Routing to My Chama statement type');
        response = await handleStatementType(phone, text, session);
        break;

      case STATE.MYCHAMA_STATEMENT_PERIOD:
        logger.info('Routing to My Chama statement period');
        response = await handleStatementPeriod(phone, text, session);
        break;

      case STATE.MYCHAMA_STATEMENT_VIEW:
        logger.info('Routing to My Chama statement view');
        response = await handleStatementView(phone, text, session);
        break;

      case STATE.MYCHAMA_PAY_PHONE:
        logger.info('Routing to My Chama payment phone');
        response = await handlePayPhone(phone, text, session);
        break;

      case STATE.MYCHAMA_PAY_PROVIDER:
        logger.info('Routing to My Chama payment provider');
        response = await handlePayProvider(phone, text, session);
        break;

      case STATE.MYCHAMA_PAY_CONFIRM:
        logger.info('Routing to My Chama payment confirmation');
        response = await handlePayConfirm(phone, text, session);
        break;
      default:
        logger.warn('Unknown state', { state: session.currentState });
        response = getMessage('SYSTEM_ERROR', session.language);
        await updateSessionState(phone, STATE.MAIN_MENU, {});
    }

    // Log handler response
    logger.info('Handler executed', {
      handlerResponse: response ? response.substring(0, 100) : null,
      responseLength: response?.length || 0,
    });

    // Send response to user
    if (response) {
      const formattedPhone = formatPhoneForWhatsApp(phone);
      logger.info('Sending WhatsApp message', {
        recipientPhone: formattedPhone,
        messageLength: response.length,
      });
      await sendWhatsAppMessage(formattedPhone, response);
      logger.info('Message sent successfully');
    } else {
      logger.warn('No response generated from handler');
    }
  } catch (error) {
    logger.error('Error processing message', error);

    // Try to send error message to user
    try {
      const formattedPhone = formatPhoneForWhatsApp(message.from);
      const errorMessage = 'An error occurred. Please try again.';
      await sendWhatsAppMessage(formattedPhone, errorMessage);
    } catch (sendError) {
      logger.error('Failed to send error message', sendError);
    }
  } finally {
    logger.clearContext();
  }
}
