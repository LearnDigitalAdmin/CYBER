import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  X, 
  RotateCw, 
  ZoomIn, 
  ZoomOut, 
  Check, 
  ChevronLeft, 
  ChevronRight,
  RefreshCw,
  Sliders,
  Sun,
  Contrast,
  Droplets
} from 'lucide-react';

interface CropData {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

interface ImageEnhancements {
  brightness: number;
  contrast: number;
  saturation: number;
}

interface EditableImage {
  id: string;
  file: File;
  preview: string;
  cropData: CropData;
  enhancements: ImageEnhancements;
}

interface ImageCropComponentProps {
  images: Array<{ id: string; file: File; preview: string }>;
  currentIndex: number;
  onCropComplete: (index: number, croppedBlob: Blob, enhancements: ImageEnhancements) => void;
  onNext: () => void;
  onPrevious: () => void;
  onFinish: () => void;
  onCancel: () => void;
  totalImages: number;
}

export const ImageCropComponent: React.FC<ImageCropComponentProps> = ({
  images,
  currentIndex,
  onCropComplete,
  onNext,
  onPrevious,
  onFinish,
  onCancel,
  totalImages,
}) => {
  const [editableImage, setEditableImage] = useState<EditableImage | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [showEnhancements, setShowEnhancements] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sourceImageRef = useRef<HTMLImageElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Initialize editable image when currentIndex changes
  useEffect(() => {
    if (images[currentIndex]) {
      setEditableImage({
        ...images[currentIndex],
        cropData: { x: 0, y: 0, width: 0, height: 0, rotation: 0 },
        enhancements: { brightness: 100, contrast: 100, saturation: 100 },
      });
      setImageLoaded(false);
      setZoom(1);
    }
  }, [currentIndex, images]);

  // Render image on canvas
  const renderImage = useCallback(() => {
    if (!canvasRef.current || !editableImage || !sourceImageRef.current || !imageLoaded) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = sourceImageRef.current;
    const { cropData, enhancements } = editableImage;

    // Calculate canvas size based on rotation
    const rotated = cropData.rotation % 180 !== 0;
    const displayWidth = rotated ? img.naturalHeight : img.naturalWidth;
    const displayHeight = rotated ? img.naturalWidth : img.naturalHeight;

    // Set canvas size
    canvas.width = displayWidth;
    canvas.height = displayHeight;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Save context state
    ctx.save();

    // Apply rotation
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((cropData.rotation * Math.PI) / 180);
    ctx.translate(-img.naturalWidth / 2, -img.naturalHeight / 2);

    // Apply filters
    const filters = [
      `brightness(${enhancements.brightness}%)`,
      `contrast(${enhancements.contrast}%)`,
      `saturate(${enhancements.saturation}%)`,
    ];
    ctx.filter = filters.join(' ');

    // Draw image
    ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);

    // Restore context
    ctx.restore();
  }, [editableImage, imageLoaded]);

  // Initialize crop area when image loads
  useEffect(() => {
    if (!imageLoaded || !editableImage || !sourceImageRef.current) return;
    if (editableImage.cropData.width !== 0 && editableImage.cropData.height !== 0) return;

    const img = sourceImageRef.current;
    const rotated = editableImage.cropData.rotation % 180 !== 0;
    const displayWidth = rotated ? img.naturalHeight : img.naturalWidth;
    const displayHeight = rotated ? img.naturalWidth : img.naturalHeight;

    const defaultSize = Math.min(displayWidth, displayHeight) * 0.8;
    const centerX = (displayWidth - defaultSize) / 2;
    const centerY = (displayHeight - defaultSize) / 2;

    setCanvasSize({ width: displayWidth, height: displayHeight });

    setEditableImage(prev => prev ? {
      ...prev,
      cropData: {
        ...prev.cropData,
        x: centerX,
        y: centerY,
        width: defaultSize,
        height: defaultSize,
      },
    } : null);
  }, [imageLoaded, editableImage?.cropData.rotation]);

