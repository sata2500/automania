// @ts-nocheck
'use client';
import React from 'react';
import { Tag, Copy, Sparkles, Check, FileText, ShoppingBag, Layers, DollarSign, Send, RefreshCw, AlertTriangle, CheckCircle, Image as ImageIcon, ChevronRight, MousePointerClick, Filter, X, Folder, Edit2, Trash2, GripVertical } from 'lucide-react';
import { useEtsySeo } from '../context/EtsySeoContext';

export const EtsyPublisher = () => {
  const {
    activeTab, etsyConnected, selectedShippingProfileId, setSelectedShippingProfileId,
    shippingProfiles, selectedReadinessStateId, setSelectedReadinessStateId,
    readinessStates, isPublishing, handlePublishToEtsy, publishResult,
    generatedTitle, generatedDescription, selectedTags, basePrice, variations,
    dbGeneratedMockups, selectedFolderId
  } = useEtsySeo();

  if (activeTab !== 'publish') return null;

  return (
    <>
{/* TAB 3: ETSY STORE DIRECT PUBLISH */}
      <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-emerald-500" />
              Etsy API v3 Mağaza İlan Senkronizasyonu
            </h3>
            
            {!etsyConnected ? (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl space-y-3">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Etsy Mağazanız Bağlı Değil
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-500">
                  Otomatik ilan oluşturabilmek için lütfen Etsy mağazanızı yetkilendirin.
                </p>
                <a 
                  href="/api/etsy/auth?returnUrl=/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  Etsy Mağazamı Bağla
                </a>
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Oluşturulan başlık, açıklama, 13 altın etiket ve varyasyon tablosu tek tıkla Etsy mağazanıza Taslak (Draft) veya Canlı (Active) ilan olarak aktarılır.
                </p>

                <div className="pt-2 pb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      Kargo Profili (Zorunlu)
                    </label>
                    <select 
                      value={selectedShippingProfileId}
                      onChange={(e) => setSelectedShippingProfileId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {shippingProfiles.map(p => (
                        <option key={p.shipping_profile_id} value={p.shipping_profile_id}>
                          {p.title} (ID: {p.shipping_profile_id})
                        </option>
                      ))}
                      {shippingProfiles.length === 0 && <option value="">Kargo profili bulunamadı...</option>}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      Üretim/Hazırlık Süresi (Zorunlu)
                    </label>
                    <select 
                      value={selectedReadinessStateId}
                      onChange={(e) => setSelectedReadinessStateId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {readinessStates.map(r => (
                        <option key={r.readiness_state_id} value={r.readiness_state_id}>
                          {r.processing_days_display_label} ({r.readiness_state})
                        </option>
                      ))}
                      {readinessStates.length === 0 && <option value="">Profil bulunamadı...</option>}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    onClick={() => handlePublishToEtsy('draft')}
                    disabled={isPublishing || !selectedShippingProfileId}
                    className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <Send className={`w-4 h-4 ${isPublishing ? 'animate-spin' : ''}`} />
                    🚀 Etsy'ye Taslak (Draft) Olarak Aktar
                  </button>

                  <button
                    onClick={() => handlePublishToEtsy('active')}
                    disabled={isPublishing || !selectedShippingProfileId}
                    className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <ShoppingBag className={`w-4 h-4 ${isPublishing ? 'animate-spin' : ''}`} />
                    🔥 Doğrudan Canlıya Al (Active)
                  </button>
                </div>
              </>
            )}

            {publishResult && (
              <div className="mt-6 bg-slate-950 text-slate-100 p-4 rounded-xl font-mono text-xs overflow-x-auto space-y-2">
                <div className="text-emerald-400 font-bold">--- ETSY PUBLISH RESULT ---</div>
                <pre>{JSON.stringify(publishResult, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
    </>
  );
};