/**
 * Rent Payment Handler
 * Handles complete rent payment flow: tenant lookup, invoice retrieval, payment processing, PDF generation
 */

import { Session } from '../types/session.types';
import { updateSessionState, updateSessionContext, clearSessionContext } from '../services/session.service';
import {
  validateNationalId,
  validatePhoneNumber,
  checkNavigationCommand,
} from '../utils/validator';
import { getMessage } from '../constants/messages';
import { STATE } from '../constants/states';
import { logger } from '../utils/logger';
import { db } from '../config/firebase.config';
import { generateInvoicePDF } from '../services/pdf.service';
import { uploadPDFToStorage, generatePDFFileName } from '../services/storage.service';
import { initiatePayment, hasPaymentInfo, getAssetContactInfo } from '../services/payment.service';

interface TenantData {
  id: string;
  localId: number;
  name: string;
  phone?: string;
  email?: string;
  rentAmount?: number;
}

interface InvoiceData {
  id: string;
  tenantId: number;
  propertyId: number;
  billingMonth: string;
  rentAmount: number;
  waterCharges?: number;
  powerCharges?: number;
  otherCharges?: number;
  totalAmount: number;
  amountPaid: number;
  arrears: number;
  isPaid: boolean;
  dueDate?: string;
  paidDate?: string;
  pdfUrl?: string;
}

/**
 * Helper: Handle navigation commands (0, 00, 000)
 */
async function handleNavigation(
  phone: string,
  input: string,
  session: Session,
  previousState?: STATE
): Promise<{ response: string | null; handled: boolean }> {
  const nav = checkNavigationCommand(input);

  if (nav.type === 'exit') {
    logger.info('User exiting to language selection', { phone });
    await clearSessionContext(phone);
    await updateSessionState(phone, STATE.LANGUAGE_SELECTION, {});
    return {
      response: getMenu('WELCOME', session.language),
      handled: true,
    };
  }

  if (nav.type === 'restart') {
    logger.info('User restarting rent payment', { phone });
    await clearSessionContext(phone);
    await updateSessionState(phone, STATE.PAY_RENT_WAITING_ID, {});
    return {
      response: getMessage('ENTER_TENANT_ID', session.language) + getMessage('NAVIGATION_HELP', session.language),
      handled: true,
    };
  }

  if (nav.type === 'back') {
    if (!previousState) {
      return {
        response: getMessage('INVALID_INPUT', session.language),
        handled: true,
      };
    }

    logger.info('User going back', { phone, from: session.currentState, to: previousState });
    await updateSessionState(phone, previousState, {});
    return {
      response: null,
      handled: true,
    };
  }

  return { response: null, handled: false };
}

/**
 * Format currency for display
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
  }).format(amount);
}

/**
 * Import menus
 */
import { getMenu } from '../constants/menus';

/**
 * Handle tenant ID for pay rent
 */
