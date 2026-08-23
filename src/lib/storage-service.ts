import { get, set, del } from 'idb-keyval';
import { uploadMediaToServer } from './image-optimizer';
import { downloadBlob } from './download';
import { MockupItem, DesignItem, MockupFolder, RenderedMatch } from '@/types/pod';

export interface SyncStatus {
  isSyncing: boolean;
  isMigrating: boolean;
  message: string;
  progress: number; // 0 to 100
  current?: number;
  total?: number;
}

type SyncStatusListener = (status: SyncStatus) => void;
const syncStatusListeners = new Set<SyncStatusListener>();

let currentSyncStatus: SyncStatus = {
  isSyncing: false,
  isMigrating: false,
  message: '',
  progress: 0,
};

let resetTimer: NodeJS.Timeout | null = null;

export function getSyncStatus(): SyncStatus {
  return currentSyncStatus;
}

export function subscribeSyncStatus(listener: SyncStatusListener): () => void {
  syncStatusListeners.add(listener);
  try {
    listener(currentSyncStatus);
  } catch (e) {
    console.error('[SyncStatus] Initial listener call error:', e);
  }
  return () => {
    syncStatusListeners.delete(listener);
  };
}

export function notifySyncStatus(status: Partial<SyncStatus>) {
  if (resetTimer) {
    clearTimeout(resetTimer);
    resetTimer = null;
  }
  currentSyncStatus = { ...currentSyncStatus, ...status };
  syncStatusListeners.forEach((listener) => {
    try {
      listener(currentSyncStatus);
    } catch (e) {
      console.error('[SyncStatus] Listener error:', e);
    }
  });

  // If sync just completed, reset state after a short celebration window
  if (!currentSyncStatus.isSyncing && !currentSyncStatus.isMigrating && currentSyncStatus.progress === 100) {
    resetTimer = setTimeout(() => {
      currentSyncStatus = {
        isSyncing: false,
        isMigrating: false,
        message: '',
        progress: 0,
      };
      syncStatusListeners.forEach((listener) => {
        try {
          listener(currentSyncStatus);
        } catch {}
      });
    }, 3500);
  }
}

let inFlightMigrationPromise: Promise<AppDataPayload | null> | null = null;
let inFlightSyncPromise: Promise<AppDataPayload | null> | null = null;

function isTemporaryMediaUrl(value: unknown): value is string {
  return typeof value === 'string' && (value.startsWith('blob:') || value.startsWith('data:'));
}

function hasTemporaryMediaUrl(payload: AppDataPayload): boolean {
  return [
    ...(payload.mockups || []).map((item) => item.src),
    ...(payload.designs || []).map((item) => item.src),
    ...(payload.etsyGeneratedMockups || []).map((item) => item.previewUrl),
  ].some(isTemporaryMediaUrl);
}

async function promoteTemporaryMediaUrls(
  payload: AppDataPayload,
  onProgress?: (current: number, total: number) => void
): Promise<{ payload: AppDataPayload; changed: boolean }> {
  let changed = false;

  const temporaryMockups = (payload.mockups || []).filter((item) => isTemporaryMediaUrl(item.src));
  const temporaryDesigns = (payload.designs || []).filter((item) => isTemporaryMediaUrl(item.src));
  const temporaryGenerated = (payload.etsyGeneratedMockups || []).filter((item) => isTemporaryMediaUrl(item.previewUrl));

  const totalTemporaryItems = temporaryMockups.length + temporaryDesigns.length + temporaryGenerated.length;
  let completedItems = 0;

  if (totalTemporaryItems > 0 && onProgress) {
    onProgress(0, totalTemporaryItems);
  }

  const promote = async (value: string, mimeType: string): Promise<string> => {
    if (!isTemporaryMediaUrl(value)) return value;
    try {
      const promotedUrl = await uploadMediaToServer(value, mimeType, { requireDurable: false });
      completedItems++;
      if (totalTemporaryItems > 0 && onProgress) {
        onProgress(completedItems, totalTemporaryItems);
      }
      if (promotedUrl && promotedUrl !== value && !isTemporaryMediaUrl(promotedUrl)) {
        changed = true;
        return promotedUrl;
      }
      return value;
    } catch (error) {
      console.warn('[Workspace] Temporary media promotion skipped:', error instanceof Error ? error.message : 'unknown error');
      completedItems++;
      if (totalTemporaryItems > 0 && onProgress) {
        onProgress(completedItems, totalTemporaryItems);
      }
      return value;
    }
  };

  const mockups = await Promise.all((payload.mockups || []).map(async (item) => ({
    ...item,
    src: await promote(item.src, item.isVideo ? (item.src.includes('webm') ? 'video/webm' : 'video/mp4') : 'image/webp'),
  })));
  const designs = await Promise.all((payload.designs || []).map(async (item) => ({
    ...item,
    src: await promote(item.src, 'image/webp'),
  })));
  const etsyGeneratedMockups = await Promise.all((payload.etsyGeneratedMockups || []).map(async (item) => ({
    ...item,
    previewUrl: await promote(item.previewUrl, item.isVideo ? (item.previewUrl?.includes('webm') ? 'video/webm' : 'video/mp4') : 'image/webp'),
  })));

  return { payload: { ...payload, mockups, designs, etsyGeneratedMockups }, changed };
}

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

