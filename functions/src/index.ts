import { onCall, HttpsError, onRequest } from 'firebase-functions/v2/https';
import { Storage } from '@google-cloud/storage';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { defineSecret } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import sharp from 'sharp';
import axios from 'axios';
import * as path from 'path';

import { execFile } from 'child_process';
import { promisify } from 'util';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs/promises';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';


import { GoogleGenerativeAI } from '@google/generative-ai';


if (getApps().length === 0) {
  initializeApp();
}

const storage = new Storage();
const db = getFirestore();


const bucket = storage.bucket('plot-9fd6e.firebasestorage.app');

interface GeneratePassportRequest {
  imageUrl: string;
  count: 1 | 2 | 4 | 6 | 8;
  paperSize?: '10x15';
  marginMm?: number;
  userId: string;
}

interface PassportLayout {
  cols: number;
  rows: number;
  photoWidth: number;
  photoHeight: number;
  paperWidth: number;
  paperHeight: number;
}

// Constants for paper at 300 DPI
const DPI = 300;
const PAPER_WIDTH_CM = 10;
const PAPER_HEIGHT_CM = 15;

// Standard passport photo size: 35mm x 45mm
const PASSPORT_WIDTH_MM = 35;
const PASSPORT_HEIGHT_MM = 45;
const PASSPORT_ASPECT_RATIO = PASSPORT_WIDTH_MM / PASSPORT_HEIGHT_MM;




const execFileAsync = promisify(execFile);

interface CropData {
  x: number;
  y: number;
  width: number;
  height: number;
}


interface ConversionConfig {
  mode: 'id' | 'document';
  pageSize: 'A4' | 'A3' | 'Letter' | 'Legal';
  imagesPerPage: number;
  enableEnhancements: boolean;
}

interface PageDimensions {
  width: number;
  height: number;
}

const PAGE_SIZES: Record<string, PageDimensions> = {
  A4: { width: 595, height: 842 },
  A3: { width: 842, height: 1191 },
  Letter: { width: 612, height: 792 },
  Legal: { width: 612, height: 1008 },
};

const ID_SIZE = {
  width: 1012,
  height: 638,
};

async function downloadImage1(url: string, outputPath: string): Promise<void> {
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'arraybuffer',
  });
  await fs.writeFile(outputPath, response.data);
}

// LIBRARY 1: SHARP (Node.js npm package)
// Used for: Image processing, cropping, resizing, enhancement
async function processImage(
  inputPath: string,
  outputPath: string,
  config: ConversionConfig,
  cropData?: CropData
): Promise<void> {
  // Sharp is imported as a Node.js module and used directly
  let image = sharp(inputPath); // Creates a Sharp pipeline

  // Crop operation (if user cropped the image)
  if (cropData) {
    image = image.extract({
      left: cropData.x,
      top: cropData.y,
      width: cropData.width,
      height: cropData.height,
    });
  }

  // Resize based on mode
  if (config.mode === 'id') {
    image = image.resize(ID_SIZE.width, ID_SIZE.height, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    });
  } else {
    const pageDims = PAGE_SIZES[config.pageSize];
    const maxWidth = Math.floor(pageDims.width * 3);
    const maxHeight = Math.floor(pageDims.height * 3);
    
    image = image.resize(maxWidth, maxHeight, {
      fit: 'inside',
      withoutEnlargement: false,
    });
  }

  // Image enhancements
  if (config.enableEnhancements) {
    image = image.rotate().normalize().sharpen();
  }

  // Save as JPEG (Sharp handles the actual file writing)
  await image
    .jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
    .toFile(outputPath);
}

