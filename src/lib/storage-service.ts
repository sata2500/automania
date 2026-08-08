import { get, set, del } from 'idb-keyval';
import { uploadMediaToServer } from './image-optimizer';
import { MockupItem, DesignItem, MockupFolder } from '@/types/pod';

function getCurrentUserId(): string {
  if (typeof window === 'undefined') return 'default_user';
  try {
    const saved = localStorage.getItem('automania_pod_user_session');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.id) return parsed.id;
    }
  } catch {}
  return 'default_user';
}

function getStorageKeys() {
  const userId = getCurrentUserId();
  const prefix = userId && userId !== 'default_user' ? `user_${userId}_` : '';
  return {
    MOCKUPS: `${prefix}automania_pod_mockups_v1`,
    DESIGNS: `${prefix}automania_pod_designs_v1`,
    FOLDERS: `${prefix}automania_pod_folders_v1`,
    ACTIVE_FOLDER: `${prefix}automania_pod_active_folder_v1`,
    SELECTED_MOCKUP: `${prefix}automania_pod_selected_mockup_v1`,
    ACTIVE_DESIGN_FOLDER: `${prefix}automania_pod_active_design_folder_v1`,
    HAS_INITIALIZED: `${prefix}automania_pod_has_init_v1`,
    ETSY_PRODUCT_TYPES: `${prefix}automania_etsy_product_types_v1`,
    ETSY_USER_NOTES: `${prefix}automania_etsy_user_notes_v1`,
    ETSY_VARIATION_TEMPLATES: `${prefix}automania_etsy_variation_templates_v1`,
    ETSY_CUSTOM_SIZES: `${prefix}automania_etsy_custom_sizes_v1`,
    ETSY_CUSTOM_COLORS: `${prefix}automania_etsy_custom_colors_v1`,
  };
}

export interface AppDataPayload {
  mockups: MockupItem[];
  designs: DesignItem[];
  folders: MockupFolder[];
  activeFolderId: string | null;
  selectedMockupId: string | null;
  activeDesignFolderId?: string | null;
  openRouterKey?: string;
  modelVision?: string;
  modelReasoning?: string;
  modelGeneration?: string;
  etsyProductTypes?: string;
  etsyUserNotes?: string;
  etsyVariationTemplates?: { id: string; name: string; updatedAt: string; variations: any[] }[];
  etsyCustomSizes?: string[];
  etsyCustomColors?: string[];
  lastUpdated?: number;
}

/**
 * Forces a synchronization from the Server API, treating the Server as the Single Source of Truth.
 * Preserves local UI state (active folders, selected mockup) if available.
 */
export async function forceSyncFromServer(): Promise<AppDataPayload | null> {
  const userId = getCurrentUserId();
  try {
    const res = await fetch(`/api/storage?userId=${userId}`);
    if (res.ok) {
      const serverData = await res.json();
      if (serverData && (Array.isArray(serverData.mockups) || Array.isArray(serverData.designs) || Array.isArray(serverData.folders))) {
        const keys = getStorageKeys();
        // Preserve local UI state so user doesn't lose their place
        const [activeFolderId, selectedMockupId, activeDesignFolderId] = await Promise.all([
          get<string | null>(keys.ACTIVE_FOLDER),
          get<string | null>(keys.SELECTED_MOCKUP),
          get<string | null>(keys.ACTIVE_DESIGN_FOLDER)
        ]);

        const payload: AppDataPayload = {
          mockups: serverData.mockups || [],
          designs: serverData.designs || [],
          folders: serverData.folders || [],
          activeFolderId: activeFolderId ?? serverData.activeFolderId ?? null,
          selectedMockupId: selectedMockupId ?? serverData.selectedMockupId ?? (serverData.mockups?.[0]?.id || null),
          activeDesignFolderId: activeDesignFolderId ?? null,
          openRouterKey: serverData.openRouterKey,
          modelVision: serverData.modelVision,
          modelReasoning: serverData.modelReasoning,
          modelGeneration: serverData.modelGeneration,
          etsyProductTypes: serverData.etsyProductTypes,
          etsyUserNotes: serverData.etsyUserNotes,
          etsyVariationTemplates: serverData.etsyVariationTemplates || [],
          etsyCustomSizes: serverData.etsyCustomSizes || [],
          etsyCustomColors: serverData.etsyCustomColors || [],
        };

        // Write the fresh server data back to local IndexedDB
        await saveToIndexedDB(payload);

        // Also update local storage caches for AI keys
        if (serverData.openRouterKey) {
          try { localStorage.setItem('automania_openrouter_api_key', serverData.openRouterKey); } catch {}
        }
        if (serverData.modelVision) {
          try { localStorage.setItem('automania_model_vision', serverData.modelVision); } catch {}
        }
        if (serverData.modelReasoning) {
          try { localStorage.setItem('automania_model_reasoning', serverData.modelReasoning); } catch {}
        }
        if (serverData.modelGeneration) {
          try { localStorage.setItem('automania_model_generation', serverData.modelGeneration); } catch {}
        }

        return payload;
      }
    }
  } catch (err) {
    console.warn('Force sync from server failed:', err);
  }
  return null;
}

