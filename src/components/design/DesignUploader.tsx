import { getErrorMessage } from '@/lib/errors';
import React, { useEffect, useState } from 'react';
import { DesignItem } from '@/types/pod';
import { InteractiveCropModal } from '@/components/common/InteractiveCropModal';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { useToast } from '@/components/common/ToastContext';
import { useAuth } from '@/components/common/UserAuthContext';
import { uploadMediaToServer } from '@/lib/image-optimizer';
import { deleteUnreferencedBlobs } from '@/lib/storage-service';
import { processImageInBrowser } from '@/lib/browser-image';

// Modular Hooks
import { useDesignUpload } from './hooks/useDesignUpload';
import { useDesignSelection } from './hooks/useDesignSelection';
import { useDesignAnalysis } from './hooks/useDesignAnalysis';
import { useDesignMaintenance } from './hooks/useDesignMaintenance';
import { designSection, type DesignSection } from '@/lib/design-library';
import { Spinner } from '@/components/common/Spinner';

// Modular Subcomponents
import { DesignUploadZone } from './components/DesignUploadZone';
import { DesignToolbar } from './components/DesignToolbar';
import { ActiveDesignSlots } from './components/ActiveDesignSlots';
import { DesignGrid } from './components/DesignGrid';
import { DesignAnalysisModal } from './components/DesignAnalysisModal';
import { AIDesignGeneratorModal } from './components/AIDesignGeneratorModal';
import { DesignRenameModal } from './components/DesignRenameModal';
import { Bot, Search, User, X } from 'lucide-react';

interface DesignUploaderProps {
  designs: DesignItem[];
  setDesigns: React.Dispatch<React.SetStateAction<DesignItem[]>>;
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
  const [section, setSection] = useState<DesignSection>('mine');

