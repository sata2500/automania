'use client';

/**
 * Kayıtlı varyasyon şablonları (Ayarlar › Varyasyonlar): liste, Excel benzeri tablo düzenleyici ve Etsy
 * ilanından içe aktarma. Şablonlar `PUT /api/workspace/variation-templates` ile kaydedilir; bir şablona bağlı
 * otomasyonlar sonraki çalıştırmada güncel satırları kullanır.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { Check, FilePlus2, Filter, Pencil, Plus, Save, Search, Store, Trash2, X } from 'lucide-react';
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

export function VariationTemplatesPanel() {
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

/**
 * Tablo başlığı filtresi: başlığa dokununca seçenekler onay kutularıyla açılır (çok seçenekte arama),
 * "Uygula" ile tablo süzülür. Boş seçim = hepsi. Pencere tablonun kaydırma alanına kırpılmasın diye
 * ekrana sabitlenir.
 */
function HeaderFilter({ label, options, selected, onChange, align = 'left' }: {
  label: string;
  options: Array<{ value: string; label: string }>;
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  align?: 'left' | 'right';
}) {
  const [anchor, setAnchor] = useState<{ top: number; left: number; width: number } | null>(null);
  const [draft, setDraft] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState('');
  const active = selected.size > 0;

  const open = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = Math.min(288, window.innerWidth - 16);
    const left = Math.max(8, Math.min(align === 'right' ? rect.right - width : rect.left, window.innerWidth - width - 8));
    // Aşağıda yer azsa (alt menü dahil) pencere ekranın üst yarısına sığacak şekilde yukarı alınır.
    setAnchor({ top: Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 420)), left, width });
    setDraft(new Set(selected));
    setQuery('');
  };
  const close = () => setAnchor(null);
  const shown = options.filter((o) => !query.trim() || o.label.toLocaleLowerCase('tr').includes(query.trim().toLocaleLowerCase('tr')));
  const toggle = (value: string) => setDraft((prev) => { const next = new Set(prev); if (next.has(value)) next.delete(value); else next.add(value); return next; });

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        aria-expanded={anchor !== null}
        className={`inline-flex items-center gap-1 max-w-full uppercase font-bold ${active ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
      >
        <span className="truncate">{label}</span>
        <Filter className={`w-3 h-3 shrink-0 ${active ? 'fill-current' : ''}`} aria-hidden="true" />
        {active && <span className="shrink-0 px-1 rounded bg-indigo-600 text-white text-[9px] normal-case">{selected.size}</span>}
      </button>
      {anchor && createPortal(
        <>
          <div className="fixed inset-0 z-[80]" onClick={close} aria-hidden="true" />
          <div
            role="dialog"
            aria-label={`${label} filtresi`}
            onKeyDown={(e) => { if (e.key === 'Escape') close(); }}
            style={{ top: anchor.top, left: anchor.left, width: anchor.width }}
            className="fixed z-[81] flex flex-col max-h-[min(24rem,70vh)] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl normal-case tracking-normal text-left"
          >
            {options.length > 8 && (
              <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`${label} ara`} aria-label={`${label} ara`} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-normal" />
              </div>
            )}
            <div className="flex items-center justify-between px-3 pt-2 text-[11px] font-bold">
              <button type="button" onClick={() => setDraft(new Set([...draft, ...shown.map((o) => o.value)]))} className="text-indigo-600 dark:text-indigo-300">Tümünü seç</button>
              <button type="button" onClick={() => setDraft(new Set())} className="text-slate-500 dark:text-slate-400">Temizle</button>
            </div>
            <ul className="flex-1 overflow-y-auto p-1.5">
              {shown.map((o) => {
                const on = draft.has(o.value);
                return (
                  <li key={o.value}>
                    <label className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                      <input type="checkbox" checked={on} onChange={() => toggle(o.value)} className="w-4 h-4 rounded accent-indigo-600" />
                      <span className="truncate">{o.label}</span>
                    </label>
                  </li>
                );
              })}
              {shown.length === 0 && <li className="px-2 py-3 text-xs text-slate-500">Eşleşen yok.</li>}
            </ul>
            <div className="flex items-center gap-2 p-2 border-t border-slate-100 dark:border-slate-800">
              <span className="flex-1 text-[11px] text-slate-500 dark:text-slate-400">{draft.size === 0 ? 'Hepsi gösterilir' : `${draft.size} seçili`}</span>
              <button type="button" onClick={close} className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300">İptal</button>
              <button type="button" onClick={() => { onChange(draft); close(); }} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold"><Check className="w-3.5 h-3.5" /> Uygula</button>
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}

/**
 * Excel benzeri varyasyon tablosu (Satış, Beden, Renk, Fiyat). Filtreler başlıklardadır (çoklu seçim);
 * toplu fiyat ve "Satışa aç/Kapat" yalnızca görünen (filtrelenen) satırlara uygulanır. Stok gösterilmez:
 * baskıya göre üretimde ilan her kombinasyon için 999 stokla yayınlanır. ↑/↓/Enter ile hücreler arasında
 * gezilir; Excel'den çok satırlı yapıştırma aşağı doğru doldurur.
 */
function VariationSheet({ rows, onChange }: { rows: EtsyVariationRow[]; onChange: (rows: EtsyVariationRow[]) => void }) {
  const [sizeFilter, setSizeFilter] = useState<Set<string>>(() => new Set());
  const [colorFilter, setColorFilter] = useState<Set<string>>(() => new Set());
  const [statusFilter, setStatusFilter] = useState<Set<string>>(() => new Set());
  const [bulkPrice, setBulkPrice] = useState('');
  const [newSize, setNewSize] = useState('');
  const [newColor, setNewColor] = useState('');
  const [manageOpen, setManageOpen] = useState(rows.length === 0);
  const tableRef = useRef<HTMLTableElement>(null);

  const sizes = useMemo(() => unique(rows.map((r) => r.size)), [rows]);
  const colors = useMemo(() => unique(rows.map((r) => r.color)), [rows]);
  const visible = useMemo(() => rows.filter((r) =>
    (sizeFilter.size === 0 || sizeFilter.has(r.size))
    && (colorFilter.size === 0 || colorFilter.has(r.color))
    && (statusFilter.size === 0 || statusFilter.has(r.enabled ? 'on' : 'off'))), [rows, sizeFilter, colorFilter, statusFilter]);
  const visibleIds = useMemo(() => new Set(visible.map((r) => r.id)), [visible]);
  const filtered = sizeFilter.size > 0 || colorFilter.size > 0 || statusFilter.size > 0;
  const clearFilters = () => { setSizeFilter(new Set()); setColorFilter(new Set()); setStatusFilter(new Set()); };
  const enabledCount = rows.filter((r) => r.enabled).length;

  const patchVisible = (patch: Partial<EtsyVariationRow>) => onChange(rows.map((r) => (visibleIds.has(r.id) ? { ...r, ...patch } : r)));
  const patchRow = (id: string, patch: Partial<EtsyVariationRow>) => onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const bulkValue = Number(bulkPrice.replace(',', '.'));

  const applyBulk = () => {
    if (!(bulkValue > 0)) return;
    patchVisible({ price: Math.round(bulkValue * 100) / 100 });
    setBulkPrice('');
  };

  /** Bir bedenin mevcut fiyatı (yoksa en düşük fiyat) yeni renklerde kullanılır. */
  const priceFor = (size: string) => rows.find((r) => r.size === size)?.price ?? (rows.length > 0 ? Math.min(...rows.map((r) => r.price)) : 24.99);

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
        added.push({ id: uniqueId(newRowId(size, color)), size, color, price: priceFor(size), quantity: 999, sku: '', enabled: true });
      }
    }
    onChange([...rows, ...added]);
  };
  const addValue = (kind: 'size' | 'color') => {
    const raw = kind === 'size' ? newSize : newColor;
    const values = unique(raw.split(',').map((v) => v.replace(/\s+/g, ' ').trim().slice(0, 60)));
    if (values.length === 0) return;
    if (kind === 'size') { addCombos(values, colors.length > 0 ? colors : ['']); setNewSize(''); }
    else { addCombos(sizes.length > 0 ? sizes : [''], values); setNewColor(''); }
  };
  const removeValue = (kind: 'size' | 'color', value: string) => {
    onChange(rows.filter((r) => r[kind] !== value));
    const setter = kind === 'size' ? setSizeFilter : setColorFilter;
    setter((prev) => { const next = new Set(prev); next.delete(value); return next; });
  };

  /** Ok tuşları/Enter ile üst/alt satırın fiyat hücresine geçer. */
  const moveFocus = (e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number) => {
    const delta = e.key === 'ArrowDown' || e.key === 'Enter' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = tableRef.current?.querySelector<HTMLInputElement>(`input[data-row="${rowIndex + delta}"]`);
    next?.focus();
    next?.select();
  };

  /** Excel'den kopyalanan çok satırlı fiyatlar bu hücreden aşağı doğru görünen satırlara yazılır. */
  const pasteDown = (e: React.ClipboardEvent<HTMLInputElement>, rowIndex: number) => {
    const lines = e.clipboardData.getData('text').split(/\r?\n/).map((l) => l.split('\t')[0]!.trim()).filter((l) => l !== '');
    if (lines.length < 2) return;
    e.preventDefault();
    const updates = new Map<string, number>();
    lines.forEach((line, i) => {
      const row = visible[rowIndex + i];
      const value = Number(line.replace(/[^\d.,-]/g, '').replace(',', '.'));
      if (row && Number.isFinite(value)) updates.set(row.id, Math.round(value * 100) / 100);
    });
    onChange(rows.map((r) => (updates.has(r.id) ? { ...r, price: updates.get(r.id)! } : r)));
  };

  const sortRows = () => {
    const order = (list: string[], v: string) => list.indexOf(v);
    onChange([...rows].sort((a, b) => order(colors, a.color) - order(colors, b.color) || order(sizes, a.size) - order(sizes, b.size)));
  };

  const cellInput = 'w-full min-w-0 px-1 sm:px-1.5 py-1.5 bg-transparent text-right tabular-nums outline-none rounded focus:bg-indigo-50 dark:focus:bg-indigo-500/15 focus:ring-1 focus:ring-indigo-400';
  const smallInput = 'w-full min-w-0 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs';

  return (
    <div className="space-y-2">
      {/* Beden ve renk yönetimi (açılır) */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-700">
        <button type="button" onClick={() => setManageOpen((v) => !v)} aria-expanded={manageOpen} className="w-full flex items-center justify-between gap-2 px-2.5 py-2 text-[11px] font-bold text-slate-600 dark:text-slate-300">
          <span>Bedenler ({sizes.length}) · Renkler ({colors.length})</span>
          <span className="text-indigo-600 dark:text-indigo-300">{manageOpen ? 'Kapat' : 'Ekle / çıkar'}</span>
        </button>
        {manageOpen && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 pt-0">
            {(['size', 'color'] as const).map((kind) => {
              const values = kind === 'size' ? sizes : colors;
              const draftValue = kind === 'size' ? newSize : newColor;
              const setDraftValue = kind === 'size' ? setNewSize : setNewColor;
              return (
                <div key={kind} className="space-y-1.5">
                  <div className="flex flex-wrap gap-1">
                    {values.map((value) => (
                      <span key={value} className="inline-flex items-center gap-0.5 pl-2 pr-0.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                        {value}
                        <button type="button" onClick={() => removeValue(kind, value)} aria-label={`${value} ve satırlarını kaldır`} className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                  <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); addValue(kind); }}>
                    <input value={draftValue} onChange={(e) => setDraftValue(e.target.value)} placeholder={kind === 'size' ? 'Beden ekle (ör. 4XL, 5XL)' : 'Renk ekle (ör. Forest Green)'} aria-label={kind === 'size' ? 'Yeni beden' : 'Yeni renk'} className={smallInput} />
                    <button type="submit" disabled={!draftValue.trim()} aria-label="Ekle" className="shrink-0 px-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 disabled:opacity-40"><Plus className="w-3.5 h-3.5" /></button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Toplu düzenleme: görünen satırlara uygulanır */}
      <form className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg bg-indigo-50/70 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/30 text-xs" onSubmit={(e) => { e.preventDefault(); applyBulk(); }}>
        <span className="w-full sm:w-auto font-semibold text-slate-700 dark:text-slate-200">
          {filtered ? `Görünen ${visible.length} satırın` : `Tüm ${visible.length} satırın`} fiyatı:
        </span>
        <input value={bulkPrice} onChange={(e) => setBulkPrice(e.target.value)} inputMode="decimal" placeholder="Ör. 26.99" aria-label="Toplu fiyat" className={`${smallInput} !w-24`} />
        <button type="submit" disabled={visible.length === 0 || !(bulkValue > 0)} className="px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white font-bold disabled:opacity-40">Uygula</button>
        <span className="hidden sm:block w-px h-5 bg-indigo-200 dark:bg-indigo-500/30" />
        <button type="button" disabled={visible.length === 0} onClick={() => patchVisible({ enabled: true })} className="px-2 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-500/40 bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 font-bold disabled:opacity-40">Satışa aç</button>
        <button type="button" disabled={visible.length === 0} onClick={() => patchVisible({ enabled: false })} className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 font-bold disabled:opacity-40">Kapat</button>
      </form>

      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className={`font-semibold ${rows.length > MAX_VARIATION_COMBINATIONS ? 'text-red-600' : 'text-slate-500 dark:text-slate-400'}`}>
          {enabledCount} satışta · {rows.length}/{MAX_VARIATION_COMBINATIONS} kombinasyon
        </span>
        <span className="flex items-center gap-3">
          {filtered && <button type="button" onClick={clearFilters} className="font-bold text-indigo-600 dark:text-indigo-300">Filtreleri temizle</button>}
          <button type="button" onClick={sortRows} className="font-bold text-slate-600 dark:text-slate-300">Sırala</button>
        </span>
      </div>

      <div className="overflow-auto max-h-[60vh] sm:max-h-[28rem] rounded-lg border border-slate-200 dark:border-slate-700">
        <table ref={tableRef} className="w-full table-fixed text-xs border-collapse">
          <colgroup>
            {/* Telefonda beden (ürün + beden adı) geniş, renk dar; masaüstünde dengeli */}
            <col className="w-[3.25rem] sm:w-20" />
            <col />
            <col className="w-[23%] sm:w-[34%]" />
            <col className="w-[4rem] sm:w-28" />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
            <tr className="text-[10px] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
              <th className="px-1 sm:px-2 py-2 text-left">
                <HeaderFilter label="Satış" options={[{ value: 'on', label: 'Satışta' }, { value: 'off', label: 'Kapalı' }]} selected={statusFilter} onChange={setStatusFilter} />
              </th>
              <th className="px-1.5 sm:px-2 py-2 text-left">
                <HeaderFilter label="Beden" options={sizes.map((v) => ({ value: v, label: v }))} selected={sizeFilter} onChange={setSizeFilter} />
              </th>
              <th className="px-1 sm:px-1.5 py-2 text-left">
                <HeaderFilter label="Renk" options={colors.map((v) => ({ value: v, label: v }))} selected={colorFilter} onChange={setColorFilter} />
              </th>
              <th className="px-2 py-2 text-right font-bold uppercase tracking-wide">Fiyat</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row, index) => (
              <tr key={row.id} className={`border-b border-slate-100 dark:border-slate-800 odd:bg-white even:bg-slate-50/60 dark:odd:bg-slate-900 dark:even:bg-slate-900/60 ${row.enabled ? '' : 'text-slate-400'}`}>
                <td className="px-1 sm:px-2 py-1">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={row.enabled}
                    aria-label={`${row.size} ${row.color} satışta`}
                    onClick={() => patchRow(row.id, { enabled: !row.enabled })}
                    className={`relative inline-flex h-5 w-8 sm:w-9 items-center rounded-full transition-colors ${row.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${row.enabled ? 'translate-x-3.5 sm:translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </td>
                <td className="px-1.5 sm:px-2 py-1 text-[11px] sm:text-xs font-bold text-indigo-700 dark:text-indigo-300 truncate" title={row.size}>{row.size || '—'}</td>
                <td className="px-1 sm:px-1.5 py-1 text-[11px] sm:text-xs font-semibold truncate" title={row.color}>{row.color || '—'}</td>
                <td className="p-0.5">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0.2}
                    step={0.01}
                    value={row.price}
                    data-row={index}
                    onChange={(e) => patchRow(row.id, { price: Math.round((Number(e.target.value) || 0) * 100) / 100 })}
                    onKeyDown={(e) => moveFocus(e, index)}
                    onPaste={(e) => pasteDown(e, index)}
                    onFocus={(e) => e.target.select()}
                    aria-label={`${row.size} ${row.color} fiyat`}
                    className={`${cellInput} font-bold ${row.price < 0.2 ? 'text-red-600' : row.enabled ? 'text-emerald-700 dark:text-emerald-400' : ''}`}
                  />
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={4} className="p-6 text-center text-slate-500">{rows.length === 0 ? 'Henüz varyasyon yok: yukarıdan beden ve renk ekleyin.' : 'Filtrelere uyan satır yok.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        Stok gösterilmez: baskıya göre üretim için her kombinasyon Etsy&apos;ye 999 stokla gönderilir.<span className="hidden sm:inline"> ↑/↓ veya Enter ile fiyatlar arasında gezinin; Excel&apos;den bir fiyat sütunu yapıştırırsanız aşağı doğru doldurulur.</span>
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
