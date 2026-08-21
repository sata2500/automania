'use client';
import React from 'react';
import { AlertTriangle, ShieldCheck, Send, CheckCircle } from 'lucide-react';
import { EtsySerpPreview } from '../components/EtsySerpPreview';
import { useEtsySeo } from '../context/EtsySeoContext';

export const SeoPublishSection: React.FC = () => {
  const {
    generatedTitle,
    dbGeneratedMockups,
    selectedFolderId,
    basePrice,
    etsyConnected,
    selectedShippingProfileId,
    isPublishing,
    handlePublishToEtsy,
    publishResult,
  } = useEtsySeo();

  const previewImage = dbGeneratedMockups.find(
    (m: any) => m.folderId === selectedFolderId && !m.isVideo
  )?.previewUrl || null;

  return (
    <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-5 shadow-sm">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-xs flex items-center justify-center font-bold">5</span>
            Etsy SERP Arama Önizlemesi & Taslak Yayınlama
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            İlanınızın Etsy masaüstü ve mobil arama sonuçlarında nasıl görüneceğini test edin ve tek tıkla mağazanıza aktarın.
          </p>
        </div>
      </div>

      {/* Live Etsy SERP Search Preview Card (Mobile/Desktop) */}
      <EtsySerpPreview
        title={generatedTitle}
        imageUrl={previewImage}
        price={basePrice || 24.99}
      />

      {/* Publishing Actions Card */}
      <div className="bg-slate-50 dark:bg-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
        {!etsyConnected ? (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="space-y-1">
              <p className="text-sm font-bold text-amber-800 dark:text-amber-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Etsy Mağazanız Henüz Bağlı Değil
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-500">
                Otomatik ilan oluşturup yayınlayabilmek için Etsy mağaza yetkilendirmesi gereklidir.
              </p>
            </div>
            <a 
              href="/api/etsy/auth?returnUrl=/"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition-colors shrink-0 shadow-sm"
            >
              Etsy Mağazamı Bağla
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  Etsy Mağaza Bağlantısı Aktif & Yayına Hazır
                </h4>
                <p className="text-[11px] text-slate-500">
                  Oluşturulan başlık, açıklama, 13 etiket, mockuplar ve varyasyonlar tek tıkla mağazanıza aktarılır.
                </p>
              </div>

              <div className="flex w-full sm:w-auto">
                <button
                  onClick={() => handlePublishToEtsy('draft')}
                  disabled={isPublishing || !selectedShippingProfileId}
                  className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Send className={`w-3.5 h-3.5 ${isPublishing ? 'animate-spin' : ''}`} />
                  Taslak (Draft) Olarak Aktar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Publish Result Output */}
        {publishResult && (
          <div className="mt-4 bg-slate-950 text-slate-100 p-4 rounded-xl font-mono text-xs overflow-x-auto space-y-2 border border-slate-800">
            <div className="text-emerald-400 font-bold flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" />
              ETSY API YAYINLAMA RAPORU
            </div>
            <pre className="text-[11px] whitespace-pre-wrap">{JSON.stringify(publishResult, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
};
