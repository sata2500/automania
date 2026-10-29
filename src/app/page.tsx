'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Header, TabKey } from '@/components/common/Header';
import dynamic from 'next/dynamic';
import { AppSplash, TabSkeleton } from '@/components/common/LoadingScreens';
import { LoadingState } from '@/components/common/Spinner';
import { useRouter } from 'next/navigation';
import { openListingsView, type ListingsView } from '@/components/listings/listings-view';
const MockupCanvasEditor = dynamic(() => import('@/components/mockup/MockupCanvasEditor').then(mod => mod.MockupCanvasEditor), { ssr: false, loading: () => <TabSkeleton label="Editör yükleniyor" layout="editor" /> });
const DesignUploader = dynamic(() => import('@/components/design/DesignUploader').then(mod => mod.DesignUploader), { ssr: false, loading: () => <TabSkeleton label="Tasarımlar yükleniyor" layout="grid" /> });
const BatchPreviewGrid = dynamic(() => import('@/components/generator/BatchPreviewGrid').then(mod => mod.BatchPreviewGrid), { ssr: false, loading: () => <TabSkeleton label="Üretim stüdyosu yükleniyor" layout="grid" /> });
const SettingsPanel = dynamic(() => import('@/components/settings/SettingsPanel').then(mod => mod.SettingsPanel), { ssr: false, loading: () => <TabSkeleton label="Ayarlar yükleniyor" layout="list" /> });
const ListingsHub = dynamic(() => import('@/components/listings/ListingsHub').then(mod => mod.ListingsHub), { ssr: false, loading: () => <TabSkeleton label="İlanlar yükleniyor" layout="list" /> });
const TemplatesManager = dynamic(() => import('@/components/templates/TemplatesManager').then(mod => mod.TemplatesManager), { ssr: false, loading: () => <TabSkeleton label="Otomasyon şablonları yükleniyor" layout="list" /> });

import { generateMatchingPairs } from '@/lib/canvas-renderer';
import { OPEN_TAB_EVENT } from '@/lib/app-navigation';
import {
  saveAppData,
  loadSampleAppData,
  clearAllAppData,
  exportAppDataFile,
  parseAppDataBackupFile,
  AppDataPayload,
} from '@/lib/storage-service';
import { useAuth } from '@/components/common/UserAuthContext';
import { AuthModal } from '@/components/common/AuthModal';
import { GuestMigrationBanner } from '@/components/common/GuestMigrationBanner';
import { SyncStatusNotification } from '@/components/common/SyncStatusNotification';
import { SaveStatusBanner } from '@/components/common/SaveStatusBanner';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { GettingStartedChecklist } from '@/components/common/GettingStartedChecklist';
import { STORAGE_KEYS } from '@/config/constants';
import { Sparkles, Info, User, X, LayoutTemplate } from 'lucide-react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/components/common/ToastContext';

const TAB_ORDER: TabKey[] = ['mockups', 'designs', 'generator', 'listings', 'settings'];
/** Eski sürümlerde ayrı olan sekmeler artık İlanlar merkezinin alt görünümleri. */
const LEGACY_TABS: Record<string, ListingsView> = { review: 'review', seo: 'review' };

type GeneratorView = 'manual' | 'templates';
const GENERATOR_VIEWS: { key: GeneratorView; label: string; icon: React.ElementType }[] = [
  { key: 'manual', label: 'Manuel Üretim', icon: Sparkles },
  { key: 'templates', label: 'Otomasyonlar', icon: LayoutTemplate },
];


/**
 * Checks if a touched DOM element is inside an interactive control or horizontally scrollable container
 * (like horizontal folder bar, sliders, inputs, or canvas handles)
 * to prevent accidental page-level tab swipes.
 */
