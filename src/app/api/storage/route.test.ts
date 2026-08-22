import { describe, expect, it, vi } from 'vitest';

const { getSessionMock, dbMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  dbMock: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock('@/lib/auth-server', () => ({ getAuthoritativeSession: getSessionMock }));
vi.mock('@/lib/db', () => ({ db: dbMock, default: vi.fn() }));
vi.mock('@/db/schema', () => ({ userWorkspaces: { userId: 'user_id', updatedAt: 'updated_at' } }));
vi.mock('drizzle-orm', () => ({ eq: vi.fn() }));

import { POST } from './route';

describe('POST /api/storage', () => {
  it('rejects temporary media URLs before mutating the workspace', async () => {
    getSessionMock.mockResolvedValue({ id: 'user-test' });

    const response = await POST(new Request('http://localhost/api/storage', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mockups: [{ id: 'm1', src: 'blob:local-preview' }],
        designs: [],
        folders: [],
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body).toMatchObject({ success: false, code: 'TEMPORARY_MEDIA_URL' });
    expect(dbMock.insert).not.toHaveBeenCalled();
  });
});
