'use client';

/**
 * Hazır İlanlar: otomasyonun ürettiği ilanlar Etsy'ye gitmeden önce burada incelenir. İlan düzenlenir,
 * hemen yayınlanır, ileri bir tarihe zamanlanır (tek tek veya toplu, aralıklı) ya da reddedilir.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarClock, CheckCircle2, ClipboardCheck, ExternalLink, RefreshCw, Rocket, RotateCcw, Trash2, XCircle, AlertTriangle, Film,
} from 'lucide-react';
import { useToast } from '@/components/common/ToastContext';
import { Spinner } from '@/components/common/Spinner';
import type { ListingReviewStatus } from '@/types/templates';
import { ListingReviewEditor } from './ListingReviewEditor';
import type { ReviewItemView } from './types';
import { formatDateTime, schedulePresets, STATUS_BADGES, toLocalInputValue } from './format';

type Filter = 'awaiting' | 'scheduled' | 'published' | 'rejected';

const FILTERS: Array<{ key: Filter; label: string; statuses: ListingReviewStatus[] }> = [
  { key: 'awaiting', label: 'İnceleme bekliyor', statuses: ['awaiting', 'failed'] },
  { key: 'scheduled', label: 'Zamanlandı', statuses: ['scheduled', 'publishing'] },
  { key: 'published', label: 'Yayınlandı', statuses: ['published'] },
  { key: 'rejected', label: 'Reddedildi', statuses: ['rejected'] },
];

const INTERVAL_OPTIONS = [
  { minutes: 0, label: 'Hepsi aynı anda' },
  { minutes: 60, label: '1 saat arayla' },
  { minutes: 180, label: '3 saat arayla' },
  { minutes: 360, label: '6 saat arayla' },
  { minutes: 720, label: '12 saat arayla' },
  { minutes: 1440, label: 'Günde bir' },
];

export function ListingReviewQueue() {
  const toast = useToast();
  const [items, setItems] = useState<ReviewItemView[] | null>(null);
  const [filter, setFilter] = useState<Filter>('awaiting');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [startAt, setStartAt] = useState(() => toLocalInputValue(new Date(Date.now() + 60 * 60_000)));
  const [interval, setIntervalMinutes] = useState(360);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/listing-review', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Liste alınamadı.');
      setItems(data.items);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Liste alınamadı.');
      setItems((current) => current ?? []);
    }
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/listing-review', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => { if (!cancelled) setItems(data.success ? data.items : []); })
      .catch(() => { if (!cancelled) setItems([]); });
    return () => { cancelled = true; };
  }, []);

  // Metni hazırlanan (manuel üretim) ilan varken liste kendiliğinden yenilenir.
  const hasPreparing = Boolean(items?.some((i) => i.preparing));
  useEffect(() => {
    if (!hasPreparing) return;
    const timer = window.setInterval(() => { void load(); }, 10_000);
    return () => window.clearInterval(timer);
  }, [hasPreparing, load]);

  const retry = async (runId: string) => {
    const res = await fetch(`/api/listing-review/${runId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'retry' }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) toast.error(data.error || 'Yeniden denenemedi.');
    else toast.info('İlan metni yeniden hazırlanıyor.');
    await load();
  };

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, (items ?? []).filter((i) => f.statuses.includes(i.review.status)).length])) as Record<Filter, number>, [items]);
  const visible = useMemo(() => {
    const statuses = FILTERS.find((f) => f.key === filter)!.statuses;
    const list = (items ?? []).filter((i) => statuses.includes(i.review.status));
    // Zamanlananlar yayın sırasına göre, diğerleri en yeni önce.
    return filter === 'scheduled'
      ? [...list].sort((a, b) => (a.review.scheduledAt ?? '').localeCompare(b.review.scheduledAt ?? ''))
      : list;
  }, [items, filter]);
  const selectedVisible = visible.filter((i) => selected.has(i.runId));
  const opened = items?.find((i) => i.runId === openId) ?? null;

  const toggle = (runId: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(runId)) next.delete(runId); else next.add(runId);
    return next;
  });

  const bulk = async (action: 'schedule' | 'unschedule' | 'reject', options: { startAt?: string | null; intervalMinutes?: number } = {}) => {
    if (selectedVisible.length === 0) return;
    setBusy(true);
    try {
      const res = await fetch('/api/listing-review/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runIds: selectedVisible.map((i) => i.runId), action, ...options }),
      });
      const data = await res.json();
      if (data.done?.length) {
        const verb = action === 'schedule' ? (options.startAt ? 'zamanlandı' : 'yayına gönderildi') : action === 'reject' ? 'reddedildi' : 'incelemeye geri alındı';
        toast.success(`${data.done.length} ilan ${verb}.`);
      }
      if (data.errors?.length) toast.error(`${data.errors.length} ilan işlenemedi: ${data.errors[0].error}`);
      setSelected(new Set());
      setShowSchedule(false);
      await load();
    } catch {
      toast.error('İşlem tamamlanamadı.');
    } finally {
      setBusy(false);
    }
  };

  const scheduleSelected = () => {
    const date = new Date(startAt);
    if (Number.isNaN(date.getTime())) return toast.error('Geçerli bir başlangıç zamanı seçin.');
    void bulk('schedule', { startAt: date.toISOString(), intervalMinutes: interval });
  };

  if (items === null) {
    return <div className="flex items-center gap-2 text-sm text-slate-500 p-6"><Spinner className="w-4 h-4" /> Hazır ilanlar yükleniyor…</div>;
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><ClipboardCheck className="w-5 h-5 text-indigo-500" /> Hazır İlanlar</h2>
          <button type="button" onClick={() => void load()} aria-label="Yenile" title="Yenile" className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
          Otomasyonların ve Üretim&apos;de &quot;İlan Oluştur&quot; ile gönderdiğiniz ilanlar burada. Dokunup düzenleyin, hemen yayınlayın veya zamanlayın.
        </p>
      </div>

      <div role="tablist" aria-label="İlan durumu" className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => { setFilter(f.key); setSelected(new Set()); setShowSchedule(false); }}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-colors ${
              filter === f.key
                ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
            }`}
          >
            {f.label}<span className="ml-1 opacity-60">{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {(filter === 'awaiting' || filter === 'scheduled' || filter === 'rejected') && visible.length > 0 && (
        <div className={`flex flex-col gap-3 ${selectedVisible.length > 0 ? 'p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900' : ''}`}>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 accent-indigo-600"
                checked={selectedVisible.length === visible.length}
                onChange={(e) => setSelected(e.target.checked ? new Set(visible.map((i) => i.runId)) : new Set())}
              />
              {selectedVisible.length > 0 ? `${selectedVisible.length}/${visible.length} seçili` : `Tümünü seç (${visible.length})`}
            </label>
            {selectedVisible.length > 0 && filter === 'awaiting' && (
              <>
                <button type="button" disabled={busy} onClick={() => setShowSchedule((v) => !v)} className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center gap-1.5 disabled:opacity-60">
                  <CalendarClock className="w-3.5 h-3.5" /> Zamanla
                </button>
                <button type="button" disabled={busy} onClick={() => void bulk('schedule', { startAt: null, intervalMinutes: 0 })} className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 disabled:opacity-60">
                  <Rocket className="w-3.5 h-3.5" /> Şimdi yayınla
                </button>
                <button type="button" disabled={busy} onClick={() => void bulk('reject')} className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold flex items-center gap-1.5 disabled:opacity-60">
                  <Trash2 className="w-3.5 h-3.5" /> Reddet
                </button>
              </>
            )}
            {selectedVisible.length > 0 && filter === 'scheduled' && (
              <button type="button" disabled={busy} onClick={() => void bulk('unschedule')} className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold flex items-center gap-1.5 disabled:opacity-60">
                <RotateCcw className="w-3.5 h-3.5" /> Zamanlamayı kaldır
              </button>
            )}
            {busy && <Spinner className="w-4 h-4" />}
          </div>
          {showSchedule && filter === 'awaiting' && selectedVisible.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              {schedulePresets(new Date(), selectedVisible.length > 1).map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  disabled={busy}
                  onClick={() => void bulk('schedule', { startAt: preset.at.toISOString(), intervalMinutes: preset.intervalMinutes ?? (selectedVisible.length > 1 ? interval : 0) })}
                  className="px-3 py-1.5 rounded-full border border-indigo-200 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-500/20 disabled:opacity-60"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}
          {showSchedule && filter === 'awaiting' && selectedVisible.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-end gap-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex flex-col gap-1">
                Özel zaman (ilk yayın)
                <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs" />
              </label>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex flex-col gap-1">
                Sonrakiler
                <select value={interval} onChange={(e) => setIntervalMinutes(Number(e.target.value))} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs">
                  {INTERVAL_OPTIONS.map((o) => <option key={o.minutes} value={o.minutes}>{o.label}</option>)}
                </select>
              </label>
              <button type="button" disabled={busy} onClick={scheduleSelected} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold disabled:opacity-60">
                {selectedVisible.length} ilanı zamanla
              </button>
            </div>
          )}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="p-8 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400 space-y-3">
          <p>
            {filter === 'awaiting'
              ? 'İnceleme bekleyen ilan yok. Üretim sekmesinde görselleri üretip "İlan Oluştur"a dokunun veya bir otomasyon çalıştırın.'
              : 'Bu bölümde ilan yok.'}
          </p>
        </div>
      ) : (
        // Etsy arama sonuçları gibi: telefonda iki sütun, büyük ekranda beş sütuna kadar kompakt kartlar.
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-3 gap-y-5 sm:gap-x-4">
          {visible.map((item) => {
            const badge = STATUS_BADGES[item.review.status];
            const photos = item.review.photos ?? item.photos;
            const canSelect = filter !== 'published' && !item.preparing;
            const canRetry = item.templateId === 'manual' && item.review.status === 'failed' && !item.seo?.title;
            const hasVideo = Boolean(item.videoUrl && item.review.includeVideo !== false);
            return (
              <div key={item.runId} className="group relative flex flex-col min-w-0">
                {canSelect && (
                  <input
                    type="checkbox"
                    aria-label="İlanı seç"
                    className="absolute top-2 left-2 z-10 w-5 h-5 accent-indigo-600 drop-shadow"
                    checked={selected.has(item.runId)}
                    onChange={() => toggle(item.runId)}
                  />
                )}
                <button type="button" disabled={item.preparing || canRetry} onClick={() => setOpenId(item.runId)} className="text-left flex flex-col flex-1 min-w-0 disabled:cursor-default">
                  <div className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-800 group-hover:shadow-lg transition-shadow">
                    {photos[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photos[0]} alt={item.seo?.imageAltTexts?.[item.photos.indexOf(photos[0])] || item.seo?.title || 'İlan fotoğrafı'} loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300" />
                    )}
                    {item.preparing ? (
                      <span className="absolute inset-0 bg-black/45 flex flex-col items-center justify-center gap-1.5 text-white text-[11px] font-bold">
                        <Spinner className="w-5 h-5" /> Metin hazırlanıyor…
                      </span>
                    ) : (
                      <span className={`absolute top-2 right-2 px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold ${badge.className}`}>{badge.label}</span>
                    )}
                    <span className="absolute bottom-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[9px] sm:text-[10px] font-bold">
                      {photos.length}{hasVideo && <Film className="w-3 h-3" aria-label="video" />}
                    </span>
                  </div>
                  <div className="pt-2 space-y-0.5 min-w-0">
                    <p className="text-xs sm:text-[13px] leading-snug text-slate-800 dark:text-slate-100 line-clamp-2">{item.seo?.title || (item.preparing ? 'Başlık hazırlanıyor…' : 'Başlıksız ilan')}</p>
                    {item.price != null && (
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{item.price.toFixed(2)}</p>
                    )}
                    <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {item.sku ? <span className="font-mono">{item.sku}</span> : item.templateName}
                    </p>
                    {item.review.status === 'scheduled' && item.review.scheduledAt && (
                      <p className="text-[10px] sm:text-[11px] font-semibold text-indigo-600 dark:text-indigo-300 flex items-center gap-1"><CalendarClock className="w-3 h-3 shrink-0" /> <span className="truncate">{formatDateTime(item.review.scheduledAt)}</span></p>
                    )}
                    {item.review.status === 'published' && (
                      <p className="text-[10px] sm:text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3 shrink-0" /> <span className="truncate">{formatDateTime(item.review.publishedAt)}</span></p>
                    )}
                    {item.review.status === 'failed' && item.review.error && (
                      <p className="text-[10px] sm:text-[11px] text-red-600 dark:text-red-400 flex items-start gap-1" title={item.review.error}><XCircle className="w-3 h-3 shrink-0 mt-0.5" /> <span className="line-clamp-2">{item.review.error}</span></p>
                    )}
                    {item.variations && item.variations.enabled === 0 && !item.preparing && item.review.status !== 'published' && (
                      <p className="text-[10px] sm:text-[11px] font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3 shrink-0" /> <span className="truncate">Varyasyon seçilmedi</span></p>
                    )}
                    {item.warning && item.review.status === 'awaiting' && (
                      <p className="text-[10px] sm:text-[11px] text-amber-700 dark:text-amber-400 flex items-start gap-1" title={item.warning}><AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" /> <span className="line-clamp-2">{item.warning}</span></p>
                    )}
                  </div>
                </button>
                {canRetry && (
                  <div className="mt-1 flex items-center gap-3 text-[10px] sm:text-[11px] font-bold">
                    <button type="button" onClick={() => void retry(item.runId)} className="text-indigo-600 dark:text-indigo-300 hover:underline flex items-center gap-1">
                      <RotateCcw className="w-3 h-3" /> Yeniden dene
                    </button>
                  </div>
                )}
                {item.review.listingUrl && (
                  <a href={item.review.listingUrl} target="_blank" rel="noopener noreferrer" className="mt-1 text-[10px] sm:text-[11px] font-bold text-indigo-600 dark:text-indigo-300 flex items-center gap-1 hover:underline">
                    <ExternalLink className="w-3 h-3" /> Etsy&apos;de aç
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

      {opened && (
        <ListingReviewEditor
          item={opened}
          onClose={() => setOpenId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
