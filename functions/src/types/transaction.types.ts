/**
 * Transaction Types
 * Defines interfaces for shop transactions
 */

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  paymentMethod?: string;
  description?: string;
  date: number; // timestamp
  createdVia: 'whatsapp' | 'cyber';
  userPhone: string;
}

export interface Report {
  id: string;
  period: 'daily' | 'weekly' | 'monthly';
  startDate: number;
  endDate: number;
  totalIncome: number;
  totalExpenses: number;
  profit: number;
  transactionCount: number;
  generatedAt: number;
}

export interface DailySummary {
  date: string;
  totalIncome: number;
  totalExpenses: number;
  profit: number;
  transactionCount: number;
}
