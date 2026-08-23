import { useState, useEffect, useRef } from 'react';
import { MockupItem, DesignItem, MockupFolder, RenderedMatch } from '@/types/pod';
import {
  loadAppData,
  saveAppData,
  saveUIStateToIndexedDB,
  updateLocalCache,
  getStorageKeys,
  subscribeSyncStatus,
  getSyncStatus,
  SyncStatus,
} from '@/lib/storage-service';
import { get } from 'idb-keyval';
import { STORAGE_KEYS, TIMING } from '@/config/constants';
import { useAuth } from '@/components/common/UserAuthContext';

function readStoredBoolean(key: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

function detectPwaInstalled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const standalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
    return Boolean(window.matchMedia('(display-mode: standalone)').matches || standalone);
  } catch {
    return false;
  }
}

export function useWorkspace() {
  const { user } = useAuth();
  
  const [folders, setFolders] = useState<MockupFolder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  const [mockups, setMockups] = useState<MockupItem[]>([]);
  const [designs, setDesigns] = useState<DesignItem[]>([]);
  const [selectedMockupId, setSelectedMockupId] = useState<string | null>(null);
  const [activeDesignFolderId, setActiveDesignFolderId] = useState<string | null>(null);

  const [renderedMatches, setRenderedMatches] = useState<RenderedMatch[]>([]);
  const [hasGenerated, setHasGenerated] = useState<boolean>(false);

  const [isInitialized, setIsInitialized] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [initializationAttempt, setInitializationAttempt] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isBackupProcessing, setIsBackupProcessing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus);

  // Subscribe to live synchronization and migration status
  useEffect(() => {
    const unsubscribe = subscribeSyncStatus((status) => {
      setSyncStatus({ ...status });
    });
    return () => unsubscribe();
  }, []);

  // Prevent accidental tab closure or refresh while data migration / cloud upload is in progress
  useEffect(() => {
    if (!syncStatus.isMigrating) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Verileriniz bulut hesabınıza senkronize ediliyor. Lütfen işlemin tamamlanmasını bekleyin.';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [syncStatus.isMigrating]);

  // These values depend on browser-only APIs. Keep the first render identical
  // on the server and client, then hydrate preferences after mount.
  const [isGuestInfoDismissed, setIsGuestInfoDismissed] = useState(false);
  const [isEmptyWorkspaceDismissed, setIsEmptyWorkspaceDismissed] = useState(false);
  const [isPwaInfoDismissed, setIsPwaInfoDismissed] = useState(false);
  const [isPwaInstalled, setIsPwaInstalled] = useState(true);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const lastSyncTimestampRef = useRef<number>(0);
  const syncedFromServerRef = useRef<boolean>(false);
  const isSyncFetchingRef = useRef<boolean>(false);
  const isFirstRenderAfterInit = useRef<boolean>(true);

  useEffect(() => {
    const preferenceTimer = window.setTimeout(() => {
      setIsGuestInfoDismissed(readStoredBoolean(STORAGE_KEYS.GUEST_BANNER_DISMISSED));
      setIsEmptyWorkspaceDismissed(readStoredBoolean(STORAGE_KEYS.EMPTY_WORKSPACE_DISMISSED));
      setIsPwaInfoDismissed(readStoredBoolean(STORAGE_KEYS.PWA_BANNER_DISMISSED));
      setIsPwaInstalled(detectPwaInstalled());
    }, 0);

    return () => window.clearTimeout(preferenceTimer);
  }, []);

  // Load initial data. Instant local IndexedDB hydration (0ms delay), then background sync.
  useEffect(() => {
    let isMounted = true;

    async function initializeWorkspace() {
      // Phase 1: Instant local cache hydration for zero-flicker UI render
      try {
        const keys = getStorageKeys();
        const [
          hasInit,
          savedMockups,
          savedDesigns,
          savedFolders,
          savedActiveFolder,
          savedSelectedMockup,
          savedActiveDesignFolder,
          savedGeneratedMockups,
        ] = await Promise.all([
          get<boolean>(keys.HAS_INITIALIZED),
          get<MockupItem[]>(keys.MOCKUPS),
          get<DesignItem[]>(keys.DESIGNS),
          get<MockupFolder[]>(keys.FOLDERS),
          get<string | null>(keys.ACTIVE_FOLDER),
          get<string | null>(keys.SELECTED_MOCKUP),
          get<string | null>(keys.ACTIVE_DESIGN_FOLDER),
          get<RenderedMatch[] | null>(keys.ETSY_GENERATED_MOCKUPS),
        ]);

        if (isMounted && (hasInit || (savedMockups && savedMockups.length > 0) || (savedDesigns && savedDesigns.length > 0))) {
          setMockups(savedMockups || []);
          setDesigns(savedDesigns || []);
          setFolders(savedFolders || []);
          setActiveFolderId(savedActiveFolder ?? null);
          setSelectedMockupId(savedSelectedMockup ?? (savedMockups?.[0]?.id || null));
          setActiveDesignFolderId(savedActiveDesignFolder ?? null);
          if (savedGeneratedMockups && savedGeneratedMockups.length > 0) {
            setRenderedMatches(savedGeneratedMockups);
            setHasGenerated(true);
          }
          setIsInitialized(true);
        }
      } catch (err) {
        console.warn('[Workspace] Local cache hydration note:', err);
      }

      // Phase 2: Authoritative load / sync from cloud
      try {
        const data = await loadAppData();
        if (!isMounted) return;

        setMockups(data.mockups || []);
        setDesigns(data.designs || []);
        setFolders(data.folders || []);
        setActiveFolderId(data.activeFolderId || null);
        setSelectedMockupId(data.selectedMockupId || null);
        setActiveDesignFolderId(data.activeDesignFolderId || null);
        if (data.etsyGeneratedMockups && data.etsyGeneratedMockups.length > 0) {
          setRenderedMatches(data.etsyGeneratedMockups);
          setHasGenerated(true);
        }
        setInitializationError(null);
        setIsInitialized(true);
      } catch (error) {
        console.error('[Workspace] Initial data load failed:', error instanceof Error ? error.message : 'unknown error');
        if (!isMounted) return;
        setIsInitialized(true);
      }
    }

    initializeWorkspace();
    return () => { isMounted = false; };
  }, [initializationAttempt, user?.id]);

  // Auto-save data
  useEffect(() => {
    if (!isInitialized) return;
    if (isFirstRenderAfterInit.current) {
      isFirstRenderAfterInit.current = false;
      return;
    }
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (syncedFromServerRef.current) {
      syncedFromServerRef.current = false;
      setIsSaving(false);
      return;
    }

    setIsSaving(true);
    saveTimeoutRef.current = setTimeout(async () => {
      const result = await saveAppData({
        mockups,
        designs,
        folders,
        activeFolderId,
        selectedMockupId,
        etsyGeneratedMockups: renderedMatches,
      }, lastSyncTimestampRef.current);

      if (result.conflict) {
        lastSyncTimestampRef.current = 0;
      } else if (result.success && result.timestamp) {
        lastSyncTimestampRef.current = result.timestamp;
      }
      setIsSaving(false);
    }, 400);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [mockups, designs, folders, activeFolderId, selectedMockupId, renderedMatches, isInitialized]);

  // Auto-save UI state locally
  useEffect(() => {
    if (!isInitialized) return;
    const uiSaveTimer = setTimeout(() => {
      saveUIStateToIndexedDB(activeFolderId, selectedMockupId, activeDesignFolderId).catch(console.error);
    }, 200);
    return () => clearTimeout(uiSaveTimer);
  }, [activeFolderId, selectedMockupId, activeDesignFolderId, isInitialized]);

  // Sync with server
  useEffect(() => {
    if (!isInitialized || !user) return;
    const interval = setInterval(async () => {
      if (isSyncFetchingRef.current || document.visibilityState === 'hidden') return;
      try {
        const res = await fetch(`/api/storage/version?userId=${user.id}`);
        if (!res.ok) return;
        const { updatedAt } = await res.json();
        if (!updatedAt) return;
        if (updatedAt > lastSyncTimestampRef.current + TIMING.SYNC_CLOCK_DRIFT_MS) {
          isSyncFetchingRef.current = true;
          const dataRes = await fetch(`/api/storage?userId=${user.id}`);
          if (dataRes.ok) {
            const serverData = await dataRes.json();
            if (serverData && Array.isArray(serverData.mockups)) {
              const isServerEmpty = (serverData.mockups?.length || 0) === 0 && (serverData.designs?.length || 0) === 0;
              if (isServerEmpty && (mockups.length > 0 || designs.length > 0)) {
                // Do not overwrite non-empty local workspace with an empty server state during background sync
                isSyncFetchingRef.current = false;
                return;
              }
              syncedFromServerRef.current = true;
              setMockups(serverData.mockups || []);
              setDesigns(serverData.designs || []);
              setFolders(serverData.folders || []);
              lastSyncTimestampRef.current = updatedAt;
              await updateLocalCache(serverData);
            }
          }
          isSyncFetchingRef.current = false;
        }
      } catch {
        isSyncFetchingRef.current = false;
      }
    }, TIMING.SYNC_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isInitialized, user]);

  return {
    folders, setFolders,
    activeFolderId, setActiveFolderId,
    mockups, setMockups,
    designs, setDesigns,
    selectedMockupId, setSelectedMockupId,
    activeDesignFolderId, setActiveDesignFolderId,
    renderedMatches, setRenderedMatches,
    hasGenerated, setHasGenerated,
    isInitialized, setIsInitialized,
    initializationError,
    retryInitialization: () => setInitializationAttempt((attempt) => attempt + 1),
    isSaving, setIsSaving,
    isBackupProcessing, setIsBackupProcessing,
    isGuestInfoDismissed, setIsGuestInfoDismissed,
    isEmptyWorkspaceDismissed, setIsEmptyWorkspaceDismissed,
    isPwaInfoDismissed, setIsPwaInfoDismissed,
    isPwaInstalled, setIsPwaInstalled,
    syncStatus,
    isSyncing: syncStatus.isSyncing,
    isMigrating: syncStatus.isMigrating,
    syncMessage: syncStatus.message,
    syncProgress: syncStatus.progress,
  };
}
