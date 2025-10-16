import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  QueryConstraint
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from './firebaseService';

export interface Upload {
  id: string;
  name: string;
  phone: string;
  type: string;
  time: string;
  status: 'pending' | 'completed';
  files: string[];
  date: Timestamp;
  createdAt: Timestamp;
  amount?: number;
  reference?: string;
  invoiceId?: string;
}

export interface CyberStats {
  totalUploads: number;
  totalFiles: number;
  completed: number;
  pending: number;
}

export interface ServiceSummary {
  name: string;
  count: number;
  revenue: number;
}

export interface DailyData {
  date: string;
  uploads: Upload[];
  stats: CyberStats;
  services: ServiceSummary[];
}

export interface IncomeRecord {
  reference: string;
  pId: string;
  service: string;
  grossAmount: number;
  paystackFees: number;
  netAfterPaystack: number;
  platformCommission: number;
  agentNetIncome: number;
  commissionRate: number;
  currency: string;
  status: string;
  type: string;
  phone?: string;
  createdAt: Timestamp;
  paidAt: Timestamp;
  splitCode?: string;
  accountReference?: string;
}

export interface PlotIncomeRecord {
  reference: string;
  userId: string;
  userName: string;
  planId: string;
  planName: string;
  grossAmount: number;
  netAmount: number;
  agentCommission: number;
  platformRevenue: number;
  paystackFees: number;
  commissionRate: number;
  currency: string;
  status: string;
  type: string;
  createdAt: Timestamp;
  paidAt: Timestamp;
  expiryDate: Timestamp;
  splitCode?: string;
}

export interface IncomeData {
  cyberIncome: number;
  plotIncome: number;
  totalIncome: number;
  cyberCount: number;
  plotCount: number;
  records: {
    cyber: IncomeRecord[];
    plot: PlotIncomeRecord[];
  };
}

class CyberService {
  private cache: Map<string, DailyData> = new Map();
  private listeners: Map<string, () => void> = new Map();
  private incomeCache: Map<string, IncomeData> = new Map();
  private incomeListeners: Map<string, () => void> = new Map();

  /**
   * Subscribe to income data (cyber-income and plot-income)
   */
  subscribeToIncomeData(
    agentId: string,
    period: 'today' | 'week' | 'month',
    onUpdate: (data: IncomeData) => void,
    onError?: (error: Error) => void
  ): () => void {
    const cacheKey = `${agentId}_${period}`;
    const date = new Date();
    const { startDate, endDate } = this.getDateRange(date, period);

    // Check cache first
    const cached = this.incomeCache.get(cacheKey);
    if (cached) {
      onUpdate(cached);
    }

    // Unsubscribe from previous listener if exists
    const existingUnsubscribe = this.incomeListeners.get(cacheKey);
    if (existingUnsubscribe) {
      existingUnsubscribe();
    }

    // Subscribe to cyber-income
    const cyberRef = collection(db, 'agents', agentId, 'cyber-income');
    const cyberConstraints: QueryConstraint[] = [
      where('status', '==', 'success'),
      orderBy('paidAt', 'desc')
    ];
    
    const cyberQuery = query(cyberRef, ...cyberConstraints);

    const unsubscribeCyber = onSnapshot(
      cyberQuery,
      (cyberSnapshot) => {
        // Subscribe to plot-income
        const plotRef = collection(db, 'agents', agentId, 'plot-income');
        const plotConstraints: QueryConstraint[] = [
          where('status', '==', 'success'),
          orderBy('paidAt', 'desc')
        ];
        
        const plotQuery = query(plotRef, ...plotConstraints);

        const unsubscribePlot = onSnapshot(
          plotQuery,
          (plotSnapshot) => {
            try {
              const cyberRecords: IncomeRecord[] = [];
              const plotRecords: PlotIncomeRecord[] = [];

              // Filter cyber records by date range
              cyberSnapshot.forEach((doc) => {
                const data = doc.data() as IncomeRecord;
                const paidDate = data.paidAt?.toDate() || new Date();
                if (paidDate >= startDate && paidDate <= endDate) {
                  cyberRecords.push({
                    ...data,
                    reference: doc.id
                  });
                }
              });

              // Filter plot records by date range
              plotSnapshot.forEach((doc) => {
                const data = doc.data() as PlotIncomeRecord;
                const paidDate = data.paidAt?.toDate() || new Date();
                if (paidDate >= startDate && paidDate <= endDate) {
                  plotRecords.push({
                    ...data,
                    reference: doc.id
                  });
                }
              });

              // Calculate totals
              const cyberIncome = cyberRecords.reduce((sum, r) => sum + (r.agentNetIncome || 0), 0);
              const plotIncome = plotRecords.reduce((sum, r) => sum + (r.agentCommission || 0), 0);
              const totalIncome = cyberIncome + plotIncome;

              const incomeData: IncomeData = {
                cyberIncome,
                plotIncome,
                totalIncome,
                cyberCount: cyberRecords.length,
                plotCount: plotRecords.length,
                records: {
                  cyber: cyberRecords,
                  plot: plotRecords
                }
              };

              this.incomeCache.set(cacheKey, incomeData);
              onUpdate(incomeData);
            } catch (error: any) {
              console.error('Error processing income data:', error);
              onError?.(error);
            }
          },
          (error) => {
            console.error('Error in plot-income listener:', error);
            onError?.(error);
          }
        );

        // Store unsubscribe function
        this.incomeListeners.set(cacheKey, unsubscribePlot);
      },
      (error) => {
        console.error('Error in cyber-income listener:', error);
        onError?.(error);
      }
    );

    return () => {
      unsubscribeCyber();
      const unsubscribePlot = this.incomeListeners.get(cacheKey);
      if (unsubscribePlot) unsubscribePlot();
      this.incomeListeners.delete(cacheKey);
    };
  }

