import { useState, useCallback } from 'react';
import { DesignItem } from '@/types/pod';
import { useToast } from '@/components/common/ToastContext';

interface UseDesignAnalysisProps {
  designs: DesignItem[];
  setDesigns: React.Dispatch<React.SetStateAction<DesignItem[]>>;
  selectedDesignIds: string[];
}

export function useDesignAnalysis({
  designs,
  setDesigns,
  selectedDesignIds,
}: UseDesignAnalysisProps) {
  const toast = useToast();
  const [analyzingIds, setAnalyzingIds] = useState<string[]>([]);
  const [analysisModalData, setAnalysisModalData] = useState<DesignItem | null>(null);

  const handleAnalyzeDesign = useCallback(
    async (designId: string) => {
      const design = designs.find((d) => d.id === designId);
      if (!design) return;

      setAnalyzingIds((prev) => [...prev, designId]);
      try {
        const res = await fetch('/api/designs/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ src: design.src, name: design.name }),
        });
        const data = await res.json();

        if (data.success && data.analysis) {
          const updatedAnalysis = data.analysis;
          setDesigns((prev) =>
            prev.map((d) =>
              d.id === designId ? { ...d, analysis: updatedAnalysis } : d
            )
          );
          setAnalysisModalData((prev) =>
            prev && prev.id === designId ? { ...prev, analysis: updatedAnalysis } : prev
          );
          toast.success(`'${design.name}' analizi başarıyla tamamlandı!`);
          if (data.warning) {
            toast.error(data.warning);
          }
        } else {
          toast.error(`Analiz hatası: ${data.error || 'Bilinmeyen hata'}`);
        }
      } catch (e: any) {
        console.error('Tasarım analiz hatası:', e);
        toast.error('Analiz işlemi sırasında sunucu hatası oluştu.');
      } finally {
        setAnalyzingIds((prev) => prev.filter((id) => id !== designId));
      }
    },
    [designs, setDesigns, toast]
  );

  const handleBulkAnalyze = useCallback(async () => {
    if (selectedDesignIds.length === 0) return;

    const toAnalyze = selectedDesignIds.filter((id) => !analyzingIds.includes(id));
    if (toAnalyze.length === 0) return;

    toast.info(`${toAnalyze.length} tasarım kuyruğa alındı, sırayla analiz ediliyor...`);

    for (const id of toAnalyze) {
      await handleAnalyzeDesign(id);
    }
    toast.success('Toplu analiz işlemi tamamlandı!');
  }, [selectedDesignIds, analyzingIds, handleAnalyzeDesign, toast]);

  return {
    analyzingIds,
    analysisModalData,
    setAnalysisModalData,
    handleAnalyzeDesign,
    handleBulkAnalyze,
  };
}
