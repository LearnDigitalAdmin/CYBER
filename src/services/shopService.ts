/**
 * Shop Service
 * Handles all shop-related API calls and data management
 *
 * Data Structure (matching WhatsApp implementation):
 * - Sales: shops/{shopId}/sales/{dateCode}/transactions/{saleId}
 * - Expenses: shops/{shopId}/expenses/{dateCode}/transactions/{expenseId}
 * - Stock: shops/{shopId}/stocks (single document with all products)
 * - Summaries: shops/{shopId}/summaries/{dateCode}
 *
 * Date Code Format: DDMMYYYY (e.g., 24112025 for Nov 24, 2025)
 */

import { db } from './firebaseService';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  getDoc,
  runTransaction,
} from 'firebase/firestore';

export interface Shop {
  id: string;
  ownerName: string;
  shopName: string;
  location: string;
  totalEmployees: number;
  nationalId: string;
  phone: string;
  email: string;
  businessType: string;
  createdAt: number;
  createdVia: 'whatsapp' | 'cyber';
  status: 'active' | 'suspended' | 'pending';
  firebaseUid?: string;
  lastLogin?: number;
  loginCount?: number;
  isAuthSetup?: boolean;
  paymentAccount?: any;
}

export interface StockRecord {
  quantity: number;
  unit: string;
  lastUpdated: number;
  updatedVia: 'whatsapp' | 'cyber';
  history: Array<{
    change: number;
    type: 'add' | 'sold' | 'edit';
    timestamp: number;
    amount?: number;
  }>;
}

export interface Stock {
  [productName: string]: StockRecord;
}

export interface Sale {
  id: string;
  shopId: string;
  productName: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  totalPrice: number;
  timestamp: number;
  createdVia: 'whatsapp' | 'cyber';
  userPhone: string;
}

export interface Expense {
  id: string;
  shopId: string;
  category: string;
  amount: number;
  timestamp: number;
  createdVia: 'whatsapp' | 'cyber';
  userPhone: string;
}

export interface DailySummary {
  shopId: string;
  dateCode: string;
  totalSales: number;
  totalExpenses: number;
  profit: number;
  transactionCount: number;
  lastUpdated: number;
}

/**
 * Search for a shop by shopId or national ID
 */
export const getShop = async (searchTerm: string): Promise<Shop | null> => {
  try {
    // First try to find by shopId
    const shopRef = doc(collection(db, 'shops'), searchTerm);
    const shopSnap = await getDoc(shopRef);

    if (shopSnap.exists()) {
      return {
        id: shopSnap.id,
        ...shopSnap.data(),
      } as Shop;
    }

    // Then try to find by national ID
    const q = query(
      collection(db, 'shops'),
      where('nationalId', '==', searchTerm)
    );

    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data(),
      } as Shop;
    }

    return null;
  } catch (error) {
    console.error('Error searching for shop:', error);
    throw error;
  }
};

/**
 * Generate date code in DDMMYYYY format
 * Example: November 24, 2025 → "24112025"
 */