export function getStorageKeys(overrideUserId?: string | null) {
  const userId = overrideUserId !== undefined ? overrideUserId : getCurrentUserId();
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
    ETSY_DEFAULT_TEMPLATES: `${prefix}automania_etsy_default_templates_v1`,
    ETSY_CUSTOM_SIZES: `${prefix}automania_etsy_custom_sizes_v1`,
    ETSY_CUSTOM_COLORS: `${prefix}automania_etsy_custom_colors_v1`,
    ETSY_GENERATED_MOCKUPS: `${prefix}automania_etsy_generated_mockups_v1`,
    ETSY_FOLDER_ORDER: `${prefix}automania_etsy_folder_order_v1`,
  };
}

/**
 * Checks if there is draft data in the guest workspace (e.g. created before signing in).
 */
export async function getGuestWorkspace(): Promise<AppDataPayload | null> {
  const keys = getStorageKeys('default_user');
  try {
    const [mockups, designs, folders, activeFolder, selectedMockup, generatedMockups] = await Promise.all([
      get<MockupItem[]>(keys.MOCKUPS),
      get<DesignItem[]>(keys.DESIGNS),
      get<MockupFolder[]>(keys.FOLDERS),
      get<string | null>(keys.ACTIVE_FOLDER),
      get<string | null>(keys.SELECTED_MOCKUP),
      get<RenderedMatch[] | null>(keys.ETSY_GENERATED_MOCKUPS),
    ]);

    if ((mockups && mockups.length > 0) || (designs && designs.length > 0) || (generatedMockups && generatedMockups.length > 0)) {
      return {
        mockups: mockups || [],
        designs: designs || [],
        folders: folders || [],
        activeFolderId: activeFolder || null,
        selectedMockupId: selectedMockup || (mockups?.[0]?.id || null),
        etsyGeneratedMockups: generatedMockups || [],
      };
    }
  } catch (err) {
    console.warn('Failed to inspect guest workspace:', err);
  }
  return null;
}

/**
 * Clears only the guest workspace keys from IndexedDB.
 */
export async function clearGuestWorkspace(): Promise<void> {
  const keys = getStorageKeys('default_user');
  try {
    await Promise.all([
      del(keys.MOCKUPS),
      del(keys.DESIGNS),
      del(keys.FOLDERS),
      del(keys.ACTIVE_FOLDER),
      del(keys.SELECTED_MOCKUP),
      del(keys.ACTIVE_DESIGN_FOLDER),
      del(keys.ETSY_GENERATED_MOCKUPS),
      del(keys.ETSY_FOLDER_ORDER),
      del('automania_pod_mockups_v1'),
      del('automania_pod_designs_v1'),
      del('automania_pod_folders_v1'),
      del('automania_pod_active_folder_v1'),
      del('automania_pod_selected_mockup_v1'),
      del('automania_pod_active_design_folder_v1'),
      del('automania_etsy_generated_mockups_v1'),
      del('automania_etsy_folder_order_v1'),
    ]);
  } catch (err) {
    console.warn('Failed to clear guest workspace:', err);
  }
}

/**
 * Migrates local guest workspace items (mockups, designs, folders, generated mockups) into the signed-in user's account.
 */
