import { NextResponse } from 'next/server';
import { getAuthoritativeSession } from '@/lib/auth-server';
import { checkRateLimit } from '@/lib/request-rate-limit';
import { generateListingContent, ListingGenerationError } from '@/lib/listing-generator';

export async function POST(req: Request) {
  try {
    const session = await getAuthoritativeSession();
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const rateLimit = await checkRateLimit(`ai:generate-listing:${session.id}`, 10, 10 * 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: 'AI listing üretim limiti aşıldı.' }, {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      });
    }

    const body = await req.json();
    const result = await generateListingContent(session.id, body);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof ListingGenerationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('[Generate Listing] Request failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ success: false, error: 'Listing içeriği üretilemedi.' }, { status: 500 });
  }
}
