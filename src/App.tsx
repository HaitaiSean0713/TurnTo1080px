import React, { useState, useRef, useEffect, useCallback } from 'react';
import { UploadCloud, Image as ImageIcon, Download, RefreshCw, Layers } from 'lucide-react';

export default function App() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Handle Drag & Drop
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        handleFile(file);
      }
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.type.startsWith('image/')) {
        handleFile(file);
      }
    }
  };

  const handleFile = (file: File) => {
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImageUrl(url);
  };

  const resetImage = () => {
    setImageFile(null);
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }
    setImageUrl(null);
    setPreviewUrl(null);
  };

  // Generate the 1080x1080 canvas
  const processImage = useCallback(() => {
    if (!imageUrl || !canvasRef.current) return;
    
    setIsProcessing(true);
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const targetSize = 1080;
      canvas.width = targetSize;
      canvas.height = targetSize;

      // Clear canvas
      ctx.clearRect(0, 0, targetSize, targetSize);

      // Handle Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetSize, targetSize);

      // Calculate the size to fit within exactly 1080x1080
      const scaleToFit = Math.min(targetSize / img.width, targetSize / img.height);
      const w = img.width * scaleToFit;
      const h = img.height * scaleToFit;
      const x = (targetSize - w) / 2;
      const y = (targetSize - h) / 2;

      // Draw the actual image
      ctx.drawImage(img, x, y, w, h);

      // Create preview
      const generatedUrl = canvas.toDataURL('image/jpeg', 0.95);
      setPreviewUrl(generatedUrl);
      setIsProcessing(false);
    };
    img.src = imageUrl;

  }, [imageUrl]);

  useEffect(() => {
    if (imageUrl) {
      processImage();
    }
  }, [imageUrl, processImage]);

  const handleDownload = () => {
    if (!previewUrl || !imageFile) return;
    const a = document.createElement('a');
    a.href = previewUrl;
    const originalName = imageFile.name.split('.').slice(0, -1).join('.');
    a.download = `${originalName}-1080x1080.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center shadow-sm">
        <div className="flex items-center gap-2 text-indigo-600">
          <Layers className="w-6 h-6" />
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">SquareIt</h1>
        </div>
        <p className="ml-4 text-sm text-gray-500 hidden sm:block">
          Convert any image to a perfect 1080x1080 square.
        </p>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8 grid gap-8 md:grid-cols-12 items-start">
        {/* Left Column - Input / Preview */}
        <div className="md:col-span-8 flex flex-col gap-6">
          {!imageUrl ? (
            <div
              onDragOver={onDragOver}
              onDrop={onDrop}
              className="border-2 border-dashed border-gray-300 rounded-2xl bg-white p-12 flex flex-col items-center justify-center text-center transition-colors hover:border-indigo-400 hover:bg-indigo-50/50 cursor-pointer aspect-square max-h-[600px]"
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-4">
                <UploadCloud className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-medium mb-2">Upload your image</h3>
              <p className="text-gray-500 mb-6 max-w-sm">
                Drag and drop your image here, or click to browse. We support JPEG, PNG, WEBP, and more.
              </p>
              <button className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors">
                Select from computer
              </button>
              <input
                id="file-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileInput}
              />
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 flex flex-col items-center">
              <div className="w-full flex justify-between items-center mb-6">
                <h2 className="text-lg font-medium flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-gray-400" />
                  Preview (1080 x 1080)
                </h2>
                <button
                  onClick={resetImage}
                  className="text-sm font-medium text-gray-500 hover:text-gray-900 flex items-center gap-1 transition-colors px-3 py-1.5 rounded-md hover:bg-gray-100"
                >
                  <RefreshCw className="w-4 h-4" />
                  Change Image
                </button>
              </div>

              {/* Preview Area */}
              <div className="relative w-full max-w-[500px] aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center">
                {isProcessing ? (
                  <div className="flex flex-col items-center text-gray-500">
                    <RefreshCw className="w-8 h-8 animate-spin mb-3" />
                    <span>Processing...</span>
                  </div>
                ) : previewUrl ? (
                  <img src={previewUrl} alt="1080x1080 preview" className="w-full h-full object-contain" />
                ) : null}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Settings */}
        <div className="md:col-span-4 flex flex-col gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 sticky top-6">
            <h2 className="text-lg font-medium mb-6 flex items-center gap-2">
              <Download className="w-5 h-5 text-gray-400" />
              Export Options
            </h2>

            <div className="space-y-6">
              <p className="text-sm text-gray-600 leading-relaxed">
                Your image is automatically centered and padded with a white background to perfectly fit a 1080x1080 square.
              </p>

              {/* Download Button */}
              <div className="pt-2">
                <button
                  disabled={!imageUrl || isProcessing}
                  onClick={handleDownload}
                  className="w-full py-3 px-4 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Download Image
                </button>
                <p className="text-xs text-center text-gray-500 mt-3">
                  Image will be saved as a 1080x1080 JPEG.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Hidden Canvas for Processing */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
