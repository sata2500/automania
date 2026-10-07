'use client';

import { getErrorMessage } from '@/lib/errors';
import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Zap,
  Cpu,
  Database,
  Trash2,
  FolderTree,
  Server,
  LayoutDashboard,
  Users,
  Settings,
  Lock,
} from 'lucide-react';
import { useToast } from '@/components/common/ToastContext';
import { useAuth } from '@/components/common/UserAuthContext';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import KeywordPoolManagement from './KeywordPoolManagement';
import TaxonomyManagement from './TaxonomyManagement';
import { AdminSettingsSection } from './AdminSettingsSection';
import { AdminAiSettingsSection } from './AdminAiSettingsSection';
import { AdminOverviewSection, type AdminGlobalStats } from './AdminOverviewSection';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

type AdminSubTab = 'overview' | 'ai' | 'keywords' | 'taxonomy' | 'users' | 'settings';

export const AdminDashboard: React.FC = () => {
  const toast = useToast();
  const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean; title: string; message: string; action: (() => void) | null}>({ isOpen: false, title: '', message: '', action: null });

  // Active Sub Tab state
  const [activeSubTab, setActiveSubTab] = useState<AdminSubTab>('overview');

  const [globalStats, setGlobalStats] = useState<AdminGlobalStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [sampleStats, setSampleStats] = useState<{ mockupsCount: number; designsCount: number; foldersCount: number } | null>(null);
  const [isUpdatingSampleData, setIsUpdatingSampleData] = useState(false);
  const [storageDiagnostics, setStorageDiagnostics] = useState<{
    records?: { mockups?: number; designs?: number; generatedMockups?: number; durable?: number; temporary?: number; other?: number; missing?: number };
    referencedR2Objects?: number;
    r2?: { objectCount?: number; totalBytes?: number; orphanObjectCount?: number | null; missingReferencedObjectCount?: number | null };
  } | null>(null);
  const [isCheckingStorage, setIsCheckingStorage] = useState(false);

  const fetchGlobalStats = async (showToast: boolean = false) => {
    setIsLoadingStats(true);
    try {
      const res = await fetch(`/api/admin/stats?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store' }
      });
      const data = await res.json();
      if (data.success && data.stats) {
        setGlobalStats(data.stats);
        if (showToast) {
          toast.success(`İstatistikler güncellendi: ${data.stats.assets.mockups} Mockup, ${data.stats.assets.designs} Tasarım, ${data.stats.storage.blobCount} R2 Dosyası.`);
        }
      } else {
        if (showToast) {
          toast.error(data.message || data.error || 'İstatistikler alınamadı.');
        }
      }
    } catch {
      if (showToast) {
        toast.error('İstatistikler yüklenirken bağlantı hatası oluştu.');
      }
    } finally {
      setIsLoadingStats(false);
    }
  };

  const handleCheckStorage = async () => {
    setIsCheckingStorage(true);
    try {
      const res = await fetch(`/api/admin/storage/diagnostics?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store' },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Storage diagnostics failed');
      }
      setStorageDiagnostics(data);
      toast.success('Depolama kayıtları doğrulandı; hiçbir dosya silinmedi.');
    } catch {
      toast.error('Depolama kayıtları doğrulanamadı.');
    } finally {
      setIsCheckingStorage(false);
    }
  };

  const fetchSampleStats = async () => {
    try {
      const res = await fetch(`/api/admin/sample-data?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      const data = await res.json();
      if (data.success && data.stats) {
        setSampleStats(data.stats);
      }
    } catch {}
  };

  useEffect(() => {
    if (activeSubTab === 'overview' || activeSubTab === 'settings') {
      fetchGlobalStats();
      fetchSampleStats();
    }
  }, [activeSubTab]);

  useEffect(() => {
    try {
      const savedTab = localStorage.getItem('automania_admin_subtab_v1') as AdminSubTab;
      if (savedTab && ['overview', 'ai', 'keywords', 'taxonomy', 'users', 'settings'].includes(savedTab)) {
        setActiveSubTab(savedTab);
      }
    } catch {}
  }, []);

  const handleSubTabChange = (tab: AdminSubTab) => {
    setActiveSubTab(tab);
    try {
      localStorage.setItem('automania_admin_subtab_v1', tab);
    } catch {}
  };

  const [isTestingDb, setIsTestingDb] = useState(false);
  const [dbHealthResult, setDbHealthResult] = useState<{ ok: boolean; latencyMs: number } | null>(null);

  const handleTestDatabaseHealth = async () => {
    setIsTestingDb(true);
    setDbHealthResult(null);
    const start = Date.now();
    try {
      const res = await fetch('/api/admin/health');
      const latencyMs = Date.now() - start;
      if (res.ok) {
        setDbHealthResult({ ok: true, latencyMs });
        toast.success(`PostgreSQL Veritabanı Bağlantısı Başarılı & Sağlıklı! (${latencyMs}ms)`);
      } else {
        setDbHealthResult({ ok: false, latencyMs });
        toast.error('Veritabanı sunucusuna erişilemedi.');
      }
    } catch {
      toast.error('Veritabanı bağlantı testi sırasında hata oluştu.');
    } finally {
      setIsTestingDb(false);
    }
  };

  const handlePurgeSystemJunkData = async () => {
    setConfirmConfig({
      isOpen: true,
      title: 'Sistem Verilerini Temizle',
      message: 'Bu işlem, veritabanında karşılığı olmayan veya kullanılmayan tüm çöp (yetim) görselleri Cloudflare R2 / Depolama alanından tamamen silecektir.\n\nSistemdeki hazır örnek taslaklar ve kullanıcıların aktif mockupları KORUNACAKTIR. Devam etmek istiyor musunuz?',
      action: async () => {
        try {
          const res = await fetch('/api/admin/clean-blobs', { method: 'POST' });
          if (res.ok) {
            const data = await res.json();
            toast.success(data.message || 'Çöp görseller depolama alanından temizlendi.');
            fetchGlobalStats(); // Update dashboard stats after cleaning
          } else {
            toast.error('Depolama temizleme işlemi başarısız oldu.');
          }
        } catch {
          toast.error('Sistem temizleme sırasında bir hata oluştu.');
        }
      }
    });
  };

  const handleSetMyWorkspaceAsSampleData = () => {
    setConfirmConfig({
      isOpen: true,
      title: 'Çalışma Alanını Genel Örnek Taslak Olarak Ata',
      message: 'Mevcut yönetici çalışma alanınızdaki tüm klasörler, mockup\'lar ve tasarımlar, sistem genelindeki tüm kullanıcılar için varsayılan "Örnek Taslak" şablonu olarak atanacaktır. Eski örnek veriler tamamen bu yeni verilerle güncellenecektir. Onaylıyor musunuz?',
      action: async () => {
        setIsUpdatingSampleData(true);
        try {
          const res = await fetch('/api/admin/sample-data', { method: 'POST' });
          const data = await res.json();
          if (data.success) {
            toast.success(data.message || 'Örnek taslak başarıyla güncellendi!');
            if (data.stats) setSampleStats(data.stats);
          } else {
            toast.error(data.error || 'Örnek taslak güncellenirken hata oluştu.');
          }
        } catch (e) {
          toast.error('İşlem sırasında bir hata oluştu: ' + (getErrorMessage(e) || 'Bilinmeyen hata'));
        } finally {
          setIsUpdatingSampleData(false);
        }
      }
    });
  };

  const handleResetSampleData = () => {
    setConfirmConfig({
      isOpen: true,
      title: 'Örnek Taslak Verilerini Sıfırla',
      message: 'Sistem genelindeki örnek taslak şablonu tamamen boşaltılacaktır. Bu işlem geri alınamaz. Devam etmek istiyor musunuz?',
      action: async () => {
        setIsUpdatingSampleData(true);
        try {
          const res = await fetch('/api/admin/sample-data', { method: 'DELETE' });
          const data = await res.json();
          if (data.success) {
            toast.success(data.message || 'Örnek taslak sıfırlandı.');
            setSampleStats(data.stats || { mockupsCount: 0, designsCount: 0, foldersCount: 0 });
          } else {
            toast.error(data.error || 'Sıfırlama sırasında hata oluştu.');
          }
        } catch (e) {
          toast.error('Hata: ' + getErrorMessage(e));
        } finally {
          setIsUpdatingSampleData(false);
        }
      }
    });
  };



  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* Top Banner & Header Section - Soft Light-Friendly Styling */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-7 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
            <div className="shrink-0 p-2.5 sm:p-3.5 bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 rounded-2xl border border-indigo-100 dark:border-indigo-800 shadow-sm">
              <ShieldCheck className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <h1 className="text-lg sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Yönetici Kumanda Merkezi
                </h1>
                <span className="px-2.5 py-0.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[10px] font-extrabold rounded-full uppercase tracking-wider whitespace-nowrap">
                  Admin Privileged
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-xl">
                Uygulamanızın tüm modüllerini yönetin, OpenRouter Yapay Zeka ayarlarını yapın ve veritabanı durumunu denetleyin.
              </p>
            </div>
          </div>

          {/* Quick System Indicators */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 px-3.5 py-2 rounded-2xl text-xs font-semibold">
              <Server className="w-4 h-4 text-emerald-500" />
              <span className="text-slate-600 dark:text-slate-300">PostgreSQL:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">Aktif</span>
            </div>

            <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 px-3.5 py-2 rounded-2xl text-xs font-semibold">
              <Zap className="w-4 h-4 text-amber-500" />
              <span className="text-slate-600 dark:text-slate-300">OpenRouter:</span>
              <span className="font-extrabold text-indigo-600 dark:text-amber-300">
                Sunucuda Tanımlı
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs Bar Inside Admin Panel */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => handleSubTabChange('overview')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'overview'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>1. Genel Özet</span>
          </button>

          <button
            onClick={() => handleSubTabChange('ai')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'ai'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Cpu className="w-4 h-4 text-amber-400" />
            <span>2. Yapay Zeka &amp; OpenRouter</span>
          </button>

          <button
            onClick={() => handleSubTabChange('keywords')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'keywords'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Database className="w-4 h-4 text-pink-400" />
            <span>3. Kelime Havuzu</span>
          </button>

          <button
            onClick={() => handleSubTabChange('taxonomy')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'taxonomy'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <FolderTree className="w-4 h-4 text-teal-400" />
            <span>4. Etsy Kategorileri</span>
          </button>

          <button
            onClick={() => handleSubTabChange('users')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'users'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Users className="w-4 h-4 text-emerald-400" />
            <span>5. Kullanıcı Yönetimi</span>
          </button>

          <button
            onClick={() => handleSubTabChange('settings')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'settings'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>6. Uygulama Ayarları &amp; Bakım</span>
          </button>
        </div>
      </div>

      {/* SUB TAB 1: OVERVIEW & METRICS */}
      {activeSubTab === 'overview' && (
        <AdminOverviewSection
          globalStats={globalStats}
          isLoadingStats={isLoadingStats}
          onRefresh={() => { fetchGlobalStats(true); fetchSampleStats(); }}
        />
      )}

      {/* SUB TAB 2: AI & OPENROUTER CENTER */}
      {activeSubTab === 'ai' && <AdminAiSettingsSection />}

      {/* SUB TAB 3: KEYWORDS */}
      {activeSubTab === 'keywords' && (
        <div className="animate-fadeIn">
          <ErrorBoundary fallbackTitle="Kelime Havuzu Yüklenirken Bir Hata Oluştu">
            <KeywordPoolManagement />
          </ErrorBoundary>
        </div>
      )}

      {/* SUB TAB 4: ETSY TAXONOMY */}
      {activeSubTab === 'taxonomy' && (
        <div className="animate-fadeIn">
          <ErrorBoundary fallbackTitle="Kategori ve Taksonomi Yüklenirken Bir Hata Oluştu">
            <TaxonomyManagement />
          </ErrorBoundary>
        </div>
      )}

      {/* SUB TAB 5: USER MANAGEMENT */}
      {activeSubTab === 'users' && (
        <UserManagementSection />
      )}

      {/* SUB TAB 6: SYSTEM SETTINGS & MAINTENANCE */}
      {activeSubTab === 'settings' && (
        <AdminSettingsSection
          sampleStats={sampleStats}
          isUpdatingSampleData={isUpdatingSampleData}
          onSetMyWorkspaceAsSampleData={handleSetMyWorkspaceAsSampleData}
          onResetSampleData={handleResetSampleData}
          isTestingDb={isTestingDb}
          dbHealthResult={dbHealthResult}
          onTestDatabaseHealth={handleTestDatabaseHealth}
          storageDiagnostics={storageDiagnostics}
          isCheckingStorage={isCheckingStorage}
          onCheckStorage={handleCheckStorage}
          onPurgeSystemJunkData={handlePurgeSystemJunkData}
        />
      )}
      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={() => {
          if (confirmConfig.action) confirmConfig.action();
          setConfirmConfig({ ...confirmConfig, isOpen: false });
        }}
        onCancel={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
      />
    </div>
  );
};


function UserManagementSection() {
  const { userList, updateUserRole, toggleUserBlock, deleteUser } = useAuth();
  const toast = useToast();
  const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean; title: string; message: string; action: (() => void) | null}>({ isOpen: false, title: '', message: '', action: null });

  return (
    <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 space-y-4 sm:space-y-6 shadow-sm animate-fadeIn">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-100 dark:border-emerald-800">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Kullanıcı Yönetimi &amp; Yetkilendirme</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Google hesaplarıyla sisteme giriş yapan tüm kullanıcılar otomatik listelenir. Rol değiştirebilir veya erişimleri engelleyebilirsiniz.
            </p>
          </div>
        </div>

        <div className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-xl border border-emerald-200 dark:border-emerald-800 shrink-0">
          Toplam Kayıtlı: {userList.length} Kullanıcı
        </div>
      </div>

      {/* Users Table */}
      <div className="border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden text-xs">
        <div className="bg-slate-50 dark:bg-slate-950 p-3 font-bold text-slate-500 dark:text-slate-400 hidden sm:grid grid-cols-12 items-center">
          <div className="col-span-4 sm:col-span-4">Kullanıcı &amp; E-Posta</div>
          <div className="col-span-3 sm:col-span-3">Rol Seviyesi</div>
          <div className="col-span-2 sm:col-span-2">Durum</div>
          <div className="col-span-3 sm:col-span-3 text-right">Erişim &amp; İşlemler</div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {userList.map((u) => {
            const isBlocked = u.status === 'blocked';
            return (
              <div key={u.id} className="p-3 sm:grid sm:grid-cols-12 flex flex-col items-start sm:items-center gap-3 sm:gap-2 hover:bg-slate-50/50 dark:hover:bg-slate-950/50 transition-colors">
                {/* User info */}
                <div className="col-span-4 w-full flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 shrink-0 overflow-hidden border border-slate-300 dark:border-slate-700">
                    <img
                      src={u.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(u.email)}`}
                      alt={u.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="truncate">
                    <p className="font-bold text-slate-900 dark:text-white truncate">{u.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono truncate">{u.email}</p>
                  </div>
                </div>

                {/* Role dropdown */}
                <div className="col-span-3 w-full sm:w-auto flex justify-between sm:block items-center">
                  <span className="sm:hidden font-bold text-slate-500">Rol Seviyesi:</span>
                  <select
                    value={u.role}
                    onChange={(e) => {
                      updateUserRole(u.id, e.target.value as 'admin' | 'user');
                      toast.info(`${u.name} rolü "${e.target.value === 'admin' ? 'Admin' : 'Standart Kullanıcı'}" olarak güncellendi.`);
                    }}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer focus:outline-none ${
                      u.role === 'admin'
                        ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <option value="user">Standart Kullanıcı</option>
                    <option value="admin">Yönetici (Admin)</option>
                  </select>
                </div>

                {/* Status Badge */}
                <div className="col-span-2 w-full sm:w-auto flex justify-between sm:block items-center">
                  <span className="sm:hidden font-bold text-slate-500">Erişim Durumu:</span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    isBlocked
                      ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                      : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  }`}>
                    {isBlocked ? 'Engellendi' : 'Aktif'}
                  </span>
                </div>

                {/* Actions */}
                <div className="col-span-3 w-full sm:w-auto flex items-center justify-end space-x-2 pt-2 sm:pt-0 border-t sm:border-0 border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => {
                      toggleUserBlock(u.id);
                      toast.warning(`${u.name} erişim durumu güncellendi.`);
                    }}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                      isBlocked
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span className="sm:hidden md:inline">{isBlocked ? 'Engeli Kaldır' : 'Engelle'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setConfirmConfig({
                        isOpen: true,
                        title: 'Kullanıcıyı Sil',
                        message: `${u.name} kullanıcısı sistemden tamamen silinsin mi?`,
                        action: () => {
                          deleteUser(u.id);
                          toast.info(`${u.name} kullanıcısı silindi.`);
                        }
                      });
                    }}
                    className="p-1.5 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-200 dark:border-rose-800 transition-all cursor-pointer"
                    title="Kullanıcıyı Sil"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={() => {
          if (confirmConfig.action) confirmConfig.action();
          setConfirmConfig({ ...confirmConfig, isOpen: false });
        }}
        onCancel={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
      />
    </div>
  );
}
