'use client';

import React, { useState, useCallback } from 'react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  LayoutTemplate,
  Image as ImageIcon,
  Palette,
  Tag,
  Clock,
  Check,
  Save,
  AlertCircle,
  Info,
} from 'lucide-react';
import { PodTemplate, PodTemplateInput } from '@/types/templates';
import { MockupItem } from '@/types/pod';
import { MockupSelectorSection } from './sections/MockupSelectorSection';
import { VariationSection } from './sections/VariationSection';
import { SeoHintsSection } from './sections/SeoHintsSection';
import { ScheduleSection } from './sections/ScheduleSection';

interface TemplateBuilderModalProps {
  mockups: MockupItem[];
  template: PodTemplate | null;
  onSave: (data: PodTemplateInput, id?: string) => Promise<void>;
  onClose: () => void;
}

type Step = 1 | 2 | 3 | 4;

const STEPS = [
  { step: 1 as Step, label: 'Görseller', icon: ImageIcon, description: 'Mockup & Baskı Alanı' },
  { step: 2 as Step, label: 'Varyasyonlar', icon: Palette, description: 'Renk, Beden, Fiyat' },
  { step: 3 as Step, label: 'SEO İpuçları', icon: Tag, description: 'Ürün & Niş Bilgisi' },
  { step: 4 as Step, label: 'Zamanlama', icon: Clock, description: 'Otomasyon Ayarları' },
];

export function TemplateBuilderModal({
  mockups,
  template,
  onSave,
  onClose,
}: TemplateBuilderModalProps) {
  const isEditing = Boolean(template);
  const [activeStep, setActiveStep] = useState<Step>(1);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [name, setName] = useState(template?.name ?? '');
  const [description, setDescription] = useState(template?.description ?? '');
  const [mockupConfig, setMockupConfig] = useState(
    template?.mockupConfig ?? {
      printAreaMockupIds: [] as string[],
      staticMockupIds: [] as string[],
      videoMockupIds: [] as string[],
      fabricType: 'all' as 'light' | 'dark' | 'all',
      multiPrintAreaSupport: false,
    }
  );
  const [variationConfig, setVariationConfig] = useState(
    template?.variationConfig ?? {
      rows: [] as any[],
      sizes: [] as string[],
      colors: [] as string[],
      basePrice: 24.99,
    }
  );
  const [seoHints, setSeoHints] = useState(
    template?.seoHints ?? {
      productType: '',
      targetAudience: '',
      customNotes: '',
      primaryNiche: '',
    }
  );
  const [automationSchedule, setAutomationSchedule] = useState(
    template?.automationSchedule ?? {
      enabled: false,
      cronExpression: '0 9 * * *',
      timezone: 'America/New_York',
      nextRunAt: null as string | null,
      listingsPerRun: 1,
      publishMode: 'draft' as 'draft' | 'active',
    }
  );

  // Doğrulama
  const totalImages =
    (mockupConfig.printAreaMockupIds?.length ?? 0) +
    (mockupConfig.staticMockupIds?.length ?? 0);
  const totalVideos = mockupConfig.videoMockupIds?.length ?? 0;

  const getStepErrors = (step: Step): string[] => {
    const errors: string[] = [];
    if (step === 1) {
      if (totalImages > 20) errors.push('Toplam görsel sayısı 20\'yi aşamaz (Etsy limiti).');
      if (totalVideos > 2) errors.push('Video sayısı 2\'yi aşamaz (Etsy limiti).');
    }
    return errors;
  };

  const allStepErrors = [1, 2, 3, 4].flatMap(s => getStepErrors(s as Step));
  const currentErrors = getStepErrors(activeStep);
  const canProceed = currentErrors.length === 0;

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Lütfen bir şablon adı girin.');
      return;
    }
    if (allStepErrors.length > 0) {
      alert('Lütfen hataları düzeltin:\n' + allStepErrors.join('\n'));
      return;
    }
    try {
      setIsSaving(true);
      await onSave(
        {
          name: name.trim(),
          description: description.trim() || undefined,
          mockupConfig,
          variationConfig,
          seoHints,
          automationSchedule,
          isActive: true,
        },
        template?.id
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto p-3 sm:p-6">
      <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 my-4 flex flex-col">

        {/* Modal Başlık */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow">
              <LayoutTemplate className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {isEditing ? 'Şablonu Düzenle' : 'Yeni Şablon Oluştur'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isEditing ? template?.name : 'Otomasyon şablonunuzu adım adım yapılandırın'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Şablon Adı */}
        <div className="px-5 pt-4 pb-2">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Şablon adı (örn: Güneş Temalı T-Shirt Şablonu)"
            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
          />
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Açıklama (isteğe bağlı)"
            className="w-full mt-2 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-600 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
          />
        </div>

        {/* Adım Navigasyonu */}
        <div className="px-5 py-3">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl p-1">
            {STEPS.map(({ step, label, icon: Icon }) => {
              const stepErrors = getStepErrors(step);
              const isActive = activeStep === step;
              const isDone = step < activeStep;
              return (
                <button
                  key={step}
                  onClick={() => setActiveStep(step)}
                  className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 px-2 py-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md'
                      : isDone && stepErrors.length === 0
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                      : stepErrors.length > 0
                      ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700/50'
                  }`}
                >
                  {isDone && stepErrors.length === 0 ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : stepErrors.length > 0 ? (
                    <AlertCircle className="w-3.5 h-3.5" />
                  ) : (
                    <Icon className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">{label}</span>
                  <span className="sm:hidden text-[9px]">{step}</span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center">
            {STEPS.find(s => s.step === activeStep)?.description}
          </p>
        </div>

        {/* Adım İçeriği */}
        <div className="px-5 py-2 flex-1 min-h-[300px]">
          {activeStep === 1 && (
            <MockupSelectorSection
              mockups={mockups}
              config={mockupConfig}
              onChange={setMockupConfig}
            />
          )}
          {activeStep === 2 && (
            <VariationSection
              config={variationConfig}
              onChange={setVariationConfig}
            />
          )}
          {activeStep === 3 && (
            <SeoHintsSection
              hints={seoHints}
              onChange={setSeoHints}
            />
          )}
          {activeStep === 4 && (
            <ScheduleSection
              schedule={automationSchedule}
              onChange={setAutomationSchedule}
            />
          )}
        </div>

        {/* Hata Gösterimi */}
        {currentErrors.length > 0 && (
          <div className="mx-5 mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div className="text-xs text-red-700 dark:text-red-400 space-y-1">
              {currentErrors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          </div>
        )}

        {/* Alt Navigasyon */}
        <div className="flex items-center justify-between p-5 border-t border-slate-200 dark:border-slate-800 gap-3">
          <button
            onClick={() => setActiveStep(s => Math.max(1, s - 1) as Step)}
            disabled={activeStep === 1}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            Geri
          </button>

          <div className="flex items-center gap-1">
            {STEPS.map(({ step }) => (
              <div
                key={step}
                className={`rounded-full transition-all ${
                  step === activeStep
                    ? 'w-4 h-2 bg-amber-500'
                    : 'w-2 h-2 bg-slate-300 dark:bg-slate-600'
                }`}
              />
            ))}
          </div>

          {activeStep < 4 ? (
            <button
              onClick={() => setActiveStep(s => Math.min(4, s + 1) as Step)}
              disabled={!canProceed}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white rounded-xl text-sm font-bold shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              İleri
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={isSaving || !name.trim()}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Kaydediliyor...' : isEditing ? 'Güncelle' : 'Şablonu Kaydet'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
