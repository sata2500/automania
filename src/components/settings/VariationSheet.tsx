'use client';

/**
 * Excel benzeri varyasyon tablosu (Satış, Beden, Renk, Fiyat).
 * - Beden, renk ve fiyat hücrelerine doğrudan yazılır; alttaki boş satırlara yazınca yeni satır açılır.
 * - Hücre seçimi: tıkla (Shift+tıkla / fareyle sürükle ile aralık); telefonda seçimin sol altındaki yuvarlak
 *   tutamaç sürüklenerek aralık genişletilir.
 * - Doldurma tutamacı (seçimin sağ altındaki kare): aşağı/yukarı çekince tek hücre kopyalanır, birden fazla hücre
 *   örüntü olarak tekrarlanır (Sarı, Kırmızı, Mavi → Sarı, Kırmızı, Mavi, Sarı…); boş satırlara çekince satır
 *   eklenir. Çift tıklama tablonun sonuna kadar doldurur.
 * - Excel'den çok hücreli yapıştırma, Ctrl+C ile seçimi kopyalama, Delete ile seçili beden/renkleri temizleme.
 * Filtreler başlıklardadır; filtre açıkken yalnızca görünen satırlar değişir ve yeni satır eklenmez.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Check, Filter, Trash2 } from 'lucide-react';
import { MAX_VARIATION_COMBINATIONS } from '@/lib/listing-defaults';
import { fillTargets, parseClipboardGrid, parsePrice } from '@/lib/sheet-fill';
import type { EtsyVariationRow } from '@/types/pod';

type Col = 'size' | 'color' | 'price';
const COLS: Col[] = ['size', 'color', 'price'];
const COL_LABEL: Record<Col, string> = { size: 'beden', color: 'renk', price: 'fiyat' };
type Cell = { r: number; c: number };
type Selection = { anchor: Cell; focus: Cell };
type Box = { top: number; bottom: number; left: number; right: number };
type CellValue = string | number;

/** Alta her zaman eklenen boş satır sayısı (yazınca veya doldurunca gerçek satır olur). */
const GHOST_ROWS = 5;

const boxOf = (s: Selection): Box => ({
  top: Math.min(s.anchor.r, s.focus.r),
  bottom: Math.max(s.anchor.r, s.focus.r),
  left: Math.min(s.anchor.c, s.focus.c),
  right: Math.max(s.anchor.c, s.focus.c),
});
let rowSeq = 0;
/** Yeni satır kimliği (tablo kayıtlı satırların kimliklerinden bağımsızdır). */
const newRowId = () => `row-${Date.now().toString(36)}-${rowSeq++}`;
const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));
const comboKey = (r: EtsyVariationRow) => `${r.size.trim().toLocaleLowerCase('tr')}\u0000${r.color.trim().toLocaleLowerCase('tr')}`;

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
              {shown.map((o) => (
                <li key={o.value}>
                  <label className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                    <input type="checkbox" checked={draft.has(o.value)} onChange={() => toggle(o.value)} className="w-4 h-4 rounded accent-indigo-600" />
                    <span className="truncate">{o.label}</span>
                  </label>
                </li>
              ))}
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