export const generateDateCode = (date: Date = new Date()): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}${month}${year}`;
};

/**
 * Parse DDMMYYYY date code to Date object
 */
export const parseDateCode = (dateCode: string): Date => {
  const day = parseInt(dateCode.substring(0, 2), 10);
  const month = parseInt(dateCode.substring(2, 4), 10) - 1;
  const year = parseInt(dateCode.substring(4, 8), 10);
  return new Date(year, month, day);
};

/**
 * Add or update stock for a product
 * Stores in shops/{shopId}/stocks (single document for all products)
 * Uses atomic transaction for consistency
 */
export const addStock = async (
  shopId: string,
  productName: string,
  quantity: number,
  unit: string
): Promise<void> => {
  try {
    // ALWAYS use current time for transaction timestamp, never use filter date
    // Filter date is only for UI, not for recording actual transaction time
    const timestamp = Math.floor(Date.now() / 1000);
    const dateCode = generateDateCode();
    const normalizedProductName = productName.toLowerCase().trim();

    await runTransaction(db, async (transaction) => {
      const stockDocRef = doc(db, 'shops', shopId, 'stocks', 'inventory');
      const summaryDocRef = doc(db, 'shops', shopId, 'summaries', dateCode);

      const stockSnap = await transaction.get(stockDocRef);
      const summarySnap = await transaction.get(summaryDocRef);

      const stockData = stockSnap.exists() ? stockSnap.data() : {};

      if (!stockData[normalizedProductName]) {
        stockData[normalizedProductName] = {
          quantity: 0,
          unit,
          lastUpdated: timestamp,
          updatedVia: 'cyber',
          history: [],
        };
      }

      stockData[normalizedProductName].quantity += quantity;
      stockData[normalizedProductName].lastUpdated = timestamp;
      stockData[normalizedProductName].updatedVia = 'cyber';
      stockData[normalizedProductName].history.push({
        change: quantity,
        type: 'add',
        timestamp,
      });

      transaction.set(stockDocRef, stockData, { merge: true });

      // Update summary
      const summaryData = summarySnap.exists() ? summarySnap.data() : {
        shopId,
        dateCode,
        totalSales: 0,
        totalExpenses: 0,
        profit: 0,
        transactionCount: 0,
        lastUpdated: timestamp,
      };
      summaryData.lastUpdated = timestamp;
      transaction.set(summaryDocRef, summaryData, { merge: true });
    });
  } catch (error) {
    console.error('Error adding stock:', error);
    throw error;
  }
};

/**
 * Record a sale
 * Stores in shops/{shopId}/sales/{dateCode}/transactions/{saleId}
 * Also updates stock and daily summary atomically
 */
export const recordSale = async (
  shopId: string,
  productName: string,
  quantity: number,
  unit: string,
  pricePerUnit: number,
  userPhone: string
): Promise<Sale> => {
  try {
    const totalPrice = quantity * pricePerUnit;
    // ALWAYS use current time for transaction timestamp, never use filter date
    // Filter date is only for UI, not for recording actual transaction time
    const timestamp = Math.floor(Date.now() / 1000);
    const dateCode = generateDateCode();
    const saleId = `${timestamp}_${Math.random().toString(36).substr(2, 9)}`;

    const sale: Sale = {
      id: saleId,
      shopId,
      productName: productName.toLowerCase().trim(),
      quantity,
      unit,
      pricePerUnit,
      totalPrice,
      timestamp,
      createdVia: 'cyber',
      userPhone,
    };

    // Atomic transaction: update sales, stock, and summary
    await runTransaction(db, async (transaction) => {
      const salesDocRef = doc(db, 'shops', shopId, 'sales', dateCode);
      const stockDocRef = doc(db, 'shops', shopId, 'stocks', 'inventory');
      const summaryDocRef = doc(db, 'shops', shopId, 'summaries', dateCode);

      // Read current data
      const salesSnap = await transaction.get(salesDocRef);
      const stockSnap = await transaction.get(stockDocRef);
      const summarySnap = await transaction.get(summaryDocRef);

      // Update sales - add to transactions map
      const salesData = salesSnap.exists() ? salesSnap.data() : { transactions: {} };
      salesData.transactions[saleId] = sale;
      transaction.set(salesDocRef, salesData, { merge: true });

      // Update stock - decrease quantity
      const stockData = stockSnap.exists() ? stockSnap.data() : {};
      if (stockData[sale.productName]) {
        const newQuantity = Math.max(0, stockData[sale.productName].quantity - quantity);
        stockData[sale.productName].quantity = newQuantity;
        stockData[sale.productName].lastUpdated = timestamp;
        if (!stockData[sale.productName].history) {
          stockData[sale.productName].history = [];
        }
        stockData[sale.productName].history.push({
          change: -quantity,
          type: 'sold',
          timestamp,
          amount: totalPrice,
        });
      }
      transaction.set(stockDocRef, stockData, { merge: true });

      // Update summary
      const summaryData = summarySnap.exists() ? summarySnap.data() : {
        shopId,
        dateCode,
        totalSales: 0,
        totalExpenses: 0,
        profit: 0,
        transactionCount: 0,
        lastUpdated: timestamp,
      };
      summaryData.totalSales = (summaryData.totalSales || 0) + totalPrice;
      summaryData.profit = summaryData.totalSales - summaryData.totalExpenses;
      summaryData.transactionCount = (summaryData.transactionCount || 0) + 1;
      summaryData.lastUpdated = timestamp;
      transaction.set(summaryDocRef, summaryData, { merge: true });
    });

    return sale;
  } catch (error) {
    console.error('Error recording sale:', error);
    throw error;
  }
};

/**
 * Record an expense
 * Stores in shops/{shopId}/expenses/{dateCode}/transactions/{expenseId}
 * Also updates daily summary atomically
 */
export const recordExpense = async (
  shopId: string,
  category: string,
  amount: number,
  userPhone: string
): Promise<Expense> => {
  try {
    // ALWAYS use current time for transaction timestamp, never use filter date
    // Filter date is only for UI, not for recording actual transaction time
    const timestamp = Math.floor(Date.now() / 1000);
    const dateCode = generateDateCode();
    const expenseId = `${timestamp}_${Math.random().toString(36).substr(2, 9)}`;

    const expense: Expense = {
      id: expenseId,
      shopId,
      category: category.toLowerCase().trim(),
      amount: Math.floor(amount),
      timestamp,
      createdVia: 'cyber',
      userPhone,
    };

    // Atomic transaction: update expenses and summary
    await runTransaction(db, async (transaction) => {
      const expensesDocRef = doc(db, 'shops', shopId, 'expenses', dateCode);
      const summaryDocRef = doc(db, 'shops', shopId, 'summaries', dateCode);

      // Read current data
      const expensesSnap = await transaction.get(expensesDocRef);
      const summarySnap = await transaction.get(summaryDocRef);

      // Update expenses - add to transactions map
      const expensesData = expensesSnap.exists() ? expensesSnap.data() : { transactions: {} };
      expensesData.transactions[expenseId] = expense;
      transaction.set(expensesDocRef, expensesData, { merge: true });

      // Update summary
      const summaryData = summarySnap.exists() ? summarySnap.data() : {
        shopId,
        dateCode,
        totalSales: 0,
        totalExpenses: 0,
        profit: 0,
        transactionCount: 0,
        lastUpdated: timestamp,
      };
      summaryData.totalExpenses = (summaryData.totalExpenses || 0) + expense.amount;
      summaryData.profit = summaryData.totalSales - summaryData.totalExpenses;
      summaryData.transactionCount = (summaryData.transactionCount || 0) + 1;
      summaryData.lastUpdated = timestamp;
      transaction.set(summaryDocRef, summaryData, { merge: true });
    });

    return expense;
  } catch (error) {
    console.error('Error recording expense:', error);
    throw error;
  }
};

/**
 * Get sales for a date range
 * Sales are stored in shops/{shopId}/sales/{dateCode}/transactions/{saleId}
 */
export const getSales = async (
  shopId: string,
  startDate?: string,
  endDate?: string
): Promise<Sale[]> => {
  try {
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date();

    const sales: Sale[] = [];

    // Iterate through each day in the date range
    const current = new Date(start);
    while (current <= end) {
      const dateCode = generateDateCode(current);

      try {
        const salesRef = doc(db, 'shops', shopId, 'sales', dateCode);
        const salesSnap = await getDoc(salesRef);

        if (salesSnap.exists()) {
          const transactions = salesSnap.data()?.transactions || {};
          // Convert transactions object to array
          Object.entries(transactions).forEach(([_, transaction]: [string, any]) => {
            sales.push({
              id: transaction.id,
              shopId: transaction.shopId,
              productName: transaction.productName,
              quantity: transaction.quantity,
              unit: transaction.unit,
              pricePerUnit: transaction.pricePerUnit,
              totalPrice: transaction.totalPrice,
              timestamp: transaction.timestamp,
              createdVia: transaction.createdVia,
              userPhone: transaction.userPhone,
            } as Sale);
          });
        }
      } catch (err) {
        // Continue to next day if this day has no data
      }

      current.setDate(current.getDate() + 1);
    }

    return sales.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('Error fetching sales:', error);
    throw error;
  }
};

/**
 * Get expenses for a date range
 * Expenses are stored in shops/{shopId}/expenses/{dateCode}/transactions/{expenseId}
 */
export const getExpenses = async (
  shopId: string,
  startDate?: string,
  endDate?: string
): Promise<Expense[]> => {
  try {
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date();

    const expenses: Expense[] = [];

    // Iterate through each day in the date range
    const current = new Date(start);
    while (current <= end) {
      const dateCode = generateDateCode(current);

      try {
        const expensesRef = doc(db, 'shops', shopId, 'expenses', dateCode);
        const expensesSnap = await getDoc(expensesRef);

        if (expensesSnap.exists()) {
          const transactions = expensesSnap.data()?.transactions || {};
          // Convert transactions object to array
          Object.entries(transactions).forEach(([_, transaction]: [string, any]) => {
            expenses.push({
              id: transaction.id,
              shopId: transaction.shopId,
              category: transaction.category,
              amount: transaction.amount,
              timestamp: transaction.timestamp,
              createdVia: transaction.createdVia,
              userPhone: transaction.userPhone,
            } as Expense);
          });
        }
      } catch (err) {
        // Continue to next day if this day has no data
      }

      current.setDate(current.getDate() + 1);
    }

    return expenses.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    throw error;
  }
};

/**
 * Get current stock for a shop
 * Stock is stored in shops/{shopId}/stocks (single document)
 * Format: {productName: {quantity, unit, lastUpdated, history}}
 */
export const getCurrentStock = async (shopId: string): Promise<Stock> => {
  try {
    const stockRef = doc(db, 'shops', shopId, 'stocks', 'inventory');
    const stockSnap = await getDoc(stockRef);

    if (stockSnap.exists()) {
      const data = stockSnap.data();
      // Filter out internal fields and return only product data
      const stock: Stock = {};
      Object.entries(data).forEach(([key, value]) => {
        if (key !== '__timestamp__' && typeof value === 'object' && value.quantity !== undefined) {
          stock[key] = value as any;
        }
      });
      return stock;
    }

    return {};
  } catch (error) {
    console.error('Error fetching current stock:', error);
    throw error;
  }
};

/**
 * Get daily summary for a date (returns with date string for compatibility)
 */
export const getDailySummary = async (
  shopId: string,
  date: string
): Promise<{
  shopId: string;
  date: string;
  totalSales: number;
  totalExpenses: number;
  profit: number;
  transactionCount: number;
}> => {
  try {
    const sales = await getSales(shopId, date, date);
    const expenses = await getExpenses(shopId, date, date);

    const totalSales = sales.reduce((sum, sale) => sum + sale.totalPrice, 0);
    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const profit = totalSales - totalExpenses;

    return {
      shopId,
      date,
      totalSales,
      totalExpenses,
      profit,
      transactionCount: sales.length + expenses.length,
    };
  } catch (error) {
    console.error('Error calculating daily summary:', error);
    throw error;
  }
};

/**
 * Get stock for a specific date
 * Since stock is now in a single document, this returns current stock
 * (stock is maintained per product, not per date)
 */
export const getStockForDate = async (shopId: string, _date: string): Promise<Stock> => {
  try {
    const stockRef = doc(db, 'shops', shopId, 'stocks', 'inventory');
    const stockSnap = await getDoc(stockRef);

    if (stockSnap.exists()) {
      const data = stockSnap.data();
      const stock: Stock = {};
      Object.entries(data).forEach(([key, value]) => {
        if (key !== '__timestamp__' && typeof value === 'object' && value.quantity !== undefined) {
          stock[key] = value as StockRecord;
        }
      });
      return stock;
    }

    return {};
  } catch (error) {
    console.error('Error fetching stock:', error);
    throw error;
  }
};

/**
 * Get summaries for a date range
 */
export const getSummaries = async (
  shopId: string,
  startDate?: string,
  endDate?: string
): Promise<DailySummary[]> => {
  try {
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date();

    const summaries: DailySummary[] = [];

    // Iterate through each day in the date range
    const current = new Date(start);
    while (current <= end) {
      const dateCode = generateDateCode(current);

      try {
        const summaryRef = doc(db, 'shops', shopId, 'summaries', dateCode);
        const summarySnap = await getDoc(summaryRef);

        if (summarySnap.exists()) {
          const data = summarySnap.data();
          summaries.push({
            shopId: data.shopId,
            dateCode: data.dateCode,
            totalSales: data.totalSales || 0,
            totalExpenses: data.totalExpenses || 0,
            profit: data.profit || 0,
            transactionCount: data.transactionCount || 0,
            lastUpdated: data.lastUpdated || 0,
          } as DailySummary);
        }
      } catch (err) {
        // Continue to next day if this day has no summary
      }

      current.setDate(current.getDate() + 1);
    }

    return summaries.sort((a, b) => {
      const dateA = parseDateCode(a.dateCode).getTime();
      const dateB = parseDateCode(b.dateCode).getTime();
      return dateB - dateA;
    });
  } catch (error) {
    console.error('Error fetching summaries:', error);
    throw error;
  }
};

/**
 * Delete a sale
 * Requires dateCode parameter to locate the sale in the nested structure
 */
export const deleteSale = async (shopId: string, dateCode: string, saleId: string): Promise<void> => {
  try {
    const salesDocRef = doc(db, 'shops', shopId, 'sales', dateCode);
    const salesSnap = await getDoc(salesDocRef);

    if (salesSnap.exists()) {
      const salesData = salesSnap.data();
      if (salesData.transactions && salesData.transactions[saleId]) {
        delete salesData.transactions[saleId];
        await setDoc(salesDocRef, salesData, { merge: true });
      }
    }
  } catch (error) {
    console.error('Error deleting sale:', error);
    throw error;
  }
};

/**
 * Delete an expense
 * Requires dateCode parameter to locate the expense in the nested structure
 */
export const deleteExpense = async (shopId: string, dateCode: string, expenseId: string): Promise<void> => {
  try {
    const expensesDocRef = doc(db, 'shops', shopId, 'expenses', dateCode);
    const expensesSnap = await getDoc(expensesDocRef);

    if (expensesSnap.exists()) {
      const expensesData = expensesSnap.data();
      if (expensesData.transactions && expensesData.transactions[expenseId]) {
        delete expensesData.transactions[expenseId];
        await setDoc(expensesDocRef, expensesData, { merge: true });
      }
    }
  } catch (error) {
    console.error('Error deleting expense:', error);
    throw error;
  }
};
