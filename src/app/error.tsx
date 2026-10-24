'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

/**
 * Sayfa düzeyindeki beklenmeyen hatalar için yedek ekran. Çalışma alanı verisi tarayıcıda ve
 * bulutta saklandığı için yeniden denemek veya sayfayı yenilemek veri kaybettirmez.
 */
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error('[App Error]', error);
  }, [error]);

  const digest = error instanceof Error && 'digest' in error ? String((error as Error & { digest?: string }).digest || '') : '';

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
      <div role="alert" className="max-w-md w-full text-center space-y-4 p-6 rounded-2xl border border-rose-200 dark:border-rose-900 bg-white dark:bg-slate-900 shadow-sm">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-900 dark:text-white">Beklenmeyen bir hata oluştu</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Verileriniz güvende; çalışma alanınız tarayıcınızda ve hesabınızda saklanıyor. Tekrar deneyebilir veya sayfayı yenileyebilirsiniz.
          </p>
          {digest && <p className="text-[10px] text-slate-400 mt-2 font-mono">Hata kodu: {digest}</p>}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button type="button" onClick={() => retry()} className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold">
            <RefreshCw className="w-3.5 h-3.5" /> Tekrar dene
          </button>
          <Link href="/" className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold">
            <Home className="w-3.5 h-3.5" /> Ana sayfaya dön
          </Link>
        </div>
      </div>
    </div>
  );
}
