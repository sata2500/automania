import { getErrorMessage } from '@/lib/errors';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { DesignItem } from '@/types/pod';
import { useToast } from '@/components/common/ToastContext';

interface UseDesignAnalysisProps {
  designs: DesignItem[];
  setDesigns: React.Dispatch<React.SetStateAction<DesignItem[]>>;
  selectedDesignIds: string[];
}

type Analysis = NonNullable<DesignItem['analysis']>;
type ServerOutcome = { status: 'done'; analysis: Analysis } | { status: 'error'; error: string } | { status: 'timeout' };

const POLL_INTERVAL_MS = 4_000;
/** Sunucu analizi (görsel + kelime puanlama) en fazla ~2 dk sürer; biraz pay bırakılır. */
const MAX_WAIT_MS = 4 * 60_000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Sunucu analizinin durum alanları olmadan tasarım. */
function withoutAnalysisStatus(design: DesignItem): DesignItem {
  const rest = { ...design };
  delete rest.analysisPendingAt;
  delete rest.analysisError;
  return rest;
}

/**
 * Tasarım analizi. Giriş yapılmışsa analiz sunucuda arka planda yürür ve sonuç tasarıma sunucuda yazılır:
 * sekme kapansa da tamamlanır. Bu hook sonucu yoklar; sayfa yeniden açıldığında süren analizler
 * (`analysisPendingAt`) kaldığı yerden izlenir. Tasarım henüz sunucuya kaydedilmediyse analiz yanıtta döner.
 */