/**
 * Loads application data, prioritizing the Server API as the Single Source of Truth.
 * If the server is offline or fails, falls back to IndexedDB.
 */
export async function loadAppData(): Promise<AppDataPayload> {
  const keys = getStorageKeys();

  // 1. Try to fetch from Server first (Single Source of Truth)
  const serverPayload = await forceSyncFromServer();
  if (serverPayload) {
    return serverPayload;
  }

  // 2. Fallback to IndexedDB if Offline or Server fails
  try {
    let [hasInit, savedMockups, savedDesigns, savedFolders, savedActiveFolder, savedSelectedMockup, savedActiveDesignFolder, savedEtsyProductTypes, savedEtsyUserNotes, savedEtsyVariationTemplates, savedEtsyCustomSizes, savedEtsyCustomColors] =
      await Promise.all([
        get<boolean>(keys.HAS_INITIALIZED),
        get<MockupItem[]>(keys.MOCKUPS),
        get<DesignItem[]>(keys.DESIGNS),
        get<MockupFolder[]>(keys.FOLDERS),
        get<string | null>(keys.ACTIVE_FOLDER),
        get<string | null>(keys.SELECTED_MOCKUP),
        get<string | null>(keys.ACTIVE_DESIGN_FOLDER),
        get<string | null>(keys.ETSY_PRODUCT_TYPES),
        get<string | null>(keys.ETSY_USER_NOTES),
        get<any[] | null>(keys.ETSY_VARIATION_TEMPLATES),
        get<string[] | null>(keys.ETSY_CUSTOM_SIZES),
        get<string[] | null>(keys.ETSY_CUSTOM_COLORS),
      ]);

    // Legacy Recovery: If current prefixed storage is empty, check non-prefixed legacy IndexedDB keys
    if ((!savedMockups || savedMockups.length === 0) && (!savedDesigns || savedDesigns.length === 0)) {
      const [legacyMockups, legacyDesigns, legacyFolders] = await Promise.all([
        get<MockupItem[]>('automania_pod_mockups_v1'),
        get<DesignItem[]>('automania_pod_designs_v1'),
        get<MockupFolder[]>('automania_pod_folders_v1'),
      ]);
      if ((legacyMockups && legacyMockups.length > 0) || (legacyDesigns && legacyDesigns.length > 0)) {
        savedMockups = legacyMockups || [];
        savedDesigns = legacyDesigns || [];
        savedFolders = legacyFolders || [];
        await saveToIndexedDB({
          mockups: savedMockups,
          designs: savedDesigns,
          folders: savedFolders,
          activeFolderId: savedActiveFolder ?? null,
          selectedMockupId: savedSelectedMockup ?? null,
        });
      }
    }

    if (hasInit && (savedMockups?.length || savedDesigns?.length || savedFolders?.length)) {
      return {
        mockups: savedMockups || [],
        designs: savedDesigns || [],
        folders: savedFolders || [],
        activeFolderId: savedActiveFolder ?? null,
        selectedMockupId: savedSelectedMockup ?? (savedMockups?.[0]?.id || null),
        activeDesignFolderId: savedActiveDesignFolder ?? null,
        etsyProductTypes: savedEtsyProductTypes ?? '',
        etsyUserNotes: savedEtsyUserNotes ?? '',
        etsyVariationTemplates: savedEtsyVariationTemplates || [],
        etsyCustomSizes: savedEtsyCustomSizes || [],
        etsyCustomColors: savedEtsyCustomColors || [],
        lastUpdated: Date.now(),
      };
    }
  } catch (err) {
    console.warn('Failed to load saved state from local storage fallback:', err);
  }

  // 3. Default empty workspace for new users
  return {
    mockups: [],
    designs: [],
    folders: [],
    activeFolderId: null,
    selectedMockupId: null,
    activeDesignFolderId: null,
  };
}

