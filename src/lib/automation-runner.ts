/**
 * "Kur ve Unut" otomasyon hattı.
 * Adımlar: Tasarım üretimi → Arka plan kaldırma → Mockup render → (isteğe bağlı) Video → SEO metni → Etsy taslak ilanı
 *
 * Hat devam ettirilebilir: her adımın sonucu `automation_runs` kaydına yazılır ve tamamlanan adımlar bir daha
 * çalışmaz. Bir çağrının süre bütçesi dolarsa çalıştırma 'pending' durumuna geri alınır ve sonraki çağrı
 * (iç token ile yeni fonksiyon çağrısı, kullanıcının takip isteği veya saatlik zamanlayıcı) kaldığı yerden sürdürür.
 *
 * Bu modül `POST /api/automation/run` (after() ile), `POST /api/automation/execute` (iç token),
 * takip uç noktası ve zamanlayıcı tarafından çağrılır.
 */
import { db, sql } from '@/lib/db';
import { automationRuns, podTemplates, userWorkspaces } from '@/db/schema';
import { and, eq, inArray, lt, or, sql as drizzleSql } from 'drizzle-orm';
import { loadAIConfig, generateImage } from '@/lib/ai-provider';
import { removeChromaBackground } from '@/lib/chroma-key';
import { KEY_COLORS, keyColorPromptValues, pickKeyBackground, type KeyBackground } from '@/lib/key-background';
import { uploadToR2, isR2Configured, deleteFromR2 } from '@/lib/r2';
import { generateListingSku } from '@/lib/sku';
import { runSkuOf } from '@/lib/run-sku';
import { MANUAL_TEMPLATE_ID, manualTemplateFor } from '@/lib/manual-listing';
import { loadListingDefaults } from '@/lib/user-settings';
import { optimizeImageForStorage } from '@/lib/media-optimizer';
import { AUTOMATION_DESIGN_FOLDER_ID } from '@/lib/design-library';
import { createOwnedUploadName } from '@/lib/upload-security';
import { getConfiguredSecret } from '@/lib/internal-auth';
import { loadImageForUser } from '@/lib/media-source';
import { writeAuditLog } from '@/lib/audit-log';
import { getValidEtsyToken } from '@/lib/etsy-token-manager';
import { sanitizeEtsyTags } from '@/lib/etsy-format';
import { validateWhoMade } from '@/lib/etsy-preflight';
import { createEtsyDraftListing, type EtsyDraftListingInput } from '@/lib/etsy-listing-service';
import { generateListingContent } from '@/lib/listing-generator';
import { detectPrimarySubject } from '@/lib/listing-subject';
import { researchNiche } from '@/lib/niche-research';
import { fetchTaxonomyProperties, selectableTaxonomyProperties, validateTaxonomyPropertyValues, type EtsyTaxonomyProperty } from '@/lib/etsy-taxonomy-properties';
import { describeAiError } from '@/lib/ai-retry';
import { fillPrompt } from '@/lib/prompt-registry';
import { loadPrompt } from '@/lib/prompt-settings';
import {
  AUTOMATION_STEP_ORDER,
  buildAutomationKeywords,
  buildDesignConcept,
  deriveRunOutcome,
  fillVideoPromptTemplate,
  effectiveSeoHints,
  type NicheResearchOutput,
  isStepDone,
  audienceGroupLabel,
  fabricLabel,
  garmentsLabel,
  variantFabricFor,
  nextPendingStep,
  selectAutomationMockups,
  topicSearchTerms,
} from '@/lib/automation-plan';
import type { DesignItem, EtsyVariationRow, MockupItem } from '@/types/pod';
import { variationConfigFromRows } from '@/lib/folder-template';
import type { AutomationRunSteps, AutomationStepName, GeneratedSeoData, ListingReviewState, PodTemplateEtsyListingSettings } from '@/types/templates';

export type AutomationRunInput = {
  runId: string;
  templateId: string;
  userId: string;
};

export type AutomationRunOutcome =
  | { ok: true; runId: string; resumed?: boolean }
  | { ok: false; runId: string; reason: 'not_found' | 'not_pending' | 'failed' | 'cancelled'; error?: string };

/** Bir çağrıda yeni adım başlatmak için kalan süre (fonksiyon sınırı 300 sn). */
const INVOCATION_BUDGET_MS = 170_000;
/** Video adımı yalnızca en az bu kadar süre kalmışsa başlatılır; aksi halde yeni çağrıya bırakılır. */
const VIDEO_MIN_REMAINING_MS = 260_000;
const VIDEO_MAX_WAIT_MS = 230_000;
/**
 * 'running' durumundaki bir çalıştırma bu kadar süredir güncellenmediyse fonksiyonu süre sınırında (300 sn)
 * kesilmiş demektir: takip, zamanlayıcı veya kullanıcı etkinliği onu kaldığı adımdan sürdürür.
 */
export const DEAD_RUN_MS = 6 * 60_000;
/** Aynı adım en fazla bu kadar kez başlatılır (kesilip sürdürülen adımlar dahil). */
const MAX_STEP_ATTEMPTS = 3;
/**
 * Otomasyonun kendi ürettiği görseller (4K ham çıktı ve tasarım PNG'leri) depodan bu sınıra kadar okunur:
 * 4K ham PNG'ler 20 MB'lık genel görsel sınırını aşabilir.
 */
const GENERATED_IMAGE_MAX_BYTES = 100 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export type RunRow = typeof automationRuns.$inferSelect;
export type TemplateRow = typeof podTemplates.$inferSelect;

class StepSkipped extends Error {}

/** Otomasyonun ürettiği tasarımların Tasarımlar sekmesindeki klasörü. */
export const AUTOMATION_DESIGN_FOLDER = { id: AUTOMATION_DESIGN_FOLDER_ID, name: 'Otomasyon Tasarımları', isCustom: true, type: 'design' as const };

async function loadWorkspaceMockups(userId: string): Promise<MockupItem[]> {
  const [workspace] = await db
    .select({ mockups: userWorkspaces.mockups })
    .from(userWorkspaces)
    .where(eq(userWorkspaces.userId, userId));
  return (workspace?.mockups as MockupItem[] | undefined) ?? [];
}

/**
 * Şablon, Etsy SEO sekmesindeki bir varyasyon şablonuna bağlıysa onun güncel satırları kullanılır
 * (fiyat güncellemeleri şablonu yeniden kaydetmeden geçerli olur); bulunamazsa kayıtlı kopya.
 */
async function resolveVariationRows(userId: string, config: TemplateRow['variationConfig']): Promise<NonNullable<TemplateRow['variationConfig']>['rows']> {
  const fallback = config?.rows ?? [];
  if (!config?.sourceTemplateId) return fallback;
  try {
    const [workspace] = await db
      .select({ templates: userWorkspaces.etsyVariationTemplates })
      .from(userWorkspaces)
      .where(eq(userWorkspaces.userId, userId));
    const source = ((workspace?.templates as Array<{ id: string; variations?: EtsyVariationRow[] }> | null) ?? [])
      .find((t) => t.id === config.sourceTemplateId);
    return source?.variations?.length ? variationConfigFromRows(source.variations).rows : fallback;
  } catch (error) {
    console.warn('[Automation] Variation template lookup failed; using saved rows.', error instanceof Error ? error.message : error);
    return fallback;
  }
}

/** Şablonun dolu Etsy ayarları geçerlidir; boş bırakılanlar kullanıcının ilan varsayılanlarından gelir. */
function mergeEtsySettings(
  template: Partial<PodTemplateEtsyListingSettings> | null | undefined,
  defaults: PodTemplateEtsyListingSettings,
): PodTemplateEtsyListingSettings {
  const merged: Record<string, unknown> = { ...defaults };
  for (const [key, value] of Object.entries(template ?? {})) {
    const empty = value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
    if (!empty) merged[key] = value;
  }
  return merged as unknown as PodTemplateEtsyListingSettings;
}

async function jpegForListing(buffer: Buffer): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  // mozjpeg: aynı görsel kalitede ~%10-20 daha küçük dosya; Etsy JPEG bekler.
  return sharp(buffer).flatten({ background: '#ffffff' }).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
}

/**
 * Tasarım görselini depoya kayıpsız, en yüksek sıkıştırmalı PNG olarak yazar; saydam kenar boşlukları
 * kırpılır (bkz. media-optimizer). Mockup'lar da bu kırpılmış görselle hazırlanır.
 */
