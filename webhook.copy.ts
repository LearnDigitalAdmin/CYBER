
interface PaystackWebhookData {
  event: string;
  data: {
    reference: string;
    amount: number;
    fees?: number;
    amount_received?: number;
    gateway_response: string;
    status: string;
    metadata?: {
      [key: string]: any;
    };
    split?: {
      split_code: string;
    };
    accountReference?: string;
  };
}

export const paystackCallback = onRequest({
  timeoutSeconds: 60,
  memory: "512MiB",
  cors: false,
  maxInstances: 10,
  region: "africa-south1",
  secrets: [PAYSTACK_SECRET_KEY],
}, async (req, res) => {
  console.log(`Webhook request received: ${req.method}`);

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Verify Paystack signature
    const hash = req.headers["x-paystack-signature"]?.toString();
    const rawBody = Buffer.from(req.rawBody || JSON.stringify(req.body));
    const body = rawBody.toString();

    const expectedHash = crypto
      .createHmac("sha512", PAYSTACK_SECRET_KEY.value())
      .update(body)
      .digest("hex");

    if (hash !== expectedHash) {
      console.error("Invalid signature");
      res.status(400).json({ error: "Invalid signature" });
      return;
    }

    const event: PaystackWebhookData = JSON.parse(body);
    console.log(`Received webhook event: ${event.event}`);

    // Handle charge.success event
    if (event.event === "charge.success") {
      const data = event.data;
      const reference = data.reference;
      const metadata = data.metadata || {};

      console.log(`Processing successful payment: ${reference}`);

      // === DETERMINE CHARGE TYPE ===
      const chargeType = metadata.chargeType || determineChargeType(reference);

      console.log(`Identified charge type: ${chargeType}`);

      // ============================================
      // 1. REPORT CHARGE (Platform -> Platform Account)
      // ============================================
      if (chargeType === 'report_charge' || reference.startsWith('REPORT_')) {
        await handleReportCharge(reference, data, metadata);
      }

      // ============================================
      // 2. SHOP CUSTOMER CHARGE (Shop -> Shop Account via Split)
      // ============================================
      else if (chargeType === 'shop_charge' || reference.startsWith('SHOP_')) {
        await handleShopCustomerCharge(reference, data, metadata);
      }

      // ============================================
      // 3. CYBER SERVICE CHARGE (existing)
      // ============================================
      else if (reference.startsWith('CYBER_')) {
        await handleCyberCharge(reference, data, metadata);
      }

      // ============================================
      // 4. SUBSCRIPTION CHARGE (existing)
      // ============================================
      else if (reference.startsWith('SUB_')) {
        await handleSubscriptionCharge(reference, data, metadata);
      }

      // ============================================
      // 5. AGENT/INVOICE PAYMENT (existing)
      // ============================================
      else if (reference.startsWith('INV_')) {
        await handleAgentPayment(reference, data, metadata);
      }

      else {
        console.warn(`Unknown reference type: ${reference}`);
      }
    }

    // Handle failed payments
    if (event.event === "charge.failed") {
      const data = event.data;
      const reference = data.reference;
      const chargeType = data.metadata?.chargeType || determineChargeType(reference);

      console.warn(`Payment failed: ${reference} (type: ${chargeType})`);

      // Update appropriate collection based on charge type
      if (chargeType === 'report_charge' || reference.startsWith('REPORT_')) {
        await db.collection("report_charges").doc(reference).update({
          status: "failed",
          failedAt: admin.firestore.FieldValue.serverTimestamp(),
          failureReason: data.gateway_response,
        });
      } else if (chargeType === 'shop_charge' || reference.startsWith('SHOP_')) {
        const shopId = data.metadata?.shopId;
        await db.collection("shops").doc(shopId || '').collection("transactions").doc(reference).update({
          status: "failed",
          failedAt: admin.firestore.FieldValue.serverTimestamp(),
          failureReason: data.gateway_response,
        });
      } else if (reference.startsWith('CYBER_')) {
        await db.collection("cyber-transactions").doc(reference).update({
          status: "failed",
          failedAt: admin.firestore.FieldValue.serverTimestamp(),
          failureReason: data.gateway_response,
        });
      } else if (reference.startsWith('SUB_')) {
        await db.collection("subscriptions").doc(reference).update({
          status: "failed",
          failedAt: admin.firestore.FieldValue.serverTimestamp(),
          failureReason: data.gateway_response,
        });
      } else {
        await db.collection("transactions").doc(reference).update({
          status: "failed",
          failedAt: admin.firestore.FieldValue.serverTimestamp(),
          failureReason: data.gateway_response,
        });
      }
    }

    res.status(200).json({
      received: true,
      processed: true,
      eventType: event.event
    });
  } catch (error: any) {
    console.error("Error in paystackCallback:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message
    });
  }
});

