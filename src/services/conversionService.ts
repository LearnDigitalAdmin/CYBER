import { httpsCallable, type HttpsCallableResult } from 'firebase/functions';
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  getDoc, 
  Timestamp,
  serverTimestamp 
} from 'firebase/firestore';
import { db, functions } from './firebaseService';
import { uploadMultipleFiles, deleteMultipleFiles, type UploadResult } from './storageService';

export type ConversionMode = 'id' | 'document';
export type PageSize = 'A4' | 'A3' | 'Letter' | 'Legal';
export type ConversionStatus = 'pending' | 'uploading' | 'processing' | 'complete' | 'failed';

export interface CropData {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageMetadata {
  id: string;
  fileName: string;
  storageUrl: string;
  downloadUrl: string;
  cropData?: CropData;
  order: number;
}

export interface ConversionConfig {
  mode: ConversionMode;
  pageSize: PageSize;
  imagesPerPage: number;
  enableEnhancements: boolean;
}

export interface ConversionJob {
  id: string;
  userId: string;
  status: ConversionStatus;
  config: ConversionConfig;
  images: ImageMetadata[];
  pdfUrl?: string;
  pdfStorageUrl?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt?: Timestamp;
  error?: string;
}

export interface ConversionProgress {
  status: ConversionStatus;
  progress: number;
  message: string;
  pdfUrl?: string;
}

/**
 * Remove undefined fields from an object to prevent Firestore errors
 */
const cleanUndefinedFields = <T extends Record<string, any>>(obj: T): Partial<T> => {
  const cleaned: Partial<T> = {};
  
  for (const key in obj) {
    if (obj[key] !== undefined) {
      cleaned[key] = obj[key];
    }
  }
  
  return cleaned;
};

/**
 * Create a new conversion job in Firestore
 */
const createConversionJob = async (
  userId: string,
  config: ConversionConfig
): Promise<string> => {
  try {
    const jobsRef = collection(db, 'conversions');
    const jobRef = doc(jobsRef);
    
    const job: Partial<ConversionJob> = {
      id: jobRef.id,
      userId,
      status: 'pending',
      config,
      images: [],
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
    };

    await setDoc(jobRef, cleanUndefinedFields(job));
    console.log(`[Conversion] Created job: ${jobRef.id}`);
    
    return jobRef.id;
  } catch (error) {
    console.error('[Conversion] Error creating job:', error);
    throw new Error('Failed to create conversion job');
  }
};

/**
 * Update conversion job status
 */
const updateJobStatus = async (
  jobId: string,
  status: ConversionStatus,
  additionalData?: Partial<ConversionJob>
): Promise<void> => {
  try {
    const jobRef = doc(db, 'conversions', jobId);
    
    const updateData: any = {
      status,
      updatedAt: serverTimestamp(),
      ...additionalData,
    };

    if (status === 'complete') {
      updateData.completedAt = serverTimestamp();
    }

    await updateDoc(jobRef, cleanUndefinedFields(updateData));
    console.log(`[Conversion] Updated job ${jobId} status to: ${status}`);
  } catch (error) {
    console.error(`[Conversion] Error updating job ${jobId}:`, error);
    throw error;
  }
};

/**
 * Upload images and create metadata
 */
const uploadImages = async (
  userId: string,
  jobId: string,
  files: Array<{ file: File; cropData?: CropData }>,
  onProgress?: (completed: number, total: number) => void
): Promise<ImageMetadata[]> => {
  try {
    console.log(`[Conversion] Uploading ${files.length} images for job ${jobId}`);
    
    const basePath = `users/${userId}/conversions/${jobId}/images`;
    
    const uploadResults: UploadResult[] = await uploadMultipleFiles(
      files.map(f => f.file),
      basePath,
      onProgress
    );

    const imageMetadata: ImageMetadata[] = uploadResults.map((result, index) => {
      const metadata: ImageMetadata = {
        id: `img-${index}`,
        fileName: result.fileName,
        storageUrl: result.storageUrl,
        downloadUrl: result.downloadUrl,
        order: index,
      };

      // Only add cropData if it exists
      if (files[index].cropData) {
        metadata.cropData = files[index].cropData;
      }

      return metadata;
    });

    console.log(`[Conversion] Uploaded ${imageMetadata.length} images`);
    return imageMetadata;
  } catch (error) {
    console.error('[Conversion] Image upload error:', error);
    throw new Error('Failed to upload images');
  }
};

/**
 * Call Cloud Run function to process conversion
 */
const processConversion = async (
  jobId: string,
  userId: string,
  images: ImageMetadata[],
  config: ConversionConfig
): Promise<{ pdfUrl: string; pdfStorageUrl: string }> => {
  try {
    console.log(`[Conversion] Processing job ${jobId} with ${images.length} images`);
    
    const convertFunction = httpsCallable(functions, 'convertImagesToPdf');
    
    const result: HttpsCallableResult = await convertFunction({
      jobId,
      userId,
      images,
      config,
    });

    const data = result.data as { pdfUrl: string; pdfStorageUrl: string };
    
    if (!data.pdfUrl || !data.pdfStorageUrl) {
      throw new Error('Invalid response from conversion function');
    }

    console.log(`[Conversion] Processing complete for job ${jobId}`);
    return data;
  } catch (error) {
    console.error(`[Conversion] Processing error for job ${jobId}:`, error);
    throw new Error(`Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Main conversion workflow
 */
export const convertImagesToPdf = async (
  userId: string,
  files: Array<{ file: File; cropData?: CropData }>,
  config: ConversionConfig,
  onProgress?: (progress: ConversionProgress) => void
): Promise<{ jobId: string; pdfUrl: string }> => {
  let jobId: string = '';
  let uploadedImages: ImageMetadata[] = [];
  
  try {
    // Step 1: Create job
    if (onProgress) {
      onProgress({
        status: 'pending',
        progress: 5,
        message: 'Creating conversion job...',
      });
    }
    
    jobId = await createConversionJob(userId, config);

    // Step 2: Upload images
    if (onProgress) {
      onProgress({
        status: 'uploading',
        progress: 10,
        message: 'Uploading images...',
      });
    }
    
    await updateJobStatus(jobId, 'uploading');
    
    uploadedImages = await uploadImages(
      userId,
      jobId,
      files,
      (completed, total) => {
        const uploadProgress = 10 + (completed / total) * 30;
        if (onProgress) {
          onProgress({
            status: 'uploading',
            progress: uploadProgress,
            message: `Uploading images (${completed}/${total})...`,
          });
        }
      }
    );

    // Step 3: Update job with image metadata
    await updateJobStatus(jobId, 'processing', { images: uploadedImages });

    // Step 4: Process conversion
    if (onProgress) {
      onProgress({
        status: 'processing',
        progress: 50,
        message: 'Converting to PDF...',
      });
    }

    const { pdfUrl, pdfStorageUrl } = await processConversion(
      jobId,
      userId,
      uploadedImages,
      config
    );

    // Step 5: Update job as complete
    await updateJobStatus(jobId, 'complete', {
      pdfUrl,
      pdfStorageUrl,
    });

    // Step 6: Clean up uploaded images (keep only PDF)
    if (onProgress) {
      onProgress({
        status: 'complete',
        progress: 95,
        message: 'Cleaning up...',
      });
    }

    try {
      await deleteMultipleFiles(uploadedImages.map(img => img.storageUrl));
      console.log(`[Conversion] Cleaned up ${uploadedImages.length} uploaded images`);
    } catch (cleanupError) {
      console.error('[Conversion] Cleanup error (non-critical):', cleanupError);
      // Don't fail the conversion if cleanup fails
    }

    if (onProgress) {
      onProgress({
        status: 'complete',
        progress: 100,
        message: 'Conversion complete!',
        pdfUrl,
      });
    }

    console.log(`[Conversion] Job ${jobId} completed successfully`);
    return { jobId, pdfUrl };
    
  } catch (error) {
    console.error(`[Conversion] Error in conversion workflow:`, error);
    
    // Update job status to failed
    if (jobId) {
      try {
        await updateJobStatus(jobId, 'failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      } catch (updateError) {
        console.error('[Conversion] Error updating failed job:', updateError);
      }

      // Attempt cleanup on failure
      if (uploadedImages.length > 0) {
        try {
          await deleteMultipleFiles(uploadedImages.map(img => img.storageUrl));
          console.log('[Conversion] Cleaned up images after failure');
        } catch (cleanupError) {
          console.error('[Conversion] Cleanup error after failure:', cleanupError);
        }
      }
    }

    if (onProgress) {
      onProgress({
        status: 'failed',
        progress: 0,
        message: error instanceof Error ? error.message : 'Conversion failed',
      });
    }

    throw error;
  }
};

/**
 * Get conversion job details
 */
export const getConversionJob = async (jobId: string): Promise<ConversionJob | null> => {
  try {
    const jobRef = doc(db, 'conversions', jobId);
    const jobSnap = await getDoc(jobRef);
    
    if (!jobSnap.exists()) {
      console.log(`[Conversion] Job ${jobId} not found`);
      return null;
    }

    return jobSnap.data() as ConversionJob;
  } catch (error) {
    console.error(`[Conversion] Error getting job ${jobId}:`, error);
    throw error;
  }
};