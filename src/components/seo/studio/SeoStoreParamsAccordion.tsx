'use client';
import React, { useState, useRef, useEffect } from 'react';
import { 
  CheckCircle2, Sparkles, Layers, Hash, RefreshCw, ChevronDown, 
  ChevronUp, SlidersHorizontal, Settings2 
} from 'lucide-react';
import { useEtsySeo } from '../context/EtsySeoContext';
import { useToast } from '@/components/common/ToastContext';

// MultiSelect Dropdown component for Etsy Taxonomy properties
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
        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 text-left flex justify-between items-center"
      >
        <span className="truncate">
          {selectedValues.length > 0 ? `${selectedValues.length} seçenek işaretlendi` : 'Seçim Yapılmadı (Boş)'}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute z-30 mt-1 w-full max-h-60 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl shadow-xl scrollbar-thin">
          {propItem.possible_values?.map((v: any) => (
            <label key={v.value_id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
              <input 
                type="checkbox" 
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
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

export const SeoStoreParamsAccordion: React.FC = () => {
  const {
    selectedShippingProfileId, setSelectedShippingProfileId,
    shippingProfiles, selectedReadinessStateId, setSelectedReadinessStateId,
    readinessStates, setVariations,
    taxonomyId, whoMade, setWhoMade, whenMade, setWhenMade, isSupply, setIsSupply,
    productionPartnerId, setProductionPartnerId, isCustomizable, setIsCustomizable, sku, setSku,
    handleRegenerateSku,
    shopSections, selectedShopSectionId, setSelectedShopSectionId,
    returnPolicies, selectedReturnPolicyId, setSelectedReturnPolicyId,
    shouldAutoRenew, setShouldAutoRenew,
    availableTaxonomyProperties, selectedTaxonomyProperties, setSelectedTaxonomyProperties,
    savedTemplates, defaultTemplates, setDefaultTemplates,
    generatedTitle, generatedDescription, selectedTags
  } = useEtsySeo();
  const toast = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [selectedTemplateForDefault, setSelectedTemplateForDefault] = useState<string>('');

  const handleSetDefaultTemplate = async (templateId: string) => {
    if (!taxonomyId) {
      toast?.error?.('Lütfen önce bir kategori seçin.');
      return;
    }
    if (!templateId) return;

    const newDefaults = { ...defaultTemplates, [taxonomyId]: templateId };
    setDefaultTemplates(newDefaults);

    try {
      await fetch('/api/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ etsyDefaultTemplates: newDefaults })
      });
      toast?.success?.(`Seçilen şablon geçerli kategori (${taxonomyId}) için varsayılan olarak kaydedildi!`);
    } catch (e) {
      console.error(e);
    }
  };

  const hasAiAnalyzed = Boolean(generatedTitle || generatedDescription || (selectedTags && selectedTags.length > 0) || (availableTaxonomyProperties && availableTaxonomyProperties.length > 0));

  // Quick summary texts for the collapsed header
  const currentShippingProfile = shippingProfiles.find((p: any) => p.shipping_profile_id.toString() === selectedShippingProfileId?.toString());
  const currentReadiness = readinessStates.find((r: any) => r.readiness_state_id.toString() === selectedReadinessStateId?.toString());
  const currentSection = shopSections.find((s: any) => s.shop_section_id?.toString() === selectedShopSectionId?.toString());

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all">
      {/* Accordion Toggle Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-left hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors cursor-pointer select-none"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-xs flex items-center justify-center font-bold shrink-0">3</span>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Etsy Mağaza & Kategori Parametreleri
              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-mono px-2 py-0.5 rounded-full font-bold">
                {isOpen ? 'Açık' : 'Otomatik Yapılandırıldı'}
              </span>
            </h3>
          </div>
          <p className="text-xs text-slate-500 pl-8">
            Yapay zeka tarafından otomatik belirlenen kargo, üretim süresi ve kategori niteliklerini açıp inceleyin veya değiştirin.
          </p>

          {/* Quick Summary Badges when Collapsed */}
          <div className="flex flex-wrap gap-1.5 pt-1 pl-8">
            {currentShippingProfile && (
              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1 border border-slate-200 dark:border-slate-700">
                📦 {currentShippingProfile.title}
              </span>
            )}
            {currentReadiness && (
              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1 border border-slate-200 dark:border-slate-700">
                ⏱️ {currentReadiness.processing_days_display_label}
              </span>
            )}
            {currentSection && (
              <span className="text-[10px] bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1 border border-purple-200 dark:border-purple-800">
                📁 {currentSection.title}
              </span>
            )}
            {sku && (
              <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md font-mono font-bold flex items-center gap-1 border border-emerald-200 dark:border-emerald-800">
                🏷️ {sku}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 shadow-xs">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {isOpen ? 'Gizle / Daralt' : 'İncele & Düzenle'}
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </div>
      </button>

      {/* Accordion Body Content */}
      {isOpen && (
        <div className="p-4 sm:p-6 border-t border-slate-200 dark:border-slate-800 space-y-5 bg-slate-50/40 dark:bg-slate-950/30 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Core Dropdowns Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Shipping Profile */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Kargo Profili (Zorunlu)
              </label>
              <select 
                value={selectedShippingProfileId}
                onChange={(e) => setSelectedShippingProfileId(e.target.value)}
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
              >
                {shippingProfiles.map((p: any) => (
                  <option key={p.shipping_profile_id} value={p.shipping_profile_id}>
                    {p.title} (ID: {p.shipping_profile_id})
                  </option>
                ))}
                {shippingProfiles.length === 0 && <option value="">Kargo profili yükleniyor...</option>}
              </select>
            </div>

            {/* Readiness State */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Üretim/Hazırlık Süresi (Zorunlu)
              </label>
              <select 
                value={selectedReadinessStateId}
                onChange={(e) => setSelectedReadinessStateId(e.target.value)}
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
              >
                {readinessStates.map((r: any) => (
                  <option key={r.readiness_state_id} value={r.readiness_state_id}>
                    {r.processing_days_display_label} ({r.readiness_state})
                  </option>
                ))}
                {readinessStates.length === 0 && <option value="">Profil bulunamadı...</option>}
              </select>
            </div>

            {/* Shop Section */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-500" />
                Mağaza Bölümü (Shop Section)
              </label>
              <select 
                value={selectedShopSectionId}
                onChange={(e) => setSelectedShopSectionId(e.target.value)}
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-xs"
              >
                <option value="">Seçim Yapılmadı (Boş)</option>
                {shopSections.map((s: any) => (
                  <option key={s.shop_section_id} value={s.shop_section_id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Return Policy */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                İade Politikası (İsteğe Bağlı)
              </label>
              <select 
                value={selectedReturnPolicyId}
                onChange={(e) => setSelectedReturnPolicyId(e.target.value)}
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
              >
                <option value="">Seçim Yapılmadı (Boş)</option>
                {returnPolicies.map((r: any) => (
                  <option key={r.return_policy_id} value={r.return_policy_id}>
                    {r.title || `Policy ID: ${r.return_policy_id}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Variation Template Loader with Default Setting */}
            <div className="md:col-span-2 space-y-1.5 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-500" />
                Kayıtlı Varyasyon Şablonu Yükle
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <select 
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedTemplateForDefault(val);
                    const t = savedTemplates?.find((st: any) => st.id === val);
                    if (t) setVariations(t.variations || []);
                  }}
                  className="flex-1 px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- Kayıtlı Şablon Seçin --</option>
                  {savedTemplates?.map((t: any) => {
                    const isDefault = taxonomyId && defaultTemplates[taxonomyId] === t.id;
                    return (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.variations?.length || 0} Varyasyon) {isDefault ? ' ⭐ (VARSAYILAN)' : ''}
                      </option>
                    );
                  })}
                </select>

                {taxonomyId && selectedTemplateForDefault && (
                  <button
                    type="button"
                    onClick={() => handleSetDefaultTemplate(selectedTemplateForDefault)}
                    className="px-3.5 py-2.5 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/80 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-xl transition-all shrink-0 flex items-center justify-center gap-1.5 border border-emerald-300 dark:border-emerald-800 shadow-xs"
                  >
                    ⭐ Bu Kategoriye Varsayılan Yap
                  </button>
                )}
              </div>
            </div>

            {/* Dynamic Taxonomy Properties & Integrated Production Metadata */}
            {hasAiAnalyzed && (
              <>
                {/* Dynamic Taxonomy Properties (Filter out unselectable custom_1, custom_2, custom_3 and empty options) */}
                {(() => {
                  const validTaxonomyProperties = (availableTaxonomyProperties || []).filter((prop: any) => {
                    if (!prop || !prop.name) return false;
                    if (/^custom[_\s]?\d+/i.test(prop.name.trim())) return false;
                    if (!prop.possible_values || !Array.isArray(prop.possible_values) || prop.possible_values.length === 0) return false;
                    return true;
                  });

                  return validTaxonomyProperties.map((prop: any) => (
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
                          className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-xs"
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
                  ));
                })()}

                {/* WHO MADE */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Who Made? (Kimin Üretimi?)</label>
                  <select value={whoMade} onChange={(e) => setWhoMade(e.target.value)} className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold shadow-xs">
                    <option value="i_did">I did (Ben yaptım)</option>
                    <option value="someone_else">Someone else (Başkası/Üretim Ortağı)</option>
                    <option value="collective">A collective (Kolektif)</option>
                  </select>
                </div>

                {/* WHEN MADE */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">When Made? (Ne Zaman Yapıldı?)</label>
                  <select value={whenMade} onChange={(e) => setWhenMade(e.target.value)} className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold shadow-xs">
                    <option value="made_to_order">Made to order (Siparişe göre)</option>
                    <option value="2020_2026">2020-2026</option>
                    <option value="2010_2019">2010-2019</option>
                  </select>
                </div>

                {/* IS SUPPLY */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Is Supply? (Tedarik Malzemesi mi?)</label>
                  <select value={isSupply ? "true" : "false"} onChange={(e) => setIsSupply(e.target.value === "true")} className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold shadow-xs">
                    <option value="false">Hayır, Bitmiş Ürün</option>
                    <option value="true">Evet, Tedarik Malzemesi</option>
                  </select>
                </div>

                {/* IS CUSTOMIZABLE */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Kişiselleştirilebilir mi?</label>
                  <select value={isCustomizable ? "true" : "false"} onChange={(e) => setIsCustomizable(e.target.value === "true")} className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold shadow-xs">
                    <option value="false">Hayır</option>
                    <option value="true">Evet</option>
                  </select>
                </div>

                {/* PRODUCTION PARTNER */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Üretim Ortağı ID (Production Partner)</label>
                  <input 
                    type="text" 
                    placeholder="Boş bırakılabilir"
                    value={productionPartnerId}
                    onChange={(e) => setProductionPartnerId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold shadow-xs"
                  />
                </div>

                {/* DYNAMIC SMART SKU */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5 text-emerald-500" />
                      İlan Ana SKU Kodu:
                    </label>
                    <button
                      type="button"
                      onClick={handleRegenerateSku}
                      className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline font-bold flex items-center gap-1"
                      title="Kategori ve Sıraya Göre Yeniden Oluştur"
                    >
                      <RefreshCw className="w-2.5 h-2.5" /> Yeniden Üret
                    </button>
                  </div>
                  <input 
                    type="text" 
                    placeholder="Örn: TSHIRT_001"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-bold tracking-wider text-emerald-700 dark:text-emerald-400 shadow-xs"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Kategori adı ve yayınlanmış ilan sırasına göre otomatik oluşturulur (Örn: TSHIRT_001).
                  </p>
                </div>
              </>
            )}

            {/* Auto-renew switch */}
            <div className="md:col-span-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={shouldAutoRenew}
                  onChange={(e) => setShouldAutoRenew(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                Otomatik Yenileme (Automatic Renewal) - Kapatmanız önerilir
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
