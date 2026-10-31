'use client';

/**
 * Hazır İlanlar › ilan penceresi. Üstte ilanın hazırlık durumu (fotoğraf, başlık, etiket, açıklama, varyasyon),
 * üç sekme: Görseller (sürükle-bırak sıra, kapak, alt metin, indirme, video), İlan metni (SKU, başlık, etiketler, açıklama) ve
 * Varyasyonlar. Alttaki sabit çubukta kaydet, zamanla, yayınla ve reddet bulunur. Telefonda tam ekran açılır.
 */
import React, { useEffect, useState } from 'react';
import { AlertTriangle, CalendarClock, Check, ExternalLink, Images, Layers, Rocket, RotateCcw, Save, Settings, Trash2, Type, X } from 'lucide-react';
import { openAppTab } from '@/lib/app-navigation';
import { DialogPanel } from '@/components/common/DialogPanel';
import { Spinner } from '@/components/common/Spinner';
import { useToast } from '@/components/common/ToastContext';
import { formatDateTime, schedulePresets, STATUS_BADGES, toLocalInputValue } from './format';
import type { ReviewItemView } from './types';
import { SeoBreakdown } from '@/components/listings/SeoBreakdown';
import { ReviewPhotosPanel, type PhotoRow } from './ReviewPhotosPanel';