// LIBRARY 2: IMAGEMAGICK (System binary - convert/montage commands)
// Used for: Creating JPEG composites from processed images (NOT PDFs!)
async function createJpegPage(
  imagePaths: string[],
  outputPath: string,
  config: ConversionConfig
): Promise<void> {
  const pageDims = PAGE_SIZES[config.pageSize];
  const geometry = `${pageDims.width}x${pageDims.height}`;

  // Build command-line arguments for ImageMagick
  const args: string[] = ['-density', '300', '-page', geometry];

  let cols = 1, rows = 1;
  if (config.imagesPerPage === 2) { cols = 1; rows = 2; }
  else if (config.imagesPerPage === 4) { cols = 2; rows = 2; }
  else if (config.imagesPerPage === 6) { cols = 2; rows = 3; }
  else if (config.imagesPerPage === 9) { cols = 3; rows = 3; }

  // Add image file paths as arguments
  for (const imgPath of imagePaths) {
    args.push(imgPath);
  }

  // For multiple images, use montage to create grid layout
  if (config.imagesPerPage > 1) {
    args.push('-tile', `${cols}x${rows}`);
    args.push('-geometry', '+10+10');
    args.push('-background', 'white');
  }

  // Output as JPEG (not PDF!)
  args.push('-quality', '95');
  args.push('-flatten');
  args.push(`jpeg:${outputPath}`);

  // Execute ImageMagick command-line tool
  // 'montage' for grids, 'convert' for single images
  const command = config.imagesPerPage > 1 ? 'montage' : 'convert';
  
  // Example: `montage -density 300 -page 595x842 img1.jpg img2.jpg -tile 2x2 -geometry +10+10 -background white -quality 95 -flatten jpeg:output.jpg`
  await execFileAsync(command, args);
}

// LIBRARY 3: IMG2PDF - Simple JPEG to PDF conversion
// Alternative: use img2pdf if available, or simple Ghostscript command
async function convertJpegToPdf(
  jpegPath: string,
  outputPath: string,
  pageSize: keyof typeof PAGE_SIZES
) {
  const pdf = await PDFDocument.create();
  const imgBytes = await fs.readFile(jpegPath);
  const img = await pdf.embedJpg(imgBytes);

  const { width, height } = PAGE_SIZES[pageSize];
  const page = pdf.addPage([width, height]);

  const scale = Math.min(width / img.width, height / img.height);

  page.drawImage(img, {
    x: (width - img.width * scale) / 2,
    y: (height - img.height * scale) / 2,
    width: img.width * scale,
    height: img.height * scale,
  });

  const bytes = await pdf.save();
  await fs.writeFile(outputPath, bytes);
}

async function combinePdfs(pdfPaths: string[], outputPath: string) {
  const merged = await PDFDocument.create();

  for (const path of pdfPaths) {
    const bytes = await fs.readFile(path);
    const doc = await PDFDocument.load(bytes);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    pages.forEach(p => merged.addPage(p));
  }

  const finalBytes = await merged.save();
  await fs.writeFile(outputPath, finalBytes);
}


export const convertImagesToPdf = onCall(
  {
    region: 'us-central1',
    timeoutSeconds: 540,
    memory: '8GiB',
    cpu: 2,
    maxInstances: 5,
    cors: true,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { jobId, userId, images, config } = request.data;

    if (request.auth.uid !== userId) {
      throw new HttpsError('permission-denied', 'User ID mismatch');
    }

    if (!images || images.length === 0) {
      throw new HttpsError('invalid-argument', 'At least one image required');
    }

    if (images.length > 50) {
      throw new HttpsError('invalid-argument', 'Maximum 50 images');
    }

    const workDir = path.join(os.tmpdir(), `conversion-${uuidv4()}`);

    try {
      await fs.mkdir(workDir, { recursive: true });

      // Download and process images
      const processedImages: string[] = [];
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const downloadPath = path.join(workDir, `original-${i}.jpg`);
        const processedPath = path.join(workDir, `processed-${i}.jpg`);

        await downloadImage1(img.downloadUrl, downloadPath);
        await processImage(downloadPath, processedPath, config, img.cropData);
        processedImages.push(processedPath);
      }

      // Create JPEG pages using ImageMagick
      const jpegPages: string[] = [];
      const imagesPerPage = config.imagesPerPage;
      
      for (let i = 0; i < processedImages.length; i += imagesPerPage) {
        const pageImages = processedImages.slice(i, i + imagesPerPage);
        const jpegPath = path.join(workDir, `page-${Math.floor(i / imagesPerPage)}.jpg`);
        await createJpegPage(pageImages, jpegPath, config);
        jpegPages.push(jpegPath);
      }

      // Convert JPEG pages to PDF using Ghostscript
      const pdfPages: string[] = [];
      for (let i = 0; i < jpegPages.length; i++) {
        const pdfPath = path.join(workDir, `page-${i}.pdf`);
        await convertJpegToPdf(jpegPages[i], pdfPath, config.pageSize);
        pdfPages.push(pdfPath);
      }

      // Combine PDFs using Ghostscript
      const finalPdfPath = path.join(workDir, 'final.pdf');
      if (pdfPages.length === 1) {
        await fs.rename(pdfPages[0], finalPdfPath);
      } else {
        await combinePdfs(pdfPages, finalPdfPath);
      }

      // Upload to Storage
      const pdfStoragePath = `users/${userId}/conversions/${jobId}/converted/output.pdf`;
      await bucket.upload(finalPdfPath, {
        destination: pdfStoragePath,
        metadata: {
          contentType: 'application/pdf',
          metadata: { jobId, userId, createdAt: new Date().toISOString() },
        },
      });

      const file = bucket.file(pdfStoragePath);
      await file.makePublic();
      const pdfUrl = `https://storage.googleapis.com/${bucket.name}/${pdfStoragePath}`;

      // Cleanup
      await fs.rm(workDir, { recursive: true, force: true });

      return { pdfUrl, pdfStorageUrl: pdfStoragePath };

    } catch (error) {
      // Cleanup on error
      try {
        await fs.rm(workDir, { recursive: true, force: true });
      } catch {}

      throw new HttpsError(
        'internal',
        error instanceof Error ? error.message : 'Conversion failed'
      );
    }
  }
);

