import React, { useState, useCallback, useRef } from 'react';
import { X, Upload, FileText, Download, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { ImageCropComponent } from './ImageCropComponent';
import { convertImagesToPdf, type ConversionProgress } from '../services/conversionService';

interface User {
  uid: string;
  email?: string;
}

interface ImageToPdfModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
}

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  croppedBlob?: Blob; // The actual cropped and enhanced image blob
  enhancements?: {
    brightness: number;
    contrast: number;
    saturation: number;
  };
  status: 'pending' | 'uploaded' | 'edited' | 'processing' | 'complete';
}

type ConversionMode = 'id' | 'document';
type PageSize = 'A4' | 'A3' | 'Letter' | 'Legal';
type ImagesPerPage = 1 | 2 | 4 | 6 | 9;

interface ConversionConfig {
  mode: ConversionMode;
  pageSize: PageSize;
  imagesPerPage: ImagesPerPage;
  enableEnhancements: boolean;
}

type Step = 'mode' | 'upload' | 'crop' | 'config' | 'processing' | 'complete';

const ImageToPdfModal: React.FC<ImageToPdfModalProps> = ({ user, isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState<Step>('mode');
  const [mode, setMode] = useState<ConversionMode>('document');
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [currentCropIndex, setCurrentCropIndex] = useState<number>(0);
  const [config, setConfig] = useState<ConversionConfig>({
    mode: 'document',
    pageSize: 'A4',
    imagesPerPage: 1,
    enableEnhancements: true,
  });
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingMessage, setProcessingMessage] = useState('');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(() => {
    setCurrentStep('mode');
    setMode('document');
    setImages([]);
    setCurrentCropIndex(0);
    setConfig({
      mode: 'document',
      pageSize: 'A4',
      imagesPerPage: 1,
      enableEnhancements: true,
    });
    setProcessingProgress(0);
    setProcessingMessage('');
    setPdfUrl(null);
    setJobId(null);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    // Clean up preview URLs
    images.forEach(img => URL.revokeObjectURL(img.preview));
    resetState();
    onClose();
  }, [resetState, onClose, images]);

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newImages: UploadedImage[] = [];
    Array.from(files).forEach((file, index) => {
      if (file.type.startsWith('image/')) {
        const id = `img-${Date.now()}-${index}`;
        const preview = URL.createObjectURL(file);
        newImages.push({
          id,
          file,
          preview,
          status: 'pending',
        });
      }
    });

    setImages(prev => [...prev, ...newImages]);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const handleRemoveImage = useCallback((id: string) => {
    setImages(prev => {
      const updated = prev.filter(img => img.id !== id);
      const removedImg = prev.find(img => img.id === id);
      if (removedImg) {
        URL.revokeObjectURL(removedImg.preview);
      }
      return updated;
    });
  }, []);

  const handleModeSelect = useCallback((selectedMode: ConversionMode) => {
    setMode(selectedMode);
    setConfig(prev => ({ ...prev, mode: selectedMode }));
    setCurrentStep('upload');
  }, []);

  const handleProceedToCrop = useCallback(() => {
    if (images.length === 0) {
      setError('Please upload at least one image');
      return;
    }
    setCurrentCropIndex(0);
    setCurrentStep('crop');
  }, [images]);

  const handleSkipAllCropping = useCallback(() => {
    setCurrentStep('config');
  }, []);

  // FIXED: Now receives the actual cropped blob from ImageCropComponent
  const handleCropComplete = useCallback((
    index: number, 
    croppedBlob: Blob,
    enhancements: { brightness: number; contrast: number; saturation: number }
  ) => {
    setImages(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        croppedBlob, // Store the actual cropped blob
        enhancements,
        status: 'edited',
      };
      return updated;
    });
  }, []);

  const handleCropNext = useCallback(() => {
    if (currentCropIndex < images.length - 1) {
      setCurrentCropIndex(currentCropIndex + 1);
    }
  }, [currentCropIndex, images.length]);

  const handleCropPrevious = useCallback(() => {
    if (currentCropIndex > 0) {
      setCurrentCropIndex(currentCropIndex - 1);
    }
  }, [currentCropIndex]);

  const handleCropFinish = useCallback(async () => {
    setError(null);
    setCurrentStep('config');
  }, []);

  const handleCancelCrop = useCallback(() => {
    setCurrentCropIndex(0);
    setCurrentStep('upload');
  }, []);

  const handleSubmit = useCallback(async () => {
    setError(null);
    setCurrentStep('processing');
    setProcessingProgress(40);
    setProcessingMessage('Preparing images for upload...');

    try {
      // FIXED: Use cropped blobs if available, otherwise use original files
      const filesToConvert = images.map(img => {
        let fileToUse: File;

        if (img.croppedBlob) {
          // Use the cropped blob (already has enhancements applied)
          fileToUse = new File([img.croppedBlob], img.file.name, { type: 'image/jpeg' });
        } else {
          // No cropping was done, use original file
          fileToUse = img.file;
        }

        return {
          file: fileToUse,
          // No need to send cropData anymore - the blob is already cropped
        };
      });

      setProcessingProgress(50);

      const result = await convertImagesToPdf(
        user.uid,
        filesToConvert,
        config,
        (progress: ConversionProgress) => {
          setProcessingProgress(50 + Math.round(progress.progress / 2));
          setProcessingMessage(progress.message);
          
          if (progress.status === 'complete' && progress.pdfUrl) {
            setPdfUrl(progress.pdfUrl);
          }
        }
      );

      setJobId(result.jobId);
      setPdfUrl(result.pdfUrl);
      setCurrentStep('complete');
      
      console.log('[Modal] Conversion complete', { jobId: result.jobId });
    } catch (err) {
      console.error('[Modal] Conversion error:', err);
      setError(err instanceof Error ? err.message : 'Conversion failed');
      setCurrentStep('config');
    }
  }, [user, images, config]);

  if (!isOpen) return null;

  return (
    <>
      {currentStep === 'crop' ? (
        <ImageCropComponent
          images={images}
          currentIndex={currentCropIndex}
          onCropComplete={handleCropComplete}
          onNext={handleCropNext}
          onPrevious={handleCropPrevious}
          onFinish={handleCropFinish}
          onCancel={handleCancelCrop}
          totalImages={images.length}
        />
      ) : (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Image to PDF Converter</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Mode: <span className="font-medium">{mode === 'id' ? 'ID Card' : 'Document'}</span>
                </p>
              </div>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Progress Indicator */}
            <div className="px-6 py-4 bg-gray-50 border-b">
              <div className="flex items-center justify-between text-sm">
                {(['mode', 'upload', 'crop', 'config', 'processing', 'complete'] as Step[]).map((step, idx) => (
                  <div
                    key={step}
                    className={`flex items-center ${
                      idx < ['mode', 'upload', 'crop', 'config', 'processing', 'complete'].indexOf(currentStep)
                        ? 'text-green-600'
                        : idx === ['mode', 'upload', 'crop', 'config', 'processing', 'complete'].indexOf(currentStep)
                        ? 'text-blue-600 font-semibold'
                        : 'text-gray-400'
                    }`}
                  >
                    <span className="capitalize">{step}</span>
                    {idx < 5 && <span className="mx-2">→</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Mode Selection */}
              {currentStep === 'mode' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold mb-4">Select Conversion Mode</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => handleModeSelect('id')}
                      className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
                    >
                      <FileText className="w-8 h-8 mb-2 text-blue-600" />
                      <h4 className="font-semibold text-lg mb-1">ID Mode</h4>
                      <p className="text-sm text-gray-600">
                        Optimized for ID cards, passports, and small documents. Images will be sized to standard ID dimensions.
                      </p>
                    </button>
                    <button
                      onClick={() => handleModeSelect('document')}
                      className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
                    >
                      <FileText className="w-8 h-8 mb-2 text-green-600" />
                      <h4 className="font-semibold text-lg mb-1">Document Mode</h4>
                      <p className="text-sm text-gray-600">
                        For full-page documents, receipts, and forms. Images will be enhanced and expanded to fit selected page size.
                      </p>
                    </button>
                  </div>
                </div>
              )}

              {/* Upload */}
              {currentStep === 'upload' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold mb-4">Upload Images</h3>
                  <div
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-600 mb-2">Drag and drop images here, or click to select</p>
                    <p className="text-sm text-gray-500">Supports: JPG, PNG, WEBP, GIF (Max 50 images)</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileSelect(e.target.files)}
                    />
                  </div>

                  {images.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-semibold mb-2">{images.length} image(s) uploaded</h4>
                      <div className="grid grid-cols-4 gap-4">
                        {images.map((img) => (
                          <div key={img.id} className="relative group">
                            <img
                              src={img.preview}
                              alt="Preview"
                              className="w-full h-24 object-cover rounded-lg"
                            />
                            {img.status === 'edited' && (
                              <div className="absolute top-1 left-1 bg-green-500 text-white px-2 py-0.5 rounded text-xs">
                                ✓ Edited
                              </div>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveImage(img.id);
                              }}
                              className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={handleProceedToCrop}
                      disabled={images.length === 0}
                      className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                      Edit Images
                    </button>
                    <button
                      onClick={handleSkipAllCropping}
                      disabled={images.length === 0}
                      className="flex-1 border border-gray-300 py-3 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
                    >
                      Skip Editing
                    </button>
                  </div>
                </div>
              )}

              {/* Configuration */}
              {currentStep === 'config' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">Configure Output</h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Page Size</label>
                    <select
                      value={config.pageSize}
                      onChange={(e) => setConfig({ ...config, pageSize: e.target.value as PageSize })}
                      className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="A4">A4 (210 × 297 mm)</option>
                      <option value="A3">A3 (297 × 420 mm)</option>
                      <option value="Letter">Letter (8.5 × 11 in)</option>
                      <option value="Legal">Legal (8.5 × 14 in)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Images Per Page</label>
                    <select
                      value={config.imagesPerPage}
                      onChange={(e) => setConfig({ ...config, imagesPerPage: parseInt(e.target.value) as ImagesPerPage })}
                      className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value={1}>1 image per page</option>
                      <option value={2}>2 images per page (vertical)</option>
                      <option value={4}>4 images per page (2×2 grid)</option>
                      <option value={6}>6 images per page (2×3 grid)</option>
                      <option value={9}>9 images per page (3×3 grid)</option>
                    </select>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="flex gap-3">
                      <button
                        onClick={() => setCurrentStep('upload')}
                        className="flex-1 border border-gray-300 py-3 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Back to Upload
                      </button>
                      <button
                        onClick={handleSubmit}
                        className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <FileText className="w-5 h-5" />
                        Convert to PDF
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Processing */}
              {currentStep === 'processing' && (
                <div className="text-center py-12">
                  <Loader2 className="w-16 h-16 mx-auto mb-4 text-blue-600 animate-spin" />
                  <h3 className="text-xl font-semibold mb-2">Converting Images to PDF</h3>
                  <p className="text-gray-600 mb-4">{processingMessage}</p>
                  <div className="max-w-md mx-auto">
                    <div className="bg-gray-200 rounded-full h-4 overflow-hidden">
                      <div
                        className="bg-blue-600 h-full transition-all duration-300"
                        style={{ width: `${processingProgress}%` }}
                      />
                    </div>
                    <p className="mt-2 text-sm text-gray-600">{processingProgress}% complete</p>
                  </div>
                  <p className="text-xs text-gray-500 mt-6">This may take a few moments</p>
                </div>
              )}

              {/* Complete */}
              {currentStep === 'complete' && pdfUrl && (
                <div className="text-center py-12">
                  <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-600" />
                  <h3 className="text-xl font-semibold mb-2">Conversion Complete!</h3>
                  <p className="text-gray-600 mb-2">Your PDF is ready for download</p>
                  {jobId && (
                    <p className="text-xs text-gray-500 mb-6">Job ID: {jobId}</p>
                  )}
                  <div className="flex gap-4 justify-center">
                    <a
                      href={pdfUrl}
                      download="converted.pdf"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Download className="w-5 h-5" />
                      Download PDF
                    </a>
                    <button
                      onClick={resetState}
                      className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Convert Another
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ImageToPdfModal;