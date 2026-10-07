'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  LayoutTemplate,
  Plus,
  Pencil,
  Trash2,
  Play,
  Pause,
  Clock,
  CheckCircle2,
  XCircle,
  Rocket,
  BarChart3,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { AutomationRun, AutomationStepName, PodTemplate, PodTemplateInput } from '@/types/templates';
import { MockupItem } from '@/types/pod';
import { useToast } from '@/components/common/ToastContext';
import { TemplateBuilderModal } from './TemplateBuilderModal';

interface TemplatesManagerProps {
  mockups: MockupItem[];
}

const POLL_INTERVAL_MS = 4000;
const ACTIVE_RUN_STATUSES = new Set<AutomationRun['status']>(['pending', 'running']);

const STEP_LABELS: Record<AutomationStepName, string> = {
  designGeneration: 'Tasarım üretimi',
  backgroundRemoval: 'Arka plan kaldırma',
  mockupRender: 'Mockup oluşturma',
  videoGeneration: 'Video üretimi',
  seoGeneration: 'SEO içeriği',
  listingCreation: 'Etsy ilanı',
};

/** Çalışan bir run'ın kullanıcıya gösterilecek mevcut adımı. */
function describeRunProgress(run: AutomationRun): string {
  if (run.status === 'pending') return 'Sırada bekliyor...';
  const steps = run.steps ? (Object.entries(run.steps) as Array<[AutomationStepName, { status: string }]>) : [];
  const running = steps.find(([, step]) => step.status === 'running');
  return running ? `${STEP_LABELS[running[0]]}...` : 'Çalışıyor...';
}

