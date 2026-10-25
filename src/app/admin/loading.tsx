import { TabSkeleton } from '@/components/common/LoadingScreens';

/** Yönetici paneli sunucuda yetki doğrulanırken gösterilir. */
export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="h-14 md:h-16 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95" />
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-6">
        <TabSkeleton label="Yönetici paneli yükleniyor" layout="list" />
      </main>
    </div>
  );
}
