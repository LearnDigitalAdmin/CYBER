/**
 * Shop Forms Handler
 * Generates professional PDF forms for shop operations
 */

import { Request, Response } from 'express';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';


interface FormGeneratorPayload {
  shopId: string;
  formType: 'sales' | 'expenses' | 'stock';
  shopInfo: {
    shopName: string;
    ownerName: string;
    shopId: string;
  };
  cyberInfo: {
    cyberName: string;
    cyberPId: string;
    cyberEmail?: string;
    cyberPhone: string;
  };
}

/**
 * Generate professional PDF form
 */
export async function generateShopForm(req: Request, res: Response): Promise<void> {
  try {
    const { shopId, formType, shopInfo, cyberInfo } = req.body as FormGeneratorPayload;

    // Validate inputs
    if (!shopId || !formType || !['sales', 'expenses', 'stock'].includes(formType)) {
      res.status(400).json({ error: 'Invalid shopId or formType parameter' });
      return;
    }

    // Validate inputs
    if (!shopInfo || !cyberInfo) {
      res.status(400).json({ error: 'Missing shop or cyber details' });
      return;
    }

    // Generate appropriate form based on type
    let html = '';
    switch (formType) {
      case 'sales':
        html = generateSalesForm(shopInfo, cyberInfo);
        break;
      case 'expenses':
        html = generateExpensesForm(shopInfo, cyberInfo);
        break;
      case 'stock':
        html = generateStockForm(shopInfo, cyberInfo);
        break;
    }

    // Generate PDF from HTML
    const pdfBuffer = await generatePDF(html);

    // Send PDF to client
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${shopInfo.shopName}-${formType}-form.pdf"`
    );
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating form:', error);
    res.status(500).json({ error: 'Failed to generate form' });
  }
}

/**
 * Generate Sales Form HTML with Cyber & Shop Details
 */
