import { useState, useEffect, useMemo, useCallback } from 'react';
import { MockupItem, ApparelType, PrintArea } from '@/types/pod';
import { useToast } from '@/components/common/ToastContext';

interface UseMockupDraftProps {
  selectedMockup: MockupItem | null;
  setMockups: React.Dispatch<React.SetStateAction<MockupItem[]>>;
}

export function useMockupDraft({ selectedMockup, setMockups }: UseMockupDraftProps) {
  const toast = useToast();

  const [draftAreas, setDraftAreas] = useState<PrintArea[]>([]);
  const [draftApparelType, setDraftApparelType] = useState<ApparelType>('light');
  const [draftHasPrintArea, setDraftHasPrintArea] = useState<boolean>(true);
  const [activeAreaIndex, setActiveAreaIndex] = useState<number>(0);

  const [copiedConfig, setCopiedConfig] = useState<{
    printAreas: PrintArea[];
    apparelType: ApparelType;
  } | null>(null);

  // Sync draft state whenever selectedMockup changes
  useEffect(() => {
    if (selectedMockup) {
      setDraftAreas(structuredClone(selectedMockup.printAreas || []));
      setDraftApparelType(selectedMockup.apparelType);
      setDraftHasPrintArea(selectedMockup.hasPrintArea !== false);
      if (activeAreaIndex >= (selectedMockup.printAreas?.length || 1)) {
        setActiveAreaIndex(0);
      }
    }
  }, [selectedMockup?.id]);

  // Check if current draft has unsaved changes
  const isDirty = useMemo(() => {
    if (!selectedMockup) return false;
    return (
      JSON.stringify(draftAreas) !== JSON.stringify(selectedMockup.printAreas || []) ||
      draftApparelType !== selectedMockup.apparelType ||
      draftHasPrintArea !== (selectedMockup.hasPrintArea !== false)
    );
  }, [selectedMockup, draftAreas, draftApparelType, draftHasPrintArea]);

  // Save draft changes to main state
  const handleSaveChanges = useCallback(() => {
    if (!selectedMockup) return;
    setMockups((prev) =>
      prev.map((m) =>
        m.id === selectedMockup.id
          ? {
              ...m,
              printAreas: structuredClone(draftAreas),
              apparelType: draftApparelType,
              hasPrintArea: draftHasPrintArea,
            }
          : m
      )
    );
    toast.success('Baskı ayarları başarıyla kaydedildi!');
  }, [selectedMockup, draftAreas, draftApparelType, draftHasPrintArea, setMockups, toast]);

  // Revert draft changes back to saved mockup state
  const handleRevertChanges = useCallback(() => {
    if (!selectedMockup) return;
    setDraftAreas(structuredClone(selectedMockup.printAreas || []));
    setDraftApparelType(selectedMockup.apparelType);
    setDraftHasPrintArea(selectedMockup.hasPrintArea !== false);
    toast.info('Değişiklikler geri alındı.');
  }, [selectedMockup, toast]);

  const updateActivePrintAreaDraft = useCallback((areaUpdates: Partial<PrintArea>) => {
    setDraftAreas((prev) =>
      prev.map((area, idx) => (idx === activeAreaIndex ? { ...area, ...areaUpdates } : area))
    );
  }, [activeAreaIndex]);

  const handleAddPrintArea = useCallback(() => {
    if (!selectedMockup) return;
    const newArea: PrintArea = {
      id: 'area-' + Date.now(),
      name: `Baskı Alanı ${draftAreas.length + 1}`,
      x: 35,
      y: 35,
      width: 30,
      height: 30,
      rotation: 0,
    };
    const updated = [...draftAreas, newArea];
    setDraftAreas(updated);
    setDraftHasPrintArea(true);
    setActiveAreaIndex(updated.length - 1);
    toast.success(`'${newArea.name}' eklendi (Kaydetmek için butona tıklayın).`);
  }, [selectedMockup, draftAreas, toast]);

  const handleRemovePrintArea = useCallback((idx: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!selectedMockup || draftAreas.length <= 1) {
      toast.warning('En az 1 baskı alanı bulunmalıdır.');
      return;
    }
    const removedName = draftAreas[idx]?.name || 'Baskı alanı';
    const updated = draftAreas.filter((_, i) => i !== idx);
    setDraftAreas(updated);
    setActiveAreaIndex(0);
    toast.info(`'${removedName}' kaldırıldı (Kaydetmek için butona tıklayın).`);
  }, [selectedMockup, draftAreas, toast]);

  const handleTogglePrintAreaMode = useCallback(() => {
    if (!selectedMockup) return;
    if (!draftHasPrintArea) {
      const defaultArea: PrintArea = {
        id: 'area-' + Date.now(),
        name: 'Ana Baskı Alanı',
        x: 33,
        y: 30,
        width: 34,
        height: 40,
        rotation: 0,
      };
      const newAreas = draftAreas.length ? draftAreas : [defaultArea];
      setDraftAreas(newAreas);
      setDraftHasPrintArea(true);
      toast.success('Baskı alanı modu aktifleştirildi.');
    } else {
      setDraftHasPrintArea(false);
      toast.info('Statik Görsel / Chart moduna geçildi.');
    }
  }, [selectedMockup, draftHasPrintArea, draftAreas, toast]);

  const handleCopyConfig = useCallback(() => {
    if (!selectedMockup) return;
    setCopiedConfig({
      printAreas: structuredClone(draftAreas),
      apparelType: draftApparelType,
    });
    toast.success('Baskı alanları panoya kopyalandı!');
  }, [selectedMockup, draftAreas, draftApparelType, toast]);

  const handlePasteConfig = useCallback(() => {
    if (!copiedConfig || !selectedMockup) return;
    setDraftApparelType(copiedConfig.apparelType);
    setDraftAreas(structuredClone(copiedConfig.printAreas));
    toast.success("Baskı alanları bu mockup'a yapıştırıldı (Kaydetmek için tıklayın)!");
  }, [copiedConfig, selectedMockup, toast]);

  const activePrintArea = draftAreas[activeAreaIndex] || draftAreas[0];

  return {
    draftAreas,
    setDraftAreas,
    draftApparelType,
    setDraftApparelType,
    draftHasPrintArea,
    setDraftHasPrintArea,
    activeAreaIndex,
    setActiveAreaIndex,
    activePrintArea,
    isDirty,
    copiedConfig,
    handleSaveChanges,
    handleRevertChanges,
    updateActivePrintAreaDraft,
    handleAddPrintArea,
    handleRemovePrintArea,
    handleTogglePrintAreaMode,
    handleCopyConfig,
    handlePasteConfig,
  };
}
