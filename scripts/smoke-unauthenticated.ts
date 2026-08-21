const baseUrl = (process.env.SMOKE_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  body: JSON.stringify(body),
  headers: { 'Content-Type': 'application/json' },
});

const cases: Array<{ name: string; path: string; init?: RequestInit; expected: number }> = [
  { name: 'storage GET', path: '/api/storage', expected: 401 },
  { name: 'storage POST', path: '/api/storage', init: json({}), expected: 401 },
  { name: 'storage DELETE', path: '/api/storage', init: { method: 'DELETE' }, expected: 401 },
  { name: 'storage version GET', path: '/api/storage/version', expected: 401 },
  { name: 'storage blob DELETE', path: '/api/storage/blob', init: { method: 'DELETE', body: JSON.stringify({ urls: [] }), headers: { 'Content-Type': 'application/json' } }, expected: 401 },
  { name: 'upload POST', path: '/api/upload', init: { method: 'POST' }, expected: 401 },
  { name: 'R2 proxy GET', path: '/api/r2/test-owned-file.png', expected: 401 },
  { name: 'AI proxy POST', path: '/api/ai/proxy', init: json({}), expected: 401 },
  { name: 'AI proxy GET', path: '/api/ai/proxy', expected: 401 },
  { name: 'design analyze POST', path: '/api/designs/analyze', init: json({}), expected: 401 },
  { name: 'listing generation POST', path: '/api/designs/generate-listing', init: json({}), expected: 401 },
  { name: 'admin settings GET', path: '/api/admin/settings', expected: 401 },
  { name: 'admin settings POST', path: '/api/admin/settings', init: json({}), expected: 401 },
  { name: 'admin stats GET', path: '/api/admin/stats', expected: 403 },
  { name: 'admin audit logs GET', path: '/api/admin/audit-logs', expected: 401 },
  { name: 'admin keyword GET', path: '/api/admin/keywords', expected: 401 },
  { name: 'admin keyword DELETE', path: '/api/admin/keywords', init: { method: 'DELETE' }, expected: 401 },
  { name: 'admin keyword evaluate POST', path: '/api/admin/keywords/evaluate', init: json({}), expected: 401 },
  { name: 'admin keyword proxy fetch GET', path: '/api/admin/keywords/proxy-fetch', expected: 401 },
  { name: 'admin keyword test scraper POST', path: '/api/admin/keywords/test-scraper', init: json({}), expected: 401 },
  { name: 'admin keyword bulk update POST', path: '/api/admin/keywords/bulk-update', init: json({ results: [] }), expected: 401 },
  { name: 'admin sample data GET', path: '/api/admin/sample-data', expected: 401 },
  { name: 'admin sample data POST', path: '/api/admin/sample-data', init: json({}), expected: 401 },
  { name: 'admin sample data DELETE', path: '/api/admin/sample-data', init: { method: 'DELETE' }, expected: 401 },
  { name: 'admin taxonomy sync GET', path: '/api/admin/taxonomy-sync', expected: 401 },
  { name: 'admin taxonomy sync POST', path: '/api/admin/taxonomy-sync', init: json({}), expected: 401 },
  { name: 'setup GET', path: '/api/setup', expected: 401 },
  { name: 'Etsy auth GET', path: '/api/etsy/auth', expected: 401 },
  { name: 'Etsy callback GET', path: '/api/etsy/callback', expected: 401 },
  { name: 'Etsy listings GET', path: '/api/etsy/listings', expected: 401 },
  { name: 'Etsy listings POST', path: '/api/etsy/listings', init: json({}), expected: 401 },
  { name: 'Etsy listing update PATCH', path: '/api/etsy/listings/update', init: { method: 'PATCH', body: JSON.stringify({}), headers: { 'Content-Type': 'application/json' } }, expected: 401 },
  { name: 'Etsy vision analysis POST', path: '/api/etsy/listings/analyze-vision', init: json({}), expected: 401 },
  { name: 'Etsy SEO evaluation POST', path: '/api/etsy/listings/evaluate-seo', init: json({}), expected: 401 },
  { name: 'Etsy listing optimize POST', path: '/api/etsy/listings/optimize', init: json({}), expected: 401 },
  { name: 'Etsy publish POST', path: '/api/etsy/publish', init: json({}), expected: 401 },
  { name: 'Etsy return policies GET', path: '/api/etsy/return-policies', expected: 401 },
  { name: 'Etsy shipping profiles GET', path: '/api/etsy/shipping-profiles', expected: 401 },
  { name: 'Etsy shop sections GET', path: '/api/etsy/shop-sections', expected: 401 },
  { name: 'Etsy taxonomy properties GET', path: '/api/etsy/taxonomy-properties?taxonomy_id=1081', expected: 401 },
  { name: 'Etsy variations POST', path: '/api/etsy/update-variations', init: json({}), expected: 401 },
  { name: 'job status GET', path: '/api/jobs/job-test', expected: 401 },
  { name: 'users GET', path: '/api/users', expected: 403 },
  { name: 'users POST invalid payload', path: '/api/users', init: json({}), expected: 400 },
  { name: 'users POST arbitrary session attempt', path: '/api/users', init: json({ id: 'attacker-id', email: 'attacker@example.com', name: 'Attacker', provider: 'google' }), expected: 401 },
  { name: 'users DELETE', path: '/api/users', init: { method: 'DELETE' }, expected: 403 },
];

async function main() {
  const failures: string[] = [];
  for (const testCase of cases) {
    const response = await fetch(`${baseUrl}${testCase.path}`, testCase.init);
    if (response.status !== testCase.expected) {
      failures.push(`${testCase.name}: expected ${testCase.expected}, received ${response.status}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(`unauthenticated_smoke_failed\n${failures.join('\n')}`);
  }
  console.log(`unauthenticated_smoke_passed cases=${cases.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
