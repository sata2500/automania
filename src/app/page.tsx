'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Header, TabKey } from '@/components/common/Header';
import { MockupCanvasEditor } from '@/components/mockup/MockupCanvasEditor';
import { DesignUploader } from '@/components/design/DesignUploader';
import { BatchPreviewGrid } from '@/components/generator/BatchPreviewGrid';
import { EtsySeoHelper } from '@/components/seo/EtsySeoHelper';
import { MockupItem, DesignItem, MockupFolder, RenderedMatch } from '@/types/pod';
import { generateMatchingPairs } from '@/lib/canvas-renderer';
import {
  loadAppData,
  saveAppData,
  loadSampleAppData,
  clearAllAppData,
  exportAppDataFile,
  parseAppDataBackupFile,
  updateLocalCache,
  saveUIStateToIndexedDB,
} from '@/lib/storage-service';
import { ThemeProvider } from '@/components/common/ThemeProvider';
import { UserAuthProvider, useAuth } from '@/components/common/UserAuthContext';
import { ToastProvider } from '@/components/common/ToastContext';
import { AuthModal } from '@/components/common/AuthModal';
import { STORAGE_KEYS, TIMING } from '@/config/constants';
import { Sparkles, Info, User, X } from 'lucide-react';
import { useWorkspace } from '@/hooks/useWorkspace';

const TAB_ORDER: TabKey[] = ['mockups', 'designs', 'generator', 'seo'];

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

