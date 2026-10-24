import { randomUUID } from 'node:crypto';
import { getErrorMessage } from '@/lib/errors';
import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { getValidEtsyToken } from '@/lib/etsy-token-manager';
import { checkRateLimit } from '@/lib/request-rate-limit';
import { etsyFetch, readEtsyError } from '@/lib/etsy-api';
import { validateBulkVariations, BULK_INVENTORY_CONFIRMATION, type VariationInput } from '@/lib/etsy-variations';

// Her ilan için 2 Etsy çağrısı (okuma + yazma) sıralı yapılır.
export const maxDuration = 300;

const MAX_LISTINGS_PER_REQUEST = 100;

/**
 * POST /api/etsy/update-variations
 * Seçili canlı ilanların envanterini (varyasyon/fiyat/stok) toplu olarak değiştirir.
 * Geri alınamaz bir işlem olduğu için yazılı onay ister ve her ilanın önceki envanterini
 * değiştirmeden önce denetim kaydına yedekler.
 */
export async function POST(req: Request) {
  try {
    const session = await getAuthoritativeSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimit = await checkRateLimit(`etsy:bulk-inventory:${session.id}`, 5, 10 * 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: 'Toplu envanter güncelleme limiti aşıldı. Lütfen biraz sonra tekrar deneyin.' }, {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { listingIds, variations, confirmationPhrase } = body as { listingIds?: unknown; variations?: VariationInput[]; confirmationPhrase?: unknown };

    if (confirmationPhrase !== BULK_INVENTORY_CONFIRMATION) {
      return NextResponse.json({ success: false, error: `Canlı ilanların envanterini değiştirmek için "${BULK_INVENTORY_CONFIRMATION}" onayı gerekiyor.` }, { status: 400 });
    }

    if (!Array.isArray(listingIds) || listingIds.length === 0) {
      return NextResponse.json({ success: false, error: 'En az bir ilan ID si gereklidir.' }, { status: 400 });
    }
    if (listingIds.length > MAX_LISTINGS_PER_REQUEST || !listingIds.every((id) => /^\d+$/.test(String(id)))) {
      return NextResponse.json({ success: false, error: `Geçersiz ilan listesi (en fazla ${MAX_LISTINGS_PER_REQUEST} sayısal ID).` }, { status: 400 });
    }

    const validation = validateBulkVariations(variations);
    if (!validation.ok) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
    }
    const { products: productsPayload, usedProperties, hasSku } = validation;

    const tokenRes = await getValidEtsyToken(session.id);
    if (!tokenRes.success) {
      return NextResponse.json({ success: false, error: tokenRes.error }, { status: tokenRes.error?.includes('dolmuş') ? 401 : 400 });
    }

    const { access_token: etsy_access_token, api_key: etsyApiKey, shared_secret: etsySharedSecret } = tokenRes;

    const headers = {
      'x-api-key': `${etsyApiKey}:${etsySharedSecret || ''}`,
      'Authorization': `Bearer ${etsy_access_token}`,
      'Content-Type': 'application/json',
    };

    const results: Array<{ listingId: string; success: boolean; error?: string; skipped?: boolean }> = [];
    let rateLimited = false;

    for (const rawId of listingIds) {
      const listingId = String(rawId);
      if (rateLimited) {
        results.push({ listingId, success: false, skipped: true, error: 'Etsy istek sınırı nedeniyle işlenmedi.' });
        continue;
      }
      try {
        // 1. Mevcut envanteri oku. Okunamazsa ilan değiştirilmez: yedeği olmayan bir envanterin
        //    üzerine yazılmaz ve hazırlık süresi (readiness_state_id) bilinmeden ürün gönderilmez.
        const invGetRes = await etsyFetch(`https://openapi.etsy.com/v3/application/listings/${listingId}/inventory`, { method: 'GET', headers });
        if (!invGetRes.ok) {
          if (invGetRes.status === 429) rateLimited = true;
          results.push({ listingId, success: false, error: await readEtsyError(invGetRes, 'Mevcut envanter okunamadı; ilan değiştirilmedi') });
          continue;
        }
        const currentInv = await invGetRes.json();
        const readinessStateId = currentInv?.products?.[0]?.offerings?.[0]?.readiness_state_id;

        // 2. Önceki envanteri yedekle (denetim kaydı; gizli bilgi içermez).
        await sql`
          INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, metadata)
          VALUES (${`audit-${randomUUID()}`}, ${session.id}, 'etsy.inventory.backup', 'etsy_listing', ${listingId},
                  ${JSON.stringify({ inventory: currentInv })}::jsonb)
        `.catch((backupError: unknown) => {
          throw new Error(`Envanter yedeği alınamadı: ${getErrorMessage(backupError)}`);
        });

        // 3. Yeni envanteri yaz.
        const payload = {
          products: productsPayload.map((p) => ({
            ...p,
            offerings: p.offerings.map((o) => ({
              ...o,
              ...(readinessStateId !== undefined ? { readiness_state_id: readinessStateId } : {}),
            })),
          })),
          price_on_property: usedProperties,
          quantity_on_property: usedProperties,
          sku_on_property: hasSku ? usedProperties : [],
        };

        const invRes = await etsyFetch(`https://openapi.etsy.com/v3/application/listings/${listingId}/inventory`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(payload),
        });

        if (invRes.ok) {
          results.push({ listingId, success: true });
        } else {
          if (invRes.status === 429) rateLimited = true;
          results.push({ listingId, success: false, error: await readEtsyError(invRes, 'Etsy envanteri güncellemeyi reddetti') });
        }
      } catch (e) {
        results.push({ listingId, success: false, error: getErrorMessage(e) });
      }
    }

    const succeeded = results.filter((r) => r.success).length;
    return NextResponse.json({ success: true, succeeded, failed: results.length - succeeded, rateLimited, results });

  } catch (error) {
    console.error('Etsy Bulk Update Error:', error);
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  }
}
