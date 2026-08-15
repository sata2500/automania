import React from 'react';
import {
  SlidersHorizontal,
  RotateCw,
  Crop,
  Copy,
  ClipboardPaste,
  Plus,
  Trash2,
  Check,
  Undo2,
  Sparkles,
  Info,
  Layers,
} from 'lucide-react';
import { MockupItem, PrintArea, ApparelType } from '@/types/pod';

interface MockupSettingsPanelProps {
  selectedMockup: MockupItem | null;
  draftAreas: PrintArea[];
  draftApparelType: ApparelType;
  setDraftApparelType: (type: ApparelType) => void;
  draftHasPrintArea: boolean;
  activeAreaIndex: number;
  setActiveAreaIndex: (idx: number) => void;
  activePrintArea?: PrintArea;
  isDirty: boolean;
  copiedConfig: { printAreas: PrintArea[]; apparelType: ApparelType } | null;
  onSaveChanges: () => void;
  onRevertChanges: () => void;
  onUpdateActiveArea: (updates: Partial<PrintArea>) => void;
  onAddArea: () => void;
  onRemoveArea: (idx: number, e?: React.MouseEvent) => void;
  onCopyConfig: () => void;
  onPasteConfig: () => void;
  onOpenCropModal: () => void;
  onUpdateExportAspectRatio?: (ratio: 'original' | 'square') => void;
}

export const MockupSettingsPanel: React.FC<MockupSettingsPanelProps> = ({
  selectedMockup,
  draftAreas,
  draftApparelType,
  setDraftApparelType,
  draftHasPrintArea,
  activeAreaIndex,
  setActiveAreaIndex,
  activePrintArea,
  isDirty,
  copiedConfig,
  onSaveChanges,
  onRevertChanges,
  onUpdateActiveArea,
  onAddArea,
  onRemoveArea,
  onCopyConfig,
  onPasteConfig,
  onOpenCropModal,
  onUpdateExportAspectRatio,
}) => {
  if (!selectedMockup) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 text-center text-xs text-slate-400 dark:text-slate-500">
        Bir mockup seçildiğinde ayarlar burada görüntülenecektir.
      </div>
    );
  }

  const isVideo = selectedMockup.isVideo;
  const currentRotation = activePrintArea?.rotation || 0;

  return (
    <div className="space-y-4">
      {/* Unsaved Changes Banner */}
      {isDirty && (
        <div className="p-3 bg-gradient-to-r from-amber-500/10 to-indigo-500/10 border border-amber-500/30 dark:border-amber-400/30 rounded-2xl flex items-center justify-between gap-2 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span className="text-xs font-bold text-amber-900 dark:text-amber-300 truncate">
              Kaydedilmemiş değişiklikler var!
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onRevertChanges}
              className="px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-1"
            >
              <Undo2 className="w-3 h-3" />
              <span>Geri Al</span>
            </button>
            <button
              onClick={onSaveChanges}
              className="px-3 py-1 text-xs font-bold text-white bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 rounded-xl shadow flex items-center gap-1 transition-all active:scale-95"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Kaydet</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Settings Box */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 space-y-4 shadow-sm">
        {/* Header & Quick Action Buttons */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-500" />
            Mockup Özellikleri
          </h3>

          <div className="flex items-center gap-1">
            {!isVideo && (
              <button
                onClick={onOpenCropModal}
                className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="1:1 Kare Kırp"
              >
                <Crop className="w-3.5 h-3.5" />
              </button>
            )}

            {!isVideo && draftHasPrintArea && (
              <>
                <button
                  onClick={onCopyConfig}
                  className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Baskı Alanlarını Kopyala"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>

                {copiedConfig && (
                  <button
                    onClick={onPasteConfig}
                    className="p-1.5 rounded-lg text-indigo-500 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
                    title="Baskı Alanlarını Yapıştır"
                  >
                    <ClipboardPaste className="w-3.5 h-3.5" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Static / Chart Mode Info */}
        {!isVideo && !draftHasPrintArea && (
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
              <Info className="w-4 h-4 text-indigo-500" />
              <span>Statik Tablo / Bilgi Görseli</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-[11px]">
              Bu görsel beden tablosu, renk kartelası veya tanıtım görseli olarak işaretlenmiştir. Üzerine baskı alanı eklenmez ve doğrudan çıktı listesine dahil edilir.
            </p>
          </div>
        )}

        {/* Video Mode Info */}
        {isVideo && (
          <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 rounded-2xl text-xs space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-purple-800 dark:text-purple-300">
              <Sparkles className="w-4 h-4 text-purple-500" />
              <span>Video Mockup</span>
            </div>
            <p className="text-purple-600 dark:text-purple-400 text-[11px]">
              Video mockuplar Etsy için optimize edilmiştir.
            </p>
          </div>
        )}

        {/* Print Area Section */}
        {!isVideo && draftHasPrintArea && (
          <div className="space-y-3.5">
            {/* Area Tabs & Management */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-500" />
                  Baskı Alanları ({draftAreas.length})
                </label>
                <button
                  onClick={onAddArea}
                  className="px-2 py-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-lg flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>Alan Ekle</span>
                </button>
              </div>

              {/* Tabs */}
              <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                {draftAreas.map((area, idx) => {
                  const isActive = idx === activeAreaIndex;
                  return (
                    <div
                      key={area.id || idx}
                      onClick={() => setActiveAreaIndex(idx)}
                      className={`group/tab flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                        isActive
                          ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span className="truncate max-w-[90px]">
                        {area.name || `Alan ${idx + 1}`}
                      </span>

                      {draftAreas.length > 1 && (
                        <button
                          onClick={(e) => onRemoveArea(idx, e)}
                          className="opacity-60 group-hover/tab:opacity-100 hover:text-red-500 p-0.5 rounded transition-all"
                          title="Alanı Sil"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Active Area Name Input */}
            {activePrintArea && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Seçili Alan İsmi:
                </label>
                <input
                  type="text"
                  value={activePrintArea.name || ''}
                  onChange={(e) => onUpdateActiveArea({ name: e.target.value })}
                  placeholder="Örn: Ön Göğüs, Sırt Baskısı..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>
            )}

            {/* Rotation Slider & Presets */}
            {activePrintArea && (
              <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <RotateCw className="w-3.5 h-3.5 text-amber-500" />
                    Döndürme Açısı:
                  </span>
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                    {currentRotation}°
                  </span>
                </div>

                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="1"
                  value={currentRotation}
                  onChange={(e) =>
                    onUpdateActiveArea({ rotation: Number(e.target.value) })
                  }
                  className="w-full accent-amber-500 cursor-pointer"
                />

                {/* Angle Presets */}
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {[0, 90, -90, 180].map((deg) => (
                    <button
                      key={deg}
                      type="button"
                      onClick={() => onUpdateActiveArea({ rotation: deg })}
                      className={`py-1 text-[11px] font-bold rounded-lg border transition-all ${
                        currentRotation === deg
                          ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-amber-400'
                      }`}
                    >
                      {deg}°
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Apparel Type Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Kumaş / Mockup Rengi Tipi:
              </label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                {[
                  { key: 'light', label: 'Açık Renk' },
                  { key: 'dark', label: 'Koyu Renk' },
                  { key: 'any', label: 'Tümü (Any)' },
                ].map(({ key, label }) => {
                  const isSelected = draftApparelType === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setDraftApparelType(key as ApparelType)}
                      className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        isSelected
                          ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                Tasarım üreticisi, tasarım varyantını buradaki kumaş tipine göre otomatik eşleştirecektir.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
