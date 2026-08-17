'use client';

import React from 'react';
import Image from 'next/image';
import {
  Layers,
  Sparkles,
  Image as ImageIcon,
  Tag,
  Palette,
  Sun,
  Moon,
  Monitor,
  User,
  ShoppingBag,
} from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { useAuth } from './UserAuthContext';

export type TabKey = 'mockups' | 'designs' | 'generator' | 'seo' | 'listings';

interface HeaderProps {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  mockupCount: number;
  designCount: number;
  matchCount: number;
}

const TABS: { key: TabKey; label: string; shortLabel: string; icon: React.ElementType }[] = [
  { key: 'mockups',   label: "1. Mockup'lar",   shortLabel: "Mockup'lar",   icon: ImageIcon },
  { key: 'designs',   label: '2. Tasarımlar',   shortLabel: 'Tasarımlar',   icon: Palette   },
  { key: 'generator', label: '3. Toplu Üretim', shortLabel: 'Toplu Üretim', icon: Sparkles  },
  { key: 'seo',       label: '4. Etsy SEO',     shortLabel: 'SEO',          icon: Tag       },
  { key: 'listings',  label: '5. Etsy İlanlarım', shortLabel: 'İlanlarım',  icon: ShoppingBag },
];


const THEME_LABELS: Record<string, string> = {
  system: 'Sistem',
  dark: 'Koyu',
  light: 'Açık',
};

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  mockupCount,
  designCount,
  matchCount,
}) => {
  const { theme, setTheme } = useTheme();
  const { user, isAdmin, setIsAuthModalOpen } = useAuth();

  const getBadge = (key: TabKey): number | null => {
    if (key === 'mockups')   return mockupCount;
    if (key === 'designs')   return designCount;
    if (key === 'generator') return matchCount;
    return null;
  };

  const cycleTheme = () => {
    if (theme === 'system') setTheme('dark');
    else if (theme === 'dark') setTheme('light');
    else setTheme('system');
  };

  const themeLabel = THEME_LABELS[theme] ?? 'Tema';

  return (
    <>
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 md:h-16">

            {/* Logo & Brand */}
            <div
              className="flex items-center space-x-2.5 cursor-pointer shrink-0"
              onClick={() => setActiveTab('mockups')}
              role="button"
              tabIndex={0}
              aria-label="Ana sayfaya dön"
              onKeyDown={(e) => e.key === 'Enter' && setActiveTab('mockups')}
            >
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Layers className="w-4 h-4 md:w-6 md:h-6 text-white" />
              </div>
              <div>
                <span className="text-base md:text-xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 dark:from-white dark:via-slate-200 dark:to-indigo-300 bg-clip-text text-transparent leading-tight block">
                  Automania POD
                </span>
                <p className="text-[10px] md:text-xs text-indigo-500 dark:text-indigo-400 font-medium hidden sm:block">
                  Etsy Print-on-Demand Studio
                </p>
              </div>
            </div>

            {/* Desktop Top Navigation Tabs */}
            <nav aria-label="Ana navigasyon" className="hidden md:flex items-center space-x-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60">
              {TABS.map(({ key, label, icon: Icon }) => {
                const badge = getBadge(key);
                const isActive = activeTab === key;
                return (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? key === 'generator'
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                          : 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 ${
                        key === 'generator'
                          ? 'text-amber-300 animate-pulse'
                          : key === 'seo'
                          ? 'text-emerald-400'
                          : ''
                      }`}
                    />
                    <span>{label}</span>
                    {badge !== null && (
                      <span
                        className={`ml-1 px-1.5 py-0.5 text-[10px] rounded-full font-bold ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-200 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300'
                        } ${key === 'generator' && isActive ? 'text-pink-200' : ''}`}
                        aria-label={`${badge} öğe`}
                      >
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Right Side Controls: Theme Switcher & User Profile */}
            <div className="flex items-center space-x-2">
              {/* Theme Switcher Button */}
              <button
                onClick={cycleTheme}
                aria-label={`Temayı değiştir. Şu an: ${themeLabel}`}
                className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold transition-all shadow-sm"
              >
                {theme === 'system' ? (
                  <Monitor className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                ) : theme === 'dark' ? (
                  <Moon className="w-4 h-4 text-purple-500 dark:text-purple-400" />
                ) : (
                  <Sun className="w-4 h-4 text-amber-500" />
                )}
              </button>

              {/* User Profile Button */}
              <button
                onClick={() => setIsAuthModalOpen(true)}
                aria-label={user ? `${user.name} — ${isAdmin ? 'Admin' : 'Kullanıcı'} profili` : 'Giriş yap veya profili görüntüle'}
                className="relative rounded-full hover:ring-2 hover:ring-indigo-400/80 transition-all cursor-pointer p-0.5 shrink-0"
              >
                {user?.avatarUrl ? (
                  <Image
                    src={user.avatarUrl}
                    alt={user.name}
                    width={32}
                    height={32}
                    className="rounded-full border-2 border-indigo-500/80 shadow-md object-cover"
                    unoptimized={user.avatarUrl.includes('dicebear.com')} // SVG avatars skip optimization
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Floating Bottom Navigation Bar for Mobile */}
      <nav
        aria-label="Mobil navigasyon"
        className="md:hidden fixed bottom-[calc(env(safe-area-inset-bottom)+12px)] left-3 right-3 z-50 bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-2xl p-1.5 flex items-center justify-around transition-colors duration-200 select-none touch-manipulation"
      >
        {TABS.map(({ key, shortLabel, icon: Icon }) => {
          const badge = getBadge(key);
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={`${shortLabel}${badge ? `, ${badge} öğe` : ''}`}
              className={`relative flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-xl text-[10px] font-bold transition-all active:scale-95 ${
                isActive
                  ? key === 'generator'
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                    : 'bg-indigo-600 text-white shadow-lg'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon
                className={`w-4 h-4 mb-0.5 ${
                  key === 'generator' && !isActive
                    ? 'text-amber-500'
                    : key === 'seo' && !isActive
                    ? 'text-emerald-500 dark:text-emerald-400'
                    : ''
                }`}
              />
              <span className="leading-none">{shortLabel}</span>
              {badge !== null && badge > 0 && (
                <span className="absolute top-1 right-2 w-4 h-4 bg-pink-500 text-white text-[8px] font-extrabold rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
};
