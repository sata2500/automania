'use client';

import React, { useState } from 'react';
import { MockupItem, DesignItem, RenderedMatch, MockupFolder, ExportFormatType } from '@/types/pod';
import { useToast } from '@/components/common/ToastContext';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import {
  renderMockupWithDesign,
  generateMatchingPairs,
} from '@/lib/canvas-renderer';
import { downloadMatchesAsZip, formatExportFileName } from '@/lib/export-utils';
import { uploadMediaToServer } from '@/lib/image-optimizer';
import { loadAppData, saveAppData } from '@/lib/storage-service';
import { useAuth } from '@/components/common/UserAuthContext';
import confetti from 'canvas-confetti';
import {
  Sparkles,
  RefreshCw,
  FileArchive,
  Layers,
  Folder,
  FolderOpen,
  Zap,
  Play,
  CheckCircle2,
  Video,
  Trash2,
  Download,
  CloudUpload,
} from 'lucide-react';

interface BatchPreviewGridProps {
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
  const toast = useToast();
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [exportProgress, setExportProgress] = useState<number | null>(null);

  const exportFormat: ExportFormatType = 'image/webp';
  const outputResolution = 3000;
  const outputQuality = 0.95;

  const currentPairs = React.useMemo(
    () => generateMatchingPairs(mockups, designs, activeFolderId, activeDesignFolderId),
    [mockups, designs, activeFolderId, activeDesignFolderId]
  );
  
  const allPairsCount = React.useMemo(
    () => generateMatchingPairs(mockups, designs, null, activeDesignFolderId).length,
    [mockups, designs, activeDesignFolderId]
  );

  const folderPairsCountMap = React.useMemo(() => {
    const map = new Map<string, number>();
    folders.forEach(f => {
      if (f.type !== 'design') {
        map.set(f.id, generateMatchingPairs(mockups, designs, f.id, activeDesignFolderId).length);
      }
    });
    return map;
  }, [folders, mockups, designs, activeDesignFolderId]);

  const [aspectOverride, setAspectOverride] = useState<'mockup' | 'original' | 'square'>('mockup');

  const handleGenerate = async () => {
    const pairs = generateMatchingPairs(mockups, designs, activeFolderId, activeDesignFolderId);
    if (pairs.length === 0) {
      toast.warning('Üretim için aktif tasarım veya mockup bulunamadı.');
      return;
    }

    setIsGenerating(true);
    setExportProgress(0);

    const genToastId = toast.progress('Toplu mockup görselleri üretiliyor...', 5);
    const results: RenderedMatch[] = [];

    for (let i = 0; i < pairs.length; i++) {
      const { mockup, design } = pairs[i];
      const folder = folders.find((f) => f.id === mockup.folderId);
      const folderName = folder?.name || 'Mockup';
      const isVideo = mockup.isVideo;
      const isStaticAsset = isVideo || mockup.hasPrintArea === false || !mockup.printAreas || mockup.printAreas.length === 0;

      const folderMockups = mockups.filter((m) => m.folderId === mockup.folderId);
      const positionInFolder = folderMockups.findIndex((m) => m.id === mockup.id);
      const folderOrderIndex = positionInFolder !== -1 ? positionInFolder + 1 : i + 1;

      try {
        const exportAspect = aspectOverride === 'mockup' ? (mockup.exportAspect || 'original') : aspectOverride;

        const previewUrl = await renderMockupWithDesign(mockup, design, {
          outputWidth: outputResolution,
          outputHeight: outputResolution,
          quality: outputQuality,
          outputFormat: exportFormat,
          exportAspect,
        });

        const videoExt = isVideo ? (mockup.mimeType?.split('/')[1] || 'mp4') : 'mp4';

        const exportFileName = formatExportFileName(
          design.name,
          mockup.name,
          folderName,
          folderOrderIndex,
          exportFormat,
          isStaticAsset,
          isVideo,
          videoExt
        );

        results.push({
          id: `match-${i}-${Date.now()}`,
          mockupId: mockup.id,
          mockupName: mockup.name,
          mockupApparel: mockup.apparelType,
          folderId: mockup.folderId,
          folderName,
          folderOrderIndex,
          designId: design.id,
          designName: design.name,
          designTarget: design.targetApparel,
          previewUrl,
          exportFileName,
          format: exportFormat,
          isVideo,
          mimeType: mockup.mimeType,
        });

        const percent = Math.round(((i + 1) / pairs.length) * 100);
        toast.updateProgressToast(genToastId, percent, `${i + 1}/${pairs.length} varyasyon işlendi`);
      } catch (err) {
        console.error('Error rendering pair:', err);
      }
    }

    setRenderedMatches(results);
    setHasGenerated(true);
    setIsGenerating(false);
    setExportProgress(null);
    toast.removeToast(genToastId);
    toast.success(`${results.length} adet mockup görseli üretildi!`);
  };

