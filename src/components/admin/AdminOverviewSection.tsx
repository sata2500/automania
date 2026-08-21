import type { ReactNode } from 'react';
import {
  Activity,
  HardDrive,
  Layers,
  Palette,
  RefreshCw,
  Users,
} from 'lucide-react';

export type AdminGlobalStats = {
  users?: { total?: number; active?: number; blocked?: number };
  assets?: { mockups?: number; designs?: number; folders?: number };
  health?: { status?: 'excellent' | 'good' | string; dbLatencyMs?: number };
  storage?: { provider?: string; usedBytes?: number; limitBytes?: number; blobCount?: number };
};

export type AdminOverviewSectionProps = {
  globalStats: AdminGlobalStats | null;
  isLoadingStats: boolean;
  onRefresh: () => void;
};

export function AdminOverviewSection({ globalStats, isLoadingStats, onRefresh }: AdminOverviewSectionProps) {
  const healthStatus = globalStats?.health?.status;
  const healthLabel = healthStatus === 'excellent' ? 'Mükemmel' : healthStatus === 'good' ? 'İyi' : 'Yavaş';
  const storageUsedBytes = globalStats?.storage?.usedBytes || 0;
  const storageLimitBytes = globalStats?.storage?.limitBytes || 1;
  const storageUsageRatio = storageUsedBytes / storageLimitBytes;

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 px-5 py-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true"></span>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Canlı Sistem İstatistikleri</span>
          <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
            Cloudflare R2 + PostgreSQL
          </span>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoadingStats}
          aria-label={isLoadingStats ? 'İstatistikler güncelleniyor' : 'İstatistikleri yenile'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStats ? 'animate-spin text-indigo-500' : ''}`} aria-hidden="true" />
          <span>{isLoadingStats ? 'Güncelleniyor...' : 'Verileri Yenile'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Kayıtlı Kullanıcılar" value={isLoadingStats ? '...' : globalStats?.users?.total || 0} unit="Kullanıcı" icon={<Users className="w-6 h-6" />} iconClass="text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 border-indigo-100 dark:border-indigo-800/50">
          <div className="flex gap-2 text-[10px] font-bold mt-3">
            <span className="text-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-100 dark:border-emerald-800">{globalStats?.users?.active || 0} Aktif</span>
            <span className="text-rose-500 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded-md border border-rose-100 dark:border-rose-800">{globalStats?.users?.blocked || 0} Engelli</span>
          </div>
        </MetricCard>

        <MetricCard label="Global Mockup Arşivi" value={isLoadingStats ? '...' : globalStats?.assets?.mockups || 0} unit="Görsel" icon={<Layers className="w-6 h-6" />} iconClass="text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 border-purple-100 dark:border-purple-800/50">
          <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-3 font-bold bg-purple-50 dark:bg-purple-950/50 inline-block px-2 py-0.5 rounded-md border border-purple-100 dark:border-purple-800">Tüm kullanıcıların ortak üretimi</p>
        </MetricCard>

        <MetricCard label="Global Tasarım Üretimi" value={isLoadingStats ? '...' : globalStats?.assets?.designs || 0} unit="Tasarım" icon={<Palette className="w-6 h-6" />} iconClass="text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border-amber-100 dark:border-amber-800/50">
          <div className="flex gap-2 text-[10px] mt-3 font-bold">
            <span className="text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-md border border-amber-100 dark:border-amber-800">{globalStats?.assets?.folders || 0} Global Klasör</span>
          </div>
        </MetricCard>

        <MetricCard label="Veritabanı Sağlığı" value={isLoadingStats ? '...' : healthLabel} icon={<Activity className="w-6 h-6" />} iconClass="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-100 dark:border-emerald-800/50" valueClass={healthStatus === 'excellent' ? 'text-emerald-600 dark:text-emerald-400' : healthStatus === 'good' ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-3 font-bold bg-slate-50 dark:bg-slate-800 inline-block px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
            {isLoadingStats ? 'Ölçülüyor...' : `Gecikme (Ping): ${globalStats?.health?.dbLatencyMs || 0}ms`}
          </p>
        </MetricCard>

        <MetricCard label={`Depolama (${globalStats?.storage?.provider || 'Cloudflare R2'})`} value={isLoadingStats ? '...' : (storageUsedBytes / (1024 * 1024)).toFixed(1)} unit="MB Dolu" icon={<HardDrive className="w-6 h-6" />} iconClass="text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30 border-sky-100 dark:border-sky-800/50" valueClass={storageUsageRatio > 0.85 ? 'text-rose-600 dark:text-rose-400' : 'text-indigo-600 dark:text-indigo-400'}>
          <div className="flex gap-2 text-[10px] mt-3 font-bold">
            <span className="text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/50 px-2 py-0.5 rounded-md border border-sky-100 dark:border-sky-800">{globalStats?.storage?.blobCount || 0} Dosya</span>
            <span className="text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">Kota: {((globalStats?.storage?.limitBytes || 10737418240) / (1024 * 1024 * 1024)).toFixed(0)} GB</span>
          </div>
        </MetricCard>
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2"><Activity className="w-4 h-4 text-indigo-500" aria-hidden="true" /><span>Sistem Çalışma Durumu &amp; Özet</span></h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <InfoCard label="Veritabanı Motoru" value="PostgreSQL (Server DB Sync)" detail="Tüm cihazlarda kesintisiz veri erişimi" />
          <InfoCard label="Yapay Zeka Altyapısı" value="OpenRouter Multi-Model Router" detail="Sunucu API anahtarı ile aktif" />
          <InfoCard label="Uygulama Sürümü" value="Automania POD Studio v2.6.0" detail="Enterprise Suite (Next.js 16 + React 19)" />
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, unit, icon, iconClass, valueClass = 'text-slate-900 dark:text-white', children }: {
  label: string;
  value: string | number;
  unit?: string;
  icon: ReactNode;
  iconClass: string;
  valueClass?: string;
  children?: ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between hover:-translate-y-1 hover:shadow-md transition-all">
      <div>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">{label}</span>
        <div className="flex items-baseline space-x-2"><span className={`text-3xl font-extrabold ${valueClass}`}>{value}</span>{unit && <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase">{unit}</span>}</div>
        {children}
      </div>
      <div className={`p-3 rounded-2xl shadow-sm border ${iconClass}`}>{icon}</div>
    </div>
  );
}

function InfoCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200/60 dark:border-slate-800 space-y-1">
      <span className="text-slate-400 text-[10px] uppercase font-bold">{label}</span>
      <p className="font-bold text-slate-800 dark:text-slate-200">{value}</p>
      <p className="text-[10px] text-slate-500">{detail}</p>
    </div>
  );
}
