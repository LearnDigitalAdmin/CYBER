import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { doc, getFirestore, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyD1hg7YLv08vyR2kSWi2ymxSu2pYCRwPq8",
  authDomain: "plot-9fd6e.firebaseapp.com",
  projectId: "plot-9fd6e",
  storageBucket: "plot-9fd6e.firebasestorage.app",
  messagingSenderId: "1037620305589",
  appId: "1:1037620305589:web:2672a7dcaeca4c46b068fc",
  measurementId: "G-B90H3GJFPM"
};

export interface Invoice {
  id: string | number;
  userId?: string;
  localId: number;
  tenantId: number;
  propertyId: number;
  assetId: string;
  billingMonth: string;
  rentAmount: number;
  waterCurrentReading: number;
  waterPreviousReading: number;
  waterStandingFee: number;
  waterUnitPrice: number;
  powerCurrentReading: number;
  powerPreviousReading: number;
  powerUnitPrice: number;
  otherCharges: number;
  otherChargesDescription: string;
  totalAmount: number;
  amountPaid: number;
  arrears: number;
  dueDate: string;
  isPaid: boolean;
  paidDate?: string;
  tenantName?: string;
  propertyName?: string;
  invoiceNumber?: any;
  createdAt?: any;
  updatedAt?: any;
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'us-central1');
// PAY's callables (setupAccount, chargeCustomer, processPayment, createUserWithFirebaseAuth) still live in africa-south1.
export const functionsAfrica = getFunctions(app, 'africa-south1');

export class FirebaseService {


}

export class PaymentService {
  // Rent fee split (mirrors functions/src/desk/rentFees.ts — the server is authoritative). Integer minor units.
  //   tenant pays rent + min(KES 150, 0.5%); landlord covers the rest of Paystack's ~1.5% plus a 0.2% convenience fee.
  static calculateFees(amount: number, invoiceBalance: number): {
    tenantFee: number;
    total: number;
    netAmount: number;
    landlordPaystackFee: number;
    convenienceFee: number;
    deductions: number;
    netPayout: number;
    arrears: number;
  } {
    const pct = (minor: number, p: number) => Math.floor((minor * Math.round(p * 100) + 5000) / 10000);
    const rent = Math.round(amount * 100);
    const tenantFee = Math.min(pct(rent, 0.5), 15000);
    const paystackEstimate = Math.min(pct(rent, 1.5), 300000);
    const landlordPaystackFee = Math.max(0, paystackEstimate - tenantFee);
    const convenienceFee = pct(rent, 0.2);
    const deductions = landlordPaystackFee + convenienceFee;
    const arrears = amount < invoiceBalance ? invoiceBalance - amount : 0;

    return {
      tenantFee: tenantFee / 100,
      total: (rent + tenantFee) / 100,
      netAmount: rent / 100,
      landlordPaystackFee: landlordPaystackFee / 100,
      convenienceFee: convenienceFee / 100,
      deductions: deductions / 100,
      netPayout: (rent - deductions) / 100,
      arrears: Math.round(arrears * 100) / 100
    };
  }

  static formatPhoneNumber(phone: string): string {
    const digits = phone.replace(/\D/g, '');

    if (digits.startsWith('254')) {
      return digits.length === 12 ? digits : '';
    } else if (digits.startsWith('0')) {
      return digits.length === 10 ? `254${digits.substring(1)}` : '';
    } else if (digits.startsWith('7') || digits.startsWith('1')) {
      return digits.length === 9 ? `254${digits}` : '';
    } else if (digits.startsWith('1') || digits.startsWith('1')) {
      return digits.length === 9 ? `254${digits}` : '';
    }
    
    return '';
  }

  static async initiatePayment(data: {
    invoiceId: number;
    invoice: Invoice;
    tenantName: string;
    amount: number;
    phone: string;
    paymentMethod: 'mpesa' | 'airtel_money';
  }): Promise<{ reference: string; accessCode: string; authorizationUrl: string; message: string }> {
    try {
      const formattedPhone = this.formatPhoneNumber(data.phone);
      if (!formattedPhone) {
        throw new Error('Invalid phone number format');
      }

      const fees = this.calculateFees(data.amount, data.invoice.totalAmount - data.invoice.amountPaid);
      
      // Map payment method to provider
      const provider = data.paymentMethod === 'mpesa' ? 'mpesa' : 'atl';

      const processPayment = httpsCallable(functionsAfrica, 'processPayment');
      const result: any = await processPayment({
        email: `tenant${data.invoice.tenantId}@plot.app`, // Generate email
        amount: data.amount,
        currency: 'KES',
        phone: formattedPhone,
        provider: provider,
        metadata: {
          userId: data.invoice.tenantId.toString(),
          userName: data.tenantName,
          invoiceId: data.invoice.id,
          billingMonth: data.invoice.billingMonth,
          arrears: fees.arrears,
          agentId: data.invoice.assetId
        }
      });

      if (!result.data.success) {
        throw new Error(result.data.message || 'Payment initiation failed');
      }

      return {
        reference: result.data.data.reference,
        accessCode: result.data.data.accessCode,
        authorizationUrl: result.data.data.authorizationUrl,
        message: result.data.message
      };
    } catch (error: any) {
      console.error('Error initiating payment:', error);
      throw new Error(error.message || 'Failed to initiate payment');
    }
  }

  static listenToPaymentStatus(
    reference: string,
    callback: (payment: any) => void
  ): Unsubscribe {
    const transactionRef = doc(db, 'transactions', reference);
    return onSnapshot(transactionRef, (doc) => {
      if (doc.exists()) {
        callback({ id: doc.id, ...doc.data() });
      }
    });
  }
}