async function storeDesignImage(userId: string, name: string, png: Buffer, size: { width: number; height: number }) {
  const stored = await optimizeImageForStorage(png, 'image/png', 'design').catch(() => null);
  const buffer = stored?.buffer ?? png;
  const mimeType = stored?.mimeType ?? 'image/png';
  const { url } = await uploadToR2(buffer, createOwnedUploadName(userId, name, mimeType), mimeType);
  return { url, buffer, width: stored?.width || size.width, height: stored?.height || size.height };
}

/** Veo çıktısını (Google Files URI veya data URL) kullanıcının depolamasına kopyalar; ilan bu dosyayı kullanır. */
async function persistGeneratedVideo(userId: string, runId: string, uri: string, googleApiKey: string): Promise<string> {
  let buffer: Buffer;
  if (uri.startsWith('data:')) {
    buffer = Buffer.from(uri.split(',')[1] || '', 'base64');
  } else {
    const url = new URL(uri);
    // Yalnızca Google'ın dosya sunucusundan indirilir; API anahtarı başka bir adrese gönderilmez.
    if (url.protocol !== 'https:' || url.hostname !== 'generativelanguage.googleapis.com') {
      throw new Error('Video beklenmeyen bir adresten döndü.');
    }
    const res = await fetch(url, { headers: { 'x-goog-api-key': googleApiKey } });
    if (!res.ok) throw new Error(`Video indirilemedi (HTTP ${res.status}).`);
    buffer = Buffer.from(await res.arrayBuffer());
  }
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_VIDEO_BYTES) throw new Error('Video boyutu geçersiz.');
  const upload = await uploadToR2(buffer, createOwnedUploadName(userId, `auto-video-${runId}`, 'video/mp4'), 'video/mp4');
  return upload.url;
}

/** Etsy mağaza bölümleri (bağlantı yoksa veya alınamazsa boş liste). */
async function loadShopSections(userId: string): Promise<Array<{ shop_section_id: number | string; title: string }>> {
  try {
    const token = await getValidEtsyToken(userId);
    if (!token.success || !token.access_token || !token.shop_id) return [];
    const res = await fetch(`https://openapi.etsy.com/v3/application/shops/${token.shop_id}/sections`, {
      headers: {
        'x-api-key': `${token.api_key || process.env.ETSY_API_KEY}:${token.shared_secret || process.env.ETSY_SHARED_SECRET || ''}`,
        Authorization: `Bearer ${token.access_token}`,
      },
    });
    if (!res.ok) return [];
    const data = await res.json() as { results?: Array<{ shop_section_id: number; title: string }> };
    return (data.results ?? []).filter((s) => s.title);
  } catch (error) {
    console.warn('[Automation] Shop sections could not be loaded', error instanceof Error ? error.message : error);
    return [];
  }
}

/** Havuzdan şablonun nişiyle ilgili, Etsy verisi olan anahtar kelimeler. */
async function loadRelatedPoolKeywords(terms: string[]): Promise<string[]> {
  if (terms.length === 0) return [];
  try {
    const patterns = terms.map((t) => `%${t.replace(/[%_\\]/g, '')}%`);
    const rows = await sql`
      SELECT keyword FROM keyword_pool
      WHERE LOWER(keyword) LIKE ANY(${patterns})
      ORDER BY COALESCE(opportunity_score, etsy_score, 0) DESC
      LIMIT 10
    `;
    return rows.map((row) => String(row.keyword));
  } catch (error) {
    console.warn('[Automation] Keyword pool lookup failed', error instanceof Error ? error.message : error);
    return [];
  }
}

// ─── Adımlar ─────────────────────────────────────────────────────────────────

type StepContext = {
  run: RunRow;
  template: TemplateRow;
  userId: string;
  runId: string;
  deadline: number;
  /** Bu çağrıda üretilen ve bir sonraki adımın kullanacağı tasarım (yeniden indirmeyi önler) */
  designPng?: Buffer;
  /** Diğer kumaş rengi için yapay zekâ versiyonu (bu çalıştırmada üretildiyse) */
  variantPng?: Buffer;
  /** Çalıştırmanın adım kayıtları (niş araştırması çıktısı buradan okunur) */
  steps?: AutomationRunSteps;
  /** Adım içinde ara kayıt (uzun adımlar kesilirse kaldığı yerden sürsün) */
  persist?: (patch: Partial<RunRow>) => Promise<void>;
};

/** Bu çalıştırmanın tasarım/SEO ipuçları: otomatik modda niş araştırmasının sonucu kullanılır. */
function runHints(ctx: StepContext) {
  return effectiveSeoHints(ctx.template.seoHints, ctx.steps?.nicheResearch?.output as NicheResearchOutput | undefined);
}

type StepResult = { patch?: Partial<RunRow>; output?: Record<string, unknown>; skipped?: string; warning?: string };

/** Tasarım üretimi adımının çıktısı: arka plan kaldırma ayrı adımda (gerekirse ayrı çağrıda) ham görsellerden yapılır. */
type DesignStepOutput = {
  prompt: string;
  finalPrompt: string;
  keyBackground: KeyBackground;
  /** İlanın SKU'su: tasarımlar bu kodla adlandırılır, ilan Etsy'de bu SKU ile açılır. */
  sku: string;
  rawUrl: string;
  rawMimeType: string;
  /** Diğer kumaş rengi için yapay zekâ versiyonu (null: istenmedi/gerekmedi) */
  variant?: { fabric: 'light' | 'dark'; rawUrl: string | null; error?: string } | null;
};

/**
 * Görsel modelinin ham çıktısını (perde zeminli) sonraki adım için depolar. Önce kayıpsız PNG olarak
 * sıkıştırılır: pikseller birebir aynı kalır (arka plan kaldırma kalitesi değişmez), dosya küçülür;
 * depoya yazma/okuma hızlanır ve kumaş versiyonu için modele küçültülmeden gönderilebilir.
 * Sıkıştırma başarısız olursa veya kazanç yoksa özgün dosya saklanır.
 */
async function storeRawImage(userId: string, name: string, data: Buffer, mimeType: string): Promise<{ url: string; buffer: Buffer; mimeType: string }> {
  // Ham görsel kırpılmaz: zemin rengi ve kompozisyon arka plan kaldırmada olduğu gibi kullanılır.
  const optimized = await optimizeImageForStorage(data, mimeType, 'design', { trim: false }).catch(() => null);
  const buffer = optimized?.optimized ? optimized.buffer : data;
  const storedMime = optimized?.optimized ? optimized.mimeType : mimeType;
  const { url } = await uploadToR2(buffer, createOwnedUploadName(userId, name, storedMime), storedMime);
  return { url, buffer, mimeType: storedMime };
}

/**
 * Tasarım üretimi: ana tasarımı ve (ayar açıksa) diğer kumaş rengi versiyonunu üretir, ham hallerini depolar.
 * Ana tasarım üretildikten sonra ara kayıt yapılır: çağrı süre sınırında kesilirse adım yeniden başladığında
 * ana tasarım tekrar üretilmez, yalnızca eksik versiyon üretilir.
 */
