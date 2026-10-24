'use client';

import React from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
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
  /** Görseller Etsy için kaydedildikten sonra SEO sekmesine geçer. */
  onGoToSeo?: () => void;
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
  onGoToSeo,
}) => {
  const {
    savedForEtsyCount,
    isGenerating,
    exportProgress,
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

      {savedForEtsyCount > 0 && onGoToSeo && (
        <div role="status" className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-3 text-xs text-emerald-900 dark:text-emerald-200">
          <span className="flex-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
            {savedForEtsyCount} görsel Etsy için kaydedildi. Sıradaki adım: ilan başlığı, açıklama ve etiketleri üretmek.
          </span>
          <button type="button" onClick={onGoToSeo} className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold shrink-0">
            Etsy SEO&apos;ya git <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

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
