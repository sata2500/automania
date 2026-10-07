import { expect, test, type Page } from '@playwright/test';

/** Sayfadaki CSP ihlallerini ve yakalanmamış hataları toplar. */
function collectProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (msg) => {
    if (/Content Security Policy|Refused to/i.test(msg.text())) problems.push(msg.text());
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  return problems;
}

test('home page renders under the nonce-based CSP', async ({ page }) => {
  const problems = collectProblems(page);
  const response = await page.goto('/');

  const csp = response?.headers()['content-security-policy'] ?? '';
  expect(csp).toContain("'strict-dynamic'");
  expect(csp).not.toContain("'unsafe-eval'");
  await expect(page.getByText('Automania POD').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Örnek Taslağı Yükle' }).first()).toBeVisible();

  expect(problems).toEqual([]);
});

test('guest can load the demo workspace and render a batch', async ({ page }) => {
  const problems = collectProblems(page);
  await page.goto('/');

  await page.getByRole('button', { name: 'Örnek Taslağı Yükle' }).first().click();
  await expect(page.getByText('3. Toplu Üretim').first()).toBeVisible();
  await page.getByText('3. Toplu Üretim').first().click();

  await page.getByRole('button', { name: /Toplu Görselleri Üret/ }).click();
  await expect(page.getByText(/Toplu Üretim Tamamlandı/)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('img').first()).toBeVisible();

  expect(problems).toEqual([]);
});

test('private API routes reject anonymous requests', async ({ request }) => {
  for (const path of ['/api/storage', '/api/templates', '/api/automation/run', '/api/admin/settings']) {
    const response = await request.get(path);
    expect([401, 403], `${path} -> ${response.status()}`).toContain(response.status());
  }
  const cron = await request.get('/api/cron/automation');
  expect(cron.status()).toBe(401);
});
