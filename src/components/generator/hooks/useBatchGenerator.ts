'use client';

import { useState, useMemo, Dispatch, SetStateAction } from 'react';
import { MockupItem, DesignItem, RenderedMatch, MockupFolder, ExportFormatType } from '@/types/pod';
import { useToast } from '@/components/common/ToastContext';
import { useAuth } from '@/components/common/UserAuthContext';
import { renderMockupWithDesign, generateMatchingPairs } from '@/lib/canvas-renderer';
import { downloadMatchesAsZip, formatExportFileName } from '@/lib/export-utils';
import { uploadMediaToServer } from '@/lib/image-optimizer';
import { loadAppData, saveAppData } from '@/lib/storage-service';
import confetti from 'canvas-confetti';
import { AspectRatioType } from '../components/BatchAspectRatioSelector';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu.';
}

interface UseBatchGeneratorProps {
  mockups: MockupItem[];
  designs: DesignItem[];
  folders: MockupFolder[];
  activeFolderId: string | null;
  setActiveFolderId: (id: string | null) => void;
  activeDesignFolderId: string | null;
  renderedMatches: RenderedMatch[];
  setRenderedMatches: Dispatch<SetStateAction<RenderedMatch[]>>;
  setHasGenerated: (val: boolean) => void;
}

export function useBatchGenerator({
  mockups,
  designs,
  folders,
  activeFolderId,
  setActiveFolderId,
  activeDesignFolderId,
  renderedMatches,
  setRenderedMatches,
  setHasGenerated,
}: UseBatchGeneratorProps) {
  const toast = useToast();
  const { user } = useAuth();

  const [isGenerating, setIsGenerating] = useState(false);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [aspectOverride, setAspectOverride] = useState<AspectRatioType>('mockup');
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const exportFormat: ExportFormatType = 'image/webp';
  const outputQuality = 0.95;

  const mockupFolders = useMemo(() => folders.filter((f) => f.type !== 'design'), [folders]);

  // Etsy allows maximum 22 items per listing (20 images + 2 videos)
  // Compute stats per individual folder
  const folderStatsMap = useMemo(() => {
    const map = new Map<string, { itemCount: number; isEligible: boolean; pairCount: number }>();
    mockupFolders.forEach((f) => {
      const folderMockups = mockups.filter((m) => m.folderId === f.id);
      const itemCount = folderMockups.length;
      const pairCount = generateMatchingPairs(folderMockups, designs, f.id, activeDesignFolderId).length;
      // An individual folder is eligible if both its item count and resulting variations are <= 22
      const isEligible = itemCount <= 22 && pairCount <= 22;
      map.set(f.id, { itemCount, isEligible, pairCount });
    });
    return map;
  }, [mockupFolders, mockups, designs, activeDesignFolderId]);

  // Over limit individual folders
  const overLimitFolders = useMemo(() => {
    return mockupFolders.filter((f) => {
      const stats = folderStatsMap.get(f.id);
      return stats && !stats.isEligible;
    });
  }, [mockupFolders, folderStatsMap]);

  // Stats for "Tüm Klasörler" (all mockup folders combined)
  const allFoldersStats = useMemo(() => {
    const allMockups = mockups.filter((m) => !m.folderId || mockupFolders.some((f) => f.id === m.folderId));
    const itemCount = allMockups.length;
    const pairCount = generateMatchingPairs(allMockups, designs, null, activeDesignFolderId).length;
    // "Tüm Klasörler" is eligible ONLY IF total items and total variations are <= 22
    const isEligible = itemCount <= 22 && pairCount <= 22;
    return { itemCount, pairCount, isEligible };
  }, [mockups, mockupFolders, designs, activeDesignFolderId]);

  // Current selected scope pairs
  const currentPairs = useMemo(() => {
    if (activeFolderId) {
      const folderMockups = mockups.filter((m) => m.folderId === activeFolderId);
      return generateMatchingPairs(folderMockups, designs, activeFolderId, activeDesignFolderId);
    }
    const allMockups = mockups.filter((m) => !m.folderId || mockupFolders.some((f) => f.id === m.folderId));
    return generateMatchingPairs(allMockups, designs, null, activeDesignFolderId);
  }, [activeFolderId, mockups, mockupFolders, designs, activeDesignFolderId]);

  // Current item count in selected scope
  const currentItemCount = useMemo(() => {
    if (activeFolderId) {
      return mockups.filter((m) => m.folderId === activeFolderId).length;
    }
    return mockups.filter((m) => !m.folderId || mockupFolders.some((f) => f.id === m.folderId)).length;
  }, [activeFolderId, mockups, mockupFolders]);

  // Eligibility check for the currently selected folder or "Tüm Klasörler"
  const isCurrentSelectionEligible = useMemo(() => {
    if (activeFolderId) {
      const stats = folderStatsMap.get(activeFolderId);
      return stats ? stats.isEligible : currentItemCount <= 22 && currentPairs.length <= 22;
    }
    return allFoldersStats.isEligible;
  }, [activeFolderId, folderStatsMap, currentItemCount, currentPairs.length, allFoldersStats]);

  const selectedFolderName = useMemo(() => {
    if (activeFolderId) {
      return mockupFolders.find((f) => f.id === activeFolderId)?.name || 'Seçili Klasör';
    }
    return 'Tüm Klasörler';
  }, [activeFolderId, mockupFolders]);

  const handleFolderClick = (folderId: string | null) => {
    if (folderId === null) {
      setActiveFolderId(null);
      if (!allFoldersStats.isEligible) {
        toast.warning(
          `Tüm klasörlerde toplam ${allFoldersStats.itemCount} öğe ve ${allFoldersStats.pairCount} varyasyon var. Etsy tek bir ilanda en fazla 22 medya (20 görsel + 2 video) desteklediği için 22'den fazla öğe üretime alınamaz.`
        );
      }
      return;
    }

    const stats = folderStatsMap.get(folderId);
    const folder = mockupFolders.find((f) => f.id === folderId);
    setActiveFolderId(folderId);

    if (stats && !stats.isEligible) {
      toast.warning(
        `"${folder?.name || 'Klasör'}" içinde ${stats.itemCount} öğe / ${stats.pairCount} varyasyon var. Etsy en fazla 22 medya (20 görsel + 2 video) kabul eder.`
      );
    }
  };

  const handleGenerate = async () => {
    // Strict 22-items limit check
    if (!isCurrentSelectionEligible || currentPairs.length > 22 || currentItemCount > 22) {
      toast.warning(
        `Etsy tek bir ilanda en fazla 22 medya (20 görsel + 2 video) kabul eder. Seçili alanda ${currentItemCount} öğe / ${currentPairs.length} varyasyon bulunmaktadır. Lütfen 22 veya daha az öğe içeren bir klasör seçin.`
      );
      return;
    }

    if (currentPairs.length === 0) {
      toast.warning('Üretim için uygun klasör, mockup veya aktif tasarım bulunamadı.');
      return;
    }

    setIsGenerating(true);
    setExportProgress(0);

    const genToastId = toast.progress('Toplu mockup görselleri üretiliyor...', 5);
    const results: RenderedMatch[] = [];

    const uniqueDesignNames = Array.from(new Set(currentPairs.map((p) => p.design.name).filter(Boolean)));
    const combinedDesignName = uniqueDesignNames.join(' & ') || 'Tasarım';
    const displayDesignName =
      combinedDesignName.length > 40 ? combinedDesignName.substring(0, 40) + '...' : combinedDesignName;

    // Determine batch identity for Etsy SEO grouping
    const primaryDesign = currentPairs.find((p) => p.design.id && p.design.id !== 'static-ref')?.design || currentPairs[0]?.design;
    const primaryDesignId = primaryDesign?.id || 'default';
    const targetFolderId = activeFolderId || 'all';
    const targetFolder = folders.find((f) => f.id === activeFolderId);
    const targetFolderName = targetFolder?.name || 'Tüm Klasörler';
    const batchFolderId = `batch-${primaryDesignId}-${targetFolderId}`;
    const batchFolderName = `${targetFolderName} - ${displayDesignName}`;

    for (let i = 0; i < currentPairs.length; i++) {
      const { mockup, design } = currentPairs[i];
      const folder = folders.find((f) => f.id === mockup.folderId);
      const baseFolderName = folder?.name || 'Mockup';

      const isStaticAsset =
        mockup.isVideo ||
        mockup.hasPrintArea === false ||
        !mockup.printAreas ||
        mockup.printAreas.length === 0;

      const exportFileName = formatExportFileName(
        displayDesignName,
        mockup.name,
        baseFolderName,
        i + 1,
        exportFormat,
        isStaticAsset,
        !!mockup.isVideo,
        'mp4'
      );

      if (mockup.isVideo) {
        results.push({
          id: `match-${Date.now()}-${i}`,
          mockupId: mockup.id,
          mockupName: mockup.name,
          mockupApparel: mockup.apparelType,
          folderId: batchFolderId,
          folderName: batchFolderName,
          folderOrderIndex: i + 1,
          designId: design.id,
          designName: design.name,
          designTarget: design.targetApparel,
          previewUrl: mockup.src,
          exportFileName,
          format: 'video/mp4',
          isVideo: true,
          mimeType: mockup.mimeType || 'video/mp4',
        });
      } else {
        const exportAspect =
          aspectOverride === 'mockup'
            ? mockup.exportAspect || 'original'
            : aspectOverride === 'square'
            ? 'square'
            : 'original';

        try {
          const dataUrl = await renderMockupWithDesign(mockup, design, {
            outputFormat: exportFormat,
            quality: outputQuality,
            exportAspect,
          });

          results.push({
            id: `match-${Date.now()}-${i}`,
            mockupId: mockup.id,
            mockupName: mockup.name,
            mockupApparel: mockup.apparelType,
            folderId: batchFolderId,
            folderName: batchFolderName,
            folderOrderIndex: i + 1,
            designId: design.id,
            designName: design.name,
            designTarget: design.targetApparel,
            previewUrl: dataUrl,
            exportFileName,
            format: exportFormat,
            isVideo: false,
          });
        } catch (err) {
          console.error(`Mockup render error for #${i + 1}:`, err);
        }
      }

      const currentProgress = Math.round(((i + 1) / currentPairs.length) * 100);
      setExportProgress(currentProgress);
      toast.updateProgressToast(
        genToastId,
        currentProgress,
        `Görseller üretiliyor... (${i + 1}/${currentPairs.length})`
      );
    }

    setRenderedMatches(results);
    setHasGenerated(true);
    setIsGenerating(false);
    setExportProgress(null);

    toast.removeToast(genToastId);
    toast.success(`${results.length} adet mockup görseli başarıyla üretildi!`);

    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch {
      // Confetti fallback
    }
  };

  const handleDownloadZip = async () => {
    if (renderedMatches.length === 0) {
      toast.warning('İndirilecek mockup görseli bulunamadı.');
      return;
    }

    setExportProgress(10);
    const zipToastId = toast.progress('ZIP arşivi hazırlanıyor...', 10);

    try {
      await downloadMatchesAsZip(renderedMatches, 'automania-toplu-mockuplar.zip', (percent) => {
        setExportProgress(percent);
        toast.updateProgressToast(zipToastId, percent, `ZIP dosyası sıkıştırılıyor... %${percent}`);
      });
      toast.removeToast(zipToastId);
      toast.success('ZIP dosyası başarıyla indirildi!');
    } catch (error: unknown) {
      console.error('ZIP download error:', getErrorMessage(error));
      toast.removeToast(zipToastId);
      toast.error('ZIP oluşturulurken bir hata oluştu: ' + getErrorMessage(error));
    } finally {
      setExportProgress(null);
    }
  };

  const handleSaveForEtsy = async () => {
    if (renderedMatches.length === 0) {
      toast.warning('Kaydedilecek mockup bulunamadı.');
      return;
    }
    if (!user) {
      toast.warning('Etsy için kaydetmek için lütfen önce giriş yapın.');
      return;
    }

    const currentData = await loadAppData();
    if (!currentData) {
      toast.error('Kullanıcı verisi yüklenemedi.');
      return;
    }

    setIsGenerating(true);
    setExportProgress(0);
    const uploadToastId = toast.progress('Görseller Etsy için hazırlanıyor...', 5);

    try {
      const updatedMatches: RenderedMatch[] = new Array(renderedMatches.length);
      let completedCount = 0;
      const concurrency = 4;

      const uploadItem = async (index: number) => {
        const match = renderedMatches[index];
        let persistentUrl = match.previewUrl;

        if (match.previewUrl.startsWith('blob:') || match.previewUrl.startsWith('data:')) {
          try {
            const res = await fetch(match.previewUrl);
            const blob = await res.blob();
            const file = new File([blob], match.exportFileName, {
              type: match.isVideo ? 'video/mp4' : 'image/webp',
            });

            persistentUrl = await uploadMediaToServer(file, match.isVideo ? 'video/mp4' : 'image/webp');
          } catch (e) {
            console.warn(`[Save for Etsy] Mockup #${index + 1} upload failed, using local preview fallback:`, e);
            persistentUrl = match.previewUrl;
          }
        }

        updatedMatches[index] = {
          ...match,
          previewUrl: persistentUrl,
        };

        completedCount++;
        const pct = Math.round((completedCount / renderedMatches.length) * 100);
        setExportProgress(pct);
        toast.updateProgressToast(
          uploadToastId,
          pct,
          `Görseller Etsy için kaydediliyor... (${completedCount}/${renderedMatches.length})`
        );
      };

      // Run uploads in parallel with controlled concurrency
      const queue = Array.from({ length: renderedMatches.length }, (_, idx) => idx);
      const workers = Array.from({ length: Math.min(concurrency, renderedMatches.length) }, async () => {
        while (queue.length > 0) {
          const nextIdx = queue.shift();
          if (nextIdx !== undefined) {
            await uploadItem(nextIdx);
          }
        }
      });

      await Promise.all(workers);

      // Preserve mockups from other folders while updating current folder
      const currentEtsyMockups = currentData.etsyGeneratedMockups || [];
      const incomingFolderIds = new Set(updatedMatches.map((m) => m.folderId).filter(Boolean));
      const preservedMockups = currentEtsyMockups.filter((m) => !incomingFolderIds.has(m.folderId));
      currentData.etsyGeneratedMockups = [...preservedMockups, ...updatedMatches];

      await saveAppData(currentData);

      setRenderedMatches(updatedMatches);
      toast.removeToast(uploadToastId);
      
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.8 },
        });
      } catch {}

      toast.success(
        `${updatedMatches.length} görsel Etsy Yöneticisi için başarıyla kaydedildi! 'Etsy' sekmesinden ilan taslağınızı oluşturabilirsiniz.`
      );
    } catch (error: unknown) {
      console.error('Save for Etsy error:', getErrorMessage(error));
      toast.removeToast(uploadToastId);
      toast.error('Görseller kaydedilirken bir hata oluştu: ' + getErrorMessage(error));
    } finally {
      setIsGenerating(false);
      setExportProgress(null);
    }
  };

  const handleClearResults = () => {
    setConfirmClearOpen(true);
  };

  const handleConfirmClear = () => {
    setRenderedMatches([]);
    setHasGenerated(false);
    setConfirmClearOpen(false);
    toast.info('Üretim sonuçları temizlendi.');
  };

  return {
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
  };
}
