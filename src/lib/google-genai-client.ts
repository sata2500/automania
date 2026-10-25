/**
 * Uygulamadaki tüm Google AI (Gemini, Imagen, Veo) çağrıları için tek istemci fabrikası.
 *
 * İki bağlantı yöntemi desteklenir:
 *  - `api_key`: Google AI Studio API anahtarı (Gemini Developer API).
 *  - `vertex`: Google Cloud hizmet hesabı JSON anahtarı ile Vertex AI. Kullanım Google Cloud
 *    faturalandırma hesabından (ör. ücretsiz deneme kredisi) düşer.
 *
 * Yöntem admin panelinde seçilir (`google_auth_mode`); hizmet hesabı anahtarı şifreli saklanır.
 */
import { GoogleGenAI } from '@google/genai';
import { loadSettings } from '@/lib/app-settings';
import {
  categorizeGoogleModels,
  parseServiceAccountJson,
  type GoogleModelInfo,
  type ServiceAccountCredentials,
} from '@/lib/google-cloud-credentials';

export const GOOGLE_CONNECTION_SETTING_KEYS = ['google_auth_mode', 'gcp_service_account_json', 'gcp_location', 'gemini_api_key'] as const;

export type GoogleConnection =
  | { mode: 'vertex'; projectId: string; location: string; clientEmail: string; credentials: ServiceAccountCredentials }
  | { mode: 'api_key'; apiKey: string };

/**
 * Imagen ve Veo "global" uç noktada sunulmaz; Veo 3.x yalnızca us-central1'de sunulur.
 * Bu modeller için bölgesel uç nokta kullanılır.
 */
export const VERTEX_MEDIA_FALLBACK_LOCATION = 'us-central1';

/** Veo modelleri liste yanıtında görünmezse doğrudan sorgulanan bilinen kimlikler (yeniden eskiye). */
export const KNOWN_VEO_MODELS = [
  'veo-3.1-generate-001',
  'veo-3.1-fast-generate-001',
  'veo-3.1-lite-generate-001',
  'veo-3.0-generate-001',
  'veo-3.0-fast-generate-001',
  'veo-2.0-generate-001',
] as const;

export function resolveGoogleConnection(settings: Record<string, string | undefined>, env: NodeJS.ProcessEnv = process.env): GoogleConnection | null {
  const mode = settings.google_auth_mode === 'vertex' ? 'vertex' : 'api_key';
  if (mode === 'vertex') {
    const json = settings.gcp_service_account_json || env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!json) return null;
    try {
      const credentials = parseServiceAccountJson(json);
      return {
        mode: 'vertex',
        projectId: credentials.project_id,
        location: settings.gcp_location || env.GOOGLE_CLOUD_LOCATION || 'global',
        clientEmail: credentials.client_email,
        credentials,
      };
    } catch (error) {
      console.error('[Google AI] Stored service account key is invalid:', error instanceof Error ? error.message : error);
      return null;
    }
  }
  const apiKey = settings.gemini_api_key || env.GEMINI_API_KEY || env.GOOGLE_API_KEY;
  return apiKey ? { mode: 'api_key', apiKey } : null;
}

/** Ayarlardan aktif Google bağlantısını okur (yapılandırılmamışsa null). */
export async function loadGoogleConnection(): Promise<GoogleConnection | null> {
  let settings: Record<string, string> = {};
  try {
    settings = await loadSettings(GOOGLE_CONNECTION_SETTING_KEYS);
  } catch (error) {
    console.error('[Google AI] Settings could not be loaded; falling back to environment.', error instanceof Error ? error.message : error);
  }
  return resolveGoogleConnection(settings);
}

/** Model kimliğinin bölgesel uç nokta gerektirip gerektirmediği (Imagen, Veo). */
export function isMediaModel(model: string | undefined): boolean {
  return Boolean(model && (model.startsWith('imagen') || model.startsWith('veo')));
}

/** Modelin çağrılacağı Vertex bölgesi: Veo her zaman us-central1, Imagen "global" seçiliyse us-central1. */
export function resolveVertexLocation(location: string, model: string | undefined): string {
  if (model?.startsWith('veo')) return VERTEX_MEDIA_FALLBACK_LOCATION;
  if (location === 'global' && isMediaModel(model)) return VERTEX_MEDIA_FALLBACK_LOCATION;
  return location;
}

