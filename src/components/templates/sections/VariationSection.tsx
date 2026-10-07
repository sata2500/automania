'use client';

import React, { useState } from 'react';
import { Plus, DollarSign, Palette, Hash } from 'lucide-react';
import { PodTemplateVariationConfig, TemplateVariationRow } from '@/types/templates';

interface VariationSectionProps {
  config: PodTemplateVariationConfig;
  onChange: (config: PodTemplateVariationConfig) => void;
}

const DEFAULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];
const DEFAULT_COLORS = [
  'Black', 'White', 'Navy', 'Gray', 'Red', 'Royal Blue',
  'Forest Green', 'Maroon', 'Purple', 'Dark Chocolate',
  'Sand', 'Light Pink', 'Heliconia', 'Cornsilk',
];

function generateRows(sizes: string[], colors: string[], basePrice: number): TemplateVariationRow[] {
  const rows: TemplateVariationRow[] = [];
  for (const color of colors) {
    for (const size of sizes) {
      const id = `${color}_${size}`.replace(/\s+/g, '_').toLowerCase();
      const existingIndex = rows.findIndex(r => r.size === size && r.color === color);
      if (existingIndex === -1) {
        rows.push({
          id,
          size,
          color,
          price: basePrice,
          quantity: 999,
          sku: `${color.toUpperCase().replace(/\s+/g, '_')}-${size}`,
          enabled: true,
        });
      }
    }
  }
  return rows;
}

