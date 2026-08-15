'use client';
import React from 'react';
import { ShoppingBag, CheckCircle, RefreshCw, Send, AlertTriangle, X } from 'lucide-react';
import { useEtsySeo } from '../context/EtsySeoContext';

export const VariationModals: React.FC = () => {
  const {
    showListingsModal,
    setShowListingsModal,
    etsyListings,
    handleSelectListingTemplate,
    isFetchingInventory,
    isSaveTemplateModalOpen,
    setIsSaveTemplateModalOpen,
    templateSaveName,
    setTemplateSaveName,
    handleSaveCurrentTemplate,
    isSavingTemplate,
    variations,
    isLoadTemplateModalOpen,
    setIsLoadTemplateModalOpen,
    savedTemplates,
    handleDeleteTemplate,
    handleLoadTemplate,
    isBulkSyncModalOpen,
    setIsBulkSyncModalOpen,
    selectedTemplateForSync,
    setSelectedTemplateForSync,
    selectedListingsForSync,
    setSelectedListingsForSync,
    isSyncing,
    handleBulkSync,
    isFetchingListings,
  } = useEtsySeo();

  return (
    <>
      {/* 1. Etsy Listings Modal (Şablon Seçimi) */}
      {showListingsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
              <h3 className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                <ShoppingBag className="w-4 h-4 text-emerald-500" />
                Etsy Mağazanızdaki İlanlar (Şablon Seçimi)
              </h3>
              <button 
                type="button"
                onClick={() => setShowListingsModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1 bg-slate-50/50 dark:bg-slate-900/50 scrollbar-thin">
              {etsyListings.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-sm">
                  Mağazanızda henüz aktif veya taslak ilan bulunmuyor.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {etsyListings.map((listing: any) => (
                    <div key={listing.listing_id} className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col justify-between transition-shadow hover:shadow-md">
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-2 mb-2">
                          {listing.title}
                        </div>
                        <div className="flex gap-2 text-[10px] mb-3">
                          <span className={`px-2 py-0.5 rounded-full font-bold ${listing.state === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                            {listing.state.toUpperCase()}
                          </span>
                          <span className="text-slate-500">ID: {listing.listing_id}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSelectListingTemplate(listing.listing_id)}
                        disabled={isFetchingInventory}
                        className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        {isFetchingInventory ? 'Varyasyonlar Çekiliyor...' : 'Bu İlanın Varyasyonlarını Şablon Yap'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. Save Template Modal */}
      {isSaveTemplateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/50 rounded-t-2xl">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-sm">
                <CheckCircle className="w-5 h-5 text-indigo-500" />
                Yeni Şablon Olarak Kaydet
              </h3>
              <button 
                type="button"
                onClick={() => setIsSaveTemplateModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Şablon Adı</label>
                <input
                  type="text"
                  value={templateSaveName}
                  onChange={e => setTemplateSaveName(e.target.value)}
                  placeholder="Örn: Kışlık Tişört Fiyatları"
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  autoFocus
                />
              </div>
              <p className="text-xs text-slate-500">Mevcut tabloda bulunan {variations.length} varyasyon bu isimle kaydedilecektir.</p>
              <button
                type="button"
                onClick={handleSaveCurrentTemplate}
                disabled={isSavingTemplate}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50 text-sm shadow-md"
              >
                {isSavingTemplate ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Load Template Modal */}
      {isLoadTemplateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/50 rounded-t-2xl">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-sm">
                <RefreshCw className="w-5 h-5 text-indigo-500" />
                Kayıtlı Şablonlarınız
              </h3>
              <button 
                type="button"
                onClick={() => setIsLoadTemplateModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh] scrollbar-thin">
              {savedTemplates.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm font-semibold">
                  Henüz kaydedilmiş bir şablonunuz bulunmuyor.
                </div>
              ) : (
                <div className="space-y-3">
                  {savedTemplates.map((t: any) => (
                    <div key={t.id} className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex justify-between items-center bg-slate-50 dark:bg-slate-950/30 gap-2">
                      <div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">{t.name}</h4>
                        <p className="text-xs text-slate-500 mt-1">{t.variations?.length || 0} Varyasyon • {new Date(t.updatedAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleDeleteTemplate(t.id)}
                          className="px-2.5 py-1.5 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold transition-colors"
                        >
                          Sil
                        </button>
                        <button
                          type="button"
                          onClick={() => handleLoadTemplate(t)}
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
                        >
                          Yükle
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. Bulk Sync Modal */}
      {isBulkSyncModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/50 rounded-t-2xl">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-sm">
                <Send className="w-5 h-5 text-emerald-500" />
                Etsy İlanlarına Uygula
              </h3>
              <button 
                type="button"
                onClick={() => setIsBulkSyncModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 scrollbar-thin">
              <div className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-400 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/50 text-xs font-medium flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <p>Aşağıdan seçtiğiniz ilanların mevcut varyasyonları <strong>tamamen silinecek</strong> ve seçtiğiniz şablondaki varyasyonlar ile değiştirilecektir. Bu işlem geri alınamaz.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Uygulanacak Şablon
                </label>
                <select
                  value={selectedTemplateForSync}
                  onChange={(e) => setSelectedTemplateForSync(e.target.value)}
                  className="w-full text-sm border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 focus:ring-emerald-500 focus:border-emerald-500 px-3 py-2.5 transition-colors"
                >
                  <option value="current">Mevcut Tablodaki Varyasyonlar ({variations.length} varyasyon)</option>
                  {savedTemplates.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.variations?.length || 0} varyasyon)
                    </option>
                  ))}
                </select>
              </div>

              {isFetchingListings ? (
                <div className="text-center py-8 text-slate-500 text-sm font-semibold flex flex-col items-center">
                  <RefreshCw className="w-6 h-6 animate-spin text-emerald-500 mb-2" />
                  İlanlarınız Yükleniyor...
                </div>
              ) : etsyListings.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm font-semibold">
                  Etsy hesabınızda uygun ilan bulunamadı.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">İlan Seçimi ({selectedListingsForSync.length} Seçili)</span>
                    <button 
                      type="button"
                      onClick={() => {
                        if (selectedListingsForSync.length === etsyListings.length) setSelectedListingsForSync([]);
                        else setSelectedListingsForSync(etsyListings.map((l: any) => l.listing_id));
                      }}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
                    >
                      {selectedListingsForSync.length === etsyListings.length ? 'Tümünü Kaldır' : 'Tümünü Seç'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
                    {etsyListings.map((listing: any) => (
                      <label key={listing.listing_id} className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${selectedListingsForSync.includes(listing.listing_id) ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50'}`}>
                        <input
                          type="checkbox"
                          checked={selectedListingsForSync.includes(listing.listing_id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedListingsForSync((prev: any[]) => [...prev, listing.listing_id]);
                            else setSelectedListingsForSync((prev: any[]) => prev.filter((id: any) => id !== listing.listing_id));
                          }}
                          className="mt-1 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-600 focus:ring-2"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate" title={listing.title}>{listing.title}</p>
                          <div className="flex gap-2 text-[10px] mt-1 text-slate-500">
                            <span className="uppercase">{listing.state}</span>
                            <span>ID: {listing.listing_id}</span>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 rounded-b-2xl">
              <button
                type="button"
                onClick={handleBulkSync}
                disabled={isSyncing || selectedListingsForSync.length === 0}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm shadow-sm"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Güncelleniyor... Lütfen bekleyin
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    {selectedListingsForSync.length} İlanı Güncelle
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
