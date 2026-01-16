import { RecaptchaVerifier } from "firebase/auth";

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
  }
}

// types/index.ts

/**
 * User interface representing a user in the system
 */
export interface User {
  id: string;
  name: string;
  email?: string;
  photoURL?: string;
  createdAt?: string;
}

/**
 * Crop area in pixels
 */
export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Number of passport photos to generate
 */
export type PassportCount = 1 | 2 | 4 | 6 | 8;

/**
 * Paper size for passport photos
 */
export type PaperSize = '10x15';

/**
 * Current step in the passport generation process
 */
export type PassportStep = 'upload' | 'crop' | 'processing' | 'preview';

/**
 * Modal props for the PassportPhotoModal component
 */
export interface PassportModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onComplete?: (imageUrl: string) => void;
}

/**
 * State for the passport generation process
 */
export interface PassportState {
  step: PassportStep;
  selectedFile: File | null;
  imagePreview: string;
  croppedAreaPixels: CropArea | null;
  passportCount: PassportCount;
  uploadedUrl: string;
  finalImageUrl: string;
  error: string;
  isProcessing: boolean;
}

/**
 * Image upload result
 */
export interface UploadResult {
  url: string;
  path: string;
  uploadedAt: string;
}

/**
 * Passport generation metadata
 */
export interface PassportMetadata {
  count: PassportCount;
  paperSize: PaperSize;
  marginMm: number;
  generatedAt: string;
  processingTimeMs: number;
  userId: string;
}

/**
 * Error response from services
 */
export interface ServiceError {
  message: string;
  code?: string;
  details?: any;
}

/**
 * Image dimensions
 */
export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Download options
 */
export interface DownloadOptions {
  filename: string;
  deleteAfterDownload?: boolean;
}