async function runDesignGeneration(ctx: StepContext): Promise<StepResult> {
  const { template, userId, runId } = ctx;
  const config = await loadAIConfig();
  const hints = runHints(ctx);
  const previous = ctx.steps?.designGeneration?.output as Partial<DesignStepOutput> | undefined;
  let output: Partial<DesignStepOutput> = previous?.rawUrl ? { ...previous } : {};
  let rawMain: Buffer | null = null;

  if (!output.rawUrl) {
    const research = ctx.steps?.nicheResearch?.output as NicheResearchOutput | undefined;
    const basePrompt = buildDesignConcept(hints);
    // Perde rengi konuya göre seçilir: yeşil ağırlıklı konularda (Noel, orman…) magenta, tasarımın yeşilleri korunur.
    const keyBackground = pickKeyBackground(`${hints.primaryNiche ?? ''} ${basePrompt}`);
    const finalPrompt = fillPrompt(await loadPrompt('ai_prompt_generate_design'), {
      concept: basePrompt,
      style: research?.style?.trim() || 'not specified',
      audienceGroup: audienceGroupLabel(hints.audienceGroup),
      fabric: fabricLabel(hints.designFabric),
      ...keyColorPromptValues(keyBackground),
    });
    const generatedImages = await generateImage(config, { prompt: finalPrompt });
    if (!generatedImages || generatedImages.length === 0) throw new Error('AI tasarımı üretemedi.');
    if (!isR2Configured()) throw new Error('Depolama (R2) yapılandırılmamış.');
    const stored = await storeRawImage(userId, `auto-raw-${runId}`, Buffer.from(generatedImages[0].data, 'base64'), generatedImages[0].mimeType || 'image/png');
    rawMain = stored.buffer;
    output = {
      prompt: basePrompt,
      finalPrompt,
      keyBackground,
      sku: generateListingSku(hints.productType || template.seoHints?.productType),
      rawUrl: stored.url,
      rawMimeType: stored.mimeType,
    };
    if (ctx.steps && ctx.persist) {
      ctx.steps.designGeneration = { ...ctx.steps.designGeneration!, output };
      await ctx.persist({ steps: ctx.steps });
    }
  }

  if (output.variant === undefined) {
    output.variant = await createFabricVariant(ctx, config, {
      rawImage: rawMain ?? await loadImageForUser(userId, output.rawUrl!, { maxBytes: GENERATED_IMAGE_MAX_BYTES }),
      mimeType: output.rawMimeType || 'image/png',
      keyBackground: output.keyBackground ?? 'green',
    });
  }
  const variant = output.variant;
  return {
    output,
    ...(variant?.error ? { warning: `${variant.fabric === 'dark' ? 'Koyu' : 'Açık'} kumaş versiyonu üretilemedi; otomatik renk dönüşümü kullanılacak. ${variant.error}` } : {}),
  };
}

/**
 * Arka plan kaldırma: ana tasarımın perde zeminini, kumaş versiyonunun ise (siyah zemin veya plaka dahil)
 * zeminini kaldırır; ikisini de SKU adıyla Tasarımlar sekmesine ekler ve ham görselleri siler.
 */
async function runBackgroundRemoval(ctx: StepContext): Promise<StepResult> {
  const { template, userId, runId } = ctx;
  const design = ctx.steps?.designGeneration?.output as Partial<DesignStepOutput> | undefined;
  if (!design?.rawUrl) {
    // Bu sürümden önce başlamış çalıştırmalar tasarımı tek adımda işlemişti.
    if (ctx.run.generatedDesignUrl) return {};
    throw new Error('Tasarımın ham görseli bulunamadı; otomasyonu yeniden çalıştırın.');
  }
  const hints = runHints(ctx);
  const keyColor = KEY_COLORS[design.keyBackground ?? 'green'];
  const sku = design.sku || generateListingSku(hints.productType);
  const title = hints.primaryNiche || template.name;

  // Zemin kaldırıldıktan sonra saydam kenar boşlukları depolarken otomatik kırpılır.
  const main = await removeChromaBackground(await loadImageForUser(userId, design.rawUrl, { maxBytes: GENERATED_IMAGE_MAX_BYTES }), { keyColor });
  const upload = await storeDesignImage(userId, `auto-design-${runId}`, main.pngBuffer, main);
  const newDesign: DesignItem = {
    id: `design-auto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: `${sku} · ${title}`,
    folderId: AUTOMATION_DESIGN_FOLDER.id,
    src: upload.url,
    width: upload.width,
    height: upload.height,
    targetApparel: 'both',
    isProductionActive: false,
    createdAt: Date.now(),
    optimizedAt: Date.now(),
    tags: [],
    skus: [sku],
    generatedByAI: true,
    promptUsed: design.finalPrompt,
  };
  // Atomik ekleme: eşzamanlı çalıştırmalar birbirinin tasarımını silmez; updated_at değiştiği için
  // açık istemciler yeni tasarımı senkronla görür.
  await addAutomationDesign(userId, newDesign);
  ctx.designPng = upload.buffer;

  let variantUrl: string | null = null;
  let warning: string | undefined;
  const variant = design.variant;
  if (variant?.rawUrl) {
    try {
      // Model versiyonu perde yerine siyah zemine veya dolu bir plakaya çizebilir: zemin türüne göre ayıklanır.
      // Desenli zeminde hata fırlar ve o mockup'larda otomatik renk dönüşümü kullanılır.
      const { removeVariantBackground } = await import('@/lib/background-removal');
      const cleaned = await removeVariantBackground(await loadImageForUser(userId, variant.rawUrl, { maxBytes: GENERATED_IMAGE_MAX_BYTES }), keyColor);
      const variantUpload = await storeDesignImage(userId, `auto-design-${runId}-${variant.fabric}`, cleaned.pngBuffer, cleaned);
      await addAutomationDesign(userId, {
        id: `design-auto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: `${sku} · ${title} · ${variant.fabric === 'dark' ? 'koyu kumaş' : 'açık kumaş'}`,
        folderId: AUTOMATION_DESIGN_FOLDER.id,
        src: variantUpload.url,
        width: variantUpload.width,
        height: variantUpload.height,
        targetApparel: variant.fabric,
        isProductionActive: false,
        createdAt: Date.now(),
        optimizedAt: Date.now(),
        tags: [],
        skus: [sku],
        generatedByAI: true,
      });
      ctx.variantPng = variantUpload.buffer;
      variantUrl = variantUpload.url;
    } catch (error) {
      const message = describeAiError(error);
      console.warn('[Automation] Fabric variant background removal failed; automatic recolor will be used.', { runId, message });
      warning = `${variant.fabric === 'dark' ? 'Koyu' : 'Açık'} kumaş versiyonunun zemini temizlenemedi; otomatik renk dönüşümü kullanıldı. ${message.slice(0, 200)}`;
    }
  } else if (variant?.error) {
    warning = `${variant.fabric === 'dark' ? 'Koyu' : 'Açık'} kumaş versiyonu üretilemedi; otomatik renk dönüşümü kullanıldı. ${variant.error}`;
  }

  // Ham görseller artık gerekmez (silinemezse depolama temizliği sonra kaldırır).
  await deleteFromR2([design.rawUrl, ...(variant?.rawUrl ? [variant.rawUrl] : [])]).catch(() => undefined);

  return {
    patch: { generatedDesignId: newDesign.id, generatedDesignUrl: upload.url },
    output: { sku, ...(variant ? { variantFabric: variant.fabric, variantUrl } : {}) },
    ...(warning ? { warning } : {}),
  };
}

/**
 * Otomasyon tasarımının çalışma alanındaki kaydına analiz ve ilan metnini ekler: Tasarımlar sekmesinde
 * "Analiz Sonucunu Gör" yeniden yapay zekâ çağrısı gerekmeden açılır. Atomik güncelleme (yalnızca o tasarım).
 * Tasarım bu arada görsel yapay zekâ ile analiz edildiyse (Tasarımlar sekmesi) o analiz korunur.
 */
async function attachDesignInsights(userId: string, designId: string, patch: Pick<DesignItem, 'analysis' | 'seo'>) {
  const seoOnly = { seo: patch.seo };
  await sql`
    UPDATE user_workspaces
    SET designs = (
      SELECT jsonb_agg(CASE
        WHEN elem ->> 'id' <> ${designId} THEN elem
        WHEN elem -> 'analysis' ->> 'source' = 'vision' THEN elem || ${JSON.stringify(seoOnly)}::jsonb
        ELSE elem || ${JSON.stringify(patch)}::jsonb END ORDER BY ord)
      FROM jsonb_array_elements(designs) WITH ORDINALITY AS t(elem, ord)
    ),
    updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ${userId} AND designs @> ${JSON.stringify([{ id: designId }])}::jsonb
  `;
}

/** Tasarımı Tasarımlar sekmesinin "Otomasyon" bölümüne atomik olarak ekler. */
async function addAutomationDesign(userId: string, design: DesignItem) {
  const folderJson = JSON.stringify([AUTOMATION_DESIGN_FOLDER]);
  await db.insert(userWorkspaces)
    .values({ userId, designs: [design], folders: [AUTOMATION_DESIGN_FOLDER], updatedAt: new Date() })
    .onConflictDoUpdate({
      target: userWorkspaces.userId,
      set: {
        designs: drizzleSql`COALESCE(${userWorkspaces.designs}, '[]'::jsonb) || ${JSON.stringify([design])}::jsonb`,
        folders: drizzleSql`CASE WHEN COALESCE(${userWorkspaces.folders}, '[]'::jsonb) @> ${JSON.stringify([{ id: AUTOMATION_DESIGN_FOLDER.id }])}::jsonb
          THEN ${userWorkspaces.folders} ELSE COALESCE(${userWorkspaces.folders}, '[]'::jsonb) || ${folderJson}::jsonb END`,
        updatedAt: new Date(),
      },
    });
}

