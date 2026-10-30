'use client';

/**
 * Ayarlar sekmesi: hesap, görünüm, Etsy mağazası, mağaza ayarları ve kayıtlı varyasyon şablonları.
 * Mağaza ayarları tüm ilanlarda kullanılır (otomasyon şablonunda boş bırakılanlar buradan tamamlanır);
 * varyasyonlar otomasyonda veya Hazır İlanlar'da kayıtlı şablonlardan seçilir.
 */
import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { FileText, Layers, Monitor, Moon, Package, Save, Store, Sun, User } from 'lucide-react';
import { useAuth } from '@/components/common/UserAuthContext';
import { useTheme } from '@/components/common/ThemeProvider';
import { useToast } from '@/components/common/ToastContext';
import { Spinner } from '@/components/common/Spinner';
import { EtsyListingSection, loadEtsyStoreOptions, type StoreOptions } from '@/components/templates/sections/EtsyListingSection';
import { TabSkeleton } from '@/components/common/LoadingScreens';
import type { EtsyVariationTemplate } from '@/types/pod';
import { isFreeShippingProfile } from '@/lib/etsy-shipping';
import {
  missingListingSettings,
  normalizeListingDefaults,
  type ListingDefaults,
} from '@/lib/listing-defaults';
import type { PodTemplateAutomationSchedule } from '@/types/templates';
import { loadVariationTemplates, VariationTemplatesPanel } from './VariationTemplatesPanel';

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

