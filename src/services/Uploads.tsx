import {
  collection,
  addDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebaseService';

export interface UploadRequest {
  name: string;
  phone: string;
  type: string;
  notes?: string;
  files: string[];
  cyberId: string;
  cyberName: string;
}

export interface UploadDocument {
  name: string;
  phone: string;
  type: string;
  notes?: string;
  files: string[];
  status: 'pending' | 'completed';
  date: Timestamp;
  time: string;
  createdAt: Timestamp;
  cyberId: string;
  cyberName: string;
  amount?: number;
  reference?: string;
}

class UploadService {
  /**
   * Submit an upload request to the cyber's uploads collection
   */
  async submitUpload(request: UploadRequest): Promise<string> {
    try {
      const now = new Date();
      
      // Format time in 12-hour format
      const time = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      const uploadData: UploadDocument = {
        name: request.name.trim(),
        phone: request.phone.trim(),
        type: request.type,
        notes: request.notes?.trim() || '',
        files: request.files,
        status: 'pending',
        date: Timestamp.fromDate(now),
        time: time,
        createdAt: Timestamp.fromDate(now),
        cyberId: request.cyberId,
        cyberName: request.cyberName
      };

      // Add to cyber's uploads subcollection
      console.log('Creating uploads ref for cyberId:', request.cyberId);
      const uploadsRef = collection(db, 'agents', request.cyberId, 'uploads');
      console.log('Uploads ref path:', uploadsRef.path);
      console.log('Upload data:', uploadData);
      const docRef = await addDoc(uploadsRef, uploadData);

      console.log('Upload submitted successfully:', docRef.id);
      return docRef.id;
    } catch (error: any) {
      console.error('Error submitting upload:', error);
      throw new Error(`Failed to submit upload: ${error.message}`);
    }
  }

  /**
   * Validate phone number format (Kenyan format)
   */
  validatePhoneNumber(phone: string): boolean {
    // Remove spaces and special characters
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    
    // Check if it matches Kenyan phone format
    // Accepts: 0712345678, +254712345678, 254712345678
    const phoneRegex = /^(\+?254|0)[17]\d{8}$/;
    return phoneRegex.test(cleaned);
  }

  /**
   * Format phone number to standard format
   */
  formatPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    
    // Convert to 0712345678 format
    if (cleaned.startsWith('+254')) {
      return '0' + cleaned.slice(4);
    } else if (cleaned.startsWith('254')) {
      return '0' + cleaned.slice(3);
    }
    
    return cleaned;
  }

  /**
   * Calculate total size of files
   */
  calculateTotalSize(files: File[]): number {
    return files.reduce((total, file) => total + file.size, 0);
  }

  /**
   * Check if file type is allowed
   */
  isFileTypeAllowed(fileType: string): boolean {
    const allowedTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/x-mspublisher'
    ];
    
    return allowedTypes.includes(fileType);
  }

  /**
   * Compress image before upload (optional optimization)
   */
  async compressImage(file: File, maxWidth: number = 1920, maxHeight: number = 1920, quality: number = 0.8): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const img = new Image();
        
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Calculate new dimensions
          if (width > height) {
            if (width > maxWidth) {
              height *= maxWidth / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width *= maxHeight / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Failed to compress image'));
              }
            },
            file.type,
            quality
          );
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Generate a unique filename for storage
   */
  generateUniqueFilename(originalName: string): string {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const safeName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `${timestamp}_${randomStr}_${safeName}`;
  }

  /**
   * Get file extension
   */
  getFileExtension(filename: string): string {
    return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2);
  }

  /**
   * Check if file is an image
   */
  isImage(fileType: string): boolean {
    return fileType.startsWith('image/');
  }

  /**
   * Format bytes to human readable format
   */
  formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
}

// Export singleton instance
export const uploadService = new UploadService();

// Export convenience function
export const submitUpload = uploadService.submitUpload.bind(uploadService);