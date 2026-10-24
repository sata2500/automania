export const MAX_ETSY_TAGS = 13;
export const MAX_ETSY_TAG_LENGTH = 20;
export const MAX_ETSY_TITLE_LENGTH = 140;
export const MAX_ETSY_PHOTOS = 20;
export const MAX_ETSY_VIDEOS = 2;
export const MAX_ETSY_VARIATION_PRODUCTS = 4900;

export type EtsyMediaItem = string | { url?: unknown; isVideo?: unknown };

function isVideoItem(item: EtsyMediaItem): boolean {
  if (typeof item === 'object' && item !== null) return item.isVideo === true;
  return /\.(mp4|webm|mov)(?:$|[?#])/i.test(item);
}

function getMediaUrl(item: EtsyMediaItem): string | null {
  const url = typeof item === 'string' ? item : item?.url;
  return typeof url === 'string' && url.trim().length > 0 ? url : null;
}

export function validateEtsyDraftPreflight(
  input: {
    state?: unknown;
    title?: unknown;
    description?: unknown;
    tags?: unknown;
    taxonomyId?: unknown;
    variations?: unknown;
    images?: unknown;
  },
  options: { allowActive?: boolean; requirePhoto?: boolean } = {},
): string[] {
  const errors: string[] = [];

  const isActive = input.state === 'active';
  if (input.state !== undefined && input.state !== 'draft' && !(isActive && options.allowActive)) {
    errors.push('Etsy yayınlama state değeri geçersiz.');
  }
  if (typeof input.title !== 'string' || input.title.trim().length === 0) {
    errors.push('Başlık zorunludur.');
  } else if (input.title.length > MAX_ETSY_TITLE_LENGTH) {
    errors.push(`Başlık en fazla ${MAX_ETSY_TITLE_LENGTH} karakter olabilir.`);
  }
  if (typeof input.description !== 'string' || input.description.trim().length === 0) {
    errors.push('Açıklama zorunludur.');
  }
  if (!Array.isArray(input.tags) || input.tags.length === 0) {
    errors.push('En az bir Etsy etiketi gereklidir.');
  } else {
    if (input.tags.length > MAX_ETSY_TAGS) errors.push(`En fazla ${MAX_ETSY_TAGS} etiket kullanılabilir.`);
    const invalidTag = input.tags.find(tag => typeof tag !== 'string' || tag.trim().length === 0 || tag.trim().length > MAX_ETSY_TAG_LENGTH);
    if (invalidTag !== undefined) errors.push(`Her etiket 1-${MAX_ETSY_TAG_LENGTH} karakter arasında olmalıdır.`);
  }

  const taxonomyId = Number(input.taxonomyId);
  if (!Number.isInteger(taxonomyId) || taxonomyId <= 0) errors.push('Geçerli bir Etsy taxonomy ID gereklidir.');

  if (!Array.isArray(input.variations)) {
    errors.push('Varyasyon matrisi geçersiz.');
  } else if (input.variations.length > MAX_ETSY_VARIATION_PRODUCTS) {
    errors.push(`Variation matrisi en fazla ${MAX_ETSY_VARIATION_PRODUCTS} ürün içerebilir.`);
  }

  if (input.images !== undefined && !Array.isArray(input.images)) {
    errors.push('Medya listesi geçersiz.');
  } else if (Array.isArray(input.images)) {
    const invalidMedia = input.images.some(item => !getMediaUrl(item as EtsyMediaItem));
    if (invalidMedia) errors.push('Her medya girdisi geçerli bir URL veya data URL içermelidir.');
    const videos = input.images.filter(item => isVideoItem(item as EtsyMediaItem)).length;
    const photos = input.images.length - videos;
    if (photos > MAX_ETSY_PHOTOS) errors.push(`En fazla ${MAX_ETSY_PHOTOS} fotoğraf yüklenebilir.`);
    if (videos > MAX_ETSY_VIDEOS) errors.push(`En fazla ${MAX_ETSY_VIDEOS} video yüklenebilir.`);
    if (options.requirePhoto && photos < 1) errors.push('Canlı yayın için en az bir fotoğraf gereklidir.');
  } else if (options.requirePhoto) {
    errors.push('Canlı yayın için en az bir fotoğraf gereklidir.');
  }

  return errors;
}

/** Etsy Open API ilan başına yalnızca 1 videoyu kabul eder (videos uç noktası mevcut videoyu değiştirir). */
export const MAX_ETSY_API_VIDEOS = 1;

/**
 * Bir klasörün medyasını Etsy'ye gönderilebilecek sınırlara indirir (sıra korunur).
 * Atlananların sayısı kullanıcıya bildirilmek üzere döner.
 */
export function selectEtsyPublishMedia<T extends { isVideo?: boolean }>(items: T[]): {
  photos: T[];
  videos: T[];
  skippedPhotos: number;
  skippedVideos: number;
} {
  const allPhotos = items.filter((item) => item.isVideo !== true);
  const allVideos = items.filter((item) => item.isVideo === true);
  return {
    photos: allPhotos.slice(0, MAX_ETSY_PHOTOS),
    videos: allVideos.slice(0, MAX_ETSY_API_VIDEOS),
    skippedPhotos: Math.max(0, allPhotos.length - MAX_ETSY_PHOTOS),
    skippedVideos: Math.max(0, allVideos.length - MAX_ETSY_API_VIDEOS),
  };
}

/** Son yıllarda yapılmış (vintage olmayan) ürünleri belirten when_made değerleri. */
function isRecentWhenMade(whenMade: unknown): boolean {
  return whenMade === 'made_to_order' || (typeof whenMade === 'string' && /^20(0[7-9]|1\d|2\d)/.test(whenMade));
}

/**
 * Etsy, başkası tarafından yapılmış yeni (vintage olmayan) bitmiş ürünleri kabul etmez. Baskı-isteğe-bağlı
 * (POD) ürünlerde doğru beyan "Ben yaptım (i_did)" + üretim ortağıdır. Geçersiz kombinasyonda hata döner.
 */
export function validateWhoMade(input: { whoMade?: unknown; isSupply?: unknown; whenMade?: unknown }): string | null {
  if (input.whoMade === 'someone_else' && input.isSupply !== true && isRecentWhenMade(input.whenMade)) {
    return 'Etsy, başkası tarafından yapılmış yeni bir bitmiş ürünü kabul etmez. Baskı-isteğe-bağlı ürünler için "Kim yaptı" alanını "Ben yaptım" seçip üretim ortağınızı (ör. Printify/Printful) belirtin.';
  }
  return null;
}
