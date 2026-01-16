import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Check, X } from 'lucide-react';

interface CropData {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageCropComponentProps {
  image: {
    id: string;
    preview: string;
    file: File;
  };
  onCropComplete: (cropData: CropData) => void;
  onSkip: () => void;
  onCancel: () => void;
  imageIndex: number;
  totalImages: number;
}

export const ImageCropComponent: React.FC<ImageCropComponentProps> = ({
  image,
  onCropComplete,
  onSkip,
  onCancel,
  imageIndex,
  totalImages,
}) => {
  const [cropArea, setCropArea] = useState<CropData>({
    x: 50,
    y: 50,
    width: 200,
    height: 200,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [naturalDimensions, setNaturalDimensions] = useState({ width: 0, height: 0 });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (imageRef.current && imageLoaded) {
      const rect = imageRef.current.getBoundingClientRect();
      const centerX = rect.width / 2 - 100;
      const centerY = rect.height / 2 - 100;
      
      setCropArea({
        x: Math.max(0, centerX),
        y: Math.max(0, centerY),
        width: Math.min(200, rect.width),
        height: Math.min(200, rect.height),
      });
    }
  }, [imageLoaded]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalDimensions({
      width: img.naturalWidth,
      height: img.naturalHeight,
    });
    setImageLoaded(true);
  };

  const handleMouseDown = useCallback((e: React.MouseEvent, type: 'move' | 'resize', handle?: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (type === 'move') {
      setIsDragging(true);
    } else if (type === 'resize' && handle) {
      setIsResizing(handle);
    }
    
    setDragStart({
      x: e.clientX,
      y: e.clientY,
    });
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!imageRef.current) return;
    
    const rect = imageRef.current.getBoundingClientRect();
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;

    if (isDragging) {
      setCropArea(prev => ({
        ...prev,
        x: Math.max(0, Math.min(rect.width - prev.width, prev.x + deltaX)),
        y: Math.max(0, Math.min(rect.height - prev.height, prev.y + deltaY)),
      }));
      setDragStart({ x: e.clientX, y: e.clientY });
    } else if (isResizing) {
      setCropArea(prev => {
        let newCrop = { ...prev };
        
        if (isResizing.includes('e')) {
          newCrop.width = Math.max(50, Math.min(rect.width - prev.x, prev.width + deltaX));
        }
        if (isResizing.includes('w')) {
          const newWidth = Math.max(50, prev.width - deltaX);
          const widthDiff = prev.width - newWidth;
          newCrop.width = newWidth;
          newCrop.x = Math.max(0, prev.x + widthDiff);
        }
        if (isResizing.includes('s')) {
          newCrop.height = Math.max(50, Math.min(rect.height - prev.y, prev.height + deltaY));
        }
        if (isResizing.includes('n')) {
          const newHeight = Math.max(50, prev.height - deltaY);
          const heightDiff = prev.height - newHeight;
          newCrop.height = newHeight;
          newCrop.y = Math.max(0, prev.y + heightDiff);
        }
        
        return newCrop;
      });
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  }, [isDragging, isResizing, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(null);
  }, []);

  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  const handleApplyCrop = () => {
    if (!imageRef.current) return;
    
    const rect = imageRef.current.getBoundingClientRect();
    const scaleX = naturalDimensions.width / rect.width;
    const scaleY = naturalDimensions.height / rect.height;
    
    const normalizedCrop: CropData = {
      x: Math.round(cropArea.x * scaleX),
      y: Math.round(cropArea.y * scaleY),
      width: Math.round(cropArea.width * scaleX),
      height: Math.round(cropArea.height * scaleY),
    };
    
    onCropComplete(normalizedCrop);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Crop Image</h3>
            <p className="text-sm text-gray-600">
              Image {imageIndex + 1} of {totalImages}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6 bg-gray-100">
          <div ref={containerRef} className="relative inline-block max-w-full">
            <img
              ref={imageRef}
              src={image.preview}
              alt="Crop preview"
              className="max-w-full h-auto block"
              onLoad={handleImageLoad}
              draggable={false}
            />
            
            {imageLoaded && (
              <>
                {/* Overlay */}
                <div className="absolute inset-0 bg-black bg-opacity-40 pointer-events-none" />
                
                {/* Crop area */}
                <div
                  className="absolute border-2 border-blue-500 bg-transparent cursor-move"
                  style={{
                    left: `${cropArea.x}px`,
                    top: `${cropArea.y}px`,
                    width: `${cropArea.width}px`,
                    height: `${cropArea.height}px`,
                  }}
                  onMouseDown={(e) => handleMouseDown(e, 'move')}
                >
                  {/* Clear area inside crop box */}
                  <div className="absolute inset-0 bg-white opacity-0" />
                  
                  {/* Grid lines */}
                  <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                    {[...Array(9)].map((_, i) => (
                      <div key={i} className="border border-blue-300 opacity-50" />
                    ))}
                  </div>
                  
                  {/* Resize handles */}
                  {['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((handle) => (
                    <div
                      key={handle}
                      className={`absolute w-3 h-3 bg-blue-500 border-2 border-white rounded-full ${
                        handle.includes('n') ? '-top-1.5' : 
                        handle.includes('s') ? '-bottom-1.5' : 'top-1/2 -mt-1.5'
                      } ${
                        handle.includes('w') ? '-left-1.5' : 
                        handle.includes('e') ? '-right-1.5' : 'left-1/2 -ml-1.5'
                      } cursor-${handle}-resize`}
                      onMouseDown={(e) => handleMouseDown(e, 'resize', handle)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="p-4 border-t flex items-center justify-between bg-white">
          <button
            onClick={onSkip}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Skip Cropping
          </button>
          
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApplyCrop}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Apply Crop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};