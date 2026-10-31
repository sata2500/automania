'use client';

/**
 * Otomasyon kurulum sihirbazı — bir mockup klasörü için "kur ve unut" akışı.
 *
 * Akış (her çalıştırmada): AI tasarım (+ isteğe bağlı diğer kumaş versiyonu) → arka plan kaldırma → klasördeki
 * mockup'lara basma → isteğe bağlı tanıtım videosu (mockup görselinden) → SEO metni → Etsy taslak ilanı.
 *
 * Kullanıcı beş kısa adımı doldurur: Ürün (klasör), Tasarım (konu, kumaş), Video, Zaman ve Etsy (ilan nasıl
 * açılsın). Kategori, kitle, ürün modelleri, ürün bilgisi, varyasyon ve mağaza ayarları mockup klasöründedir
 * (Klasör ayarları); mockup'lar, varyasyonlar ve klasör ayarları her çalıştırmada güncel hâlleriyle okunur.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Check, ChevronLeft, ChevronRight, Clapperboard, Clock, Layers, Package, Palette, PenLine, Rocket, Save, Sparkles, Store, Video, X,
} from 'lucide-react';
import type { EtsyVariationTemplate, MockupFolder, MockupItem } from '@/types/pod';
import type {
  DesignFabric, PodTemplate, PodTemplateAutomationSchedule, PodTemplateInput, PodTemplateVariationConfig,
} from '@/types/templates';
import { AUDIENCE_OPTIONS, mergeFolderEtsy, missingFolderEtsy } from '@/lib/folder-listing';
import { buildFolderMockupConfig, variationConfigFromRows } from '@/lib/folder-template';
import { saveTemplate } from '@/lib/templates-client';
import { useToast } from '@/components/common/ToastContext';
import { DialogPanel } from '@/components/common/DialogPanel';
import { Spinner } from '@/components/common/Spinner';
import { ScheduleSection } from './sections/ScheduleSection';
import { DEFAULT_ETSY_LISTING_SETTINGS } from './sections/EtsyListingSection';
import type { TaxonomyOption } from './sections/CategoryPicker';
import { productTypeFromCategory } from '@/lib/sku';

type Step = 0 | 1 | 2 | 3 | 4;
const STEPS: { label: string; icon: React.ElementType }[] = [
  { label: 'Ürün', icon: Package },
  { label: 'Tasarım', icon: Palette },
  { label: 'Video', icon: Clapperboard },
  { label: 'Zaman', icon: Clock },
  { label: 'Etsy', icon: Store },
];

/** Video modelleri (Veo, Omni Flash) yalnızca yatay ve dikey üretir; kare desteklenmez. */
const VIDEO_ASPECTS = [
  { id: '16:9' as const, label: 'Yatay', desc: '16:9 — Etsy ilan galerisi için' },
  { id: '9:16' as const, label: 'Dikey', desc: '9:16 — Reels / Shorts / TikTok için' },
];

const FABRIC_OPTIONS: { id: DesignFabric; label: string; desc: string }[] = [
  { id: 'light', label: 'Açık renkli kumaş', desc: 'Beyaz, krem, açık gri tişörtler için koyu mürekkepli tasarım' },
  { id: 'dark', label: 'Koyu renkli kumaş', desc: 'Siyah, lacivert, antrasit tişörtler için açık mürekkepli tasarım' },
  { id: 'universal', label: 'Her ikisi', desc: 'Tek tasarım; hem açık hem koyu kumaşta iyi duracak renklerle' },
];

const DEFAULT_SCHEDULE: PodTemplateAutomationSchedule = {
  enabled: true,
  cronExpression: '0 10 * * *',
  timezone: 'Europe/Istanbul',
  nextRunAt: null,
  listingsPerRun: 1,
  publishMode: 'draft',
  createListing: true,
  generateVideo: true,
  video: { aspectRatio: '16:9' },
  etsy: DEFAULT_ETSY_LISTING_SETTINGS,
};

const inputClass = 'w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40';
const labelClass = 'block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5';

