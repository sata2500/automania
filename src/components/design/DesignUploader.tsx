'use client';

import React, { useState } from 'react';
import { DesignItem, TargetApparel, MockupFolder } from '@/types/pod';
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
  Folder,
  FolderOpen,
  Plus,
  FolderTree,
  MoreVertical,
} from 'lucide-react';

import { optimizeDesignImage, uploadMediaToServer } from '@/lib/image-optimizer';
import { deleteBlobs } from '@/lib/storage-service';

interface DesignUploaderProps {
  designs: DesignItem[];
  setDesigns: React.Dispatch<React.SetStateAction<DesignItem[]>>;
  folders: MockupFolder[];
  setFolders: React.Dispatch<React.SetStateAction<MockupFolder[]>>;
  activeDesignFolderId: string | null;
  setActiveDesignFolderId: (id: string | null) => void;
}

const SLOT_LABELS: Record<TargetApparel, string> = {
  dark: 'Açık Giysi',
  light: 'Koyu Giysi',
  both: 'Tüm Giysi',
};

export const DesignUploader: React.FC<DesignUploaderProps> = ({ 
  designs, 
  setDesigns,
  folders,
  setFolders,
  activeDesignFolderId,
  setActiveDesignFolderId
}) => {
  const toast = useToast();
  const [dragActive, setDragActive] = useState(false);
  const [cropTargetDesign, setCropTargetDesign] = useState<DesignItem | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);

  const designFolders = folders.filter(f => f.type === 'design');
  
  const handleAddFolder = () => {
    const name = prompt('Yeni tasarım klasörünün adını girin:');
    if (!name || name.trim() === '') return;
    const newFolder: MockupFolder = {
      id: 'dfol-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      name: name.trim(),
      isCustom: true,
      type: 'design',
    };
    setFolders((prev) => [...prev, newFolder]);
    setActiveDesignFolderId(newFolder.id);
    toast.success(`"${name}" tasarım klasörü oluşturuldu.`);
  };

  const handleDeleteFolder = (id: string, name: string) => {
    if (!confirm(`"${name}" klasörünü silmek istediğinize emin misiniz? (İçindeki tasarımlar 'Tüm Tasarımlar'a taşınacaktır)`)) return;
    setFolders((prev) => prev.filter((f) => f.id !== id));
    setDesigns((prev) => prev.map(d => d.folderId === id ? { ...d, folderId: undefined } : d));
    if (activeDesignFolderId === id) {
      setActiveDesignFolderId(null);
    }
    toast.info(`"${name}" klasörü silindi.`);
  };

  const handleMoveToFolder = (designId: string, folderId: string | null) => {
    setDesigns((prev) => prev.map(d => d.id === designId ? { ...d, folderId: folderId || undefined } : d));
    toast.success('Tasarım taşındı.');
  };

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
          return [newDesign, ...prev];
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

  const [selectedDesignIds, setSelectedDesignIds] = useState<string[]>([]);

  const toggleManagementSelection = (id: string) => {
    setSelectedDesignIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSetProductionActive = (id: string, target: TargetApparel) => {
    setDesigns((prev) => {
      const design = prev.find((d) => d.id === id);
      if (!design) return prev;

      // If clicking the same target that is already active, deactivate it
      if (design.isSelected && design.targetApparel === target) {
        return prev.map((d) => (d.id === id ? { ...d, isSelected: false } : d));
      }

      // Check if this slot is already taken by ANOTHER design
      const slotTaken = prev.some(
        (d) => d.id !== id && d.isSelected && d.targetApparel === target
      );
      
      if (slotTaken) {
        warnSlot(target);
        return prev;
      }

      // Make it active and set target
      return prev.map((d) => (d.id === id ? { ...d, isSelected: true, targetApparel: target } : d));
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
    if (target?.src) {
      deleteBlobs([target.src]);
    }
    setDesigns((prev) => prev.filter((d) => d.id !== id));
    setSelectedDesignIds((prev) => prev.filter(x => x !== id));
    toast.info(`'${target?.name || 'Tasarım'}' silindi.`);
  };

  const handleBulkDelete = () => {
    if (selectedDesignIds.length === 0) return;
    if (!confirm(`${selectedDesignIds.length} tasarımı silmek istediğinize emin misiniz?`)) return;
    
    const targets = designs.filter(d => selectedDesignIds.includes(d.id));
    const blobsToDelete = targets.map(t => t.src).filter(Boolean);
    if (blobsToDelete.length > 0) {
      deleteBlobs(blobsToDelete);
    }
    
    setDesigns((prev) => prev.filter((d) => !selectedDesignIds.includes(d.id)));
    setSelectedDesignIds([]);
    toast.info(`${targets.length} tasarım silindi.`);
  };

  const handleBulkMove = (folderId: string | null) => {
    if (selectedDesignIds.length === 0) return;
    setDesigns((prev) => prev.map(d => 
      selectedDesignIds.includes(d.id) ? { ...d, folderId: folderId || undefined } : d
    ));
    setSelectedDesignIds([]);
    toast.success(`${selectedDesignIds.length} tasarım taşındı.`);
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

      {/* Folder Selection Bar */}
      <div className="bg-slate-50 dark:bg-slate-900/90 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
        <div className="flex items-center justify-between mb-2">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Tasarım Klasörleri
          </label>
          <button
            onClick={handleAddFolder}
            className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors"
          >
            <Plus className="w-3 h-3" /> Yeni Klasör
          </button>
        </div>
        <div className="grid grid-rows-1 grid-flow-col auto-cols-max gap-2 overflow-x-auto custom-scrollbar pb-2.5">
          <button
            onClick={() => setActiveDesignFolderId(null)}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer max-w-[210px] min-w-0 ${
              activeDesignFolderId === null
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 border-indigo-400 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FolderTree className={`w-4 h-4 shrink-0 ${activeDesignFolderId === null ? 'text-amber-300' : 'text-indigo-500 dark:text-indigo-400'}`} />
            <span className="truncate">Tüm Tasarımlar</span>
            <span className={`px-2 py-0.5 text-[10px] rounded-full font-extrabold shrink-0 ${
              activeDesignFolderId === null ? 'bg-slate-950/80 text-amber-300' : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
            }`}>
              {designs.length}
            </span>
          </button>

          {designFolders.map((folder) => {
            const isActive = activeDesignFolderId === folder.id;
            const folderDesignsCount = designs.filter((d) => d.folderId === folder.id).length;
            return (
              <div key={folder.id} className="relative group/folder">
                <button
                  onClick={() => setActiveDesignFolderId(folder.id)}
                  className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer max-w-[210px] min-w-0 pr-8 ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 border-indigo-400 text-white shadow-lg shadow-indigo-600/30'
                      : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  title={`${folder.name} (${folderDesignsCount} Tasarım)`}
                >
                  {isActive ? <FolderOpen className="w-4 h-4 text-amber-300 shrink-0" /> : <Folder className="w-4 h-4 text-slate-400 shrink-0" />}
                  <span className="truncate">{folder.name}</span>
                  <span className={`px-2 py-0.5 text-[10px] rounded-full font-extrabold shrink-0 ${
                    isActive ? 'bg-slate-950/80 text-amber-300' : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}>
                    {folderDesignsCount}
                  </span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteFolder(folder.id, folder.name);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-rose-500 opacity-0 group-hover/folder:opacity-100 transition-opacity"
                  title="Klasörü Sil"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
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
            
            {/* Active slots summary (Optional) */}
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

          {/* Bulk Management Toolbar */}
          <div className="w-full mt-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const filteredDesigns = designs.filter(d => activeDesignFolderId ? d.folderId === activeDesignFolderId : true);
                  if (selectedDesignIds.length === filteredDesigns.length && filteredDesigns.length > 0) {
                    setSelectedDesignIds([]);
                  } else {
                    setSelectedDesignIds(filteredDesigns.map(d => d.id));
                  }
                }}
                className="flex items-center space-x-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-bold px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg transition-colors cursor-pointer"
              >
                {selectedDesignIds.length > 0 && selectedDesignIds.length === designs.filter(d => activeDesignFolderId ? d.folderId === activeDesignFolderId : true).length ? (
                  <CheckSquare className="w-4 h-4" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                <span>Tümünü Seç</span>
              </button>
              
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 border-l border-slate-300 dark:border-slate-700 pl-3">
                {selectedDesignIds.length} Tasarım Seçildi
              </span>
            </div>

            <div className="flex items-center gap-2">
              {designFolders.length > 0 && selectedDesignIds.length > 0 && (
                <select
                  onChange={(e) => handleBulkMove(e.target.value || null)}
                  className="text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg px-2 py-1.5 outline-none cursor-pointer max-w-[120px] truncate"
                >
                  <option value="">Klasöre Taşı...</option>
                  <option value="">Tüm Tasarımlar</option>
                  {designFolders.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              )}
              
              <button
                onClick={handleBulkDelete}
                disabled={selectedDesignIds.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Toplu Sil
              </button>
            </div>
          </div>
        </div>

        {designs.filter(d => activeDesignFolderId ? d.folderId === activeDesignFolderId : true).length === 0 ? (
          <div className="text-center py-12 text-slate-400 dark:text-slate-500">
            <Palette className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Bu klasörde henüz tasarım yok.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {designs
              .filter(d => activeDesignFolderId ? d.folderId === activeDesignFolderId : true)
              .map((design) => {
              const isSelected = !!design.isSelected;
              const isChecked = selectedDesignIds.includes(design.id);
              
              return (
                <div
                  key={design.id}
                  onClick={() => toggleManagementSelection(design.id)}
                  className={`relative p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group ${
                    isChecked
                      ? 'bg-gradient-to-b from-indigo-50 dark:from-indigo-950/80 to-white dark:to-slate-900 border-indigo-400 dark:border-indigo-500 shadow-lg ring-1 ring-indigo-400/50 dark:ring-indigo-500/50'
                      : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-500 opacity-75 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                        isChecked ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 group-hover:border-indigo-400'
                      }`}>
                        {isChecked && <CheckCheck className="w-3.5 h-3.5" />}
                      </div>
                    </div>

                    <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                      {designFolders.length > 0 && (
                        <select
                          value={design.folderId || ''}
                          onChange={(e) => handleMoveToFolder(design.id, e.target.value || null)}
                          className="bg-transparent text-[10px] text-slate-400 hover:text-indigo-500 cursor-pointer border-none outline-none max-w-[80px] truncate"
                          title="Klasöre Taşı"
                        >
                          <option value="">Tüm Tasarımlar</option>
                          {designFolders.map(f => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                          ))}
                        </select>
                      )}
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

                  <div className={`w-full h-36 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-950/80 border p-2 flex items-center justify-center relative mb-3 transition-colors ${
                    isSelected ? 'border-amber-400 dark:border-amber-500 ring-2 ring-amber-400/20' : 'border-slate-200 dark:border-slate-800'
                  }`}>
                    <img src={design.src} alt={design.name} className="max-w-full max-h-full object-contain drop-shadow-md" />
                    {isSelected && (
                      <div className="absolute top-2 right-2 bg-slate-900/80 text-amber-300 px-2 py-0.5 rounded-full text-[9px] font-bold backdrop-blur-sm shadow-sm flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Üretimde
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{design.name}</p>

                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Üretim Seçimi:</span>
                      <div className="flex bg-slate-100 dark:bg-slate-950 rounded-lg p-0.5 border border-slate-200 dark:border-slate-800 gap-0.5">
                        {(['dark', 'light', 'both'] as TargetApparel[]).map((target) => {
                          const isActiveSlot = isSelected && design.targetApparel === target;
                          return (
                            <button
                              key={target}
                              onClick={() => handleSetProductionActive(design.id, target)}
                              className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                                isActiveSlot
                                  ? target === 'dark' ? 'bg-amber-500 text-slate-950 shadow-sm'
                                    : target === 'light' ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'bg-purple-600 text-white shadow-sm'
                                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                              }`}
                              title={`${SLOT_LABELS[target]} için üretimi aktif/pasif yap`}
                            >
                              {target === 'dark' ? 'Açık' : target === 'light' ? 'Koyu' : 'Tümü'}
                            </button>
                          );
                        })}
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
