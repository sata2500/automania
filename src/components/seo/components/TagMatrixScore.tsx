'use client';

import React, { useMemo } from 'react';
import { ShieldCheck, Tag, Sparkles, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';
import { isTrademarkViolator } from '@/lib/trademark-shield';

interface TagMatrixScoreProps {
  tags: string[];
  title?: string;
  className?: string;
}

export function TagMatrixScore({ tags = [], title = '', className = '' }: TagMatrixScoreProps) {
  // Real-time analysis of the 13 tags
  const analysis = useMemo(() => {
    const validTags = tags.map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean);
    const tagCount = validTags.length;

    // Check <= 20 chars
    const over20Chars = validTags.filter((t) => t.length > 20);

    // Trademark check
    const trademarkViolations = validTags.filter((t) => isTrademarkViolator(t).isViolator);

    // Anti-cannibalization root word check
    const words = validTags.flatMap((t) => t.toLowerCase().split(/\s+/));
    const wordCounts: Record<string, number> = {};
    words.forEach((w) => {
      if (w.length > 2) {
        wordCounts[w] = (wordCounts[w] || 0) + 1;
      }
    });

    const shirtCount = (wordCounts['shirt'] || 0) + (wordCounts['tee'] || 0) + (wordCounts['tshirt'] || 0);
    const isCannibalized = shirtCount > 4;

    // 5-Bucket Distribution
    const buckets = {
      subject: 0,
      typography: 0,
      aesthetic: 0,
      gift: 0,
      lifestyle: 0,
    };

    const typographyKeywords = ['quote', 'saying', 'grow', 'mindset', 'inspirational', 'funny', 'sarcastic', 'text', 'words'];
    const aestheticKeywords = ['cottagecore', 'botanical', 'vintage', 'retro', 'minimalist', 'boho', 'wildflower', 'dark academia', 'aesthetic', 'art', 'graphic', 'gothic', 'pastel'];
    const giftKeywords = ['gift', 'present', 'mom', 'her', 'him', 'birthday', 'mother', 'father', 'friend', 'sister', 'brother', 'lover', 'teacher', 'nurse', 'holiday', 'xmas', 'christmas'];
    const lifestyleKeywords = ['self care', 'nature', 'plant', 'gardening', 'whimsical', 'outdoor', 'mental health', 'positive', 'vibes', 'bookish', 'cat mom', 'dog mom', 'gardener'];

    validTags.forEach((tag) => {
      const lower = tag.toLowerCase();
      let matched = false;

      if (giftKeywords.some((k) => lower.includes(k))) {
        buckets.gift++;
        matched = true;
      }
      if (aestheticKeywords.some((k) => lower.includes(k))) {
        buckets.aesthetic++;
        matched = true;
      }
      if (typographyKeywords.some((k) => lower.includes(k))) {
        buckets.typography++;
        matched = true;
      }
      if (lifestyleKeywords.some((k) => lower.includes(k))) {
        buckets.lifestyle++;
        matched = true;
      }
      if (!matched || lower.includes('shirt') || lower.includes('tee') || lower.includes('hoodie')) {
        buckets.subject++;
      }
    });

    // Calculate SEO Health Score
    let score = 0;
    // 1. Tag count (Target 13)
    if (tagCount === 13) score += 30;
    else if (tagCount >= 10) score += 20;
    else score += tagCount * 2;

    // 2. Length compliance
    if (over20Chars.length === 0) score += 20;
    else score += Math.max(0, 20 - over20Chars.length * 5);

    // 3. Anti-cannibalization
    if (!isCannibalized) score += 20;
    else score += 10;

    // 4. Trademark clean
    if (trademarkViolations.length === 0) score += 15;

    // 5. Diversity coverage (at least 3 buckets filled)
    const filledBuckets = Object.values(buckets).filter((c) => c > 0).length;
    if (filledBuckets >= 4) score += 15;
    else if (filledBuckets >= 3) score += 10;
    else score += 5;

    // Grade
    let grade = 'A+';
    let gradeColor = 'text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10';
    if (score < 75) {
      grade = 'C';
      gradeColor = 'text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10';
    } else if (score < 85) {
      grade = 'B';
      gradeColor = 'text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10';
    } else if (score < 95) {
      grade = 'A';
      gradeColor = 'text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10';
    }

    return {
      tagCount,
      over20Chars,
      trademarkViolations,
      shirtCount,
      isCannibalized,
      buckets,
      filledBuckets,
      score,
      grade,
      gradeColor,
    };
  }, [tags, title]);

  return (
    <div className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 ${className}`}>
      {/* Header with SEO Score */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">Etiket Sağlık Matrisi & Çeşitlilik Denetimi</h4>
            <p className="text-[10px] text-slate-500">13 Etiketin arama niyetleri ve kelime yamyamlığı analizi</p>
          </div>
        </div>

        {/* Health Score Badge */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border font-bold text-xs ${analysis.gradeColor}`}>
          <Sparkles className="w-3.5 h-3.5" />
          <span>SEO Skoru: {analysis.score}/100 ({analysis.grade})</span>
        </div>
      </div>

      {/* 5-Bucket Distribution Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-center">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5 font-medium">🏷️ Özne / Ürün</span>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{analysis.buckets.subject} Etiket</span>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-center">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5 font-medium">💬 Tipografi / Mesaj</span>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{analysis.buckets.typography} Etiket</span>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-center">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5 font-medium">🎨 Estetik / Stil</span>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{analysis.buckets.aesthetic} Etiket</span>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-center">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5 font-medium">🎁 Hediye / Alıcı</span>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{analysis.buckets.gift} Etiket</span>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-center col-span-2 sm:col-span-1">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5 font-medium">🌟 Yaşam Tarzı / Trend</span>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{analysis.buckets.lifestyle} Etiket</span>
        </div>
      </div>

      {/* Health Checks & Feedback */}
      <div className="space-y-2 text-[11px]">
        {/* Tag count check */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
          <span className="text-slate-500 dark:text-slate-400">13 Etiket Kotası:</span>
          <span className={`font-bold ${analysis.tagCount === 13 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {analysis.tagCount} / 13 Seçili
          </span>
        </div>

        {/* 20 Char Limit Check */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
          <span className="text-slate-500 dark:text-slate-400">20 Karakter Kuralı:</span>
          {analysis.over20Chars.length === 0 ? (
            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" /> Tümü Uygun (≤20)
            </span>
          ) : (
            <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1 font-bold">
              <AlertTriangle className="w-3.5 h-3.5" /> {analysis.over20Chars.length} Etiket 20 Karakteri Aşıyor!
            </span>
          )}
        </div>

        {/* Anti-Cannibalization Check */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
          <span className="text-slate-500 dark:text-slate-400">Kök Kelime Tekrarı (Shirt/Tee):</span>
          {!analysis.isCannibalized ? (
            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" /> Dengeli ({analysis.shirtCount}/4 tekrar)
            </span>
          ) : (
            <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 font-bold">
              <AlertTriangle className="w-3.5 h-3.5" /> Yüksek Tekrar ({analysis.shirtCount} kez "shirt/tee" geçiyor)
            </span>
          )}
        </div>

        {/* Trademark Shield Check */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
          <span className="text-slate-500 dark:text-slate-400">Telif / Marka (Trademark) Güvenliği:</span>
          {analysis.trademarkViolations.length === 0 ? (
            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-bold">
              <ShieldCheck className="w-3.5 h-3.5" /> %100 Güvenli (0 İhlal)
            </span>
          ) : (
            <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1 font-bold">
              <AlertTriangle className="w-3.5 h-3.5" /> {analysis.trademarkViolations.join(', ')} (Riskli!)
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
