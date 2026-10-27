'use client';
import React, { useMemo } from 'react';
import { Gauge } from 'lucide-react';
import { TagMatrixScore } from '../components/TagMatrixScore';
import { useEtsySeo } from '../context/EtsySeoContext';
import { evaluateEtsyListingSeo, type KeywordPoolInputRow } from '@/lib/etsy-seo-evaluator';

export const SeoTagHealthSection: React.FC = () => {
  const { selectedTags, generatedTitle, generatedDescription, enrichedKeywords } = useEtsySeo();

  // Genel SEO skoru "Etsy'deki İlanlarım" görünümüyle aynı motor ve ölçekle hesaplanır;
  // böylece ilan yayınlandıktan sonra iki sekmede farklı puan görülmez.
  const overall = useMemo(() => {
    const keywordPoolRows: KeywordPoolInputRow[] = (enrichedKeywords || [])
      .filter((k) => typeof k.opportunity_score === 'number')
      .map((k) => ({ keyword: k.keyword, opportunity_score: k.opportunity_score, total_listings: k.total_listings, bestseller_count: k.bestseller_count }));
    return evaluateEtsyListingSeo({ title: generatedTitle, description: generatedDescription, tags: selectedTags, keywordPoolRows });
  }, [generatedTitle, generatedDescription, selectedTags, enrichedKeywords]);

  const topIssues = overall.issues.filter((issue) => issue.severity !== 'tip').slice(0, 3);
  const scoreColor = overall.score >= 80
    ? 'text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10'
    : overall.score >= 55
      ? 'text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10'
      : 'text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10';

  return (
    <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-5 shadow-sm">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-xs flex items-center justify-center font-bold">4</span>
            SEO Skoru & 13 Etiket Sağlığı
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Başlık, açıklama ve etiketlerin genel SEO puanı ile etiketlerin karakter limiti, çeşitlilik ve marka güvenliği denetimi.
          </p>
        </div>
      </div>

      {/* Genel SEO skoru — İlanlarım sekmesiyle aynı ölçüt */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
            <Gauge className="w-4 h-4 text-emerald-500" />
            Genel SEO Skoru
            <span className="font-normal text-slate-500">(İlanlarım sekmesiyle aynı ölçüt)</span>
          </div>
          <span className={`px-3 py-1 rounded-xl border text-xs font-bold ${scoreColor}`}>
            {overall.score}/100 ({overall.grade})
          </span>
        </div>
        <p className="text-[11px] text-slate-500">
          Başlık {overall.breakdown.titleScore}/{overall.breakdown.maxTitle} · Etiketler {overall.breakdown.tagsScore}/{overall.breakdown.maxTags} · Açıklama {overall.breakdown.descriptionScore}/{overall.breakdown.maxDesc}
        </p>
        {topIssues.length > 0 && (
          <ul className="list-disc pl-5 text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5">
            {topIssues.map((issue, index) => <li key={index}>{issue.message}</li>)}
          </ul>
        )}
      </div>

      {/* Real-time Tag Health Matrix & Intent Distribution Score */}
      <TagMatrixScore tags={selectedTags} />
    </div>
  );
};
