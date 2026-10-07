'use client';

import React, { useState } from 'react';
import { Image as ImageIcon, Video, Check, Info } from 'lucide-react';
import { MockupItem } from '@/types/pod';
import { PodTemplateMockupConfig } from '@/types/templates';

interface MockupSelectorSectionProps {
  mockups: MockupItem[];
  config: PodTemplateMockupConfig;
  onChange: (config: PodTemplateMockupConfig) => void;
}

const FABRIC_OPTIONS = [
  { value: 'light', label: '☀️ Açık Kumaş', desc: 'Beyaz, krem, açık gri vb.' },
  { value: 'dark', label: '🌑 Koyu Kumaş', desc: 'Siyah, lacivert, koyu gri vb.' },
  { value: 'all', label: '✦ Tüm Kumaşlar', desc: 'Açık ve koyu renk birlikte' },
] as const;

export function MockupSelectorSection({ mockups, config, onChange }: MockupSelectorSectionProps) {
  const [activeGroup, setActiveGroup] = useState<'print' | 'static' | 'video'>('print');

  const totalImages =
    (config.printAreaMockupIds?.length ?? 0) +
    (config.staticMockupIds?.length ?? 0);
  const totalVideos = config.videoMockupIds?.length ?? 0;
  const remainingImages = 20 - totalImages;

  // Video mockuplar
  const videoMockups = mockups.filter(m => m.isVideo);
  // Baskı alanı olan mockuplar (görsel, isVideo değil, hasPrintArea !== false)
  const printAreaMockups = mockups.filter(m => !m.isVideo && m.hasPrintArea !== false);
  // Statik mockuplar (görsel, isVideo değil, hasPrintArea === false)
  const staticMockups = mockups.filter(m => !m.isVideo && m.hasPrintArea === false);

  const toggleMockup = (
    id: string,
    group: 'printAreaMockupIds' | 'staticMockupIds' | 'videoMockupIds'
  ) => {
    const current = config[group] ?? [];
    const isSelected = current.includes(id);

    if (!isSelected) {
      // Limit kontrolü
      if (group === 'videoMockupIds' && totalVideos >= 2) return;
      if ((group === 'printAreaMockupIds' || group === 'staticMockupIds') && totalImages >= 20) return;
    }

    onChange({
      ...config,
      [group]: isSelected ? current.filter(x => x !== id) : [...current, id],
    });
  };

  const currentList = activeGroup === 'print'
    ? printAreaMockups
    : activeGroup === 'static'
    ? staticMockups
    : videoMockups;

  const currentKey: 'printAreaMockupIds' | 'staticMockupIds' | 'videoMockupIds' =
    activeGroup === 'print'
      ? 'printAreaMockupIds'
      : activeGroup === 'static'
      ? 'staticMockupIds'
      : 'videoMockupIds';

  return (
    <div className="space-y-4">
      {/* Özet İstatistikler */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: 'Baskı Alanlı',
            value: config.printAreaMockupIds?.length ?? 0,
            max: 20,
            color: 'text-indigo-600 dark:text-indigo-400',
            bg: 'bg-indigo-50 dark:bg-indigo-500/10',
          },
          {
            label: 'Statik',
            value: config.staticMockupIds?.length ?? 0,
            max: 20,
            color: 'text-purple-600 dark:text-purple-400',
            bg: 'bg-purple-50 dark:bg-purple-500/10',
          },
          {
            label: 'Video',
            value: totalVideos,
            max: 2,
            color: 'text-amber-600 dark:text-amber-400',
            bg: 'bg-amber-50 dark:bg-amber-500/10',
          },
        ].map(stat => (
          <div key={stat.label} className={`${stat.bg} rounded-xl p-3 text-center`}>
            <p className={`text-lg font-bold ${stat.color}`}>
              {stat.value}
              <span className="text-xs font-normal text-slate-400">/{stat.max}</span>
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Etsy Limit Uyarısı */}
      <div className={`flex items-start gap-2 p-3 rounded-xl border text-xs ${
        totalImages > 20 || totalVideos > 2
          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400'
          : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-400'
      }`}>
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          Etsy limiti: <strong>maksimum 20 görsel</strong> ve <strong>2 video</strong>.
          {remainingImages >= 0 ? ` ${remainingImages} görsel alanı kaldı.` : ` ${Math.abs(remainingImages)} görsel fazla!`}
        </span>
      </div>

      {/* Kumaş Tipi */}
      <div>
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
          Hedef Kumaş Rengi
        </label>
        <div className="grid grid-cols-3 gap-2">
          {FABRIC_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => onChange({ ...config, fabricType: opt.value })}
              className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all cursor-pointer ${
                config.fabricType === opt.value
                  ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-400 dark:border-amber-500/50 shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <span className="text-sm">{opt.label.split(' ')[0]}</span>
              <span className={`text-[10px] font-semibold mt-0.5 ${
                config.fabricType === opt.value
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-slate-600 dark:text-slate-400'
              }`}>
                {opt.label.split(' ').slice(1).join(' ')}
              </span>
              <span className="text-[9px] text-slate-400 mt-0.5">{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Mockup Grup Seçici */}
      <div>
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 mb-3">
          {[
            { key: 'print' as const, label: `Baskı Alanlı (${printAreaMockups.length})`, icon: ImageIcon },
            { key: 'static' as const, label: `Statik (${staticMockups.length})`, icon: ImageIcon },
            { key: 'video' as const, label: `Video (${videoMockups.length})`, icon: Video },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveGroup(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                activeGroup === key
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Icon className="w-3 h-3" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{label.split(' ')[0]}</span>
            </button>
          ))}
        </div>

        {/* Mockup Grid */}
        {currentList.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-xs text-slate-400">
              {activeGroup === 'print'
                ? 'Baskı alanı olan mockup yok. Mockup sekmesinden ekleyin.'
                : activeGroup === 'static'
                ? 'Statik mockup yok. Mockup sekmesinden "Baskı Alanı Yok" seçeneğiyle ekleyin.'
                : 'Video mockup yok. Mockup sekmesinden video yükleyin.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-56 overflow-y-auto pr-1">
            {currentList.map(mockup => {
              const isSelected = (config[currentKey] ?? []).includes(mockup.id);
              const isLimitReached = !isSelected && (
                (currentKey === 'videoMockupIds' && totalVideos >= 2) ||
                ((currentKey !== 'videoMockupIds') && totalImages >= 20)
              );

              return (
                <button
                  key={mockup.id}
                  onClick={() => toggleMockup(mockup.id, currentKey)}
                  disabled={isLimitReached}
                  className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-amber-500 shadow-lg shadow-amber-500/20'
                      : isLimitReached
                      ? 'border-slate-200 dark:border-slate-700 opacity-40 cursor-not-allowed'
                      : 'border-transparent hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  {mockup.src ? (
                    <img
                      src={mockup.src}
                      alt={mockup.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-slate-300" />
                    </div>
                  )}

                  {/* Seçili overlay */}
                  {isSelected && (
                    <div className="absolute inset-0 bg-amber-500/20 flex items-center justify-center">
                      <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center shadow-lg">
                        <Check className="w-3.5 h-3.5 text-white" />
                      </div>
                    </div>
                  )}

                  {/* İsim tooltip */}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-1">
                    <p className="text-[9px] text-white font-semibold truncate text-center leading-tight">
                      {mockup.name}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Çoklu Baskı Alanı Toggle */}
      <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <div>
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Çoklu Baskı Alanı Desteği
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            Bir mockup üzerinde birden fazla baskı alanı kullan
          </p>
        </div>
        <button
          onClick={() => onChange({ ...config, multiPrintAreaSupport: !config.multiPrintAreaSupport })}
          className={`relative w-10 h-5.5 rounded-full transition-colors cursor-pointer ${
            config.multiPrintAreaSupport
              ? 'bg-amber-500'
              : 'bg-slate-300 dark:bg-slate-600'
          }`}
          style={{ height: '22px' }}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
              config.multiPrintAreaSupport ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
    </div>
  );
}
