'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MockupItem, ApparelType, PrintArea, MockupFolder } from '@/types/pod';
import { InteractiveCropModal } from '@/components/common/InteractiveCropModal';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { useToast } from '@/components/common/ToastContext';
import {
  Upload,
  Trash2,
  Plus,
  RotateCw,
  FolderPlus,
  Folder,
  FolderOpen,
  Copy,
  ClipboardCheck,
  Crop,
  Layers,
  CheckSquare,
  Square,
  SlidersHorizontal,
  X,
  BarChart3,
  GripVertical,
  Video,
  Pencil,
  CopyPlus,
  Save,
  Undo,
  AlertCircle,
  Check,
  MoreVertical,
} from 'lucide-react';
import { optimizeMockupImage, uploadMediaToServer } from '@/lib/image-optimizer';
import { optimizeVideoFile } from '@/lib/video-optimizer';

interface MockupCanvasEditorProps {
  mockups: MockupItem[];
  setMockups: React.Dispatch<React.SetStateAction<MockupItem[]>>;
  folders: MockupFolder[];
  setFolders: React.Dispatch<React.SetStateAction<MockupFolder[]>>;
  selectedMockupId: string | null;
  setSelectedMockupId: (id: string | null) => void;
  activeFolderId: string | null;
  setActiveFolderId: (id: string | null) => void;
}