export function VariationSheet({ rows, onChange }: { rows: EtsyVariationRow[]; onChange: (rows: EtsyVariationRow[]) => void }) {
  const [sizeFilter, setSizeFilter] = useState<Set<string>>(() => new Set());
  const [colorFilter, setColorFilter] = useState<Set<string>>(() => new Set());
  const [statusFilter, setStatusFilter] = useState<Set<string>>(() => new Set());
  const [bulkPrice, setBulkPrice] = useState('');
  const [sel, setSel] = useState<Selection | null>(null);
  const [fillTo, setFillTo] = useState<number | null>(null);
  const [extraGhosts, setExtraGhosts] = useState(0);
  // Fiyat hücresi düzenlenirken yazılan metin (yazarken "24." gibi ara değerler bozulmasın)
  const [priceDraft, setPriceDraft] = useState<{ r: number; text: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Hücreye tıklanınca içerik seçili gelir (Excel gibi yazılan değer eskisinin yerine geçer); odaklanmayı izleyen
  // fare bırakması seçimi bozmasın diye bir kez engellenir.
  const justFocused = useRef(false);
  const dragRef = useRef<{ kind: 'fill' | 'select' | 'mouse'; anchor: Cell; x: number; y: number; startX: number; startY: number; active: boolean; frame: number; ticks: number; to: number } | null>(null);

  const sizes = useMemo(() => unique(rows.map((r) => r.size.trim())), [rows]);
  const colors = useMemo(() => unique(rows.map((r) => r.color.trim())), [rows]);
  const visible = useMemo(() => rows.filter((r) =>
    (sizeFilter.size === 0 || sizeFilter.has(r.size.trim()))
    && (colorFilter.size === 0 || colorFilter.has(r.color.trim()))
    && (statusFilter.size === 0 || statusFilter.has(r.enabled ? 'on' : 'off'))), [rows, sizeFilter, colorFilter, statusFilter]);
  const filtered = sizeFilter.size > 0 || colorFilter.size > 0 || statusFilter.size > 0;
  const clearFilters = () => { setSizeFilter(new Set()); setColorFilter(new Set()); setStatusFilter(new Set()); setSel(null); };
  const room = MAX_VARIATION_COMBINATIONS - rows.length;
  const ghostCount = filtered ? 0 : Math.max(0, Math.min(GHOST_ROWS + extraGhosts, room));
  const displayCount = visible.length + ghostCount;
  const enabledCount = rows.filter((r) => r.enabled).length;

  const duplicates = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) if (r.size.trim() || r.color.trim()) counts.set(comboKey(r), (counts.get(comboKey(r)) ?? 0) + 1);
    return new Set([...counts].filter(([, n]) => n > 1).map(([key]) => key));
  }, [rows]);

  const valueAt = (r: number, c: number): CellValue => {
    const row = visible[r];
    if (!row) return COLS[c] === 'price' ? '' : '';
    return row[COLS[c]!];
  };

  /** Hücre değişikliklerini uygular; görünenlerin altındaki (boş) satırlara yazılan değerler yeni satır açar. */
  const commit = (updates: Map<number, Partial<EtsyVariationRow>>) => {
    if (updates.size === 0) return;
    const byId = new Map<string, Partial<EtsyVariationRow>>();
    let maxNew = -1;
    for (const [r, patch] of updates) {
      const row = visible[r];
      if (row) byId.set(row.id, { ...byId.get(row.id), ...patch });
      else if (!filtered) maxNew = Math.max(maxNew, r);
    }
    const added: EtsyVariationRow[] = [];
    const lastPrice = rows.at(-1)?.price ?? 24.99;
    for (let r = visible.length; r <= maxNew && rows.length + added.length < MAX_VARIATION_COMBINATIONS; r++) {
      added.push({ id: newRowId(), size: '', color: '', price: lastPrice, quantity: 999, sku: '', enabled: true, ...updates.get(r) });
    }
    onChange([...rows.map((row) => (byId.has(row.id) ? { ...row, ...byId.get(row.id) } : row)), ...added]);
  };
  const patchFor = (c: number, value: CellValue): Partial<EtsyVariationRow> | null => {
    const col = COLS[c]!;
    if (col === 'price') {
      const price = typeof value === 'number' ? value : parsePrice(String(value));
      return price === null ? null : { price };
    }
    return { [col]: String(value).slice(0, 60) };
  };

  const focusCell = (cell: Cell) => {
    const input = scrollRef.current?.querySelector<HTMLInputElement>(`input[data-cell="${cell.r}:${cell.c}"]`);
    input?.focus();
    if (COLS[cell.c] === 'price') input?.select();
  };
  const box = sel ? boxOf(sel) : null;
  const inBox = (r: number, c: number) => box !== null && r >= box.top && r <= box.bottom && c >= box.left && c <= box.right;
  const inFill = (r: number, c: number) => box !== null && fillTo !== null && c >= box.left && c <= box.right
    && ((fillTo > box.bottom && r > box.bottom && r <= fillTo) || (fillTo < box.top && r >= fillTo && r < box.top));

  /** Seçimi `to` satırına kadar doldurur (tek hücre kopyalanır, birden fazlası örüntü olarak tekrarlanır). */
  const applyFill = (b: Box, to: number) => {
    const target = Math.max(0, Math.min(to, displayCount - 1));
    const updates = new Map<number, Partial<EtsyVariationRow>>();
    for (let c = b.left; c <= b.right; c++) {
      const values = Array.from({ length: b.bottom - b.top + 1 }, (_, i) => valueAt(b.top + i, c));
      for (const { row, value } of fillTargets(values, b.top, b.bottom, target)) {
        const patch = patchFor(c, value);
        if (patch) updates.set(row, { ...updates.get(row), ...patch });
      }
    }
    commit(updates);
    setSel({ anchor: { r: Math.min(b.top, target), c: b.left }, focus: { r: Math.max(b.bottom, target), c: b.right } });
  };

  const cellAt = (x: number, y: number): Cell | null => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-cell-td]');
    if (!el) return null;
    const [r, c] = el.dataset.cellTd!.split(':').map(Number);
    return { r: r!, c: c! };
  };

  /**
   * Sürükleme: 'fill' doldurma tutamacı, 'select' telefondaki aralık tutamacı, 'mouse' farenin hücreler üzerinde
   * sürüklenmesi. Pencere düzeyinde izlenir; tablo kenarına yaklaşınca kayar, en alttayken boş satır eklenir.
   */
  const startDrag = (kind: 'fill' | 'select' | 'mouse', e: React.PointerEvent, anchor: Cell) => {
    if (kind !== 'mouse') { e.preventDefault(); e.stopPropagation(); }
    const state = { kind, anchor, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, active: kind !== 'mouse', frame: 0, ticks: 0, to: box?.bottom ?? anchor.r };
    dragRef.current = state;
    if (kind === 'fill') setFillTo(state.to);
    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      d.x = ev.clientX;
      d.y = ev.clientY;
      if (!d.active && Math.hypot(d.x - d.startX, d.y - d.startY) > 6) {
        d.active = true;
        (document.activeElement as HTMLElement | null)?.blur();
      }
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      const d = dragRef.current;
      dragRef.current = null;
      if (!d) return;
      cancelAnimationFrame(d.frame);
      if (d.kind === 'fill' && box) applyFill(box, d.to);
      setFillTo(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    const tick = () => {
      const d = dragRef.current;
      const scroller = scrollRef.current;
      if (!d || !scroller) return;
      d.ticks++;
      if (d.active) {
        const rect = scroller.getBoundingClientRect();
        const edge = 36;
        const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;
        if (d.y > rect.bottom - edge) {
          scroller.scrollTop += Math.min(20, (d.y - (rect.bottom - edge)) / 2 + 4);
          // En alttayken çekmeye devam edilirse yeni boş satırlar açılır (satır eklemek için aşağı çekmek yeter).
          if (atBottom && !filtered && d.ticks % 6 === 0) setExtraGhosts((g) => g + 1);
        } else if (d.y < rect.top + edge + 28) {
          scroller.scrollTop -= Math.min(20, (rect.top + edge + 28 - d.y) / 2 + 4);
        }
        const cell = cellAt(Math.max(rect.left + 2, Math.min(rect.right - 2, d.x)), Math.max(rect.top + 32, Math.min(rect.bottom - 2, d.y)));
        if (cell) {
          if (d.kind === 'fill') {
            if (cell.r !== d.to) { d.to = cell.r; setFillTo(cell.r); }
          } else {
            setSel({ anchor: d.anchor, focus: cell });
          }
        }
      }
      d.frame = requestAnimationFrame(tick);
    };
    state.frame = requestAnimationFrame(tick);
  };

  // Tablo dışına tıklanınca/bileşen kapanınca sürükleme dinleyicileri temizlenir.
  useEffect(() => () => { if (dragRef.current) cancelAnimationFrame(dragRef.current.frame); }, []);

  const onCellPointerDown = (e: React.PointerEvent, cell: Cell) => {
    if (e.shiftKey && sel) {
      e.preventDefault();
      setSel({ anchor: sel.anchor, focus: cell });
      return;
    }
    setSel({ anchor: cell, focus: cell });
    if (e.pointerType === 'mouse' && e.button === 0) startDrag('mouse', e, cell);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, cell: Cell) => {
    const vertical = e.key === 'ArrowDown' || e.key === 'Enter' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (vertical) {
      e.preventDefault();
      const next = { r: Math.max(0, Math.min(displayCount - 1, (e.shiftKey && sel ? sel.focus.r : cell.r) + vertical)), c: cell.c };
      if (e.shiftKey && e.key !== 'Enter' && sel) setSel({ anchor: sel.anchor, focus: next });
      else { (e.target as HTMLInputElement).blur(); focusCell(next); setSel({ anchor: next, focus: next }); }
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && box && (box.bottom > box.top || box.right > box.left)) {
      // Çok hücreli seçimde Delete beden/renk hücrelerini temizler (fiyat boş bırakılamaz).
      e.preventDefault();
      const updates = new Map<number, Partial<EtsyVariationRow>>();
      for (let r = box.top; r <= Math.min(box.bottom, visible.length - 1); r++) {
        for (let c = box.left; c <= box.right; c++) if (COLS[c] !== 'price') updates.set(r, { ...updates.get(r), [COLS[c]!]: '' });
      }
      commit(updates);
    }
  };

  const onCopy = (e: React.ClipboardEvent) => {
    if (!box || (box.bottom === box.top && box.right === box.left)) return;
    e.preventDefault();
    const lines: string[] = [];
    for (let r = box.top; r <= box.bottom; r++) {
      const cells: string[] = [];
      for (let c = box.left; c <= box.right; c++) cells.push(String(valueAt(r, c)));
      lines.push(cells.join('\t'));
    }
    e.clipboardData.setData('text/plain', lines.join('\n'));
  };
  /** Excel'den çok hücreli yapıştırma: seçimin sol üstünden başlayarak yazılır, gerekirse satır eklenir. */
  const onPaste = (e: React.ClipboardEvent) => {
    const grid = parseClipboardGrid(e.clipboardData.getData('text'));
    if (!box || (grid.length < 2 && (grid[0]?.length ?? 0) < 2)) return;
    e.preventDefault();
    const updates = new Map<number, Partial<EtsyVariationRow>>();
    grid.forEach((line, i) => {
      const r = box.top + i;
      if (r >= displayCount + room) return;
      line.forEach((text, j) => {
        const c = box.left + j;
        if (c >= COLS.length) return;
        const patch = patchFor(c, text);
        if (patch) updates.set(r, { ...updates.get(r), ...patch });
      });
    });
    commit(updates);
    setPriceDraft(null);
  };

  const patchVisible = (patch: Partial<EtsyVariationRow>) => {
    const ids = new Set(visible.map((r) => r.id));
    onChange(rows.map((r) => (ids.has(r.id) ? { ...r, ...patch } : r)));
  };
  const bulkValue = parsePrice(bulkPrice) ?? 0;
  const applyBulk = () => {
    if (!(bulkValue > 0)) return;
    patchVisible({ price: bulkValue });
    setBulkPrice('');
  };
  const selectedRealRows = box ? visible.slice(box.top, Math.min(box.bottom, visible.length - 1) + 1) : [];
  const deleteSelectedRows = () => {
    const ids = new Set(selectedRealRows.map((r) => r.id));
    onChange(rows.filter((r) => !ids.has(r.id)));
    setSel(null);
  };
  const sortRows = () => {
    const order = (list: string[], v: string) => { const i = list.indexOf(v.trim()); return i < 0 ? 9999 : i; };
    onChange([...rows].sort((a, b) => order(colors, a.color) - order(colors, b.color) || order(sizes, a.size) - order(sizes, b.size)));
    setSel(null);
  };

  const cellInput = 'w-full min-w-0 px-1.5 py-1.5 bg-transparent outline-none text-[11px] sm:text-xs placeholder:text-slate-300 dark:placeholder:text-slate-600';
  const smallInput = 'w-full min-w-0 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs';
  const fillSource = box && fillTo === null;

  return (
    <div className="space-y-2">
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

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <span className={`font-semibold ${rows.length > MAX_VARIATION_COMBINATIONS ? 'text-red-600' : 'text-slate-500 dark:text-slate-400'}`}>
          {enabledCount} satışta · {rows.length}/{MAX_VARIATION_COMBINATIONS} kombinasyon
        </span>
        <span className="flex items-center gap-3">
          {selectedRealRows.length > 0 && (
            <button type="button" onClick={deleteSelectedRows} className="inline-flex items-center gap-1 font-bold text-red-600 dark:text-red-400">
              <Trash2 className="w-3.5 h-3.5" /> {selectedRealRows.length} satırı sil
            </button>
          )}
          {filtered && <button type="button" onClick={clearFilters} className="font-bold text-indigo-600 dark:text-indigo-300">Filtreleri temizle</button>}
          <button type="button" onClick={sortRows} className="font-bold text-slate-600 dark:text-slate-300">Sırala</button>
        </span>
      </div>

      {duplicates.size > 0 && (
        <p className="flex items-start gap-1.5 text-[11px] text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-500/30 rounded-lg p-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" /> Aynı beden + renk birden fazla satırda var (kırmızı). Etsy her kombinasyonu bir kez kabul eder; kaydetmeden önce düzeltin.
        </p>
      )}

      <div
        ref={scrollRef}
        onCopy={onCopy}
        onPaste={onPaste}
        // Seçili hücre metninin tarayıcı tarafından sürüklenip başka hücreye bırakılması engellenir (sürükleme seçim içindir).
        onDragStart={(e) => e.preventDefault()}
        onDrop={(e) => e.preventDefault()}
        className="overflow-auto max-h-[60vh] sm:max-h-[28rem] rounded-lg border border-slate-200 dark:border-slate-700 select-none"
      >
        <table className="w-full table-fixed text-xs border-collapse">
          <colgroup>
            <col className="w-[3.25rem] sm:w-20" />
            <col />
            <col className="w-[30%] sm:w-[34%]" />
            <col className="w-[4.5rem] sm:w-28" />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
            <tr className="text-[10px] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
              <th className="px-1 sm:px-2 py-2 text-left">
                <HeaderFilter label="Satış" options={[{ value: 'on', label: 'Satışta' }, { value: 'off', label: 'Kapalı' }]} selected={statusFilter} onChange={setStatusFilter} />
              </th>
              <th className="px-1.5 sm:px-2 py-2 text-left">
                <HeaderFilter label="Beden" options={sizes.map((v) => ({ value: v, label: v }))} selected={sizeFilter} onChange={(next) => { setSizeFilter(next); setSel(null); }} />
              </th>
              <th className="px-1.5 py-2 text-left">
                <HeaderFilter label="Renk" options={colors.map((v) => ({ value: v, label: v }))} selected={colorFilter} onChange={(next) => { setColorFilter(next); setSel(null); }} />
              </th>
              <th className="px-2 py-2 text-right font-bold uppercase tracking-wide">Fiyat</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: displayCount }, (_, r) => {
              const row = visible[r];
              const duplicate = row && (row.size.trim() || row.color.trim()) && duplicates.has(comboKey(row));
              return (
                // Satırlar konumla anahtarlanır: boş satıra yazınca gerçek satıra dönüşse de hücre (ve imleç) yerinde kalır.
                <tr key={r} className={`border-b border-slate-100 dark:border-slate-800 ${row ? 'odd:bg-white even:bg-slate-50/60 dark:odd:bg-slate-900 dark:even:bg-slate-900/60' : 'bg-slate-50/40 dark:bg-slate-950/40'} ${row && !row.enabled ? 'text-slate-400' : ''}`}>
                  <td className="px-1 sm:px-2 py-1">
                    {row && (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={row.enabled}
                        aria-label={`${row.size} ${row.color} satışta`}
                        onClick={() => onChange(rows.map((x) => (x.id === row.id ? { ...x, enabled: !x.enabled } : x)))}
                        className={`relative inline-flex h-5 w-8 sm:w-9 items-center rounded-full transition-colors ${row.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                      >
                        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${row.enabled ? 'translate-x-3.5 sm:translate-x-4' : 'translate-x-0.5'}`} />
                      </button>
                    )}
                  </td>
                  {COLS.map((col, c) => {
                    const selected = inBox(r, c);
                    const isFocus = sel?.focus.r === r && sel.focus.c === c;
                    const fillPreview = inFill(r, c);
                    const isPrice = col === 'price';
                    const raw = valueAt(r, c);
                    const display = isPrice
                      ? (priceDraft?.r === r ? priceDraft.text : row ? String(row.price) : '')
                      : String(raw);
                    return (
                      <td
                        key={col}
                        data-cell-td={`${r}:${c}`}
                        className={`relative p-0 ${selected ? 'bg-indigo-50 dark:bg-indigo-500/15' : ''} ${fillPreview ? 'bg-indigo-50/70 dark:bg-indigo-500/10 outline outline-1 outline-dashed outline-indigo-400 -outline-offset-1' : ''} ${isFocus ? 'outline outline-2 outline-indigo-500 -outline-offset-2' : ''}`}
                        onPointerDown={(e) => onCellPointerDown(e, { r, c })}
                      >
                        <input
                          data-cell={`${r}:${c}`}
                          value={display}
                          inputMode={isPrice ? 'decimal' : 'text'}
                          placeholder={row ? (isPrice ? '0.00' : '—') : r === visible.length && c === 0 ? 'Yeni satır…' : ''}
                          aria-label={`Satır ${r + 1} ${COL_LABEL[col]}`}
                          onFocus={(e) => {
                            e.target.select();
                            justFocused.current = true;
                            if (!dragRef.current?.active) setSel((prev) => (prev && prev.focus.r === r && prev.focus.c === c ? prev : { anchor: { r, c }, focus: { r, c } }));
                            if (isPrice) setPriceDraft({ r, text: row ? String(row.price) : '' });
                          }}
                          onChange={(e) => {
                            if (isPrice) setPriceDraft({ r, text: e.target.value });
                            else commit(new Map([[r, { [col]: e.target.value.slice(0, 60) }]]));
                          }}
                          onBlur={() => {
                            if (!isPrice || priceDraft?.r !== r) return;
                            const price = parsePrice(priceDraft.text);
                            if (price !== null && (!row || price !== row.price)) commit(new Map([[r, { price }]]));
                            setPriceDraft(null);
                          }}
                          onMouseUp={(e) => { if (justFocused.current) { e.preventDefault(); justFocused.current = false; } }}
                          onKeyDown={(e) => onKeyDown(e, { r, c })}
                          className={`${cellInput} select-text ${isPrice ? 'text-right tabular-nums font-bold' : 'font-semibold'} ${
                            duplicate && !isPrice ? 'text-red-600 dark:text-red-400'
                              : isPrice && row ? (row.price < 0.2 ? 'text-red-600' : row.enabled ? 'text-emerald-700 dark:text-emerald-400' : '')
                              : col === 'size' ? 'text-indigo-700 dark:text-indigo-300' : ''}`}
                        />
                        {/* Telefonda aralık seçme tutamacı (seçimin sol alt köşesi) */}
                        {fillSource && box && r === box.bottom && c === box.left && (
                          <span
                            role="button"
                            tabIndex={-1}
                            aria-label="Seçimi genişlet"
                            title="Sürükle: seçimi genişlet"
                            style={{ touchAction: 'none' }}
                            onPointerDown={(e) => startDrag('select', e, { r: box.top, c: box.right })}
                            className="absolute left-0 bottom-0 z-[1] w-5 h-5 -translate-x-1/2 translate-y-1/2 flex items-center justify-center cursor-pointer"
                          >
                            <span className="block w-3 h-3 rounded-full bg-white border-2 border-indigo-600 shadow" />
                          </span>
                        )}
                        {/* Doldurma tutamacı (seçimin sağ alt köşesi) */}
                        {fillSource && box && r === box.bottom && c === box.right && (
                          <span
                            role="button"
                            tabIndex={-1}
                            aria-label="Doldurma tutamacı: aşağı/yukarı sürükleyin, çift tıklayınca sona kadar doldurur"
                            title="Sürükle: kopyala / örüntüyü devam ettir · Çift tıkla: sona kadar"
                            style={{ touchAction: 'none' }}
                            onPointerDown={(e) => startDrag('fill', e, { r: box.bottom, c: box.right })}
                            onDoubleClick={() => applyFill(box, visible.length - 1)}
                            className="absolute right-0 bottom-0 z-[1] w-5 h-5 translate-x-1/3 translate-y-1/3 flex items-center justify-center cursor-crosshair"
                          >
                            <span className="block w-2.5 h-2.5 bg-indigo-600 border border-white dark:border-slate-900 rounded-[2px]" />
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {displayCount === 0 && (
              <tr><td colSpan={4} className="p-6 text-center text-slate-500">Filtrelere uyan satır yok.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        Beden, renk ve fiyatı doğrudan yazın; alttaki boş satırlara yazınca yeni satır eklenir. Bir veya birkaç hücre seçip sağ alttaki mavi kareyi aşağı çekin: tek hücre kopyalanır, birden fazla hücre örüntü olarak tekrarlanır (boş satırlara çekmek satır ekler). Telefonda seçimi soldaki yuvarlak tutamaçla genişletin.
        <span className="hidden sm:inline"> Shift+tıkla veya fareyle sürükle ile aralık seçin; Ctrl+C/Ctrl+V Excel ile çalışır, Delete seçili beden/renkleri temizler.</span> Stok gösterilmez: her kombinasyon Etsy&apos;ye 999 stokla gönderilir.
      </p>
    </div>
  );
}
