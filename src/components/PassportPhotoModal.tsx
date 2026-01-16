// components/PassportPhotoModal.tsx
import React, { useState, useCallback, useRef } from 'react';
import { Upload, X, Crop, Download, RotateCw, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import Cropper from 'react-easy-crop';
import { 
  uploadToFirebase, 
  deleteFromFirebase, 
  uploadBlobToFirebase 
} from '../services/firebaseStorage';
import { generatePassportTiles } from '../services/cloudRunService';
import { 
  getCroppedImg, 
  validateImageFile, 
  downloadFile 
} from '../utils/imageUtils';
import type { 
  PassportCount, 
  PassportStep, 
  CropArea 
} from '../types';


interface PassportModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onComplete?: (imageUrl: string) => void;
}

export const PassportPhotoModal: React.FC<PassportModalProps> = ({ 
  isOpen, 
  onClose, 
  user,
  onComplete 
}) => {
  const [step, setStep] = useState<PassportStep>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);
  const [passportCount, setPassportCount] = useState<PassportCount>(4);
  const [, setUploadedUrl] = useState<string>('');
  const [finalImageUrl, setFinalImageUrl] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleReset = useCallback(() => {
    setStep('upload');
    setSelectedFile(null);
    setImagePreview('');
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setUploadedUrl('');
    setFinalImageUrl('');
    setError('');
    setIsProcessing(false);
  }, []);

  const handleFileSelect = useCallback((file: File) => {
    const validation = validateImageFile(file);
    
    if (!validation.isValid) {
      setError(validation.error || 'Invalid file');
      return;
    }

    setError('');
    setSelectedFile(file);
    
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
      setStep('crop');
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: CropArea) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSkipCrop = useCallback(async () => {
    if (!selectedFile) return;

    try {
      setIsProcessing(true);
      setError('');
      
      console.log('[Skip Crop] Uploading original file to Firebase');
      
      // Upload original file to Firebase
      const url = await uploadToFirebase(selectedFile, user.id);
      setUploadedUrl(url);
      
      console.log('[Skip Crop] File uploaded successfully:', url);
      
      setStep('processing');
      
      // Process passport tiles
      await processPassportTiles(url);
    } catch (err) {
      console.error('[Skip Crop] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload image. Please try again.');
      setIsProcessing(false);
    }
  }, [selectedFile, user.id]);

  const handleCropConfirm = useCallback(async () => {
    if (!croppedAreaPixels || !imagePreview || !selectedFile) return;

    try {
      setIsProcessing(true);
      setError('');
      
      console.log('[Crop] Cropping image with area:', croppedAreaPixels);
      
      // Get cropped image blob
      const croppedBlob = await getCroppedImg(imagePreview, croppedAreaPixels);
      
      console.log('[Crop] Uploading cropped image to Firebase');
      
      // Upload cropped image to Firebase
      const url = await uploadBlobToFirebase(
        croppedBlob,
        user.id,
        selectedFile.name
      );
      
      setUploadedUrl(url);
      
      console.log('[Crop] Cropped image uploaded successfully:', url);
      
      setStep('processing');
      
      // Process passport tiles
      await processPassportTiles(url);
    } catch (err) {
      console.error('[Crop] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process image. Please try again.');
      setIsProcessing(false);
    }
  }, [croppedAreaPixels, imagePreview, selectedFile, user.id]);

  const processPassportTiles = async (imageUrl: string) => {
    try {
      console.log('[Process] Generating passport tiles via Cloud Run');
      
      // Call Cloud Run service to generate passport tiles
      const response = await generatePassportTiles({
        imageUrl,
        count: passportCount,
        paperSize: '10x15',
        marginMm: 2,
        userId: user.id,
      });
      
      console.log('[Process] Passport tiles generated:', response);
      
      setFinalImageUrl(response.downloadUrl);
      setStep('preview');
      setIsProcessing(false);
      
      // Call onComplete callback if provided
      if (onComplete) {
        onComplete(response.downloadUrl);
      }
      
      console.log('[Process] Success - tiles ready for download');
    } catch (err) {
      console.error('[Process] Error generating passport tiles:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate passport tiles. Please try again.');
      setIsProcessing(false);
      setStep('crop');
      
      // Cleanup: delete uploaded image if processing failed
      if (imageUrl) {
        try {
          await deleteFromFirebase(imageUrl);
          console.log('[Process] Cleaned up failed upload');
        } catch (cleanupErr) {
          console.error('[Process] Failed to cleanup:', cleanupErr);
        }
      }
    }
  };

  const handleDownload = useCallback(async () => {
    if (!finalImageUrl) return;

    try {
      setIsProcessing(true);
      
      console.log('[Download] Downloading passport tiles');
      
      // Download the final image
      const filename = `passport-${passportCount}-photos-${Date.now()}.jpg`;
      await downloadFile(finalImageUrl, filename);
      
      console.log('[Download] File downloaded successfully');
      
      // Delete from Firebase storage after successful download
      console.log('[Download] Cleaning up Firebase storage');
      await deleteFromFirebase(finalImageUrl);
      
      console.log('[Download] Cleanup complete');
      
      // Reset and close
      handleReset();
      onClose();
    } catch (err) {
      console.error('[Download] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to download image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [finalImageUrl, passportCount, handleReset, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Passport Photo Generator</h2>
            <p className="text-sm text-gray-600 mt-1">Welcome, {user.name}!</p>
          </div>
          <button
            onClick={() => {
              handleReset();
              onClose();
            }}
            className="p-2 hover:bg-white rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            {[
              { key: 'upload' as PassportStep, label: 'Upload' },
              { key: 'crop' as PassportStep, label: 'Crop' },
              { key: 'processing' as PassportStep, label: 'Process' },
              { key: 'preview' as PassportStep, label: 'Preview' }
            ].map((s, i) => {
              const steps: PassportStep[] = ['upload', 'crop', 'processing', 'preview'];
              const currentIndex = steps.indexOf(step);
              const stepIndex = steps.indexOf(s.key);
              
              return (
                <div key={s.key} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                        step === s.key
                          ? 'bg-blue-600 text-white scale-110'
                          : currentIndex > stepIndex
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {currentIndex > stepIndex ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        i + 1
                      )}
                    </div>
                    <span className="text-xs mt-2 font-medium text-gray-700">{s.label}</span>
                  </div>
                  {i < 3 && (
                    <div
                      className={`h-1 flex-1 mx-2 rounded ${
                        currentIndex > i ? 'bg-green-500' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Error</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Upload Step */}
          {step === 'upload' && (
            <div className="space-y-6">
              <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-blue-500 transition-colors cursor-pointer bg-gray-50 hover:bg-blue-50"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <p className="text-lg font-semibold text-gray-700 mb-2">
                  Drop your photo here or click to browse
                </p>
                <p className="text-sm text-gray-500">
                  Supports: JPG, PNG, WEBP (Max 10MB)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileInput}
                  className="hidden"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Select number of passport photos:
                </label>
                <div className="grid grid-cols-5 gap-3">
                  {([1, 2, 4, 6, 8] as PassportCount[]).map(count => (
                    <button
                      key={count}
                      onClick={() => setPassportCount(count)}
                      className={`py-3 px-4 rounded-lg font-semibold transition-all ${
                        passportCount === count
                          ? 'bg-blue-600 text-white shadow-lg scale-105'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Photos will be arranged on a 10x15cm paper with uniform margins
                </p>
              </div>
            </div>
          )}

          {/* Crop Step */}
          {step === 'crop' && imagePreview && (
            <div className="space-y-4">
              <div className="relative w-full h-96 bg-gray-900 rounded-xl overflow-hidden">
                <Cropper
                  image={imagePreview}
                  crop={crop}
                  zoom={zoom}
                  aspect={3 / 4}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-semibold text-gray-700">
                  Zoom: {zoom.toFixed(1)}x
                </label>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.1}
                  value={zoom}
                  onChange={e => setZoom(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSkipCrop}
                  disabled={isProcessing}
                  className="flex-1 py-3 px-6 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  Skip Crop
                </button>
                <button
                  onClick={handleCropConfirm}
                  disabled={isProcessing}
                  className="flex-1 py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Crop className="w-5 h-5" />
                      Crop & Continue
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Processing Step */}
          {step === 'processing' && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-20 h-20 text-blue-600 animate-spin mb-6" />
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Generating Your Passport Photos
              </h3>
              <p className="text-gray-600 mb-4">
                Creating {passportCount} photo{passportCount > 1 ? 's' : ''} on 10x15cm paper...
              </p>
              <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full animate-pulse" style={{ width: '60%' }} />
              </div>
            </div>
          )}

          {/* Preview Step */}
          {step === 'preview' && finalImageUrl && (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-8 flex items-center justify-center">
                <img
                  src={finalImageUrl}
                  alt="Passport photos"
                  className="max-w-full max-h-96 rounded-lg shadow-2xl"
                />
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-800">Success!</p>
                  <p className="text-sm text-green-700 mt-1">
                    Your {passportCount} passport photo{passportCount > 1 ? 's' : ''} are ready for download
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleReset}
                  disabled={isProcessing}
                  className="flex-1 py-3 px-6 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <RotateCw className="w-5 h-5" />
                  Start Over
                </button>
                <button
                  onClick={handleDownload}
                  disabled={isProcessing}
                  className="flex-1 py-3 px-6 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      Download & Finish
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};