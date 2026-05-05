import React, { useState, useCallback } from 'react';
import { UploadCloud, Image as ImageIcon, Download, RefreshCw, Layers, Settings, Plus, Trash, Archive, CopyCheck, X } from 'lucide-react';

type BgType = 'color' | 'transparent';

export interface ImageItem {
  id: string;
  file: File;
  originalUrl: string;
  bgType: BgType;
  bgColor: string;
  previewUrl: string | null;
  isProcessing: boolean;
}

const generateImage = async (url: string, bgType: BgType, bgColor: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = async () => {
      // Yield slightly to prevent main thread lockup
      await new Promise(r => setTimeout(r, 0));
      
      const canvas = document.createElement('canvas');
      const targetSize = 1080;
      canvas.width = targetSize;
      canvas.height = targetSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('No context'));

      if (bgType === 'color') {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, targetSize, targetSize);
      }

      const scaleToFit = Math.min(targetSize / img.width, targetSize / img.height);
      const w = img.width * scaleToFit;
      const h = img.height * scaleToFit;
      const x = (targetSize - w) / 2;
      const y = (targetSize - h) / 2;

      ctx.drawImage(img, x, y, w, h);
      resolve(canvas.toDataURL(bgType === 'transparent' ? 'image/png' : 'image/jpeg', 0.95));
    };
    img.onerror = reject;
    img.src = url;
  });
};

