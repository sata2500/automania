/**
 * Otomasyon hattının saf (yan etkisiz) karar mantığı: hangi mockup'ların kullanılacağı, tasarım prompt'u,
 * SEO anahtar kelimeleri, sıradaki adım ve çalıştırmanın sonucu. Çalıştırıcı (`automation-runner.ts`) bunları
 * kullanır; ayrı tutuldukları için birim testleriyle doğrulanır.
 */
import type { MockupItem } from '@/types/pod';
import type {
  AutomationRunSteps,
  AutomationStepName,
  PodTemplateMockupConfig,
  PodTemplateSeoHints,
} from '@/types/templates';
import { buildFolderMockupConfig } from '@/lib/folder-template';
import { MAX_ETSY_PHOTOS } from '@/lib/etsy-preflight';
import { fillPrompt } from '@/lib/prompt-registry';

// Video SEO metninden sonra üretilir: admin video prompt'u ürün başlığını ({{title}}) kullanabilir.
export const AUTOMATION_STEP_ORDER: AutomationStepName[] = [
  'nicheResearch',
  'designGeneration',
  'backgroundRemoval',
  'mockupRender',
  'seoGeneration',
  'videoGeneration',
  'listingCreation',
];

/** Başarısız olsa da çalıştırmayı başarısız saymayan adımlar. */
// Niş araştırması başarısız olursa şablondaki niş (yoksa genel bir konu) ile devam edilir.
const OPTIONAL_STEPS = new Set<AutomationStepName>(['nicheResearch', 'videoGeneration']);

export function isStepDone(status: string | undefined): boolean {
  return status === 'completed' || status === 'skipped' || status === 'failed';
}

/** Henüz bitmemiş ilk adım (yoksa null). */
export function nextPendingStep(steps: Partial<AutomationRunSteps>): AutomationStepName | null {
  // Niş araştırması adımı sonradan eklendi: bu adımı içermeyen eski çalıştırmalar onu atlar.
  return AUTOMATION_STEP_ORDER.find((name) => (name === 'nicheResearch' && !steps[name] ? false : !isStepDone(steps[name]?.status))) ?? null;
}

/** Tüm adımlar bittiğinde çalıştırmanın durumu: zorunlu bir adım başarısızsa 'failed'. */
export function deriveRunOutcome(steps: Partial<AutomationRunSteps>): { status: 'completed' | 'failed'; errorMessage: string | null } {
  for (const name of AUTOMATION_STEP_ORDER) {
    const step = steps[name];
    if (step?.status === 'failed' && !OPTIONAL_STEPS.has(name)) {
      return { status: 'failed', errorMessage: step.error || `${name} adımı başarısız oldu.` };
    }
  }
  return { status: 'completed', errorMessage: null };
}

function matchesFabric(mockup: MockupItem, fabricType: PodTemplateMockupConfig['fabricType'] | undefined): boolean {
  if (!fabricType || fabricType === 'all') return true;
  return mockup.apparelType === fabricType || mockup.apparelType === 'any';
}

/**
 * Şablonun mockup seçimini çalışma alanındaki gerçek mockup'larla eşleştirir.
 * - Baskı alanlı mockup'lar kumaş filtresine göre süzülür ve tasarım yerleştirilerek render edilir.
 * - Statik mockup'lar (beden tablosu vb.) olduğu gibi eklenir.
 * - Toplam fotoğraf sayısı Etsy sınırına (20) indirilir; ilk video mockup'ı ayrıca döner.
 */
export function selectAutomationMockups(mockups: MockupItem[], templateConfig: Partial<PodTemplateMockupConfig> | null | undefined) {
  // Klasöre bağlı şablonlar her çalıştırmada klasörün güncel içeriğini kullanır
  // (klasöre eklenen/çıkarılan mockup'lar şablonu yeniden kaydetmeden geçerli olur).
  const config = templateConfig?.folderId
    ? { ...buildFolderMockupConfig(templateConfig.folderId, mockups), fabricType: templateConfig.fabricType ?? 'all' }
    : templateConfig;
  const byId = new Map(mockups.map((m) => [m.id, m]));
  const pick = (ids: string[] | undefined) => (ids ?? []).map((id) => byId.get(id)).filter((m): m is MockupItem => Boolean(m));

  const render = pick(config?.printAreaMockupIds)
    .filter((m) => !m.isVideo && m.hasPrintArea !== false && (m.printAreas?.length ?? 0) > 0)
    .filter((m) => matchesFabric(m, config?.fabricType));
  const statics = pick(config?.staticMockupIds).filter((m) => !m.isVideo);
  const video = pick(config?.videoMockupIds).find((m) => m.isVideo) ?? null;

  const renderLimited = render.slice(0, MAX_ETSY_PHOTOS);
  const staticLimited = statics.slice(0, Math.max(0, MAX_ETSY_PHOTOS - renderLimited.length));
  return { render: renderLimited, statics: staticLimited, video };
}