export function createGoogleClient(connection: GoogleConnection, options: { model?: string; location?: string } = {}): GoogleGenAI {
  if (connection.mode === 'api_key') return new GoogleGenAI({ apiKey: connection.apiKey });
  const location = options.location ?? resolveVertexLocation(connection.location, options.model);
  return new GoogleGenAI({
    vertexai: true,
    project: connection.projectId,
    location,
    googleAuthOptions: {
      credentials: { client_email: connection.credentials.client_email, private_key: connection.credentials.private_key },
      projectId: connection.projectId,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    },
  });
}

const MAX_LISTED_MODELS = 1000;

type RawModel = { name?: string; displayName?: string; description?: string };

async function fetchModelList(client: GoogleGenAI): Promise<RawModel[]> {
  const pager = await client.models.list({ config: { pageSize: 100 } });
  const raw: RawModel[] = [];
  for await (const model of pager) {
    raw.push({ name: model.name, displayName: model.displayName, description: model.description });
    if (raw.length >= MAX_LISTED_MODELS) break;
  }
  return raw;
}

/** Liste yanıtında olmayan bilinen Veo modellerini tek tek sorgular; erişilebilir olanları döner. */
async function probeKnownVeoModels(client: GoogleGenAI, exclude: Set<string>): Promise<RawModel[]> {
  const results = await Promise.allSettled(
    KNOWN_VEO_MODELS.filter((id) => !exclude.has(id)).map(async (id) => {
      const model = await client.models.get({ model: id });
      return { name: model.name || id, displayName: model.displayName, description: model.description };
    }),
  );
  return results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
}

/**
 * Bağlantının erişebildiği güncel modelleri Google'dan çeker ve gruplara ayırır.
 * Vertex AI'da Imagen/Veo seçili bölgede (ör. "global") listelenmediği için bu modeller
 * bölgesel uç noktadan ayrıca çekilir; Veo listede yoksa bilinen sürümler doğrudan sorgulanır.
 */
export async function listGoogleModels(connection: GoogleConnection): Promise<GoogleModelInfo[]> {
  const raw = await fetchModelList(createGoogleClient(connection));
  if (connection.mode === 'vertex') {
    const mediaClient = createGoogleClient(connection, { location: VERTEX_MEDIA_FALLBACK_LOCATION });
    if (connection.location !== VERTEX_MEDIA_FALLBACK_LOCATION) {
      try {
        const regional = await fetchModelList(mediaClient);
        raw.push(...regional.filter((m) => isMediaModel(String(m.name || '').split('/').pop())));
      } catch (error) {
        console.error('[Google AI] Regional model list failed:', error instanceof Error ? error.message : error);
      }
    }
    const listed = new Set(categorizeGoogleModels(raw).filter((m) => m.category === 'video').map((m) => m.id));
    raw.push(...(await probeKnownVeoModels(mediaClient, listed)));
  }
  return categorizeGoogleModels(raw);
}

/** Google API hatalarını kullanıcıya anlaşılır bir mesaja çevirir (izin, API kapalı, faturalandırma). */
export function describeGoogleError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/PERMISSION_DENIED|403/.test(message)) {
    if (/SERVICE_DISABLED|has not been used|is disabled/i.test(message)) {
      return 'Vertex AI API bu projede etkin değil. Google Cloud Console › API\'ler ve Hizmetler bölümünden "Vertex AI API"yi etkinleştirin.';
    }
    return 'Hizmet hesabının yetkisi yok. Google Cloud Console › IAM bölümünde bu hesaba "Vertex AI User" (roles/aiplatform.user) rolünü verin.';
  }
  if (/BILLING|billing/i.test(message)) return 'Projede faturalandırma etkin değil. Ücretsiz deneme kredisini kullanmak için projeyi faturalandırma hesabına bağlayın.';
  if (/invalid_grant|invalid_client|Invalid JWT/i.test(message)) return 'Hizmet hesabı anahtarı geçersiz veya silinmiş. Yeni bir JSON anahtarı oluşturup yükleyin.';
  if (/NOT_FOUND|404/.test(message)) return `Model veya bölge bulunamadı: ${message.slice(0, 200)}`;
  return message.slice(0, 300);
}