export async function migrateGuestWorkspaceToUser(
  currentUserPayload?: Partial<AppDataPayload>
): Promise<AppDataPayload | null> {
  if (inFlightMigrationPromise) {
    return inFlightMigrationPromise;
  }

  inFlightMigrationPromise = (async () => {
    try {
      const guestData = await getGuestWorkspace();
      if (!guestData) {
        notifySyncStatus({ isSyncing: false, isMigrating: false, message: '', progress: 0 });
        return null;
      }

      notifySyncStatus({
        isSyncing: true,
        isMigrating: true,
        message: 'Yerel taslaklarınız taranıyor ve bulut hesabınıza aktarılıyor...',
        progress: 10,
      });

      const userKeys = getStorageKeys();
      let existingMockups = currentUserPayload?.mockups;
      let existingDesigns = currentUserPayload?.designs;
      let existingFolders = currentUserPayload?.folders;
      let existingGenerated = currentUserPayload?.etsyGeneratedMockups;

      if (existingMockups === undefined || existingDesigns === undefined || existingFolders === undefined || existingGenerated === undefined) {
        const [savedMockups, savedDesigns, savedFolders, savedGenerated] = await Promise.all([
          get<MockupItem[]>(userKeys.MOCKUPS),
          get<DesignItem[]>(userKeys.DESIGNS),
          get<MockupFolder[]>(userKeys.FOLDERS),
          get<RenderedMatch[]>(userKeys.ETSY_GENERATED_MOCKUPS),
        ]);
        if (existingMockups === undefined) existingMockups = savedMockups || [];
        if (existingDesigns === undefined) existingDesigns = savedDesigns || [];
        if (existingFolders === undefined) existingFolders = savedFolders || [];
        if (existingGenerated === undefined) existingGenerated = savedGenerated || [];
      }

      const currentMockups = existingMockups || [];
      const currentDesigns = existingDesigns || [];
      const currentFolders = existingFolders || [];
      const currentGenerated = existingGenerated || [];

      // Merge folders without duplicate names
      const mergedFolders = [...currentFolders];
      for (const gf of guestData.folders || []) {
        if (!mergedFolders.some(f => f.id === gf.id || f.name === gf.name)) {
          mergedFolders.push(gf);
        }
      }

      // Merge mockups without duplicate IDs
      const mergedMockups = [...currentMockups];
      for (const gm of guestData.mockups || []) {
        if (!mergedMockups.some(m => m.id === gm.id || (m.src && gm.src && m.src === gm.src))) {
          mergedMockups.push(gm);
        }
      }

      // Merge designs without duplicate IDs
      const mergedDesigns = [...currentDesigns];
      for (const gd of guestData.designs || []) {
        if (!mergedDesigns.some(d => d.id === gd.id || (d.src && gd.src && d.src === gd.src))) {
          mergedDesigns.push(gd);
        }
      }

      // Merge generated mockups without duplicate IDs
      const mergedGenerated = [...currentGenerated];
      for (const gg of guestData.etsyGeneratedMockups || []) {
        if (!mergedGenerated.some(g => g.id === gg.id)) {
          mergedGenerated.push(gg);
        }
      }

      let mergedPayload: AppDataPayload = {
        mockups: mergedMockups,
        designs: mergedDesigns,
        folders: mergedFolders,
        etsyGeneratedMockups: mergedGenerated,
        activeFolderId: guestData.activeFolderId || currentUserPayload?.activeFolderId || null,
        selectedMockupId: guestData.selectedMockupId || currentUserPayload?.selectedMockupId || (mergedMockups[0]?.id || null),
        lastUpdated: Date.now(),
      };

      // 1. Promote temporary media to durable server URLs where possible
      const promoted = await promoteTemporaryMediaUrls(mergedPayload, (curr, tot) => {
        const pct = Math.min(88, Math.round(15 + (curr / tot) * 70));
        notifySyncStatus({
          isSyncing: true,
          isMigrating: true,
          message: `Görseller bulut hesabınıza aktarılıyor (${curr}/${tot})...`,
          progress: pct,
          current: curr,
          total: tot,
        });
      });
      mergedPayload = promoted.payload;

      // 2. Save merged state to the logged-in user's IndexedDB and Server
      notifySyncStatus({
        isSyncing: true,
        isMigrating: true,
        message: 'Verileriniz bulut hesabınıza kaydediliyor...',
        progress: 92,
      });
      await saveAppData(mergedPayload);

      // 3. Clear guest workspace so migration prompt doesn't trigger again
      await clearGuestWorkspace();

      notifySyncStatus({
        isSyncing: false,
        isMigrating: false,
        message: 'Verileriniz bulut hesabınıza başarıyla aktarıldı!',
        progress: 100,
      });

      return mergedPayload;
    } catch (err) {
      console.error('[Workspace] Migration failed:', err);
      notifySyncStatus({
        isSyncing: false,
        isMigrating: false,
        message: 'Aktarım sırasında bir hata oluştu.',
        progress: 0,
      });
      return null;
    } finally {
      inFlightMigrationPromise = null;
    }
  })();

  return inFlightMigrationPromise;
}

