import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  Timestamp,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebaseService';
import type { Invoice } from './firebaseService';

interface Tenant {
  id: string;
  localId: number;
  propertyId: number;
  userId: string;
  name: string;
  phone?: string;
  email?: string;
  unitNumber?: string;
  rentAmount: number;
  standingFees: number;
  depositAmount: number;
  leaseStart?: string;
  leaseEnd?: string;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}


interface MonthlyRecord {
  billingMonth: string;
  rentAmount: number;
  totalBilled: number;
  amountPaid: number;
  arrears: number;
  dueDate: Date | null;
  paidDate: Date | null;
  // partial = due date passed with only part of the bill paid; pending = not yet due (kept for display, never scored)
  paymentStatus: 'early' | 'on_time' | 'late' | 'partial' | 'unpaid' | 'pending';
  daysLate: number;
  paidRatio: number;     // amountPaid / totalBilled, 0..1
  outstanding: number;   // balance still owed for the month
  invoiceCount: number;
  hadMultipleInvoices: boolean;
}

interface CalculatedMetrics {
  onTimePaymentRate: number;
  earlyPaymentRate: number;
  latePaymentRate: number;
  averageDaysLate: number;
  maxDaysLate: number;
  averageMonthlyArrears: number;
  maxMonthlyArrears: number;
  totalArrearsAccumulated: number;
  paymentCompletionRate: number;
  rentStability: boolean;
  hadRentIncreases: boolean;
  averageMonthlyBilled: number;
  paymentVariability: number;
  hasUnpaidInvoices: boolean;
  unpaidInvoiceCount: number;
  longestNonPaymentStreak: number;
  improvingTrend: boolean;
  screeningScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  paymentConsistencyScore?: number;
  preferredPaymentDay?: number;
  averagePaymentDelay?: number;
  paymentReliabilityTrend?: 'improving' | 'stable' | 'declining';
  cashFlowStressIndicators?: string[];
  hasSeasonalPaymentPatterns?: boolean;
  worstPerformingMonths?: string[];

  // NEW v3 - partial payments and current standing
  partialPaymentRate?: number;      // share of due months paid only in part
  averagePaidRatio?: number;        // average share of each due bill that was paid (0..1)
  overdueBalance?: number;          // owed on bills already past due
  outstandingBalance?: number;      // owed on all bills, including those not yet due
  currentDaysOverdue?: number;      // days since the oldest unsettled bill fell due
}

interface ScreeningData {
  tenantId: number;
  tenantFirestoreId: string;
  tenantName: string;
  tenantPhone: string;
  tenantEmail: string;
  currentPropertyId: number;
  currentUnitNumber: string;
  currentRentAmount: number;
  paymentHistory: {
    totalMonthsTracked: number;
    monthlyRecords: MonthlyRecord[];
  };
  calculatedMetrics: CalculatedMetrics;
  dataQuality: {
    monthsWithCompleteData: number;
    hasRecentData: boolean;
    dataConfidenceScore: number;
    lastInvoiceDate: Date | null;
    oldestInvoiceDate: Date | null;
    dataCompletenessScore?: number;
    missingDataPoints?: string[];
    reliabilityFlags?: {
      hasGaps: boolean;
      hasInconsistencies: boolean;
      requiresManualReview: boolean;
    };
    recommendedAction?: 'use_confidently' | 'use_with_caution' | 'request_manual_screening';
  };
  portfolioBenchmarks?: {
    percentileRank?: number;
    comparedToPortfolioAverage: {
      screeningScore: 'above' | 'average' | 'below';
      onTimeRate: 'above' | 'average' | 'below';
      arrearsLevel: 'above' | 'average' | 'below';
    };
    portfolioContext: string;
  };
  earlyWarningFlags?: {
    recentDeteriorationDetected: boolean;
    flagsRaised: string[];
    riskTrend: 'improving' | 'stable' | 'worsening';
    recommendedMonitoring: 'none' | 'monthly' | 'weekly';
  };
  lastUpdated: Date;
  lastMiningRun: Date;
  sourceUserId: string;
  dataVersion: number;
}

interface QuickViewCache {
  tenantId: number;
  tenantFirestoreId: string;
  tenantName: string;
  tenantPhone: string;
  propertyId: number;
  unitNumber: string;
  currentRent: number;
  screeningScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  onTimePaymentRate: number;
  totalArrears: number;
  monthsTracked: number;
  lastPaymentStatus: 'early' | 'on_time' | 'late' | 'partial' | 'unpaid' | 'pending';
  daysSinceLastPayment: number | null;
  earlyWarningFlags: string[];
  dataQualityScore: number;
  recommendedAction: 'approve' | 'conditional' | 'review' | 'reject';
  portfolioPercentile: number | null;
  lastUpdated: Timestamp;
}

export class FirebaseTenantScreeningService {
  private static instance: FirebaseTenantScreeningService;
  private miningInProgress = new Map<string, boolean>();
  private readonly TWELVE_MONTHS_AGO = new Date(Date.now() - (12 * 30 * 24 * 60 * 60 * 1000));
  private portfolioBenchmarkCache = new Map<string, { data: any; lastUpdated: Date }>();

  static getInstance(): FirebaseTenantScreeningService {
    if (!this.instance) {
      this.instance = new FirebaseTenantScreeningService();
    }
    return this.instance;
  }

  // ==================== MAIN PUBLIC METHODS ====================

  /**
   * Trigger screening update after payment success
   */
  async updateScreeningAfterPayment(
    agentId: string,
    tenantLocalId: number,
  ): Promise<void> {
    try {
      console.log(`🔍 Updating screening for tenant ${tenantLocalId} after payment`);

      // Get tenant data
      const tenant = await this.getTenantByLocalId(agentId, tenantLocalId);
      if (!tenant) {
        console.warn(`⚠️ Tenant ${tenantLocalId} not found`);
        return;
      }

      // Perform screening mining
      await this.mineTenantData(tenant, agentId);

      console.log(`✅ Screening updated for tenant ${tenantLocalId}`);
    } catch (error) {
      console.error('Error updating screening after payment:', error);
      // Don't throw - screening update shouldn't fail the payment
    }
  }

