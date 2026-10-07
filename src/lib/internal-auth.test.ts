import { afterEach, describe, expect, it, vi } from 'vitest';
import { isValidCronAuthorization, isValidInternalToken, secretsMatch } from './internal-auth';

const TOKEN = 'x'.repeat(40);

describe('internal-auth', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects every token when INTERNAL_API_TOKEN is not configured', () => {
    vi.stubEnv('INTERNAL_API_TOKEN', '');
    expect(isValidInternalToken('dev-internal')).toBe(false);
    expect(isValidInternalToken('')).toBe(false);
  });

  it('rejects tokens shorter than the minimum length', () => {
    vi.stubEnv('INTERNAL_API_TOKEN', 'short-token');
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
