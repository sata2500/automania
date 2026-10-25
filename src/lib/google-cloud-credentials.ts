/**
 * Google Cloud hizmet hesabı (service account) JSON anahtarının doğrulanması.
 * Bu anahtarla Gemini/Imagen/Veo modellerine Vertex AI üzerinden erişilir ve kullanım
 * Google Cloud faturalandırma hesabından (ör. ücretsiz deneme kredisinden) düşer.
 */

export type ServiceAccountCredentials = {
  type: 'service_account';
  project_id: string;
  private_key_id?: string;
  private_key: string;
  client_email: string;
  client_id?: string;
  token_uri?: string;
};

export class ServiceAccountError extends Error {}

const MAX_JSON_BYTES = 20_000;

/** Yüklenen JSON metnini doğrular; yalnızca kimlik doğrulama için gereken alanları döner. */
export function parseServiceAccountJson(text: string): ServiceAccountCredentials {
  if (!text || text.length > MAX_JSON_BYTES) throw new ServiceAccountError('Dosya boş veya çok büyük.');
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ServiceAccountError('Dosya geçerli bir JSON değil.');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ServiceAccountError('Dosya geçerli bir JSON değil.');
  if (data.type !== 'service_account') {
    throw new ServiceAccountError('Bu bir hizmet hesabı anahtarı değil. Google Cloud Console › IAM › Hizmet hesapları › Anahtarlar bölümünden JSON anahtar oluşturun.');
  }
  const str = (key: string) => (typeof data[key] === 'string' ? (data[key] as string).trim() : '');
  const projectId = str('project_id');
  const clientEmail = str('client_email');
  const privateKey = typeof data.private_key === 'string' ? data.private_key : '';
  if (!projectId) throw new ServiceAccountError('JSON dosyasında "project_id" yok.');
  if (!/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(projectId)) throw new ServiceAccountError('"project_id" geçersiz görünüyor.');
  if (!clientEmail || !clientEmail.endsWith('.iam.gserviceaccount.com')) throw new ServiceAccountError('JSON dosyasında geçerli bir "client_email" yok.');
  if (!privateKey.includes('BEGIN PRIVATE KEY')) throw new ServiceAccountError('JSON dosyasında "private_key" yok veya bozuk.');

  return {
    type: 'service_account',
    project_id: projectId,
    private_key_id: str('private_key_id') || undefined,
    private_key: privateKey,
    client_email: clientEmail,
    client_id: str('client_id') || undefined,
    token_uri: str('token_uri') || undefined,
  };
}

/** Vertex AI bölgeleri: "global" Gemini 3 gibi yeni modelleri, bölgesel uç noktalar Imagen/Veo'yu destekler. */
export const VERTEX_LOCATIONS = [
  { id: 'global', label: 'Global (önerilen — en yeni Gemini modelleri)' },
  { id: 'us-central1', label: 'us-central1 (Iowa)' },
  { id: 'us-east4', label: 'us-east4 (Virginia)' },
  { id: 'europe-west1', label: 'europe-west1 (Belçika)' },
  { id: 'europe-west4', label: 'europe-west4 (Hollanda)' },
] as const;

export function isValidVertexLocation(value: unknown): value is string {
  return typeof value === 'string' && VERTEX_LOCATIONS.some((loc) => loc.id === value);
}

export const DEFAULT_VIDEO_MODEL = 'veo-3.1-fast-generate-001';

/**
 * Veo 3.1 önizleme kimlikleri (…-generate-preview) Google tarafından kapatıldı;
 * kayıtlı eski ayarlar aynı modelin genel kullanıma açık (GA) sürümüne yönlendirilir.
 */
export function normalizeVideoModel(model: string): string {
  return model.replace(/^(veo-3\.1-(?:fast-|lite-)?generate)-preview$/, '$1-001');
}

export type GoogleModelCategory = 'text' | 'image' | 'video';
export type GoogleModelInfo = { id: string; displayName: string; category: GoogleModelCategory; description?: string };

const EXCLUDED_MODEL_PATTERN = /(embedding|embed|gecko|chirp|tts|audio|live|computer-use|aqa|codey|code-|text-bison|chat-bison|-tuning|robotics|native-audio|transcribe)/i;

/**
 * Google'ın döndürdüğü model listesini uygulamanın kullandığı üç gruba ayırır:
 * metin/görsel analiz (Gemini, Gemma), görsel üretim (Imagen, "-image" Gemini) ve video (Veo).
 * Gömme (embedding), ses ve konuşma modelleri listelenmez.
 */
export function categorizeGoogleModels(models: Array<{ name?: string; displayName?: string; description?: string }>): GoogleModelInfo[] {
  const seen = new Set<string>();
  const result: GoogleModelInfo[] = [];
  for (const model of models) {
    const id = String(model.name || '').split('/').pop()?.split('@')[0]?.trim();
    if (!id || seen.has(id) || EXCLUDED_MODEL_PATTERN.test(id)) continue;
    let category: GoogleModelCategory | null = null;
    if (id.startsWith('veo') || id.startsWith('gemini-omni')) category = 'video';
    else if (id.startsWith('imagen') || (id.startsWith('gemini') && id.includes('image'))) category = 'image';
    else if (id.startsWith('gemini') || id.startsWith('gemma')) category = 'text';
    if (!category) continue;
    seen.add(id);
    result.push({ id, displayName: model.displayName?.trim() || id, category, description: model.description?.slice(0, 200) });
  }
  // En yeni sürümler önce: sürüm numarasına göre azalan, sonra ada göre.
  return result.sort((a, b) => b.id.localeCompare(a.id, 'en', { numeric: true }));
}
