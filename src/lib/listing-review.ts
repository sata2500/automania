/**
 * Hazır İlanlar (inceleme kuyruğu): otomasyonun ürettiği ilanlar Etsy'ye gönderilmeden önce burada bekler.
 * Kullanıcı ilanı düzenler, onaylar (hemen veya zamanlanmış) ya da reddeder; onaylanan ilan Etsy'de oluşturulup
 * yayına alınır. Durum, ilan adımının çıktısında (`steps.listingCreation.output.review`) tutulur.
 */
import { and, desc, eq, inArray, or, sql as drizzleSql } from 'drizzle-orm';
import { db, sql } from '@/lib/db';
import { automationRuns, podTemplates, userWorkspaces } from '@/db/schema';
import { buildListingRequest, type RunRow, type TemplateRow } from '@/lib/automation-runner';
import { createEtsyDraftListing } from '@/lib/etsy-listing-service';
import { etsyFetch, readEtsyError } from '@/lib/etsy-api';
import { getValidEtsyToken } from '@/lib/etsy-token-manager';
import { writeAuditLog } from '@/lib/audit-log';
import { runSkuOf } from '@/lib/run-sku';
import { hasManualVariations, MANUAL_TEMPLATE_ID, manualSettingsOf, withManualSettings, type ManualListingSettings } from '@/lib/manual-listing';
import { sanitizeSku } from '@/lib/sku';
import { MAX_ETSY_PHOTOS } from '@/lib/etsy-preflight';
import { evaluateEtsyListingSeo } from '@/lib/etsy-seo-evaluator';
import { poolRowsForTags } from '@/lib/listing-pipeline';
import type {
  AutomationRunSteps,
  GeneratedSeoData,
  ListingReviewState,
  ListingReviewStatus,
} from '@/types/templates';
import type { EtsyVariationRow } from '@/types/pod';

export { MANUAL_TEMPLATE_ID, type ManualListingSettings } from '@/lib/manual-listing';

export class ListingReviewError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = 'ListingReviewError';
  }
}

/** Düzenlenebilen, onaylanabilen ve yayınlanabilen durumlar. */
const EDITABLE: ListingReviewStatus[] = ['awaiting', 'scheduled', 'failed'];
/** Yayın bu süreden uzun "yayınlanıyor"da kalırsa (ör. sunucu yarıda kesildi) başarısız sayılır. */
const STALE_PUBLISHING_MINUTES = 20;

export function reviewStateOf(steps: unknown): ListingReviewState | null {
  const review = (steps as AutomationRunSteps | null)?.listingCreation?.output?.review;
  return review && typeof review === 'object' && typeof (review as ListingReviewState).status === 'string' ? review as ListingReviewState : null;
}

function withReview(steps: AutomationRunSteps, review: ListingReviewState): AutomationRunSteps {
  return { ...steps, listingCreation: { ...steps.listingCreation, output: { ...steps.listingCreation?.output, review } } };
}

export type ReviewItem = {
  runId: string;
  templateId: string;
  templateName: string;
  createdAt: string | null;
  review: ListingReviewState;
  seo: GeneratedSeoData | null;
  photos: string[];
  videoUrl: string | null;
  designUrl: string | null;
  etsyListingId: string | null;
  price: number | null;
  warning: string | null;
  sku: string | null;
  /** Manuel üretimden gelen ilanın metni arka planda hazırlanıyor */
  preparing: boolean;
  /**
   * Manuel üretim ilanının varyasyonları (yayından önce kayıtlı şablonlardan seçilir). Otomasyon
   * ilanlarında null: varyasyonlar otomasyonun ayarından gelir.
   */
  variations: { templateId: string | null; templateName: string | null; count: number; enabled: number } | null;
};

/**
 * Manuel üretim kaydının inceleme durumu: metin hazırlanırken ve hazırlanamadıysa kayıtta henüz inceleme
 * durumu yoktur; kuyrukta görünsün diye çalıştırma durumundan türetilir.
 */