/**
 * Ana tasarımı görsel modeline verip diğer kumaş rengi için yeniden çizdirir ("Diğer kumaş versiyonu"
 * talimatı). Ayar kapalıysa, ana tasarım her iki kumaşa uygunsa veya klasörde o renkte mockup yoksa
 * üretilmez (null). Başarısız olursa otomasyon durmaz: o mockup'larda otomatik renk dönüşümü kullanılır.
 */
const MAX_INLINE_IMAGE_BYTES = 12 * 1024 * 1024;

async function createFabricVariant(
  ctx: StepContext,
  config: Awaited<ReturnType<typeof loadAIConfig>>,
  input: { rawImage: Buffer; mimeType: string; keyBackground: KeyBackground },
): Promise<{ fabric: 'light' | 'dark'; rawUrl: string | null; error?: string } | null> {
  const hints = runHints(ctx);
  const base = hints.designFabric ?? 'light';
  if (!hints.fabricVariant || base === 'universal') return null;
  const target = base === 'light' ? 'dark' : 'light';
  const mockups = await loadWorkspaceMockups(ctx.userId);
  const plan = selectAutomationMockups(mockups, ctx.template.mockupConfig);
  if (!plan.render.some((m) => variantFabricFor(m, base) === target)) return null;

  try {
    const prompt = fillPrompt(await loadPrompt('ai_prompt_design_variant'), {
      fabric: fabricLabel(target),
      ...keyColorPromptValues(input.keyBackground),
    });
    // Gemini satır içi görsel sınırı (~20 MB) aşılmasın: çok büyük 4K çıktılar 2K'ya küçültülüp gönderilir.
    const source = input.rawImage.byteLength > MAX_INLINE_IMAGE_BYTES
      ? { data: await (await import('sharp')).default(input.rawImage).resize(2048, 2048, { fit: 'inside' }).png().toBuffer(), mimeType: 'image/png' }
      : { data: input.rawImage, mimeType: input.mimeType };
    const images = await generateImage(config, { prompt, image: source });
    if (!images?.[0]) throw new Error('Görsel modeli versiyon üretmedi.');
    const mimeType = images[0].mimeType || 'image/png';
    const { url: rawUrl } = await storeRawImage(ctx.userId, `auto-raw-${ctx.runId}-${target}`, Buffer.from(images[0].data, 'base64'), mimeType);
    return { fabric: target, rawUrl };
  } catch (error) {
    const message = describeAiError(error);
    console.warn('[Automation] Fabric variant failed; automatic recolor will be used.', { runId: ctx.runId, message });
    return { fabric: target, rawUrl: null, error: message.slice(0, 300) };
  }
}

async function runNicheResearch(ctx: StepContext): Promise<StepResult> {
  const { template, userId, runId } = ctx;
  const hints = template.seoHints;
  if (hints?.nicheMode !== 'auto') throw new StepSkipped('Tasarım konusu şablonda belirlendi.');
  const taxonomyId = template.automationSchedule?.etsy?.taxonomyId;
  let categoryPath: string | null = null;
  if (taxonomyId) {
    const rows = await sql`SELECT path, name FROM etsy_taxonomy_cache WHERE id = ${taxonomyId} LIMIT 1`.catch(() => []);
    categoryPath = rows[0] ? String(rows[0].path || rows[0].name) : null;
  }
  const result = await researchNiche({
    userId,
    templateId: template.id,
    productType: hints?.productType || 'T-shirt',
    categoryPath,
    focus: hints?.researchFocus,
    audienceGroup: audienceGroupLabel(hints?.audienceGroup),
  });
  console.log('[Automation] Niche research', { runId, niche: result.niche, searchedWeb: result.searchedWeb });
  return { output: { ...result } };
}

async function runMockupRender(ctx: StepContext): Promise<StepResult> {
  const { run, template, userId, runId } = ctx;
  if (!run.generatedDesignUrl) throw new Error('Tasarım bulunamadı.');
  const design = ctx.designPng ?? await loadImageForUser(userId, run.generatedDesignUrl, { maxBytes: GENERATED_IMAGE_MAX_BYTES });
  const mockups = await loadWorkspaceMockups(userId);
  const plan = selectAutomationMockups(mockups, template.mockupConfig);
  if (plan.render.length === 0 && plan.statics.length === 0) {
    throw new StepSkipped('Şablonda kullanılabilir mockup yok (seçili mockup silinmiş veya kumaş filtresine uymuyor).');
  }

  const { renderDesignOnMockup } = await import('@/lib/backend-render');
  // Ana tasarım bir kumaş rengi için hazırlandıysa karşı renkteki mockup'lara o renge uygun versiyon basılır:
  // yapay zekâ versiyonu varsa o, yoksa otomatik renk dönüşümü (bir kez üretilir).
  const hints = runHints(ctx);
  const variantInfo = ctx.steps?.backgroundRemoval?.output as { variantUrl?: string | null } | undefined;
  let variantDesign: Buffer | null = ctx.variantPng ?? null;
  const designFor = async (mockup: MockupItem): Promise<Buffer> => {
    const target = variantFabricFor(mockup, hints.designFabric);
    if (!target) return design;
    if (!variantDesign && variantInfo?.variantUrl) {
      try {
        variantDesign = await loadImageForUser(userId, variantInfo.variantUrl, { maxBytes: GENERATED_IMAGE_MAX_BYTES });
      } catch (error) {
        console.warn('[Automation] Fabric variant could not be loaded; using automatic recolor.', error instanceof Error ? error.message : error);
      }
    }
    if (!variantDesign) {
      try {
        const { recolorDesign } = await import('@/lib/recolor');
        variantDesign = (await recolorDesign(design, target === 'dark' ? 'dark_garment' : 'light_garment')).pngBuffer;
      } catch (error) {
        console.warn('[Automation] Garment recolor failed; using original design.', error instanceof Error ? error.message : error);
        variantDesign = design;
      }
    }
    return variantDesign;
  };
  const urls: string[] = [];
  // Her fotoğrafın kısa tanımı (SEO adımında alt metin yazılırken kullanılır), `urls` ile aynı sırada.
  const photos: string[] = [];
  const failures: string[] = [];
  // Fotoğraflar mockup listesindeki sırayla eklenir; statik görseller (beden tablosu vb.) render edilmeden,
  // kendi adresleriyle listedeki yerlerine girer.
  let renderIndex = 0;
  for (const { mockup, kind } of plan.photos) {
    if (kind === 'static') {
      urls.push(mockup.src);
      photos.push(`static info image without the design${mockup.name ? ` (name: "${mockup.name}", e.g. size chart or color chart)` : ' (e.g. size chart or color chart)'}`);
      continue;
    }
    renderIndex += 1;
    try {
      let composite = await loadImageForUser(userId, mockup.src);
      const mockupDesign = await designFor(mockup);
      // Birden fazla baskı alanı varsa tasarım hepsine yerleştirilir.
      for (const area of mockup.printAreas) composite = await renderDesignOnMockup(composite, mockupDesign, area);
      const jpeg = await jpegForListing(composite);
      const upload = await uploadToR2(jpeg, createOwnedUploadName(userId, `auto-mockup-${runId}-${renderIndex}`, 'image/jpeg'), 'image/jpeg');
      urls.push(upload.url);
      photos.push(`${mockup.apparelType} mockup with the design printed on it${mockup.name ? ` (mockup name: "${mockup.name}")` : ''}${variantFabricFor(mockup, hints.designFabric) ? ', fabric-adjusted design version' : ''}`);
    } catch (error) {
      failures.push(`${mockup.name || mockup.id}: ${error instanceof Error ? error.message : 'render hatası'}`);
    }
  }

  if (urls.length === 0) throw new Error(`Hiçbir mockup üretilemedi. ${failures.join('; ')}`);
  return {
    patch: { generatedMockupUrls: urls },
    output: { rendered: urls.length - plan.statics.length, static: plan.statics.length, videoMockup: plan.video?.id ?? null, photos },
    warning: failures.length > 0 ? `${failures.length} mockup üretilemedi: ${failures.join('; ')}` : undefined,
  };
}

