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
import { formatDateTime, STATUS_BADGES, toLocalInputValue } from './format';

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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><ClipboardCheck className="w-5 h-5 text-indigo-500" /> Hazır İlanlar</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Otomasyonların hazırladığı ilanlar Etsy&apos;ye gönderilmeden önce burada bekler. Beğendiklerinizi düzenleyip hemen yayınlayın veya zamanlayın; beğenmediklerinizi reddedin. Zamanlanan ilanlar saatlik zamanlayıcı ile Etsy&apos;de <strong>yayına</strong> alınır.
          </p>
        </div>
        <button type="button" onClick={() => void load()} className="self-start sm:self-auto px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800">
          <RefreshCw className="w-3.5 h-3.5" /> Yenile
        </button>
      </div>

      <div role="tablist" aria-label="İlan durumu" className="flex flex-wrap gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 w-full sm:w-auto sm:inline-flex">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => { setFilter(f.key); setSelected(new Set()); setShowSchedule(false); }}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${filter === f.key ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            {f.label} <span className="ml-1 opacity-70">{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {(filter === 'awaiting' || filter === 'scheduled' || filter === 'rejected') && visible.length > 0 && (
        <div className="flex flex-col gap-3 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 accent-indigo-600"
                checked={selectedVisible.length === visible.length}
                onChange={(e) => setSelected(e.target.checked ? new Set(visible.map((i) => i.runId)) : new Set())}
              />
              Tümünü seç ({selectedVisible.length}/{visible.length})
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
            <div className="flex flex-col sm:flex-row sm:items-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex flex-col gap-1">
                İlk yayın
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
        <div className="p-8 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400">
          {filter === 'awaiting'
            ? 'İnceleme bekleyen ilan yok. Otomasyonlar çalıştıkça hazırlanan ilanlar burada görünür.'
            : 'Bu bölümde ilan yok.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((item) => {
            const badge = STATUS_BADGES[item.review.status];
            const photos = item.review.photos ?? item.photos;
            const canSelect = filter !== 'published';
            return (
              <div key={item.runId} className="group relative flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                {canSelect && (
                  <input
                    type="checkbox"
                    aria-label="İlanı seç"
                    className="absolute top-3 left-3 z-10 w-5 h-5 accent-indigo-600"
                    checked={selected.has(item.runId)}
                    onChange={() => toggle(item.runId)}
                  />
                )}
                <button type="button" onClick={() => setOpenId(item.runId)} className="text-left flex flex-col flex-1">
                  <div className="relative aspect-square bg-slate-100 dark:bg-slate-800">
                    {photos[0] && (
                       
                      <img src={photos[0]} alt={item.seo?.imageAltTexts?.[item.photos.indexOf(photos[0])] || item.seo?.title || 'İlan fotoğrafı'} loading="lazy" className="w-full h-full object-cover" />
                    )}
                    <span className={`absolute top-3 right-3 px-2 py-0.5 rounded-lg text-[10px] font-bold ${badge.className}`}>{badge.label}</span>
                    <span className="absolute bottom-3 left-3 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-black/60 text-white text-[10px] font-bold">
                      {photos.length} fotoğraf{item.videoUrl && item.review.includeVideo !== false ? <><Film className="w-3 h-3 ml-1" /> video</> : null}
                    </span>
                  </div>
                  <div className="p-3 space-y-1.5 flex-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-2">{item.seo?.title || 'Başlıksız ilan'}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{item.templateName} · {formatDateTime(item.createdAt)}</p>
                    {item.review.status === 'scheduled' && item.review.scheduledAt && (
                      <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-300 flex items-center gap-1"><CalendarClock className="w-3.5 h-3.5" /> {formatDateTime(item.review.scheduledAt)}</p>
                    )}
                    {item.review.status === 'published' && (
                      <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> {formatDateTime(item.review.publishedAt)}</p>
                    )}
                    {item.review.status === 'failed' && item.review.error && (
                      <p className="text-[11px] text-red-600 dark:text-red-400 flex items-start gap-1 line-clamp-3"><XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {item.review.error}</p>
                    )}
                    {item.warning && item.review.status === 'awaiting' && (
                      <p className="text-[11px] text-amber-700 dark:text-amber-400 flex items-start gap-1"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {item.warning}</p>
                    )}
                  </div>
                </button>
                {item.review.listingUrl && (
                  <a href={item.review.listingUrl} target="_blank" rel="noopener noreferrer" className="mx-3 mb-3 text-[11px] font-bold text-indigo-600 dark:text-indigo-300 flex items-center gap-1 hover:underline">
                    <ExternalLink className="w-3.5 h-3.5" /> Etsy&apos;de aç
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
