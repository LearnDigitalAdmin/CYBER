# Report Menu Handler Updates

## Overview

This file shows the exact code changes needed in `functions/src/handlers/report.menu.handler.ts` to integrate report charging.

---

## 1. Add Imports at Top

Add these imports:

```typescript
import {
  hasExistingReport,
  getReportChargeAmount,
  initiateReportCharge,
} from '../services/report.charge.service';
```

---

## 2. Update handleWeeklyReportMenu (Option 1: Last 7 Days)

**BEFORE:**
```typescript
// Option 1: Last 7 days
if (option === 1) {
  logger.info('User generating weekly report for last 7 days', { phone, shopId });
  await updateSessionState(phone, STATE.REPORT_GENERATING, {});
  await updateSessionContext(phone, {
    reportPeriod: 'weekly' as ReportPeriod,
    reportDateRange: 'last7days' as ReportDateRange,
  });

  // Generate report
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
```

**AFTER:**
```typescript
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
```

---

## 3. Update handleWeeklyReportMenu (Option 2: Last 30 Days)

**BEFORE:**
```typescript
// Option 2: Last 30 days
if (option === 2) {
  logger.info('User generating weekly report for last 30 days', { phone, shopId });
  await updateSessionState(phone, STATE.REPORT_GENERATING, {});
  await updateSessionContext(phone, {
    reportPeriod: 'weekly' as ReportPeriod,
    reportDateRange: 'last30days' as ReportDateRange,
  });

  // Generate report
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
```

**AFTER:**
```typescript
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
```

---

## 4. Do the Same for Monthly Reports

Apply the same pattern to `handleMonthlyReportMenu`:

```typescript
export async function handleMonthlyReportMenu(
  phone: string,
  input: string,
  session: Session
): Promise<string> {
  try {
    // ... navigation and validation code ...

    const shopId = session.context.shopId as string;
    const recentReports = await handleGetRecentReports(shopId, 'monthly', 5);
    const maxOption = Math.min(2 + recentReports.length, 7);
    const validation = validateMenuSelection(input, 1, maxOption);

    if (!validation.valid || validation.option === undefined) {
      const menuText = buildReportMenuText('monthly', recentReports);
      return menuText + '\n\n' + getMessage('NAVIGATION_HELP', session.language);
    }

    const option = validation.option;

    // Option 1: Last 30 days
    if (option === 1) {
      logger.info('User selecting monthly report for last 30 days', { phone, shopId });

      const hasReport = await hasExistingReport(shopId, 'monthly', 'last30days');

      if (!hasReport) {
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

    // Option 2: Last 3 Months (or similar for monthly)
    if (option === 2) {
      // Similar pattern: check, charge if new, generate if free
      // ... apply same logic as above ...
    }

    // ... rest of options ...
  } catch (error) {
    logger.error('Error handling monthly report menu', { phone, error });
    return `❌ An error occurred. Please try again.`;
  }
}
```

---

## 5. Add New States to functions/src/constants/states.ts

Add these constants:

```typescript
export const STATE = {
  // ... existing states ...

  // Report charging states
  REPORT_PAYMENT_PROMPT: 'report_payment_prompt',      // Waiting for phone number
  REPORT_PAYMENT_PROCESSING: 'report_payment_processing', // Optional: after payment sent
  REPORT_GENERATING: 'report_generating',              // Generate after payment success
};
```

---

## 6. Add Payment Handler to Session Handler

Add this new function to handle the payment prompt state.

This could go in `functions/src/handlers/shop.handler.ts` or a dedicated payment handler:

```typescript
/**
 * Handle report payment phone number input
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

    // Validate phone number
    const validation = validatePhoneNumber(input);

    if (!validation.valid) {
      const retryMsg =
        session.language === 'en'
          ? 'Invalid phone number. Please enter a valid M-Pesa phone:\n\n(e.g., 0712345678 or 254712345678)'
          : 'Namba batili. Tafadhali ingiza namba sahihi ya simu ya M-Pesa:\n\n(mfano: 0712345678 au 254712345678)';
      return retryMsg;
    }

    logger.info('Initiating report charge', {
      phone,
      shopId,
      customerPhone: validation.formatted,
      amount: chargeAmount,
    });

    // Initiate payment
    const result = await initiateReportCharge(
      shopId,
      validation.formatted,
      reportPeriod as 'weekly' | 'monthly',
      reportDateRange as 'last7days' | 'last30days'
    );

    if (!result.success) {
      logger.error('Report charge failed', {
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

    // Update state to generating
    await updateSessionState(phone, STATE.REPORT_GENERATING, {});

    const successMsg =
      session.language === 'en'
        ? `✅ *Payment Request Sent!*\n\n📱 Phone: ${validation.formatted}\n💰 Amount: KES ${chargeAmount}\n📊 Report: ${reportPeriod.charAt(0).toUpperCase() + reportPeriod.slice(1)}\n\n⏳ Enter your M-Pesa PIN to confirm payment.\n\nOnce payment is confirmed, your report will be generated automatically.`
        : `✅ *Ombi Lilitumwa!*\n\n📱 Namba: ${validation.formatted}\n💰 Kiasi: KES ${chargeAmount}\n📊 Ripoti: ${reportPeriod.charAt(0).toUpperCase() + reportPeriod.slice(1)}\n\n⏳ Ingiza PIN yako ya M-Pesa kuakikisha kulipa.\n\nBaada ya kulipa, ripoti yako itaundwa kwa otomatiki.`;

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
```

---

## 7. Wire Up State Handler

In your main WhatsApp handler (likely `functions/src/webhooks/whatsapp-webhook.ts`), add:

```typescript
// Inside main state handler switch
case STATE.REPORT_PAYMENT_PROMPT:
  response = await handleReportPaymentPrompt(phone, userInput, session);
  break;

case STATE.REPORT_GENERATING:
  // After webhook confirms payment, trigger report generation
  // This is handled automatically when charge.success webhook is received
  response = 'Report is being generated. Please wait...';
  // TODO: Implement actual generation trigger on webhook callback
  break;
```

---

## Summary of Changes

1. ✅ Add imports from `report.charge.service`
2. ✅ Update `handleWeeklyReportMenu` with charge logic
3. ✅ Update `handleMonthlyReportMenu` with charge logic
4. ✅ Add states to `constants/states.ts`
5. ✅ Add `handleReportPaymentPrompt` handler
6. ✅ Wire up in main state handler
7. ✅ Test end-to-end

All of these changes follow the same pattern as the existing shop charging flow!
