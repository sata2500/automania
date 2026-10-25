import React from 'react';

/**
 * Uygulama genelindeki tek yükleniyor göstergesi: ince bir halka üzerinde dönen yay.
 * Renk `currentColor`dan, boyut `className`den (ör. "w-4 h-4") gelir. Bir işlem sürerken düğmenin
 * kendi ikonu (yıldız, gönder vb.) döndürülmez; ikonun yerine bu gösterge konur.
 * `label` verilirse ekran okuyuculara duyurulur; düğme içinde metin zaten durumu anlattığı için gizlidir.
 */
export function Spinner({ className = 'w-4 h-4', label }: { className?: string; label?: string }) {
  return (
    <span role={label ? 'status' : undefined} className={`inline-flex shrink-0 ${className}`}>
      <svg viewBox="0 0 24 24" fill="none" className="w-full h-full animate-spin [animation-duration:0.8s]" aria-hidden="true">
        <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="3" className="opacity-20" />
        <path d="M21.5 12a9.5 9.5 0 0 0-9.5-9.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}

/**
 * Bölüm veya sayfa yüklenirken ortada gösterilen gösterge (ör. "Şablonlar yükleniyor").
 */
export function LoadingState({ label, className = '' }: { label: string; className?: string }) {
  return (
    <div role="status" className={`flex flex-col items-center justify-center gap-3 py-12 text-slate-500 dark:text-slate-400 animate-in fade-in duration-300 ${className}`}>
      <Spinner className="w-7 h-7 text-indigo-500" />
      <p className="text-xs font-medium">{label}</p>
    </div>
  );
}
