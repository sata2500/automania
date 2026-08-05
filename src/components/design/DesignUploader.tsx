'use client';

import React, { useState } from 'react';
import { DesignItem, TargetApparel } from '@/types/pod';
import { InteractiveCropModal } from '@/components/common/InteractiveCropModal';
import { useToast } from '@/components/common/ToastContext';
import {
  Upload,
  Palette,
  Sun,
  Moon,
  Sparkles,
  Trash2,
  Image as ImageIcon,
  Crop,
  CheckSquare,
  Square,
  AlertCircle,
  CheckCheck,
} from 'lucide-react';

import { optimizeDesignImage, uploadMediaToServer } from '@/lib/image-optimizer';

interface DesignUploaderProps {
  designs: DesignItem[];
  setDesigns: React.Dispatch<React.SetStateAction<DesignItem[]>>;
}

const SLOT_LABELS: Record<TargetApparel, string> = {
  dark: 'Açık Giysi',
  light: 'Koyu Giysi',
  both: 'Tüm Giysi',
};

export const DesignUploader: React.FC<DesignUploaderProps> = ({ designs, setDesigns }) => {
  const toast = useToast();
  const [dragActive, setDragActive] = useState(false);
  const [cropTargetDesign, setCropTargetDesign] = useState<DesignItem | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);

  const activeForSlot = (slot: TargetApparel, list: DesignItem[]): string | null => {
    const found = list.find((d) => d.isSelected && d.targetApparel === slot);
    return found ? found.id : null;
  };

  const warnSlot = (slot: TargetApparel) => {
    toast.warning(
      `"${SLOT_LABELS[slot]}" kategorisinde zaten aktif bir tasarım var. Önce onu devre dışı bırakın.`
    );
  };

  const handleFiles = async (files: FileList | File[]) => {
    setIsOptimizing(true);
    const fileArray = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (fileArray.length === 0) {
      setIsOptimizing(false);
      return;
    }

    const uploadToastId = toast.progress('Tasarımlar işleniyor...', 10);
    let uploadedCount = 0;

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      try {
        const optimized = await optimizeDesignImage(file, 2000);
        setDesigns((prev) => {
          const slotFree = !prev.some((d) => d.isSelected && d.targetApparel === 'light');
          const newDesign: DesignItem = {
            id: 'design-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
            name: file.name.replace(/\.[^/.]+$/, ''),
            src: optimized.url || optimized.dataUrl,
            targetApparel: 'light',
            isSelected: slotFree,
            width: optimized.width,
            height: optimized.height,
          };
          return [...prev, newDesign];
        });
        uploadedCount++;
        const percent = Math.round(((i + 1) / fileArray.length) * 100);
        toast.updateProgressToast(uploadToastId, percent, `${i + 1}/${fileArray.length} tasarım işlendi`);
      } catch (err) {
        console.error('Tasarım optimizasyon hatası:', err);
        toast.error(`'${file.name}' yüklenirken hata oluştu.`);
      }
    }

    toast.removeToast(uploadToastId);
    if (uploadedCount > 0) {
      toast.success(`${uploadedCount} tasarım başarıyla yüklendi!`);
    }
    setIsOptimizing(false);
  };

  const toggleSelectDesign = (id: string) => {
    setDesigns((prev) => {
      const target = prev.find((d) => d.id === id);
      if (!target) return prev;

      if (target.isSelected) {
        return prev.map((d) => (d.id === id ? { ...d, isSelected: false } : d));
      }

      const slotTaken = prev.some(
        (d) => d.id !== id && d.isSelected && d.targetApparel === target.targetApparel
      );
      if (slotTaken) {
        warnSlot(target.targetApparel);
        return prev;
      }
      return prev.map((d) => (d.id === id ? { ...d, isSelected: true } : d));
    });
  };

  const handleSmartEnableAll = () => {
    const allSelected = designs.every((d) => d.isSelected);
    if (allSelected) {
      setDesigns((prev) => prev.map((d) => ({ ...d, isSelected: false })));
      toast.info('Tüm tasarımlar devre dışı bırakıldı.');
      return;
    }
    setDesigns((prev) => {
      const activatedSlots = new Set<TargetApparel>(
        prev.filter((d) => d.isSelected).map((d) => d.targetApparel)
      );
      return prev.map((d) => {
        if (d.isSelected) return d;
        if (!activatedSlots.has(d.targetApparel)) {
          activatedSlots.add(d.targetApparel);
          return { ...d, isSelected: true };
        }
        return d;
      });
    });
    toast.success('Kategori başına en uygun tasarımlar aktifleştirildi.');
  };

  const updateDesignTarget = (id: string, target: TargetApparel) => {
    setDesigns((prev) => {
      const design = prev.find((d) => d.id === id);
      if (!design) return prev;
      if (design.isSelected) {
        const slotTaken = prev.some(
          (d) => d.id !== id && d.isSelected && d.targetApparel === target
        );
        if (slotTaken) {
          warnSlot(target);
          return prev;
        }
      }
      return prev.map((d) => (d.id === id ? { ...d, targetApparel: target } : d));
    });
  };

  const handleCropComplete = async (croppedDataUrl: string) => {
    if (!cropTargetDesign) return;
    const serverUrl = await uploadMediaToServer(croppedDataUrl, 'image/png');
    setDesigns((prev) =>
      prev.map((d) =>
        d.id === cropTargetDesign.id ? { ...d, src: serverUrl, width: 1500, height: 1500 } : d
      )
    );
    setCropTargetDesign(null);
    toast.success('Tasarım görseli başarıyla kırpıldı!');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  const deleteDesign = (id: string) => {
    const target = designs.find((d) => d.id === id);
    setDesigns((prev) => prev.filter((d) => d.id !== id));
    toast.info(`'${target?.name || 'Tasarım'}' silindi.`);
  };

  const selectedCount = designs.filter((d) => d.isSelected).length;

  const takenSlots: Record<TargetApparel, string | null> = {
    dark: activeForSlot('dark', designs),
    light: activeForSlot('light', designs),
    both: activeForSlot('both', designs),
  };
  const activeSlotsCount = Object.values(takenSlots).filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Upload Zone */}
      <div className="bg-white dark:bg-slate-800/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-700/60">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-xl">
            <Palette className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Tasarım Yöneticisi (PNG Tasarımlarınız)</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tasarımlarınızı yükleyin, kırpın ve hangilerinin <strong>Toplu Üretimine</strong> gireceğini seçin.
            </p>
          </div>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
            dragActive
              ? 'border-indigo-400 bg-indigo-100/30 dark:bg-indigo-600/10 scale-[1.01]'
              : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 bg-slate-50 dark:bg-slate-900/40'
          }`}
        >
          <Upload className="w-10 h-10 text-indigo-500 dark:text-indigo-400 mb-3 animate-bounce" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Tasarımlarınızı Buraya Sürükleyip Bırakın</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">veya bilgisayarınızdan dosya seçin (PNG, JPG, WEBP)</p>
          <label className="mt-4 cursor-pointer inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-5 py-2.5 rounded-xl text-xs transition-all shadow-md">
            <span>Dosya Seç</span>
            <input type="file" accept="image/*" multiple onChange={(e) => e.target.files && handleFiles(e.target.files)} className="hidden" />
          </label>
        </div>
      </div>

      {/* Design List */}
      <div className="bg-white dark:bg-slate-800/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-700/60">
        <div className="flex items-start justify-between mb-4 border-b border-slate-200 dark:border-slate-700/80 pb-3 gap-3 flex-wrap">
          <div className="flex items-center flex-wrap gap-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-purple-500 dark:text-purple-400" />
              Yüklü Tasarım Listesi ({designs.length})
            </h3>

            {designs.length > 0 && (
              <button
                onClick={handleSmartEnableAll}
                className="flex items-center space-x-1 text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 font-semibold cursor-pointer"
              >
                {selectedCount === designs.length && designs.length > 0 ? (
                  <CheckSquare className="w-4 h-4" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                <span>Tümünü Seç ({selectedCount}/{designs.length} Üretimine Seçildi)</span>
              </button>
            )}

            {activeSlotsCount > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {(Object.entries(takenSlots) as [TargetApparel, string | null][]).map(([slot, takenId]) => {
                  if (!takenId) return null;
                  const design = designs.find((d) => d.id === takenId);
                  const colorMap: Record<TargetApparel, string> = {
                    dark: 'bg-amber-50 dark:bg-amber-500/20 border-amber-300 dark:border-amber-400/50 text-amber-600 dark:text-amber-300',
                    light: 'bg-indigo-50 dark:bg-indigo-600/20 border-indigo-300 dark:border-indigo-400/50 text-indigo-600 dark:text-indigo-300',
                    both: 'bg-purple-50 dark:bg-purple-600/20 border-purple-300 dark:border-purple-400/50 text-purple-600 dark:text-purple-300',
                  };
                  return (
                    <span key={slot} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${colorMap[slot]}`}>
                      {SLOT_LABELS[slot]}: {design?.name || takenId}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {designs.length === 0 ? (
          <div className="text-center py-12 text-slate-400 dark:text-slate-500">
            <Palette className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Henüz tasarım yüklenmedi.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {designs.map((design) => {
              const isSelected = !!design.isSelected;
              return (
                <div
                  key={design.id}
                  onClick={() => toggleSelectDesign(design.id)}
                  className={`relative p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group ${
                    isSelected
                      ? 'bg-gradient-to-b from-indigo-50 dark:from-indigo-950/80 to-white dark:to-slate-900 border-indigo-400 dark:border-indigo-500 shadow-lg ring-1 ring-indigo-400/50 dark:ring-indigo-500/50'
                      : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-500 opacity-75 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                        isSelected ? 'bg-indigo-600 text-white border-indigo-400' : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      {isSelected ? <CheckCheck className="w-3 h-3" /> : null}
                      {isSelected ? 'Seçili' : 'Pasif'}
                    </span>

                    <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setCropTargetDesign(design)}
                        className="p-1 text-slate-400 hover:text-amber-500 dark:hover:text-amber-300 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Tasarımı Kırp"
                      >
                        <Crop className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteDesign(design.id)}
                        className="p-1 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Tasarımı Sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="w-full h-36 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 p-2 flex items-center justify-center relative mb-3">
                    <img src={design.src} alt={design.name} className="max-w-full max-h-full object-contain drop-shadow-md" />
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{design.name}</p>

                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Hedef Kumaş:</span>
                      <div className="flex bg-slate-100 dark:bg-slate-950 rounded-lg p-0.5 border border-slate-200 dark:border-slate-800">
                        {(['dark', 'light', 'both'] as TargetApparel[]).map((target) => (
                          <button
                            key={target}
                            onClick={() => updateDesignTarget(design.id, target)}
                            className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                              design.targetApparel === target
                                ? target === 'dark' ? 'bg-amber-500 text-slate-950'
                                  : target === 'light' ? 'bg-indigo-600 text-white'
                                  : 'bg-purple-600 text-white'
                                : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                            title={SLOT_LABELS[target]}
                          >
                            {target === 'dark' ? <Sun className="w-3 h-3" /> : target === 'light' ? <Moon className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {cropTargetDesign && (
        <InteractiveCropModal
          imageSrc={cropTargetDesign.src}
          imageTitle={cropTargetDesign.name}
          isOpen={!!cropTargetDesign}
          onClose={() => setCropTargetDesign(null)}
          onCropComplete={handleCropComplete}
        />
      )}
    </div>
  );
};
