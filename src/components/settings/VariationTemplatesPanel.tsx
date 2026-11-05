'use client';

/**
 * Kayıtlı varyasyon şablonları (Ayarlar › Varyasyonlar): liste, Excel benzeri tablo düzenleyici ve Etsy
 * ilanından içe aktarma. Şablonlar `PUT /api/workspace/variation-templates` ile kaydedilir; bir şablona bağlı
 * otomasyonlar sonraki çalıştırmada güncel satırları kullanır.
 */
import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { FilePlus2, Pencil, Save, Search, Store, Trash2, X } from 'lucide-react';
import { useToast } from '@/components/common/ToastContext';
import { Spinner } from '@/components/common/Spinner';
import { DialogPanel } from '@/components/common/DialogPanel';
import { MAX_VARIATION_COMBINATIONS } from '@/lib/listing-defaults';
import { rowsFromEtsyInventory } from '@/lib/etsy-inventory-rows';
import type { EtsyVariationRow, EtsyVariationTemplate } from '@/types/pod';
import { VariationSheet } from './VariationSheet';

const inputClass = 'w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500';
const smallBtn = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-50';

/** Eski kayıtlardaki eksik/metin alanları API şemasına uyacak biçime getirir. */
function cleanTemplate(template: EtsyVariationTemplate): EtsyVariationTemplate {
  const rows = (Array.isArray(template.variations) ? template.variations : []).map((row, index): EtsyVariationRow => cleanRow(row, index));
  return { id: String(template.id), name: String(template.name || 'Adsız şablon').slice(0, 100), updatedAt: template.updatedAt, variations: rows.slice(0, MAX_VARIATION_COMBINATIONS) };
}

function cleanRow(row: Partial<EtsyVariationRow> | undefined, index: number): EtsyVariationRow {
  return {
    id: String(row?.id || `row-${index}`).slice(0, 100),
    size: String(row?.size ?? '').trim().slice(0, 60),
    color: String(row?.color ?? '').trim().slice(0, 60),
    price: Math.max(0, Math.min(50_000, Math.round((Number(row?.price) || 0) * 100) / 100)),
    quantity: Math.max(0, Math.min(999, Math.trunc(Number(row?.quantity) || 0))),
    sku: String(row?.sku ?? '').slice(0, 64),
    enabled: row?.enabled !== false,
  };
}

const rowKey = (size: string, color: string) => `${size}\u0000${color}`;

type Draft = { id: string | null; name: string; rows: EtsyVariationRow[] };

/** Kayıtlı varyasyon şablonlarını okur (Ayarlar sekmesi her şey hazır açılsın diye önceden de çağrılır). */
export async function loadVariationTemplates(): Promise<EtsyVariationTemplate[]> {
  try {
    const data = await fetch('/api/workspace/variation-templates', { cache: 'no-store' }).then((r) => r.json());
    return (Array.isArray(data?.templates) ? data.templates : []).filter((t: EtsyVariationTemplate) => t?.id).map(cleanTemplate);
  } catch {
    return [];
  }
}

