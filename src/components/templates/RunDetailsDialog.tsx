'use client';

import React from 'react';
import { X, CheckCircle2, XCircle, MinusCircle, Circle, ExternalLink, AlertTriangle } from 'lucide-react';
import type { AutomationRun, AutomationStepName, AutomationStepResult, GeneratedSeoData } from '@/types/templates';
import { DialogPanel } from '@/components/common/DialogPanel';
import { AUTOMATION_STEP_ORDER } from '@/lib/automation-plan';
import { Spinner } from '@/components/common/Spinner';

export const STEP_LABELS: Record<AutomationStepName, string> = {
  nicheResearch: 'Niş araştırması',
  designGeneration: 'Tasarım üretimi',
  backgroundRemoval: 'Arka plan kaldırma',
  mockupRender: 'Mockup oluşturma',
  videoGeneration: 'Video',
  seoGeneration: 'SEO metni',
  listingCreation: 'Etsy ilanı',
};

const STATUS_LABELS: Record<AutomationRun['status'], string> = {
  pending: 'Sırada',
  running: 'Çalışıyor',
  completed: 'Tamamlandı',
  failed: 'Başarısız',
  cancelled: 'İptal edildi',
};

const REVIEW_LABELS: Record<string, string> = {
  awaiting: 'Hazır İlanlar\'da incelemenizi bekliyor',
  scheduled: 'Onaylandı, yayın zamanı bekleniyor',
  publishing: 'Etsy\'de yayınlanıyor',
  published: 'Etsy\'de yayında',
  rejected: 'Reddedildi',
  failed: 'Yayınlanamadı; Hazır İlanlar\'dan yeniden deneyin',
};

/** Etsy taslağının bağlantısı (ilan adımı çıktısından veya kimlikten). */
export function getRunListingUrl(run: AutomationRun): string | null {
  const output = run.steps?.listingCreation?.output as { listingUrl?: unknown; review?: { listingUrl?: unknown } } | undefined;
  if (typeof output?.listingUrl === 'string') return output.listingUrl;
  if (typeof output?.review?.listingUrl === 'string') return output.review.listingUrl;
  return run.etsyListingId ? `https://www.etsy.com/your/shops/me/listing-editor/edit/${run.etsyListingId}` : null;
}

/** Adım çıktılarındaki uyarılar (ör. bazı görseller yüklenemedi). */
export function getRunWarnings(run: AutomationRun): string[] {
  return AUTOMATION_STEP_ORDER
    .map((name) => (run.steps?.[name]?.output as { warning?: unknown } | undefined)?.warning)
    .filter((warning): warning is string => typeof warning === 'string' && warning.length > 0);
}

type ResearchSummary = {
  niche?: string;
  occasion?: string | null;
  targetAudience?: string;
  style?: string;
  reasoning?: string;
  sources?: Array<{ title: string; url: string }>;
};

function StepIcon({ status }: { status: AutomationStepResult['status'] }) {
  if (status === 'completed') return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" aria-label="Tamamlandı" />;
  if (status === 'failed') return <XCircle className="w-4 h-4 text-red-500 shrink-0" aria-label="Başarısız" />;
  if (status === 'running') return <Spinner className="w-4 h-4 text-amber-500 shrink-0" label="Çalışıyor" />;
  if (status === 'skipped') return <MinusCircle className="w-4 h-4 text-slate-400 shrink-0" aria-label="Atlandı" />;
  return <Circle className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" aria-label="Bekliyor" />;
}

