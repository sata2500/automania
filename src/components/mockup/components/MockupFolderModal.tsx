'use client';

/**
 * Klasör ayarları penceresi. Mockup klasörü = bir Etsy ilanı: ad, ürün kategorisi, varsayılan varyasyon, kitle,
 * ürün modelleri, ürün bilgisi ve Etsy mağaza ayarları (kargo, hazırlık, iade, üretici, otomatik yenileme)
 * burada tutulur; manuel ilanlar ve otomasyonlar bunları kullanır. Misafirde yalnızca ad düzenlenir.
 * Mağaza ayarı seçilmemiş klasör, Ayarlar'daki eski kayıtla (yeni klasör seçili klasörden) önceden doldurulur.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Folder, Layers, Package, Store, X } from 'lucide-react';
import { DialogPanel } from '@/components/common/DialogPanel';
import { Spinner } from '@/components/common/Spinner';
import { CategoryPicker, type TaxonomyOption } from '@/components/templates/sections/CategoryPicker';
import { loadEtsyStoreOptions, type StoreOptions } from '@/components/templates/sections/EtsyListingSection';
import { loadVariationTemplates } from '@/components/settings/VariationTemplatesPanel';
import { AUDIENCE_OPTIONS, normalizeFolderEtsy } from '@/lib/folder-listing';
import { formatReturnPolicy } from '@/lib/etsy-format';
import type { EtsyVariationTemplate, FolderEtsySettings, MockupFolder } from '@/types/pod';
import type { AudienceGroup } from '@/types/templates';

/** Pencerenin kaydettiği klasör alanları (id ve tür dışındakiler). */
export type FolderSettingsPatch = Omit<MockupFolder, 'id' | 'type' | 'isCustom'>;

interface MockupFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Düzenlenen klasör (yoksa yeni klasör) */
  folder: MockupFolder | null;
  /** Yeni klasörde mağaza ayarlarının kopyalanacağı klasör (genelde seçili klasör) */
  prefillFrom?: MockupFolder | null;
  /** Giriş yapılmışsa ilan ayarları gösterilir */
  showListingSettings: boolean;
  onSave: (patch: FolderSettingsPatch) => void;
}

type Options = { categories: TaxonomyOption[]; variations: EtsyVariationTemplate[]; store: StoreOptions; defaultsEtsy: FolderEtsySettings };

// Seçenekler oturum boyunca bir kez yüklenir (pencere her açıldığında yeniden istenmez).
let optionsPromise: Promise<Options> | null = null;
function loadOptions(): Promise<Options> {
  optionsPromise ??= Promise.all([
    fetch('/api/etsy/taxonomy').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    loadVariationTemplates(),
    loadEtsyStoreOptions(),
    fetch('/api/settings/listing', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]).then(([taxonomy, variations, store, settings]) => ({
    categories: Array.isArray(taxonomy?.categories) ? taxonomy.categories : [],
    variations,
    store,
    defaultsEtsy: normalizeFolderEtsy(settings?.defaults?.etsy),
  }));
  // Hata olursa sonraki açılışta yeniden denenir.
  optionsPromise.catch(() => { optionsPromise = null; });
  return optionsPromise;
}

const inputClass = 'w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50';
const labelClass = 'block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5';
const hintClass = 'mt-1 text-[11px] text-slate-500 dark:text-slate-400';

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
      <h4 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5"><Icon className="w-3.5 h-3.5 text-amber-500" /> {title}</h4>
      {children}
    </section>
  );
}