/**
 * İlan videosu: "Yapay zekâ ile video üret" açıksa yalnızca üretilen video gönderilir (klasördeki video
 * kullanılmaz). Kapalıysa klasöre yüklenen video (varsa) gönderilir. Etsy API'si ilan başına tek video
 * yükletir. Yapay zekâ videosu üretilemezse klasördeki videoya düşülür (uyarıyla).
 */
async function runVideo(ctx: StepContext): Promise<StepResult> {
  const { template, userId } = ctx;
  const schedule = template.automationSchedule;
  const folderVideo = async () => selectAutomationMockups(await loadWorkspaceMockups(userId), template.mockupConfig).video;
  if (!schedule?.generateVideo) {
    const video = await folderVideo();
    if (video) return { patch: { generatedVideoUrl: video.src }, output: { source: 'mockup', mockupId: video.id } };
    throw new StepSkipped('Video istenmedi ve klasörde video yok.');
  }
  try {
    return await generateAiVideo(ctx);
  } catch (error) {
    const video = await folderVideo().catch(() => null);
    if (!video) throw error;
    console.warn('[Automation] AI video failed; using the folder video.', describeAiError(error));
    return {
      patch: { generatedVideoUrl: video.src },
      output: { source: 'mockup', mockupId: video.id },
      warning: `Yapay zekâ videosu üretilemedi; klasördeki video kullanıldı. ${describeAiError(error).slice(0, 200)}`,
    };
  }
}

async function generateAiVideo(ctx: StepContext): Promise<StepResult> {
  const { template, userId, runId } = ctx;
  const schedule = template.automationSchedule!;

  const config = await loadAIConfig();
  const { generateVideo, isOmniVideoModel } = await import('@/lib/ai-provider');
  const videoSettings = schedule.video;
  const hints = runHints(ctx);
  const seo = ctx.run.generatedSeo as GeneratedSeoData | null;

  // Talimat admin panelindeki "Video üretimi" prompt'udur (boşsa varsayılanı).
  const prompt = fillVideoPromptTemplate(await loadPrompt('ai_prompt_generate_video'), {
    title: seo?.title || hints.primaryNiche || template.name,
    designPrompt: String((ctx.steps?.designGeneration?.output as { prompt?: unknown } | undefined)?.prompt || hints.primaryNiche || template.name),
    product: hints.productType?.trim().toLowerCase() || 't-shirt',
    niche: hints.primaryNiche || 'not specified',
    garment: hints.garments?.find((g) => g.trim())?.trim() || '',
  });

  // Referans görseller: tasarımın kendisi ve tasarımın basıldığı ilk mockup. Video bu ürünü gösterir
  // ama görselle başlamaz (ilk kare olarak kullanılmaz).
  const referenceImages: Array<{ data: Buffer; mimeType: 'image/jpeg' }> = [];
  const firstMockupUrl = ((ctx.run.generatedMockupUrls as string[] | null) ?? [])[0];
  for (const url of [ctx.run.generatedDesignUrl, firstMockupUrl]) {
    if (!url) continue;
    try {
      referenceImages.push({ data: await jpegForListing(await loadImageForUser(userId, url)), mimeType: 'image/jpeg' });
    } catch (error) {
      console.warn('[Automation] Reference image for video could not be loaded', error instanceof Error ? error.message : error);
    }
  }

  // Model admin panelinden seçilir; otomasyon yalnızca videonun yönünü belirler.
  const model = config.videoModel;
  const aspectRatio = videoSettings?.aspectRatio === '9:16' ? '9:16' : '16:9';
  let generated;
  try {
    generated = await generateVideo(config, { prompt, model, referenceImages, aspectRatio, maxWaitMs: VIDEO_MAX_WAIT_MS });
  } catch (error) {
    // Omni Flash: Gemini API'de GA adı, Vertex'te önizleme adı geçerli olabilir; diğeri denenir.
    const alternate = isOmniVideoModel(model) && /NOT_FOUND|404|not found|not supported/i.test(error instanceof Error ? error.message : '')
      ? (model.endsWith('-preview') ? model.replace(/-preview$/, '') : `${model}-preview`)
      : null;
    if (!alternate) throw error;
    generated = await generateVideo(config, { prompt, model: alternate, referenceImages, aspectRatio, maxWaitMs: VIDEO_MAX_WAIT_MS });
  }
  const url = await persistGeneratedVideo(userId, runId, generated.uri, config.googleApiKey);
  return { patch: { generatedVideoUrl: url }, output: { source: 'ai', model, referenceImages: referenceImages.length } };
}

async function runSeo(ctx: StepContext): Promise<StepResult> {
  const { template, userId, run } = ctx;
  if (template.automationSchedule?.createListing !== true) throw new StepSkipped('Kuru çalıştırma: SEO ve ilan adımları kapalı.');
  const hints = runHints(ctx);
  const research = ctx.steps?.nicheResearch?.output as NicheResearchOutput | undefined;
  const poolKeywords = await loadRelatedPoolKeywords(topicSearchTerms(hints));
  // Araştırmanın önerdiği arama ifadeleri havuz kelimelerinden önce gelir.
  const keywords = buildAutomationKeywords(hints, [...(research?.keywords ?? []), ...poolKeywords]);
  if (keywords.length === 0) throw new StepSkipped('Şablonda niş veya hedef kitle bilgisi yok; SEO üretilemedi.');

  const designPrompt = String((run.steps as AutomationRunSteps | null)?.designGeneration?.output?.prompt || buildDesignConcept(hints));
  const subject = detectPrimarySubject(`${hints?.primaryNiche || ''} ${designPrompt}`);
  const taxonomyId = template.automationSchedule?.etsy?.taxonomyId;
  // Mağaza bölümü elle seçilmediyse yapay zekâ mağazadaki bölümlerden en uygununu seçer.
  const shopSections = template.automationSchedule?.etsy?.shopSectionId ? [] : await loadShopSections(userId);
  // Kategori özellikleri (kol boyu, yaka, vesile, grafik…) Etsy'den çekilir; yapay zekâ tasarıma göre seçer.
  const { properties: taxonomyProperties, error: propertiesError } = await loadCategoryProperties(userId, taxonomyId);
  // Fotoğraf alt metinleri için mockup adımının fotoğraf tanımları (eski çalıştırmalarda yalnızca sıra).
  const photoUrls = (run.generatedMockupUrls as string[] | null) ?? [];
  const photoLabels = stringList((ctx.steps?.mockupRender?.output as { photos?: unknown } | undefined)?.photos, photoUrls.length);
  const images = photoUrls.map((_, i) => photoLabels[i] ?? 'listing photo of the product');
  const result = await generateListingContent(userId, {
    designDescription: designPrompt,
    keywords,
    productType: hints?.productType || undefined,
    userNotes: hints?.customNotes || undefined,
    primarySubject: subject?.subject || hints?.primaryNiche || undefined,
    audienceGroup: audienceGroupLabel(hints?.audienceGroup),
    garments: garmentsLabel(hints?.garments),
    taxonomyId,
    shopSections: shopSections.length > 0 ? shopSections : undefined,
    taxonomyProperties: taxonomyProperties.length > 0 ? taxonomyProperties : undefined,
    images,
  });
  const listing = result.listing as {
    title: string; description: string; selectedTags: string[]; shop_section_id?: unknown;
    taxonomy_properties_values?: unknown; materials?: unknown; styles?: unknown; image_alt_texts?: unknown;
  };
  const chosenSection = shopSections.find((s) => String(s.shop_section_id) === String(listing.shop_section_id ?? ''));
  const seo: GeneratedSeoData = {
    title: listing.title,
    description: listing.description,
    tags: listing.selectedTags,
    taxonomyId: taxonomyId ?? null,
    taxonomyProperties: validateTaxonomyPropertyValues(listing.taxonomy_properties_values, taxonomyProperties),
    keywords,
    shopSectionId: chosenSection ? String(chosenSection.shop_section_id) : null,
    shopSectionTitle: chosenSection?.title ?? null,
    materials: stringList(listing.materials, 5),
    styles: stringList(listing.styles, 2),
    imageAltTexts: Array.isArray(listing.image_alt_texts)
      ? listing.image_alt_texts.slice(0, images.length).map((alt) => (typeof alt === 'string' ? alt.trim() : ''))
      : [],
  };
  const propertyCount = Object.keys(seo.taxonomyProperties).length;
  if (run.generatedDesignId) {
    const parsed = listing as typeof listing & { detectedSubject?: unknown; detectedAesthetic?: unknown };
    // Kullanıcının kendi tasarımında (manuel üretim) mevcut görsel analizi korunur; yalnızca ilan metni eklenir.
    const keepAnalysis = template.id === MANUAL_TEMPLATE_ID;
    await attachDesignInsights(userId, run.generatedDesignId, keepAnalysis
      ? { seo: { title: seo.title, description: seo.description, tags: seo.tags, generatedAt: Date.now() } }
      : {
      analysis: {
        description: designPrompt,
        keywords: Array.from(new Set([...keywords, ...seo.tags])).slice(0, 30),
        analyzedAt: Date.now(),
        primarySubject: typeof parsed.detectedSubject === 'string' ? parsed.detectedSubject : subject?.subject || hints?.primaryNiche || undefined,
        primaryAesthetic: typeof parsed.detectedAesthetic === 'string' ? parsed.detectedAesthetic : research?.style || undefined,
        niche: hints?.primaryNiche || research?.niche || undefined,
        productType: hints?.productType || undefined,
        userNotes: hints?.customNotes || research?.designBrief || undefined,
        taxonomyId: taxonomyId ?? null,
        source: 'automation',
      },
      seo: { title: seo.title, description: seo.description, tags: seo.tags, generatedAt: Date.now() },
    }).catch((error: unknown) => console.warn('[Automation] Design insights could not be saved', error instanceof Error ? error.message : error));
  }
  return {
    patch: { generatedSeo: seo },
    output: {
      model: result.modelUsed, tagCount: seo.tags.length, shopSection: chosenSection?.title ?? null, attributes: propertyCount,
      altTexts: seo.imageAltTexts?.filter(Boolean).length ?? 0,
    },
    warning: propertiesError ? `Kategori özellikleri alınamadı, bu alanlar boş kaldı: ${propertiesError}` : undefined,
  };
}