  /**
   * Get uploads for a specific date with real-time updates
   */
  subscribeToUploads(
    agentId: string,
    date: Date,
    onUpdate: (data: DailyData) => void,
    onError?: (error: Error) => void
  ): () => void {
    const dateKey = this.getDateKey(date);
    const cacheKey = `${agentId}_${dateKey}`;

    const cached = this.cache.get(cacheKey);
    if (cached) {
      onUpdate(cached);
    }

    const uploadsRef = collection(db, 'agents', agentId, 'uploads');
    const startOfDay = this.getStartOfDay(date);
    const endOfDay = this.getEndOfDay(date);

    const q = query(
      uploadsRef,
      where('date', '>=', Timestamp.fromDate(startOfDay)),
      where('date', '<=', Timestamp.fromDate(endOfDay)),
      orderBy('date', 'desc'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const uploads: Upload[] = [];
        
        snapshot.forEach((doc) => {
          uploads.push({
            id: doc.id,
            ...doc.data()
          } as Upload);
        });

        uploads.sort((a, b) => {
          const timeA = this.parseTime(a.time);
          const timeB = this.parseTime(b.time);
          return timeB - timeA;
        });

        const stats = this.calculateStats(uploads);
        const services = this.calculateServiceSummary(uploads);

        const dailyData: DailyData = {
          date: dateKey,
          uploads,
          stats,
          services
        };

        this.cache.set(cacheKey, dailyData);
        onUpdate(dailyData);
      },
      (error) => {
        console.error('Error in uploads listener:', error);
        onError?.(error);
      }
    );

    this.listeners.set(cacheKey, unsubscribe);
    return unsubscribe;
  }

