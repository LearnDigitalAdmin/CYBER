/**
 * Session Types
 * Defines interfaces for WhatsApp conversation sessions
 */

export interface Session {
  phone: string;
  language: 'en' | 'sw';
  currentState: string;
  context: Record<string, any>;
  lastActive: number; // timestamp
  createdAt: number; // timestamp
}

export interface SessionContext {
  ownerName?: string;
  shopName?: string;
  nationalId?: string;
  shopPhone?: string;
  businessType?: string;
  saleAmount?: number;
  paymentMethod?: string;
  saleDescription?: string;
  expenseAmount?: number;
  expenseCategory?: string;
  expenseDescription?: string;
  tenantId?: string;
  rentAmount?: number;
  propertyDetails?: Record<string, any>;
  billAmount?: number;
  billPayer?: string;
  billReceiver?: string;
  [key: string]: any;
}
