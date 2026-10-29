/**
 * GET /api/listing-review — Hazır İlanlar: inceleme bekleyen/zamanlanmış/yayınlanmış ilanlar ve
 * metni hazırlanmakta olan manuel üretim ilanları. Yeni ilanlar otomasyonlardan ve
 * /api/listing-review/from-production uç noktasından gelir.
 */
import { NextResponse } from 'next/server';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { listReviewItems } from '@/lib/listing-review';
import { getErrorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getAuthoritativeSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json({ success: true, items: await listReviewItems(session.id) });
  } catch (error) {
    console.error('[Listing Review] List failed', error);
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  }
}
