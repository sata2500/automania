import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireAdminMock, sqlMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  sqlMock: vi.fn(),
}));

vi.mock('@/lib/auth-server', () => ({ requireAdmin: requireAdminMock }));
vi.mock('@/lib/db', () => ({ default: sqlMock }));

import { GET } from './route';

describe('GET /api/admin/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminMock.mockResolvedValue({ id: 'admin-test', role: 'admin' });
    sqlMock.mockResolvedValue([{ ok: 1 }]);
  });

  it('rejects non-admin requests before touching the database', async () => {
    requireAdminMock.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ success: false, error: 'Unauthorized' });
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it('returns a healthy read-only ping for an admin', async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.ok).toBe(true);
    expect(body.latencyMs).toEqual(expect.any(Number));
    expect(sqlMock).toHaveBeenCalledTimes(1);
  });

  it('hides database error details and returns 503', async () => {
    sqlMock.mockRejectedValue(new Error('connection string must remain private'));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      success: false,
      ok: false,
      error: 'Veritabanı bağlantı testi başarısız oldu.',
    });
    expect(JSON.stringify(body)).not.toContain('connection string');
  });
});
