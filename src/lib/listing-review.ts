/**
 * Hazır İlanlar (inceleme kuyruğu): otomasyonun ürettiği ilanlar Etsy'ye gönderilmeden önce burada bekler.
 * Kullanıcı ilanı düzenler, onaylar (hemen veya zamanlanmış) ya da reddeder; onaylanan ilan Etsy'de oluşturulup
 * yayına alınır. Durum, ilan adımının çıktısında (`steps.listingCreation.output.review`) tutulur.
 */
import { and, desc, eq, sql as drizzleSql } from 'drizzle-orm';
import { db, sql } from '@/lib/db';
import { automationRuns, podTemplates } from '@/db/schema';
import { buildListingRequest, type RunRow } from '@/lib/automation-runner';
import { createEtsyDraftListing } from '@/lib/etsy-listing-service';
import { etsyFetch, readEtsyError } from '@/lib/etsy-api';
import { getValidEtsyToken } from '@/lib/etsy-token-manager';
import { writeAuditLog } from '@/lib/audit-log';
import type { AutomationRunSteps, GeneratedSeoData, ListingReviewState, ListingReviewStatus } from '@/types/templates';

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
};

/** Kullanıcının kuyruktaki ilanları (en yeni önce). */
export async function listReviewItems(userId: string): Promise<ReviewItem[]> {
  const rows = await db
    .select({ run: automationRuns, templateName: podTemplates.name, schedule: podTemplates.automationSchedule })
    .from(automationRuns)
    .leftJoin(podTemplates, eq(podTemplates.id, automationRuns.templateId))
    .where(and(
      eq(automationRuns.userId, userId),
      eq(automationRuns.status, 'completed'),
      drizzleSql`${automationRuns.steps} -> 'listingCreation' -> 'output' -> 'review' IS NOT NULL`,
    ))
    .orderBy(desc(automationRuns.createdAt))
    .limit(300);
  return rows.flatMap(({ run, templateName, schedule }) => {
    const review = reviewStateOf(run.steps);
    if (!review) return [];
    const steps = run.steps as AutomationRunSteps;
    const warning = steps.listingCreation?.output?.warning;
    return [{
      runId: run.id,
      templateId: run.templateId,
      templateName: templateName ?? 'Silinmiş otomasyon',
      createdAt: run.createdAt ? new Date(run.createdAt).toISOString() : null,
      review,
      seo: run.generatedSeo as GeneratedSeoData | null,
      photos: (run.generatedMockupUrls as string[] | null) ?? [],
      videoUrl: run.generatedVideoUrl,
      designUrl: run.generatedDesignUrl,
      etsyListingId: run.etsyListingId,
      price: typeof schedule?.etsy?.price === 'number' ? schedule.etsy.price : null,
      warning: typeof warning === 'string' ? warning : null,
    }];
  });
}

async function loadOwnedRun(userId: string, runId: string): Promise<RunRow> {
  const [run] = await db.select().from(automationRuns).where(and(eq(automationRuns.id, runId), eq(automationRuns.userId, userId)));
  if (!run || !reviewStateOf(run.steps)) throw new ListingReviewError('İlan bulunamadı.', 404);
  return run;
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
};

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
  const next: ListingReviewState = { ...review };
  if (edits.photos !== undefined) {
    const photos = edits.photos.filter((url, i, list) => allPhotos.includes(url) && list.indexOf(url) === i);
    if (photos.length === 0) throw new ListingReviewError('En az bir fotoğraf seçin.');
    if (photos.length > 10) throw new ListingReviewError('Etsy en fazla 10 fotoğraf kabul eder.');
    next.photos = photos;
  }
  if (edits.includeVideo !== undefined) next.includeVideo = edits.includeVideo;
  await saveReview(runId, run.steps as AutomationRunSteps, next, { generatedSeo: seo });
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
    const [template] = await db.select().from(podTemplates).where(and(eq(podTemplates.id, run.templateId), eq(podTemplates.userId, userId)));
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