function manualReviewOf(run: RunRow): ListingReviewState | null {
  if (run.templateId !== MANUAL_TEMPLATE_ID) return null;
  const updatedAt = (run.updatedAt ?? run.createdAt ?? new Date()).toISOString();
  if (run.status === 'failed') return { status: 'failed', error: run.errorMessage || 'İlan metni hazırlanamadı; yeniden deneyin.', updatedAt };
  if (run.status === 'pending' || run.status === 'running') return { status: 'awaiting', updatedAt };
  return null;
}

/** Kullanıcının kuyruktaki ilanları (en yeni önce). */
export async function listReviewItems(userId: string): Promise<ReviewItem[]> {
  const rows = await db
    .select({ run: automationRuns, templateName: podTemplates.name, schedule: podTemplates.automationSchedule })
    .from(automationRuns)
    .leftJoin(podTemplates, eq(podTemplates.id, automationRuns.templateId))
    .where(and(
      eq(automationRuns.userId, userId),
      or(
        and(
          eq(automationRuns.status, 'completed'),
          drizzleSql`${automationRuns.steps} -> 'listingCreation' -> 'output' -> 'review' IS NOT NULL`,
        ),
        // Manuel üretimden gelen ilanlar metin hazırlanırken de görünür.
        and(eq(automationRuns.templateId, MANUAL_TEMPLATE_ID), inArray(automationRuns.status, ['pending', 'running', 'failed'])),
      ),
    ))
    .orderBy(desc(automationRuns.createdAt))
    .limit(300);
  return rows.flatMap(({ run, templateName, schedule }) => {
    const review = reviewStateOf(run.steps) ?? manualReviewOf(run);
    if (!review) return [];
    const steps = run.steps as AutomationRunSteps;
    const warning = steps.listingCreation?.output?.warning;
    const manual = manualSettingsOf(steps);
    const price = manual?.etsy.price ?? schedule?.etsy?.price;
    return [{
      runId: run.id,
      templateId: run.templateId,
      templateName: manual ? 'Manuel üretim' : templateName ?? 'Silinmiş otomasyon',
      createdAt: run.createdAt ? new Date(run.createdAt).toISOString() : null,
      review,
      seo: run.generatedSeo as GeneratedSeoData | null,
      photos: (run.generatedMockupUrls as string[] | null) ?? [],
      videoUrl: run.generatedVideoUrl,
      designUrl: run.generatedDesignUrl,
      etsyListingId: run.etsyListingId,
      price: typeof price === 'number' ? price : null,
      warning: typeof warning === 'string' ? warning : null,
      sku: runSkuOf(steps),
      preparing: run.status === 'pending' || run.status === 'running',
      variations: manual
        ? {
            templateId: manual.variationTemplateId ?? null,
            templateName: manual.variationTemplateName ?? (manual.variations?.length ? 'Klasörün otomasyonundan' : null),
            count: manual.variations?.length ?? 0,
            enabled: manual.variations?.filter((r) => r.enabled !== false).length ?? 0,
          }
        : null,
    }];
  });
}

async function loadOwnedRun(userId: string, runId: string): Promise<RunRow> {
  const [run] = await db.select().from(automationRuns).where(and(eq(automationRuns.id, runId), eq(automationRuns.userId, userId)));
  if (!run) throw new ListingReviewError('İlan bulunamadı.', 404);
  if (reviewStateOf(run.steps)) return run;
  // Metni hazırlanamamış manuel ilan: reddedilebilsin diye inceleme durumu kayda yazılmış gibi işlenir.
  const synthetic = run.status === 'failed' ? manualReviewOf(run) : null;
  if (!synthetic) throw new ListingReviewError(run.templateId === MANUAL_TEMPLATE_ID ? 'İlan metni henüz hazırlanıyor.' : 'İlan bulunamadı.', run.templateId === MANUAL_TEMPLATE_ID ? 409 : 404);
  return { ...run, steps: withReview(run.steps as AutomationRunSteps, synthetic) };
}