  // AI Design Generator Modal
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);

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

  // Custom Hooks
  const {
    isOptimizing,
    dragActive,
    handleFiles,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  } = useDesignUpload({ setDesigns });

  const {
    selectedDesignIds,
    setSelectedDesignIds,
    filteredDesigns,
    toggleManagementSelection,
    handleToggleSelectAll,
    handleToggleProductionActive,
    handleSetProductionActive,
    deactivate,
    takenSlots,
  } = useDesignSelection({
    designs,
    setDesigns,
    section,
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

  const { activeTask } = useDesignMaintenance({ designs, setDesigns, mode: user ? 'server' : 'local' });

  // Üretimdeki tasarım slotuna dokununca: tasarımın bölümü açılır, kartına kaydırılıp kısa süre vurgulanır.
  const [focusRequest, setFocusRequest] = useState<{ id: string; at: number } | null>(null);
  const focusDesign = (id: string) => {
    const design = designs.find((d) => d.id === id);
    if (!design) return;
    setSearchQuery('');
    setSection(designSection(design));
    setFocusRequest({ id, at: Date.now() });
  };
  useEffect(() => {
    if (!focusRequest) return;
    document.getElementById(`design-card-${focusRequest.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timer = setTimeout(() => setFocusRequest(null), 2200);
    return () => clearTimeout(timer);
  }, [focusRequest]);

  const counts = {
    mine: designs.filter((d) => designSection(d) === 'mine').length,
    automation: designs.filter((d) => designSection(d) === 'automation').length,
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
          // Sunucu boşlukları yeniden kırpabilir: ölçüler arka plan bakımında güncellenir.
          ? { ...d, src: serverUrl, width: size.width, height: size.height, optimizedAt: undefined }
          : d
      )
    );
    setCropTargetDesign(null);
    toast.success(`Tasarım kırpıldı (${size.width}×${size.height}px).`);
  };

  // --- Remove Background Handler ---
  const handleRemoveBgClick = async (design: DesignItem) => {
    if (!design.src) return;

    const toastId = toast.progress('Arka plan kaldırılıyor...');
    try {
      let patch: Partial<DesignItem>;
      let message: string;
      if (user) {
        const response = await fetch('/api/designs/remove-bg', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: design.src }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Arka plan kaldırılamadı');

        // Sunucu depoya yükleyemediyse (R2 yok) sonuç ayrıca yüklenir; base64 çalışma alanına yazılmaz.
        const bgSrc: string = data.bgRemovedUrl || await uploadMediaToServer(`data:image/png;base64,${data.pngBase64}`, 'image/png', { optimize: 'design' });
        patch = { src: bgSrc, optimizedAt: undefined };
        message = data.qualityMessage || 'Arka plan başarıyla kaldırıldı!';
      } else {
        // Misafir: aynı algoritma tarayıcıda çalışır; görsel sunucuya gönderilmez (sonuç kırpılmış, sıkıştırılmış PNG).
        const result = await processImageInBrowser(design.src, { type: 'remove-bg' });
        patch = { src: result.dataUrl!, width: result.width, height: result.height, optimizedAt: Date.now() };
        message = 'Arka plan bu cihazda kaldırıldı.';
      }

      setDesigns((prev) => prev.map((d) => (d.id === design.id ? { ...d, ...patch } : d)));

      toast.removeToast(toastId);
      toast.success(message);
    } catch (err) {
      toast.removeToast(toastId);
      toast.error(getErrorMessage(err) || 'Arka plan kaldırılırken hata oluştu.');
    }
  };

  // --- Recolor Handler ---
  const handleRecolorClick = async (design: DesignItem, mode: 'light_garment' | 'dark_garment') => {
    if (!design.src) return;

    const actionText = mode === 'dark_garment' ? 'Koyu kumaş versiyonu hazırlanıyor…' : 'Açık kumaş versiyonu hazırlanıyor…';
    const toastId = toast.progress(actionText);

    try {
      let recoloredUrl: string;
      let changedRatio: number;
      let size: Partial<DesignItem> = {};
      if (user) {
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
        recoloredUrl = data.recoloredUrl.startsWith('data:')
          ? await uploadMediaToServer(data.recoloredUrl, 'image/png', { optimize: 'design' })
          : data.recoloredUrl;
        changedRatio = data.changedRatio ?? 0;
      } else {
        // Misafir: aynı algoritma tarayıcıda çalışır; görsel sunucuya gönderilmez.
        const result = await processImageInBrowser(design.src, { type: 'recolor', mode });
        if (!result.dataUrl) {
          toast.removeToast(toastId);
          toast.info(`Bu tasarım zaten ${mode === 'dark_garment' ? 'koyu' : 'açık'} kumaşta iyi görünüyor; değiştirilecek renk bulunamadı.`);
          return;
        }
        recoloredUrl = result.dataUrl;
        changedRatio = result.changedRatio ?? 0;
        size = { width: result.width, height: result.height, optimizedAt: Date.now() };
      }

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
        optimizedAt: undefined,
        ...size,
      };

      setDesigns((prev) => [...prev, newDesign]);

      toast.removeToast(toastId);
      toast.success(`${mode === 'dark_garment' ? 'Koyu' : 'Açık'} kumaş versiyonu kütüphaneye eklendi (renklerin %${Math.max(1, Math.round(changedRatio * 100))}'i uyarlandı).`);
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

      {/* Main Studio Design Cards Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-6 rounded-3xl shadow-sm space-y-4">
        <ActiveDesignSlots designs={designs} takenSlots={takenSlots} onFocusDesign={focusDesign} onDeactivate={deactivate} />

        {/* Bölümler: kullanıcının tasarımları ve otomasyonların ürettikleri (en yeniden eskiye); misafirde otomasyon yok */}
        {user && <div role="tablist" aria-label="Tasarım bölümleri" className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80">
          {([
            ['mine', 'Tasarımlarım', User],
            ['automation', 'Otomasyon', Bot],
          ] as const).map(([key, label, Icon]) => {
            const active = section === key && !searchQuery.trim();
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => { setSection(key); setSearchQuery(''); }}
                className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors ${active ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
              >
                <Icon className="w-4 h-4" /> {label}
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${active ? 'bg-indigo-50 dark:bg-indigo-500/15' : 'bg-slate-200/70 dark:bg-slate-700/70'}`}>{counts[key]}</span>
              </button>
            );
          })}
        </div>}
        {activeTask && (
          <p className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 -mt-1" role="status">
            <Spinner className="w-3.5 h-3.5" />
            {`Tasarımların boşlukları kırpılıp kayıpsız PNG olarak optimize ediliyor (${activeTask.remaining} kaldı)…`}
          </p>
        )}
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
          <p className="text-[11px] text-slate-500 dark:text-slate-400 -mt-2">{filteredDesigns.length} tasarım bulundu (Tasarımlarım ve Otomasyon)</p>
        )}

        {/* Action Toolbar */}
        <DesignToolbar
          filteredDesigns={filteredDesigns}
          selectedDesignIds={selectedDesignIds}
          analyzingIds={analyzingIds}
          onToggleSelectAll={handleToggleSelectAll}
          onBulkDelete={handleBulkDelete}
          onBulkAnalyze={user ? handleBulkAnalyze : undefined}
        />

        {/* Dynamic Responsive Design Grid */}
        <DesignGrid
          designs={filteredDesigns}
          selectedDesignIds={selectedDesignIds}
          analyzingIds={analyzingIds}
          highlightedId={focusRequest?.id ?? null}
          onToggleCheck={toggleManagementSelection}
          onToggleProductionActive={handleToggleProductionActive}
          onSetProductionActive={handleSetProductionActive}
          onAnalyzeClick={user ? (design) => {
            if (design.analysis) {
              setAnalysisModalData(design);
            } else {
              handleAnalyzeDesign(design.id);
            }
          } : undefined}
          onCropClick={(design) => setCropTargetDesign(design)}
          onRenameClick={(design) => setRenameTarget(design)}
          searchQuery={searchQuery}
          section={section}
          onRemoveBgClick={handleRemoveBgClick}
          onRecolorClick={handleRecolorClick}
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

      {/* AI Design Generator Modal */}
      <AIDesignGeneratorModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        onDesignsAdded={(newDesigns) => {
          setDesigns((prev) => [...prev, ...newDesigns]);
          setSection('mine');
          setSearchQuery('');
          toast.success(`${newDesigns.length} AI tasarımı Tasarımlarım'a eklendi; analiz ediliyor…`);
          // Yapay zekâ ile üretilen tasarımlar kaydedilince bir kez analiz edilir (sırayla).
          void (async () => {
            for (const design of newDesigns) await handleAnalyzeDesign(design.id, design, { silent: true });
          })();
        }}
      />
    </div>
  );
};