type EditorTab = 'photos' | 'text' | 'variations';

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
  const [tab, setTab] = useState<EditorTab>(() => (item.variations?.enabled === 0 ? 'variations' : 'photos'));
  const [activePhoto, setActivePhoto] = useState(0);
  const [scheduleOpen, setScheduleOpen] = useState(false);
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
  const movePhoto = (index: number, target: number) => {
    if (target < 0 || target >= photos.length || target === index) return;
    const next = [...photos];
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row!);
    change(setPhotos)(next);
    setActivePhoto(target);
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
  const requestClose = () => {
    if (busy) return;
    if (dirty && !window.confirm('Kaydedilmemiş değişiklikler var. Kaydetmeden kapatılsın mı?')) return;
    onClose();
  };

  const badge = STATUS_BADGES[status];
  const includedCount = photos.filter((p) => p.included).length;
  const variationsMissing = item.variations?.enabled === 0;
  // Hazırlık durumu: Etsy'nin kurallarına ve iyi bir ilanın gereklerine göre
  const checks: Array<{ key: string; label: string; ok: boolean; tab: EditorTab }> = [
    { key: 'photos', label: `${includedCount}/20 fotoğraf`, ok: includedCount >= 1, tab: 'photos' },
    { key: 'title', label: `Başlık ${title.length}/140`, ok: title.trim().length >= 20 && title.length <= 140, tab: 'text' },
    { key: 'tags', label: `${tags.length}/13 etiket`, ok: tags.length === 13, tab: 'text' },
    { key: 'description', label: 'Açıklama', ok: description.trim().length >= 160, tab: 'text' },
    ...(item.variations ? [{ key: 'variations', label: variationsMissing ? 'Varyasyon yok' : `${item.variations.enabled} varyasyon`, ok: !variationsMissing, tab: 'variations' as const }] : []),
  ];
  const seoEvaluation = item.seo?.evaluation;

  const tabs: Array<{ key: EditorTab; label: string; icon: typeof Images; alert?: boolean }> = [
    { key: 'photos', label: 'Görseller', icon: Images },
    { key: 'text', label: 'İlan metni', icon: Type, alert: checks.some((c) => c.tab === 'text' && !c.ok) },
    ...(item.variations ? [{ key: 'variations' as const, label: 'Varyasyonlar', icon: Layers, alert: variationsMissing }] : []),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-start justify-center bg-black/60 backdrop-blur-sm sm:overflow-y-auto sm:p-6" onClick={(e) => { if (e.target === e.currentTarget) requestClose(); }}>
      <DialogPanel aria-labelledby="review-editor-title" onClose={busy ? undefined : requestClose} className="w-full max-w-3xl bg-white dark:bg-slate-900 sm:rounded-3xl shadow-2xl sm:border border-slate-200 dark:border-slate-700 flex flex-col h-full sm:h-auto sm:max-h-[calc(100vh-3rem)] sm:my-0">
        {/* Başlık + hazırlık durumu + sekmeler */}
        <div className="shrink-0 border-b border-slate-200 dark:border-slate-800 pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-0">
          <div className="flex items-center gap-3 px-4 sm:px-5 py-3">
            <div className="min-w-0 flex-1">
              <h2 id="review-editor-title" className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="truncate">{title.trim() || 'İlanı incele'}</span>
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap mt-0.5">
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${badge.className}`}>{badge.label}</span>
                {sku && <span className="font-mono">{sku}</span>}
                <span className="truncate">{item.templateName} · {formatDateTime(item.createdAt)}{item.price != null ? ` · ${item.price.toFixed(2)}` : ''}</span>
              </p>
            </div>
            {item.review.listingUrl && (
              <a href={item.review.listingUrl} target="_blank" rel="noopener noreferrer" aria-label="İlanı Etsy'de aç" className="p-2 text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl">
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <button type="button" onClick={requestClose} disabled={Boolean(busy)} aria-label="Kapat" className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-xl">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-1.5 px-4 sm:px-5 pb-3 overflow-x-auto no-scrollbar" aria-label="İlanın hazırlık durumu">
            {seoEvaluation && (
              <button
                type="button"
                onClick={() => setTab('text')}
                className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border ${seoEvaluation.score >= 80
                  ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : seoEvaluation.score >= 60 ? 'border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300'
                  : 'border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300'}`}
                title="SEO puanı (kurallar, Etsy verisi ve yapay zekâ değerlendirmesi)"
              >
                SEO {seoEvaluation.score}{dirty ? '*' : ''}
              </button>
            )}
            {checks.map((check) => (
              <button
                key={check.key}
                type="button"
                onClick={() => setTab(check.tab)}
                className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border ${check.ok
                  ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300'}`}
              >
                {check.ok ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />} {check.label}
              </button>
            ))}
          </div>

          <div role="tablist" className="grid gap-1 px-4 sm:px-5" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
            {tabs.map(({ key, label, icon: Icon, alert }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`relative flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold border-b-2 transition-colors ${tab === key
                  ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
              >
                <Icon className="w-3.5 h-3.5" /> {label}
                {alert && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-label="eksik" />}
              </button>
            ))}
          </div>
        </div>

        {/* İçerik */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-4 space-y-4">
          {item.review.error && status === 'failed' && (
            <p className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 text-xs text-red-700 dark:text-red-300">{item.review.error}</p>
          )}
          {item.warning && status === 'awaiting' && (
            <p className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30 text-xs text-amber-800 dark:text-amber-300">{item.warning}</p>
          )}

          {tab === 'photos' && (
            <ReviewPhotosPanel
              photos={photos}
              editable={editable}
              activeIndex={activePhoto}
              onActivate={setActivePhoto}
              onMove={movePhoto}
              onUpdate={updatePhoto}
              videoUrl={item.videoUrl}
              includeVideo={includeVideo}
              onIncludeVideo={change(setIncludeVideo)}
              fileBase={sku || item.sku || 'ilan'}
            />
          )}

          {tab === 'text' && (
            <div className="space-y-4">
              {seoEvaluation && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">SEO puanı: {seoEvaluation.score}/100</span>
                    {dirty && <span className="text-[10px] text-amber-700 dark:text-amber-300">Kaydedince yeniden hesaplanır</span>}
                  </div>
                  <SeoBreakdown evaluation={seoEvaluation} compact />
                  {seoEvaluation.issues.filter((i) => i.severity !== 'tip').slice(0, 4).map((issue, i) => (
                    <p key={i} className="text-[11px] text-amber-800 dark:text-amber-300 flex gap-1.5"><AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />{issue.message}</p>
                  ))}
                </div>
              )}
              <div>
                <label className={labelClass} htmlFor="review-title">Başlık <span className="font-normal text-slate-400">({title.length}/140)</span></label>
                <textarea id="review-title" rows={2} className={`${inputClass} resize-none`} value={title} maxLength={140} disabled={!editable} onChange={(e) => change(setTitle)(e.target.value.replace(/\n/g, ' '))} />
              </div>
              <div>
                <span className={labelClass}>Etiketler <span className="font-normal text-slate-400">({tags.length}/13 · her biri en fazla 20 karakter)</span></span>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {tags.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-[11px] font-semibold text-indigo-800 dark:text-indigo-200">
                      {tag}
                      {editable && <button type="button" aria-label={`${tag} etiketini kaldır`} onClick={() => change(setTags)(tags.filter((t) => t !== tag))} className="p-0.5 rounded hover:bg-indigo-100 dark:hover:bg-indigo-500/20"><X className="w-3 h-3" /></button>}
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
                <label className={labelClass} htmlFor="review-description">Açıklama <span className="font-normal text-slate-400">({description.length} karakter)</span></label>
                <textarea id="review-description" className={`${inputClass} h-64 leading-relaxed`} value={description} disabled={!editable} onChange={(e) => change(setDescription)(e.target.value)} />
              </div>
              <div>
                <label className={labelClass} htmlFor="review-sku">SKU <span className="font-normal text-slate-400">(siparişte görünür; tasarım bu kodla Tasarımlar&apos;da aranır)</span></label>
                <input id="review-sku" className={`${inputClass} font-mono uppercase`} value={sku} maxLength={32} disabled={!editable} placeholder="Ör. TSH-261029-K7QD" onChange={(e) => change(setSku)(e.target.value.toUpperCase())} />
              </div>
            </div>
          )}

          {tab === 'variations' && item.variations && <VariationPicker item={item} editable={editable} onChanged={onChanged} />}
        </div>

        {/* İşlemler */}
        {editable && (
          <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sm:rounded-b-3xl px-4 sm:px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-3">
            {status === 'rejected' ? (
              <button type="button" disabled={Boolean(busy)} onClick={() => void run('restore', async () => { if (dirty) await save(); await action('restore'); onClose(); return 'İlan incelemeye geri alındı.'; })} className="w-full px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-60">
                <RotateCcw className="w-3.5 h-3.5" /> İncelemeye geri al
              </button>
            ) : (
              <>
                {scheduleOpen && (
                  <div className="rounded-2xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/60 dark:bg-indigo-500/5 p-3 space-y-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      {schedulePresets(new Date()).map((preset) => (
                        <button
                          key={preset.key}
                          type="button"
                          disabled={Boolean(busy)}
                          onClick={() => void run('schedule', () => scheduleFor(preset.at))}
                          className="px-3 py-1.5 rounded-full border border-indigo-200 dark:border-indigo-500/40 bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-500/20 disabled:opacity-60"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input type="datetime-local" aria-label="Özel zaman" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} className={`${inputClass} flex-1 min-w-0`} />
                      <button
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() => void run('schedule', () => scheduleFor(new Date(scheduleAt)))}
                        className="shrink-0 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-60"
                      >
                        {busy === 'schedule' ? <Spinner className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />} {status === 'scheduled' ? 'Güncelle' : 'Zamanla'}
                      </button>
                    </div>
                    {status === 'scheduled' && (
                      <button type="button" disabled={Boolean(busy)} onClick={() => void run('unschedule', async () => { await action('unschedule'); return 'Zamanlama kaldırıldı.'; })} className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                        <RotateCcw className="w-3 h-3" /> Zamanlamayı kaldır
                      </button>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button type="button" disabled={Boolean(busy)} onClick={() => void run('reject', async () => { await action('reject'); onClose(); return 'İlan reddedildi.'; })} aria-label="İlanı reddet" title="Reddet" className="p-2.5 rounded-xl border border-red-200 dark:border-red-500/40 text-red-600 dark:text-red-400 flex items-center justify-center gap-1.5 disabled:opacity-50">
                    <Trash2 className="w-4 h-4" /><span className="hidden sm:inline text-xs font-bold">Reddet</span>
                  </button>
                  <span className="hidden sm:block flex-1" />
                  {dirty && (
                    <button type="button" disabled={Boolean(busy)} onClick={() => void run('save', async () => { await save(); return 'Değişiklikler kaydedildi.'; })} className="flex-1 sm:flex-none px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 disabled:opacity-50">
                      {busy === 'save' ? <Spinner className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />} Kaydet
                    </button>
                  )}
                  <button type="button" disabled={Boolean(busy)} onClick={() => setScheduleOpen((v) => !v)} aria-expanded={scheduleOpen} className={`flex-1 sm:flex-none px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 whitespace-nowrap ${scheduleOpen ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-200' : 'border border-indigo-200 dark:border-indigo-500/40 text-indigo-700 dark:text-indigo-300'}`}>
                    <CalendarClock className="w-3.5 h-3.5" /> {status === 'scheduled' ? 'Zamanı değiştir' : 'Zamanla'}
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(busy) || variationsMissing}
                    title={variationsMissing ? 'Önce bir varyasyon şablonu seçin' : undefined}
                    onClick={() => void run('publish', async () => {
                      if (dirty) await save();
                      await action('publish');
                      onClose();
                      return 'İlan Etsy\'de yayına alındı.';
                    })}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
                  >
                    {busy === 'publish' ? <Spinner className="w-3.5 h-3.5" /> : <Rocket className="w-3.5 h-3.5" />} {busy === 'publish' ? 'Yayınlanıyor…' : 'Yayınla'}
                  </button>
                </div>
                {dirty && !scheduleOpen && <p className="text-[10px] text-slate-500 dark:text-slate-400">Yayınla ve Zamanla, değişiklikleri önce kaydeder.</p>}
              </>
            )}
          </div>
        )}
      </DialogPanel>
    </div>
  );
}
