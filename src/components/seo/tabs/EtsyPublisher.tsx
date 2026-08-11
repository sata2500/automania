// @ts-nocheck
'use client';
import React, { useState, useRef, useEffect } from 'react';
import { Tag, Copy, Sparkles, Check, FileText, ShoppingBag, Layers, DollarSign, Send, RefreshCw, AlertTriangle, CheckCircle, Image as ImageIcon, ChevronRight, MousePointerClick, Filter, X, Folder, Edit2, Trash2, GripVertical, ChevronDown } from 'lucide-react';
import { useEtsySeo } from '../context/EtsySeoContext';

const MultiSelectDropdown = ({ propItem, selectedValues = [], onChange }: { propItem: any, selectedValues: number[], onChange: (vals: number[]) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={wrapperRef}>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500 text-left flex justify-between items-center"
      >
        <span className="truncate">
          {selectedValues.length > 0 ? `${selectedValues.length} seçenek işaretlendi` : 'Seçim Yapılmadı (Boş)'}
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg shadow-xl">
          {propItem.possible_values?.map((v: any) => (
            <label key={v.value_id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
              <input 
                type="checkbox" 
                className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                checked={selectedValues.includes(v.value_id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    onChange([...selectedValues, v.value_id]);
                  } else {
                    onChange(selectedValues.filter((id: number) => id !== v.value_id));
                  }
                }}
              />
              {v.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

export const EtsyPublisher = () => {
  const {
    activeTab, etsyConnected, selectedShippingProfileId, setSelectedShippingProfileId,
    shippingProfiles, selectedReadinessStateId, setSelectedReadinessStateId,
    readinessStates, isPublishing, handlePublishToEtsy, publishResult,
    generatedTitle, generatedDescription, selectedTags, basePrice, variations,
    taxonomyId, whoMade, whenMade, materials, styles,
    shopSections, selectedShopSectionId, setSelectedShopSectionId,
    returnPolicies, selectedReturnPolicyId, setSelectedReturnPolicyId,
    shouldAutoRenew, setShouldAutoRenew,
    availableTaxonomyProperties, selectedTaxonomyProperties, setSelectedTaxonomyProperties,
    savedTemplates, setVariations
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
                  Oluşturulan başlık, açıklama, 13 altın etiket, varyasyon tablosu ve AI tarafından bulunan gelişmiş mağaza özellikleri tek tıkla Etsy'ye aktarılır.
                </p>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 mb-4">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-purple-500" />
                    AI Tespit Edilen Gelişmiş Özellikler
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                    <div><span className="font-semibold text-slate-800 dark:text-slate-200">Kategori ID:</span> {taxonomyId}</div>
                    <div><span className="font-semibold text-slate-800 dark:text-slate-200">Kim Yaptı:</span> {whoMade === 'someone_else' ? 'Üretim Ortağı' : whoMade}</div>
                    <div><span className="font-semibold text-slate-800 dark:text-slate-200">Üretim Yılı:</span> {whenMade}</div>
                    <div><span className="font-semibold text-slate-800 dark:text-slate-200">Materyal:</span> {materials?.length > 0 ? materials.join(', ') : 'Belirtilmedi'}</div>
                    <div className="col-span-2"><span className="font-semibold text-slate-800 dark:text-slate-200">Stil:</span> {styles?.length > 0 ? styles.join(', ') : 'Belirtilmedi'}</div>
                  </div>
                </div>

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

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-emerald-500" />
                      Kayıtlı Varyasyon Şablonu Yükle
                    </label>
                    <select 
                      onChange={(e) => {
                        const t = savedTemplates?.find((st: any) => st.id === e.target.value);
                        if (t) setVariations(t.variations || []);
                      }}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">-- Şablon Seçin --</option>
                      {savedTemplates?.map((t: any) => (
                        <option key={t.id} value={t.id}>{t.name} ({t.variations?.length || 0} Varyasyon)</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1">Bu alandan bir şablon seçerseniz mevcut varyasyon listeniz üzerine yazılır.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-500" />
                      Mağaza Bölümü (Shop Section)
                    </label>
                    <select 
                      value={selectedShopSectionId}
                      onChange={(e) => setSelectedShopSectionId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Seçim Yapılmadı (Boş)</option>
                      {shopSections.map((s: any) => (
                        <option key={s.shop_section_id} value={s.shop_section_id}>
                          {s.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      İade Politikası (İsteğe Bağlı)
                    </label>
                    <select 
                      value={selectedReturnPolicyId}
                      onChange={(e) => setSelectedReturnPolicyId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Seçim Yapılmadı (Boş)</option>
                      {returnPolicies.map((r: any) => (
                        <option key={r.return_policy_id} value={r.return_policy_id}>
                          {r.title || `Policy ID: ${r.return_policy_id}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {availableTaxonomyProperties?.map((prop: any) => (
                    <div key={prop.property_id}>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-purple-500" />
                        {prop.name}
                      </label>
                      {prop.is_multivalued ? (
                          <MultiSelectDropdown 
                            propItem={prop} 
                            selectedValues={selectedTaxonomyProperties[prop.property_id] || []}
                            onChange={(vals) => {
                              setSelectedTaxonomyProperties((prev: any) => ({
                                ...prev,
                                [prop.property_id]: vals
                              }));
                            }}
                          />
                        ) : (
                          <select 
                            value={selectedTaxonomyProperties[prop.property_id]?.[0]?.toString() || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSelectedTaxonomyProperties((prev: any) => ({
                                ...prev,
                                [prop.property_id]: val ? [parseInt(val, 10)] : []
                              }));
                            }}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
                          >
                            <option value="">Seçim Yapılmadı (Boş)</option>
                            {prop.possible_values?.map((v: any) => (
                              <option key={v.value_id} value={v.value_id}>
                                {v.name}
                              </option>
                            ))}
                          </select>
                        )}
                    </div>
                  ))}

                  <div className="md:col-span-2 flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700/50">
                    <input
                      type="checkbox"
                      id="autoRenewCheckbox"
                      checked={shouldAutoRenew}
                      onChange={(e) => setShouldAutoRenew(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                    />
                    <label htmlFor="autoRenewCheckbox" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                      Otomatik Yenileme (Automatic Renewal) - Kapatmanız önerilir
                    </label>
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