export async function handlePayRentId(phone: string, input: string, session: Session): Promise<string> {
  try {
    // Check navigation
    const nav = await handleNavigation(phone, input, session);
    if (nav.handled && nav.response) return nav.response;
    if (nav.handled) {
      return getMessage('ENTER_TENANT_ID', session.language) + getMessage('NAVIGATION_HELP', session.language);
    }

    // Validate tenant ID format
    if (!validateNationalId(input)) {
      return (
        getMessage('INVALID_ID', session.language) +
        '\n\n' +
        getMessage('ENTER_TENANT_ID', session.language) +
        getMessage('NAVIGATION_HELP', session.language)
      );
    }

    const tenantId = input.trim();

    // Perform the search immediately (don't wait for next message)
    logger.info('Tenant ID collected, searching for tenant and invoice', { tenantId });

    // Search for tenant and invoice in Firestore
    const usersRef = db.collection('users');
    const allUsers = await usersRef.get();

    let foundTenant: TenantData | null = null;
    let foundInvoice: InvoiceData | null = null;
    let assetId: string | null = null;

    // Search through all users for the tenant
    for (const userDoc of allUsers.docs) {
      const tenantIdNum = parseInt(tenantId);
      const searchIds = isNaN(tenantIdNum) ? [tenantId] : [tenantId, tenantIdNum];

      try {
        const tenantsRef = userDoc.ref.collection('tenants');
        const tenantSnapshot = await tenantsRef.where('localId', 'in', searchIds).get();

        if (!tenantSnapshot.empty) {
          const tenantDoc = tenantSnapshot.docs[0];
          foundTenant = {
            id: tenantDoc.id,
            ...(tenantDoc.data() as any),
          };
          assetId = userDoc.id;

          logger.info('Tenant found', { tenantId, assetId });
          break;
        }
      } catch (err) {
        // Continue searching other users
        continue;
      }
    }

    if (!foundTenant) {
      logger.warn('Tenant not found', { tenantId });
      return (
        getMessage('TENANT_NOT_FOUND', session.language) +
        '\n\n' +
        getMessage('ENTER_TENANT_ID', session.language) +
        getMessage('NAVIGATION_HELP', session.language)
      );
    }

    // Find unpaid invoice or last paid invoice
    if (assetId) {
      const invoicesRef = db.collection('users').doc(assetId).collection('invoices');
      const tenantIdNum = parseInt(tenantId);
      const searchIds = isNaN(tenantIdNum) ? [tenantId] : [tenantId, tenantIdNum];

      // Search for unpaid invoices first
      const unpaidSnapshot = await invoicesRef
        .where('tenantId', 'in', searchIds)
        .where('isPaid', '==', false)
        .get();

      if (!unpaidSnapshot.empty) {
        const invoiceDoc = unpaidSnapshot.docs[0];
        foundInvoice = {
          id: invoiceDoc.id,
          ...(invoiceDoc.data() as any),
        };
      }
    }

    if (!foundInvoice) {
      logger.warn('No invoice found for tenant', { tenantId });
      return (
        getMessage('INVOICE_NOT_FOUND', session.language) +
        '\n\n' +
        getMessage('ENTER_TENANT_ID', session.language) +
        getMessage('NAVIGATION_HELP', session.language)
      );
    }

    // Store found data in session
    await updateSessionContext(phone, {
      tenantId,
      foundTenant: JSON.stringify(foundTenant),
      foundInvoice: JSON.stringify(foundInvoice),
      assetId,
    });

    // Move to next state
    await updateSessionState(phone, STATE.PAY_RENT_MPESA, {});

    const outstanding = foundInvoice.totalAmount - foundInvoice.amountPaid;

    return (
      session.language === 'en'
        ? `*Tenant Found! 🎯*\n\n📱 Name: ${foundTenant.name}\n💰 Outstanding: ${formatCurrency(outstanding)}\n📅 Billing: ${foundInvoice.billingMonth}\n\nReply *CONTINUE* to proceed`
        : `*Mkokoteni Aliyepatikana! 🎯*\n\n📱 Jina: ${foundTenant.name}\n💰 Unajifunguka: ${formatCurrency(outstanding)}\n📅 Billi: ${foundInvoice.billingMonth}\n\nJibu *ENDELEA* kuendelea`
    );
  } catch (error) {
    logger.error('Error handling rent ID', error);
    await clearSessionContext(phone);
    await updateSessionState(phone, STATE.MAIN_MENU, {});
    return getMessage('SYSTEM_ERROR', session.language);
  }
}

/**
 * Step 2: Confirm tenant found and move to payment
 */
export async function handlePayRentConfirm(phone: string, input: string, session: Session): Promise<string> {
  try {
    // Check navigation
    const nav = await handleNavigation(phone, input, session, STATE.PAY_RENT_WAITING_ID);
    if (nav.handled && nav.response) return nav.response;
    if (nav.handled) {
      return getMessage('ENTER_TENANT_ID', session.language) + getMessage('NAVIGATION_HELP', session.language);
    }

    const context = session.context;
    const foundTenant = context.foundTenant ? JSON.parse(context.foundTenant as string) : null;
    const foundInvoice = context.foundInvoice ? JSON.parse(context.foundInvoice as string) : null;

    if (!foundTenant || !foundInvoice) {
      // Search was not completed or failed, go back
      await updateSessionState(phone, STATE.PAY_RENT_WAITING_ID, {});
      return getMessage('ENTER_TENANT_ID', session.language) + getMessage('NAVIGATION_HELP', session.language);
    }

    const response = input.trim().toUpperCase();

    // Handle user response
    if (response === 'CONTINUE' || response === 'ENDELEA') {
      // Proceed to M-Pesa phone entry
      await updateSessionState(phone, STATE.PAY_RENT_MPESA, {});

      return (
        getMessage('ENTER_MPESA_PHONE', session.language) +
        getMessage('NAVIGATION_HELP', session.language)
      );
    } else {
      // Invalid response - stay on same screen
      const outstanding = foundInvoice.totalAmount - foundInvoice.amountPaid;
      const confirmMessage = session.language === 'en'
        ? `*Tenant Found! 🎯*\n\n📱 Name: ${foundTenant.name}\n💰 Outstanding: ${formatCurrency(outstanding)}\n📅 Billing: ${foundInvoice.billingMonth}\n\nReply *CONTINUE* to pay${getMessage('NAVIGATION_HELP', session.language)}`
        : `*Mkokoteni Aliyepatikana! 🎯*\n\n📱 Jina: ${foundTenant.name}\n💰 Unajifunguka: ${formatCurrency(outstanding)}\n📅 Billi: ${foundInvoice.billingMonth}\n\nJibu *ENDELEA* kulipa${getMessage('NAVIGATION_HELP', session.language)}`;

      return confirmMessage;
    }
  } catch (error) {
    logger.error('Error searching for tenant/invoice', error);
    await clearSessionContext(phone);
    await updateSessionState(phone, STATE.MAIN_MENU, {});
    return getMessage('SYSTEM_ERROR', session.language);
  }
}