function isInsideScrollableOrInteractive(el: HTMLElement | null): boolean {
  let curr: HTMLElement | null = el;
  while (curr && curr !== document.body) {
    if (
      curr.tagName === 'INPUT' ||
      curr.tagName === 'BUTTON' ||
      curr.tagName === 'SELECT' ||
      curr.tagName === 'TEXTAREA' ||
      curr.classList.contains('cursor-move') ||
      curr.classList.contains('cursor-grab') ||
      curr.classList.contains('cursor-se-resize')
    ) {
      return true;
    }

    if (curr.classList.contains('overflow-x-auto')) {
      return true;
    }

    const style = window.getComputedStyle(curr);
    if ((style.overflowX === 'auto' || style.overflowX === 'scroll') && curr.scrollWidth > curr.clientWidth + 15) {
      return true;
    }

    curr = curr.parentElement;
  }
  return false;
}

const ETSY_ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'Etsy bağlantısı iptal edildi.',
  missing_params: 'Etsy yanıtı eksik geldi. Lütfen bağlantıyı tekrar deneyin.',
  workspace_not_found: 'Çalışma alanınız bulunamadı. Lütfen sayfayı yenileyip tekrar bağlanın.',
  invalid_state: 'Etsy bağlantı oturumu doğrulanamadı (süresi dolmuş olabilir). Lütfen tekrar bağlanın.',
  missing_api_key: 'Etsy API anahtarı yapılandırılmamış. Yöneticinize başvurun.',
  token_exchange_failed: 'Etsy erişim izni alınamadı. Lütfen tekrar deneyin.',
  shop_not_found: 'Etsy hesabınıza bağlı bir mağaza bulunamadı. Etsy\'de mağazanızın açık olduğundan emin olup tekrar bağlanın.',
  internal_error: 'Etsy bağlantısı sırasında beklenmeyen bir hata oluştu.',
};

/** Giriş gerektiren sekmeler: oturum doğrulanırken bekleme, misafire giriş çağrısı gösterir. */
function ProtectedTabPlaceholder({ loading, onLogin }: { loading: boolean; onLogin: () => void }) {
  if (loading) {
    return <LoadingState label="Oturum doğrulanıyor…" />;
  }
  return (
    <div className="max-w-lg mx-auto my-10 p-6 text-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
      <p className="text-sm font-bold text-slate-900 dark:text-white">Bu adım için giriş yapmanız gerekiyor</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">İlan hazırlama ve yönetimi, Etsy mağazanızın bağlı olduğu bir hesap gerektirir. Hazırladığınız taslaklar girişten sonra hesabınıza aktarılır.</p>
      <button type="button" onClick={onLogin} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold">Giriş Yap</button>
    </div>
  );
}

