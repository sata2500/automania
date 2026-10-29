import { getErrorMessage } from '@/lib/errors';
import React, { useState } from 'react';
import { DesignItem, MockupFolder } from '@/types/pod';
import { InteractiveCropModal } from '@/components/common/InteractiveCropModal';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { useToast } from '@/components/common/ToastContext';
import { useAuth } from '@/components/common/UserAuthContext';
import { uploadMediaToServer } from '@/lib/image-optimizer';
import { deleteUnreferencedBlobs } from '@/lib/storage-service';

// Modular Hooks
import { useDesignUpload } from './hooks/useDesignUpload';
import { useDesignSelection } from './hooks/useDesignSelection';
import { useDesignAnalysis } from './hooks/useDesignAnalysis';

// Modular Subcomponents
import { DesignUploadZone } from './components/DesignUploadZone';
import { DesignFolderBar } from './components/DesignFolderBar';
import { DesignToolbar } from './components/DesignToolbar';
import { DesignGrid } from './components/DesignGrid';
import { DesignAnalysisModal } from './components/DesignAnalysisModal';
import { DesignFolderModal } from './components/DesignFolderModal';
import { AIDesignGeneratorModal } from './components/AIDesignGeneratorModal';
import { DesignRenameModal } from './components/DesignRenameModal';
import { Search, X } from 'lucide-react';

interface DesignUploaderProps {
  designs: DesignItem[];
  setDesigns: React.Dispatch<React.SetStateAction<DesignItem[]>>;
  folders: MockupFolder[];
  setFolders: React.Dispatch<React.SetStateAction<MockupFolder[]>>;
  activeDesignFolderId: string | null;
  setActiveDesignFolderId: (id: string | null) => void;
}

function readImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Kırpılan görsel okunamadı.'));
    img.src = src;
  });
}

