/**
 * Etsy SEO Evaluation Engine (0-100 Score & In-Depth Diagnostic)
 * Analyzes Title, 13 Golden Tags, Description, Keyword Pool metrics, and Vision AI Consistency.
 */

export interface VisionAnalysisData {
  primarySubject?: string;
  primaryAesthetic?: string;
  detectedStyle?: string;
  detectedColors?: string[];
  productType?: string;
  description?: string;
  keywords?: string[];
  analyzedAt?: number | string;
}

export interface SeoIssue {
  severity: 'critical' | 'warning' | 'tip';
  field: 'title' | 'tags' | 'description' | 'vision';
  message: string;
  fixSuggestion?: string;
}

export interface KeywordPoolMetric {
  keyword: string;
  opportunityScore: number;
  totalListings?: number;
  competitionLevel?: string;
  bestsellerCount?: number;
  isEtsySuggested?: boolean;
  lastEvaluatedAt?: string | number | Date | null;
  isFresh?: boolean;
}

export interface TagMetricBreakdown {
  keyword: string;
  charLength: number;
  isValidLength: boolean; // <= 20 chars
  isMultiWord: boolean;
  opportunityScore: number;
  totalListings?: number;
  competitionLevel?: string;
  bestsellerCount?: number;
  isEtsySuggested?: boolean;
  inPool: boolean;
  isFresh?: boolean;
  status: 'excellent' | 'good' | 'average' | 'poor' | 'invalid';
}

export interface SeoEvaluationResult {
  score: number;
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  breakdown: {
    titleScore: number;
    tagsScore: number;
    descriptionScore: number;
    consistencyScore?: number;
    maxTitle: number;
    maxTags: number;
    maxDesc: number;
    maxConsistency?: number;
  };
  tagBreakdown: TagMetricBreakdown[];
  strengths: string[];
  issues: SeoIssue[];
  matchedPoolKeywords: KeywordPoolMetric[];
  missingPoolKeywords: KeywordPoolMetric[];
  evaluatedAt: string;
}

/**
 * Calculates a comprehensive 0-100 SEO score for an Etsy listing.
 */
