import { useEffect, useRef, useState } from 'react';
import type { DesignItem } from '@/types/pod';
import { needsAutoAnalysis, needsOptimization } from '@/lib/design-library';

type AnalyzeResult = { status: 'ok' | 'rate-limited' | 'error'; retryAfter?: number };

interface UseDesignMaintenanceProps {
  designs: DesignItem[];
  setDesigns: React.Dispatch<React.SetStateAction<DesignItem[]>>;
  /** Yalnızca giriş yapılmışken (dosyalar sunucuda) çalışır. */
  enabled: boolean;
  analyzingIds: string[];
  analyze: (designId: string, known: DesignItem, options: { silent: boolean }) => Promise<AnalyzeResult>;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Tasarımlar sekmesi açıkken arka planda, sırayla ve tek tek:
 *  1. Henüz işlenmemiş tasarımların saydam boşlukları kırpılır ve kayıpsız PNG olarak yeniden saklanır
 *     (/api/designs/optimize; ölçüler de güncellenir).
 *  2. Otomasyonun ve yapay zekânın ürettiği tasarımlar görsel yapay zekâ ile analiz edilir.
 * Limit aşılırsa bekleyip devam eder; başarısız olan tasarım bu oturumda yeniden denenmez.
 */
export function useDesignMaintenance({ designs, setDesigns, enabled, analyzingIds, analyze }: UseDesignMaintenanceProps) {
  const designsRef = useRef(designs);
  const analyzingRef = useRef(analyzingIds);
  const analyzeRef = useRef(analyze);
  const failedRef = useRef(new Set<string>());
  // Render'da kullanılan kopya (başarısız tasarımlar bekleyen iş sayılmaz).
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const runningRef = useRef(false);
  const enabledRef = useRef(enabled);
  const mountedRef = useRef(true);
  const [activeTask, setActiveTask] = useState<{ kind: 'optimize' | 'analyze'; remaining: number } | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    designsRef.current = designs;
    analyzingRef.current = analyzingIds;
    analyzeRef.current = analyze;
    enabledRef.current = enabled;
  });

  // Döngü yalnızca sekme kapanınca veya oturum kapanınca durur (yeniden çizimler onu kesmez).
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const pendingOptimize = enabled ? designs.filter((d) => needsOptimization(d) && !failed.has(`o:${d.id}`)).length : 0;
  const pendingAnalyze = enabled ? designs.filter((d) => needsAutoAnalysis(d) && !failed.has(`a:${d.id}`)).length : 0;
  const hasWork = pendingOptimize + pendingAnalyze > 0;

  useEffect(() => {
    if (!enabled || !hasWork || runningRef.current) return;
    runningRef.current = true;
    const stopped = () => !mountedRef.current || !enabledRef.current;
    const markFailed = (key: string) => {
      failedRef.current.add(key);
      setFailed(new Set(failedRef.current));
    };

    const nextOptimize = () => designsRef.current.find((d) => needsOptimization(d) && !failedRef.current.has(`o:${d.id}`));
    const nextAnalyze = () => designsRef.current.find((d) =>
      !needsOptimization(d) && needsAutoAnalysis(d) && !failedRef.current.has(`a:${d.id}`) && !analyzingRef.current.includes(d.id));

    void (async () => {
      try {
        // Kullanıcının ilk etkileşimlerini yavaşlatmamak için kısa bir gecikmeyle başlanır.
        await wait(1500);
        while (!stopped()) {
          const target = nextOptimize();
          if (!target) break;
          setActiveTask({ kind: 'optimize', remaining: designsRef.current.filter((d) => needsOptimization(d) && !failedRef.current.has(`o:${d.id}`)).length });
          const res = await fetch('/api/designs/optimize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ src: target.src }),
          }).catch(() => null);
          if (res?.status === 429) {
            await wait((Number(res.headers.get('Retry-After')) || 60) * 1000);
            continue;
          }
          const data = res?.ok ? await res.json().catch(() => null) as { changed?: boolean; url?: string; width?: number; height?: number } | null : null;
          if (!data) {
            markFailed(`o:${target.id}`);
            continue;
          }
          const now = Date.now();
          const optimizedDesign = (d: DesignItem): DesignItem => ({
            ...d,
            ...(data.changed && data.url ? { src: data.url } : {}),
            ...(data.width && data.height ? { width: data.width, height: data.height } : {}),
            optimizedAt: now,
          });
          // Bu arada tasarım değiştiyse (kırpma, arka plan kaldırma) güncel hâline dokunulmaz.
          designsRef.current = designsRef.current.map((d) => (d.id === target.id && d.src === target.src ? optimizedDesign(d) : d));
          setDesigns((prev) => prev.map((d) => (d.id === target.id && d.src === target.src ? optimizedDesign(d) : d)));
        }

        while (!stopped()) {
          const target = nextAnalyze();
          if (!target) break;
          setActiveTask({ kind: 'analyze', remaining: designsRef.current.filter((d) => needsAutoAnalysis(d) && !failedRef.current.has(`a:${d.id}`)).length });
          const result = await analyzeRef.current(target.id, target, { silent: true });
          if (result.status === 'rate-limited') {
            await wait((result.retryAfter ?? 60) * 1000);
            continue;
          }
          if (result.status === 'error') markFailed(`a:${target.id}`);
          else designsRef.current = designsRef.current.map((d) => (d.id === target.id ? { ...d, analysis: { ...(d.analysis ?? { description: '', keywords: [], analyzedAt: Date.now() }), source: 'vision' } } : d));
        }
      } finally {
        runningRef.current = false;
        if (!stopped()) {
          setActiveTask(null);
          // Çalışırken eklenen tasarımlar için yeniden kontrol edilir.
          setTick((t) => t + 1);
        }
      }
    })();
  }, [enabled, hasWork, setDesigns, tick]);

  return { activeTask };
}
