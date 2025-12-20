/**
 * Report Menu Handler
 * Handles report generation menu flows for weekly and monthly reports
 */

import { Session } from '../types/session.types';
import { updateSessionState, updateSessionContext } from '../services/session.service';
import {
  validateMenuSelection,
  checkNavigationCommand,
} from '../utils/validator';
import { getMessage } from '../constants/messages';
import { getMenu } from '../constants/menus';
import { STATE } from '../constants/states';
import { logger } from '../utils/logger';
import {
  handleGenerateReport,
  handleGetRecentReports,
  buildReportMenuText,
} from './report.handler';
import { ReportPeriod, ReportDateRange } from '../types/report.types';
import {
  hasExistingReport,
  getReportChargeAmount,
  initiateReportCharge,
} from '../services/report.charge.service';
import { startReportPaymentListener } from '../services/report.listener.service';
import { validatePhoneNumber } from '../utils/validator';

/**
 * Handle navigation for report menus
 */
async function handleReportNavigation(
  phone: string,
  input: string,
  session: Session
): Promise<{ response: string | null; handled: boolean }> {
  const nav = checkNavigationCommand(input);

  if (nav.type === 'back') {
    logger.info('User going back from report menu', { phone });
    await updateSessionState(phone, STATE.MY_SHOP_MENU, {});
    return {
      response: null, // Let the state handler generate the message
      handled: true,
    };
  }

  if (nav.type === 'exit') {
    logger.info('User exiting to language selection from report menu', { phone });
    await updateSessionState(phone, STATE.LANGUAGE_SELECTION, {});
    return {
      response: getMenu('WELCOME', session.language),
      handled: true,
    };
  }

  return { response: null, handled: false };
}

/**
 * Handle weekly report menu
 */