/**
 * Loads standard factory sample data (60 mockups, designs, folders) into the user's workspace.
 */
export async function loadSampleAppData(): Promise<AppDataPayload> {
  const { SAMPLE_MOCKUPS, SAMPLE_DESIGNS, DEFAULT_FOLDERS } = await import('./sample-data');
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
 * Calls the internal blob API to securely delete a list of URLs from Vercel Blob.
 */
export async function deleteBlobs(urls: string[]): Promise<void> {
  if (!urls || urls.length === 0) return;
  try {
    await fetch('/api/storage/blob', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls }),
    });
  } catch (err) {
    console.error('Failed to delete blobs:', err);
  }
}

/**
 * Clears all user data completely to start from scratch.
 */
export async function clearAllAppData(): Promise<AppDataPayload> {
  const keys = getStorageKeys();
  const userId = getCurrentUserId();

  try {
    // Toplayıp sileceğimiz blob'ları bulalım
    const mockups = await get<MockupItem[]>(keys.MOCKUPS);
    const designs = await get<DesignItem[]>(keys.DESIGNS);
    
    const urlsToDelete: string[] = [];
    if (mockups) mockups.forEach(m => { if (m.src) urlsToDelete.push(m.src); });
    if (designs) designs.forEach(d => { if (d.src) urlsToDelete.push(d.src); });
    
    // Asenkron olarak silme isteği başlat (best-effort)
    deleteBlobs(urlsToDelete);

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
export async function saveAppData(
  payload: AppDataPayload,
  lastKnownServerTimestamp?: number
): Promise<{ success: boolean; conflict?: boolean; timestamp?: number }> {
  const userId = getCurrentUserId();
  try {
    // Save to IndexedDB (Client side instant persistence)
    await saveToIndexedDB(payload);

    // Sync to Server side API (Disk persistence)
    const query = userId ? `?userId=${userId}` : '';
    
    // UI state'lerini (activeFolderId, selectedMockupId) sunucuya gönderme! Sadece yerel cihazda kalsın.
    const { activeFolderId, selectedMockupId, ...dataPayload } = payload;
    
    const payloadString = JSON.stringify({
      ...dataPayload,
      lastUpdated: Date.now(),
      lastKnownServerTimestamp,
    });

    // Vercel Serverless Limit is 4.5MB. Prevent sync if JSON is too heavy (e.g., contains raw base64 images from old caches)
    if (payloadString.length > 3.8 * 1024 * 1024) {
      console.warn('Sync aborted: Payload exceeds 3.8MB Vercel limit. Please delete large local designs or clear cache.');
      return { success: false };
    }

    try {
      const res = await fetch(`/api/storage${query}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payloadString,
      });
      
      if (res.status === 409) {
        return { success: false, conflict: true };
      }
      
      if (res.ok) {
        const responseData = await res.json();
        return { success: true, timestamp: responseData.timestamp };
      }
      return { success: false };
    } catch (err) {
      console.warn('Server sync background warning:', err);
      return { success: false };
    }
  } catch (err) {
    console.error('Error saving app data:', err);
    return { success: false };
  }
}

/**
 * Updates IndexedDB with data received from a remote server sync.
 * Does NOT trigger a server POST — use this when applying another device's changes
 * to avoid the echo loop: fetch → state update → auto-save → fetch → ...
 */
export async function updateLocalCache(payload: AppDataPayload): Promise<void> {
  await saveToIndexedDB(payload);
}

/**
 * Saves ONLY the UI state (which folder is open, which mockup is selected) to IndexedDB.
 * This prevents unnecessary server syncs when the user just clicks around.
 */
export async function saveUIStateToIndexedDB(
  activeFolderId: string | null,
  selectedMockupId: string | null,
  activeDesignFolderId: string | null
): Promise<void> {
  const keys = getStorageKeys();
  await Promise.all([
    set(keys.ACTIVE_FOLDER, activeFolderId),
    set(keys.SELECTED_MOCKUP, selectedMockupId),
    set(keys.ACTIVE_DESIGN_FOLDER, activeDesignFolderId),
  ]);
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
    ...(payload.etsyProductTypes !== undefined ? [set(keys.ETSY_PRODUCT_TYPES, payload.etsyProductTypes)] : []),
    ...(payload.etsyUserNotes !== undefined ? [set(keys.ETSY_USER_NOTES, payload.etsyUserNotes)] : []),
    ...(payload.etsyVariationTemplates !== undefined ? [set(keys.ETSY_VARIATION_TEMPLATES, payload.etsyVariationTemplates)] : []),
    ...(payload.etsyCustomSizes !== undefined ? [set(keys.ETSY_CUSTOM_SIZES, payload.etsyCustomSizes)] : []),
    ...(payload.etsyCustomColors !== undefined ? [set(keys.ETSY_CUSTOM_COLORS, payload.etsyCustomColors)] : []),
  ]);
}

/**
 * Exports current mockups, designs, and folders as a ZIP file for backup.
 */
export async function exportAppDataFile(payload: AppDataPayload): Promise<void> {
  const JSZip = (await import('jszip')).default;
  const { saveAs } = await import('file-saver');

  const zip = new JSZip();
  const imagesFolder = zip.folder("images");
  if (!imagesFolder) throw new Error("Failed to create zip folder");

  // Deep clone payload so we can mutate image src paths
  const newPayload = JSON.parse(JSON.stringify(payload));

  const processImage = async (item: MockupItem | DesignItem) => {
    if (item.src && item.src.startsWith('http')) {
      try {
        const response = await fetch(item.src);
        const blob = await response.blob();
        
        const urlObj = new URL(item.src);
        let filename = urlObj.pathname.split('/').pop() || `${item.id}.png`;
        
        imagesFolder.file(filename, blob);
        item.src = `images/${filename}`;
      } catch (err) {
        console.warn(`Failed to fetch image for backup: ${item.src}`, err);
      }
    }
  };

  const tasks: Promise<void>[] = [];
  if (newPayload.mockups) newPayload.mockups.forEach((m: MockupItem) => tasks.push(processImage(m)));
  if (newPayload.designs) newPayload.designs.forEach((d: DesignItem) => tasks.push(processImage(d)));
  
  await Promise.all(tasks);

  zip.file("backup.json", JSON.stringify(newPayload, null, 2));

  const content = await zip.generateAsync({ type: "blob" });
  const dateStr = new Date().toISOString().slice(0, 10);
  saveAs(content, `automania-pod-backup-${dateStr}.zip`);
}

/**
 * Imports application backup from a ZIP file containing backup.json and an images folder.
 */
export async function parseAppDataBackupFile(file: File): Promise<AppDataPayload> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);
  
  const backupJsonFile = loadedZip.file("backup.json");
  if (!backupJsonFile) {
    throw new Error('Geçersiz yedek dosyası biçimi. (backup.json bulunamadı)');
  }
  
  const content = await backupJsonFile.async("string");
  const parsed = JSON.parse(content);
  if (!parsed || !Array.isArray(parsed.mockups) || !Array.isArray(parsed.designs)) {
    throw new Error('Geçersiz yedek dosyası biçimi.');
  }

  // Upload images from zip to Vercel Blob
  const processImage = async (item: MockupItem | DesignItem) => {
    if (item.src && item.src.startsWith('images/')) {
      const imgFile = loadedZip.file(item.src);
      if (imgFile) {
        try {
          const blobData = await imgFile.async("blob");
          const ext = item.src.split('.').pop() || 'png';
          const fileToUpload = new File([blobData], `restore-${Date.now()}.${ext}`, { type: `image/${ext === 'jpg' ? 'jpeg' : ext}` });
          const newUrl = await uploadMediaToServer(fileToUpload);
          item.src = newUrl;
        } catch (err) {
          console.error(`Failed to restore image ${item.src}:`, err);
        }
      }
    }
  };

  const tasks: Promise<void>[] = [];
  if (parsed.mockups) parsed.mockups.forEach((m: MockupItem) => tasks.push(processImage(m)));
  if (parsed.designs) parsed.designs.forEach((d: DesignItem) => tasks.push(processImage(d)));
  
  await Promise.all(tasks);

  return {
    mockups: parsed.mockups,
    designs: parsed.designs,
    folders: Array.isArray(parsed.folders) ? parsed.folders : [],
    activeFolderId: parsed.activeFolderId || null,
    selectedMockupId: parsed.selectedMockupId || (parsed.mockups[0]?.id || null),
  };
}