export function SettingsPanel() {
  const { user, setIsAuthModalOpen } = useAuth();
  const { theme, setTheme } = useTheme();
  const toast = useToast();
  const [defaults, setDefaults] = useState<ListingDefaults | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  // Sayfa, tüm bölümlerin verisi (ilan ayarları, Etsy mağazası, varyasyon şablonları) hazır olunca bir kerede açılır.
  const [storeOptions, setStoreOptions] = useState<StoreOptions | null>(null);
  const [variationTemplates, setVariationTemplates] = useState<EtsyVariationTemplate[] | null>(null);
  const etsyConnected = storeOptions?.connected ?? null;

  useEffect(() => {
    let cancelled = false;
    const listing = fetch('/api/settings/listing', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => normalizeListingDefaults(data?.defaults))
      .catch(() => normalizeListingDefaults(null));
    void Promise.all([listing, loadEtsyStoreOptions(), loadVariationTemplates()]).then(([loaded, options, templates]) => {
      if (cancelled) return;
      setDefaults(loaded);
      setSavedSnapshot(JSON.stringify(loaded));
      setStoreOptions(options);
      setVariationTemplates(templates);
    });
    return () => { cancelled = true; };
  }, []);

  const dirty = defaults !== null && JSON.stringify(defaults) !== savedSnapshot;
  const missing = defaults ? missingListingSettings(defaults) : [];

  const schedule = useMemo<PodTemplateAutomationSchedule>(
    () => ({ createListing: true, etsy: defaults?.etsy } as PodTemplateAutomationSchedule),
    [defaults?.etsy],
  );

  if (!defaults || !storeOptions || !variationTemplates) {
    return <div className="max-w-3xl mx-auto"><TabSkeleton label="Ayarlar yükleniyor" layout="list" /></div>;
  }

  const update = (patch: Partial<ListingDefaults>) => setDefaults({ ...defaults, ...patch });
  const detectedFreeShipping = isFreeShippingProfile(storeOptions.profiles.find((p) => String(p.shipping_profile_id) === String(defaults.etsy.shippingProfileId)));

  const save = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/settings/listing', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(defaults) });
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
        <SectionTitle icon={Package} title="Mağaza ayarları" hint="Tüm ilanlarda kullanılır (Üretim'den oluşturulanlar ve otomasyonlarda boş bırakılanlar). Kategori ve ürün tipi her klasörün otomasyonunda belirlenir." />
        {missing.length > 0 && (
          <p className="text-xs rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 p-2.5">
            Yayınlamak için seçilmesi gereken: <strong>{missing.join(', ')}</strong>.
          </p>
        )}
        <div>
          <label className={labelClass} htmlFor="set-whomade">Kim üretti?</label>
          <select id="set-whomade" className={inputClass} value={defaults.etsy.whoMade} onChange={(e) => update({ etsy: { ...defaults.etsy, whoMade: e.target.value as ListingDefaults['etsy']['whoMade'] } })}>
            <option value="i_did">Ben tasarladım (POD)</option>
            <option value="someone_else">Başka biri / üretim ortağı</option>
            <option value="collective">Ekip (kolektif)</option>
          </select>
        </div>
        <EtsyListingSection
          variant="store"
          embedded
          schedule={schedule}
          preloadedOptions={storeOptions}
          onChange={(next) => update({ etsy: { ...defaults.etsy, ...next.etsy } })}
        />
      </section>

      {/* İlan metni bilgileri: yapay zekâ açıklamayı yazarken yalnızca bunları ürün bilgisi olarak kullanır */}
      <section className={cardClass} aria-label="İlan metni bilgileri">
        <SectionTitle icon={FileText} title="İlan metni bilgileri" hint="Yapay zekâ ilan açıklamasını yazarken ürün bilgisi olarak yalnızca bunları kullanır; boş bırakılan bilgi açıklamaya yazılmaz (uydurulmaz). İngilizce yazın." />
        <div>
          <span className={labelClass}>Kargo ücretsiz mi?</span>
          <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold">
            {([
              [null, 'Otomatik'],
              [true, 'Ücretsiz'],
              [false, 'Ücretli'],
            ] as const).map(([value, label]) => (
              <button
                key={label}
                type="button"
                onClick={() => update({ copy: { ...defaults.copy, freeShipping: value } })}
                className={`py-2 rounded-lg transition-colors ${defaults.copy.freeShipping === value ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow' : 'text-slate-500 dark:text-slate-400'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
            {defaults.copy.freeShipping === null
              ? detectedFreeShipping === null
                ? 'Seçili kargo profilinden anlaşılamadı; açıklamada kargo ücretinden söz edilmez.'
                : `Seçili kargo profiline göre: ${detectedFreeShipping ? 'ABD\'ye ücretsiz kargo — açıklamada belirtilir.' : 'kargo ücretli — açıklamada ücretsiz kargo yazılmaz.'}`
              : defaults.copy.freeShipping ? 'Açıklamada ücretsiz kargo belirtilir.' : 'Açıklamada ücretsiz kargo yazılmaz.'}
          </p>
        </div>
        {([
          ['productInfo', 'Ürün bilgisi', 'Ör. Comfort Colors 1717, 100% ring-spun cotton, garment-dyed, relaxed fit', 300],
          ['careInstructions', 'Bakım talimatı', 'Ör. Machine wash cold inside out, tumble dry low, do not iron the print', 200],
          ['processingInfo', 'Üretim ve kargo süresi', 'Ör. Made to order in 1-3 business days, ships from the USA', 200],
          ['extraNotes', 'Mağaza notu', 'Ör. Need a different size or color? Message us — we reply within a day.', 400],
        ] as const).map(([key, label, placeholder, max]) => (
          <div key={key}>
            <label className={labelClass} htmlFor={`copy-${key}`}>{label}</label>
            <textarea
              id={`copy-${key}`}
              rows={2}
              maxLength={max}
              className={`${inputClass} resize-none`}
              placeholder={placeholder}
              value={defaults.copy[key]}
              onChange={(e) => update({ copy: { ...defaults.copy, [key]: e.target.value } })}
            />
          </div>
        ))}
      </section>

      {/* Varyasyonlar: kayıtlı şablonlar (otomasyonlarda ve Hazır İlanlar'da manuel ilanlar için seçilir) */}
      <section className={cardClass} aria-label="Varyasyonlar">
        <SectionTitle icon={Layers} title="Varyasyonlar" hint="Beden × renk şablonları. Otomasyonlar klasör ayarında, Üretim'den gelen ilanlar ise Hazır İlanlar'da yayından önce buradaki bir şablonu kullanır." />
        <VariationTemplatesPanel initialTemplates={variationTemplates} />
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
