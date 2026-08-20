import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// In-memory rate limiting store for API protection
const rateLimitMap = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 120; // max 120 requests per minute

export function proxy(request: NextRequest) {
  // 1. Rate Limiting for API routes
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

  // 2. CSP & Nonce
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval' https: http:;
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: https: http:;
    media-src 'self' blob: data: https: http:;
    font-src 'self' data: https:;
    connect-src 'self' blob: data: https: http: wss: ws:;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `.replace(/\s{2,}/g, ' ').trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', cspHeader);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set('Content-Security-Policy', cspHeader);

  return response;
}

// For backwards-compatibility with middleware naming
export const middleware = proxy;

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