export function evaluateEtsyListingSeo(params: {
  title?: string | null;
  description?: string | null;
  tags?: string[] | null;
  visionAnalysis?: VisionAnalysisData | null;
  keywordPoolRows?: any[];
}): SeoEvaluationResult {
  const title = (params.title || '').trim();
  const description = (params.description || '').trim();
  const rawTags = (params.tags || []).map(t => String(t).trim()).filter(Boolean);
  const vision = params.visionAnalysis || {};
  const poolRows = params.keywordPoolRows || [];

  const issues: SeoIssue[] = [];
  const strengths: string[] = [];

  // Map keyword pool for fast lookup
  const poolMap = new Map<string, KeywordPoolMetric>();
  for (const row of poolRows) {
    if (row.keyword) {
      const lastEval = row.last_evaluated_at || row.lastEvaluatedAt;
      const isFresh = Boolean(
        lastEval && (Date.now() - new Date(lastEval).getTime() <= 7 * 24 * 60 * 60 * 1000)
      );

      poolMap.set(row.keyword.toLowerCase().trim(), {
        keyword: row.keyword,
        opportunityScore: Number(row.opportunity_score || row.etsy_score || 0),
        totalListings: Number(row.total_listings || row.totalListings || 0),
        competitionLevel: row.competition_level || row.competitionLevel || 'Bilinmiyor',
        bestsellerCount: Number(row.bestseller_count || row.bestsellerCount || 0),
        isEtsySuggested: Boolean(row.is_etsy_suggested || row.isEtsySuggested),
        lastEvaluatedAt: lastEval,
        isFresh,
      });
    }
  }

  // ==========================================
  // 1. TAGS & KEYWORD POOL EVALUATION (Max 40 Points)
  // ==========================================
  let tagsScore = 0;
  const tagCount = rawTags.length;

  // A. Tag Count (Max 15 pts)
  if (tagCount === 13) {
    tagsScore += 15;
    strengths.push('Etsy 13 etiket limitinin tamamı (13/13) eksiksiz kullanılmış.');
  } else if (tagCount >= 10) {
    tagsScore += 10;
    issues.push({
      severity: 'warning',
      field: 'tags',
      message: `${13 - tagCount} adet etiket eksik (${tagCount}/13).`,
      fixSuggestion: 'Etsy arama görünürlüğünüzü maksimize etmek için tam 13 etiket kullanın.'
    });
  } else if (tagCount >= 5) {
    tagsScore += 5;
    issues.push({
      severity: 'critical',
      field: 'tags',
      message: `Çok az etiket kullanılmış (${tagCount}/13).`,
      fixSuggestion: 'En az 13 adet niş ve aranma hacmi yüksek etiket ekleyin.'
    });
  } else {
    tagsScore += 0;
    issues.push({
      severity: 'critical',
      field: 'tags',
      message: 'Neredeyse hiç etiket bulunmuyor!',
      fixSuggestion: '13 adet etiket ekleyerek listelemenizi hemen güçlendirin.'
    });
  }

  // B. Tag Character Length & Long-Tail Usage (Max 10 pts)
  let validLengthCount = 0;
  let overLengthCount = 0;

  const tagBreakdown: TagMetricBreakdown[] = [];
  const matchedPoolKeywords: KeywordPoolMetric[] = [];
  let totalOppScore = 0;
  let scoredTagCount = 0;

  for (const tag of rawTags) {
    const cleanTag = tag.trim();
    const lower = cleanTag.toLowerCase();
    const len = cleanTag.length;
    const isValidLength = len <= 20;
    const isMultiWord = cleanTag.includes(' ') || cleanTag.includes('-');

    if (isValidLength) {
      validLengthCount++;
    } else {
      overLengthCount++;
    }

    const poolItem = poolMap.get(lower);
    const inPool = Boolean(poolItem);
    const opportunityScore = poolItem?.opportunityScore || 0;
    const totalListings = poolItem?.totalListings;
    const competitionLevel = poolItem?.competitionLevel;
    const bestsellerCount = poolItem?.bestsellerCount;
    const isEtsySuggested = poolItem?.isEtsySuggested;
    const isFresh = poolItem?.isFresh;

    let status: TagMetricBreakdown['status'] = 'average';
    if (!isValidLength) {
      status = 'invalid';
    } else if (opportunityScore >= 75) {
      status = 'excellent';
    } else if (opportunityScore >= 55) {
      status = 'good';
    } else if (opportunityScore > 0 && opportunityScore < 40) {
      status = 'poor';
    } else if (!inPool) {
      status = 'average';
    }

    if (inPool && opportunityScore > 0) {
      matchedPoolKeywords.push(poolItem!);
      totalOppScore += opportunityScore;
      scoredTagCount++;
    }

    tagBreakdown.push({
      keyword: cleanTag,
      charLength: len,
      isValidLength,
      isMultiWord,
      opportunityScore,
      totalListings,
      competitionLevel,
      bestsellerCount,
      isEtsySuggested,
      inPool,
      isFresh,
      status,
    });
  }

  if (overLengthCount > 0) {
    issues.push({
      severity: 'critical',
      field: 'tags',
      message: `${overLengthCount} adet etiket 20 karakter sınırını aşıyor.`,
      fixSuggestion: 'Etsy 20 karakterden uzun etiketleri reddeder. 20 karaktere kısaltın.'
    });
  }

  if (tagCount > 0) {
    const longTailCount = tagBreakdown.filter(t => t.isMultiWord && t.isValidLength).length;
    const longTailRatio = longTailCount / tagCount;
    if (longTailRatio >= 0.7) {
      tagsScore += 10;
      strengths.push('Etiketlerin çoğu yüksek dönüşümlü çok kelimeli (long-tail) öbeklerden oluşuyor.');
    } else if (longTailRatio >= 0.4) {
      tagsScore += 6;
      issues.push({
        severity: 'tip',
        field: 'tags',
        message: 'Etiketlerinizde daha fazla çok kelimeli (long-tail) kalıp kullanabilirsiniz.',
        fixSuggestion: 'Tek kelimelik jenerik etiketler yerine 14-20 karakterlik spesifik alıcı öbekleri tercih edin.'
      });
    } else {
      tagsScore += 3;
      issues.push({
        severity: 'warning',
        field: 'tags',
        message: 'Etiketlerin çoğu çok kısa veya tek kelimelik.',
        fixSuggestion: 'Daha spesifik niş kelime öbekleri kullanın (Örn: "shirt" yerine "retro cat shirt").'
      });
    }
  }

  // C. Keyword Pool Opportunity Quality (Max 15 pts)
  if (scoredTagCount > 0) {
    const avgOpp = totalOppScore / scoredTagCount;
    const highOppCount = matchedPoolKeywords.filter(m => m.opportunityScore >= 70).length;

    if (avgOpp >= 75 || highOppCount >= 6) {
      tagsScore += 15;
      strengths.push(`Kelime havuzundaki yüksek fırsat puanlı ${highOppCount} kelime doğrudan etiketlerde kullanılmış (Ort. Fırsat: ${Math.round(avgOpp)}).`);
    } else if (avgOpp >= 60 || highOppCount >= 3) {
      tagsScore += 12;
      strengths.push(`Etiketler kelime havuzu ile uyumlu ve iyi fırsat puanlarına sahip (Ort. Fırsat: ${Math.round(avgOpp)}).`);
    } else if (avgOpp >= 45) {
      tagsScore += 8;
      issues.push({
        severity: 'tip',
        field: 'tags',
        message: 'Kelime havuzundaki yüksek fırsat puanlı kelimelerden daha fazla ekleyebilirsiniz.',
        fixSuggestion: 'Havuzda 70+ fırsat puanına sahip anahtar kelimeleri etiketlere dahil edin.'
      });
    } else {
      tagsScore += 4;
      issues.push({
        severity: 'warning',
        field: 'tags',
        message: 'Etiketlerin ortalama fırsat puanı düşük veya yüksek rekabetli.',
        fixSuggestion: 'Daha az rekabetli ve yüksek talep gören altın niş kelimeleri tercih edin.'
      });
    }
  } else if (tagCount > 0) {
    // Unscored tags in pool
    tagsScore += 7;
    issues.push({
      severity: 'tip',
      field: 'tags',
      message: 'Etiketler henüz kelime havuzunda taranmamış veya puanlanmamış.',
      fixSuggestion: '"Etiketleri Havuzda Güncelle" butonuna tıklayarak etiketlerin güncel fırsat puanlarını taratın.'
    });
  }

  // ==========================================
  // 2. TITLE EVALUATION (Max 35 Points)
  // ==========================================
  let titleScore = 0;
  const titleLen = title.length;

  // A. Title Length (Max 12 pts)
  if (titleLen >= 110 && titleLen <= 140) {
    titleScore += 12;
    strengths.push(`Başlık uzunluğu ideal Etsy standardında (${titleLen}/140 karakter).`);
  } else if (titleLen >= 80 && titleLen < 110) {
    titleScore += 9;
    issues.push({
      severity: 'tip',
      field: 'title',
      message: `Başlık biraz daha zenginleştirilebilir (${titleLen}/140 karakter).`,
      fixSuggestion: '110-140 karakter aralığında tamamlayıcı niş kelimeler ve ürün tipi ekleyin.'
    });
  } else if (titleLen > 140) {
    titleScore += 4;
    issues.push({
      severity: 'warning',
      field: 'title',
      message: `Başlık 140 karakter Etsy sınırını aşıyor (${titleLen} karakter).`,
      fixSuggestion: 'Başlığı 140 karakterin altına indirin.'
    });
  } else if (titleLen >= 40) {
    titleScore += 5;
    issues.push({
      severity: 'warning',
      field: 'title',
      message: `Başlık çok kısa (${titleLen} karakter).`,
      fixSuggestion: 'Ürününüzün konusunu, stilini, alıcı kitlesini ve hediyelik özelliklerini başlığa ekleyin.'
    });
  } else {
    titleScore += 1;
    issues.push({
      severity: 'critical',
      field: 'title',
      message: 'Başlık çok yetersiz veya boş!',
      fixSuggestion: '120-140 karakterlik açıklayıcı ve arama odaklı bir başlık girin.'
    });
  }

  // B. Frontloading in first 40 characters (Max 10 pts)
  const first40 = title.slice(0, 40).toLowerCase();
  const hasGenericStart = first40.startsWith('custom') || first40.startsWith('unisex') || first40.startsWith('best');
  
  if (titleLen >= 40) {
    if (!hasGenericStart && (first40.includes('shirt') || first40.includes('sweatshirt') || first40.includes('gift') || first40.includes('tee') || first40.includes('hoodie') || first40.includes('vintage') || first40.includes('retro') || first40.includes('mug') || first40.includes('poster'))) {
      titleScore += 10;
      strengths.push('Başlığın ilk 40 karakterinde mobil aramalarda hemen görünen ana niyet kelimeleri öne çıkarılmış.');
    } else {
      titleScore += 6;
      issues.push({
        severity: 'tip',
        field: 'title',
        message: 'İlk 40 karakter mobilde kesilmeden önce en önemli arama terimlerini içermelidir.',
        fixSuggestion: 'En çok aranan anahtar kelimenizi başlığın ilk 3 kelimesi olarak konumlandırın.'
      });
    }
  } else {
    titleScore += 2;
  }

  // C. Title & Tag Match Ratio (Max 8 pts)
  let matchingTagCount = 0;
  const lowerTitle = title.toLowerCase();
  for (const tag of rawTags) {
    const cleanTag = tag.toLowerCase().trim();
    if (cleanTag.length > 3 && lowerTitle.includes(cleanTag)) {
      matchingTagCount++;
    }
  }

  if (matchingTagCount >= 4) {
    titleScore += 8;
    strengths.push(`${matchingTagCount} adet etiket başlık ile birebir eşleşiyor (Etsy algoritması için güçlü eşleşme sinyali).`);
  } else if (matchingTagCount >= 2) {
    titleScore += 6;
    strengths.push(`${matchingTagCount} adet etiket başlıkla uyumlu.`);
  } else if (matchingTagCount === 1) {
    titleScore += 4;
    issues.push({
      severity: 'tip',
      field: 'title',
      message: 'Başlık ile etiketler arasında daha fazla anahtar kelime eşleşmesi sağlayın.',
      fixSuggestion: 'En önemli 3-4 etiketinizi başlıktaki ana öbeklerle aynı yapın.'
    });
  } else {
    titleScore += 1;
    issues.push({
      severity: 'warning',
      field: 'title',
      message: 'Başlık kelimeleri ile etiketler neredeyse hiç eşleşmiyor.',
      fixSuggestion: 'Etsy algoritması başlıkta ve etikette aynı anda geçen terimlere en yüksek arama alaka puanını verir.'
    });
  }

  // D. Readability & Formatting (Max 5 pts)
  const isAllUpper = titleLen > 20 && title === title.toUpperCase();
  const delimiterCount = (title.match(/[|,•-]/g) || []).length;

  if (isAllUpper) {
    issues.push({
      severity: 'warning',
      field: 'title',
      message: 'Başlık tamamen BÜYÜK HARFLERLE yazılmış.',
      fixSuggestion: 'Etsy kurallarına göre Title Case (Her Kelimenin İlk Harfi Büyük) formatını kullanın.'
    });
    titleScore += 1;
  } else if (delimiterCount >= 1 && delimiterCount <= 6) {
    titleScore += 5;
    strengths.push('Başlıkta temiz ve okunabilir ayrım işaretleri (| veya ,) kullanılmış.');
  } else {
    titleScore += 3;
  }

  // ==========================================
  // 3. DESCRIPTION & STRUCTURE EVALUATION (Max 25 Points)
  // ==========================================
  let descriptionScore = 0;
  const descLen = description.length;
  const lowerDesc = description.toLowerCase();

  // A. Opening 160 chars Hook (Max 8 pts)
  const first160 = description.slice(0, 160).toLowerCase();
  if (descLen >= 160 && (first160.includes('shirt') || first160.includes('gift') || first160.includes('hoodie') || first160.includes('quality') || first160.includes('cotton') || first160.includes('handmade') || first160.includes('printed') || first160.includes('designed'))) {
    descriptionScore += 8;
    strengths.push('Açıklamanın ilk 160 karakteri Google ve Etsy arama snippet önizlemesi için zenginleştirilmiş.');
  } else if (descLen >= 50) {
    descriptionScore += 5;
  } else {
    descriptionScore += 2;
    issues.push({
      severity: 'warning',
      field: 'description',
      message: 'Açıklama girişi arama motoru önizlemesi için çok zayıf.',
      fixSuggestion: 'İlk 2 cümlede ürünün ne olduğunu ve ana arama kelimelerini geçirin.'
    });
  }

  // B. Structure, Care & Sizing Sections (Max 10 pts)
  const hasSizing = lowerDesc.includes('size') || lowerDesc.includes('sizing') || lowerDesc.includes('ölçü') || lowerDesc.includes('beden');
  const hasCare = lowerDesc.includes('wash') || lowerDesc.includes('care') || lowerDesc.includes('yıkama') || lowerDesc.includes('bakım');
  const hasMaterial = lowerDesc.includes('cotton') || lowerDesc.includes('fabric') || lowerDesc.includes('material') || lowerDesc.includes('kumaş');

  const sectionCount = (hasSizing ? 1 : 0) + (hasCare ? 1 : 0) + (hasMaterial ? 1 : 0);
  if (sectionCount >= 2) {
    descriptionScore += 10;
    strengths.push('Açıklamada beden tablosu, kumaş özellikleri ve yıkama talimatları detaylandırılmış.');
  } else if (sectionCount === 1) {
    descriptionScore += 6;
    issues.push({
      severity: 'tip',
      field: 'description',
      message: 'Açıklamaya beden ölçüleri veya yıkama/bakım talimatları ekleyebilirsiniz.',
      fixSuggestion: 'Alıcıların iadelerini önlemek için beden tablosu ve kumaş detaylarını listeleyin.'
    });
  } else {
    descriptionScore += 3;
    issues.push({
      severity: 'warning',
      field: 'description',
      message: 'Açıklama şablonunda ürün detayları (kumaş, beden, kargo) eksik.',
      fixSuggestion: 'Müşteri güvenini artırmak için madde madde ürün özellikleri ekleyin.'
    });
  }

  // C. Length & Depth (Max 7 pts)
  if (descLen >= 500) {
    descriptionScore += 7;
  } else if (descLen >= 250) {
    descriptionScore += 5;
  } else {
    descriptionScore += 2;
    issues.push({
      severity: 'critical',
      field: 'description',
      message: 'Açıklama çok kısa.',
      fixSuggestion: 'En az 400-600 karakterlik profesyonel bir açıklama metni hazırlayın.'
    });
  }

  // ==========================================
  // CALCULATE TOTAL & GRADE (Direct Mathematical Formula)
  // ==========================================
  const totalScore = Math.min(100, Math.max(0, Math.round(tagsScore + titleScore + descriptionScore)));

  let grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F' = 'F';
  if (totalScore >= 90) grade = 'A+';
  else if (totalScore >= 80) grade = 'A';
  else if (totalScore >= 70) grade = 'B';
  else if (totalScore >= 55) grade = 'C';
  else if (totalScore >= 40) grade = 'D';
  else grade = 'F';

  // Find missing high-opportunity keywords from pool
  const missingPoolKeywords: KeywordPoolMetric[] = [];
  const existingTagsSet = new Set(rawTags.map(t => t.toLowerCase().trim()));

  for (const poolItem of Array.from(poolMap.values())) {
    if (poolItem.opportunityScore >= 65 && !existingTagsSet.has(poolItem.keyword.toLowerCase().trim())) {
      missingPoolKeywords.push(poolItem);
    }
  }
  missingPoolKeywords.sort((a, b) => b.opportunityScore - a.opportunityScore);

  return {
    score: totalScore,
    grade,
    breakdown: {
      titleScore,
      tagsScore,
      descriptionScore,
      maxTitle: 35,
      maxTags: 40,
      maxDesc: 25,
    },
    tagBreakdown,
    strengths,
    issues,
    matchedPoolKeywords,
    missingPoolKeywords: missingPoolKeywords.slice(0, 10),
    evaluatedAt: new Date().toISOString(),
  };
}
