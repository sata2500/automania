import { get, set, del } from 'idb-keyval';
import { MockupItem, DesignItem, MockupFolder } from '@/types/pod';
import { SAMPLE_MOCKUPS, SAMPLE_DESIGNS, DEFAULT_FOLDERS } from './sample-data';

function getCurrentUserId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem('automania_pod_user_session');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.id || null;
    }
  } catch {}
  return null;
}

function getStorageKeys() {
  const userId = getCurrentUserId();
  const prefix = userId ? `user_${userId}_` : '';
  return {
    MOCKUPS: `${prefix}automania_pod_mockups_v1`,
    DESIGNS: `${prefix}automania_pod_designs_v1`,
    FOLDERS: `${prefix}automania_pod_folders_v1`,
    ACTIVE_FOLDER: `${prefix}automania_pod_active_folder_v1`,
    SELECTED_MOCKUP: `${prefix}automania_pod_selected_mockup_v1`,
    HAS_INITIALIZED: `${prefix}automania_pod_has_init_v1`,
  };
}

export interface AppDataPayload {
  mockups: MockupItem[];
  designs: DesignItem[];
  folders: MockupFolder[];
  activeFolderId: string | null;
  selectedMockupId: string | null;
  lastUpdated?: number;
}

/**
 * Loads application data from IndexedDB first, with fallback to Server API endpoint (/api/storage).
 * For new users or uninitialized workspaces, returns an empty workspace payload.
 */
export async function loadAppData(): Promise<AppDataPayload> {
  const keys = getStorageKeys();
  const userId = getCurrentUserId();

  try {
    // 1. Try loading from IndexedDB (Fastest & handles binary images/videos)
    const [hasInit, savedMockups, savedDesigns, savedFolders, savedActiveFolder, savedSelectedMockup] =
      await Promise.all([
        get<boolean>(keys.HAS_INITIALIZED),
        get<MockupItem[]>(keys.MOCKUPS),
        get<DesignItem[]>(keys.DESIGNS),
        get<MockupFolder[]>(keys.FOLDERS),
        get<string | null>(keys.ACTIVE_FOLDER),
        get<string | null>(keys.SELECTED_MOCKUP),
      ]);

    if (savedMockups && Array.isArray(savedMockups) && savedMockups.length > 0) {
      return {
        mockups: savedMockups || [],
        designs: savedDesigns || [],
        folders: savedFolders || [],
        activeFolderId: savedActiveFolder ?? null,
        selectedMockupId: savedSelectedMockup ?? (savedMockups?.[0]?.id || null),
      };
    }

    // 2. Fallback to Server API storage (.data/pod-db.json or .data/users/{userId}-db.json)
    const query = userId ? `?userId=${userId}` : '';
    const res = await fetch(`/api/storage${query}`);
    if (res.ok) {
      const serverData = await res.json();
      if (serverData && (serverData.mockups || serverData.designs || serverData.folders)) {
        await saveToIndexedDB(serverData);
        return {
          mockups: serverData.mockups || [],
          designs: serverData.designs || [],
          folders: serverData.folders || [],
          activeFolderId: serverData.activeFolderId ?? null,
          selectedMockupId: serverData.selectedMockupId ?? (serverData.mockups?.[0]?.id || null),
        };
      }
    }
  } catch (err) {
    console.warn('Failed to load saved state from storage:', err);
  }

  // 3. New User / Empty Workspace default state
  return {
    mockups: [],
    designs: [],
    folders: [],
    activeFolderId: null,
    selectedMockupId: null,
  };
}

/**
 * Loads standard factory sample data (60 mockups, designs, folders) into the user's workspace.
 */
export async function loadSampleAppData(): Promise<AppDataPayload> {
  const payload: AppDataPayload = {
    mockups: SAMPLE_MOCKUPS,
    designs: SAMPLE_DESIGNS,
    folders: DEFAULT_FOLDERS,
    activeFolderId: DEFAULT_FOLDERS[0]?.id || null,
    selectedMockupId: SAMPLE_MOCKUPS[0]?.id || null,
  };

  await saveAppData(payload);
  return payload;
}