export const DesignUploader: React.FC<DesignUploaderProps> = ({
  designs,
  setDesigns,
  folders,
  setFolders,
  activeDesignFolderId,
  setActiveDesignFolderId,
}) => {
  const toast = useToast();
  const { user, setIsAuthModalOpen } = useAuth();

  /** AI işlemleri (üretim, arka plan kaldırma, renk uyarlama) hesap gerektirir; misafire nedenini söyle. */
  const requireAccount = (feature: string): boolean => {
    if (user) return true;
    toast.info(`${feature} için giriş yapmanız gerekiyor. Taslaklarınız girişten sonra hesabınıza aktarılır.`, 'Giriş Gerekli');
    setIsAuthModalOpen(true);
    return false;
  };
  const [cropTargetDesign, setCropTargetDesign] = useState<DesignItem | null>(null);
  const [renameTarget, setRenameTarget] = useState<DesignItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // AI Design Generator Modal
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);

  // Folder Modals State
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<MockupFolder | null>(null);
  const [folderInputName, setFolderInputName] = useState('');

  // Confirmation Modal State
  const [confirmConfig, setConfirmConfig] = useState<{
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

  // Filter design folders
  const designFolders = folders.filter((f) => f.type === 'design');

  // Custom Hooks
  const {
    isOptimizing,
    dragActive,
    handleFiles,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  } = useDesignUpload({
    setDesigns,
    activeDesignFolderId,
  });

  const {
    selectedDesignIds,
    setSelectedDesignIds,
    filteredDesigns,
    toggleManagementSelection,
    handleToggleSelectAll,
    handleToggleProductionActive,
    handleSetProductionActive,
    handleMoveToFolder,
    handleBulkMove,
    takenSlots,
    activeSlotsCount,
  } = useDesignSelection({
    designs,
    setDesigns,
    activeDesignFolderId,
    searchQuery,
  });

  const {
    analyzingIds,
    analysisModalData,
    setAnalysisModalData,
    handleAnalyzeDesign,
    handleBulkAnalyze,
  } = useDesignAnalysis({
    designs,
    setDesigns,
    selectedDesignIds,
  });

  // --- Folder Management ---
  const handleOpenAddFolderModal = () => {
    setEditingFolder(null);
    setFolderInputName('');
    setIsFolderModalOpen(true);
  };

  const handleOpenEditFolderModal = (folder: MockupFolder) => {
    setEditingFolder(folder);
    setFolderInputName(folder.name);
    setIsFolderModalOpen(true);
  };

  const handleSaveFolder = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = folderInputName.trim();
    if (!trimmed) {
      toast.warning('Lütfen bir klasör adı girin.');
      return;
    }

    if (editingFolder) {
      setFolders((prev) =>
        prev.map((f) => (f.id === editingFolder.id ? { ...f, name: trimmed } : f))
      );
      toast.success(`Klasör adı "${trimmed}" olarak güncellendi.`);
    } else {
      const newFolder: MockupFolder = {
        id: 'dfol-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        name: trimmed,
        isCustom: true,
        type: 'design',
      };
      setFolders((prev) => [...prev, newFolder]);
      setActiveDesignFolderId(newFolder.id);
      toast.success(`"${trimmed}" tasarım klasörü oluşturuldu.`);
    }

    setIsFolderModalOpen(false);
    setFolderInputName('');
    setEditingFolder(null);
  };

  const handleDeleteFolder = (id: string, name: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Klasörü Sil',
      message: `"${name}" klasörünü silmek istediğinize emin misiniz? (İçindeki tasarımlar 'Tüm Tasarımlar'a taşınacaktır)`,
      onConfirm: () => {
        setFolders((prev) => prev.filter((f) => f.id !== id));
        setDesigns((prev) =>
          prev.map((d) => (d.folderId === id ? { ...d, folderId: undefined } : d))
        );
        if (activeDesignFolderId === id) {
          setActiveDesignFolderId(null);
        }
        toast.info(`"${name}" klasörü silindi.`);
        setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // --- Deletion Handlers ---
  // Tekil silme de toplu silme gibi onay ister (dosya kalıcı olarak silinir).
  const requestDeleteDesign = (id: string) => {
    const target = designs.find((d) => d.id === id);
    if (!target) return;
    setConfirmConfig({
      isOpen: true,
      title: 'Tasarım silinsin mi?',
      message: `"${target.name}" ve dosyası kalıcı olarak silinecek. Bu işlem geri alınamaz.`,
      onConfirm: () => {
        deleteDesign(id);
        setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const deleteDesign = (id: string) => {
    const target = designs.find((d) => d.id === id);
    if (target?.src) {
      void deleteUnreferencedBlobs([target.src], { designs: designs.filter((d) => d.id !== id) });
    }
    setDesigns((prev) => prev.filter((d) => d.id !== id));
    setSelectedDesignIds((prev) => prev.filter((x) => x !== id));
    toast.info(`'${target?.name || 'Tasarım'}' silindi.`);
  };

  const handleBulkDelete = () => {
    if (selectedDesignIds.length === 0) return;
    setConfirmConfig({
      isOpen: true,
      title: 'Toplu Silme Onayı',
      message: `${selectedDesignIds.length} tasarımı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
      onConfirm: () => {
        const targets = designs.filter((d) => selectedDesignIds.includes(d.id));
        const blobsToDelete = targets.map((t) => t.src).filter(Boolean);
        if (blobsToDelete.length > 0) {
          void deleteUnreferencedBlobs(blobsToDelete, { designs: designs.filter((d) => !selectedDesignIds.includes(d.id)) });
        }

        setDesigns((prev) => prev.filter((d) => !selectedDesignIds.includes(d.id)));
        setSelectedDesignIds([]);
        toast.info(`${targets.length} tasarım silindi.`);
        setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // --- Crop Complete Handler ---
  const handleCropComplete = async (croppedDataUrl: string) => {
    if (!cropTargetDesign) return;
    const oldSrc = cropTargetDesign.src;
    // Tasarım baskı dosyasıdır: kırpılan bölge orijinal çözünürlükte, kayıpsız PNG olarak saklanır.
    const [serverUrl, size] = await Promise.all([
      uploadMediaToServer(croppedDataUrl, 'image/png', { optimize: 'design' }),
      readImageDimensions(croppedDataUrl),
    ]);
    if (oldSrc && oldSrc !== serverUrl) {
      const nextDesigns = designs.map((d) => (d.id === cropTargetDesign.id ? { ...d, src: serverUrl } : d));
      void deleteUnreferencedBlobs([oldSrc], { designs: nextDesigns });
    }
    setDesigns((prev) =>
      prev.map((d) =>
        d.id === cropTargetDesign.id
          ? { ...d, src: serverUrl, width: size.width, height: size.height }
          : d
      )
    );
    setCropTargetDesign(null);
    toast.success(`Tasarım kırpıldı (${size.width}×${size.height}px).`);
  };

  // --- Remove Background Handler ---
  const handleRemoveBgClick = async (design: DesignItem) => {
    if (!design.src) return;
    if (!requireAccount('Arka plan kaldırma')) return;

    const toastId = toast.progress('Arka plan kaldırılıyor...');
    try {
      const response = await fetch('/api/designs/remove-bg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: design.src }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Arka plan kaldırılamadı');

      // Sunucu depoya yükleyemediyse (R2 yok) sonuç ayrıca yüklenir; base64 çalışma alanına yazılmaz.
      const bgSrc: string = data.bgRemovedUrl || await uploadMediaToServer(`data:image/png;base64,${data.pngBase64}`, 'image/png', { optimize: 'design' });

      setDesigns((prev) =>
        prev.map((d) =>
          d.id === design.id
            ? { ...d, src: bgSrc }
            : d
        )
      );

      toast.removeToast(toastId);
      toast.success(data.qualityMessage || 'Arka plan başarıyla kaldırıldı!');
    } catch (err) {
      toast.removeToast(toastId);
      toast.error(getErrorMessage(err) || 'Arka plan kaldırılırken hata oluştu.');
    }
  };

  // --- Recolor Handler ---
  const handleRecolorClick = async (design: DesignItem, mode: 'light_garment' | 'dark_garment') => {
    if (!design.src) return;
    if (!requireAccount('Renk uyarlama')) return;

    const actionText = mode === 'dark_garment' ? 'Koyu kumaş versiyonu hazırlanıyor…' : 'Açık kumaş versiyonu hazırlanıyor…';
    const toastId = toast.progress(actionText);

    try {
      const response = await fetch('/api/designs/recolor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: design.src, mode }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Renk dönüşümü yapılamadı');
      if (data.unchanged) {
        toast.removeToast(toastId);
        toast.info(data.message);
        return;
      }

      // Sunucu depoya yükleyemediyse (yerel geliştirme) sonuç ayrıca yüklenir; base64 çalışma alanına yazılmaz.
      const recoloredUrl: string = data.recoloredUrl.startsWith('data:')
        ? await uploadMediaToServer(data.recoloredUrl, 'image/png', { optimize: 'design' })
        : data.recoloredUrl;

      // Yeni bir tasarım objesi oluştur
      // Yeni kopya hedef kumaşa göre eşleşir ve üretime pasif olarak eklenir (aynı slotta iki aktif
      // tasarım oluşmasın). targetApparel tasarımın mürekkep tonudur: koyu kumaş için açık ton ('light').
      const newDesign: DesignItem = {
        ...design,
        id: crypto.randomUUID(),
        name: `${design.name} (${mode === 'dark_garment' ? 'Koyu' : 'Açık'} kumaş için)`,
        src: recoloredUrl,
        targetApparel: mode === 'dark_garment' ? 'light' : 'dark',
        isSelected: false,
        createdAt: Date.now(),
      };

      setDesigns((prev) => [...prev, newDesign]);

      toast.removeToast(toastId);
      toast.success(`${mode === 'dark_garment' ? 'Koyu' : 'Açık'} kumaş versiyonu kütüphaneye eklendi (renklerin %${Math.max(1, Math.round((data.changedRatio ?? 0) * 100))}'i uyarlandı).`);
    } catch (err) {
      toast.removeToast(toastId);
      toast.error(getErrorMessage(err) || 'Renk dönüşümü sırasında hata oluştu.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Zone */}
      <DesignUploadZone
        dragActive={dragActive}
        isOptimizing={isOptimizing}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onFileChange={(e) => e.target.files && handleFiles(e.target.files)}
        onAIGenerate={() => { if (requireAccount('AI ile tasarım üretimi')) setIsAIModalOpen(true); }}
      />

      {/* Folder Selection Bar */}
      <DesignFolderBar
        designFolders={designFolders}
        setDesignFolders={(newFoldersAction) => {
          setFolders((prev) => {
            const currentDesignFolders = prev.filter((f) => f.type === 'design');
            const otherFolders = prev.filter((f) => f.type !== 'design');
            const resolvedDesignFolders =
              typeof newFoldersAction === 'function'
                ? newFoldersAction(currentDesignFolders)
                : newFoldersAction;
            return [...otherFolders, ...resolvedDesignFolders];
          });
        }}
        designs={designs}
        activeDesignFolderId={activeDesignFolderId}
        setActiveDesignFolderId={setActiveDesignFolderId}
        onOpenNewFolderModal={handleOpenAddFolderModal}
        onOpenRenameFolderModal={handleOpenEditFolderModal}
        onDeleteFolder={handleDeleteFolder}
      />

      {/* Main Studio Design Cards Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-6 rounded-3xl shadow-sm space-y-4">
        {/* Arama: ad, ilan SKU'su, etiket */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            inputMode="search"
            enterKeyHint="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tasarım ara: SKU (ör. TSH-261029-K7QD), ad veya etiket…"
            aria-label="Tasarım ara"
            className="w-full pl-9 pr-9 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} aria-label="Aramayı temizle" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {searchQuery.trim() && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 -mt-2">{filteredDesigns.length} tasarım bulundu (tüm klasörlerde)</p>
        )}

        {/* Action Toolbar */}
        <DesignToolbar
          designs={designs}
          filteredDesigns={filteredDesigns}
          selectedDesignIds={selectedDesignIds}
          designFolders={designFolders}
          takenSlots={takenSlots}
          activeSlotsCount={activeSlotsCount}
          analyzingIds={analyzingIds}
          onToggleSelectAll={handleToggleSelectAll}
          onBulkMove={handleBulkMove}
          onBulkDelete={handleBulkDelete}
          onBulkAnalyze={handleBulkAnalyze}
        />

        {/* Dynamic Responsive Design Grid */}
        <DesignGrid
          designs={filteredDesigns}
          selectedDesignIds={selectedDesignIds}
          analyzingIds={analyzingIds}
          designFolders={designFolders}
          onToggleCheck={toggleManagementSelection}
          onToggleProductionActive={handleToggleProductionActive}
          onSetProductionActive={handleSetProductionActive}
          onAnalyzeClick={(design) => {
            if (design.analysis) {
              setAnalysisModalData(design);
            } else {
              handleAnalyzeDesign(design.id);
            }
          }}
          onCropClick={(design) => setCropTargetDesign(design)}
          onRenameClick={(design) => setRenameTarget(design)}
          searchQuery={searchQuery}
          onRemoveBgClick={handleRemoveBgClick}
          onRecolorClick={handleRecolorClick}
          onMoveToFolder={handleMoveToFolder}
          onDeleteClick={requestDeleteDesign}
        />
      </div>

      {renameTarget && (
        <DesignRenameModal
          design={renameTarget}
          onClose={() => setRenameTarget(null)}
          onSave={(name) => {
            setDesigns((prev) => prev.map((d) => (d.id === renameTarget.id ? { ...d, name } : d)));
            setRenameTarget(null);
            toast.success(`Tasarım adı "${name}" olarak güncellendi.`);
          }}
        />
      )}

      {/* Interactive Crop Modal */}
      {cropTargetDesign && (
        <InteractiveCropModal
          imageSrc={cropTargetDesign.src}
          imageTitle={cropTargetDesign.name}
          isOpen={!!cropTargetDesign}
          onClose={() => setCropTargetDesign(null)}
          onCropComplete={handleCropComplete}
          variant="design"
        />
      )}

      {/* Confirm Action Dialog Modal */}
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* AI Vision Analysis Details Modal */}
      <DesignAnalysisModal
        analysisModalData={analysisModalData}
        onClose={() => setAnalysisModalData(null)}
        onReAnalyze={(id) => handleAnalyzeDesign(id)}
      />

      {/* Design Folder Create / Rename Modal */}
      <DesignFolderModal
        isOpen={isFolderModalOpen}
        editingFolder={editingFolder}
        folderInputName={folderInputName}
        setFolderInputName={setFolderInputName}
        onClose={() => setIsFolderModalOpen(false)}
        onSave={handleSaveFolder}
      />

      {/* AI Design Generator Modal */}
      <AIDesignGeneratorModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        activeDesignFolderId={activeDesignFolderId}
        designFolders={designFolders}
        onDesignsAdded={(newDesigns) => {
          setDesigns((prev) => [...prev, ...newDesigns]);
          toast.success(`${newDesigns.length} AI tasarımı kütüphaneye eklendi; analiz ediliyor…`);
          // Yeni tasarımlar hemen analiz edilir: "Analiz Sonucunu Gör" ayrıca bir adım gerektirmez.
          void (async () => {
            for (const design of newDesigns) await handleAnalyzeDesign(design.id, design);
          })();
        }}
      />
    </div>
  );
};