/** Mockup'ın otomasyonda nasıl kullanılacağı. */
function mockupKind(m: MockupItem): 'video' | 'static' | 'print' | 'unset' {
  if (m.isVideo) return 'video';
  if (m.hasPrintArea === false) return 'static';
  return (m.printAreas?.length ?? 0) > 0 ? 'print' : 'unset';
}

/** Kategori adından ürün tipi (SEO ve video prompt'u için): "T-shirts" → "T-shirt". */
interface AutomationWizardProps {
  folders: MockupFolder[];
  mockups: MockupItem[];
  /** Düzenlenen şablon (yoksa yeni) */
  template: PodTemplate | null;
  /** Klasör menüsünden açıldıysa klasör sabittir */
  folderId?: string;
  onSaved: (template: PodTemplate) => void;
  onClose: () => void;
}

export function AutomationWizard({ folders, mockups, template, folderId: fixedFolderId, onSaved, onClose }: AutomationWizardProps) {
  const toast = useToast();
  const [step, setStep] = useState<Step>(0);
  const [isSaving, setIsSaving] = useState(false);

  const mockupFolders = useMemo(() => folders.filter((f) => f.type !== 'design'), [folders]);
  const [folderId, setFolderId] = useState(fixedFolderId ?? template?.mockupConfig?.folderId ?? '');
  const folder = mockupFolders.find((f) => f.id === folderId);
  const [name, setName] = useState(template?.name ?? folder?.name ?? '');

  // Ürün
  const savedEtsy = { ...DEFAULT_ETSY_LISTING_SETTINGS, ...template?.automationSchedule?.etsy };
  // Kategori mockup klasöründe seçilir (klasör = bir Etsy ilanı); klasörde yoksa şablonda kayıtlı eski kategori.
  const taxonomyId = folder?.taxonomyId || savedEtsy.taxonomyId;
  // Varyasyon da mockup klasöründe seçilir; klasörde yoksa şablonda kayıtlı eski varyasyon şablonu.
  const variationSourceId = folder?.variationTemplateId || template?.variationConfig?.sourceTemplateId || '';
  const [fixedPrice, setFixedPrice] = useState<number>(savedEtsy.price);

  // Tasarım: yeni otomasyonlarda konu yapay zekâ araştırmasıyla belirlenir.
  const [nicheMode, setNicheMode] = useState<'auto' | 'manual'>(
    template?.seoHints?.nicheMode ?? (template?.seoHints?.primaryNiche ? 'manual' : 'auto'),
  );
  const [researchFocus, setResearchFocus] = useState(template?.seoHints?.researchFocus ?? '');
  const [niche, setNiche] = useState(template?.seoHints?.primaryNiche ?? '');
  const [audience, setAudience] = useState(template?.seoHints?.targetAudience ?? '');
  const [notes, setNotes] = useState(template?.seoHints?.customNotes ?? '');
  // Kitle, ürün modelleri ve kumaş: tasarım, video ve ilan metni bunlara göre hazırlanır.
  // Kitle ve ürün modelleri mockup klasöründe (Klasör ayarları); klasörde yoksa şablonda kayıtlı eski değer.
  const audienceGroup = folder?.audienceGroup ?? template?.seoHints?.audienceGroup;
  const garments = folder?.garments?.length ? folder.garments : template?.seoHints?.garments ?? [];
  const [designFabric, setDesignFabric] = useState<DesignFabric>(template?.seoHints?.designFabric ?? 'light');
  const [fabricVariant, setFabricVariant] = useState(template?.seoHints?.fabricVariant ?? true);

  // Video + zaman + Etsy (tek zamanlama nesnesinde)
  const [schedule, setSchedule] = useState<PodTemplateAutomationSchedule>(() => ({
    ...DEFAULT_SCHEDULE,
    ...template?.automationSchedule,
    createListing: true,
    publishMode: 'draft',
    video: { aspectRatio: template?.automationSchedule?.video?.aspectRatio ?? '16:9' },
    etsy: savedEtsy,
  }));
  const video = schedule.video ?? {};
  const updateVideo = (patch: Partial<NonNullable<PodTemplateAutomationSchedule['video']>>) =>
    setSchedule((prev) => ({ ...prev, video: { ...prev.video, ...patch } }));

  // Seçenek listeleri
  const [categories, setCategories] = useState<TaxonomyOption[] | null>(null);
  const [variationTemplates, setVariationTemplates] = useState<EtsyVariationTemplate[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/etsy/taxonomy').then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (!cancelled) setCategories(Array.isArray(d?.categories) ? d.categories : []);
    }).catch(() => { if (!cancelled) setCategories([]); });
    fetch('/api/workspace/variation-templates').then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (!cancelled) setVariationTemplates(Array.isArray(d?.templates) ? d.templates : []);
    }).catch(() => { if (!cancelled) setVariationTemplates([]); });
    return () => { cancelled = true; };
  }, []);

  const folderMockups = useMemo(() => mockups.filter((m) => m.folderId === folderId), [mockups, folderId]);
  const counts = useMemo(() => {
    const c = { print: 0, static: 0, video: 0, unset: 0 };
    for (const m of folderMockups) c[mockupKind(m)]++;
    return c;
  }, [folderMockups]);
  const category = categories?.find((c) => c.id === taxonomyId);
  const variationSource = variationTemplates?.find((t) => t.id === variationSourceId);
  const variationSummary = useMemo(() => {
    const rows = variationSource?.variations ?? [];
    if (rows.length === 0) return null;
    const prices = rows.map((r) => Number(r.price)).filter((p) => p > 0);
    return {
      count: rows.length,
      sizes: new Set(rows.map((r) => r.size)).size,
      colors: new Set(rows.map((r) => r.color)).size,
      min: prices.length ? Math.min(...prices) : 0,
      max: prices.length ? Math.max(...prices) : 0,
    };
  }, [variationSource]);

  // Adım doğrulamaları (Etsy mağaza ayarları eksikse kayıt engellenmez; ilan adımı nedenini yazarak atlanır).
  const stepErrors = (s: Step): string[] => {
    if (s === 0) {
      const errors: string[] = [];
      if (!folderId) errors.push('Bir mockup klasörü seçin.');
      else if (counts.print === 0) errors.push('Klasörde baskı alanı ayarlanmış en az bir mockup olmalı.');
      if (folderId && !folder?.taxonomyId && !(savedEtsy.taxonomyId > 0)) errors.push('Klasörün ürün kategorisini seçin (Mockup\'lar › klasör menüsü › Klasör ayarları).');
      if (!variationSourceId && !(fixedPrice >= 0.2)) errors.push('Klasöre varyasyon seçin (Mockup\'lar › klasör menüsü › Klasör ayarları) veya en az 0,20 fiyat girin.');
      return errors;
    }
    if (s === 1 && nicheMode === 'manual' && !niche.trim()) return ['Tasarım konusunu yazın veya konuyu yapay zekâya bırakın.'];
    return [];
  };
  const currentErrors = stepErrors(step);
  const blockingErrors = ([0, 1] as Step[]).flatMap(stepErrors);
  // Mağaza ayarları klasörde (Klasör ayarları); klasörde boş olan alan şablondaki eski değerle kalır.
  const folderEtsy = mergeFolderEtsy({ ...DEFAULT_ETSY_LISTING_SETTINGS, ...schedule.etsy }, folder?.etsy);
  const etsyWarnings = missingFolderEtsy(folderEtsy);

  const buildInput = (): PodTemplateInput => {
    const variationConfig: PodTemplateVariationConfig = variationSource?.variations?.length
      ? { ...variationConfigFromRows(variationSource.variations), sourceTemplateId: variationSource.id, sourceTemplateName: variationSource.name }
      : { rows: [], sizes: [], colors: [] };
    return {
      name: name.trim() || folder?.name || 'Otomasyon',
      mockupConfig: { ...buildFolderMockupConfig(folderId, mockups), fabricType: 'all' },
      variationConfig,
      seoHints: {
        primaryNiche: nicheMode === 'manual' ? niche.trim() : '',
        targetAudience: nicheMode === 'manual' ? audience.trim() : '',
        customNotes: nicheMode === 'manual' ? notes.trim() : '',
        productType: productTypeFromCategory(folder?.categoryName || category?.name),
        nicheMode,
        researchFocus: nicheMode === 'auto' ? researchFocus.trim() : '',
        // Kitle ve ürün modelleri çalıştırmada klasörden okunur; şablonda eski değer korunur.
        audienceGroup: template?.seoHints?.audienceGroup,
        garments: template?.seoHints?.garments ?? [],
        designFabric,
        fabricVariant: designFabric !== 'universal' && fabricVariant,
      },
      automationSchedule: {
        ...schedule,
        createListing: true,
        publishMode: 'draft',
        // Mağaza bölümü her ilan için yapay zekâ tarafından seçilir.
        etsy: { ...DEFAULT_ETSY_LISTING_SETTINGS, ...schedule.etsy, shopSectionId: undefined, taxonomyId, price: variationSummary?.min || fixedPrice },
      },
      isActive: template?.isActive ?? true,
    };
  };

  const handleSave = async (runNow: boolean) => {
    if (blockingErrors.length > 0) {
      toast.error(blockingErrors[0]);
      setStep(stepErrors(0).length > 0 ? 0 : 1);
      return;
    }
    setIsSaving(true);
    try {
      const saved = await saveTemplate(buildInput(), template?.id);
      if (runNow) {
        const res = await fetch('/api/automation/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateId: saved.id, triggerType: 'manual' }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok || res.status === 409) toast.info('Otomasyon kaydedildi ve ilk çalıştırma başlatıldı. İlerlemeyi Üretim › Otomasyonlar\'da izleyebilirsiniz.');
        else toast.warning(`Otomasyon kaydedildi ancak çalıştırılamadı: ${data.error || 'bilinmeyen hata'}`);
      } else {
        toast.success(template ? 'Otomasyon güncellendi.' : 'Otomasyon oluşturuldu.');
      }
      onSaved(saved);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Otomasyon kaydedilemedi.');
    } finally {
      setIsSaving(false);
    }
  };

  const isLast = step === 4;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-6">
      <DialogPanel
        aria-labelledby="automation-wizard-title"
        onClose={onClose}
        className="w-full sm:max-w-2xl bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[92dvh]"
      >
        {/* Başlık */}
        <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shrink-0 shadow">
              <Rocket className="w-5 h-5 text-white" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 id="automation-wizard-title" className="text-base font-bold text-slate-900 dark:text-white truncate">
                {template ? 'Otomasyonu Düzenle' : 'Otomasyon Kur'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{folder ? `Klasör: ${folder.name}` : 'Bir mockup klasörü için otomatik ürün üretimi'}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Kapat" className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white bg-slate-100 dark:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Adımlar */}
        <nav aria-label="Kurulum adımları" className="px-5 pb-3">
          <ol className="grid grid-cols-5 gap-1">
            {STEPS.map(({ label, icon: Icon }, index) => {
              const s = index as Step;
              const active = s === step;
              const done = s < step && stepErrors(s).length === 0;
              return (
                <li key={label}>
                  <button
                    type="button"
                    onClick={() => setStep(s)}
                    aria-current={active ? 'step' : undefined}
                    className={`w-full flex flex-col items-center gap-1 py-2 rounded-xl text-[11px] font-semibold transition-colors ${
                      active ? 'bg-purple-600 text-white shadow' : done ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {done ? <Check className="w-4 h-4" aria-hidden="true" /> : <Icon className="w-4 h-4" aria-hidden="true" />}
                    {label}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* İçerik */}
        <div className="flex-1 overflow-y-auto px-5 py-2 space-y-5">
          {step === 0 && (
            <>
              <div>
                <label className={labelClass} htmlFor="aw-name">Otomasyon adı</label>
                <input id="aw-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder={folder?.name || 'Ör. Erkek tişört — kedi temalı'} />
              </div>

              {!fixedFolderId && (
                <div>
                  <label className={labelClass} htmlFor="aw-folder">Mockup klasörü</label>
                  <select id="aw-folder" className={inputClass} value={folderId} onChange={(e) => {
                    setFolderId(e.target.value);
                    const next = mockupFolders.find((f) => f.id === e.target.value);
                    if (next && !name.trim()) setName(next.name);
                  }}>
                    <option value="">Klasör seçin…</option>
                    {mockupFolders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              )}

              {folderId && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-3.5">
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-2"><Layers className="w-3.5 h-3.5 text-purple-500" /> Klasördeki mockup&apos;lar</p>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {folderMockups.slice(0, 12).map((m) => (
                      <div key={m.id} className={`relative w-12 h-12 shrink-0 rounded-lg overflow-hidden border ${mockupKind(m) === 'unset' ? 'border-amber-400' : 'border-slate-200 dark:border-slate-700'}`} title={m.name}>
                        {m.isVideo
                          ? <div className="w-full h-full flex items-center justify-center bg-slate-800"><Video className="w-4 h-4 text-white" /></div>
                          : <img src={m.src} alt={m.name} loading="lazy" className="w-full h-full object-cover" />}
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                    Tasarım basılacak: <strong className="text-slate-700 dark:text-slate-200">{counts.print}</strong>
                    {counts.static > 0 && <> · Olduğu gibi eklenecek (tablo): <strong className="text-slate-700 dark:text-slate-200">{counts.static}</strong></>}
                    {counts.video > 0 && <> · Video: <strong className="text-slate-700 dark:text-slate-200">{counts.video}</strong></>}
                  </p>
                  {counts.unset > 0 && (
                    <p className="mt-1.5 text-[11px] text-amber-700 dark:text-amber-400 flex gap-1"><AlertTriangle className="w-3.5 h-3.5 shrink-0" />{counts.unset} mockup&apos;ta baskı alanı ayarlanmamış; bunlar atlanır.</p>
                  )}
                  <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">Her çalıştırmada klasörün güncel içeriği kullanılır. Açık/koyu kumaş versiyonu Tasarım adımında ayarlanır.</p>
                </div>
              )}


              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-3 text-xs space-y-1">
                <p className="font-bold text-slate-700 dark:text-slate-200">Klasörün ilan ayarları</p>
                <p className="text-slate-600 dark:text-slate-300">
                  Kategori: <strong>{folder?.taxonomyId
                    ? (category?.path || category?.name || folder.categoryName || `#${folder.taxonomyId}`)
                    : taxonomyId > 0
                      ? `${category?.path || category?.name || `#${taxonomyId}`} (eski ayar)`
                      : 'Seçilmedi'}</strong>
                </p>
                <p className="text-slate-600 dark:text-slate-300">
                  Kitle: <strong>{AUDIENCE_OPTIONS.find((o) => o.id === audienceGroup)?.label ?? 'Belirtilmedi'}</strong>
                  {' · '}Ürün modelleri: <strong>{garments.length > 0 ? garments.join(', ') : 'Belirtilmedi'}</strong>
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Kategori, kitle, ürün modelleri, ürün bilgisi, varyasyon ve Etsy mağaza ayarları mockup klasöründe: Mockup&apos;lar › klasör menüsü › Klasör ayarları.</p>
              </div>

              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-3 text-xs">
                <p className="font-bold text-slate-700 dark:text-slate-200">Varyasyonlar (ürün, renk, fiyat)</p>
                {variationTemplates === null ? (
                  <div className="mt-1 flex items-center gap-2 text-slate-500"><Spinner className="w-4 h-4" /> Varyasyon şablonları yükleniyor…</div>
                ) : variationSummary && variationSource ? (
                  <p className="mt-0.5 text-slate-600 dark:text-slate-300">
                    {variationSource.name}{!folder?.variationTemplateId && ' (eski ayar)'}: {variationSummary.count} varyasyon · {variationSummary.sizes} beden/ürün · {variationSummary.colors} renk · ${variationSummary.min.toFixed(2)}–${variationSummary.max.toFixed(2)}
                  </p>
                ) : (
                  <div className="mt-2">
                    <label className={labelClass} htmlFor="aw-price">Varyasyon yok: tek fiyat (USD)</label>
                    <input id="aw-price" type="number" min={0.2} step={0.01} className={inputClass} value={fixedPrice} onChange={(e) => setFixedPrice(Number(e.target.value) || 0)} />
                  </div>
                )}
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Varsayılan varyasyon mockup klasöründe seçilir: Mockup&apos;lar › klasör menüsü › Klasör ayarları. Şablonlar Ayarlar › Varyasyonlar&apos;da; fiyat değişiklikleri sonraki çalıştırmalarda geçerli olur.</p>
              </div>

            </>
          )}

          {step === 1 && (
            <>
              <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <legend className={labelClass}>Tasarım konusu</legend>
                {([
                  { id: 'auto' as const, icon: Sparkles, label: 'Yapay zekâ belirlesin', desc: 'Her çalıştırmada trendleri araştırıp konuyu, kitleyi ve stili kendisi seçer (önerilen)' },
                  { id: 'manual' as const, icon: PenLine, label: 'Konuyu ben belirleyeyim', desc: 'Her çalıştırma yazdığınız konuda yeni bir tasarım üretir' },
                ]).map(({ id, icon: Icon, label, desc }) => (
                  <button key={id} type="button" onClick={() => setNicheMode(id)} aria-pressed={nicheMode === id}
                    className={`text-left p-3 rounded-xl border-2 transition-colors ${nicheMode === id ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/10' : 'border-slate-200 dark:border-slate-700'}`}>
                    <span className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white"><Icon className="w-4 h-4 text-purple-500" />{label}</span>
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{desc}</span>
                  </button>
                ))}
              </fieldset>

              <fieldset>
                <legend className={labelClass}>Tasarım hangi kumaş rengi için?</legend>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {FABRIC_OPTIONS.map((option) => (
                    <button key={option.id} type="button" onClick={() => setDesignFabric(option.id)} aria-pressed={designFabric === option.id}
                      className={`text-left p-3 rounded-xl border-2 transition-colors ${designFabric === option.id ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/10' : 'border-slate-200 dark:border-slate-700'}`}>
                      <span className="block text-sm font-bold text-slate-900 dark:text-white">{option.label}</span>
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{option.desc}</span>
                    </button>
                  ))}
                </div>
                {designFabric !== 'universal' && (
                  <label className="mt-2 flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input type="checkbox" className="mt-0.5 w-4 h-4 accent-purple-600" checked={fabricVariant} onChange={(e) => setFabricVariant(e.target.checked)} />
                    <span>
                      <strong>{designFabric === 'light' ? 'Koyu' : 'Açık'} kumaş için yapay zekâ ile ayrı versiyon üret</strong>
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400">Klasörde {designFabric === 'light' ? 'koyu' : 'açık'} renkli mockup varsa tasarım o kumaşa uygun renklerle yeniden çizilir ve o mockup&apos;lara basılır (bir görsel üretimi daha). Kapalıysa otomatik renk dönüşümü kullanılır.</span>
                    </span>
                  </label>
                )}
              </fieldset>

              {nicheMode === 'auto' ? (
                <>
                  <div className="rounded-2xl bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/30 p-3.5 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                    <p className="font-bold text-violet-800 dark:text-violet-300">Yapay zekâ her çalıştırmada şunlara bakar:</p>
                    <ul className="list-disc pl-4 space-y-0.5">
                      <li>Önümüzdeki 6-10 haftadaki ABD özel günleri (ör. Cadılar Bayramı, Şükran Günü, Noel)</li>
                      <li>Mağazanızda en çok favorilenen ve görüntülenen ürünler</li>
                      <li>Kelime havuzundaki Etsy arama verileri ve rekabet</li>
                      <li>Web araması açıksa güncel trendler, Pinterest ve Google Trends sinyalleri</li>
                      <li>Bu otomasyonun son nişleri (aynı konuyu tekrarlamaz)</li>
                    </ul>
                    <p>Seçtiği niş ve nedeni her çalıştırmanın &quot;Ayrıntılar&quot; ekranında görünür. Web araması ve araştırma modeli admin panelinden yönetilir.</p>
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="aw-focus">Genel yön (isteğe bağlı)</label>
                    <input id="aw-focus" className={inputClass} value={researchFocus} onChange={(e) => setResearchFocus(e.target.value)} placeholder="Ör. aile ve evcil hayvan esprileri, retro tarzlar — boş bırakılırsa tamamen serbest" />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className={labelClass} htmlFor="aw-niche">Tasarım konusu / niş</label>
                    <input id="aw-niche" className={inputClass} value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="Ör. funny cat mom quotes, retro camping, teacher appreciation" />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="aw-audience">Hedef kitle (isteğe bağlı)</label>
                    <input id="aw-audience" className={inputClass} value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Ör. cat moms, dog lovers, nurses" />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="aw-notes">Stil ve ek istekler (isteğe bağlı)</label>
                    <textarea id="aw-notes" rows={3} className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ör. vintage distressed look, en fazla 3 renk" />
                  </div>
                </>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <label className="flex items-start gap-3 p-3.5 rounded-2xl border-2 border-slate-200 dark:border-slate-700 cursor-pointer has-[:checked]:border-purple-500 has-[:checked]:bg-purple-50 dark:has-[:checked]:bg-purple-500/10">
                <input type="checkbox" className="mt-0.5 w-4 h-4 accent-purple-600" checked={schedule.generateVideo === true} onChange={(e) => setSchedule((prev) => ({ ...prev, generateVideo: e.target.checked }))} />
                <span className="text-sm">
                  <span className="font-bold text-slate-900 dark:text-white">Tanıtım videosu üret</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">Tasarım ve basıldığı mockup referans alınarak kısa (Omni Flash 5 sn, Veo 8 sn), gerçekçi bir video üretilir ve ilana eklenir. Ek maliyet ve birkaç dakika süre ekler.</span>
                </span>
              </label>

              {schedule.generateVideo && (
                <>
                  <fieldset>
                    <legend className={labelClass}>Video yönü</legend>
                    <div className="grid grid-cols-2 gap-2">
                      {VIDEO_ASPECTS.map((aspect) => (
                        <button key={aspect.id} type="button" onClick={() => updateVideo({ aspectRatio: aspect.id })} aria-pressed={(video.aspectRatio ?? '16:9') === aspect.id}
                          className={`text-left p-3 rounded-xl border-2 transition-colors ${(video.aspectRatio ?? '16:9') === aspect.id ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/10' : 'border-slate-200 dark:border-slate-700'}`}>
                          <span className="block text-sm font-bold text-slate-900 dark:text-white">{aspect.label}</span>
                          <span className="block text-[11px] text-slate-500 dark:text-slate-400">{aspect.desc}</span>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Video modeli ve video talimatı (prompt) admin panelinden yönetilir; tasarımın basıldığı mockup görseli videoya referans olarak verilir. Video modelleri kare formatı desteklemez.
                  </p>
                </>
              )}
            </>
          )}

          {step === 3 && <ScheduleSection schedule={schedule} onChange={setSchedule} />}

          {step === 4 && (
            <>
              <fieldset className="space-y-2">
                <legend className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Hazırlanan ilan ne olsun?</legend>
                {([
                  { id: 'review', title: 'Önce incelemeye al (önerilir)', desc: 'İlan Hazır İlanlar sekmesinde bekler; düzenleyip onayladığınızda hemen veya seçtiğiniz zamanda Etsy\'de yayına alınır.' },
                  { id: 'draft', title: 'Doğrudan Etsy taslağı', desc: 'İlan her çalıştırmada Etsy\'de taslak olarak açılır.' },
                ] as const).map((option) => {
                  const active = (schedule.listingMode ?? 'review') === option.id;
                  return (
                    <label key={option.id} className={`flex items-start gap-3 p-3 rounded-2xl border-2 cursor-pointer transition-all ${active ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-500/60' : 'border-slate-200 dark:border-slate-700'}`}>
                      <input type="radio" name="listing-mode" className="mt-0.5 w-4 h-4 accent-indigo-600" checked={active} onChange={() => setSchedule({ ...schedule, listingMode: option.id })} />
                      <span className="text-xs">
                        <span className="font-bold text-slate-800 dark:text-slate-100">{option.title}</span>
                        <span className="block mt-0.5 text-slate-500 dark:text-slate-400">{option.desc}</span>
                      </span>
                    </label>
                  );
                })}
              </fieldset>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-3.5 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                <p className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5"><Store className="w-3.5 h-3.5 text-amber-500" /> Etsy mağaza ayarları</p>
                <p>Kargo profili, hazırlık süresi, iade politikası, üretici ve otomatik yenileme klasörde seçilir (Mockup&apos;lar › klasör menüsü › Klasör ayarları); bu klasörden açılan tüm ilanlar onları kullanır.</p>
                <p>Otomatik yenileme: <strong>{folderEtsy.shouldAutoRenew ? 'Açık' : 'Kapalı'}</strong></p>
              </div>
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-3.5 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                <p className="font-bold text-slate-800 dark:text-slate-100">Özet</p>
                <p>Klasör: <strong>{folder?.name ?? '—'}</strong> · {counts.print} mockup&apos;a basılır</p>
                <p>Kategori: <strong>{category?.path || category?.name || (taxonomyId > 0 ? `#${taxonomyId}` : '—')}</strong></p>
                <p>Varyasyon: <strong>{variationSource ? `${variationSource.name} (${variationSummary?.count ?? 0})` : `Tek fiyat $${fixedPrice}`}</strong></p>
                <p>Kitle: <strong>{AUDIENCE_OPTIONS.find((o) => o.id === audienceGroup)?.label ?? 'Belirtilmedi'}</strong> · Kumaş: <strong>{FABRIC_OPTIONS.find((o) => o.id === designFabric)?.label}{designFabric !== 'universal' && fabricVariant ? ' + diğer kumaş versiyonu' : ''}</strong></p>
                <p>Konu: <strong>{nicheMode === 'auto' ? `Yapay zekâ belirler${researchFocus.trim() ? ` (${researchFocus.trim()})` : ''}` : niche || '—'}</strong></p>
                <p>Video: <strong>{schedule.generateVideo ? (video.aspectRatio === '9:16' ? 'Dikey' : 'Yatay') : 'Yok'}</strong> · Mağaza bölümü: <strong>yapay zekâ seçer</strong></p>
                <p>Zaman: <strong>{schedule.enabled ? 'Zamanlanmış' : 'Yalnızca elle çalıştırma'}</strong> · Sonuç: <strong>{(schedule.listingMode ?? 'review') === 'review' ? 'Hazır İlanlar\'da incelemeye alınır' : 'Etsy taslak ilanı'}</strong></p>
                {etsyWarnings.length > 0 && (
                  <p className="text-amber-700 dark:text-amber-400 flex gap-1 pt-1"><AlertTriangle className="w-3.5 h-3.5 shrink-0" />Klasörde {etsyWarnings.join(' ve ')} seçilmemiş: tasarım ve mockup&apos;lar üretilir, ilan adımı atlanır.</p>
                )}
              </div>
            </>
          )}

          {currentErrors.length > 0 && (
            <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-0.5 list-disc pl-5" role="status">
              {currentErrors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          )}
        </div>

        {/* Alt gezinme */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800">
          <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1) as Step)} disabled={step === 0}
            className="btn btn-secondary disabled:opacity-40">
            <ChevronLeft className="w-4 h-4" /> Geri
          </button>
          {isLast ? (
            <div className="flex gap-2 ml-auto">
              <button type="button" onClick={() => handleSave(false)} disabled={isSaving} className="btn btn-secondary">
                {isSaving ? <Spinner className="w-4 h-4" /> : <Save className="w-4 h-4" />} Kaydet
              </button>
              <button type="button" onClick={() => handleSave(true)} disabled={isSaving} className="btn btn-primary">
                <Rocket className="w-4 h-4" /> Kaydet ve şimdi dene
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setStep((s) => Math.min(4, s + 1) as Step)} disabled={currentErrors.length > 0} className="btn btn-primary ml-auto disabled:opacity-50">
              İleri <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </DialogPanel>
    </div>
  );
}
