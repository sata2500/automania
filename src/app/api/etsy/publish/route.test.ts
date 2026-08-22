import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { sessionMock } = vi.hoisted(() => ({
  sessionMock: vi.fn(),
}));

vi.mock('@/lib/auth-server', () => ({ getAuthoritativeSession: sessionMock }));
vi.mock('@/lib/etsy-preflight', () => ({ validateEtsyDraftPreflight: vi.fn(() => []) }));
vi.mock('@/lib/etsy-publish-mode', () => ({
  resolveEtsyPublishMode: (input: { publishMode?: unknown; state?: unknown }) => {
    const values = [input.publishMode, input.state].filter((value) => value !== undefined);
    if (values.some((value) => value !== 'draft' && value !== 'active')) return null;
    if (values.length > 1 && values[0] !== values[1]) return null;
    return (values[0] as 'draft' | 'active' | undefined) ?? 'draft';
  },
  isLivePublishEnabled: (flag: string | undefined | null) => flag?.trim().toLowerCase() === 'true',
  hasExplicitLivePublishConfirmation: (input: { confirmLivePublish?: unknown; confirmationPhrase?: unknown }) =>
    input.confirmLivePublish === true && input.confirmationPhrase === 'YAYINLA',
}));
vi.mock('@/lib/db', () => ({ default: vi.fn() }));
vi.mock('@/lib/etsy-token-manager', () => ({ getValidEtsyToken: vi.fn() }));
vi.mock('@/lib/r2', () => ({
  isR2Configured: () => false,
  getR2Client: vi.fn(),
  getBucketName: vi.fn(),
  extractKeyFromUrlOrKey: vi.fn(),
}));
vi.mock('@/lib/upload-security', () => ({ isOwnedUploadName: vi.fn(() => false) }));
vi.mock('@/lib/request-rate-limit', () => ({ consumeRateLimit: vi.fn(() => ({ allowed: true, retryAfterSeconds: 0 })) }));
vi.mock('@/lib/audit-log', () => ({ writeAuditLog: vi.fn() }));

import { POST } from './route';

const originalFlag = process.env.ETSY_LIVE_PUBLISH_ENABLED;

function request(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/etsy/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/etsy/publish live guards', () => {
  beforeEach(() => {
    sessionMock.mockResolvedValue({ id: 'user-test-1', role: 'user' });
  });

  afterEach(() => {
    if (originalFlag === undefined) delete process.env.ETSY_LIVE_PUBLISH_ENABLED;
    else process.env.ETSY_LIVE_PUBLISH_ENABLED = originalFlag;
    vi.restoreAllMocks();
  });

  it('rejects active mode when the server feature flag is off without calling Etsy', async () => {
    process.env.ETSY_LIVE_PUBLISH_ENABLED = 'false';
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const response = await POST(request({ publishMode: 'active', state: 'active' }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ success: false, error: 'Canlı Etsy yayınlama bu sunucuda devre dışıdır.' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects active mode without the exact explicit confirmation phrase', async () => {
    process.env.ETSY_LIVE_PUBLISH_ENABLED = 'true';
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const response = await POST(request({ publishMode: 'active', state: 'active', confirmLivePublish: true, confirmationPhrase: 'YAYIN' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ success: false, error: 'Canlı yayın için açık kullanıcı onayı gereklidir.' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
