import { requireAdmin } from '@/lib/auth-server';
import { redirect } from 'next/navigation';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { UserAuthProvider } from '@/components/common/UserAuthContext';
import { ThemeProvider } from '@/components/common/ThemeProvider';
import { ToastProvider } from '@/components/common/ToastContext';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default async function AdminPage() {
  const session = await requireAdmin();
  if (!session) {
    redirect('/');
  }

  return (
    <UserAuthProvider>
      <ThemeProvider>
        <ToastProvider>
          <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-indigo-500 selection:text-white pb-24 md:pb-16 transition-colors duration-200">
            <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors duration-200">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center h-14 md:h-16 gap-4">
                  <Link href="/" className="flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                    <span>Stüdyoya Dön</span>
                  </Link>
                </div>
              </div>
            </header>
            <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-6">
              <AdminDashboard />
            </main>
          </div>
        </ToastProvider>
      </ThemeProvider>
    </UserAuthProvider>
  );
}