function MainContent() {
  const { user, authStatus, setIsAuthModalOpen } = useAuth();
  const router = useRouter();
  const [activeTabState, setActiveTabState] = useState<TabKey>('mockups');
  const [generatorView, setGeneratorView] = useState<GeneratorView>('manual');

  useEffect(() => {
    const tabTimer = window.setTimeout(() => {
      try {
        const savedTab = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB) ?? '';
        if (LEGACY_TABS[savedTab]) {
          openListingsView(LEGACY_TABS[savedTab]);
          localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, 'listings');
          setActiveTabState('listings');
        } else if (TAB_ORDER.includes(savedTab as TabKey)) {
          setActiveTabState(savedTab as TabKey);
        }
      } catch {}
    }, 0);

    return () => window.clearTimeout(tabTimer);
  }, []);

  // Diğer bileşenlerden sekme geçişi (openAppTab).
  useEffect(() => {
    const onOpen = (event: Event) => {
      const tab = (event as CustomEvent).detail;
      if (!TAB_ORDER.includes(tab as TabKey)) return;
      setActiveTabState(tab as TabKey);
      try { localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, tab); } catch {}
    };
    window.addEventListener(OPEN_TAB_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_TAB_EVENT, onOpen);
  }, []);

  const setActiveTab = (tab: TabKey) => {
    // Prevent guest from navigating to protected tabs
    if (!user && (tab === 'listings' || tab === 'settings')) {
      setIsAuthModalOpen(true);
      return;
    }
    setActiveTabState(tab);
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, tab);
    } catch {}
  };

  // If user is guest and on a protected tab (listings), show mockups — but only once the
  // stored session has been checked; otherwise a signed-in user loses their tab on every reload.
  // The saved tab is kept so it is restored after the user signs in.
  const isProtectedTab = activeTabState === 'listings' || activeTabState === 'settings';
  const activeTab: TabKey = authStatus === 'ready' && !user && isProtectedTab ? 'mockups' : activeTabState;

  const {
    folders, setFolders,
    activeFolderId, setActiveFolderId,
    mockups, setMockups,
    designs, setDesigns,
    selectedMockupId, setSelectedMockupId,
    renderedMatches, setRenderedMatches,
    hasGenerated, setHasGenerated,
    isInitialized,
    initializationError,
    retryInitialization,
    isSaving,
    isBackupProcessing, setIsBackupProcessing,
    isGuestInfoDismissed, setIsGuestInfoDismissed,
    isEmptyWorkspaceDismissed, setIsEmptyWorkspaceDismissed,
    isPwaInfoDismissed, setIsPwaInfoDismissed,
    isPwaInstalled,
    syncStatus,
    isMigrating,
    saveStatus,
    hasSaveConflict,
    resolveSaveConflict,
    retrySave,
  } = useWorkspace();
  const toast = useToast();

  // OAuth dönüş mesajları (Google girişi ve Etsy bağlantısı) — okunur, gösterilir ve adresten temizlenir.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get('auth_error');
    const etsyError = params.get('etsy_error');
    const etsySuccess = params.get('etsy_success');
    if (!authError && !etsyError && !etsySuccess) return;
    if (authError) toast.error(authError, 'Giriş Başarısız');
    if (etsyError) toast.error(ETSY_ERROR_MESSAGES[etsyError] || `Etsy bağlantısı başarısız (${etsyError}).`, 'Etsy Bağlantısı');
    if (etsySuccess) toast.success('Etsy mağazanız başarıyla bağlandı.', 'Etsy Bağlantısı');
    ['auth_error', 'etsy_error', 'etsy_success'].forEach((key) => params.delete(key));
    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
    // Yalnızca ilk açılışta çalışır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const touchStartRef = useRef<{ x: number; y: number; target: EventTarget | null } | null>(null);


  // Handlers for Backup Export / Import / Sample Load / Clear All
  const handleExportBackup = async () => {
    setIsBackupProcessing(true);
    try {
      await exportAppDataFile({
        mockups,
        designs,
        folders,
        activeFolderId,
        selectedMockupId,
      });
      toast.success('Yedek ZIP dosyası başarıyla indirildi.', 'Yedek Alındı');
    } catch (err) {
      console.error('Yedekleme sırasında hata:', err);
      toast.error('Yedekleme işlemi sırasında bir hata oluştu.', 'Yedek Hatası');
    } finally {
      setIsBackupProcessing(false);
    }
  };

  const handleImportBackup = async (file: File) => {
    setIsBackupProcessing(true);
    const toastId = toast.progress('Yedek dosyanız inceleniyor ve veriler yükleniyor, lütfen bekleyin...', 15);
    try {
      const data = await parseAppDataBackupFile(file);
      setMockups(data.mockups);
      setDesigns(data.designs);
      setFolders(data.folders);
      setActiveFolderId(data.activeFolderId);
      setSelectedMockupId(data.selectedMockupId);
      setRenderedMatches(data.etsyGeneratedMockups || []);
      setHasGenerated(Boolean(data.etsyGeneratedMockups && data.etsyGeneratedMockups.length > 0));
      await saveAppData(data);
      toast.removeToast(toastId);
      toast.success('Yedek başarıyla yüklendi ve çalışma alanı güncellendi!', 'Yedek Yüklendi');
    } catch (error: unknown) {
      toast.removeToast(toastId);
      toast.error(error instanceof Error ? error.message : 'Yedek yüklenirken bir hata oluştu.', 'Yükleme Hatası');
    } finally {
      setIsBackupProcessing(false);
    }
  };

  const handleLoadSampleData = async () => {
    try {
      const data = await loadSampleAppData();
      if (data.mockups.length === 0 || data.designs.length === 0) {
        throw new Error('Örnek taslak paketi şu anda kullanılamıyor.');
      }
      setMockups(data.mockups);
      setDesigns(data.designs);
      setFolders(data.folders);
      setActiveFolderId(data.activeFolderId);
      setSelectedMockupId(data.selectedMockupId);
      setRenderedMatches([]);
      setHasGenerated(false);
      toast.success('Örnek taslak başarıyla yüklendi!', 'Taslak Yüklendi');
    } catch (error) {
      console.error('[Workspace] Sample data load failed:', error instanceof Error ? error.message : 'unknown error');
      toast.error(error instanceof Error ? error.message : 'Örnek taslak yüklenirken bir hata oluştu.', 'Hata');
    }
  };

  const handleClearAllData = async () => {
    let data: AppDataPayload;
    try {
      data = await clearAllAppData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Veriler temizlenemedi.', 'Temizleme Başarısız');
      return;
    }
    setMockups(data.mockups);
    setDesigns(data.designs);
    setFolders(data.folders);
    setActiveFolderId(data.activeFolderId);
    setSelectedMockupId(data.selectedMockupId);
    setRenderedMatches([]);
    setHasGenerated(false);
    setIsEmptyWorkspaceDismissed(false);
    toast.success('Tüm veriler başarıyla temizlendi, boş çalışma alanı hazır.', 'Veriler Sıfırlandı');
  };

  const handleMigrateGuestData = (payload: AppDataPayload) => {
    setMockups(payload.mockups || []);
    setDesigns(payload.designs || []);
    setFolders(payload.folders || []);
    setActiveFolderId(payload.activeFolderId || null);
    setSelectedMockupId(payload.selectedMockupId || null);
    if (payload.etsyGeneratedMockups && payload.etsyGeneratedMockups.length > 0) {
      setRenderedMatches(payload.etsyGeneratedMockups);
      setHasGenerated(true);
    }
    toast.success('Misafir taslaklarınız bu hesabınıza başarıyla aktarıldı!', 'Aktarım Tamamlandı');
  };

  const handleDismissGuestBanner = () => {
    setIsGuestInfoDismissed(true);
    try { localStorage.setItem(STORAGE_KEYS.GUEST_BANNER_DISMISSED, 'true'); } catch {}
  };

  const handleDismissPwaBanner = () => {
    setIsPwaInfoDismissed(true);
    try { localStorage.setItem(STORAGE_KEYS.PWA_BANNER_DISMISSED, 'true'); } catch {}
  };

  const handleDismissEmptyWorkspaceBanner = () => {
    setIsEmptyWorkspaceDismissed(true);
    try { localStorage.setItem(STORAGE_KEYS.EMPTY_WORKSPACE_DISMISSED, 'true'); } catch {}
  };

  const matchingPairs = generateMatchingPairs(mockups, designs, activeFolderId);

  // Mobile Touch Swipe Navigation between tabs
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, target: e.target };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || e.changedTouches.length !== 1) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;

    const startTarget = touchStartRef.current.target as HTMLElement | null;
    touchStartRef.current = null;

    if (isInsideScrollableOrInteractive(startTarget)) {
      return;
    }

    if (Math.abs(deltaX) > 80 && Math.abs(deltaX) > Math.abs(deltaY) * 2.5) {
      const allowedTabs = user ? TAB_ORDER : (['mockups', 'designs', 'generator'] as TabKey[]);
      const currentIndex = allowedTabs.indexOf(activeTab);
      if (deltaX < 0 && currentIndex < allowedTabs.length - 1) {
        setActiveTab(allowedTabs[currentIndex + 1]);
      } else if (deltaX > 0 && currentIndex > 0) {
        setActiveTab(allowedTabs[currentIndex - 1]);
      }
    }
  };

  // Rehber, üretimin önkoşulları (mockup, baskı alanı, tasarım, aktif tasarım) tamamlanana kadar görünür.
  const hasProductionPrerequisites =
    mockups.some((m) => !m.isVideo && m.hasPrintArea !== false && (m.printAreas?.length ?? 0) > 0) &&
    designs.some((d) => d.isSelected);
  const showGettingStarted = isInitialized && !isMigrating && !isEmptyWorkspaceDismissed && !hasProductionPrerequisites;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-indigo-500 selection:text-white pb-24 lg:pb-16 transition-colors duration-200"
    >
      {/* Açılış ekranı: çalışma alanı yüklenene kadar (hata olursa hemen kapanır) */}
      <AppSplash visible={!isInitialized && !initializationError} />
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        mockupCount={mockups.length}
        designCount={designs.length}
        matchCount={matchingPairs.length}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-3 sm:pt-6">
        {initializationError && (
          <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100">
            <span>{initializationError}</span>
            <button
              type="button"
              onClick={retryInitialization}
              className="shrink-0 rounded-xl border border-amber-300 px-3 py-1.5 text-xs font-semibold hover:bg-amber-100 dark:border-amber-500/40 dark:hover:bg-amber-900/40"
            >
              Tekrar dene
            </button>
          </div>
        )}

        {/* Bulut kaydı hatası veya başka cihazla sürüm çakışması */}
        {user && (
          <SaveStatusBanner
            saveStatus={saveStatus}
            hasConflict={hasSaveConflict}
            onResolveConflict={resolveSaveConflict}
            onRetry={() => { void retrySave(); }}
          />
        )}

        {/* Guest Data Migration Prompt for Signed-in Users with existing cloud data */}
        {user && (
          <GuestMigrationBanner
            currentMockups={mockups}
            currentDesigns={designs}
            onMigrationComplete={handleMigrateGuestData}
          />
        )}

        {/* Guest User Informational Banner (Dismissible & Remembered) */}
        {authStatus === 'ready' && !user && !isGuestInfoDismissed && !showGettingStarted && (
          <div className="bg-gradient-to-r from-indigo-50 via-white to-purple-50 dark:from-indigo-950/90 dark:via-slate-900/90 dark:to-purple-950/90 border border-indigo-200 dark:border-indigo-500/40 rounded-2xl p-4 sm:p-5 shadow-md dark:shadow-xl text-slate-800 dark:text-slate-100 font-sans mb-4 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fadeIn">
            <div className="flex items-start space-x-3.5 min-w-0">
              <div className="bg-indigo-100 dark:bg-indigo-500/20 p-2.5 rounded-xl border border-indigo-200 dark:border-indigo-500/30 shrink-0 mt-0.5">
                <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="space-y-1 pr-6 md:pr-0">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Çalışmalarınızı Kaydetmek & Tüm Cihazlardan Erişmek İçin Giriş Yapın</span>
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                  Oturum açarak kendi özel mockup&apos;larınızı, tasarımlarınızı ve baskı ayarlarınızı kişisel hesabınıza kaydedebilir ve tüm cihazlarınızdan güvenle erişebilirsiniz. <i>(Giriş yapmadan da örnek taslağımızı yükleyip hemen kullanmaya başlayabilirsiniz.)</i>
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2.5 shrink-0 self-end md:self-center">
              <button
                onClick={handleLoadSampleData}
                className="px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-300 font-semibold text-xs rounded-xl border border-indigo-200 dark:border-indigo-500/30 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Örnek Taslağı Yükle</span>
              </button>
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <User className="w-3.5 h-3.5" />
                <span>Giriş Yap / Kaydol</span>
              </button>
              <button
                onClick={handleDismissGuestBanner}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer ml-1"
                title="Kapat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Başlangıç rehberi: üretimin önkoşulları tamamlanana kadar adım adım yol gösterir. */}
        {showGettingStarted && (
          <GettingStartedChecklist
            mockups={mockups}
            designs={designs}
            hasGenerated={hasGenerated || renderedMatches.length > 0}
            isSignedIn={Boolean(user)}
            onNavigate={setActiveTab}
            onLogin={() => setIsAuthModalOpen(true)}
            onLoadSample={handleLoadSampleData}
            onDismiss={handleDismissEmptyWorkspaceBanner}
          />
        )}

        {/* PWA Installation Banner (Mobile Only) */}
        {!isPwaInstalled && !isPwaInfoDismissed && (
          <div className="md:hidden bg-gradient-to-r from-emerald-50 via-white to-teal-50 dark:from-emerald-950/80 dark:via-slate-900/90 dark:to-teal-950/80 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl p-3 sm:px-4 sm:py-3 shadow-md dark:shadow-lg text-slate-700 dark:text-slate-200 font-sans mb-4 flex items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="bg-emerald-100 dark:bg-emerald-500/20 p-2 rounded-xl border border-emerald-200 dark:border-emerald-500/30 shrink-0">
                <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-900 dark:text-white">Uygulamayı Cihazınıza Yükleyin</span>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 max-w-md leading-relaxed mt-0.5">
                  Tarayıcı menüsünden &quot;Ana Ekrana Ekle&quot; diyerek uygulamayı tam ekran ve daha hızlı açabilirsiniz.
                </p>
              </div>
            </div>
            <div className="flex items-center shrink-0">
              <button
                onClick={handleDismissPwaBanner}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 transition-all cursor-pointer shadow-sm"
                title="Kapat"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Tab Views — her sekme kendi hata sınırında: bir sekmedeki hata tüm uygulamayı düşürmez. */}
        <ErrorBoundary key={activeTab} fallbackTitle="Bu sekme yüklenirken bir sorun oluştu">
          {/* Tab Views */}
          {activeTab === 'mockups' && (
            <MockupCanvasEditor
              mockups={mockups}
              setMockups={setMockups}
              folders={folders}
              setFolders={setFolders}
              selectedMockupId={selectedMockupId}
              setSelectedMockupId={setSelectedMockupId}
              activeFolderId={activeFolderId}
              setActiveFolderId={setActiveFolderId}
            />
          )}

          {activeTab === 'designs' && (
            <DesignUploader 
              designs={designs} 
              setDesigns={setDesigns}
            />
          )}

          {activeTab === 'generator' && user && (
            <div role="tablist" aria-label="Üretim modu" className="flex w-full sm:w-auto sm:inline-flex items-center gap-1 mb-5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60">
              {GENERATOR_VIEWS.map(({ key, label, icon: Icon }) => {
                const isActive = generatorView === key;
                return (
                  <button
                    key={key}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setGeneratorView(key)}
                    className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      isActive
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/25'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {activeTab === 'generator' && user && generatorView === 'templates' && (
            <TemplatesManager mockups={mockups} folders={folders} />
          )}

          {activeTab === 'generator' && (!user || generatorView === 'manual') && (
            <BatchPreviewGrid
              mockups={mockups}
              designs={designs}
              folders={folders}
              activeFolderId={activeFolderId}
              setActiveFolderId={setActiveFolderId}
              renderedMatches={renderedMatches}
              setRenderedMatches={setRenderedMatches}
              hasGenerated={hasGenerated}
              setHasGenerated={setHasGenerated}
              onGoToListings={user ? () => { openListingsView('review'); setActiveTab('listings'); } : undefined}
            />
          )}

          {activeTab === 'listings' && (user ? <ListingsHub /> : <ProtectedTabPlaceholder loading={authStatus === 'loading'} onLogin={() => setIsAuthModalOpen(true)} />)}

          {activeTab === 'settings' && (user ? <SettingsPanel /> : <ProtectedTabPlaceholder loading={authStatus === 'loading'} onLogin={() => setIsAuthModalOpen(true)} />)}
        </ErrorBoundary>



      </main>

      {/* Floating Bottom-Right Migration Progress Notification */}
      <SyncStatusNotification syncStatus={syncStatus} />

      {/* Auth Modal & Profile Management Modal */}
      <AuthModal
        isSaving={isSaving}
        saveStatus={saveStatus}
        isBackupProcessing={isBackupProcessing}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
        onLoadSampleData={handleLoadSampleData}
        onClearAllData={handleClearAllData}
        onNavigateAdmin={() => router.push('/admin')}
      />
    </div>
  );
}

export default function Home() {
  return (
    <MainContent />
  );
}
