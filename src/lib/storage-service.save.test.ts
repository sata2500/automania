import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { idbStore, uploadMock } = vi.hoisted(() => ({
  idbStore: new Map<string, unknown>(),
  uploadMock: vi.fn(),
}));

vi.mock('idb-keyval', () => ({
  get: vi.fn(async (key: string) => idbStore.get(key)),
  set: vi.fn(async (key: string, value: unknown) => { idbStore.set(key, value); }),
  del: vi.fn(async (key: string) => { idbStore.delete(key); }),
}));
vi.mock('./image-optimizer', () => ({ uploadMediaToServer: uploadMock }));

import {
  getKnownServerVersion,
  getSaveStatus,
  getStorageKeys,
  migrateGuestWorkspaceToUser,
  saveAppData,
  setKnownServerVersion,
  forceSyncFromServer,
  subscribeRemoteWorkspace,
} from './storage-service';

const USER_ID = 'user-1';
const emptyPayload = { mockups: [], designs: [], folders: [], activeFolderId: null, selectedMockupId: null };

function signIn() {
  vi.stubGlobal('window', {});
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => (key === 'automania_pod_user_session' ? JSON.stringify({ id: USER_ID }) : null),
    setItem: () => {},
  });
}

type FetchHandler = (url: string, init?: RequestInit) => Response | Promise<Response>;
function mockFetch(handler: FetchHandler) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => handler(String(url), init));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  idbStore.clear();
  uploadMock.mockReset();
  signIn();
  setKnownServerVersion(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('saveAppData', () => {
  it('sends the known server version and records the new one', async () => {
    setKnownServerVersion(1000);
    const fetchMock = mockFetch(() => json({ success: true, timestamp: 2000 }));

    const result = await saveAppData({ ...emptyPayload });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.lastKnownServerTimestamp).toBe(1000);
    expect(body).not.toHaveProperty('activeFolderId');
    expect(result).toMatchObject({ success: true, timestamp: 2000 });
    expect(getKnownServerVersion()).toBe(2000);
    expect(getSaveStatus().state).toBe('saved');
  });

  it('reports a conflict instead of silently dropping the change', async () => {
    mockFetch(() => json({ conflict: true }, 409));
    const result = await saveAppData({ ...emptyPayload });
    expect(result).toMatchObject({ success: false, conflict: true, reason: 'conflict' });
    expect(getSaveStatus().state).toBe('conflict');
  });

  it('refuses oversized payloads with a visible explanation', async () => {
    const fetchMock = mockFetch(() => json({ success: true }));
    const huge = 'data:image/png;base64,' + 'A'.repeat(4 * 1024 * 1024);
    const result = await saveAppData({ ...emptyPayload, designs: [{ id: 'd1', name: 'x', src: huge, width: 1, height: 1 }] });

    expect(result.reason).toBe('too_large');
    expect(result.message).toContain('1 görsel henüz buluta yüklenmemiş');
    expect(getSaveStatus().state).toBe('error');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('marks network failures as retryable errors', async () => {
    mockFetch(() => { throw new TypeError('offline'); });
    const result = await saveAppData({ ...emptyPayload });
    expect(result.reason).toBe('network');
    expect(getSaveStatus().state).toBe('error');
  });
});

describe('migrateGuestWorkspaceToUser', () => {
  const guestKeys = getStorageKeys('default_user');

  function seedGuest() {
    idbStore.set(guestKeys.MOCKUPS, [{ id: 'guest-m', name: 'g', src: '/api/r2/guest', apparelType: 'light', printAreas: [], opacity: 1, width: 1, height: 1 }]);
  }

  it('keeps the account’s saved Etsy generation results', async () => {
    seedGuest();
    let savedBody: Record<string, unknown> | null = null;
    mockFetch((url, init) => {
      if (init?.method === 'POST') {
        savedBody = JSON.parse(String(init.body));
        return json({ success: true, timestamp: 5000 });
      }
      return json({
        mockups: [{ id: 'acc-m', src: '/api/r2/acc' }],
        designs: [],
        folders: [],
        etsyGeneratedMockups: [{ id: 'g1', previewUrl: '/api/r2/g1' }],
        updatedAt: 4000,
      });
    });

    const merged = await migrateGuestWorkspaceToUser();

    expect(merged?.etsyGeneratedMockups?.map((g) => g.id)).toEqual(['g1']);
    expect(savedBody!.etsyGeneratedMockups).toEqual([{ id: 'g1', previewUrl: '/api/r2/g1' }]);
    expect(savedBody!.lastKnownServerTimestamp).toBe(4000);
    expect(idbStore.has(guestKeys.MOCKUPS)).toBe(false); // guest data cleared only after success
  });

  it('keeps the guest workspace when the merged result cannot be saved', async () => {
    seedGuest();
    mockFetch((url, init) => {
      if (init?.method === 'POST') return json({ conflict: true }, 409);
      return json({ mockups: [], designs: [], folders: [], etsyGeneratedMockups: [], updatedAt: 4000 });
    });

    await expect(migrateGuestWorkspaceToUser()).rejects.toThrow();
    expect(idbStore.has(guestKeys.MOCKUPS)).toBe(true);
  });

  it('does not merge when the account data cannot be read', async () => {
    seedGuest();
    const fetchMock = mockFetch(() => json({ error: 'down' }, 503));
    await expect(migrateGuestWorkspaceToUser()).rejects.toThrow();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
    expect(idbStore.has(guestKeys.MOCKUPS)).toBe(true);
  });
});

describe('forceSyncFromServer', () => {
  const serverWorkspace = (updatedAt: number) => json({
    mockups: [{ id: 'm1', src: '/api/r2/m1' }], designs: [], folders: [], etsyGeneratedMockups: [], updatedAt,
  });

  it('tells the open workspace when another reader found newer server data', async () => {
    setKnownServerVersion(1000);
    mockFetch(() => serverWorkspace(9000));
    const listener = vi.fn();
    const unsubscribe = subscribeRemoteWorkspace(listener);

    await forceSyncFromServer();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(getKnownServerVersion()).toBe(9000);
    unsubscribe();
  });

  it('stays quiet when the data is the version already seen', async () => {
    setKnownServerVersion(9000);
    mockFetch(() => serverWorkspace(9000));
    const listener = vi.fn();
    const unsubscribe = subscribeRemoteWorkspace(listener);

    await forceSyncFromServer();

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});
