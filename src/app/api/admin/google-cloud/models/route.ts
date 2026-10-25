/**
 * GET /api/admin/google-cloud/models
 * Aktif Google bağlantısının (API anahtarı veya Vertex AI hizmet hesabı) erişebildiği güncel modelleri
 * doğrudan Google'dan çeker; metin/görsel analiz, görsel üretim ve video olarak gruplar.
 */
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { describeGoogleError, listGoogleModels, loadGoogleConnection } from '@/lib/google-genai-client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const connection = await loadGoogleConnection();
  if (!connection) {
    return NextResponse.json({ success: false, error: 'Google bağlantısı yapılandırılmamış.' }, { status: 400 });
  }
  try {
    const models = await listGoogleModels(connection);
    return NextResponse.json({ success: true, mode: connection.mode, models }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ success: false, error: describeGoogleError(error) }, { status: 502 });
  }
}
