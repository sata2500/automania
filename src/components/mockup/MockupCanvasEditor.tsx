import React, { useState, useCallback } from 'react';
import { Sparkles, Image as ImageIcon } from 'lucide-react';
import { MockupItem, MockupFolder } from '@/types/pod';
import { uploadMediaToServer } from '@/lib/image-optimizer';
import { deleteBlobs } from '@/lib/storage-service';
import { useToast } from '@/components/common/ToastContext';
import { InteractiveCropModal } from '@/components/common/InteractiveCropModal';
import { ConfirmModal } from '@/components/common/ConfirmModal';

// Subcomponents
import { MockupFolderBar } from './components/MockupFolderBar';
import { MockupSidebarList } from './components/MockupSidebarList';
import { MockupCanvasWorkspace } from './components/MockupCanvasWorkspace';
import { MockupSettingsPanel } from './components/MockupSettingsPanel';
import { MockupMobileDrawer } from './components/MockupMobileDrawer';
import { MockupFolderModal } from './components/MockupFolderModal';

// Hooks
import { useMockupDraft } from './hooks/useMockupDraft';
import { useMockupTransform } from './hooks/useMockupTransform';
import { useMockupUpload } from './hooks/useMockupUpload';

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

  // Filter mockup folders (exclude design folders)
  const mockupFolders = folders.filter((f) => f.type !== 'design');
  const setMockupFolders: React.Dispatch<React.SetStateAction<MockupFolder[]>> = (action) => {
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
  };

  // UI States
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'canvas'>('canvas');

  // Confirmation Modal State
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

  // Folder Modal State (Create / Rename)
  const [folderModalState, setFolderModalState] = useState<{
    isOpen: boolean;
    isEditing: boolean;
    folderId: string | null;
    folderName: string;
  }>({
    isOpen: false,
    isEditing: false,
    folderId: null,
    folderName: '',
  });

  // Filter mockups for active folder
  const filteredMockups = mockups.filter((m) =>
    activeFolderId === null ? true : m.folderId === activeFolderId
  );

  // Selected Mockup reference
  const selectedMockup =
    mockups.find((m) => m.id === selectedMockupId) ||
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

        if (urlsToDelete.length > 0) {
          deleteBlobs(urlsToDelete);
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
            deleteBlobs([target.src]);
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

  // Folder Operations
  const handleOpenNewFolderModal = useCallback(() => {
    setFolderModalState({
      isOpen: true,
      isEditing: false,
      folderId: null,
      folderName: '',
    });
  }, []);

  const handleOpenRenameFolderModal = useCallback((folder: MockupFolder) => {
    setFolderModalState({
      isOpen: true,
      isEditing: true,
      folderId: folder.id,
      folderName: folder.name,
    });
  }, []);

  const handleFolderModalSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const cleanName = folderModalState.folderName.trim();
      if (!cleanName) return;

      if (folderModalState.isEditing && folderModalState.folderId) {
        setMockupFolders((prev) =>
          prev.map((f) => (f.id === folderModalState.folderId ? { ...f, name: cleanName } : f))
        );
        toast.success('Klasör adı güncellendi!');
      } else {
        const newFolder: MockupFolder = {
          id: 'folder-' + Date.now(),
          name: cleanName,
          isCustom: true,
          type: 'mockup',
        };
        setMockupFolders((prev) => [...prev, newFolder]);
        setActiveFolderId(newFolder.id);
        toast.success(`'${newFolder.name}' klasörü oluşturuldu!`);
      }

      setFolderModalState({
        isOpen: false,
        isEditing: false,
        folderId: null,
        folderName: '',
      });
    },
    [folderModalState, setMockupFolders, setActiveFolderId, toast]
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
        id: 'mockup-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
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

      setConfirmModalState({
        isOpen: true,
        title: `'${folder.name}' Silinsin mi?`,
        message: 'Bu klasör ve içindeki tüm mockup yapılandırmaları silinecektir. Devam etmek istiyor musunuz?',
        onConfirm: () => {
          const urlsToDelete = mockups
            .filter((m) => m.folderId === folderId && m.src)
            .map((m) => m.src);

          if (urlsToDelete.length > 0) {
            deleteBlobs(urlsToDelete);
          }

          setMockupFolders((prev) => prev.filter((f) => f.id !== folderId));
          setMockups((prev) => prev.filter((m) => m.folderId !== folderId));
          if (activeFolderId === folderId) setActiveFolderId(null);
          setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
          toast.info(`'${folder.name}' silindi.`);
        },
      });
    },
    [mockupFolders, mockups, activeFolderId, setMockupFolders, setMockups, setActiveFolderId, toast]
  );

  // Crop Complete Handler
  const handleCropComplete = useCallback(
    async (croppedDataUrl: string) => {
      if (!selectedMockup) return;
      try {
        const oldSrc = selectedMockup.src;
        const serverUrl = await uploadMediaToServer(croppedDataUrl, 'image/webp', { requireDurable: true });
        if (oldSrc && oldSrc !== serverUrl) {
          deleteBlobs([oldSrc]);
        }
        setMockups((prev) =>
          prev.map((m) => (m.id === selectedMockup.id ? { ...m, src: serverUrl } : m))
        );
        toast.success('Mockup görseli başarıyla kırpıldı ve kaydedildi!');
      } catch (err) {
        toast.error('Kırpılan görsel kaydedilemedi.');
      }
    },
    [selectedMockup, setMockups, toast]
  );

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
      />

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
            selectedMockupId={selectedMockupId}
            setSelectedMockupId={(id) => {
              setSelectedMockupId(id);
              // On mobile, auto switch to canvas upon picking a mockup
              if (window.innerWidth < 1024) {
                setMobileView('canvas');
              }
            }}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            setMockups={setMockups}
            onFileUpload={handleFileUpload}
            onApplyConfigToSelected={handleApplyConfigToSelected}
            onBatchDeleteRequest={handleBatchDeleteRequest}
            onRequestDeleteMockup={handleRequestDeleteMockup}
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
          />
        </div>

        {/* Right Column: Desktop Settings Panel */}
        <div className="hidden lg:block lg:col-span-3 xl:col-span-3">
          <MockupSettingsPanel {...settingsPanelProps} />
        </div>
      </div>

      {/* 4. Mobile Bottom Sheet Settings Drawer */}
      <MockupMobileDrawer
        isOpen={mobileSettingsOpen}
        onClose={() => setMobileSettingsOpen(false)}
        {...settingsPanelProps}
      />

      {/* 5. Modals */}
      <MockupFolderModal
        isOpen={folderModalState.isOpen}
        isEditing={folderModalState.isEditing}
        folderName={folderModalState.folderName}
        setFolderName={(name) =>
          setFolderModalState((prev) => ({ ...prev, folderName: name }))
        }
        onClose={() =>
          setFolderModalState((prev) => ({ ...prev, isOpen: false }))
        }
        onSubmit={handleFolderModalSubmit}
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
        onConfirm={confirmModalState.onConfirm}
        onCancel={() =>
          setConfirmModalState((prev) => ({ ...prev, isOpen: false }))
        }
      />
    </div>
  );
};