/** Metni hazırlanamamış manuel ilanı yeniden sıraya alır (başarısız adımlar tekrar çalışır). */
export async function retryManualDraft(userId: string, runId: string): Promise<{ runId: string; templateId: string; userId: string }> {
  const [run] = await db.select().from(automationRuns).where(and(eq(automationRuns.id, runId), eq(automationRuns.userId, userId)));
  if (!run || run.templateId !== MANUAL_TEMPLATE_ID || run.status !== 'failed') throw new ListingReviewError('Bu ilan yeniden denenemez.', 409);
  const steps = { ...(run.steps as AutomationRunSteps) };
  for (const name of ['seoGeneration', 'listingCreation'] as const) {
    if (steps[name]?.status !== 'completed') steps[name] = { status: 'pending' };
  }
  await db.update(automationRuns)
    .set({ status: 'pending', steps, errorMessage: null, completedAt: null, updatedAt: new Date() })
    .where(and(eq(automationRuns.id, runId), eq(automationRuns.status, 'failed')));
  return { runId, templateId: run.templateId, userId };
}

async function saveReview(runId: string, steps: AutomationRunSteps, review: ListingReviewState, patch: Partial<RunRow> = {}) {
  await db.update(automationRuns)
    .set({ ...patch, steps: withReview(steps, { ...review, updatedAt: new Date().toISOString() }), updatedAt: new Date() })
    .where(eq(automationRuns.id, runId));
}

export type ReviewEdits = {
  title?: string;
  description?: string;
  tags?: string[];
  photos?: string[];
  includeVideo?: boolean;
  imageAltTexts?: Record<string, string>;
  sku?: string;
  /** Manuel ilan: kayıtlı varyasyon şablonunu seçer (satırlar ilana kopyalanır). */
  variationTemplateId?: string;
};

const NO_VARIATIONS_ERROR = 'Yayınlamadan önce ilanın varyasyonlarını seçin (Ayarlar › Varyasyonlar\'daki kayıtlı şablonlardan).';

/** Kayıtlı varyasyon şablonunu yükler (yoksa hata). */
async function loadVariationTemplate(userId: string, templateId: string) {
  const [workspace] = await db.select({ templates: userWorkspaces.etsyVariationTemplates }).from(userWorkspaces).where(eq(userWorkspaces.userId, userId));
  const template = ((workspace?.templates as Array<{ id: string; name?: string; variations?: EtsyVariationRow[] }> | null) ?? []).find((t) => t.id === templateId);
  if (!template?.variations?.length) throw new ListingReviewError('Varyasyon şablonu bulunamadı veya boş.', 404);
  return { id: template.id, name: template.name || 'Adsız şablon', rows: template.variations };
}

/** İlan metnini ve fotoğraf seçimini günceller (yalnızca yayınlanmamış ilanlarda). */
export async function updateReviewItem(userId: string, runId: string, edits: ReviewEdits): Promise<void> {
  const run = await loadOwnedRun(userId, runId);
  const review = reviewStateOf(run.steps)!;
  if (!EDITABLE.includes(review.status) && review.status !== 'rejected') throw new ListingReviewError('Bu ilan artık düzenlenemez.', 409);
  const seo = { ...(run.generatedSeo as GeneratedSeoData) };
  if (edits.title !== undefined) {
    const title = edits.title.replace(/\s+/g, ' ').trim();
    if (!title || title.length > 140) throw new ListingReviewError('Başlık 1-140 karakter olmalıdır.');
    seo.title = title;
  }
  if (edits.description !== undefined) {
    if (!edits.description.trim()) throw new ListingReviewError('Açıklama boş olamaz.');
    seo.description = edits.description.trim();
  }
  if (edits.tags !== undefined) {
    const tags = Array.from(new Set(edits.tags.map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean)));
    if (tags.length > 13 || tags.some((t) => t.length > 20)) throw new ListingReviewError('En fazla 13 etiket, her biri en fazla 20 karakter.');
    seo.tags = tags;
  }
  const allPhotos = (run.generatedMockupUrls as string[] | null) ?? [];
  if (edits.imageAltTexts) {
    const alts = allPhotos.map((url, i) => seo.imageAltTexts?.[i] ?? '');
    for (const [url, alt] of Object.entries(edits.imageAltTexts)) {
      const index = allPhotos.indexOf(url);
      if (index >= 0) alts[index] = alt.replace(/\s+/g, ' ').trim().slice(0, 250);
    }
    seo.imageAltTexts = alts;
  }
  let steps = run.steps as AutomationRunSteps;
  if (edits.variationTemplateId !== undefined) {
    const manual = manualSettingsOf(steps);
    if (!manual) throw new ListingReviewError('Bu ilanın varyasyonları otomasyonundan gelir; otomasyon ayarlarından değiştirin.', 409);
    const template = await loadVariationTemplate(userId, edits.variationTemplateId);
    steps = withManualSettings(steps, { ...manual, variations: template.rows, variationTemplateId: template.id, variationTemplateName: template.name });
  }
  const next: ListingReviewState = { ...review };
  if (edits.photos !== undefined) {
    const photos = edits.photos.filter((url, i, list) => allPhotos.includes(url) && list.indexOf(url) === i);
    if (photos.length === 0) throw new ListingReviewError('En az bir fotoğraf seçin.');
    if (photos.length > MAX_ETSY_PHOTOS) throw new ListingReviewError(`Etsy en fazla ${MAX_ETSY_PHOTOS} fotoğraf kabul eder.`);
    next.photos = photos;
  }
  if (edits.includeVideo !== undefined) next.includeVideo = edits.includeVideo;
  if (edits.sku !== undefined) {
    const sku = sanitizeSku(edits.sku);
    if (!sku) throw new ListingReviewError('SKU boş olamaz (harf, rakam, - . _).');
    next.sku = sku;
    // Tasarım da yeni SKU ile aranabilsin.
    if (run.generatedDesignUrl) await tagDesignWithSku(userId, run.generatedDesignUrl, sku);
  }
  // Metin değiştiyse SEO puanı yeniden hesaplanır (kurallar + kelime havuzu; yapay zekâ incelemesi yalnızca metin
  // aynı kaldıysa geçerli kalır).
  if (edits.title !== undefined || edits.tags !== undefined || edits.description !== undefined) {
    const poolRows = await poolRowsForTags(seo.tags ?? [], {}, 0).catch(() => []);
    seo.evaluation = evaluateEtsyListingSeo({ title: seo.title, description: seo.description, tags: seo.tags, keywordPoolRows: poolRows, aiReview: seo.evaluation?.aiReview ?? null });
  }
  await saveReview(runId, steps, next, { generatedSeo: seo });
}