function generateSalesForm(shopInfo: any, cyberInfo: any): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Sales Form</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: #333;
            line-height: 1.5;
            background: white;
          }

          .page {
            width: 210mm;
            height: 297mm;
            padding: 12mm 15mm;
            margin: 0 auto;
            background: white;
            page-break-after: always;
          }

          /* Header Section */
          .header {
            border-bottom: 4px solid #0891b2;
            padding-bottom: 8mm;
            margin-bottom: 8mm;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10mm;
            align-items: flex-start;
          }

          .logo-section h1 {
            font-size: 26px;
            font-weight: 900;
            color: #0891b2;
            letter-spacing: -0.5px;
          }

          .logo-section p {
            font-size: 10px;
            color: #666;
            margin-top: 1px;
            font-weight: 500;
          }

          .form-title {
            font-size: 16px;
            font-weight: bold;
            color: #1f2937;
            margin-top: 3mm;
            letter-spacing: 0.3px;
          }

          .header-contact {
            text-align: right;
            font-size: 9px;
            color: #555;
            line-height: 1.4;
          }

          .header-contact div {
            margin-bottom: 1px;
            font-weight: 500;
          }

          /* Info Sections */
          .info-section {
            background: linear-gradient(135deg, #f0fdf4 0%, #f1fdf5 100%);
            padding: 7mm;
            border-left: 4px solid #16a34a;
            margin-bottom: 6mm;
            border-radius: 2px;
          }

          .info-section-title {
            font-size: 9px;
            color: #059669;
            font-weight: bold;
            text-transform: uppercase;
            margin-bottom: 2mm;
            letter-spacing: 0.5px;
          }

          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6mm;
          }

          .info-group {
            font-size: 10px;
          }

          .info-label {
            color: #666;
            font-weight: bold;
            font-size: 9px;
            margin-bottom: 1mm;
            text-transform: uppercase;
          }

          .info-value {
            color: #1f2937;
            font-weight: 500;
            word-break: break-word;
          }

          /* Section Header */
          .section-header {
            background: #0891b2;
            color: white;
            padding: 4mm 5mm;
            margin: 8mm 0 6mm 0;
            border-radius: 2px;
            font-size: 12px;
            font-weight: bold;
            letter-spacing: 0.2px;
          }

          /* Table */
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 8mm;
            font-size: 10px;
          }

          th {
            background: #e0f2fe;
            border: 1px solid #0284c7;
            padding: 4mm;
            text-align: left;
            font-weight: bold;
            color: #0c4a6e;
            font-size: 9px;
          }

          td {
            border: 1px solid #d1d5db;
            padding: 5mm;
            height: 7mm;
          }

          tr:nth-child(even) {
            background: #f9fafb;
          }

          .total-row {
            background: #dbeafe;
            font-weight: bold;
            color: #0c4a6e;
          }

          /* Signature Section */
          .signature-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12mm;
            margin-top: 12mm;
            font-size: 10px;
          }

          .signature-block {
            border-top: 1.5px solid #000;
            padding-top: 3mm;
            text-align: center;
            margin-top: 10mm;
          }

          .signature-title {
            font-weight: bold;
            margin-top: 2mm;
            font-size: 9px;
          }

          /* Footer */
          .footer {
            margin-top: 15mm;
            padding-top: 4mm;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            font-size: 8px;
            color: #666;
            line-height: 1.4;
          }

          .footer-bold {
            font-weight: bold;
            color: #0891b2;
          }
        </style>
      </head>
      <body>
        <div class="page">
          <!-- Header -->
          <div class="header">
            <div class="logo-section">
              <h1>🔧 COGVANA</h1>
              <p>Shop Management System</p>
              <div class="form-title">📋 Daily Sales Record</div>
            </div>
            <div class="header-contact">
              <div>☎️ +254 791 286 165</div>
              <div>✉️ info@cogvana.co.ke</div>
              <div>🌐 cogvana.co.ke</div>
            </div>
          </div>

          <!-- Shop Info -->
          <div class="info-section">
            <div class="info-section-title">📦 Shop Information</div>
            <div class="info-grid">
              <div class="info-group">
                <div class="info-label">Shop Name</div>
                <div class="info-value">${shopInfo.shopName || 'N/A'}</div>
              </div>
              <div class="info-group">
                <div class="info-label">Owner</div>
                <div class="info-value">${shopInfo.ownerName || 'N/A'}</div>
              </div>
              <div class="info-group">
                <div class="info-label">Shop ID</div>
                <div class="info-value" style="font-family: monospace;">${shopInfo.shopId || 'N/A'}</div>
              </div>
              <div class="info-group">
                <div class="info-label">Date</div>
                <div class="info-value">__________________</div>
              </div>
            </div>
          </div>

          <!-- Cyber Info -->
          <div class="info-section" style="background: linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%); border-left-color: #ec4899;">
            <div class="info-section-title" style="color: #be185d;">💼 Cyber Officer Information</div>
            <div class="info-grid">
              <div class="info-group">
                <div class="info-label">Cyber Name</div>
                <div class="info-value">${cyberInfo.cyberName || 'N/A'}</div>
              </div>
              <div class="info-group">
                <div class="info-label">Cyber ID</div>
                <div class="info-value" style="font-family: monospace;">${cyberInfo.cyberPId || 'N/A'}</div>
              </div>
              <div class="info-group">
                <div class="info-label">Phone</div>
                <div class="info-value">${cyberInfo.cyberPhone || 'N/A'}</div>
              </div>
              <div class="info-group">
                <div class="info-label">Email</div>
                <div class="info-value" style="font-size: 9px;">${cyberInfo.cyberEmail || 'N/A'}</div>
              </div>
            </div>
          </div>

          <div class="section-header">Sales Details</div>

          <table>
            <thead>
              <tr>
                <th style="width: 8%;">No.</th>
                <th style="width: 25%;">Product Name</th>
                <th style="width: 12%;">Quantity</th>
                <th style="width: 12%;">Unit</th>
                <th style="width: 15%;">Price/Unit (KES)</th>
                <th style="width: 15%;">Total (KES)</th>
                <th style="width: 13%;">Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${Array.from({ length: 15 })
                .map(
                  (_, i) => `
                <tr>
                  <td style="text-align: center;">${i + 1}</td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                </tr>
              `
                )
                .join('')}
              <tr class="total-row">
                <td colspan="5" style="text-align: right; padding-right: 10mm;">TOTAL SALES (KES)</td>
                <td style="text-align: center;"></td>
                <td></td>
              </tr>
            </tbody>
          </table>

          <div class="notes-section">
            <div class="notes-label">Notes / Remarks</div>
            <div class="notes-box"></div>
          </div>

          <div class="signature-section">
            <div class="signature-block">
              <div class="signature-title">Seller's Signature</div>
              <div style="height: 15mm;"></div>
            </div>
            <div class="signature-block">
              <div class="signature-title">Cyber Officer's Signature</div>
              <div style="height: 15mm;"></div>
            </div>
          </div>

          <div class="footer">
            <strong>Cogvana Shop Management System</strong> | Print this form, fill manually, and submit to your cyber officer | www.cogvana.co.ke
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Generate Expenses Form HTML with Cyber & Shop Details
 */