// ... (keep all your other exports below)

/**
 * Convert cm to pixels at 300 DPI
 */
const cmToPx = (cm: number): number => {
  return Math.round((cm / 2.54) * DPI);
};

/**
 * Convert mm to pixels at 300 DPI
 */
const mmToPx = (mm: number): number => {
  return Math.round((mm / 25.4) * DPI);
};

/**
 * Calculate layout for passport photos
 */
const calculateLayout = (count: number, marginMm: number): PassportLayout => {
  const marginPx = mmToPx(marginMm);
  
  // For single photo: portrait orientation (10x15 cm)
  // For multiple photos: landscape orientation (15x10 cm)
  const isPortrait = count === 1;
  const paperWidthPx = isPortrait ? cmToPx(PAPER_WIDTH_CM) : cmToPx(PAPER_HEIGHT_CM);
  const paperHeightPx = isPortrait ? cmToPx(PAPER_HEIGHT_CM) : cmToPx(PAPER_WIDTH_CM);
  
  let cols: number, rows: number;
  
  if (count === 1) {
    cols = 1;
    rows = 1;
  } else if (count === 2) {
    cols = 1;  // 2 columns (side by side)
    rows = 2;  // 1 row
  } else if (count === 4) {
    cols = 2;
    rows = 2;
  } else if (count === 6) {
    cols = 3;
    rows = 2;
  } else if (count === 8) {
    cols = 4;
    rows = 2;
  } else {
    cols = 1;
    rows = 1;
  }
  
  let photoWidth: number, photoHeight: number;
  
  if (count === 1) {
    // For single photo: fill entire page minus margins
    const availableWidth = paperWidthPx - (2 * marginPx);
    const availableHeight = paperHeightPx - (2 * marginPx);
    
    photoWidth = availableWidth;
    photoHeight = Math.floor(photoWidth / PASSPORT_ASPECT_RATIO);
    
    // If height exceeds available space, scale down based on height
    if (photoHeight > availableHeight) {
      photoHeight = availableHeight;
      photoWidth = Math.floor(photoHeight * PASSPORT_ASPECT_RATIO);
    }
  } else if (count === 2) {
    // For 2 photos: use standard passport size (35mm x 45mm) at 300 DPI
    // This makes them take up ~25% of landscape page
    photoWidth = mmToPx(PASSPORT_WIDTH_MM);
    photoHeight = mmToPx(PASSPORT_HEIGHT_MM);
  } else {
    // For 4, 6, 8 photos: calculate to fit in grid with margins
    const availableWidth = paperWidthPx - (marginPx * (cols + 1));
    const availableHeight = paperHeightPx - (marginPx * (rows + 1));
    
    photoWidth = Math.floor(availableWidth / cols);
    photoHeight = Math.floor(availableHeight / rows);
    
    // Maintain passport aspect ratio (35:45)
    const calculatedHeight = Math.floor(photoWidth / PASSPORT_ASPECT_RATIO);
    
    if (calculatedHeight <= photoHeight) {
      photoHeight = calculatedHeight;
    } else {
      photoWidth = Math.floor(photoHeight * PASSPORT_ASPECT_RATIO);
    }
  }
  
  return {
    cols,
    rows,
    photoWidth,
    photoHeight,
    paperWidth: paperWidthPx,
    paperHeight: paperHeightPx,
  };
};

