import { useState, useEffect, useRef, useCallback } from 'react';
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
  subscribeSaveStatus,
  getSaveStatus,
  SaveStatus,
  getKnownServerVersion,
  setKnownServerVersion,
  forceSyncFromServer,
  countLocalOnlyMedia,
  promoteTemporaryMediaUrls,
  subscribeRemoteWorkspace,
} from '@/lib/storage-service';
import { get } from 'idb-keyval';
import { mergeWorkspaceChanges } from '@/lib/workspace-merge';
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
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(getSaveStatus);
  /** Sunucuda daha yeni bir sürüm var; kullanıcı karar verene kadar buluta yazılmaz. */
  const [hasSaveConflict, setHasSaveConflict] = useState(false);

  useEffect(() => subscribeSaveStatus(setSaveStatus), []);

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

  const isSyncFetchingRef = useRef<boolean>(false);
  const isFirstRenderAfterInit = useRef<boolean>(true);
  /** Sunucudan/önbellekten yüklenen son koleksiyonlar: bunlar değişmediyse tekrar kaydetmeye gerek yok. */
  const loadedSnapshotRef = useRef<{ mockups: MockupItem[]; designs: DesignItem[]; folders: MockupFolder[] } | null>(null);
  /** Sunucuyla en son eşit olduğu bilinen koleksiyonlar: çakışmada üç yönlü birleştirmenin tabanı. */
  const syncedBaseRef = useRef<{ mockups: MockupItem[]; designs: DesignItem[]; folders: MockupFolder[] } | null>(null);
  /** Henüz sunucuya ulaşmamış yerel değişiklik var mı (zamanlanmış ya da süren kayıt)? */
  const hasPendingSaveRef = useRef<boolean>(false);
  const isSaveInFlightRef = useRef<boolean>(false);
  const needsRetryRef = useRef<boolean>(false);
  const hasSaveConflictRef = useRef<boolean>(false);
  /** Buluta taşınması denenmiş ama başarısız olmuş yerel (data:) görseller; her kayıtta tekrar denenmez. */
  const failedPromotionsRef = useRef<Set<string>>(new Set());
  const latestRef = useRef({ mockups, designs, folders, activeFolderId, selectedMockupId });
  useEffect(() => {
    latestRef.current = { mockups, designs, folders, activeFolderId, selectedMockupId };
  });

  /** Sunucudan gelen veriyi, otomatik kaydı tetiklemeden state'e uygular. */
  const applyLoadedCollections = useCallback((data: { mockups?: MockupItem[]; designs?: DesignItem[]; folders?: MockupFolder[] }) => {
    const snapshot = {
      mockups: data.mockups || [],
      designs: data.designs || [],
      folders: data.folders || [],
    };
    loadedSnapshotRef.current = snapshot;
    syncedBaseRef.current = snapshot;
    setMockups(snapshot.mockups);
    setDesigns(snapshot.designs);
    setFolders(snapshot.folders);
  }, []);

  /**
   * Sunucudaki daha yeni çalışma alanını bu cihazdaki kaydedilmemiş değişikliklerle birleştirir.
   * Otomasyonun eklediği tasarım ile kullanıcının mockup düzenlemesi gibi farklı öğelere dokunan
   * değişiklikler kullanıcıya sorulmadan birleşir; aynı öğede bu cihazdaki düzenleme kazanır.
   */
  const mergeRemoteIntoLocal = useCallback((server: { mockups?: MockupItem[]; designs?: DesignItem[]; folders?: MockupFolder[] }) => {
    const remote = { mockups: server.mockups || [], designs: server.designs || [], folders: server.folders || [] };
    const local = latestRef.current;
    const base = syncedBaseRef.current ?? remote;
    const merged = mergeWorkspaceChanges(base, local, remote);
    syncedBaseRef.current = remote;
    loadedSnapshotRef.current = null;
    // Yeni dizi kimlikleri otomatik kaydı tetikler; birleşmiş sürüm güncel sunucu sürümüyle kaydedilir.
    setMockups(merged.mockups);
    setDesigns(merged.designs);
    setFolders(merged.folders);
  }, []);

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
        ] = await Promise.all([
          get<boolean>(keys.HAS_INITIALIZED),
          get<MockupItem[]>(keys.MOCKUPS),
          get<DesignItem[]>(keys.DESIGNS),
          get<MockupFolder[]>(keys.FOLDERS),
          get<string | null>(keys.ACTIVE_FOLDER),
          get<string | null>(keys.SELECTED_MOCKUP),
          get<string | null>(keys.ACTIVE_DESIGN_FOLDER),
        ]);

        if (isMounted && (hasInit || (savedMockups && savedMockups.length > 0) || (savedDesigns && savedDesigns.length > 0))) {
          applyLoadedCollections({ mockups: savedMockups, designs: savedDesigns, folders: savedFolders });
          setActiveFolderId(savedActiveFolder ?? null);
          setSelectedMockupId(savedSelectedMockup ?? (savedMockups?.[0]?.id || null));
          setActiveDesignFolderId(savedActiveDesignFolder ?? null);
          setIsInitialized(true);
        }
      } catch (err) {
        console.warn('[Workspace] Local cache hydration note:', err);
      }

      // Phase 2: Authoritative load / sync from cloud
      try {
        const data = await loadAppData();
        if (!isMounted) return;

        applyLoadedCollections(data);
        setActiveFolderId(data.activeFolderId || null);
        setSelectedMockupId(data.selectedMockupId || null);
        setActiveDesignFolderId(data.activeDesignFolderId || null);
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
  }, [initializationAttempt, user?.id, applyLoadedCollections]);

  /** Güncel koleksiyonları kaydeder (yerel önbellek + bulut). Çakışma varken yalnızca yerel önbelleğe yazar. */
  const persistNow = useCallback(async () => {
    const current = latestRef.current;
    const payload = {
      mockups: current.mockups,
      designs: current.designs,
      folders: current.folders,
      activeFolderId: current.activeFolderId,
      selectedMockupId: current.selectedMockupId,
    };

    if (hasSaveConflictRef.current) {
      await updateLocalCache(payload).catch(() => {});
      hasPendingSaveRef.current = false;
      setIsSaving(false);
      return;
    }

    isSaveInFlightRef.current = true;

    // Oturum açıkken tarayıcıda kalmış (data:) görselleri önce kalıcı depolamaya taşı. Aksi halde
    // çalışma alanı bulut sınırını aşar ve hiçbir değişiklik kaydedilemez.
    if (user && countLocalOnlyMedia(payload) > 0) {
      const pending = {
        ...payload,
        mockups: payload.mockups.filter((m) => !failedPromotionsRef.current.has(m.src)),
        designs: payload.designs.filter((d) => !failedPromotionsRef.current.has(d.src)),
      };
      if (countLocalOnlyMedia(pending) > 0) {
        const promoted = await promoteTemporaryMediaUrls(pending);
        const replacements = new Map<string, string>();
        [...pending.mockups, ...pending.designs].forEach((item, index) => {
          const next = index < pending.mockups.length ? promoted.payload.mockups[index] : promoted.payload.designs[index - pending.mockups.length];
          if (item.src.startsWith('data:')) {
            if (next && next.src !== item.src) replacements.set(item.src, next.src);
            else failedPromotionsRef.current.add(item.src);
          }
        });
        if (replacements.size > 0) {
          isSaveInFlightRef.current = false;
          // State güncellemesi yeni bir otomatik kaydı tetikler; o kayıt kalıcı URL'lerle yapılır.
          setMockups((prev) => prev.map((m) => (replacements.has(m.src) ? { ...m, src: replacements.get(m.src)! } : m)));
          setDesigns((prev) => prev.map((d) => (replacements.has(d.src) ? { ...d, src: replacements.get(d.src)! } : d)));
          return;
        }
      }
    }

    const result = await saveAppData(payload);
    isSaveInFlightRef.current = false;
    if (result.success) {
      syncedBaseRef.current = { mockups: payload.mockups, designs: payload.designs, folders: payload.folders };
    }

    // Çakışma: sunucudaki yeni sürüm alınıp bu cihazdaki değişikliklerle birleştirilir ve yeniden kaydedilir.
    // Yalnızca sunucu okunamazsa kullanıcıya sorulur.
    if (result.conflict && !hasSaveConflictRef.current) {
      const serverData = await fetch('/api/storage', { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null);
      if (serverData && Array.isArray(serverData.mockups)) {
        setKnownServerVersion(typeof serverData.updatedAt === 'number' ? serverData.updatedAt : null);
        mergeRemoteIntoLocal(serverData);
        setIsSaving(false);
        return;
      }
    }

    // Kayıt sürerken yeni bir değişiklik zamanlandıysa bekleyen durumu o kayıt temizler.
    if (!saveTimeoutRef.current) hasPendingSaveRef.current = false;
    needsRetryRef.current = !result.success && (result.reason === 'network' || result.reason === 'server');
    if (result.conflict) {
      hasSaveConflictRef.current = true;
      setHasSaveConflict(true);
    }
    setIsSaving(false);
  }, [user, mergeRemoteIntoLocal]);

  // Auto-save data. Yalnızca çalışma alanı verisi değişince çalışır; klasör/mockup seçimi gibi
  // arayüz durumları aşağıdaki ayrı efektle yalnızca bu cihaza kaydedilir.
  useEffect(() => {
    if (!isInitialized) return;
    if (isFirstRenderAfterInit.current) {
      isFirstRenderAfterInit.current = false;
      return;
    }
    const snapshot = loadedSnapshotRef.current;
    if (snapshot && snapshot.mockups === mockups && snapshot.designs === designs && snapshot.folders === folders) {
      // Sunucudan/önbellekten yeni yüklenen veri: geri yazmaya gerek yok. Önceki çalıştırmanın
      // zamanlanmış kaydı React temizliğinde iptal edildiği için bekleyen durum da sıfırlanır.
      hasPendingSaveRef.current = false;
      setIsSaving(false);
      return;
    }
    loadedSnapshotRef.current = null;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    hasPendingSaveRef.current = true;
    setIsSaving(true);
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      void persistNow();
    }, TIMING.SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [mockups, designs, folders, isInitialized, persistNow]);

  // Ağ/sunucu hatasıyla kaydedilemeyen değişiklikleri bağlantı gelince veya periyodik olarak yeniden dene.
  useEffect(() => {
    if (!isInitialized) return;
    const retry = () => {
      if (needsRetryRef.current && !isSaveInFlightRef.current && !saveTimeoutRef.current) {
        void persistNow();
      }
    };
    const interval = window.setInterval(retry, 30_000);
    window.addEventListener('online', retry);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('online', retry);
    };
  }, [isInitialized, persistNow]);

  // Kaydedilmemiş değişiklik varken sayfayı kapatmaya karşı uyar.
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasPendingSaveRef.current && !needsRetryRef.current && !hasSaveConflictRef.current) return;
      e.preventDefault();
      e.returnValue = 'Kaydedilmemiş değişiklikleriniz var.';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  /**
   * Çakışmayı çözer. 'server': buluttaki sürümü yükler (bu cihazdaki kaydedilmemiş değişiklikler atılır).
   * 'local': bu cihazdaki sürümü buluttakinin üzerine kaydeder.
   */
  const resolveSaveConflict = useCallback(async (choice: 'server' | 'local') => {
    if (choice === 'server') {
      const data = await forceSyncFromServer();
      if (!data) return false;
      hasSaveConflictRef.current = false;
      setHasSaveConflict(false);
      needsRetryRef.current = false;
      hasPendingSaveRef.current = false;
      applyLoadedCollections(data);
      return true;
    }

    const res = await fetch('/api/storage/version', { cache: 'no-store' }).catch(() => null);
    if (!res?.ok) return false;
    const { updatedAt } = await res.json();
    setKnownServerVersion(typeof updatedAt === 'number' ? updatedAt : null);
    hasSaveConflictRef.current = false;
    setHasSaveConflict(false);
    await persistNow();
    return !hasSaveConflictRef.current;
  }, [applyLoadedCollections, persistNow]);

  // Auto-save UI state locally
  useEffect(() => {
    if (!isInitialized) return;
    const uiSaveTimer = setTimeout(() => {
      saveUIStateToIndexedDB(activeFolderId, selectedMockupId, activeDesignFolderId).catch(console.error);
    }, 200);
    return () => clearTimeout(uiSaveTimer);
  }, [activeFolderId, selectedMockupId, activeDesignFolderId, isInitialized]);

  // Başka bir bileşen sunucudan daha yeni veri okuduysa: bekleyen yerel değişiklik yoksa uygula,
  // varsa kullanıcıya hangi sürümün korunacağını sor.
  useEffect(() => {
    if (!isInitialized) return;
    return subscribeRemoteWorkspace((payload) => {
      if (hasPendingSaveRef.current || isSaveInFlightRef.current) {
        mergeRemoteIntoLocal(payload);
        return;
      }
      applyLoadedCollections(payload);
    });
  }, [isInitialized, applyLoadedCollections, mergeRemoteIntoLocal]);

  // Sync with server: başka cihaz/sekmedeki değişiklikleri al. Bekleyen yerel değişiklik varken
  // sunucu verisi uygulanmaz (aksi halde kullanıcının son düzenlemesi silinir).
  useEffect(() => {
    if (!isInitialized || !user) return;
    let lastCheckAt = 0;
    const checkRemote = async () => {
      if (isSyncFetchingRef.current || document.visibilityState === 'hidden') return;
      lastCheckAt = Date.now();
      if (hasPendingSaveRef.current || isSaveInFlightRef.current || hasSaveConflictRef.current) return;
      try {
        const res = await fetch('/api/storage/version', { cache: 'no-store' });
        if (!res.ok) return;
        const { updatedAt } = await res.json();
        if (!updatedAt) return;
        if (updatedAt > getKnownServerVersion() + TIMING.SYNC_CLOCK_DRIFT_MS) {
          isSyncFetchingRef.current = true;
          const dataRes = await fetch('/api/storage', { cache: 'no-store' });
          if (dataRes.ok) {
            const serverData = await dataRes.json();
            // İstek sürerken kullanıcı bir şey değiştirdiyse sunucu verisini uygulama.
            if (serverData && Array.isArray(serverData.mockups) && !hasPendingSaveRef.current && !isSaveInFlightRef.current) {
              const local = latestRef.current;
              const isServerEmpty = (serverData.mockups?.length || 0) === 0 && (serverData.designs?.length || 0) === 0;
              if (!(isServerEmpty && (local.mockups.length > 0 || local.designs.length > 0))) {
                setKnownServerVersion(typeof serverData.updatedAt === 'number' ? serverData.updatedAt : updatedAt);
                applyLoadedCollections(serverData);
                await updateLocalCache({
                  ...serverData,
                  activeFolderId: local.activeFolderId,
                  selectedMockupId: local.selectedMockupId,
                });
              }
            }
          }
          isSyncFetchingRef.current = false;
        }
      } catch {
        isSyncFetchingRef.current = false;
      }
    };
    // Seyrek yoklama + sekmeye/pencereye dönüldüğünde anında kontrol: başka cihazdaki değişiklik
    // kullanıcı geri geldiğinde hemen görünür, arka planda ise sunucuya gereksiz sorgu gitmez.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastCheckAt > TIMING.SYNC_FOCUS_MIN_GAP_MS) void checkRemote();
    };
    const interval = setInterval(checkRemote, TIMING.SYNC_POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [isInitialized, user, applyLoadedCollections]);

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
    saveStatus,
    hasSaveConflict,
    resolveSaveConflict,
    retrySave: persistNow,
    isSyncing: syncStatus.isSyncing,
    isMigrating: syncStatus.isMigrating,
    syncMessage: syncStatus.message,
    syncProgress: syncStatus.progress,
  };
}