function generateExpensesForm(shopInfo: any, cyberInfo: any): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Expenses Form</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: #333;
            line-height: 1.5;
            background: white;
          }

          .page {
            width: 210mm;
            height: 297mm;
            padding: 12mm 15mm;
            margin: 0 auto;
            background: white;
            page-break-after: always;
          }

          /* Header Section */
          .header {
            border-bottom: 4px solid #ea580c;
            padding-bottom: 8mm;
            margin-bottom: 8mm;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10mm;
            align-items: flex-start;
          }

          .logo-section h1 {
            font-size: 26px;
            font-weight: 900;
            color: #ea580c;
            letter-spacing: -0.5px;
          }

          .logo-section p {
            font-size: 10px;
            color: #666;
            margin-top: 1px;
            font-weight: 500;
          }

          .form-title {
            font-size: 16px;
            font-weight: bold;
            color: #1f2937;
            margin-top: 3mm;
            letter-spacing: 0.3px;
          }

          .header-contact {
            text-align: right;
            font-size: 9px;
            color: #555;
            line-height: 1.4;
          }

          .header-contact div {
            margin-bottom: 1px;
            font-weight: 500;
          }

          /* Info Sections */
          .info-section {
            background: linear-gradient(135deg, #f0fdf4 0%, #f1fdf5 100%);
            padding: 7mm;
            border-left: 4px solid #16a34a;
            margin-bottom: 6mm;
            border-radius: 2px;
          }

          .info-section-title {
            font-size: 9px;
            color: #059669;
            font-weight: bold;
            text-transform: uppercase;
            margin-bottom: 2mm;
            letter-spacing: 0.5px;
          }

          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6mm;
          }

          .info-group {
            font-size: 10px;
          }

          .info-label {
            color: #666;
            font-weight: bold;
            font-size: 9px;
            margin-bottom: 1mm;
            text-transform: uppercase;
          }

          .info-value {
            color: #1f2937;
            font-weight: 500;
            word-break: break-word;
          }

          /* Section Header */
          .section-header {
            background: #ea580c;
            color: white;
            padding: 4mm 5mm;
            margin: 8mm 0 6mm 0;
            border-radius: 2px;
            font-size: 12px;
            font-weight: bold;
            letter-spacing: 0.2px;
          }

          /* Table */
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 8mm;
            font-size: 10px;
          }

          th {
            background: #fef3c7;
            border: 1px solid #f59e0b;
            padding: 4mm;
            text-align: left;
            font-weight: bold;
            color: #92400e;
            font-size: 9px;
          }

          td {
            border: 1px solid #d1d5db;
            padding: 5mm;
            height: 7mm;
          }

          tr:nth-child(even) {
            background: #f9fafb;
          }

          .total-row {
            background: #fef3c7;
            font-weight: bold;
            color: #92400e;
          }

          /* Signature Section */
          .signature-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12mm;
            margin-top: 12mm;
            font-size: 10px;
          }

          .signature-block {
            border-top: 1.5px solid #000;
            padding-top: 3mm;
            text-align: center;
            margin-top: 10mm;
          }

          .signature-title {
            font-weight: bold;
            margin-top: 2mm;
            font-size: 9px;
          }

          /* Footer */
          .footer {
            margin-top: 15mm;
            padding-top: 4mm;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            font-size: 8px;
            color: #666;
            line-height: 1.4;
          }

          .footer-bold {
            font-weight: bold;
            color: #ea580c;
          }
        </style>
      </head>
      <body>
        <div class="page">
          <!-- Header -->
          <div class="header">
            <div class="logo-section">
              <h1>🔧 COGVANA</h1>
              <p>Shop Management System</p>
              <div class="form-title">💰 Daily Expenses Record</div>
            </div>
            <div class="header-contact">
              <div>☎️ +254 791 286 165</div>
              <div>✉️ info@cogvana.co.ke</div>
              <div>🌐 cogvana.co.ke</div>
            </div>
          </div>

          <!-- Shop Info -->
          <div class="info-section">
            <div class="info-section-title">📦 Shop Information</div>
            <div class="info-grid">
              <div class="info-group">
                <div class="info-label">Shop Name</div>
                <div class="info-value">${shopInfo.shopName || 'N/A'}</div>
              </div>
              <div class="info-group">
                <div class="info-label">Owner</div>
                <div class="info-value">${shopInfo.ownerName || 'N/A'}</div>
              </div>
              <div class="info-group">
                <div class="info-label">Shop ID</div>
                <div class="info-value" style="font-family: monospace;">${shopInfo.shopId || 'N/A'}</div>
              </div>
              <div class="info-group">
                <div class="info-label">Date</div>
                <div class="info-value">__________________</div>
              </div>
            </div>
          </div>

          <!-- Cyber Info -->
          <div class="info-section" style="background: linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%); border-left-color: #ec4899;">
            <div class="info-section-title" style="color: #be185d;">💼 Cyber Officer Information</div>
            <div class="info-grid">
              <div class="info-group">
                <div class="info-label">Cyber Name</div>
                <div class="info-value">${cyberInfo.cyberName || 'N/A'}</div>
              </div>
              <div class="info-group">
                <div class="info-label">Cyber ID</div>
                <div class="info-value" style="font-family: monospace;">${cyberInfo.cyberPId || 'N/A'}</div>
              </div>
              <div class="info-group">
                <div class="info-label">Phone</div>
                <div class="info-value">${cyberInfo.cyberPhone || 'N/A'}</div>
              </div>
              <div class="info-group">
                <div class="info-label">Email</div>
                <div class="info-value" style="font-size: 9px;">${cyberInfo.cyberEmail || 'N/A'}</div>
              </div>
            </div>
          </div>

          <div class="section-header">Expenses Details</div>

          <table>
            <thead>
              <tr>
                <th style="width: 8%;">No.</th>
                <th style="width: 35%;">Expense Category</th>
                <th style="width: 25%;">Description</th>
                <th style="width: 18%;">Amount (KES)</th>
                <th style="width: 14%;">Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${Array.from({ length: 18 })
                .map(
                  (_, i) => `
                <tr>
                  <td style="text-align: center;">${i + 1}</td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                </tr>
              `
                )
                .join('')}
              <tr class="total-row">
                <td colspan="3" style="text-align: right; padding-right: 10mm;">TOTAL EXPENSES (KES)</td>
                <td style="text-align: center;"></td>
                <td></td>
              </tr>
            </tbody>
          </table>

          <div class="signature-section">
            <div class="signature-block">
              <div class="signature-title">Manager's Signature</div>
              <div style="height: 15mm;"></div>
            </div>
            <div class="signature-block">
              <div class="signature-title">Cyber Officer's Signature</div>
              <div style="height: 15mm;"></div>
            </div>
          </div>

          <div class="footer">
            <strong>Cogvana Shop Management System</strong> | Print this form, fill manually, and submit to your cyber officer | www.cogvana.co.ke
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Generate Stock Form HTML with Cyber & Shop Details
 */
