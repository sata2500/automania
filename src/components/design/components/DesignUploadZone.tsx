import React, { useRef } from 'react';
import { Upload, Loader2, Sparkles } from 'lucide-react';

interface DesignUploadZoneProps {
  dragActive: boolean;
  isOptimizing: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAIGenerate?: () => void;
}

export const DesignUploadZone: React.FC<DesignUploadZoneProps> = ({
  dragActive,
  isOptimizing,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileChange,
  onAIGenerate,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleZoneClick = () => {
    if (!isOptimizing && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 sm:p-4 rounded-2xl sm:rounded-3xl shadow-xs">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*, image/svg+xml"
        multiple
        disabled={isOptimizing}
        onChange={onFileChange}
        className="hidden"
      />

      <div className="flex gap-3">
        {/* Drag & Drop Upload Area */}
        <div
          onClick={handleZoneClick}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleZoneClick();
          }}
          className={`group flex-1 relative border-2 border-dashed rounded-xl sm:rounded-2xl p-4 sm:p-5 text-center transition-all cursor-pointer flex flex-col items-center justify-center select-none ${
            dragActive
              ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/50 scale-[1.005] shadow-md shadow-indigo-500/10'
              : 'border-slate-200 dark:border-slate-700/80 hover:border-indigo-400 dark:hover:border-indigo-500 bg-slate-50/50 dark:bg-slate-950/40 hover:bg-indigo-50/20 dark:hover:bg-indigo-950/20'
          } ${isOptimizing ? 'opacity-80 cursor-wait' : ''}`}
        >
          {isOptimizing ? (
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-indigo-500 animate-spin shrink-0" />
              <div className="text-left">
                <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                  Optimize ediliyor...
                </p>
                <p className="text-[10px] text-slate-400">2000px şeffaf PNG korunuyor</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform">
                <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="text-center">
                <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
                  Sürükle veya <span className="text-indigo-600 dark:text-indigo-400 underline underline-offset-2">seç</span>
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">PNG, SVG, WebP</p>
              </div>
            </div>
          )}
        </div>

        {/* AI Generate Button */}
        {onAIGenerate && (
          <button
            onClick={onAIGenerate}
            type="button"
            className="flex flex-col items-center justify-center gap-2 px-5 py-4 rounded-xl sm:rounded-2xl border-2 border-dashed border-purple-300 dark:border-purple-700/60 bg-purple-50/50 dark:bg-purple-950/20 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:border-purple-400 dark:hover:border-purple-600 transition-all group shrink-0"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="text-center">
              <p className="text-xs font-bold text-purple-700 dark:text-purple-300 whitespace-nowrap">AI ile Üret</p>
              <p className="text-[10px] text-purple-400 dark:text-purple-500 mt-0.5">Gemini</p>
            </div>
          </button>
        )}
      </div>
    </div>
  );
};
