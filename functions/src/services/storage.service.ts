/**
 * Cloud Storage Service
 * Handles uploading files to Firebase Cloud Storage and generating download URLs
 */

import { bucket } from '../config/firebase.config';
import { logger } from '../utils/logger';

/**
 * Upload PDF to Cloud Storage
 * Returns the public download URL
 * Path: invoices/{assetId}/{tenantId}/invoice_{tenantName}_{invoiceId}.pdf
 */
export async function uploadPDFToStorage(
  pdfBuffer: Buffer,
  fileName: string,
  assetId: string,
  tenantId: string
): Promise<string> {
  try {
    const filePath = `invoices/${assetId}/${tenantId}/${fileName}`;
    const file = bucket.file(filePath);

    logger.info('Uploading PDF to Cloud Storage', {
      filePath,
      fileSize: pdfBuffer.length,
    });

    // Upload the file
    await file.save(pdfBuffer, {
      metadata: {
        contentType: 'application/pdf',
        cacheControl: 'public, max-age=31536000',
      },
    });

    logger.info('PDF uploaded successfully', { filePath });

    // Get the public download URL
    const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media`;

    logger.info('PDF download URL generated', {
      filePath,
      downloadUrl,
    });

    return downloadUrl;
  } catch (error) {
    logger.error('Failed to upload PDF to Cloud Storage', {
      error: error instanceof Error ? error.message : 'Unknown error',
      fileName,
    });
    throw error;
  }
}

/**
 * Generate PDF filename with tenant name
 * Format: invoice_{tenantName}_{invoiceId}.pdf
 */
export function generatePDFFileName(
  tenantName: string,
  invoiceId: string
): string {
  // Sanitize tenant name (remove spaces, special chars)
  const sanitizedName = tenantName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  return `invoice_${sanitizedName}_${invoiceId}.pdf`;
}
