import React, { useEffect, useRef } from 'react';
import { Sparkles, Crop, Trash2, Eraser, Download, Pencil } from 'lucide-react';
import { DesignItem } from '@/types/pod';

interface DesignItemMenuProps {
  design: DesignItem;
  isOpen: boolean;
  position: { top: number; left: number } | null;
  isAnalyzing: boolean;
  onClose: () => void;
  /** Yoksa (misafir) yapay zekâ analizi gösterilmez. */
  onAnalyze?: (design: DesignItem) => void;
  onCrop: (design: DesignItem) => void;
  onRename?: (design: DesignItem) => void;
  onRemoveBg?: (design: DesignItem) => void;
  onRecolor?: (design: DesignItem, mode: 'light_garment' | 'dark_garment') => void;
  onDelete: (id: string) => void;
}

/** Görseli kayıpsız PNG'ye çevirir (saydamlık korunur); zaten PNG ise olduğu gibi döner. */
async function toPngBlob(blob: Blob): Promise<Blob> {
  if (blob.type === 'image/png') return blob;
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((png) => (png ? resolve(png) : reject(new Error('PNG oluşturulamadı.'))), 'image/png'));
}

/**
 * Tasarımı baskıya hazır PNG olarak indirir. Tasarımlar depoda zaten PNG'dir; eski WebP/JPEG kayıtlar
 * indirirken PNG'ye çevrilir (baskı firmaları çoğunlukla PNG ister; saydamlık korunur).
 */
async function downloadDesign(design: DesignItem) {
  const fileName = `${design.name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'tasarim'}.png`;
  try {
    const res = await fetch(design.src);
    if (!res.ok) throw new Error(String(res.status));
    const url = URL.createObjectURL(await toPngBlob(await res.blob()));
    const link = Object.assign(document.createElement('a'), { href: url, download: fileName });
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  } catch {
    // Doğrudan indirilemezse dosya yeni sekmede açılır (uzun basıp kaydetmek için).
    window.open(design.src, '_blank', 'noopener');
  }
}

export const DesignItemMenu: React.FC<DesignItemMenuProps> = ({
  design,
  isOpen,
  position,
  isAnalyzing,
  onClose,
  onAnalyze,
  onRename,
  onCrop,
  onRemoveBg,
  onRecolor,
  onDelete,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !position) return null;

  return (
    <div
      ref={menuRef}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
      className="fixed z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl py-1.5 min-w-[200px] text-xs animate-in fade-in zoom-in-95 duration-100"
    >
      {/* AI Analysis */}
      {onAnalyze && <button
        onClick={() => {
          onClose();
          onAnalyze(design);
        }}
        disabled={isAnalyzing}
        className="w-full px-3.5 py-2 flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors text-left font-medium disabled:opacity-50 cursor-pointer"
      >
        <Sparkles className="w-4 h-4 text-purple-500 shrink-0" />
        <span>{design.analysis ? 'Analiz Sonucunu Gör' : 'Yapay Zeka ile Analiz Et'}</span>
      </button>}

      {/* Download (orijinal çözünürlükte, baskı merkezine iletmek için) */}
      <button
        onClick={() => {
          onClose();
          void downloadDesign(design);
        }}
        className="w-full px-3.5 py-2 flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors text-left font-medium cursor-pointer"
      >
        <Download className="w-4 h-4 text-emerald-500 shrink-0" />
        <span>İndir (PNG)</span>
      </button>

      {/* Rename */}
      {onRename && (
        <button
          onClick={() => {
            onClose();
            onRename(design);
          }}
          className="w-full px-3.5 py-2 flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors text-left font-medium cursor-pointer"
        >
          <Pencil className="w-4 h-4 text-indigo-500 shrink-0" />
          <span>Yeniden Adlandır</span>
        </button>
      )}

      {/* Crop */}
      <button
        onClick={() => {
          onClose();
          onCrop(design);
        }}
        className="w-full px-3.5 py-2 flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors text-left font-medium cursor-pointer"
      >
        <Crop className="w-4 h-4 text-amber-500 shrink-0" />
        <span>Tasarımı Kırp</span>
      </button>

      {/* Remove Background */}
      {onRemoveBg && (
        <button
          onClick={() => {
            onClose();
            onRemoveBg(design);
          }}
          className="w-full px-3.5 py-2 flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors text-left font-medium cursor-pointer"
        >
          <Eraser className="w-4 h-4 text-teal-500 shrink-0" />
          <span>Arka Planı Kaldır</span>
        </button>
      )}

      {/* Recolor Options */}
      {onRecolor && (
        <>
          <button
            onClick={() => {
              onClose();
              onRecolor(design, 'dark_garment'); // Kumaşa değen koyu tonlar açılır
            }}
            className="w-full px-3.5 py-2 flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors text-left font-medium cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-sky-500 shrink-0" />
            <span>Koyu Kumaş İçin Uyarla</span>
          </button>
          <button
            onClick={() => {
              onClose();
              onRecolor(design, 'light_garment'); // Kumaşa değen açık tonlar koyulaşır
            }}
            className="w-full px-3.5 py-2 flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors text-left font-medium cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-slate-800 dark:text-slate-400 shrink-0" />
            <span>Açık Kumaş İçin Uyarla</span>
          </button>
        </>
      )}

      <div className="h-px bg-slate-100 dark:bg-slate-700 my-1" />

      {/* Delete */}
      <button
        onClick={() => {
          onClose();
          onDelete(design.id);
        }}
        className="w-full px-3.5 py-2 flex items-center gap-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-left font-medium"
      >
        <Trash2 className="w-4 h-4 shrink-0" />
        <span>Tasarımı Sil</span>
      </button>
    </div>
  );
};
