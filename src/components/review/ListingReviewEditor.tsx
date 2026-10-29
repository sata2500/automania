'use client';

/**
 * Hazır İlanlar › ilan penceresi: fotoğraf seçimi ve sırası, video, başlık, etiketler, açıklama ve alt metinler
 * düzenlenir; ilan hemen yayınlanır, zamanlanır veya reddedilir.
 */
import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, CalendarClock, ExternalLink, Layers, Rocket, RotateCcw, Save, Settings, Trash2, X } from 'lucide-react';
import { openAppTab } from '@/lib/app-navigation';
import { DialogPanel } from '@/components/common/DialogPanel';
import { Spinner } from '@/components/common/Spinner';
import { useToast } from '@/components/common/ToastContext';
import { formatDateTime, schedulePresets, STATUS_BADGES, toLocalInputValue } from './format';
import type { ReviewItemView } from './types';

type PhotoRow = { url: string; included: boolean; alt: string };

const inputClass = 'w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30';
const labelClass = 'block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5';

function initialPhotos(item: ReviewItemView): PhotoRow[] {
  const order = item.review.photos ?? item.photos;
  const alt = (url: string) => item.seo?.imageAltTexts?.[item.photos.indexOf(url)] ?? '';
  return [
    ...order.filter((url) => item.photos.includes(url)).map((url) => ({ url, included: true, alt: alt(url) })),
    ...item.photos.filter((url) => !order.includes(url)).map((url) => ({ url, included: false, alt: alt(url) })),
  ];
}

type VariationTemplateOption = { id: string; name: string; variations?: Array<{ enabled?: boolean }> };

/**
 * Manuel üretim ilanının varyasyonları: kayıtlı şablonlardan biri seçilir (satırlar ilana kopyalanır).
 * Kayıtlı şablon yoksa Ayarlar › Varyasyonlar'a yönlendirir (Etsy'den çekme veya yeni şablon).
 */
function VariationPicker({ item, editable, onChanged }: { item: ReviewItemView; editable: boolean; onChanged: () => Promise<void> }) {
  const toast = useToast();
  const [templates, setTemplates] = useState<VariationTemplateOption[] | null>(null);
  const [saving, setSaving] = useState(false);
  const current = item.variations!;

  useEffect(() => {
    let cancelled = false;
    fetch('/api/workspace/variation-templates', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setTemplates(Array.isArray(data?.templates) ? data.templates.filter((t: VariationTemplateOption) => t?.id && t.variations?.length) : []); })
      .catch(() => { if (!cancelled) setTemplates([]); });
    return () => { cancelled = true; };
  }, []);

  const choose = async (templateId: string) => {
    if (!templateId || templateId === current.templateId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/listing-review/${item.runId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ variationTemplateId: templateId }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error(data.error || 'Varyasyonlar seçilemedi.');
      toast.success('Varyasyonlar ilana eklendi.');
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Varyasyonlar seçilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const missing = current.enabled === 0;
  return (
    <section className={`rounded-2xl border p-3 space-y-2 ${missing ? 'border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-950/30' : 'border-slate-200 dark:border-slate-700'}`}>
      <div className="flex items-center gap-2">
        <Layers className={`w-4 h-4 shrink-0 ${missing ? 'text-amber-600' : 'text-indigo-500'}`} />
        <span className="text-xs font-bold text-slate-800 dark:text-slate-100 flex-1">Varyasyonlar</span>
        {!missing && <span className="text-[11px] text-slate-500 dark:text-slate-400">{current.enabled} satışta / {current.count}</span>}
      </div>
      {missing && <p className="text-[11px] text-amber-800 dark:text-amber-200">Yayınlamadan önce kayıtlı varyasyon şablonlarınızdan birini seçin.</p>}
      {templates === null ? (
        <div className="flex items-center gap-2 text-xs text-slate-500"><Spinner className="w-3.5 h-3.5" /> Şablonlar yükleniyor…</div>
      ) : templates.length === 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[11px] text-slate-600 dark:text-slate-300 flex-1 min-w-48">Kayıtlı varyasyon şablonunuz yok. Ayarlar&apos;da Etsy&apos;deki bir ilanınızdan çekebilir veya yeni şablon oluşturabilirsiniz.</p>
          <button type="button" onClick={() => openAppTab('settings')} className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold">
            <Settings className="w-3.5 h-3.5" /> Ayarlar › Varyasyonlar
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <select
            value={current.templateId ?? ''}
            disabled={!editable || saving}
            onChange={(e) => void choose(e.target.value)}
            aria-label="Varyasyon şablonu"
            className={`${inputClass} flex-1 min-w-0`}
          >
            {!current.templateId && <option value="">{current.count > 0 ? `${current.templateName ?? 'Mevcut varyasyonlar'} (${current.count})` : 'Şablon seçin…'}</option>}
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.variations?.filter((r) => r.enabled !== false).length ?? 0} satışta)</option>)}
          </select>
          {saving && <Spinner className="w-4 h-4 shrink-0" />}
        </div>
      )}
    </section>
  );
}