  // Handle image load
  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
  }, []);

  // Re-render when enhancements or rotation change
  useEffect(() => {
    renderImage();
  }, [renderImage]);

  // Crop area interaction - unified for mouse and touch
  const handlePointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent, type: 'move' | 'resize', handle?: string) => {
      e.preventDefault();
      e.stopPropagation();

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      if (type === 'move') {
        setIsDragging(true);
      } else if (type === 'resize' && handle) {
        setIsResizing(handle);
      }

      setDragStart({ x: clientX, y: clientY });
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!editableImage || (!isDragging && !isResizing)) return;

      e.preventDefault();

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      if (!overlayRef.current) return;

      const rect = overlayRef.current.getBoundingClientRect();
      const scaleX = canvasSize.width / rect.width;
      const scaleY = canvasSize.height / rect.height;

      const deltaX = (clientX - dragStart.x) * scaleX;
      const deltaY = (clientY - dragStart.y) * scaleY;

      if (isDragging) {
        setEditableImage(prev => {
          if (!prev) return null;
          const crop = prev.cropData;
          return {
            ...prev,
            cropData: {
              ...crop,
              x: Math.max(0, Math.min(canvasSize.width - crop.width, crop.x + deltaX)),
              y: Math.max(0, Math.min(canvasSize.height - crop.height, crop.y + deltaY)),
            },
          };
        });
        setDragStart({ x: clientX, y: clientY });
      } else if (isResizing) {
        setEditableImage(prev => {
          if (!prev) return null;
          const crop = { ...prev.cropData };
          const minSize = 50;

          if (isResizing.includes('e')) {
            crop.width = Math.max(minSize, Math.min(canvasSize.width - crop.x, crop.width + deltaX));
          }
          if (isResizing.includes('w')) {
            const newWidth = Math.max(minSize, crop.width - deltaX);
            const widthDiff = crop.width - newWidth;
            crop.width = newWidth;
            crop.x = Math.max(0, crop.x + widthDiff);
          }
          if (isResizing.includes('s')) {
            crop.height = Math.max(minSize, Math.min(canvasSize.height - crop.y, crop.height + deltaY));
          }
          if (isResizing.includes('n')) {
            const newHeight = Math.max(minSize, crop.height - deltaY);
            const heightDiff = crop.height - newHeight;
            crop.height = newHeight;
            crop.y = Math.max(0, crop.y + heightDiff);
          }

          return {
            ...prev,
            cropData: crop,
          };
        });
        setDragStart({ x: clientX, y: clientY });
      }
    },
    [isDragging, isResizing, dragStart, canvasSize, editableImage]
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(null);
  }, []);

  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handlePointerMove);
      document.addEventListener('mouseup', handlePointerUp);
      document.addEventListener('touchmove', handlePointerMove, { passive: false });
      document.addEventListener('touchend', handlePointerUp);
      return () => {
        document.removeEventListener('mousemove', handlePointerMove);
        document.removeEventListener('mouseup', handlePointerUp);
        document.removeEventListener('touchmove', handlePointerMove);
        document.removeEventListener('touchend', handlePointerUp);
      };
    }
  }, [isDragging, isResizing, handlePointerMove, handlePointerUp]);

  // Rotate image
  const handleRotate = useCallback(() => {
    setEditableImage(prev => {
      if (!prev) return null;
      const newRotation = (prev.cropData.rotation + 90) % 360;
      
      return {
        ...prev,
        cropData: {
          ...prev.cropData,
          rotation: newRotation,
          x: 0,
          y: 0,
          width: 0,
          height: 0,
        },
      };
    });
  }, []);

  // Update enhancement
  const updateEnhancement = useCallback(
    (key: keyof ImageEnhancements, value: number) => {
      setEditableImage(prev => {
        if (!prev) return null;
        return {
          ...prev,
          enhancements: {
            ...prev.enhancements,
            [key]: value,
          },
        };
      });
    },
    []
  );

  // Reset enhancements
  const resetEnhancements = useCallback(() => {
    setEditableImage(prev => {
      if (!prev) return null;
      return {
        ...prev,
        enhancements: { brightness: 100, contrast: 100, saturation: 100 },
      };
    });
  }, []);

  // **CRITICAL FIX**: Actually apply the crop and create a real blob
  const applyCropAndEnhancements = useCallback(async (): Promise<Blob> => {
    if (!editableImage || !sourceImageRef.current) {
      throw new Error('Image not loaded');
    }

    return new Promise((resolve, reject) => {
      const img = sourceImageRef.current!;
      const { cropData, enhancements } = editableImage;

      // Create a temporary canvas for the full rotated image
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) {
        reject(new Error('Failed to get temp canvas context'));
        return;
      }

      // Calculate dimensions based on rotation
      const rotated = cropData.rotation % 180 !== 0;
      const fullWidth = rotated ? img.naturalHeight : img.naturalWidth;
      const fullHeight = rotated ? img.naturalWidth : img.naturalHeight;

      tempCanvas.width = fullWidth;
      tempCanvas.height = fullHeight;

      // Apply rotation and enhancements to full image
      tempCtx.save();
      tempCtx.translate(fullWidth / 2, fullHeight / 2);
      tempCtx.rotate((cropData.rotation * Math.PI) / 180);
      tempCtx.translate(-img.naturalWidth / 2, -img.naturalHeight / 2);
      tempCtx.filter = `brightness(${enhancements.brightness}%) contrast(${enhancements.contrast}%) saturate(${enhancements.saturation}%)`;
      tempCtx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
      tempCtx.restore();

      // Now create the FINAL cropped canvas
      const finalCanvas = document.createElement('canvas');
      const finalCtx = finalCanvas.getContext('2d');
      if (!finalCtx) {
        reject(new Error('Failed to get final canvas context'));
        return;
      }

      finalCanvas.width = cropData.width;
      finalCanvas.height = cropData.height;

      // Draw the cropped portion from the rotated image
      finalCtx.drawImage(
        tempCanvas,
        cropData.x,
        cropData.y,
        cropData.width,
        cropData.height,
        0,
        0,
        cropData.width,
        cropData.height
      );

      // Convert to blob
      finalCanvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob'));
          }
        },
        'image/jpeg',
        0.95
      );
    });
  }, [editableImage]);

  // Apply current crop - **FIXED TO ACTUALLY CROP**
  const handleApplyCurrent = useCallback(async () => {
    if (!editableImage || isProcessing) return;

    setIsProcessing(true);
    try {
      // **THIS IS THE FIX**: Actually create a cropped blob
      const croppedBlob = await applyCropAndEnhancements();
      
      // Pass the REAL cropped blob to parent
      onCropComplete(currentIndex, croppedBlob, editableImage.enhancements);

      // Move to next or finish
      if (currentIndex < totalImages - 1) {
        onNext();
      } else {
        onFinish();
      }
    } catch (error) {
      console.error('Error applying crop:', error);
      alert('Failed to process image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [editableImage, currentIndex, totalImages, onCropComplete, onNext, onFinish, applyCropAndEnhancements, isProcessing]);

  if (!editableImage) return null;

  const displayScale = containerRef.current
    ? Math.min(
        containerRef.current.clientWidth / canvasSize.width,
        containerRef.current.clientHeight / canvasSize.height,
        1
      ) * zoom
    : 1;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 flex flex-col z-50">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-700 px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <h2 className="text-lg sm:text-xl font-bold text-white">Edit Images</h2>
            <span className="text-gray-400 text-xs sm:text-sm">
              {currentIndex + 1} of {totalImages}
            </span>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Zoom controls */}
            <div className="hidden sm:flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-1.5">
              <button
                onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-white text-sm w-12 text-center">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoom(Math.min(3, zoom + 0.25))}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            {/* Rotate */}
            <button
              onClick={handleRotate}
              className="bg-gray-800 hover:bg-gray-700 text-white px-2 sm:px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 sm:gap-2"
            >
              <RotateCw className="w-4 h-4" />
              <span className="hidden sm:inline">Rotate</span>
            </button>

            {/* Enhancements toggle */}
            <button
              onClick={() => setShowEnhancements(!showEnhancements)}
              className={`${
                showEnhancements ? 'bg-blue-600' : 'bg-gray-800'
              } hover:bg-blue-700 text-white px-2 sm:px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 sm:gap-2`}
            >
              <Sliders className="w-4 h-4" />
              <span className="hidden sm:inline">Enhance</span>
            </button>

            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas Area */}
        <div className="flex-1 flex items-center justify-center p-2 sm:p-6 relative overflow-auto" ref={containerRef}>
          <div className="relative" style={{ transform: `scale(${displayScale})`, transformOrigin: 'center' }}>
            {/* Hidden source image */}
            <img
              ref={sourceImageRef}
              src={editableImage.preview}
              alt="Source"
              className="hidden"
              onLoad={handleImageLoad}
              crossOrigin="anonymous"
            />

            {/* Rendered canvas */}
            <canvas
              ref={canvasRef}
              className="max-w-full max-h-full block"
              style={{ imageRendering: 'crisp-edges' }}
            />

            {/* Crop overlay */}
            {imageLoaded && editableImage.cropData.width > 0 && (
              <div 
                ref={overlayRef}
                className="absolute inset-0"
                style={{ touchAction: 'none' }}
              >
                {/* Dark overlay with cutout */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  <defs>
                    <mask id="crop-mask">
                      <rect width="100%" height="100%" fill="white" />
                      <rect
                        x={`${(editableImage.cropData.x / canvasSize.width) * 100}%`}
                        y={`${(editableImage.cropData.y / canvasSize.height) * 100}%`}
                        width={`${(editableImage.cropData.width / canvasSize.width) * 100}%`}
                        height={`${(editableImage.cropData.height / canvasSize.height) * 100}%`}
                        fill="black"
                      />
                    </mask>
                  </defs>
                  <rect width="100%" height="100%" fill="rgba(0, 0, 0, 0.5)" mask="url(#crop-mask)" />
                </svg>

                {/* Crop box */}
                <div
                  className="absolute border-2 border-white shadow-2xl cursor-move"
                  style={{
                    left: `${(editableImage.cropData.x / canvasSize.width) * 100}%`,
                    top: `${(editableImage.cropData.y / canvasSize.height) * 100}%`,
                    width: `${(editableImage.cropData.width / canvasSize.width) * 100}%`,
                    height: `${(editableImage.cropData.height / canvasSize.height) * 100}%`,
                  }}
                  onMouseDown={(e) => handlePointerDown(e, 'move')}
                  onTouchStart={(e) => handlePointerDown(e, 'move')}
                >
                  {/* Grid */}
                  <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                    {[...Array(9)].map((_, i) => (
                      <div key={i} className="border border-white opacity-30" />
                    ))}
                  </div>

                  {/* Resize handles */}
                  {['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((handle) => (
                    <div
                      key={handle}
                      className={`absolute w-5 h-5 sm:w-4 sm:h-4 bg-white border-2 border-blue-500 rounded-full shadow-lg ${
                        handle.includes('n') ? '-top-2.5 sm:-top-2' : handle.includes('s') ? '-bottom-2.5 sm:-bottom-2' : 'top-1/2 -mt-2.5 sm:-mt-2'
                      } ${
                        handle.includes('w') ? '-left-2.5 sm:-left-2' : handle.includes('e') ? '-right-2.5 sm:-right-2' : 'left-1/2 -ml-2.5 sm:-ml-2'
                      } cursor-${handle}-resize hover:scale-125 active:scale-125 transition-transform`}
                      onMouseDown={(e) => handlePointerDown(e, 'resize', handle)}
                      onTouchStart={(e) => handlePointerDown(e, 'resize', handle)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Enhancements Panel */}
        {showEnhancements && (
          <div className="w-64 sm:w-80 bg-gray-900 border-l border-gray-700 p-4 sm:p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h3 className="text-base sm:text-lg font-semibold text-white">Enhancements</h3>
              <button
                onClick={resetEnhancements}
                className="text-gray-400 hover:text-white text-sm flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Reset
              </button>
            </div>

            <div className="space-y-4 sm:space-y-6">
              {/* Brightness */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-white text-sm flex items-center gap-2">
                    <Sun className="w-4 h-4" />
                    Brightness
                  </label>
                  <span className="text-gray-400 text-sm">{editableImage.enhancements.brightness}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="150"
                  value={editableImage.enhancements.brightness}
                  onChange={(e) => updateEnhancement('brightness', parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Contrast */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-white text-sm flex items-center gap-2">
                    <Contrast className="w-4 h-4" />
                    Contrast
                  </label>
                  <span className="text-gray-400 text-sm">{editableImage.enhancements.contrast}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="150"
                  value={editableImage.enhancements.contrast}
                  onChange={(e) => updateEnhancement('contrast', parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Saturation */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-white text-sm flex items-center gap-2">
                    <Droplets className="w-4 h-4" />
                    Saturation
                  </label>
                  <span className="text-gray-400 text-sm">{editableImage.enhancements.saturation}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={editableImage.enhancements.saturation}
                  onChange={(e) => updateEnhancement('saturation', parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="bg-gray-900 border-t border-gray-700 px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between flex-col sm:flex-row gap-3 sm:gap-0">
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={onPrevious}
              disabled={currentIndex === 0}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <button
              onClick={onNext}
              disabled={currentIndex === totalImages - 1}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-3 w-full sm:w-auto">
            <button
              onClick={onCancel}
              className="flex-1 sm:flex-none px-4 sm:px-6 py-2 border border-gray-600 hover:bg-gray-800 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApplyCurrent}
              disabled={isProcessing}
              className="flex-1 sm:flex-none px-4 sm:px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isProcessing ? (
                <>Processing...</>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  {currentIndex === totalImages - 1 ? 'Finish' : 'Next'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};