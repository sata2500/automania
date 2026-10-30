'use client';

/**
 * Seçili Etsy ilanlarına toplu işlem: "Analiz et" (görsel + etiketlerin Etsy verisi + yapay zekâ değerlendirmesi)
 * veya "Yapay zekâ ile iyileştir" (yalnızca analiz edilmiş ilanlar; öneriler kaydedilir, Etsy'ye gönderilmez).
 */
import { getErrorMessage } from '@/lib/errors';
import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Sparkles, TrendingUp, X } from 'lucide-react';
import { useToast } from '@/components/common/ToastContext';
import type { StoredEtsyListing } from '@/types/etsy';
import { DialogPanel } from '@/components/common/DialogPanel';
import { Spinner } from '@/components/common/Spinner';

export type BulkActionType = 'analyze' | 'optimize';

interface BulkActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionType: BulkActionType;
  selectedListings: StoredEtsyListing[];
  onCompleted: () => void;
}

/** Analiz bir istekte en fazla 5 ilan alır; iyileştirme tek tek (her biri 1-2 dk). */
const CHUNK_SIZE: Record<BulkActionType, number> = { analyze: 5, optimize: 1 };

const COPY: Record<BulkActionType, { title: string; description: string; icon: React.ReactNode }> = {
  analyze: {
    title: 'Analiz et',
    description: 'Her ilanın kapak görseli yapay zekâyla analiz edilir, etiketleri Etsy\'den puanlanır ve başlık, etiket ve açıklama değerlendirilir. Sonunda her ilanın tam SEO puanı görünür (ilan başına yaklaşık 30-60 sn).',
    icon: <TrendingUp className="w-5 h-5" />,
  },
  optimize: {
    title: 'Yapay zekâ ile iyileştir',
    description: 'Analiz edilmiş ilanlar için sırayla yeni başlık, etiket ve açıklama önerisi hazırlanır ve puanlanır (ilan başına 1-2 dk). Etsy\'ye hiçbir şey gönderilmez: önerileri ilan penceresinde inceleyip onaylarsınız.',
    icon: <Sparkles className="w-5 h-5" />,
  },
};