interface EtsyVariationTemplate {
  id: string;
  name: string;
  updatedAt: string;
  variations: unknown[];
}

export interface AppDataPayload {
  mockups: MockupItem[];
  designs: DesignItem[];
  folders: MockupFolder[];
  activeFolderId: string | null;
  selectedMockupId: string | null;
  activeDesignFolderId?: string | null;
  modelVision?: string;
  modelReasoning?: string;
  modelGeneration?: string;
  etsyProductTypes?: string;
  etsyUserNotes?: string;
  etsyVariationTemplates?: EtsyVariationTemplate[];
  etsyDefaultTemplates?: Record<number, string>;
  etsyCustomSizes?: string[];
  etsyCustomColors?: string[];
  etsyGeneratedMockups?: RenderedMatch[];
  etsyFolderOrder?: string[];
  lastUpdated?: number;
}

/**
 * Forces a synchronization from the Server API, treating the Server as the Single Source of Truth.
 * Preserves local UI state (active folders, selected mockup) if available.
 */
export async function forceSyncFromServer(): Promise<AppDataPayload | null> {
  const userId = getCurrentUserId();
  if (!userId || userId === 'default_user') {
    // Guest users do not have a server workspace; their single source of truth is local IndexedDB!
    return null;
  }

  if (inFlightSyncPromise) {
    return inFlightSyncPromise;
  }

  inFlightSyncPromise = (async () => {
    try {
      const res = await fetch('/api/storage');
      if (res.ok) {
        const serverData = await res.json();
        if (serverData && (Array.isArray(serverData.mockups) || Array.isArray(serverData.designs) || Array.isArray(serverData.folders))) {
          const keys = getStorageKeys();
          // Check if user has local items in IndexedDB
          const [
            savedMockups,
            savedDesigns,
            savedFolders,
            savedActiveFolder,
            savedSelectedMockup,
            savedActiveDesignFolder,
            savedGeneratedMockups,
          ] = await Promise.all([
            get<MockupItem[]>(keys.MOCKUPS),
            get<DesignItem[]>(keys.DESIGNS),
            get<MockupFolder[]>(keys.FOLDERS),
            get<string | null>(keys.ACTIVE_FOLDER),
            get<string | null>(keys.SELECTED_MOCKUP),
            get<string | null>(keys.ACTIVE_DESIGN_FOLDER),
            get<RenderedMatch[] | null>(keys.ETSY_GENERATED_MOCKUPS),
          ]);

          const isServerEmpty = (serverData.mockups?.length || 0) === 0 && (serverData.designs?.length || 0) === 0;
          const hasLocalUserData = (savedMockups && savedMockups.length > 0) || (savedDesigns && savedDesigns.length > 0);

          // Scenario 1: Server is empty, but local user IndexedDB has items (e.g. freshly migrated or offline items)
          if (isServerEmpty && hasLocalUserData) {
            let localPayload: AppDataPayload = {
              mockups: savedMockups || [],
              designs: savedDesigns || [],
              folders: savedFolders || [],
              activeFolderId: savedActiveFolder ?? null,
              selectedMockupId: savedSelectedMockup ?? (savedMockups?.[0]?.id || null),
              activeDesignFolderId: savedActiveDesignFolder ?? null,
              etsyGeneratedMockups: savedGeneratedMockups || [],
            };
            const promoted = await promoteTemporaryMediaUrls(localPayload);
            localPayload = promoted.payload;
            await saveAppData(localPayload);
            return localPayload;
          }

          // Scenario 2: Server is empty and user IndexedDB is empty, check if guest workspace has items
          if (isServerEmpty && !hasLocalUserData) {
            const guestData = await getGuestWorkspace();
            if (
              guestData &&
              ((guestData.mockups?.length || 0) > 0 ||
                (guestData.designs?.length || 0) > 0 ||
                (guestData.etsyGeneratedMockups?.length || 0) > 0)
            ) {
              const migrated = await migrateGuestWorkspaceToUser();
              if (migrated) {
                return migrated;
              }
            }
          }

          const serverGenerated = serverData.etsyGeneratedMockups;
          const finalGenerated = (serverGenerated && serverGenerated.length > 0)
            ? serverGenerated
            : (savedGeneratedMockups || []);

          let payload: AppDataPayload = {
            mockups: serverData.mockups || [],
            designs: serverData.designs || [],
            folders: serverData.folders || [],
            activeFolderId: savedActiveFolder ?? serverData.activeFolderId ?? null,
            selectedMockupId: savedSelectedMockup ?? serverData.selectedMockupId ?? (serverData.mockups?.[0]?.id || null),
            activeDesignFolderId: savedActiveDesignFolder ?? null,
            modelVision: serverData.modelVision,
            modelReasoning: serverData.modelReasoning,
            modelGeneration: serverData.modelGeneration,
            etsyProductTypes: serverData.etsyProductTypes,
            etsyUserNotes: serverData.etsyUserNotes,
            etsyVariationTemplates: serverData.etsyVariationTemplates || [],
            etsyDefaultTemplates: serverData.etsyDefaultTemplates || {},
            etsyCustomSizes: serverData.etsyCustomSizes || [],
            etsyCustomColors: serverData.etsyCustomColors || [],
            etsyGeneratedMockups: finalGenerated,
          };

          // Promote legacy temporary URLs when they are still recoverable in this browser.
          const promoted = await promoteTemporaryMediaUrls(payload);
          payload = promoted.payload;
          if (promoted.changed) {
            const syncResult = await saveAppData(payload);
            if (!syncResult.success) {
              console.warn('[Workspace] Promoted media could not be persisted to the server.');
            }
          }

          // Write the fresh server data back to local IndexedDB
          await saveToIndexedDB(payload);

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
    } finally {
      inFlightSyncPromise = null;
    }
    return null;
  })();

  return inFlightSyncPromise;
}

/**
 * Loads application data, prioritizing the Server API as the Single Source of Truth for logged-in users.
 * If the user is a guest or server is offline/fails, loads from IndexedDB.
 */
export async function loadAppData(): Promise<AppDataPayload> {
  const keys = getStorageKeys();
  const userId = getCurrentUserId();

  // 1. Try to fetch from Server first ONLY if user is logged in
  if (userId && userId !== 'default_user') {
    const serverPayload = await forceSyncFromServer();
    if (serverPayload) {
      return serverPayload;
    }
  }

  // 2. Fallback to IndexedDB (and Primary for Guest users)
  try {
    const [hasInit, savedMockups, savedDesigns, savedFolders, savedActiveFolder, savedSelectedMockup, savedActiveDesignFolder, savedEtsyProductTypes, savedEtsyUserNotes, savedEtsyVariationTemplates, savedEtsyDefaultTemplates, savedEtsyCustomSizes, savedEtsyCustomColors, savedEtsyGeneratedMockups, savedEtsyFolderOrder] =
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
        get<EtsyVariationTemplate[] | null>(keys.ETSY_VARIATION_TEMPLATES),
        get<Record<number, string> | null>(keys.ETSY_DEFAULT_TEMPLATES),
        get<string[] | null>(keys.ETSY_CUSTOM_SIZES),
        get<string[] | null>(keys.ETSY_CUSTOM_COLORS),
        get<RenderedMatch[] | null>(keys.ETSY_GENERATED_MOCKUPS),
        get<string[] | null>(keys.ETSY_FOLDER_ORDER),
      ]);

    if (hasInit || (savedMockups && savedMockups.length > 0) || (savedDesigns && savedDesigns.length > 0)) {
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
        etsyDefaultTemplates: savedEtsyDefaultTemplates || {},
        etsyCustomSizes: savedEtsyCustomSizes || [],
        etsyCustomColors: savedEtsyCustomColors || [],
        etsyGeneratedMockups: savedEtsyGeneratedMockups || [],
        etsyFolderOrder: savedEtsyFolderOrder || [],
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
    // Toplayıp sileceğimiz remote HTTP blob'ları bulalım (base64/data URL'ler sunucuya gönderilmez)
    const [mockups, designs, generatedMockups] = await Promise.all([
      get<MockupItem[]>(keys.MOCKUPS),
      get<DesignItem[]>(keys.DESIGNS),
      get<RenderedMatch[]>(keys.ETSY_GENERATED_MOCKUPS),
    ]);
    
    const urlsToDelete: string[] = [];
    if (mockups) mockups.forEach(m => { if (m.src && (m.src.startsWith('http://') || m.src.startsWith('https://'))) urlsToDelete.push(m.src); });
    if (designs) designs.forEach(d => { if (d.src && (d.src.startsWith('http://') || d.src.startsWith('https://'))) urlsToDelete.push(d.src); });
    if (generatedMockups) generatedMockups.forEach(item => { if (item.previewUrl && (item.previewUrl.startsWith('http://') || item.previewUrl.startsWith('https://'))) urlsToDelete.push(item.previewUrl); });
    
    if (urlsToDelete.length > 0) {
      await deleteBlobs(Array.from(new Set(urlsToDelete))).catch(() => {});
    }

    await Promise.all([
      del(keys.MOCKUPS),
      del(keys.DESIGNS),
      del(keys.FOLDERS),
      del(keys.ACTIVE_FOLDER),
      del(keys.SELECTED_MOCKUP),
      del(keys.ACTIVE_DESIGN_FOLDER),
      del(keys.ETSY_GENERATED_MOCKUPS),
      del(keys.ETSY_FOLDER_ORDER),
      del(keys.ETSY_PRODUCT_TYPES),
      del(keys.ETSY_USER_NOTES),
      del(keys.ETSY_VARIATION_TEMPLATES),
      del(keys.ETSY_DEFAULT_TEMPLATES),
      del(keys.ETSY_CUSTOM_SIZES),
      del(keys.ETSY_CUSTOM_COLORS),
      del('automania_pod_mockups_v1'),
      del('automania_pod_designs_v1'),
      del('automania_pod_folders_v1'),
      del('automania_pod_active_folder_v1'),
      del('automania_pod_selected_mockup_v1'),
      del('automania_pod_active_design_folder_v1'),
      del('automania_etsy_generated_mockups_v1'),
      del('automania_etsy_folder_order_v1'),
      del('automania_etsy_product_types_v1'),
      del('automania_etsy_user_notes_v1'),
      del('automania_etsy_variation_templates_v1'),
      del('automania_etsy_default_templates_v1'),
      del('automania_etsy_custom_sizes_v1'),
      del('automania_etsy_custom_colors_v1'),
      set(keys.HAS_INITIALIZED, true),
    ]);

    if (userId && userId !== 'default_user') {
      await fetch(`/api/storage?userId=${userId}`, { method: 'DELETE' }).catch(() => {});
    }
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
    // 1. ALWAYS save to IndexedDB first (Client side instant persistence for guest & signed-in users)
    await saveToIndexedDB(payload);

    // 2. If guest user (not logged in), IndexedDB is their sole permanent storage.
    if (!userId || userId === 'default_user') {
      return { success: true };
    }

    // Sync to Server side API (Disk persistence)
    const query = `?userId=${userId}`;
    
    // UI state'lerini (activeFolderId, selectedMockupId) sunucuya gönderme! Sadece yerel cihazda kalsın.
    const dataPayload = Object.fromEntries(
      Object.entries(payload).filter(([key]) => key !== 'activeFolderId' && key !== 'selectedMockupId')
    ) as Omit<AppDataPayload, 'activeFolderId' | 'selectedMockupId'>;
    
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
    ...(payload.etsyDefaultTemplates !== undefined ? [set(keys.ETSY_DEFAULT_TEMPLATES, payload.etsyDefaultTemplates)] : []),
    ...(payload.etsyCustomSizes !== undefined ? [set(keys.ETSY_CUSTOM_SIZES, payload.etsyCustomSizes)] : []),
    ...(payload.etsyCustomColors !== undefined ? [set(keys.ETSY_CUSTOM_COLORS, payload.etsyCustomColors)] : []),
    ...(payload.etsyGeneratedMockups !== undefined ? [set(keys.ETSY_GENERATED_MOCKUPS, payload.etsyGeneratedMockups)] : []),
    ...(payload.etsyFolderOrder !== undefined ? [set(keys.ETSY_FOLDER_ORDER, payload.etsyFolderOrder)] : []),
  ]);
}

