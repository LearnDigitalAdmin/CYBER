import { 
  doc, 
  writeBatch, 
  getDoc, 
  serverTimestamp,
  Timestamp,
  collection 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage} from './firebaseService';
import { generateInvoicePDF, type InvoiceWithDetails, type Property } from './PDF';
import type { Invoice } from '../components/plotYangu/AddInvc';

export interface Transaction {
  id: string;
  reference: string;
  amount: number;
  arrears: number;
  status: 'success' | 'failed' | 'pending';
  invoiceId: string;
  userId: string;
  userName: string;
  billingMonth: string;
  agentId: string;
  createdAt: any;
  // Keep metadata optional for backward compatibility
  metadata?: {
    invoiceId: string;
    tenantId: number;
    userName: string;
    billingMonth: string;
    agentId: string;
  };
}

interface CompanyInfo {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
}

export class PaymentSuccessHandler {
  /**
   * Main success handler - orchestrates all post-payment operations
   */
  static async handlePaymentSuccess(
    transaction: Transaction,
    firestoreUserId: string
  ): Promise<void> {
    try {
      // Validate transaction
      if (transaction.status !== 'success') {
        throw new Error('Transaction is not successful');
      }

      // Extract data from transaction (supporting both direct properties and metadata object)
      const amount = transaction.amount;
      const arrears = transaction.arrears;
      const reference = transaction.reference;
      const invoiceId = transaction.metadata?.invoiceId || transaction.invoiceId;
      const agentId = transaction.metadata?.agentId || transaction.agentId || transaction.userId;
      const userName = transaction.metadata?.userName || transaction.userName;

      if (!invoiceId || !agentId || !userName) {
        throw new Error('Missing required transaction data');
      }

      // 1. Fetch invoice and related data in parallel
      const [invoiceDoc, propertyData, agentData] = await Promise.all([
        getDoc(doc(db, 'users', agentId, 'invoices', invoiceId)),
        this.getInvoiceProperty(agentId, invoiceId),
        this.getAgentCompanyInfo(agentId)
      ]);

      if (!invoiceDoc.exists()) {
        throw new Error('Invoice not found');
      }

      const invoice = { id: invoiceDoc.id, ...invoiceDoc.data() } as Invoice;

      // 2. Generate PDF
      const pdfUrl = await this.generateAndUploadInvoicePDF(
        invoice,
        propertyData,
        agentData,
        reference
      );

      // 3. Prepare batch write
      const batch = writeBatch(db);

      // 4. Update invoice
      const invoiceRef = doc(db, 'users', agentId, 'invoices', invoiceId);
      batch.update(invoiceRef, {
        isPaid: true,
        amountPaid: amount,
        arrears: arrears,
        paidDate: serverTimestamp(),
        pdfUrl: pdfUrl,
        paymentReference: reference,
        updatedAt: serverTimestamp()
      });

      // 5. Create upload record for cyber dashboard
      const uploadRef = doc(collection(db, 'agents', firestoreUserId, 'uploads'));
      const uploadData = {
        name: userName,
        date: serverTimestamp(),
        time: this.getCurrentTime(),
        type: 'PRINTING',
        service: 'Invoice Payment',
        files: [pdfUrl],
        phone: invoice.tenantName || 'N/A',
        status: 'pending',
        invoiceId: invoiceId,
        amount: amount,
        reference: reference,
        createdAt: serverTimestamp()
      };
      batch.set(uploadRef, uploadData);

      // 6. Update tenant's last payment date
      const tenantRef = doc(db, 'users', agentId, 'tenants', invoice.tenantId.toString());
      batch.update(tenantRef, {
        lastPaymentDate: serverTimestamp(),
        lastPaymentAmount: amount,
        updatedAt: serverTimestamp()
      });

      // 7. Commit all changes atomically
      await batch.commit();

      console.log('Payment success handler completed successfully');
    } catch (error: any) {
      console.error('Error in payment success handler:', error);
      // Log error to Firestore for monitoring
      await this.logError(error, transaction, firestoreUserId);
      throw new Error(`Payment processing failed: ${error.message}`);
    }
  }

