import React, { useRef } from 'react';
import { Palette, Upload, Loader2 } from 'lucide-react';

interface DesignUploadZoneProps {
  dragActive: boolean;
  isOptimizing: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const DesignUploadZone: React.FC<DesignUploadZoneProps> = ({
  dragActive,
  isOptimizing,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleZoneClick = () => {
    if (!isOptimizing && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 sm:p-4 rounded-2xl sm:rounded-3xl shadow-xs">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*, image/svg+xml"
        multiple
        disabled={isOptimizing}
        onChange={onFileChange}
        className="hidden"
      />

      {/* Compact Interactive Drag & Drop Area */}
      <div
        onClick={handleZoneClick}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleZoneClick();
          }
        }}
        className={`group relative border-2 border-dashed rounded-xl sm:rounded-2xl p-4 sm:p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center select-none ${
          dragActive
            ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/50 scale-[1.005] shadow-md shadow-indigo-500/10'
            : 'border-slate-200 dark:border-slate-700/80 hover:border-indigo-400 dark:hover:border-indigo-500 bg-slate-50/50 dark:bg-slate-950/40 hover:bg-indigo-50/20 dark:hover:bg-indigo-950/20'
        } ${isOptimizing ? 'opacity-80 cursor-wait' : ''}`}
      >
        {isOptimizing ? (
          <div className="flex items-center gap-3 py-1">
            <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-500 animate-spin shrink-0" />
            <div className="text-left">
              <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                Görseller optimize ediliyor...
              </p>
              <p className="text-[10px] sm:text-[11px] text-slate-400">
                2000px şeffaf PNG formatı korunuyor
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 group-hover:scale-105 transition-transform shadow-xs">
              <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="text-center sm:text-left">
              <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
                Tasarımları sürükleyin veya <span className="text-indigo-600 dark:text-indigo-400 underline underline-offset-2">seçin</span>
              </p>
              <p className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                PNG, SVG, WebP • Otomatik 2000px optimizasyon
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