function formatRunDate(value: string | null): string {
  if (!value) return '';
  return new Date(value).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function TemplatesManager({ mockups }: TemplatesManagerProps) {
  const toast = useToast();
  const { error: showError, success: showSuccess } = toast;
  const [templates, setTemplates] = useState<PodTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PodTemplate | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);
  /** Şablon başına en son otomasyon çalıştırması. */
  const [latestRuns, setLatestRuns] = useState<Record<string, AutomationRun>>({});
  const pollTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const stopPolling = useCallback((templateId: string) => {
    clearTimeout(pollTimers.current[templateId]);
    delete pollTimers.current[templateId];
  }, []);

  useEffect(() => {
    const timers = pollTimers.current;
    return () => Object.values(timers).forEach(clearTimeout);
  }, []);

  // Devam eden bir çalıştırmayı bitene kadar takip et
  const pollRun = useCallback((templateId: string, runId: string) => {
    stopPolling(templateId);
    const tick = async () => {
      try {
        const res = await fetch(`/api/automation/poll/${runId}`);
        if (!res.ok) throw new Error('Durum alınamadı.');
        const { run } = (await res.json()) as { run: AutomationRun };
        setLatestRuns(prev => ({ ...prev, [templateId]: run }));
        if (ACTIVE_RUN_STATUSES.has(run.status)) {
          pollTimers.current[templateId] = setTimeout(tick, POLL_INTERVAL_MS);
          return;
        }
        delete pollTimers.current[templateId];
        if (run.status === 'completed') {
          showSuccess('Otomasyon tamamlandı. Üretilen görseller hazır.');
          setTemplates(prev => prev.map(t => t.id === templateId
            ? { ...t, lastRunAt: run.completedAt ?? t.lastRunAt, totalListingsGenerated: (t.totalListingsGenerated ?? 0) + 1 }
            : t));
        } else if (run.status === 'failed') {
          showError(run.errorMessage || 'Otomasyon başarısız oldu.');
        }
      } catch {
        // Geçici ağ hatalarında takibi bırakma; bir sonraki denemede tekrar sorulur.
        pollTimers.current[templateId] = setTimeout(tick, POLL_INTERVAL_MS * 2);
      }
    };
    pollTimers.current[templateId] = setTimeout(tick, POLL_INTERVAL_MS);
  }, [showError, showSuccess, stopPolling]);

  // Şablonları yükle
  const loadTemplates = useCallback(async () => {
    try {
      setIsLoading(true);
      const [res, runsRes] = await Promise.all([
        fetch('/api/templates'),
        fetch('/api/automation/run').catch(() => null),
      ]);
      if (!res.ok) throw new Error('Şablonlar yüklenemedi.');
      const data = await res.json();
      setTemplates(data.templates ?? []);

      // Çalıştırma geçmişi isteğe bağlıdır; alınamazsa şablonlar yine gösterilir.
      if (runsRes?.ok) {
        const { runs } = (await runsRes.json()) as { runs: AutomationRun[] };
        const latest: Record<string, AutomationRun> = {};
        for (const run of runs ?? []) {
          if (!latest[run.templateId]) latest[run.templateId] = run; // en yeniden eskiye sıralı
        }
        setLatestRuns(latest);
        Object.values(latest)
          .filter(run => ACTIVE_RUN_STATUSES.has(run.status))
          .forEach(run => pollRun(run.templateId, run.id));
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Şablonlar yüklenirken hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  }, [showError, pollRun]);

  // Şablonu şimdi çalıştır
  const handleRunNow = async (template: PodTemplate) => {
    try {
      setStartingId(template.id);
      const res = await fetch('/api/automation/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: template.id, triggerType: 'manual' }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && typeof data.runId === 'string') {
        toast.info('Bu şablon zaten çalışıyor; ilerlemesi takip ediliyor.');
        pollRun(template.id, data.runId);
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Otomasyon başlatılamadı.');
      const now = new Date().toISOString();
      setLatestRuns(prev => ({
        ...prev,
        [template.id]: { id: data.runId, templateId: template.id, status: 'pending', createdAt: now } as AutomationRun,
      }));
      toast.info(`"${template.name}" için otomasyon başlatıldı.`);
      pollRun(template.id, data.runId);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Otomasyon başlatılamadı.');
    } finally {
      setStartingId(null);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Şablon sil
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" şablonunu silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) return;
    try {
      setDeletingId(id);
      const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Şablon silinemedi.');
      setTemplates(prev => prev.filter(t => t.id !== id));
      stopPolling(id);
      toast.success(`"${name}" şablonu silindi.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Silme işlemi başarısız.');
    } finally {
      setDeletingId(null);
    }
  };

  // Şablonu aktif/pasif yap
  const handleToggleActive = async (template: PodTemplate) => {
    try {
      setTogglingId(template.id);
      const res = await fetch(`/api/templates/${template.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !template.isActive }),
      });
      if (!res.ok) throw new Error('Durum güncellenemedi.');
      const data = await res.json();
      setTemplates(prev => prev.map(t => t.id === template.id ? data.template : t));
      toast.success(data.template.isActive ? 'Şablon aktif edildi.' : 'Şablon pasife alındı.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Durum güncellenemedi.');
    } finally {
      setTogglingId(null);
    }
  };

  // Şablon kaydet (oluştur / güncelle)
  const handleSaveTemplate = async (data: PodTemplateInput, id?: string) => {
    try {
      const url = id ? `/api/templates/${id}` : '/api/templates';
      const method = id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Şablon kaydedilemedi.');
      }
      const result = await res.json();
      if (id) {
        setTemplates(prev => prev.map(t => t.id === id ? result.template : t));
        toast.success('Şablon güncellendi!');
      } else {
        setTemplates(prev => [result.template, ...prev]);
        toast.success('Yeni şablon oluşturuldu!');
      }
      setIsBuilderOpen(false);
      setEditingTemplate(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kaydetme başarısız.');
    }
  };

  // Mockup sayılarını hesapla
  const getMockupCounts = (template: PodTemplate) => {
    const print = template.mockupConfig?.printAreaMockupIds?.length ?? 0;
    const staticM = template.mockupConfig?.staticMockupIds?.length ?? 0;
    const video = template.mockupConfig?.videoMockupIds?.length ?? 0;
    return { print, staticM, video, total: print + staticM };
  };

  // Zamanlama etiketi
  const getScheduleLabel = (template: PodTemplate) => {
    if (!template.automationSchedule?.enabled) return null;
    const cron = template.automationSchedule.cronExpression;
    const presets: Record<string, string> = {
      '0 9 * * *': 'Her gün 09:00',
      '0 9 * * 1': 'Her Pazartesi 09:00',
      '0 9 1 * *': 'Her ayın 1\'i',
      '0 */6 * * *': 'Her 6 saatte bir',
      '0 */12 * * *': 'Her 12 saatte bir',
    };
    return presets[cron] ?? cron;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Şablonlar yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Başlık */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center shadow">
              <LayoutTemplate className="w-4 h-4 text-white" />
            </div>
            Otomasyon Şablonları
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Her şablon, kur-ve-unut mantığıyla otomatik listing üretir. Mockupları, varyasyonları, SEO ipuçlarını ve zamanlamayı bir kere ayarlayın — gerisini sistem halleder.
          </p>
        </div>
        <button
          onClick={() => { setEditingTemplate(null); setIsBuilderOpen(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold text-sm rounded-xl shadow-lg shadow-amber-500/25 transition-all active:scale-95 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Yeni Şablon
        </button>
      </div>

      {/* İstatistik Özeti */}
      {templates.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: 'Toplam Şablon',
              value: templates.length,
              icon: LayoutTemplate,
              color: 'text-amber-600 dark:text-amber-400',
              bg: 'bg-amber-50 dark:bg-amber-500/10',
            },
            {
              label: 'Aktif Şablon',
              value: templates.filter(t => t.isActive).length,
              icon: CheckCircle2,
              color: 'text-emerald-600 dark:text-emerald-400',
              bg: 'bg-emerald-50 dark:bg-emerald-500/10',
            },
            {
              label: 'Zamanlanmış',
              value: templates.filter(t => t.automationSchedule?.enabled).length,
              icon: Clock,
              color: 'text-indigo-600 dark:text-indigo-400',
              bg: 'bg-indigo-50 dark:bg-indigo-500/10',
            },
            {
              label: 'Toplam Listing',
              value: templates.reduce((s, t) => s + (t.totalListingsGenerated ?? 0), 0),
              icon: BarChart3,
              color: 'text-purple-600 dark:text-purple-400',
              bg: 'bg-purple-50 dark:bg-purple-500/10',
            },
          ].map(stat => (
            <div
              key={stat.label}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-3"
            >
              <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{stat.label}</p>
                <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Şablon Listesi */}
      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-5 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center">
            <LayoutTemplate className="w-8 h-8 text-amber-500" />
          </div>
          <div className="text-center">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Henüz şablon yok</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
              İlk şablonunuzu oluşturun. Mockupları, varyasyonları ve SEO ayarlarını bir kere yapılandırın — sistem otomatik olarak Etsy listingleri üretsin.
            </p>
          </div>
          <button
            onClick={() => { setEditingTemplate(null); setIsBuilderOpen(true); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold text-sm rounded-xl shadow-lg shadow-amber-500/25 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            İlk Şablonu Oluştur
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {templates.map(template => {
            const { video, total } = getMockupCounts(template);
            const scheduleLabel = getScheduleLabel(template);
            const isDeleting = deletingId === template.id;
            const isToggling = togglingId === template.id;
            const variationCount = template.variationConfig?.rows?.filter(r => r.enabled)?.length ?? 0;
            const latestRun = latestRuns[template.id];
            const isRunActive = latestRun ? ACTIVE_RUN_STATUSES.has(latestRun.status) : false;
            const isStarting = startingId === template.id;

            return (
              <div
                key={template.id}
                className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group ${
                  template.isActive
                    ? 'border-slate-200 dark:border-slate-700'
                    : 'border-slate-200/60 dark:border-slate-800 opacity-60'
                }`}
              >
                {/* Şablon Başlık */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                      template.isActive
                        ? 'bg-gradient-to-br from-amber-500 to-orange-500'
                        : 'bg-slate-200 dark:bg-slate-700'
                    }`}>
                      <LayoutTemplate className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {template.name}
                      </h3>
                      {template.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{template.description}</p>
                      )}
                    </div>
                  </div>

                  {/* Durum badge */}
                  <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                    template.isActive
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                  }`}>
                    {template.isActive ? '● Aktif' : '○ Pasif'}
                  </span>
                </div>

                {/* Şablon Özellikleri */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { label: 'Görsel', value: total, max: 20, icon: '🖼️' },
                    { label: 'Video', value: video, max: 2, icon: '🎬' },
                    { label: 'Varyasyon', value: variationCount, max: null, icon: '🎨' },
                  ].map(item => (
                    <div key={item.label} className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-2.5 text-center">
                      <p className="text-base">{item.icon}</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {item.value}{item.max && <span className="text-xs font-normal text-slate-400">/{item.max}</span>}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">{item.label}</p>
                    </div>
                  ))}
                </div>

                {/* SEO & Kumaş Tipi */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {template.seoHints?.productType && (
                    <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 text-[10px] font-semibold rounded-full border border-indigo-200 dark:border-indigo-500/30">
                      {template.seoHints.productType}
                    </span>
                  )}
                  {template.seoHints?.primaryNiche && (
                    <span className="px-2 py-0.5 bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 text-[10px] font-semibold rounded-full border border-purple-200 dark:border-purple-500/30">
                      {template.seoHints.primaryNiche}
                    </span>
                  )}
                  <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${
                    template.mockupConfig?.fabricType === 'light'
                      ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30'
                      : template.mockupConfig?.fabricType === 'dark'
                      ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                  }`}>
                    {template.mockupConfig?.fabricType === 'light' ? '☀️ Açık Kumaş' : template.mockupConfig?.fabricType === 'dark' ? '🌑 Koyu Kumaş' : '✦ Tüm Kumaşlar'}
                  </span>
                </div>

                {/* Zamanlama */}
                {scheduleLabel && (
                  <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-200 dark:border-indigo-500/30">
                    <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">{scheduleLabel}</span>
                    <span className="ml-auto text-[10px] text-indigo-500 font-medium">
                      {template.automationSchedule.publishMode === 'active' ? 'Direkt Yayın' : 'Taslak'}
                    </span>
                  </div>
                )}

                {/* Son çalışma */}
                {template.lastRunAt && (
                  <div className="flex items-center gap-1.5 mb-4 text-xs text-slate-400">
                    <RefreshCw className="w-3 h-3" />
                    <span>Son çalışma: {new Date(template.lastRunAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    {template.totalListingsGenerated > 0 && (
                      <span className="ml-auto font-semibold text-slate-500">
                        {template.totalListingsGenerated} listing üretildi
                      </span>
                    )}
                  </div>
                )}

                {/* Son otomasyon çalıştırması */}
                {latestRun && (
                  <div
                    className={`flex items-start gap-2 mb-4 px-3 py-2 rounded-xl border text-xs ${
                      isRunActive
                        ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300'
                        : latestRun.status === 'completed'
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                        : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300'
                    }`}
                  >
                    {isRunActive ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 mt-px" />
                    ) : latestRun.status === 'completed' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-px" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        {isRunActive
                          ? describeRunProgress(latestRun)
                          : latestRun.status === 'completed'
                          ? `Son çalıştırma başarılı · ${formatRunDate(latestRun.completedAt)}`
                          : `Son çalıştırma başarısız · ${formatRunDate(latestRun.completedAt ?? latestRun.createdAt)}`}
                      </p>
                      {latestRun.status === 'failed' && latestRun.errorMessage && (
                        <p className="mt-0.5 break-words opacity-80 line-clamp-2">{latestRun.errorMessage}</p>
                      )}
                      {latestRun.status === 'completed' && (latestRun.generatedMockupUrls?.length ?? 0) > 0 && (
                        <div className="mt-2 flex gap-1.5 overflow-x-auto">
                          {latestRun.generatedMockupUrls.slice(0, 6).map(url => (
                            <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                              <img src={url} alt="Üretilen mockup" loading="lazy" className="w-12 h-12 rounded-lg object-cover border border-emerald-200 dark:border-emerald-500/30 bg-white" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Aksiyonlar */}
                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  {/* Şimdi çalıştır */}
                  <button
                    onClick={() => handleRunNow(template)}
                    disabled={!template.isActive || isRunActive || isStarting}
                    title={!template.isActive ? 'Pasif şablonlar çalıştırılamaz' : undefined}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isStarting || isRunActive ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Rocket className="w-3 h-3" />
                    )}
                    {isRunActive ? 'Çalışıyor' : 'Şimdi Çalıştır'}
                  </button>

                  {/* Aktif/Pasif Toggle */}
                  <button
                    onClick={() => handleToggleActive(template)}
                    disabled={isToggling}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      template.isActive
                        ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/20 border border-amber-200 dark:border-amber-500/30'
                        : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30'
                    }`}
                  >
                    {isToggling ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : template.isActive ? (
                      <Pause className="w-3 h-3" />
                    ) : (
                      <Play className="w-3 h-3" />
                    )}
                    {template.isActive ? 'Pasife Al' : 'Aktif Et'}
                  </button>

                  {/* Düzenle */}
                  <button
                    onClick={() => { setEditingTemplate(template); setIsBuilderOpen(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-semibold transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
                  >
                    <Pencil className="w-3 h-3" />
                    Düzenle
                  </button>

                  {/* Sil */}
                  <button
                    onClick={() => handleDelete(template.id, template.name)}
                    disabled={isDeleting}
                    className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg text-xs font-semibold transition-all cursor-pointer border border-red-200 dark:border-red-500/30"
                  >
                    {isDeleting ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                    Sil
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Şablon Oluşturucu Modal */}
      {isBuilderOpen && (
        <TemplateBuilderModal
          mockups={mockups}
          template={editingTemplate}
          onSave={handleSaveTemplate}
          onClose={() => { setIsBuilderOpen(false); setEditingTemplate(null); }}
        />
      )}
    </div>
  );
}
