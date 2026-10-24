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

import { GET, POST } from './route';

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

describe('GET /api/storage', () => {
  it('returns a 5xx instead of an empty workspace when the database fails', async () => {
    getSessionMock.mockResolvedValue({ id: 'user-test' });
    dbMock.select.mockImplementation(() => ({
      from: () => ({ where: () => Promise.reject(new Error('db down')) }),
    }));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await GET(new Request('http://localhost/api/storage'));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.mockups).toBeUndefined();
  });
});

describe('POST /api/storage partial saves', () => {
  const SERVER_TIME = new Date('2026-10-07T00:00:00Z');

  function mockInsert() {
    const returning = vi.fn(async () => [{ updatedAt: new Date('2026-10-07T00:01:00Z') }]);
    const onConflictDoUpdate = vi.fn(() => ({ returning }));
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    dbMock.insert.mockReturnValue({ values });
    dbMock.select.mockImplementation(() => ({
      from: () => ({ where: async () => [{ updatedAt: SERVER_TIME }] }),
    }));
    return { values, onConflictDoUpdate };
  }

  function post(body: unknown) {
    return POST(new Request('http://localhost/api/storage', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }));
  }

  it('only updates the fields that were sent', async () => {
    getSessionMock.mockResolvedValue({ id: 'user-test' });
    const { onConflictDoUpdate } = mockInsert();

    const response = await post({ etsyDefaultTemplates: { '482': 'tmpl-1' } });

    expect(response.status).toBe(200);
    const [{ set }] = onConflictDoUpdate.mock.calls[0] as unknown as [{ set: Record<string, unknown> }];
    expect(set.etsyDefaultTemplates).toEqual({ '482': 'tmpl-1' });
    // Gönderilmeyen alanlar (AI modelleri, aktif klasör, seçili mockup) korunmalı
    expect(set).not.toHaveProperty('openrouterModel');
    expect(set).not.toHaveProperty('activeFolderId');
    expect(set).not.toHaveProperty('selectedMockupId');
    expect(set).not.toHaveProperty('mockups');
  });

  it('rejects malformed payloads', async () => {
    getSessionMock.mockResolvedValue({ id: 'user-test' });
    const response = await post({ mockups: 'not-an-array' });
    expect(response.status).toBe(400);
  });
});

describe('POST /api/storage optimistic concurrency', () => {
  const SERVER_TIME = new Date('2026-10-07T00:00:00Z');

  function setup() {
    getSessionMock.mockResolvedValue({ id: 'user-test' });
    const returning = vi.fn(async () => [{ updatedAt: new Date('2026-10-07T00:01:00Z') }]);
    const onConflictDoUpdate = vi.fn(() => ({ returning }));
    dbMock.insert.mockReturnValue({ values: vi.fn(() => ({ onConflictDoUpdate })) });
    dbMock.select.mockImplementation(() => ({
      from: () => ({ where: async () => [{ updatedAt: SERVER_TIME }] }),
    }));
    return { onConflictDoUpdate };
  }

  function post(body: unknown) {
    return POST(new Request('http://localhost/api/storage', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }));
  }

  it('rejects a client that has never seen the existing workspace (version 0)', async () => {
    const { onConflictDoUpdate } = setup();
    const response = await post({ mockups: [], lastKnownServerTimestamp: 0 });
    expect(response.status).toBe(409);
    expect(onConflictDoUpdate).not.toHaveBeenCalled();
  });

  it('rejects a stale version', async () => {
    setup();
    const response = await post({ mockups: [], lastKnownServerTimestamp: SERVER_TIME.getTime() - 60_000 });
    expect(response.status).toBe(409);
  });

  it('accepts the current version and returns the new one', async () => {
    setup();
    const response = await post({ mockups: [], lastKnownServerTimestamp: SERVER_TIME.getTime() });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.timestamp).toBe(new Date('2026-10-07T00:01:00Z').getTime());
  });
});

describe('GET /api/storage version', () => {
  it('returns the workspace version so the client can send it back', async () => {
    getSessionMock.mockResolvedValue({ id: 'user-test' });
    dbMock.select.mockImplementation(() => ({
      from: () => ({ where: async () => [{ mockups: [], designs: [], folders: [], updatedAt: new Date('2026-10-07T00:00:00Z') }] }),
    }));
    const response = await GET(new Request('http://localhost/api/storage'));
    const body = await response.json();
    expect(body.updatedAt).toBe(new Date('2026-10-07T00:00:00Z').getTime());
  });
});