// ============================================================================
// CHARGE TYPE HANDLERS
// ============================================================================

/**
 * Handle Report Charge (Platform charges user for report access)
 * Money goes directly to platform account (no split code)
 */
async function handleReportCharge(
  reference: string,
  data: any,
  metadata: any
): Promise<void> {
  try {
    console.log(`Processing report charge: ${reference}`);

    const shopId = metadata.shopId;
    const reportPeriod = metadata.reportPeriod || 'unknown';
    const dateRange = metadata.dateRange || 'unknown';
    const userPhone = metadata.userPhone;
    const chargeAmount = metadata.chargeAmount || 0;

    // Update report charge status to success
    await db.collection("report_charges").doc(reference).update({
      status: "success",
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      paystackReference: data.reference,
      paystackResponse: {
        amount: data.amount / 100,
        fees: data.fees ? data.fees / 100 : 0,
        amountReceived: data.amount_received ? data.amount_received / 100 : 0,
      },
    });

    // Also update shop-level report_charges
    if (shopId) {
      await db
        .collection("shops")
        .doc(shopId)
        .collection("report_charges")
        .doc(reference)
        .update({
          status: "success",
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          paystackReference: data.reference,
        });
    }

    // Record platform revenue
    const grossAmount = data.amount / 100;
    const paystackFees = data.fees ? data.fees / 100 : 0;
    const platformRevenue = grossAmount - paystackFees;

    const revenueRecord = {
      reference,
      shopId,
      userPhone,
      reportPeriod,
      dateRange,
      chargeAmount,
      grossAmount,
      paystackFees,
      platformRevenue,
      currency: "KES",
      status: "success",
      type: "report_charge",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db
      .collection("platform_revenue")
      .doc(reference)
      .set(revenueRecord);

    // Update platform totals
    await db.collection("platform_stats").doc("totals").set({
      totalReportCharges: admin.firestore.FieldValue.increment(1),
      totalReportRevenue: admin.firestore.FieldValue.increment(platformRevenue),
      lastReportChargeDate: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log(
      `✅ Report charge recorded: ${reference}\n` +
      `   Period: ${reportPeriod} (${dateRange})\n` +
      `   Amount: KES ${chargeAmount}\n` +
      `   Platform Revenue: KES ${platformRevenue}\n` +
      `   Shop: ${shopId}\n` +
      `   Status: Waiting for THIS project's payment.verification.service to handle messaging`
    );

  } catch (error: any) {
    console.error(`Error processing report charge ${reference}:`, error);
    throw error;
  }
}

/**
 * Handle Shop Customer Charge (Shop charges customer, funds routed via split code)
 * Money goes to shop account via Paystack split
 */
async function handleShopCustomerCharge(
  reference: string,
  data: any,
  metadata: any
): Promise<void> {
  try {
    console.log(`Processing shop customer charge: ${reference}`);

    const shopId = metadata.shopId;
    const customerPhone = metadata.customerPhone;
    const chargeAmount = data.amount / 100;

    // Update transaction status
    await db
      .collection("shops")
      .doc(shopId || '')
      .collection("transactions")
      .doc(reference)
      .update({
        status: "success",
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        paystackReference: data.reference,
        paystackResponse: {
          amount: data.amount / 100,
          fees: data.fees ? data.fees / 100 : 0,
          amountReceived: data.amount_received ? data.amount_received / 100 : 0,
        },
      });

    // Calculate split
    const grossAmount = data.amount / 100;
    const paystackFees = data.fees ? data.fees / 100 : 0;
    const netToShop = grossAmount - paystackFees;

    // Update shop income
    await db.collection("shops").doc(shopId || '').set({
      totalChargeRevenue: admin.firestore.FieldValue.increment(netToShop),
      totalChargesCollected: admin.firestore.FieldValue.increment(1),
      lastChargeAmount: netToShop,
      lastChargeDate: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log(
      `✅ Shop charge recorded: ${reference}\n` +
      `   Customer: ${customerPhone}\n` +
      `   Amount: KES ${chargeAmount}\n` +
      `   Net to Shop: KES ${netToShop}\n` +
      `   Shop: ${shopId}\n` +
      `   Status: Waiting for THIS project's payment.verification.service to handle notification`
    );

  } catch (error: any) {
    console.error(`Error processing shop charge ${reference}:`, error);
    throw error;
  }
}

/**
 * Handle Cyber Service Charge (existing logic)
 */
async function handleCyberCharge(
  reference: string,
  data: any,
  metadata: any
): Promise<void> {
  try {
    console.log(`Processing cyber service charge: ${reference}`);

    const transactionRef = db.collection("cyber-transactions").doc(reference);
    const transactionDoc = await transactionRef.get();

    if (!transactionDoc.exists) {
      console.error(`Cyber transaction not found: ${reference}`);
      return;
    }

    const transactionData = transactionDoc.data();
    const uid = metadata.uid || transactionData?.uid;
    const pId = metadata.pId || transactionData?.pId;
    const service = metadata.service || transactionData?.service;

    // Update transaction status
    await transactionRef.update({
      status: "success",
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      paystackResponse: data,
    });

    const grossAmount = data.amount / 100;
    const paystackFees = data.fees ? data.fees / 100 : 0;
    const netAfterPaystack = grossAmount - paystackFees;
    const platformCommission = (netAfterPaystack * 2.5) / 100;
    const agentNetIncome = netAfterPaystack - platformCommission;

    console.log(
      `Cyber income calculation: Gross: ${grossAmount}, Paystack Fees: ${paystackFees}, ` +
      `Net after Paystack: ${netAfterPaystack}, Platform Commission: ${platformCommission}, ` +
      `Agent Net: ${agentNetIncome}`
    );

    const incomeRecord: any = {
      reference,
      pId,
      service,
      grossAmount,
      paystackFees,
      netAfterPaystack,
      platformCommission,
      agentNetIncome,
      commissionRate: 2.5,
      currency: "KES",
      status: "success",
      type: "cyber_service",
      phone: transactionData?.phone,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
      splitCode: data.split?.split_code || transactionData?.splitCode,
      accountReference: data.accountReference || transactionData?.accountReference || null,
    };

    Object.keys(incomeRecord).forEach((key) => {
      if (incomeRecord[key] === undefined) {
        delete incomeRecord[key];
      }
    });

    await db
      .collection("agents")
      .doc(uid)
      .collection("cyber-income")
      .doc(reference)
      .set(incomeRecord);

    await db
      .collection("agents")
      .doc(uid)
      .set({
        totalCyberIncome: admin.firestore.FieldValue.increment(agentNetIncome),
        totalCyberTransactions: admin.firestore.FieldValue.increment(1),
        lastCyberIncomeDate: admin.firestore.FieldValue.serverTimestamp(),
        lastCyberIncomeAmount: agentNetIncome,
      }, { merge: true });

    console.log(`Successfully recorded cyber income for agent ${uid}: ${agentNetIncome} KES`);

  } catch (error: any) {
    console.error(`Error processing cyber charge ${reference}:`, error);
    throw error;
  }
}

/**
 * Handle Subscription Charge (existing logic)
 */
async function handleSubscriptionCharge(
  reference: string,
  data: any,
  metadata: any
): Promise<void> {
  try {
    console.log(`Processing subscription charge: ${reference}`);

    const subscriptionRef = db.collection("subscriptions").doc(reference);
    const subscriptionDoc = await subscriptionRef.get();

    if (!subscriptionDoc.exists) {
      console.error(`Subscription not found: ${reference}`);
      return;
    }

    const subscriptionData = subscriptionDoc.data();
    const userId = metadata.userId || subscriptionData?.userId;
    const planId = metadata.planId || subscriptionData?.planId;
    const planName = metadata.planName || subscriptionData?.planName;
    const daysToAdd = metadata.daysToAdd || subscriptionData?.daysToAdd || 30;
    const agentId = metadata.agentId || subscriptionData?.agentId;

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + daysToAdd);

    await subscriptionRef.update({
      status: "success",
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      expiryDate: admin.firestore.Timestamp.fromDate(expiryDate),
      paystackResponse: data,
    });

    const userRef = db.collection("users").doc(userId);
    await userRef.set({
      type: "paid",
      tier: planId,
      storage: true,
      subscriptionExpiry: admin.firestore.Timestamp.fromDate(expiryDate),
      lastPaymentDate: admin.firestore.FieldValue.serverTimestamp(),
      lastPaymentReference: reference,
      lastPaymentAmount: data.amount / 100,
      planName: planName
    }, { merge: true });

    console.log(`Successfully activated subscription for user ${userId}`);

    if (agentId) {
      try {
        const grossAmount = data.amount / 100;
        const paystackFees = data.fees ? data.fees / 100 : 0;
        const netAmount = grossAmount - paystackFees;
        const commissionRate = 45;
        const agentCommission = (netAmount * commissionRate) / 100;
        const platformRevenue = netAmount - agentCommission;

        const incomeRecord = {
          reference: reference,
          userId: userId,
          userName: metadata.userName || subscriptionData?.userName || "Unknown",
          planId: planId,
          planName: planName,
          grossAmount: grossAmount,
          netAmount: netAmount,
          agentCommission: agentCommission,
          platformRevenue: platformRevenue,
          paystackFees: paystackFees,
          commissionRate: commissionRate,
          currency: "KES",
          status: "success",
          type: "subscription",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
          expiryDate: admin.firestore.Timestamp.fromDate(expiryDate),
          splitCode: data.split?.split_code || null,
        };

        await db
          .collection("agents")
          .doc(agentId)
          .collection("plot-income")
          .doc(reference)
          .set(incomeRecord);

        const agentRef = db.collection("agents").doc(agentId);
        await agentRef.set({
          totalIncome: admin.firestore.FieldValue.increment(agentCommission),
          totalSubscriptions: admin.firestore.FieldValue.increment(1),
          lastIncomeDate: admin.firestore.FieldValue.serverTimestamp(),
          lastIncomeAmount: agentCommission,
        }, { merge: true });

        console.log(`Successfully recorded subscription income for agent ${agentId}`);
      } catch (agentError: any) {
        console.error(`Error recording agent commission:`, agentError);
      }
    }

  } catch (error: any) {
    console.error(`Error processing subscription charge ${reference}:`, error);
    throw error;
  }
}

/**
 * Handle Agent Payment (existing logic)
 */
async function handleAgentPayment(
  reference: string,
  data: any,
  metadata: any
): Promise<void> {
  try {
    console.log(`Processing agent payment: ${reference}`);

    const transactionRef = db.collection("transactions").doc(reference);
    const transactionDoc = await transactionRef.get();

    if (!transactionDoc.exists) {
      console.error(`Transaction not found: ${reference}`);
      return;
    }

    const transactionData = transactionDoc.data();

    await transactionRef.update({
      status: "success",
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      paystackResponse: data,
    });

    const userId = metadata.userId || transactionData?.userId;
    const billingMonth = metadata.billingMonth || transactionData?.billingMonth;

    if (userId && billingMonth) {
      const paymentDoc = await db
        .collection("payments")
        .doc(userId)
        .collection("billingMonths")
        .doc(billingMonth)
        .get();

      if (paymentDoc.exists) {
        const paymentData = paymentDoc.data();
        const payments = paymentData?.payments || [];

        const updatedPayments = payments.map((payment: any) => {
          if (payment.reference === reference) {
            return {
              ...payment,
              status: "success",
              completedAt: new Date().toISOString(),
              paidAmount: data.amount / 100,
              fees: data.fees / 100,
            };
          }
          return payment;
        });

        await db
          .collection("payments")
          .doc(userId)
          .collection("billingMonths")
          .doc(billingMonth)
          .update({
            payments: updatedPayments,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          });
      }

      const invoiceId = metadata.invoiceId || transactionData?.invoiceId;
      if (invoiceId) {
        await db.collection("invoices").doc(invoiceId).update({
          status: "paid",
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
          paymentReference: reference,
        });
      }
    }

    console.log(`Successfully processed agent payment: ${reference}`);

  } catch (error: any) {
    console.error(`Error processing agent payment ${reference}:`, error);
    throw error;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Determine charge type from reference prefix
 */
function determineChargeType(reference: string): string {
  if (reference.startsWith('REPORT_')) return 'report_charge';
  if (reference.startsWith('SHOP_')) return 'shop_charge';
  if (reference.startsWith('CYBER_')) return 'cyber_service';
  if (reference.startsWith('SUB_')) return 'subscription';
  if (reference.startsWith('INV_')) return 'agent_payment';
  return 'unknown';
}

/**
 * MESSAGING HANDLED BY: This project's payment.verification.service.ts
 *
 * This webhook ONLY:
 * 1. Verifies Paystack signature
 * 2. Updates Firestore with payment status
 * 3. Does NOT handle messaging (other project handles that via payment.verification.service)
 *
 * WhatsApp messages are sent by THIS project when it detects Firestore updates
 */

