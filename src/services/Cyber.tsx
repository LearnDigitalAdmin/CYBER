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
  getDocs
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from './firebaseService';

export interface Upload {
  id: string;
  name: string;
  phone: string;
  type: string; // service type
  time: string;
  status: 'pending' | 'completed';
  files: string[]; // array of file URLs
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

class CyberService {
  private cache: Map<string, DailyData> = new Map();
  private listeners: Map<string, () => void> = new Map();

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

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      onUpdate(cached);
    }

    // Set up real-time listener
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

        // Sort by time (most recent first)
        uploads.sort((a, b) => {
          const timeA = this.parseTime(a.time);
          const timeB = this.parseTime(b.time);
          return timeB - timeA;
        });

        // Calculate stats
        const stats = this.calculateStats(uploads);
        const services = this.calculateServiceSummary(uploads);

        const dailyData: DailyData = {
          date: dateKey,
          uploads,
          stats,
          services
        };

        // Update cache
        this.cache.set(cacheKey, dailyData);

        // Notify subscriber
        onUpdate(dailyData);
      },
      (error) => {
        console.error('Error in uploads listener:', error);
        onError?.(error);
      }
    );

    // Store unsubscribe function
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
      // Download all files
      for (const fileUrl of files) {
        await this.downloadFile(fileUrl);
      }

      // Update status to completed
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
      // Delete files from storage
      const deletePromises = files.map(async (fileUrl) => {
        try {
          const fileRef = ref(storage, fileUrl);
          await deleteObject(fileRef);
        } catch (error) {
          console.warn('Failed to delete file from storage:', fileUrl, error);
          // Continue even if file deletion fails
        }
      });

      await Promise.all(deletePromises);

      // Delete upload document
      const uploadRef = doc(db, 'agents', agentId, 'uploads', uploadId);
      await deleteDoc(uploadRef);

      console.log('Upload and files deleted successfully');
    } catch (error: any) {
      console.error('Error deleting upload:', error);
      throw new Error(`Failed to delete upload: ${error.message}`);
    }
  }

  /**
   * Get income data for cyber services
   */
  async getCyberIncome(agentId: string, period: 'today' | 'week' | 'month'): Promise<number> {
    try {
      const incomeRef = collection(db, 'agents', agentId, 'cyber-income');
      const date = new Date();
      let startDate: Date;

      switch (period) {
        case 'today':
          startDate = this.getStartOfDay(date);
          break;
        case 'week':
          startDate = new Date(date);
          startDate.setDate(date.getDate() - 7);
          break;
        case 'month':
          startDate = new Date(date);
          startDate.setMonth(date.getMonth() - 1);
          break;
      }

      const q = query(
        incomeRef,
        where('date', '>=', Timestamp.fromDate(startDate)),
        where('date', '<=', Timestamp.fromDate(new Date()))
      );

      const snapshot = await getDocs(q);
      let total = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        total += data.amount || 0;
      });

      return total;
    } catch (error) {
      console.error('Error fetching cyber income:', error);
      return 0;
    }
  }

  /**
   * Clear cache for a specific date
   */
  clearCache(agentId: string, date?: Date): void {
    if (date) {
      const dateKey = this.getDateKey(date);
      const cacheKey = `${agentId}_${dateKey}`;
      this.cache.delete(cacheKey);
    } else {
      // Clear all cache for this agent
      const keys = Array.from(this.cache.keys()).filter(key => key.startsWith(agentId));
      keys.forEach(key => this.cache.delete(key));
    }
  }

  /**
   * Unsubscribe from all listeners
   */
  unsubscribeAll(): void {
    this.listeners.forEach(unsubscribe => unsubscribe());
    this.listeners.clear();
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

  private parseTime(timeStr: string): number {
    // Parse time string like "09:15 AM" to timestamp
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
      
      // Extract filename from URL
      const urlParts = fileUrl.split('/');
      const fileNameWithQuery = urlParts[urlParts.length - 1];
      const fileName = fileNameWithQuery.split('?')[0].split('%2F').pop() || 'download.pdf';
      
      // Create download link
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

// Export singleton instance
export const cyberService = new CyberService();