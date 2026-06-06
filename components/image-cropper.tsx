'use client';

import { getCroppedImg } from '@/utils/cropImage';
import React, { useState, useCallback, useRef } from 'react';
import Cropper from 'react-easy-crop';

const ImageCropper = () => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onCropComplete = useCallback((croppedArea: any, croppedPixels: any) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const showFileDialog = () => {
    inputRef.current?.click();
  };

  const onSelectFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.addEventListener('load', () => setImageSrc(reader.result as string));
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    const file = await getCroppedImg(imageSrc, croppedAreaPixels);
    saveAs(file, 'cropped-image.png');
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <input type="file" accept="image/*" className="hidden" ref={inputRef} onChange={onSelectFile} />
      <button className="px-4 py-2 bg-blue-500 text-white rounded" onClick={showFileDialog}>
        Upload Image
      </button>

      {imageSrc && (
        <div className="relative w-[300px] h-[300px] bg-gray-100 rounded overflow-hidden">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>
      )}

      {imageSrc && (
        <div className="flex flex-col items-center w-full">
          <input
            type="range"
            className="w-60"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
          <button className="mt-2 px-4 py-2 bg-green-600 text-white rounded" onClick={handleSave}>
            Save Cropped Image
          </button>
        </div>
      )}
    </div>
  );
};

export default ImageCropper;

function saveAs(file: Blob, arg1: string) {
  throw new Error('Function not implemented.');
}

