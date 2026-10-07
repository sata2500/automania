'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Database, KeyRound, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { useToast } from '@/components/common/ToastContext';

type MaintenanceStatus = {
  migrations: { total: number; applied: Array<{ tag: string; appliedAt: string }>; pending: Array<{ tag: string }> };
  secrets: { encryptionConfigured: boolean; plaintextSettings: number; plaintextWorkspaces: number; legacyScrapingKeys: number };
  lockedSince: string | null;
};

type MaintenanceAction = 'migrate' | 'encrypt-secrets';

const CONFIRMATION_WORD = 'ONAYLA';

const ACTION_COPY: Record<MaintenanceAction, { title: string; description: string; button: string }> = {
  migrate: {
    title: 'Migration\'ları uygula',
    description: 'Bekleyen şema değişikliklerini (tablolar, kolonlar, indeksler) canlı veritabanına uygular. Mevcut verileri silmez; migration\'lar tekrar uygulanabilir şekilde yazılmıştır.',
    button: 'Migration\'ları Uygula',
  },
  'encrypt-secrets': {
    title: 'Gizli değerleri şifrele',
    description: 'Düz metin Etsy token\'larını ve admin API anahtarlarını DATA_ENCRYPTION_KEY ile şifreler, kullanıcı satırlarındaki eski scraping anahtarı kopyalarını temizler. Bu anahtarı kaybederseniz şifreli değerler okunamaz.',
    button: 'Gizli Değerleri Şifrele',
  },
};

async function fetchMaintenanceStatus(): Promise<MaintenanceStatus> {
  const res = await fetch('/api/admin/db-maintenance', { cache: 'no-store' });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Bakım durumu okunamadı.');
  return data.status;
}