/**
 * Exports current mockups, designs, and folders as a ZIP file for backup.
 */
export async function exportAppDataFile(payload: AppDataPayload): Promise<void> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const imagesFolder = zip.folder("images");
  if (!imagesFolder) throw new Error("Failed to create zip folder");

  // Deep clone payload so we can mutate image src paths
  const newPayload = JSON.parse(JSON.stringify(payload));

  const processImage = async (item: MockupItem | DesignItem) => {
    if (!item.src) return;
    const isVideoItem = (item as MockupItem).isVideo === true;
    try {
      if (item.src.startsWith('http')) {
        const response = await fetch(item.src);
        const blob = await response.blob();
        const urlObj = new URL(item.src);
        let ext = urlObj.pathname.split('.').pop()?.toLowerCase() || '';
        if (!ext || ext.length > 5 || ext.includes('/')) {
          ext = isVideoItem ? 'mp4' : 'webp';
        }
        const filename = `${item.id}.${ext}`;
        imagesFolder.file(filename, blob);
        item.src = `images/${filename}`;
      } else if (item.src.startsWith('data:')) {
        const parts = item.src.split(',');
        const mime = parts[0].match(/:(.*?);/)?.[1] || (isVideoItem ? 'video/mp4' : 'image/webp');
        const binary = atob(parts[1]);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
        const blob = new Blob([array], { type: mime });

        let ext = 'webp';
        if (mime.includes('mp4') || (isVideoItem && !mime.includes('webm') && !mime.includes('quicktime'))) ext = 'mp4';
        else if (mime.includes('webm')) ext = 'webm';
        else if (mime.includes('quicktime') || mime.includes('mov')) ext = 'mov';
        else if (mime.includes('png')) ext = 'png';
        else if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpg';
        else if (isVideoItem) ext = 'mp4';

        const filename = `${item.id}.${ext}`;
        imagesFolder.file(filename, blob);
        item.src = `images/${filename}`;
      }
    } catch (err) {
      console.warn(`Failed to process media for backup: ${item.id}`, err);
    }
  };

  const tasks: Promise<void>[] = [];
  if (newPayload.mockups) newPayload.mockups.forEach((m: MockupItem) => tasks.push(processImage(m)));
  if (newPayload.designs) newPayload.designs.forEach((d: DesignItem) => tasks.push(processImage(d)));
  
  await Promise.all(tasks);

  zip.file("backup.json", JSON.stringify(newPayload, null, 2));

  const content = await zip.generateAsync({ type: "blob" });
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadBlob(content, `automania-pod-backup-${dateStr}.zip`);
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

  // Restore images and videos from zip
  const processImage = async (item: MockupItem | DesignItem) => {
    if (item.src && item.src.startsWith('images/')) {
      const imgFile = loadedZip.file(item.src);
      if (imgFile) {
        try {
          const ext = item.src.split('.').pop()?.toLowerCase() || '';
          const isVideoItem = (item as MockupItem).isVideo === true || ['mp4', 'webm', 'mov'].includes(ext);
          
          let mimeType = 'image/webp';
          if (ext === 'mp4') mimeType = 'video/mp4';
          else if (ext === 'webm') mimeType = 'video/webm';
          else if (ext === 'mov') mimeType = 'video/quicktime';
          else if (ext === 'png') mimeType = 'image/png';
          else if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
          else if (isVideoItem) mimeType = 'video/mp4';

          const arrayBuffer = await imgFile.async("arraybuffer");
          const typedBlob = new Blob([arrayBuffer], { type: mimeType });
          const fileToUpload = new File([typedBlob], `restore-${Date.now()}.${ext || (isVideoItem ? 'mp4' : 'webp')}`, { type: mimeType });
          
          try {
            const newUrl = await uploadMediaToServer(fileToUpload, mimeType, { requireDurable: false });
            if (newUrl) {
              item.src = newUrl;
              return;
            }
          } catch {}

          // Fallback to local DataURL for guest/offline restoration with explicit typedBlob
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(typedBlob);
          });
          item.src = dataUrl;
        } catch (err) {
          console.error(`Failed to restore media ${item.src}:`, err);
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
