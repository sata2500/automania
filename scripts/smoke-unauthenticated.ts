const baseUrl = (process.env.SMOKE_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

const cases: Array<{ name: string; path: string; init?: RequestInit; expected: number }> = [
  { name: 'storage GET', path: '/api/storage', expected: 401 },
  { name: 'storage blob DELETE', path: '/api/storage/blob', init: { method: 'DELETE', body: JSON.stringify({ urls: [] }), headers: { 'Content-Type': 'application/json' } }, expected: 401 },
  { name: 'upload POST', path: '/api/upload', init: { method: 'POST' }, expected: 401 },
  { name: 'R2 proxy GET', path: '/api/r2/test-owned-file.png', expected: 401 },
  { name: 'AI proxy POST', path: '/api/ai/proxy', init: { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } }, expected: 401 },
  { name: 'admin settings GET', path: '/api/admin/settings', expected: 401 },
  { name: 'admin audit logs GET', path: '/api/admin/audit-logs', expected: 401 },
  { name: 'setup GET', path: '/api/setup', expected: 401 },
  { name: 'job status GET', path: '/api/jobs/job-test', expected: 401 },
  { name: 'Etsy publish POST', path: '/api/etsy/publish', init: { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } }, expected: 401 },
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