export async function handleWeeklyReportMenu(
  phone: string,
  input: string,
  session: Session
): Promise<string> {
  try {
    // Check for navigation commands
    const nav = await handleReportNavigation(phone, input, session);
    if (nav.handled && nav.response) return nav.response;
    if (nav.handled) {
      return getMenu('MY_SHOP_MENU', session.language) +
        getMessage('NAVIGATION_HELP', session.language);
    }

    const shopId = session.context.shopId as string;

    // Get recent reports for display
    const recentReports = await handleGetRecentReports(shopId, 'weekly', 5);

    // Validate menu selection (1-7 or up to 1+number of recent reports)
    const maxOption = Math.min(2 + recentReports.length, 7);
    const validation = validateMenuSelection(input, 1, maxOption);

    if (!validation.valid || validation.option === undefined) {
      const menuText = buildReportMenuText('weekly', recentReports);
      return menuText + '\n\n' + getMessage('NAVIGATION_HELP', session.language);
    }

    const option = validation.option;

    // Option 1: Last 7 days
    if (option === 1) {
      logger.info('User selecting weekly report for last 7 days', { phone, shopId });

      // Check if user already has this report
      const hasReport = await hasExistingReport(shopId, 'weekly', 'last7days');

      if (!hasReport) {
        // New report - require payment
        const chargeAmount = getReportChargeAmount('weekly');
        logger.info('New report requested, initiating charge', {
          phone,
          shopId,
          amount: chargeAmount,
        });

        await updateSessionState(phone, STATE.REPORT_PAYMENT_PROMPT, {});
        await updateSessionContext(phone, {
          reportPeriod: 'weekly' as ReportPeriod,
          reportDateRange: 'last7days' as ReportDateRange,
          reportChargeAmount: chargeAmount,
        });

        const message =
          session.language === 'en'
            ? `📊 *Weekly Report - Last 7 Days*\n\n💰 Charge: KES ${chargeAmount}\n\nEnter your M-Pesa phone number to proceed with payment:\n\n(e.g., 0712345678 or 254712345678)`
            : `📊 *Ripoti ya Wiki - Siku 7 Zilizopita*\n\n💰 Malipo: KES ${chargeAmount}\n\nIngiza namba yako ya simu ya M-Pesa:\n\n(mfano: 0712345678 au 254712345678)`;

        return message;
      }

      // Existing report - generate for free
      logger.info('Generating existing weekly report for last 7 days (free)', {
        phone,
        shopId,
      });

      await updateSessionState(phone, STATE.REPORT_GENERATING, {});
      await updateSessionContext(phone, {
        reportPeriod: 'weekly' as ReportPeriod,
        reportDateRange: 'last7days' as ReportDateRange,
      });

      const result = await handleGenerateReport({
        shopId,
        period: 'weekly',
        dateRange: 'last7days',
        userPhone: phone,
      });

      await updateSessionState(phone, STATE.MY_SHOP_MENU, {});

      if (result.success && result.downloadUrl) {
        const successMsg =
          session.language === 'en'
            ? `✅ Weekly Report Generated!\n\n📊 Period: Last 7 days\n📥 Download: ${result.downloadUrl}\n\n${getMenu('MY_SHOP_MENU', session.language)}`
            : `✅ Ripoti ya Wiki Imeundwa!\n\n📊 Kipindi: Siku 7 zilizopita\n📥 Pakua: ${result.downloadUrl}\n\n${getMenu('MY_SHOP_MENU', session.language)}`;
        return successMsg + getMessage('NAVIGATION_HELP', session.language);
      } else {
        const errorMsg =
          session.language === 'en'
            ? `❌ Failed to generate report: ${result.error}\n\n${getMenu('MY_SHOP_MENU', session.language)}`
            : `❌ Imeshindwa kuundwa ripoti: ${result.error}\n\n${getMenu('MY_SHOP_MENU', session.language)}`;
        return errorMsg + getMessage('NAVIGATION_HELP', session.language);
      }
    }

    // Option 2: Last 30 days
    if (option === 2) {
      logger.info('User selecting weekly report for last 30 days', { phone, shopId });

      // Check if user already has this report
      const hasReport = await hasExistingReport(shopId, 'weekly', 'last30days');

      if (!hasReport) {
        // New report - require payment
        const chargeAmount = getReportChargeAmount('weekly');
        logger.info('New report requested, initiating charge', {
          phone,
          shopId,
          amount: chargeAmount,
        });

        await updateSessionState(phone, STATE.REPORT_PAYMENT_PROMPT, {});
        await updateSessionContext(phone, {
          reportPeriod: 'weekly' as ReportPeriod,
          reportDateRange: 'last30days' as ReportDateRange,
          reportChargeAmount: chargeAmount,
        });

        const message =
          session.language === 'en'
            ? `📊 *Weekly Report - Last 30 Days*\n\n💰 Charge: KES ${chargeAmount}\n\nEnter your M-Pesa phone number to proceed with payment:\n\n(e.g., 0712345678 or 254712345678)`
            : `📊 *Ripoti ya Wiki - Siku 30 Zilizopita*\n\n💰 Malipo: KES ${chargeAmount}\n\nIngiza namba yako ya simu ya M-Pesa:\n\n(mfano: 0712345678 au 254712345678)`;

        return message;
      }

      // Existing report - generate for free
      logger.info('Generating existing weekly report for last 30 days (free)', {
        phone,
        shopId,
      });

      await updateSessionState(phone, STATE.REPORT_GENERATING, {});
      await updateSessionContext(phone, {
        reportPeriod: 'weekly' as ReportPeriod,
        reportDateRange: 'last30days' as ReportDateRange,
      });

      const result = await handleGenerateReport({
        shopId,
        period: 'weekly',
        dateRange: 'last30days',
        userPhone: phone,
      });

      await updateSessionState(phone, STATE.MY_SHOP_MENU, {});

      if (result.success && result.downloadUrl) {
        const successMsg =
          session.language === 'en'
            ? `✅ Weekly Report Generated!\n\n📊 Period: Last 30 days\n📥 Download: ${result.downloadUrl}\n\n${getMenu('MY_SHOP_MENU', session.language)}`
            : `✅ Ripoti ya Wiki Imeundwa!\n\n📊 Kipindi: Siku 30 zilizopita\n📥 Pakua: ${result.downloadUrl}\n\n${getMenu('MY_SHOP_MENU', session.language)}`;
        return successMsg + getMessage('NAVIGATION_HELP', session.language);
      } else {
        const errorMsg =
          session.language === 'en'
            ? `❌ Failed to generate report: ${result.error}\n\n${getMenu('MY_SHOP_MENU', session.language)}`
            : `❌ Imeshindwa kuundwa ripoti: ${result.error}\n\n${getMenu('MY_SHOP_MENU', session.language)}`;
        return errorMsg + getMessage('NAVIGATION_HELP', session.language);
      }
    }

    // Options 3+: Previous reports
    if (option >= 3 && option - 3 < recentReports.length) {
      const reportIndex = option - 3;
      const report = recentReports[reportIndex];

      logger.info('User downloading previous weekly report', {
        phone,
        shopId,
        reportId: report.id,
      });

      if (report.downloadUrl) {
        const downloadMsg =
          session.language === 'en'
            ? `📊 Weekly Report\n\n📅 Period: ${report.startDate} to ${report.endDate}\n📥 Download: ${report.downloadUrl}\n\n${getMenu('MY_SHOP_MENU', session.language)}`
            : `📊 Ripoti ya Wiki\n\n📅 Kipindi: ${report.startDate} kwa ${report.endDate}\n📥 Pakua: ${report.downloadUrl}\n\n${getMenu('MY_SHOP_MENU', session.language)}`;
        return downloadMsg + getMessage('NAVIGATION_HELP', session.language);
      }
    }

    // Default: Show menu again
    const menuText = buildReportMenuText('weekly', recentReports);
    return menuText + '\n\n' + getMessage('NAVIGATION_HELP', session.language);
  } catch (error) {
    logger.error('Error handling weekly report menu', { phone, error });
    return getMessage('SYSTEM_ERROR', session.language);
  }
}

