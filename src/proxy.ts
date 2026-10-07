import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { consumeRateLimit } from '@/lib/request-rate-limit';

// Kaba IP bazlı koruma (süreç içi). Maliyetli uç noktalar ayrıca kullanıcı bazlı,
// paylaşımlı `checkRateLimit` ile sınırlandırılır.
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 120;

export function getClientIp(request: NextRequest): string | null {
  // Vercel ve çoğu proxy, istemci IP'sini listenin başına yazar.
  const forwarded = request.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return first || request.headers.get('x-real-ip')?.trim() || null;
}

export function buildContentSecurityPolicy(nonce: string, isDev: boolean): string {
  return `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ''};
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: https:;
    media-src 'self' blob: data: https:;
    font-src 'self' data:;
    connect-src 'self' blob: data: https:${isDev ? ' ws:' : ''};
    worker-src 'self' blob:;
    manifest-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    ${isDev ? '' : 'upgrade-insecure-requests;'}
  `.replace(/\s{2,}/g, ' ').trim();
}

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const ip = getClientIp(request);
    if (ip) {
      const limit = consumeRateLimit(`ip:${ip}`, MAX_REQUESTS_PER_WINDOW, RATE_LIMIT_WINDOW_MS);
      if (!limit.allowed) {
        return NextResponse.json({ error: 'Too Many Requests' }, {
          status: 429,
          headers: { 'Retry-After': String(limit.retryAfterSeconds) },
        });
      }
    }
    return NextResponse.next();
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const cspHeader = buildContentSecurityPolicy(nonce, process.env.NODE_ENV === 'development');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', cspHeader);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', cspHeader);
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico|sw.js|workers/|demo/|icon-|manifest.json|sitemap.xml|robots.txt).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