export const MockupFolderModal: React.FC<MockupFolderModalProps> = ({ isOpen, onClose, folder, prefillFrom, showListingSettings, onSave }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [taxonomyId, setTaxonomyId] = useState(0);
  const [variationTemplateId, setVariationTemplateId] = useState('');
  const [audienceGroup, setAudienceGroup] = useState<AudienceGroup | undefined>();
  const [garmentsText, setGarmentsText] = useState('');
  const [productInfo, setProductInfo] = useState('');
  const [etsy, setEtsy] = useState<FolderEtsySettings>({});
  const [options, setOptions] = useState<Options | null>(null);

  // Pencere açılınca alanlar klasörden doldurulur.
  useEffect(() => {
    if (!isOpen) return;
    /* eslint-disable react-hooks/set-state-in-effect -- form, açılan klasörün değerleriyle sıfırlanır */
    setName(folder?.name ?? '');
    setTaxonomyId(folder?.taxonomyId ?? 0);
    setVariationTemplateId(folder?.variationTemplateId ?? '');
    setAudienceGroup(folder?.audienceGroup);
    setGarmentsText((folder?.garments ?? []).join('\n'));
    setProductInfo(folder?.productInfo ?? '');
    setEtsy(normalizeFolderEtsy(folder ? folder.etsy : prefillFrom?.etsy));
    /* eslint-enable react-hooks/set-state-in-effect */
    const timer = setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 50);
    return () => clearTimeout(timer);
  }, [isOpen, folder, prefillFrom]);

  useEffect(() => {
    if (!isOpen || !showListingSettings) return;
    let cancelled = false;
    void loadOptions().then((loaded) => {
      if (cancelled) return;
      setOptions(loaded);
      // Mağaza ayarı seçilmemiş klasör, Ayarlar'daki eski kayıtla önceden doldurulur.
      setEtsy((current) => (current.shippingProfileId || current.readinessStateId ? current : { ...loaded.defaultsEtsy, ...current }));
    });
    return () => { cancelled = true; };
  }, [isOpen, showListingSettings]);

  if (!isOpen) return null;

  const updateEtsy = (patch: FolderEtsySettings) => setEtsy((current) => ({ ...current, ...patch }));
  const partnerIds = etsy.productionPartnerIds ?? [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;
    if (!showListingSettings || !options) {
      onSave({ name: cleanName });
      return;
    }
    const category = options.categories.find((c) => c.id === taxonomyId);
    const variation = options.variations.find((t) => t.id === variationTemplateId);
    onSave({
      name: cleanName,
      taxonomyId: category?.id ?? folder?.taxonomyId,
      categoryName: category?.name ?? folder?.categoryName,
      variationTemplateId: variation?.id,
      variationTemplateName: variation?.name,
      audienceGroup,
      garments: garmentsText.split('\n').map((g) => g.trim()).filter(Boolean).slice(0, 10),
      productInfo: productInfo.trim().slice(0, 300),
      etsy: normalizeFolderEtsy(etsy),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 dark:bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <DialogPanel
        aria-labelledby="mockup-folder-modal-title"
        onClose={onClose}
        className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl w-full ${showListingSettings ? 'sm:max-w-lg' : 'sm:max-w-sm'} shadow-2xl flex flex-col max-h-[92dvh]`}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 id="mockup-folder-modal-title" className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Folder className="w-4 h-4 text-amber-500" />
            {folder ? 'Klasör ayarları' : 'Yeni Klasör Oluştur'}
          </h3>
          <button type="button" onClick={onClose} aria-label="Kapat" className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-xl">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">
            <div>
              <label className={labelClass} htmlFor="folder-name">Klasör adı</label>
              <input ref={inputRef} id="folder-name" type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn: Kadın Sweatshirt" className={inputClass} />
              {showListingSettings && <p className={hintClass}>Klasör bir Etsy ilanıdır: aşağıdaki ayarlar bu klasörden üretilen tüm ilanlarda (elle veya otomasyonla) kullanılır.</p>}
            </div>

            {showListingSettings && !options && (
              <div className="flex items-center gap-2 text-xs text-slate-500 py-2"><Spinner className="w-4 h-4" /> İlan ayarları yükleniyor…</div>
            )}

            {showListingSettings && options && (
              <>
                <Section icon={Package} title="Ürün">
                  <div>
                    <label className={labelClass} htmlFor="folder-category">Ürün kategorisi</label>
                    {options.categories.length > 0
                      ? <CategoryPicker id="folder-category" categories={options.categories} value={taxonomyId} onChange={setTaxonomyId} />
                      : <p className={hintClass}>Admin panelinde (Etsy Kategorileri) kategori etkinleştirilince burada seçilir.</p>}
                    <p className={hintClass}>Her klasörde tek ürün türü önerilir (tişört, sweatshirt, hoodie ayrı ilanlar).</p>
                  </div>
                  <fieldset>
                    <legend className={labelClass}>Kitle</legend>
                    <div className="flex flex-wrap gap-1.5">
                      {AUDIENCE_OPTIONS.map((option) => (
                        <button key={option.id} type="button" aria-pressed={audienceGroup === option.id} onClick={() => setAudienceGroup(audienceGroup === option.id ? undefined : option.id)}
                          className={`px-3 py-1.5 rounded-full border-2 text-xs font-bold transition-colors ${audienceGroup === option.id ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <p className={hintClass}>Tasarım, niş araştırması ve ilan metni bu kitleye göre hazırlanır.</p>
                  </fieldset>
                  <div>
                    <label className={labelClass} htmlFor="folder-garments">Ürün modelleri (isteğe bağlı)</label>
                    <textarea id="folder-garments" rows={2} className={`${inputClass} resize-none`} value={garmentsText} onChange={(e) => setGarmentsText(e.target.value)} placeholder={'Comfort Colors 1717\nBella+Canvas 3001'} />
                    <p className={hintClass}>Her satıra bir model; ilki ilk görseldeki üründür ve videoda kullanılır. Açıklamada seçenek olarak yazılır (başlık ve etiketlerde marka kullanılmaz).</p>
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="folder-product-info">Ürün bilgisi</label>
                    <textarea id="folder-product-info" rows={2} maxLength={300} className={`${inputClass} resize-none`} value={productInfo} onChange={(e) => setProductInfo(e.target.value)} placeholder="Ör. 100% ring-spun cotton, garment-dyed, relaxed fit" />
                    <p className={hintClass}>Yapay zekâ açıklamada ürün özelliği olarak yalnızca bunu kullanır (uydurmaz) ve bakım talimatını buna göre yazar. İngilizce yazın.</p>
                  </div>
                </Section>

                <Section icon={Layers} title="Varyasyon">
                  <div>
                    <label className={labelClass} htmlFor="folder-variation">Varsayılan varyasyon</label>
                    <select id="folder-variation" value={variationTemplateId} onChange={(e) => setVariationTemplateId(e.target.value)} className={inputClass}>
                      <option value="">Seçilmedi (Hazır İlanlar&apos;da seçilir)</option>
                      {options.variations.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.variations?.length ?? 0} varyasyon)</option>)}
                    </select>
                    <p className={hintClass}>Beden, renk ve fiyatlar bu şablondan gelir (Ayarlar › Varyasyonlar); şablondaki fiyat değişiklikleri sonraki ilanlarda geçerli olur.</p>
                  </div>
                </Section>

                <Section icon={Store} title="Etsy mağaza ayarları">
                  {!options.store.connected ? (
                    <p className={hintClass}>Etsy mağazanız bağlı değil. Ayarlar › Etsy mağazası bölümünden bağlayınca kargo profili ve hazırlık süresi burada seçilir.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass} htmlFor="folder-whomade">Kim üretti?</label>
                        <select id="folder-whomade" className={inputClass} value={etsy.whoMade ?? 'i_did'} onChange={(e) => updateEtsy({ whoMade: e.target.value as FolderEtsySettings['whoMade'] })}>
                          <option value="i_did">Ben tasarladım (POD)</option>
                          <option value="someone_else">Başka biri / üretim ortağı</option>
                          <option value="collective">Ekip (kolektif)</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelClass} htmlFor="folder-shipping">Kargo profili (zorunlu)</label>
                        <select id="folder-shipping" className={inputClass} value={etsy.shippingProfileId ?? ''} onChange={(e) => updateEtsy({ shippingProfileId: e.target.value || undefined })}>
                          <option value="">Seçin…</option>
                          {options.store.profiles.map((p) => <option key={p.shipping_profile_id} value={String(p.shipping_profile_id)}>{p.title}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelClass} htmlFor="folder-readiness">Hazırlık süresi (zorunlu)</label>
                        <select id="folder-readiness" className={inputClass} value={etsy.readinessStateId ?? ''} onChange={(e) => updateEtsy({ readinessStateId: e.target.value || undefined })}>
                          <option value="">Seçin…</option>
                          {options.store.readinessStates.map((r) => <option key={r.readiness_state_id} value={String(r.readiness_state_id)}>{r.processing_days_display_label || r.readiness_state || r.readiness_state_id}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelClass} htmlFor="folder-return">İade politikası</label>
                        <select id="folder-return" className={inputClass} value={etsy.returnPolicyId ?? ''} onChange={(e) => updateEtsy({ returnPolicyId: e.target.value || undefined })}>
                          <option value="">Mağaza varsayılanı</option>
                          {options.store.returnPolicies.map((p) => <option key={p.return_policy_id} value={String(p.return_policy_id)}>{formatReturnPolicy(p)}</option>)}
                        </select>
                      </div>
                      {options.store.partners.length > 0 && (
                        <div className="sm:col-span-2">
                          <span className={labelClass}>Üretim ortağı (baskı firması)</span>
                          <div className="flex flex-wrap gap-2">
                            {options.store.partners.map((p) => {
                              const partnerId = String(p.production_partner_id);
                              return (
                                <label key={partnerId} className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">
                                  <input type="checkbox" className="w-4 h-4 accent-amber-500" checked={partnerIds.includes(partnerId)}
                                    onChange={(e) => updateEtsy({ productionPartnerIds: e.target.checked ? [...partnerIds, partnerId] : partnerIds.filter((x) => x !== partnerId) })} />
                                  {p.partner_name}{p.location ? ` (${p.location})` : ''}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <label className="sm:col-span-2 flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input type="checkbox" className="mt-0.5 w-4 h-4 accent-amber-500" checked={etsy.shouldAutoRenew === true} onChange={(e) => updateEtsy({ shouldAutoRenew: e.target.checked })} />
                        <span><strong>Otomatik yenile</strong> — ilan 4 ay sonra süresi dolunca Etsy yeniler (her yenileme 0,20 $ ücretlidir).</span>
                      </label>
                      <p className="sm:col-span-2 text-[11px] text-slate-500 dark:text-slate-400">Mağaza bölümü her ilan için yapay zekâ tarafından mağazanızdaki bölümler arasından seçilir.</p>
                    </div>
                  )}
                </Section>
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={onClose} className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
              İptal
            </button>
            <button type="submit" disabled={showListingSettings && !options} className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold rounded-xl shadow disabled:opacity-50">
              {folder ? 'Kaydet' : 'Oluştur'}
            </button>
          </div>
        </form>
      </DialogPanel>
    </div>
  );
};
