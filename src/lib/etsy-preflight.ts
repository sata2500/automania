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

export function validateEtsyDraftPreflight(input: {
  state?: unknown;
  title?: unknown;
  description?: unknown;
  tags?: unknown;
  taxonomyId?: unknown;
  variations?: unknown;
  images?: unknown;
}): string[] {
  const errors: string[] = [];

  if (input.state !== undefined && input.state !== 'draft') {
    errors.push('Etsy güvenlik politikası nedeniyle yalnızca draft listing oluşturulabilir.');
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
  }

  return errors;
}
