'use client';

/**
 * Ayarlar sekmesi: hesap, görünüm, Etsy mağazası ve kayıtlı varyasyon şablonları. İlanın mağaza ayarları
 * (kargo, hazırlık, iade…), ürün bilgisi ve varsayılan varyasyonu her mockup klasöründe seçilir (Klasör ayarları).
 */
import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { Layers, Monitor, Moon, Store, Sun, User } from 'lucide-react';
import { useAuth } from '@/components/common/UserAuthContext';
import { useTheme } from '@/components/common/ThemeProvider';
import { loadEtsyStoreOptions, type StoreOptions } from '@/components/templates/sections/EtsyListingSection';
import { TabSkeleton } from '@/components/common/LoadingScreens';
import type { EtsyVariationTemplate } from '@/types/pod';
import { loadVariationTemplates, VariationTemplatesPanel } from './VariationTemplatesPanel';

const cardClass = 'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4';
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
  // Sayfa, tüm bölümlerin verisi (Etsy mağazası, varyasyon şablonları) hazır olunca bir kerede açılır.
  const [storeOptions, setStoreOptions] = useState<StoreOptions | null>(null);
  const [variationTemplates, setVariationTemplates] = useState<EtsyVariationTemplate[] | null>(null);
  const etsyConnected = storeOptions?.connected ?? null;

  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadEtsyStoreOptions(), loadVariationTemplates()]).then(([options, templates]) => {
      if (cancelled) return;
      setStoreOptions(options);
      setVariationTemplates(templates);
    });
    return () => { cancelled = true; };
  }, []);

  if (!storeOptions || !variationTemplates) {
    return <div className="max-w-3xl mx-auto"><TabSkeleton label="Ayarlar yükleniyor" layout="list" /></div>;
  }

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

      {/* Varyasyonlar: kayıtlı şablonlar (mockup klasörlerinde varsayılan olarak, Hazır İlanlar'da da seçilir) */}
      <section className={cardClass} aria-label="Varyasyonlar">
        <SectionTitle icon={Layers} title="Varyasyonlar" hint="Beden × renk şablonları. Her mockup klasörü Klasör ayarları'nda bir şablonu varsayılan seçer; Hazır İlanlar'da ilan bazında değiştirilebilir." />
        <VariationTemplatesPanel initialTemplates={variationTemplates} />
      </section>

    </div>
  );
}