/**
 * Step 3: Confirm and collect M-Pesa details
 */
export async function handlePayRentMpesa(phone: string, input: string, session: Session): Promise<string> {
  try {
    // Check navigation
    const nav = await handleNavigation(phone, input, session, STATE.PAY_RENT_CONFIRM);
    if (nav.handled && nav.response) return nav.response;
    if (nav.handled) {
      return getMessage('ENTER_TENANT_ID', session.language) + getMessage('NAVIGATION_HELP', session.language);
    }

    const response = input.trim().toUpperCase();

    // Handle EDIT request
    if (['EDIT', 'BAGUISHA', 'NO'].includes(response)) {
      logger.info('User requested to edit tenant', { phone });
      await clearSessionContext(phone);
      await updateSessionState(phone, STATE.PAY_RENT_WAITING_ID, {});
      return getMessage('ENTER_TENANT_ID', session.language) + getMessage('NAVIGATION_HELP', session.language);
    }

    // Handle CONTINUE
    if (['CONTINUE', 'ENDELEA', 'YES', 'NDIO'].includes(response)) {
      logger.info('User proceeding to payment', { phone });
      await updateSessionState(phone, STATE.PAY_RENT_AMOUNT, {});
      return (
        getMessage('ENTER_MPESA_PHONE', session.language) +
        '\n\n' +
        getMessage('NAVIGATION_HELP', session.language)
      );
    }

    // Invalid response - show options again
    const context = session.context;
    const foundTenant = JSON.parse(context.foundTenant as string);
    const foundInvoice = JSON.parse(context.foundInvoice as string);
    const outstanding = foundInvoice.totalAmount - foundInvoice.amountPaid;

    return (
      getMessage('INVALID_INPUT', session.language) +
      '\n\n' +
      `*Tenant Found! 🎯*\n\n📱 Name: ${foundTenant.name}\n💰 Outstanding: ${formatCurrency(outstanding)}\n📅 Billing: ${foundInvoice.billingMonth}\n\nReply *CONTINUE* to pay or *EDIT* to search again` +
      getMessage('NAVIGATION_HELP', session.language)
    );
  } catch (error) {
    logger.error('Error handling rent confirmation', error);
    return getMessage('SYSTEM_ERROR', session.language);
  }
}

/**
 * Step 4: Collect M-Pesa phone and amount
 */
export async function handlePayRentAmount(phone: string, input: string, session: Session): Promise<string> {
  try {
    // Check navigation
    const nav = await handleNavigation(phone, input, session, STATE.PAY_RENT_CONFIRM);
    if (nav.handled && nav.response) return nav.response;
    if (nav.handled) {
      return getMessage('ENTER_TENANT_ID', session.language) + getMessage('NAVIGATION_HELP', session.language);
    }

    const mpesaPhone = input.trim();
    const validation = validatePhoneNumber(mpesaPhone);

    if (!validation.valid || !validation.formatted) {
      return (
        getMessage('INVALID_PHONE', session.language) +
        '\n\n' +
        getMessage('ENTER_MPESA_PHONE', session.language) +
        getMessage('NAVIGATION_HELP', session.language)
      );
    }

    // Store raw phone in 07/01 format for payment service to format
    await updateSessionContext(phone, { mpesaPhone });
    const context = session.context;
    const foundInvoice = JSON.parse(context.foundInvoice as string);
    const outstanding = foundInvoice.totalAmount - foundInvoice.amountPaid;

    const amountPrompt =
      getMessage('ENTER_PAYMENT_AMOUNT', session.language, {
        outstanding: formatCurrency(outstanding),
      }) + getMessage('NAVIGATION_HELP', session.language);

    await updateSessionState(phone, STATE.PAY_RENT_PROCESSING, {});
    return amountPrompt;
  } catch (error) {
    logger.error('Error handling M-Pesa phone', error);
    return getMessage('SYSTEM_ERROR', session.language);
  }
}

