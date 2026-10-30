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

/** Depodaki (sunucudaki) dosya adresi: sunucuda üretimde doğrudan okunabilir. */
const isStoredUrl = (src: string) => /^\/api\/(r2|uploads)\//.test(src) || /^https?:\/\//.test(src);

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu.';
}

interface UseBatchGeneratorProps {
  mockups: MockupItem[];
  designs: DesignItem[];
  folders: MockupFolder[];
  activeFolderId: string | null;
  setActiveFolderId: (id: string | null) => void;
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

  // Etsy'ye giden ilan görseli: JPEG (Etsy API'si JPG/PNG/GIF kabul eder; WebP yayında JPEG'e çevrilmek
  // zorunda kalıyordu, bu da ikinci bir kayıplı sıkıştırma demekti). q0.92 gözle ayırt edilemez kalitededir.
  const exportFormat: ExportFormatType = 'image/jpeg';
  const outputQuality = 0.92;

  const mockupFolders = useMemo(() => folders.filter((f) => f.type !== 'design'), [folders]);

  // Etsy bir ilanda en fazla 20 fotoğraf ve (API ile) 1 video kabul eder (MAX_ETSY_PHOTOS / MAX_ETSY_VIDEOS).
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
      const pairs = generateMatchingPairs(folderMockups, designs, f.id);
      const pairCount = pairs.length;
      const isEligible = fitsEtsyMediaLimits(pairs);
      map.set(f.id, { itemCount, isEligible, pairCount });
    });
    return map;
  }, [mockupFolders, mockups, designs]);

  // Over limit individual folders
  const overLimitFolders = useMemo(() => {
    return mockupFolders.filter((f) => {
      const stats = folderStatsMap.get(f.id);
      return stats && !stats.isEligible;
    });
  }, [mockupFolders, folderStatsMap]);

  // Seçili klasörün eşleşmeleri ("Tüm Klasörler" yoktur: her üretim tek bir klasör = tek ilan).
  const currentPairs = useMemo(() => {
    if (!activeFolderId) return [];
    const folderMockups = mockups.filter((m) => m.folderId === activeFolderId);
    return generateMatchingPairs(folderMockups, designs, activeFolderId);
  }, [activeFolderId, mockups, designs]);

  const currentItemCount = useMemo(
    () => (activeFolderId ? mockups.filter((m) => m.folderId === activeFolderId).length : 0),
    [activeFolderId, mockups]
  );

  const isCurrentSelectionEligible = useMemo(() => {
    if (!activeFolderId) return false;
    const stats = folderStatsMap.get(activeFolderId);
    return stats ? stats.isEligible : fitsEtsyMediaLimits(currentPairs);
  }, [activeFolderId, folderStatsMap, currentPairs]);

  const selectedFolderName = useMemo(
    () => mockupFolders.find((f) => f.id === activeFolderId)?.name || 'Klasör',
    [activeFolderId, mockupFolders]
  );

  const handleFolderClick = (folderId: string) => {
    const stats = folderStatsMap.get(folderId);
    const folder = mockupFolders.find((f) => f.id === folderId);
    setActiveFolderId(folderId);

    if (stats && !stats.isEligible) {
      toast.warning(
        `"${folder?.name || 'Klasör'}" içinde ${stats.itemCount} öğe / ${stats.pairCount} varyasyon var. Etsy bir ilanda en fazla ${MAX_ETSY_PHOTOS} fotoğraf ve ${MAX_ETSY_VIDEOS} video kabul eder.`
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

    const uniqueDesignNames = Array.from(new Set(currentPairs.map((p) => p.design.name).filter(Boolean)));
    const combinedDesignName = uniqueDesignNames.join(' & ') || 'Tasarım';
    const displayDesignName =
      combinedDesignName.length > 40 ? combinedDesignName.substring(0, 40) + '...' : combinedDesignName;

    // Determine batch identity for Etsy SEO grouping
    const primaryDesign = currentPairs.find((p) => p.design.id && p.design.id !== 'static-ref')?.design || currentPairs[0]?.design;
    const primaryDesignId = primaryDesign?.id || 'default';
    const targetFolderId = activeFolderId || 'folder';
    const targetFolder = folders.find((f) => f.id === activeFolderId);
    const targetFolderName = targetFolder?.name || 'Klasör';
    const batchFolderId = `batch-${primaryDesignId}-${targetFolderId}`;
    const batchFolderName = `${targetFolderName} - ${displayDesignName}`;

    // Giriş yapılmışsa görseller sunucuda üretilip depoya yazılır (Hazır İlanlar'a eklerken yeniden yükleme
    // gerekmez); sunucu üretemezse o görsel tarayıcıda üretilir. Misafirde her şey tarayıcıdadır.
    const serverRender = Boolean(user);
    const slots: Array<RenderedMatch | null> = new Array(currentPairs.length).fill(null);
    let done = 0;
    let serverFailures = 0;

    const renderPair = async (i: number) => {
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
      const base = {
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
        exportFileName,
      };

      if (mockup.isVideo) {
        slots[i] = { ...base, previewUrl: mockup.src, format: 'video/mp4', isVideo: true, mimeType: mockup.mimeType || 'video/mp4' };
        return;
      }

      // Sunucuda üretim: statik görsel (beden tablosu vb.) olduğu gibi kullanılır, diğerlerine tasarım basılır.
      if (serverRender && isStoredUrl(mockup.src) && (isStaticAsset || isStoredUrl(design.src))) {
        if (isStaticAsset) {
          slots[i] = { ...base, previewUrl: mockup.src, format: exportFormat, isVideo: false };
          return;
        }
        const res = await fetch('/api/production/render', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mockup: { src: mockup.src, printAreas: mockup.printAreas, opacity: mockup.opacity, exportAspect: mockup.exportAspect || 'original' },
            design: { src: design.src },
          }),
        }).catch(() => null);
        const data = res?.ok ? await res.json().catch(() => null) as { url?: string } | null : null;
        if (data?.url) {
          slots[i] = { ...base, previewUrl: data.url, format: exportFormat, isVideo: false };
          return;
        }
        serverFailures++;
      }

      // Tarayıcıda üretim. The mockup editor is the single source of truth for crop/aspect.
      try {
        const dataUrl = await renderMockupWithDesign(mockup, design, {
          outputFormat: exportFormat,
          quality: outputQuality,
          exportAspect: mockup.exportAspect || 'original',
        });
        slots[i] = { ...base, previewUrl: dataUrl, format: exportFormat, isVideo: false };
      } catch (err) {
        console.error(`Mockup render error for #${i + 1}:`, err);
      }
    };

    const queue = currentPairs.map((_, i) => i);
    const workers = Array.from({ length: Math.min(serverRender ? 4 : 1, queue.length) }, async () => {
      while (queue.length > 0) {
        const i = queue.shift()!;
        await renderPair(i);
        done++;
        const currentProgress = Math.round((done / currentPairs.length) * 100);
        setExportProgress(currentProgress);
        toast.updateProgressToast(genToastId, currentProgress, `Görseller üretiliyor... (${done}/${currentPairs.length})`);
      }
    });
    await Promise.all(workers);
    const results = slots.filter((m): m is RenderedMatch => m !== null);
    if (serverFailures > 0) console.warn(`[Production] ${serverFailures} görsel sunucuda üretilemedi; tarayıcıda üretildi.`);

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
    // Sunucuda üretilen görseller zaten depodadır; yalnızca tarayıcıda üretilenler yüklenir.
    const needsUpload = renderedMatches.some((m) => m.previewUrl.startsWith('blob:') || m.previewUrl.startsWith('data:'));
    const uploadToastId = toast.progress(needsUpload ? 'Görseller ilan için yükleniyor...' : 'Hazır İlanlar\'a ekleniyor...', 5);

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
            const mime = match.isVideo ? 'video/mp4' : blob.type || 'image/jpeg';
            const file = new File([blob], match.exportFileName, { type: mime });
            persistentUrl = await uploadMediaToServer(file, mime, { requireDurable: true });
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
        if (needsUpload) toast.updateProgressToast(uploadToastId, pct, `Görseller yükleniyor... (${completedCount}/${renderedMatches.length})`);
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
              ? { description: analysis.description, keywords: analysis.keywords?.slice(0, 60), primarySubject: analysis.primarySubject, primaryAesthetic: analysis.primaryAesthetic, productType: analysis.productType, taxonomyId: Number(analysis.taxonomyId) > 0 ? Math.trunc(Number(analysis.taxonomyId)) : null }
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