function MainContent() {
  const { user, isAdmin, setIsAuthModalOpen } = useAuth();
  const [activeTabState, setActiveTabState] = useState<TabKey>('mockups');

  useEffect(() => {
    try {
      const savedTab = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB) as TabKey;
      if (savedTab && ['mockups', 'designs', 'generator', 'seo'].includes(savedTab)) {
        setActiveTabState(savedTab);
      }
    } catch {}
  }, []);

  const setActiveTab = (tab: TabKey) => {
    setActiveTabState(tab);
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, tab);
    } catch {}
  };

  const activeTab = activeTabState;

  const {
    folders, setFolders,
    activeFolderId, setActiveFolderId,
    mockups, setMockups,
    designs, setDesigns,
    selectedMockupId, setSelectedMockupId,
    activeDesignFolderId, setActiveDesignFolderId,
    renderedMatches, setRenderedMatches,
    hasGenerated, setHasGenerated,
    isInitialized, setIsInitialized,
    isSaving, setIsSaving,
    isBackupProcessing, setIsBackupProcessing,
    isGuestInfoDismissed, setIsGuestInfoDismissed,
    isEmptyWorkspaceDismissed, setIsEmptyWorkspaceDismissed,
    isPwaInfoDismissed, setIsPwaInfoDismissed,
    isPwaInstalled, setIsPwaInstalled
  } = useWorkspace();

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
    } catch (err) {
      console.error('Yedekleme sırasında hata:', err);
      alert('Yedekleme işlemi sırasında bir hata oluştu.');
    } finally {
      setIsBackupProcessing(false);
    }
  };

  const handleImportBackup = async (file: File) => {
    setIsBackupProcessing(true);
    try {
      const data = await parseAppDataBackupFile(file);
      setMockups(data.mockups);
      setDesigns(data.designs);
      setFolders(data.folders);
      setActiveFolderId(data.activeFolderId);
      setSelectedMockupId(data.selectedMockupId);
      setRenderedMatches([]);
      setHasGenerated(false);
      await saveAppData(data);
      alert('Yedek başarıyla yüklendi!');
    } catch (err: any) {
      alert(err.message || 'Yedek yüklenirken bir hata oluştu.');
    } finally {
      setIsBackupProcessing(false);
    }
  };

  const handleLoadSampleData = async () => {
    const data = await loadSampleAppData();
    setMockups(data.mockups);
    setDesigns(data.designs);
    setFolders(data.folders);
    setActiveFolderId(data.activeFolderId);
    setSelectedMockupId(data.selectedMockupId);
    setRenderedMatches([]);
    setHasGenerated(false);
  };

  const handleClearAllData = async () => {
    const data = await clearAllAppData();
    setMockups(data.mockups);
    setDesigns(data.designs);
    setFolders(data.folders);
    setActiveFolderId(data.activeFolderId);
    setSelectedMockupId(data.selectedMockupId);
    setRenderedMatches([]);
    setHasGenerated(false);
    setIsEmptyWorkspaceDismissed(false);
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
      const currentIndex = TAB_ORDER.indexOf(activeTab);
      if (deltaX < 0 && currentIndex < TAB_ORDER.length - 1) {
        setActiveTab(TAB_ORDER[currentIndex + 1]);
      } else if (deltaX > 0 && currentIndex > 0) {
        setActiveTab(TAB_ORDER[currentIndex - 1]);
      }
    }
  };

  const isEmptyWorkspace = isInitialized && mockups.length === 0 && designs.length === 0;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-indigo-500 selection:text-white pb-24 md:pb-16 transition-colors duration-200"
    >
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
        {/* Guest User Informational Banner (Dismissible & Remembered) */}
        {!user && !isGuestInfoDismissed && (
          <div className="bg-gradient-to-r from-indigo-50 via-white to-purple-50 dark:from-indigo-950/90 dark:via-slate-900/90 dark:to-purple-950/90 border border-indigo-200 dark:border-indigo-500/40 rounded-2xl p-4 sm:p-5 shadow-md dark:shadow-xl text-slate-800 dark:text-slate-100 font-sans mb-4 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fadeIn">
            <div className="flex items-start space-x-3.5 min-w-0">
              <div className="bg-indigo-100 dark:bg-indigo-500/20 p-2.5 rounded-xl border border-indigo-200 dark:border-indigo-500/30 shrink-0 mt-0.5">
                <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="space-y-1 pr-6 md:pr-0">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>☁️ Çalışmalarınızı Kaydetmek & Tüm Cihazlardan Erişmek İçin Giriş Yapın</span>
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                  Oturum açarak kendi özel mockup'larınızı, tasarımlarınızı ve baskı ayarlarınızı kişisel hesabınıza kaydedebilir ve tüm cihazlarınızdan güvenle erişebilirsiniz. <i>(Giriş yapmadan da örnek taslağımızı yükleyip hemen kullanmaya başlayabilirsiniz.)</i>
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

        {/* Compact Empty Workspace Bar (Dismissible) */}
        {isEmptyWorkspace && !isEmptyWorkspaceDismissed && (
          <div className="bg-white dark:bg-slate-900/90 border border-indigo-200 dark:border-indigo-500/30 rounded-2xl p-3 sm:px-4 sm:py-2.5 shadow-md dark:shadow-lg text-slate-700 dark:text-slate-200 font-sans mb-4 flex items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-center space-x-2.5 min-w-0">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">
                Çalışma alanınız boş. Dilerseniz 60 adet hazır mockup ve örnek tasarımı yükleyebilirsiniz:
              </span>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={handleLoadSampleData}
                className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Örnek Taslağı Yükle</span>
              </button>
              <button
                onClick={handleDismissEmptyWorkspaceBanner}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-all cursor-pointer"
                title="Kapat"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
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
                  Tarayıcı menüsünden "Ana Ekrana Ekle" diyerek daha hızlı, tam ekran ve kotasız bir deneyim yaşayabilirsiniz.
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
            folders={folders}
            setFolders={setFolders}
            activeDesignFolderId={activeDesignFolderId}
            setActiveDesignFolderId={setActiveDesignFolderId}
          />
        )}

        {activeTab === 'generator' && (
          <BatchPreviewGrid
            mockups={mockups}
            designs={designs}
            folders={folders}
            activeFolderId={activeFolderId}
            setActiveFolderId={setActiveFolderId}
            activeDesignFolderId={activeDesignFolderId}
            renderedMatches={renderedMatches}
            setRenderedMatches={setRenderedMatches}
            hasGenerated={hasGenerated}
            setHasGenerated={setHasGenerated}
          />
        )}

        {activeTab === 'seo' && <EtsySeoHelper renderedMatches={renderedMatches} />}


      </main>

      {/* Auth Modal & Profile Management Modal */}
      <AuthModal
        isSaving={isSaving}
        isBackupProcessing={isBackupProcessing}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
        onLoadSampleData={handleLoadSampleData}
        onClearAllData={handleClearAllData}
        onNavigateAdmin={() => {
          window.location.href = '/admin';
        }}
      />
    </div>
  );
}

export default function Home() {
  return (
    <MainContent />
  );
}