/**
 * Otomasyonun tasarım konsepti: "Tasarım üretimi" talimatındaki {{concept}} değişkenine yazılan veri
 * (niş, hedef kitle, ürün tipi, notlar). Talimat metni admin panelindedir; burada yalnızca veri toplanır.
 */
export function buildDesignConcept(hints: Partial<PodTemplateSeoHints> | null | undefined): string {
  return [
    `Niche: ${hints?.primaryNiche?.trim() || 'a trending gift theme'}`,
    `Target audience: ${hints?.targetAudience?.trim() || 'a broad Etsy audience'}`,
    `Product: ${hints?.productType?.trim() || 'apparel'}`,
    `Notes: ${hints?.customNotes?.trim() || 'none'}`,
  ].join('\n');
}

/**
 * SEO adımına verilecek aday anahtar kelimeler: şablonun niş/kitle/ürün bilgisi ve havuzdan ilgili kelimeler.
 * Tekrarlar ve boşlar atılır; en fazla 20 kelime döner.
 */
export function buildAutomationKeywords(hints: Partial<PodTemplateSeoHints> | null | undefined, poolKeywords: string[] = []): string[] {
  const niche = hints?.primaryNiche?.trim().toLowerCase() || '';
  const audience = hints?.targetAudience?.trim().toLowerCase() || '';
  const product = hints?.productType?.trim().toLowerCase() || '';
  const productWord = product.split(/[\s,/]+/).find(Boolean) || 'shirt';

  const candidates = [
    niche,
    niche && `${niche} ${productWord}`,
    niche && `${niche} gift`,
    audience && `${audience} gift`,
    audience && `gift for ${audience}`,
    product,
    ...poolKeywords.map((k) => k.trim().toLowerCase()),
  ];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const keyword of candidates) {
    if (!keyword || keyword.length > 60 || seen.has(keyword)) continue;
    seen.add(keyword);
    result.push(keyword);
    if (result.length >= 20) break;
  }
  return result;
}

/** Havuz araması için niş ve hedef kitleden anlamlı kelimeler (3+ harf, en fazla 5). */
export function topicSearchTerms(hints: Partial<PodTemplateSeoHints> | null | undefined): string[] {
  const stop = new Set(['and', 'for', 'the', 'with', 'gift', 'gifts', 'shirt', 'tee']);
  const words = `${hints?.primaryNiche || ''} ${hints?.targetAudience || ''}`
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 3 && !stop.has(w));
  return Array.from(new Set(words)).slice(0, 5);
}

/** Kumaş rengi koyu olan mockup'lar için tasarımın açık tonlu sürümü kullanılır. */
export function needsDarkGarmentDesign(mockup: Pick<MockupItem, 'apparelType'>): boolean {
  return mockup.apparelType === 'dark';
}

/** Admin panelindeki "Video üretimi" talimatının değişkenlerini doldurur. */
export function fillVideoPromptTemplate(
  template: string,
  values: { title: string; designPrompt: string; product: string; niche: string },
): string {
  return fillPrompt(template, {
    title: values.title,
    designPrompt: values.designPrompt,
    userPrompt: values.designPrompt,
    product: values.product,
    niche: values.niche,
    selectedStyle: values.niche,
  });
}

/** Niş araştırmasının çıktısı (çalıştırma kaydında saklanır). */
export type NicheResearchOutput = {
  niche?: string;
  targetAudience?: string;
  style?: string;
  designBrief?: string;
  keywords?: string[];
};

/**
 * Çalıştırmada kullanılacak SEO/tasarım ipuçları: otomatik modda araştırmanın bulduğu niş, kitle ve stil
 * şablondaki değerlerin yerine geçer; ürün tipi ve şablon notları korunur.
 */
export function effectiveSeoHints(
  hints: Partial<PodTemplateSeoHints> | null | undefined,
  research: NicheResearchOutput | null | undefined,
): PodTemplateSeoHints {
  const base: PodTemplateSeoHints = {
    productType: hints?.productType ?? '',
    targetAudience: hints?.targetAudience ?? '',
    customNotes: hints?.customNotes ?? '',
    primaryNiche: hints?.primaryNiche ?? '',
    nicheMode: hints?.nicheMode,
    researchFocus: hints?.researchFocus,
  };
  if (!research?.niche) return base;
  const notes = [research.style ? `Style: ${research.style}.` : '', research.designBrief ?? '', base.customNotes].filter(Boolean).join(' ');
  return {
    ...base,
    primaryNiche: research.niche,
    targetAudience: research.targetAudience || base.targetAudience,
    customNotes: notes,
  };
}
