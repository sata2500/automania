import { useState, useCallback, useMemo } from 'react';
import { DesignItem, TargetApparel } from '@/types/pod';
import { useToast } from '@/components/common/ToastContext';

export const SLOT_LABELS: Record<TargetApparel, string> = {
  dark: 'Açık Kumaş',
  light: 'Koyu Kumaş',
  both: 'Tüm Kumaşlar',
};

interface UseDesignSelectionProps {
  designs: DesignItem[];
  setDesigns: React.Dispatch<React.SetStateAction<DesignItem[]>>;
  activeDesignFolderId: string | null;
}

export function useDesignSelection({
  designs,
  setDesigns,
  activeDesignFolderId,
}: UseDesignSelectionProps) {
  const toast = useToast();
  const [selectedDesignIds, setSelectedDesignIds] = useState<string[]>([]);

  // Filtered designs based on active folder
  const filteredDesigns = useMemo(() => {
    return designs.filter((d) =>
      activeDesignFolderId ? d.folderId === activeDesignFolderId : true
    );
  }, [designs, activeDesignFolderId]);

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

  const warnSlot = useCallback(
    (slot: TargetApparel) => {
      toast.warning(
        `"${SLOT_LABELS[slot]}" seçeneğinde zaten aktif bir tasarım var. Önce onu devre dışı bırakın.`
      );
    },
    [toast]
  );

  // Toggle Production Active / Passive (Simple toggle on current targetApparel)
  const handleToggleProductionActive = useCallback(
    (id: string) => {
      setDesigns((prev) => {
        const design = prev.find((d) => d.id === id);
        if (!design) return prev;

        if (design.isSelected) {
          return prev.map((d) => (d.id === id ? { ...d, isSelected: false } : d));
        }

        const slotTaken = prev.some(
          (d) => d.id !== id && d.isSelected && d.targetApparel === design.targetApparel
        );

        if (slotTaken) {
          warnSlot(design.targetApparel);
          return prev;
        }

        return prev.map((d) => (d.id === id ? { ...d, isSelected: true } : d));
      });
    },
    [setDesigns, warnSlot]
  );

  // Set Production Target Slot ('dark' | 'light' | 'both')
  const handleSetProductionActive = useCallback(
    (id: string, target: TargetApparel) => {
      setDesigns((prev) => {
        const design = prev.find((d) => d.id === id);
        if (!design) return prev;

        // If clicking the same target that is already active, deactivate it
        if (design.isSelected && design.targetApparel === target) {
          return prev.map((d) => (d.id === id ? { ...d, isSelected: false } : d));
        }

        // Check if this slot is already taken by ANOTHER design
        const slotTaken = prev.some(
          (d) => d.id !== id && d.isSelected && d.targetApparel === target
        );

        if (slotTaken) {
          warnSlot(target);
          return prev;
        }

        // Make it active and set target
        return prev.map((d) =>
          d.id === id ? { ...d, isSelected: true, targetApparel: target } : d
        );
      });
    },
    [setDesigns, warnSlot]
  );

  // Single Move to Folder
  const handleMoveToFolder = useCallback(
    (designId: string, folderId: string | null) => {
      setDesigns((prev) =>
        prev.map((d) =>
          d.id === designId ? { ...d, folderId: folderId || undefined } : d
        )
      );
      toast.success('Tasarım taşındı.');
    },
    [setDesigns, toast]
  );

  // Bulk Move to Folder
  const handleBulkMove = useCallback(
    (folderId: string | null) => {
      if (selectedDesignIds.length === 0) return;
      setDesigns((prev) =>
        prev.map((d) =>
          selectedDesignIds.includes(d.id)
            ? { ...d, folderId: folderId || undefined }
            : d
        )
      );
      setSelectedDesignIds([]);
      toast.success(`${selectedDesignIds.length} tasarım taşındı.`);
    },
    [selectedDesignIds, setDesigns, toast]
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

  const activeSlotsCount = useMemo(() => {
    return Object.values(takenSlots).filter(Boolean).length;
  }, [takenSlots]);

  return {
    selectedDesignIds,
    setSelectedDesignIds,
    filteredDesigns,
    toggleManagementSelection,
    handleToggleSelectAll,
    handleToggleProductionActive,
    handleSetProductionActive,
    handleMoveToFolder,
    handleBulkMove,
    takenSlots,
    activeSlotsCount,
  };
}