  const handleDownloadZip = async () => {
    if (renderedMatches.length === 0) return;
    const zipToastId = toast.progress('ZIP paketi sıkıştırılıyor...', 10);
    setExportProgress(5);
    try {
      const folderName = folders.find((f) => f.id === activeFolderId)?.name || 'Tumu';
      await downloadMatchesAsZip(
        renderedMatches,
        `Etsy_Mockups_${folderName}_${Date.now()}.zip`,
        (percent) => {
          setExportProgress(percent);
          toast.updateProgressToast(zipToastId, percent, `%${percent} ZIP paketi hazırlandı`);
        }
      );

      toast.removeToast(zipToastId);
      toast.success('ZIP dosyası başarıyla indirildi!');

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (err) {
      console.error('ZIP export error:', err);
      toast.removeToast(zipToastId);
      toast.error('ZIP indirilirken bir hata oluştu.');
    } finally {
      setTimeout(() => setExportProgress(null), 1000);
    }
  };

  const handleSaveForEtsy = async () => {
    if (renderedMatches.length === 0) return;
    const saveToastId = toast.progress('Görseller buluta kaydediliyor...', renderedMatches.length);
    setIsGenerating(true);
    setExportProgress(10);
    
    try {
      const uploadedMatches: RenderedMatch[] = [];
      for (let i = 0; i < renderedMatches.length; i++) {
        const match = renderedMatches[i];
        toast.updateProgressToast(saveToastId, Math.round(((i + 1) / renderedMatches.length) * 100), `${i + 1}/${renderedMatches.length} görsel yükleniyor`);
        
        try {
          const uploadedUrl = await uploadMediaToServer(match.previewUrl, match.format);
          uploadedMatches.push({ ...match, previewUrl: uploadedUrl });
        } catch (uploadErr) {
          console.error('Upload failed for match:', match.id, uploadErr);
          // If one fails, we continue with the rest or abort? Let's just push original if it fails so it doesn't break everything, or throw.
          throw new Error(`Görsel yüklenemedi: ${match.mockupName}`);
        }
      }
      
      const currentData = await loadAppData();
      // Veritabanındaki eski üretilmiş görsellerin üzerine yazar (kullanıcı her ürettiğinde güncel seti tutarız)
      currentData.etsyGeneratedMockups = uploadedMatches;
      await saveAppData(currentData);
      
      toast.removeToast(saveToastId);
      toast.success('Görseller Etsy Yöneticisine kaydedildi! Şimdi Etsy SEO sekmesinden seçebilirsiniz.');
      
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (err: any) {
      console.error('Save to Etsy error:', err);
      toast.removeToast(saveToastId);
      toast.error(err.message || 'Buluta kaydedilirken bir hata oluştu.');
    } finally {
      setIsGenerating(false);
      setTimeout(() => setExportProgress(null), 1000);
    }
  };

  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const handleClearResults = () => {
    setConfirmClearOpen(true);
  };

  const handleConfirmClear = () => {
    setRenderedMatches([]);
    setHasGenerated(false);
    setConfirmClearOpen(false);
    toast.info('Üretim sonuçları temizlendi.');
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-800/60 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-pink-500 dark:text-pink-400" />
            Toplu Mockup Üretim Stüdyosu
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Görseller sırayla 3000 x 3000 piksel çözünürlükte ve WebP formatında üretilir.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold">
            <span className="text-[11px] text-slate-400 font-bold uppercase mr-1">En-Boy Oranı:</span>
            <select
              value={aspectOverride}
              onChange={(e) => setAspectOverride(e.target.value as 'mockup' | 'original' | 'square')}
              className="bg-transparent text-indigo-600 dark:text-indigo-400 font-bold outline-none cursor-pointer"
            >
              <option value="mockup">Mockup Ayarı (Otomatik)</option>
              <option value="original">Orijinal Boyut (Kırpma Yok)</option>
              <option value="square">Kare Yap (1:1)</option>
            </select>
          </div>

          <div className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <Zap className="w-4 h-4 text-amber-500 shrink-0" />
            <span>3000px HD WebP</span>
          </div>

          {hasGenerated && (
            <button
              onClick={handleGenerate}
              disabled={isGenerating || currentPairs.length === 0}
              className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 disabled:opacity-50 text-white font-extrabold rounded-xl text-xs transition-all shadow-lg shadow-purple-600/30 cursor-pointer"
            >
              {isGenerating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4 text-amber-300 fill-amber-300" />
              )}
              <span>Yeniden Üret</span>
            </button>
          )}

          {hasGenerated && (
            <button
              onClick={handleDownloadZip}
              disabled={renderedMatches.length === 0 || exportProgress !== null}
              className="flex items-center space-x-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-emerald-600/20 cursor-pointer"
            >
              <FileArchive className="w-4 h-4" />
              <span>ZIP İndir ({renderedMatches.length})</span>
            </button>
          )}

          {hasGenerated && user && (
            <button
              onClick={handleSaveForEtsy}
              disabled={isGenerating || renderedMatches.length === 0 || exportProgress !== null}
              className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-400 hover:to-rose-400 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-orange-500/30 cursor-pointer"
              title="Görselleri Etsy Yöneticisi sayfasına gönderir"
            >
              <CloudUpload className="w-4 h-4" />
              <span>Etsy İçin Kaydet</span>
            </button>
          )}

          {hasGenerated && (
            <button
              onClick={handleClearResults}
              disabled={isGenerating}
              className="flex items-center space-x-1.5 px-3.5 py-2.5 bg-slate-100 dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 border border-slate-200 dark:border-slate-700 hover:border-rose-300 dark:hover:border-rose-500/50 rounded-xl text-xs font-bold transition-all shadow shrink-0 cursor-pointer"
              title="Üretilen verileri ekranı sıfırlamak için temizleyin"
            >
              <Trash2 className="w-4 h-4 text-rose-500 dark:text-rose-400" />
              <span>Verileri Temizle</span>
            </button>
          )}
        </div>
      </div>

      {/* Folder Selection Bar */}
      <div className="bg-slate-50 dark:bg-slate-900/90 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
          Üretim İçin Klasör Seçin:
        </label>
        <div className="grid grid-rows-2 grid-flow-col auto-cols-max gap-2 overflow-x-auto custom-scrollbar pb-2.5 max-h-[95px]">
          <button
            onClick={() => setActiveFolderId(null)}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer max-w-[210px] min-w-0 ${
              activeFolderId === null
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 border-indigo-400 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FolderOpen className={`w-4 h-4 shrink-0 ${activeFolderId === null ? 'text-amber-300' : 'text-indigo-500 dark:text-indigo-400'}`} />
            <span className="truncate">Tüm Klasörler</span>
            <span className={`px-2 py-0.5 text-[10px] rounded-full font-extrabold shrink-0 ${
              activeFolderId === null ? 'bg-slate-950/80 text-amber-300' : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
            }`}>
              {allPairsCount} Varyasyon
            </span>
          </button>

          {folders.filter(f => f.type !== 'design').map((folder) => {
            const isActive = activeFolderId === folder.id;
            const pairCount = folderPairsCountMap.get(folder.id) || 0;
            return (
              <button
                key={folder.id}
                onClick={() => setActiveFolderId(folder.id)}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer max-w-[210px] min-w-0 ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 border-indigo-400 text-white shadow-lg shadow-indigo-600/30'
                    : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title={`${folder.name} (${pairCount} Varyasyon)`}
              >
                {isActive ? <FolderOpen className="w-4 h-4 text-amber-300 shrink-0" /> : <Folder className="w-4 h-4 text-slate-400 shrink-0" />}
                <span className="truncate">{folder.name}</span>
                <span className={`px-2 py-0.5 text-[10px] rounded-full font-extrabold shrink-0 ${
                  isActive ? 'bg-slate-950/80 text-amber-300' : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}>
                  {pairCount}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      {!hasGenerated ? (
        <div className="bg-slate-100/60 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-3xl p-8 md:p-12 text-center space-y-5 shadow-xl dark:shadow-2xl">
          <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto shadow-xl shadow-indigo-600/30 animate-pulse">
            <Sparkles className="w-8 h-8 text-white" />
          </div>

          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Toplu Mockup Üretimini Başlatın</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Seçili klasördeki mockup'lar ile aktif PNG tasarımları eşleştirilip yüksek çözünürlüklü Etsy çıktısına dönüştürülür.
            </p>
          </div>

          <div className="inline-flex items-center gap-3 bg-slate-100 dark:bg-slate-900/80 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <Layers className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
            <span>Hazır Eşleşme Sayısı: <strong className="text-amber-500 dark:text-amber-400 font-mono text-sm">{currentPairs.length} Varyasyon</strong></span>
          </div>

          <div>
            <button
              onClick={handleGenerate}
              disabled={isGenerating || currentPairs.length === 0}
              className="px-8 py-3.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 disabled:opacity-50 text-white font-extrabold rounded-2xl text-sm transition-all shadow-xl shadow-purple-600/30 hover:scale-105 active:scale-95 cursor-pointer inline-flex items-center gap-2"
            >
              {isGenerating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 text-amber-300 fill-amber-300" />}
              <span>Toplu Görselleri Üret ({currentPairs.length})</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Toplu Üretim Tamamlandı ({renderedMatches.length} Varyasyon)
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {renderedMatches.map((match) => (
              <div
                key={match.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-md dark:shadow-lg group"
              >
                <div className="w-full h-48 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 relative flex items-center justify-center mb-3 group/img">
                  {match.isVideo ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300">
                      <Video className="w-8 h-8 mb-1 opacity-80" />
                      <span className="text-[10px] font-bold">Video Mockup</span>
                    </div>
                  ) : (
                    <>
                      <img src={match.previewUrl} alt={match.exportFileName} className="w-full h-full object-contain" />
                      <a 
                        href={match.previewUrl} 
                        download={match.exportFileName}
                        className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full opacity-0 group-hover/img:opacity-100 transition-opacity backdrop-blur-sm shadow-lg cursor-pointer"
                        title="İndir"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </>
                  )}
                </div>

                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate" title={match.exportFileName}>
                    {match.exportFileName}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    <span>{match.folderName}</span>
                    <span className="text-indigo-500 dark:text-indigo-400 font-mono">#{match.folderOrderIndex}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