export function AdminDbMaintenanceCard() {
  const toast = useToast();
  const [status, setStatus] = useState<MaintenanceStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<MaintenanceAction | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  const applyResult = useCallback((promise: Promise<MaintenanceStatus>, isActive: () => boolean = () => true) => {
    promise
      .then((next) => {
        if (!isActive()) return;
        setStatus(next);
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (isActive()) setLoadError(error instanceof Error ? error.message : 'Bakım durumu okunamadı.');
      })
      .finally(() => {
        if (isActive()) setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    let active = true;
    applyResult(fetchMaintenanceStatus(), () => active);
    return () => {
      active = false;
    };
  }, [applyResult]);

  const loadStatus = () => {
    setIsLoading(true);
    applyResult(fetchMaintenanceStatus());
  };

  const openConfirm = (action: MaintenanceAction) => {
    setPendingAction(action);
    setConfirmation('');
  };

  const runAction = async () => {
    if (!pendingAction || confirmation !== CONFIRMATION_WORD) return;
    setIsRunning(true);
    try {
      const res = await fetch('/api/admin/db-maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: pendingAction, confirmation }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'İşlem başarısız oldu.');
      setStatus(data.status);
      toast.success(pendingAction === 'migrate' ? 'Migration\'lar uygulandı.' : 'Gizli değerler şifrelendi.');
      setPendingAction(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'İşlem başarısız oldu.');
    } finally {
      setIsRunning(false);
    }
  };

  const pendingMigrations = status?.migrations.pending.length ?? 0;
  const plaintextTotal = status
    ? status.secrets.plaintextSettings + status.secrets.plaintextWorkspaces + status.secrets.legacyScrapingKeys
    : 0;

  return (
    <div className="md:col-span-2 p-5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">Veritabanı Bakımı (Migration &amp; Şifreleme)</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Şema değişikliklerini ve gizli değer şifrelemesini gerektiğinde buradan elle uygulayın.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadStatus}
          disabled={isLoading || isRunning}
          className="self-start sm:self-auto px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Durumu Yenile
        </button>
      </div>

      <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 flex gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
        <span>
          Bu işlemler canlı veritabanını değiştirir. Çalıştırmadan önce Neon panelinden bir yedek (branch) almanız önerilir.
          Her işlem denetim kaydına (audit log) yazılır.
        </span>
      </div>

      {loadError && (
        <p role="alert" className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">{loadError}</p>
      )}

      {status?.lockedSince && (
        <p role="status" className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
          Bir bakım işlemi {new Date(status.lockedSince).toLocaleTimeString('tr-TR')} itibarıyla çalışıyor.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Migration durumu */}
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Şema Migration&apos;ları</span>
            {status && (
              pendingMigrations === 0 ? (
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Güncel
                </span>
              ) : (
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">{pendingMigrations} bekliyor</span>
              )
            )}
          </div>
          {status ? (
            <ul className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
              {status.migrations.applied.map((m) => (
                <li key={m.tag} className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" aria-hidden="true" />
                  <code>{m.tag}</code>
                </li>
              ))}
              {status.migrations.pending.map((m) => (
                <li key={m.tag} className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full border-2 border-amber-400" aria-hidden="true" />
                  <code>{m.tag}</code> <span className="text-amber-600 dark:text-amber-400">(bekliyor)</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-slate-400">{isLoading ? 'Yükleniyor…' : '—'}</p>
          )}
          <button
            type="button"
            onClick={() => openConfirm('migrate')}
            disabled={!status || isRunning || pendingMigrations === 0}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Database className="w-4 h-4" />
            {!status ? 'Durum bilinmiyor' : pendingMigrations === 0 ? 'Bekleyen migration yok' : ACTION_COPY.migrate.button}
          </button>
        </div>

        {/* Şifreleme durumu */}
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Gizli Değer Şifrelemesi</span>
            {status && (
              plaintextTotal === 0 ? (
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Tamamı şifreli
                </span>
              ) : (
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">{plaintextTotal} düz metin kayıt</span>
              )
            )}
          </div>
          {status ? (
            <ul className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
              <li>
                Şifreleme anahtarı:{' '}
                {status.secrets.encryptionConfigured
                  ? <strong className="text-emerald-600 dark:text-emerald-400">tanımlı</strong>
                  : <strong className="text-rose-600 dark:text-rose-400">tanımlı değil (DATA_ENCRYPTION_KEY)</strong>}
              </li>
              <li>Düz metin admin API anahtarı: <strong>{status.secrets.plaintextSettings}</strong></li>
              <li>Düz metin Etsy bağlantısı: <strong>{status.secrets.plaintextWorkspaces}</strong></li>
              <li>Eski scraping anahtarı kopyası: <strong>{status.secrets.legacyScrapingKeys}</strong></li>
            </ul>
          ) : (
            <p className="text-[11px] text-slate-400">{isLoading ? 'Yükleniyor…' : '—'}</p>
          )}
          <button
            type="button"
            onClick={() => openConfirm('encrypt-secrets')}
            disabled={!status || isRunning || plaintextTotal === 0 || !status.secrets.encryptionConfigured}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <KeyRound className="w-4 h-4" />
            {!status ? 'Durum bilinmiyor' : plaintextTotal === 0 ? 'Şifrelenecek kayıt yok' : ACTION_COPY['encrypt-secrets'].button}
          </button>
        </div>
      </div>

      {pendingAction && (
        <div role="dialog" aria-labelledby="db-maintenance-confirm-title" className="p-4 bg-white dark:bg-slate-900 rounded-xl border-2 border-amber-300 dark:border-amber-700 space-y-3">
          <h4 id="db-maintenance-confirm-title" className="text-xs font-bold text-slate-900 dark:text-white">
            {ACTION_COPY[pendingAction].title}
          </h4>
          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">{ACTION_COPY[pendingAction].description}</p>
          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
            Devam etmek için <strong>{CONFIRMATION_WORD}</strong> yazın
            <input
              type="text"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete="off"
              className="mt-1.5 w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => void runAction()}
              disabled={confirmation !== CONFIRMATION_WORD || isRunning}
              className="flex-1 py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isRunning && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              {isRunning ? 'Çalışıyor…' : 'Onayla ve Çalıştır'}
            </button>
            <button
              type="button"
              onClick={() => setPendingAction(null)}
              disabled={isRunning}
              className="py-2.5 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold rounded-xl text-xs cursor-pointer disabled:opacity-40"
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
