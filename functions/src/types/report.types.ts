/**
 * Report Types
 * Defines interfaces for weekly and monthly reports
 */

export type ReportPeriod = 'weekly' | 'monthly';
export type ReportDateRange = 'last7days' | 'last30days';

export interface ReportMetadata {
  id: string;
  shopId: string;
  period: ReportPeriod;
  dateRange: ReportDateRange;
  startDate: string; // DDMMYYYY format
  endDate: string; // DDMMYYYY format
  startDateTimestamp: number;
  endDateTimestamp: number;
  generatedAt: number;
  generatedBy: string; // phone number
  downloadUrl: string;
  fileSize: number;
  cloudStoragePath: string;
}

export interface ReportData {
  shopName: string;
  ownerName: string;
  phone: string;
  email: string;
  location: string;
  businessType: string;
  reportPeriod: ReportPeriod;
  startDate: string;
  endDate: string;
  totalSales: number;
  totalExpenses: number;
  profit: number;
  transactionCount: number;
  salesCount: number;
  expenseCount: number;
  averageSaleValue: number;
  topProducts: Array<{
    name: string;
    quantity: number;
    revenue: number;
  }>;
  lowMovingProducts: Array<{
    name: string;
    quantity: number;
    revenue: number;
  }>;
  expenseBreakdown: Record<string, number>;
  dailyData: Array<{
    date: string;
    sales: number;
    expenses: number;
    profit: number;
    transactionCount: number;
  }>;
  weeklyTotals?: Array<{
    week: string;
    sales: number;
    expenses: number;
    profit: number;
  }>;
}

export interface GenerateReportRequest {
  shopId: string;
  period: ReportPeriod;
  dateRange: ReportDateRange;
  userPhone: string;
}

export interface GenerateReportResponse {
  success: boolean;
  reportId?: string;
  downloadUrl?: string;
  error?: string;
  message?: string;
}

export interface ReportListResponse {
  reports: ReportMetadata[];
  hasMore: boolean;
}
