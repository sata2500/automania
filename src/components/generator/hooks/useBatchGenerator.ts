'use client';

import { MAX_ETSY_PHOTOS, MAX_ETSY_VIDEOS } from '@/lib/etsy-preflight';
import { useState, useMemo, Dispatch, SetStateAction } from 'react';
import { MockupItem, DesignItem, RenderedMatch, MockupFolder, ExportFormatType } from '@/types/pod';
import { useToast } from '@/components/common/ToastContext';
import { useAuth } from '@/components/common/UserAuthContext';
import { renderMockupWithDesign, generateMatchingPairs } from '@/lib/canvas-renderer';
import { downloadMatchesAsZip, formatExportFileName } from '@/lib/export-utils';
import { uploadMediaToServer } from '@/lib/image-optimizer';
import confetti from 'canvas-confetti';

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
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  // Son üretimden ilan oluşturulduysa Hazır İlanlar'a geçiş düğmesi gösterilir.
  const [listingCreated, setListingCreated] = useState(false);

  const exportFormat: ExportFormatType = 'image/webp';
  const outputQuality = 0.95;

  const mockupFolders = useMemo(() => folders.filter((f) => f.type !== 'design'), [folders]);

  // Etsy bir ilanda en fazla 20 fotoğraf ve 2 video kabul eder (MAX_ETSY_PHOTOS / MAX_ETSY_VIDEOS).
  // Sınır mockup sayısına değil, üretilecek görsellere (eşleşmelere) uygulanır.
  const fitsEtsyMediaLimits = (pairs: Array<{ mockup: { isVideo?: boolean } }>) => {
    const videos = pairs.filter((p) => p.mockup.isVideo === true).length;
    return pairs.length - videos <= MAX_ETSY_PHOTOS && videos <= MAX_ETSY_VIDEOS;
  };

  // Compute stats per individual folder
  const folderStatsMap = useMemo(() => {
    const map = new Map<string, { itemCount: number; isEligible: boolean; pairCount: number }>();
    mockupFolders.forEach((f) => {
      const folderMockups = mockups.filter((m) => m.folderId === f.id);
      const itemCount = folderMockups.length;
      const pairs = generateMatchingPairs(folderMockups, designs, f.id, activeDesignFolderId);
      const pairCount = pairs.length;
      const isEligible = fitsEtsyMediaLimits(pairs);
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
    const pairs = generateMatchingPairs(allMockups, designs, null, activeDesignFolderId);
    const pairCount = pairs.length;
    const isEligible = fitsEtsyMediaLimits(pairs);
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
      return stats ? stats.isEligible : fitsEtsyMediaLimits(currentPairs);
    }
    return allFoldersStats.isEligible;
  }, [activeFolderId, folderStatsMap, currentPairs, allFoldersStats]);

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
          `Tüm klasörlerde toplam ${allFoldersStats.itemCount} öğe ve ${allFoldersStats.pairCount} varyasyon var. Etsy tek bir ilanda en fazla 20 fotoğraf ve 2 video kabul ettiği için bu kapsam üretime alınamaz.`
        );
      }
      return;
    }

    const stats = folderStatsMap.get(folderId);
    const folder = mockupFolders.find((f) => f.id === folderId);
    setActiveFolderId(folderId);

    if (stats && !stats.isEligible) {
      toast.warning(
        `"${folder?.name || 'Klasör'}" içinde ${stats.itemCount} öğe / ${stats.pairCount} varyasyon var. Etsy en fazla 20 fotoğraf ve 2 video kabul eder.`
      );
    }
  };

  const handleGenerate = async () => {
    if (!isCurrentSelectionEligible) {
      toast.warning(
        `Etsy tek bir ilanda en fazla ${MAX_ETSY_PHOTOS} fotoğraf ve ${MAX_ETSY_VIDEOS} video kabul eder. Seçili alan ${currentPairs.length} görsel üretecek. Lütfen daha az mockup/tasarım içeren bir klasör seçin.`
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
          designTarget: design.targetApparel || 'both',
          previewUrl: mockup.src,
          exportFileName,
          format: 'video/mp4',
          isVideo: true,
          mimeType: mockup.mimeType || 'video/mp4',
        });
      } else {
        // The mockup editor is the single source of truth for crop/aspect.
        // Batch generation must not apply a second user-selected crop.
        const exportAspect = mockup.exportAspect || 'original';

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
            designTarget: design.targetApparel || 'both',
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
    setListingCreated(false);
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

  /**
   * Üretilen görselleri depoya yükleyip ilanı Hazır İlanlar'a gönderir. İlan metni (başlık, etiketler,
   * açıklama) sunucuda arka planda, Ayarlar'daki ilan varsayılanları ve varyasyonlarla hazırlanır.
   */
  const handleCreateListing = async () => {
    if (renderedMatches.length === 0) {
      toast.warning('İlana eklenecek görsel bulunamadı.');
      return;
    }
    if (!user) {
      toast.warning('İlan oluşturmak için lütfen önce giriş yapın.');
      return;
    }

    setIsGenerating(true);
    setExportProgress(0);
    const uploadToastId = toast.progress('Görseller ilan için yükleniyor...', 5);

    try {
      const uploadedUrls: string[] = new Array(renderedMatches.length);
      let completedCount = 0;
      const concurrency = 4;
      let aborted = false;

      const uploadItem = async (index: number) => {
        const match = renderedMatches[index];
        let persistentUrl = match.previewUrl;
        if (match.previewUrl.startsWith('blob:') || match.previewUrl.startsWith('data:')) {
          try {
            const blob = await (await fetch(match.previewUrl)).blob();
            const file = new File([blob], match.exportFileName, { type: match.isVideo ? 'video/mp4' : 'image/webp' });
            persistentUrl = await uploadMediaToServer(file, match.isVideo ? 'video/mp4' : 'image/webp', { requireDurable: true });
          } catch (e) {
            console.warn(`[Create listing] Mockup #${index + 1} upload failed; durable storage is required:`, e);
            aborted = true; // Diğer işçiler kuyruktaki yeni yüklemelere başlamasın
            throw e;
          }
        }
        uploadedUrls[index] = persistentUrl;
        completedCount++;
        const pct = Math.round((completedCount / renderedMatches.length) * 90);
        setExportProgress(pct);
        toast.updateProgressToast(uploadToastId, pct, `Görseller yükleniyor... (${completedCount}/${renderedMatches.length})`);
      };

      const queue = Array.from({ length: renderedMatches.length }, (_, idx) => idx);
      const workers = Array.from({ length: Math.min(concurrency, renderedMatches.length) }, async () => {
        while (queue.length > 0 && !aborted) {
          const nextIdx = queue.shift();
          if (nextIdx !== undefined) await uploadItem(nextIdx);
        }
      });
      await Promise.all(workers);
      setRenderedMatches(renderedMatches.map((m, i) => ({ ...m, previewUrl: uploadedUrls[i] ?? m.previewUrl })));

      // İlanın konusu ilk gerçek tasarımdan (bilgi görselleri hariç) alınır; analizi yoksa önce analiz edilir.
      const designId = renderedMatches.find((m) => m.designId && m.designId !== 'static-ref')?.designId;
      const design = designs.find((d) => d.id === designId);
      let analysis = design?.analysis ?? null;
      if (design && !analysis?.description && /^\/api\/(r2|uploads)\//.test(design.src)) {
        toast.updateProgressToast(uploadToastId, 93, 'Tasarım analiz ediliyor...');
        const res = await fetch('/api/designs/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ src: design.src }),
        }).catch(() => null);
        const data = await res?.json().catch(() => null);
        if (data?.success && data.analysis) analysis = data.analysis;
      }

      const photos = renderedMatches.flatMap((m, i) => (m.isVideo ? [] : [{ url: uploadedUrls[i]!, label: `${m.mockupApparel ?? ''} ${m.designId === 'static-ref' ? 'static info image' : 'mockup with the design printed on it'}${m.mockupName ? ` (mockup name: "${m.mockupName}")` : ''}`.trim() }])).slice(0, MAX_ETSY_PHOTOS);
      const video = renderedMatches.map((m, i) => (m.isVideo ? uploadedUrls[i] : null)).find(Boolean) ?? null;
      const res = await fetch('/api/listing-review/from-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photos: photos.map((p) => p.url),
          photoLabels: photos.map((p) => p.label.slice(0, 300)),
          videoUrl: video,
          folderId: renderedMatches[0]?.folderId ?? null,
          folderName: renderedMatches[0]?.folderName,
          design: {
            id: design?.id ?? null,
            url: design && /^\/api\/(r2|uploads)\//.test(design.src) ? design.src : null,
            name: design?.name ?? renderedMatches[0]?.designName ?? 'Tasarım',
            analysis: analysis
              ? { description: analysis.description, keywords: analysis.keywords?.slice(0, 60), primarySubject: analysis.primarySubject, primaryAesthetic: analysis.primaryAesthetic, productType: analysis.productType }
              : null,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'İlan oluşturulamadı.');

      setListingCreated(true);
      toast.removeToast(uploadToastId);
      try {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
      } catch {}
      toast.success('İlan Hazır İlanlar\'a eklendi; başlık, etiket ve açıklama arka planda hazırlanıyor.');
    } catch (error: unknown) {
      console.error('Create listing error:', getErrorMessage(error));
      toast.removeToast(uploadToastId);
      toast.error('İlan oluşturulamadı: ' + getErrorMessage(error));
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
    setListingCreated(false);
    setConfirmClearOpen(false);
    toast.info('Üretim sonuçları temizlendi.');
  };

  return {
    listingCreated,
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
    handleCreateListing,
    handleClearResults,
    handleConfirmClear,
  };
}
