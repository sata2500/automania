/**
 * Automania marka simgesi: lacivert zemin üzerinde mor katmanlar ve yıldız. Ana ekran simgesi,
 * tarayıcı sekmesi simgesi (public/icon-*.png, icon-logo.svg), açılış ekranı ve uygulama başlığı aynı çizimi kullanır.
 */
import React, { useId } from 'react';

/** Yalnızca katmanlar + yıldız (zeminsiz). */
export function BrandGlyph({ className = '', sparkleClassName }: { className?: string; sparkleClassName?: string }) {
  const gradientId = `brand-top-${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="8 3 50 54" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b6cf0" />
          <stop offset="1" stopColor="#b16cf8" />
        </linearGradient>
      </defs>
      <path d="M32 31 53 42.5 32 54 11 42.5Z" fill="#3b2a9e" />
      <path d="M32 24.5 53 36 32 47.5 11 36Z" fill="#5b3fc4" />
      <path d="M32 17 53 28.5 32 40 11 28.5Z" fill={`url(#${gradientId})`} />
      <path
        className={sparkleClassName}
        d="M50 6c.8 3.4 2.2 4.8 5.6 5.6-3.4.8-4.8 2.2-5.6 5.6-.8-3.4-2.2-4.8-5.6-5.6 3.4-.8 4.8-2.2 5.6-5.6Z"
        fill={sparkleClassName ? undefined : '#e0d2ff'}
      />
    </svg>
  );
}

/** Uygulama simgesinin küçük hali: yuvarlatılmış lacivert kare içinde simge (başlıkta kullanılır). */
export function BrandMark({ className = 'w-10 h-10' }: { className?: string }) {
  return (
    <span className={`${className} relative inline-flex items-center justify-center rounded-[28%] bg-[#0f172a] ring-1 ring-white/10 shadow-lg shadow-indigo-500/25 overflow-hidden shrink-0`}>
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_50%_52%,rgba(124,58,237,0.55),transparent_70%)]" aria-hidden="true" />
      <BrandGlyph className="relative w-[80%] h-[80%]" />
    </span>
  );
}
