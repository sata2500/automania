'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Maximize2, Square, ChevronDown, Check } from 'lucide-react';

export type AspectRatioType = 'mockup' | 'original' | 'square';

interface BatchAspectRatioSelectorProps {
  value: AspectRatioType;
  onChange: (val: AspectRatioType) => void;
}

const OPTIONS: {
  value: AspectRatioType;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ElementType;
  badgeBg: string;
  iconColor: string;
}[] = [
  {
    value: 'mockup',
    label: 'Mockup Ayarı (Otomatik)',
    shortLabel: 'Mockup Ayarı',
    description: 'Mockup şablonundaki en-boy oranını korur',
    icon: Sparkles,
    badgeBg: 'bg-purple-100 dark:bg-purple-950/60',
    iconColor: 'text-purple-600 dark:text-purple-400',
  },
  {
    value: 'original',
    label: 'Orijinal Boyut (Kırpma Yok)',
    shortLabel: 'Orijinal Boyut',
    description: 'Orijinal en-boy oranını korur, kırpma yapmaz',
    icon: Maximize2,
    badgeBg: 'bg-indigo-100 dark:bg-indigo-950/60',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
  },
  {
    value: 'square',
    label: 'Kare Format (1:1)',
    shortLabel: 'Kare Format (1:1)',
    description: 'Etsy için 1:1 kare formatında çıktılar üretir',
    icon: Square,
    badgeBg: 'bg-pink-100 dark:bg-pink-950/60',
    iconColor: 'text-pink-600 dark:text-pink-400',
  },
];

export const BatchAspectRatioSelector: React.FC<BatchAspectRatioSelectorProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = OPTIONS.find((opt) => opt.value === value) || OPTIONS[0];
  const SelectedIcon = selectedOption.icon;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={`relative shrink-0 ${isOpen ? 'z-50' : 'z-10'}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between gap-2 px-3 py-1.5 sm:py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 border rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all cursor-pointer shadow-xs group ${
          isOpen
            ? 'border-indigo-500 dark:border-indigo-400 ring-2 ring-indigo-500/20'
            : 'border-slate-200 dark:border-slate-700/80'
        }`}
        title="Görsel En-Boy Oranı Seçimi"
      >
        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider hidden xs:inline">
          En-Boy:
        </span>
        <div className="flex items-center gap-1.5 min-w-0">
          <SelectedIcon className={`w-3.5 h-3.5 shrink-0 ${selectedOption.iconColor}`} />
          <span className="font-bold text-indigo-600 dark:text-indigo-400 truncate max-w-[130px] sm:max-w-[180px]">
            {selectedOption.label}
          </span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-indigo-500' : ''
          }`}
        />
      </button>

      {/* Modern Popover Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-1.5 w-[280px] sm:w-[320px] max-w-[calc(100vw-32px)] animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 mb-1">
            En-Boy Oranı Modu
          </div>

          <div className="space-y-1">
            {OPTIONS.map((option) => {
              const Icon = option.icon;
              const isSelected = option.value === value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-start gap-2.5 p-2.5 rounded-xl text-left transition-all cursor-pointer group ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent'
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : `${option.badgeBg} ${option.iconColor} group-hover:scale-105`
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-xs font-bold truncate ${
                          isSelected
                            ? 'text-indigo-950 dark:text-indigo-200'
                            : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {option.label}
                      </span>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      )}
                    </div>
                    <p
                      className={`text-[11px] leading-tight mt-0.5 line-clamp-2 ${
                        isSelected
                          ? 'text-indigo-700/90 dark:text-indigo-300/90'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {option.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
