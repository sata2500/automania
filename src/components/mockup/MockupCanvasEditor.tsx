import React, { useState, useCallback } from 'react';
import { FolderPlus, Sparkles, Image as ImageIcon } from 'lucide-react';
import type { MockupItem, MockupFolder } from '@/types/pod';
import { uploadMediaToServer } from '@/lib/image-optimizer';
import { deleteUnreferencedBlobs } from '@/lib/storage-service';
import { useToast } from '@/components/common/ToastContext';
import { useAuth } from '@/components/common/UserAuthContext';
import { InteractiveCropModal } from '@/components/common/InteractiveCropModal';
import { ConfirmModal } from '@/components/common/ConfirmModal';

// Subcomponents
import { MockupFolderBar } from './components/MockupFolderBar';
import { MockupSidebarList } from './components/MockupSidebarList';
import { MockupCanvasWorkspace } from './components/MockupCanvasWorkspace';
import { MockupSettingsPanel } from './components/MockupSettingsPanel';
import { MockupMobileDrawer } from './components/MockupMobileDrawer';
import { MockupFolderModal, type FolderSettingsPatch } from './components/MockupFolderModal';
import { FolderTemplateDialog } from '../templates/FolderTemplateDialog';

// Hooks
import { useMockupDraft } from './hooks/useMockupDraft';
import { useMockupTransform } from './hooks/useMockupTransform';
import { useMockupUpload } from './hooks/useMockupUpload';
import { MAX_FOLDER_PHOTOS, MAX_FOLDER_VIDEOS } from '@/lib/mockup-folders';

interface MockupCanvasEditorProps {
  mockups: MockupItem[];
  setMockups: React.Dispatch<React.SetStateAction<MockupItem[]>>;
  folders: MockupFolder[];
  setFolders: React.Dispatch<React.SetStateAction<MockupFolder[]>>;
  activeFolderId: string | null;
  setActiveFolderId: (id: string | null) => void;
  selectedMockupId: string | null;
  setSelectedMockupId: (id: string | null) => void;
}

