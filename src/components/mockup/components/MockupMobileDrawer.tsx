import React, { useEffect } from 'react';
import { X, SlidersHorizontal } from 'lucide-react';
import { MockupSettingsPanel } from './MockupSettingsPanel';
import { MockupItem, PrintArea, ApparelType } from '@/types/pod';

interface MockupMobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
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
}

export const MockupMobileDrawer: React.FC<MockupMobileDrawerProps> = ({
  isOpen,
  onClose,
  ...panelProps
}) => {
  // Prevent background body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 dark:bg-slate-950/80 backdrop-blur-sm flex flex-col justify-end lg:hidden animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 rounded-t-3xl max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-250">
        {/* Drawer Drag Bar / Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">
              Mockup Ayarları
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content with Safe Area Padding */}
        <div className="overflow-y-auto p-4 space-y-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <MockupSettingsPanel {...panelProps} />
        </div>
      </div>
    </div>
  );
};