/** Otomasyonun kategorisindeki, yapay zekânın doldurabileceği Etsy özellikleri (hata olursa boş + neden). */
async function loadCategoryProperties(userId: string, taxonomyId: number | undefined): Promise<{ properties: EtsyTaxonomyProperty[]; error?: string }> {
  if (!taxonomyId) return { properties: [] };
  try {
    const token = await getValidEtsyToken(userId);
    const apiKey = token.api_key || process.env.ETSY_API_KEY;
    if (!token.success || !token.access_token || !apiKey) return { properties: [], error: token.error || 'Etsy bağlantısı yok.' };
    const all = await fetchTaxonomyProperties({ apiKey, sharedSecret: token.shared_secret || process.env.ETSY_SHARED_SECRET, accessToken: token.access_token }, taxonomyId);
    return { properties: selectableTaxonomyProperties(all) };
  } catch (error) {
    return { properties: [], error: error instanceof Error ? error.message : 'bilinmeyen hata' };
  }
}

const stringList = (value: unknown, max: number): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0).map((v) => v.trim()).slice(0, max) : [];

/**
 * İlanın Etsy'ye gönderilecek alanları. Otomasyonun doğrudan taslağı ve Hazır İlanlar'dan yayın aynı veriyi
 * kullanır; incelemede yapılan fotoğraf seçimi (`review.photos`, `review.includeVideo`) burada uygulanır.
 */
export async function buildListingRequest(userId: string, template: TemplateRow, run: RunRow, review?: ListingReviewState | null) {
  const seo = run.generatedSeo as GeneratedSeoData | null;
  if (!seo?.title) throw new StepSkipped('SEO metni olmadığı için ilan açılmadı.');
  const defaults = await loadListingDefaults(userId);
  // Şablonda boş bırakılan mağaza ayarları Ayarlar sekmesindeki ilan varsayılanlarından tamamlanır.
  const etsy = mergeEtsySettings(template.automationSchedule?.etsy, defaults.etsy);
  if (!etsy.shippingProfileId || !etsy.readinessStateId) {
    throw new StepSkipped('Kargo profili veya hazırlık süresi seçilmemiş; Ayarlar › İlan varsayılanları bölümünden seçin.');
  }
  const whoMadeError = validateWhoMade({ whoMade: etsy.whoMade, isSupply: false, whenMade: etsy.whenMade });
  if (whoMadeError) throw new Error(whoMadeError);

  const tokenRes = await getValidEtsyToken(userId);
  if (!tokenRes.success || !tokenRes.access_token || !tokenRes.shop_id) {
    throw new Error(tokenRes.error || 'Etsy mağaza bağlantısı bulunamadı.');
  }
  const tags = sanitizeEtsyTags(seo.tags);
  if (tags.length === 0) throw new Error('Geçerli etiket üretilemedi.');

  // Alt metinler üretilen fotoğrafların sırasına göredir; incelemede sıra değişse de adresle eşleşir.
  const allPhotos = (run.generatedMockupUrls as string[] | null) ?? [];
  const selected = review?.photos ? review.photos.filter((url) => allPhotos.includes(url)) : allPhotos;
  const photos = selected.map((url) => ({ url, isVideo: false, altText: seo.imageAltTexts?.[allPhotos.indexOf(url)] || undefined }));
  if (photos.length === 0) throw new Error('İlana eklenecek görsel yok.');
  const media = run.generatedVideoUrl && review?.includeVideo !== false ? [...photos, { url: run.generatedVideoUrl, isVideo: true }] : photos;
  // Satışa kapalı satırlar da gönderilir: Etsy envanterde tüm beden × renk kombinasyonlarını ister.
  // Varyasyonlar otomasyonun seçtiği kayıtlı şablondan (manuel ilanda Hazır İlanlar'da seçilen şablondan)
  // gelir; hiç yoksa ilan tek fiyatla açılır.
  const variationRows = await resolveVariationRows(userId, template.variationConfig);
  const variations = variationRows.some((row) => row.enabled !== false)
    ? variationRows.map((row) => ({ size: row.size, color: row.color, price: row.price, quantity: row.quantity, sku: row.sku || undefined, enabled: row.enabled !== false }))
    : [];

  const credentials = {
    etsyAccessToken: tokenRes.access_token,
    etsyShopId: tokenRes.shop_id,
    etsyApiKey: tokenRes.api_key || process.env.ETSY_API_KEY,
    etsySharedSecret: tokenRes.shared_secret || process.env.ETSY_SHARED_SECRET,
  };
  const input: EtsyDraftListingInput = {
    title: seo.title,
    description: seo.description,
    validTags: tags,
    price: etsy.price,
    quantity: 999,
    taxonomyId: Number(etsy.taxonomyId),
    who_made: etsy.whoMade,
    when_made: etsy.whenMade,
    is_supply: false,
    shipping_profile_id: etsy.shippingProfileId,
    readiness_state_id: etsy.readinessStateId,
    return_policy_id: etsy.returnPolicyId,
    shop_section_id: etsy.shopSectionId || seo.shopSectionId || undefined,
    taxonomy_properties_values: seo.taxonomyProperties ?? {},
    materials: seo.materials ?? [],
    styles: seo.styles ?? [],
    production_partner_id: etsy.productionPartnerIds ?? [],
    should_auto_renew: etsy.shouldAutoRenew === true,
    item_weight: etsy.itemWeight,
    item_weight_unit: etsy.itemWeightUnit,
    item_length: etsy.itemLength,
    item_width: etsy.itemWidth,
    item_height: etsy.itemHeight,
    item_dimensions_unit: etsy.itemDimensionsUnit,
    variations,
    images: media,
    // İlan düzeyinde tek SKU: siparişte görünür, tasarım bu kodla Tasarımlar sekmesinde bulunur.
    sku: runSkuOf(run.steps) ?? undefined,
  };
  return { credentials, input };
}