/**
 * Download image from URL
 */
const downloadImage = async (url: string): Promise<Buffer> => {
  logger.info('[Download] Fetching image from URL', { url });
  
  try {
    const response = await axios.get(url, { 
      responseType: 'arraybuffer',
      timeout: 30000,
      maxContentLength: 10 * 1024 * 1024, // 10MB max
    });
    
    logger.info('[Download] Image fetched successfully', { 
      size: response.data.length 
    });
    
    return Buffer.from(response.data);
  } catch (error) {
    logger.error('[Download] Failed to fetch image', { error, url });
    throw new Error('Failed to download image from URL');
  }
};

/**
 * Generate passport photo tiles
 */
const generatePassportTiles = async (
  imageBuffer: Buffer,
  count: number,
  marginMm: number
): Promise<Buffer> => {
  logger.info('[Generate] Creating passport tiles', { count, marginMm });
  
  const layout = calculateLayout(count, marginMm);
  const marginPx = mmToPx(marginMm);
  
  logger.info('[Generate] Layout calculated', {
    cols: layout.cols,
    rows: layout.rows,
    photoWidth: layout.photoWidth,
    photoHeight: layout.photoHeight,
    paperWidth: layout.paperWidth,
    paperHeight: layout.paperHeight,
    marginPx,
    orientation: count === 1 ? 'portrait' : 'landscape',
  });
  
  try {
    // Resize input image to passport photo size
    const resizedPhoto = await sharp(imageBuffer)
      .resize(layout.photoWidth, layout.photoHeight, {
        fit: 'cover',
        position: 'center',
      })
      .toBuffer();
    
    // Create composites for each photo position
    const composites = [];
    
    if (count === 1) {
      // Center single photo on page
      const left = Math.floor((layout.paperWidth - layout.photoWidth) / 2);
      const top = Math.floor((layout.paperHeight - layout.photoHeight) / 2);
      
      composites.push({
        input: resizedPhoto,
        left,
        top,
      });
    } else {
      // Align multiple photos to left with margins
      for (let row = 0; row < layout.rows; row++) {
        for (let col = 0; col < layout.cols; col++) {
          const left = marginPx + col * (layout.photoWidth + marginPx);
          const top = marginPx + row * (layout.photoHeight + marginPx);
          
          composites.push({
            input: resizedPhoto,
            left,
            top,
          });
        }
      }
    }
    
    // Create white background and composite all photos
    const finalImage = await sharp({
      create: {
        width: layout.paperWidth,
        height: layout.paperHeight,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .composite(composites)
      .jpeg({ quality: 95 })
      .toBuffer();
    
    logger.info('[Generate] Tiles created successfully', {
      outputSize: finalImage.length,
    });
    
    return finalImage;
  } catch (error) {
    logger.error('[Generate] Failed to create tiles', { error });
    throw new Error('Failed to generate passport tiles');
  }
};

/**
 * Upload to Google Cloud Storage
 */
const uploadToStorage = async (
  buffer: Buffer,
  userId: string,
  filename: string
): Promise<string> => {
  const timestamp = Date.now();
  const filepath = `passport-results/${userId}/${timestamp}-${filename}`;
  const file = bucket.file(filepath);
  
  logger.info('[Upload] Uploading to storage', { filepath, size: buffer.length });
  
  try {
    await file.save(buffer, {
      metadata: {
        contentType: 'image/jpeg',
        metadata: {
          uploadedBy: userId,
          uploadedAt: new Date().toISOString(),
        },
      },
    });
    
    // Make the file publicly accessible
    await file.makePublic();
    
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filepath}`;
    
    logger.info('[Upload] File uploaded successfully', { publicUrl });
    
    return publicUrl;
  } catch (error) {
    logger.error('[Upload] Failed to upload to storage', { error, filepath });
    throw new Error('Failed to upload result to storage');
  }
};

/**
 * Delete from Google Cloud Storage
 */
const deleteFromStorage = async (url: string): Promise<void> => {
  try {
    const urlObj = new URL(url);
    const filepath = urlObj.pathname.split(`/${bucket.name}/`)[1];
    
    if (!filepath) {
      throw new Error('Invalid storage URL');
    }
    
    logger.info('[Delete] Deleting file from storage', { filepath });
    
    const file = bucket.file(filepath);
    await file.delete();
    
    logger.info('[Delete] File deleted successfully', { filepath });
  } catch (error) {
    logger.error('[Delete] Failed to delete file', { error, url });
    throw new Error('Failed to delete file from storage');
  }
};

/**
 * Main passport generation handler
 */
const handleGeneratePassport = async (req: any, res: any) => {
  const startTime = Date.now();
  
  try {
    const {
      imageUrl,
      count,
      paperSize = '10x15',
      marginMm = 2,
      userId,
    }: GeneratePassportRequest = req.body;
    
    logger.info('[Request] Generate passport request received', {
      imageUrl,
      count,
      paperSize,
      marginMm,
      userId,
    });
    
    // Validate input
    if (!imageUrl || !count || !userId) {
      logger.warn('[Validation] Missing required parameters');
      res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required parameters: imageUrl, count, userId',
      });
      return;
    }
    
    if (![1, 2, 4, 6, 8].includes(count)) {
      logger.warn('[Validation] Invalid count value', { count });
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid count. Must be one of: 1, 2, 4, 6, 8',
      });
      return;
    }
    
    // Download original image
    const imageBuffer = await downloadImage(imageUrl);
    
    // Generate passport tiles
    const resultBuffer = await generatePassportTiles(imageBuffer, count, marginMm);
    
    // Upload result to storage
    const downloadUrl = await uploadToStorage(
      resultBuffer,
      userId,
      `passport-${count}-photos.jpg`
    );
    
    // Delete original image
    let originalImageDeleted = false;
    try {
      await deleteFromStorage(imageUrl);
      originalImageDeleted = true;
      logger.info('[Cleanup] Original image deleted successfully');
    } catch (error) {
      logger.error('[Cleanup] Failed to delete original image', { error });
    }
    
    const processingTimeMs = Date.now() - startTime;
    
    logger.info('[Success] Passport generation complete', {
      downloadUrl,
      processingTimeMs,
    });
    
    res.status(200).json({
      success: true,
      downloadUrl,
      originalImageDeleted,
      metadata: {
        count,
        paperSize,
        marginMm,
        orientation: count === 1 ? 'portrait' : 'landscape',
        generatedAt: new Date().toISOString(),
        processingTimeMs,
      },
    });
  } catch (error) {
    const processingTimeMs = Date.now() - startTime;
    
    logger.error('[Error] Passport generation failed', { 
      error,
      processingTimeMs,
    });
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

/**
 * Health check handler
 */
const handleHealthCheck = async (req: any, res: any) => {
  logger.info('[Health] Health check requested');
  
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'passport-generator',
    version: '1.0.0',
  });
};

// Export Cloud Functions
export const generatePassport = onRequest(
  {
    memory: '2GiB',
    timeoutSeconds: 300,
    cors: true,
    maxInstances: 10,
    region: 'africa-south1',
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

      // Only allow POST requests
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
      }

      await handleGeneratePassport(req, res);
    } catch (error) {
      logger.error('[Function] Unhandled error in generatePassport', { error });
      res.status(500).json({ error: 'Failed to generate passport photos' });
    }
  }
);

export const healthCheck = onRequest(
  {
    memory: '256MiB',
    timeoutSeconds: 10,
    cors: true,
    region: 'africa-south1',
  },
  async (req, res) => {
    try {
      // Set CORS headers explicitly
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type');

      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
      }

      await handleHealthCheck(req, res);
    } catch (error) {
      logger.error('[Function] Unhandled error in healthCheck', { error });
      res.status(500).json({ error: 'Health check failed' });
    }
  }
);


interface MovieDataRequest {
  title: string;
  year: number;
  type: 'movie' | 'series';
}

interface MovieDataResponse {
  success: boolean;
  data?: {
    title: string;
    year: number;
    type: 'movie' | 'series';
    description: string;
    category: string;
    rating?: string;
    seasons?: Array<{ season: number; episodes: number }>;
    trailer?: string;
  };
  message?: string;
}

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

export const generateMovieData = onCall<MovieDataRequest, Promise<MovieDataResponse>>(
  {
    region: 'africa-south1',
    maxInstances: 10,
    timeoutSeconds: 60,
    memory: '256MiB',
    secrets: [GEMINI_API_KEY],
  },
  async (request) => {
    try {
      // Validate input
      const { title, type } = request.data;
      
      if (!title || !type) {
        throw new HttpsError(
          'invalid-argument',
          'Missing required fields: title, year, and type are required'
        );
      }

      // if (year < 1900 || year > new Date().getFullYear() + 5) {
      //   throw new HttpsError('invalid-argument', 'Invalid year provided');
      // }

      if (!['movie', 'series'].includes(type)) {
        throw new HttpsError('invalid-argument', 'Type must be either "movie" or "series"');
      }

      // Prepare prompt for Gemini
      const prompt = type === 'movie'
        ? `You are a movie database API. Provide detailed information about the movie "${title}" released in .... year (find the correct release year).

Return a JSON object with the following structure (no markdown, just raw JSON):
{
  "title": "Official movie title",
  "year": the correct year for the movie release,
  "type": "movie",
  "description": "A comprehensive 2-3 sentence plot summary",
  "category": "Main genre (e.g., Action, Drama, Sci-Fi, Comedy, Horror)",
  "rating": "IMDb or Rotten Tomatoes rating if available (e.g., 8.5/10 or 95%)",
  "trailer": "find the actual YouTube trailer video ID if available (11 characters), not random videos, the actual trailers"
}

If you cannot find exact information, provide best estimates based on similar titles, but ensure the description is relevant to the title and year provided.`
        : `You are a TV series database API. Provide detailed information about the series "${title}" that premiered in .... year (find the correct release year).

Return a JSON object with the following structure (no markdown, just raw JSON):
{
  "title": "Official series title",
  "year": the correct year for the show release,
  "type": "series",
  "description": "A comprehensive 2-3 sentence series overview",
  "category": "Main genre (e.g., Drama, Thriller, Comedy, Fantasy)",
  "rating": "IMDb rating if available (e.g., 8.7/10)",
  "seasons": [
    {"season": 1, "episodes": 10},
    {"season": 2, "episodes": 13}
  ],
  "trailer": "find the actual YouTube trailer video ID if available (11 characters), not random videos, the actual trailers"
}

Include all available seasons with their episode counts. If you cannot find exact information, provide reasonable estimates based on the title and year.`;

      // Call Gemini API
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Parse JSON response
      let movieData;
      try {
        // Remove markdown code blocks if present
        const cleanText = text
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();
        
        movieData = JSON.parse(cleanText);
      } catch (parseError) {
        console.error('Failed to parse AI response:', text);
        throw new HttpsError(
          'internal',
          'Failed to parse AI response. Please try again.'
        );
      }

      // Validate response structure
      if (!movieData.title || !movieData.description || !movieData.category) {
        throw new HttpsError(
          'internal',
          'AI response missing required fields'
        );
      }

      // Ensure correct type
      movieData.type = type;
      //movieData.year = year;

      // Validate seasons for series
      if (type === 'series') {
        if (!movieData.seasons || !Array.isArray(movieData.seasons) || movieData.seasons.length === 0) {
          // Provide default seasons if not available
          movieData.seasons = [
            { season: 1, episodes: 10 }
          ];
        }
      }

      return {
        success: true,
        data: movieData
      };

    } catch (error: any) {
      console.error('Error generating movie data:', error);

      if (error instanceof HttpsError) {
        throw error;
      }

      // Handle Gemini API errors
      if (error.message?.includes('API key')) {
        throw new HttpsError(
          'internal',
          'AI service configuration error. Please contact support.'
        );
      }

      if (error.message?.includes('quota')) {
        throw new HttpsError(
          'resource-exhausted',
          'AI service temporarily unavailable. Please try again later.'
        );
      }

      throw new HttpsError(
        'internal',
        'Failed to generate content data. Please try again.'
      );
    }
  }
);


import { generateShopForm } from './handlers/shop.forms.handler';


exports.shopFormGenerator = onRequest(
  {
    memory: "1GiB",
    timeoutSeconds: 120,
    cors: true, 
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


import { handleIncomingMessage } from './webhooks/whatsapp-webhook';
import { handleWebhookVerification } from './webhooks/verify-webhook';
import { WHATSAPP_VERIFY_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN } from './config/whatsapp.config';
import { PAYSTACK_SECRET_KEY } from './config/paystack.config';


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