  /**
   * Download file(s) from upload and mark as completed
   */
  async downloadAndComplete(
    agentId: string,
    uploadId: string,
    files: string[]
  ): Promise<void> {
    try {
      for (const fileUrl of files) {
        await this.downloadFile(fileUrl);
      }

      const uploadRef = doc(db, 'agents', agentId, 'uploads', uploadId);
      await updateDoc(uploadRef, {
        status: 'completed',
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      console.log('Files downloaded and upload marked as completed');
    } catch (error: any) {
      console.error('Error downloading files:', error);
      throw new Error(`Failed to download files: ${error.message}`);
    }
  }

  /**
   * Delete upload and associated files from storage
   */
  async deleteUpload(
    agentId: string,
    uploadId: string,
    files: string[]
  ): Promise<void> {
    try {
      const deletePromises = files.map(async (fileUrl) => {
        try {
          const fileRef = ref(storage, fileUrl);
          await deleteObject(fileRef);
        } catch (error) {
          console.warn('Failed to delete file from storage:', fileUrl, error);
        }
      });

      await Promise.all(deletePromises);

      const uploadRef = doc(db, 'agents', agentId, 'uploads', uploadId);
      await deleteDoc(uploadRef);

      console.log('Upload and files deleted successfully');
    } catch (error: any) {
      console.error('Error deleting upload:', error);
      throw new Error(`Failed to delete upload: ${error.message}`);
    }
  }

  /**
   * Clear cache
   */
  clearCache(agentId: string, date?: Date): void {
    if (date) {
      const dateKey = this.getDateKey(date);
      const cacheKey = `${agentId}_${dateKey}`;
      this.cache.delete(cacheKey);
    } else {
      const keys = Array.from(this.cache.keys()).filter(key => key.startsWith(agentId));
      keys.forEach(key => this.cache.delete(key));
    }
  }

  /**
   * Clear income cache
   */
  clearIncomeCache(agentId: string, period?: 'today' | 'week' | 'month'): void {
    if (period) {
      const cacheKey = `${agentId}_${period}`;
      this.incomeCache.delete(cacheKey);
    } else {
      const keys = Array.from(this.incomeCache.keys()).filter(key => key.startsWith(agentId));
      keys.forEach(key => this.incomeCache.delete(key));
    }
  }

  /**
   * Unsubscribe from all listeners
   */
  unsubscribeAll(): void {
    this.listeners.forEach(unsubscribe => unsubscribe());
    this.listeners.clear();
    this.incomeListeners.forEach(unsubscribe => unsubscribe());
    this.incomeListeners.clear();
  }

  // Helper methods
  private getDateKey(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private getStartOfDay(date: Date): Date {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  private getEndOfDay(date: Date): Date {
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return end;
  }

  private getDateRange(date: Date, period: 'today' | 'week' | 'month'): { startDate: Date; endDate: Date } {
    const endDate = this.getEndOfDay(new Date());
    let startDate: Date;

    switch (period) {
      case 'today':
        startDate = this.getStartOfDay(new Date());
        break;
      case 'week':
        startDate = new Date();
        startDate.setDate(date.getDate() - 7);
        startDate = this.getStartOfDay(startDate);
        break;
      case 'month':
        startDate = new Date();
        startDate.setMonth(date.getMonth() - 1);
        startDate = this.getStartOfDay(startDate);
        break;
    }

    return { startDate, endDate };
  }

  private parseTime(timeStr: string): number {
    const [time, period] = timeStr.split(' ');
    const [hours, minutes] = time.split(':').map(Number);
    
    let hour24 = hours;
    if (period === 'PM' && hours !== 12) {
      hour24 = hours + 12;
    } else if (period === 'AM' && hours === 12) {
      hour24 = 0;
    }
    
    return hour24 * 60 + minutes;
  }

  private calculateStats(uploads: Upload[]): CyberStats {
    return {
      totalUploads: uploads.length,
      totalFiles: uploads.reduce((sum, u) => sum + u.files.length, 0),
      completed: uploads.filter(u => u.status === 'completed').length,
      pending: uploads.filter(u => u.status === 'pending').length
    };
  }

  private calculateServiceSummary(uploads: Upload[]): ServiceSummary[] {
    const serviceMap = new Map<string, ServiceSummary>();

    uploads.forEach(upload => {
      const existing = serviceMap.get(upload.type);
      if (existing) {
        existing.count += 1;
        existing.revenue += upload.amount || 0;
      } else {
        serviceMap.set(upload.type, {
          name: upload.type,
          count: 1,
          revenue: upload.amount || 0
        });
      }
    });

    return Array.from(serviceMap.values()).sort((a, b) => b.count - a.count);
  }

  private async downloadFile(fileUrl: string): Promise<void> {
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      
      const urlParts = fileUrl.split('/');
      const fileNameWithQuery = urlParts[urlParts.length - 1];
      const fileName = fileNameWithQuery.split('?')[0].split('%2F').pop() || 'download.pdf';
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = decodeURIComponent(fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      throw error;
    }
  }
}

export const cyberService = new CyberService();