export function VariationTemplatesPanel({ initialTemplates }: { initialTemplates?: EtsyVariationTemplate[] }) {
  const toast = useToast();
  const [templates, setTemplates] = useState<EtsyVariationTemplate[] | null>(initialTemplates ?? null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [savedDraft, setSavedDraft] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initialTemplates) return;
    let cancelled = false;
    void loadVariationTemplates().then((loaded) => { if (!cancelled) setTemplates(loaded); });
    return () => { cancelled = true; };
  }, [initialTemplates]);

  const openDraft = (next: Draft) => {
    setDraft(next);
    setSavedDraft(next.id ? JSON.stringify(next) : '');
  };

  const persist = async (next: EtsyVariationTemplate[], successMessage: string) => {
    setBusy(true);
    try {
      const res = await fetch('/api/workspace/variation-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templates: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Şablonlar kaydedilemedi.');
      setTemplates(next);
      toast.success(successMessage);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Şablonlar kaydedilemedi.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = async (asNew: boolean) => {
    if (!templates || !draft) return;
    const name = draft.name.replace(/\s+/g, ' ').trim().slice(0, 100);
    if (!name) { toast.warning('Şablona bir ad verin.'); return; }
    // Beden ve rengi boş satırlar atılır; aynı beden + renk iki kez olamaz (Etsy reddeder).
    const filled = draft.rows.map(cleanRow).filter((r) => r.size || r.color);
    if (filled.length === 0) { toast.warning('Şablonda en az bir varyasyon olmalı.'); return; }
    if (filled.length > MAX_VARIATION_COMBINATIONS) { toast.warning(`Etsy en fazla ${MAX_VARIATION_COMBINATIONS} kombinasyon kabul eder.`); return; }
    const seen = new Set<string>();
    const duplicate = filled.find((r) => { const key = rowKey(r.size.toLocaleLowerCase('tr'), r.color.toLocaleLowerCase('tr')); if (seen.has(key)) return true; seen.add(key); return false; });
    if (duplicate) { toast.warning(`"${duplicate.size} / ${duplicate.color}" birden fazla satırda var; Etsy her kombinasyonu bir kez kabul eder.`); return; }
    const template: EtsyVariationTemplate = {
      id: !asNew && draft.id ? draft.id : `vt-${Date.now()}`,
      name: asNew && draft.id && name === templates.find((t) => t.id === draft.id)?.name ? `${name} (kopya)` : name,
      updatedAt: new Date().toISOString(),
      variations: filled,
    };
    const exists = templates.some((t) => t.id === template.id);
    const next = exists ? templates.map((t) => (t.id === template.id ? template : t)) : [...templates, template];
    if (await persist(next, exists ? `"${template.name}" kaydedildi.` : `"${template.name}" şablonu oluşturuldu.`)) {
      openDraft({ id: template.id, name: template.name, rows: template.variations });
    }
  };

  const remove = (template: EtsyVariationTemplate) => {
    if (!templates || !window.confirm(`"${template.name}" şablonu silinsin mi? Bu şablonu varsayılan seçen klasörlerde varyasyon seçilmemiş olur.`)) return;
    void persist(templates.filter((t) => t.id !== template.id), 'Şablon silindi.').then((ok) => {
      if (ok && draft?.id === template.id) setDraft(null);
    });
  };

  const dirty = draft !== null && JSON.stringify(draft) !== savedDraft;
  const closeDraft = () => {
    if (dirty && !window.confirm('Kaydedilmemiş değişiklikler kaybolacak. Kapatılsın mı?')) return;
    setDraft(null);
  };

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Kayıtlı şablonlar</span>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setImportOpen(true)} disabled={!templates} className={`${smallBtn} border border-orange-200 dark:border-orange-500/40 text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-500/10`}>
            <Store className="w-3.5 h-3.5" /> Etsy ilanından çek
          </button>
          <button type="button" onClick={() => openDraft({ id: null, name: '', rows: [] })} disabled={!templates} className={`${smallBtn} border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800`}>
            <FilePlus2 className="w-3.5 h-3.5" /> Yeni şablon
          </button>
        </div>
      </div>

      {templates === null && <div className="flex items-center gap-2 text-xs text-slate-500"><Spinner className="w-3.5 h-3.5" /> Şablonlar yükleniyor…</div>}
      {templates && templates.length === 0 && !draft && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">Henüz kayıtlı şablon yok. Etsy&apos;deki bir ilanınızın varyasyonlarını çekebilir veya yeni şablon oluşturabilirsiniz.</p>
      )}
      {templates && templates.length > 0 && (
        <ul className="space-y-1.5">
          {templates.map((template) => {
            const isOpen = template.id === draft?.id;
            const count = template.variations.filter((r) => r.enabled).length;
            return (
              <li key={template.id} className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${isOpen ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 dark:border-indigo-500/50' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'}`}>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{template.name}</span>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                    {count} satışta / {template.variations.length} kombinasyon{template.updatedAt ? ` · ${new Date(template.updatedAt).toLocaleDateString('tr-TR')}` : ''}{isOpen ? ' · düzenleniyor' : ''}
                  </span>
                </span>
                <button type="button" onClick={() => { if (!dirty || window.confirm('Açık şablondaki kaydedilmemiş değişiklikler kaybolacak. Devam edilsin mi?')) openDraft({ id: template.id, name: template.name, rows: template.variations }); }} disabled={busy} className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 disabled:opacity-50">
                  <Pencil className="w-3.5 h-3.5" /> Düzenle
                </button>
                <button type="button" onClick={() => remove(template)} disabled={busy} aria-label={`${template.name} sil`} className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {draft && (
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-500/40 bg-white dark:bg-slate-900 p-2 sm:p-3 space-y-2.5 -mx-1 sm:mx-0">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              maxLength={100}
              placeholder="Şablon adı (ör. Unisex tişört)"
              aria-label="Şablon adı"
              className={`${inputClass} !w-auto flex-1 min-w-0 font-bold`}
            />
            <button type="button" onClick={closeDraft} aria-label="Düzenleyiciyi kapat" className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><X className="w-4 h-4" /></button>
          </div>
          <VariationSheet key={draft.id ?? 'new'} rows={draft.rows} onChange={(rows) => setDraft({ ...draft, rows })} />
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={() => void saveDraft(false)} disabled={busy || (!dirty && draft.id !== null)} className={`${smallBtn} bg-indigo-600 hover:bg-indigo-500 text-white`}>
              {busy ? <Spinner className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />} {draft.id ? 'Kaydet' : 'Şablon olarak kaydet'}
            </button>
            {draft.id && (
              <button type="button" onClick={() => void saveDraft(true)} disabled={busy} className={`${smallBtn} border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200`}>
                Yeni şablon olarak kaydet
              </button>
            )}
          </div>
        </div>
      )}

      {importOpen && (
        <EtsyImportDialog
          onClose={() => setImportOpen(false)}
          onImported={(name, rows) => {
            setImportOpen(false);
            openDraft({ id: null, name, rows });
            toast.success(`${rows.length} varyasyon Etsy'den çekildi. Düzenleyip şablon olarak kaydedin.`);
          }}
        />
      )}
    </div>
  );
}