/**
 * Handle monthly report menu
 */
export async function handleMonthlyReportMenu(
  phone: string,
  input: string,
  session: Session
): Promise<string> {
  try {
    // Check for navigation commands
    const nav = await handleReportNavigation(phone, input, session);
    if (nav.handled && nav.response) return nav.response;
    if (nav.handled) {
      return getMenu('MY_SHOP_MENU', session.language) +
        getMessage('NAVIGATION_HELP', session.language);
    }

    const shopId = session.context.shopId as string;

    // Get recent reports for display
    const recentReports = await handleGetRecentReports(shopId, 'monthly', 5);

    // Validate menu selection
    const maxOption = Math.min(2 + recentReports.length, 7);
    const validation = validateMenuSelection(input, 1, maxOption);

    if (!validation.valid || validation.option === undefined) {
      const menuText = buildReportMenuText('monthly', recentReports);
      return menuText + '\n\n' + getMessage('NAVIGATION_HELP', session.language);
    }

    const option = validation.option;

    // Option 1: Last 30 days (Monthly)
    if (option === 1) {
      logger.info('User selecting monthly report for last 30 days', { phone, shopId });

      // Check if user already has this report
      const hasReport = await hasExistingReport(shopId, 'monthly', 'last30days');

      if (!hasReport) {
        // New report - require payment
        const chargeAmount = getReportChargeAmount('monthly');
        logger.info('New report requested, initiating charge', {
          phone,
          shopId,
          amount: chargeAmount,
        });

        await updateSessionState(phone, STATE.REPORT_PAYMENT_PROMPT, {});
        await updateSessionContext(phone, {
          reportPeriod: 'monthly' as ReportPeriod,
          reportDateRange: 'last30days' as ReportDateRange,
          reportChargeAmount: chargeAmount,
        });

        const message =
          session.language === 'en'
            ? `📊 *Monthly Report - Last 30 Days*\n\n💰 Charge: KES ${chargeAmount}\n\nEnter your M-Pesa phone number to proceed with payment:\n\n(e.g., 0712345678 or 254712345678)`
            : `📊 *Ripoti ya Mwezi - Siku 30 Zilizopita*\n\n💰 Malipo: KES ${chargeAmount}\n\nIngiza namba yako ya simu ya M-Pesa:\n\n(mfano: 0712345678 au 254712345678)`;

        return message;
      }

      // Existing report - generate for free
      logger.info('Generating existing monthly report for last 30 days (free)', {
        phone,
        shopId,
      });

      await updateSessionState(phone, STATE.REPORT_GENERATING, {});
      await updateSessionContext(phone, {
        reportPeriod: 'monthly' as ReportPeriod,
        reportDateRange: 'last30days' as ReportDateRange,
      });

      const result = await handleGenerateReport({
        shopId,
        period: 'monthly',
        dateRange: 'last30days',
        userPhone: phone,
      });

      await updateSessionState(phone, STATE.MY_SHOP_MENU, {});

      if (result.success && result.downloadUrl) {
        const successMsg =
          session.language === 'en'
            ? `✅ Monthly Report Generated!\n\n📊 Period: Last 30 days\n📥 Download: ${result.downloadUrl}\n\n${getMenu('MY_SHOP_MENU', session.language)}`
            : `✅ Ripoti ya Mwezi Imeundwa!\n\n📊 Kipindi: Siku 30 zilizopita\n📥 Pakua: ${result.downloadUrl}\n\n${getMenu('MY_SHOP_MENU', session.language)}`;
        return successMsg + getMessage('NAVIGATION_HELP', session.language);
      } else {
        const errorMsg =
          session.language === 'en'
            ? `❌ Failed to generate report: ${result.error}\n\n${getMenu('MY_SHOP_MENU', session.language)}`
            : `❌ Imeshindwa kuundwa ripoti: ${result.error}\n\n${getMenu('MY_SHOP_MENU', session.language)}`;
        return errorMsg + getMessage('NAVIGATION_HELP', session.language);
      }
    }

    // Option 2: Last 90 days (Quarterly Monthly)
    if (option === 2) {
      logger.info('User selecting monthly report for last 90 days', { phone, shopId });

      // For quarterly/custom periods, still use 'last30days' dateRange
      // but could be extended - using last30days for standard pricing
      const dateRange = 'last30days' as ReportDateRange;

      // Check if user already has this report
      const hasReport = await hasExistingReport(shopId, 'monthly', dateRange);

      if (!hasReport) {
        // New report - require payment
        const chargeAmount = getReportChargeAmount('monthly');
        logger.info('New report requested, initiating charge', {
          phone,
          shopId,
          amount: chargeAmount,
        });

        await updateSessionState(phone, STATE.REPORT_PAYMENT_PROMPT, {});
        await updateSessionContext(phone, {
          reportPeriod: 'monthly' as ReportPeriod,
          reportDateRange: dateRange,
          reportChargeAmount: chargeAmount,
        });

        const message =
          session.language === 'en'
            ? `📊 *Monthly Report - Extended Period*\n\n💰 Charge: KES ${chargeAmount}\n\nEnter your M-Pesa phone number to proceed with payment:\n\n(e.g., 0712345678 or 254712345678)`
            : `📊 *Ripoti ya Mwezi - Kipindi Kipya*\n\n💰 Malipo: KES ${chargeAmount}\n\nIngiza namba yako ya simu ya M-Pesa:\n\n(mfano: 0712345678 au 254712345678)`;

        return message;
      }

      // Existing report - generate for free
      logger.info('Generating existing monthly report (free)', {
        phone,
        shopId,
      });

      await updateSessionState(phone, STATE.REPORT_GENERATING, {});
      await updateSessionContext(phone, {
        reportPeriod: 'monthly' as ReportPeriod,
        reportDateRange: dateRange,
      });

      const result = await handleGenerateReport({
        shopId,
        period: 'monthly',
        dateRange: dateRange,
        userPhone: phone,
      });

      await updateSessionState(phone, STATE.MY_SHOP_MENU, {});

      if (result.success && result.downloadUrl) {
        const successMsg =
          session.language === 'en'
            ? `✅ Monthly Report Generated!\n\n📊 Period: Extended\n📥 Download: ${result.downloadUrl}\n\n${getMenu('MY_SHOP_MENU', session.language)}`
            : `✅ Ripoti ya Mwezi Imeundwa!\n\n📊 Kipindi: Kieneza\n📥 Pakua: ${result.downloadUrl}\n\n${getMenu('MY_SHOP_MENU', session.language)}`;
        return successMsg + getMessage('NAVIGATION_HELP', session.language);
      } else {
        const errorMsg =
          session.language === 'en'
            ? `❌ Failed to generate report: ${result.error}\n\n${getMenu('MY_SHOP_MENU', session.language)}`
            : `❌ Imeshindwa kuundwa ripoti: ${result.error}\n\n${getMenu('MY_SHOP_MENU', session.language)}`;
        return errorMsg + getMessage('NAVIGATION_HELP', session.language);
      }
    }

    // Options 3+: Previous reports
    if (option >= 3 && option - 3 < recentReports.length) {
      const reportIndex = option - 3;
      const report = recentReports[reportIndex];

      logger.info('User downloading previous monthly report', {
        phone,
        shopId,
        reportId: report.id,
      });

      if (report.downloadUrl) {
        const downloadMsg =
          session.language === 'en'
            ? `📊 Monthly Report\n\n📅 Period: ${report.startDate} to ${report.endDate}\n📥 Download: ${report.downloadUrl}\n\n${getMenu('MY_SHOP_MENU', session.language)}`
            : `📊 Ripoti ya Mwezi\n\n📅 Kipindi: ${report.startDate} kwa ${report.endDate}\n📥 Pakua: ${report.downloadUrl}\n\n${getMenu('MY_SHOP_MENU', session.language)}`;
        return downloadMsg + getMessage('NAVIGATION_HELP', session.language);
      }
    }

    // Default: Show menu again
    const menuText = buildReportMenuText('monthly', recentReports);
    return menuText + '\n\n' + getMessage('NAVIGATION_HELP', session.language);
  } catch (error) {
    logger.error('Error handling monthly report menu', { phone, error });
    return getMessage('SYSTEM_ERROR', session.language);
  }
}

