import sql from '@/lib/db';
import { loadSettings } from '@/lib/app-settings';
import { openSecretOrNull, sealSecret } from '@/lib/secret-box';

interface EtsyTokenResponse {
  success: boolean;
  access_token?: string;
  shop_id?: string;
  api_key?: string;
  shared_secret?: string;
  error?: string;
}

type StoredTokenRow = {
  etsy_access_token: string | null;
  etsy_refresh_token: string | null;
  etsy_token_expires_at: string | Date | null;
  etsy_shop_id: string | null;
};

const REFRESH_MARGIN_MS = 5 * 60 * 1000;

async function readStoredTokens(userId: string): Promise<StoredTokenRow | null> {
  const rows = await sql`
    SELECT etsy_access_token, etsy_refresh_token, etsy_token_expires_at, etsy_shop_id
    FROM user_workspaces
    WHERE user_id = ${userId}
  `;
  return (rows[0] as StoredTokenRow | undefined) ?? null;
}

function needsRefresh(row: StoredTokenRow, now = Date.now()): boolean {
  const expiresAt = row.etsy_token_expires_at ? new Date(row.etsy_token_expires_at).getTime() : 0;
  return expiresAt - now < REFRESH_MARGIN_MS;
}

/** Etsy OAuth token'larını şifreleyerek kaydeder (callback ve yenileme tarafından kullanılır). */
export async function storeEtsyTokens(input: {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  shopId?: string | null;
}): Promise<void> {
  const access = sealSecret(input.accessToken);
  const refresh = sealSecret(input.refreshToken);
  const expiresAt = input.expiresAt.toISOString();

  if (input.shopId !== undefined) {
    await sql`
      INSERT INTO user_workspaces (user_id, etsy_access_token, etsy_refresh_token, etsy_token_expires_at, etsy_shop_id, updated_at)
      VALUES (${input.userId}, ${access}, ${refresh}, ${expiresAt}, ${input.shopId}, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) DO UPDATE SET
        etsy_access_token = EXCLUDED.etsy_access_token,
        etsy_refresh_token = EXCLUDED.etsy_refresh_token,
        etsy_token_expires_at = EXCLUDED.etsy_token_expires_at,
        etsy_shop_id = EXCLUDED.etsy_shop_id,
        updated_at = CURRENT_TIMESTAMP
    `;
    return;
  }

  await sql`
    UPDATE user_workspaces
    SET etsy_access_token = ${access},
        etsy_refresh_token = ${refresh},
        etsy_token_expires_at = ${expiresAt},
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ${input.userId}
  `;
}

export async function getValidEtsyToken(userId: string): Promise<EtsyTokenResponse> {
  // 1. Kullanıcının Etsy kimlik bilgileri
  const stored = await readStoredTokens(userId);
  if (!stored || !stored.etsy_access_token || !stored.etsy_shop_id) {
    return { success: false, error: 'Etsy hesabı bağlı değil.' };
  }

  // 2. Global Etsy keystring & shared secret
  const settings = await loadSettings(['etsy_keystring', 'etsy_shared_secret']);
  const etsyApiKey = settings.etsy_keystring || process.env.ETSY_API_KEY;
  const etsySharedSecret = settings.etsy_shared_secret || process.env.ETSY_SHARED_SECRET;

  if (!etsyApiKey) {
    return { success: false, error: 'API Anahtarı eksik.' };
  }

  const success = (accessToken: string): EtsyTokenResponse => ({
    success: true,
    access_token: accessToken,
    shop_id: stored.etsy_shop_id ?? undefined,
    api_key: etsyApiKey,
    shared_secret: etsySharedSecret,
  });

  // 3. Token geçerliyse doğrudan dön
  if (!needsRefresh(stored)) {
    const accessToken = openSecretOrNull(stored.etsy_access_token);
    if (!accessToken) return { success: false, error: 'Kayıtlı Etsy oturumu okunamadı. Lütfen tekrar bağlanın.' };
    return success(accessToken);
  }

  // 4. Süresi dolmuş/dolmak üzere: yenile
  const refreshToken = openSecretOrNull(stored.etsy_refresh_token);
  if (!refreshToken) {
    return { success: false, error: 'Oturum süresi dolmuş ve yenileme anahtarı bulunamadı. Lütfen tekrar bağlanın.' };
  }

  try {
    const tokenRes = await fetch('https://api.etsy.com/v3/public/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: etsyApiKey,
        refresh_token: refreshToken,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!tokenRes.ok) {
      // Eşzamanlı başka bir istek token'ı zaten yenilemiş olabilir (Etsy refresh token'ları tek kullanımlıktır).
      const latest = await readStoredTokens(userId);
      if (latest?.etsy_access_token && latest.etsy_refresh_token !== stored.etsy_refresh_token && !needsRefresh(latest)) {
        const accessToken = openSecretOrNull(latest.etsy_access_token);
        if (accessToken) return success(accessToken);
      }
      console.error('[Etsy] Token refresh failed', { status: tokenRes.status });
      return { success: false, error: 'Oturum süresi dolmuş ve yenilenemedi. Lütfen tekrar bağlanın.' };
    }

    const tokenData = await tokenRes.json();
    const { access_token, refresh_token, expires_in } = tokenData;
    if (
      typeof access_token !== 'string' ||
      access_token.length === 0 ||
      typeof refresh_token !== 'string' ||
      refresh_token.length === 0 ||
      typeof expires_in !== 'number' ||
      !Number.isFinite(expires_in) ||
      expires_in <= 0
    ) {
      console.error('[Etsy] Token refresh returned an invalid response');
      return { success: false, error: 'Etsy oturumu yenileme yanıtı geçersiz.' };
    }

    // Yalnızca okuduğumuz refresh token hâlâ kayıtlıysa güncelle; aksi halde başka bir istek
    // daha yeni bir token yazmıştır ve onun üzerine yazmamalıyız.
    const newExpiresAt = new Date(Date.now() + expires_in * 1000).toISOString();
    const updated = await sql`
      UPDATE user_workspaces
      SET etsy_access_token = ${sealSecret(access_token)},
          etsy_refresh_token = ${sealSecret(refresh_token)},
          etsy_token_expires_at = ${newExpiresAt},
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ${userId}
        AND etsy_refresh_token IS NOT DISTINCT FROM ${stored.etsy_refresh_token}
      RETURNING user_id
    `;
    if (updated.length === 0) {
      console.warn('[Etsy] Token was refreshed concurrently; keeping the newer stored token.');
    }

    return success(access_token);
  } catch {
    console.error('[Etsy] Token refresh exception');
    return { success: false, error: 'Token yenileme işlemi başarısız oldu.' };
  }
}
