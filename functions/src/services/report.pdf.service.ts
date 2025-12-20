/**
 * Report PDF Service
 * Generates professional PDF reports using Puppeteer
 */

import puppeteer, { Browser } from 'puppeteer';
import * as chromium from '@sparticuz/chromium';
import { ReportData, ReportPeriod } from '../types/report.types';
import { logger } from '../utils/logger';
import { db } from '../config/firebase.config';

let browser: Browser | null = null;

/**
 * Initialize Puppeteer browser
 */
async function getBrowser(): Promise<Browser> {
  if (browser) {
    return browser;
  }

  try {
    const executablePath = await (chromium as any).executablePath();

    browser = await puppeteer.launch({
      args: [...(chromium as any).args, '--no-sandbox', '--disable-setuid-sandbox'],
      executablePath,
      headless: true,
    });

    return browser;
  } catch (error) {
    logger.error('Failed to launch browser', { error });
    throw error;
  }
}

/**
 * Fetch current stock levels from Firestore
 */
async function getCurrentStockLevels(shopId: string): Promise<Record<string, { quantity: number; unit: string }>> {
  try {
    if (!shopId) {
      return {};
    }

    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const dateCode = `${day}${month}${year}`;

    const stockDoc = await db
      .collection('shops')
      .doc(shopId)
      .collection('stocks')
      .doc(dateCode)
      .get();

    if (!stockDoc.exists) {
      return {};
    }

    const data = stockDoc.data();
    const currentStock: Record<string, { quantity: number; unit: string }> = {};

    if (data) {
      Object.entries(data).forEach(([productName, record]: [string, any]) => {
        if (record && typeof record === 'object' && 'quantity' in record) {
          currentStock[productName] = {
            quantity: record.quantity || 0,
            unit: record.unit || 'pieces',
          };
        }
      });
    }

    return currentStock;
  } catch (error) {
    logger.error('Failed to fetch current stock levels', { shopId, error });
    return {};
  }
}

/**
 * Generate HTML for PDF report
 */
