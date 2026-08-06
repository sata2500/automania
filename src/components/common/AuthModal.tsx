'use client';

import React, { useRef } from 'react';
import { useAuth } from './UserAuthContext';
import {
  X,
  LogOut,
  User,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Download,
  Upload,
  Sparkles,
  Trash2,
  Database,
} from 'lucide-react';

interface AuthModalProps {
  isSaving?: boolean;
  isBackupProcessing?: boolean;
  onExportBackup?: () => void;
  onImportBackup?: (file: File) => void;
  onLoadSampleData?: () => void;
  onClearAllData?: () => void;
  onNavigateAdmin?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isSaving = false,
  isBackupProcessing = false,
  onExportBackup,
  onImportBackup,
  onLoadSampleData,
  onClearAllData,
  onNavigateAdmin,
}) => {
  const { user, isAdmin, loginWithGoogle, logout, isAuthModalOpen, setIsAuthModalOpen } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isAuthModalOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImportBackup) {
      onImportBackup(file);
    }
    if (e.target) e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      {/* Hidden File Input for Backup Import */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".zip,application/zip"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 w-full max-w-md rounded-3xl shadow-2xl p-6 relative overflow-hidden text-slate-800 dark:text-slate-100 max-h-[90vh] overflow-y-auto custom-scrollbar">
        {/* Close Button */}
        <button
          onClick={() => setIsAuthModalOpen(false)}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {user ? (
          /* Signed In User Profile & Data Manager View */
          <div className="space-y-5 pt-1">
            {/* User Info Header */}
            <div className="text-center">
              <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 p-1 shadow-xl mb-3">
                <img
                  src={user.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.email}`}
                  alt={user.name}
                  className="w-full h-full rounded-full bg-slate-100 dark:bg-slate-950 object-cover"
                />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center justify-center gap-1.5">
                <span>{user.name}</span>
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
              </h3>
              <p className="text-xs text-indigo-500 dark:text-indigo-300 font-mono mt-0.5">{user.email}</p>
            </div>

            {/* Admin Direct Navigation Button */}
            {isAdmin && (
              <button
                onClick={() => {
                  setIsAuthModalOpen(false);
                  if (onNavigateAdmin) onNavigateAdmin();
                }}
                className="w-full py-3 px-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-amber-300 font-extrabold text-xs rounded-2xl border border-indigo-500/50 shadow-lg flex items-center justify-center gap-2 hover:from-slate-800 hover:to-indigo-900 transition-all cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-amber-300" />
                <span>Yönetici Kumanda Merkezine Git (Admin)</span>
              </button>
            )}

            {/* Database Status Badge */}
            <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Database className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Kişisel Veritabanı</span>
              </div>
              <div className="flex items-center space-x-1.5 text-xs font-medium">
                {isSaving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                    <span className="text-amber-500 text-[11px]">Kaydediliyor...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400 text-[11px]">Senkronize ✓</span>
                  </>
                )}
              </div>
            </div>

            {/* User Data Management Tools */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-2">
              <h4 className="text-xs font-bold text-slate-500 dark:text-slate-300 px-1 mb-2">Veri ve Taslak Yönetimi</h4>

              <button
                onClick={() => {
                  if (!isBackupProcessing) onExportBackup?.();
                }}
                disabled={isBackupProcessing}
                className={`w-full flex items-center justify-between p-2.5 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/60 rounded-xl text-xs transition-all font-medium ${isBackupProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer text-slate-700 dark:text-slate-200'}`}
              >
                <div className="flex items-center space-x-2.5">
                  {isBackupProcessing ? (
                    <RefreshCw className="w-4 h-4 text-indigo-500 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                  )}
                  <span>Tüm Verilerimi Yedek İndir (.zip)</span>
                </div>
                <span className="text-[10px] bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 px-2 py-0.5 rounded font-bold">
                  {isBackupProcessing ? 'İşleniyor...' : 'İndir'}
                </span>
              </button>

              <button
                onClick={() => {
                  if (!isBackupProcessing) fileInputRef.current?.click();
                }}
                disabled={isBackupProcessing}
                className={`w-full flex items-center justify-between p-2.5 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/60 rounded-xl text-xs transition-all font-medium ${isBackupProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer text-slate-700 dark:text-slate-200'}`}
              >
                <div className="flex items-center space-x-2.5">
                  {isBackupProcessing ? (
                    <RefreshCw className="w-4 h-4 text-purple-500 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 text-purple-500 dark:text-purple-400" />
                  )}
                  <span>Yedekten Veri Yükle (.zip)</span>
                </div>
                <span className="text-[10px] bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300 px-2 py-0.5 rounded font-bold">
                  {isBackupProcessing ? 'Yükleniyor...' : 'Seç'}
                </span>
              </button>

              <button
                onClick={() => {
                  if (
                    confirm(
                      "Örnek taslak verileri (mockup'lar, tasarımlar ve varsayılan klasörler) çalışma alanınıza yüklenecektir. Onaylıyor musunuz?"
                    )
                  ) {
                    onLoadSampleData?.();
                  }
                }}
                className="w-full flex items-center justify-between p-2.5 bg-white dark:bg-slate-900/80 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-500/40 rounded-xl text-xs text-indigo-700 dark:text-indigo-200 transition-all font-medium cursor-pointer"
              >
                <div className="flex items-center space-x-2.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Örnek Taslağı Yükle</span>
                </div>
                <span className="text-[10px] bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 px-2 py-0.5 rounded font-bold">
                  Yükle
                </span>
              </button>

              <button
                onClick={() => {
                  if (
                    confirm(
                      "TÜM VERİLERİNİZ SİLİNECEKTİR (Mockup'lar, tasarımlar ve klasörler sıfırlanıp tamamen boş bir alan oluşturulacaktır). Emin misiniz?"
                    )
                  ) {
                    onClearAllData?.();
                  }
                }}
                className="w-full flex items-center justify-between p-2.5 bg-white dark:bg-slate-900/80 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-500/40 rounded-xl text-xs text-rose-600 dark:text-rose-300 transition-all font-medium cursor-pointer"
              >
                <div className="flex items-center space-x-2.5">
                  <Trash2 className="w-4 h-4 text-rose-500" />
                  <span>Tüm Verileri Temizle</span>
                </div>
                <span className="text-[10px] bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-300 px-2 py-0.5 rounded font-bold">
                  Temizle
                </span>
              </button>
            </div>

            {/* Logout Button */}
            <button
              onClick={logout}
              className="w-full flex items-center justify-center space-x-2 bg-rose-50 dark:bg-rose-600/20 hover:bg-rose-600 text-rose-600 dark:text-rose-300 hover:text-white border border-rose-200 dark:border-rose-500/40 py-2.5 rounded-xl font-bold text-xs transition-all shadow cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Oturumu Kapat</span>
            </button>
          </div>
        ) : (
          /* Guest User Login Prompt View */
          <div className="space-y-5 pt-2">
            <div className="text-center">
              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/30 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <User className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Google İle Oturum Açın</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Giriş yaparak kendi özel çalışma alanınızı oluşturabilir, taslaklarınızı kaydedebilir ve verilerinize her cihazdan erişebilirsiniz.
              </p>
            </div>

            <div className="space-y-3">
              {/* Google Sign In Button */}
              <button
                onClick={loginWithGoogle}
                className="w-full flex items-center justify-center space-x-3 bg-white hover:bg-slate-50 text-slate-900 font-bold py-3 px-4 rounded-2xl shadow-lg hover:shadow-xl border border-slate-200 transition-all transform hover:-translate-y-0.5 active:translate-y-0 text-sm cursor-pointer"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Google İle Giriş Yap</span>
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 text-center">
              🔒 Oturum açmadığınızda da mockup ve tasarımlarınızı üretebilirsiniz. Oturum açtığınızda verileriniz kişisel hesabınızda saklanır.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
