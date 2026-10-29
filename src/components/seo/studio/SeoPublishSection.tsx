'use client';
import React, { useMemo, useRef, useState } from 'react';
import { AlertTriangle, ShieldCheck, Send, ListChecks, CheckCircle, XCircle, ExternalLink, CircleAlert } from 'lucide-react';
import { buildPublishChecklist } from '@/lib/etsy-preflight';
import { LIVE_PUBLISH_CONFIRMATION, isLivePublishEnabled } from '@/lib/etsy-publish-mode';
import { EtsySerpPreview } from '../components/EtsySerpPreview';
import { useEtsySeo } from '../context/EtsySeoContext';
import { Spinner } from '@/components/common/Spinner';
import { openListingsView } from '@/components/listings/listings-view';

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
    selectedReadinessStateId,
    generatedDescription,
    selectedTags,
    taxonomyId,
    whoMade,
    whenMade,
    isSupply,
    isPublishing,
    handlePublishToEtsy,
    handleSaveToReview,
    isSavingToReview,
    publishResult,
    duplicatePublish,
    setDuplicatePublish,
  } = useEtsySeo();

  // Mükerrer uyarısından sonra "yine de oluştur" denirse aynı istek tekrarlanır.
  type PublishArgs = Parameters<typeof handlePublishToEtsy>;
  const lastPublishArgsRef = useRef<PublishArgs>(['draft']);
  const publish = (...args: PublishArgs) => {
    lastPublishArgsRef.current = args;
    return handlePublishToEtsy(...args);
  };

  const result = publishResult as null | {
    success?: boolean;
    simulated?: boolean;
    partial?: boolean;
    listingId?: string | number;
    listingUrl?: string;
    state?: string;
    message?: string;
    error?: string;
    imagesUploaded?: number;
    imagesRequested?: number;
    uploadErrors?: string[];
  };

  const [isLiveConfirmOpen, setIsLiveConfirmOpen] = useState(false);
  const [liveConfirmationPhrase, setLiveConfirmationPhrase] = useState('');
  const livePublishEnabled = isLivePublishEnabled(process.env.NEXT_PUBLIC_ETSY_LIVE_PUBLISH_ENABLED);

  const mockupPreviews = dbGeneratedMockups as MockupPreview[];
  const previewImage = mockupPreviews.find(
    (m) => m.folderId === selectedFolderId && !m.isVideo
  )?.previewUrl || null;

  const checklist = useMemo(() => buildPublishChecklist({
    title: generatedTitle,
    description: generatedDescription,
    tags: selectedTags,
    taxonomyId,
    shippingProfileId: selectedShippingProfileId,
    readinessStateId: selectedReadinessStateId,
    media: mockupPreviews.filter((m) => m.folderId === selectedFolderId && m.previewUrl),
    whoMade,
    whenMade,
    isSupply,
  }), [generatedTitle, generatedDescription, selectedTags, taxonomyId, selectedShippingProfileId, selectedReadinessStateId, mockupPreviews, selectedFolderId, whoMade, whenMade, isSupply]);
  const blockingCount = checklist.filter((item) => item.status === 'error').length;
  const canPublish = !isPublishing && blockingCount === 0;

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
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition-colors shrink-0 shadow-sm"
            >
              Etsy Mağazamı Bağla
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <button
                type="button"
                onClick={async () => {
                  if (await handleSaveToReview()) openListingsView('review');
                }}
                disabled={!canPublish || isSavingToReview}
                className="w-full px-5 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSavingToReview ? <Spinner className="w-4 h-4" /> : <ListChecks className="w-4 h-4" />}
                Hazır İlanlar&apos;a Ekle
              </button>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
                {blockingCount > 0
                  ? `Eklemeden önce ${blockingCount} eksik alanı tamamlayın (aşağıdaki kontrol listesi).`
                  : 'İlan Hazır İlanlar\'da bekler; oradan hemen yayınlar veya zamanlarsınız.'}
              </p>

              {/* Doğrudan Etsy'ye gönderim: kuyruğu atlamak isteyenler için ikincil seçenek */}
              <details className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <summary className="cursor-pointer select-none list-none px-3.5 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-500" /> Doğrudan Etsy&apos;ye gönder</span>
                  <span className="text-slate-400 group-open:rotate-180 transition-transform">▾</span>
                </summary>
                <div className="px-3.5 pb-3.5 space-y-2">
                  <div className="flex w-full flex-col sm:flex-row gap-2">
                    <button
                      onClick={() => publish('draft')}
                      disabled={!canPublish}
                      className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isPublishing ? <Spinner className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                      Etsy’ye Taslak Gönder
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsLiveConfirmOpen(true)}
                      disabled={!canPublish || !livePublishEnabled}
                      className="w-full sm:w-auto px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      title={!livePublishEnabled ? 'Canlı yayınlama sunucu ayarıyla kapalı.' : 'Etsy’de canlı yayınlama onayını aç'}
                    >
                      <Send className="w-3.5 h-3.5" />
                      Etsy’de Canlı Yayınla
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    {!livePublishEnabled
                      ? 'Canlı yayınlama bu ortamda güvenlik amacıyla kapalıdır.'
                      : 'Canlı yayınlama yalnızca açık onay ve son bir kontrol sonrasında yapılır.'}
                  </p>
                </div>
              </details>
            </div>
          </div>
        )}

        {etsyConnected && (
          <ul aria-label="Yayın ön kontrolü" className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
            {checklist.map((item) => (
              <li
                key={item.id}
                className={`flex items-start gap-1.5 rounded-lg border px-2.5 py-1.5 ${
                  item.status === 'error'
                    ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300'
                    : item.status === 'warning'
                      ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200'
                      : 'border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
                }`}
              >
                {item.status === 'ok'
                  ? <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-px text-emerald-500" aria-label="Tamam" />
                  : item.status === 'warning'
                    ? <CircleAlert className="w-3.5 h-3.5 shrink-0 mt-px" aria-label="Uyarı" />
                    : <XCircle className="w-3.5 h-3.5 shrink-0 mt-px" aria-label="Eksik" />}
                <span className="min-w-0"><strong>{item.label}:</strong> {item.detail}</span>
              </li>
            ))}
          </ul>
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
                    disabled={!canPublish || liveConfirmationPhrase !== LIVE_PUBLISH_CONFIRMATION}
                    onClick={async () => {
                      await publish('active', {
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

        {/* Mükerrer ilan uyarısı */}
        {duplicatePublish && (
          <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs dark:border-amber-800 dark:bg-amber-950/30">
            <p className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Bu klasör zaten Etsy&apos;ye aktarıldı
            </p>
            <p className="mt-1 text-amber-800 dark:text-amber-300">
              {new Date(duplicatePublish.at).toLocaleString('tr-TR')} tarihinde #{duplicatePublish.listingId} numaralı ilan ({duplicatePublish.state === 'active' ? 'yayında' : 'taslak'}) olarak oluşturuldu. Yeniden aktarmak mağazanızda ikinci bir ilan açar.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {duplicatePublish.listingUrl && (
                <a href={duplicatePublish.listingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-amber-300 px-3 py-1.5 font-semibold text-amber-900 dark:border-amber-700 dark:text-amber-200">
                  <ExternalLink className="w-3.5 h-3.5" /> Mevcut ilanı aç
                </a>
              )}
              <button type="button" onClick={() => setDuplicatePublish(null)} className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                Vazgeç
              </button>
              <button
                type="button"
                onClick={() => {
                  const [state, confirmation] = lastPublishArgsRef.current;
                  void handlePublishToEtsy(state, confirmation, { allowDuplicate: true });
                }}
                className="rounded-lg bg-amber-600 px-3 py-1.5 font-bold text-white hover:bg-amber-500"
              >
                Yine de yeni ilan oluştur
              </button>
            </div>
          </div>
        )}

        {/* Yayın sonucu */}
        {result && (
          <div
            role="status"
            className={`rounded-xl border p-4 text-xs space-y-2 ${
              !result.success
                ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300'
                : result.partial
                  ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200'
            }`}
          >
            <p className="font-bold flex items-center gap-1.5">
              {!result.success ? <XCircle className="w-4 h-4 shrink-0" /> : result.partial ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle className="w-4 h-4 shrink-0" />}
              {!result.success
                ? (result.listingId ? 'İlan taslak olarak oluşturuldu, ancak işlem tamamlanamadı' : 'İlan oluşturulamadı')
                : result.simulated
                  ? 'Önizleme hazır (Etsy bağlantısı yok)'
                  : result.partial
                    ? 'İlan taslak olarak oluşturuldu — bazı adımlar eksik'
                    : result.state === 'active' ? 'İlan yayında' : 'İlan taslak olarak oluşturuldu'}
            </p>
            <p>{result.success ? result.message : result.error}</p>
            {typeof result.imagesRequested === 'number' && (
              <p>Görseller: {result.imagesUploaded ?? 0}/{result.imagesRequested} yüklendi</p>
            )}
            {result.uploadErrors && result.uploadErrors.length > 0 && (
              <ul className="list-disc pl-5 space-y-0.5">
                {result.uploadErrors.map((message, index) => <li key={index}>{message}</li>)}
              </ul>
            )}
            {result.listingId && (
              <a
                href={result.listingUrl || `https://www.etsy.com/your/shops/me/listing-editor/edit/${result.listingId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold underline"
              >
                <ExternalLink className="w-3.5 h-3.5" /> İlanı Etsy&apos;de aç (#{result.listingId})
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