export const BulkActionModal: React.FC<BulkActionModalProps> = ({ isOpen, onClose, actionType, selectedListings, onCompleted }) => {
  const { success, error, warning } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStepText, setCurrentStepText] = useState('');
  const [processedCount, setProcessedCount] = useState(0);
  const [errorLogs, setErrorLogs] = useState<string[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const cancelRef = useRef(false);

  // Yalnızca pencere açılırken sıfırlanır (süren işlemin ilerlemesi yeniden çizimlerde kaybolmasın).
  useEffect(() => {
    if (!isOpen) return;
    setIsProcessing(false);
    setProgress(0);
    setProcessedCount(0);
    setErrorLogs([]);
    setIsFinished(false);
    cancelRef.current = false;
  }, [isOpen]);

  if (!isOpen) return null;

  const targets = actionType === 'optimize' ? selectedListings.filter((l) => l.ai_analyzed) : selectedListings;
  const skipped = selectedListings.length - targets.length;
  const copy = COPY[actionType];

  const handleStart = async () => {
    if (targets.length === 0) {
      warning('İşlenecek ilan yok.');
      return;
    }
    setIsProcessing(true);
    setProgress(0);
    setProcessedCount(0);
    setErrorLogs([]);
    setIsFinished(false);
    cancelRef.current = false;

    let completed = 0;
    const errors: string[] = [];
    let stoppedReason: string | null = null;
    const chunkSize = CHUNK_SIZE[actionType];

    for (let i = 0; i < targets.length; i += chunkSize) {
      if (cancelRef.current) {
        stoppedReason = `İşlem durduruldu; ${targets.length - i} ilan işlenmedi.`;
        break;
      }
      const chunk = targets.slice(i, i + chunkSize);
      setCurrentStepText(`İşleniyor: ${i + 1}${chunk.length > 1 ? `-${i + chunk.length}` : ''} / ${targets.length}…`);
      try {
        const res = await fetch(actionType === 'analyze' ? '/api/etsy/listings/analyze' : '/api/etsy/listings/optimize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(actionType === 'analyze' ? { listingIds: chunk.map((c) => c.listing_id) } : { listingId: chunk[0]!.listing_id }),
        });
        if (res.status === 429) {
          const minutes = Math.max(1, Math.ceil((Number(res.headers.get('Retry-After')) || 0) / 60));
          stoppedReason = `İstek sınırına ulaşıldı; ${targets.length - i} ilan işlenmedi. Yaklaşık ${minutes} dakika sonra kalanlar için tekrar çalıştırın.`;
          break;
        }
        const data = await res.json();
        const itemErrors: string[] = Array.isArray(data.errors) ? data.errors : [];
        if (!data.success && itemErrors.length === 0) itemErrors.push(data.error || 'Bilinmeyen hata');
        errors.push(...itemErrors);
        completed += Math.max(0, chunk.length - itemErrors.length);
      } catch (err) {
        errors.push(`Ağ hatası: ${getErrorMessage(err)}`);
      }
      setProcessedCount(completed);
      setProgress(Math.round(((i + chunk.length) / targets.length) * 100));
    }

    setIsProcessing(false);
    setIsFinished(true);
    if (stoppedReason) errors.unshift(stoppedReason);
    setErrorLogs(errors);
    if (stoppedReason) warning(`${stoppedReason} (${completed}/${targets.length} tamamlandı)`);
    else if (completed === 0) error(`İşlem başarısız oldu (0/${targets.length}). Ayrıntılar pencerede.`);
    else if (errors.length > 0) warning(`Kısmen tamamlandı (${completed}/${targets.length}).`);
    else success(`${copy.title}: ${completed} ilan tamamlandı.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <DialogPanel aria-labelledby="bulk-action-title" onClose={isProcessing ? undefined : onClose} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">{copy.icon}</div>
          <h3 id="bulk-action-title" className="flex-1 text-sm font-bold text-slate-900 dark:text-white">
            {copy.title} · {targets.length} ilan
          </h3>
          <button type="button" onClick={onClose} disabled={isProcessing} aria-label="Kapat" className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg disabled:opacity-40">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{copy.description}</p>
          {skipped > 0 && !isFinished && (
            <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5">
              {skipped} ilan henüz analiz edilmediği için atlanacak. Önce onları analiz edin.
            </p>
          )}

          {(isProcessing || isFinished) && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-700 dark:text-slate-300 font-bold flex items-center gap-2">
                  {isProcessing ? <Spinner className="w-4 h-4 text-indigo-500" /> : <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                  {isFinished ? 'Tamamlandı' : currentStepText}
                </span>
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">%{progress}</span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-[11px] text-slate-500">İşlenen: {processedCount} / {targets.length}{errorLogs.length > 0 ? ` · ${errorLogs.length} hata` : ''}</p>
              {errorLogs.length > 0 && (
                <ul className="p-2 bg-rose-500/10 rounded-lg border border-rose-500/20 max-h-24 overflow-y-auto text-[11px] text-rose-700 dark:text-rose-300 space-y-1">
                  {errorLogs.map((err, i) => <li key={i}>• {err}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
          {!isProcessing && !isFinished && (
            <>
              <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl">İptal</button>
              <button type="button" onClick={handleStart} disabled={targets.length === 0} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl disabled:opacity-50">
                Başlat ({targets.length})
              </button>
            </>
          )}
          {isProcessing && (
            <button type="button" onClick={() => { cancelRef.current = true; }} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl">
              Durdur
            </button>
          )}
          {isFinished && (
            <button type="button" onClick={() => { onCompleted(); onClose(); }} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl">
              Tamam
            </button>
          )}
        </div>
      </DialogPanel>
    </div>
  );
};
