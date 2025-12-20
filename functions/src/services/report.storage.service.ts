/**
 * Report Storage Service
 * Handles uploading PDFs to Cloud Storage and managing metadata
 */

import { bucket } from '../config/firebase.config';
import { logger } from '../utils/logger';

/**
 * Generate unique report ID with timestamp
 */
function generateReportId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `${timestamp}-${random}`;
}

/**
 * Upload PDF to Cloud Storage
 */
export async function uploadPDFToStorage(
  shopId: string,
  pdfBuffer: Buffer,
  reportType: 'weekly' | 'monthly'
): Promise<{ reportId: string; downloadUrl: string; cloudStoragePath: string }> {
  const reportId = generateReportId();
  const timestamp = new Date().toISOString();
  const cloudStoragePath = `reports/${shopId}/${reportType}/${reportId}.pdf`;

  try {
    const file = bucket.file(cloudStoragePath);

    // Upload PDF to Cloud Storage
    await file.save(pdfBuffer, {
      metadata: {
        contentType: 'application/pdf',
        cacheControl: 'public, max-age=3600',
        metadata: {
          shopId,
          reportType,
          reportId,
          uploadedAt: timestamp,
        },
      },
    });

    logger.info('PDF uploaded to Cloud Storage', {
      shopId,
      reportId,
      cloudStoragePath,
      fileSize: pdfBuffer.length,
    });

    // Make file publicly readable
    await file.makePublic();

    // Generate public URL
    const bucketName = bucket.name;
    const downloadUrl = `https://storage.googleapis.com/${bucketName}/${cloudStoragePath}`;

    logger.info('Generated download URL', {
      reportId,
      downloadUrl,
    });

    return {
      reportId,
      downloadUrl,
      cloudStoragePath,
    };
  } catch (error) {
    logger.error('Failed to upload PDF to Cloud Storage', {
      shopId,
      reportType,
      error,
    });
    throw error;
  }
}

/**
 * Get download URL for existing report
 */
export async function getReportDownloadUrl(
  cloudStoragePath: string
): Promise<string> {
  try {
    const file = bucket.file(cloudStoragePath);

    // Ensure file is publicly readable
    await file.makePublic().catch(() => {
      // File may already be public, ignore error
    });

    // Generate public URL
    const bucketName = bucket.name;
    const downloadUrl = `https://storage.googleapis.com/${bucketName}/${cloudStoragePath}`;

    return downloadUrl;
  } catch (error) {
    logger.error('Failed to get download URL', { cloudStoragePath, error });
    throw error;
  }
}

/**
 * Delete report from Cloud Storage
 */
export async function deleteReportFromStorage(
  cloudStoragePath: string
): Promise<void> {
  try {
    const file = bucket.file(cloudStoragePath);
    await file.delete();

    logger.info('Report deleted from Cloud Storage', { cloudStoragePath });
  } catch (error) {
    logger.error('Failed to delete report from Cloud Storage', {
      cloudStoragePath,
      error,
    });
    throw error;
  }
}

/**
 * List all reports for a shop
 */
export async function listShopReports(
  shopId: string,
  reportType: 'weekly' | 'monthly',
  limit: number = 10
): Promise<Array<{ name: string; size: number; timeCreated: string }>> {
  try {
    const prefix = `reports/${shopId}/${reportType}/`;
    const [files] = await bucket.getFiles({ prefix });

    return files
      .filter((file) => file.metadata.timeCreated)
      .sort(
        (a, b) =>
          new Date(b.metadata.timeCreated!).getTime() -
          new Date(a.metadata.timeCreated!).getTime()
      )
      .slice(0, limit)
      .map((file) => ({
        name: file.name,
        size: parseInt(file.metadata.size as string, 10),
        timeCreated: file.metadata.timeCreated!,
      }));
  } catch (error) {
    logger.error('Failed to list shop reports', { shopId, reportType, error });
    return [];
  }
}
