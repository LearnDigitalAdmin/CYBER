/**
 * PDF Invoice Generation Service
 * Generates invoice PDFs using Puppeteer for backend processing
 */

import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { logger } from '../utils/logger';

interface InvoiceData {
  id: string;
  tenantId: number;
  propertyId: number;
  billingMonth: string;
  rentAmount: number;
  waterCharges?: number;
  powerCharges?: number;
  otherCharges?: number;
  totalAmount: number;
  amountPaid: number;
  arrears: number;
  isPaid: boolean;
  dueDate?: string;
  paidDate?: string;
}

interface TenantData {
  id: string;
  localId: number;
  name: string;
  phone?: string;
  email?: string;
  rentAmount?: number;
}

/**
 * Generate invoice PDF from tenant and invoice data
 */
export async function generateInvoicePDF(
  tenant: TenantData,
  invoice: InvoiceData,
  propertyName: string = 'Property'
): Promise<Buffer> {
  let browser: any = null;

  try {
    logger.info('Starting PDF generation', {
      tenantId: tenant.localId,
      invoiceId: invoice.id,
    });

    // Launch browser with chromium
    const launchArgs: any = {
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    };

    browser = await puppeteer.launch(launchArgs);

    const page = await browser.newPage();

    // Create HTML content for the invoice
    const htmlContent = generateInvoiceHTML(tenant, invoice, propertyName);

    // Set HTML content
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px',
      },
    });

    logger.info('PDF generated successfully', {
      tenantId: tenant.localId,
      invoiceId: invoice.id,
      size: pdfBuffer.length,
    });

    return pdfBuffer;
  } catch (error) {
    logger.error('Error generating PDF', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Generate HTML content for invoice
 */
function generateInvoiceHTML(
  tenant: TenantData,
  invoice: InvoiceData,
  propertyName: string
): string {
  const outstanding = invoice.totalAmount - invoice.amountPaid;
  const statusColor = invoice.isPaid ? '#4CAF50' : '#FF9800';
  const statusText = invoice.isPaid ? 'PAID' : 'PENDING';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          color: #333;
          line-height: 1.6;
        }

        .container {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #1976d2;
          padding-bottom: 15px;
        }

        .company-info h1 {
          color: #1976d2;
          font-size: 24px;
          margin-bottom: 5px;
        }

        .company-info p {
          font-size: 12px;
          color: #666;
        }

        .invoice-title {
          text-align: right;
        }

        .invoice-title h2 {
          color: #1976d2;
          margin-bottom: 5px;
        }

        .status-badge {
          display: inline-block;
          background-color: ${statusColor};
          color: white;
          padding: 5px 15px;
          border-radius: 20px;
          font-weight: bold;
          font-size: 12px;
          margin-top: 10px;
        }

        .invoice-details {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
          font-size: 13px;
        }

        .invoice-details p {
          margin: 5px 0;
        }

        .label {
          font-weight: bold;
          color: #1976d2;
        }

        .section {
          margin-bottom: 25px;
        }

        .section-title {
          background-color: #f5f5f5;
          padding: 10px;
          font-weight: bold;
          color: #1976d2;
          border-left: 4px solid #1976d2;
          margin-bottom: 10px;
        }

        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }

        .info-card {
          background-color: #f9f9f9;
          padding: 15px;
          border-radius: 5px;
          border: 1px solid #e0e0e0;
        }

        .info-card h3 {
          color: #1976d2;
          font-size: 13px;
          margin-bottom: 10px;
        }

        .info-card p {
          font-size: 12px;
          margin: 5px 0;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 15px;
        }

        thead {
          background-color: #f5f5f5;
        }

        th {
          text-align: left;
          padding: 10px;
          font-weight: bold;
          border-bottom: 2px solid #1976d2;
          color: #1976d2;
          font-size: 12px;
        }

        td {
          padding: 10px;
          border-bottom: 1px solid #e0e0e0;
          font-size: 12px;
        }

        .amount {
          text-align: right;
        }

        .summary {
          background-color: #f9f9f9;
          padding: 15px;
          border-radius: 5px;
          border: 1px solid #e0e0e0;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          margin: 8px 0;
          font-size: 12px;
        }

        .summary-row.total {
          font-weight: bold;
          border-top: 2px solid #1976d2;
          padding-top: 10px;
          margin-top: 10px;
          font-size: 14px;
        }

        .footer {
          margin-top: 40px;
          padding: 20px;
          background-color: #f5f5f5;
          border-radius: 5px;
          font-size: 11px;
          color: #666;
          text-align: center;
          border: 1px solid #e0e0e0;
        }

        .currency {
          font-weight: bold;
          color: #1976d2;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- Header -->
        <div class="header">
          <div class="company-info">
            <h1>PLOT YANGU</h1>
            <p>by Cogvana Biz</p>
            <p style="font-size: 11px; margin-top: 8px;">
              📧 Email: info@cogvana.co.ke<br>
              📱 Tel: 0791286165
            </p>
          </div>
          <div class="invoice-title">
            <h2>INVOICE</h2>
            <p>Invoice #: ${invoice.id}</p>
            <p>Issue Date: ${new Date().toLocaleDateString('en-KE')}</p>
            <div class="status-badge">${statusText}</div>
          </div>
        </div>

        <!-- Invoice Details -->
        <div class="invoice-details">
          <div>
            <p><span class="label">Billing Month:</span> ${invoice.billingMonth}</p>
            <p><span class="label">Due Date:</span> ${invoice.dueDate || 'Not specified'}</p>
          </div>
          <div>
            <p><span class="label">Property:</span> ${propertyName}</p>
            <p><span class="label">Tenant ID:</span> ${invoice.tenantId}</p>
          </div>
        </div>

        <!-- Tenant & Property Info -->
        <div class="section">
          <div class="section-title">TENANT & PROPERTY INFORMATION</div>
          <div class="info-grid">
            <div class="info-card">
              <h3>Tenant Details</h3>
              <p><strong>${tenant.name}</strong></p>
              <p>ID: ${tenant.localId}</p>
              ${tenant.phone ? `<p>Phone: ${tenant.phone}</p>` : ''}
              ${tenant.email ? `<p>Email: ${tenant.email}</p>` : ''}
            </div>
            <div class="info-card">
              <h3>Property Details</h3>
              <p><strong>${propertyName}</strong></p>
              <p>Property ID: ${invoice.propertyId}</p>
              <p>Billing Month: ${invoice.billingMonth}</p>
            </div>
          </div>
        </div>

        <!-- Billing Details -->
        <div class="section">
          <div class="section-title">BILLING DETAILS</div>
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th class="amount">Amount (KES)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Monthly Rent</td>
                <td class="amount"><span class="currency">Ksh</span> ${invoice.rentAmount.toLocaleString('en-KE')}</td>
              </tr>
              ${invoice.waterCharges ? `
              <tr>
                <td>Water Charges</td>
                <td class="amount"><span class="currency">Ksh</span> ${invoice.waterCharges.toLocaleString('en-KE')}</td>
              </tr>
              ` : ''}
              ${invoice.powerCharges ? `
              <tr>
                <td>Electricity Charges</td>
                <td class="amount"><span class="currency">Ksh</span> ${invoice.powerCharges.toLocaleString('en-KE')}</td>
              </tr>
              ` : ''}
              ${invoice.otherCharges ? `
              <tr>
                <td>Other Charges</td>
                <td class="amount"><span class="currency">Ksh</span> ${invoice.otherCharges.toLocaleString('en-KE')}</td>
              </tr>
              ` : ''}
            </tbody>
          </table>
        </div>

        <!-- Summary -->
        <div class="section">
          <div class="summary">
            <div class="summary-row">
              <span>Total Amount Due:</span>
              <span><span class="currency">Ksh</span> ${invoice.totalAmount.toLocaleString('en-KE')}</span>
            </div>
            <div class="summary-row">
              <span>Amount Paid:</span>
              <span><span class="currency">Ksh</span> ${invoice.amountPaid.toLocaleString('en-KE')}</span>
            </div>
            ${invoice.arrears ? `
            <div class="summary-row">
              <span>Arrears:</span>
              <span><span class="currency">Ksh</span> ${invoice.arrears.toLocaleString('en-KE')}</span>
            </div>
            ` : ''}
            <div class="summary-row total">
              <span>Outstanding Balance:</span>
              <span><span class="currency">Ksh</span> ${outstanding.toLocaleString('en-KE')}</span>
            </div>
          </div>
        </div>

        <!-- Payment Info -->
        ${invoice.paidDate ? `
        <div class="section">
          <div class="section-title">PAYMENT INFORMATION</div>
          <p><strong>Paid Date:</strong> ${invoice.paidDate}</p>
          <p><strong>Status:</strong> ${invoice.isPaid ? 'Fully Paid' : 'Partially Paid'}</p>
        </div>
        ` : ''}

        <!-- Footer -->
        <div class="footer">
          <hr style="border: none; border-top: 1px solid #ddd; margin: 15px 0;">
          <p style="font-weight: bold; color: #1976d2; margin-bottom: 8px;">Processed by Cogvana Biz WhatsApp Platform</p>
          <p style="font-size: 10px;">This invoice was automatically generated through the Plot Yangu WhatsApp-based property management system.</p>
          <p style="font-size: 10px; margin-top: 8px;">
            <strong>Company:</strong> Cogvana Biz Limited | <strong>Email:</strong> info@cogvana.co.ke | <strong>Phone:</strong> 0791286165
          </p>
          <p style="font-size: 10px; color: #999; margin-top: 8px;">Generated on ${new Date().toLocaleString('en-KE')} | Reference: ${invoice.id}</p>
          <p style="font-size: 9px; color: #bbb; margin-top: 10px; font-style: italic;">For support or inquiries, contact us via WhatsApp or email at info@cogvana.co.ke</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