export type ReviewAction =
  | { type: 'approve'; scheduledAt?: string | null }
  | { type: 'unschedule' }
  | { type: 'reject' }
  | { type: 'restore' };

/** Onay (hemen yayın için `scheduledAt` boş, ileri tarih için zamanlama), zamanlamayı kaldırma, reddetme, geri alma. */
export async function applyReviewAction(userId: string, runId: string, action: ReviewAction): Promise<ListingReviewState> {
  const run = await loadOwnedRun(userId, runId);
  const review = reviewStateOf(run.steps)!;
  let next: ListingReviewState;
  switch (action.type) {
    case 'approve': {
      if (!EDITABLE.includes(review.status)) throw new ListingReviewError('Bu ilan onaylanamaz.', 409);
      const manual = manualSettingsOf(run.steps);
      if (manual && !hasManualVariations(manual)) throw new ListingReviewError(NO_VARIATIONS_ERROR, 409);
      const at = action.scheduledAt ? new Date(action.scheduledAt) : new Date();
      if (Number.isNaN(at.getTime())) throw new ListingReviewError('Geçersiz tarih.');
      next = { ...review, status: 'scheduled', scheduledAt: at.toISOString(), error: null };
      break;
    }
    case 'unschedule':
      if (review.status !== 'scheduled') throw new ListingReviewError('İlan zamanlanmamış.', 409);
      next = { ...review, status: 'awaiting', scheduledAt: null };
      break;
    case 'reject':
      if (!EDITABLE.includes(review.status)) throw new ListingReviewError('Bu ilan reddedilemez.', 409);
      next = { ...review, status: 'rejected', scheduledAt: null };
      break;
    case 'restore':
      if (review.status !== 'rejected') throw new ListingReviewError('Yalnızca reddedilen ilan geri alınabilir.', 409);
      next = { ...review, status: 'awaiting' };
      break;
  }
  await saveReview(runId, run.steps as AutomationRunSteps, next);
  return next;
}

/**
 * Tek bir ilanı Etsy'de oluşturup yayına alır. Aynı ilanın iki kez yayınlanmaması için önce durum
 * 'publishing' olarak kilitlenir. Önceki denemede taslak oluştuysa yeniden oluşturulmaz, yalnızca yayına alınır.
 */
