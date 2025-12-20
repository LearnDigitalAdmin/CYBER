/**
 * Shop Types
 * Defines interfaces for shop management
 */

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
  createdAt: number; // timestamp
  createdVia: 'whatsapp' | 'cyber';
  status: 'active' | 'suspended' | 'pending';
  firebaseUid?: string;
  // Auth metadata
  authCreatedAt?: number; // timestamp when auth account was created
  authEmail?: string; // email used for Firebase Auth
  // Additional metadata
  lastLogin?: number; // last login timestamp
  loginCount?: number; // total login count
  isAuthSetup?: boolean; // whether auth account is fully set up
  // Payment account
  paymentAccount?: PaymentAccount; // Payment details for STK push
}

export interface ShopCreateInput {
  ownerName: string;
  shopName: string;
  location: string;
  totalEmployees: number;
  nationalId: string;
  phone: string;
  email: string;
  businessType: string;
}

/**
 * Shop Command Types
 * Handles quick command-based transactions (sales, expenses, stock)
 */

export type CommandType = 'sold' | 'paid' | 'add' | 'edit';
export type TransactionUnit = 'kg' | 'pieces' | 'liters' | 'amount';

export interface ParsedCommand {
  type: CommandType;
  productName: string;
  quantity: number;
  unit: TransactionUnit;
  pricePerUnit?: number; // For sales only
  totalPrice?: number; // Calculated for sales
  rawInput: string;
}

export interface CommandValidation {
  valid: boolean;
  error?: string;
  command?: ParsedCommand;
}

export interface StockRecord {
  quantity: number;
  unit: TransactionUnit;
  lastUpdated: number; // timestamp
  updatedVia: 'whatsapp' | 'cyber';
  history?: StockChange[];
}

export interface StockChange {
  change: number;
  type: 'add' | 'sold' | 'edit';
  timestamp: number;
  amount?: number; // For sales
}

export interface SaleRecord {
  id: string;
  shopId: string;
  productName: string;
  quantity: number;
  unit: TransactionUnit;
  pricePerUnit: number;
  totalPrice: number;
  timestamp: number;
  createdVia: 'whatsapp' | 'cyber';
  userPhone: string;
}

export interface ExpenseRecord {
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
  dateCode: string; // DDMMYYYY format
  totalSales: number; // Total revenue
  totalExpenses: number;
  profit: number;
  stockMovement: {
    added: Record<string, number>;
    sold: Record<string, number>;
  };
  transactionCount: number;
  lastUpdated: number;
}

/**
 * Payment Types
 * Handles payment accounts and transactions
 */

export type PaymentMethod = 'mpesa' | 'airtel' | 'bank';
export type PaymentNetwork = 'safaricom' | 'airtel';
export type PaymentStatus = 'pending' | 'active' | 'success' | 'failed';

export interface MpesaAccount {
  paybillOrTill: string; // Paybill number or Till number
  accountNumber: string; // Account/Reference number
  reference?: string; // Optional reference text
}

export interface AirtelAccount {
  businessNumber: string; // Airtel business number
  accountDetails: string; // Account holder name or details
}

export interface BankAccount {
  bankName: string; // e.g., KCB, Equity, Standard Chartered
  branch: string; // Branch location
  accountNumber: string; // Account number
}

export interface PaymentAccount {
  type: PaymentMethod;
  mpesa?: MpesaAccount;
  airtel?: AirtelAccount;
  bank?: BankAccount;
  paystackSubaccountId: string; // Paystack subaccount ID (split codes created automatically)
  createdAt: number; // timestamp
  updatedAt: number; // timestamp
}

export interface PaymentSetupRequest {
  id: string;
  shopId: string;
  shopName: string;
  ownerName: string;
  ownerPhone: string;
  paymentMethod: PaymentMethod;
  paymentDetails: MpesaAccount | AirtelAccount | BankAccount;
  createdAt: number; // timestamp
  status: 'pending' | 'approved' | 'rejected';
  approvedAt?: number;
  rejectionReason?: string;
  notes?: string;
}

export interface PaymentTransaction {
  id: string;
  shopId: string;
  amount: number;
  customerPhone: string;
  network: PaymentNetwork;
  transactionId: string; // Paystack reference
  timestamp: number;
  status: PaymentStatus;
  createdVia: 'whatsapp' | 'cyber';
  webhookData?: Record<string, any>; // Paystack webhook data
}

export interface CachedSplitCode {
  shopId: string;
  splitCode: string;
  subaccountId: string;
  commissionRate: number; // Platform commission percentage (1.5%)
  createdAt: number; // timestamp
  updatedAt: number; // timestamp
}