async function runListing(ctx: StepContext): Promise<StepResult> {
  const { template, userId, run, runId } = ctx;
  const schedule = template.automationSchedule;
  if (schedule?.createListing !== true) throw new StepSkipped('Kuru çalıştırma: Etsy ilanı oluşturulmadı.');
  // Idempotency: aynı çalıştırma ikinci bir ilan açmaz.
  if (run.etsyListingId) return { output: { listingId: run.etsyListingId, reused: true } };

  // İnceleme modu (varsayılan): ilan Etsy'ye gönderilmez, Hazır İlanlar'da onay bekler.
  if ((schedule.listingMode ?? 'review') === 'review') {
    if (!(run.generatedSeo as GeneratedSeoData | null)?.title) throw new StepSkipped('SEO metni olmadığı için ilan hazırlanmadı.');
    const etsy = mergeEtsySettings(schedule.etsy, (await loadListingDefaults(userId)).etsy);
    const review: ListingReviewState = { status: 'awaiting', updatedAt: new Date().toISOString() };
    return {
      output: { review },
      warning: !etsy.shippingProfileId || !etsy.readinessStateId
        ? 'Kargo profili veya hazırlık süresi seçilmemiş; yayınlamadan önce Ayarlar › İlan varsayılanları bölümünden seçin.'
        : undefined,
    };
  }

  const { credentials, input } = await buildListingRequest(userId, template, run);
  const draft = await createEtsyDraftListing(userId, credentials, input);

  const blocking = draft.uploadErrors.filter((e) => !e.startsWith('Bilgi:'));
  await writeAuditLog({
    userId,
    action: 'automation.etsy_draft_listing.created',
    resourceType: 'etsy_listing',
    resourceId: String(draft.listingId),
    metadata: { runId, templateId: template.id, imagesUploaded: draft.imagesUploaded, imagesRequested: draft.imageItems.length, uploadErrorCount: blocking.length },
  });
  return {
    patch: { etsyListingId: String(draft.listingId), generatedListingId: String(draft.listingId) },
    output: { listingId: draft.listingId, listingUrl: draft.listingUrl, imagesUploaded: draft.imagesUploaded, imagesRequested: draft.imageItems.length },
    warning: blocking.length > 0 ? `İlan taslak olarak açıldı ancak ${blocking.length} işlem tamamlanamadı: ${blocking.slice(0, 3).join(' ')}` : undefined,
  };
}

const STEP_RUNNERS: Partial<Record<AutomationStepName, (ctx: StepContext) => Promise<StepResult>>> = {
  nicheResearch: runNicheResearch,
  designGeneration: runDesignGeneration,
  backgroundRemoval: runBackgroundRemoval,
  mockupRender: runMockupRender,
  videoGeneration: runVideo,
  seoGeneration: runSeo,
  listingCreation: runListing,
};

// ─── Çalıştırıcı ─────────────────────────────────────────────────────────────

export async function executeAutomationRun({ runId, templateId, userId }: AutomationRunInput): Promise<AutomationRunOutcome> {
  const [existing] = await db
    .select()
    .from(automationRuns)
    .where(and(eq(automationRuns.id, runId), eq(automationRuns.userId, userId)));

  // Manuel üretimden açılan ilanın şablonu yoktur: oluşturulurken alınan ayar kopyasından türetilir.
  const [template] = templateId === MANUAL_TEMPLATE_ID
    ? [existing ? manualTemplateFor(userId, existing.steps) as unknown as TemplateRow | null : null]
    : await db
      .select()
      .from(podTemplates)
      .where(and(eq(podTemplates.id, templateId), eq(podTemplates.userId, userId)));

  if (!template || !existing) return { ok: false, runId, reason: 'not_found' };

  // Aynı run'ın iki kez çalıştırılmasını engelle: yalnızca 'pending' kayıt ya da fonksiyon süre sınırında
  // kesildiği için 'running' durumunda kalmış (uzun süredir dokunulmamış) kayıt sahiplenilebilir.
  const claimed = await db
    .update(automationRuns)
    .set({ status: 'running', startedAt: drizzleSql`COALESCE(${automationRuns.startedAt}, NOW())`, updatedAt: new Date() })
    .where(and(eq(automationRuns.id, runId), or(
      eq(automationRuns.status, 'pending'),
      and(eq(automationRuns.status, 'running'), lt(automationRuns.updatedAt, new Date(Date.now() - DEAD_RUN_MS))),
    )))
    .returning();
  if (claimed.length === 0) return { ok: false, runId, reason: 'not_pending' };

  const steps = { ...(claimed[0].steps as AutomationRunSteps) };
  const ctx: StepContext = { run: claimed[0], template, userId, runId, deadline: Date.now() + INVOCATION_BUDGET_MS, steps };
  const persist = async (patch: Partial<RunRow>) => {
    await db.update(automationRuns).set({ ...patch, updatedAt: new Date() }).where(eq(automationRuns.id, runId));
    ctx.run = { ...ctx.run, ...patch };
  };
  ctx.persist = persist;
  const isCancelled = async () => {
    const [row] = await db.select({ status: automationRuns.status }).from(automationRuns).where(eq(automationRuns.id, runId));
    return row?.status === 'cancelled';
  };

  let ranAnyStep = false;
  try {
    for (let step = nextPendingStep(steps); step; step = nextPendingStep(steps)) {
      if (ranAnyStep && await isCancelled()) return { ok: false, runId, reason: 'cancelled' };

      // Süre bütçesi: yeni adıma başlamadan önce kontrol et; video ayrıca uzun bir pencere ister.
      const remaining = ctx.deadline + (300_000 - INVOCATION_BUDGET_MS) - Date.now();
      const needsLongWindow = step === 'videoGeneration' && template.automationSchedule?.generateVideo === true;
      if (ranAnyStep && (Date.now() > ctx.deadline || (needsLongWindow && remaining < VIDEO_MIN_REMAINING_MS))) {
        if (await isCancelled()) return { ok: false, runId, reason: 'cancelled' };
        await persist({ status: 'pending', steps });
        return { ok: true, runId, resumed: true };
      }
      ranAnyStep = true;

      // Süre sınırında kesilen adım (durumu 'running' kalmış) yeniden başlatılır; ara çıktısı korunur.
      // Aynı adım tekrar tekrar kesiliyorsa sonsuza dek denenmez.
      const attempts = (steps[step]?.attempts ?? 0) + 1;
      if (attempts > MAX_STEP_ATTEMPTS) {
        steps[step] = { ...steps[step], status: 'failed', completedAt: new Date().toISOString(), error: 'Adım art arda zaman aşımına uğradı; otomasyonu yeniden çalıştırın.' };
        for (const later of AUTOMATION_STEP_ORDER.slice(AUTOMATION_STEP_ORDER.indexOf(step) + 1)) {
          if (!isStepDone(steps[later]?.status)) steps[later] = { status: 'skipped', error: 'Önceki adım başarısız olduğu için atlandı.' };
        }
        await persist({ steps });
        continue;
      }
      steps[step] = { ...(steps[step]?.status === 'running' ? { output: steps[step]?.output } : {}), status: 'running', startedAt: new Date().toISOString(), attempts };
      await persist({ steps });

      const runner = STEP_RUNNERS[step];
      try {
        const result = runner ? await runner(ctx) : {};
        steps[step] = {
          ...steps[step],
          status: 'completed',
          completedAt: new Date().toISOString(),
          ...(result.output || result.warning ? { output: { ...result.output, ...(result.warning ? { warning: result.warning } : {}) } } : {}),
        };
        await persist({ ...(result.patch ?? {}), steps });
      } catch (error) {
        const skipped = error instanceof StepSkipped;
        const message = skipped ? (error as Error).message : describeAiError(error);
        if (!skipped) console.error(`[Automation] Step ${step} failed`, { runId, message, raw: error instanceof Error ? error.message : error });
        steps[step] = { ...steps[step], status: skipped ? 'skipped' : 'failed', completedAt: new Date().toISOString(), error: message.slice(0, 500) };
        await persist({ steps });
        // Görsel üretilemezse sonraki adımların anlamı yok.
        if (!skipped && (step === 'designGeneration' || step === 'backgroundRemoval' || step === 'mockupRender')) {
          for (const later of AUTOMATION_STEP_ORDER.slice(AUTOMATION_STEP_ORDER.indexOf(step) + 1)) {
            if (!isStepDone(steps[later]?.status)) steps[later] = { status: 'skipped', error: 'Önceki adım başarısız olduğu için atlandı.' };
          }
        }
        if (!skipped && step === 'seoGeneration' && !isStepDone(steps.listingCreation?.status)) {
          steps.listingCreation = { status: 'skipped', error: 'SEO metni üretilemediği için ilan açılmadı.' };
        }
      }
    }

    // Son adım sürerken iptal edildiyse 'cancelled' durumu korunur (üzerine 'completed' yazılmaz).
    if (await isCancelled()) {
      await persist({ steps });
      return { ok: false, runId, reason: 'cancelled' };
    }
    const outcome = deriveRunOutcome(steps);
    await persist({ status: outcome.status, errorMessage: outcome.errorMessage, completedAt: new Date(), steps });
    await db.update(podTemplates)
      .set({
        lastRunAt: new Date(),
        ...(outcome.status === 'completed' ? { totalListingsGenerated: drizzleSql`COALESCE(${podTemplates.totalListingsGenerated}, 0) + 1` } : {}),
      })
      .where(eq(podTemplates.id, templateId))
      .catch((error: unknown) => console.error('[Automation] Template stats update failed', error));

    return outcome.status === 'completed' ? { ok: true, runId } : { ok: false, runId, reason: 'failed', error: outcome.errorMessage ?? undefined };
  } catch (error) {
    console.error('[Automation] Run failed:', error);
    const message = describeAiError(error);
    for (const name of AUTOMATION_STEP_ORDER) {
      if (steps[name]?.status === 'running') steps[name] = { ...steps[name], status: 'failed', completedAt: new Date().toISOString(), error: message.slice(0, 500) };
    }
    await persist({ status: 'failed', errorMessage: message.slice(0, 1000), completedAt: new Date(), steps })
      .catch((dbError: unknown) => console.error('[Automation] Failed to persist failure state', dbError));
    return { ok: false, runId, reason: 'failed', error: message };
  }
}

