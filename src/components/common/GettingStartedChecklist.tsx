'use client';

import React from 'react';
import { CheckCircle2, Circle, Sparkles, X, ArrowRight } from 'lucide-react';
import type { TabKey } from '@/components/common/Header';
import { openListingsView } from '@/components/listings/listings-view';
import type { DesignItem, MockupItem } from '@/types/pod';

interface GettingStartedChecklistProps {
  mockups: MockupItem[];
  designs: DesignItem[];
  hasGenerated: boolean;
  isSignedIn: boolean;
  onNavigate: (tab: TabKey) => void;
  onLogin: () => void;
  onLoadSample: () => void;
  onDismiss: () => void;
}

type Step = { id: string; label: string; hint: string; done: boolean; action: () => void; actionLabel: string };

/**
 * İlk kullanımda iş akışını adım adım gösteren kontrol listesi. Adımların durumu çalışma alanı
 * verisinden türetilir; böylece "neden hiçbir şey üretilmedi?" gibi gizli önkoşullar görünür olur.
 */
export const GettingStartedChecklist: React.FC<GettingStartedChecklistProps> = ({
  mockups,
  designs,
  hasGenerated,
  isSignedIn,
  onNavigate,
  onLogin,
  onLoadSample,
  onDismiss,
}) => {
  const hasPrintArea = mockups.some((m) => !m.isVideo && m.hasPrintArea !== false && (m.printAreas?.length ?? 0) > 0);
  const steps: Step[] = [
    { id: 'mockup', label: 'Mockup ekleyin', hint: 'Ürün fotoğraflarınızı "1. Mockup\'lar" sekmesine yükleyin.', done: mockups.length > 0, action: () => onNavigate('mockups'), actionLabel: 'Mockup\'lara git' },
    { id: 'area', label: 'Baskı alanını yerleştirin', hint: 'Tasarımın mockup üzerinde nereye basılacağını belirleyin ve kaydedin.', done: hasPrintArea, action: () => onNavigate('mockups'), actionLabel: 'Baskı alanı çiz' },
    { id: 'design', label: 'Tasarım yükleyin', hint: 'Şeffaf PNG tasarımınızı yükleyin ya da AI ile üretin.', done: designs.length > 0, action: () => onNavigate('designs'), actionLabel: 'Tasarımlara git' },
    { id: 'active', label: 'Tasarımı üretime alın', hint: 'Üretim yalnızca "aktif" tasarımlarla yapılır; kartın menüsünden aktif edin.', done: designs.some((d) => d.isSelected), action: () => onNavigate('designs'), actionLabel: 'Tasarımı aktif et' },
    { id: 'generate', label: 'Görselleri üretin', hint: 'Mockup ve tasarımları eşleştirip ilan görsellerini oluşturun.', done: hasGenerated, action: () => onNavigate('generator'), actionLabel: 'Üretime git' },
    {
      id: 'publish',
      label: isSignedIn ? 'Etsy\'de yayınlayın' : 'Giriş yapıp Etsy\'de yayınlayın',
      hint: isSignedIn ? 'Üretim sekmesinde "İlan Oluştur"a dokunun; ilan metni otomatik hazırlanır, Hazır İlanlar\'dan yayınlayın veya zamanlayın.' : 'SEO ve Etsy yayını için hesap gerekir; taslaklarınız girişten sonra hesabınıza aktarılır.',
      done: false,
      action: isSignedIn ? () => { openListingsView('review'); onNavigate('listings'); } : onLogin,
      actionLabel: isSignedIn ? 'Hazır İlanlar\'a git' : 'Giriş yap',
    },
  ];

  const nextStep = steps.find((step) => !step.done);
  const completed = steps.filter((step) => step.done).length;
  const isEmpty = mockups.length === 0 && designs.length === 0;

  return (
    <section aria-labelledby="getting-started-title" className="mb-4 rounded-2xl border border-indigo-200 dark:border-indigo-500/30 bg-white dark:bg-slate-900/90 p-4 sm:p-5 shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="getting-started-title" className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            Başlangıç Rehberi
            <span className="text-[11px] font-semibold text-slate-500">({completed}/{steps.length})</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">İlk Etsy ilanınıza giden adımlar. Tamamladıkça işaretlenir.</p>
        </div>
        <button type="button" onClick={onDismiss} aria-label="Başlangıç rehberini kapat" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white bg-slate-100 dark:bg-slate-800 shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <ol className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {steps.map((step, index) => {
          const isNext = step === nextStep;
          return (
            <li
              key={step.id}
              className={`flex items-start gap-2 rounded-xl border p-2.5 text-xs ${
                step.done
                  ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-500/5'
                  : isNext
                    ? 'border-indigo-300 dark:border-indigo-500/50 bg-indigo-50/60 dark:bg-indigo-500/10'
                    : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              {step.done
                ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" aria-label="Tamamlandı" />
                : <Circle className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0 mt-0.5" aria-label="Bekliyor" />}
              <div className="min-w-0 flex-1">
                <p className={`font-semibold ${step.done ? 'text-emerald-800 dark:text-emerald-300' : 'text-slate-800 dark:text-slate-100'}`}>
                  {index + 1}. {step.label}
                </p>
                {!step.done && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{step.hint}</p>}
                {isNext && (
                  <button type="button" onClick={step.action} className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                    {step.actionLabel} <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {isEmpty && (
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 text-xs text-slate-600 dark:text-slate-300">
          <span className="flex-1">Önce denemek mi istersiniz? Hazır mockup ve örnek tasarımlarla tüm akışı görebilirsiniz.</span>
          <button type="button" onClick={onLoadSample} className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Örnek Taslağı Yükle
          </button>
        </div>
      )}
    </section>
  );
};
