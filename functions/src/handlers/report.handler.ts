/**
 * Report Handler
 * Orchestrates report generation, storage, and retrieval
 */

import {
  ReportPeriod,
  GenerateReportRequest,
  GenerateReportResponse,
  ReportMetadata,
} from '../types/report.types';
import { aggregateReportData } from '../services/report.data.service';
import { generatePDF, closeBrowser } from '../services/report.pdf.service';
import {
  uploadPDFToStorage,
  getReportDownloadUrl,
} from '../services/report.storage.service';
import {
  saveReportMetadata,
  getRecentReportMetadata,
  getReportMetadata,
} from '../services/report.metadata.service';
import { logger } from '../utils/logger';

/**
 * Generate a new report
 */
export async function handleGenerateReport(
  request: GenerateReportRequest
): Promise<GenerateReportResponse> {
  const { shopId, period, dateRange, userPhone } = request;

  try {
    logger.info('Starting report generation', {
      shopId,
      period,
      dateRange,
      userPhone,
    });

    // Step 1: Aggregate data
    const reportData = await aggregateReportData(shopId, dateRange, period);
    if (!reportData) {
      return {
        success: false,
        error: 'Failed to aggregate report data',
        message: 'Could not find shop or data for the specified period',
      };
    }

    // Step 2: Generate PDF
    const pdfBuffer = await generatePDF(reportData, period, shopId);

    // Step 3: Upload to Cloud Storage
    const { reportId, downloadUrl, cloudStoragePath } =
      await uploadPDFToStorage(shopId, pdfBuffer, period);

    // Step 4: Save metadata to Firestore
    const metadata: ReportMetadata = {
      id: reportId,
      shopId,
      period,
      dateRange,
      startDate: reportData.startDate,
      endDate: reportData.endDate,
      startDateTimestamp: new Date(
        reportData.startDate.split('/').reverse().join('-')
      ).getTime(),
      endDateTimestamp: new Date(
        reportData.endDate.split('/').reverse().join('-')
      ).getTime(),
      generatedAt: Date.now(),
      generatedBy: userPhone,
      downloadUrl,
      fileSize: pdfBuffer.length,
      cloudStoragePath,
    };

    await saveReportMetadata(shopId, metadata);

    logger.info('Report generated successfully', {
      shopId,
      reportId,
      period,
      fileSize: pdfBuffer.length,
    });

    return {
      success: true,
      reportId,
      downloadUrl,
      message: `${period.charAt(0).toUpperCase() + period.slice(1)} report generated successfully`,
    };
  } catch (error) {
    logger.error('Failed to generate report', {
      shopId,
      period,
      dateRange,
      error,
    });

    return {
      success: false,
      error: 'Failed to generate report',
      message: 'An error occurred while generating the report. Please try again.',
    };
  } finally {
    // Always close browser to free resources
    await closeBrowser();
  }
}

/**
 * Get recent reports for selection menu
 */
export async function handleGetRecentReports(
  shopId: string,
  period: ReportPeriod,
  limit: number = 5
): Promise<ReportMetadata[]> {
  try {
    const reports = await getRecentReportMetadata(shopId, period, limit);
    logger.info('Retrieved recent reports', {
      shopId,
      period,
      count: reports.length,
    });
    return reports;
  } catch (error) {
    logger.error('Failed to get recent reports', { shopId, period, error });
    return [];
  }
}

/**
 * Get a specific report for download
 */
export async function handleGetReportForDownload(
  shopId: string,
  reportId: string,
  period: ReportPeriod
): Promise<GenerateReportResponse> {
  try {
    const metadata = await getReportMetadata(shopId, reportId, period);

    if (!metadata) {
      return {
        success: false,
        error: 'Report not found',
        message: 'The requested report could not be found',
      };
    }

    // Refresh download URL (7-day validity)
    const downloadUrl = await getReportDownloadUrl(metadata.cloudStoragePath);

    return {
      success: true,
      reportId: metadata.id,
      downloadUrl,
      message: 'Report retrieved successfully',
    };
  } catch (error) {
    logger.error('Failed to get report for download', {
      shopId,
      reportId,
      error,
    });

    return {
      success: false,
      error: 'Failed to retrieve report',
      message: 'An error occurred while retrieving the report',
    };
  }
}

/**
 * Format report list for WhatsApp menu
 */
export function formatReportListForMenu(
  reports: ReportMetadata[],
  period: ReportPeriod
): string {
  if (reports.length === 0) {
    return `No ${period} reports available. Generate a new one?`;
  }

  let menu = `📊 Recent ${period.toUpperCase()} Reports:\n\n`;

  reports.forEach((report, index) => {
    const date = new Date(report.generatedAt);
    const dateStr = date.toLocaleDateString('en-KE');
    const timeStr = date.toLocaleTimeString('en-KE', {
      hour: '2-digit',
      minute: '2-digit',
    });

    menu += `${index + 1}. ${dateStr} at ${timeStr}\n`;
    menu += `   Period: ${report.startDate} to ${report.endDate}\n`;
    menu += `   Size: ${(report.fileSize / 1024 / 1024).toFixed(2)} MB\n\n`;
  });

  return menu;
}

/**
 * Build report selection response text
 */
export function buildReportMenuText(
  period: ReportPeriod,
  recentReports: ReportMetadata[]
): string {
  let text = `📊 ${period.toUpperCase()} Reports\n\n`;
  text += `Select an option:\n\n`;
  text += `1️⃣ Last 7 days\n`;
  text += `2️⃣ Last 30 days\n`;

  if (recentReports.length > 0) {
    text += `\nRecent Reports:\n`;
    recentReports.slice(0, 5).forEach((report, idx) => {
      const date = new Date(report.generatedAt);
      const dateStr = date.toLocaleDateString('en-KE');
      text += `${idx + 3}️⃣ ${dateStr}\n`;
    });
  }

  text += `\n0️⃣ Back`;

  return text;
}
