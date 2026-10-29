import { getErrorMessage } from '@/lib/errors';
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
    // `known`: listeye henüz yansımamış yeni bir tasarım. `silent`: arka plan analizi (bildirim gösterilmez).
    // Sonuç: 'ok', 'rate-limited' (Retry-After saniyesiyle) veya 'error'.
    async (designId: string, known?: DesignItem, options: { silent?: boolean } = {}): Promise<{ status: 'ok' | 'rate-limited' | 'error'; retryAfter?: number }> => {
      const design = known ?? designs.find((d) => d.id === designId);
      if (!design) return { status: 'error' };
      const { silent = false } = options;

      setAnalyzingIds((prev) => [...prev, designId]);
      if (!silent) toast.info(`'${design.name}' görseli, Etsy kelimeleri ve rakip etiketleri taranıyor...`);
      try {
        const res = await fetch('/api/designs/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ src: design.src, name: design.name }),
        });
        
        if (res.status === 429) {
          if (!silent) toast.error('Analiz limiti aşıldı. Lütfen birkaç dakika sonra tekrar deneyin.');
          return { status: 'rate-limited', retryAfter: Number(res.headers.get('Retry-After')) || 60 };
        }
        let data: { success?: boolean; analysis?: DesignItem['analysis']; error?: string; warning?: string };
        const rawText = await res.text();
        try {
          data = JSON.parse(rawText);
        } catch {
          throw new Error(rawText ? (rawText.length > 200 ? rawText.substring(0, 200) + '...' : rawText) : `Sunucu yanıt vermedi (HTTP ${res.status})`);
        }

        if (data.success && data.analysis) {
          const updatedAnalysis = { ...data.analysis, source: 'vision' as const };
          setDesigns((prev) =>
            prev.map((d) =>
              d.id === designId ? { ...d, analysis: updatedAnalysis } : d
            )
          );
          setAnalysisModalData((prev) =>
            prev && prev.id === designId ? { ...prev, analysis: updatedAnalysis } : prev
          );
          if (!silent) {
            toast.success(`'${design.name}' analizi ve Etsy kelime havuzu senkronizasyonu tamamlandı!`);
            if (data.warning) toast.error(data.warning);
          }
          return { status: 'ok' };
        }
        if (!silent) toast.error(`Analiz hatası: ${data.error || 'Bilinmeyen hata'}`);
        return { status: 'error' };
      } catch (e) {
        console.error('Tasarım analiz hatası:', e);
        if (!silent) toast.error(`Analiz hatası: ${getErrorMessage(e) || 'Sunucu hatası oluştu.'}`);
        return { status: 'error' };
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

    toast.info(`${toAnalyze.length} tasarım için Etsy kelime havuzu ve görsel analizi başlatıldı...`);

    for (const id of toAnalyze) {
      await handleAnalyzeDesign(id);
    }
    toast.success('Tüm tasarımların analizi ve kelime havuzu senkronizasyonu tamamlandı!');
  }, [selectedDesignIds, analyzingIds, handleAnalyzeDesign, toast]);

  return {
    analyzingIds,
    analysisModalData,
    setAnalysisModalData,
    handleAnalyzeDesign,
    handleBulkAnalyze,
  };
}
