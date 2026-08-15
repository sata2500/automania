import React from 'react';
import { Palette } from 'lucide-react';
import { DesignItem, TargetApparel, MockupFolder } from '@/types/pod';
import { DesignCard } from './DesignCard';

interface DesignGridProps {
  designs: DesignItem[];
  selectedDesignIds: string[];
  analyzingIds: string[];
  designFolders: MockupFolder[];
  onToggleCheck: (id: string) => void;
  onToggleProductionActive: (id: string) => void;
  onSetProductionActive: (id: string, target: TargetApparel) => void;
  onAnalyzeClick: (design: DesignItem) => void;
  onCropClick: (design: DesignItem) => void;
  onMoveToFolder: (designId: string, folderId: string | null) => void;
  onDeleteClick: (id: string) => void;
}

export const DesignGrid: React.FC<DesignGridProps> = ({
  designs,
  selectedDesignIds,
  analyzingIds,
  designFolders,
  onToggleCheck,
  onToggleProductionActive,
  onSetProductionActive,
  onAnalyzeClick,
  onCropClick,
  onMoveToFolder,
  onDeleteClick,
}) => {
  if (designs.length === 0) {
    return (
      <div className="text-center py-16 px-4 bg-slate-50 dark:bg-slate-900/40 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500">
        <Palette className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm font-semibold">Bu klasörde henüz tasarım bulunmuyor.</p>
        <p className="text-xs text-slate-400 mt-1">
          Yukarıdaki yükleme alanını kullanarak tasarım yükleyebilirsiniz.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-4">
      {designs.map((design) => (
        <DesignCard
          key={design.id}
          design={design}
          isChecked={selectedDesignIds.includes(design.id)}
          isAnalyzing={analyzingIds.includes(design.id)}
          designFolders={designFolders}
          onToggleCheck={onToggleCheck}
          onToggleProductionActive={onToggleProductionActive}
          onSetProductionActive={onSetProductionActive}
          onAnalyzeClick={onAnalyzeClick}
          onCropClick={onCropClick}
          onMoveToFolder={onMoveToFolder}
          onDeleteClick={onDeleteClick}
        />
      ))}
    </div>
  );
};
