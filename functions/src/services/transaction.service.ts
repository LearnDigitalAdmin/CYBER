/**
 * Transaction Service
 * CRUD operations for shop transactions and reports
 */

import { db } from '../config/firebase.config';
import { Transaction, DailySummary } from '../types/transaction.types';
import { logger } from '../utils/logger';

const SHOPS_COLLECTION = 'shops';
const TRANSACTIONS_SUBCOLLECTION = 'transactions';

/**
 * Create a new transaction (income or expense)
 */
export async function createTransaction(shopId: string, transaction: Omit<Transaction, 'id'>): Promise<Transaction> {
  try {
    const transactionRef = db
      .collection(SHOPS_COLLECTION)
      .doc(shopId)
      .collection(TRANSACTIONS_SUBCOLLECTION)
      .doc();

    const newTransaction: Transaction = {
      id: transactionRef.id,
      ...transaction,
    };

    await transactionRef.set(newTransaction);

    logger.info('Transaction created', { shopId, type: transaction.type, amount: transaction.amount });

    return newTransaction;
  } catch (error) {
    logger.error('Failed to create transaction', error);
    throw error;
  }
}

/**
 * Get transaction by ID
 */
export async function getTransactionById(shopId: string, transactionId: string): Promise<Transaction | null> {
  try {
    const doc = await db
      .collection(SHOPS_COLLECTION)
      .doc(shopId)
      .collection(TRANSACTIONS_SUBCOLLECTION)
      .doc(transactionId)
      .get();

    if (!doc.exists) {
      return null;
    }

    return doc.data() as Transaction;
  } catch (error) {
    logger.error('Failed to get transaction', error);
    throw error;
  }
}

/**
 * Get transactions by date range
 */
export async function getTransactionsByDateRange(
  shopId: string,
  startDate: number,
  endDate: number
): Promise<Transaction[]> {
  try {
    const snapshot = await db
      .collection(SHOPS_COLLECTION)
      .doc(shopId)
      .collection(TRANSACTIONS_SUBCOLLECTION)
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .orderBy('date', 'desc')
      .get();

    const transactions: Transaction[] = [];

    snapshot.forEach((doc) => {
      transactions.push(doc.data() as Transaction);
    });

    return transactions;
  } catch (error) {
    logger.error('Failed to get transactions by date range', error);
    throw error;
  }
}

/**
 * Get today's transactions
 */
export async function getTodaysTransactions(shopId: string): Promise<Transaction[]> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const startOfDay = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);

    return await getTransactionsByDateRange(shopId, startOfDay, now);
  } catch (error) {
    logger.error('Failed to get today\'s transactions', error);
    throw error;
  }
}

/**
 * Get daily summary
 */
export async function getDailySummary(shopId: string, date?: number): Promise<DailySummary> {
  try {
    const targetDate = date || Math.floor(Date.now() / 1000);
    const startOfDay = Math.floor(new Date(targetDate * 1000).setHours(0, 0, 0, 0) / 1000);
    const endOfDay = startOfDay + 86400; // 24 hours

    const transactions = await getTransactionsByDateRange(shopId, startOfDay, endOfDay);

    const summary: DailySummary = {
      date: new Date(targetDate * 1000).toISOString().split('T')[0],
      totalIncome: 0,
      totalExpenses: 0,
      profit: 0,
      transactionCount: transactions.length,
    };

    transactions.forEach((tx) => {
      if (tx.type === 'income') {
        summary.totalIncome += tx.amount;
      } else {
        summary.totalExpenses += tx.amount;
      }
    });

    summary.profit = summary.totalIncome - summary.totalExpenses;

    return summary;
  } catch (error) {
    logger.error('Failed to get daily summary', error);
    throw error;
  }
}

/**
 * Get weekly summary
 */
export async function getWeeklySummary(shopId: string): Promise<{ summary: DailySummary; daily: DailySummary[] }> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const sevenDaysAgo = now - 7 * 86400; // 7 days in seconds

    const dailySummaries: DailySummary[] = [];
    let totalIncome = 0;
    let totalExpenses = 0;
    let totalCount = 0;

    // Generate summary for each day
    for (let i = 0; i < 7; i++) {
      const dayTimestamp = sevenDaysAgo + i * 86400;
      const daySummary = await getDailySummary(shopId, dayTimestamp);
      dailySummaries.push(daySummary);

      totalIncome += daySummary.totalIncome;
      totalExpenses += daySummary.totalExpenses;
      totalCount += daySummary.transactionCount;
    }

    const weekSummary: DailySummary = {
      date: 'week',
      totalIncome,
      totalExpenses,
      profit: totalIncome - totalExpenses,
      transactionCount: totalCount,
    };

    return { summary: weekSummary, daily: dailySummaries };
  } catch (error) {
    logger.error('Failed to get weekly summary', error);
    throw error;
  }
}

/**
 * Get monthly summary
 */
export async function getMonthlySummary(shopId: string): Promise<{ summary: DailySummary; daily: DailySummary[] }> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - 30 * 86400; // 30 days in seconds

    const dailySummaries: DailySummary[] = [];
    let totalIncome = 0;
    let totalExpenses = 0;
    let totalCount = 0;

    // Generate summary for each day
    for (let i = 0; i < 30; i++) {
      const dayTimestamp = thirtyDaysAgo + i * 86400;
      const daySummary = await getDailySummary(shopId, dayTimestamp);
      dailySummaries.push(daySummary);

      totalIncome += daySummary.totalIncome;
      totalExpenses += daySummary.totalExpenses;
      totalCount += daySummary.transactionCount;
    }

    const monthSummary: DailySummary = {
      date: 'month',
      totalIncome,
      totalExpenses,
      profit: totalIncome - totalExpenses,
      transactionCount: totalCount,
    };

    return { summary: monthSummary, daily: dailySummaries };
  } catch (error) {
    logger.error('Failed to get monthly summary', error);
    throw error;
  }
}

/**
 * Delete transaction
 */
export async function deleteTransaction(shopId: string, transactionId: string): Promise<void> {
  try {
    await db
      .collection(SHOPS_COLLECTION)
      .doc(shopId)
      .collection(TRANSACTIONS_SUBCOLLECTION)
      .doc(transactionId)
      .delete();

    logger.info('Transaction deleted', { shopId, transactionId });
  } catch (error) {
    logger.error('Failed to delete transaction', error);
    throw error;
  }
}

/**
 * Get transaction statistics for shop
 */
export async function getTransactionStats(shopId: string, days = 30): Promise<{ totalIncome: number; totalExpenses: number; profit: number; count: number }> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const daysAgo = now - days * 86400;

    const transactions = await getTransactionsByDateRange(shopId, daysAgo, now);

    let totalIncome = 0;
    let totalExpenses = 0;

    transactions.forEach((tx) => {
      if (tx.type === 'income') {
        totalIncome += tx.amount;
      } else {
        totalExpenses += tx.amount;
      }
    });

    return {
      totalIncome,
      totalExpenses,
      profit: totalIncome - totalExpenses,
      count: transactions.length,
    };
  } catch (error) {
    logger.error('Failed to get transaction stats', error);
    throw error;
  }
}
