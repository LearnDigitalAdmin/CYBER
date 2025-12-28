/**
 * Shop Transaction Service
 * Handles all Firestore operations for sales, expenses, and stock management
 * Ensures atomic operations and data consistency
 */

import { db } from '../config/firebase.config';
import {
  ParsedCommand,
  SaleRecord,
  ExpenseRecord,
  StockRecord,
  DailySummary,
} from '../types/shop.types';
import { logger } from '../utils/logger';

const SHOPS_COLLECTION = 'shops';

/**
 * Generate date code in DDMMYYYY format
 */
export function generateDateCode(date: Date = new Date()): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}${month}${year}`;
}

/**
 * Record a sale transaction and update stock
 * Uses transaction for atomicity
 */
export async function recordSale(
  shopId: string,
  parsed: ParsedCommand,
  userPhone: string
): Promise<{
  success: boolean;
  saleId?: string;
  stockBefore?: number;
  stockAfter?: number;
  error?: string;
}> {
  if (parsed.type !== 'sold' || !parsed.totalPrice || !parsed.pricePerUnit) {
    return {
      success: false,
      error: 'Invalid sale command',
    };
  }

  try {
    const dateCode = generateDateCode();
    const timestamp = Math.floor(Date.now() / 1000);
    const saleId = `${timestamp}_${Math.random().toString(36).substr(2, 9)}`;

    // Prepare sale record
    const saleRecord: SaleRecord = {
      id: saleId,
      shopId,
      productName: parsed.productName,
      quantity: parsed.quantity,
      unit: parsed.unit,
      pricePerUnit: parsed.pricePerUnit,
      totalPrice: parsed.totalPrice,
      timestamp,
      createdVia: 'whatsapp',
      userPhone,
    };

    // Use transaction for atomicity
    try {
      const saleDocRef = db
        .collection(SHOPS_COLLECTION)
        .doc(shopId)
        .collection('sales')
        .doc(dateCode);

      const stockDocRef = db
        .collection(SHOPS_COLLECTION)
        .doc(shopId)
        .collection('stocks').doc('inventory');

      const summaryDocRef = db
        .collection(SHOPS_COLLECTION)
        .doc(shopId)
        .collection('summaries')
        .doc(dateCode);

      const result = await db.runTransaction(async (transaction) => {
        // ALL READS FIRST
        const saleDoc = await transaction.get(saleDocRef);
        const stockDoc = await transaction.get(stockDocRef);
        const summaryDoc = await transaction.get(summaryDocRef);

        // Process reads
        const currentSales = saleDoc.exists ? (saleDoc.data()?.transactions ?? {}) : {};
        const stockData = stockDoc.exists ? (stockDoc.data() || {}) : {};
        const currentStock = stockData[parsed.productName] as StockRecord | undefined;
        const stockBefore = currentStock?.quantity ?? 0;
        const stockAfter = Math.max(0, stockBefore - parsed.quantity);
        const currentSummary = summaryDoc.exists
          ? (summaryDoc.data() as DailySummary)
          : null;

        // Calculate sale update
        const updatedSales = {
          ...currentSales,
          [saleId]: saleRecord
        };

        // Update stock (use merge to avoid overwriting other products)
        const newStockRecord: StockRecord = {
          quantity: stockAfter,
          unit: parsed.unit,
          lastUpdated: timestamp,
          updatedVia: 'whatsapp',
          history: [
            ...(currentStock?.history ?? []),
            {
              change: -parsed.quantity,
              type: 'sold',
              timestamp,
              amount: parsed.totalPrice ?? 0,
            },
          ],
        };

        // Calculate summary update
        const updatedSummary: DailySummary = {
          shopId,
          dateCode,
          totalSales: (currentSummary?.totalSales ?? 0) + (parsed.totalPrice ?? 0),
          totalExpenses: currentSummary?.totalExpenses ?? 0,
          profit: (currentSummary?.totalSales ?? 0) + (parsed.totalPrice ?? 0) - (currentSummary?.totalExpenses ?? 0),
          stockMovement: {
            added: currentSummary?.stockMovement?.added ?? {},
            sold: {
              ...(currentSummary?.stockMovement?.sold ?? {}),
              [parsed.productName]: (currentSummary?.stockMovement?.sold?.[parsed.productName] ?? 0) + parsed.quantity,
            },
          },
          transactionCount: (currentSummary?.transactionCount ?? 0) + 1,
          lastUpdated: timestamp,
        };

        // ALL WRITES LAST
        transaction.set(saleDocRef, { transactions: updatedSales }, { merge: true });
        transaction.set(
          stockDocRef,
          {
            [parsed.productName]: newStockRecord,
          },
          { merge: true }
        );
        transaction.set(summaryDocRef, updatedSummary);

        return {
          success: true,
          saleId,
          stockBefore,
          stockAfter,
        };
      });

      logger.info('Sale recorded successfully', {
        shopId,
        saleId,
        product: parsed.productName,
        quantity: parsed.quantity,
        totalPrice: parsed.totalPrice,
        stockBefore: result.stockBefore,
        stockAfter: result.stockAfter,
      });

      return result;
    } catch (transactionError) {
      logger.error('Failed to record sale in transaction', { shopId, product: parsed.productName, error: transactionError });
      return {
        success: false,
        error: 'Failed to record sale',
      };
    }
  } catch (error) {
    logger.error('Failed to record sale', { shopId, product: parsed.productName, error });
    return {
      success: false,
      error: 'Failed to record sale',
    };
  }
}

/**
 * Record an expense transaction
 */
export async function recordExpense(
  shopId: string,
  parsed: ParsedCommand,
  userPhone: string
): Promise<{
  success: boolean;
  expenseId?: string;
  error?: string;
}> {
  if (parsed.type !== 'paid' || parsed.quantity <= 0) {
    return {
      success: false,
      error: 'Invalid expense command',
    };
  }

  try {
    const dateCode = generateDateCode();
    const timestamp = Math.floor(Date.now() / 1000);
    const expenseId = `${timestamp}_${Math.random().toString(36).substr(2, 9)}`;

    // Prepare expense record
    const expenseRecord: ExpenseRecord = {
      id: expenseId,
      shopId,
      category: parsed.productName,
      amount: Math.floor(parsed.quantity),
      timestamp,
      createdVia: 'whatsapp',
      userPhone,
    };

    // Use transaction for atomicity
    try {
      // Simpler approach without nested transaction
      const expenseDocRef = db
        .collection(SHOPS_COLLECTION)
        .doc(shopId)
        .collection('expenses')
        .doc(dateCode);

      const summaryDocRef = db
        .collection(SHOPS_COLLECTION)
        .doc(shopId)
        .collection('summaries')
        .doc(dateCode);

      const result = await db.runTransaction(async (transaction) => {
        // ALL READS FIRST
        const expenseDoc = await transaction.get(expenseDocRef);
        const summaryDoc = await transaction.get(summaryDocRef);

        // Process reads
        const currentExpenses = expenseDoc.exists ? (expenseDoc.data()?.transactions ?? {}) : {};
        const currentSummary = summaryDoc.exists
          ? (summaryDoc.data() as DailySummary)
          : null;

        // Calculate updates
        const updatedExpenses = {
          ...currentExpenses,
          [expenseId]: expenseRecord
        };

        const expenseAmount = Math.floor(parsed.quantity);
        const totalExpenses = (currentSummary?.totalExpenses ?? 0) + expenseAmount;
        const totalSales = currentSummary?.totalSales ?? 0;

        const updatedSummary: DailySummary = {
          shopId,
          dateCode,
          totalSales,
          totalExpenses,
          profit: totalSales - totalExpenses,
          stockMovement: currentSummary?.stockMovement ?? { added: {}, sold: {} },
          transactionCount: (currentSummary?.transactionCount ?? 0) + 1,
          lastUpdated: timestamp,
        };

        // ALL WRITES LAST
        transaction.set(expenseDocRef, { transactions: updatedExpenses }, { merge: true });
        transaction.set(summaryDocRef, updatedSummary);

        return {
          success: true,
          expenseId,
        };
      });

      logger.info('Expense recorded successfully', {
        shopId,
        expenseId,
        category: parsed.productName,
        amount: parsed.quantity,
      });

      return result;
    } catch (transactionError) {
      const errorMsg = transactionError instanceof Error ? transactionError.message : String(transactionError);
      logger.error('Failed to record expense in transaction', {
        shopId,
        category: parsed.productName,
        errorMsg,
        errorCode: (transactionError as any).code,
        errorDetails: (transactionError as any).details
      });
      return {
        success: false,
        error: 'Failed to record expense',
      };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('Failed to record expense', {
      shopId,
      category: parsed.productName,
      errorMsg,
      errorCode: (error as any).code
    });
    return {
      success: false,
      error: 'Failed to record expense',
    };
  }
}

/**
 * Add stock (new or increment existing)
 */
export async function addStock(
  shopId: string,
  parsed: ParsedCommand,
  userPhone: string
): Promise<{
  success: boolean;
  stockAfter?: number;
  error?: string;
}> {
  if (parsed.type !== 'add' || parsed.quantity <= 0) {
    return {
      success: false,
      error: 'Invalid add command',
    };
  }

  try {
    const dateCode = generateDateCode();
    const timestamp = Math.floor(Date.now() / 1000);

    const stockDocRef = db
      .collection(SHOPS_COLLECTION)
      .doc(shopId)
      .collection('stocks').doc('inventory');

    const summaryDocRef = db
      .collection(SHOPS_COLLECTION)
      .doc(shopId)
      .collection('summaries')
      .doc(dateCode);

    // Use transaction for atomicity
    const result = await db.runTransaction(async (transaction) => {
      // READ FIRST
      const stockDoc = await transaction.get(stockDocRef);
      const summaryDoc = await transaction.get(summaryDocRef);

      const stockData = stockDoc.exists ? (stockDoc.data() || {}) : {};
      const currentStock = stockData[parsed.productName] as StockRecord | undefined;
      const stockBefore = currentStock?.quantity ?? 0;
      const stockAfter = stockBefore + parsed.quantity;

      const currentSummary = summaryDoc.exists
        ? (summaryDoc.data() as DailySummary)
        : null;

      // CALCULATE
      const newStockRecord: StockRecord = {
        quantity: stockAfter,
        unit: parsed.unit,
        lastUpdated: timestamp,
        updatedVia: 'whatsapp',
        history: [
          ...(currentStock?.history ?? []),
          {
            change: parsed.quantity,
            type: 'add',
            timestamp,
          },
        ],
      };

      const updatedSummary: DailySummary = {
        shopId,
        dateCode,
        totalSales: currentSummary?.totalSales ?? 0,
        totalExpenses: currentSummary?.totalExpenses ?? 0,
        profit: (currentSummary?.totalSales ?? 0) - (currentSummary?.totalExpenses ?? 0),
        stockMovement: {
          added: {
            ...(currentSummary?.stockMovement?.added ?? {}),
            [parsed.productName]: (currentSummary?.stockMovement?.added?.[parsed.productName] ?? 0) + parsed.quantity,
          },
          sold: currentSummary?.stockMovement?.sold ?? {},
        },
        transactionCount: (currentSummary?.transactionCount ?? 0) + 1,
        lastUpdated: timestamp,
      };

      // WRITE LAST
      transaction.set(
        stockDocRef,
        {
          [parsed.productName]: newStockRecord,
        },
        { merge: true }
      );
      transaction.set(summaryDocRef, updatedSummary);

      return {
        success: true,
        stockBefore,
        stockAfter,
      };
    });

    logger.info('Stock added successfully', {
      shopId,
      product: parsed.productName,
      quantity: parsed.quantity,
      stockBefore: result.stockBefore,
      stockAfter: result.stockAfter,
    });

    return result;
  } catch (error) {
    logger.error('Failed to add stock', { shopId, product: parsed.productName, error });
    return {
      success: false,
      error: 'Failed to add stock',
    };
  }
}

/**
 * Edit stock (adjust by amount or set absolute value)
 * Negative values reduce stock, positive increase it
 */
export async function editStock(
  shopId: string,
  parsed: ParsedCommand,
  userPhone: string
): Promise<{
  success: boolean;
  stockBefore?: number;
  stockAfter?: number;
  error?: string;
}> {
  if (parsed.type !== 'edit' || parsed.quantity === 0) {
    return {
      success: false,
      error: 'Invalid edit command',
    };
  }

  try {
    const dateCode = generateDateCode();
    const timestamp = Math.floor(Date.now() / 1000);

    const stockDocRef = db
      .collection(SHOPS_COLLECTION)
      .doc(shopId)
      .collection('stocks').doc('inventory');

    const summaryDocRef = db
      .collection(SHOPS_COLLECTION)
      .doc(shopId)
      .collection('summaries')
      .doc(dateCode);

    // Use transaction for atomicity
    const result = await db.runTransaction(async (transaction) => {
      // READ FIRST
      const stockDoc = await transaction.get(stockDocRef);
      const summaryDoc = await transaction.get(summaryDocRef);

      const stockData = stockDoc.exists ? (stockDoc.data() || {}) : {};
      const currentStock = stockData[parsed.productName] as StockRecord | undefined;
      const stockBefore = currentStock?.quantity ?? 0;
      const stockAfter = Math.max(0, stockBefore + parsed.quantity);

      // Warn if going below 0
      if (stockAfter < 0 && stockBefore + parsed.quantity < 0) {
        logger.warn('Stock adjustment would go negative', {
          shopId,
          product: parsed.productName,
          stockBefore,
          change: parsed.quantity,
        });
      }

      const currentSummary = summaryDoc.exists
        ? (summaryDoc.data() as DailySummary)
        : null;

      // CALCULATE
      const newStockRecord: StockRecord = {
        quantity: stockAfter,
        unit: parsed.unit,
        lastUpdated: timestamp,
        updatedVia: 'whatsapp',
        history: [
          ...(currentStock?.history ?? []),
          {
            change: parsed.quantity,
            type: 'edit',
            timestamp,
          },
        ],
      };

      const updatedSummary: DailySummary = {
        shopId,
        dateCode,
        totalSales: currentSummary?.totalSales ?? 0,
        totalExpenses: currentSummary?.totalExpenses ?? 0,
        profit: (currentSummary?.totalSales ?? 0) - (currentSummary?.totalExpenses ?? 0),
        stockMovement: currentSummary?.stockMovement ?? { added: {}, sold: {} },
        transactionCount: (currentSummary?.transactionCount ?? 0) + 1,
        lastUpdated: timestamp,
      };

      // WRITE LAST
      transaction.set(
        stockDocRef,
        {
          [parsed.productName]: newStockRecord,
        },
        { merge: true }
      );
      transaction.set(summaryDocRef, updatedSummary);

      return {
        success: true,
        stockBefore,
        stockAfter,
      };
    });

    logger.info('Stock edited successfully', {
      shopId,
      product: parsed.productName,
      change: parsed.quantity,
      stockBefore: result.stockBefore,
      stockAfter: result.stockAfter,
    });

    return result;
  } catch (error) {
    logger.error('Failed to edit stock', { shopId, product: parsed.productName, error });
    return {
      success: false,
      error: 'Failed to edit stock',
    };
  }
}

/**
 * Get current stock for a product
 */
export async function getProductStock(shopId: string, productName: string): Promise<number> {
  try {
    const stockDocRef = db
      .collection(SHOPS_COLLECTION)
      .doc(shopId)
      .collection('stocks').doc('inventory');

    const stockDoc = await stockDocRef.get();
    if (!stockDoc.exists) {
      return 0;
    }

    const stockData = stockDoc.data() || {};
    const stock = stockData[productName] as StockRecord | undefined;
    return stock?.quantity ?? 0;
  } catch (error) {
    logger.error('Failed to get product stock', { shopId, productName, error });
    return 0;
  }
}

/**
 * Get daily summary
 */
export async function getDailySummary(shopId: string, dateCode?: string): Promise<DailySummary | null> {
  try {
    const code = dateCode ?? generateDateCode();
    const summaryDoc = await db
      .collection(SHOPS_COLLECTION)
      .doc(shopId)
      .collection('summaries')
      .doc(code)
      .get();

    if (!summaryDoc.exists) {
      return null;
    }

    return summaryDoc.data() as DailySummary;
  } catch (error) {
    logger.error('Failed to get daily summary', { shopId, dateCode, error });
    return null;
  }
}

/**
 * Get all products with current stock
 */
export async function getAllProductsStock(shopId: string): Promise<Record<string, StockRecord>> {
  try {
    const stockDoc = await db
      .collection(SHOPS_COLLECTION)
      .doc(shopId)
      .collection('stocks').doc('inventory')
      .get();

    if (!stockDoc.exists) {
      return {};
    }

    const allStocks = stockDoc.data() || {};
    // Filter out any non-stock entries
    const result: Record<string, StockRecord> = {};
    for (const [key, value] of Object.entries(allStocks)) {
      if (typeof value === 'object' && value !== null && 'quantity' in value) {
        result[key] = value as StockRecord;
      }
    }
    return result;
  } catch (error) {
    logger.error('Failed to get all products stock', { shopId, error });
    return {};
  }
}