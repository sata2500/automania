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

/** Imagen ve Veo "global" uç noktada sunulmaz; bu durumda bölgesel uç nokta kullanılır. */
export const VERTEX_MEDIA_FALLBACK_LOCATION = 'us-central1';

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

export function createGoogleClient(connection: GoogleConnection, options: { model?: string } = {}): GoogleGenAI {
  if (connection.mode === 'api_key') return new GoogleGenAI({ apiKey: connection.apiKey });
  const location = connection.location === 'global' && isMediaModel(options.model)
    ? VERTEX_MEDIA_FALLBACK_LOCATION
    : connection.location;
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

/** Ayarlardaki bağlantıyla istemci oluşturur; yapılandırılmamışsa açıklayıcı bir hata fırlatır. */
export async function getGoogleClient(options: { model?: string } = {}): Promise<GoogleGenAI> {
  const connection = await loadGoogleConnection();
  if (!connection) {
    throw new Error('Google AI bağlantısı yapılandırılmamış. Admin panelinden Gemini API anahtarı veya Google Cloud hizmet hesabı ekleyin.');
  }
  return createGoogleClient(connection, options);
}

const MAX_LISTED_MODELS = 500;

/** Bağlantının erişebildiği güncel modelleri Google'dan çeker ve gruplara ayırır. */
export async function listGoogleModels(connection: GoogleConnection): Promise<GoogleModelInfo[]> {
  const client = createGoogleClient(connection);
  const pager = await client.models.list({ config: { pageSize: 100 } });
  const raw: Array<{ name?: string; displayName?: string; description?: string }> = [];
  for await (const model of pager) {
    raw.push({ name: model.name, displayName: model.displayName, description: model.description });
    if (raw.length >= MAX_LISTED_MODELS) break;
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