/**
 * Clears all user data completely to start from scratch.
 */
export async function clearAllAppData(): Promise<AppDataPayload> {
  const keys = getStorageKeys();
  const userId = getCurrentUserId();

  try {
    await Promise.all([
      del(keys.MOCKUPS),
      del(keys.DESIGNS),
      del(keys.FOLDERS),
      del(keys.ACTIVE_FOLDER),
      del(keys.SELECTED_MOCKUP),
      set(keys.HAS_INITIALIZED, true),
    ]);

    const query = userId ? `?userId=${userId}` : '';
    await fetch(`/api/storage${query}`, { method: 'DELETE' }).catch(() => {});
  } catch (err) {
    console.error('Failed to clear storage:', err);
  }

  const emptyPayload: AppDataPayload = {
    mockups: [],
    designs: [],
    folders: [],
    activeFolderId: null,
    selectedMockupId: null,
  };

  await saveToIndexedDB(emptyPayload);
  return emptyPayload;
}

/**
 * Saves current application state to IndexedDB and syncs asynchronously with Server API.
 */
export async function saveAppData(payload: AppDataPayload): Promise<void> {
  const userId = getCurrentUserId();
  try {
    // Save to IndexedDB (Client side instant persistence)
    await saveToIndexedDB(payload);

    // Sync to Server side API (Disk persistence)
    const query = userId ? `?userId=${userId}` : '';
    
    const payloadString = JSON.stringify({
      ...payload,
      lastUpdated: Date.now(),
    });

    // Vercel Serverless Limit is 4.5MB. Prevent sync if JSON is too heavy (e.g., contains raw base64 images from old caches)
    if (payloadString.length > 3.8 * 1024 * 1024) {
      console.warn('Sync aborted: Payload exceeds 3.8MB Vercel limit. Please delete large local designs or clear cache.');
      return;
    }

    fetch(`/api/storage${query}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payloadString,
    }).catch((err) => console.warn('Server sync background warning:', err));
  } catch (err) {
    console.error('Error saving app data:', err);
  }
}

/**
 * Helper to write directly to IndexedDB.
 */
async function saveToIndexedDB(payload: AppDataPayload): Promise<void> {
  const keys = getStorageKeys();
  await Promise.all([
    set(keys.HAS_INITIALIZED, true),
    set(keys.MOCKUPS, payload.mockups || []),
    set(keys.DESIGNS, payload.designs || []),
    set(keys.FOLDERS, payload.folders || []),
    set(keys.ACTIVE_FOLDER, payload.activeFolderId),
    set(keys.SELECTED_MOCKUP, payload.selectedMockupId),
  ]);
}

/**
 * Exports current mockups, designs, and folders as a JSON file for backup.
 */
export function exportAppDataFile(payload: AppDataPayload): void {
  const jsonString = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const dateStr = new Date().toISOString().slice(0, 10);
  const link = document.createElement('a');
  link.href = url;
  link.download = `automania-pod-backup-${dateStr}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Imports application backup from a JSON file.
 */
export function parseAppDataBackupFile(file: File): Promise<AppDataPayload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        if (!parsed || !Array.isArray(parsed.mockups) || !Array.isArray(parsed.designs)) {
          throw new Error('Geçersiz yedek dosyası biçimi.');
        }
        resolve({
          mockups: parsed.mockups,
          designs: parsed.designs,
          folders: Array.isArray(parsed.folders) ? parsed.folders : [],
          activeFolderId: parsed.activeFolderId || null,
          selectedMockupId: parsed.selectedMockupId || (parsed.mockups[0]?.id || null),
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Dosya okunamadı.'));
    reader.readAsText(file);
  });
}
