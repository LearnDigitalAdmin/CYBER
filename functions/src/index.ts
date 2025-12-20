import { onCall, HttpsError, onRequest } from 'firebase-functions/v2/https';
import { Storage } from '@google-cloud/storage';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { defineSecret } from 'firebase-functions/params';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import FormData from 'form-data';


//initializeApp();
if (getApps().length === 0) {
  initializeApp();
}
const storage = new Storage();
const db = getFirestore();

// Generate complete HTML template
function generateHTML(numberOfTenants: number): string {
  // Generate tenant pages HTML
  const generateTenantPage = (tenantNum: number, total: number) => `
    <div class="page">
        <div class="header">
            <div class="logo-section">
                <div class="logo">PLOT YANGU</div>
                <div class="tagline">Property Management System</div>
                <div class="form-title">Tenant Registration</div>
                <div class="form-subtitle">Tenant ${tenantNum} of ${total} - Complete all sections accurately</div>
            </div>
            <div class="header-contact">
                <div>📞 0791286165</div>
                <div>✉ info@cogvana.co.ke</div>
                <div>🌐 www.cogvana.co.ke</div>
            </div>
        </div>

        <div class="section-header">
            <div class="section-title">Section C: Tenant Personal Information</div>
        </div>

        <div class="form-row">
            <div class="form-group" style="flex: 2;">
                <label class="form-label">Full Legal Name (as per ID)</label>
                <div class="form-input"></div>
            </div>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label class="form-label">National ID Number</label>
                <div class="form-input"></div>
            </div>
            <div class="form-group">
                <label class="form-label">Date of Birth</label>
                <div class="form-input"></div>
            </div>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label class="form-label">Primary Phone Number</label>
                <div class="form-input"></div>
            </div>
            <div class="form-group">
                <label class="form-label">WhatsApp Number</label>
                <div class="form-input"></div>
            </div>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label class="form-label">Email Address</label>
                <div class="form-input"></div>
            </div>
            <div class="form-group">
                <label class="form-label">Unit Number / House Number</label>
                <div class="form-input"></div>
            </div>
        </div>

        <div class="section-header">
            <div class="section-title">Section D: Financial Information</div>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label class="form-label">Monthly Rent (KES)</label>
                <div class="form-input"></div>
            </div>
            <div class="form-group">
                <label class="form-label">Security Deposit (KES)</label>
                <div class="form-input"></div>
            </div>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label class="form-label">Standing Fees (KES)</label>
                <div class="form-input"></div>
            </div>
            <div class="form-group">
                <label class="form-label">Water Standing Fee (KES)</label>
                <div class="form-input"></div>
            </div>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label class="form-label">Water Unit Price per m³ (KES)</label>
                <div class="form-input"></div>
            </div>
            <div class="form-group">
                <label class="form-label">Power Unit Price per kWh (KES)</label>
                <div class="form-input"></div>
            </div>
        </div>

        <div class="section-header">
            <div class="section-title">Section E: Lease Period</div>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label class="form-label">Lease Start Date (DD/MM/YYYY)</label>
                <div class="form-input"></div>
            </div>
            <div class="form-group">
                <label class="form-label">Lease End Date (DD/MM/YYYY)</label>
                <div class="form-input"></div>
            </div>
        </div>

        <div class="form-group">
            <label class="form-label">Additional Notes / Special Instructions</label>
            <div class="form-input large"></div>
        </div>

        <div class="footer">
            <div class="footer-left">
                Plot Yangu © 2025 | Cogvana Corporation | Page ${tenantNum + 1}
            </div>
            <div class="footer-right">
                <div class="footer-office">For office use only:</div>
                <div class="footer-field"></div>
            </div>
        </div>
    </div>
  `;

  const tenantPagesHTML = Array.from({ length: numberOfTenants }, (_, i) => 
    generateTenantPage(i + 1, numberOfTenants)
  ).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Plot Yangu Property Registration Form</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; background: white; color: #1e293b; line-height: 1.6; }
        .page { width: 210mm; min-height: 297mm; padding: 15mm; margin: 0 auto; background: white; position: relative; }
        .header { background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%); margin: -15mm -15mm 6mm -15mm; padding: 12mm 15mm 6mm 15mm; position: relative; overflow: hidden; }
        .header::before { content: ''; position: absolute; top: -50%; right: -10%; width: 400px; height: 400px; background: rgba(255, 255, 255, 0.05); border-radius: 50%; }
        .header::after { content: ''; position: absolute; bottom: -30%; left: -5%; width: 300px; height: 300px; background: rgba(255, 255, 255, 0.03); border-radius: 50%; }
        .logo-section { position: relative; z-index: 2; }
        .logo { font-size: 28px; font-weight: 800; color: white; letter-spacing: -0.5px; margin-bottom: 2px; line-height: 1.1; }
        .tagline { font-size: 11px; color: rgba(255, 255, 255, 0.9); font-weight: 400; margin-bottom: 8px; line-height: 1.2; }
        .form-title { font-size: 20px; font-weight: 700; color: white; margin-bottom: 3px; line-height: 1.2; }
        .form-subtitle { font-size: 11px; color: rgba(255, 255, 255, 0.85); font-weight: 400; line-height: 1.2; }
        .header-contact { position: absolute; right: 15mm; top: 12mm; text-align: right; z-index: 2; }
        .header-contact div { color: white; font-size: 10px; margin-bottom: 2px; font-weight: 500; line-height: 1.3; }
        .alert-box { background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-left: 4px solid #f59e0b; padding: 12px 16px; margin-bottom: 18px; border-radius: 8px; box-shadow: 0 2px 8px rgba(245, 158, 11, 0.1); }
        .alert-title { font-weight: 700; color: #92400e; font-size: 12px; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.2; }
        .alert-text { color: #78350f; font-size: 10px; line-height: 1.5; }
        .section-header { background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); padding: 10px 16px; margin: 18px 0 14px 0; border-radius: 8px; border-left: 4px solid #0891b2; box-shadow: 0 2px 4px rgba(8, 145, 178, 0.08); }
        .section-title { font-size: 13px; font-weight: 700; color: #0c4a6e; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.2; }
        .form-row { display: flex; gap: 12px; margin-bottom: 14px; }
        .form-group { flex: 1; }
        .form-label { display: block; font-size: 10px; font-weight: 600; color: #475569; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.3px; line-height: 1.2; }
        .form-input { width: 100%; padding: 8px 10px; border: 1.5px solid #cbd5e1; border-radius: 6px; font-size: 12px; background: white; transition: all 0.2s; min-height: 34px; }
        .form-input.large { min-height: 70px; resize: vertical; }
        .checkbox-group { display: flex; gap: 20px; margin-top: 6px; }
        .checkbox-item { display: flex; align-items: center; gap: 8px; }
        .checkbox { width: 16px; height: 16px; border: 2px solid #64748b; border-radius: 4px; background: white; }
        .checkbox-label { font-size: 11px; color: #334155; font-weight: 500; line-height: 1.2; }
        .signature-section { background: #f8fafc; padding: 16px; border-radius: 8px; margin-top: 20px; border: 1.5px solid #e2e8f0; }
        .signature-row { display: flex; gap: 16px; margin-top: 12px; }
        .signature-box { flex: 1; }
        .signature-label { font-size: 10px; font-weight: 600; color: #475569; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.3px; line-height: 1.2; }
        .signature-field { width: 100%; height: 60px; border: 2px solid #cbd5e1; border-radius: 6px; background: white; }
        .date-field { width: 100%; padding: 8px 10px; border: 1.5px solid #cbd5e1; border-radius: 6px; font-size: 12px; background: white; margin-top: 6px; }
        .consent-box { background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border: 2px solid #ef4444; border-radius: 8px; padding: 14px; margin: 18px 0; }
        .consent-title { font-weight: 700; color: #991b1b; font-size: 11px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.2; }
        .consent-text { font-size: 10px; color: #7f1d1d; line-height: 1.6; margin-bottom: 6px; }
        .consent-checkbox { display: flex; align-items: flex-start; gap: 8px; margin-top: 10px; padding: 10px; background: white; border-radius: 6px; }
        .consent-checkbox .checkbox { margin-top: 2px; flex-shrink: 0; }
        .consent-checkbox-label { font-size: 10px; color: #450a0a; font-weight: 600; line-height: 1.5; }
        .footer { position: absolute; bottom: 8mm; left: 15mm; right: 15mm; border-top: 1px solid #e2e8f0; padding-top: 8px; display: flex; justify-content: space-between; align-items: center; }
        .footer-left { font-size: 9px; color: #94a3b8; line-height: 1.2; }
        .footer-right { text-align: right; }
        .footer-office { font-size: 8px; color: #cbd5e1; margin-bottom: 3px; line-height: 1.2; }
        .footer-field { width: 160px; padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 9px; background: white; }
        .page { page-break-after: always; break-after: page; }
        .section-header, .consent-box, .signature-section, .alert-box, .form-row { page-break-inside: avoid; break-inside: avoid; }
        .form-label { page-break-after: avoid; break-after: avoid; }
        p, li, .consent-text { orphans: 3; widows: 3; }
        .instruction-list { list-style: none; padding: 0; }
        .instruction-list li { padding: 10px 0; padding-left: 32px; position: relative; font-size: 11px; color: #334155; line-height: 1.6; }
        .instruction-list li::before { content: '✓'; position: absolute; left: 0; top: 10px; width: 22px; height: 22px; background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 13px; }
        .contact-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 16px; }
        .contact-card { background: white; border: 2px solid #0891b2; border-radius: 8px; padding: 14px; text-align: center; }
        .contact-icon { font-size: 22px; margin-bottom: 6px; line-height: 1; }
        .contact-label { font-size: 9px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; line-height: 1.2; }
        .contact-value { font-size: 12px; font-weight: 700; color: #0c4a6e; line-height: 1.2; }
        @media print { .page { margin: 0; page-break-after: always; } body { background: white; } }
    </style>
</head>
<body>
    <div class="page">
        <div class="header">
            <div class="logo-section">
                <div class="logo">PLOT YANGU</div>
                <div class="tagline">Property Management System</div>
                <div class="form-title">Property Registration Form</div>
                <div class="form-subtitle">Official Document for Landlord & Tenant Registration</div>
            </div>
            <div class="header-contact">
                <div>📞 0791286165</div>
                <div>✉ info@cogvana.co.ke</div>
                <div>🌐 www.cogvana.co.ke</div>
            </div>
        </div>

        <div class="alert-box">
            <div class="alert-title">⚠ Important Instructions</div>
            <div class="alert-text">
                Please complete ALL sections in BLOCK LETTERS using black or blue ink. Incomplete forms will be returned for correction. 
                This form must be submitted with required documentation to your Plot Yangu agent for processing.
            </div>
        </div>

        <div class="section-header">
            <div class="section-title">Section A: Landlord / Agent Information</div>
        </div>

        <div class="form-row">
            <div class="form-group" style="flex: 2;">
                <label class="form-label">Full Legal Name (as per ID)</label>
                <div class="form-input"></div>
            </div>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label class="form-label">National ID Number</label>
                <div class="form-input"></div>
            </div>
            <div class="form-group">
                <label class="form-label">KRA PIN (Optional)</label>
                <div class="form-input"></div>
            </div>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label class="form-label">Primary Phone Number</label>
                <div class="form-input"></div>
            </div>
            <div class="form-group">
                <label class="form-label">WhatsApp Number</label>
                <div class="form-input"></div>
            </div>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label class="form-label">Email Address</label>
                <div class="form-input"></div>
            </div>
        </div>

        <div class="form-group">
            <label class="form-label">Account Type</label>
            <div class="checkbox-group">
                <div class="checkbox-item">
                    <div class="checkbox"></div>
                    <span class="checkbox-label">Landlord (Property Owner)</span>
                </div>
                <div class="checkbox-item">
                    <div class="checkbox"></div>
                    <span class="checkbox-label">Agent (Property Manager)</span>
                </div>
            </div>
        </div>

        <div class="section-header">
            <div class="section-title">Section B: Property Information</div>
        </div>

        <div class="form-row">
            <div class="form-group" style="flex: 2;">
                <label class="form-label">Property Name / Building Name</label>
                <div class="form-input"></div>
            </div>
        </div>

        <div class="form-row">
            <div class="form-group" style="flex: 2;">
                <label class="form-label">Physical Address (Street, Area, Town/City)</label>
                <div class="form-input"></div>
            </div>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label class="form-label">County</label>
                <div class="form-input"></div>
            </div>
            <div class="form-group">
                <label class="form-label">Sub-County</label>
                <div class="form-input"></div>
            </div>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label class="form-label">Total Number of Units</label>
                <div class="form-input"></div>
            </div>
            <div class="form-group">
                <label class="form-label">Agent Commission Rate (%)</label>
                <div class="form-input"></div>
            </div>
        </div>

        <div class="form-group">
            <label class="form-label">Property Description (Type of units, amenities, etc.)</label>
            <div class="form-input large"></div>
        </div>

        <div class="footer">
            <div class="footer-left">
                Plot Yangu © 2025 | Cogvana Corporation | Page 1
            </div>
            <div class="footer-right">
                <div class="footer-office">For authorized agent use only:</div>
                <div class="footer-field"></div>
            </div>
        </div>
    </div>

    ${tenantPagesHTML}

    <div class="page">
        <div class="header">
            <div class="logo-section">
                <div class="logo">PLOT YANGU</div>
                <div class="tagline">Property Management System</div>
                <div class="form-title">Consent & Agreement</div>
                <div class="form-subtitle">Landlord/Agent Declaration</div>
            </div>
            <div class="header-contact">
                <div>📞 0791286165</div>
                <div>✉ info@cogvana.co.ke</div>
                <div>🌐 www.cogvana.co.ke</div>
            </div>
        </div>

        <div class="consent-box" style="margin-top: 10px;">
            <div class="consent-title">🔒 Important: Landlord/Agent Consent & Agreement</div>
            <div class="consent-text">
                By signing this form, I hereby acknowledge and agree to the following:
            </div>
            <div class="consent-text">
                <strong>1. Data Processing:</strong> I consent to the collection, processing, and storage of personal information by Plot Yangu Property Management System for the purpose of property management, rent collection, and service delivery.
            </div>
            <div class="consent-text">
                <strong>2. Regular Screening:</strong> I consent to regular screening and verification processes conducted through the Plot Yangu PMS, including payment history tracking, compliance monitoring, and property condition assessments through invoice analysis.
            </div>
            <div class="consent-text">
                <strong>3. Payment Terms:</strong> I understand and agree that ALL rent payments MUST be processed through the official M-Pesa payment terminal. Cash transactions are strictly prohibited for Plot Yangu managed properties.
            </div>
            <div class="consent-text">
                <strong>4. Communication:</strong> I consent to receive notifications, reminders, and important updates via SMS, email, and the Plot Yangu platform regarding property management, payments, and related matters.
            </div>
            <div class="consent-text">
                <strong>5. Data Accuracy:</strong> I confirm that all information provided in this form is true, accurate, and complete to the best of my knowledge.
            </div>
            
            <div class="consent-checkbox">
                <div class="checkbox"></div>
                <span class="consent-checkbox-label">I have read, understood, and agree to the terms and conditions stated above, including consent to regular screening through Plot Yangu PMS invoice analysis.</span>
            </div>
        </div>

        <div class="signature-section">
            <div class="signature-row">
                <div class="signature-box">
                    <div class="signature-label">Landlord/Agent Signature</div>
                    <div class="signature-field"></div>
                    <div class="date-field" style="margin-top: 6px;">Date: _______________________</div>
                </div>
                <div class="signature-box">
                    <div class="signature-label">Plot Yangu Agent Signature</div>
                    <div class="signature-field"></div>
                    <div class="date-field" style="margin-top: 6px;">Date: _______________________</div>
                </div>
            </div>
        </div>

        <div class="footer">
            <div class="footer-left">
                Plot Yangu © 2025 | Cogvana Corporation | Page ${numberOfTenants + 2}
            </div>
            <div class="footer-right">
                <div class="footer-office">For office use only:</div>
                <div class="footer-field"></div>
            </div>
        </div>
    </div>

    <div class="page">
        <div class="header">
            <div class="logo-section">
                <div class="logo">PLOT YANGU</div>
                <div class="tagline">Property Management System</div>
                <div class="form-title">Instructions & Important Information</div>
                <div class="form-subtitle">Please read carefully before submission</div>
            </div>
            <div class="header-contact">
                <div>📞 0791286165</div>
                <div>✉ info@cogvana.co.ke</div>
                <div>🌐 www.cogvana.co.ke</div>
            </div>
        </div>

        <div style="padding-top: 10px;">
            <div style="font-size: 15px; font-weight: 700; color: #0c4a6e; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 3px solid #0891b2; line-height: 1.2;">
                📋 How to Complete This Form
            </div>
            <ul class="instruction-list">
                <li>Fill in ALL sections completely and legibly in BLOCK LETTERS using black or blue ink only.</li>
                <li>Ensure all information is accurate and matches official identification documents.</li>
                <li>Attach clear photocopies of landlord/agent and all tenant National IDs.</li>
                <li>Submit completed form to your Plot Yangu agent for processing within 24-48 hours.</li>
            </ul>

            <div style="background: linear-gradient(135deg, #ecfeff 0%, #cffafe 100%); border-left: 4px solid #0891b2; padding: 14px; margin: 16px 0; border-radius: 8px;">
                <strong style="color: #0c4a6e; font-size: 12px; line-height: 1.3;">⚡ Processing Time:</strong> Registration completed within 24-48 hours of submission with all required documents.
            </div>

            <div style="font-size: 15px; font-weight: 700; color: #0c4a6e; margin: 20px 0 12px 0; padding-bottom: 6px; border-bottom: 3px solid #0891b2; line-height: 1.2;">
                💳 Payment & Service Information
            </div>
            <ul class="instruction-list">
                <li><strong>M-Pesa Payments Only:</strong> All rent payments MUST be through official M-Pesa terminal.</li>
                <li><strong>Free Trial:</strong> 30-day FREE trial for all new property registrations.</li>
                <li><strong>Monthly Plans:</strong> KES 500 - 5,600 based on property size after trial period.</li>
                <li><strong>Invoice Printing:</strong> Agents may charge up to KES 20 for printing services.</li>
            </ul>

            <div class="contact-grid" style="margin-top: 20px;">
                <div class="contact-card">
                    <div class="contact-icon">📱</div>
                    <div class="contact-label">Phone Support</div>
                    <div class="contact-value">0791286165</div>
                </div>
                <div class="contact-card">
                    <div class="contact-icon">✉️</div>
                    <div class="contact-label">Email Support</div>
                    <div class="contact-value">info@cogvana.co.ke</div>
                </div>
                <div class="contact-card">
                    <div class="contact-icon">🌐</div>
                    <div class="contact-label">Website</div>
                    <div class="contact-value">cogvana.co.ke</div>
                </div>
            </div>

            <div style="margin-top: 20px; padding: 16px; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 8px; border: 2px solid #0891b2; text-align: center;">
                <div style="font-size: 13px; font-weight: 700; color: #0c4a6e; margin-bottom: 6px; line-height: 1.3;">
                    Thank You for Choosing Plot Yangu! 🏘️
                </div>
                <div style="font-size: 10px; color: #334155; line-height: 1.5;">
                    We're committed to making property management simple, transparent, and efficient.
                </div>
            </div>
        </div>

        <div class="footer">
            <div class="footer-left">
                Plot Yangu © 2025 | Cogvana Corporation | Page ${numberOfTenants + 3}
            </div>
            <div class="footer-right">
                <div class="footer-office">Form Version: 2025.1</div>
            </div>
        </div>
    </div>

    <div class="page">
        <div class="header">
            <div class="logo-section">
                <div class="logo">PLOT YANGU</div>
                <div class="tagline">Property Management System</div>
                <div class="form-title">Privacy & Data Protection</div>
                <div class="form-subtitle">Your data security is our priority</div>
            </div>
            <div class="header-contact">
                <div>📞 0791286165</div>
                <div>✉ info@cogvana.co.ke</div>
                <div>🌐 www.cogvana.co.ke</div>
            </div>
        </div>

        <div style="padding-top: 10px;">
            <div style="font-size: 15px; font-weight: 700; color: #0c4a6e; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 3px solid #0891b2; line-height: 1.2;">
                🛡️ Data Protection Policy
            </div>
            
            <div style="font-size: 11px; color: #334155; line-height: 1.7; margin-bottom: 14px;">
                All personal information collected through this registration form is secured and encrypted in compliance with Kenya's Data Protection Act, 2019. 
                Your data is used exclusively for property management, rent collection, and service delivery purposes.
            </div>

            <div style="background: #f8fafc; padding: 14px; border-radius: 8px; border: 1.5px solid #e2e8f0; margin-bottom: 14px;">
                <div style="font-weight: 600; color: #0c4a6e; font-size: 11px; margin-bottom: 8px; line-height: 1.3;">What Information We Collect:</div>
                <ul style="margin-left: 18px; font-size: 10px; color: #334155; line-height: 1.6;">
                    <li>Personal identification details (name, ID number, contact information)</li>
                    <li>Property and tenancy information</li>
                    <li>Financial transaction data (rent payments, invoices)</li>
                    <li>Communication records and preferences</li>
                </ul>
            </div>

            <div style="background: #f8fafc; padding: 14px; border-radius: 8px; border: 1.5px solid #e2e8f0; margin-bottom: 14px;">
                <div style="font-weight: 600; color: #0c4a6e; font-size: 11px; margin-bottom: 8px; line-height: 1.3;">How We Protect Your Data:</div>
                <ul style="margin-left: 18px; font-size: 10px; color: #334155; line-height: 1.6;">
                    <li>End-to-end encryption for all sensitive information</li>
                    <li>Secure cloud storage with regular backups</li>
                    <li>Limited access controls - only authorized personnel</li>
                    <li>Regular security audits and compliance checks</li>
                    <li>No sharing of personal data with third parties without consent</li>
                </ul>
            </div>

            <div style="background: #f8fafc; padding: 14px; border-radius: 8px; border: 1.5px solid #e2e8f0; margin-bottom: 14px;">
                <div style="font-weight: 600; color: #0c4a6e; font-size: 11px; margin-bottom: 8px; line-height: 1.3;">Your Rights:</div>
                <ul style="margin-left: 18px; font-size: 10px; color: #334155; line-height: 1.6;">
                    <li>Right to access your personal data at any time</li>
                    <li>Right to request corrections or updates to your information</li>
                    <li>Right to request deletion of your data (subject to legal requirements)</li>
                    <li>Right to withdraw consent for data processing</li>
                    <li>Right to lodge complaints with the Office of the Data Protection Commissioner</li>
                </ul>
            </div>

            <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-left: 4px solid #f59e0b; padding: 14px; border-radius: 8px; margin-bottom: 14px;">
                <div style="font-weight: 600; color: #92400e; font-size: 11px; margin-bottom: 6px; line-height: 1.3;">Regular Screening Notice:</div>
                <div style="font-size: 10px; color: #78350f; line-height: 1.6;">
                    Plot Yangu conducts regular screening and verification through invoice analysis to maintain service quality and ensure compliance. 
                    This process helps identify payment patterns, detect potential issues early, and provide better service to all parties. 
                    No direct tenant screening is performed - all analysis is conducted through payment records and invoices only.
                </div>
            </div>

            <div style="font-size: 10px; color: #334155; line-height: 1.7; margin-bottom: 14px;">
                <strong>Data Retention:</strong> We retain your information for the duration of your tenancy or property management agreement, 
                plus an additional period as required by law for record-keeping and compliance purposes (typically 7 years).
            </div>

            <div style="font-size: 10px; color: #334155; line-height: 1.7; margin-bottom: 14px;">
                <strong>Contact for Privacy Concerns:</strong> If you have any questions or concerns about how your data is handled, 
                please contact our Data Protection Officer at info@cogvana.co.ke or call 0791286165.
            </div>

            <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); padding: 14px; border-radius: 8px; border: 2px solid #0891b2; margin-top: 20px;">
                <div style="font-size: 10px; color: #0c4a6e; line-height: 1.6; text-align: center;">
                    <strong>Office of the Data Protection Commissioner:</strong><br>
                    Website: www.odpc.go.ke | Email: info@odpc.go.ke | Phone: 0800 597 000
                </div>
            </div>
        </div>

        <div class="footer">
            <div class="footer-left">
                Plot Yangu © 2025 | Cogvana Corporation | Final Page
            </div>
            <div class="footer-right">
                <div class="footer-office">Form Version: 2025.1</div>
            </div>
        </div>
    </div>
</body>
</html>`;
}

export const generateRegistrationForm = onCall(
  {
    region: 'africa-south1',
    memory: '2GiB',
    timeoutSeconds: 120,
  },
  async (request) => {
    try {
      const { numberOfTenants } = request.data;

      if (!numberOfTenants || numberOfTenants < 1 || numberOfTenants > 50) {
        throw new HttpsError('invalid-argument', 'Number of tenants must be between 1 and 50');
      }

      // Check cache
      const formRef = db.collection('forms').doc(`${numberOfTenants}-tenants`);
      const formDoc = await formRef.get();

      if (formDoc.exists) {
        const data = formDoc.data();
        return {
          success: true,
          url: data?.url,
          cached: true,
          numberOfTenants,
        };
      }

      // Launch browser with chromium
      const browser = await puppeteer.launch({
        args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: { width: 1280, height: 720 },
        executablePath: await chromium.executablePath(),
        headless: true,
      });

      try {
        const page = await browser.newPage();
        
        await page.setViewport({ width: 1200, height: 1600 });
        
        const html = generateHTML(numberOfTenants);
        
        await page.setContent(html, { 
          waitUntil: 'networkidle0',
          timeout: 60000 
        });
        
        const pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          preferCSSPageSize: true,
          margin: {
            top: '0mm',
            right: '0mm',
            bottom: '0mm',
            left: '0mm',
          },
        });

        await browser.close();

        // Upload to Storage
        const bucket = storage.bucket('plot-9fd6e.firebasestorage.app');
        const fileName = `forms/${numberOfTenants}-Tenants-Registration-Form.pdf`;
        const file = bucket.file(fileName);

        await file.save(pdfBuffer, {
          metadata: {
            contentType: 'application/pdf',
            metadata: {
              numberOfTenants: numberOfTenants.toString(),
              generatedAt: new Date().toISOString(),
            },
          },
        });

        await file.makePublic();

        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

        // Save to Firestore
        await formRef.set({
          numberOfTenants,
          url: publicUrl,
          fileName,
          createdAt: new Date().toISOString(),
          fileSize: pdfBuffer.length,
        });

        return {
          success: true,
          url: publicUrl,
          cached: false,
          numberOfTenants,
        };

      } catch (error) {
        await browser.close();
        throw error;
      }

    } catch (error: any) {
      console.error('Error generating form:', error);
      throw new HttpsError('internal', error.message || 'Failed to generate registration form');
    }
  }
);



const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');//
//const META_ACCESS_TOKEN = defineSecret('META_ACCESS_TOKEN');//
const COGVANA_PAGE_ID = defineSecret('COGVANA_PAGE_ID');//
const SMB_PAGE_ID = defineSecret('SMB_PAGE_ID');//
const COGVANA_PAGE_TOKEN = defineSecret('COGVANA_PAGE_TOKEN');
const SMB_PAGE_TOKEN = defineSecret('SMB_PAGE_TOKEN');
// const LINKEDIN_ACCESS_TOKEN = defineSecret('LINKEDIN_ACCESS_TOKEN');//
// const SMB_LINKEDIN_ORG_URN = defineSecret('SMB_LINKEDIN_ORG_URN');
// const COGVANA_LINKEDIN_ORG_URN = defineSecret('COGVANA_LINKEDIN_ORG_URN');
//const FIREBASE_FUNCTION_URL = "https://us-central1-learn-000111.cloudfunctions.net/getVertexAIToken";


// Brand context for AI
const BRAND_CONTEXT = {
  cogvana: {
    name: "Cogvana",
    owner: "Cogvana Technologies (subsidiary of Cogvana Corporation)",
    description: "AI-powered e-learning platform transforming education in Africa",
    apps: {
      cogvana: {
        name: "Cogvana App",
        description: "Free Android app for students with subscriptions for premium content",
        features: "Offline-capable, gamified learning experience, social network for interactive learning, groups, virtual classrooms",
        availability: "Android (with web/PWA in development)"
      },
      cognitutor: {
        name: "Cogni Tutor",
        description: "Platform for teachers to create and sell digital certified courses",
        features: "Course creation tools, monetization platform, virtual classrooms with video/audio, content management for schools",
        availability: "Web, PWA, Android",
        preRegistration: "cogvana.co.ke/platforms/cogni"
      }
    },
    features: "AI-powered personalized learning, offline-first design for limited connectivity, virtual classrooms with video and audio support, dedicated social network for students, gamified engagement, tiered affordable subscriptions, courses on any category from K-12 to professional and tertiary education",
    target: "Students (K-12 to tertiary), teachers, educators creating courses, school administrators, educational institutions",
    demographics: "Kenyan youth, students with limited internet access, educators seeking monetization, schools needing digital content delivery",
    tone: "Casual and informal with touch of professionalism - use English, Swahili, Sheng, and slang to connect with Kenyan youth",
    languages: "English, Swahili, Sheng, and slang",
    mainLink: "https://cogvana.co.ke",
    links: {
      main: "https://cogvana.co.ke",
      cogniPreReg: "https://cogvana.co.ke/platforms/cogni",
      platforms: "https://cogvana.co.ke/platforms"
    },
    objectives: "Create awareness for apps and platform, drive installations, engage users with fun interactive posts, brand exposure and visibility, increase page following and likes, joke and engage in trivial ways, have informative fun, collect user views and feedback"
  },
  smb: {
    name: "SMB KENYA LTD",
    owner: "Cogvana Corporation",
    description: "Property management company offering digital solutions for landlords, agents, caretakers, and property managers in Kenya",
    product: {
      name: "Plot Yangu",
      fullName: "Plot Yangu Property Management System (PMS)",
      developer: "Developed by Cogvana Technologies and SMB KENYA LTD",
      description: "Simple offline-capable tool for managing properties digitally"
    },
    features: {
      core: "Tenant management, invoice generation and management, payments and rent collection, property accounting, financial statements, tenant assessment, data-driven screening, transcription and management record sheets",
      access: "Web portal (admin.cogvana.co.ke), PWA, full Android app, accessible via agents at any cyber cafe",
      offline: "Fully functional offline - no internet required for daily operations"
    },
    services: "Property management, tenant screening, property marketing, consultations, digital property management tools",
    cyberPlatform: {
      description: "Platform for cyber cafes and freelancers to become Plot Yangu agents",
      commission: "Up to 45% commission on Plot Yangu services",
      features: "File sharing with clients, products and services catalog page, payment gateway with M-Pesa support, financial insights and trends, tools to run and manage cyber operations",
      access: "cyber.cogvana.co.ke",
      explore: "cyber.cogvana.co.ke/explore"
    },
    target: "Landlords, property managers, real estate agents, caretakers, cyber cafe owners, freelancers seeking agency opportunities",
    demographics: "Property owners with 5-200 units, professional property managers, cyber cafes in residential areas, entrepreneurs",
    tone: "Professional with engaging elements - authoritative but accessible",
    mainLink: "https://cogvana.co.ke",
    links: {
      main: "https://cogvana.co.ke",
      admin: "https://admin.cogvana.co.ke",
      payments: "https://payments.cogvana.co.ke",
      cyber: "https://cyber.cogvana.co.ke",
      cyberExplore: "https://cyber.cogvana.co.ke/explore"
    },
    objectives: "Campaign for Plot Yangu PMS, educate users and public on product, drive adoption, engage users professionally, increase page following and likes, brand exposure, drive calls and messages, recruit cyber agents"
  }
};

const FORMATTING = {
  bullet: '•',
  arrow: '→',
  checkmark: '✓',
  star: '★',
  line: '━━━━━━━━━━',
  doubleArrow: '»',
  dot: '·',
  diamond: '◆',
  circle: '○'
};

const COMMON_HASHTAGS = "#Cogvana #CogniTutor #cogvana #sammuhia #plot #plotyangu #smbkenya #samuhia";

// const LINKEDIN_CONTEXT = {
//   smb: {
//     ...BRAND_CONTEXT.smb,
//     tone: "Professional, authoritative, data-driven, solution-focused B2B communication",
//     postTypes: ['thought-leadership', 'case-study', 'industry-insight', 'product-feature', 'partner-opportunity', 'best-practices', 'market-trends'],
//     hashtags: "#PropertyManagement #RealEstate #PropTech #KenyaBusiness #DigitalTransformation #RealEstateKenya #PropertyTech"
//   },
//   cogvana: {
//     ...BRAND_CONTEXT.cogvana,
//     tone: "Professional yet innovative, education-focused, impact-driven, thought leadership in EdTech",
//     postTypes: ['edtech-trends', 'learning-innovation', 'educator-spotlight', 'platform-update', 'education-insights', 'impact-story'],
//     hashtags: "#EdTech #Education #ELearning #DigitalLearning #EducationTechnology #AfricaEducation #LearningInnovation"
//   }
// };

interface Post {
  content: string;
  postType: string;
  sent: boolean;
  scheduledTime: string | null;
  sentAt: Timestamp | null;
  index: number;
  error?: string;
}

// ============================================================================
// SOCIAL MEDIA (FACEBOOK/INSTAGRAM) FUNCTIONS
// // ============================================================================
// async function getAccessToken(): Promise<string> {
//   try {
    
//     if (!FIREBASE_FUNCTION_URL) {
//       console.warn('FIREBASE_FUNCTION_URL not set');
//       return '';
//     }
//     const response = await axios.get<{ accessToken: string }>(FIREBASE_FUNCTION_URL);
//     return response.data?.accessToken || '';
//   } catch (error) {
//     console.error('Error fetching AI token:', error);
//     return '';
//   }
// }

// Generate social media posts daily at 2 AM EAT
export const generateDailyPosts = onSchedule(
  {
    schedule: '0 2 * * *',
    timeZone: 'Africa/Nairobi',
    secrets: [GEMINI_API_KEY],
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 540
  },
  async (event) => {
    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const today = getTodayDateString();

      console.log(`Generating social media posts for ${today}`);

      // Generate for Cogvana
      const cogvanaPosts = await generatePostsForPage('cogvana', model, 10);
      await db.collection('social_cogvana').doc(today).set({
        date: today,
        posts: cogvanaPosts,
        createdAt: Timestamp.now(),
        platform: 'facebook_instagram'
      });

      // Generate for SMB
      const smbPosts = await generatePostsForPage('smb', model, 10);
      await db.collection('social_smb').doc(today).set({
        date: today,
        posts: smbPosts,
        createdAt: Timestamp.now(),
        platform: 'facebook_instagram'
      });

      console.log(`✅ Generated ${cogvanaPosts.length} posts for Cogvana and ${smbPosts.length} for SMB`);
    } catch (error) {
      console.error('❌ Error generating daily posts:', error);
      throw error;
    }
  }
);

// Schedule social media posts at 3 AM EAT
export const scheduleSocialPosts = onSchedule(
  {
    schedule: '0 3 * * *',
    timeZone: 'Africa/Nairobi',
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 60
  },
  async (event) => {
    try {
      const today = getTodayDateString();
      
      const cogvanaDoc = await db.collection('social_cogvana').doc(today).get();
      const smbDoc = await db.collection('social_smb').doc(today).get();

      if (!cogvanaDoc.exists || !smbDoc.exists) {
        throw new Error('Social posts not found for today');
      }

      // Generate staggered time slots (7 AM - 9 PM)
      const timeSlots = generateTimeSlots(20, 7, 21);
      
      const cogvanaPosts: Post[] = cogvanaDoc.data()!.posts;
      const smbPosts: Post[] = smbDoc.data()!.posts;

      // Alternate between pages
      const cogvanaSlots: string[] = [];
      const smbSlots: string[] = [];
      
      timeSlots.forEach((slot, idx) => {
        if (idx % 2 === 0) cogvanaSlots.push(slot);
        else smbSlots.push(slot);
      });

      // Assign times
      cogvanaPosts.forEach((post, idx) => { post.scheduledTime = cogvanaSlots[idx]; });
      smbPosts.forEach((post, idx) => { post.scheduledTime = smbSlots[idx]; });

      await db.collection('social_cogvana').doc(today).update({ posts: cogvanaPosts });
      await db.collection('social_smb').doc(today).update({ posts: smbPosts });

      console.log('✅ Social posts scheduled successfully');
    } catch (error) {
      console.error('❌ Error scheduling social posts:', error);
      throw error;
    }
  }
);

// Publish scheduled social media posts every 5 minutes490706184128700

// ============================================================================
// LINKEDIN FUNCTIONS
// ============================================================================

// Generate LinkedIn posts daily at 2 AM EAT
// export const generateLinkedInPosts = onSchedule(
//   {
//     schedule: '0 2 * * *',
//     timeZone: 'Africa/Nairobi',
//     secrets: [GEMINI_API_KEY],
//     region: 'us-central1',
//     memory: '512MiB',
//     timeoutSeconds: 540
//   },
//   async (event) => {
//     try {
//       const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
//       const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
//       const today = getTodayDateString();

//       console.log(`Generating LinkedIn posts for ${today}`);

//       // Generate 7 posts for SMB (primary focus on LinkedIn)
//       const smbPosts = await generateLinkedInPostsForPage('smb', model, 7);
//       await db.collection('linkedin_smb').doc(today).set({
//         date: today,
//         posts: smbPosts,
//         createdAt: Timestamp.now(),
//         platform: 'linkedin'
//       });

//       // Generate 5 posts for Cogvana (secondary on LinkedIn)
//       const cogvanaPosts = await generateLinkedInPostsForPage('cogvana', model, 5);
//       await db.collection('linkedin_cogvana').doc(today).set({
//         date: today,
//         posts: cogvanaPosts,
//         createdAt: Timestamp.now(),
//         platform: 'linkedin'
//       });

//       console.log(`✅ Generated ${smbPosts.length} LinkedIn posts for SMB and ${cogvanaPosts.length} for Cogvana`);
//     } catch (error) {
//       console.error('❌ Error generating LinkedIn posts:', error);
//       throw error;
//     }
//   }
// );

// // Schedule LinkedIn posts at 3 AM EAT
// export const scheduleLinkedInPosts = onSchedule(
//   {
//     schedule: '0 3 * * *',
//     timeZone: 'Africa/Nairobi',
//     region: 'us-central1',
//     memory: '256MiB',
//     timeoutSeconds: 60
//   },
//   async (event) => {
//     try {
//       const today = getTodayDateString();
      
//       const smbDoc = await db.collection('linkedin_smb').doc(today).get();
//       const cogvanaDoc = await db.collection('linkedin_cogvana').doc(today).get();

//       if (!smbDoc.exists || !cogvanaDoc.exists) {
//         throw new Error('LinkedIn posts not found for today');
//       }

//       // Business hours: 8 AM - 6 PM for LinkedIn
//       const optimalTimes = ['08:00', '09:30', '11:00', '12:30', '14:00', '15:00', '16:00', '17:00', '09:00', '10:30', '13:00', '15:30'];
      
//       const smbPosts: Post[] = smbDoc.data()!.posts;
//       const cogvanaPosts: Post[] = cogvanaDoc.data()!.posts;

//       smbPosts.forEach((post, idx) => { post.scheduledTime = optimalTimes[idx]; });
//       cogvanaPosts.forEach((post, idx) => { post.scheduledTime = optimalTimes[idx + 7]; });

//       await db.collection('linkedin_smb').doc(today).update({ posts: smbPosts });
//       await db.collection('linkedin_cogvana').doc(today).update({ posts: cogvanaPosts });

//       console.log('✅ LinkedIn posts scheduled successfully');
//     } catch (error) {
//       console.error('❌ Error scheduling LinkedIn posts:', error);
//       throw error;
//     }
//   }
// );

// // Publish scheduled LinkedIn posts every 10 minutes
// export const publishLinkedInPosts = onSchedule(
//   {
//     schedule: '*/10 * * * *',
//     timeZone: 'Africa/Nairobi',
//     secrets: [LINKEDIN_ACCESS_TOKEN, SMB_LINKEDIN_ORG_URN, COGVANA_LINKEDIN_ORG_URN],
//     region: 'us-central1',
//     memory: '256MiB',
//     timeoutSeconds: 60
//   },
//   async (event) => {
//     try {
//       const now = new Date();
//       const today = getTodayDateString();
//       const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

//       await processLinkedInPagePosts('linkedin_smb', today, currentTime, SMB_LINKEDIN_ORG_URN.value(), LINKEDIN_ACCESS_TOKEN.value());
//       await processLinkedInPagePosts('linkedin_cogvana', today, currentTime, COGVANA_LINKEDIN_ORG_URN.value(), LINKEDIN_ACCESS_TOKEN.value());

//     } catch (error) {
//       console.error('❌ Error publishing LinkedIn posts:', error);
//     }
//   }
// );

// ============================================================================
// MANUAL TRIGGER FOR TESTING
// ============================================================================

export const manualGenerateAllPosts = onRequest(
  {
    secrets: [GEMINI_API_KEY],
    region: 'us-central1',
    memory: '1GiB',
    timeoutSeconds: 540
  },
  async (req, res) => {
    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const today = getTodayDateString();

      console.log(`🔧 MANUAL: Generating all posts for ${today}`);

      // Social Media Posts
      const cogvanaSocial = await generatePostsForPage('cogvana', model, 10);
      const smbSocial = await generatePostsForPage('smb', model, 10);

      // LinkedIn Posts
    //   const smbLinkedIn = await generateLinkedInPostsForPage('smb', model, 7);
    //   const cogvanaLinkedIn = await generateLinkedInPostsForPage('cogvana', model, 5);

      // Save to Firestore
      await Promise.all([
        db.collection('social_cogvana').doc(today).set({
          date: today,
          posts: cogvanaSocial,
          createdAt: Timestamp.now(),
          platform: 'facebook_instagram',
          generatedManually: true
        }),
        db.collection('social_smb').doc(today).set({
          date: today,
          posts: smbSocial,
          createdAt: Timestamp.now(),
          platform: 'facebook_instagram',
          generatedManually: true
        }),
        // db.collection('linkedin_smb').doc(today).set({
        //   date: today,
        //   posts: smbLinkedIn,
        //   createdAt: Timestamp.now(),
        //   platform: 'linkedin',
        //   generatedManually: true
        // }),
        // db.collection('linkedin_cogvana').doc(today).set({
        //   date: today,
        //   posts: cogvanaLinkedIn,
        //   createdAt: Timestamp.now(),
        //   platform: 'linkedin',
        //   generatedManually: true
        // })
      ]);

      // Schedule all posts
      const socialTimeSlots = generateTimeSlots(20, 7, 21);
      //const linkedInTimes = ['08:00', '09:30', '11:00', '12:30', '14:00', '15:00', '16:00', '17:00', '09:00', '10:30', '13:00', '15:30'];

      const cogvanaSocialSlots: string[] = [];
      const smbSocialSlots: string[] = [];
      
      socialTimeSlots.forEach((slot, idx) => {
        if (idx % 2 === 0) cogvanaSocialSlots.push(slot);
        else smbSocialSlots.push(slot);
      });

      cogvanaSocial.forEach((post, idx) => { post.scheduledTime = cogvanaSocialSlots[idx]; });
      smbSocial.forEach((post, idx) => { post.scheduledTime = smbSocialSlots[idx]; });
    //   smbLinkedIn.forEach((post, idx) => { post.scheduledTime = linkedInTimes[idx]; });
    //   cogvanaLinkedIn.forEach((post, idx) => { post.scheduledTime = linkedInTimes[idx + 7]; });

      await Promise.all([
        db.collection('social_cogvana').doc(today).update({ posts: cogvanaSocial }),
        db.collection('social_smb').doc(today).update({ posts: smbSocial }),
        // db.collection('linkedin_smb').doc(today).update({ posts: smbLinkedIn }),
        // db.collection('linkedin_cogvana').doc(today).update({ posts: cogvanaLinkedIn })
      ]);

      res.status(200).json({
        success: true,
        message: 'All posts generated and scheduled',
        date: today,
        counts: {
          cogvanaSocial: cogvanaSocial.length,
          smbSocial: smbSocial.length,
        //   smbLinkedIn: smbLinkedIn.length,
        //   cogvanaLinkedIn: cogvanaLinkedIn.length
        }
      });

    } catch (error) {
      console.error('❌ Manual generation error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

async function processSocialPagePosts(collection: string, today: string, currentTime: string, pageId: string, token: string) {
  console.log(`🔍 [${collection}] Starting processing for ${today} at ${currentTime}`);
  console.log(`🔍 [${collection}] PageId: ${pageId ? pageId.substring(0, 10) + '...' : 'MISSING'}`);
  console.log(`🔍 [${collection}] Token: ${token ? 'Present (length: ' + token.length + ')' : 'MISSING'}`);
  
  const docRef = db.collection(collection).doc(today);
  
  let doc;
  try {
    doc = await docRef.get();
    console.log(`✓ [${collection}] Firestore doc.get() completed`);
  } catch (error) {
    console.error(`❌ [${collection}] Firestore doc.get() failed:`, error);
    throw error;
  }

  if (!doc.exists) {
    console.log(`⚠️ [${collection}] No document exists for ${today}`);
    return;
  }

  const data = doc.data();
  console.log(`✓ [${collection}] Document data retrieved:`, data ? 'YES' : 'NO');
  
  const posts: Post[] = data?.posts || [];
  console.log(`📊 [${collection}] Total posts found: ${posts.length}`);

  if (posts.length === 0) {
    console.log(`⚠️ [${collection}] No posts array or empty array`);
    return;
  }

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    console.log(`\n📝 [${collection}] Post ${i}:`, {
      sent: post.sent,
      scheduledTime: post.scheduledTime,
      hasContent: !!post.content,
      contentLength: post.content?.length || 0
    });
    
    if (!post.scheduledTime) {
      console.log(`⚠️ [${collection}] Post ${i}: No scheduledTime`);
      continue;
    }

    if (post.sent) {
      console.log(`⏭️ [${collection}] Post ${i}: Already sent, skipping`);
      continue;
    }

    console.log(`⏰ [${collection}] Post ${i}: Comparing times - scheduled: ${post.scheduledTime}, current: ${currentTime}`);
    
    if (post.scheduledTime <= currentTime) {
      console.log(`🚀 [${collection}] Post ${i}: Ready to post!`);
      
      try {
        console.log(`📤 [${collection}] Post ${i}: Calling postToFacebook...`);
        const result = await postToFacebook(pageId, post.content, token);
        console.log(`✅ [${collection}] Post ${i}: Facebook API response:`, result);
        
        post.sent = true;
        post.sentAt = Timestamp.now();
        
        console.log(`💾 [${collection}] Post ${i}: Updating Firestore...`);
        await docRef.update({ posts });
        console.log(`✅ [${collection}] Post ${i}: Successfully posted and marked as sent at ${currentTime}`);
        
      } catch (error) {
        console.error(`❌ [${collection}] Post ${i}: Error during posting:`, error);
        console.error(`❌ [${collection}] Post ${i}: Error details:`, {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          response: (error as any).response?.data
        });
        
        post.error = error instanceof Error ? error.message : 'Unknown error';
        
        try {
          await docRef.update({ posts });
          console.log(`💾 [${collection}] Post ${i}: Error logged to Firestore`);
        } catch (updateError) {
          console.error(`❌ [${collection}] Post ${i}: Failed to update error in Firestore:`, updateError);
        }
        
        try {
          await logError('social', collection, today, i, error instanceof Error ? error.message : 'Unknown error');
          console.log(`📋 [${collection}] Post ${i}: Error logged via logError()`);
        } catch (logError) {
          console.error(`❌ [${collection}] Post ${i}: Failed to call logError():`, logError);
        }
      }
    } else {
      console.log(`⏸️ [${collection}] Post ${i}: Not yet time (scheduled: ${post.scheduledTime}, current: ${currentTime})`);
    }
  }
  
  console.log(`✓ [${collection}] Processing complete for ${today}\n`);
}

// export const publishSocialPosts = onSchedule(
//   {
//     schedule: '*/5 * * * *',
//     timeZone: 'Africa/Nairobi',
//     secrets: [COGVANA_PAGE_TOKEN, SMB_PAGE_TOKEN, COGVANA_PAGE_ID, SMB_PAGE_ID],
//     region: 'us-central1',
//     memory: '256MiB',
//     timeoutSeconds: 60
//   },
//   async (event) => {
//     console.log('\n========================================');
//     console.log('🕐 SCHEDULED FUNCTION TRIGGERED');
//     console.log('========================================');
    
//     try {
//       const now = new Date();
//       const today = getTodayDateString();
//       const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

//       console.log(`📅 Date: ${today}`);
//       console.log(`⏰ Current time: ${currentTime}`);
//       console.log(`🌍 Timezone: Africa/Nairobi`);
//       console.log(`📍 Actual UTC time: ${now.toISOString()}`);

//       console.log('\n--- Processing Cogvana ---');
//       await processSocialPagePosts('social_cogvana', today, currentTime, COGVANA_PAGE_ID.value(), COGVANA_PAGE_TOKEN.value());
      
//       console.log('\n--- Processing SMB ---');
//       await processSocialPagePosts('social_smb', today, currentTime, SMB_PAGE_ID.value(), SMB_PAGE_TOKEN.value());

//       console.log('\n========================================');
//       console.log('✅ SCHEDULED FUNCTION COMPLETED');
//       console.log('========================================\n');

//     } catch (error) {
//       console.error('\n========================================');
//       console.error('❌ CRITICAL ERROR IN SCHEDULED FUNCTION');
//       console.error('========================================');
//       console.error('Error details:', error);
//       console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
//       console.error('========================================\n');
//       throw error; // Re-throw to mark function as failed
//     }
//   }
// );
export const publishSocialPosts = onSchedule(
  {
    schedule: '*/5 * * * *',
    timeZone: 'Africa/Nairobi',
    secrets: [COGVANA_PAGE_TOKEN, SMB_PAGE_TOKEN, COGVANA_PAGE_ID, SMB_PAGE_ID],
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 60
  },
  async (event) => {
    try {
      // Convert UTC to EAT (UTC+3)
      const nowUTC = new Date();
      const nowEAT = new Date(nowUTC.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }));
      
      const today = getTodayDateString(); // Make sure this also uses EAT!
      const currentTime = `${nowEAT.getHours().toString().padStart(2, '0')}:${nowEAT.getMinutes().toString().padStart(2, '0')}`;

      console.log(`🕐 UTC Time: ${nowUTC.toISOString()}`);
      console.log(`🕐 EAT Time: ${currentTime} on ${today}`);

      await processSocialPagePosts('social_cogvana', today, currentTime, COGVANA_PAGE_ID.value(), COGVANA_PAGE_TOKEN.value());
      await processSocialPagePosts('social_smb', today, currentTime, SMB_PAGE_ID.value(), SMB_PAGE_TOKEN.value());

    } catch (error) {
      console.error('❌ Error publishing social posts:', error);
    }
  }
);

// Update your generatePostsForPage function
async function generatePostsForPage(pageType: 'cogvana' | 'smb', model: any, count: number): Promise<Post[]> {
  const brand = BRAND_CONTEXT[pageType];
  const posts: Post[] = [];
  
  const postTypes = [
    'promotional', 'promotional',
    'educational', 'educational',
    'engagement', 'engagement',
    'user-story-testimonial',
    'tips-and-tricks',
    'fun-fact-trivia',
    'strong-cta-conversion'
  ];

  for (let i = 0; i < count; i++) {
    const postType = postTypes[i];
    const prompt = buildSocialPrompt(brand, postType, pageType);
    
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      let text = response.text().trim();
      
      // 🔥 Clean and convert the text
      text = cleanPostContent(text);
      
      posts.push({
        content: text,
        postType,
        sent: false,
        scheduledTime: null,
        sentAt: null,
        index: i
      });
      
      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`Error generating post ${i} for ${pageType}:`, error);
      posts.push({
        content: `Error generating post. Please check logs.`,
        postType,
        sent: false,
        scheduledTime: null,
        sentAt: null,
        index: i,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return posts;
}

// Also update your Facebook posting function
async function postToFacebook(pageId: string, message: string, accessToken: string): Promise<any> {
  console.log(`🌐 [Facebook API] Starting post request`);
  console.log(`🌐 [Facebook API] PageId: ${pageId}`);
  console.log(`🌐 [Facebook API] Message length: ${message?.length || 0}`);
  console.log(`🌐 [Facebook API] Token present: ${!!accessToken}`);
  
  // Clean the message one more time before posting
  const cleanedMessage = cleanPostContent(message);
  
  const url = `https://graph.facebook.com/v21.0/${pageId}/feed`;
  console.log(`🌐 [Facebook API] URL: ${url}`);
  
  try {
    const form = new FormData();
    form.append('message', cleanedMessage); // Use cleaned message
    form.append('access_token', accessToken);
    
    console.log(`🌐 [Facebook API] FormData created, making POST request...`);
    
    const response = await axios.post(url, form, {
      headers: {
        ...form.getHeaders(),
        'Content-Type': 'multipart/form-data; charset=UTF-8' // Ensure UTF-8
      }
    });

    console.log(`🌐 [Facebook API] Response status: ${response.status}`);
    console.log(`🌐 [Facebook API] Response data:`, response.data);
    
    return response.data;
    
  } catch (error) {
    console.error(`🌐 [Facebook API] Request failed`);
    console.error(`🌐 [Facebook API] Error:`, error);
    
    if (axios.isAxiosError(error)) {
      console.error(`🌐 [Facebook API] Status: ${error.response?.status}`);
      console.error(`🌐 [Facebook API] Response data:`, error.response?.data);
      console.error(`🌐 [Facebook API] Headers:`, error.response?.headers);
    }
    
    throw error;
  }
}

function convertMarkdownBoldToUnicode(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, (match, content) => {
    return content.split('').map((char: string) => {
      const code = char.charCodeAt(0);
      
      // Uppercase A-Z → Mathematical Bold Capital A-Z
      if (code >= 0x41 && code <= 0x5A) {
        return String.fromCodePoint(code - 0x41 + 0x1D400);
      }
      // Lowercase a-z → Mathematical Bold Small A-Z
      else if (code >= 0x61 && code <= 0x7A) {
        return String.fromCodePoint(code - 0x61 + 0x1D41A);
      }
      // Digits 0-9 → Mathematical Bold Digit 0-9
      else if (code >= 0x30 && code <= 0x39) {
        return String.fromCodePoint(code - 0x30 + 0x1D7CE);
      }
      
      // Keep everything else (spaces, punctuation, emojis)
      return char;
    }).join('');
  });
}

// Clean up function
function cleanPostContent(text: string): string {
  // Remove [object Object] artifacts
  let cleaned = text.replace(/\[object Object\]/g, '');
  
  // Convert markdown bold to Unicode bold
  cleaned = convertMarkdownBoldToUnicode(cleaned);
  
  // Normalize Unicode to prevent encoding issues
  cleaned = cleaned.normalize('NFC');
  
  return cleaned;
}

function buildSocialPrompt(brand: any, postType: string, pageType: string): string {
  return `You are an expert social media content creator for ${brand.name}.

CRITICAL INSTRUCTIONS - READ CAREFULLY:
1. You MUST use ONLY the context provided below
2. NEVER invent features, services, or information not explicitly mentioned
3. NEVER make assumptions about the brand
4. If a detail isn't in the context, DON'T mention it
5. Stay 100% faithful to the brand voice and tone described

COMPLETE BRAND CONTEXT:
Company: ${brand.name}
Owner: ${brand.owner}
Description: ${brand.description}

${pageType === 'cogvana' ? `
APPS AND PLATFORMS:
Cogvana App: ${brand.apps.cogvana.description}
- Features: ${brand.apps.cogvana.features}
- Availability: ${brand.apps.cogvana.availability}

Cogni Tutor: ${brand.apps.cognitutor.description}
- Features: ${brand.apps.cognitutor.features}
- Availability: ${brand.apps.cognitutor.availability}
- Pre-registration: ${brand.apps.cognitutor.preRegistration}
` : ''}

${pageType === 'smb' ? `
PRODUCT: ${brand.product.fullName}
- ${brand.product.description}
- Developed by: ${brand.product.developer}

CORE FEATURES:
${brand.features.core}

ACCESS METHODS:
${brand.features.access}

OFFLINE CAPABILITY:
${brand.features.offline}

SERVICES OFFERED:
${brand.services}

CYBER AGENT PLATFORM:
${brand.cyberPlatform.description}
- Commission: ${brand.cyberPlatform.commission}
- Features: ${brand.cyberPlatform.features}
- Access: ${brand.cyberPlatform.access}
- Details: ${brand.cyberPlatform.explore}
` : ''}

COMPLETE FEATURE LIST:
${brand.features}

TARGET AUDIENCE:
${brand.target}

DEMOGRAPHICS:
${brand.demographics}

BRAND TONE & VOICE:
${brand.tone}

${pageType === 'cogvana' ? `LANGUAGES TO USE: ${brand.languages}` : ''}

AVAILABLE LINKS (use contextually appropriate link):
${Object.entries(brand.links).map(([key, url]) => `- ${key}: ${url}`).join('\n')}

OBJECTIVES:
${brand.objectives}

POST TYPE: ${postType.toUpperCase()}

POST TYPE SPECIFIC GUIDELINES:
${getPostTypeGuidance(postType, pageType)}

MANDATORY POST REQUIREMENTS:
1. Length: 100-200 words
2. Use proper spacing (double line breaks between sections)
3. Include relevant emojis (moderate use - 3-5 per post)
4. Use headings with ** for bold where appropriate
5. Use emojis strategically:
   - 1 emoji in opening line (hook)
   - Emojis as bullet points (✅, →, •)
   - 1 emoji before CTA
   - Total: 5-8 emojis per post
6. Use **bold** for key phrases (1-2 per post max)
7. Use Unicode symbols for structure:
   • Bullet points: ${FORMATTING.bullet}
   → Arrows: ${FORMATTING.arrow} or ${FORMATTING.doubleArrow}
   ✓ Checkmarks: ${FORMATTING.checkmark}
   ★ Stars: ${FORMATTING.star}
   ◆ Diamonds: ${FORMATTING.diamond}
   ━ Lines for separators: ${FORMATTING.line}

9. Make it conversational and engaging

10. MUST INCLUDE A CLEAR CTA (Call-to-Action):
   ${pageType === 'cogvana' ? `
   - "Download now and start learning! 📱"
   - "Comment below with your learning goals 💬"
   - "Share with a student who needs this! ❤️"
   - "Follow us for daily learning tips! 🎓"
   - "Click the link to explore our platform 👇"
   ` : `
   - "Send us a message to schedule a demo 📩"
   - "Visit the link to learn more 👇"
   - "Comment 'INTERESTED' for more details 💬"
   - "Call us today to get started! 📞"
   - "Follow for property management tips! ❤️"
   `}

11. MUST INCLUDE relevant link from links above

12. MUST END WITH: ${COMMON_HASHTAGS}

STRICT CONTENT RULES:
- Write in ${brand.tone}
- Base EVERYTHING on the context provided above
- Do NOT mention features not explicitly listed
- Do NOT invent statistics or data
- Do NOT reference competitors
- Keep it authentic, not salesy
- Focus on value and benefits
- Make it shareable

OUTPUT FORMAT:
Generate ONLY the post content. No explanations, no meta-commentary, just the post itself.

Generate the post now:`;
}

function getPostTypeGuidance(postType: string, pageType: string): string {
  const guidance: Record<string, string> = {
    'promotional': 'Highlight specific product features and benefits. Include a strong reason to act now. Make the value proposition crystal clear.',
    'educational': 'Teach something valuable related to your product. Provide actionable insights. Position your brand as a helpful expert.',
    'engagement': 'Ask questions, create polls (mention "what do you think?"), share relatable scenarios. Encourage comments and discussion.',
    'user-story-testimonial': 'Share a realistic success story (can be hypothetical but believable). Focus on transformation and results.',
    'tips-and-tricks': pageType === 'cogvana' ? 'Quick study tips, learning hacks, or productivity advice' : 'Property management best practices, rental tips, or business advice',
    'fun-fact-trivia': pageType === 'cogvana' ? 'Interesting education statistics or learning science facts' : 'Property market insights or real estate trivia',
    'strong-cta-conversion': 'Direct action-driving post. Clear benefit + urgent CTA + easy next step. Conversion-focused.'
  };
  
  return guidance[postType] || 'Create engaging, valuable content that resonates with the target audience.';
}

// ============================================================================
// HELPER FUNCTIONS - LINKEDIN
// ============================================================================

// async function generateLinkedInPostsForPage(pageType: 'cogvana' | 'smb', model: any, count: number): Promise<Post[]> {
//   const brand = LINKEDIN_CONTEXT[pageType];
//   const posts: Post[] = [];

//   for (let i = 0; i < count; i++) {
//     const postType = brand.postTypes[i % brand.postTypes.length];
//     const prompt = buildLinkedInPrompt(brand, postType, pageType);
    
//     try {
//       const result = await model.generateContent(prompt);
//       const response = await result.response;
//       const text = response.text().trim();
      
//       posts.push({
//         content: text,
//         postType,
//         sent: false,
//         scheduledTime: null,
//         sentAt: null,
//         index: i
//       });
      
//       // Rate limit: 1 request per 2 seconds
//       if (i < count - 1) {
//         await new Promise(resolve => setTimeout(resolve, 2000));
//       }
//     } catch (error) {
//       console.error(`Error generating LinkedIn post ${i} for ${pageType}:`, error);
//       posts.push({
//         content: `Error generating LinkedIn post. Please check logs.`,
//         postType,
//         sent: false,
//         scheduledTime: null,
//         sentAt: null,
//         index: i,
//         error: error instanceof Error ? error.message : 'Unknown error'
//       });
//     }
//   }

//   return posts;
// }

// function buildLinkedInPrompt(brand: any, postType: string, pageType: string): string {
//   const postTypeExamples: Record<string, string> = {
//     'thought-leadership': 'Share industry insights, trends, or forward-thinking perspectives about the future of your industry in Kenya/Africa',
//     'case-study': 'Tell a detailed success story showing how your solution solved a specific business problem with measurable results',
//     'industry-insight': 'Share data, research, or observations about the property management/education sector with business implications',
//     'product-feature': 'Deep-dive into a specific feature explaining its business value and ROI for professionals',
//     'partner-opportunity': 'Highlight partnership or agency opportunities with clear value proposition and earning potential',
//     'best-practices': 'Share actionable professional tips and proven strategies for success in your industry',
//     'market-trends': 'Analyze current market conditions, economic factors, or regulatory changes affecting your industry',
//     'edtech-trends': 'Discuss innovations, research, and trends in educational technology with global and local context',
//     'learning-innovation': 'Showcase innovative approaches to learning, teaching methodologies, or educational breakthroughs',
//     'educator-spotlight': 'Highlight educator success stories, innovative teaching methods, or professional development insights',
//     'platform-update': 'Share meaningful product updates with business context, value proposition, and strategic reasoning',
//     'education-insights': 'Share research, data, or analysis about education effectiveness, learning outcomes, or EdTech adoption',
//     'impact-story': 'Show measurable impact of technology on learning outcomes, student success, or institutional performance'
//   };

//   return `You are a professional LinkedIn content strategist for ${brand.name}.

// CRITICAL INSTRUCTIONS - ABSOLUTE REQUIREMENTS:
// 1. You MUST use ONLY the context provided below
// 2. NEVER invent features, services, statistics, or information not explicitly stated
// 3. NEVER make assumptions about the brand beyond what's written
// 4. If a detail isn't in the context, DON'T mention it at all
// 5. Stay 100% faithful to the brand voice, tone, and positioning described
// 6. This is LinkedIn B2B content - maintain high professional standards

// COMPLETE BRAND CONTEXT:
// Company: ${brand.name}
// Owner: ${brand.owner}
// Description: ${brand.description}

// ${pageType === 'smb' ? `
// PRODUCT DETAILS:
// Name: ${brand.product.fullName}
// Developer: ${brand.product.developer}
// Description: ${brand.product.description}

// CORE FEATURES:
// ${brand.features.core}

// ACCESS METHODS:
// ${brand.features.access}

// SERVICES:
// ${brand.services}

// CYBER AGENT PROGRAM:
// ${brand.cyberPlatform.description}
// Commission: ${brand.cyberPlatform.commission}
// Platform Features: ${brand.cyberPlatform.features}
// Access: ${brand.cyberPlatform.access}
// More Info: ${brand.cyberPlatform.explore}
// ` : `
// PLATFORM COMPONENTS:

// Cogvana App:
// - ${brand.apps.cogvana.description}
// - Features: ${brand.apps.cogvana.features}
// - Availability: ${brand.apps.cogvana.availability}

// Cogni Tutor Platform:
// - ${brand.apps.cognitutor.description}
// - Features: ${brand.apps.cognitutor.features}
// - Availability: ${brand.apps.cognitutor.availability}
// - Pre-registration: ${brand.apps.cognitutor.preRegistration}

// KEY FEATURES:
// ${brand.features}
// `}

// TARGET PROFESSIONAL AUDIENCE:
// ${brand.target}

// PROFESSIONAL DEMOGRAPHICS:
// ${brand.demographics}

// LINKEDIN TONE & VOICE:
// ${brand.tone}

// AVAILABLE LINKS (choose most contextually relevant):
// ${Object.entries(brand.links).map(([key, url]) => `- ${key}: ${url}`).join('\n')}

// BUSINESS OBJECTIVES:
// ${brand.objectives}

// POST TYPE: ${postType.toUpperCase()}

// POST TYPE GUIDANCE:
// ${postTypeExamples[postType]}

// LINKEDIN BEST PRACTICES (MANDATORY):
// 1. **Hook in First 2 Lines**: First 2 lines appear before "...see more" - MUST grab attention immediately
// 2. **Professional Tone**: Maximum 3 emojis in entire post, authoritative and credible voice
// 3. **Value-First Approach**: Lead with insights or value, NOT with sales pitch
// 4. **Data-Driven**: Include relevant business metrics, percentages, or concrete examples when appropriate (but ONLY from provided context)
// 5. **Proper Structure**: Use line breaks for readability, short paragraphs (2-3 sentences max)
// 6. **Optimal Length**: 150-300 words (LinkedIn favors substantive, valuable content)
// 7. **Story-Driven**: Frame even data/features as compelling business narratives
// 8. **Actionable**: Provide takeaways or next steps for professionals

// POST STRUCTURE (FOLLOW EXACTLY):

// [HOOK - 1-2 sentences that make professionals stop scrolling]

// [MAIN CONTENT - 2-3 paragraphs]
// - Lead with the problem or opportunity
// - Provide context, insights, or valuable information
// - Use bullet points ONLY if listing specific benefits/features
// - Include concrete examples from the context provided
// - Tie back to business value and ROI

// [CALL-TO-ACTION - Professional and specific]
// Choose the most appropriate:
// - "What's your experience with [topic]? Share in the comments."
// - "Learn more about how we're solving this: [link]"
// - "Interested in this for your organization? Let's connect."
// - "Explore the full platform: [link]"
// - "Are you facing this challenge? DM us to discuss solutions."

// [RELEVANT LINK]

// [HASHTAGS - End with: ${brand.hashtags}]

// STRICT LINKEDIN CONTENT RULES:
// - First 2 lines are CRITICAL - they determine if people click "see more"
// - Use double line breaks (\\n\\n) between sections for readability
// - Maximum 3 emojis total - use sparingly and professionally
// - Avoid casual language, slang, or overly promotional tone
// - Focus on business problems and solutions
// - Make it valuable enough that professionals want to share it
// - Base EVERYTHING on the provided context
// - DO NOT invent case studies, statistics, or features
// - DO NOT reference competitors or make comparisons
// - Realistic scenarios are OK, but must align with provided features

// BAD LINKEDIN POST EXAMPLE (Don't do this):
// "🎉 Exciting news everyone! We just launched something AMAZING! 😍 Our platform is the BEST and you'll absolutely LOVE it! Check it out now! 🔥🔥🔥 #awesome #best"

// GOOD LINKEDIN POST EXAMPLE (Do this):
// "Property managers in Nairobi waste an average of 8 hours weekly on manual rent tracking.

// After analyzing operations at over 100 properties, we identified three critical inefficiencies:
// • Payment reconciliation takes 2-3 hours per property monthly
// • Tenant communication is fragmented across multiple channels  
// • Financial reporting requires manual Excel consolidation

// Digital transformation isn't just about technology—it's about reclaiming strategic time. Plot Yangu automates these operational tasks while maintaining the personal touch property managers value.

// The result? Managers focus on growth instead of administrative work.

// What's your biggest operational bottleneck in property management?

// Learn more: https://cyber.cogvana.co.ke/explore

// #PropertyManagement #RealEstate #PropTech #KenyaBusiness"

// OUTPUT REQUIREMENT:
// Generate ONLY the LinkedIn post content. No meta-commentary, no explanations, no notes to me. Just the final post text that's ready to publish.

// Generate the post now:`;
// }

// async function processLinkedInPagePosts(collection: string, today: string, currentTime: string, orgUrn: string, token: string) {
//   const docRef = db.collection(collection).doc(today);
//   const doc = await docRef.get();

//   if (!doc.exists) {
//     console.log(`No LinkedIn posts found in ${collection} for ${today}`);
//     return;
//   }

//   const data = doc.data();
//   const posts: Post[] = data?.posts || [];

//   for (let i = 0; i < posts.length; i++) {
//     const post = posts[i];
    
//     if (!post.sent && post.scheduledTime && post.scheduledTime <= currentTime) {
//       try {
//         await postToLinkedIn(orgUrn, post.content, token);
        
//         post.sent = true;
//         post.sentAt = Timestamp.now();
        
//         await docRef.update({ posts });
        
//         console.log(`✅ Posted LinkedIn ${collection} post ${i} at ${currentTime}`);
//       } catch (error) {
//         console.error(`❌ Error posting LinkedIn ${collection} post ${i}:`, error);
//         post.error = error instanceof Error ? error.message : 'Unknown error';
//         await docRef.update({ posts });
//         await logError('linkedin', collection, today, i, error instanceof Error ? error.message : 'Unknown error');
//       }
//     }
//   }
// }

// async function postToLinkedIn(organizationUrn: string, text: string, accessToken: string): Promise<any> {
//   const url = 'https://api.linkedin.com/v2/ugcPosts';
  
//   const postData = {
//     author: organizationUrn,
//     lifecycleState: 'PUBLISHED',
//     specificContent: {
//       'com.linkedin.ugc.ShareContent': {
//         shareCommentary: {
//           text: text
//         },
//         shareMediaCategory: 'NONE'
//       }
//     },
//     visibility: {
//       'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
//     }
//   };

//   const response = await axios.post(url, postData, {
//     headers: {
//       'Authorization': `Bearer ${accessToken}`,
//       'Content-Type': 'application/json',
//       'X-Restli-Protocol-Version': '2.0.0'
//     }
//   });

//   return response.data;
// }

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// function getTodayDateString(): string {
//   const now = new Date();
//   const day = now.getDate().toString().padStart(2, '0');
//   const month = (now.getMonth() + 1).toString().padStart(2, '0');
//   const year = now.getFullYear();
//   return `${day}${month}${year}`;
// }

function getTodayDateString(): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  
  const parts = formatter.formatToParts(new Date());
  const day = parts.find(p => p.type === 'day')!.value;
  const month = parts.find(p => p.type === 'month')!.value;
  const year = parts.find(p => p.type === 'year')!.value;
  
  return `${day}${month}${year}`;
}

function generateTimeSlots(count: number, startHour: number, endHour: number): string[] {
  const slots: string[] = [];
  const totalMinutes = (endHour - startHour) * 60;
  const baseInterval = Math.floor(totalMinutes / count);

  for (let i = 0; i < count; i++) {
    const randomOffset = Math.floor(Math.random() * 15);
    const minutesFromStart = (i * baseInterval) + randomOffset;
    const hour = startHour + Math.floor(minutesFromStart / 60);
    const minute = minutesFromStart % 60;
    
    if (hour < endHour) {
      slots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
    }
  }

  return slots.sort();
}

async function logError(platform: string, collection: string, date: string, postIndex: number, errorMessage: string) {
  try {
    await db.collection('post_errors').add({
      platform,
      collection,
      date,
      postIndex,
      error: errorMessage,
      timestamp: Timestamp.now()
    });
  } catch (error) {
    console.error('Failed to log error to Firestore:', error);
  }
}

// ============================================================================
// ADMIN/UTILITY ENDPOINTS
// ============================================================================

// Get LinkedIn Organization Info (run once during setup)
// export const getLinkedInOrgInfo = onRequest(
//   {
//     secrets: [LINKEDIN_ACCESS_TOKEN],
//     region: 'us-central1',
//     memory: '256MiB',
//     timeoutSeconds: 30
//   },
//   async (req, res) => {
//     try {
//       const response = await axios.get(
//         'https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee',
//         {
//           headers: {
//             'Authorization': `Bearer ${LINKEDIN_ACCESS_TOKEN.value()}`,
//             'X-Restli-Protocol-Version': '2.0.0'
//           }
//         }
//       );

//       const orgs = response.data.elements.map((element: any) => ({
//         organizationUrn: element.organizationTarget,
//         role: element.role,
//         state: element.state
//       }));

//       // Get details for each org
//       const orgDetails = await Promise.all(
//         orgs.map(async (org: any) => {
//           try {
//             const orgId = org.organizationUrn.split(':').pop();
//             const detailResponse = await axios.get(
//               `https://api.linkedin.com/v2/organizations/${orgId}`,
//               {
//                 headers: {
//                   'Authorization': `Bearer ${LINKEDIN_ACCESS_TOKEN.value()}`,
//                   'X-Restli-Protocol-Version': '2.0.0'
//                 }
//               }
//             );
            
//             return {
//               ...org,
//               name: detailResponse.data.localizedName,
//               vanityName: detailResponse.data.vanityName
//             };
//           } catch (error) {
//             return org;
//           }
//         })
//       );

//       res.status(200).json({
//         success: true,
//         organizations: orgDetails
//       });

//     } catch (error) {
//       console.error('Error fetching LinkedIn org info:', error);
//       res.status(500).json({
//         success: false,
//         error: error instanceof Error ? error.message : 'Unknown error'
//       });
//     }
//   }
// );

// Health check endpoint
export const healthCheck = onRequest(
  {
    region: 'us-central1',
    memory: '128MiB',
    timeoutSeconds: 10
  },
  async (req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'social-media-automation',
      functions: [
        'generateDailyPosts',
        'scheduleSocialPosts', 
        'publishSocialPosts',
        'generateLinkedInPosts',
        'scheduleLinkedInPosts',
        'publishLinkedInPosts',
        'manualGenerateAllPosts'
      ]
    });
  }
);

/**
 * ========================================
 * SHOP FORMS GENERATOR EXPORTS
 * ========================================
 */

import { generateShopForm } from './handlers/shop.forms.handler';

// Shop Forms - Generate PDF forms for shop operations
// URL: /api/forms/sales?shopId=<id>
//      /api/forms/expenses?shopId=<id>
//      /api/forms/stock?shopId=<id>
exports.shopFormGenerator = onRequest(
  {
    memory: "1GiB",
    timeoutSeconds: 120,
    cors: true, // Enable CORS for browser requests
  },
  async (req, res) => {
    try {
      // Set CORS headers explicitly
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type');

      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
      }

      await generateShopForm(req, res);
    } catch (error) {
      console.error('Shop form generator error:', error);
      res.status(500).json({ error: 'Failed to generate form' });
    }
  }
);

/**
 * ========================================
 * WHATSAPP WEBHOOK EXPORTS
 * ========================================
 */

import { handleIncomingMessage } from './webhooks/whatsapp-webhook';
import { handleWebhookVerification } from './webhooks/verify-webhook';
import { WHATSAPP_VERIFY_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN } from './config/whatsapp.config';
import { PAYSTACK_SECRET_KEY } from './config/paystack.config';

// WhatsApp Webhook - handles both GET (verification) and POST (incoming messages)
// Uses Firebase Secrets set via: firebase functions:secrets:set WHATSAPP_* PAYSTACK_SECRET_KEY
// Increased memory to 1GB and timeout to 120s for PDF generation and upload
exports.whatsappWebhook = onRequest(
  {
    memory: "1GiB",
    timeoutSeconds: 120,
    secrets: [WHATSAPP_VERIFY_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, PAYSTACK_SECRET_KEY]
  },
  async (req, res) => {
    try {
      if (req.method === 'GET') {
        handleWebhookVerification(req, res);
      } else if (req.method === 'POST') {
        await handleIncomingMessage(req, res);
      } else {
        res.status(405).send('Method not allowed');
      }
    } catch (error) {
      console.error('WhatsApp webhook error:', error);
      res.status(500).send('Internal server error');
    }
  }
);