'use client';

/**
 * SEO puanının üç parçası (v2), her biri kaynağıyla: Kurallar, Etsy verisi (kelime havuzu), Yapay zekâ.
 * Verisi olmayan parça "bilinmiyor" görünür; puan eldeki parçalara oranlandıysa bu açıkça yazılır.
 */
import React from 'react';
import { Bot, Database, ListChecks } from 'lucide-react';
import type { SeoEvaluationResult } from '@/lib/etsy-seo-evaluator';

type Props = {
  evaluation: Partial<SeoEvaluationResult>;
  compact?: boolean;
};

function Bar({ icon, label, source, value, max, color, emptyText }: {
  icon: React.ReactNode; label: string; source: string; value: number | null | undefined; max: number; color: string; emptyText: string;
}) {
  const known = typeof value === 'number';
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-xs mb-1">
        <span className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200 min-w-0">
          {icon}
          <span className="truncate">{label}</span>
          <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">{source}</span>
        </span>
        <span className={`shrink-0 font-bold tabular-nums ${known ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400'}`}>
          {known ? `${value} / ${max}` : 'bilinmiyor'}
        </span>
      </div>
      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        {known && <div className={`h-full rounded-full ${color}`} style={{ width: `${(value / max) * 100}%` }} />}
      </div>
      {!known && <p className="text-[10px] text-slate-400 mt-1">{emptyText}</p>}
    </div>
  );
}

export function SeoBreakdown({ evaluation, compact = false }: Props) {
  if (evaluation.version !== 2 || !evaluation.breakdown) {
    return (
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Bu puan eski yöntemle hesaplanmış. İlanlar yenilendiğinde veya &quot;Analiz et&quot; ile yeni yöntemle yeniden hesaplanır.
      </p>
    );
  }
  const { breakdown, confidence, partial } = evaluation;
  return (
    <div className={compact ? 'space-y-2.5' : 'space-y-3'}>
      <Bar
        icon={<ListChecks className="w-3.5 h-3.5 text-sky-500" />}
        label="Etsy kuralları ve tekrar"
        source="Kural"
        value={breakdown.rules}
        max={breakdown.maxRules}
        color="bg-sky-500"
        emptyText=""
      />
      <Bar
        icon={<Database className="w-3.5 h-3.5 text-emerald-500" />}
        label="Arama gücü"
        source="Etsy verisi"
        value={breakdown.demand}
        max={breakdown.maxDemand}
        color="bg-emerald-500"
        emptyText="Etiketlerin güncel Etsy puanı yok; kelime havuzunda taranınca hesaplanır."
      />
      <Bar
        icon={<Bot className="w-3.5 h-3.5 text-purple-500" />}
        label="Tasarıma uygunluk ve kalite"
        source="Yapay zekâ"
        value={breakdown.ai}
        max={breakdown.maxAi}
        color="bg-purple-500"
        emptyText="Bu metin henüz analiz edilmedi."
      />
      <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
        {confidence ? `${confidence.scoredTags}/${confidence.totalTags} etiket güncel Etsy verisiyle puanlandı` : ''}
        {partial ? ' · Puan yalnızca bilinen parçalara göre hesaplandı.' : ''}
      </p>
    </div>
  );
}