  /**
   * Perform full screening mining for all tenants of an agent
   */
  async performFullScreeningMining(agentId: string): Promise<void> {
    if (this.miningInProgress.get(agentId)) {
      console.log('⏳ Mining already in progress for agent:', agentId);
      return;
    }

    try {
      this.miningInProgress.set(agentId, true);
      console.log('🔍 Starting full screening mining for agent:', agentId);

      const tenants = await this.getAllAgentTenants(agentId);
      console.log(`📊 Found ${tenants.length} tenants to analyze`);

      // Process in batches to avoid overwhelming Firestore
      const batchSize = 5;
      for (let i = 0; i < tenants.length; i += batchSize) {
        const batch = tenants.slice(i, i + batchSize);
        await Promise.all(
          batch.map(tenant => this.mineTenantData(tenant, agentId).catch(err => {
            console.error(`Failed to mine tenant ${tenant.localId}:`, err);
          }))
        );
        
        // Small delay between batches
        if (i + batchSize < tenants.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      console.log('✅ Full screening mining completed');
    } catch (error) {
      console.error('❌ Full screening mining failed:', error);
      throw error;
    } finally {
      this.miningInProgress.set(agentId, false);
    }
  }

  // ==================== DATA MINING CORE ====================

  private async mineTenantData(tenant: Tenant, agentId: string): Promise<void> {
    try {
      console.log(`🔍 Mining data for tenant: ${tenant.name} (ID: ${tenant.localId})`);

      // Get tenant's invoices from last 12 months
      const invoices = await this.getTenantInvoicesLast12Months(agentId, tenant.localId);

      if (invoices.length === 0) {
        console.log(`⚠️ No recent invoices for tenant ${tenant.localId}`);
        return;
      }

      // Generate monthly payment patterns
      const allRecords = this.generateMonthlyRecords(invoices);
      // Bills not yet due ('pending') are shown but never scored: only months that have fallen due are assessed
      const monthlyRecords = allRecords.filter(r => r.paymentStatus !== 'pending');

      // Calculate screening metrics
      const calculatedMetrics = this.calculateScreeningMetrics(monthlyRecords, invoices, allRecords);

      // Enhanced data quality assessment
      const dataQuality = this.enhancedDataQualityAssessment(monthlyRecords, invoices, tenant);

      // Early warning detection
      const earlyWarningFlags = this.detectEarlyWarnings(monthlyRecords);

      // Portfolio benchmarking
      const portfolioBenchmarks = await this.calculatePortfolioBenchmarks(
        calculatedMetrics.screeningScore,
        calculatedMetrics.onTimePaymentRate,
        calculatedMetrics.totalArrearsAccumulated,
        agentId
      );

      // Build screening document
      const screeningData: ScreeningData = {
        tenantId: tenant.localId,
        tenantFirestoreId: tenant.id,
        tenantName: tenant.name || 'Unknown Tenant',
        tenantPhone: tenant.phone || '',
        tenantEmail: tenant.email || '',
        currentPropertyId: tenant.propertyId,
        currentUnitNumber: tenant.unitNumber || '',
        currentRentAmount: tenant.rentAmount || 0,
        paymentHistory: {
          totalMonthsTracked: monthlyRecords.length,
          monthlyRecords: allRecords
        },
        calculatedMetrics,
        dataQuality,
        earlyWarningFlags,
        portfolioBenchmarks,
        lastUpdated: new Date(),
        lastMiningRun: new Date(),
        sourceUserId: agentId,
        dataVersion: 3
      };

      // Use batch write for atomic updates
      const batch = writeBatch(db);

      // Upload to Firestore screening collection
      const screeningRef = doc(db, 'screening', tenant.id);
      batch.set(screeningRef, this.convertToFirestoreFormat(screeningData), { merge: true });

      // Update quick view cache
      const quickViewRef = doc(db, 'screening_quick_view', tenant.id);
      batch.set(quickViewRef, this.buildQuickViewCache(screeningData), { merge: true });

      await batch.commit();

      console.log(`✅ Screening data uploaded for tenant ${tenant.localId}`);
    } catch (error) {
      console.error(`❌ Failed to mine tenant ${tenant.localId}:`, error);
      throw error;
    }
  }

  private async getTenantInvoicesLast12Months(
    agentId: string,
    tenantLocalId: number
  ): Promise<Invoice[]> {
    try {
      const invoicesRef = collection(db, 'users', agentId, 'invoices');
      const q = query(
        invoicesRef,
        where('tenantId', '==', tenantLocalId),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const invoices: Invoice[] = [];

      snapshot.forEach(doc => {
        const data = doc.data() as Invoice;
        const invoiceDate = data.createdAt ? new Date(data.createdAt) : new Date();

        if (invoiceDate >= this.TWELVE_MONTHS_AGO) {
          invoices.push({ ...data, id: doc.id });
        }
      });

      return invoices.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateA - dateB;
      });
    } catch (error) {
      console.error(`Failed to get invoices for tenant ${tenantLocalId}:`, error);
      return [];
    }
  }

  private generateMonthlyRecords(invoices: Invoice[]): MonthlyRecord[] {
    const monthlyMap = new Map<string, Invoice[]>();

    // Group invoices by billing month
    invoices.forEach(invoice => {
      const month = invoice.billingMonth || this.extractMonthFromDate(invoice.createdAt);
      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, []);
      }
      monthlyMap.get(month)!.push(invoice);
    });

    // Convert to monthly records
    const records: MonthlyRecord[] = [];

    monthlyMap.forEach((monthInvoices, month) => {
      const record = this.createMonthlyRecord(month, monthInvoices);
      records.push(record);
    });

