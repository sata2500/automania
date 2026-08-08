import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Mevcut rate limitleri izlemek için basit in-memory store
// Gerçek bir üretim ortamında Redis veya Vercel KV kullanılması önerilir
const rateLimitMap = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 dakika
const MAX_REQUESTS_PER_WINDOW = 100; // dakikada maks 100 istek

export function proxy(request: NextRequest) {
  // 1. Rate Limiting (Basit IP bazlı koruma)
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
  if (ip !== 'unknown' && request.nextUrl.pathname.startsWith('/api/')) {
    const now = Date.now();
    let limitData = rateLimitMap.get(ip);
    if (!limitData || (now - limitData.lastReset > RATE_LIMIT_WINDOW_MS)) {
      limitData = { count: 0, lastReset: now };
    }
    
    limitData.count++;
    rateLimitMap.set(ip, limitData);

    if (limitData.count > MAX_REQUESTS_PER_WINDOW) {
      return new NextResponse(JSON.stringify({ error: 'Too Many Requests' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // 2. CSP ve Nonce Enjeksiyonu
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  
  // CSP Kurgusu: unsafe-inline yerine nonce ve strict-dynamic
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https: http: 'unsafe-inline' 'unsafe-eval';
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: https:;
    font-src 'self' data: https:;
    connect-src 'self' blob: data: https: http: wss: ws:;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `.replace(/\s{2,}/g, ' ').trim();

  // Next.js request objesine nonce'u header olarak ekleyelim ki sayfalarda kullanılabilsin
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', cspHeader);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Response'a da CSP ekle
  response.headers.set('Content-Security-Policy', cspHeader);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
