/**
 * Report Metadata Service
 * Manages storing and retrieving report metadata from Firestore
 */

import { db } from '../config/firebase.config';
import {
  ReportMetadata,
  ReportPeriod,
} from '../types/report.types';
import { logger } from '../utils/logger';

/**
 * Save report metadata to Firestore
 */
export async function saveReportMetadata(
  shopId: string,
  metadata: ReportMetadata
): Promise<ReportMetadata> {
  try {
    const reportId = metadata.id;
    const collectionName =
      metadata.period === 'weekly' ? 'weeklyReports' : 'monthlyReports';

    const reportData: ReportMetadata = metadata;

    // Save to Firestore
    await db
      .collection('shops')
      .doc(shopId)
      .collection(collectionName)
      .doc(reportId)
      .set(reportData, { merge: true });

    logger.info('Report metadata saved to Firestore', {
      shopId,
      reportId,
      period: metadata.period,
    });

    return reportData;
  } catch (error) {
    logger.error('Failed to save report metadata', { shopId, error });
    throw error;
  }
}

/**
 * Get specific report by ID
 */
export async function getReportMetadata(
  shopId: string,
  reportId: string,
  period: ReportPeriod
): Promise<ReportMetadata | null> {
  try {
    const collectionName = period === 'weekly' ? 'weeklyReports' : 'monthlyReports';

    const doc = await db
      .collection('shops')
      .doc(shopId)
      .collection(collectionName)
      .doc(reportId)
      .get();

    if (!doc.exists) {
      logger.warn('Report metadata not found', { shopId, reportId, period });
      return null;
    }

    return doc.data() as ReportMetadata;
  } catch (error) {
    logger.error('Failed to get report metadata', { shopId, reportId, error });
    return null;
  }
}

/**
 * Get recent reports for a shop
 */
export async function getRecentReportMetadata(
  shopId: string,
  period: ReportPeriod,
  limit: number = 5
): Promise<ReportMetadata[]> {
  try {
    const collectionName = period === 'weekly' ? 'weeklyReports' : 'monthlyReports';

    const snapshot = await db
      .collection('shops')
      .doc(shopId)
      .collection(collectionName)
      .orderBy('generatedAt', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => doc.data() as ReportMetadata);
  } catch (error) {
    logger.error('Failed to get recent report metadata', {
      shopId,
      period,
      error,
    });
    return [];
  }
}

/**
 * Get reports within date range
 */
export async function getReportsByDateRange(
  shopId: string,
  period: ReportPeriod,
  startTimestamp: number,
  endTimestamp: number
): Promise<ReportMetadata[]> {
  try {
    const collectionName = period === 'weekly' ? 'weeklyReports' : 'monthlyReports';

    const snapshot = await db
      .collection('shops')
      .doc(shopId)
      .collection(collectionName)
      .where('generatedAt', '>=', startTimestamp)
      .where('generatedAt', '<=', endTimestamp)
      .orderBy('generatedAt', 'desc')
      .get();

    return snapshot.docs.map((doc) => doc.data() as ReportMetadata);
  } catch (error) {
    logger.error('Failed to get reports by date range', {
      shopId,
      period,
      error,
    });
    return [];
  }
}

/**
 * Delete report metadata from Firestore
 */
export async function deleteReportMetadata(
  shopId: string,
  reportId: string,
  period: ReportPeriod
): Promise<void> {
  try {
    const collectionName = period === 'weekly' ? 'weeklyReports' : 'monthlyReports';

    await db
      .collection('shops')
      .doc(shopId)
      .collection(collectionName)
      .doc(reportId)
      .delete();

    logger.info('Report metadata deleted from Firestore', {
      shopId,
      reportId,
      period,
    });
  } catch (error) {
    logger.error('Failed to delete report metadata', {
      shopId,
      reportId,
      error,
    });
    throw error;
  }
}

/**
 * Update report metadata
 */
export async function updateReportMetadata(
  shopId: string,
  reportId: string,
  period: ReportPeriod,
  updates: Partial<ReportMetadata>
): Promise<void> {
  try {
    const collectionName = period === 'weekly' ? 'weeklyReports' : 'monthlyReports';

    await db
      .collection('shops')
      .doc(shopId)
      .collection(collectionName)
      .doc(reportId)
      .update(updates);

    logger.info('Report metadata updated', {
      shopId,
      reportId,
      period,
    });
  } catch (error) {
    logger.error('Failed to update report metadata', {
      shopId,
      reportId,
      error,
    });
    throw error;
  }
}
