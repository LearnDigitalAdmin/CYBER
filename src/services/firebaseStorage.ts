// services/firebaseStorage.ts
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebaseService';


/**
 * Upload a file to Firebase Storage
 * @param file - The file to upload
 * @param userId - The user ID for organizing files
 * @returns The download URL of the uploaded file
 */
export const uploadToFirebase = async (
  file: File,
  userId: string
): Promise<string> => {
  try {
    const timestamp = Date.now();
    const fileName = `passport-photos/${userId}/${timestamp}-${file.name}`;
    const storageRef = ref(storage, fileName);

    console.log('[Firebase] Uploading file:', {
      fileName,
      size: file.size,
      type: file.type,
    });

    const snapshot = await uploadBytes(storageRef, file, {
      contentType: file.type,
      customMetadata: {
        uploadedBy: userId,
        uploadedAt: new Date().toISOString(),
      },
    });

    const downloadURL = await getDownloadURL(snapshot.ref);

    console.log('[Firebase] Upload successful:', {
      fileName,
      downloadURL,
      fullPath: snapshot.ref.fullPath,
    });

    return downloadURL;
  } catch (error) {
    console.error('[Firebase] Upload failed:', error);
    throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Delete a file from Firebase Storage
 * @param url - The download URL of the file to delete
 */
export const deleteFromFirebase = async (url: string): Promise<void> => {
  try {
    // Extract the file path from the download URL
    const urlObj = new URL(url);
    const pathMatch = urlObj.pathname.match(/\/o\/(.+?)\?/);
    
    if (!pathMatch || !pathMatch[1]) {
      throw new Error('Invalid Firebase Storage URL');
    }

    const filePath = decodeURIComponent(pathMatch[1]);
    const fileRef = ref(storage, filePath);

    console.log('[Firebase] Deleting file:', {
      url,
      filePath,
    });

    await deleteObject(fileRef);

    console.log('[Firebase] Delete successful:', filePath);
  } catch (error) {
    console.error('[Firebase] Delete failed:', error);
    throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Get the storage reference for a given path
 * @param path - The path to the file in storage
 */
export const getStorageRef = (path: string) => {
  return ref(storage, path);
};

/**
 * Upload a blob to Firebase Storage
 * @param blob - The blob to upload
 * @param userId - The user ID for organizing files
 * @param filename - The desired filename
 * @returns The download URL of the uploaded file
 */
export const uploadBlobToFirebase = async (
  blob: Blob,
  userId: string,
  filename: string
): Promise<string> => {
  try {
    const timestamp = Date.now();
    const fileName = `passport-photos/${userId}/${timestamp}-${filename}`;
    const storageRef = ref(storage, fileName);

    console.log('[Firebase] Uploading blob:', {
      fileName,
      size: blob.size,
      type: blob.type,
    });

    const snapshot = await uploadBytes(storageRef, blob, {
      contentType: blob.type || 'image/jpeg',
      customMetadata: {
        uploadedBy: userId,
        uploadedAt: new Date().toISOString(),
      },
    });

    const downloadURL = await getDownloadURL(snapshot.ref);

    console.log('[Firebase] Blob upload successful:', {
      fileName,
      downloadURL,
    });

    return downloadURL;
  } catch (error) {
    console.error('[Firebase] Blob upload failed:', error);
    throw new Error(`Failed to upload blob: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const downloadFile = async (fileUrl: string): Promise<void> => {
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
};