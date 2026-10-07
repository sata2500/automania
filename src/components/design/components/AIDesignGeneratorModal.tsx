'use client';

/**
 * AIDesignGeneratorModal
 * =======================
 * Kullanıcı prompt girer → Gemini görsel üretir (yeşil arka planlı) →
 * önizleme gösterir → arka planı kaldırıp tasarım olarak kaydeder.
 *
 * Akış:
 *  1. Prompt gir + ayarla
 *  2. "Üret" → /api/designs/generate
 *  3. Sonuçları göster (önizleme grid)
 *  4. Seçili görseller → /api/designs/remove-bg → transparan PNG
 *  5. Dosya olarak kaydet → setDesigns()
 */

import React, { useState, useCallback } from 'react';
import {
  X, Sparkles, Loader2, CheckCircle2,
  AlertCircle, RefreshCw, Eraser, ImagePlus,
  Info
} from 'lucide-react';
import { DesignItem, MockupFolder } from '@/types/pod';
import { uploadMediaToServer } from '@/lib/image-optimizer';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GeneratedPreview {
  id: string;
  data: string;        // base64 (yeşil arka planlı)
  mimeType: string;
  pngData?: string;    // base64 (transparan PNG, arka plan kaldırıldıktan sonra)
  bgRemoved?: boolean;
  bgRemoving?: boolean;
  bgQuality?: 'good' | 'warning' | 'poor';
  selected: boolean;
}

interface AIDesignGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeDesignFolderId: string | null;
  designFolders: MockupFolder[];
  onDesignsAdded: (designs: DesignItem[]) => void;
}

// ─── Bileşen ──────────────────────────────────────────────────────────────────

