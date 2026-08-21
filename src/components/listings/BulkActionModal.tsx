'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Eye,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useToast } from '@/components/common/ToastContext';

export type BulkActionType = 'vision' | 'evaluate_seo' | 'optimize';

interface BulkActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionType: BulkActionType;
  selectedListings: any[];
  allListings: any[];
  onCompleted: () => void;
}

export const BulkActionModal: React.FC<BulkActionModalProps> = ({
  isOpen,
  onClose,
  actionType,
  selectedListings,
  allListings,
  onCompleted
}) => {
  const { success, error, warning } = useToast();
  const [scope, setScope] = useState<'selected' | 'all'>('selected');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStepText, setCurrentStepText] = useState('');
  const [processedCount, setProcessedCount] = useState(0);
  const [errorLogs, setErrorLogs] = useState<string[]>([]);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    if (selectedListings.length === 0) {
      setScope('all');
    } else {
      setScope('selected');
    }
    setIsProcessing(false);
    setProgress(0);
    setProcessedCount(0);
    setErrorLogs([]);
    setIsFinished(false);
  }, [isOpen, selectedListings]);

  if (!isOpen) return null;

  const targetListings = scope === 'selected' ? selectedListings : allListings;
  const totalItems = targetListings.length;

  const getActionTitle = () => {
    if (actionType === 'vision') return '👁️ Toplu Görsel (Vision AI) Analizi';
    if (actionType === 'evaluate_seo') return '📊 Toplu SEO Değerlendirme & Skorlama';
    if (actionType === 'optimize') return '🪄 Toplu AI SEO Optimizasyonu';
    return 'Toplu İşlem';
  };

  const getActionDescription = () => {
    if (actionType === 'vision') {
      return 'Seçili ilanların kapak fotoğraflarını Admin panelinde yapılandırılan Vision AI modeli ile tek tek analiz eder; konu, estetik ve renk verilerini kaydeder.';
    }
    if (actionType === 'evaluate_seo') {
      return 'Seçili ilanların başlık, 13 etiket ve açıklamalarını Kelime Havuzu metriği ve SEO kurallarına göre 0-100 arasında yeniden puanlar.';
    }
    if (actionType === 'optimize') {
      return 'Seçili ilanlar için SEO/Reasoning AI modelini kullanarak optimize 140 karakterlik başlık, 13 altın etiket ve dönüşüm odaklı açıklama üretir.';
    }
    return '';
  };

  const handleStartProcess = async () => {
    if (totalItems === 0) {
      warning('İşlem yapılacak ilan bulunamadı.');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setProcessedCount(0);
    setErrorLogs([]);
    setIsFinished(false);

    let completed = 0;
    const errors: string[] = [];

    // Process sequentially or in small chunks of 2 to avoid timeout/rate limits
    const chunkSize = actionType === 'vision' ? 1 : actionType === 'optimize' ? 1 : 10;
    
    for (let i = 0; i < targetListings.length; i += chunkSize) {
      const chunk = targetListings.slice(i, i + chunkSize);
      const chunkIds = chunk.map(c => c.listing_id);

      setCurrentStepText(`İşleniyor: ${i + 1} - ${Math.min(i + chunkSize, targetListings.length)} / ${targetListings.length}...`);

      try {
        let endpoint = '';
        const body: any = { listingIds: chunkIds };

        if (actionType === 'vision') {
          endpoint = '/api/etsy/listings/analyze-vision';
        } else if (actionType === 'evaluate_seo') {
          endpoint = '/api/etsy/listings/evaluate-seo';
        } else if (actionType === 'optimize') {
          endpoint = '/api/etsy/listings/optimize';
        }

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        const data = await res.json();
        if (!data.success) {
          errors.push(`Hata: ${data.error || 'Bilinmeyen hata'}`);
        } else {
          completed += chunk.length;
          if (data.errors && Array.isArray(data.errors)) {
            errors.push(...data.errors);
          }
        }
      } catch (err: any) {
        errors.push(`Ağ Hatası: ${err.message}`);
      }

      setProcessedCount(completed);
      setProgress(Math.round(((i + chunk.length) / targetListings.length) * 100));

      // Small throttle
      await new Promise(r => setTimeout(r, 200));
    }

    setIsProcessing(false);
    setIsFinished(true);
    setErrorLogs(errors);
    setProgress(100);
    success(`Toplu işlem tamamlandı! (${completed}/${targetListings.length})`);
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
              {actionType === 'vision' && <Eye className="w-5 h-5" />}
              {actionType === 'evaluate_seo' && <TrendingUp className="w-5 h-5" />}
              {actionType === 'optimize' && <Sparkles className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">
                {getActionTitle()}
              </h3>
              <p className="text-xs text-slate-400">
                Toplu İlan İşleme Asistanı
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-2 text-slate-400 hover:text-white rounded-lg bg-slate-800/60 hover:bg-slate-800 transition-colors disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-300 leading-relaxed">
            {getActionDescription()}
          </p>

          {/* Scope Selector */}
          {!isProcessing && !isFinished && (
            <div className="space-y-2 pt-2">
              <label className="text-xs font-bold text-slate-300">İşlem Kapsamı:</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setScope('selected')}
                  disabled={selectedListings.length === 0}
                  className={`p-3 rounded-xl border text-xs font-bold text-left transition-all ${
                    scope === 'selected'
                      ? 'bg-purple-600/20 border-purple-500 text-white shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  } ${selectedListings.length === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <div>Seçili İlanlar</div>
                  <div className="text-[11px] font-normal text-purple-300 mt-0.5">
                    {selectedListings.length} ilan seçildi
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setScope('all')}
                  className={`p-3 rounded-xl border text-xs font-bold text-left transition-all ${
                    scope === 'all'
                      ? 'bg-purple-600/20 border-purple-500 text-white shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div>Tüm İlanlar</div>
                  <div className="text-[11px] font-normal text-purple-300 mt-0.5">
                    Toplam {allListings.length} ilan
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Progress Box */}
          {(isProcessing || isFinished) && (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-bold flex items-center gap-2">
                  {isProcessing && <Loader2 className="w-4 h-4 animate-spin text-purple-400" />}
                  {isFinished && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  <span>{isFinished ? 'İşlem Tamamlandı' : currentStepText}</span>
                </span>
                <span className="font-mono text-purple-400 font-bold">%{progress}</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="text-[11px] text-slate-400 flex justify-between">
                <span>İşlenen: {processedCount} / {totalItems}</span>
                {errorLogs.length > 0 && (
                  <span className="text-rose-400 font-bold">{errorLogs.length} hata</span>
                )}
              </div>

              {errorLogs.length > 0 && (
                <div className="p-2 bg-rose-500/10 rounded-lg border border-rose-500/20 max-h-24 overflow-y-auto">
                  <ul className="text-[11px] text-rose-300 space-y-1">
                    {errorLogs.map((err, i) => (
                      <li key={i}>• {err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-end gap-2 bg-slate-950/70">
          {!isProcessing && !isFinished && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
              >
                İptal
              </button>

              <button
                onClick={handleStartProcess}
                disabled={totalItems === 0}
                className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <span>İşlemi Başlat ({totalItems} İlan)</span>
              </button>
            </>
          )}

          {isFinished && (
            <button
              onClick={() => {
                onCompleted();
                onClose();
              }}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
            >
              Tamamla & Listeyi Yenile
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
