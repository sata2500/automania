/**
 * Yapay zekâya giden tüm talimatların (prompt) tek kaydı.
 *
 * Her talimat admin panelinde (AI Ayarları › Sistem Promptları) görünür ve düzenlenebilir; sunucu
 * yalnızca buradaki anahtarlarla kayıtlı metni kullanır, alan boşsa aşağıdaki varsayılanı. Kodda başka
 * yerde yapay zekâya talimat yazılmaz; kod yalnızca {{değişken}} değerlerini (veri) doldurur.
 * Bu dosya istemci tarafında da kullanılır (sunucu bağımlılığı yoktur).
 */
import {
  DEFAULT_ANALYZE_DESIGN_PROMPT,
  DEFAULT_DESIGN_VARIANT_PROMPT,
  DEFAULT_GENERATE_DESIGN_PROMPT,
  DEFAULT_GENERATE_LISTING_PROMPT,
  DEFAULT_GENERATE_VIDEO_PROMPT,
  DEFAULT_NICHE_RESEARCH_PROMPT,
  DEFAULT_OPTIMIZE_LISTING_PROMPT,
} from '@/lib/default-prompts';
import {
  LEGACY_ANALYZE_DESIGN_V1,
  LEGACY_ANALYZE_DESIGN_V2,
  LEGACY_ANALYZE_LISTING_IMAGE,
  LEGACY_GENERATE_DESIGN_V1,
  LEGACY_GENERATE_DESIGN_V2,
  LEGACY_GENERATE_DESIGN_V3,
  LEGACY_GENERATE_LISTING,
  LEGACY_GENERATE_LISTING_V2,
  LEGACY_GENERATE_VIDEO,
  LEGACY_GENERATE_VIDEO_V2,
  LEGACY_NICHE_RESEARCH_V1,
  LEGACY_OPTIMIZE_LISTING,
} from '@/lib/legacy-prompts';

export type PromptKey =
  | 'ai_prompt_analyze_design'
  | 'ai_prompt_generate_design'
  | 'ai_prompt_design_variant'
  | 'ai_prompt_generate_listing'
  | 'ai_prompt_optimize_listing'
  | 'ai_prompt_niche_research'
  | 'ai_prompt_generate_video';

export type PromptGroup = 'design' | 'listing' | 'automation' | 'video';

export interface PromptVariable {
  tag: string;
  label: string;
  desc: string;
  icon: string;
}

export interface PromptDefinition {
  key: PromptKey;
  group: PromptGroup;
  title: string;
  /** Talimatın ne zaman ve nerede kullanıldığı (admin panelinde gösterilir). */
  description: string;
  defaultValue: string;
  variables: PromptVariable[];
  /** Kayıtlı değer bunlardan biriyle aynıysa (hiç düzenlenmemiş eski varsayılan) güncel varsayılan kullanılır. */
  legacyDefaults?: string[];
}

export const PROMPT_GROUPS: Array<{ id: PromptGroup; label: string }> = [
  { id: 'design', label: 'Tasarım' },
  { id: 'listing', label: 'İlan & SEO' },
  { id: 'automation', label: 'Otomasyon' },
  { id: 'video', label: 'Video' },
];

const v = (tag: string, label: string, desc: string, icon: string): PromptVariable => ({ tag: `{{${tag}}}`, label, desc, icon });

