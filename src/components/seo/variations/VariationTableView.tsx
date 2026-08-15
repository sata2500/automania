'use client';
import React from 'react';
import { MousePointerClick } from 'lucide-react';
import { useEtsySeo } from '../context/EtsySeoContext';

export const VariationTableView: React.FC = () => {
  const {
    variations,
    filteredVariations,
    statusFilter,
    setStatusFilter,
    colorFilter,
    setColorFilter,
    uniqueTableColors,
    sizeFilter,
    setSizeFilter,
    uniqueTableSizes,
    dragState,
    handleDragEnter,
    handleDragStart,
    setVariations,
  } = useEtsySeo();

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm relative">
      {/* Header with counter and drag tip */}
      <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <span className={`px-2.5 py-0.5 rounded-full font-bold ${variations.length > 380 ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400'}`}>
            Görünen: {filteredVariations.length} | Toplam: {variations.length} / 400 Maks
          </span>
          <span>Varyasyon Tablosu</span>
        </h4>
        <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
          <span className="flex items-center gap-1">
            <MousePointerClick className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span className="hidden sm:inline">Hücrenin sağ alt köşesinden tutup sürükle (Drag-to-fill)</span>
            <span className="sm:hidden">Hücreleri dokunarak düzenleyebilirsiniz</span>
          </span>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto w-full select-none scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700" style={{ maxHeight: '600px' }}>
        <table className="w-full text-left text-xs min-w-[500px]">
          <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="p-2.5 border-r border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 w-24">
                <select 
                  value={statusFilter} 
                  onChange={e => setStatusFilter(e.target.value as any)}
                  className="w-full bg-transparent border-none outline-none font-bold text-[11px] uppercase tracking-wider cursor-pointer text-slate-700 dark:text-slate-300"
                >
                  <option value="all">Durum</option>
                  <option value="active">Aktifler</option>
                  <option value="inactive">Pasifler</option>
                </select>
              </th>
              <th className="p-2.5 border-r border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 min-w-[120px]">
                <select 
                  value={colorFilter} 
                  onChange={e => setColorFilter(e.target.value)}
                  className="w-full bg-transparent border-none outline-none font-bold text-[11px] uppercase tracking-wider cursor-pointer text-slate-700 dark:text-slate-300"
                >
                  <option value="all">Renk (Tümü)</option>
                  {uniqueTableColors.map((c: string) => <option key={c} value={c}>{c}</option>)}
                </select>
              </th>
              <th className="p-2.5 border-r border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 w-28">
                <select 
                  value={sizeFilter} 
                  onChange={e => setSizeFilter(e.target.value)}
                  className="w-full bg-transparent border-none outline-none font-bold text-[11px] uppercase tracking-wider cursor-pointer text-slate-700 dark:text-slate-300"
                >
                  <option value="all">Beden (Tümü)</option>
                  {uniqueTableSizes.map((s: string) => <option key={s} value={s}>{s}</option>)}
                </select>
              </th>
              <th className="p-2.5 text-center border-r border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-[11px] uppercase tracking-wider w-32 font-bold">
                Fiyat ($)
              </th>
              <th className="p-2.5 text-center bg-slate-100 dark:bg-slate-900 text-[11px] uppercase tracking-wider w-28 font-bold">
                Stok
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono bg-white dark:bg-slate-900">
            {filteredVariations.map((row: any, idx: number) => {
              // Sürükleme efekti kontrolü
              let isPriceHighlighted = false;
              let isQtyHighlighted = false;
              let isStatusHighlighted = false;
              
              if (dragState.isDragging && dragState.startRowId && dragState.endRowId) {
                const startIdx = filteredVariations.findIndex((v: any) => v.id === dragState.startRowId);
                const endIdx = filteredVariations.findIndex((v: any) => v.id === dragState.endRowId);
                const currentIdx = idx;
                if (startIdx !== -1 && endIdx !== -1) {
                  const min = Math.min(startIdx, endIdx);
                  const max = Math.max(startIdx, endIdx);
                  if (currentIdx >= min && currentIdx <= max) {
                    if (dragState.field === 'price') isPriceHighlighted = true;
                    if (dragState.field === 'quantity') isQtyHighlighted = true;
                    if (dragState.field === 'enabled') isStatusHighlighted = true;
                  }
                }
              }

              return (
                <tr key={row.id} className="hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-colors group">
                  <td 
                    className={`p-2 text-center border-r border-slate-100 dark:border-slate-800 transition-colors ${isStatusHighlighted ? 'bg-indigo-100 dark:bg-indigo-900/50 ring-1 ring-inset ring-indigo-500' : ''}`}
                    onMouseEnter={() => handleDragEnter(row.id)}
                  >
                    <div className="relative flex justify-center items-center w-full h-full group/cell py-1">
                      <input
                        type="checkbox"
                        checked={row.enabled}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setVariations((prev: any[]) => prev.map((v: any) => v.id === row.id ? { ...v, enabled: val } : v));
                        }}
                        className="rounded text-indigo-600 w-4 h-4 cursor-pointer"
                      />
                      {/* Drag handle */}
                      <div 
                        className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-indigo-500 cursor-crosshair rounded-xs opacity-0 group-hover/cell:opacity-100 hover:scale-125 transition-all z-10 border border-white dark:border-slate-800 hidden sm:block"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleDragStart(row.id, 'enabled', row.enabled);
                        }}
                      />
                    </div>
                  </td>
                  <td className="p-2.5 font-semibold text-slate-800 dark:text-slate-200 font-sans border-r border-slate-100 dark:border-slate-800 truncate max-w-[160px]">
                    {row.color}
                  </td>
                  <td className="p-2.5 font-bold text-indigo-600 dark:text-indigo-400 border-r border-slate-100 dark:border-slate-800">
                    {row.size}
                  </td>
                  
                  <td 
                    className={`p-0 border-r border-slate-100 dark:border-slate-800 transition-colors relative ${isPriceHighlighted ? 'bg-indigo-100 dark:bg-indigo-900/50 ring-1 ring-inset ring-indigo-500' : ''}`}
                    onMouseEnter={() => handleDragEnter(row.id)}
                  >
                    <div className="w-full h-full flex items-center justify-center group/cell p-1">
                      <input
                        type="number"
                        step="0.01"
                        value={row.price}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setVariations((prev: any[]) => prev.map((v: any) => v.id === row.id ? { ...v, price: val } : v));
                        }}
                        className="w-20 px-2 py-1.5 bg-transparent border-none text-center font-bold text-emerald-600 dark:text-emerald-400 outline-none hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 rounded transition-colors"
                      />
                      {/* Drag handle */}
                      <div 
                        className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-indigo-500 cursor-crosshair rounded-xs opacity-0 group-hover/cell:opacity-100 hover:scale-125 transition-all z-10 border border-white dark:border-slate-800 hidden sm:block"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleDragStart(row.id, 'price', row.price);
                        }}
                      />
                    </div>
                  </td>
                  
                  <td 
                    className={`p-0 border-r border-slate-100 dark:border-slate-800 transition-colors relative ${isQtyHighlighted ? 'bg-indigo-100 dark:bg-indigo-900/50 ring-1 ring-inset ring-indigo-500' : ''}`}
                    onMouseEnter={() => handleDragEnter(row.id)}
                  >
                    <div className="w-full h-full flex items-center justify-center group/cell p-1">
                      <input
                        type="number"
                        value={row.quantity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 0;
                          setVariations((prev: any[]) => prev.map((v: any) => v.id === row.id ? { ...v, quantity: val } : v));
                        }}
                        className="w-16 px-2 py-1.5 bg-transparent border-none text-center font-semibold text-slate-700 dark:text-slate-300 outline-none hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 rounded transition-colors"
                      />
                      {/* Drag handle */}
                      <div 
                        className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-indigo-500 cursor-crosshair rounded-xs opacity-0 group-hover/cell:opacity-100 hover:scale-125 transition-all z-10 border border-white dark:border-slate-800 hidden sm:block"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleDragStart(row.id, 'quantity', row.quantity);
                        }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredVariations.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500 font-sans">
                  Seçili filtrelere uygun varyasyon bulunamadı. Lütfen filtreleri temizleyin.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