export default function App() {
  const [items, setItems] = useState<ImageItem[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [isZipping, setIsZipping] = useState(false);

  const activeItem = items[activeIndex];

  const onDragOver = useCallback((e: React.DragEvent) => e.preventDefault(), []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
    e.target.value = ''; // Reset input to allow selecting the same file again
  };

  const handleFiles = async (files: FileList | File[]) => {
    const validFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (validFiles.length === 0) return;

    const newItems: ImageItem[] = validFiles.map(file => ({
      id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      file,
      originalUrl: URL.createObjectURL(file),
      bgType: 'color',
      bgColor: '#ffffff',
      previewUrl: null,
      isProcessing: true,
    }));

    setItems(prev => {
      const updated = [...prev, ...newItems];
      if (prev.length === 0) setActiveIndex(0);
      return updated;
    });

    for (const item of newItems) {
      try {
        const previewUrl = await generateImage(item.originalUrl, item.bgType, item.bgColor);
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, previewUrl, isProcessing: false } : i));
      } catch (e) {
        console.error('Failed to generate image', e);
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, isProcessing: false } : i));
      }
    }
  };

  const updateActiveSettings = async (updates: Partial<ImageItem>) => {
    if (!activeItem) return;
    const newBgType = updates.bgType ?? activeItem.bgType;
    const newBgColor = updates.bgColor ?? activeItem.bgColor;

    const updatedItem = { ...activeItem, ...updates, isProcessing: true };
    setItems(prev => prev.map((item, idx) => idx === activeIndex ? updatedItem : item));

    try {
      const previewUrl = await generateImage(updatedItem.originalUrl, newBgType, newBgColor);
      setItems(prev => prev.map((item, idx) => idx === activeIndex ? { ...item, ...updates, previewUrl, isProcessing: false } : item));
    } catch (e) {
      setItems(prev => prev.map((item, idx) => idx === activeIndex ? { ...item, isProcessing: false } : item));
    }
  };

  const applyToAll = async () => {
    if (!activeItem) return;
    const { bgType, bgColor } = activeItem;

    const itemsToUpdate = items.filter((item, idx) => idx !== activeIndex && (item.bgType !== bgType || item.bgColor !== bgColor));
    if (itemsToUpdate.length === 0) return;

    setItems(prev => prev.map(item => itemsToUpdate.find(i => i.id === item.id) ? { ...item, isProcessing: true } : item));

    for (const item of itemsToUpdate) {
      try {
        const previewUrl = await generateImage(item.originalUrl, bgType, bgColor);
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, bgType, bgColor, previewUrl, isProcessing: false } : i));
      } catch (e) {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, isProcessing: false } : i));
      }
    }
  };

  const deleteItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const item = items.find(i => i.id === id);
    if (item) URL.revokeObjectURL(item.originalUrl);
    setItems(prev => {
      const next = prev.filter(i => i.id !== id);
      if (activeIndex >= next.length && next.length > 0) {
        setActiveIndex(next.length - 1);
      } else if (activeIndex >= next.length && next.length === 0) {
        setActiveIndex(0);
      }
      return next;
    });
  };

  const clearAll = () => {
    items.forEach(i => URL.revokeObjectURL(i.originalUrl));
    setItems([]);
    setActiveIndex(0);
  };

  const downloadSingle = (item: ImageItem) => {
    if (!item.previewUrl) return;
    const a = document.createElement('a');
    a.href = item.previewUrl;
    const originalName = item.file.name.split('.').slice(0, -1).join('.');
    const ext = item.bgType === 'transparent' ? 'png' : 'jpg';
    a.download = `${originalName}-1080x1080.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadAllZip = async () => {
    if (items.length === 0) return;
    setIsZipping(true);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      
      items.forEach((item, index) => {
         if (item.previewUrl) {
            const base64Data = item.previewUrl.split(',')[1];
            let originalName = item.file.name.split('.').slice(0, -1).join('.');
            if (!originalName) originalName = `image_${index}`;
            const ext = item.bgType === 'transparent' ? 'png' : 'jpg';
            
            let filename = `${originalName}-1080x1080.${ext}`;
            let counter = 1;
            while(zip.file(filename)) {
              filename = `${originalName}-${counter}-1080x1080.${ext}`;
              counter++;
            }
            zip.file(filename, base64Data, {base64: true});
         }
      });
      
      const content = await zip.generateAsync({type: "blob"});
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SquareIt-Batch-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to create zip', e);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col font-sans text-gray-900 overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-2 text-indigo-600">
          <Layers className="w-6 h-6" />
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">SquareIt</h1>
          {items.length > 0 && <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full items-center">Batch Mode</span>}
        </div>
        <p className="ml-4 text-sm text-gray-500 hidden md:block">
          Convert multiple images to a perfect 1080x1080 square.
        </p>
      </header>

      {/* Main Content */}
      {items.length === 0 ? (
        <main className="flex-1 overflow-auto p-6 md:p-12 flex items-center justify-center">
          <div
            onDragOver={onDragOver}
            onDrop={onDrop}
            className="border-2 border-dashed border-gray-300 rounded-2xl bg-white p-12 flex flex-col items-center justify-center text-center transition-colors hover:border-indigo-400 hover:bg-indigo-50/50 cursor-pointer w-full max-w-2xl min-h-[400px]"
            onClick={() => document.getElementById('file-upload-main')?.click()}
          >
            <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-4">
              <UploadCloud className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-medium mb-2">Upload your images</h3>
            <p className="text-gray-500 mb-6 max-w-sm">
              Drag and drop multiple images here, or click to browse. We support JPEG, PNG, WEBP, and more.
            </p>
            <button className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors">
              Select files from computer
            </button>
            <input
              id="file-upload-main"
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={handleFileInput}
            />
          </div>
        </main>
      ) : (
        <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          {/* Sidebar */}
          <div className="w-full md:w-72 border-b md:border-b-0 md:border-r border-gray-200 bg-white flex flex-col h-48 md:h-full shrink-0">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/80 shrink-0 z-10 sticky top-0">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-gray-500" />
                <span className="font-medium text-sm text-gray-700">{items.length} Images</span>
              </div>
              <div className="flex gap-1">
                <button 
                  className="p-1.5 hover:bg-gray-200 rounded-md text-gray-600 transition-colors" 
                  onClick={() => document.getElementById('file-upload-sidebar')?.click()} 
                  title="Add more images"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button 
                  className="p-1.5 hover:bg-red-100 text-red-600 rounded-md transition-colors" 
                  onClick={clearAll} 
                  title="Clear all"
                >
                  <Trash className="w-4 h-4" />
                </button>
                <input
                  id="file-upload-sidebar"
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 flex md:flex-col gap-3 flex-row md:flex-nowrap flex-wrap md:justify-start justify-start w-full">
              {items.map((item, idx) => (
                <div 
                  key={item.id}
                  onClick={() => setActiveIndex(idx)} 
                  className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all shrink-0 w-24 h-24 md:w-full md:h-auto md:aspect-square ${activeIndex === idx ? 'border-indigo-600 shadow-md ring-2 ring-indigo-600/20' : 'border-transparent hover:border-gray-300 bg-gray-50'}`}
                >
                  <div className="w-full h-full md:aspect-square checkerboard-bg-small flex items-center justify-center p-2 relative">
                    {item.previewUrl ? (
                      <img src={item.previewUrl} alt="thumbnail" className="w-full h-full object-contain rounded drop-shadow-sm" />
                    ) : item.isProcessing ? (
                      <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-gray-300" />
                    )}
                  </div>
                  
                  <button 
                    onClick={(e) => deleteItem(e, item.id)}
                    className="absolute top-1 right-1 p-1 md:opacity-0 group-hover:opacity-100 bg-black/60 text-white rounded transition-opacity hover:bg-red-500 z-20"
                    title="Remove image"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  
                  <div className="absolute bottom-0 left-0 right-0 py-1 px-2 bg-black/50 text-white text-[10px] font-medium flex items-center gap-1.5 z-10 truncate">
                    <div 
                      className="w-2.5 h-2.5 rounded-full border border-white/50 shrink-0" 
                      style={{ background: item.bgType === 'color' ? item.bgColor : 'repeating-conic-gradient(#aaa 0% 25%, transparent 0% 50%) 50% / 4px 4px' }}
                    />
                    <span className="truncate">{item.file.name}</span>
                  </div>
                  
                  {item.isProcessing && (
                    <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10 backdrop-blur-sm">
                       <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Editor Area */}
          <div className="flex-1 bg-gray-50 overflow-y-auto p-4 md:p-8 flex flex-col xl:flex-row gap-8">
            
            {/* Preview Image */}
            <div className="flex-1 flex flex-col items-center justify-center min-h-[300px]">
              {activeItem && (
                <div className="w-full flex-col items-center flex max-w-lg">
                  <div className="w-full flex justify-between items-center mb-4 px-2">
                    <h2 className="text-lg font-medium flex items-center gap-2">
                      <ImageIcon className="w-5 h-5 text-gray-400" />
                      Preview (1080 x 1080)
                    </h2>
                  </div>
                  <div className="relative w-full aspect-square rounded-lg overflow-hidden border border-gray-200 checkerboard-bg flex items-center justify-center shadow-sm">
                    {activeItem.isProcessing ? (
                      <div className="flex flex-col items-center text-gray-500">
                        <RefreshCw className="w-8 h-8 animate-spin mb-3 text-indigo-500" />
                        <span>Rendering...</span>
                      </div>
                    ) : activeItem.previewUrl ? (
                      <img src={activeItem.previewUrl} alt="1080x1080 preview" className="w-full h-full object-contain mix-blend-normal" />
                    ) : null}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Settings */}
            <div className="w-full xl:w-80 flex flex-col gap-6 flex-shrink-0">
              {activeItem && (
                <>
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 xl:sticky top-0">
                    <h2 className="text-lg font-medium mb-6 flex items-center gap-2 border-b border-gray-200 pb-4">
                      <Settings className="w-5 h-5 text-gray-400" />
                      Padding Settings
                    </h2>

                    <div className="space-y-6">
                      <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-700">Background Style</label>
                        <div className="grid grid-cols-1 gap-2">
                          <button
                            onClick={() => updateActiveSettings({ bgType: 'color' })}
                            className={`px-4 py-3 border rounded-lg text-left transition-colors flex items-center gap-3 ${activeItem.bgType === 'color' ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600/30' : 'border-gray-200 hover:border-gray-300'}`}
                          >
                            <div className="w-5 h-5 rounded border border-gray-300 shrink-0" style={{ backgroundColor: activeItem.bgType === 'color' ? activeItem.bgColor : '#ffffff' }}></div>
                            <span className="font-medium text-sm">Solid Color</span>
                          </button>
                          <button
                            onClick={() => updateActiveSettings({ bgType: 'transparent' })}
                            className={`px-4 py-3 border rounded-lg text-left transition-colors flex items-center gap-3 ${activeItem.bgType === 'transparent' ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600/30' : 'border-gray-200 hover:border-gray-300'}`}
                          >
                            <div className="w-5 h-5 rounded border border-gray-300 checkerboard-bg-small shrink-0"></div>
                            <span className="font-medium text-sm">Transparent <span className="text-xs text-gray-500 ml-1">(PNG)</span></span>
                          </button>
                        </div>
                      </div>

                      {activeItem.bgType === 'color' && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                          <label className="text-sm font-medium text-gray-700">Select Color</label>
                          <div className="flex gap-2">
                            <input
                              type="color"
                              value={activeItem.bgColor}
                              onChange={(e) => updateActiveSettings({ bgColor: e.target.value })}
                              className="w-10 h-10 rounded border-0 p-0 cursor-pointer shrink-0"
                            />
                            <input
                              type="text"
                              value={activeItem.bgColor.toUpperCase()}
                              onChange={(e) => updateActiveSettings({ bgColor: e.target.value })}
                              className="flex-1 w-full border border-gray-300 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-700"
                            />
                          </div>
                          <div className="flex gap-2 mt-2">
                             <button onClick={() => updateActiveSettings({ bgColor: '#ffffff'})} className="flex-1 h-8 rounded border border-gray-200 bg-white hover:ring-2 ring-indigo-500/30" title="White"></button>
                             <button onClick={() => updateActiveSettings({ bgColor: '#000000'})} className="flex-1 h-8 rounded border border-gray-200 bg-black hover:ring-2 ring-indigo-500/30" title="Black"></button>
                             <button onClick={() => updateActiveSettings({ bgColor: '#f3f4f6'})} className="flex-1 h-8 rounded border border-gray-200 bg-gray-100 hover:ring-2 ring-indigo-500/30" title="Light Gray"></button>
                             <button onClick={() => updateActiveSettings({ bgColor: '#1f2937'})} className="flex-1 h-8 rounded border border-gray-200 bg-gray-800 hover:ring-2 ring-indigo-500/30" title="Dark Gray"></button>
                          </div>
                        </div>
                      )}

                      <div className="pt-2 border-t border-gray-200">
                        <button 
                          onClick={applyToAll}
                          disabled={items.length <= 1}
                          className="w-full py-2.5 px-4 bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-medium hover:bg-gray-100 hover:border-gray-300 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <CopyCheck className="w-4 h-4" />
                          Apply Style to All Images
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 xl:sticky top-[calc(1.5rem+420px)] mt-6 xl:mt-0">
                    <h2 className="text-lg font-medium mb-5 flex items-center gap-2 border-b border-gray-200 pb-4">
                      <Archive className="w-5 h-5 text-gray-400" />
                      Export Options
                    </h2>

                    <div className="space-y-3">
                      <button
                        disabled={!activeItem?.previewUrl || activeItem.isProcessing}
                        onClick={() => downloadSingle(activeItem)}
                        className="w-full py-2.5 px-4 bg-indigo-50 text-indigo-700 rounded-lg font-medium hover:bg-indigo-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <Download className="w-5 h-5" />
                        Download Current
                      </button>
                      
                      <button
                        disabled={items.length === 0 || isZipping || items.some(i => i.isProcessing)}
                        onClick={downloadAllZip}
                        className="w-full py-3 px-4 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 relative overflow-hidden"
                      >
                        {isZipping ? (
                          <>
                            <RefreshCw className="w-5 h-5 animate-spin" />
                            <span>Zipping {items.length} files...</span>
                          </>
                        ) : (
                          <>
                            <Archive className="w-5 h-5" />
                            <span>Download All as ZIP ({items.length})</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </main>
      )}

      <style>{`
        .checkerboard-bg {
          background-image: 
            linear-gradient(45deg, #d1d5db 25%, transparent 25%),
            linear-gradient(-45deg, #d1d5db 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #d1d5db 75%),
            linear-gradient(-45deg, transparent 75%, #d1d5db 75%);
          background-size: 20px 20px;
          background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
          background-color: #f3f4f6;
        }
        .checkerboard-bg-small {
          background-image: 
            linear-gradient(45deg, #e5e7eb 25%, transparent 25%),
            linear-gradient(-45deg, #e5e7eb 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #e5e7eb 75%),
            linear-gradient(-45deg, transparent 75%, #e5e7eb 75%);
          background-size: 8px 8px;
          background-position: 0 0, 0 4px, 4px -4px, -4px 0px;
          background-color: #f9fafb;
        }
        
        /* Modern scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
}