export function ListingReviewEditor({ item, onClose, onChanged }: { item: ReviewItemView; onClose: () => void; onChanged: () => Promise<void> }) {
  const toast = useToast();
  const status = item.review.status;
  const editable = status === 'awaiting' || status === 'failed' || status === 'scheduled' || status === 'rejected';
  const [title, setTitle] = useState(item.seo?.title ?? '');
  const [tags, setTags] = useState<string[]>(item.seo?.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [description, setDescription] = useState(item.seo?.description ?? '');
  const [sku, setSku] = useState(item.sku ?? '');
  const [photos, setPhotos] = useState<PhotoRow[]>(() => initialPhotos(item));
  const [includeVideo, setIncludeVideo] = useState(item.review.includeVideo !== false);
  const [scheduleAt, setScheduleAt] = useState(() => toLocalInputValue(item.review.scheduledAt ? new Date(item.review.scheduledAt) : new Date(Date.now() + 60 * 60_000)));
  const [busy, setBusy] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const change = <T,>(setter: (value: T) => void) => (value: T) => { setter(value); setDirty(true); };

  const addTags = (raw: string) => {
    const next = [...tags];
    for (const tag of raw.split(',').map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean)) {
      if (tag.length > 20) { toast.error(`"${tag}" 20 karakterden uzun.`); continue; }
      if (!next.includes(tag) && next.length < 13) next.push(tag);
    }
    change(setTags)(next);
    setTagInput('');
  };
  const movePhoto = (index: number, delta: number) => {
    const next = [...photos];
    const [row] = next.splice(index, 1);
    next.splice(index + delta, 0, row!);
    change(setPhotos)(next);
  };
  const updatePhoto = (index: number, patch: Partial<PhotoRow>) => change(setPhotos)(photos.map((p, i) => (i === index ? { ...p, ...patch } : p)));

  const call = async (url: string, method: 'PATCH' | 'POST', body: unknown) => {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) throw new Error(data.error || 'İşlem başarısız.');
    return data;
  };
  const save = async () => {
    const included = photos.filter((p) => p.included);
    if (included.length === 0) throw new Error('En az bir fotoğraf seçin.');
    await call(`/api/listing-review/${item.runId}`, 'PATCH', {
      title, description, tags,
      photos: included.map((p) => p.url),
      includeVideo,
      imageAltTexts: Object.fromEntries(photos.map((p) => [p.url, p.alt])),
      ...(sku.trim() && sku.trim() !== (item.sku ?? '') ? { sku } : {}),
    });
    setDirty(false);
  };
  const run = async (key: string, fn: () => Promise<string | void>) => {
    setBusy(key);
    try {
      const message = await fn();
      if (message) toast.success(message);
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'İşlem başarısız.');
      await onChanged();
    } finally {
      setBusy(null);
    }
  };
  const action = (name: string, extra: Record<string, unknown> = {}) => call(`/api/listing-review/${item.runId}`, 'POST', { action: name, ...extra });

  const scheduleFor = async (date: Date) => {
    if (Number.isNaN(date.getTime())) throw new Error('Geçerli bir tarih seçin.');
    if (dirty) await save();
    await action('approve', { scheduledAt: date.toISOString() });
    onClose();
    return `İlan ${formatDateTime(date.toISOString())} için zamanlandı.`;
  };

  const badge = STATUS_BADGES[status];
  const includedCount = photos.filter((p) => p.included).length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto p-3 sm:p-6" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <DialogPanel aria-labelledby="review-editor-title" onClose={busy ? undefined : onClose} className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 my-4">
        <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-200 dark:border-slate-800">
          <div className="min-w-0">
            <h2 id="review-editor-title" className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
              İlanı incele <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${badge.className}`}>{badge.label}</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {item.templateName} · {formatDateTime(item.createdAt)}{item.price != null ? ` · ${item.price.toFixed(2)}` : ''}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={Boolean(busy)} aria-label="Kapat" className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-xl">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {item.review.error && (status === 'failed') && (
            <p className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 text-xs text-red-700 dark:text-red-300">{item.review.error}</p>
          )}
          {item.warning && status === 'awaiting' && (
            <p className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30 text-xs text-amber-800 dark:text-amber-300">{item.warning}</p>
          )}
          {item.review.listingUrl && (
            <a href={item.review.listingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-300 hover:underline">
              <ExternalLink className="w-3.5 h-3.5" /> İlanı Etsy&apos;de aç
            </a>
          )}

          {/* Fotoğraflar */}
          <section>
            <span className={labelClass}>Fotoğraflar ({includedCount} seçili, sırayla gönderilir; ilki kapak)</span>
            <div className="space-y-2">
              {photos.map((photo, index) => (
                <div key={photo.url} className={`flex gap-3 p-2 rounded-xl border ${photo.included ? 'border-slate-200 dark:border-slate-700' : 'border-dashed border-slate-200 dark:border-slate-800 opacity-60'}`}>
                  <img src={photo.url} alt={photo.alt || `Fotoğraf ${index + 1}`} loading="lazy" className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0" />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 accent-indigo-600" checked={photo.included} disabled={!editable} onChange={(e) => updatePhoto(index, { included: e.target.checked })} />
                        İlana ekle
                      </label>
                      {editable && (
                        <span className="flex gap-1 ml-auto">
                          <button type="button" aria-label="Yukarı taşı" disabled={index === 0} onClick={() => movePhoto(index, -1)} className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5" /></button>
                          <button type="button" aria-label="Aşağı taşı" disabled={index === photos.length - 1} onClick={() => movePhoto(index, 1)} className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5" /></button>
                        </span>
                      )}
                    </div>
                    <textarea
                      aria-label={`Fotoğraf ${index + 1} alt metni`}
                      value={photo.alt}
                      disabled={!editable}
                      maxLength={250}
                      rows={2}
                      placeholder="Alt metin (görmeyen alıcılar ve arama için)"
                      onChange={(e) => updatePhoto(index, { alt: e.target.value })}
                      className={`${inputClass} resize-none`}
                    />
                  </div>
                </div>
              ))}
            </div>
            {item.videoUrl && (
              <div className="mt-3 flex flex-col sm:flex-row gap-3 items-start">
                <video src={item.videoUrl} controls muted playsInline className="w-full max-w-[220px] rounded-xl border border-slate-200 dark:border-slate-700" />
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 accent-indigo-600" checked={includeVideo} disabled={!editable} onChange={(e) => change(setIncludeVideo)(e.target.checked)} />
                  Videoyu ilana ekle
                </label>
              </div>
            )}
          </section>

          {item.variations && <VariationPicker item={item} editable={editable} onChanged={onChanged} />}

          {/* Metinler */}
          <section className="space-y-4">
            <div>
              <label className={labelClass} htmlFor="review-sku">SKU (siparişte görünür; tasarım bu kodla Tasarımlar&apos;da aranır)</label>
              <input id="review-sku" className={`${inputClass} font-mono uppercase`} value={sku} maxLength={32} disabled={!editable} placeholder="Ör. TSH-261029-K7QD" onChange={(e) => change(setSku)(e.target.value.toUpperCase())} />
            </div>
            <div>
              <label className={labelClass} htmlFor="review-title">Başlık ({title.length}/140)</label>
              <input id="review-title" className={inputClass} value={title} maxLength={140} disabled={!editable} onChange={(e) => change(setTitle)(e.target.value)} />
            </div>
            <div>
              <span className={labelClass}>Etiketler ({tags.length}/13)</span>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                    {tag}
                    {editable && <button type="button" aria-label={`${tag} etiketini kaldır`} onClick={() => change(setTags)(tags.filter((t) => t !== tag))}><X className="w-3 h-3" /></button>}
                  </span>
                ))}
              </div>
              {editable && tags.length < 13 && (
                <input
                  aria-label="Etiket ekle"
                  className={inputClass}
                  value={tagInput}
                  placeholder="Etiket ekleyin (virgülle ayırın, Enter ile ekleyin)"
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTags(tagInput); } }}
                  onBlur={() => { if (tagInput.trim()) addTags(tagInput); }}
                />
              )}
            </div>
            <div>
              <label className={labelClass} htmlFor="review-description">Açıklama</label>
              <textarea id="review-description" className={`${inputClass} h-56 font-mono leading-relaxed`} value={description} disabled={!editable} onChange={(e) => change(setDescription)(e.target.value)} />
            </div>
          </section>
        </div>

        {/* İşlemler */}
        {editable && (
          <div className="sticky bottom-0 p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur rounded-b-3xl space-y-3">
            {status !== 'rejected' ? (
              <>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Hızlı zamanla:</span>
                  {schedulePresets(new Date()).map((preset) => (
                    <button
                      key={preset.key}
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => void run('schedule', () => scheduleFor(preset.at))}
                      className="px-3 py-1.5 rounded-full border border-indigo-200 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-500/20 disabled:opacity-60"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex flex-col gap-1">
                    Özel zaman
                    <input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} className={inputClass} />
                  </label>
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => void run('schedule', () => scheduleFor(new Date(scheduleAt)))}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    {busy === 'schedule' ? <Spinner className="w-3.5 h-3.5" /> : <CalendarClock className="w-3.5 h-3.5" />} {status === 'scheduled' ? 'Zamanı güncelle' : 'Zamanla'}
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => void run('publish', async () => {
                      if (dirty) await save();
                      await action('publish');
                      onClose();
                      return 'İlan Etsy\'de yayına alındı.';
                    })}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    {busy === 'publish' ? <Spinner className="w-3.5 h-3.5" /> : <Rocket className="w-3.5 h-3.5" />} {busy === 'publish' ? 'Yayınlanıyor (1-2 dk)…' : 'Şimdi yayınla'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={Boolean(busy) || !dirty} onClick={() => void run('save', async () => { await save(); return 'Değişiklikler kaydedildi.'; })} className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 disabled:opacity-50">
                    {busy === 'save' ? <Spinner className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />} Kaydet
                  </button>
                  {status === 'scheduled' && (
                    <button type="button" disabled={Boolean(busy)} onClick={() => void run('unschedule', async () => { await action('unschedule'); return 'Zamanlama kaldırıldı.'; })} className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 disabled:opacity-50">
                      <RotateCcw className="w-3.5 h-3.5" /> Zamanlamayı kaldır
                    </button>
                  )}
                  <button type="button" disabled={Boolean(busy)} onClick={() => void run('reject', async () => { await action('reject'); onClose(); return 'İlan reddedildi.'; })} className="px-3 py-1.5 rounded-xl border border-red-200 dark:border-red-500/40 text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5 disabled:opacity-50 sm:ml-auto">
                    <Trash2 className="w-3.5 h-3.5" /> Reddet
                  </button>
                </div>
              </>
            ) : (
              <button type="button" disabled={Boolean(busy)} onClick={() => void run('restore', async () => { if (dirty) await save(); await action('restore'); onClose(); return 'İlan incelemeye geri alındı.'; })} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-60">
                <RotateCcw className="w-3.5 h-3.5" /> İncelemeye geri al
              </button>
            )}
          </div>
        )}
      </DialogPanel>
    </div>
  );
}