type EtsyListingOption = { listing_id: number | string; title?: string; state?: string; price?: number | string; primary_image_url?: string | null };

/** Mağazadaki ilanlardan birini seçip envanterini (beden × renk, fiyat, stok) şablon satırlarına çevirir. */
function EtsyImportDialog({ onClose, onImported }: { onClose: () => void; onImported: (name: string, rows: EtsyVariationRow[]) => void }) {
  const [listings, setListings] = useState<EtsyListingOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/etsy/listings', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.success) setListings(Array.isArray(data.listings) ? data.listings : []);
        else setError(data?.error || 'İlanlar alınamadı. Etsy mağazanızın bağlı olduğundan emin olun.');
      })
      .catch(() => { if (!cancelled) setError('İlanlar alınamadı.'); });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    return (listings ?? []).filter((l) => !q || `${l.title ?? ''} ${l.listing_id}`.toLocaleLowerCase('tr').includes(q)).slice(0, 100);
  }, [listings, query]);

  const pick = async (listing: EtsyListingOption) => {
    const id = String(listing.listing_id);
    setLoadingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/etsy/listings?listing_id=${encodeURIComponent(id)}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      const rows = rowsFromEtsyInventory(data?.inventory).slice(0, MAX_VARIATION_COMBINATIONS);
      if (!res.ok || !data?.success) throw new Error(data?.error || 'İlanın varyasyonları alınamadı.');
      if (rows.length === 0) throw new Error('Bu ilanda varyasyon bulunamadı (veya envanter okunamadı).');
      const title = (listing.title || `Etsy ilanı ${id}`).replace(/\s+/g, ' ').trim();
      onImported(`${title.slice(0, 80)}${title.length > 80 ? '…' : ''}`, rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'İlanın varyasyonları alınamadı.');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <DialogPanel onClose={onClose} aria-label="Etsy ilanından varyasyon çek" onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-lg max-h-[85vh] flex flex-col bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl">
        <div className="flex items-center justify-between gap-2 p-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Etsy ilanından varyasyon çek</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">İlanın beden, renk, fiyat ve stokları yeni bir şablona aktarılır.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Kapat" className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-3 border-b border-slate-100 dark:border-slate-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="İlan ara (başlık veya ID)" aria-label="İlan ara" className={`${inputClass} pl-9`} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {error && <p className="m-2 text-xs rounded-xl border border-red-200 bg-red-50 dark:border-red-500/40 dark:bg-red-950/30 text-red-700 dark:text-red-300 p-2.5">{error}</p>}
          {listings === null && !error && <div className="flex items-center gap-2 text-xs text-slate-500 p-4"><Spinner className="w-4 h-4" /> İlanlar yükleniyor…</div>}
          {listings && filtered.length === 0 && <p className="text-xs text-slate-500 p-4">İlan bulunamadı.</p>}
          <ul className="space-y-1">
            {filtered.map((listing) => {
              const id = String(listing.listing_id);
              return (
                <li key={id}>
                  <button type="button" onClick={() => void pick(listing)} disabled={loadingId !== null} className="w-full flex items-center gap-3 p-2 rounded-xl text-left hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60">
                    <span className="relative w-11 h-11 shrink-0 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800">
                      {listing.primary_image_url && <Image src={listing.primary_image_url} alt="" fill sizes="44px" className="object-cover" unoptimized />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold text-slate-800 dark:text-slate-100 line-clamp-2">{listing.title || `İlan ${id}`}</span>
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400">#{id}{listing.state ? ` · ${listing.state === 'active' ? 'aktif' : listing.state === 'draft' ? 'taslak' : listing.state}` : ''}</span>
                    </span>
                    {loadingId === id && <Spinner className="w-4 h-4 shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </DialogPanel>
    </div>
  );
}
