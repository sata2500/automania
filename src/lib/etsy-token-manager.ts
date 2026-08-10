import sql from '@/lib/db';

interface EtsyTokenResponse {
  success: boolean;
  access_token?: string;
  shop_id?: string;
  api_key?: string;
  shared_secret?: string;
  error?: string;
}

export async function getValidEtsyToken(userId: string): Promise<EtsyTokenResponse> {
  // 1. Fetch User's Etsy Credentials
  const workspaceRows = await sql`
    SELECT etsy_access_token, etsy_refresh_token, etsy_token_expires_at, etsy_shop_id 
    FROM user_workspaces 
    WHERE user_id = ${userId}
  `;

  if (workspaceRows.length === 0 || !workspaceRows[0].etsy_access_token || !workspaceRows[0].etsy_shop_id) {
    return { success: false, error: 'Etsy hesabı bağlı değil.' };
  }

  const workspace = workspaceRows[0];
  let accessToken = workspace.etsy_access_token;
  const shopId = workspace.etsy_shop_id;
  
  // 2. Fetch Etsy Keystring & Shared Secret from global app_settings
  const settingsRows = await sql`
    SELECT setting_key, setting_value 
    FROM app_settings 
    WHERE setting_key IN ('etsy_keystring', 'etsy_shared_secret')
  `;
  let etsyApiKey = process.env.ETSY_API_KEY;
  let etsySharedSecret = process.env.ETSY_SHARED_SECRET;
  for (const row of settingsRows) {
    if (row.setting_key === 'etsy_keystring') etsyApiKey = row.setting_value;
    if (row.setting_key === 'etsy_shared_secret') etsySharedSecret = row.setting_value;
  }

  if (!etsyApiKey) {
    return { success: false, error: 'API Anahtarı eksik.' };
  }

  // 3. Check if token is expired (or expires in less than 5 minutes)
  const now = new Date();
  const expiresAt = workspace.etsy_token_expires_at ? new Date(workspace.etsy_token_expires_at) : new Date(0);
  const timeRemainingMs = expiresAt.getTime() - now.getTime();

  if (timeRemainingMs < 5 * 60 * 1000) {
    // Token is expired or about to expire. We need to refresh it.
    if (!workspace.etsy_refresh_token) {
       return { success: false, error: 'Oturum süresi dolmuş ve yenileme anahtarı bulunamadı. Lütfen tekrar bağlanın.' };
    }

    try {
      const tokenRes = await fetch('https://api.etsy.com/v3/public/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: etsyApiKey,
          refresh_token: workspace.etsy_refresh_token
        })
      });

      if (!tokenRes.ok) {
        const errorText = await tokenRes.text();
        console.error("Etsy Token Refresh Error:", errorText);
        return { success: false, error: 'Oturum süresi dolmuş ve yenilenemedi. Lütfen tekrar bağlanın.' };
      }

      const tokenData = await tokenRes.json();
      const { access_token, refresh_token, expires_in } = tokenData;
      
      const newExpiresAt = new Date(Date.now() + expires_in * 1000);
      accessToken = access_token;

      // Update the tokens in the database
      await sql`
        UPDATE user_workspaces 
        SET 
          etsy_access_token = ${access_token},
          etsy_refresh_token = ${refresh_token},
          etsy_token_expires_at = ${newExpiresAt.toISOString()},
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ${userId}
      `;
    } catch (err: any) {
       console.error("Etsy Token Refresh Exception:", err);
       return { success: false, error: 'Token yenileme işlemi başarısız oldu.' };
    }
  }

  return { 
    success: true, 
    access_token: accessToken, 
    shop_id: shopId,
    api_key: etsyApiKey,
    shared_secret: etsySharedSecret
  };
}
