'use client';

/**
 * Kayıtlı varyasyon şablonları (Ayarlar › Varyasyonlar): liste, Excel benzeri tablo düzenleyici ve Etsy
 * ilanından içe aktarma. Şablonlar `PUT /api/workspace/variation-templates` ile kaydedilir; bir şablona bağlı
 * otomasyonlar sonraki çalıştırmada güncel satırları kullanır.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { Download, FilePlus2, Pencil, Plus, Save, Search, Store, Trash2, X } from 'lucide-react';
import { useToast } from '@/components/common/ToastContext';
import { Spinner } from '@/components/common/Spinner';
import { DialogPanel } from '@/components/common/DialogPanel';
import { MAX_VARIATION_COMBINATIONS } from '@/lib/listing-defaults';
import { rowsFromEtsyInventory } from '@/lib/etsy-inventory-rows';
import type { EtsyVariationRow, EtsyVariationTemplate } from '@/types/pod';

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
const newRowId = (size: string, color: string) => `${size}-${color}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'row';
const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

type Draft = { id: string | null; name: string; rows: EtsyVariationRow[] };

export function VariationTemplatesPanel({ newTemplateRows, onUseAsDefault }: {
  /** "Yeni şablon" bu satırlarla başlar (Ayarlar'daki varsayılan varyasyonlar). */
  newTemplateRows: () => EtsyVariationRow[];
  /** Şablonu Ayarlar'daki varsayılan varyasyonlara aktarır. */
  onUseAsDefault: (rows: EtsyVariationRow[]) => void;
}) {
  const toast = useToast();
  const [templates, setTemplates] = useState<EtsyVariationTemplate[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [savedDraft, setSavedDraft] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/workspace/variation-templates', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setTemplates((Array.isArray(data?.templates) ? data.templates : []).filter((t: EtsyVariationTemplate) => t?.id).map(cleanTemplate));
      })
      .catch(() => { if (!cancelled) setTemplates([]); });
    return () => { cancelled = true; };
  }, []);

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
    if (draft.rows.length === 0) { toast.warning('Şablonda en az bir varyasyon olmalı.'); return; }
    if (draft.rows.length > MAX_VARIATION_COMBINATIONS) { toast.warning(`Etsy en fazla ${MAX_VARIATION_COMBINATIONS} kombinasyon kabul eder.`); return; }
    const template: EtsyVariationTemplate = {
      id: !asNew && draft.id ? draft.id : `vt-${Date.now()}`,
      name: asNew && draft.id && name === templates.find((t) => t.id === draft.id)?.name ? `${name} (kopya)` : name,
      updatedAt: new Date().toISOString(),
      variations: draft.rows.map(cleanRow),
    };
    const exists = templates.some((t) => t.id === template.id);
    const next = exists ? templates.map((t) => (t.id === template.id ? template : t)) : [...templates, template];
    if (await persist(next, exists ? `"${template.name}" kaydedildi.` : `"${template.name}" şablonu oluşturuldu.`)) {
      openDraft({ id: template.id, name: template.name, rows: template.variations });
    }
  };

  const remove = (template: EtsyVariationTemplate) => {
    if (!templates || !window.confirm(`"${template.name}" şablonu silinsin mi? Bu şablona bağlı otomasyonlar Ayarlar'daki varyasyonları kullanır.`)) return;
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
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2.5 bg-slate-50/60 dark:bg-slate-950/40">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Kayıtlı şablonlar</span>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setImportOpen(true)} disabled={!templates} className={`${smallBtn} border border-orange-200 dark:border-orange-500/40 text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-500/10`}>
            <Store className="w-3.5 h-3.5" /> Etsy ilanından çek
          </button>
          <button type="button" onClick={() => openDraft({ id: null, name: '', rows: newTemplateRows() })} disabled={!templates} className={`${smallBtn} border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800`}>
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
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-500/40 bg-white dark:bg-slate-900 p-3 space-y-3">
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
          <VariationSheet rows={draft.rows} onChange={(rows) => setDraft({ ...draft, rows })} />
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={() => void saveDraft(false)} disabled={busy || (!dirty && draft.id !== null)} className={`${smallBtn} bg-indigo-600 hover:bg-indigo-500 text-white`}>
              {busy ? <Spinner className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />} {draft.id ? 'Kaydet' : 'Şablon olarak kaydet'}
            </button>
            {draft.id && (
              <button type="button" onClick={() => void saveDraft(true)} disabled={busy} className={`${smallBtn} border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200`}>
                Yeni şablon olarak kaydet
              </button>
            )}
            <button type="button" onClick={() => onUseAsDefault(draft.rows)} disabled={draft.rows.length === 0} className={`${smallBtn} text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 ml-auto`} title="Bu varyasyonları Üretim'den oluşturulan ilanların varsayılanı yapar">
              <Download className="w-3.5 h-3.5" /> Varsayılan varyasyonlara aktar
            </button>
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

/**
 * Excel benzeri varyasyon tablosu: filtreler, toplu fiyat/stok/satış durumu, beden ve renk ekleme/çıkarma,
 * ok tuşları ve Enter ile hücreler arasında gezinme, Excel'den çok satırlı yapıştırma (aşağı doğru doldurur).
 */
function VariationSheet({ rows, onChange }: { rows: EtsyVariationRow[]; onChange: (rows: EtsyVariationRow[]) => void }) {
  const [sizeFilter, setSizeFilter] = useState('');
  const [colorFilter, setColorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'on' | 'off'>('all');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkPrice, setBulkPrice] = useState('');
  const [bulkQty, setBulkQty] = useState('');
  const [newSize, setNewSize] = useState('');
  const [newColor, setNewColor] = useState('');
  const tableRef = useRef<HTMLTableElement>(null);

  const sizes = useMemo(() => unique(rows.map((r) => r.size)), [rows]);
  const colors = useMemo(() => unique(rows.map((r) => r.color)), [rows]);
  const visible = useMemo(() => rows.filter((r) =>
    (!sizeFilter || r.size === sizeFilter)
    && (!colorFilter || r.color === colorFilter)
    && (statusFilter === 'all' || (statusFilter === 'on') === r.enabled)), [rows, sizeFilter, colorFilter, statusFilter]);
  const targetIds = useMemo(() => {
    const chosen = visible.filter((r) => selected.has(r.id));
    return new Set((chosen.length > 0 ? chosen : visible).map((r) => r.id));
  }, [visible, selected]);
  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r.id));
  const enabledCount = rows.filter((r) => r.enabled).length;

  const patchRows = (ids: Set<string>, patch: (row: EtsyVariationRow) => Partial<EtsyVariationRow>) =>
    onChange(rows.map((r) => (ids.has(r.id) ? { ...r, ...patch(r) } : r)));
  const patchRow = (id: string, patch: Partial<EtsyVariationRow>) => onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  /** Bir bedenin mevcut fiyatı (yoksa en düşük fiyat) yeni renklerde kullanılır. */
  const priceFor = (size: string) => rows.find((r) => r.size === size)?.price ?? (rows.length > 0 ? Math.min(...rows.map((r) => r.price)) : 24.99);
  const quantityFor = () => rows[0]?.quantity ?? 999;

  const addCombos = (newSizes: string[], newColors: string[]) => {
    const existing = new Set(rows.map((r) => rowKey(r.size, r.color)));
    const ids = new Set(rows.map((r) => r.id));
    const uniqueId = (base: string) => {
      let id = base;
      for (let n = 2; ids.has(id); n++) id = `${base}-${n}`;
      ids.add(id);
      return id;
    };
    const added: EtsyVariationRow[] = [];
    for (const size of newSizes) {
      for (const color of newColors) {
        if (existing.has(rowKey(size, color))) continue;
        existing.add(rowKey(size, color));
        added.push({ id: uniqueId(newRowId(size, color)), size, color, price: priceFor(size), quantity: quantityFor(), sku: '', enabled: true });
      }
    }
    onChange([...rows, ...added]);
  };

  const addSize = () => {
    const size = newSize.replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!size) return;
    addCombos([size], colors.length > 0 ? colors : ['']);
    setNewSize('');
  };
  const addColor = () => {
    const color = newColor.replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!color) return;
    addCombos(sizes.length > 0 ? sizes : [''], [color]);
    setNewColor('');
  };

  /** Ok tuşları/Enter ile aynı sütunda üst/alt satıra geçer. */
  const moveFocus = (e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, column: string) => {
    const delta = e.key === 'ArrowDown' || e.key === 'Enter' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = tableRef.current?.querySelector<HTMLInputElement>(`input[data-row="${rowIndex + delta}"][data-col="${column}"]`);
    next?.focus();
    next?.select();
  };

  /** Excel'den kopyalanan çok satırlı değerler bu hücreden aşağı doğru görünen satırlara yazılır. */
  const pasteDown = (e: React.ClipboardEvent<HTMLInputElement>, rowIndex: number, field: 'price' | 'quantity') => {
    const lines = e.clipboardData.getData('text').split(/\r?\n/).map((l) => l.split('\t')[0]!.trim()).filter((l) => l !== '');
    if (lines.length < 2) return;
    e.preventDefault();
    const updates = new Map<string, number>();
    lines.forEach((line, i) => {
      const row = visible[rowIndex + i];
      const value = Number(line.replace(/[^\d.,-]/g, '').replace(',', '.'));
      if (row && Number.isFinite(value)) updates.set(row.id, field === 'price' ? Math.round(value * 100) / 100 : Math.max(0, Math.min(999, Math.trunc(value))));
    });
    onChange(rows.map((r) => (updates.has(r.id) ? { ...r, [field]: updates.get(r.id)! } : r)));
  };

  const removeValue = (kind: 'size' | 'color', value: string) => {
    onChange(rows.filter((r) => r[kind] !== value));
    if (kind === 'size' && sizeFilter === value) setSizeFilter('');
    if (kind === 'color' && colorFilter === value) setColorFilter('');
  };

  const sortRows = () => {
    const order = (list: string[], v: string) => list.indexOf(v);
    onChange([...rows].sort((a, b) => order(colors, a.color) - order(colors, b.color) || order(sizes, a.size) - order(sizes, b.size)));
  };

  const targetLabel = selected.size > 0 && visible.some((r) => selected.has(r.id)) ? `${targetIds.size} seçili satıra` : `${targetIds.size} görünen satıra`;
  const cellInput = 'w-full min-w-0 px-2 py-1.5 bg-transparent text-right tabular-nums outline-none rounded focus:bg-indigo-50 dark:focus:bg-indigo-500/15 focus:ring-1 focus:ring-indigo-400';

  return (
    <div className="space-y-2.5">
      {/* Bedenler ve renkler: ekle / çıkar (çıkarılınca o satırlar silinir) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {([['size', 'Bedenler', sizes, newSize, setNewSize, addSize], ['color', 'Renkler', colors, newColor, setNewColor, addColor]] as const).map(([kind, label, values, draftValue, setDraftValue, add]) => (
          <div key={kind} className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 space-y-1.5">
            <span className="block text-[11px] font-bold text-slate-500 dark:text-slate-400">{label} ({values.filter(Boolean).length})</span>
            <div className="flex flex-wrap gap-1">
              {values.filter(Boolean).map((value) => (
                <span key={value} className="inline-flex items-center gap-0.5 pl-2 pr-0.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                  {value}
                  <button type="button" onClick={() => removeValue(kind, value)} aria-label={`${value} ve satırlarını kaldır`} className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
            <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); add(); }}>
              <input value={draftValue} onChange={(e) => setDraftValue(e.target.value)} placeholder={kind === 'size' ? 'Beden ekle (ör. 4XL)' : 'Renk ekle (ör. Forest Green)'} aria-label={kind === 'size' ? 'Yeni beden' : 'Yeni renk'} className={`${inputClass} !py-1.5 !text-xs`} />
              <button type="submit" disabled={!draftValue.trim()} aria-label="Ekle" className="shrink-0 px-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 disabled:opacity-40"><Plus className="w-3.5 h-3.5" /></button>
            </form>
          </div>
        ))}
      </div>

      {/* Filtreler ve toplu düzenleme */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <select value={sizeFilter} onChange={(e) => setSizeFilter(e.target.value)} aria-label="Bedene göre süz" className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs">
          <option value="">Tüm bedenler</option>
          {sizes.map((s) => <option key={s} value={s}>{s || '(boş)'}</option>)}
        </select>
        <select value={colorFilter} onChange={(e) => setColorFilter(e.target.value)} aria-label="Renge göre süz" className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs">
          <option value="">Tüm renkler</option>
          {colors.map((c) => <option key={c} value={c}>{c || '(boş)'}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} aria-label="Duruma göre süz" className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs">
          <option value="all">Tüm durumlar</option>
          <option value="on">Satışta</option>
          <option value="off">Satışta değil</option>
        </select>
        <button type="button" onClick={sortRows} className="px-2 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold">Sırala (renk › beden)</button>
        <span className={`ml-auto font-semibold ${rows.length > MAX_VARIATION_COMBINATIONS ? 'text-red-600' : 'text-slate-500 dark:text-slate-400'}`}>
          {enabledCount} satışta · {rows.length}/{MAX_VARIATION_COMBINATIONS}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs">
        <span className="font-semibold text-slate-500 dark:text-slate-400 mr-1">Toplu ({targetLabel}):</span>
        <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); const v = Number(bulkPrice); if (v > 0) { patchRows(targetIds, () => ({ price: Math.round(v * 100) / 100 })); setBulkPrice(''); } }}>
          <input value={bulkPrice} onChange={(e) => setBulkPrice(e.target.value)} type="number" min={0.2} step={0.01} placeholder="Fiyat" aria-label="Toplu fiyat" className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950" />
          <button type="submit" disabled={!(Number(bulkPrice) > 0)} className="px-2 py-1.5 rounded-lg bg-indigo-600 text-white font-bold disabled:opacity-40">Uygula</button>
        </form>
        <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); const v = Math.trunc(Number(bulkQty)); if (bulkQty !== '' && v >= 0) { patchRows(targetIds, () => ({ quantity: Math.min(999, v) })); setBulkQty(''); } }}>
          <input value={bulkQty} onChange={(e) => setBulkQty(e.target.value)} type="number" min={0} max={999} placeholder="Stok" aria-label="Toplu stok" className="w-16 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950" />
          <button type="submit" disabled={bulkQty === ''} className="px-2 py-1.5 rounded-lg bg-indigo-600 text-white font-bold disabled:opacity-40">Uygula</button>
        </form>
        <button type="button" onClick={() => patchRows(targetIds, () => ({ enabled: true }))} className="px-2 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-bold">Satışa aç</button>
        <button type="button" onClick={() => patchRows(targetIds, () => ({ enabled: false }))} className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold">Satıştan kaldır</button>
      </div>

      {/* Tablo */}
      <div className="overflow-auto max-h-[28rem] rounded-lg border border-slate-200 dark:border-slate-700">
        <table ref={tableRef} className="w-full min-w-[30rem] text-xs border-collapse">
          <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            <tr>
              <th className="w-9 p-2 border-b border-slate-200 dark:border-slate-700">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={() => setSelected(allVisibleSelected ? new Set() : new Set(visible.map((r) => r.id)))}
                  aria-label="Görünen satırların tümünü seç"
                  className="w-4 h-4 rounded"
                />
              </th>
              <th className="p-2 text-left font-bold border-b border-slate-200 dark:border-slate-700 w-20">Satışta</th>
              <th className="p-2 text-left font-bold border-b border-slate-200 dark:border-slate-700">Beden</th>
              <th className="p-2 text-left font-bold border-b border-slate-200 dark:border-slate-700">Renk</th>
              <th className="p-2 text-right font-bold border-b border-slate-200 dark:border-slate-700 w-28">Fiyat</th>
              <th className="p-2 text-right font-bold border-b border-slate-200 dark:border-slate-700 w-24">Stok</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row, index) => (
              <tr key={row.id} className={`border-b border-slate-100 dark:border-slate-800 ${selected.has(row.id) ? 'bg-indigo-50/70 dark:bg-indigo-500/10' : 'odd:bg-white even:bg-slate-50/60 dark:odd:bg-slate-900 dark:even:bg-slate-900/60'} ${row.enabled ? '' : 'text-slate-400'}`}>
                <td className="p-2 text-center">
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={() => setSelected((prev) => { const next = new Set(prev); if (next.has(row.id)) next.delete(row.id); else next.add(row.id); return next; })}
                    aria-label={`${row.size} ${row.color} seç`}
                    className="w-4 h-4 rounded"
                  />
                </td>
                <td className="p-2">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={row.enabled}
                    aria-label={`${row.size} ${row.color} satışta`}
                    onClick={() => patchRow(row.id, { enabled: !row.enabled })}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${row.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${row.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </td>
                <td className="p-2 font-bold text-indigo-700 dark:text-indigo-300 whitespace-nowrap">{row.size || '—'}</td>
                <td className="p-2 font-semibold whitespace-nowrap">{row.color || '—'}</td>
                <td className="p-0.5">
                  <input
                    type="number"
                    min={0.2}
                    step={0.01}
                    value={row.price}
                    data-row={index}
                    data-col="price"
                    onChange={(e) => patchRow(row.id, { price: Math.round((Number(e.target.value) || 0) * 100) / 100 })}
                    onKeyDown={(e) => moveFocus(e, index, 'price')}
                    onPaste={(e) => pasteDown(e, index, 'price')}
                    onFocus={(e) => e.target.select()}
                    aria-label={`${row.size} ${row.color} fiyat`}
                    className={`${cellInput} font-bold ${row.price < 0.2 ? 'text-red-600' : 'text-emerald-700 dark:text-emerald-400'}`}
                  />
                </td>
                <td className="p-0.5">
                  <input
                    type="number"
                    min={0}
                    max={999}
                    value={row.quantity}
                    data-row={index}
                    data-col="quantity"
                    onChange={(e) => patchRow(row.id, { quantity: Math.max(0, Math.min(999, Math.trunc(Number(e.target.value) || 0))) })}
                    onKeyDown={(e) => moveFocus(e, index, 'quantity')}
                    onPaste={(e) => pasteDown(e, index, 'quantity')}
                    onFocus={(e) => e.target.select()}
                    aria-label={`${row.size} ${row.color} stok`}
                    className={cellInput}
                  />
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-slate-500">{rows.length === 0 ? 'Henüz varyasyon yok: yukarıdan beden ve renk ekleyin.' : 'Filtrelere uyan satır yok.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        İpucu: Hücreler arasında ↑/↓ veya Enter ile gezinin. Excel&apos;den bir sütun kopyalayıp fiyat ya da stok hücresine yapıştırırsanız değerler aşağı doğru doldurulur. Toplu işlemler satır seçiliyse seçili satırlara, değilse görünen satırlara uygulanır.
      </p>
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
