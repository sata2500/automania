'use client';
import React, { useState } from 'react';
import { AlertTriangle, ShieldCheck, Send, CheckCircle } from 'lucide-react';
import { LIVE_PUBLISH_CONFIRMATION, isLivePublishEnabled } from '@/lib/etsy-publish-mode';
import { EtsySerpPreview } from '../components/EtsySerpPreview';
import { useEtsySeo } from '../context/EtsySeoContext';

type MockupPreview = {
  folderId?: string;
  isVideo?: boolean;
  previewUrl?: string;
};

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

  const [isLiveConfirmOpen, setIsLiveConfirmOpen] = useState(false);
  const [liveConfirmationPhrase, setLiveConfirmationPhrase] = useState('');
  const livePublishEnabled = isLivePublishEnabled(process.env.NEXT_PUBLIC_ETSY_LIVE_PUBLISH_ENABLED);

  const mockupPreviews = dbGeneratedMockups as MockupPreview[];
  const previewImage = mockupPreviews.find(
    (m) => m.folderId === selectedFolderId && !m.isVideo
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

              <div className="flex w-full sm:w-auto flex-col gap-2">
                <div className="flex w-full flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => handlePublishToEtsy('draft')}
                    disabled={isPublishing || !selectedShippingProfileId}
                    className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Send className={`w-3.5 h-3.5 ${isPublishing ? 'animate-spin' : ''}`} />
                    Taslak (Draft) Olarak Aktar
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsLiveConfirmOpen(true)}
                    disabled={isPublishing || !selectedShippingProfileId || !livePublishEnabled}
                    className="w-full sm:w-auto px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    title={!livePublishEnabled ? 'Canlı yayınlama sunucu ayarıyla kapalı.' : 'Etsy’de canlı yayınlama onayını aç'}
                  >
                    <Send className="w-3.5 h-3.5" />
                    Etsy’de Canlı Yayınla
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 sm:text-right">
                  {!livePublishEnabled
                    ? 'Canlı yayınlama bu ortamda güvenlik amacıyla kapalıdır.'
                    : 'Canlı yayınlama yalnızca açık onay ve son bir kontrol sonrasında yapılır.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {isLiveConfirmOpen && livePublishEnabled && (
          <div className="rounded-xl border border-orange-300 bg-orange-50 p-4 dark:border-orange-900 dark:bg-orange-950/30" role="dialog" aria-modal="true" aria-labelledby="live-publish-title">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <h4 id="live-publish-title" className="text-sm font-bold text-orange-900 dark:text-orange-200">Etsy’de canlı yayınlamayı onayla</h4>
                  <p className="mt-1 text-xs leading-5 text-orange-800 dark:text-orange-300">
                    Bu işlem listing’i Etsy mağazanızda görünür hale getirmek için create-draft, görsel/envanter yükleme ve sonrasında active state güncellemesi yapar. Taslak seçeneği güvenli varsayılan olarak kalır.
                  </p>
                </div>
                <div className="rounded-lg border border-orange-200 bg-white/70 p-3 text-xs dark:border-orange-900 dark:bg-slate-950/40">
                  <p><strong>Başlık:</strong> {generatedTitle || 'Üretilen başlık yok'}</p>
                  <p><strong>Fiyat:</strong> {basePrice || 24.99}</p>
                  <p><strong>Görsel:</strong> {mockupPreviews.filter((m) => m.folderId === selectedFolderId && !m.isVideo && m.previewUrl).length}</p>
                </div>
                <label className="block text-xs font-semibold text-orange-900 dark:text-orange-200" htmlFor="live-publish-confirmation">
                  Devam etmek için <span className="font-mono">{LIVE_PUBLISH_CONFIRMATION}</span> yazın.
                </label>
                <input
                  id="live-publish-confirmation"
                  value={liveConfirmationPhrase}
                  onChange={(event) => setLiveConfirmationPhrase(event.target.value.toUpperCase())}
                  placeholder={LIVE_PUBLISH_CONFIRMATION}
                  autoComplete="off"
                  className="w-full rounded-lg border border-orange-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-orange-500 focus:ring-2 dark:border-orange-800 dark:bg-slate-950 dark:text-white"
                />
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => { setIsLiveConfirmOpen(false); setLiveConfirmationPhrase(''); }}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="button"
                    disabled={isPublishing || liveConfirmationPhrase !== LIVE_PUBLISH_CONFIRMATION}
                    onClick={async () => {
                      await handlePublishToEtsy('active', {
                        confirmLivePublish: true,
                        confirmationPhrase: liveConfirmationPhrase,
                      });
                      setIsLiveConfirmOpen(false);
                      setLiveConfirmationPhrase('');
                    }}
                    className="rounded-lg bg-orange-600 px-4 py-2 text-xs font-bold text-white hover:bg-orange-700 disabled:opacity-50"
                  >
                    {isPublishing ? 'Yayınlanıyor...' : 'Canlı Yayınlamayı Onayla'}
                  </button>
                </div>
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
