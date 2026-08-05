'use client';

import React, { useState, useRef, useEffect } from 'react';
import { loadImage } from '@/lib/canvas-renderer';
import { Crop, X, Check, ArrowLeftRight, ArrowUpDown } from 'lucide-react';

interface InteractiveCropModalProps {
  imageSrc: string;
  imageTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onCropComplete: (croppedDataUrl: string) => void;
}

export const InteractiveCropModal: React.FC<InteractiveCropModalProps> = ({
  imageSrc,
  imageTitle,
  isOpen,
  onClose,
  onCropComplete,
}) => {
  const [offsetX, setOffsetX] = useState(50); // 0% (left) to 100% (right)
  const [offsetY, setOffsetY] = useState(50); // 0% (top) to 100% (bottom)
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isWide, setIsWide] = useState(false);
  const [isTall, setIsTall] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!isOpen || !imageSrc) return;

    let isMounted = true;
    loadImage(imageSrc).then((img) => {
      if (!isMounted) return;

      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;

      setIsWide(w > h);
      setIsTall(h > w);
      renderCropPreview(img, offsetX, offsetY);
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen, imageSrc, offsetX, offsetY]);

  const renderCropPreview = (img: HTMLImageElement, posX: number, posY: number) => {
    const canvas = document.createElement('canvas');
    const targetSize = 1500;
    canvas.width = targetSize;
    canvas.height = targetSize;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;

    let srcW = Math.min(w, h);
    let srcH = Math.min(w, h);

    // Calculate crop origin based on position percentage (0..100)
    let srcX = 0;
    let srcY = 0;

    if (w > h) {
      const maxScrollX = w - h;
      srcX = (posX / 100) * maxScrollX;
    } else if (h > w) {
      const maxScrollY = h - w;
      srcY = (posY / 100) * maxScrollY;
    }

    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, targetSize, targetSize);
    const dataUrl = canvas.toDataURL('image/png');
    setPreviewUrl(dataUrl);
  };

  const handleSave = () => {
    if (previewUrl) {
      onCropComplete(previewUrl);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 dark:bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Crop className="w-4 h-4 text-amber-500" />
            İnteraktif Kare Kırpma Editörü - {imageTitle}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Preview Area */}
        <div className="flex flex-col sm:flex-row items-center gap-6 justify-center bg-slate-100 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="w-64 h-64 rounded-xl bg-white dark:bg-slate-900 border border-indigo-400/50 dark:border-indigo-500/50 overflow-hidden relative shadow-xl flex items-center justify-center">
            {previewUrl ? (
              <img src={previewUrl} alt="Crop Preview" className="w-full h-full object-cover" />
            ) : (
              <div className="text-xs text-slate-400 dark:text-slate-500">Yükleniyor...</div>
            )}
            <span className="absolute bottom-2 left-2 text-[10px] font-mono bg-slate-950/90 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/40">
              1:1 Kare Çıktı (1500x1500px)
            </span>
          </div>
        </div>

        {/* Offset Sliders */}
        <div className="space-y-4 bg-slate-100 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60">
          {isWide && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300 font-semibold">
                <span className="flex items-center gap-1.5">
                  <ArrowLeftRight className="w-3.5 h-3.5 text-amber-500" />
                  Yatay Hizalama (Sol &harr; Sağ):
                </span>
                <span className="font-mono text-amber-500 dark:text-amber-400">{Math.round(offsetX)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={offsetX}
                onChange={(e) => setOffsetX(Number(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500">
                <span>Sol Kenar</span>
                <span>Tam Ortala</span>
                <span>Sağ Kenar</span>
              </div>
            </div>
          )}

          {isTall && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300 font-semibold">
                <span className="flex items-center gap-1.5">
                  <ArrowUpDown className="w-3.5 h-3.5 text-amber-500" />
                  Dikey Hizalama (Yukarı &varr; Aşağı):
                </span>
                <span className="font-mono text-amber-500 dark:text-amber-400">{Math.round(offsetY)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={offsetY}
                onChange={(e) => setOffsetY(Number(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500">
                <span>Üst Kenar</span>
                <span>Tam Ortala</span>
                <span>Alt Kenar</span>
              </div>
            </div>
          )}

          {!isWide && !isTall && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 text-center font-medium">
              Görsel zaten tam 1:1 kare formatındadır!
            </p>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end space-x-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            İptal
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Kırpmayı Kaydet & Uygula</span>
          </button>
        </div>
      </div>
    </div>
  );
};