/**
 * Step 5: Process payment
 */
export async function handlePayRentProcessing(phone: string, input: string, session: Session): Promise<string> {
  try {
    // Check navigation
    const nav = await handleNavigation(phone, input, session, STATE.PAY_RENT_AMOUNT);
    if (nav.handled && nav.response) return nav.response;
    if (nav.handled) {
      const context = session.context;
      const foundInvoice = JSON.parse(context.foundInvoice as string);
      const outstanding = foundInvoice.totalAmount - foundInvoice.amountPaid;
      return (
        getMessage('ENTER_PAYMENT_AMOUNT', session.language, {
          outstanding: formatCurrency(outstanding),
        }) + getMessage('NAVIGATION_HELP', session.language)
      );
    }

    const amountInput = input.trim();
    const amount = parseFloat(amountInput);

    if (isNaN(amount) || amount <= 0) {
      return (
        getMessage('INVALID_AMOUNT', session.language) +
        getMessage('NAVIGATION_HELP', session.language)
      );
    }

    const context = session.context;
    const foundInvoice = JSON.parse(context.foundInvoice as string);
    const outstanding = foundInvoice.totalAmount - foundInvoice.amountPaid;

    if (amount > outstanding) {
      return (
        getMessage('INVALID_AMOUNT_EXCEEDS', session.language, {
          outstanding: formatCurrency(outstanding),
        }) + getMessage('NAVIGATION_HELP', session.language)
      );
    }

    await updateSessionContext(phone, { paymentAmount: amount });
    await updateSessionState(phone, STATE.PAY_RENT_CONFIRM_AMOUNT, {});

    const summaryMessage = `*Payment Summary* 💳\n\n💰 Amount: ${formatCurrency(amount)}\n📱 Phone: ${context.mpesaPhone}\n✅ Reply *YES* to confirm or *BACK* to edit${getMessage('NAVIGATION_HELP', session.language)}`;

    return summaryMessage;
  } catch (error) {
    logger.error('Error processing payment amount', error);
    return getMessage('SYSTEM_ERROR', session.language);
  }
}

/**
 * Step 6: Confirm and complete payment
 */
