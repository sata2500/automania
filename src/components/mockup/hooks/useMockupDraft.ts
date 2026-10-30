import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { MockupItem, ApparelType, PrintArea } from '@/types/pod';
import { useToast } from '@/components/common/ToastContext';

type DraftSnapshot = { areas: PrintArea[]; apparelType: ApparelType; hasPrintArea: boolean };

/** Bu süre içindeki ardışık küçük değişiklikler (ör. sayı alanına yazmak) tek geri alma adımı sayılır. */
const UNDO_COALESCE_MS = 700;
const MAX_UNDO_STEPS = 50;

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

  // Adım adım geri alma: her değişiklikten önceki taslak (kaydet / tümünü geri al / mockup değişimi temizler)
  const [undoStack, setUndoStack] = useState<DraftSnapshot[]>([]);
  const lastRememberAtRef = useRef(0);

  const [copiedConfig, setCopiedConfig] = useState<{
    printAreas: PrintArea[];
    apparelType: ApparelType;
  } | null>(null);

  // Sync draft state whenever the selected mockup (by id) changes — render sırasında, efekt olmadan.
  const [draftMockupId, setDraftMockupId] = useState<string | null>(null);
  const selectedMockupId = selectedMockup?.id ?? null;
  if (selectedMockupId !== draftMockupId) {
    setDraftMockupId(selectedMockupId);
    setUndoStack([]);
    if (selectedMockup) {
      setDraftAreas(structuredClone(selectedMockup.printAreas || []));
      setDraftApparelType(selectedMockup.apparelType);
      setDraftHasPrintArea(selectedMockup.hasPrintArea !== false);
      if (activeAreaIndex >= (selectedMockup.printAreas?.length || 1)) {
        setActiveAreaIndex(0);
      }
    }
  }

  // Check if current draft has unsaved changes
  const isDirty = useMemo(() => {
    if (!selectedMockup) return false;
    return (
      JSON.stringify(draftAreas) !== JSON.stringify(selectedMockup.printAreas || []) ||
      draftApparelType !== selectedMockup.apparelType ||
      draftHasPrintArea !== (selectedMockup.hasPrintArea !== false)
    );
  }, [selectedMockup, draftAreas, draftApparelType, draftHasPrintArea]);

  /** Değişiklikten önce çağrılır: mevcut taslağı geri alma yığınına ekler. */
  const remember = useCallback((coalesce = false) => {
    const now = Date.now();
    const recent = now - lastRememberAtRef.current < UNDO_COALESCE_MS;
    lastRememberAtRef.current = now;
    if (coalesce && recent) return;
    const snapshot: DraftSnapshot = { areas: structuredClone(draftAreas), apparelType: draftApparelType, hasPrintArea: draftHasPrintArea };
    setUndoStack((prev) => [...prev.slice(-(MAX_UNDO_STEPS - 1)), snapshot]);
  }, [draftAreas, draftApparelType, draftHasPrintArea]);

  const handleUndo = useCallback(() => {
    const last = undoStack[undoStack.length - 1];
    if (!last) return;
    setUndoStack((prev) => prev.slice(0, -1));
    setDraftAreas(last.areas);
    setDraftApparelType(last.apparelType);
    setDraftHasPrintArea(last.hasPrintArea);
    setActiveAreaIndex((idx) => (idx < last.areas.length ? idx : 0));
    lastRememberAtRef.current = 0;
  }, [undoStack]);

  const changeApparelType = useCallback((type: ApparelType) => {
    if (type === draftApparelType) return;
    remember();
    setDraftApparelType(type);
  }, [draftApparelType, remember]);

  // Kaydedilmemiş değişiklik varken sayfa kapatılır/yenilenirse tarayıcı uyarır.
  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

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
    setUndoStack([]);
    toast.success('Baskı ayarları kaydedildi.');
  }, [selectedMockup, draftAreas, draftApparelType, draftHasPrintArea, setMockups, toast]);

  // Revert draft changes back to saved mockup state
  const handleRevertChanges = useCallback(() => {
    if (!selectedMockup) return;
    setDraftAreas(structuredClone(selectedMockup.printAreas || []));
    setDraftApparelType(selectedMockup.apparelType);
    setDraftHasPrintArea(selectedMockup.hasPrintArea !== false);
    setUndoStack([]);
    toast.info('Kaydedilmemiş değişiklikler geri alındı.');
  }, [selectedMockup, toast]);

  const updateActivePrintAreaDraft = useCallback((areaUpdates: Partial<PrintArea>) => {
    remember(true);
    setDraftAreas((prev) =>
      prev.map((area, idx) => (idx === activeAreaIndex ? { ...area, ...areaUpdates } : area))
    );
  }, [activeAreaIndex, remember]);

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
    remember();
    setDraftAreas(updated);
    setDraftHasPrintArea(true);
    setActiveAreaIndex(updated.length - 1);
    toast.success(`'${newArea.name}' eklendi.`);
  }, [selectedMockup, draftAreas, remember, toast]);

  const handleRemovePrintArea = useCallback((idx: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!selectedMockup || draftAreas.length <= 1) {
      toast.warning('En az 1 baskı alanı bulunmalıdır.');
      return;
    }
    const removedName = draftAreas[idx]?.name || 'Baskı alanı';
    const updated = draftAreas.filter((_, i) => i !== idx);
    remember();
    setDraftAreas(updated);
    setActiveAreaIndex(0);
    toast.info(`'${removedName}' kaldırıldı.`);
  }, [selectedMockup, draftAreas, remember, toast]);

  const handleTogglePrintAreaMode = useCallback(() => {
    if (!selectedMockup) return;
    remember();
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
  }, [selectedMockup, draftHasPrintArea, draftAreas, remember, toast]);

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
    remember();
    setDraftApparelType(copiedConfig.apparelType);
    setDraftAreas(structuredClone(copiedConfig.printAreas));
    toast.success("Baskı alanları bu mockup'a yapıştırıldı.");
  }, [copiedConfig, selectedMockup, remember, toast]);

  const activePrintArea = draftAreas[activeAreaIndex] || draftAreas[0];

  return {
    draftAreas,
    draftApparelType,
    setDraftApparelType: changeApparelType,
    draftHasPrintArea,
    activeAreaIndex,
    setActiveAreaIndex,
    activePrintArea,
    isDirty,
    canUndo: undoStack.length > 0,
    handleUndo,
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