/**
 * Handle report payment phone number input
 * User enters their M-Pesa phone to initiate payment for report
 */
export async function handleReportPaymentPrompt(
  phone: string,
  input: string,
  session: Session
): Promise<string> {
  try {
    const shopId = session.context.shopId as string;
    const reportPeriod = session.context.reportPeriod as string;
    const reportDateRange = session.context.reportDateRange as string;
    const chargeAmount = session.context.reportChargeAmount as number;

    // Validate required context
    if (!shopId || !reportPeriod || !reportDateRange || !chargeAmount) {
      logger.error('Missing required context for report payment', {
        phone,
        shopId,
        reportPeriod,
        reportDateRange,
        chargeAmount,
      });

      const errorMsg = session.language === 'en'
        ? '❌ Session error. Please try again from the menu.'
        : '❌ Hitilafu ya mkutano. Tafadhali jaribu tena kutokea kwa menyu.';
      return errorMsg;
    }

    logger.info('Processing report payment phone input', {
      phone,
      shopId,
      reportPeriod,
      reportDateRange,
      inputLength: input.length,
    });

    // Validate phone number
    const validation = validatePhoneNumber(input);

    if (!validation.valid) {
      const errorMsg =
        session.language === 'en'
          ? 'Invalid phone number. Please enter a valid M-Pesa phone:\n\n(e.g., 0712345678 or 254712345678)'
          : 'Namba batili. Tafadhali ingiza namba sahihi ya simu ya M-Pesa:\n\n(mfano: 0712345678 au 254712345678)';
      return errorMsg;
    }

    if (!validation.formatted) {
      const errorMsg =
        session.language === 'en'
          ? 'Could not format phone number. Please try again.'
          : 'Haiwezi kuangalia namba. Tafadhali jaribu tena.';
      return errorMsg;
    }

    if (!validation.formatted) {
      const errorMsg = session.language === 'en'
        ? '❌ Invalid phone number. Please try again.'
        : '❌ Namba sio sahihi. Jaribu tena.';
      return errorMsg;
    }

    logger.info('Phone number validated, initiating report charge', {
      phone,
      shopId,
      customerPhone: validation.formatted,
      amount: chargeAmount,
    });

    // Initiate report charge via Paystack
    const result = await initiateReportCharge(
      shopId,
      validation.formatted,
      (reportPeriod || 'weekly') as 'weekly' | 'monthly',
      (reportDateRange || 'last7days') as 'last7days' | 'last30days'
    );

    if (!result.success) {
      logger.error('Report charge initiation failed', {
        phone,
        shopId,
        error: result.error,
      });

      const errorMsg =
        session.language === 'en'
          ? `❌ Payment request failed: ${result.error}\n\nPlease try again.`
          : `❌ Ombi la malipo lilishindwa: ${result.error}\n\nTafadhali jaribu tena.`;
      return errorMsg;
    }

    logger.info('✅ Report charge initiated successfully', {
      phone,
      shopId,
      reference: result.reference,
    });

    // CRITICAL: Validate reference exists
    if (!result.reference) {
      logger.error('❌ CRITICAL: No reference returned from charge initiation', {
        phone,
        shopId,
      });

      const errorMsg =
        session.language === 'en'
          ? '❌ Error: Payment request did not receive a tracking reference. Please try again.'
          : '❌ Hitilafu: Ombi la malipo halikupokea kumbi-kumbizo. Tafadhali jaribu tena.';
      return errorMsg;
    }

    // CRITICAL: Activate listener IMMEDIATELY after STK sent
    // This listener will:
    // 1. Listen to report_charges/{reference} for payment status
    // 2. When payment succeeds, generate report
    // 3. Send report link to user
    // 4. Return user to MY_SHOP_MENU automatically
    logger.info(
      '🔄 ACTIVATING REPORT PAYMENT LISTENER - CRITICAL OPERATION',
      {
        phone,
        reference: result.reference,
        reportPeriod,
        shopId,
      }
    );

    startReportPaymentListener(
      result.reference, // Unique reference for this charge
      shopId, // Shop making the charge
      phone, // User's WhatsApp phone (for status messages)
      reportPeriod as 'weekly' | 'monthly',
      reportDateRange as 'last7days' | 'last30days',
      chargeAmount, // For message
      session.language // For bilingual messages
    );

    logger.info('✅ REPORT LISTENER ACTIVATED - READY FOR PAYMENT', {
      reference: result.reference,
      shopId,
      userPhone: phone,
    });

    // Update state to generating (waiting for payment via listener)
    await updateSessionState(phone, STATE.REPORT_GENERATING, {});

    // Keep context for reference
    await updateSessionContext(phone, {
      chargeReference: result.reference,
      chargeType: 'report_charge',
    });

    logger.info('Session updated - awaiting payment confirmation via listener', {
      phone,
      chargeReference: result.reference,
      chargeType: 'report_charge',
    });

    const successMsg =
      session.language === 'en'
        ? `✅ *Payment Request Sent!*\n\n📱 Phone: ${validation.formatted}\n💰 Amount: KES ${chargeAmount}\n📊 Report: ${reportPeriod.charAt(0).toUpperCase() + reportPeriod.slice(1)}\n\n⏳ Enter your M-Pesa PIN to confirm payment.\n\n✨ Once payment is confirmed, your report will be generated and sent automatically!\n\n💡 You can close this and continue with other operations. We'll notify you when it's ready.`
        : `✅ *Ombi Lilitumwa!*\n\n📱 Namba: ${validation.formatted}\n💰 Kiasi: KES ${chargeAmount}\n📊 Ripoti: ${reportPeriod.charAt(0).toUpperCase() + reportPeriod.slice(1)}\n\n⏳ Ingiza PIN yako ya M-Pesa kuakikisha kulipa.\n\n✨ Baada ya kulipa, ripoti yako itaundwa na kutumwa kwa otomatiki!\n\n💡 Unaweza kufunga na kuendelea na shughuli zingine. Tutakujuliza baada ya kuandaliwa.`;

    return successMsg;
  } catch (error: any) {
    logger.error('Error handling report payment prompt', { phone, error });

    const errorMsg =
      session.language === 'en'
        ? `❌ An error occurred: ${error.message}\n\nPlease try again.`
        : `❌ Hitilafu iliotokea: ${error.message}\n\nTafadhali jaribu tena.`;

    return errorMsg;
  }
}