async function generateReportHTML(data: ReportData, period: ReportPeriod, shopId?: string): Promise<string> {
  const isWeekly = period === 'weekly';
  const reportTitle = isWeekly ? 'WEEKLY REPORT' : 'MONTHLY REPORT';
  const profitClass = data.profit >= 0 ? 'text-success' : 'text-danger';
  const profitSign = data.profit >= 0 ? '+' : '';
  const marginPercent = data.totalSales > 0 ? ((data.profit / data.totalSales) * 100).toFixed(1) : '0';

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };


  // Generate daily data table
  const dailyRows = data.dailyData
    .map(
      (day) => `
    <tr>
      <td>${day.date}</td>
      <td class="text-right">${formatCurrency(day.sales)}</td>
      <td class="text-right">${formatCurrency(day.expenses)}</td>
      <td class="text-right ${day.profit >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(day.profit)}</td>
      <td class="text-right">${day.transactionCount}</td>
    </tr>
  `
    )
    .join('');

  // Generate simple bar chart for daily sales trend (lightweight HTML approach)
  const maxDailySales = Math.max(...data.dailyData.map(d => d.sales), 1);
  const chartHTML = data.dailyData.slice(-7).map(day => {
    const barHeight = (day.sales / maxDailySales) * 60;
    const dateObj = new Date(day.date.split('/').reverse().join('-'));
    const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dateObj.getDay()];
    return `
      <div class="chart-bar">
        <div class="bar" style="height: ${barHeight}px"></div>
        <div class="bar-label">${dayName}<br/>${formatCurrency(day.sales)}</div>
      </div>
    `;
  }).join('');

  // Get actual current stock levels from Firestore (not sold units)
  const actualStockLevels = await getCurrentStockLevels(shopId || '');
  const currentStock: Record<string, { quantity: number; estimated_value: number }> = {};

  // Build current stock from actual Firestore data, with fallback to product estimates
  data.topProducts.concat(data.lowMovingProducts).forEach(product => {
    const actualStock = actualStockLevels[product.name];
    const quantity = actualStock ? actualStock.quantity : 0;

    currentStock[product.name] = {
      quantity: Math.max(0, quantity),
      estimated_value: Math.max(0, product.revenue)
    };
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${reportTitle} - ${data.shopName}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html, body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #1a1a1a;
      background: white;
      line-height: 1.4;
    }

    @page {
      size: A4;
      margin: 10mm;
      padding: 0;
      @bottom-center {
        content: "Page " counter(page) " of " counter(pages);
        font-size: 9px;
        color: #999;
      }
    }

    .page {
      page-break-after: always;
      page-break-inside: avoid;
      position: relative;
      width: 210mm;
      height: 297mm;
      margin: 0 auto;
      padding: 10mm;
      background: white;
    }

    .page:last-child {
      page-break-after: avoid;
    }

    /* Header - Premium look */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #1a472a;
      padding-bottom: 8mm;
      margin-bottom: 8mm;
      page-break-inside: avoid;
    }

    .header-left h1 {
      color: #1a472a;
      font-size: 18pt;
      font-weight: 700;
      letter-spacing: 0.5px;
      margin-bottom: 2mm;
    }

    .header-left p {
      color: #555;
      font-size: 8pt;
      margin: 1mm 0;
      font-weight: 500;
    }

    .header-right {
      text-align: right;
      font-size: 8pt;
      color: #666;
    }

    .report-period {
      background: #1a472a;
      color: white;
      padding: 3mm 5mm;
      border-radius: 2px;
      font-weight: 600;
      font-size: 9pt;
      margin-bottom: 4mm;
      display: inline-block;
    }

    .header-right p {
      margin: 1mm 0;
      font-size: 8pt;
    }

    /* KPI Cards - Compact */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 4mm;
      margin-bottom: 6mm;
      page-break-inside: avoid;
    }

    .kpi-card {
      padding: 4mm;
      border-radius: 2px;
      border-left: 2.5px solid;
      background-size: 100%;
      font-size: 8pt;
    }

    .kpi-sales {
      border-left-color: #27ae60;
      background: linear-gradient(135deg, rgba(39,174,96,0.05) 0%, rgba(39,174,96,0.02) 100%);
    }

    .kpi-expenses {
      border-left-color: #e74c3c;
      background: linear-gradient(135deg, rgba(231,76,60,0.05) 0%, rgba(231,76,60,0.02) 100%);
    }

    .kpi-profit {
      border-left-color: #2980b9;
      background: linear-gradient(135deg, rgba(41,128,185,0.05) 0%, rgba(41,128,185,0.02) 100%);
    }

    .kpi-ratio {
      border-left-color: #f39c12;
      background: linear-gradient(135deg, rgba(243,156,18,0.05) 0%, rgba(243,156,18,0.02) 100%);
    }

    .kpi-label {
      font-size: 7pt;
      color: #666;
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.3px;
      margin-bottom: 1mm;
    }

    .kpi-value {
      font-size: 11pt;
      font-weight: 700;
      color: #1a1a1a;
      margin-bottom: 1mm;
    }

    .kpi-subtext {
      font-size: 7pt;
      color: #999;
    }

    /* Section Titles */
    .section-title {
      font-size: 10pt;
      font-weight: 700;
      color: #1a472a;
      margin-top: 5mm;
      margin-bottom: 3mm;
      border-bottom: 1px solid #ddd;
      padding-bottom: 2mm;
      page-break-inside: avoid;
      letter-spacing: 0.3px;
    }

    /* Charts */
    .chart-container {
      margin-bottom: 5mm;
      page-break-inside: avoid;
      display: flex;
      gap: 3mm;
      align-items: flex-end;
      height: 50px;
      border-bottom: 1px solid #eee;
      padding-bottom: 3mm;
    }

    .chart-bar {
      display: flex;
      flex-direction: column;
      align-items: center;
      flex: 1;
      gap: 2mm;
    }

    .bar {
      width: 100%;
      background: linear-gradient(180deg, #2980b9 0%, #1a472a 100%);
      border-radius: 1px 1px 0 0;
      min-height: 5px;
      opacity: 0.85;
    }

    .bar-label {
      font-size: 7pt;
      text-align: center;
      color: #666;
      width: 100%;
      word-break: break-word;
    }

    /* Tables - Compact */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8pt;
      margin-bottom: 4mm;
      page-break-inside: avoid;
    }

    thead {
      background: #1a472a;
      color: white;
    }

    th {
      padding: 2mm 3mm;
      text-align: left;
      font-weight: 600;
      font-size: 7pt;
      letter-spacing: 0.3px;
    }

    td {
      padding: 2mm 3mm;
      border-bottom: 1px solid #f0f0f0;
      font-size: 8pt;
    }

    tbody tr:nth-child(odd) {
      background: #fafafa;
    }

    tbody tr:nth-child(even) {
      background: white;
    }

    .text-right {
      text-align: right;
    }

    .text-success {
      color: #27ae60;
      font-weight: 600;
    }

    .text-danger {
      color: #e74c3c;
      font-weight: 600;
    }

    /* Footer - On every page */
    .footer {
      border-top: 1px solid #ddd;
      padding-top: 3mm;
      font-size: 7pt;
      color: #999;
      display: flex;
      justify-content: space-between;
      margin-top: 5mm;
      page-break-inside: avoid;
    }

    .footer-left {
      flex: 1;
      line-height: 1.3;
    }

    .footer-right {
      text-align: right;
      flex: 1;
    }

    .footer-brand {
      font-weight: 600;
      color: #1a472a;
      font-size: 8pt;
      margin-bottom: 1mm;
    }

    /* Watermark */
    .watermark {
      position: fixed;
      top: 40%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-45deg);
      font-size: 80px;
      color: rgba(26, 71, 42, 0.03);
      white-space: nowrap;
      z-index: -1;
      pointer-events: none;
      font-weight: 700;
      letter-spacing: 20px;
    }

    .empty-state {
      text-align: center;
      padding: 5mm;
      color: #999;
      font-style: italic;
      font-size: 9pt;
    }

    /* Spacer to prevent footer overlap */
    .page-content {
      min-height: 210mm;
      position: relative;
    }
  </style>
