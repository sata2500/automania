import { useState, useCallback, useMemo } from 'react';
import { DesignItem, TargetApparel } from '@/types/pod';
import { useToast } from '@/components/common/ToastContext';
import { matchesDesignQuery } from '@/lib/design-search';
import { designSection, sortNewestFirst, type DesignSection } from '@/lib/design-library';

export const SLOT_LABELS: Record<TargetApparel, string> = {
  dark: 'Açık Kumaş',
  light: 'Koyu Kumaş',
  both: 'Tüm Kumaşlar',
};

interface UseDesignSelectionProps {
  designs: DesignItem[];
  setDesigns: React.Dispatch<React.SetStateAction<DesignItem[]>>;
  /** Gösterilen bölüm: Tasarımlarım veya Otomasyon */
  section: DesignSection;
  /** Arama yapılıyorsa iki bölümde birden aranır */
  searchQuery?: string;
}

export function useDesignSelection({
  designs,
  setDesigns,
  section,
  searchQuery = '',
}: UseDesignSelectionProps) {
  const toast = useToast();
  const [selectedDesignIds, setSelectedDesignIds] = useState<string[]>([]);

  // Bölümdeki tasarımlar en yeniden eskiye. Arama varken iki bölümde birden aranır (sipariş SKU'su
  // hangi bölümde olursa olsun bulunsun).
  const filteredDesigns = useMemo(() => {
    const visible = searchQuery.trim()
      ? designs.filter((d) => matchesDesignQuery(d, searchQuery))
      : designs.filter((d) => designSection(d) === section);
    return sortNewestFirst(visible);
  }, [designs, section, searchQuery]);

  // Bölüm veya arama değişince seçim temizlenir: toplu silme ekranda görünmeyen tasarımları etkilemesin.
  const viewKey = `${section}|${searchQuery.trim()}`;
  const [selectionViewKey, setSelectionViewKey] = useState(viewKey);
  if (selectionViewKey !== viewKey) {
    setSelectionViewKey(viewKey);
    setSelectedDesignIds([]);
  }

  // Management (Checkbox) Selection Toggle
  const toggleManagementSelection = useCallback((id: string) => {
    setSelectedDesignIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  // Toggle Select All filtered designs
  const handleToggleSelectAll = useCallback(() => {
    if (selectedDesignIds.length === filteredDesigns.length && filteredDesigns.length > 0) {
      setSelectedDesignIds([]);
    } else {
      setSelectedDesignIds(filteredDesigns.map((d) => d.id));
    }
  }, [filteredDesigns, selectedDesignIds.length]);

  /**
   * Tasarımı bir kumaş slotunda üretime alır. Slotta başka bir tasarım varsa o devre dışı bırakılır (her slotta
   * tek aktif tasarım); kullanıcıya hangisinin yerine geçtiği söylenir.
   */
  const activateInSlot = useCallback(
    (id: string, slot: TargetApparel) => {
      const design = designs.find((d) => d.id === id);
      if (!design) return;
      const previous = designs.find((d) => d.id !== id && d.isSelected && d.targetApparel === slot);
      setDesigns((prev) =>
        prev.map((d) => {
          if (d.id === id) return { ...d, isSelected: true, targetApparel: slot };
          if (d.isSelected && d.targetApparel === slot) return { ...d, isSelected: false };
          return d;
        })
      );
      if (previous) toast.info(`"${SLOT_LABELS[slot]}" için "${previous.name}" yerine "${design.name}" üretime alındı.`);
    },
    [designs, setDesigns, toast]
  );

  const deactivate = useCallback(
    (id: string) => setDesigns((prev) => prev.map((d) => (d.id === id ? { ...d, isSelected: false } : d))),
    [setDesigns]
  );

  // Üretim aktif/pasif (tasarımın mevcut kumaş hedefinde)
  const handleToggleProductionActive = useCallback(
    (id: string) => {
      const design = designs.find((d) => d.id === id);
      if (!design) return;
      if (design.isSelected) deactivate(id);
      else activateInSlot(id, design.targetApparel || 'both');
    },
    [designs, deactivate, activateInSlot]
  );

  // Kumaş hedefi seçimi ('dark' | 'light' | 'both'); aynı hedefe tekrar basmak devre dışı bırakır.
  const handleSetProductionActive = useCallback(
    (id: string, target: TargetApparel) => {
      const design = designs.find((d) => d.id === id);
      if (!design) return;
      if (design.isSelected && design.targetApparel === target) deactivate(id);
      else activateInSlot(id, target);
    },
    [designs, deactivate, activateInSlot]
  );

  // Slot occupancy summary
  const takenSlots = useMemo(() => {
    const activeForSlot = (slot: TargetApparel): string | null => {
      const found = designs.find((d) => d.isSelected && d.targetApparel === slot);
      return found ? found.id : null;
    };

    return {
      dark: activeForSlot('dark'),
      light: activeForSlot('light'),
      both: activeForSlot('both'),
    };
  }, [designs]);

  return {
    selectedDesignIds,
    setSelectedDesignIds,
    filteredDesigns,
    toggleManagementSelection,
    handleToggleSelectAll,
    handleToggleProductionActive,
    handleSetProductionActive,
    deactivate,
    takenSlots,
  };
}
