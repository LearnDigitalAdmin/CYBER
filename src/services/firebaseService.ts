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
  id: string;
  localId: number;
  tenantId: number;
  propertyId: number;
  agentUserId: string;
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
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'africa-south1'); 

export class FirebaseService {


}

export class PaymentService {
  private static readonly PLATFORM_FEE_PERCENTAGE = 0.8;

  static calculateFees(amount: number, invoiceBalance: number): {
    platformFee: number;
    paystackFee: number;
    total: number;
    netAmount: number;
    arrears: number;
  } {
    const platformFee = amount * (this.PLATFORM_FEE_PERCENTAGE / 100);
    const total = amount + platformFee;
    const paystackFee = 0; // Calculated by Paystack backend
    const netAmount = amount;
    const arrears = amount < invoiceBalance ? invoiceBalance - amount : 0;

    return {
      platformFee: Math.round(platformFee * 100) / 100,
      paystackFee: Math.round(paystackFee * 100) / 100,
      total: Math.round(total * 100) / 100,
      netAmount: Math.round(netAmount * 100) / 100,
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

      const processPayment = httpsCallable(functions, 'processPayment');
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
          agentId: data.invoice.agentUserId
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