export async function handlePayRentConfirmAmount(phone: string, input: string, session: Session): Promise<string> {
  try {
    // Check navigation
    const nav = await handleNavigation(phone, input, session, STATE.PAY_RENT_PROCESSING);
    if (nav.handled && nav.response) return nav.response;
    if (nav.handled) {
      const context = session.context;
      const foundInvoice = JSON.parse(context.foundInvoice as string);
      const outstanding = foundInvoice.totalAmount - foundInvoice.amountPaid;
      return (
        getMessage('ENTER_PAYMENT_AMOUNT', session.language, {
          outstanding: formatCurrency(outstanding),
        }) + getMessage('NAVIGATION_HELP', session.language)
      );
    }

    const response = input.trim().toUpperCase();

    if (!['YES', 'Y', 'NDIO', 'NDIYO'].includes(response)) {
      return (
        getMessage('INVALID_INPUT', session.language) +
        '\n\n*Confirm Payment* ✅\n\nReply *YES* to proceed' +
        getMessage('NAVIGATION_HELP', session.language)
      );
    }

    logger.info('Processing rent payment', { phone });

    const context = session.context;
    const foundTenant = JSON.parse(context.foundTenant as string);
    const foundInvoice = JSON.parse(context.foundInvoice as string);
    const mpesaPhone = context.mpesaPhone as string;
    const paymentAmount = context.paymentAmount as number;
    const assetId = context.assetId as string;

    // CRITICAL: Update state immediately to prevent duplicate processing
    // if webhook receives the same message twice
    await updateSessionState(phone, STATE.PAY_RENT_PROCESSING, {});

    // Process payment and update invoice
    try {
      logger.info('Processing rent payment', {
        phone: mpesaPhone,
        amount: paymentAmount,
        tenantName: foundTenant.name,
        invoiceId: foundInvoice.id,
        assetId,
      });

      // Step 1: Fetch asset document to get payment info and contact details
      let assetData: any = null;
      try {
        const assetDoc = await db.collection('users').doc(assetId).get();
        if (assetDoc.exists) {
          assetData = assetDoc.data();
          logger.info('Asset document retrieved', {
            assetId,
            hasPaymentInfo: hasPaymentInfo(assetData),
          });
        }
      } catch (assetError) {
        logger.warn('Failed to fetch asset document', assetError);
      }

      // Step 2: Check if asset has payment processing capability
      if (!hasPaymentInfo(assetData)) {
        // No payment info - provide fallback contact info
        const contactInfo = getAssetContactInfo(assetData);
        const assetPhone = contactInfo.phone || 'unavailable';
        const assetName = contactInfo.name || 'Property Manager';

        logger.info('Asset has no payment processing info, providing contact fallback', {
          assetId,
          assetPhone,
        });

        // Clear session and show fallback message
        await clearSessionContext(phone);
        await updateSessionState(phone, STATE.MAIN_MENU, {});

        const fallbackMessage = session.language === 'en'
          ? `*Payment Processing Not Available* ⚠️\n\nPayment processing is currently unavailable for this property.\n\n📱 Please contact the property manager:\n*${assetName}*\n📞 ${assetPhone}\n\nThey will assist you with the payment process.\n\nReturning to Main Menu...`
          : `*Malipo Hayana Available* ⚠️\n\nMalipo hayawezi kusindikwa kwa sasa kwa mali hii.\n\n📱 Tafadhali wasiliana na mkadhi wa mali:\n*${assetName}*\n📞 ${assetPhone}\n\nWatakutulia na mchakato wa malipo.\n\nKurudi kwenye Menuu Kuu...`;

        return fallbackMessage;
      }

      // Step 3: Initiate payment with asset details
      let paymentReference: string = '';
      let paymentSucceeded = false;

      try {
        const paymentResult = await initiatePayment({
          invoiceId: foundInvoice.id as any,
          invoice: foundInvoice,
          tenantName: foundTenant.name,
          amount: paymentAmount,
          phone: mpesaPhone,
          paymentMethod: 'mpesa',
          assetId,
          assetName: assetData?.name,
        });

        if (!paymentResult.success) {
          logger.error('Payment initiation failed', {
            reference: paymentResult.reference,
            message: paymentResult.message,
          });

          // Clear session and show error - DO NOT update invoice
          await clearSessionContext(phone);
          await updateSessionState(phone, STATE.MAIN_MENU, {});

          const errorMsg = session.language === 'en'
            ? `*Payment Failed* ❌\n\n${paymentResult.message}\n\nPlease try again later or contact support.\n\nReturning to Main Menu...`
            : `*Malipo Yameshindwa* ❌\n\n${paymentResult.message}\n\nTafadhali jaribu tena au wasiliana na msaada.\n\nKurudi kwenye Menuu Kuu...`;

          return errorMsg;
        }

        paymentReference = paymentResult.reference;
        paymentSucceeded = true;

        logger.info('Payment initiated successfully', {
          reference: paymentReference,
          phone: mpesaPhone,
          amount: paymentAmount,
          tenantId: foundTenant.localId,
        });
      } catch (paymentInitError) {
        logger.error('Payment initiation error', paymentInitError);

        // Clear session and show error - DO NOT update invoice
        await clearSessionContext(phone);
        await updateSessionState(phone, STATE.MAIN_MENU, {});

        const errorMsg = session.language === 'en'
          ? `*Payment Failed* ❌\n\nAn unexpected error occurred. Please try again later.\n\nReturning to Main Menu...`
          : `*Malipo Yameshindwa* ❌\n\nKulikuwa na hitilafu. Tafadhali jaribu baadaye.\n\nKurudi kwenye Menuu Kuu...`;

        return errorMsg;
      }

      // Step 4: Update invoice status ONLY if payment succeeded
      let pdfUrl: string | undefined;

      if (paymentSucceeded && foundInvoice.id && foundInvoice.id !== 'temp' && assetId) {
        const invoiceRef = db.collection('users').doc(assetId).collection('invoices').doc(foundInvoice.id.toString());
        const newAmountPaid = foundInvoice.amountPaid + paymentAmount;
        const isPaid = newAmountPaid >= foundInvoice.totalAmount;

        // Step 5: Generate, upload PDF, and get URL (BEFORE updating invoice)
        try {
          logger.info('Generating invoice PDF', {
            tenantId: foundTenant.localId,
            invoiceId: foundInvoice.id,
          });

          const updatedInvoiceData = {
            ...foundInvoice,
            amountPaid: newAmountPaid,
            isPaid: isPaid,
            paidDate: isPaid ? new Date().toLocaleDateString('en-KE') : undefined,
          };

          // Generate PDF buffer
          const pdfBuffer = await generateInvoicePDF(
            foundTenant,
            updatedInvoiceData,
            assetData?.name || 'Property'
          );

          logger.info('Invoice PDF generated successfully', {
            tenantId: foundTenant.localId,
            pdfSize: pdfBuffer.length,
          });

          // Upload PDF to Cloud Storage
          // Path: invoices/{assetId}/{tenantId}/invoice_{tenantName}_{invoiceId}.pdf
          const fileName = generatePDFFileName(foundTenant.name, foundInvoice.id.toString());
          pdfUrl = await uploadPDFToStorage(pdfBuffer, fileName, assetId, foundTenant.localId.toString());

          logger.info('PDF uploaded to Cloud Storage', {
            fileName,
            pdfUrl,
          });
        } catch (pdfError) {
          logger.warn('Failed to generate or upload PDF', pdfError);
          // Continue without PDF - don't fail the entire payment process
        }

        // Step 6: Update invoice - First phase: update amount, reference, and PDF URL
        const updateDataPhase1: any = {
          amountPaid: newAmountPaid,
          paymentReference: paymentReference,
          updatedAt: new Date(),
        };

        // Add PDF URL if successfully generated
        if (pdfUrl) {
          updateDataPhase1.pdfUrl = pdfUrl;
        }

        await invoiceRef.update(updateDataPhase1);

        logger.info('Invoice Phase 1 updated: amount, reference, PDF URL', {
          invoiceId: foundInvoice.id,
          amountPaid: newAmountPaid,
          paymentReference: paymentReference,
          hasPdfUrl: !!pdfUrl,
        });

        // Step 6b: Wait before updating status (timeout for transaction confirmation)
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay

        // Step 6c: Update invoice - Second phase: update status (isPaid)
        const updateDataPhase2: any = {
          isPaid: isPaid,
          paidDate: isPaid ? new Date() : null,
          updatedAt: new Date(),
        };

        await invoiceRef.update(updateDataPhase2);

        logger.info('Invoice Phase 2 updated: payment status', {
          invoiceId: foundInvoice.id,
          isPaid,
          paidDate: isPaid ? new Date().toISOString() : null,
        });
      }

      // Step 7: Clear session and return to main menu
      await clearSessionContext(phone);
      await updateSessionState(phone, STATE.MAIN_MENU, {});

      const successMessage = session.language === 'en'
        ? `*Payment Initiated! ✅*\n\n💰 Amount: ${formatCurrency(paymentAmount)}\n📱 Tenant: ${foundTenant.name}\n📱 Phone: ${mpesaPhone}\n📅 Date: ${new Date().toLocaleDateString('en-KE')}\n\n*Reference:* ${paymentReference}\n\n📲 You will receive an M-Pesa prompt shortly.\nPlease enter your M-Pesa PIN to complete the payment.\n\nInvoice has been updated in the system.\n\nReturning to Main Menu...`
        : `*Malipo Umeingia! ✅*\n\n💰 Kiasi: ${formatCurrency(paymentAmount)}\n📱 Mkokoteni: ${foundTenant.name}\n📱 Simu: ${mpesaPhone}\n📅 Tarehe: ${new Date().toLocaleDateString('en-KE')}\n\n*Kumbuka:* ${paymentReference}\n\n📲 Utapokea ujumbe wa M-Pesa karibuni.\nTafadhali ingiza namba yako ya M-Pesa kwa kummaliza malipo.\n\nAnkara imebadilishwa katika mfumo.\n\nKurudi kwenye Menuu Kuu...`;

      return successMessage;
    } catch (paymentError) {
      logger.error('Payment processing failed', paymentError);

      // Clear session on payment error and return to main menu
      await clearSessionContext(phone);
      await updateSessionState(phone, STATE.MAIN_MENU, {});

      const errorMessage =
        paymentError instanceof Error ? paymentError.message : 'Payment processing failed';
      const errorMsg = session.language === 'en'
        ? `*Payment Failed* ❌\n\n${errorMessage}\n\nPlease try again later or contact support.\n\nReturning to Main Menu...`
        : `*Malipo Yameshindwa* ❌\n\n${errorMessage}\n\nTafadhali jaribu tena au wasiliana na msaada.\n\nKurudi kwenye Menuu Kuu...`;

      return errorMsg;
    }
  } catch (error) {
    logger.error('Error confirming rent payment', error);

    // Clear session on error
    await clearSessionContext(phone);
    await updateSessionState(phone, STATE.MAIN_MENU, {});

    return getMessage('SYSTEM_ERROR', session.language);
  }
}

