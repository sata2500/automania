'use client';

import React from 'react';
import { MockupItem, DesignItem, RenderedMatch, MockupFolder } from '@/types/pod';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { useBatchGenerator } from './hooks/useBatchGenerator';
import { BatchHeader } from './components/BatchHeader';
import { BatchFolderBar } from './components/BatchFolderBar';
import { BatchEmptyState } from './components/BatchEmptyState';
import { BatchResultsGrid } from './components/BatchResultsGrid';

export interface BatchPreviewGridProps {
  mockups: MockupItem[];
  designs: DesignItem[];
  folders: MockupFolder[];
  activeFolderId: string | null;
  setActiveFolderId: (id: string | null) => void;
  activeDesignFolderId: string | null;
  renderedMatches: RenderedMatch[];
  setRenderedMatches: React.Dispatch<React.SetStateAction<RenderedMatch[]>>;
  hasGenerated: boolean;
  setHasGenerated: (val: boolean) => void;
}

export const BatchPreviewGrid: React.FC<BatchPreviewGridProps> = ({
  mockups,
  designs,
  folders,
  activeFolderId,
  setActiveFolderId,
  activeDesignFolderId,
  renderedMatches,
  setRenderedMatches,
  hasGenerated,
  setHasGenerated,
}) => {
  const {
    isGenerating,
    exportProgress,
    aspectOverride,
    setAspectOverride,
    confirmClearOpen,
    setConfirmClearOpen,
    user,
    mockupFolders,
    folderStatsMap,
    overLimitFolders,
    allFoldersStats,
    currentPairs,
    currentItemCount,
    isCurrentSelectionEligible,
    selectedFolderName,
    handleFolderClick,
    handleGenerate,
    handleDownloadZip,
    handleSaveForEtsy,
    handleClearResults,
    handleConfirmClear,
  } = useBatchGenerator({
    mockups,
    designs,
    folders,
    activeFolderId,
    setActiveFolderId,
    activeDesignFolderId,
    renderedMatches,
    setRenderedMatches,
    setHasGenerated,
  });

  return (
    <div className="space-y-5">
      {/* Top Header Bar */}
      <BatchHeader
        aspectOverride={aspectOverride}
        setAspectOverride={setAspectOverride}
        hasGenerated={hasGenerated}
        isGenerating={isGenerating}
        canGenerate={isCurrentSelectionEligible && currentPairs.length > 0}
        renderedMatchesCount={renderedMatches.length}
        exportProgress={exportProgress}
        user={user}
        onGenerate={handleGenerate}
        onDownloadZip={handleDownloadZip}
        onSaveForEtsy={handleSaveForEtsy}
        onClearResults={handleClearResults}
      />

      {/* Folder Selection Bar */}
      <BatchFolderBar
        mockupFolders={mockupFolders}
        activeFolderId={activeFolderId}
        folderStatsMap={folderStatsMap}
        overLimitFolders={overLimitFolders}
        allFoldersStats={allFoldersStats}
        onFolderClick={handleFolderClick}
      />

      {/* Main Content Area */}
      {!hasGenerated ? (
        <BatchEmptyState
          selectedFolderName={selectedFolderName}
          currentPairsCount={currentPairs.length}
          currentItemCount={currentItemCount}
          isEligible={isCurrentSelectionEligible}
          isGenerating={isGenerating}
          onGenerate={handleGenerate}
        />
      ) : (
        <BatchResultsGrid renderedMatches={renderedMatches} />
      )}

      {/* Clear Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmClearOpen}
        title="Üretim Verileri Temizlensin mi?"
        message="Üretilen tüm mockup görselleri ve sonuçlar ekranınızdan temizlenecektir. Devam etmek istiyor musunuz?"
        onConfirm={handleConfirmClear}
        onCancel={() => setConfirmClearOpen(false)}
      />
    </div>
  );
};
