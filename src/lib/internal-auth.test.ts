import { afterEach, describe, expect, it, vi } from 'vitest';
import { getConfiguredSecret, isValidCronAuthorization, isValidInternalToken, secretsMatch } from './internal-auth';

const TOKEN = 'x'.repeat(40);

describe('internal-auth', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects every token when neither INTERNAL_API_TOKEN nor JWT_SECRET is configured', () => {
    vi.stubEnv('INTERNAL_API_TOKEN', '');
    vi.stubEnv('JWT_SECRET', '');
    expect(isValidInternalToken('dev-internal')).toBe(false);
    expect(isValidInternalToken('')).toBe(false);
  });

  it('derives a stable internal token from JWT_SECRET when none is configured', () => {
    vi.stubEnv('INTERNAL_API_TOKEN', '');
    vi.stubEnv('JWT_SECRET', 'j'.repeat(40));
    const derived = getConfiguredSecret('INTERNAL_API_TOKEN');
    expect(derived).toMatch(/^[0-9a-f]{64}$/);
    expect(derived).not.toContain('j');
    expect(isValidInternalToken(derived)).toBe(true);
    expect(getConfiguredSecret('CRON_SECRET')).toBeNull(); // zamanlayıcı anahtarı türetilmez
  });

  it('rejects tokens shorter than the minimum length', () => {
    vi.stubEnv('INTERNAL_API_TOKEN', 'short-token');
    vi.stubEnv('JWT_SECRET', '');
    expect(isValidInternalToken('short-token')).toBe(false);
  });

  it('accepts only the exact configured token', () => {
    vi.stubEnv('INTERNAL_API_TOKEN', TOKEN);
    expect(isValidInternalToken(TOKEN)).toBe(true);
    expect(isValidInternalToken(`${TOKEN}y`)).toBe(false);
    expect(isValidInternalToken(null)).toBe(false);
  });

  it('validates the Vercel cron bearer header', () => {
    vi.stubEnv('CRON_SECRET', TOKEN);
    expect(isValidCronAuthorization(`Bearer ${TOKEN}`)).toBe(true);
    expect(isValidCronAuthorization(TOKEN)).toBe(false);
    expect(isValidCronAuthorization('Bearer wrong')).toBe(false);
  });

  it('never matches a missing expected secret', () => {
    expect(secretsMatch('anything', null)).toBe(false);
  });
});
