import { 
  ref, 
  uploadBytesResumable, 
  getDownloadURL, 
  deleteObject,
  type UploadTaskSnapshot,
  type StorageReference 
} from 'firebase/storage';
import { storage } from './firebaseService';

export interface UploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
}

export interface UploadResult {
  storageUrl: string;
  downloadUrl: string;
  fileName: string;
}

/**
 * Upload a file to Firebase Storage with progress tracking
 */
export const uploadFile = (
  file: File,
  path: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> => {
  return new Promise((resolve, reject) => {
    try {
      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${timestamp}_${sanitizedFileName}`;
      const fullPath = `${path}/${fileName}`;
      
      const storageRef: StorageReference = ref(storage, fullPath);
      const uploadTask = uploadBytesResumable(storageRef, file);

      console.log(`[Storage] Starting upload: ${fullPath}`);

      uploadTask.on(
        'state_changed',
        (snapshot: UploadTaskSnapshot) => {
          const progress: UploadProgress = {
            bytesTransferred: snapshot.bytesTransferred,
            totalBytes: snapshot.totalBytes,
            percentage: (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
          };
          
          if (onProgress) {
            onProgress(progress);
          }
          
          console.log(`[Storage] Upload progress: ${progress.percentage.toFixed(2)}%`);
        },
        (error) => {
          console.error(`[Storage] Upload error for ${fullPath}:`, error);
          reject(new Error(`Upload failed: ${error.message}`));
        },
        async () => {
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            
            const result: UploadResult = {
              storageUrl: fullPath,
              downloadUrl,
              fileName,
            };
            
            console.log(`[Storage] Upload complete: ${fullPath}`);
            resolve(result);
          } catch (error) {
            console.error(`[Storage] Error getting download URL:`, error);
            reject(new Error('Failed to get download URL'));
          }
        }
      );
    } catch (error) {
      console.error('[Storage] Upload initialization error:', error);
      reject(error);
    }
  });
};

/**
 * Upload multiple files with batch progress tracking
 */
export const uploadMultipleFiles = async (
  files: File[],
  basePath: string,
  onBatchProgress?: (completed: number, total: number) => void
): Promise<UploadResult[]> => {
  console.log(`[Storage] Starting batch upload of ${files.length} files`);
  
  const results: UploadResult[] = [];
  let completed = 0;

  for (const file of files) {
    try {
      const result = await uploadFile(file, basePath);
      results.push(result);
      completed++;
      
      if (onBatchProgress) {
        onBatchProgress(completed, files.length);
      }
      
      console.log(`[Storage] Batch progress: ${completed}/${files.length}`);
    } catch (error) {
      console.error(`[Storage] Failed to upload file ${file.name}:`, error);
      throw error;
    }
  }

  console.log(`[Storage] Batch upload complete: ${results.length} files uploaded`);
  return results;
};

/**
 * Delete a file from Firebase Storage
 */
export const deleteFile = async (storagePath: string): Promise<void> => {
  try {
    console.log(`[Storage] Deleting file: ${storagePath}`);
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
    console.log(`[Storage] File deleted: ${storagePath}`);
  } catch (error) {
    console.error(`[Storage] Delete error for ${storagePath}:`, error);
    throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Delete multiple files from Firebase Storage
 */
export const deleteMultipleFiles = async (storagePaths: string[]): Promise<void> => {
  console.log(`[Storage] Deleting ${storagePaths.length} files`);
  
  const deletePromises = storagePaths.map(path => deleteFile(path));
  
  try {
    await Promise.all(deletePromises);
    console.log(`[Storage] Successfully deleted ${storagePaths.length} files`);
  } catch (error) {
    console.error('[Storage] Batch delete error:', error);
    throw error;
  }
};

/**
 * Get download URL for a file
 */
export const getFileDownloadUrl = async (storagePath: string): Promise<string> => {
  try {
    console.log(`[Storage] Getting download URL for: ${storagePath}`);
    const storageRef = ref(storage, storagePath);
    const url = await getDownloadURL(storageRef);
    console.log(`[Storage] Download URL retrieved for: ${storagePath}`);
    return url;
  } catch (error) {
    console.error(`[Storage] Error getting download URL for ${storagePath}:`, error);
    throw new Error(`Failed to get download URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};