export const MockupCanvasEditor: React.FC<MockupCanvasEditorProps> = ({
  mockups,
  setMockups,
  folders,
  setFolders,
  selectedMockupId,
  setSelectedMockupId,
  activeFolderId,
  setActiveFolderId,
}) => {
  const toast = useToast();
  const selectedMockup = mockups.find((m) => m.id === selectedMockupId) || mockups[0] || null;
  const containerRef = useRef<HTMLDivElement>(null);

  const [selectedMockupIds, setSelectedMockupIds] = useState<Set<string>>(new Set());
  const [activeAreaIndex, setActiveAreaIndex] = useState<number>(0);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);

  const [editingMockupId, setEditingMockupId] = useState<string | null>(null);
  const [editingMockupName, setEditingMockupName] = useState<string>('');

  // Confirmation Modals State
  const [confirmModalState, setConfirmModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Local Draft Editing State (For 60 FPS lag-free slider movement & explicit Save/Revert)
  const [draftAreas, setDraftAreas] = useState<PrintArea[]>([]);
  const [draftApparelType, setDraftApparelType] = useState<ApparelType>('light');
  const [draftHasPrintArea, setDraftHasPrintArea] = useState<boolean>(true);

  // Sync draft state whenever selectedMockup changes
  useEffect(() => {
    if (selectedMockup) {
      setDraftAreas(JSON.parse(JSON.stringify(selectedMockup.printAreas || [])));
      setDraftApparelType(selectedMockup.apparelType);
      setDraftHasPrintArea(selectedMockup.hasPrintArea !== false);
      if (activeAreaIndex >= (selectedMockup.printAreas?.length || 1)) {
        setActiveAreaIndex(0);
      }
    }
  }, [selectedMockup?.id]);

  // Check if current draft has unsaved changes
  const isDirty = selectedMockup
    ? JSON.stringify(draftAreas) !== JSON.stringify(selectedMockup.printAreas || []) ||
      draftApparelType !== selectedMockup.apparelType ||
      draftHasPrintArea !== (selectedMockup.hasPrintArea !== false)
    : false;

  // Save draft changes to main state
  const handleSaveChanges = () => {
    if (!selectedMockup) return;
    setMockups((prev) =>
      prev.map((m) =>
        m.id === selectedMockup.id
          ? {
              ...m,
              printAreas: JSON.parse(JSON.stringify(draftAreas)),
              apparelType: draftApparelType,
              hasPrintArea: draftHasPrintArea,
            }
          : m
      )
    );
    toast.success('Baskı ayarları başarıyla kaydedildi!');
  };

  // Revert draft changes back to saved mockup state
  const handleRevertChanges = () => {
    if (!selectedMockup) return;
    setDraftAreas(JSON.parse(JSON.stringify(selectedMockup.printAreas || [])));
    setDraftApparelType(selectedMockup.apparelType);
    setDraftHasPrintArea(selectedMockup.hasPrintArea !== false);
    toast.info('Değişiklikler geri alındı.');
  };

  const updateActivePrintAreaDraft = (areaUpdates: Partial<PrintArea>) => {
    setDraftAreas((prev) =>
      prev.map((area, idx) => (idx === activeAreaIndex ? { ...area, ...areaUpdates } : area))
    );
  };

  const displayedMockups = activeFolderId
    ? mockups.filter((m) => m.folderId === activeFolderId)
    : mockups;

  // Drag & Drop reordering handlers
  const [draggedMockupId, setDraggedMockupId] = useState<string | null>(null);
  const [dragOverMockupId, setDragOverMockupId] = useState<string | null>(null);

  const handleDragStartMockup = (id: string, e: React.DragEvent) => {
    setDraggedMockupId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOverMockup = (id: string, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverMockupId !== id) {
      setDragOverMockupId(id);
    }
  };

  const handleDropMockup = (targetId: string, e: React.DragEvent) => {
    e.preventDefault();
    const draggedId = draggedMockupId || e.dataTransfer.getData('text/plain');
    if (!draggedId || draggedId === targetId) {
      setDraggedMockupId(null);
      setDragOverMockupId(null);
      return;
    }

    setMockups((prev) => {
      const fromIndex = prev.findIndex((m) => m.id === draggedId);
      const toIndex = prev.findIndex((m) => m.id === targetId);
      if (fromIndex === -1 || toIndex === -1) return prev;

      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });

    setDraggedMockupId(null);
    setDragOverMockupId(null);
    toast.info("Mockup sıralaması güncellendi.");
  };

  const handleDragEndMockup = () => {
    setDraggedMockupId(null);
    setDragOverMockupId(null);
  };

  const handleStartRename = (mockupId: string, currentName: string, e?: any) => {
    e?.stopPropagation();
    setEditingMockupId(mockupId);
    setEditingMockupName(currentName);
  };

  const handleSaveRename = (mockupId: string) => {
    if (!editingMockupName.trim()) {
      setEditingMockupId(null);
      return;
    }
    const cleanName = editingMockupName.trim();
    setMockups((prev) =>
      prev.map((item) => (item.id === mockupId ? { ...item, name: cleanName } : item))
    );
    setEditingMockupId(null);
    toast.success('Mockup adı güncellendi.');
  };

  const [dragMode, setDragMode] = useState<'move' | 'resize-se' | 'rotate' | null>(null);
  const [dragStart, setDragStart] = useState<{
    mouseX: number;
    mouseY: number;
    area: PrintArea;
    startAngleDeg?: number;
    startRotation?: number;
    boxCenterX?: number;
    boxCenterY?: number;
  } | null>(null);

  const [copiedConfig, setCopiedConfig] = useState<{
    printAreas: PrintArea[];
    apparelType: ApparelType;
  } | null>(null);

  const [newFolderName, setNewFolderName] = useState('');
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [openFolderMenuId, setOpenFolderMenuId] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = () => setOpenFolderMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const activePrintArea = draftAreas[activeAreaIndex] || draftAreas[0];

  const toggleSelectMockup = (id: string, e: any) => {
    e.stopPropagation();
    setSelectedMockupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedMockupIds.size === displayedMockups.length) {
      setSelectedMockupIds(new Set());
    } else {
      setSelectedMockupIds(new Set(displayedMockups.map((m) => m.id)));
    }
  };

  const handleApplyToSelected = () => {
    if (selectedMockupIds.size === 0 || !selectedMockup) return;
    setMockups((prev) =>
      prev.map((m) => {
        if (selectedMockupIds.has(m.id)) {
          return {
            ...m,
            printAreas: JSON.parse(JSON.stringify(draftAreas)),
            apparelType: draftApparelType,
          };
        }
        return m;
      })
    );
    toast.success(`Baskı alanları seçilen ${selectedMockupIds.size} mockup'a uygulandı!`);
  };

  const handleDeleteSelected = () => {
    if (selectedMockupIds.size === 0) return;

    setConfirmModalState({
      isOpen: true,
      title: 'Seçili Mockup’ları Sil',
      message: `Seçilen ${selectedMockupIds.size} adet mockup silinecektir. Devam etmek istiyor musunuz?`,
      onConfirm: () => {
        setMockups((prev) => prev.filter((m) => !selectedMockupIds.has(m.id)));
        setSelectedMockupIds(new Set());
        setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
        toast.info("Seçili mockup'lar silindi.");
      },
    });
  };

  const handleAddPrintArea = () => {
    if (!selectedMockup) return;
    const newArea: PrintArea = {
      id: 'area-' + Date.now(),
      name: `Baskı Alanı ${draftAreas.length + 1}`,
      x: 35, y: 35, width: 30, height: 30, rotation: 0,
    };
    const updated = [...draftAreas, newArea];
    setDraftAreas(updated);
    setDraftHasPrintArea(true);
    setActiveAreaIndex(updated.length - 1);
    toast.success(`'${newArea.name}' eklendi (Kaydetmek için butona tıklayın).`);
  };

  const handleRemovePrintArea = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedMockup || draftAreas.length <= 1) {
      toast.warning('En az 1 baskı alanı bulunmalıdır.');
      return;
    }
    const removedName = draftAreas[idx]?.name || 'Baskı alanı';
    const updated = draftAreas.filter((_, i) => i !== idx);
    setDraftAreas(updated);
    setActiveAreaIndex(0);
    toast.info(`'${removedName}' kaldırıldı (Kaydetmek için butona tıklayın).`);
  };



  const handleTogglePrintAreaMode = () => {
    if (!selectedMockup) return;
    if (!draftHasPrintArea) {
      const defaultArea: PrintArea = {
        id: 'area-' + Date.now(),
        name: 'Ana Baskı Alanı',
        x: 33, y: 30, width: 34, height: 40, rotation: 0,
      };
      const newAreas = draftAreas.length ? draftAreas : [defaultArea];
      setDraftAreas(newAreas);
      setDraftHasPrintArea(true);
      toast.success('Baskı alanı modu aktifleştirildi.');
    } else {
      setDraftHasPrintArea(false);
      toast.info('Statik Görsel / Chart moduna geçildi.');
    }
  };

  const handleCropComplete = async (croppedDataUrl: string) => {
    if (selectedMockup) {
      const serverUrl = await uploadMediaToServer(croppedDataUrl, 'image/webp');
      setMockups((prev) => prev.map((m) => (m.id === selectedMockup.id ? { ...m, src: serverUrl } : m)));
      toast.success('Mockup görseli başarıyla kırpıldı ve kaydedildi!');
    }
  };

  const handleDeleteFolder = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const folder = folders.find((f) => f.id === folderId);

    setConfirmModalState({
      isOpen: true,
      title: `'${folder?.name || 'Klasör'}' Silinsin mi?`,
      message: `Bu klasör ve içindeki tüm mockup yapılandırmaları silinecektir. Devam etmek istiyor musunuz?`,
      onConfirm: () => {
        setFolders((prev) => prev.filter((f) => f.id !== folderId));
        setMockups((prev) => prev.filter((m) => m.folderId !== folderId));
        if (activeFolderId === folderId) setActiveFolderId(null);
        setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
        toast.info(`'${folder?.name || 'Klasör'}' silindi.`);
      },
    });
  };

  const handleDuplicateFolder = (folderId: string, e: any) => {
    e.stopPropagation();
    const sourceFolder = folders.find((f) => f.id === folderId);
    if (!sourceFolder) return;

    const newFolderId = 'folder-' + Date.now();
    const newFolderName = `${sourceFolder.name} (Kopya)`;
    const newFolder: MockupFolder = {
      id: newFolderId,
      name: newFolderName,
      isCustom: true,
    };

    const sourceMockups = mockups.filter((m) => m.folderId === folderId);
    const copiedMockups: MockupItem[] = sourceMockups.map((m) => ({
      ...m,
      id: 'mockup-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      folderId: newFolderId,
      printAreas: JSON.parse(JSON.stringify(m.printAreas || [])),
    }));

    setFolders((prev) => [...prev, newFolder]);
    setMockups((prev) => [...prev, ...copiedMockups]);
    setActiveFolderId(newFolderId);
    toast.success(`'${sourceFolder.name}' klasörü ve içeriği kopyalandı!`);
  };

  const handleCopyConfig = () => {
    if (!selectedMockup) return;
    setCopiedConfig({
      printAreas: JSON.parse(JSON.stringify(draftAreas)),
      apparelType: draftApparelType,
    });
    toast.success('Baskı alanları panoya kopyalandı!');
  };

  const handlePasteConfig = () => {
    if (!copiedConfig || !selectedMockup) return;
    setDraftApparelType(copiedConfig.apparelType);
    setDraftAreas(JSON.parse(JSON.stringify(copiedConfig.printAreas)));
    toast.success("Baskı alanları bu mockup'a yapıştırıldı (Kaydetmek için tıklayın)!");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const targetFolder = activeFolderId || folders[0]?.id || 'folder-women';

    const existingInFolder = mockups.filter((m) => m.folderId === targetFolder);
    let currentImageCount = existingInFolder.filter((m) => !m.isVideo).length;
    let currentVideoCount = existingInFolder.filter((m) => m.isVideo).length;

    const fileList = Array.from(files);
    let addedCount = 0;
    const uploadToastId = toast.progress('Görseller yükleniyor ve işleniyor...', 10);

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      try {
        const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(file.name);

        if (isVideo) {
          if (currentVideoCount >= 2) {
            toast.warning(`'${file.name}' eklenemedi! Klasörde maks. 2 video sınırı mevcut. (Etsy Limiti)`);
            continue;
          }
          currentVideoCount++;
        } else {
          if (currentImageCount >= 20) {
            toast.warning(`'${file.name}' eklenemedi! Klasörde maks. 20 görsel sınırı mevcut. (Etsy Limiti)`);
            continue;
          }
          currentImageCount++;
        }

        let srcUrl: string;
        let imgWidth = 2000;
        let imgHeight = 2000;
        let mimeType = isVideo ? 'video/mp4' : 'image/webp';

        if (isVideo) {
          const optimizedVideo = await optimizeVideoFile(file);
          srcUrl = optimizedVideo.url || optimizedVideo.dataUrl;
          mimeType = optimizedVideo.mimeType || 'video/mp4';
        } else {
          const optimized = await optimizeMockupImage(file, 2000, 0.90);
          srcUrl = optimized.url || optimized.dataUrl;
          imgWidth = optimized.width;
          imgHeight = optimized.height;
        }

        const newMockup: MockupItem = {
          id: 'mockup-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
          name: file.name.replace(/\.[^/.]+$/, ''),
          src: srcUrl,
          folderId: targetFolder,
          apparelType: draftApparelType,
          printAreas: isVideo ? [] : JSON.parse(JSON.stringify(draftAreas.length ? draftAreas : [{ id: 'area-1', name: 'Ana Baskı Alanı', x: 33, y: 30, width: 34, height: 40, rotation: 0 }])),
          opacity: 1.0,
          width: imgWidth,
          height: imgHeight,
          hasPrintArea: !isVideo,
          isVideo,
          mimeType,
        };

        setMockups((prev) => [...prev, newMockup]);
        setSelectedMockupId(newMockup.id);
        addedCount++;

        const percent = Math.round(((i + 1) / fileList.length) * 100);
        toast.updateProgressToast(uploadToastId, percent, `${i + 1}/${fileList.length} dosya yüklendi`);
      } catch (err) {
        console.error('Mockup/Video optimizasyon hatası:', err);
        toast.error(`'${file.name}' yüklenirken hata oluştu.`);
      }
    }

    toast.removeToast(uploadToastId);
    if (addedCount > 0) {
      toast.success(`${addedCount} dosya başarıyla klasöre yüklendi!`);
    }
  };

  const handlePointerDown = (e: any, mode: 'move' | 'resize-se' | 'rotate') => {
    e.stopPropagation();
    e.preventDefault();
    setDragMode(mode);

    if (mode === 'rotate' && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const containerW = rect.width;
      const containerH = rect.height;
      const boxCenterX = rect.left + ((activePrintArea.x + activePrintArea.width / 2) / 100) * containerW;
      const boxCenterY = rect.top + ((activePrintArea.y + activePrintArea.height / 2) / 100) * containerH;
      const rad = Math.atan2(e.clientY - boxCenterY, e.clientX - boxCenterX);
      const startAngleDeg = (rad * 180) / Math.PI;

      setDragStart({
        mouseX: e.clientX,
        mouseY: e.clientY,
        area: { ...activePrintArea },
        startAngleDeg,
        startRotation: activePrintArea.rotation || 0,
        boxCenterX,
        boxCenterY,
      });
    } else {
      setDragStart({
        mouseX: e.clientX,
        mouseY: e.clientY,
        area: { ...activePrintArea },
      });
    }
  };

  useEffect(() => {
    const handlepointermove = (e: PointerEvent) => {
      if (!dragMode || !dragStart || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const containerW = rect.width;
      const containerH = rect.height;
      const deltaXPercent = ((e.clientX - dragStart.mouseX) / containerW) * 100;
      const deltaYPercent = ((e.clientY - dragStart.mouseY) / containerH) * 100;

      if (dragMode === 'move') {
        const newX = Math.max(0, Math.min(100 - dragStart.area.width, dragStart.area.x + deltaXPercent));
        const newY = Math.max(0, Math.min(100 - dragStart.area.height, dragStart.area.y + deltaYPercent));
        updateActivePrintAreaDraft({ x: Math.round(newX * 10) / 10, y: Math.round(newY * 10) / 10 });
      } else if (dragMode === 'resize-se') {
        const newW = Math.max(10, Math.min(100 - dragStart.area.x, dragStart.area.width + deltaXPercent));
        const newH = Math.max(10, Math.min(100 - dragStart.area.y, dragStart.area.height + deltaYPercent));
        updateActivePrintAreaDraft({ width: Math.round(newW * 10) / 10, height: Math.round(newH * 10) / 10 });
      } else if (dragMode === 'rotate' && dragStart.boxCenterX !== undefined && dragStart.boxCenterY !== undefined) {
        const rad = Math.atan2(e.clientY - dragStart.boxCenterY, e.clientX - dragStart.boxCenterX);
        const currentAngleDeg = (rad * 180) / Math.PI;
        const deltaDeg = currentAngleDeg - (dragStart.startAngleDeg || 0);

        let newRotation = Math.round((dragStart.startRotation || 0) + deltaDeg);
        while (newRotation > 180) newRotation -= 360;
        while (newRotation < -180) newRotation += 360;

        updateActivePrintAreaDraft({ rotation: newRotation });
      }
    };
    const handlepointerup = () => { setDragMode(null); setDragStart(null); };
    if (dragMode) {
      window.addEventListener('pointermove', handlepointermove);
      window.addEventListener('pointerup', handlepointerup);
    }
    return () => {
      window.removeEventListener('pointermove', handlepointermove);
      window.removeEventListener('pointerup', handlepointerup);
    };
  }, [dragMode, dragStart, activePrintArea]);

  /**
   * Render Settings Panel with Unsaved Changes Bar & Instant 60 FPS Sliders
   */
  const renderSettingsPanel = () => {
    const isStaticAsset = !draftHasPrintArea || !draftAreas.length;

    return (
      <div className="space-y-4">
        {/* Unsaved Changes Status & Explicit Save / Revert Bar */}
        {isDirty && (
          <div className="bg-gradient-to-r from-amber-950/80 to-indigo-950/80 p-3 rounded-2xl border border-amber-500/40 space-y-2 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                Kaydedilmemiş Değişiklikler Var
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={handleRevertChanges}
                className="py-1.5 px-2.5 bg-white dark:bg-slate-800 hover:bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 font-bold rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer transition-all"
              >
                <Undo className="w-3.5 h-3.5" />
                <span>Geri Al</span>
              </button>
              <button
                onClick={handleSaveChanges}
                className="py-1.5 px-2.5 bg-indigo-600 hover:bg-indigo-500 text-slate-900 dark:text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-1 shadow-lg shadow-indigo-600/40 cursor-pointer transition-all"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Kaydet</span>
              </button>
            </div>
          </div>
        )}

        {/* Mode Selector Header */}
        <div className="space-y-1.5 border-b border-slate-300 dark:border-slate-700 pb-3">
          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block">Görsel Modu:</label>
          <div
            className={`w-full py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-between ${
              isStaticAsset
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500/60 text-amber-600 dark:text-amber-300 shadow-md'
                : 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-500/40 text-indigo-600 dark:text-indigo-200'
            }`}
          >
            <span className="flex items-center gap-2">
              {isStaticAsset ? (
                <BarChart3 className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              ) : (
                <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              )}
              <span>
                {isStaticAsset ? 'Statik Görsel / Chart' : 'Standart Mockup (Baskı Alanlı)'}
              </span>
            </span>
          </div>
        </div>

        {isStaticAsset ? (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-500/40 rounded-2xl p-4 text-center space-y-2">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-500/20 rounded-xl flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400 border border-amber-500/30">
              <BarChart3 className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-amber-600 dark:text-amber-200">Statik Görsel / Chart Modu Aktif</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Bu görsel üzerine tasarım yerleştirilmez. Toplu üretimde orijinal resim (Size Chart, Color Chart vs.) olarak çıktıya eklenir.
            </p>
          </div>
        ) : (
          <>
            {/* Print Area Tabs & Management Header */}
            <div className="space-y-2 border-b border-slate-300 dark:border-slate-700 pb-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Baskı Alanları ({draftAreas.length})</span>
                </h3>

                <button
                  onClick={handleAddPrintArea}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-slate-900 dark:text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow transition-all cursor-pointer"
                  title="Bu mockup üzerine yeni bir baskı kutusu ekleyin"
                >
                  <Plus className="w-3 h-3" />
                  <span>Alan Ekle</span>
                </button>
              </div>

              {/* Print Area Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 pt-1">
                {draftAreas.map((area, idx) => {
                  const isActive = idx === activeAreaIndex;
                  return (
                    <div key={area.id || idx} className="relative group shrink-0 flex items-center">
                      <button
                        onClick={() => setActiveAreaIndex(idx)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                          isActive
                            ? 'bg-indigo-600 text-slate-900 dark:text-white shadow-md'
                            : 'bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        <span className="truncate max-w-[90px]">{area.name || `Alan ${idx + 1}`}</span>
                        {draftAreas.length > 1 && (
                          <span
                            onClick={(e) => handleRemovePrintArea(idx, e)}
                            className="p-0.5 hover:bg-rose-500/30 text-slate-600 dark:text-slate-400 hover:text-rose-300 rounded transition-colors ml-1"
                            title="Baskı Alanını Sil"
                          >
                            <X className="w-3 h-3" />
                          </span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Active Print Area Name Input */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block">Baskı Alanı Adı:</label>
              <input
                type="text"
                value={activePrintArea?.name || ''}
                onChange={(e) => updateActivePrintAreaDraft({ name: e.target.value })}
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-1.5 text-xs outline-none focus:border-indigo-500 font-medium"
                placeholder="Örn: Ön Baskı, Sırt, Sol Kol"
              />
            </div>

            {/* Instant 60 FPS Rotation Angle Slider & Quick Angle Presets */}
            <div className="space-y-2 pt-2 border-t border-slate-700/60">
              <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-400 font-semibold">
                <span className="flex items-center gap-1">
                  <RotateCw className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  Açı / Eğiklik:
                </span>
                <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">{activePrintArea?.rotation || 0}°</span>
              </div>
              <input
                type="range" min="-180" max="180"
                value={activePrintArea?.rotation || 0}
                onChange={(e) => updateActivePrintAreaDraft({ rotation: parseInt(e.target.value, 10) })}
                className="w-full accent-amber-400 cursor-pointer"
              />
              <div className="grid grid-cols-4 gap-1 pt-0.5">
                {[0, 90, -90, 180].map((deg) => (
                  <button
                    key={deg}
                    onClick={() => updateActivePrintAreaDraft({ rotation: deg })}
                    className={`py-1 rounded text-[10px] font-mono font-bold border transition-colors cursor-pointer ${
                      activePrintArea?.rotation === deg
                        ? 'bg-amber-100 dark:bg-amber-500/20 border-amber-400 text-amber-600 dark:text-amber-300'
                        : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {deg}°
                  </button>
                ))}
              </div>
            </div>

            {/* Apparel Type Selector */}
            <div className="pt-2 border-t border-slate-700/60">
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1.5">Kumaş Rengi Tipi:</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['light', 'dark', 'any'] as ApparelType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setDraftApparelType(type)}
                    className={`py-1.5 rounded-lg border text-[11px] font-medium transition-all cursor-pointer ${
                      draftApparelType === type
                        ? type === 'light' ? 'bg-amber-100 dark:bg-amber-500/20 border-amber-400 text-amber-600 dark:text-amber-300 font-bold'
                          : type === 'dark' ? 'bg-indigo-600/30 border-indigo-400 text-indigo-600 dark:text-indigo-200 font-bold'
                          : 'bg-purple-600/30 border-purple-400 text-purple-200 font-bold'
                        : 'bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {type === 'light' ? 'Açık' : type === 'dark' ? 'Koyu' : 'Tümü'}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Folder Bar */}
      <div className="bg-slate-100 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="grid grid-rows-2 grid-flow-col auto-cols-max gap-2 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-2.5 md:pb-1 max-h-[95px]">
          <button
            onClick={() => setActiveFolderId(null)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all max-w-[200px] min-w-0 cursor-pointer ${
              activeFolderId === null ? 'bg-indigo-600 text-slate-900 dark:text-white shadow' : 'bg-white dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Folder className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Tüm Mockup'lar</span>
            <span className="shrink-0">({mockups.length})</span>
          </button>

          {folders.map((folder) => {
            const folderMockups = mockups.filter((m) => m.folderId === folder.id);
            const count = folderMockups.length;
            const isActive = activeFolderId === folder.id;
            return (
              <div key={folder.id} className="relative group/folder shrink-0 flex items-center max-w-[220px] min-w-0 snap-start">
                <button
                  onClick={() => setActiveFolderId(folder.id)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all min-w-0 max-w-[190px] cursor-pointer ${
                    isActive ? 'bg-indigo-600 text-slate-900 dark:text-white shadow' : 'bg-white dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title={`${folder.name} (${count}) - Etsy Limiti: Max 20 Görsel, 2 Video`}
                >
                  {isActive ? <FolderOpen className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300 shrink-0" /> : <Folder className="w-3.5 h-3.5 shrink-0" />}
                  <span className="truncate">{folder.name}</span>
                  <span className="shrink-0">({count})</span>
                </button>

                <div className="relative ml-1 flex items-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenFolderMenuId(openFolderMenuId === folder.id ? null : folder.id);
                    }}
                    className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg transition-all shrink-0 cursor-pointer"
                    title="Seçenekler"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {openFolderMenuId === folder.id && (
                    <div className="absolute top-full left-0 mt-1 w-36 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 flex flex-col p-1 animate-in fade-in zoom-in-95 duration-100">
                      {folder.isCustom && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingFolderId(folder.id);
                            setNewFolderName(folder.name);
                            setShowFolderModal(true);
                            setOpenFolderMenuId(null);
                          }}
                          className="w-full text-left flex items-center space-x-2 px-3 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg transition-colors cursor-pointer text-xs font-semibold"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Yeniden Adlandır</span>
                        </button>
                      )}
                      
                      <button
                        onClick={(e) => {
                          handleDuplicateFolder(folder.id, e);
                          setOpenFolderMenuId(null);
                        }}
                        className="w-full text-left flex items-center space-x-2 px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition-colors cursor-pointer text-xs font-semibold"
                      >
                        <CopyPlus className="w-3.5 h-3.5" />
                        <span>Kopyala</span>
                      </button>

                      {folder.isCustom && (
                        <button
                          onClick={(e) => {
                            handleDeleteFolder(folder.id, e);
                            setOpenFolderMenuId(null);
                          }}
                          className="w-full text-left flex items-center space-x-2 px-3 py-2 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-colors cursor-pointer text-xs font-semibold"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Sil</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <button
            onClick={() => {
              setEditingFolderId(null);
              setNewFolderName('');
              setShowFolderModal(true);
            }}
            className="flex items-center space-x-1 px-3 py-1.5 bg-slate-700/60 hover:bg-slate-200 dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 rounded-xl text-xs font-medium shrink-0 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Yeni Klasör</span>
          </button>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          {selectedMockup && (
            <button
              onClick={() => setCropModalOpen(true)}
              className="flex items-center space-x-1 px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-amber-600 dark:text-amber-300 rounded-xl text-xs font-semibold transition-all shadow cursor-pointer"
            >
              <Crop className="w-3.5 h-3.5" />
              <span>Kırp</span>
            </button>
          )}
          <button onClick={handleCopyConfig} className="flex items-center space-x-1 px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white rounded-xl text-xs font-semibold transition-all shadow cursor-pointer">
            <Copy className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-300" />
            <span>Kopyala</span>
          </button>
          <button
            onClick={handlePasteConfig}
            disabled={!copiedConfig}
            className="flex items-center space-x-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-slate-900 dark:text-white rounded-xl text-xs font-semibold transition-all shadow cursor-pointer"
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            <span>Yapıştır</span>
          </button>
        </div>
      </div>

      {/* Bulk Selection Actions */}
      {selectedMockupIds.size > 0 && (
        <div className="bg-gradient-to-r from-purple-100 to-indigo-100 dark:from-purple-900/80 dark:to-indigo-900/80 p-3 rounded-2xl border border-purple-200 dark:border-purple-500/40 flex items-center justify-between shadow-xl">
          <span className="text-xs font-bold text-slate-900 dark:text-white bg-purple-600 px-2.5 py-1 rounded-lg">
            {selectedMockupIds.size} Mockup Seçildi
          </span>
          <div className="flex items-center space-x-2">
            <button onClick={handleApplyToSelected} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-900 dark:text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow cursor-pointer">
              <Check className="w-3.5 h-3.5" />
              <span>Baskı Alanını Uygula</span>
            </button>
            <button onClick={handleDeleteSelected} className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-slate-900 dark:text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow cursor-pointer">
              <Trash2 className="w-3.5 h-3.5" />
              <span>Seçilenleri Sil</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
        {/* Left: Mockup List with Drag & Drop */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-slate-100 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200 dark:border-slate-700/60">
            <div className="flex items-center justify-between mb-3 border-b border-slate-700/60 pb-2">
              <button onClick={handleSelectAll} className="flex items-center space-x-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:text-white cursor-pointer">
                {selectedMockupIds.size === displayedMockups.length && displayedMockups.length > 0
                  ? <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  : <Square className="w-4 h-4 text-slate-400 dark:text-slate-600 dark:text-slate-500" />}
                <span>Tümünü Seç ({displayedMockups.length})</span>
              </button>
              <label className="cursor-pointer text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-600 dark:text-indigo-300 flex items-center gap-1">
                <Upload className="w-3.5 h-3.5" />
                <span>Yükle</span>
                <input type="file" accept="image/*,video/*" multiple onChange={handleFileUpload} className="hidden" />
              </label>
            </div>

            <div className="space-y-2.5 max-h-[280px] md:max-h-[400px] lg:max-h-[550px] overflow-y-auto custom-scrollbar pr-1">
              {displayedMockups.map((m) => {
                const isSelected = selectedMockup?.id === m.id;
                const isChecked = selectedMockupIds.has(m.id);
                const isVideo = m.isVideo;
                const isStaticAsset = isVideo || m.hasPrintArea === false || !m.printAreas?.length;
                const isDragging = draggedMockupId === m.id;
                const isDragOver = dragOverMockupId === m.id;

                return (
                  <div
                    key={m.id}
                    draggable
                    onDragStart={(e) => handleDragStartMockup(m.id, e)}
                    onDragOver={(e) => handleDragOverMockup(m.id, e)}
                    onDrop={(e) => handleDropMockup(m.id, e)}
                    onDragEnd={handleDragEndMockup}
                    onClick={() => setSelectedMockupId(m.id)}
                    className={`p-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer select-none ${
                      isDragging ? 'opacity-40 scale-95 border-dashed border-indigo-400' : ''
                    } ${
                      isDragOver ? 'border-indigo-400 bg-indigo-500/20 ring-2 ring-indigo-400/50' : ''
                    } ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 shadow-md'
                        : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      {/* Drag Handle for Reordering */}
                      <div className="flex items-center text-slate-400 dark:text-slate-600 dark:text-slate-500 shrink-0">
                        <span title="Sürükleyip Bırakın">
                          <GripVertical className="w-4 h-4 cursor-grab active:cursor-grabbing hover:text-slate-600 dark:text-slate-400" />
                        </span>
                      </div>

                      <button onClick={(e) => toggleSelectMockup(m.id, e)} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white shrink-0">
                        {isChecked ? <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> : <Square className="w-4 h-4 text-slate-400 dark:text-slate-600" />}
                      </button>

                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-white dark:bg-slate-950 shrink-0 border border-slate-300 dark:border-slate-700 relative">
                        {isVideo ? (
                          <div className="w-full h-full flex items-center justify-center bg-purple-950/50 text-purple-400">
                            <Video className="w-5 h-5" />
                          </div>
                        ) : (
                          <img src={m.src} alt={m.name} className="w-full h-full object-cover pointer-events-none" />
                        )}
                      </div>

                      <div className="min-w-0">
                        {editingMockupId === m.id ? (
                          <input
                            type="text"
                            value={editingMockupName}
                            onChange={(e) => setEditingMockupName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(m.id)}
                            onBlur={() => handleSaveRename(m.id)}
                            autoFocus
                            className="bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs px-1.5 py-0.5 rounded border border-indigo-500 outline-none w-full"
                          />
                        ) : (
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{m.name}</p>
                        )}
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          {isStaticAsset ? (isVideo ? 'Video' : 'Statik Chart') : `${m.apparelType === 'light' ? 'Açık' : 'Koyu'} (${m.printAreas?.length || 1} Alan)`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        onClick={(e) => handleStartRename(m.id, m.name, e)}
                        className="p-1 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:text-indigo-300 rounded hover:bg-white dark:bg-slate-800 cursor-pointer"
                        title="Yeniden Adlandır"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMockups((prev) => prev.filter((item) => item.id !== m.id));
                          toast.info(`'${m.name}' silindi.`);
                        }}
                        className="p-1 text-slate-500 dark:text-slate-400 hover:text-rose-400 rounded hover:bg-white dark:bg-slate-800 cursor-pointer"
                        title="Sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Middle: Canvas Workspace */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {selectedMockup?.isVideo ? <Video className="w-4 h-4 text-purple-400" /> : <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                {selectedMockup?.name || 'Mockup Tuvali'}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {selectedMockup?.isVideo
                  ? 'Video Dosyası (Baskı Alanı Yerleştirilmez)'
                  : !draftHasPrintArea
                  ? 'Statik Görsel / Chart (Baskı Alanı Devre Dışı)'
                  : 'Baskı kutusunu tutup taşıyın veya açı verin'}
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleTogglePrintAreaMode}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
                  !draftHasPrintArea
                    ? 'bg-amber-950/60 border-amber-500/60 text-amber-600 dark:text-amber-300'
                    : 'bg-indigo-950/60 border-indigo-500/60 text-indigo-600 dark:text-indigo-300'
                }`}
              >
                {!draftHasPrintArea ? <BarChart3 className="w-3.5 h-3.5" /> : <Layers className="w-3.5 h-3.5" />}
                <span>{!draftHasPrintArea ? 'Chart Modu' : 'Baskı Modu'}</span>
              </button>

              <button
                onClick={() => setMobileSettingsOpen(true)}
                className="lg:hidden p-2 bg-white dark:bg-slate-800 hover:bg-slate-200 dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-center min-h-[420px] relative overflow-hidden">
            {selectedMockup ? (
              <div ref={containerRef} className="relative max-w-full max-h-[500px] select-none shadow-2xl rounded-xl overflow-hidden bg-white dark:bg-slate-950">
                {selectedMockup.isVideo ? (
                  <video src={selectedMockup.src} controls autoPlay loop muted className="max-w-full max-h-[500px] object-contain" />
                ) : (
                  <img src={selectedMockup.src} alt={selectedMockup.name} className="max-w-full max-h-[500px] object-contain block pointer-events-none" />
                )}

                {!selectedMockup.isVideo && draftHasPrintArea && (
                  <>
                    {draftAreas.map((area, idx) => {
                      const isActive = idx === activeAreaIndex;
                      return (
                        <div
                          key={area.id || idx}
                          onClick={() => setActiveAreaIndex(idx)}
                          onPointerDown={(e) => handlePointerDown(e, 'move')}
                          style={{
                            left: `${area.x}%`,
                            top: `${area.y}%`,
                            width: `${area.width}%`,
                            height: `${area.height}%`,
                            transform: `rotate(${area.rotation || 0}deg)`,
                            transformOrigin: 'center center',
                          }}
                          className={`absolute border-2 border-dashed cursor-move flex items-center justify-center rounded transition-all touch-none ${
                            isActive
                              ? 'border-indigo-400 bg-indigo-500/25 shadow-xl z-20'
                              : 'border-slate-500/60 bg-slate-800/20 z-10 hover:border-indigo-300'
                          }`}
                        >
                          <div className="bg-indigo-950/90 text-indigo-600 dark:text-indigo-200 border border-indigo-500/50 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shadow pointer-events-none text-center">
                            {area.name}
                          </div>

                          {isActive && (
                            <>
                              <div
                                onPointerDown={(e) => handlePointerDown(e, 'rotate')}
                                className="absolute -top-9 left-1/2 -translate-x-1/2 w-8 h-8 touch-none bg-indigo-500 hover:bg-amber-400 text-slate-900 dark:text-white rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing shadow-xl border-2 border-white transition-transform transform hover:scale-110 active:scale-95 z-30"
                                title="Açı vermek için basılı tutup etrafında sürükleyin"
                              >
                                <RotateCw className="w-4 h-4" />
                              </div>
                              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-0.5 h-3 bg-indigo-400 pointer-events-none" />
                              <div
                                onPointerDown={(e) => handlePointerDown(e, 'resize-se')}
                                className="absolute -bottom-2.5 -right-2.5 w-6 h-6 touch-none bg-indigo-400 hover:bg-indigo-300 rounded-full border-2 border-white cursor-se-resize shadow-md"
                                title="Boyutlandırmak için sürükleyin"
                              />
                            </>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            ) : (
              <div className="text-center py-20 text-slate-400 dark:text-slate-600 dark:text-slate-500">
                <Upload className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">Lütfen bir mockup seçin.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Desktop Settings Panel */}
        {selectedMockup && (
          <div className="hidden lg:block lg:col-span-3 space-y-4">
            <div className="bg-slate-100 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200 dark:border-slate-700/60">
              {renderSettingsPanel()}
            </div>
          </div>
        )}
      </div>

      {/* Mobile Slide-Up Settings Drawer */}
      {mobileSettingsOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col justify-end p-0">
          <div className="bg-slate-50 dark:bg-slate-900 border-t border-slate-300 dark:border-slate-700 rounded-t-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto custom-scrollbar shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Kumaş &amp; Baskı Ayarları
              </h3>
              <button
                onClick={() => setMobileSettingsOpen(false)}
                className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white rounded-lg bg-white dark:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {renderSettingsPanel()}
            <button
              onClick={() => setMobileSettingsOpen(false)}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-slate-900 dark:text-white font-bold text-xs rounded-xl shadow mt-2 cursor-pointer"
            >
              Tamam / Kapat
            </button>
          </div>
        </div>
      )}

      {/* Crop Modal */}
      {selectedMockup && (
        <InteractiveCropModal
          imageSrc={selectedMockup.src}
          imageTitle={selectedMockup.name}
          isOpen={cropModalOpen}
          onClose={() => setCropModalOpen(false)}
          onCropComplete={handleCropComplete}
        />
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModalState.isOpen}
        title={confirmModalState.title}
        message={confirmModalState.message}
        onConfirm={confirmModalState.onConfirm}
        onCancel={() => setConfirmModalState((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* New Folder Modal */}
      {showFolderModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FolderPlus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              {editingFolderId ? 'Klasörü Yeniden Adlandır' : 'Yeni Mockup Klasörü Oluştur'}
            </h3>
            <input
              type="text"
              placeholder="Klasör Adı (Örn: Kadın Tişörtleri, Sweatshirt)"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl p-2.5 text-xs outline-none focus:border-indigo-500"
            />
            <div className="flex justify-end space-x-2">
              <button onClick={() => {
                setShowFolderModal(false);
                setEditingFolderId(null);
              }} className="px-3 py-2 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs rounded-xl hover:bg-slate-200 dark:bg-slate-700 cursor-pointer">
                İptal
              </button>
              <button
                onClick={() => {
                  if (!newFolderName.trim()) return;
                  if (editingFolderId) {
                    setFolders((prev) =>
                      prev.map((f) =>
                        f.id === editingFolderId ? { ...f, name: newFolderName.trim() } : f
                      )
                    );
                    toast.success('Klasör adı güncellendi!');
                  } else {
                    const newFolder: MockupFolder = { id: 'folder-' + Date.now(), name: newFolderName.trim(), isCustom: true };
                    setFolders((prev) => [...prev, newFolder]);
                    setActiveFolderId(newFolder.id);
                    toast.success(`'${newFolder.name}' klasörü oluşturuldu!`);
                  }
                  setNewFolderName('');
                  setEditingFolderId(null);
                  setShowFolderModal(false);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-slate-900 dark:text-white text-xs font-bold rounded-xl shadow cursor-pointer"
              >
                {editingFolderId ? 'Kaydet' : 'Oluştur'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