function generateStockForm(shopInfo: any, cyberInfo: any): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Stock Form</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: #333;
            line-height: 1.5;
            background: white;
          }

          .page {
            width: 210mm;
            height: 297mm;
            padding: 12mm 15mm;
            margin: 0 auto;
            background: white;
            page-break-after: always;
          }

          /* Header Section */
          .header {
            border-bottom: 4px solid #16a34a;
            padding-bottom: 8mm;
            margin-bottom: 8mm;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10mm;
            align-items: flex-start;
          }

          .logo-section h1 {
            font-size: 26px;
            font-weight: 900;
            color: #16a34a;
            letter-spacing: -0.5px;
          }

          .logo-section p {
            font-size: 10px;
            color: #666;
            margin-top: 1px;
            font-weight: 500;
          }

          .form-title {
            font-size: 16px;
            font-weight: bold;
            color: #1f2937;
            margin-top: 3mm;
            letter-spacing: 0.3px;
          }

          .header-contact {
            text-align: right;
            font-size: 9px;
            color: #555;
            line-height: 1.4;
          }

          .header-contact div {
            margin-bottom: 1px;
            font-weight: 500;
          }

          /* Info Sections */
          .info-section {
            background: linear-gradient(135deg, #f0fdf4 0%, #f1fdf5 100%);
            padding: 7mm;
            border-left: 4px solid #16a34a;
            margin-bottom: 6mm;
            border-radius: 2px;
          }

          .info-section-title {
            font-size: 9px;
            color: #059669;
            font-weight: bold;
            text-transform: uppercase;
            margin-bottom: 2mm;
            letter-spacing: 0.5px;
          }

          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6mm;
          }

          .info-group {
            font-size: 10px;
          }

          .info-label {
            color: #666;
            font-weight: bold;
            font-size: 9px;
            margin-bottom: 1mm;
            text-transform: uppercase;
          }

          .info-value {
            color: #1f2937;
            font-weight: 500;
            word-break: break-word;
          }

          /* Section Header */
          .section-header {
            background: #16a34a;
            color: white;
            padding: 4mm 5mm;
            margin: 8mm 0 6mm 0;
            border-radius: 2px;
            font-size: 12px;
            font-weight: bold;
            letter-spacing: 0.2px;
          }

          /* Table */
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 8mm;
            font-size: 10px;
          }

          th {
            background: #dcfce7;
            border: 1px solid #22c55e;
            padding: 4mm;
            text-align: left;
            font-weight: bold;
            color: #166534;
            font-size: 9px;
          }

          td {
            border: 1px solid #d1d5db;
            padding: 5mm;
            height: 7mm;
          }

          tr:nth-child(even) {
            background: #f9fafb;
          }

          /* Signature Section */
          .signature-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12mm;
            margin-top: 12mm;
            font-size: 10px;
          }

          .signature-block {
            border-top: 1.5px solid #000;
            padding-top: 3mm;
            text-align: center;
            margin-top: 10mm;
          }

          .signature-title {
            font-weight: bold;
            margin-top: 2mm;
            font-size: 9px;
          }

          /* Footer */
          .footer {
            margin-top: 15mm;
            padding-top: 4mm;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            font-size: 8px;
            color: #666;
            line-height: 1.4;
          }

          .footer-bold {
            font-weight: bold;
            color: #16a34a;
          }
        </style>
      </head>
      <body>
        <div class="page">
          <!-- Header -->
          <div class="header">
            <div class="logo-section">
              <h1>🔧 COGVANA</h1>
              <p>Shop Management System</p>
              <div class="form-title">📦 Stock Inventory Record</div>
            </div>
            <div class="header-contact">
              <div>☎️ +254 791 286 165</div>
              <div>✉️ info@cogvana.co.ke</div>
              <div>🌐 cogvana.co.ke</div>
            </div>
          </div>

          <!-- Shop Info -->
          <div class="info-section">
            <div class="info-section-title">📦 Shop Information</div>
            <div class="info-grid">
              <div class="info-group">
                <div class="info-label">Shop Name</div>
                <div class="info-value">${shopInfo.shopName || 'N/A'}</div>
              </div>
              <div class="info-group">
                <div class="info-label">Owner</div>
                <div class="info-value">${shopInfo.ownerName || 'N/A'}</div>
              </div>
              <div class="info-group">
                <div class="info-label">Shop ID</div>
                <div class="info-value" style="font-family: monospace;">${shopInfo.shopId || 'N/A'}</div>
              </div>
              <div class="info-group">
                <div class="info-label">Date</div>
                <div class="info-value">__________________</div>
              </div>
            </div>
          </div>

          <!-- Cyber Info -->
          <div class="info-section" style="background: linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%); border-left-color: #ec4899;">
            <div class="info-section-title" style="color: #be185d;">💼 Cyber Officer Information</div>
            <div class="info-grid">
              <div class="info-group">
                <div class="info-label">Cyber Name</div>
                <div class="info-value">${cyberInfo.cyberName || 'N/A'}</div>
              </div>
              <div class="info-group">
                <div class="info-label">Cyber ID</div>
                <div class="info-value" style="font-family: monospace;">${cyberInfo.cyberPId || 'N/A'}</div>
              </div>
              <div class="info-group">
                <div class="info-label">Phone</div>
                <div class="info-value">${cyberInfo.cyberPhone || 'N/A'}</div>
              </div>
              <div class="info-group">
                <div class="info-label">Email</div>
                <div class="info-value" style="font-size: 9px;">${cyberInfo.cyberEmail || 'N/A'}</div>
              </div>
            </div>
          </div>

          <div class="section-header">Current Stock Inventory</div>

          <table>
            <thead>
              <tr>
                <th style="width: 8%;">No.</th>
                <th style="width: 30%;">Product Name</th>
                <th style="width: 15%;">Quantity</th>
                <th style="width: 15%;">Unit</th>
                <th style="width: 18%;">Reorder Level</th>
                <th style="width: 14%;">Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${Array.from({ length: 20 })
                .map(
                  (_, i) => `
                <tr>
                  <td style="text-align: center;">${i + 1}</td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>

          <div class="signature-section">
            <div class="signature-block">
              <div class="signature-title">Stock Manager's Signature</div>
              <div style="height: 15mm;"></div>
            </div>
            <div class="signature-block">
              <div class="signature-title">Cyber Officer's Signature</div>
              <div style="height: 15mm;"></div>
            </div>
          </div>

          <div class="footer">
            <strong>Cogvana Shop Management System</strong> | Print this form, fill manually, and submit to your cyber officer | www.cogvana.co.ke
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Generate PDF from HTML using Puppeteer
 */
async function generatePDF(html: string): Promise<Buffer> {
  let browser: any = null;

  try {
    browser = await puppeteer.launch({
      args: chromium.args || [],
      defaultViewport: {
        width: 1024,
        height: 768,
      } as any,
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: {
        top: '10mm',
        bottom: '10mm',
        left: '10mm',
        right: '10mm',
      },
      printBackground: true,
    });

    return Buffer.from(pdfBuffer);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
