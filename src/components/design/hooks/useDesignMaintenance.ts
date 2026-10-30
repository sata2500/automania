import { useEffect, useRef, useState } from 'react';
import type { DesignItem } from '@/types/pod';
import { needsLocalOptimization, needsOptimization } from '@/lib/design-library';
import { processImageInBrowser } from '@/lib/browser-image';

interface UseDesignMaintenanceProps {
  designs: DesignItem[];
  setDesigns: React.Dispatch<React.SetStateAction<DesignItem[]>>;
  /** 'server': giriş yapılmış, dosyalar sunucuda. 'local': misafir, dosyalar bu cihazda (tarayıcıda işlenir). */
  mode: 'server' | 'local';
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type OptimizeOutcome = { src?: string; width?: number; height?: number } | 'retry' | null;

/** Sunucuda yeniden optimizasyon (/api/designs/optimize). Limit aşılırsa bekleyip yeniden denenir. */
async function optimizeOnServer(design: DesignItem): Promise<OptimizeOutcome> {
  const res = await fetch('/api/designs/optimize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ src: design.src }),
  }).catch(() => null);
  if (res?.status === 429) {
    await wait((Number(res.headers.get('Retry-After')) || 60) * 1000);
    return 'retry';
  }
  const data = res?.ok ? await res.json().catch(() => null) as { changed?: boolean; url?: string; width?: number; height?: number } | null : null;
  if (!data) return null;
  return { ...(data.changed && data.url ? { src: data.url } : {}), width: data.width, height: data.height };
}

async function optimizeLocally(design: DesignItem): Promise<OptimizeOutcome> {
  const result = await processImageInBrowser(design.src, { type: 'encode' }).catch(() => null);
  if (!result?.dataUrl) return null;
  // Yeniden kodlanan dosya daha büyükse eskisi korunur (yalnızca ölçüler güncellenmez).
  const smaller = result.size < Math.round((design.src.length * 3) / 4);
  return smaller ? { src: result.dataUrl, width: result.width, height: result.height } : {};
}

/**
 * Tasarımlar sekmesi açıkken arka planda, sırayla ve tek tek: henüz işlenmemiş (eski, kırpılmış) tasarımların
 * saydam boşlukları kırpılır ve kayıpsız PNG olarak yeniden saklanır (ölçüler de güncellenir). Giriş yapılmışsa
 * sunucuda (/api/designs/optimize), misafirde tarayıcıda yapılır. Her tasarım bir kez işlenir; başarısız olan
 * tasarım bu oturumda yeniden denenmez. Analiz burada yapılmaz.
 */
export function useDesignMaintenance({ designs, setDesigns, mode }: UseDesignMaintenanceProps) {
  const designsRef = useRef(designs);
  const failedRef = useRef(new Set<string>());
  // Render'da kullanılan kopya (başarısız tasarımlar bekleyen iş sayılmaz).
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const runningRef = useRef(false);
  const modeRef = useRef(mode);
  const mountedRef = useRef(true);
  const [activeTask, setActiveTask] = useState<{ remaining: number } | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    designsRef.current = designs;
    modeRef.current = mode;
  });

  // Döngü yalnızca sekme kapanınca veya oturum değişince durur (yeniden çizimler onu kesmez).
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const needs = mode === 'server' ? needsOptimization : needsLocalOptimization;
  const hasWork = designs.some((d) => needs(d) && !failed.has(d.id));

  useEffect(() => {
    if (!hasWork || runningRef.current) return;
    runningRef.current = true;
    const startedMode = mode;
    const stopped = () => !mountedRef.current || modeRef.current !== startedMode;
    const pendingDesigns = () => designsRef.current.filter((d) => needs(d) && !failedRef.current.has(d.id));
    const optimize = startedMode === 'server' ? optimizeOnServer : optimizeLocally;

    void (async () => {
      try {
        // Kullanıcının ilk etkileşimlerini yavaşlatmamak için kısa bir gecikmeyle başlanır.
        await wait(1500);
        while (!stopped()) {
          const queue = pendingDesigns();
          const target = queue[0];
          if (!target) break;
          setActiveTask({ remaining: queue.length });
          const outcome = await optimize(target);
          if (outcome === 'retry') continue;
          if (!outcome) {
            failedRef.current.add(target.id);
            setFailed(new Set(failedRef.current));
            continue;
          }
          const now = Date.now();
          const optimizedDesign = (d: DesignItem): DesignItem => ({
            ...d,
            ...(outcome.src ? { src: outcome.src } : {}),
            ...(outcome.width && outcome.height ? { width: outcome.width, height: outcome.height } : {}),
            optimizedAt: now,
          });
          // Bu arada tasarım değiştiyse (kırpma, arka plan kaldırma) güncel hâline dokunulmaz.
          designsRef.current = designsRef.current.map((d) => (d.id === target.id && d.src === target.src ? optimizedDesign(d) : d));
          setDesigns((prev) => prev.map((d) => (d.id === target.id && d.src === target.src ? optimizedDesign(d) : d)));
        }
      } finally {
        runningRef.current = false;
        if (mountedRef.current) {
          setActiveTask(null);
          // Çalışırken eklenen tasarımlar (veya oturum değiştiyse yeni kipteki işler) için yeniden kontrol edilir.
          setTick((t) => t + 1);
        }
      }
    })();
  }, [mode, needs, hasWork, setDesigns, tick]);

  return { activeTask };
}
