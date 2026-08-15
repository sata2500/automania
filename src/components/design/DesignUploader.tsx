'use client';

import React, { useState } from 'react';
import { DesignItem, MockupFolder } from '@/types/pod';
import { InteractiveCropModal } from '@/components/common/InteractiveCropModal';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { useToast } from '@/components/common/ToastContext';
import { uploadMediaToServer } from '@/lib/image-optimizer';
import { deleteBlobs } from '@/lib/storage-service';

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

interface DesignUploaderProps {
  designs: DesignItem[];
  setDesigns: React.Dispatch<React.SetStateAction<DesignItem[]>>;
  folders: MockupFolder[];
  setFolders: React.Dispatch<React.SetStateAction<MockupFolder[]>>;
  activeDesignFolderId: string | null;
  setActiveDesignFolderId: (id: string | null) => void;
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
  const [cropTargetDesign, setCropTargetDesign] = useState<DesignItem | null>(null);

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
        id: 'dfol-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
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
  const deleteDesign = (id: string) => {
    const target = designs.find((d) => d.id === id);
    if (target?.src) {
      deleteBlobs([target.src]);
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
          deleteBlobs(blobsToDelete);
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
    const serverUrl = await uploadMediaToServer(croppedDataUrl, 'image/png');
    if (oldSrc && oldSrc !== serverUrl) {
      deleteBlobs([oldSrc]);
    }
    setDesigns((prev) =>
      prev.map((d) =>
        d.id === cropTargetDesign.id
          ? { ...d, src: serverUrl, width: 1500, height: 1500 }
          : d
      )
    );
    setCropTargetDesign(null);
    toast.success('Tasarım görseli başarıyla kırpıldı!');
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

      {/* Design List Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-6 rounded-3xl shadow-sm space-y-4">
        {/* Toolbar with summary and bulk action controls */}
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

        {/* Responsive Design Cards Grid */}
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
          onMoveToFolder={handleMoveToFolder}
          onDeleteClick={deleteDesign}
        />
      </div>

      {/* Interactive Crop Modal */}
      {cropTargetDesign && (
        <InteractiveCropModal
          imageSrc={cropTargetDesign.src}
          imageTitle={cropTargetDesign.name}
          isOpen={!!cropTargetDesign}
          onClose={() => setCropTargetDesign(null)}
          onCropComplete={handleCropComplete}
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
    </div>
  );
};