/**
 * Uzun süredir ilerlemeyen çalıştırmaları 'failed' olarak işaretler. Ölçüt son güncelleme zamanıdır:
 * adım adım ilerleyen (devam ettirilen) bir çalıştırma, toplam süresi uzun olsa da kapatılmaz.
 */
export async function failStaleAutomationRuns(olderThanMinutes = 30, filter: { templateId?: string } = {}): Promise<number> {
  const rows = filter.templateId
    ? await sql`
        UPDATE automation_runs
        SET status = 'failed', error_message = 'Zaman aşımı: çalıştırma tamamlanamadı.', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE status IN ('running', 'pending') AND template_id = ${filter.templateId}
          AND COALESCE(updated_at, started_at, created_at) < CURRENT_TIMESTAMP - make_interval(mins => ${olderThanMinutes}::int)
        RETURNING id
      `
    : await sql`
        UPDATE automation_runs
        SET status = 'failed', error_message = 'Zaman aşımı: çalıştırma tamamlanamadı.', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE status IN ('running', 'pending')
          AND COALESCE(updated_at, started_at, created_at) < CURRENT_TIMESTAMP - make_interval(mins => ${olderThanMinutes}::int)
        RETURNING id
      `;
  return rows.length;
}

/** Bekleyen (yeni ya da yarıda kalmış) veya süre sınırında kesilmiş çalıştırmalar: zamanlayıcı bunları sürdürür. */
export async function findResumableRuns(idleSeconds = 60, limit = 10, userId?: string): Promise<AutomationRunInput[]> {
  const deadSeconds = Math.round(DEAD_RUN_MS / 1000);
  const rows = await sql`
    SELECT id, template_id, user_id FROM automation_runs
    WHERE (${userId ?? null}::text IS NULL OR user_id = ${userId ?? null})
      AND (
        (status = 'pending' AND COALESCE(updated_at, created_at) < CURRENT_TIMESTAMP - make_interval(secs => ${idleSeconds}::int))
        OR (status = 'running' AND COALESCE(updated_at, started_at, created_at) < CURRENT_TIMESTAMP - make_interval(secs => ${deadSeconds}::int))
      )
    ORDER BY created_at ASC
    LIMIT ${limit}
  `;
  return rows.map((row) => ({ runId: String(row.id), templateId: String(row.template_id), userId: String(row.user_id) }));
}

/** Kullanıcının çalıştırmasını iptal eder. Süren adım tamamlanır, sonraki adımlar başlatılmaz. */
export async function cancelAutomationRun(runId: string, userId: string): Promise<boolean> {
  const rows = await db
    .update(automationRuns)
    .set({ status: 'cancelled', errorMessage: 'Kullanıcı tarafından iptal edildi.', completedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(automationRuns.id, runId), eq(automationRuns.userId, userId), inArray(automationRuns.status, ['pending', 'running'])))
    .returning({ id: automationRuns.id });
  return rows.length > 0;
}

const INITIAL_STEPS: AutomationRunSteps = {
  nicheResearch: { status: 'pending' },
  designGeneration: { status: 'pending' },
  backgroundRemoval: { status: 'pending' },
  mockupRender: { status: 'pending' },
  videoGeneration: { status: 'pending' },
  seoGeneration: { status: 'pending' },
  listingCreation: { status: 'pending' },
};

export type CreateRunResult =
  | { ok: true; runId: string }
  | { ok: false; reason: 'not_found' | 'inactive' | 'already_running'; runId?: string };

/** Bir şablon için 'pending' durumunda yeni bir çalıştırma kaydı oluşturur. */
export async function createAutomationRun(input: {
  templateId: string;
  userId: string;
  triggerType: 'manual' | 'scheduled';
  allowConcurrent?: boolean;
}): Promise<CreateRunResult> {
  const [template] = await db
    .select({ id: podTemplates.id, isActive: podTemplates.isActive })
    .from(podTemplates)
    .where(and(eq(podTemplates.id, input.templateId), eq(podTemplates.userId, input.userId)));
  if (!template) return { ok: false, reason: 'not_found' };
  if (!template.isActive) return { ok: false, reason: 'inactive' };

  if (!input.allowConcurrent) {
    const [activeRun] = await db
      .select({ id: automationRuns.id })
      .from(automationRuns)
      .where(and(
        eq(automationRuns.templateId, input.templateId),
        eq(automationRuns.userId, input.userId),
        inArray(automationRuns.status, ['pending', 'running']),
      ))
      .limit(1);
    if (activeRun) return { ok: false, reason: 'already_running', runId: activeRun.id };
  }

  const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  await db.insert(automationRuns).values({
    id: runId,
    templateId: input.templateId,
    userId: input.userId,
    status: 'pending',
    steps: INITIAL_STEPS,
    triggerType: input.triggerType,
  });
  return { ok: true, runId };
}

/**
 * Bekleyen çalıştırmayı işletir. INTERNAL_API_TOKEN tanımlıysa her çalıştırma (ve her devam)
 * `/api/automation/execute` üzerinden kendi fonksiyon çağrısında, kendi süre sınırıyla çalışır;
 * tanımlı değilse aynı süreç içinde çalıştırılır ve yarıda kalan kısım takip/zamanlayıcı ile sürdürülür.
 */
export async function dispatchAutomationRun(input: AutomationRunInput, appOrigin: string): Promise<void> {
  const token = getConfiguredSecret('INTERNAL_API_TOKEN');
  if (!token) {
    await executeAutomationRun(input);
    return;
  }
  try {
    const res = await fetch(new URL('/api/automation/execute', appOrigin), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': token },
      body: JSON.stringify(input),
    });
    if (!res.ok && res.status !== 409) {
      console.error('[Automation] Execute dispatch failed', { runId: input.runId, status: res.status });
    }
  } catch (error) {
    console.error('[Automation] Execute dispatch error', { runId: input.runId, error: error instanceof Error ? error.message : error });
  }
}

/**
 * Bir çalıştırmayı başlatır ve süre bütçesi dolduğunda (iç token varsa) yeni bir çağrıyla sürdürür.
 * İç token yoksa yarıda kalan çalıştırma, kullanıcının takip isteği veya saatlik zamanlayıcıyla devam eder.
 */
export async function runAndContinue(input: AutomationRunInput, appOrigin: string): Promise<void> {
  const outcome = await executeAutomationRun(input);
  if (outcome.ok && outcome.resumed && getConfiguredSecret('INTERNAL_API_TOKEN')) {
    await dispatchAutomationRun(input, appOrigin);
  }
}
