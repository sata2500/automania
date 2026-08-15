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
  description: string;
  icon: React.ElementType;
  badgeBg: string;
  iconColor: string;
}[] = [
  {
    value: 'mockup',
    label: 'Mockup Ayarı (Otomatik)',
    description: 'Mockup şablonundaki en-boy oranını korur',
    icon: Sparkles,
    badgeBg: 'bg-purple-100 dark:bg-purple-950/60',
    iconColor: 'text-purple-600 dark:text-purple-400',
  },
  {
    value: 'original',
    label: 'Orijinal Boyut (Kırpma Yok)',
    description: 'Orijinal en-boy oranını korur, kırpma yapmaz',
    icon: Maximize2,
    badgeBg: 'bg-indigo-100 dark:bg-indigo-950/60',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
  },
  {
    value: 'square',
    label: 'Kare Format (1:1)',
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
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all cursor-pointer shadow-xs group"
        title="Görsel En-Boy Oranı Seçimi"
      >
        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          En-Boy:
        </span>
        <div className="flex items-center gap-1.5">
          <SelectedIcon className={`w-3.5 h-3.5 ${selectedOption.iconColor}`} />
          <span className="font-bold text-indigo-600 dark:text-indigo-400 max-w-[150px] sm:max-w-none truncate">
            {selectedOption.label}
          </span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-500' : ''}`}
        />
      </button>

      {/* Modern Popover Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-1.5 min-w-[280px] sm:min-w-[320px] animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl">
          <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 mb-1">
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
                  className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between gap-3 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/80'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-xl shrink-0 ${option.badgeBg}`}>
                      <Icon className={`w-4 h-4 ${option.iconColor}`} />
                    </div>
                    <div className="min-w-0">
                      <div
                        className={`text-xs font-bold truncate ${
                          isSelected
                            ? 'text-indigo-600 dark:text-indigo-300'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {option.label}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight truncate">
                        {option.description}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center text-white shrink-0 shadow-xs">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