/**
 * Get Invoice Handler
 * Fetch and display tenant invoice with PDF link if available
 * Similar to Pay Rent flow but only retrieves and displays invoice
 */
export async function handleGetInvoiceId(phone: string, input: string, session: Session): Promise<string> {
  try {
    // Check navigation
    const nav = await handleNavigation(phone, input, session);
    if (nav.handled && nav.response) return nav.response;
    if (nav.handled) {
      return getMessage('ENTER_TENANT_ID', session.language) + getMessage('NAVIGATION_HELP', session.language);
    }

    // Validate tenant ID format
    if (!validateNationalId(input)) {
      return (
        getMessage('INVALID_ID', session.language) +
        '\n\n' +
        getMessage('ENTER_TENANT_ID', session.language) +
        getMessage('NAVIGATION_HELP', session.language)
      );
    }

    const tenantId = input.trim();

    logger.info('🔍 Get Invoice: Tenant ID collected, searching for tenant and invoice', { tenantId });

    // Search for tenant and invoice in Firestore (same as Pay Rent)
    const usersRef = db.collection('users');
    const allUsers = await usersRef.get();

    let foundTenant: TenantData | null = null;
    let foundInvoice: InvoiceData | null = null;
    let assetId: string | null = null;

    // Search through all users for the tenant
    for (const userDoc of allUsers.docs) {
      const tenantIdNum = parseInt(tenantId);
      const searchIds = isNaN(tenantIdNum) ? [tenantId] : [tenantId, tenantIdNum];

      try {
        const tenantsRef = userDoc.ref.collection('tenants');
        const tenantSnapshot = await tenantsRef.where('localId', 'in', searchIds).get();

        if (!tenantSnapshot.empty) {
          const tenantDoc = tenantSnapshot.docs[0];
          foundTenant = {
            id: tenantDoc.id,
            ...(tenantDoc.data() as any),
          };
          assetId = userDoc.id;

          logger.info('👤 Tenant found for invoice retrieval', { tenantId, assetId });
          break;
        }
      } catch (err) {
        // Continue searching other users
        continue;
      }
    }

    if (!foundTenant) {
      logger.warn('❌ Tenant not found for invoice', { tenantId });
      return (
        getMessage('TENANT_NOT_FOUND', session.language) +
        '\n\n' +
        getMessage('ENTER_TENANT_ID', session.language) +
        getMessage('NAVIGATION_HELP', session.language)
      );
    }

    // Find unpaid invoice or last paid invoice
    if (assetId) {
      const invoicesRef = db.collection('users').doc(assetId).collection('invoices');
      const tenantIdNum = parseInt(tenantId);
      const searchIds = isNaN(tenantIdNum) ? [tenantId] : [tenantId, tenantIdNum];

      // Search for unpaid invoices first
      const unpaidSnapshot = await invoicesRef
        .where('tenantId', 'in', searchIds)
        .where('isPaid', '==', false)
        .get();

      if (!unpaidSnapshot.empty) {
        const invoiceDoc = unpaidSnapshot.docs[0];
        foundInvoice = {
          id: invoiceDoc.id,
          ...(invoiceDoc.data() as any),
        };
      }
    }

    if (!foundInvoice) {
      logger.warn('❌ No invoice found for tenant', { tenantId });
      return (
        getMessage('INVOICE_NOT_FOUND', session.language) +
        '\n\n' +
        getMessage('ENTER_TENANT_ID', session.language) +
        getMessage('NAVIGATION_HELP', session.language)
      );
    }

    // Store found data in session for potential future use
    await updateSessionContext(phone, {
      tenantId,
      foundTenant: JSON.stringify(foundTenant),
      foundInvoice: JSON.stringify(foundInvoice),
      assetId,
    });

    logger.info('📄 Invoice retrieved successfully', {
      tenantId,
      invoiceId: foundInvoice.id,
      hasPdfUrl: !!foundInvoice.pdfUrl,
    });

    // Format invoice display
    const outstanding = foundInvoice.totalAmount - foundInvoice.amountPaid;
    const invoiceDetailsEn = `*Invoice Retrieved! 📄*\n\n👤 Tenant: ${foundTenant.name}\n💰 Rent Amount: ${formatCurrency(foundInvoice.rentAmount)}\n💧 Water: ${formatCurrency(foundInvoice.waterCharges || 0)}\n⚡ Power: ${formatCurrency(foundInvoice.powerCharges || 0)}\n🏷️ Other: ${formatCurrency(foundInvoice.otherCharges || 0)}\n📊 Total: ${formatCurrency(foundInvoice.totalAmount)}\n✅ Paid: ${formatCurrency(foundInvoice.amountPaid)}\n⏳ Outstanding: ${formatCurrency(outstanding)}\n📅 Billing Month: ${foundInvoice.billingMonth}${foundInvoice.dueDate ? `\n📆 Due Date: ${foundInvoice.dueDate}` : ''}${foundInvoice.paidDate ? `\n✔️ Paid Date: ${foundInvoice.paidDate}` : ''}`;

    const invoiceDetailsSw = `*Ankara Imepatikana! 📄*\n\n👤 Mkokoteni: ${foundTenant.name}\n💰 Kodi: ${formatCurrency(foundInvoice.rentAmount)}\n💧 Maji: ${formatCurrency(foundInvoice.waterCharges || 0)}\n⚡ Umeme: ${formatCurrency(foundInvoice.powerCharges || 0)}\n🏷️ Mengine: ${formatCurrency(foundInvoice.otherCharges || 0)}\n📊 Jumla: ${formatCurrency(foundInvoice.totalAmount)}\n✅ Lilipwa: ${formatCurrency(foundInvoice.amountPaid)}\n⏳ Linabaki: ${formatCurrency(outstanding)}\n📅 Mwezi wa Billi: ${foundInvoice.billingMonth}${foundInvoice.dueDate ? `\n📆 Tarehe ya Mwisho: ${foundInvoice.dueDate}` : ''}${foundInvoice.paidDate ? `\n✔️ Tarehe ya Malipo: ${foundInvoice.paidDate}` : ''}`;

    // Add PDF link if available
    const pdfSection = foundInvoice.pdfUrl
      ? (session.language === 'en'
          ? `\n\n📥 *Download Invoice:*\n${foundInvoice.pdfUrl}`
          : `\n\n📥 *Pakua Ankara:*\n${foundInvoice.pdfUrl}`)
      : (session.language === 'en'
          ? '\n\n⚠️ *PDF not yet generated*'
          : '\n\n⚠️ *PDF haijabadilishwa bado*');

    // Add navigation back to menu
    const navigationMsg = session.language === 'en'
      ? `\n\n*Navigation:*\n*0* = Back to Main Menu\n*000* = Exit`
      : `\n\n*Matembezi:*\n*0* = Kurudi kwenye Menuu Kuu\n*000* = Toka`;

    // Move to next state to handle back navigation
    await updateSessionState(phone, STATE.GET_INVOICE_WAITING_ID, {});

    return (session.language === 'en' ? invoiceDetailsEn : invoiceDetailsSw) + pdfSection + navigationMsg;
  } catch (error) {
    logger.error('Error handling get invoice', error);
    await clearSessionContext(phone);
    await updateSessionState(phone, STATE.MAIN_MENU, {});
    return getMessage('SYSTEM_ERROR', session.language);
  }
}

/**
 * Handle GET_INVOICE_WAITING_ID state
 * Allows user to navigate back to main menu or repeat the request
 */
export async function handleGetInvoiceMenu(phone: string, input: string, session: Session): Promise<string> {
  try {
    // Check navigation commands
    const nav = await handleNavigation(phone, input, session, STATE.MAIN_MENU);
    if (nav.handled && nav.response) return nav.response;
    if (nav.handled) {
      return getMenu('MAIN_MENU', session.language);
    }

    // If user pressed 0 but it wasn't detected as back nav, treat as back to main menu
    if (input.trim() === '0') {
      logger.info('👈 User navigating back from get invoice to main menu', { phone });
      await clearSessionContext(phone);
      await updateSessionState(phone, STATE.MAIN_MENU, {});
      return getMenu('MAIN_MENU', session.language);
    }

    // Any other input: ask for tenant ID again
    return getMessage('ENTER_TENANT_ID', session.language) + getMessage('NAVIGATION_HELP', session.language);
  } catch (error) {
    logger.error('Error in get invoice menu', error);
    await clearSessionContext(phone);
    await updateSessionState(phone, STATE.MAIN_MENU, {});
    return getMessage('SYSTEM_ERROR', session.language);
  }
}
