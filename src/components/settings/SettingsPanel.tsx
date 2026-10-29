'use client';

/**
 * Ayarlar sekmesi: hesap, görünüm, Etsy mağazası ve ilan varsayılanları (mağaza ayarları + varyasyonlar).
 * İlan varsayılanları Üretim'deki "İlan Oluştur" ile hazırlanan ilanlarda kullanılır; otomasyon şablonunda
 * boş bırakılan mağaza ayarları ve varyasyonlar da buradan tamamlanır.
 */
import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Layers, Monitor, Moon, Package, Save, Store, Sun, User, X } from 'lucide-react';
import { useAuth } from '@/components/common/UserAuthContext';
import { useTheme } from '@/components/common/ThemeProvider';
import { useToast } from '@/components/common/ToastContext';
import { Spinner } from '@/components/common/Spinner';
import { EtsyListingSection } from '@/components/templates/sections/EtsyListingSection';
import { CategoryPicker, type TaxonomyOption } from '@/components/templates/sections/CategoryPicker';
import {
  MAX_VARIATION_COMBINATIONS,
  missingListingSettings,
  normalizeListingDefaults,
  type ListingDefaults,
} from '@/lib/listing-defaults';
import type { PodTemplateAutomationSchedule } from '@/types/templates';

const cardClass = 'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4';
const inputClass = 'w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500';
const labelClass = 'block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5';

function SectionTitle({ icon: Icon, title, hint }: { icon: React.ElementType; title: string; hint?: string }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2"><Icon className="w-4 h-4 text-indigo-500" /> {title}</h3>
      {hint && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );
}

/** Virgül veya Enter ile eklenen, çarpıyla silinen değer listesi (beden, renk). */
function ChipListInput({ id, values, onChange, placeholder }: { id: string; values: string[]; onChange: (values: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState('');
  const add = (raw: string) => {
    const next = [...values];
    for (const part of raw.split(',').map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean)) {
      if (!next.some((v) => v.toLocaleLowerCase('tr') === part.toLocaleLowerCase('tr'))) next.push(part.slice(0, 60));
    }
    onChange(next);
    setDraft('');
  };
  return (
    <div className="flex flex-wrap gap-1.5 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950">
      {values.map((value) => (
        <span key={value} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200">
          {value}
          <button type="button" aria-label={`${value} kaldır`} onClick={() => onChange(values.filter((v) => v !== value))} className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700">
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); if (draft.trim()) add(draft); }
          if (e.key === 'Backspace' && !draft && values.length > 0) onChange(values.slice(0, -1));
        }}
        onBlur={() => { if (draft.trim()) add(draft); }}
        placeholder={placeholder}
        className="flex-1 min-w-24 bg-transparent text-sm px-1 py-1 focus:outline-none text-slate-900 dark:text-white"
      />
    </div>
  );
}