export const PROMPT_DEFINITIONS: PromptDefinition[] = [
  {
    key: 'ai_prompt_analyze_design',
    group: 'design',
    title: 'Görsel analizi',
    description: 'Bir tasarımı veya Etsy ilanının kapak görselini inceler: üzerindeki yazı, konu, stil, renkler, aday etiketler ve Etsy kategorisi. Tasarımlar › Analiz ile İlanlarım › Görsel analiz bunu kullanır. JSON alan adlarını değiştirmeyin.',
    defaultValue: DEFAULT_ANALYZE_DESIGN_PROMPT,
    legacyDefaults: [LEGACY_ANALYZE_DESIGN_V1, LEGACY_ANALYZE_DESIGN_V2, LEGACY_ANALYZE_LISTING_IMAGE],
    variables: [
      v('taxonomyHint', 'Kategori listesi', 'Admin panelinde etkin Etsy kategorilerinin ID, ad ve yolları (etkin kategori yoksa T-shirts ve Sweatshirts).', '🏷️'),
    ],
  },
  {
    key: 'ai_prompt_generate_design',
    group: 'design',
    title: 'Tasarım üretimi',
    description: 'Görsel modeline giden tasarım talimatı (Tasarımlar › AI ile üret ve otomasyon): tasarım kuralları, kare ve ortalı kompozisyon, düz perde arka plan. Perde rengi konuya göre seçilir (yeşil ağırlıklı konularda magenta, diğerlerinde yeşil) ve sonradan otomatik kaldırılır.',
    defaultValue: DEFAULT_GENERATE_DESIGN_PROMPT,
    legacyDefaults: [LEGACY_GENERATE_DESIGN_V1, LEGACY_GENERATE_DESIGN_V2, LEGACY_GENERATE_DESIGN_V3],
    variables: [
      v('concept', 'Konsept', 'Elle üretimde kullanıcının yazdığı açıklama; otomasyonda niş, hedef kitle, ürün ve notlar (araştırmanın tasarım özeti dahil).', '📝'),
      v('style', 'Stil', 'Elle üretimde seçilen stil; otomasyonda niş araştırmasının önerdiği stil (yoksa "not specified").', '✨'),
      v('audienceGroup', 'Kitle', 'Otomasyonun hedef kitlesi (ör. "men\'s t-shirt"; elle üretimde "not specified").', '👥'),
      v('fabric', 'Kumaş', 'Tasarımın basılacağı kumaş rengi: açık, koyu veya ikisi de (otomasyon ayarından).', '🧵'),
      v('keyColorName', 'Perde rengi adı', '"pure chroma-key green" veya "pure magenta".', '🎨'),
      v('keyColorHex', 'Perde rengi kodu', '#00FF00 veya #FF00FF.', '#️⃣'),
    ],
  },
  {
    key: 'ai_prompt_design_variant',
    group: 'design',
    title: 'Diğer kumaş versiyonu',
    description: 'Otomasyonda "Diğer kumaş rengi için ayrı versiyon" açıksa ana tasarım görsel modeline gönderilir ve diğer kumaş rengine uygun renklerle yeniden çizilir; o renkteki mockup\'larda bu versiyon kullanılır.',
    defaultValue: DEFAULT_DESIGN_VARIANT_PROMPT,
    variables: [
      v('fabric', 'Hedef kumaş', 'Versiyonun basılacağı kumaş rengi (ör. "dark-colored garments (black, navy, charcoal)").', '🧵'),
      v('keyColorName', 'Perde rengi adı', '"pure chroma-key green" veya "pure magenta".', '🎨'),
      v('keyColorHex', 'Perde rengi kodu', '#00FF00 veya #FF00FF.', '#️⃣'),
    ],
  },
  {
    key: 'ai_prompt_generate_listing',
    group: 'listing',
    title: 'İlan metni üretimi',
    description: 'Yeni ilan için başlık, 13 etiket, açıklama, kategori nitelikleri ve mağaza bölümünü üretir (SEO stüdyosu ve otomasyon). JSON alan adlarını değiştirmeyin.',
    defaultValue: DEFAULT_GENERATE_LISTING_PROMPT,
    legacyDefaults: [LEGACY_GENERATE_LISTING, LEGACY_GENERATE_LISTING_V2],
    variables: [
      v('audienceGroup', 'Kitle', 'Otomasyonun hedef kitlesi (ör. "men\'s t-shirt").', '👥'),
      v('garments', 'Ürün modelleri', 'Otomasyonda yazılan ürün modelleri (ör. Comfort Colors 1717, Bella+Canvas 3001).', '👕'),
      v('designDescription', 'Tasarım açıklaması', 'Görsel analizinden veya otomasyonun tasarım konseptinden gelen açıklama.', '📝'),
      v('primarySubject', 'Ana konu', 'Tasarımın ana konusu (alakasız kelimeleri elemek için).', '🎯'),
      v('primaryAesthetic', 'Stil & estetik', 'Tasarımın görsel stili.', '✨'),
      v('productType', 'Ürün tipi', 'Ürün tipi (girilmemişse "Not specified").', '👕'),
      v('userNotes', 'Mağaza notları', 'Kullanıcının ürün/kumaş/beden notları (girilmemişse "None provided").', '📌'),
      v('keywords', 'Aday anahtar kelimeler', 'Kelime havuzundan metriklerle zenginleştirilmiş aday etiketler.', '🔑'),
      v('coOccurringTags', 'Rakip etiketleri', 'Çok satan rakiplerde bu kelimelerle birlikte kullanılan etiketler.', '🔗'),
      v('taxonomyId', 'Kategori ID', 'Seçilen Etsy kategori numarası.', '🆔'),
      v('shopSections', 'Mağaza bölümleri', 'Bağlı mağazanın bölüm listesi.', '🏪'),
      v('taxonomyProperties', 'Kategori nitelikleri', 'Kategoriye özel nitelikler ve geçerli değerleri.', '⚙️'),
    ],
  },
  {
    key: 'ai_prompt_optimize_listing',
    group: 'listing',
    title: 'Mevcut ilanı iyileştirme',
    description: 'İlanlarım sayfasında mevcut bir Etsy ilanının başlık, etiket ve açıklamasını iyileştirir (tekil ve toplu "SEO optimize"). JSON alan adlarını değiştirmeyin.',
    defaultValue: DEFAULT_OPTIMIZE_LISTING_PROMPT,
    legacyDefaults: [LEGACY_OPTIMIZE_LISTING],
    variables: [
      v('title', 'Mevcut başlık', 'İlanın şu anki başlığı.', '🏷️'),
      v('tags', 'Mevcut etiketler', 'İlanın şu anki etiketleri.', '🔖'),
      v('description', 'Mevcut açıklama', 'İlanın şu anki açıklaması.', '📄'),
      v('price', 'Fiyat', 'İlan fiyatı ve para birimi.', '💲'),
      v('productType', 'Ürün tipi', 'Görsel analizindeki ürün tipi.', '👕'),
      v('primarySubject', 'Ana konu', 'Görsel analizindeki ana konu.', '🎯'),
      v('primaryAesthetic', 'Stil', 'Görsel analizindeki stil.', '✨'),
      v('colors', 'Renkler', 'Görsel analizinde bulunan baskın renkler.', '🎨'),
      v('visualDescription', 'Görsel açıklaması', 'Görsel analizindeki açıklama.', '🖼️'),
      v('poolKeywords', 'Havuz kelimeleri', 'Kelime havuzundaki yüksek fırsatlı kelimeler.', '🔑'),
      v('userInstructions', 'Kullanıcı talimatı', 'Optimizasyon sırasında yazılan ek talimat (yoksa "None").', '💬'),
    ],
  },
  {
    key: 'ai_prompt_niche_research',
    group: 'automation',
    title: 'Niş araştırması',
    description: 'Otomasyonda "Konuyu yapay zekâ belirlesin" seçiliyse her çalıştırmada tasarım nişini seçer. Web araması admin ayarından açılır. JSON alan adlarını değiştirmeyin.',
    defaultValue: DEFAULT_NICHE_RESEARCH_PROMPT,
    legacyDefaults: [LEGACY_NICHE_RESEARCH_V1],
    variables: [
      v('audienceGroup', 'Kitle', 'Otomasyonun hedef kitlesi (ör. "women\'s t-shirt").', '👥'),
      v('today', 'Bugün', 'Bugünün tarihi (YYYY-AA-GG).', '📅'),
      v('productType', 'Ürün tipi', 'Otomasyonun ürün tipi.', '👕'),
      v('category', 'Etsy kategorisi', 'Otomasyonun Etsy kategori yolu (yoksa "not specified").', '🗂️'),
      v('focus', 'Genel yön', 'Otomasyonda yazılan genel yön (yoksa "none").', '🧭'),
      v('upcomingEvents', 'Yaklaşan özel günler', 'Önümüzdeki 120 gündeki ABD özel günleri.', '🎉'),
      v('topListings', 'En iyi ilanlar', 'Mağazanın en çok favorilenen/görüntülenen ilanları.', '⭐'),
      v('poolKeywords', 'Havuz kelimeleri', 'Kelime havuzundaki fırsat skorlu kelimeler.', '🔑'),
      v('recentNiches', 'Son nişler', 'Bu otomasyonun son kullandığı nişler (tekrarı önlemek için).', '🔁'),
    ],
  },
  {
    key: 'ai_prompt_generate_video',
    group: 'video',
    title: 'Video üretimi',
    description: 'Otomasyonda tanıtım videosu üretilirken modele giden talimat. Tasarımın kendisi ve basıldığı ilk mockup referans olarak eklenir (video bu görsellerle başlamaz). Omni Flash 5 sn, Veo 8 sn (referans modu) üretir; Vertex AI\'da Veo sessiz üretilir.',
    defaultValue: DEFAULT_GENERATE_VIDEO_PROMPT,
    legacyDefaults: [LEGACY_GENERATE_VIDEO, LEGACY_GENERATE_VIDEO_V2],
    variables: [
      v('garment', 'Ürün modeli', 'Otomasyondaki ilk ürün modeli (ilk görseldeki ürün, ör. Comfort Colors 1717).', '🏷️'),
      v('product', 'Ürün tipi', 'Otomasyonun ürün tipi (ör. t-shirt).', '👕'),
      v('niche', 'Niş', 'Tasarımın konusu.', '🎯'),
      v('title', 'Ürün başlığı', 'Üretilen ilan başlığı.', '🏷️'),
      v('designPrompt', 'Tasarım konsepti', 'Tasarımın üretildiği konsept metni.', '📝'),
    ],
  },
];

export const PROMPT_KEYS: PromptKey[] = PROMPT_DEFINITIONS.map((d) => d.key);

export function getPromptDefinition(key: PromptKey): PromptDefinition {
  const definition = PROMPT_DEFINITIONS.find((d) => d.key === key);
  if (!definition) throw new Error(`Unknown prompt key: ${key}`);
  return definition;
}

const normalize = (text: string) => text.replace(/\r\n/g, '\n').trim();

/** Kullanılacak talimat: kayıtlı metin; boşsa veya hiç düzenlenmemiş eski varsayılansa güncel varsayılan. */
export function resolvePrompt(key: PromptKey, stored: string | null | undefined): string {
  const definition = getPromptDefinition(key);
  const value = normalize(stored ?? '');
  if (!value) return definition.defaultValue;
  if (definition.legacyDefaults?.some((legacy) => normalize(legacy) === value)) return definition.defaultValue;
  return value;
}

/** {{değişken}} yer tutucularını doldurur; bilinmeyen yer tutucular olduğu gibi kalır. */
export function fillPrompt(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) => (name in values ? values[name]! : match));
}
