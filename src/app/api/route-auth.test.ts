import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Her API route dosyasının bir yetkilendirme kontrolü içerdiğini doğrular.
 * Yeni bir route eklendiğinde kontrol unutulursa bu test başarısız olur.
 * Kasıtlı olarak herkese açık olan route'lar aşağıda açıkça listelenir.
 */
const PUBLIC_ROUTES = new Set([
  'auth/logout/route.ts',
  'auth/google/callback/route.ts',
  // Yalnızca herkese açık anahtar kelime metriklerini okur (misafir SEO analizi).
  'designs/analyze/keywords/route.ts',
]);

const AUTH_GUARDS = [
  'getAuthoritativeSession',
  'requireAdmin',
  'requireActiveSession',
  'isValidInternalToken',
  'isValidCronAuthorization',
];

// Yalnızca JWT içeriğine güvenen bu fonksiyon, engellenen kullanıcıları yakalamaz.
const FORBIDDEN_IN_ROUTES = /\bgetSession\s*\(/;

function collectRoutes(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectRoutes(full);
    return entry.name === 'route.ts' ? [full] : [];
  });
}

const apiDir = path.join(__dirname);
const routes = collectRoutes(apiDir).map((file) => ({
  file,
  relative: path.relative(apiDir, file).split(path.sep).join('/'),
  source: fs.readFileSync(file, 'utf8'),
}));

describe('API route authorization coverage', () => {
  it('discovers route files', () => {
    expect(routes.length).toBeGreaterThan(30);
  });

  it.each(routes.filter((r) => !PUBLIC_ROUTES.has(r.relative)).map((r) => [r.relative, r.source]))(
    '%s uses an authorization guard',
    (_relative, source) => {
      expect(AUTH_GUARDS.some((guard) => source.includes(guard))).toBe(true);
    },
  );

  it.each(routes.map((r) => [r.relative, r.source]))('%s does not rely on unverified JWT sessions', (_relative, source) => {
    expect(FORBIDDEN_IN_ROUTES.test(source)).toBe(false);
  });
});