</head>
<body>
  <!-- PAGE 1: EXECUTIVE SUMMARY -->
  <div class="page">
    <div class="watermark">Cogvana</div>

    <!-- Header -->
    <div class="header">
      <div class="header-left">
        <h1>${reportTitle}</h1>
        <p><strong>${data.shopName}</strong></p>
        <p>${data.location} • ${data.businessType}</p>
      </div>
      <div class="header-right">
        <div class="report-period">${data.startDate} to ${data.endDate}</div>
        <p><strong>${data.ownerName}</strong></p>
        <p>${data.phone} | ${data.email}</p>
      </div>
    </div>

    <!-- KPI Cards -->
    <div class="kpi-grid">
      <div class="kpi-card kpi-sales">
        <div class="kpi-label">Total Revenue</div>
        <div class="kpi-value">${formatCurrency(data.totalSales)}</div>
        <div class="kpi-subtext">${data.salesCount} transactions</div>
      </div>

      <div class="kpi-card kpi-expenses">
        <div class="kpi-label">Total Expenses</div>
        <div class="kpi-value">${formatCurrency(data.totalExpenses)}</div>
        <div class="kpi-subtext">${data.expenseCount} items</div>
      </div>

      <div class="kpi-card kpi-profit">
        <div class="kpi-label">Net Profit/Loss</div>
        <div class="kpi-value ${profitClass}">${profitSign}${formatCurrency(Math.abs(data.profit))}</div>
        <div class="kpi-subtext">Avg ${formatCurrency(data.averageSaleValue)}/txn</div>
      </div>

      <div class="kpi-card kpi-ratio">
        <div class="kpi-label">Profit Margin</div>
        <div class="kpi-value">${marginPercent}%</div>
        <div class="kpi-subtext">${data.transactionCount} total txns</div>
      </div>
    </div>

    <!-- Sales Trend Chart -->
    <div class="section-title">📈 Sales Trend (Last 7 Days)</div>
    <div class="chart-container">
      ${chartHTML}
    </div>

    <!-- Top Selling Products -->
    ${
      data.topProducts.length > 0
        ? `
    <div class="section-title">⭐ Top Selling Products</div>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Product</th>
          <th style="text-align: right">Qty</th>
          <th style="text-align: right">Revenue</th>
        </tr>
      </thead>
      <tbody>
        ${data.topProducts.map((p, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${p.name}</td>
          <td style="text-align: right">${Math.round(p.quantity)}</td>
          <td style="text-align: right">${formatCurrency(p.revenue)}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
    ` : ''
    }

    <!-- Low Moving Products -->
    ${
      data.lowMovingProducts.length > 0
        ? `
    <div class="section-title">⚠️ Low Moving Products</div>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Product</th>
          <th style="text-align: right">Qty</th>
          <th style="text-align: right">Revenue</th>
        </tr>
      </thead>
      <tbody>
        ${data.lowMovingProducts.map((p, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${p.name}</td>
          <td style="text-align: right">${Math.round(p.quantity)}</td>
          <td style="text-align: right">${formatCurrency(p.revenue)}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
    ` : ''
    }

    <!-- Footer on Page 1 -->
    <div class="footer">
      <div class="footer-left">
        <div class="footer-brand">COGVANA BIZ</div>
        <p style="margin-bottom: 0.5mm;">Property & Shop Management</p>
        <p style="margin: 0;">+254 791 286 165 | info@cogvana.co.ke | www.cogvana.co.ke</p>
      </div>
      <div class="footer-right">
        <p style="margin: 0;">Generated: ${new Date().toLocaleDateString('en-KE')}</p>
      </div>
    </div>
  </div>

  <!-- PAGE 2: DETAILED BREAKDOWN -->
  <div class="page">
    <div class="watermark">Cogvana</div>

    <!-- Header -->
    <div class="header">
      <div class="header-left">
        <h1>DETAILED BREAKDOWN</h1>
        <p><strong>${data.shopName}</strong></p>
      </div>
      <div class="header-right">
        <div class="report-period">${data.startDate} to ${data.endDate}</div>
      </div>
    </div>

    <!-- Expense Breakdown -->
    ${
      Object.keys(data.expenseBreakdown).length > 0
        ? `
    <div class="section-title">💰 Expense Breakdown by Category</div>
    <table>
      <thead>
        <tr>
          <th>Category</th>
          <th style="text-align: right">Amount</th>
          <th style="text-align: right">% of Total</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(data.expenseBreakdown).map(([cat, amt]) => `
        <tr>
          <td>${cat}</td>
          <td style="text-align: right">${formatCurrency(amt as number)}</td>
          <td style="text-align: right">${((((amt as number) / data.totalExpenses) * 100) || 0).toFixed(1)}%</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
    ` : ''
    }

    <!-- Daily Transactions Summary -->
    <div class="section-title">📊 Daily Transaction Summary</div>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th style="text-align: right">Revenue</th>
          <th style="text-align: right">Expenses</th>
          <th style="text-align: right">Profit/Loss</th>
          <th style="text-align: right">Count</th>
        </tr>
      </thead>
      <tbody>
        ${dailyRows}
      </tbody>
    </table>

    <!-- Stock Summary -->
    <div class="section-title">📦 Current Stock Levels</div>
    <table>
      <thead>
        <tr>
          <th>Product</th>
          <th style="text-align: right">Units</th>
          <th style="text-align: right">Est. Value</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(currentStock).slice(0, 8).map(([name, stock]) => `
        <tr>
          <td>${name}</td>
          <td style="text-align: right">${stock.quantity}</td>
          <td style="text-align: right">${formatCurrency(stock.estimated_value)}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- Footer on Page 2 -->
    <div class="footer">
      <div class="footer-left">
        <div class="footer-brand">COGVANA BIZ</div>
        <p style="margin-bottom: 0.5mm;">Property & Shop Management</p>
        <p style="margin: 0;">+254 791 286 165 | info@cogvana.co.ke | www.cogvana.co.ke</p>
      </div>
      <div class="footer-right">
        <p style="margin: 0;">© 2025 Cogvana. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generate PDF from HTML
 */
export async function generatePDF(
  data: ReportData,
  period: ReportPeriod,
  shopId?: string
): Promise<Buffer> {
  const browser = await getBrowser();

  try {
    const page = await browser.newPage();
    const html = await generateReportHTML(data, period, shopId);

    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Generate PDF with proper margins and formatting
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '25mm',
        left: '10mm',
      },
      printBackground: true,
      scale: 1,
    });

    await page.close();

    logger.info('PDF generated successfully', {
      size: pdfBuffer.length,
      shop: data.shopName,
    });

    return Buffer.from(pdfBuffer);
  } catch (error) {
    logger.error('Failed to generate PDF', { error });
    throw error;
  }
}

/**
 * Close browser connection
 */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
