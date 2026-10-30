import React from 'react';
import { Palette } from 'lucide-react';
import { DesignItem, TargetApparel } from '@/types/pod';
import { DesignCard } from './DesignCard';

interface DesignGridProps {
  designs: DesignItem[];
  selectedDesignIds: string[];
  analyzingIds: string[];
  onToggleCheck: (id: string) => void;
  onToggleProductionActive: (id: string) => void;
  onSetProductionActive: (id: string, target: TargetApparel) => void;
  /** Yoksa (misafir) yapay zekâ analizi gösterilmez. */
  onAnalyzeClick?: (design: DesignItem) => void;
  onCropClick: (design: DesignItem) => void;
  onRenameClick?: (design: DesignItem) => void;
  /** Arama yapılıyorsa boş durum mesajı buna göre gösterilir */
  searchQuery?: string;
  /** Boş durum mesajı için gösterilen bölüm */
  section?: 'mine' | 'automation';
  onRemoveBgClick?: (design: DesignItem) => void;
  onRecolorClick?: (design: DesignItem, mode: 'light_garment' | 'dark_garment') => void;
  onDeleteClick: (id: string) => void;
}

export const DesignGrid: React.FC<DesignGridProps> = ({
  designs,
  selectedDesignIds,
  analyzingIds,
  onToggleCheck,
  onToggleProductionActive,
  onSetProductionActive,
  onAnalyzeClick,
  onCropClick,
  onRenameClick,
  searchQuery,
  section = 'mine',
  onRemoveBgClick,
  onRecolorClick,
  onDeleteClick,
}) => {
  if (designs.length === 0) {
    return (
      <div className="text-center py-16 px-4 bg-slate-50 dark:bg-slate-900/40 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500">
        <Palette className="w-12 h-12 mx-auto mb-3 opacity-30" />
        {searchQuery?.trim() ? (
          <>
            <p className="text-sm font-semibold">&quot;{searchQuery.trim()}&quot; ile eşleşen tasarım bulunamadı.</p>
            <p className="text-xs text-slate-400 mt-1">Arama tüm tasarımlarda (Tasarımlarım ve Otomasyon) ada, SKU&apos;lara ve etiketlere bakar.</p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold">{section === 'automation' ? 'Otomasyonlar henüz tasarım üretmedi.' : 'Henüz tasarım yok.'}</p>
            <p className="text-xs text-slate-400 mt-1">
              {section === 'automation'
                ? 'Mockup klasörlerine otomasyon kurduğunuzda ürettikleri tasarımlar burada en yeniden eskiye listelenir.'
                : 'Yukarıdaki alandan tasarım yükleyebilir veya yapay zekâ ile üretebilirsiniz.'}
            </p>
          </>
        )}
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
          onToggleCheck={onToggleCheck}
          onToggleProductionActive={onToggleProductionActive}
          onSetProductionActive={onSetProductionActive}
          onAnalyzeClick={onAnalyzeClick}
          onCropClick={onCropClick}
          onRenameClick={onRenameClick}
          onRemoveBgClick={onRemoveBgClick}
          onRecolorClick={onRecolorClick}
          onDeleteClick={onDeleteClick}
        />
      ))}
    </div>
  );
};