export function SettingsPanel() {
  const { user, setIsAuthModalOpen } = useAuth();
  const { theme, setTheme } = useTheme();
  const toast = useToast();
  const [defaults, setDefaults] = useState<ListingDefaults | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [categories, setCategories] = useState<TaxonomyOption[]>([]);
  const [etsyConnected, setEtsyConnected] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/settings/listing', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const loaded = normalizeListingDefaults(data?.defaults);
        setDefaults(loaded);
        setSavedSnapshot(JSON.stringify(loaded));
      })
      .catch(() => { if (!cancelled) setDefaults(normalizeListingDefaults(null)); });
    fetch('/api/etsy/taxonomy')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!cancelled && Array.isArray(data?.categories)) setCategories(data.categories); })
      .catch(() => {});
    fetch('/api/etsy/shipping-profiles')
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setEtsyConnected(Boolean(data?.connected)); })
      .catch(() => { if (!cancelled) setEtsyConnected(false); });
    return () => { cancelled = true; };
  }, []);

  const dirty = defaults !== null && JSON.stringify(defaults) !== savedSnapshot;
  const combinations = defaults ? defaults.variations.sizes.length * defaults.variations.colors.length : 0;
  const missing = defaults ? missingListingSettings(defaults) : [];

  const schedule = useMemo<PodTemplateAutomationSchedule>(
    () => ({ createListing: true, etsy: defaults?.etsy } as PodTemplateAutomationSchedule),
    [defaults?.etsy],
  );

  if (!defaults) {
    return <div className="flex items-center gap-2 text-sm text-slate-500 p-6"><Spinner className="w-4 h-4" /> Ayarlar yükleniyor…</div>;
  }

  const update = (patch: Partial<ListingDefaults>) => setDefaults({ ...defaults, ...patch });
  const updateVariations = (patch: Partial<ListingDefaults['variations']>) => update({ variations: { ...defaults.variations, ...patch } });

  const save = async () => {
    if (combinations > MAX_VARIATION_COMBINATIONS) {
      toast.error(`Etsy en fazla ${MAX_VARIATION_COMBINATIONS} beden × renk kombinasyonuna izin verir (şu an ${combinations}).`);
      return;
    }
    setIsSaving(true);
    try {
      // Varyasyon yoksa kullanılan fiyat temel varyasyon fiyatıyla aynı tutulur.
      const body = { ...defaults, etsy: { ...defaults.etsy, price: defaults.variations.basePrice } };
      const res = await fetch('/api/settings/listing', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Ayarlar kaydedilemedi.');
      const saved = normalizeListingDefaults(data.defaults);
      setDefaults(saved);
      setSavedSnapshot(JSON.stringify(saved));
      toast.success('Ayarlar kaydedildi. Yeni ilanlar bu ayarlarla hazırlanacak.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ayarlar kaydedilemedi.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-24">
      <h2 className="text-lg font-bold text-slate-900 dark:text-white">Ayarlar</h2>

      {/* Hesap */}
      <section className={cardClass} aria-labelledby="settings-account">
        <div className="flex items-center gap-3">
          {user?.avatarUrl ? (
            <Image src={user.avatarUrl} alt={user.name} width={44} height={44} className="rounded-full border-2 border-indigo-500/70 object-cover" unoptimized={user.avatarUrl.includes('dicebear.com')} />
          ) : (
            <div className="w-11 h-11 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center text-white"><User className="w-5 h-5" /></div>
          )}
          <div className="min-w-0 flex-1">
            <p id="settings-account" className="text-sm font-bold text-slate-900 dark:text-white truncate">{user?.name ?? 'Hesap'}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
          </div>
          <button type="button" onClick={() => setIsAuthModalOpen(true)} className="shrink-0 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
            Profil ve yedekleme
          </button>
        </div>
        <div>
          <span className={labelClass}>Görünüm</span>
          <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80">
            {([['system', 'Sistem', Monitor], ['light', 'Açık', Sun], ['dark', 'Koyu', Moon]] as const).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTheme(key)}
                aria-pressed={theme === key}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold ${theme === key ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow' : 'text-slate-500 dark:text-slate-400'}`}
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Etsy mağazası */}
      <section className={cardClass} aria-label="Etsy mağazası">
        <div className="flex items-center justify-between gap-3">
          <SectionTitle
            icon={Store}
            title="Etsy mağazası"
            hint={etsyConnected === null ? 'Bağlantı kontrol ediliyor…' : etsyConnected ? 'Mağazanız bağlı; ilanlar bu mağazada yayınlanır.' : 'Mağazanız bağlı değil.'}
          />
          <a href="/api/etsy/auth?returnUrl=/" className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold ${etsyConnected ? 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200' : 'bg-orange-500 hover:bg-orange-600 text-white'}`}>
            {etsyConnected ? 'Yeniden bağla' : 'Etsy mağazamı bağla'}
          </a>
        </div>
      </section>

      {/* İlan varsayılanları */}
      <section className={cardClass} aria-label="İlan varsayılanları">
        <SectionTitle icon={Package} title="İlan varsayılanları" hint="Üretim'den oluşturulan ilanlar bu ayarlarla hazırlanır; otomasyonlarda boş bırakılan ayarlar da buradan alınır." />
        {missing.length > 0 && (
          <p className="text-xs rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 p-2.5">
            Yayınlamak için seçilmesi gereken: <strong>{missing.join(', ')}</strong>.
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="set-product">Ürün tipi</label>
            <input id="set-product" className={inputClass} value={defaults.productType} maxLength={80} onChange={(e) => update({ productType: e.target.value })} placeholder="Ör. T-shirt, Sweatshirt" />
          </div>
          <div>
            <label className={labelClass} htmlFor="set-whomade">Kim üretti?</label>
            <select id="set-whomade" className={inputClass} value={defaults.etsy.whoMade} onChange={(e) => update({ etsy: { ...defaults.etsy, whoMade: e.target.value as ListingDefaults['etsy']['whoMade'] } })}>
              <option value="i_did">Ben tasarladım (POD)</option>
              <option value="someone_else">Başka biri / üretim ortağı</option>
              <option value="collective">Ekip (kolektif)</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="set-category">Etsy kategorisi</label>
            {categories.length > 0 ? (
              <CategoryPicker id="set-category" categories={categories} value={defaults.etsy.taxonomyId} onChange={(id) => update({ etsy: { ...defaults.etsy, taxonomyId: id } })} />
            ) : (
              <input id="set-category" type="number" min={1} className={inputClass} value={defaults.etsy.taxonomyId} onChange={(e) => update({ etsy: { ...defaults.etsy, taxonomyId: Number(e.target.value) || 0 } })} />
            )}
          </div>
        </div>
        <EtsyListingSection
          variant="store"
          embedded
          schedule={schedule}
          onChange={(next) => update({ etsy: { ...defaults.etsy, ...next.etsy } })}
        />
        <div>
          <label className={labelClass} htmlFor="set-notes">Mağaza notları (ilan metnine eklenir)</label>
          <textarea id="set-notes" rows={3} className={inputClass} value={defaults.notes} maxLength={2000} onChange={(e) => update({ notes: e.target.value })} placeholder="Ör. Comfort Colors 1717, %100 pamuk, beden tablosu fotoğraflarda; yıkama talimatları…" />
        </div>
      </section>

      {/* Varyasyonlar */}
      <section className={cardClass} aria-label="Varyasyonlar">
        <SectionTitle icon={Layers} title="Varyasyonlar" hint="Her ilan bu beden ve renklerin tüm kombinasyonlarıyla açılır. Bedene özel fiyat vermezseniz temel fiyat kullanılır." />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="set-sizes">Bedenler</label>
            <ChipListInput id="set-sizes" values={defaults.variations.sizes} onChange={(sizes) => updateVariations({ sizes })} placeholder="Beden ekle (Enter)…" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="set-colors">Renkler</label>
            <ChipListInput id="set-colors" values={defaults.variations.colors} onChange={(colors) => updateVariations({ colors })} placeholder="Renk ekle (Enter)…" />
          </div>
          <div>
            <label className={labelClass} htmlFor="set-price">Temel fiyat</label>
            <input id="set-price" type="number" min={0.2} step={0.01} className={inputClass} value={defaults.variations.basePrice} onChange={(e) => updateVariations({ basePrice: Number(e.target.value) || 0 })} />
          </div>
          <div>
            <label className={labelClass} htmlFor="set-qty">Stok adedi (her kombinasyon)</label>
            <input id="set-qty" type="number" min={1} max={999} className={inputClass} value={defaults.variations.quantity} onChange={(e) => updateVariations({ quantity: Math.trunc(Number(e.target.value)) || 1 })} />
          </div>
        </div>
        {defaults.variations.sizes.length > 0 && (
          <div>
            <span className={labelClass}>Bedene özel fiyat (boş = temel fiyat)</span>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {defaults.variations.sizes.map((size) => (
                <label key={size} className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 space-y-1">
                  <span className="block truncate">{size}</span>
                  <input
                    type="number"
                    min={0.2}
                    step={0.01}
                    className={`${inputClass} px-2`}
                    placeholder={String(defaults.variations.basePrice)}
                    value={defaults.variations.sizePrices[size] ?? ''}
                    onChange={(e) => {
                      const sizePrices = { ...defaults.variations.sizePrices };
                      const value = Number(e.target.value);
                      if (e.target.value === '' || !(value > 0)) delete sizePrices[size];
                      else sizePrices[size] = value;
                      updateVariations({ sizePrices });
                    }}
                  />
                </label>
              ))}
            </div>
          </div>
        )}
        <p className={`text-xs ${combinations > MAX_VARIATION_COMBINATIONS ? 'text-red-600 dark:text-red-400 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
          {combinations} kombinasyon ({defaults.variations.sizes.length} beden × {defaults.variations.colors.length} renk){combinations > MAX_VARIATION_COMBINATIONS ? ` — Etsy en fazla ${MAX_VARIATION_COMBINATIONS} kabul eder` : ''}
        </p>
      </section>

      {/* Kaydet: değişiklik varken altta sabit */}
      <div className={`fixed left-3 right-3 bottom-[calc(env(safe-area-inset-bottom)+88px)] lg:bottom-6 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-[28rem] z-40 transition-all ${dirty ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
        <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl">
          <span className="flex-1 text-xs font-semibold text-slate-600 dark:text-slate-300 px-1">Kaydedilmemiş değişiklikler var</span>
          <button type="button" onClick={() => { setDefaults(JSON.parse(savedSnapshot || 'null') ?? normalizeListingDefaults(null)); }} className="px-3 py-2 rounded-xl text-xs font-bold text-slate-500">Vazgeç</button>
          <button type="button" onClick={() => void save()} disabled={isSaving} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-60">
            {isSaving ? <Spinner className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />} Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}