/** Görselin piksel boyutunu okur (okunamazsa null). */
function readImageSize(src: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth > 0 ? { width: img.naturalWidth, height: img.naturalHeight } : null);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export const MockupCanvasEditor: React.FC<MockupCanvasEditorProps> = ({
  mockups,
  setMockups,
  folders,
  setFolders,
  activeFolderId,
  setActiveFolderId,
  selectedMockupId,
  setSelectedMockupId,
}) => {
  const toast = useToast();
  const { user } = useAuth();

  // Filter mockup folders (exclude design folders)
  const mockupFolders = folders.filter((f) => f.type !== 'design');
  const setMockupFolders: React.Dispatch<React.SetStateAction<MockupFolder[]>> = useCallback((action) => {
    setFolders((prev) => {
      const nonMockupFolders = prev.filter((f) => f.type === 'design');
      const updatedMockupFolders =
        typeof action === 'function'
          ? (action as (p: MockupFolder[]) => MockupFolder[])(
              prev.filter((f) => f.type !== 'design')
            )
          : action;
      return [...nonMockupFolders, ...updatedMockupFolders];
    });
  }, [setFolders]);

  // UI States
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Klasör değişince toplu seçim temizlenir (görünmeyen mockup'lar yanlışlıkla silinmesin/taşınmasın).
  const [selectionFolderId, setSelectionFolderId] = useState(activeFolderId);
  if (selectionFolderId !== activeFolderId) {
    setSelectionFolderId(activeFolderId);
    setSelectedIds([]);
  }
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'canvas'>('canvas');

  // Confirmation Modal State
  const [confirmModalState, setConfirmModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Klasörün otomasyon şablonu (Üretim › Otomasyonlar ile aynı kayıt)
  const [templatePanelFolder, setTemplatePanelFolder] = useState<MockupFolder | null>(null);
  const closeTemplatePanel = useCallback(() => setTemplatePanelFolder(null), []);

  // Klasör ayarları penceresi (yeni klasör veya düzenlenen klasör)
  const [folderModal, setFolderModal] = useState<{ isOpen: boolean; folder: MockupFolder | null }>({ isOpen: false, folder: null });

  // Etkin klasördeki mockup'lar ("Tüm Mockup'lar" görünümü yoktur; klasör yoksa liste boştur).
  const filteredMockups = mockups.filter((m) => activeFolderId !== null && m.folderId === activeFolderId);

  // Selected Mockup reference — seçim etkin klasörün dışındaysa (ör. klasör değişti) klasörün ilk mockup'ı gösterilir.
  const selectedMockup =
    filteredMockups.find((m) => m.id === selectedMockupId) ||
    filteredMockups[0] ||
    null;

  // 1. Draft State Hook
  const {
    draftAreas,
    draftApparelType,
    setDraftApparelType,
    draftHasPrintArea,
    activeAreaIndex,
    setActiveAreaIndex,
    activePrintArea,
    isDirty,
    canUndo,
    handleUndo,
    copiedConfig,
    handleSaveChanges,
    handleRevertChanges,
    updateActivePrintAreaDraft,
    handleAddPrintArea,
    handleRemovePrintArea,
    handleCopyConfig,
    handlePasteConfig,
    handleTogglePrintAreaMode,
  } = useMockupDraft({
    selectedMockup,
    setMockups,
  });

  // Tuval kilidi: baskı alanları yalnızca "Düzenle" ile açılınca taşınır (mobilde sekmeler arası kaydırırken
  // parmak alana değip onu kaydırmasın). Kaydedilmemiş değişiklik varken düzenleme açık kalır.
  const [editingMockupId, setEditingMockupId] = useState<string | null>(null);
  const editing = (editingMockupId !== null && editingMockupId === selectedMockup?.id) || isDirty;
  const startEditing = () => setEditingMockupId(selectedMockup?.id ?? null);
  const saveAndClose = () => {
    if (isDirty) handleSaveChanges();
    setEditingMockupId(null);
  };
  const cancelEditing = () => {
    if (isDirty) handleRevertChanges();
    setEditingMockupId(null);
  };

  // 2. Transform Math & Drag Handler Hook
  const { containerRef, activeAreaRef, handlePointerDown } = useMockupTransform({
    activePrintArea,
    updateActivePrintAreaDraft,
  });

  // 3. Upload Hook
  const { handleFileUpload } = useMockupUpload({
    mockups,
    setMockups,
    mockupFolders,
    activeFolderId,
    draftApparelType,
    draftAreas,
    setSelectedMockupId,
  });

  // Bulk Apply Configuration
  const handleApplyConfigToSelected = useCallback(() => {
    if (selectedIds.length === 0 || !selectedMockup) return;
    setMockups((prev) =>
      prev.map((m) => {
        if (selectedIds.includes(m.id)) {
          return {
            ...m,
            printAreas: structuredClone(draftAreas),
            apparelType: draftApparelType,
            hasPrintArea: draftHasPrintArea,
          };
        }
        return m;
      })
    );
    toast.success(`${selectedIds.length} mockup'a ayarlar uygulandı!`);
  }, [selectedIds, selectedMockup, draftAreas, draftApparelType, draftHasPrintArea, setMockups, toast]);

  // Bulk Delete Request
  const handleBatchDeleteRequest = useCallback(() => {
    if (selectedIds.length === 0) return;
    setConfirmModalState({
      isOpen: true,
      title: `${selectedIds.length} Mockup Silinsin mi?`,
      message: 'Seçilen tüm mockup dosyaları ve ayarları kalıcı olarak silinecektir. Devam etmek istiyor musunuz?',
      onConfirm: () => {
        const urlsToDelete = mockups
          .filter((m) => selectedIds.includes(m.id) && m.src)
          .map((m) => m.src);
        const remaining = mockups.filter((m) => !selectedIds.includes(m.id));

        // Çoğaltılmış klasörler aynı dosyayı paylaşır: yalnızca artık hiçbir yerde kullanılmayanlar silinir.
        if (urlsToDelete.length > 0) {
          void deleteUnreferencedBlobs(urlsToDelete, { mockups: remaining });
        }

        setMockups((prev) => prev.filter((m) => !selectedIds.includes(m.id)));
        setSelectedIds([]);
        setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
        toast.info("Seçili mockup'lar silindi.");
      },
    });
  }, [selectedIds, mockups, setMockups, toast]);

  // Single Mockup Delete
  const handleRequestDeleteMockup = useCallback(
    (id: string) => {
      const target = mockups.find((m) => m.id === id);
      if (!target) return;

      setConfirmModalState({
        isOpen: true,
        title: `'${target.name}' Silinsin mi?`,
        message: 'Bu mockup kalıcı olarak silinecektir. Devam etmek istiyor musunuz?',
        onConfirm: () => {
          if (target.src) {
            void deleteUnreferencedBlobs([target.src], { mockups: mockups.filter((m) => m.id !== id) });
          }
          setMockups((prev) => prev.filter((m) => m.id !== id));
          if (selectedMockupId === id) {
            setSelectedMockupId(null);
          }
          setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
          toast.info(`'${target.name}' silindi.`);
        },
      });
    },
    [mockups, selectedMockupId, setMockups, setSelectedMockupId, toast]
  );

  /** Hedef klasöre taşındığında Etsy sınırı (20 görsel + 1 video) aşılıyorsa taşınamayanları ayırır. */
  const planMove = useCallback(
    (ids: string[], folderId: string) => {
      const inTarget = mockups.filter((m) => m.folderId === folderId && !ids.includes(m.id));
      let photos = inTarget.filter((m) => !m.isVideo).length;
      let videos = inTarget.filter((m) => m.isVideo).length;
      const allowed: string[] = [];
      for (const m of mockups.filter((x) => ids.includes(x.id) && x.folderId !== folderId)) {
        if (m.isVideo ? videos < MAX_FOLDER_VIDEOS : photos < MAX_FOLDER_PHOTOS) {
          allowed.push(m.id);
          if (m.isVideo) videos++; else photos++;
        }
      }
      return allowed;
    },
    [mockups]
  );

  const moveMockups = useCallback(
    (ids: string[], folderId: string) => {
      const allowed = planMove(ids, folderId);
      const skipped = ids.filter((id) => !allowed.includes(id) && mockups.find((m) => m.id === id)?.folderId !== folderId).length;
      if (allowed.length > 0) {
        setMockups((prev) => prev.map((m) => (allowed.includes(m.id) ? { ...m, folderId } : m)));
      }
      const folderName = mockupFolders.find((f) => f.id === folderId)?.name ?? 'klasör';
      if (skipped > 0) {
        toast.warning(`${skipped} mockup taşınamadı: "${folderName}" klasörü Etsy sınırında (en fazla ${MAX_FOLDER_PHOTOS} görsel + ${MAX_FOLDER_VIDEOS} video).`);
      } else if (allowed.length > 0) {
        toast.success(allowed.length === 1 ? `Mockup "${folderName}" klasörüne taşındı.` : `${allowed.length} mockup "${folderName}" klasörüne taşındı.`);
      }
      return allowed.length;
    },
    [planMove, mockups, mockupFolders, setMockups, toast]
  );

  const handleMoveMockupToFolder = useCallback(
    (mockupId: string, folderId: string) => { moveMockups([mockupId], folderId); },
    [moveMockups]
  );

  const handleBulkMoveMockups = useCallback(
    (folderId: string) => {
      if (selectedIds.length === 0) return;
      moveMockups(selectedIds, folderId);
      setSelectedIds([]);
    },
    [selectedIds, moveMockups]
  );

  // Folder Operations
  const handleOpenNewFolderModal = useCallback(() => setFolderModal({ isOpen: true, folder: null }), []);

  const handleOpenRenameFolderModal = useCallback((folder: MockupFolder) => setFolderModal({ isOpen: true, folder }), []);

  const handleFolderModalSave = useCallback(
    (patch: FolderSettingsPatch) => {
      const editing = folderModal.folder;
      if (editing) {
        setMockupFolders((prev) => prev.map((f) => (f.id === editing.id ? { ...f, ...patch } : f)));
        toast.success('Klasör güncellendi!');
      } else {
        const newFolder: MockupFolder = { ...patch, id: 'folder-' + Date.now(), isCustom: true, type: 'mockup' };
        setMockupFolders((prev) => [...prev, newFolder]);
        setActiveFolderId(newFolder.id);
        toast.success(`'${newFolder.name}' klasörü oluşturuldu!`);
      }
      setFolderModal({ isOpen: false, folder: null });
    },
    [folderModal.folder, setMockupFolders, setActiveFolderId, toast]
  );

  const handleDuplicateFolder = useCallback(
    (folderId: string) => {
      const sourceFolder = mockupFolders.find((f) => f.id === folderId);
      if (!sourceFolder) return;

      const newFolderId = 'folder-' + Date.now();
      const newFolder: MockupFolder = {
        id: newFolderId,
        name: `${sourceFolder.name} (Kopya)`,
        isCustom: true,
        type: 'mockup',
      };

      const sourceMockups = mockups.filter((m) => m.folderId === folderId);
      const copiedMockups: MockupItem[] = sourceMockups.map((m) => ({
        ...m,
        id: 'mockup-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        folderId: newFolderId,
        printAreas: structuredClone(m.printAreas || []),
      }));

      setMockupFolders((prev) => [...prev, newFolder]);
      setMockups((prev) => [...prev, ...copiedMockups]);
      setActiveFolderId(newFolderId);
      toast.success(`'${sourceFolder.name}' klasörü ve içeriği kopyalandı!`);
    },
    [mockupFolders, mockups, setMockupFolders, setMockups, setActiveFolderId, toast]
  );

  const handleDeleteFolder = useCallback(
    (folderId: string) => {
      const folder = mockupFolders.find((f) => f.id === folderId);
      if (!folder) return;

      // "Tüm Mockup'lar" olmadığı için klasör içindekilerle birlikte silinir (önce onay istenir).
      const items = mockups.filter((m) => m.folderId === folderId);
      setConfirmModalState({
        isOpen: true,
        title: `'${folder.name}' klasörü silinsin mi?`,
        message: items.length > 0
          ? `Klasör ve içindeki ${items.length} mockup kalıcı olarak silinecek. Mockup'ları korumak istiyorsanız önce başka bir klasöre taşıyın. Bu klasöre bağlı otomasyon varsa artık çalışmaz.`
          : 'Bu boş klasör silinecek.',
        confirmText: items.length > 0 ? 'Klasörü ve mockup\'ları sil' : 'Klasörü sil',
        onConfirm: () => {
          const remaining = mockups.filter((m) => m.folderId !== folderId);
          const urls = items.map((m) => m.src).filter(Boolean);
          if (urls.length > 0) void deleteUnreferencedBlobs(urls, { mockups: remaining });
          setMockupFolders((prev) => prev.filter((f) => f.id !== folderId));
          setMockups(remaining);
          setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
          toast.info(items.length > 0 ? `'${folder.name}' ve içindeki ${items.length} mockup silindi.` : `'${folder.name}' silindi.`);
        },
      });
    },
    [mockupFolders, mockups, setMockupFolders, setMockups, toast]
  );

  // Crop Complete Handler
  const handleCropComplete = useCallback(
    async (croppedDataUrl: string) => {
      if (!selectedMockup) return;
      try {
        const oldSrc = selectedMockup.src;
        // Kırpma en-boy oranını değiştirir; kayıtlı boyut güncellenmezse tuval ve baskı alanları kayar.
        const size = await readImageSize(croppedDataUrl);
        let finalSrc = croppedDataUrl;
        try {
          const serverUrl = await uploadMediaToServer(croppedDataUrl, 'image/jpeg');
          if (serverUrl) finalSrc = serverUrl;
        } catch (e) {
          console.warn('Direct R2 upload skipped or failed:', e);
        }

        const applyCrop = (m: MockupItem): MockupItem =>
          m.id === selectedMockup.id ? { ...m, src: finalSrc, ...(size ?? {}) } : m;

        if (oldSrc && oldSrc !== finalSrc) {
          void deleteUnreferencedBlobs([oldSrc], { mockups: mockups.map(applyCrop) }).catch(() => {});
        }

        setMockups((prev) => prev.map(applyCrop));

        toast.success('Mockup görseli başarıyla kırpıldı ve kaydedildi!');
      } catch (err) {
        console.error('Crop save error:', err);
        toast.error('Kırpılan görsel kaydedilemedi.');
      }
    },
    [selectedMockup, mockups, setMockups, toast]
  );

  // Mockup seçimi: kaydedilmemiş baskı alanı değişiklikleri sessizce kaybolmasın.
  const handleSelectMockup = (id: string | null) => {
    const select = () => {
      setSelectedMockupId(id);
      setEditingMockupId(null);
      // On mobile, auto switch to canvas upon picking a mockup
      if (window.innerWidth < 1024) setMobileView('canvas');
    };
    if (!isDirty || !selectedMockup || id === selectedMockup.id) {
      select();
      return;
    }
    setConfirmModalState({
      isOpen: true,
      title: 'Kaydedilmemiş değişiklikler',
      message: `'${selectedMockup.name}' üzerindeki baskı alanı değişiklikleri kaydedilmedi. Kaydetmeden devam ederseniz bu değişiklikler kaybolur.`,
      confirmText: 'Kaydetmeden geç',
      onConfirm: () => {
        setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
        select();
      },
    });
  };

  // Common Settings Panel Props
  const settingsPanelProps = {
    selectedMockup,
    draftAreas,
    draftApparelType,
    setDraftApparelType,
    draftHasPrintArea,
    activeAreaIndex,
    setActiveAreaIndex,
    activePrintArea,
    isDirty,
    copiedConfig,
    onSaveChanges: handleSaveChanges,
    onRevertChanges: handleRevertChanges,
    onUpdateActiveArea: updateActivePrintAreaDraft,
    onAddArea: handleAddPrintArea,
    onRemoveArea: handleRemovePrintArea,
    onCopyConfig: handleCopyConfig,
    onPasteConfig: handlePasteConfig,
    onOpenCropModal: () => setCropModalOpen(true),
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 1. Folder Navigation Bar */}
      <MockupFolderBar
        mockupFolders={mockupFolders}
        setMockupFolders={setMockupFolders}
        mockups={mockups}
        activeFolderId={activeFolderId}
        setActiveFolderId={setActiveFolderId}
        onOpenNewFolderModal={handleOpenNewFolderModal}
        onOpenRenameFolderModal={handleOpenRenameFolderModal}
        onDuplicateFolder={handleDuplicateFolder}
        onDeleteFolder={handleDeleteFolder}
        onTemplateSettings={user ? (folder) => setTemplatePanelFolder(folder) : undefined}
      />

      {mockupFolders.length === 0 ? (
        <div className="text-center py-14 px-6 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">
          <FolderPlus className="w-11 h-11 mx-auto mb-3 text-amber-500" />
          <p className="text-sm font-bold text-slate-900 dark:text-white">Önce bir klasör oluşturun</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            Her klasör bir Etsy ilanının fotoğraflarıdır: en fazla {MAX_FOLDER_PHOTOS} mockup görseli ve {MAX_FOLDER_VIDEOS} video.
            Mockup&apos;larınızı klasöre yükleyip baskı alanlarını ayarlayın; Üretim&apos;de klasörü seçerek tasarımları basarsınız.
          </p>
          <button type="button" onClick={handleOpenNewFolderModal} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold">
            <FolderPlus className="w-4 h-4" /> Klasör oluştur
          </button>
        </div>
      ) : (<>
      {/* 2. Mobile Segmented Switcher (Visible only on mobile < lg) */}
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/80 dark:bg-slate-800/80 rounded-2xl lg:hidden text-xs font-bold">
        <button
          onClick={() => setMobileView('list')}
          className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            mobileView === 'list'
              ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>Mockup Listesi ({filteredMockups.length})</span>
        </button>
        <button
          onClick={() => setMobileView('canvas')}
          className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            mobileView === 'canvas'
              ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Tuval &amp; Düzenle</span>
        </button>
      </div>

      {/* 3. Main Grid Layout with Harmonious Proportions & Matching Heights */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-start">
        {/* Left Column: Mockup List */}
        <div
          className={`lg:col-span-4 xl:col-span-3 ${
            mobileView === 'list' ? 'block' : 'hidden lg:block'
          }`}
        >
          <MockupSidebarList
            filteredMockups={filteredMockups}
            allMockups={mockups}
            mockupFolders={mockupFolders}
            selectedMockupId={selectedMockupId}
            setSelectedMockupId={handleSelectMockup}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            setMockups={setMockups}
            onFileUpload={handleFileUpload}
            onApplyConfigToSelected={handleApplyConfigToSelected}
            onBatchDeleteRequest={handleBatchDeleteRequest}
            onRequestDeleteMockup={handleRequestDeleteMockup}
            onMoveToFolder={handleMoveMockupToFolder}
            onBulkMove={handleBulkMoveMockups}
            activePrintArea={activePrintArea}
          />
        </div>

        {/* Center Column: Interactive Canvas */}
        <div
          className={`lg:col-span-5 xl:col-span-6 ${
            mobileView === 'canvas' ? 'block' : 'hidden lg:block'
          }`}
        >
          <MockupCanvasWorkspace
            selectedMockup={selectedMockup}
            draftAreas={draftAreas}
            draftHasPrintArea={draftHasPrintArea}
            activeAreaIndex={activeAreaIndex}
            setActiveAreaIndex={setActiveAreaIndex}
            containerRef={containerRef}
            activeAreaRef={activeAreaRef}
            onPointerDown={handlePointerDown}
            onTogglePrintAreaMode={handleTogglePrintAreaMode}
            onOpenMobileSettings={() => setMobileSettingsOpen(true)}
            editing={editing}
            onStartEditing={startEditing}
            isDirty={isDirty}
            canUndo={canUndo}
            onUndo={handleUndo}
            onSave={saveAndClose}
            onCancel={cancelEditing}
          />
        </div>

        {/* Right Column: Desktop Settings Panel */}
        <div className="hidden lg:block lg:col-span-3 xl:col-span-3">
          <MockupSettingsPanel {...settingsPanelProps} showSaveBanner={false} />
        </div>
      </div>
      </>)}

      {/* 4. Mobile Bottom Sheet Settings Drawer */}
      <MockupMobileDrawer
        isOpen={mobileSettingsOpen}
        onClose={() => setMobileSettingsOpen(false)}
        {...settingsPanelProps}
      />

      {/* 5. Modals */}
      <MockupFolderModal
        isOpen={folderModal.isOpen}
        folder={folderModal.folder}
        prefillFrom={mockupFolders.find((f) => f.id === activeFolderId) ?? null}
        showListingSettings={Boolean(user)}
        onClose={() => setFolderModal({ isOpen: false, folder: null })}
        onSave={handleFolderModalSave}
      />

      {selectedMockup && (
        <InteractiveCropModal
          imageSrc={selectedMockup.src}
          imageTitle={selectedMockup.name}
          isOpen={cropModalOpen}
          onClose={() => setCropModalOpen(false)}
          onCropComplete={handleCropComplete}
        />
      )}

      <ConfirmModal
        isOpen={confirmModalState.isOpen}
        title={confirmModalState.title}
        message={confirmModalState.message}
        confirmText={confirmModalState.confirmText}
        onConfirm={confirmModalState.onConfirm}
        onCancel={() =>
          setConfirmModalState((prev) => ({ ...prev, isOpen: false }))
        }
      />

      {/* Klasörün otomasyon şablonu — yalnızca oturum açmış kullanıcılar için */}
      {user && templatePanelFolder && (
        <FolderTemplateDialog
          folder={templatePanelFolder}
          folders={mockupFolders}
          mockups={mockups}
          onClose={closeTemplatePanel}
        />
      )}
    </div>
  );
};
