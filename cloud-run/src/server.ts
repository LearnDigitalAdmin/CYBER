import express, { Request, Response } from 'express';
import { Storage } from '@google-cloud/storage';
import sharp from 'sharp';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

const execFileAsync = promisify(execFile);

const app = express();
const storage = new Storage();
const bucket = storage.bucket(process.env.STORAGE_BUCKET || '');

app.use(express.json({ limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

interface CropData {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageMetadata {
  id: string;
  fileName: string;
  storageUrl: string;
  downloadUrl: string;
  cropData?: CropData;
  order: number;
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

// Page size definitions in points (1 point = 1/72 inch)
const PAGE_SIZES: Record<string, PageDimensions> = {
  A4: { width: 595, height: 842 },
  A3: { width: 842, height: 1191 },
  Letter: { width: 612, height: 792 },
  Legal: { width: 612, height: 1008 },
};

// ID card standard size (in pixels at 300 DPI)
const ID_SIZE = {
  width: 1012, // 3.375 inches * 300 DPI
  height: 638,  // 2.125 inches * 300 DPI
};

/**
 * Download image from URL
 */
async function downloadImage(url: string, outputPath: string): Promise<void> {
  console.log(`[Download] Downloading image from ${url}`);
  
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'arraybuffer',
  });

  await fs.writeFile(outputPath, response.data);
  console.log(`[Download] Saved to ${outputPath}`);
}

/**
 * Process image with Sharp
 */
async function processImage(
  inputPath: string,
  outputPath: string,
  config: ConversionConfig,
  cropData?: CropData
): Promise<void> {
  console.log(`[Sharp] Processing image: ${path.basename(inputPath)}`);
  
  let image = sharp(inputPath);

  // Apply crop if specified
  if (cropData) {
    console.log(`[Sharp] Applying crop:`, cropData);
    image = image.extract({
      left: cropData.x,
      top: cropData.y,
      width: cropData.width,
      height: cropData.height,
    });
  }

  // Apply mode-specific processing
  if (config.mode === 'id') {
    console.log(`[Sharp] Resizing to ID dimensions`);
    image = image.resize(ID_SIZE.width, ID_SIZE.height, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    });
  } else {
    // Document mode - resize to fit page
    const pageDims = PAGE_SIZES[config.pageSize];
    const maxWidth = Math.floor(pageDims.width * 3); // 300 DPI
    const maxHeight = Math.floor(pageDims.height * 3);
    
    console.log(`[Sharp] Resizing to page dimensions (${maxWidth}x${maxHeight})`);
    image = image.resize(maxWidth, maxHeight, {
      fit: 'inside',
      withoutEnlargement: false,
    });
  }

  // Apply enhancements if enabled
  if (config.enableEnhancements) {
    console.log(`[Sharp] Applying enhancements`);
    image = image
      .rotate() // Auto-rotate based on EXIF
      .normalize() // Normalize contrast
      .sharpen(); // Apply sharpening
  }

  // Convert to high-quality JPEG
  await image
    .jpeg({
      quality: 95,
      chromaSubsampling: '4:4:4',
    })
    .toFile(outputPath);

  console.log(`[Sharp] Processed image saved to ${outputPath}`);
}

/**
 * Create PDF page using ImageMagick
 */
async function createPdfPage(
  imagePaths: string[],
  outputPath: string,
  config: ConversionConfig
): Promise<void> {
  console.log(`[ImageMagick] Creating PDF page with ${imagePaths.length} image(s)`);
  
  const pageDims = PAGE_SIZES[config.pageSize];
  const geometry = `${pageDims.width}x${pageDims.height}`;

  const args: string[] = [
    '-density', '300',
    '-page', geometry,
  ];

  // Calculate grid layout
  let cols = 1;
  let rows = 1;
  
  if (config.imagesPerPage === 2) {
    cols = 1;
    rows = 2;
  } else if (config.imagesPerPage === 4) {
    cols = 2;
    rows = 2;
  } else if (config.imagesPerPage === 6) {
    cols = 2;
    rows = 3;
  } else if (config.imagesPerPage === 9) {
    cols = 3;
    rows = 3;
  }

  // Add images
  for (const imgPath of imagePaths) {
    args.push(imgPath);
  }

  // Create montage if multiple images per page
  if (config.imagesPerPage > 1) {
    const tileLayout = `${cols}x${rows}`;
    args.push('-tile', tileLayout);
    args.push('-geometry', '+10+10'); // 10px spacing
    args.push('-background', 'white');
  }

  args.push(outputPath);

  try {
    const command = config.imagesPerPage > 1 ? 'montage' : 'convert';
    await execFileAsync(command, args);
    console.log(`[ImageMagick] PDF page created: ${outputPath}`);
  } catch (error) {
    console.error('[ImageMagick] Error creating PDF page:', error);
    throw new Error(`ImageMagick failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Combine PDF pages using Ghostscript
 */
async function combinePdfs(
  pdfPaths: string[],
  outputPath: string,
  config: ConversionConfig
): Promise<void> {
  console.log(`[Ghostscript] Combining ${pdfPaths.length} PDF page(s)`);

  const args = [
    '-dBATCH',
    '-dNOPAUSE',
    '-dSAFER',
    '-sDEVICE=pdfwrite',
    '-dPDFSETTINGS=/prepress', // Highest quality
    '-dColorImageResolution=300',
    '-dGrayImageResolution=300',
    '-dMonoImageResolution=300',
    '-dAutoRotatePages=/None',
    `-sOutputFile=${outputPath}`,
    ...pdfPaths,
  ];

  try {
    await execFileAsync('gs', args);
    console.log(`[Ghostscript] Combined PDF created: ${outputPath}`);
  } catch (error) {
    console.error('[Ghostscript] Error combining PDFs:', error);
    throw new Error(`Ghostscript failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Main conversion endpoint
 */
app.post('/convert', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const workDir = path.join(os.tmpdir(), `conversion-${uuidv4()}`);
  
  console.log('[Convert] Request received', {
    jobId: req.body.jobId,
    imageCount: req.body.images?.length,
    workDir,
  });

  try {
    const { jobId, userId, images, config } = req.body as {
      jobId: string;
      userId: string;
      images: ImageMetadata[];
      config: ConversionConfig;
    };

    // Create working directory
    await fs.mkdir(workDir, { recursive: true });
    console.log(`[Convert] Created work directory: ${workDir}`);

    // Step 1: Download and process all images
    const processedImages: string[] = [];
    
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const downloadPath = path.join(workDir, `original-${i}.jpg`);
      const processedPath = path.join(workDir, `processed-${i}.jpg`);

      await downloadImage(img.downloadUrl, downloadPath);
      await processImage(downloadPath, processedPath, config, img.cropData);
      
      processedImages.push(processedPath);
    }

    console.log(`[Convert] Processed ${processedImages.length} images`);

    // Step 2: Create PDF pages
    const pdfPages: string[] = [];
    const imagesPerPage = config.imagesPerPage;
    
    for (let i = 0; i < processedImages.length; i += imagesPerPage) {
      const pageImages = processedImages.slice(i, i + imagesPerPage);
      const pagePath = path.join(workDir, `page-${Math.floor(i / imagesPerPage)}.pdf`);
      
      await createPdfPage(pageImages, pagePath, config);
      pdfPages.push(pagePath);
    }

    console.log(`[Convert] Created ${pdfPages.length} PDF page(s)`);

    // Step 3: Combine PDFs with Ghostscript
    const finalPdfPath = path.join(workDir, 'final.pdf');
    
    if (pdfPages.length === 1) {
      // Just rename if single page
      await fs.rename(pdfPages[0], finalPdfPath);
    } else {
      await combinePdfs(pdfPages, finalPdfPath, config);
    }

    // Step 4: Upload final PDF to Storage
    const pdfStoragePath = `users/${userId}/conversions/${jobId}/converted/output.pdf`;
    await bucket.upload(finalPdfPath, {
      destination: pdfStoragePath,
      metadata: {
        contentType: 'application/pdf',
        metadata: {
          jobId,
          userId,
          createdAt: new Date().toISOString(),
        },
      },
    });

    console.log(`[Convert] Uploaded PDF to ${pdfStoragePath}`);

    // Cleanup
    await fs.rm(workDir, { recursive: true, force: true });
    console.log(`[Convert] Cleaned up work directory`);

    const duration = Date.now() - startTime;
    console.log(`[Convert] Conversion complete in ${duration}ms`);

    res.status(200).json({
      pdfPath: pdfStoragePath,
      duration,
    });

  } catch (error) {
    console.error('[Convert] Conversion error:', error);
    
    // Cleanup on error
    try {
      await fs.rm(workDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.error('[Convert] Cleanup error:', cleanupError);
    }

    res.status(500).json({
      error: error instanceof Error ? error.message : 'Conversion failed',
    });
  }
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`[Server] Cloud Run service listening on port ${PORT}`);
  console.log(`[Server] Storage bucket: ${process.env.STORAGE_BUCKET}`);
});