export function useDesignAnalysis({
  designs,
  setDesigns,
  selectedDesignIds,
}: UseDesignAnalysisProps) {
  const toast = useToast();
  const [localAnalyzingIds, setLocalAnalyzingIds] = useState<string[]>([]);
  const [analysisModalData, setAnalysisModalData] = useState<DesignItem | null>(null);
  const pollingRef = useRef(new Set<string>());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Bu sekmede başlatılanlar + sunucuda sürdüğü bilinenler (başka sekme/önceki oturum)
  const analyzingIds = useMemo(
    () => [...new Set([...localAnalyzingIds, ...designs.filter((d) => d.analysisPendingAt).map((d) => d.id)])],
    [localAnalyzingIds, designs]
  );

  const applyAnalysis = useCallback((designId: string, analysis: Analysis) => {
    setDesigns((prev) => prev.map((d) => (d.id === designId ? { ...withoutAnalysisStatus(d), analysis } : d)));
    setAnalysisModalData((prev) => (prev && prev.id === designId ? { ...prev, analysis } : prev));
  }, [setDesigns]);

  const clearStatus = useCallback((designId: string) => {
    setDesigns((prev) => prev.map((d) => (d.id === designId && (d.analysisPendingAt || d.analysisError) ? withoutAnalysisStatus(d) : d)));
  }, [setDesigns]);

  /** Sunucudaki analizin bitmesini bekler (sayfa kapanırsa yoklama durur, analiz sunucuda sürer). */
  const waitForServer = useCallback(async (designId: string): Promise<ServerOutcome> => {
    const deadline = Date.now() + MAX_WAIT_MS;
    while (mountedRef.current && Date.now() < deadline) {
      await wait(POLL_INTERVAL_MS);
      const res = await fetch(`/api/designs/analyze?designId=${encodeURIComponent(designId)}`, { cache: 'no-store' }).catch(() => null);
      if (!res?.ok) continue;
      const data = await res.json().catch(() => null) as { status?: string; analysis?: Analysis | null; error?: string } | null;
      if (data?.status === 'done' && data.analysis) return { status: 'done', analysis: data.analysis };
      if (data?.status === 'error') return { status: 'error', error: data.error || 'Analiz başarısız oldu.' };
      if (data?.status === 'none') return { status: 'error', error: 'Tasarım bulunamadı.' };
    }
    return { status: 'timeout' };
  }, []);

  // Sayfa açıldığında (veya başka sekmeden) sunucuda süren analizleri izle.
  useEffect(() => {
    for (const design of designs) {
      if (!design.analysisPendingAt || pollingRef.current.has(design.id)) continue;
      pollingRef.current.add(design.id);
      const { id, name } = design;
      void waitForServer(id).then((outcome) => {
        pollingRef.current.delete(id);
        if (!mountedRef.current) return;
        if (outcome.status === 'done') {
          applyAnalysis(id, outcome.analysis);
          toast.success(`'${name}' analizi tamamlandı.`);
        } else if (outcome.status === 'error') {
          clearStatus(id);
          toast.error(`'${name}' analiz edilemedi: ${outcome.error}`);
        }
      });
    }
  }, [designs, waitForServer, applyAnalysis, clearStatus, toast]);

  const handleAnalyzeDesign = useCallback(
    // `known`: listeye henüz yansımamış yeni bir tasarım. `silent`: arka plan analizi (bildirim gösterilmez).
    // Sonuç: 'ok', 'rate-limited' (Retry-After saniyesiyle) veya 'error'.
    async (designId: string, known?: DesignItem, options: { silent?: boolean } = {}): Promise<{ status: 'ok' | 'rate-limited' | 'error'; retryAfter?: number }> => {
      const design = known ?? designs.find((d) => d.id === designId);
      if (!design) return { status: 'error' };
      const { silent = false } = options;

      pollingRef.current.add(designId);
      setLocalAnalyzingIds((prev) => [...prev, designId]);
      try {
        const res = await fetch('/api/designs/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ src: design.src, designId }),
        });

        if (res.status === 429) {
          if (!silent) toast.error('Analiz limiti aşıldı. Lütfen birkaç dakika sonra tekrar deneyin.');
          return { status: 'rate-limited', retryAfter: Number(res.headers.get('Retry-After')) || 60 };
        }
        if (res.status === 504) {
          if (!silent) toast.error('Analiz zaman aşımına uğradı (sunucu yoğun). Lütfen birazdan tekrar deneyin.');
          return { status: 'error' };
        }
        let data: { success?: boolean; queued?: boolean; analysis?: Analysis; error?: string; warning?: string; pendingKeywords?: number };
        const rawText = await res.text();
        try {
          data = JSON.parse(rawText);
        } catch {
          throw new Error(rawText ? (rawText.length > 200 ? rawText.substring(0, 200) + '...' : rawText) : `Sunucu yanıt vermedi (HTTP ${res.status})`);
        }

        // Sunucuda arka planda: sayfa kapansa da sürer, sonuç tasarıma yazılır.
        if (data.success && data.queued) {
          if (!silent) toast.info(`'${design.name}' sunucuda analiz ediliyor (görsel, Etsy kelimeleri ve rakip etiketleri). Sayfayı kapatsanız da devam eder.`);
          const outcome = await waitForServer(designId);
          if (outcome.status === 'done') {
            applyAnalysis(designId, outcome.analysis);
            if (!silent) toast.success(`'${design.name}' analizi ve Etsy kelime puanları tamamlandı.`);
            return { status: 'ok' };
          }
          if (outcome.status === 'error') {
            clearStatus(designId);
            if (!silent) toast.error(`Analiz hatası: ${outcome.error}`);
            return { status: 'error' };
          }
          return { status: 'ok' }; // Sayfa kapandı veya uzun sürdü: sonuç sunucuda tasarıma yazılır.
        }

        if (data.success && data.analysis) {
          applyAnalysis(designId, data.analysis);
          if (!silent) {
            toast.success(data.pendingKeywords
              ? `'${design.name}' analiz edildi; ${data.pendingKeywords} kelimenin Etsy puanı arka planda hesaplanıyor (analiz penceresinde güncel görünür).`
              : `'${design.name}' analizi ve Etsy kelime puanları tamamlandı.`);
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
        pollingRef.current.delete(designId);
        setLocalAnalyzingIds((prev) => prev.filter((id) => id !== designId));
      }
    },
    [designs, toast, waitForServer, applyAnalysis, clearStatus]
  );

  const handleBulkAnalyze = useCallback(async () => {
    if (selectedDesignIds.length === 0) return;

    const toAnalyze = selectedDesignIds.filter((id) => !analyzingIds.includes(id));
    if (toAnalyze.length === 0) return;

    toast.info(`${toAnalyze.length} tasarım sırayla sunucuda analiz ediliyor...`);

    for (const id of toAnalyze) {
      await handleAnalyzeDesign(id, undefined, { silent: true });
    }
    toast.success('Seçili tasarımların analizi tamamlandı.');
  }, [selectedDesignIds, analyzingIds, handleAnalyzeDesign, toast]);

  return {
    analyzingIds,
    analysisModalData,
    setAnalysisModalData,
    handleAnalyzeDesign,
    handleBulkAnalyze,
  };
}
