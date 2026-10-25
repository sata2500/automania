'use client';

/**
 * EtsyListingSection — Otomasyonun Etsy'de açacağı taslak ilanın ayarları.
 * Mağaza seçenekleri (kargo, hazırlık süresi, iade, bölüm) kullanıcının bağlı Etsy mağazasından okunur.
 */

import React, { useEffect, useState } from 'react';
import { Store, Video, FileText, AlertCircle } from 'lucide-react';
import type { PodTemplateAutomationSchedule, PodTemplateEtsyListingSettings } from '@/types/templates';
import type { EtsyReadinessState, EtsyReturnPolicy, EtsyShippingProfile, EtsyShopSection } from '@/types/etsy';
import { formatReturnPolicy } from '@/lib/etsy-format';
import { Spinner } from '@/components/common/Spinner';

interface EtsyListingSectionProps {
  schedule: PodTemplateAutomationSchedule;
  onChange: (schedule: PodTemplateAutomationSchedule) => void;
  /** 'store': yalnızca mağaza ayarları (kargo, hazırlık, iade, bölüm) — kategori ve fiyat başka adımda seçilir */
  variant?: 'full' | 'store';
}

export const DEFAULT_ETSY_LISTING_SETTINGS: PodTemplateEtsyListingSettings = {
  shippingProfileId: '',
  readinessStateId: '',
  taxonomyId: 482,
  price: 24.99,
  whoMade: 'i_did',
  whenMade: 'made_to_order',
};

const TAXONOMY_PRESETS = [
  { id: 482, label: 'T-Shirt' },
  { id: 2202, label: 'Sweatshirt' },
];

type TaxonomyOption = { id: number; name: string; path: string | null };

type StoreOptions = {
  connected: boolean;
  profiles: EtsyShippingProfile[];
  readinessStates: EtsyReadinessState[];
  returnPolicies: EtsyReturnPolicy[];
  sections: EtsyShopSection[];
};

/** Şablonun Etsy ayarlarında ilan açmayı engelleyen eksikleri döner. */
export function getEtsyListingSettingsErrors(schedule: PodTemplateAutomationSchedule): string[] {
  if (schedule.createListing !== true) return [];
  const etsy = schedule.etsy;
  const errors: string[] = [];
  if (!etsy?.shippingProfileId) errors.push('Etsy ilanı için kargo profili seçin.');
  if (!etsy?.readinessStateId) errors.push('Etsy ilanı için hazırlık süresi seçin.');
  if (!etsy || !(etsy.taxonomyId > 0)) errors.push('Geçerli bir Etsy kategori kimliği girin.');
  if (!etsy || !(etsy.price >= 0.2)) errors.push('Fiyat en az 0,20 olmalıdır.');
  return errors;
}

const selectClass = 'w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400/40 text-slate-800 dark:text-slate-100';
const labelClass = 'block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5';