export const AIDesignGeneratorModal: React.FC<AIDesignGeneratorModalProps> = ({
  isOpen,
  onClose,
  activeDesignFolderId,
  designFolders,
  onDesignsAdded,
}) => {
  const [prompt, setPrompt] = useState('');
  const [count, setCount] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [previews, setPreviews] = useState<GeneratedPreview[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'prompt' | 'preview'>('prompt');

  // ── Tasarım Üret ─────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setError(null);
    setPreviews([]);

    try {
      const res = await fetch('/api/designs/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          greenBackground: true,
          numberOfImages: count,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Görsel üretilemedi');

      const newPreviews: GeneratedPreview[] = (data.images ?? []).map((img: { id: string; data: string; mimeType: string }) => ({
        id: img.id,
        data: img.data,
        mimeType: img.mimeType,
        selected: true,
      }));

      setPreviews(newPreviews);
      setStep('preview');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Görsel üretilemedi');
    } finally {
      setGenerating(false);
    }
  };

  // ── Tek Görselin Arka Planını Kaldır ──────────────────────────────────────
  const handleRemoveBg = useCallback(async (id: string) => {
    setPreviews(prev =>
      prev.map(p => p.id === id ? { ...p, bgRemoving: true } : p)
    );

    try {
      const preview = previews.find(p => p.id === id);
      if (!preview) return;

      const res = await fetch('/api/designs/remove-bg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData: preview.data,
          mimeType: preview.mimeType,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setPreviews(prev =>
        prev.map(p =>
          p.id === id
            ? {
                ...p,
                pngData: data.pngBase64,
                bgRemoved: true,
                bgRemoving: false,
                bgQuality: data.quality,
              }
            : p
        )
      );
    } catch {
      setPreviews(prev =>
        prev.map(p => p.id === id ? { ...p, bgRemoving: false } : p)
      );
    }
  }, [previews]);

  // ── Tüm Seçililer İçin Arka Plan Kaldır ──────────────────────────────────
  const handleRemoveAllBg = async () => {
    const toProcess = previews.filter(p => p.selected && !p.bgRemoved);
    for (const p of toProcess) {
      await handleRemoveBg(p.id);
    }
  };

  // ── Tasarım Olarak Kaydet ─────────────────────────────────────────────────
  const handleSave = async () => {
    const selected = previews.filter(p => p.selected);
    if (selected.length === 0) return;

    setSaving(true);
    const newDesigns: DesignItem[] = [];

    try {
      for (const preview of selected) {
        // Önce arka planı kaldırılmış sürümü kullan, yoksa orijinali
        const finalData = preview.pngData ?? preview.data;
        const finalMime = preview.pngData ? 'image/png' : preview.mimeType;

        // data URL oluştur
        const dataUrl = `data:${finalMime};base64,${finalData}`;

        // Blob storage'a yükle
        const src = await uploadMediaToServer(dataUrl, `ai-design-${Date.now()}.png`);

        const designItem: DesignItem = {
          id: `design-ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: `AI Tasarım — ${prompt.slice(0, 30)}${prompt.length > 30 ? '...' : ''}`,
          src,
          width: 1024,
          height: 1024,
          folderId: activeDesignFolderId ?? undefined,
          isProductionActive: false,
          createdAt: Date.now(),
          tags: [],
          generatedByAI: true,
          promptUsed: prompt,
        };

        newDesigns.push(designItem);
      }

      onDesignsAdded(newDesigns);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Kaydedilirken hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  // ── Reset ─────────────────────────────────────────────────────────────────
  const handleBack = () => {
    setStep('prompt');
    setPreviews([]);
    setError(null);
  };

  const handleClose = () => {
    setStep('prompt');
    setPreviews([]);
    setError(null);
    setPrompt('');
    onClose();
  };

  if (!isOpen) return null;

  const selectedCount = previews.filter(p => p.selected).length;
  const bgRemovedCount = previews.filter(p => p.selected && p.bgRemoved).length;
  const anyRemoving = previews.some(p => p.bgRemoving);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700/60 overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-purple-600/10 via-indigo-600/10 to-pink-600/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center shadow-sm">
              <Sparkles className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                AI ile Tasarım Üret
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {step === 'prompt' ? 'Tasarımı tarif et, yapay zeka üretsin' : `${previews.length} görsel üretildi`}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Step 1: Prompt ─────────────────────────────────────────── */}
          {step === 'prompt' && (
            <div className="p-5 space-y-5">

              {/* Info Banner */}
              <div className="flex items-start gap-2.5 p-3.5 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-800/40 text-xs text-indigo-700 dark:text-indigo-300">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <p>
                  Yapay zeka <strong>yeşil arka planlı</strong> tasarım üretir. Sonraki adımda yeşil arka plan otomatik kaldırılarak şeffaf PNG oluşturulur.
                </p>
              </div>

              {/* Prompt Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Tasarım Prompt'u
                </label>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleGenerate();
                  }}
                  placeholder={`Örn: "Retro güneş gözlüklü kedi, vaporwave renk paleti, t-shirt tasarımı için"\n\nCtrl+Enter ile üret`}
                  rows={4}
                  className="w-full px-4 py-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-purple-400 dark:focus:border-purple-500 resize-none transition-colors"
                />
              </div>

              {/* Ayarlar */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Kaç Görsel
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4].map(n => (
                      <button
                        key={n}
                        onClick={() => setCount(n)}
                        className={`flex-1 py-2 rounded-xl border-2 text-sm font-bold transition-all ${
                          count === n
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-purple-300'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Klasör
                  </label>
                  <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-600 dark:text-slate-400">
                    {designFolders.find(f => f.id === activeDesignFolderId)?.name ?? 'Tüm Tasarımlar'}
                  </div>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-700/40 rounded-xl text-xs text-red-600 dark:text-red-400">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {error}
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Preview ────────────────────────────────────────── */}
          {step === 'preview' && (
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Kaydetmek istediğin görselleri seç. Arka planı kaldırarak şeffaf PNG olarak kaydet.
              </p>

              {/* Preview Grid */}
              <div className="grid grid-cols-2 gap-3">
                {previews.map((preview) => {
                  const displayData = preview.pngData ?? preview.data;
                  const displayMime = preview.pngData ? 'image/png' : preview.mimeType;
                  return (
                    <div
                      key={preview.id}
                      className={`relative rounded-2xl border-2 overflow-hidden cursor-pointer transition-all ${
                        preview.selected
                          ? 'border-purple-500 shadow-md shadow-purple-500/20'
                          : 'border-slate-200 dark:border-slate-700 opacity-60'
                      }`}
                      onClick={() =>
                        setPreviews(prev =>
                          prev.map(p =>
                            p.id === preview.id ? { ...p, selected: !p.selected } : p
                          )
                        )
                      }
                    >
                      {/* Görsel */}
                      <div className="aspect-square relative bg-slate-100 dark:bg-slate-800">
                        {/* Transparan zemin checkerboard */}
                        {preview.bgRemoved && (
                          <div
                            className="absolute inset-0"
                            style={{
                              backgroundImage: 'repeating-conic-gradient(#e2e8f0 0% 25%, #ffffff 0% 50%)',
                              backgroundSize: '16px 16px',
                            }}
                          />
                        )}
                        <img
                          src={`data:${displayMime};base64,${displayData}`}
                          alt="AI Tasarım"
                          className="w-full h-full object-contain relative z-10"
                        />
                      </div>

                      {/* Overlay badge'ler */}
                      {preview.selected && (
                        <div className="absolute top-2 right-2 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center z-20">
                          <CheckCircle2 className="w-3 h-3 text-white" />
                        </div>
                      )}

                      {/* Arka plan durumu */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 z-20">
                        {preview.bgRemoving ? (
                          <span className="flex items-center gap-1 text-[10px] text-white">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Arka plan kaldırılıyor...
                          </span>
                        ) : preview.bgRemoved ? (
                          <span className={`flex items-center gap-1 text-[10px] ${
                            preview.bgQuality === 'good' ? 'text-green-300' :
                            preview.bgQuality === 'warning' ? 'text-amber-300' : 'text-red-300'
                          }`}>
                            <CheckCircle2 className="w-3 h-3" />
                            Şeffaf PNG hazır
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-300">Yeşil arka planlı</span>
                        )}
                      </div>

                      {/* Tek kaldır butonu */}
                      {!preview.bgRemoved && !preview.bgRemoving && (
                        <button
                          onClick={e => { e.stopPropagation(); handleRemoveBg(preview.id); }}
                          className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 bg-black/60 hover:bg-black/80 text-white text-[10px] rounded-lg z-20 transition-colors"
                        >
                          <Eraser className="w-3 h-3" />
                          BG Kaldır
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-700/40 rounded-xl text-xs text-red-600 dark:text-red-400">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 shrink-0">
          {step === 'prompt' ? (
            <>
              <button onClick={handleClose} className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
                İptal
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating || !prompt.trim()}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 transition-all"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Üretiliyor...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Üret {count > 1 ? `(${count} adet)` : ''}
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Tekrar Üret
                </button>
                {previews.some(p => p.selected && !p.bgRemoved) && (
                  <button
                    onClick={handleRemoveAllBg}
                    disabled={anyRemoving}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-700/40 transition-colors disabled:opacity-50"
                  >
                    {anyRemoving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eraser className="w-3.5 h-3.5" />}
                    Tümünün BG'sini Kaldır
                  </button>
                )}
              </div>
              <button
                onClick={handleSave}
                disabled={saving || selectedCount === 0}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 transition-all"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ImagePlus className="w-4 h-4" />
                )}
                {saving ? 'Kaydediliyor...' : `${selectedCount} Tasarımı Kaydet`}
                {bgRemovedCount > 0 && !saving && (
                  <span className="text-[10px] font-normal opacity-80">({bgRemovedCount} şeffaf)</span>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
