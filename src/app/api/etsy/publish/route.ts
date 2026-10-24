import { NextResponse } from 'next/server';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { getValidEtsyToken } from '@/lib/etsy-token-manager';
import { validateEtsyDraftPreflight, validateWhoMade } from '@/lib/etsy-preflight';
import { etsyFetch, readEtsyError } from '@/lib/etsy-api';
import { createEtsyDraftListing, EtsyListingError, type EtsyDraftListingResult } from '@/lib/etsy-listing-service';
import { sanitizeEtsyTags } from '@/lib/etsy-format';
import { checkRateLimit } from '@/lib/request-rate-limit';
import { writeAuditLog } from '@/lib/audit-log';
import {
  hasExplicitLivePublishConfirmation,
  isLivePublishEnabled,
  resolveEtsyPublishMode,
} from '@/lib/etsy-publish-mode';

// 20 görsel + video + envanter adımları sıralı yapıldığında 60 sn yetmeyebiliyor.
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const session = await getAuthoritativeSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      title,
      description,
      tags,
      price = 24.99,
      quantity = 999,
      variations = [],
      images = [],
      shipping_profile_id,
      readiness_state_id,
      state: requestedState,
      publishMode: requestedPublishMode,
      confirmLivePublish,
      confirmationPhrase,
      taxonomy_id = 1081,
      who_made = 'i_did',
      when_made = 'made_to_order',
      is_supply = false,
      production_partner_id,
      is_customizable = false,
      sku,
      materials = [],
      styles = [],
      shop_section_id,
      return_policy_id,
      should_auto_renew = false,
      taxonomy_properties_values = {}
    } = body;

    const state = resolveEtsyPublishMode({
      publishMode: requestedPublishMode,
      state: requestedState,
    });
    if (!state) {
      return NextResponse.json({ success: false, error: 'Geçersiz Etsy yayınlama modu.' }, { status: 400 });
    }

    if (state === 'active') {
      if (!isLivePublishEnabled(process.env.ETSY_LIVE_PUBLISH_ENABLED)) {
        return NextResponse.json({
          success: false,
          error: 'Canlı Etsy yayınlama bu sunucuda devre dışıdır.',
        }, { status: 403 });
      }
      if (!hasExplicitLivePublishConfirmation({ confirmLivePublish, confirmationPhrase })) {
        return NextResponse.json({
          success: false,
          error: 'Canlı yayın için açık kullanıcı onayı gereklidir.',
        }, { status: 400 });
      }
    }

    const rateLimit = await checkRateLimit(
      `etsy:publish:${state}:${session.id}`,
      state === 'active' ? 2 : 5,
      state === 'active' ? 30 * 60_000 : 10 * 60_000,
    );
    if (!rateLimit.allowed) {
      return NextResponse.json({
        success: false,
        error: state === 'active' ? 'Canlı Etsy yayınlama limiti aşıldı.' : 'Etsy draft oluşturma limiti aşıldı.',
      }, {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      });
    }

    if (!title || !description || !tags || !Array.isArray(tags)) {
      return NextResponse.json({ success: false, error: 'Başlık, açıklama ve etiketler zorunludur.' }, { status: 400 });
    }

    const preflightErrors = validateEtsyDraftPreflight({
      state,
      title,
      description,
      tags,
      taxonomyId: taxonomy_id,
      variations,
      images,
    }, {
      allowActive: state === 'active',
      requirePhoto: state === 'active',
    });
    if (preflightErrors.length > 0) {
      return NextResponse.json({ success: false, error: preflightErrors.join(' ') }, { status: 400 });
    }

    const whoMadeError = validateWhoMade({ whoMade: who_made, isSupply: is_supply, whenMade: when_made });
    if (whoMadeError) {
      return NextResponse.json({ success: false, error: whoMadeError }, { status: 400 });
    }

    const taxonomyId = Number(taxonomy_id);
    // Etsy'nin karakter kurallarına uymayan etiketler (ör. & veya virgül) tüm isteği bozar.
    const validTags = sanitizeEtsyTags(tags);
    if (validTags.length === 0) {
      return NextResponse.json({ success: false, error: 'Geçerli en az bir etiket gerekiyor (en fazla 20 karakter; harf, rakam, boşluk, - ve \').' }, { status: 400 });
    }

    // Yalnızca isteği yapan kullanıcının kendi Etsy bağlantısı kullanılır. Ortamdaki genel
    // bir token'a düşmek, bağlantısı olmayan kullanıcıların başka bir mağazaya ilan açmasına yol açardı.
    const tokenRes = await getValidEtsyToken(session.id);
    const etsyAccessToken = tokenRes.success ? tokenRes.access_token : undefined;
    const etsyShopId = tokenRes.success ? tokenRes.shop_id : undefined;
    const etsyApiKey = tokenRes.api_key || process.env.ETSY_API_KEY;
    const etsySharedSecret = tokenRes.shared_secret || process.env.ETSY_SHARED_SECRET;

    // Draft preview is safe without OAuth; live publication must never be simulated.
    if (!etsyAccessToken || !etsyShopId) {
      if (state === 'active') {
        return NextResponse.json({
          success: false,
          error: 'Canlı yayın için doğrulanmış Etsy mağaza bağlantısı gereklidir.',
        }, { status: 412 });
      }
      return NextResponse.json({
        success: true,
        simulated: true,
        message: 'Etsy Mağaza Bağlantısı Henüz Tamamlanmadı. Oluşturulan İlan İçeriği ve Varyasyon Tablosu Yayına Hazır!',
        draftPreview: {
          title: title.slice(0, 140),
          description,
          tags: validTags,
          price,
          quantity,
          variationsCount: variations.length,
          state
        }
      });
    }

    let draft: EtsyDraftListingResult;
    try {
      draft = await createEtsyDraftListing(session.id, { etsyAccessToken, etsyShopId, etsyApiKey, etsySharedSecret }, {
        title, description, validTags, price, quantity, taxonomyId,
        who_made, when_made, is_supply, production_partner_id, materials, styles,
        is_customizable, should_auto_renew, shipping_profile_id, readiness_state_id,
        shop_section_id, return_policy_id, sku, taxonomy_properties_values, variations, images,
      });
    } catch (error) {
      if (error instanceof EtsyListingError) {
        if (error.status !== 400) console.warn('[Etsy Publish]', error.message);
        return NextResponse.json({ success: false, draftCreated: false, error: error.message }, { status: error.status });
      }
      throw error;
    }
    const { listingId, listingUrl, variationsUpdated, imageItems, videoItems, uploadErrors } = draft;
    const { imagesUploaded } = draft;

    let activated = false;
    if (state === 'active') {
      const blockingUploadErrors = uploadErrors.filter((error) => !error.startsWith('Bilgi:'));
      // Canlı yayın yalnızca gönderilen her görsel yüklendiyse ve hiçbir adım başarısız olmadıysa yapılır.
      if (!listingId || imagesUploaded < 1 || imagesUploaded < imageItems.length || blockingUploadErrors.length > 0) {
        const error = !listingId
          ? 'Etsy listing kimliği alınamadığı için canlı yayın durduruldu.'
          : imagesUploaded < 1
            ? 'Canlı yayın için en az bir görselin Etsy’ye başarıyla yüklenmesi gerekir.'
            : 'Görsel, varyasyon veya kategori adımlarındaki hatalar nedeniyle canlı yayın durduruldu.';
        await writeAuditLog({
          userId: session.id,
          action: 'etsy.listing.publish_blocked',
          resourceType: 'etsy_listing',
          resourceId: listingId ? String(listingId) : undefined,
          metadata: {
            requestedState: state,
            resultingState: 'draft',
            taxonomyId,
            imageCount: imageItems.length,
            imagesUploaded,
            videoCount: videoItems.length,
            variationCount: Array.isArray(variations) ? variations.length : 0,
            uploadErrorCount: uploadErrors.length,
          },
        });
        return NextResponse.json({
          success: false,
          draftCreated: Boolean(listingId),
          listingId,
          state: 'draft',
          error,
          uploadErrors: uploadErrors.length > 0 ? uploadErrors : undefined,
        }, { status: 502 });
      }

      try {
        const activateRes = await etsyFetch(
          `https://openapi.etsy.com/v3/application/shops/${etsyShopId}/listings/${listingId}`,
          {
            method: 'PATCH',
            headers: {
              'x-api-key': `${etsyApiKey}:${etsySharedSecret || ''}`,
              'Authorization': `Bearer ${etsyAccessToken}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({ state: 'active' }),
          },
        );

        if (!activateRes.ok) {
          console.warn('[Etsy Publish] Listing activation failed', { status: activateRes.status });
          await writeAuditLog({
            userId: session.id,
            action: 'etsy.listing.publish_failed',
            resourceType: 'etsy_listing',
            resourceId: String(listingId),
            metadata: {
              requestedState: state,
              resultingState: 'draft',
              activationStatus: activateRes.status,
              taxonomyId,
              imageCount: imageItems.length,
              imagesUploaded,
              variationCount: Array.isArray(variations) ? variations.length : 0,
            },
          });
          return NextResponse.json({
            success: false,
            draftCreated: true,
            listingId,
            state: 'draft',
            error: `${await readEtsyError(activateRes, 'İlan taslak olarak oluşturuldu ancak Etsy yayına almayı reddetti')} Taslağı Etsy panelinden kontrol edebilirsiniz.`,
          }, { status: 502 });
        }
        activated = true;
      } catch {
        await writeAuditLog({
          userId: session.id,
          action: 'etsy.listing.publish_failed',
          resourceType: 'etsy_listing',
          resourceId: String(listingId),
          metadata: {
            requestedState: state,
            resultingState: 'draft',
            activationStatus: 'network_error',
            taxonomyId,
            imageCount: imageItems.length,
            imagesUploaded,
            variationCount: Array.isArray(variations) ? variations.length : 0,
          },
        });
        return NextResponse.json({
          success: false,
          draftCreated: true,
          listingId,
          state: 'draft',
          error: 'Listing taslak olarak oluşturuldu ancak canlı yayınlama bağlantısı başarısız oldu.',
        }, { status: 502 });
      }
    }

    const resultingState = activated ? 'active' : 'draft';
    const blockingErrors = uploadErrors.filter((error) => !error.startsWith('Bilgi:'));
    await writeAuditLog({
      userId: session.id,
      action: activated ? 'etsy.listing.published' : 'etsy.draft_listing.created',
      resourceType: 'etsy_listing',
      resourceId: listingId ? String(listingId) : undefined,
      metadata: {
        requestedState: state,
        resultingState,
        taxonomyId,
        imageCount: imageItems.length,
        imagesUploaded,
        videoCount: videoItems.length,
        variationCount: Array.isArray(variations) ? variations.length : 0,
        uploadErrorCount: uploadErrors.length,
      },
    });

    return NextResponse.json({
      success: true,
      listingId,
      state: resultingState,
      listingUrl,
      variationsUpdated,
      imagesUploaded,
      imagesRequested: imageItems.length,
      partial: blockingErrors.length > 0,
      uploadErrors: uploadErrors.length > 0 ? uploadErrors : undefined,
      message: activated
        ? 'İlan Etsy mağazanızda canlı olarak yayınlandı.'
        : blockingErrors.length > 0
          ? `İlan taslak olarak oluşturuldu, ancak ${blockingErrors.length} adım tamamlanamadı (${imagesUploaded}/${imageItems.length} görsel yüklendi). Eksikleri Etsy panelinden tamamlayın.`
          : 'İlan Etsy mağazanıza taslak (DRAFT) olarak aktarıldı.',
    });

  } catch (error) {
    console.error('[Etsy Publish] Request failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ success: false, error: 'Etsy listing aktarımı başarısız oldu.' }, { status: 500 });
  }
}