export function EtsyListingSection({ schedule, onChange, variant = 'full' }: EtsyListingSectionProps) {
  const storeOnly = variant === 'store';
  const [options, setOptions] = useState<StoreOptions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState<TaxonomyOption[]>([]);
  const createListing = storeOnly || schedule.createListing === true;
  const etsy = { ...DEFAULT_ETSY_LISTING_SETTINGS, ...schedule.etsy };

  const updateEtsy = (updates: Partial<PodTemplateEtsyListingSettings>) => {
    onChange({ ...schedule, etsy: { ...etsy, ...updates } });
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/etsy/shipping-profiles');
        const data = await res.json();
        if (!data.connected) {
          if (!cancelled) setOptions({ connected: false, profiles: [], readinessStates: [], returnPolicies: [], sections: [] });
          return;
        }
        const [policies, sections] = await Promise.all([
          fetch('/api/etsy/return-policies').then((r) => r.json()).catch(() => ({})),
          fetch('/api/etsy/shop-sections').then((r) => r.json()).catch(() => ({})),
        ]);
        if (cancelled) return;
        setOptions({
          connected: true,
          profiles: data.profiles || [],
          readinessStates: data.readinessStates || [],
          returnPolicies: policies.returnPolicies || [],
          sections: sections.sections || [],
        });
      } catch {
        if (!cancelled) setOptions({ connected: false, profiles: [], readinessStates: [], returnPolicies: [], sections: [] });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    // Admin panelinde etkinleştirilen kategoriler; yoksa kategori kimliği elle girilir.
    fetch('/api/etsy/taxonomy')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && Array.isArray(data?.categories)) setCategories(data.categories);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const isKnownCategory = categories.some((c) => c.id === etsy.taxonomyId);

  const errors = getEtsyListingSettingsErrors({ ...schedule, etsy });

  return (
    <div className="space-y-5">
      {/* Ne yapılacak? */}
      {!storeOnly && <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className={`flex items-start gap-3 p-3 rounded-2xl border-2 cursor-pointer transition-all ${createListing ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-500/60' : 'border-slate-200 dark:border-slate-700'}`}>
          <input
            type="checkbox"
            className="mt-0.5 w-4 h-4 accent-emerald-600"
            checked={createListing}
            onChange={(e) => onChange({ ...schedule, createListing: e.target.checked, etsy })}
          />
          <span className="text-xs">
            <span className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-emerald-500" />SEO metni + Etsy taslak ilanı</span>
            <span className="block mt-0.5 text-slate-500 dark:text-slate-400">Başlık, açıklama ve 13 etiket üretilir; ilan mağazanızda <strong>taslak</strong> olarak açılır. Kapalıysa yalnızca tasarım ve mockup üretilir (kuru çalıştırma).</span>
          </span>
        </label>
        <label className={`flex items-start gap-3 p-3 rounded-2xl border-2 cursor-pointer transition-all ${schedule.generateVideo ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-500/60' : 'border-slate-200 dark:border-slate-700'}`}>
          <input
            type="checkbox"
            className="mt-0.5 w-4 h-4 accent-indigo-600"
            checked={schedule.generateVideo === true}
            onChange={(e) => onChange({ ...schedule, generateVideo: e.target.checked })}
          />
          <span className="text-xs">
            <span className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5"><Video className="w-3.5 h-3.5 text-indigo-500" />AI tanıtım videosu</span>
            <span className="block mt-0.5 text-slate-500 dark:text-slate-400">Google Veo ile 8 saniyelik video üretilir ve ilana eklenir. Ek maliyet ve birkaç dakika süre ekler.</span>
          </span>
        </label>
      </div>}

      {createListing && (
        <>
          {isLoading ? (
            <div className="flex items-center gap-2 text-xs text-slate-500"><Spinner className="w-4 h-4" /> Etsy mağaza ayarları yükleniyor…</div>
          ) : !options?.connected ? (
            <div className="flex items-start gap-2 p-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-900/20 text-xs text-amber-800 dark:text-amber-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Etsy mağazanız bağlı değil. İlan ayarlarını seçmek için önce Etsy SEO sekmesinden mağazanızı bağlayın. Bağlantı olmadan çalıştırmalar ilan adımını atlar.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor="tpl-shipping">Kargo profili (zorunlu)</label>
                <select id="tpl-shipping" className={selectClass} value={etsy.shippingProfileId} onChange={(e) => updateEtsy({ shippingProfileId: e.target.value })}>
                  <option value="">Seçin…</option>
                  {options.profiles.map((p) => <option key={p.shipping_profile_id} value={String(p.shipping_profile_id)}>{p.title}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="tpl-readiness">Hazırlık süresi (zorunlu)</label>
                <select id="tpl-readiness" className={selectClass} value={etsy.readinessStateId} onChange={(e) => updateEtsy({ readinessStateId: e.target.value })}>
                  <option value="">Seçin…</option>
                  {options.readinessStates.map((r) => <option key={r.readiness_state_id} value={String(r.readiness_state_id)}>{r.processing_days_display_label || r.readiness_state || r.readiness_state_id}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="tpl-return">İade politikası</label>
                <select id="tpl-return" className={selectClass} value={etsy.returnPolicyId || ''} onChange={(e) => updateEtsy({ returnPolicyId: e.target.value || undefined })}>
                  <option value="">Mağaza varsayılanı</option>
                  {options.returnPolicies.map((p) => <option key={p.return_policy_id} value={String(p.return_policy_id)}>{formatReturnPolicy(p)}</option>)}
                </select>
              </div>
              {!storeOnly && <div>
                <label className={labelClass} htmlFor="tpl-section">Mağaza bölümü</label>
                <select id="tpl-section" className={selectClass} value={etsy.shopSectionId || ''} onChange={(e) => updateEtsy({ shopSectionId: e.target.value || undefined })}>
                  <option value="">Bölüm yok</option>
                  {options.sections.map((s) => <option key={s.shop_section_id} value={String(s.shop_section_id)}>{s.title}</option>)}
                </select>
              </div>}
              {storeOnly && (
                <p className="sm:col-span-2 text-[11px] text-slate-500 dark:text-slate-400">
                  Mağaza bölümü her ilan için, ürünün konusuna göre yapay zekâ tarafından mağazanızdaki bölümler arasından seçilir.
                </p>
              )}
            </div>
          )}

          {!storeOnly && <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="tpl-taxonomy">Etsy kategorisi</label>
              {categories.length > 0 && (
                <select
                  id="tpl-taxonomy"
                  className={`${selectClass} mb-1.5`}
                  value={isKnownCategory ? String(etsy.taxonomyId) : 'custom'}
                  onChange={(e) => { if (e.target.value !== 'custom') updateEtsy({ taxonomyId: Number(e.target.value) }); }}
                >
                  {categories.map((c) => <option key={c.id} value={String(c.id)}>{c.path || c.name}</option>)}
                  <option value="custom">Diğer (kimliği elle gir)</option>
                </select>
              )}
              {(categories.length === 0 || !isKnownCategory) && (
                <div className="flex gap-1.5">
                  <input
                    id={categories.length > 0 ? 'tpl-taxonomy-custom' : 'tpl-taxonomy'}
                    type="number"
                    min={1}
                    aria-label="Etsy kategori kimliği"
                    className={selectClass}
                    value={etsy.taxonomyId}
                    onChange={(e) => updateEtsy({ taxonomyId: Number(e.target.value) || 0 })}
                  />
                  {categories.length === 0 && TAXONOMY_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => updateEtsy({ taxonomyId: preset.id })}
                      className={`px-2 rounded-xl border text-[11px] font-bold shrink-0 ${etsy.taxonomyId === preset.id ? 'bg-amber-500 border-amber-500 text-white' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className={labelClass} htmlFor="tpl-price">Fiyat (varyasyon yoksa)</label>
              <input
                id="tpl-price"
                type="number"
                min={0.2}
                step={0.01}
                className={selectClass}
                value={etsy.price}
                onChange={(e) => updateEtsy({ price: Number(e.target.value) || 0 })}
              />
            </div>
          </div>}

          <div className="flex items-start gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-[11px] text-slate-600 dark:text-slate-300">
            <Store className="w-4 h-4 shrink-0 text-amber-500" />
            <span>
              Otomasyon ilanları her zaman <strong>taslak</strong> olarak açar; canlıya almadan önce Etsy&apos;de veya &quot;İlanlarım&quot; sekmesinde kontrol edebilirsiniz. Üretici beyanı &quot;Ben yaptım&quot;, üretim zamanı &quot;Siparişe göre&quot; olarak gönderilir. Varyasyon adımındaki satırlar ilanın envanterine aktarılır.
            </span>
          </div>

          {errors.length > 0 && !isLoading && options?.connected && (
            <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-0.5 list-disc pl-5">
              {errors.map((error) => <li key={error}>{error}</li>)}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