  /**
   * Generate PDF and upload to Firebase Storage
   */
  public static async generateAndUploadInvoicePDF(
    invoice: Invoice,
    property: Property,
    companyInfo: CompanyInfo,
    reference: string
  ): Promise<string> {
    try {
      const invoiceWithDetails: InvoiceWithDetails = {
        ...invoice,
        tenantName: invoice.tenantName || `Tenant ${invoice.tenantId}`,
        propertyName: property.name,
        tenantPhone: '',
        tenantEmail: '',
        invoiceNumber: invoice.invoiceNumber,
        createdAt: invoice.createdAt,
        updatedAt: invoice.updatedAt,
        id: invoice.id as number,
      };

      // Generate PDF
      const pdfBytes = await generateInvoicePDF(
        invoiceWithDetails,
        property,
        companyInfo
      );

      // Create storage reference with organized path
      const timestamp = Date.now();
      const fileName = `invoice_${invoice.id}_${reference}_${timestamp}.pdf`;
      const storageRef = ref(
        storage,
        `invoices/${invoice.assetId}/${invoice.billingMonth}/${fileName}`
      );

      // Upload with metadata
      const metadata = {
        contentType: 'application/pdf',
        customMetadata: {
          invoiceId: invoice.id as string,
          tenantId: invoice.tenantId.toString(),
          billingMonth: invoice.billingMonth,
          reference: reference,
          uploadedAt: new Date().toISOString()
        }
      };

      await uploadBytes(storageRef, pdfBytes, metadata);

      // Get download URL
      const downloadUrl = await getDownloadURL(storageRef);

      return downloadUrl;
    } catch (error: any) {
      console.error('Error generating/uploading PDF:', error);
      throw new Error(`PDF generation failed: ${error.message}`);
    }
  }

  /**
   * Get property details for invoice
   */
  private static async getInvoiceProperty(
    agentId: string,
    invoiceId: string
  ): Promise<Property> {
    try {
      const invoiceDoc = await getDoc(doc(db, 'users', agentId, 'invoices', invoiceId));
      
      if (!invoiceDoc.exists()) {
        throw new Error('Invoice not found');
      }

      const invoice = invoiceDoc.data();
      const propertyId = invoice.propertyId;

      const propertyDoc = await getDoc(
        doc(db, 'users', agentId, 'properties', propertyId.toString())
      );

      if (!propertyDoc.exists()) {
        throw new Error('Property not found');
      }

      return { id: propertyDoc.id, ...propertyDoc.data() } as any;
    } catch (error: any) {
      console.error('Error fetching property:', error);
      // Return default property if fetch fails
      return {
        id: 0,
        name: 'N/A',
        address: '',
        userId: 0,
        agentCommissionRate: 0,
        maxUnits: 1,
        createdAt: Timestamp.now().toDate().toISOString(),
        updatedAt: Timestamp.now().toDate().toISOString()
      } as any;
    }
  }

  /**
   * Get agent/landlord company information
   */
  private static async getAgentCompanyInfo(agentId: string): Promise<CompanyInfo> {
    try {
      const agentDoc = await getDoc(doc(db, 'users', agentId));

      if (!agentDoc.exists()) {
        throw new Error('Agent not found');
      }

      const agentData = agentDoc.data();

      return {
        name: agentData.company?.name || 'Plot Yangu',
        address: agentData.company?.address || agentData.address || 'Nairobi, Kenya',
        phone: agentData.company?.phone || agentData.phone || '0791286165',
        email: agentData.company?.email || agentData.email || 'info@cogvana.co.ke',
        website: agentData.company?.website || 'https://cogvana.co.ke'
      };
    } catch (error: any) {
      console.error('Error fetching agent info:', error);
      // Return default company info
      return {
        name: 'Plot Yangu',
        address: 'Nairobi, Kenya',
        phone: '0791286165',
        email: 'info@cogvana.co.ke',
        website: 'https://cogvana.co.ke'
      };
    }
  }

  /**
   * Get current time in 12-hour format
   */
  private static getCurrentTime(): string {
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12
    
    const minutesStr = minutes < 10 ? `0${minutes}` : minutes.toString();
    
    return `${hours}:${minutesStr} ${ampm}`;
  }

  /**
   * Log errors for monitoring and debugging
   */
  private static async logError(
    error: Error,
    transaction: Transaction,
    firestoreUserId: string
  ): Promise<void> {
    try {
      const errorRef = doc(collection(db, 'payment_errors'));
      const errorData = {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        },
        transaction: {
          id: transaction.id,
          reference: transaction.reference,
          amount: transaction.amount,
          invoiceId: transaction.invoiceId,
          agentId: transaction.agentId || transaction.userId,
          userName: transaction.userName
        },
        processedBy: firestoreUserId,
        timestamp: serverTimestamp(),
        resolved: false
      };
      
      const batch = writeBatch(db);
      batch.set(errorRef, errorData);
      await batch.commit();
    } catch (logError) {
      console.error('Failed to log error:', logError);
      // Fail silently - don't throw
    }
  }
}

// Export convenience function
export const handlePaymentSuccess = PaymentSuccessHandler.handlePaymentSuccess.bind(
  PaymentSuccessHandler
);