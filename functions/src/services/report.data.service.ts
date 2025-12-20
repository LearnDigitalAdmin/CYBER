/**
 * Report Data Service
 * Aggregates data from Firestore for report generation
 */

import { db } from '../config/firebase.config';
import { Shop } from '../types/shop.types';
import { ReportData, ReportPeriod, ReportDateRange } from '../types/report.types';
import { logger } from '../utils/logger';

/**
 * Get date range for report
 */
function getDateRange(
  dateRange: ReportDateRange
): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  const startDate = new Date();

  if (dateRange === 'last7days') {
    startDate.setDate(endDate.getDate() - 7);
  } else {
    startDate.setDate(endDate.getDate() - 30);
  }

  return { startDate, endDate };
}

/**
 * Format date to DDMMYYYY
 */
function formatDateCode(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}${month}${year}`;
}

/**
 * Format date to DD/MM/YYYY
 */
function formatDisplayDate(dateCode: string): string {
  const day = dateCode.substring(0, 2);
  const month = dateCode.substring(2, 4);
  const year = dateCode.substring(4, 8);
  return `${day}/${month}/${year}`;
}

/**
 * Parse dateCode back to Date
 */
function parseDateCode(dateCode: string): Date {
  const day = parseInt(dateCode.substring(0, 2), 10);
  const month = parseInt(dateCode.substring(2, 4), 10) - 1;
  const year = parseInt(dateCode.substring(4, 8), 10);
  return new Date(year, month, day);
}

/**
 * Aggregate report data for a shop
 */
export async function aggregateReportData(
  shopId: string,
  dateRange: ReportDateRange,
  reportPeriod: ReportPeriod
): Promise<ReportData | null> {
  try {
    // Get shop data
    const shopDoc = await db.collection('shops').doc(shopId).get();
    if (!shopDoc.exists) {
      logger.error('Shop not found', { shopId });
      return null;
    }

    const shop = shopDoc.data() as Shop;
    const { startDate, endDate } = getDateRange(dateRange);
    const startDateCode = formatDateCode(startDate);
    const endDateCode = formatDateCode(endDate);

    // Fetch all daily summaries in range
    const summariesSnapshot = await db
      .collection('shops')
      .doc(shopId)
      .collection('summaries')
      .get();

    let totalSales = 0;
    let totalExpenses = 0;
    let salesCount = 0;
    let expenseCount = 0;
    const dailyData: ReportData['dailyData'] = [];
    const topProductsMap: Record<string, { quantity: number; revenue: number }> = {};
    const expenseMap: Record<string, number> = {};

    // Process summaries
    summariesSnapshot.forEach((doc) => {
      const dateCode = doc.id;
      const date = parseDateCode(dateCode);

      // Check if within range
      if (date >= startDate && date <= endDate) {
        const summary = doc.data();

        totalSales += summary.totalSales ?? 0;
        totalExpenses += summary.totalExpenses ?? 0;
        salesCount += (summary.stockMovement?.sold ? Object.keys(summary.stockMovement.sold).length : 0);
        expenseCount += (summary.transactionCount ?? 0) - salesCount;

        dailyData.push({
          date: formatDisplayDate(dateCode),
          sales: summary.totalSales ?? 0,
          expenses: summary.totalExpenses ?? 0,
          profit: (summary.totalSales ?? 0) - (summary.totalExpenses ?? 0),
          transactionCount: summary.transactionCount ?? 0,
        });

        // Track products
        if (summary.stockMovement?.sold) {
          Object.entries(summary.stockMovement.sold).forEach(([product, qty]) => {
            if (!topProductsMap[product]) {
              topProductsMap[product] = { quantity: 0, revenue: 0 };
            }
            topProductsMap[product].quantity += (qty as number);
          });
        }
      }
    });

    // Fetch sales details to get revenue per product
    const salesSnapshot = await db
      .collection('shops')
      .doc(shopId)
      .collection('sales')
      .get();

    salesSnapshot.forEach((doc) => {
      const dateCode = doc.id;
      const date = parseDateCode(dateCode);

      if (date >= startDate && date <= endDate) {
        const transactions = doc.data().transactions || {};

        Object.values(transactions).forEach((sale: any) => {
          if (topProductsMap[sale.productName]) {
            topProductsMap[sale.productName].revenue += sale.totalPrice ?? 0;
          }
        });
      }
    });

    // Fetch expenses breakdown
    const expensesSnapshot = await db
      .collection('shops')
      .doc(shopId)
      .collection('expenses')
      .get();

    expensesSnapshot.forEach((doc) => {
      const dateCode = doc.id;
      const date = parseDateCode(dateCode);

      if (date >= startDate && date <= endDate) {
        const transactions = doc.data().transactions || {};

        Object.values(transactions).forEach((expense: any) => {
          const category = expense.category || 'Other';
          expenseMap[category] = (expenseMap[category] ?? 0) + (expense.amount ?? 0);
        });
      }
    });

    // Sort products
    const sortedProducts = Object.entries(topProductsMap)
      .map(([name, data]) => ({
        name,
        quantity: data.quantity,
        revenue: data.revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const topProducts = sortedProducts.slice(0, 5);
    const lowMovingProducts = sortedProducts.reverse().slice(0, 3);

    // Sort daily data
    dailyData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const reportData: ReportData = {
      shopName: shop.shopName,
      ownerName: shop.ownerName,
      phone: shop.phone,
      email: shop.email,
      location: shop.location,
      businessType: shop.businessType,
      reportPeriod,
      startDate: formatDisplayDate(startDateCode),
      endDate: formatDisplayDate(endDateCode),
      totalSales,
      totalExpenses,
      profit: totalSales - totalExpenses,
      transactionCount: dailyData.reduce((sum, d) => sum + d.transactionCount, 0),
      salesCount,
      expenseCount,
      averageSaleValue: salesCount > 0 ? totalSales / salesCount : 0,
      topProducts,
      lowMovingProducts,
      expenseBreakdown: expenseMap,
      dailyData,
    };

    logger.info('Report data aggregated', {
      shopId,
      dateRange,
      totalSales,
      totalExpenses,
      profit: reportData.profit,
    });

    return reportData;
  } catch (error) {
    logger.error('Failed to aggregate report data', { shopId, error });
    return null;
  }
}

/**
 * Get weekly totals for chart
 */
export function calculateWeeklyTotals(
  dailyData: ReportData['dailyData']
): ReportData['weeklyTotals'] {
  const weeklyMap: Record<string, { sales: number; expenses: number; profit: number }> = {};

  dailyData.forEach((day) => {
    const date = new Date(day.date.split('/').reverse().join('-'));
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());

    const weekKey = formatDisplayDate(formatDateCode(weekStart));

    if (!weeklyMap[weekKey]) {
      weeklyMap[weekKey] = { sales: 0, expenses: 0, profit: 0 };
    }

    weeklyMap[weekKey].sales += day.sales;
    weeklyMap[weekKey].expenses += day.expenses;
    weeklyMap[weekKey].profit += day.profit;
  });

  return Object.entries(weeklyMap).map(([week, data]) => ({
    week,
    ...data,
  }));
}

/**
 * Get list of recent reports from Firestore
 */
export async function getRecentReports(
  shopId: string,
  period: ReportPeriod,
  limit: number = 5
): Promise<any[]> {
  try {
    const snapshot = await db
      .collection('shops')
      .doc(shopId)
      .collection(period === 'weekly' ? 'weeklyReports' : 'monthlyReports')
      .orderBy('generatedAt', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => doc.data());
  } catch (error) {
    logger.error('Failed to get recent reports', { shopId, period, error });
    return [];
  }
}