export async function publishReviewItem(userId: string, runId: string): Promise<ListingReviewState> {
  const claimed = await sql`
    UPDATE automation_runs
    SET steps = jsonb_set(steps, '{listingCreation,output,review,status}', '"publishing"'), updated_at = CURRENT_TIMESTAMP
    WHERE id = ${runId} AND user_id = ${userId}
      AND steps -> 'listingCreation' -> 'output' -> 'review' ->> 'status' IN ('awaiting', 'scheduled', 'failed')
    RETURNING id
  `;
  if (claimed.length === 0) throw new ListingReviewError('İlan şu anda yayınlanamaz (zaten yayınlanıyor veya yayınlandı).', 409);

  const run = await loadOwnedRun(userId, runId);
  const steps = run.steps as AutomationRunSteps;
  const review = reviewStateOf(steps)!;
  const fail = async (message: string, patch: Partial<RunRow> = {}) => {
    const next: ListingReviewState = { ...review, status: 'failed', error: message.slice(0, 500) };
    await saveReview(runId, steps, next, patch);
    return next;
  };

  try {
    // Elle hazırlanan ilan Etsy ayarlarını kendisi taşır; otomasyon ilanı şablonundan okur.
    const manual = manualSettingsOf(steps);
    if (manual && !hasManualVariations(manual)) return await fail(NO_VARIATIONS_ERROR);
    const [template] = manual
      ? [{ automationSchedule: { etsy: manual.etsy }, variationConfig: { rows: manual.variations } } as unknown as TemplateRow]
      : await db.select().from(podTemplates).where(and(eq(podTemplates.id, run.templateId), eq(podTemplates.userId, userId)));
    if (!template) return await fail('Bu ilanın otomasyonu silinmiş; Etsy ayarları bulunamadı.');

    let listingId = run.etsyListingId;
    let listingUrl = review.listingUrl ?? null;
    let shopId: string | number;
    let credentials;
    if (!listingId) {
      const request = await buildListingRequest(userId, template, run, review);
      credentials = request.credentials;
      shopId = credentials.etsyShopId;
      const draft = await createEtsyDraftListing(userId, credentials, request.input);
      listingId = String(draft.listingId);
      listingUrl = draft.listingUrl;
      const blocking = draft.uploadErrors.filter((e) => !e.startsWith('Bilgi:'));
      if (draft.imagesUploaded < 1 || draft.imagesUploaded < draft.imageItems.length || blocking.length > 0) {
        // Taslak Etsy'de kalır; tekrar denendiğinde yeniden oluşturulmaz, yalnızca yayına alınır.
        const next: ListingReviewState = {
          ...review, status: 'failed', listingUrl,
          error: `İlan Etsy'de taslak olarak oluşturuldu ama yayına alınmadı: ${blocking.slice(0, 2).join(' ') || 'tüm görseller yüklenemedi.'} Taslağı Etsy'de kontrol edip yeniden deneyebilirsiniz.`.slice(0, 500),
        };
        await saveReview(runId, steps, next, { etsyListingId: listingId, generatedListingId: listingId });
        return next;
      }
    } else {
      const token = await getValidEtsyToken(userId);
      if (!token.success || !token.access_token || !token.shop_id) return await fail(token.error || 'Etsy mağaza bağlantısı bulunamadı.');
      credentials = {
        etsyAccessToken: token.access_token,
        etsyShopId: token.shop_id,
        etsyApiKey: token.api_key || process.env.ETSY_API_KEY,
        etsySharedSecret: token.shared_secret || process.env.ETSY_SHARED_SECRET,
      };
      shopId = token.shop_id;
    }

    const activateRes = await etsyFetch(`https://openapi.etsy.com/v3/application/shops/${shopId}/listings/${listingId}`, {
      method: 'PATCH',
      headers: {
        'x-api-key': `${credentials.etsyApiKey}:${credentials.etsySharedSecret || ''}`,
        'Authorization': `Bearer ${credentials.etsyAccessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ state: 'active' }),
    });
    if (!activateRes.ok) {
      const message = await readEtsyError(activateRes, 'Etsy ilanı yayına almayı reddetti');
      const next = { ...review, status: 'failed' as const, listingUrl, error: `${message} İlan Etsy'de taslak olarak duruyor.`.slice(0, 500) };
      await saveReview(runId, steps, next, { etsyListingId: listingId, generatedListingId: listingId });
      return next;
    }

    const published: ListingReviewState = {
      ...review, status: 'published', publishedAt: new Date().toISOString(), error: null,
      listingUrl: `https://www.etsy.com/listing/${listingId}`,
    };
    await saveReview(runId, steps, published, { etsyListingId: listingId, generatedListingId: listingId });
    await writeAuditLog({
      userId,
      action: 'automation.etsy_listing.published',
      resourceType: 'etsy_listing',
      resourceId: listingId,
      metadata: { runId, templateId: run.templateId, scheduledAt: review.scheduledAt ?? null },
    });
    return published;
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Yayınlama sırasında beklenmeyen hata.');
  }
}

/**
 * Zamanlayıcı: zamanı gelen onaylı ilanları sırayla yayınlar (süre bütçesi içinde). Yarıda kalmış
 * "yayınlanıyor" kayıtları başarısız olarak işaretlenir ki kullanıcı yeniden deneyebilsin.
 */
export async function publishDueReviewItems(
  { budgetMs = 240_000, limit = 10, userId }: { budgetMs?: number; limit?: number; userId?: string } = {},
): Promise<{ published: string[]; failed: string[]; staleReset: number }> {
  const stale = await sql`
    UPDATE automation_runs
    SET steps = jsonb_set(
          jsonb_set(steps, '{listingCreation,output,review,status}', '"failed"'),
          '{listingCreation,output,review,error}', '"Yayın yarıda kaldı; ilanı Etsy üzerinde kontrol edip yeniden deneyin."'),
        updated_at = CURRENT_TIMESTAMP
    WHERE steps -> 'listingCreation' -> 'output' -> 'review' ->> 'status' = 'publishing'
      AND updated_at < CURRENT_TIMESTAMP - make_interval(mins => ${STALE_PUBLISHING_MINUTES}::int)
    RETURNING id
  `;
  const due = await sql`
    SELECT id, user_id FROM automation_runs
    WHERE status = 'completed' AND (${userId ?? null}::text IS NULL OR user_id = ${userId ?? null})
      AND steps -> 'listingCreation' -> 'output' -> 'review' ->> 'status' = 'scheduled'
      AND (steps -> 'listingCreation' -> 'output' -> 'review' ->> 'scheduledAt')::timestamptz <= CURRENT_TIMESTAMP
    ORDER BY (steps -> 'listingCreation' -> 'output' -> 'review' ->> 'scheduledAt')::timestamptz ASC
    LIMIT ${limit}
  `;
  const started = Date.now();
  const published: string[] = [];
  const failed: string[] = [];
  for (const row of due) {
    if (Date.now() - started > budgetMs) break;
    const runId = String(row.id);
    try {
      const result = await publishReviewItem(String(row.user_id), runId);
      (result.status === 'published' ? published : failed).push(runId);
    } catch {
      failed.push(runId);
    }
  }
  return { published, failed, staleReset: stale.length };
}

/**
 * Tasarımı SKU ile etiketler (Tasarımlar sekmesindeki arama için). Aynı görsel birden çok ilanda
 * kullanılabildiği için SKU'lar listede biriktirilir. Görsel çalışma alanında yoksa bir şey yapılmaz.
 */
export async function tagDesignWithSku(userId: string, designUrl: string, sku: string) {
  await sql`
    UPDATE user_workspaces
    SET designs = (
      SELECT jsonb_agg(
        CASE WHEN elem ->> 'src' = ${designUrl} AND NOT COALESCE(elem -> 'skus', '[]'::jsonb) @> ${JSON.stringify([sku])}::jsonb
          THEN jsonb_set(elem, '{skus}', COALESCE(elem -> 'skus', '[]'::jsonb) || ${JSON.stringify([sku])}::jsonb)
          ELSE elem END
        ORDER BY ord)
      FROM jsonb_array_elements(designs) WITH ORDINALITY AS t(elem, ord)
    ),
    updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ${userId} AND designs @> ${JSON.stringify([{ src: designUrl }])}::jsonb
  `.catch((error: unknown) => console.warn('[Listing Review] Design SKU tag failed', error));
}

export type ProductionDraftInput = {
  /** Depoya yüklenmiş mockup fotoğrafları, ilandaki sırayla */
  photos: string[];
  /** Her fotoğrafın kısa tanımı (alt metin üretimi için) */
  photoLabels?: string[];
  videoUrl?: string | null;
  design: {
    id?: string | null;
    url?: string | null;
    name: string;
    analysis?: { description?: string; keywords?: string[]; primarySubject?: string; primaryAesthetic?: string; productType?: string; taxonomyId?: number | null } | null;
  };
  folderId?: string | null;
  folderName?: string;
};

/**
 * Üretim sekmesindeki manuel üretimi Hazır İlanlar'a gönderir: görseller hazırdır; ilan metni (SEO)
 * arka planda çalıştırıcı tarafından Ayarlar'daki ilan varsayılanlarıyla üretilir. Çalıştırma kimliğini döner.
 */
export async function createProductionDraft(userId: string, input: ProductionDraftInput): Promise<{ runId: string }> {
  const { loadListingDefaults } = await import('@/lib/user-settings');
  const { generateListingSku } = await import('@/lib/sku');
  const defaults = await loadListingDefaults(userId);
  const analysis = input.design.analysis ?? {};
  const subject = (analysis.primarySubject || input.design.name || '').trim().slice(0, 200);
  const description = (analysis.description || subject || input.folderName || 'Print-on-demand t-shirt design').trim().slice(0, 4000);
  // Kategori ve ürün tipi tasarımın analizinden gelir (yapay zekâ admin panelindeki aktif Etsy kategorilerinden
  // seçer; analizde yoksa Ayarlar'daki kategori). Mağaza ayarları (kargo, hazırlık, iade) Ayarlar'dan.
  // Varyasyonlar Hazır İlanlar'da yayından önce kayıtlı bir şablon seçilerek eklenir.
  const productType = analysis.productType?.trim() || 'T-shirt';
  const sku = generateListingSku(productType);
  const taxonomyId = Number(analysis.taxonomyId) > 0 ? Math.trunc(Number(analysis.taxonomyId)) : null;
  const settings: ManualListingSettings = {
    etsy: { ...defaults.etsy, ...(taxonomyId ? { taxonomyId } : {}) },
    variations: [],
    variationTemplateId: null,
    variationTemplateName: null,
    sku,
    productType,
    notes: '',
    subject,
  };
  const now = new Date();
  const runId = `run_${now.getTime()}_${Math.random().toString(36).slice(2, 9)}`;
  const steps: AutomationRunSteps = {
    // Tasarımın görsel analizi araştırma çıktısı yerine geçer (anahtar kelimeler ve stil ilan metnini besler).
    nicheResearch: {
      status: 'skipped',
      error: 'Manuel üretim: konu tasarım analizinden alındı.',
      output: { niche: subject, style: analysis.primaryAesthetic ?? '', keywords: (analysis.keywords ?? []).slice(0, 30) },
    },
    designGeneration: { status: 'completed', completedAt: now.toISOString(), output: { prompt: description, sku } },
    backgroundRemoval: { status: 'completed', completedAt: now.toISOString(), output: { sku } },
    mockupRender: {
      status: 'completed',
      completedAt: now.toISOString(),
      output: { photos: input.photoLabels ?? [], listingSettings: settings, source: 'manual', folderName: input.folderName ?? null },
    },
    videoGeneration: { status: 'skipped', error: 'Manuel üretimde video oluşturulmaz.' },
    seoGeneration: { status: 'pending' },
    listingCreation: { status: 'pending' },
  };
  await db.insert(automationRuns).values({
    id: runId,
    templateId: MANUAL_TEMPLATE_ID,
    userId,
    status: 'pending',
    steps,
    generatedDesignId: input.design.id ?? null,
    generatedDesignUrl: input.design.url ?? null,
    generatedMockupUrls: input.photos,
    generatedVideoUrl: input.videoUrl ?? null,
    triggerType: 'manual',
    createdAt: now,
    updatedAt: now,
  });
  if (input.design.url) await tagDesignWithSku(userId, input.design.url, sku);
  return { runId };
}