export function VariationSection({ config, onChange }: VariationSectionProps) {
  const [newSize, setNewSize] = useState('');
  const [newColor, setNewColor] = useState('');
  const [basePrice, setBasePrice] = useState(config.basePrice ?? 24.99);
  const [activeView, setActiveView] = useState<'setup' | 'matrix'>('setup');

  const sizes = config.sizes ?? [];
  const colors = config.colors ?? [];
  const rows = config.rows ?? [];

  const addSize = (size: string) => {
    const trimmed = size.trim();
    if (!trimmed || sizes.includes(trimmed)) return;
    const newSizes = [...sizes, trimmed];
    const newRows = generateRows(newSizes, colors, basePrice);
    onChange({ ...config, sizes: newSizes, rows: newRows });
    setNewSize('');
  };

  const removeSize = (size: string) => {
    const newSizes = sizes.filter(s => s !== size);
    const newRows = rows.filter(r => r.size !== size);
    onChange({ ...config, sizes: newSizes, rows: newRows });
  };

  const addColor = (color: string) => {
    const trimmed = color.trim();
    if (!trimmed || colors.includes(trimmed)) return;
    const newColors = [...colors, trimmed];
    const newRows = generateRows(sizes, newColors, basePrice);
    onChange({ ...config, colors: newColors, rows: newRows });
    setNewColor('');
  };

  const removeColor = (color: string) => {
    const newColors = colors.filter(c => c !== color);
    const newRows = rows.filter(r => r.color !== color);
    onChange({ ...config, colors: newColors, rows: newRows });
  };

  const updateRow = <K extends keyof TemplateVariationRow>(rowId: string, field: K, value: TemplateVariationRow[K]) => {
    const newRows = rows.map(r => r.id === rowId ? { ...r, [field]: value } : r);
    onChange({ ...config, rows: newRows });
  };

  const applyBasePriceToAll = () => {
    const newRows = rows.map(r => ({ ...r, price: basePrice }));
    onChange({ ...config, rows: newRows, basePrice });
  };

  const regenerateMatrix = () => {
    const newRows = generateRows(sizes, colors, basePrice);
    onChange({ ...config, rows: newRows, basePrice });
  };

  const enabledCount = rows.filter(r => r.enabled).length;

  return (
    <div className="space-y-4">
      {/* Görünüm Seçici */}
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
        {[
          { key: 'setup', label: 'Kurulum' },
          { key: 'matrix', label: `Varyasyon Tablosu (${rows.length} satır)` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveView(key as typeof activeView)}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeView === key
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeView === 'setup' ? (
        <>
          {/* Temel Fiyat */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
              Temel Fiyat (USD)
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">$</span>
                <input
                  type="number"
                  value={basePrice}
                  min={0.01}
                  step={0.01}
                  onChange={e => setBasePrice(parseFloat(e.target.value) || 0)}
                  className="w-full pl-7 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>
              <button
                onClick={applyBasePriceToAll}
                disabled={rows.length === 0}
                className="px-3 py-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 rounded-lg text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all cursor-pointer disabled:opacity-40"
              >
                Tümüne Uygula
              </button>
            </div>
          </div>

          {/* Bedenler */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-indigo-500" />
              Bedenler ({sizes.length})
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {sizes.map(size => (
                <span
                  key={size}
                  className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 rounded-lg text-xs font-semibold border border-indigo-200 dark:border-indigo-500/30"
                >
                  {size}
                  <button
                    onClick={() => removeSize(size)}
                    className="text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-200 transition-colors cursor-pointer ml-0.5"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            {/* Hızlı ekle */}
            <div className="flex flex-wrap gap-1 mb-2">
              {DEFAULT_SIZES.filter(s => !sizes.includes(s)).map(s => (
                <button
                  key={s}
                  onClick={() => addSize(s)}
                  className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-slate-600 dark:text-slate-400 hover:text-indigo-700 dark:hover:text-indigo-400 rounded-md text-[11px] font-semibold transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
                >
                  + {s}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newSize}
                onChange={e => setNewSize(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSize(newSize)}
                placeholder="Özel beden ekle..."
                className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
              <button
                onClick={() => addSize(newSize)}
                className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-bold cursor-pointer transition-all"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Renkler */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-purple-500" />
              Renkler ({colors.length})
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {colors.map(color => (
                <span
                  key={color}
                  className="flex items-center gap-1 px-2.5 py-1 bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 rounded-lg text-xs font-semibold border border-purple-200 dark:border-purple-500/30"
                >
                  {color}
                  <button
                    onClick={() => removeColor(color)}
                    className="text-purple-400 hover:text-purple-700 dark:hover:text-purple-200 transition-colors cursor-pointer ml-0.5"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-1 mb-2">
              {DEFAULT_COLORS.filter(c => !colors.includes(c)).slice(0, 8).map(c => (
                <button
                  key={c}
                  onClick={() => addColor(c)}
                  className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-500/10 text-slate-600 dark:text-slate-400 hover:text-purple-700 dark:hover:text-purple-400 rounded-md text-[11px] font-semibold transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
                >
                  + {c}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newColor}
                onChange={e => setNewColor(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addColor(newColor)}
                placeholder="Özel renk ekle..."
                className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/40"
              />
              <button
                onClick={() => addColor(newColor)}
                className="px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-xs font-bold cursor-pointer transition-all"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>

          {sizes.length > 0 && colors.length > 0 && (
            <button
              onClick={regenerateMatrix}
              className="w-full py-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow"
            >
              Varyasyon Tablosunu Oluştur ({sizes.length} beden × {colors.length} renk = {sizes.length * colors.length} satır)
            </button>
          )}
        </>
      ) : (
        /* Varyasyon Tablosu */
        <div>
          {rows.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-xs text-slate-400">
                Önce beden ve renk ekleyin, ardından &quot;Varyasyon Tablosunu Oluştur&quot; butonuna tıklayın.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{enabledCount}</span> / {rows.length} varyasyon aktif
                </p>
                <button
                  onClick={() => {
                    const allEnabled = rows.every(r => r.enabled);
                    onChange({ ...config, rows: rows.map(r => ({ ...r, enabled: !allEnabled })) });
                  }}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  {rows.every(r => r.enabled) ? 'Tümünü Pasif Et' : 'Tümünü Aktif Et'}
                </button>
              </div>
              <div className="overflow-auto max-h-64 border border-slate-200 dark:border-slate-700 rounded-xl">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-bold text-slate-600 dark:text-slate-300">Aktif</th>
                      <th className="px-3 py-2 text-left font-bold text-slate-600 dark:text-slate-300">Renk</th>
                      <th className="px-3 py-2 text-left font-bold text-slate-600 dark:text-slate-300">Beden</th>
                      <th className="px-3 py-2 text-left font-bold text-slate-600 dark:text-slate-300">Fiyat</th>
                      <th className="px-3 py-2 text-left font-bold text-slate-600 dark:text-slate-300">Adet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr
                        key={row.id}
                        className={`border-t border-slate-100 dark:border-slate-800 ${
                          !row.enabled ? 'opacity-40' : ''
                        } ${i % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/40'}`}
                      >
                        <td className="px-3 py-1.5">
                          <input
                            type="checkbox"
                            checked={row.enabled}
                            onChange={e => updateRow(row.id, 'enabled', e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 font-medium">{row.color}</td>
                        <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 font-medium">{row.size}</td>
                        <td className="px-3 py-1.5">
                          <div className="flex items-center gap-0.5">
                            <span className="text-slate-400">$</span>
                            <input
                              type="number"
                              value={row.price}
                              min={0.01}
                              step={0.01}
                              onChange={e => updateRow(row.id, 'price', parseFloat(e.target.value) || 0)}
                              className="w-16 px-1.5 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                            />
                          </div>
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="number"
                            value={row.quantity}
                            min={0}
                            onChange={e => updateRow(row.id, 'quantity', parseInt(e.target.value) || 0)}
                            className="w-14 px-1.5 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
