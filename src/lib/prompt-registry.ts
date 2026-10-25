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
  DEFAULT_ANALYZE_LISTING_IMAGE_PROMPT,
  DEFAULT_AUTOMATION_DESIGN_PROMPT,
  DEFAULT_CREATIVE_DIRECTIONS,
  DEFAULT_DESIGN_CANVAS_PROMPT,
  DEFAULT_GENERATE_DESIGN_PROMPT,
  DEFAULT_GENERATE_LISTING_PROMPT,
  DEFAULT_GENERATE_VIDEO_PROMPT,
  DEFAULT_NICHE_RESEARCH_PROMPT,
  DEFAULT_OPTIMIZE_LISTING_PROMPT,
  DEFAULT_SEASONALITY_PROMPT,
  LEGACY_ANALYZE_DESIGN_PROMPT,
  LEGACY_GENERATE_DESIGN_PROMPT,
} from '@/lib/default-prompts';

export type PromptKey =
  | 'ai_prompt_analyze_design'
  | 'ai_prompt_generate_design'
  | 'ai_prompt_design_canvas'
  | 'ai_prompt_generate_listing'
  | 'ai_prompt_seasonality'
  | 'ai_prompt_analyze_listing_image'
  | 'ai_prompt_optimize_listing'
  | 'ai_prompt_niche_research'
  | 'ai_prompt_automation_design'
  | 'ai_prompt_creative_directions'
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
    title: 'Tasarım görsel analizi',
    description: 'Tasarım yüklendiğinde görseli ve tipografiyi analiz edip Etsy kategorisine eşler (Tasarımlar › Analiz). JSON alan adlarını değiştirmeyin.',
    defaultValue: DEFAULT_ANALYZE_DESIGN_PROMPT,
    legacyDefaults: [LEGACY_ANALYZE_DESIGN_PROMPT],
    variables: [
      v('taxonomyHint', 'Kategori listesi', 'Admin panelinde etkin Etsy kategorilerinin ID, ad ve yolları (etkin kategori yoksa "482 = T-shirts, 2202 = Sweatshirts").', '🏷️'),
    ],
  },
  {
    key: 'ai_prompt_generate_design',
    group: 'design',
    title: 'Tasarım üretimi',
    description: 'Yapay zekâ ile tasarım üretirken (Tasarımlar › AI ile üret ve otomasyon) modele giden ana talimat. Altına "Tasarım tuvali ve arka plan" talimatı eklenir.',
    defaultValue: DEFAULT_GENERATE_DESIGN_PROMPT,
    legacyDefaults: [LEGACY_GENERATE_DESIGN_PROMPT],
    variables: [
      v('userPrompt', 'Tasarım konsepti', 'Kullanıcının yazdığı açıklama; otomasyonda "Otomasyon tasarım konsepti" talimatının sonucu.', '📝'),
      v('selectedStyle', 'Stil / niş', 'Seçilen stil; otomasyonda tasarımın nişi.', '✨'),
    ],
  },
  {
    key: 'ai_prompt_design_canvas',
    group: 'design',
    title: 'Tasarım tuvali ve arka plan',
    description: 'Her tasarım üretiminin sonuna eklenir: kare ve ortalı kompozisyon, düz perde rengi (sonradan saydamlaştırılır), temiz kenarlar. Perde rengi konuya göre seçilir: yeşil ağırlıklı konularda magenta, diğerlerinde yeşil.',
    defaultValue: DEFAULT_DESIGN_CANVAS_PROMPT,
    variables: [
      v('keyColorName', 'Perde rengi adı', '"pure chroma-key green" veya "pure magenta".', '🎨'),
      v('keyColorHex', 'Perde rengi kodu', '#00FF00 veya #FF00FF.', '#️⃣'),
    ],
  },
  {
    key: 'ai_prompt_generate_listing',
    group: 'listing',
    title: 'İlan metni üretimi (SEO)',
    description: 'Etsy başlığı, 13 etiket, açıklama, kategori nitelikleri ve mağaza bölümünü üretir (SEO stüdyosu ve otomasyon). JSON alan adlarını değiştirmeyin.',
    defaultValue: DEFAULT_GENERATE_LISTING_PROMPT,
    variables: [
      v('designDescription', 'Tasarım açıklaması', 'Görsel analizinden veya otomasyonun tasarım konseptinden gelen açıklama.', '📝'),
      v('primarySubject', 'Ana konu', 'Tasarımın ana konusu (alakasız kelimeleri elemek için).', '🎯'),
      v('primaryAesthetic', 'Stil & estetik', 'Tasarımın görsel stili.', '✨'),
      v('productType', 'Ürün tipi', 'Ürün tipi (girilmemişse "Not specified").', '👕'),
      v('userNotes', 'Özel notlar', 'Kullanıcının ürün/kumaş/beden notları (girilmemişse "None provided").', '📌'),
      v('seasonalityContext', 'Sezon rehberi', 'Bugünün sezonuna ait "Sezon rehberi" talimatı.', '🍂'),
      v('keywords', 'Aday anahtar kelimeler', 'Kelime havuzundan metriklerle zenginleştirilmiş aday etiketler.', '🔑'),
      v('coOccurringTags', 'Rakip etiketleri', 'Çok satan rakiplerde bu kelimelerle birlikte kullanılan etiketler.', '🔗'),
      v('taxonomyId', 'Kategori ID', 'Seçilen Etsy kategori numarası.', '🆔'),
      v('shopSections', 'Mağaza bölümleri', 'Bağlı mağazanın bölüm listesi.', '🏪'),
      v('taxonomyProperties', 'Kategori nitelikleri', 'Kategoriye özel nitelikler ve geçerli değerleri.', '⚙️'),
    ],
  },
  {
    key: 'ai_prompt_seasonality',
    group: 'listing',
    title: 'Sezon rehberi',
    description: 'İlan metni üretiminde {{seasonalityContext}} yerine bugünün sezonuna ait bölüm yazılır. Köşeli parantezli bölüm adlarını değiştirmeyin: q4_holiday (Kasım-Aralık), fall_halloween (Ağustos-Ekim), spring_mothers_day (15 Şubat-15 Mayıs), summer_vacation (16 Mayıs-Temmuz), winter_valentines (Ocak-14 Şubat).',
    defaultValue: DEFAULT_SEASONALITY_PROMPT,
    variables: [],
  },
  {
    key: 'ai_prompt_analyze_listing_image',
    group: 'listing',
    title: 'Etsy ilan görseli analizi',
    description: 'İlanlarım sayfasında ilanın kapak görselini analiz eder (tekil ve toplu "Görsel analiz"). JSON alan adlarını değiştirmeyin.',
    defaultValue: DEFAULT_ANALYZE_LISTING_IMAGE_PROMPT,
    variables: [],
  },
  {
    key: 'ai_prompt_optimize_listing',
    group: 'listing',
    title: 'Mevcut ilanı SEO optimizasyonu',
    description: 'İlanlarım sayfasında mevcut bir Etsy ilanının başlık, etiket ve açıklamasını iyileştirir (tekil ve toplu "SEO optimize"). JSON alan adlarını değiştirmeyin.',
    defaultValue: DEFAULT_OPTIMIZE_LISTING_PROMPT,
    variables: [
      v('seasonName', 'Sezon', 'Bugünün alışveriş sezonu.', '🍂'),
      v('seasonKeywords', 'Sezon temaları', 'Sezona ait önerilen temalar.', '🗓️'),
      v('poolKeywords', 'Havuz kelimeleri', 'Kelime havuzundaki yüksek fırsatlı kelimeler.', '🔑'),
      v('title', 'Mevcut başlık', 'İlanın şu anki başlığı.', '🏷️'),
      v('tags', 'Mevcut etiketler', 'İlanın şu anki etiketleri.', '🔖'),
      v('price', 'Fiyat', 'İlan fiyatı ve para birimi.', '💲'),
      v('productType', 'Ürün tipi', 'Görsel analizindeki ürün tipi.', '👕'),
      v('primarySubject', 'Ana konu', 'Görsel analizindeki ana konu.', '🎯'),
      v('primaryAesthetic', 'Stil', 'Görsel analizindeki stil.', '✨'),
      v('colors', 'Renkler', 'Görsel analizinde bulunan baskın renkler.', '🎨'),
      v('visualDescription', 'Görsel açıklaması', 'Görsel analizindeki açıklama.', '📝'),
      v('userInstructions', 'Kullanıcı talimatı', 'Optimizasyon sırasında kullanıcının yazdığı ek talimat (yoksa "None").', '💬'),
    ],
  },
  {
    key: 'ai_prompt_niche_research',
    group: 'automation',
    title: 'Niş araştırması',
    description: 'Otomasyonda "Konuyu yapay zekâ belirlesin" seçiliyse her çalıştırmada tasarım nişini seçer. Web araması admin ayarından açılır. JSON alan adlarını değiştirmeyin.',
    defaultValue: DEFAULT_NICHE_RESEARCH_PROMPT,
    variables: [
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
    key: 'ai_prompt_automation_design',
    group: 'automation',
    title: 'Otomasyon tasarım konsepti',
    description: 'Otomasyonun her çalıştırmada ürettiği tasarım konsepti; "Tasarım üretimi" talimatında {{userPrompt}} yerine yazılır.',
    defaultValue: DEFAULT_AUTOMATION_DESIGN_PROMPT,
    variables: [
      v('productType', 'Ürün tipi', 'Otomasyonun ürün tipi (yoksa "apparel").', '👕'),
      v('niche', 'Niş', 'Otomasyonda yazılan veya araştırmanın bulduğu niş.', '🎯'),
      v('audience', 'Hedef kitle', 'Hedef kitle (yoksa "a broad Etsy audience").', '👥'),
      v('creativeDirection', 'Yaratıcı yön', '"Yaratıcı yönler" listesinden her çalıştırmada sırayla biri.', '🎨'),
      v('notes', 'Notlar', 'Otomasyon notları ve araştırmanın stil/tasarım özeti (yoksa "none").', '📌'),
    ],
  },
  {
    key: 'ai_prompt_creative_directions',
    group: 'automation',
    title: 'Yaratıcı yönler',
    description: 'Aynı otomasyonun art arda tasarımları birbirinin kopyası olmasın diye her çalıştırmada bu listeden farklı bir yön seçilir. Her satır bir yön.',
    defaultValue: DEFAULT_CREATIVE_DIRECTIONS,
    variables: [],
  },
  {
    key: 'ai_prompt_generate_video',
    group: 'video',
    title: 'Video üretimi',
    description: 'Otomasyonda tanıtım videosu üretilirken modele giden talimat. Tasarımın basıldığı mockup görseli referans olarak eklenir.',
    defaultValue: DEFAULT_GENERATE_VIDEO_PROMPT,
    variables: [
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

/** "Sezon rehberi" metninden istenen sezonun bölümünü döner ([anahtar] başlıklı bölümler). */
export function seasonSection(template: string, seasonKey: string): string {
  const sections = new Map<string, string[]>();
  let current: string | null = null;
  for (const line of template.replace(/\r\n/g, '\n').split('\n')) {
    const header = line.trim().match(/^\[([\w-]+)\]$/);
    if (header) { current = header[1]!; sections.set(current, []); continue; }
    if (current) sections.get(current)!.push(line);
  }
  return (sections.get(seasonKey) ?? []).join('\n').trim();
}

/** "Yaratıcı yönler" listesi (her satır bir yön). */
export function parseLines(text: string): string[] {
  return text.split('\n').map((line) => line.trim()).filter(Boolean);
}