export function RunDetailsDialog({ run, templateName, onClose, onCancel, isCancelling }: {
  run: AutomationRun;
  templateName: string;
  onClose: () => void;
  onCancel?: () => void;
  isCancelling?: boolean;
}) {
  const seo = run.generatedSeo as GeneratedSeoData | null;
  const research = run.steps?.nicheResearch?.output as ResearchSummary | undefined;
  const listingUrl = getRunListingUrl(run);
  const warnings = getRunWarnings(run);
  const isActive = run.status === 'pending' || run.status === 'running';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto p-3 sm:p-6" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <DialogPanel aria-labelledby="run-details-title" onClose={onClose} className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 my-4">
        <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-200 dark:border-slate-800">
          <div className="min-w-0">
            <h2 id="run-details-title" className="text-base font-bold text-slate-900 dark:text-white truncate">Çalıştırma Ayrıntıları</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {templateName} · {STATUS_LABELS[run.status]} · {run.triggerType === 'scheduled' ? 'Zamanlanmış' : 'Manuel'} · {new Date(run.createdAt).toLocaleString('tr-TR')}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Kapat" className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-xl">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Adımlar */}
          <ol className="space-y-1.5">
            {AUTOMATION_STEP_ORDER.map((name) => {
              const step = run.steps?.[name] ?? { status: 'pending' as const };
              return (
                <li key={name} className="flex items-start gap-2 text-xs">
                  <StepIcon status={step.status} />
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{STEP_LABELS[name]}</span>
                    {name === 'listingCreation' && (step.output as { review?: { status?: string } } | undefined)?.review && (
                      <p className="mt-0.5 text-indigo-600 dark:text-indigo-300">{REVIEW_LABELS[(step.output as { review: { status: string } }).review.status] ?? 'Hazır İlanlar\'da'}</p>
                    )}
                    {step.error && <p className={`mt-0.5 break-words ${step.status === 'failed' ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>{step.error}</p>}
                  </div>
                </li>
              );
            })}
          </ol>

          {run.errorMessage && run.status !== 'completed' && (
            <p role="alert" className="text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-xl p-3 break-words">{run.errorMessage}</p>
          )}
          {warnings.length > 0 && (
            <div className="text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30 rounded-xl p-3 space-y-1">
              {warnings.map((warning) => <p key={warning} className="flex gap-1.5 break-words"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />{warning}</p>)}
            </div>
          )}

          {/* Niş araştırması: seçilen konu ve nedeni */}
          {research?.niche && (
            <section aria-label="Niş araştırması" className="rounded-xl border border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/10 p-3 space-y-1.5">
              <h3 className="text-xs font-bold text-violet-800 dark:text-violet-300">
                Seçilen niş: {research.niche}{research.occasion ? ` · ${research.occasion}` : ''}
              </h3>
              {(research.targetAudience || research.style) && (
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  {research.targetAudience && <>Hedef kitle: <strong>{research.targetAudience}</strong></>}
                  {research.targetAudience && research.style && ' · '}
                  {research.style && <>Stil: <strong>{research.style}</strong></>}
                </p>
              )}
              {research.reasoning && <p className="text-[11px] text-slate-600 dark:text-slate-300">{research.reasoning}</p>}
              {(research.sources?.length ?? 0) > 0 && (
                <details className="text-[11px] text-slate-600 dark:text-slate-300">
                  <summary className="cursor-pointer font-semibold">Web kaynakları ({research.sources!.length})</summary>
                  <ul className="mt-1 space-y-0.5 list-disc pl-4">
                    {research.sources!.map((source) => (
                      <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer" className="underline break-all">{source.title || source.url}</a></li>
                    ))}
                  </ul>
                </details>
              )}
            </section>
          )}

          {/* Çıktılar */}
          {(run.generatedDesignUrl || (run.generatedMockupUrls?.length ?? 0) > 0) && (
            <section aria-label="Üretilen görseller" className="space-y-2">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">Üretilen görseller</h3>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {run.generatedDesignUrl && (
                  <a href={run.generatedDesignUrl} target="_blank" rel="noopener noreferrer" className="shrink-0" title="Tasarım">
                    <img src={run.generatedDesignUrl} alt="Üretilen tasarım" loading="lazy" className="w-20 h-20 rounded-xl object-contain border border-slate-200 dark:border-slate-700 bg-[repeating-conic-gradient(#e2e8f0_0%_25%,#fff_0%_50%)] bg-[length:16px_16px]" />
                  </a>
                )}
                {(run.generatedMockupUrls ?? []).map((url, index) => (
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                    <img src={url} alt={`Mockup ${index + 1}`} loading="lazy" className="w-20 h-20 rounded-xl object-cover border border-slate-200 dark:border-slate-700 bg-white" />
                  </a>
                ))}
              </div>
              {run.generatedVideoUrl && run.generatedVideoUrl.startsWith('/') && (
                <video src={run.generatedVideoUrl} controls muted playsInline className="w-full max-w-xs rounded-xl border border-slate-200 dark:border-slate-700" />
              )}
            </section>
          )}

          {seo?.title && (
            <section aria-label="SEO metni" className="space-y-1.5">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">SEO metni</h3>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{seo.title}</p>
              {seo.shopSectionTitle && <p className="text-[11px] text-slate-500 dark:text-slate-400">Mağaza bölümü: <strong>{seo.shopSectionTitle}</strong></p>}
              <div className="flex flex-wrap gap-1">
                {(seo.tags ?? []).map((tag) => (
                  <span key={tag} className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-600 dark:text-slate-300">{tag}</span>
                ))}
              </div>
              <details className="text-xs text-slate-600 dark:text-slate-300">
                <summary className="cursor-pointer font-semibold">Açıklama</summary>
                <p className="mt-1 whitespace-pre-line">{seo.description}</p>
              </details>
            </section>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 p-5 border-t border-slate-200 dark:border-slate-800">
          {isActive && onCancel && (
            <button type="button" onClick={onCancel} disabled={isCancelling} className="px-4 py-2 rounded-xl border border-red-200 dark:border-red-500/40 text-red-600 dark:text-red-400 text-xs font-bold disabled:opacity-50">
              {isCancelling ? 'İptal ediliyor…' : 'Çalıştırmayı iptal et'}
            </button>
          )}
          {listingUrl && (
            <a href={listingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold">
              <ExternalLink className="w-3.5 h-3.5" /> Etsy ilanını aç
            </a>
          )}
        </div>
      </DialogPanel>
    </div>
  );
}
