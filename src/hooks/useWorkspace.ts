import { useState, useEffect, useRef } from 'react';
import { MockupItem, DesignItem, MockupFolder, RenderedMatch } from '@/types/pod';
import { loadAppData, saveAppData, saveUIStateToIndexedDB, updateLocalCache } from '@/lib/storage-service';
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

  const [isGuestInfoDismissed, setIsGuestInfoDismissed] = useState(() => readStoredBoolean(STORAGE_KEYS.GUEST_BANNER_DISMISSED));
  const [isEmptyWorkspaceDismissed, setIsEmptyWorkspaceDismissed] = useState(() => readStoredBoolean(STORAGE_KEYS.EMPTY_WORKSPACE_DISMISSED));
  const [isPwaInfoDismissed, setIsPwaInfoDismissed] = useState(() => readStoredBoolean(STORAGE_KEYS.PWA_BANNER_DISMISSED));
  const [isPwaInstalled, setIsPwaInstalled] = useState(detectPwaInstalled);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const lastSyncTimestampRef = useRef<number>(0);
  const syncedFromServerRef = useRef<boolean>(false);
  const isSyncFetchingRef = useRef<boolean>(false);
  const isFirstRenderAfterInit = useRef<boolean>(true);

  // Load initial data. Always resolve initialization so a storage failure cannot leave the UI in a permanent loading state.
  useEffect(() => {
    let isMounted = true;
    loadAppData()
      .then((data) => {
        if (!isMounted) return;
        setMockups(data.mockups || []);
        setDesigns(data.designs || []);
        setFolders(data.folders || []);
        setActiveFolderId(data.activeFolderId || null);
        setSelectedMockupId(data.selectedMockupId || null);
        setActiveDesignFolderId(data.activeDesignFolderId || null);
        setInitializationError(null);
        setIsInitialized(true);
      })
      .catch((error) => {
        console.error('[Workspace] Initial data load failed:', error instanceof Error ? error.message : 'unknown error');
        if (!isMounted) return;
        setInitializationError('Çalışma alanı yüklenirken bir hata oluştu. Yerel boş çalışma alanıyla devam edebilirsiniz.');
        setMockups([]);
        setDesigns([]);
        setFolders([]);
        setActiveFolderId(null);
        setSelectedMockupId(null);
        setActiveDesignFolderId(null);
        setIsInitialized(true);
      });
    return () => { isMounted = false; };
  }, [initializationAttempt]);

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
  }, [mockups, designs, folders, activeFolderId, selectedMockupId, isInitialized]);

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
    isPwaInstalled, setIsPwaInstalled
  };
}