    return records.sort((a, b) => a.billingMonth.localeCompare(b.billingMonth));
  }

  private createMonthlyRecord(month: string, invoices: Invoice[]): MonthlyRecord {
    const totalBilled = invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    const amountPaid = invoices.reduce((sum, inv) => sum + (inv.amountPaid || 0), 0);
    const arrears = invoices.reduce((sum, inv) => sum + (inv.arrears || 0), 0);
    const rentAmount = invoices[0]?.rentAmount || 0;

    // Find earliest due date and latest paid date for the month
    const dueDate = this.findEarliestDueDate(invoices);
    const paidDate = this.findLatestPaidDate(invoices);

    // Calculate payment timing
    const { paymentStatus, daysLate } = this.calculatePaymentTiming(dueDate, paidDate, amountPaid, totalBilled);
    const paidRatio = totalBilled > 0 ? Math.min(1, amountPaid / totalBilled) : 0;
    const outstanding = Math.max(0, Math.round((totalBilled - amountPaid) * 100) / 100);

    return {
      billingMonth: month,
      rentAmount,
      totalBilled,
      amountPaid,
      arrears,
      dueDate,
      paidDate,
      paymentStatus,
      daysLate,
      paidRatio,
      outstanding,
      invoiceCount: invoices.length,
      hadMultipleInvoices: invoices.length > 1
    };
  }

  /**
   * How a month's bill was handled. A bill counts as on-time/early/late ONLY once it is fully paid (timed by the date it was
   * settled). Part-paid after the due date is 'partial' — never credited as on time; nothing paid after the due date is
   * 'unpaid'; a bill not yet due is 'pending' and is left out of every rate.
   */
  private calculatePaymentTiming(
    dueDate: Date | null,
    paidDate: Date | null,
    amountPaid: number,
    totalBilled: number,
    now: Date = new Date()
  ): { paymentStatus: MonthlyRecord['paymentStatus']; daysLate: number } {
    const DAY = 1000 * 60 * 60 * 24;
    const settled = totalBilled > 0 ? amountPaid >= totalBilled - 0.005 : amountPaid > 0;

    if (!settled) {
      if (dueDate && dueDate.getTime() > now.getTime()) return { paymentStatus: 'pending', daysLate: 0 };
      const daysPastDue = dueDate ? Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / DAY)) : 0;
      return amountPaid > 0
        ? { paymentStatus: 'partial', daysLate: daysPastDue }
        : { paymentStatus: 'unpaid', daysLate: 0 };
    }

    // Fully paid. Without both dates the timing is unknown: neutral, not a penalty.
    if (!dueDate || !paidDate) return { paymentStatus: 'on_time', daysLate: 0 };

    const daysDiff = Math.floor((paidDate.getTime() - dueDate.getTime()) / DAY);
    if (daysDiff < 0) return { paymentStatus: 'early', daysLate: 0 };
    if (daysDiff === 0) return { paymentStatus: 'on_time', daysLate: 0 };
    return { paymentStatus: 'late', daysLate: daysDiff };
  }

  // ==================== METRICS CALCULATION ====================

  private calculateScreeningMetrics(
    monthlyRecords: MonthlyRecord[],
    invoices: Invoice[],
    allRecords?: MonthlyRecord[]
  ): CalculatedMetrics {
    if (monthlyRecords.length === 0) {
      return this.getDefaultMetrics();
    }

    const totalMonths = monthlyRecords.length;

    // Payment timing analysis
    const onTimeCount = monthlyRecords.filter(r => r.paymentStatus === 'on_time').length;
    const earlyCount = monthlyRecords.filter(r => r.paymentStatus === 'early').length;
    const lateCount = monthlyRecords.filter(r => r.paymentStatus === 'late').length;

    const onTimePaymentRate = totalMonths > 0 ? (onTimeCount + earlyCount) / totalMonths : 0;
    const earlyPaymentRate = totalMonths > 0 ? earlyCount / totalMonths : 0;
    const latePaymentRate = totalMonths > 0 ? lateCount / totalMonths : 0;

    // Late payment analysis
    const lateDays = monthlyRecords.map(r => r.daysLate);
    const averageDaysLate =
      lateDays.length > 0 ? lateDays.reduce((sum, days) => sum + days, 0) / lateDays.length : 0;
    const maxDaysLate = lateDays.length > 0 ? Math.max(...lateDays) : 0;

    // Arrears analysis
    const arrearsAmounts = monthlyRecords.map(r => r.arrears);
    const averageMonthlyArrears =
      arrearsAmounts.reduce((sum, arr) => sum + arr, 0) / arrearsAmounts.length;
    const maxMonthlyArrears = Math.max(...arrearsAmounts, 0);
    const totalArrearsAccumulated = arrearsAmounts.reduce((sum, arr) => sum + arr, 0);

    // Financial performance
    const totalBilled = monthlyRecords.reduce((sum, r) => sum + r.totalBilled, 0);
    const totalPaid = monthlyRecords.reduce((sum, r) => sum + r.amountPaid, 0);
    const paymentCompletionRate = totalBilled > 0 ? totalPaid / totalBilled : 0;

    // Rent stability
    const rentAmounts = monthlyRecords.map(r => r.rentAmount).filter(amount => amount > 0);
    const rentStability =
      rentAmounts.length <= 1 || rentAmounts.every(amount => amount === rentAmounts[0]);
    const hadRentIncreases =
      rentAmounts.length > 1 && Math.max(...rentAmounts) > Math.min(...rentAmounts);

    const averageMonthlyBilled = totalMonths > 0 ? totalBilled / totalMonths : 0;

    // Payment variability
    const paymentAmounts = monthlyRecords.map(r => r.amountPaid);
    const paymentVariability = this.calculateStandardDeviation(paymentAmounts);

    // Risk indicators
    // Partial payments and current standing (v3)
    const partialMonths = monthlyRecords.filter(r => r.paymentStatus === 'partial').length;
    const partialPaymentRate = totalMonths > 0 ? partialMonths / totalMonths : 0;
    const billedMonths = monthlyRecords.filter(r => r.totalBilled > 0);
    const averagePaidRatio = billedMonths.length > 0 ? billedMonths.reduce((sum, r) => sum + r.paidRatio, 0) / billedMonths.length : 0;
    const standingRecords = allRecords ?? monthlyRecords;
    const overdueRecords = standingRecords.filter(r => r.paymentStatus === 'partial' || r.paymentStatus === 'unpaid');
    const overdueBalance = overdueRecords.reduce((sum, r) => sum + r.outstanding, 0);
    const outstandingBalance = standingRecords.reduce((sum, r) => sum + r.outstanding, 0);
    const currentDaysOverdue = overdueRecords.reduce((max, r) => {
      const days = r.dueDate ? Math.floor((Date.now() - r.dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
      return Math.max(max, days);
    }, 0);

    const hasUnpaidInvoices = invoices.some(
      inv => (inv.amountPaid || 0) < (inv.totalAmount || 0)
    );
    const unpaidInvoiceCount = invoices.filter(inv => (inv.amountPaid || 0) === 0).length;
    const longestNonPaymentStreak = this.calculateLongestNonPaymentStreak(monthlyRecords);
    const improvingTrend = this.calculateImprovingTrend(monthlyRecords);

    // Calculate screening score
    const screeningScore = this.calculateScreeningScore({
      onTimePaymentRate,
      averageDaysLate,
      paymentCompletionRate,
      averageMonthlyArrears,
      longestNonPaymentStreak,
      improvingTrend,
      partialPaymentRate,
      overdueBalance,
      averageMonthlyBilled
    });

    const riskLevel = this.determineRiskLevel(screeningScore);

    // Payment pattern analysis
    const patternAnalysis = this.analyzePaymentPatterns(monthlyRecords);
    const cashFlowStress = this.detectCashFlowStressIndicators(monthlyRecords);
    const seasonalAnalysis = this.detectSeasonalPatterns(monthlyRecords);

    return {
      onTimePaymentRate,
      earlyPaymentRate,
      latePaymentRate,
      averageDaysLate,
      maxDaysLate,
      averageMonthlyArrears,
      maxMonthlyArrears,
      totalArrearsAccumulated,
      paymentCompletionRate,
      rentStability,
      hadRentIncreases,
      averageMonthlyBilled,
      paymentVariability,
      hasUnpaidInvoices,
      unpaidInvoiceCount,
      longestNonPaymentStreak,
      improvingTrend,
      screeningScore,
      riskLevel,
      paymentConsistencyScore: patternAnalysis.consistencyScore,
      preferredPaymentDay: patternAnalysis.preferredPaymentDay,
      averagePaymentDelay: patternAnalysis.averagePaymentDelay,
      paymentReliabilityTrend: patternAnalysis.reliabilityTrend,
      cashFlowStressIndicators: cashFlowStress,
      hasSeasonalPaymentPatterns: seasonalAnalysis.hasSeasonalPatterns,
      worstPerformingMonths: seasonalAnalysis.worstPerformingMonths,

      // NEW v3 fields
      partialPaymentRate,
      averagePaidRatio,
      overdueBalance,
      outstandingBalance,
      currentDaysOverdue
    };
  }

  // ==================== PAYMENT PATTERN ANALYSIS ====================

  private analyzePaymentPatterns(monthlyRecords: MonthlyRecord[]): {
    consistencyScore: number;
    preferredPaymentDay: number;
    averagePaymentDelay: number;
    reliabilityTrend: 'improving' | 'stable' | 'declining';
  } {
    if (monthlyRecords.length < 3) {
      return {
        consistencyScore: 50,
        preferredPaymentDay: 0,
        averagePaymentDelay: 0,
        reliabilityTrend: 'stable'
      };
    }

    const paymentDays = monthlyRecords
      .filter(r => r.paidDate)
      .map(r => r.paidDate!.getDate());

    const preferredPaymentDay = this.findMostFrequentDay(paymentDays);
    const consistencyScore = this.calculatePaymentConsistency(paymentDays, preferredPaymentDay);

    const delays = monthlyRecords.filter(r => r.daysLate >= 0).map(r => r.daysLate);
    const averagePaymentDelay =
      delays.length > 0 ? delays.reduce((sum, d) => sum + d, 0) / delays.length : 0;

    const reliabilityTrend = this.calculateReliabilityTrend(monthlyRecords);

    return { consistencyScore, preferredPaymentDay, averagePaymentDelay, reliabilityTrend };
  }

  private findMostFrequentDay(days: number[]): number {
    if (days.length === 0) return 0;

    const frequency = new Map<number, number>();
    days.forEach(day => {
      frequency.set(day, (frequency.get(day) || 0) + 1);
    });

    let maxFreq = 0;
    let mostFrequentDay = 0;
    frequency.forEach((freq, day) => {
      if (freq > maxFreq) {
        maxFreq = freq;
        mostFrequentDay = day;
      }
    });

    return mostFrequentDay;
  }

  private calculatePaymentConsistency(days: number[], preferredDay: number): number {
    if (days.length === 0) return 0;

    const withinRange = days.filter(day => Math.abs(day - preferredDay) <= 3).length;
    return Math.round((withinRange / days.length) * 100);
  }

  private calculateReliabilityTrend(
    monthlyRecords: MonthlyRecord[]
  ): 'improving' | 'stable' | 'declining' {
    if (monthlyRecords.length < 6) return 'stable';

    const midpoint = Math.floor(monthlyRecords.length / 2);
    const olderHalf = monthlyRecords.slice(0, midpoint);
    const recentHalf = monthlyRecords.slice(midpoint);

    const olderOnTimeRate =
      olderHalf.filter(r => r.paymentStatus === 'on_time' || r.paymentStatus === 'early')
        .length / olderHalf.length;

    const recentOnTimeRate =
      recentHalf.filter(r => r.paymentStatus === 'on_time' || r.paymentStatus === 'early')
        .length / recentHalf.length;

    const difference = recentOnTimeRate - olderOnTimeRate;

    if (difference > 0.15) return 'improving';
    if (difference < -0.15) return 'declining';
    return 'stable';
  }

  private detectCashFlowStressIndicators(monthlyRecords: MonthlyRecord[]): string[] {
    const indicators: string[] = [];

    if (monthlyRecords.length < 3) return indicators;

    const recent3 = monthlyRecords.slice(-3);

    // Check for frequent partial payments
    const partialPayments = recent3.filter(
      r => r.amountPaid > 0 && r.amountPaid < r.totalBilled * 0.9
    ).length;

    if (partialPayments >= 2) {
      indicators.push('frequent_partial_payments');
    }

    // Check for erratic payment timing
    const paymentDays = recent3.filter(r => r.paidDate).map(r => r.paidDate!.getDate());

    if (paymentDays.length >= 2) {
      const dayDifferences = [];
      for (let i = 1; i < paymentDays.length; i++) {
        dayDifferences.push(Math.abs(paymentDays[i] - paymentDays[i - 1]));
      }
      const avgDifference =
        dayDifferences.reduce((sum, d) => sum + d, 0) / dayDifferences.length;

      if (avgDifference > 10) {
        indicators.push('erratic_payment_timing');
      }
    }

    // Check for increasing arrears
    const arrearsIncreasing = recent3.every((record, index) => {
      if (index === 0) return true;
      return record.arrears >= recent3[index - 1].arrears;
    });

    if (arrearsIncreasing && recent3[recent3.length - 1].arrears > 0) {
      indicators.push('steadily_increasing_arrears');
    }

    return indicators;
  }

  private detectSeasonalPatterns(monthlyRecords: MonthlyRecord[]): {
    hasSeasonalPatterns: boolean;
    worstPerformingMonths: string[];
  } {
    if (monthlyRecords.length < 6) {
      return { hasSeasonalPatterns: false, worstPerformingMonths: [] };
    }

    const monthPerformance = new Map<string, { late: number; total: number }>();

    monthlyRecords.forEach(record => {
      const monthName = new Date(record.billingMonth + '-01').toLocaleDateString('en-US', {
        month: 'long'
      });

      if (!monthPerformance.has(monthName)) {
        monthPerformance.set(monthName, { late: 0, total: 0 });
      }

      const stats = monthPerformance.get(monthName)!;
      stats.total++;
      if (record.paymentStatus === 'late' || record.paymentStatus === 'partial' || record.paymentStatus === 'unpaid') {
        stats.late++;
      }
    });

    const worstPerformingMonths: string[] = [];
    monthPerformance.forEach((stats, month) => {
      const lateRate = stats.late / stats.total;
      if (lateRate > 0.5 && stats.total >= 2) {
        worstPerformingMonths.push(month);
      }
    });

    const hasSeasonalPatterns = worstPerformingMonths.length > 0;

    return { hasSeasonalPatterns, worstPerformingMonths };
  }

  // ==================== DATA QUALITY ASSESSMENT ====================

  private enhancedDataQualityAssessment(
    monthlyRecords: MonthlyRecord[],
    invoices: Invoice[],
    tenant: Tenant
  ): ScreeningData['dataQuality'] {
    const basic = this.assessBasicDataQuality(monthlyRecords, invoices);

    const completenessFactors = {
      hasPhone: !!tenant.phone,
      hasEmail: !!tenant.email,
      hasCompletePaymentDates: monthlyRecords.every(
        r => r.paidDate || r.paymentStatus === 'unpaid' || r.paymentStatus === 'partial'
      ),
      hasConsistentInvoicing: this.checkInvoicingConsistency(monthlyRecords),
      hasRecentData: basic.hasRecentData,
      hasMinimumHistory: monthlyRecords.length >= 3
    };

    const trueCount = Object.values(completenessFactors).filter(Boolean).length;
    const dataCompletenessScore = Math.round(
      (trueCount / Object.keys(completenessFactors).length) * 100
    );

    const missingDataPoints: string[] = [];
    if (!tenant.phone) missingDataPoints.push('phone_number');
    if (!tenant.email) missingDataPoints.push('email_address');
    if (monthlyRecords.length < 3) missingDataPoints.push('sufficient_payment_history');
    if (!completenessFactors.hasCompletePaymentDates) missingDataPoints.push('payment_dates');

    const hasGaps = this.detectPaymentGaps(monthlyRecords);
    const hasInconsistencies = this.detectDataInconsistencies(monthlyRecords);

    let recommendedAction: 'use_confidently' | 'use_with_caution' | 'request_manual_screening';
    if (dataCompletenessScore >= 80 && !hasGaps && !hasInconsistencies) {
      recommendedAction = 'use_confidently';
    } else if (dataCompletenessScore >= 60 && monthlyRecords.length >= 3) {
      recommendedAction = 'use_with_caution';
    } else {
      recommendedAction = 'request_manual_screening';
    }

    return {
      ...basic,
      dataCompletenessScore,
      missingDataPoints,
      reliabilityFlags: {
        hasGaps,
        hasInconsistencies,
        requiresManualReview: recommendedAction === 'request_manual_screening'
      },
      recommendedAction
    };
  }

  private assessBasicDataQuality(
    monthlyRecords: MonthlyRecord[],
    invoices: Invoice[]
  ): Pick<
    ScreeningData['dataQuality'],
    'monthsWithCompleteData' | 'hasRecentData' | 'dataConfidenceScore' | 'lastInvoiceDate' | 'oldestInvoiceDate'
  > {
    const monthsWithCompleteData = monthlyRecords.filter(
      record =>
        record.totalBilled > 0 &&
        record.dueDate !== null &&
        (record.amountPaid > 0 || record.paymentStatus === 'unpaid')
    ).length;

    const invoiceDates = invoices.map(inv => new Date(inv.createdAt || 0).getTime());
    const lastInvoiceDate = invoiceDates.length > 0 ? new Date(Math.max(...invoiceDates)) : null;
    const oldestInvoiceDate = invoiceDates.length > 0 ? new Date(Math.min(...invoiceDates)) : null;

    const hasRecentData = lastInvoiceDate
      ? Date.now() - lastInvoiceDate.getTime() < 30 * 24 * 60 * 60 * 1000
      : false;

    const dataConfidenceScore =
      monthlyRecords.length > 0 ? monthsWithCompleteData / monthlyRecords.length : 0;

    return {
      monthsWithCompleteData,
      hasRecentData,
      dataConfidenceScore,
      lastInvoiceDate,
      oldestInvoiceDate
    };
  }

  private checkInvoicingConsistency(monthlyRecords: MonthlyRecord[]): boolean {
    if (monthlyRecords.length < 2) return true;
    return this.findMonthGaps(monthlyRecords).length === 0;
  }

  private findMonthGaps(monthlyRecords: MonthlyRecord[]): string[] {
    if (monthlyRecords.length < 2) return [];

    const gaps: string[] = [];
    const sortedRecords = [...monthlyRecords].sort((a, b) =>
      a.billingMonth.localeCompare(b.billingMonth)
    );

    for (let i = 1; i < sortedRecords.length; i++) {
      const prevDate = new Date(sortedRecords[i - 1].billingMonth + '-01');
      const currDate = new Date(sortedRecords[i].billingMonth + '-01');

      const monthDiff =
        (currDate.getFullYear() - prevDate.getFullYear()) * 12 +
        (currDate.getMonth() - prevDate.getMonth());

      if (monthDiff > 1) {
        gaps.push(`${sortedRecords[i - 1].billingMonth} to ${sortedRecords[i].billingMonth}`);
      }
    }

    return gaps;
  }

  private detectPaymentGaps(monthlyRecords: MonthlyRecord[]): boolean {
    return this.findMonthGaps(monthlyRecords).length > 0;
  }

  private detectDataInconsistencies(monthlyRecords: MonthlyRecord[]): boolean {
    const impossiblePayments = monthlyRecords.filter(r => {
      if (!r.dueDate || !r.paidDate) return false;
      const daysDiff = (r.paidDate.getTime() - r.dueDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff < -30;
    });

    const statusInconsistencies = monthlyRecords.filter(
      r => r.amountPaid > 0 && r.paymentStatus === 'unpaid'
    );

    return impossiblePayments.length > 0 || statusInconsistencies.length > 0;
  }

  // ==================== EARLY WARNING SYSTEM ====================

  private detectEarlyWarnings(monthlyRecords: MonthlyRecord[]): ScreeningData['earlyWarningFlags'] {
    if (monthlyRecords.length < 3) {
      return {
        recentDeteriorationDetected: false,
        flagsRaised: [],
        riskTrend: 'stable',
        recommendedMonitoring: 'monthly'
      };
    }

    const recent3 = monthlyRecords.slice(-3);
    const previous3 = monthlyRecords.length >= 6 ? monthlyRecords.slice(-6, -3) : [];

    const flags: string[] = [];

    if (recent3[recent3.length - 1].paymentStatus === 'unpaid') {
      flags.push('missed_last_payment');
    } else if (recent3[recent3.length - 1].paymentStatus === 'partial') {
      flags.push('last_payment_incomplete');
    }

    // Money owed on bills already past due
    const overdueNow = monthlyRecords.filter(r => r.paymentStatus === 'partial' || r.paymentStatus === 'unpaid');
    if (overdueNow.length >= 2) {
      flags.push('multiple_overdue_months');
    }

    const recentAvgArrears = recent3.reduce((sum, r) => sum + r.arrears, 0) / 3;
    const previousAvgArrears =
      previous3.length > 0 ? previous3.reduce((sum, r) => sum + r.arrears, 0) / previous3.length : 0;

    if (recentAvgArrears > previousAvgArrears * 1.5 && recentAvgArrears > 1000) {
      flags.push('arrears_increasing_rapidly');
    }

    const recentAvgDelay = recent3.reduce((sum, r) => sum + r.daysLate, 0) / 3;
    const previousAvgDelay =
      previous3.length > 0 ? previous3.reduce((sum, r) => sum + r.daysLate, 0) / previous3.length : 0;

    if (recentAvgDelay > previousAvgDelay + 5 && recentAvgDelay > 10) {
      flags.push('payment_delays_worsening');
    }

    const partialPayments = recent3.filter(
      r => r.amountPaid > 0 && r.amountPaid < r.totalBilled * 0.9
    ).length;

    if (partialPayments >= 2) {
      flags.push('frequent_partial_payments');
    }

    const consecutiveLate = recent3.filter(
      r => r.paymentStatus === 'late' || r.paymentStatus === 'partial' || r.paymentStatus === 'unpaid'
    ).length;

    if (consecutiveLate === 3) {
      flags.push('three_consecutive_late_payments');
    }

    const recentDeteriorationDetected = flags.length > 0;

    let riskTrend: 'improving' | 'stable' | 'worsening';
    if (flags.length >= 2) riskTrend = 'worsening';
    else if (flags.length === 1) riskTrend = 'stable';
    else riskTrend = 'improving';

    let recommendedMonitoring: 'none' | 'monthly' | 'weekly';
    if (flags.length >= 3 || flags.includes('three_consecutive_late_payments')) {
      recommendedMonitoring = 'weekly';
    } else if (flags.length >= 1) {
      recommendedMonitoring = 'monthly';
    } else {
      recommendedMonitoring = 'none';
    }

    return {
      recentDeteriorationDetected,
      flagsRaised: flags,
      riskTrend,
      recommendedMonitoring
    };
  }

  // ==================== PORTFOLIO BENCHMARKING ====================

  private async calculatePortfolioBenchmarks(
    tenantScore: number,
    onTimeRate: number,
    totalArrears: number,
    agentId: string
  ): Promise<ScreeningData['portfolioBenchmarks'] | undefined> {
    try {
      const cached = this.portfolioBenchmarkCache.get(agentId);
      const cacheAge = cached ? Date.now() - cached.lastUpdated.getTime() : Infinity;
      const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours

      let allScores: number[];
      let allOnTimeRates: number[];
      let allArrears: number[];

      if (cached && cacheAge < CACHE_DURATION) {
        allScores = cached.data.scores;
        allOnTimeRates = cached.data.onTimeRates;
        allArrears = cached.data.arrears;
      } else {
        // Fetch all screening quick views for this agent
        const quickViewRef = collection(db, 'screening_quick_view');
        const q = query(quickViewRef, where('sourceUserId', '==', agentId));
        const snapshot = await getDocs(q);

        if (snapshot.size < 5) {
          return undefined;
        }

        allScores = [];
        allOnTimeRates = [];
        allArrears = [];

        snapshot.forEach(doc => {
          const data = doc.data() as QuickViewCache;
          allScores.push(data.screeningScore);
          allOnTimeRates.push(data.onTimePaymentRate);
          allArrears.push(data.totalArrears);
        });

        this.portfolioBenchmarkCache.set(agentId, {
          data: { scores: allScores, onTimeRates: allOnTimeRates, arrears: allArrears },
          lastUpdated: new Date()
        });
      }

      const betterThan = allScores.filter(s => tenantScore > s).length;
      const percentileRank = Math.round((betterThan / allScores.length) * 100);

      const avgScore = allScores.reduce((sum, s) => sum + s, 0) / allScores.length;
      const avgOnTimeRate = allOnTimeRates.reduce((sum, r) => sum + r, 0) / allOnTimeRates.length;
      const avgArrears = allArrears.reduce((sum, a) => sum + a, 0) / allArrears.length;

      let context: string;
      if (percentileRank >= 75) {
        context = `Top 25% performer in your portfolio (${percentileRank}th percentile)`;
      } else if (percentileRank >= 50) {
        context = `Above average in your portfolio (${percentileRank}th percentile)`;
      } else if (percentileRank >= 25) {
        context = `Below average in your portfolio (${percentileRank}th percentile)`;
      } else {
        context = `Bottom 25% performer in your portfolio (${percentileRank}th percentile)`;
      }

      return {
        percentileRank,
        comparedToPortfolioAverage: {
          screeningScore:
            tenantScore > avgScore + 10 ? 'above' : tenantScore < avgScore - 10 ? 'below' : 'average',
          onTimeRate:
            onTimeRate > avgOnTimeRate + 0.1
              ? 'above'
              : onTimeRate < avgOnTimeRate - 0.1
              ? 'below'
              : 'average',
          arrearsLevel:
            totalArrears < avgArrears * 0.5
              ? 'above'
              : totalArrears > avgArrears * 1.5
              ? 'below'
              : 'average'
        },
        portfolioContext: context
      };
    } catch (error) {
      console.error('Failed to calculate portfolio benchmarks:', error);
      return undefined;
    }
  }

  // ==================== SCORING ALGORITHMS ====================

  /**
   * 0-100. Weights: on-time 35 | completion 25 | lateness 12 | arrears 10 | non-payment streak 5 | improving trend 5 |
   * part-payment behaviour 4 | current overdue standing 4. Only months already due are scored.
   */
  private calculateScreeningScore(factors: {
    onTimePaymentRate: number;
    averageDaysLate: number;
    paymentCompletionRate: number;
    averageMonthlyArrears: number;
    longestNonPaymentStreak: number;
    improvingTrend: boolean;
    partialPaymentRate: number;
    overdueBalance: number;
    averageMonthlyBilled: number;
  }): number {
    let score = 0;

    score += factors.onTimePaymentRate * 35;
    score += Math.min(1, factors.paymentCompletionRate) * 25;

    const latePenalty = Math.min(factors.averageDaysLate / 30, 1); // Cap at 30 days
    score += (1 - latePenalty) * 12;

    const arrearsPenalty = Math.min(factors.averageMonthlyArrears / 10000, 1); // Cap at 10k KES
    score += (1 - arrearsPenalty) * 10;

    const streakPenalty = Math.min(factors.longestNonPaymentStreak / 3, 1); // Cap at 3 months
    score += (1 - streakPenalty) * 5;

    if (factors.improvingTrend) score += 5;

    score += (1 - Math.min(1, factors.partialPaymentRate)) * 4;

    // Owing a full month's bill (or more) right now forfeits all of this component
    const standingPenalty = factors.averageMonthlyBilled > 0 ? Math.min(1, factors.overdueBalance / factors.averageMonthlyBilled) : 0;
    score += (1 - standingPenalty) * 4;

    return Math.max(0, Math.min(100, Math.round(score * 100) / 100));
  }

  private determineRiskLevel(score: number): 'low' | 'medium' | 'high' {
    if (score >= 75) return 'low';
    if (score >= 50) return 'medium';
    return 'high';
  }

  // ==================== UTILITY METHODS ====================

  private calculateStandardDeviation(numbers: number[]): number {
    if (numbers.length <= 1) return 0;

    const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
    const squaredDiffs = numbers.map(num => Math.pow(num - mean, 2));
    const avgSquaredDiff =
      squaredDiffs.reduce((sum, diff) => sum + diff, 0) / squaredDiffs.length;

    return Math.sqrt(avgSquaredDiff);
  }

  private calculateLongestNonPaymentStreak(records: MonthlyRecord[]): number {
    let maxStreak = 0;
    let currentStreak = 0;

    records.forEach(record => {
      if (record.amountPaid === 0) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    });

    return maxStreak;
  }

  private calculateImprovingTrend(records: MonthlyRecord[]): boolean {
    if (records.length < 3) return false;

    const recentRecords = records.slice(-3);
    const olderRecords = records.slice(0, -3);

    if (olderRecords.length === 0) return false;

    const recentOnTimeRate =
      recentRecords.filter(r => r.paymentStatus === 'on_time' || r.paymentStatus === 'early')
        .length / recentRecords.length;
    const olderOnTimeRate =
      olderRecords.filter(r => r.paymentStatus === 'on_time' || r.paymentStatus === 'early')
        .length / olderRecords.length;

    return recentOnTimeRate > olderOnTimeRate;
  }

  private extractMonthFromDate(dateString: string | any): string {
    const date = new Date(dateString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private findEarliestDueDate(invoices: Invoice[]): Date | null {
    const dueDates = invoices
      .map(inv => (inv.dueDate ? new Date(inv.dueDate) : null))
      .filter(date => date !== null) as Date[];

    return dueDates.length > 0 ? new Date(Math.min(...dueDates.map(d => d.getTime()))) : null;
  }

  private findLatestPaidDate(invoices: Invoice[]): Date | null {
    const paidDates = invoices
      .map(inv => (inv.paidDate ? new Date(inv.paidDate) : null))
      .filter(date => date !== null) as Date[];

    return paidDates.length > 0 ? new Date(Math.max(...paidDates.map(d => d.getTime()))) : null;
  }

  private getDefaultMetrics(): CalculatedMetrics {
    return {
      onTimePaymentRate: 0,
      earlyPaymentRate: 0,
      latePaymentRate: 0,
      averageDaysLate: 0,
      maxDaysLate: 0,
      averageMonthlyArrears: 0,
      maxMonthlyArrears: 0,
      totalArrearsAccumulated: 0,
      paymentCompletionRate: 0,
      rentStability: true,
      hadRentIncreases: false,
      averageMonthlyBilled: 0,
      paymentVariability: 0,
      hasUnpaidInvoices: false,
      unpaidInvoiceCount: 0,
      longestNonPaymentStreak: 0,
      improvingTrend: false,
      screeningScore: 0,
      riskLevel: 'high'
    };
  }

  // ==================== FIRESTORE HELPERS ====================

  private async getTenantByLocalId(agentId: string, localId: number): Promise<Tenant | null> {
    try {
      const tenantsRef = collection(db, 'users', agentId, 'tenants');
      const q = query(tenantsRef, where('localId', '==', localId), firestoreLimit(1));
      const snapshot = await getDocs(q);

      if (snapshot.empty) return null;

      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() } as Tenant;
    } catch (error) {
      console.error(`Error fetching tenant ${localId}:`, error);
      return null;
    }
  }

  private async getAllAgentTenants(agentId: string): Promise<Tenant[]> {
    try {
      const tenantsRef = collection(db, 'users', agentId, 'tenants');
      const q = query(tenantsRef, where('isActive', '==', true));
      const snapshot = await getDocs(q);

      const tenants: Tenant[] = [];
      snapshot.forEach(doc => {
        tenants.push({ id: doc.id, ...doc.data() } as Tenant);
      });

      return tenants;
    } catch (error) {
      console.error('Error fetching all tenants:', error);
      return [];
    }
  }

  private convertToFirestoreFormat(data: ScreeningData): any {
    return {
      ...data,
      paymentHistory: {
        ...data.paymentHistory,
        monthlyRecords: data.paymentHistory.monthlyRecords.map(record => ({
          ...record,
          dueDate: record.dueDate ? Timestamp.fromDate(record.dueDate) : null,
          paidDate: record.paidDate ? Timestamp.fromDate(record.paidDate) : null
        }))
      },
      dataQuality: {
        ...data.dataQuality,
        lastInvoiceDate: data.dataQuality.lastInvoiceDate
          ? Timestamp.fromDate(data.dataQuality.lastInvoiceDate)
          : null,
        oldestInvoiceDate: data.dataQuality.oldestInvoiceDate
          ? Timestamp.fromDate(data.dataQuality.oldestInvoiceDate)
          : null
      },
      lastUpdated: serverTimestamp(),
      lastMiningRun: serverTimestamp()
    };
  }

  private buildQuickViewCache(screeningData: ScreeningData): QuickViewCache {
    // The most recent bill that has fallen due (bills not yet due are 'pending' and not part of the picture)
    const dueRecords = screeningData.paymentHistory.monthlyRecords.filter(r => r.paymentStatus !== 'pending');
    const lastDue = dueRecords.length > 0 ? dueRecords[dueRecords.length - 1] : null;
    const lastPaymentStatus = lastDue ? lastDue.paymentStatus : 'unpaid';
    const lastPaymentDate = lastDue ? lastDue.paidDate : null;

    const daysSinceLastPayment = lastPaymentDate
      ? Math.floor((Date.now() - lastPaymentDate.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    let recommendedAction: 'approve' | 'conditional' | 'review' | 'reject';
    if (
      screeningData.calculatedMetrics.screeningScore >= 80 &&
      screeningData.calculatedMetrics.riskLevel === 'low'
    ) {
      recommendedAction = 'approve';
    } else if (screeningData.calculatedMetrics.screeningScore >= 65) {
      recommendedAction = 'conditional';
    } else if (screeningData.calculatedMetrics.screeningScore >= 50) {
      recommendedAction = 'review';
    } else {
      recommendedAction = 'reject';
    }

    return {
      tenantId: screeningData.tenantId,
      tenantFirestoreId: screeningData.tenantFirestoreId,
      tenantName: screeningData.tenantName,
      tenantPhone: screeningData.tenantPhone,
      propertyId: screeningData.currentPropertyId,
      unitNumber: screeningData.currentUnitNumber,
      currentRent: screeningData.currentRentAmount,
      screeningScore: screeningData.calculatedMetrics.screeningScore,
      riskLevel: screeningData.calculatedMetrics.riskLevel,
      onTimePaymentRate: screeningData.calculatedMetrics.onTimePaymentRate,
      totalArrears: screeningData.calculatedMetrics.totalArrearsAccumulated,
      monthsTracked: screeningData.paymentHistory.totalMonthsTracked,
      lastPaymentStatus,
      daysSinceLastPayment,
      earlyWarningFlags: screeningData.earlyWarningFlags?.flagsRaised || [],
      dataQualityScore: screeningData.dataQuality.dataConfidenceScore,
      recommendedAction,
      portfolioPercentile: screeningData.portfolioBenchmarks?.percentileRank || null,
      lastUpdated: Timestamp.now()
    };
  }

  // ==================== PUBLIC QUERY METHODS ====================

  async getScreeningData(tenantFirestoreId: string): Promise<ScreeningData | null> {
    try {
      const docRef = doc(db, 'screening', tenantFirestoreId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) return null;

      return docSnap.data() as ScreeningData;
    } catch (error) {
      console.error('Error fetching screening data:', error);
      return null;
    }
  }

  async getQuickScreeningView(agentId: string): Promise<QuickViewCache[]> {
    try {
      const quickViewRef = collection(db, 'screening_quick_view');
      const q = query(quickViewRef, where('sourceUserId', '==', agentId), orderBy('screeningScore', 'desc'));
      const snapshot = await getDocs(q);

      const results: QuickViewCache[] = [];
      snapshot.forEach(doc => {
        results.push(doc.data() as QuickViewCache);
      });

      return results;
    } catch (error) {
      console.error('Error fetching quick screening view:', error);
      return [];
    }
  }

  async getHighRiskTenants(agentId: string): Promise<QuickViewCache[]> {
    try {
      const quickViewRef = collection(db, 'screening_quick_view');
      const q = query(
        quickViewRef,
        where('sourceUserId', '==', agentId),
        where('riskLevel', '==', 'high'),
        orderBy('screeningScore', 'asc')
      );
      const snapshot = await getDocs(q);

      const results: QuickViewCache[] = [];
      snapshot.forEach(doc => {
        results.push(doc.data() as QuickViewCache);
      });

      return results;
    } catch (error) {
      console.error('Error fetching high risk tenants:', error);
      return [];
    }
  }

  async getTenantsByProperty(agentId: string, propertyId: number): Promise<QuickViewCache[]> {
    try {
      const quickViewRef = collection(db, 'screening_quick_view');
      const q = query(
        quickViewRef,
        where('sourceUserId', '==', agentId),
        where('propertyId', '==', propertyId),
        orderBy('screeningScore', 'desc')
      );
      const snapshot = await getDocs(q);

      const results: QuickViewCache[] = [];
      snapshot.forEach(doc => {
        results.push(doc.data() as QuickViewCache);
      });

      return results;
    } catch (error) {
      console.error('Error fetching tenants by property:', error);
      return [];
    }
  }
}

// Export singleton instance
export const Screening = FirebaseTenantScreeningService.getInstance();