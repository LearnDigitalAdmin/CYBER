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
  handleMyChamaAuthPhone,
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
  handleMgrPayAmount,
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
import { handleWatchMessage, handleStaleWatchTap, isWatchButtonId } from '../handlers/watch.entry';
import { isWatchState } from '../handlers/watch.handler';
import { claimMessage } from '../services/message-dedup.service';
import { logger } from '../utils/logger';
import { STATE } from '../constants/states';
import { getMessage } from '../constants/messages';

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
    // Reply-button / list-row taps arrive as `interactive`; typed text as `text`.
    const interactiveId = message.interactive?.button_reply?.id || message.interactive?.list_reply?.id || '';
    const text = message.text?.body || interactiveId || '';
    const messageId = message.id;

    logger.setContext({ phone });
    logger.info('Processing WhatsApp message', {
      messageId,
      phone,
      textLength: text.length,
      // The message body is deliberately not logged: it can be an OTP code, an ID number or a phone number.
      messageType: message.type,
    });

    // Get or create session
    let session = await createOrGetSession(phone);

    // WhatsApp retries a delivery it thinks failed; handle each message id once.
    if (!(await claimMessage(phone, messageId))) {
      logger.info('Duplicate WhatsApp message ignored', { messageId });
      return;
    }
    logger.info('Session retrieved/created', {
      phone,
      sessionId: phone,
      currentState: session.currentState,
      language: session.language,
    });
    logger.setContext({ phone, state: session.currentState });

    // Route to appropriate handler based on current state
    let response: string | null = null;

    // ── Landlord Watch: replies are sent by the module itself (buttons, lists, documents) ──
    if (isWatchState(session.currentState)) {
      await handleWatchMessage(phone, { text, interactiveId: interactiveId || undefined }, session, message.timestamp);
      return;
    }
    if (isWatchButtonId(interactiveId)) {
      // A Landlord Watch button tapped after the user already left the module
      await handleStaleWatchTap(phone, session);
      return;
    }

    switch (session.currentState) {
      case STATE.LANGUAGE_SELECTION:
        logger.info('Routing to language selection handler');
        response = await handleLanguageSelection(phone, text, session);
        break;

      case STATE.MAIN_MENU:
        logger.info('Routing to main menu handler');
        response = await handleMainMenu(phone, text, session);
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
      case STATE.MYCHAMA_AUTH_PHONE:
        logger.info('Routing to My Chama registered-phone step');
        response = await handleMyChamaAuthPhone(phone, text, session);
        break;

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

      case STATE.MYCHAMA_MGR_PAY_AMOUNT:
        logger.info('Routing to My Chama MGR payment amount');
        response = await handleMgrPayAmount(phone, text, session);
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
      // Handlers such as Landlord Watch send their own replies and return an empty string.
      logger.info('Handler returned no direct reply');
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
