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
  bestsellerCount?: number;
  isEtsySuggested?: boolean;
}

export interface SeoEvaluationResult {
  score: number;
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  breakdown: {
    titleScore: number;
    tagsScore: number;
    descriptionScore: number;
    consistencyScore: number;
    maxTitle: number;
    maxTags: number;
    maxDesc: number;
    maxConsistency: number;
  };
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
      poolMap.set(row.keyword.toLowerCase().trim(), {
        keyword: row.keyword,
        opportunityScore: Number(row.opportunity_score || row.etsy_score || 0),
        totalListings: Number(row.total_listings || 0),
        bestsellerCount: Number(row.bestseller_count || 0),
        isEtsySuggested: Boolean(row.is_etsy_suggested),
      });
    }
  }

  // ==========================================
  // 1. TAGS EVALUATION (Max 35 Points)
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
  let singleWordCount = 0;
  let overLengthCount = 0;

  for (const tag of rawTags) {
    const len = tag.length;
    if (len > 20) {
      overLengthCount++;
    } else if (len >= 10) {
      validLengthCount++;
    }

    if (!tag.includes(' ') && !tag.includes('-')) {
      singleWordCount++;
    }
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
    const longTailRatio = validLengthCount / tagCount;
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

  // C. Keyword Pool Match & Opportunity (Max 10 pts)
  const matchedPoolKeywords: KeywordPoolMetric[] = [];
  let totalOppScore = 0;

  for (const tag of rawTags) {
    const cleanTag = tag.toLowerCase().trim();
    if (poolMap.has(cleanTag)) {
      const metric = poolMap.get(cleanTag)!;
      matchedPoolKeywords.push(metric);
      totalOppScore += metric.opportunityScore;
    }
  }

  if (matchedPoolKeywords.length >= 5) {
    const avgOpp = totalOppScore / matchedPoolKeywords.length;
    if (avgOpp >= 65) {
      tagsScore += 10;
      strengths.push(`Kelime havuzundaki yüksek fırsat puanlı ${matchedPoolKeywords.length} kelime doğrudan etiketlerde kullanılmış.`);
    } else {
      tagsScore += 7;
    }
  } else if (matchedPoolKeywords.length >= 2) {
    tagsScore += 5;
    issues.push({
      severity: 'tip',
      field: 'tags',
      message: 'Kelime havuzundaki yüksek fırsat puanlı kelimelerden daha fazla ekleyebilirsiniz.',
      fixSuggestion: 'Havuzda 70+ fırsat puanına sahip anahtar kelimeleri etiketlere dahil edin.'
    });
  } else {
    tagsScore += 2;
  }

  // ==========================================
  // 2. TITLE EVALUATION (Max 35 Points)
  // ==========================================
  let titleScore = 0;
  const titleLen = title.length;

  // A. Title Length (Max 10 pts)
  if (titleLen >= 100 && titleLen <= 140) {
    titleScore += 10;
    strengths.push(`Başlık uzunluğu ideal Etsy standardında (${titleLen}/140 karakter).`);
  } else if (titleLen >= 70 && titleLen < 100) {
    titleScore += 7;
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
  } else if (titleLen >= 30) {
    titleScore += 4;
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
    if (!hasGenericStart && (first40.includes('shirt') || first40.includes('sweatshirt') || first40.includes('gift') || first40.includes('tee') || first40.includes('hoodie') || first40.includes('vintage') || first40.includes('retro'))) {
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

  // C. Title & Tag Match Ratio (Max 10 pts)
  let matchingTagCount = 0;
  const lowerTitle = title.toLowerCase();
  for (const tag of rawTags) {
    const cleanTag = tag.toLowerCase().trim();
    if (cleanTag.length > 3 && lowerTitle.includes(cleanTag)) {
      matchingTagCount++;
    }
  }

  if (matchingTagCount >= 4) {
    titleScore += 10;
    strengths.push(`${matchingTagCount} adet etiket başlık ile birebir eşleşiyor (Etsy Algoritması için süper eşleşme bonusu).`);
  } else if (matchingTagCount >= 2) {
    titleScore += 7;
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
      fixSuggestion: 'Etsy algoritması başlıkta ve etikette aynı anda geçen terimlere en yüksek arama puanını verir.'
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
  // 3. DESCRIPTION EVALUATION (Max 15 Points)
  // ==========================================
  let descriptionScore = 0;
  const descLen = description.length;
  const lowerDesc = description.toLowerCase();

  // A. Opening 160 chars Hook (Max 5 pts)
  const first160 = description.slice(0, 160).toLowerCase();
  if (descLen >= 160 && (first160.includes('shirt') || first160.includes('gift') || first160.includes('hoodie') || first160.includes('quality') || first160.includes('cotton') || first160.includes('handmade') || first160.includes('printed'))) {
    descriptionScore += 5;
    strengths.push('Açıklamanın ilk 160 karakteri Google ve Etsy arama snippet önizlemesi için zenginleştirilmiş.');
  } else if (descLen >= 50) {
    descriptionScore += 3;
  } else {
    descriptionScore += 1;
    issues.push({
      severity: 'warning',
      field: 'description',
      message: 'Açıklama girişi arama motoru önizlemesi için çok zayıf.',
      fixSuggestion: 'İlk 2 cümlede ürünün ne olduğunu ve ana arama kelimelerini geçirin.'
    });
  }

  // B. Structure, Care & Sizing Sections (Max 5 pts)
  const hasSizing = lowerDesc.includes('size') || lowerDesc.includes('sizing') || lowerDesc.includes('ölçü') || lowerDesc.includes('beden');
  const hasCare = lowerDesc.includes('wash') || lowerDesc.includes('care') || lowerDesc.includes('yıkama') || lowerDesc.includes('bakım');
  const hasMaterial = lowerDesc.includes('cotton') || lowerDesc.includes('fabric') || lowerDesc.includes('material') || lowerDesc.includes('kumaş');

  const sectionCount = (hasSizing ? 1 : 0) + (hasCare ? 1 : 0) + (hasMaterial ? 1 : 0);
  if (sectionCount >= 2) {
    descriptionScore += 5;
    strengths.push('Açıklamada beden tablosu, kumaş özellikleri ve yıkama talimatları detaylandırılmış.');
  } else if (sectionCount === 1) {
    descriptionScore += 3;
    issues.push({
      severity: 'tip',
      field: 'description',
      message: 'Açıklamaya beden ölçüleri veya yıkama/bakım talimatları ekleyebilirsiniz.',
      fixSuggestion: 'Alıcıların iadelerini önlemek için beden tablosu ve kumaş detaylarını listeleyin.'
    });
  } else {
    descriptionScore += 1;
    issues.push({
      severity: 'warning',
      field: 'description',
      message: 'Açıklama şablonunda ürün detayları (kumaş, beden, kargo) eksik.',
      fixSuggestion: 'Müşteri güvenini artırmak için madde madde ürün özellikleri ekleyin.'
    });
  }

  // C. Length (Max 5 pts)
  if (descLen >= 500) {
    descriptionScore += 5;
  } else if (descLen >= 200) {
    descriptionScore += 3;
  } else {
    descriptionScore += 1;
    issues.push({
      severity: 'critical',
      field: 'description',
      message: 'Açıklama çok kısa.',
      fixSuggestion: 'En az 400-600 karakterlik profesyonel bir açıklama metni hazırlayın.'
    });
  }

  // ==========================================
  // 4. VISUAL & SEO CONSISTENCY (Max 15 Points)
  // ==========================================
  let consistencyScore = 0;

  if (vision && (vision.primarySubject || vision.primaryAesthetic || (vision.detectedColors && vision.detectedColors.length > 0) || (vision.keywords && vision.keywords.length > 0))) {
    let matchedVisualTerms = 0;
    const allListingText = `${lowerTitle} ${rawTags.join(' ').toLowerCase()}`;

    if (vision.primarySubject && allListingText.includes(vision.primarySubject.toLowerCase().trim())) {
      matchedVisualTerms += 2;
    }
    if (vision.primaryAesthetic && allListingText.includes(vision.primaryAesthetic.toLowerCase().trim())) {
      matchedVisualTerms += 2;
    }
    if (vision.detectedColors && Array.isArray(vision.detectedColors)) {
      for (const color of vision.detectedColors) {
        if (allListingText.includes(String(color).toLowerCase())) {
          matchedVisualTerms += 1;
          break;
        }
      }
    }
    if (vision.keywords && Array.isArray(vision.keywords)) {
      for (const vkw of vision.keywords) {
        if (allListingText.includes(String(vkw).toLowerCase())) {
          matchedVisualTerms += 1;
        }
      }
    }

    if (matchedVisualTerms >= 3) {
      consistencyScore = 15;
      strengths.push('Kapak görselinde tespit edilen tasarım teması, renkleri ve estetiği başlık ve etiketlerle kusursuz uyumlu.');
    } else if (matchedVisualTerms >= 1) {
      consistencyScore = 10;
      issues.push({
        severity: 'tip',
        field: 'vision',
        message: 'Görselde tespit edilen bazı estetik ve konu detayları başlıklarda tam yer almıyor.',
        fixSuggestion: `Görseldeki "${vision.primarySubject || vision.primaryAesthetic || 'tasarım özellikleri'}" temasını başlıklara ekleyin.`
      });
    } else {
      consistencyScore = 6;
      issues.push({
        severity: 'warning',
        field: 'vision',
        message: 'Görsel analizi ile mevcut SEO başlık/etiketleri arasında tutarsızlık var.',
        fixSuggestion: 'Görseldeki asıl konuyu ve renk paletini SEO metnine dahil edin.'
      });
    }
  } else {
    // Vision not run yet: provide default partial score and call to action
    consistencyScore = 10;
    issues.push({
      severity: 'tip',
      field: 'vision',
      message: 'Bu ilan için henüz Görsel (Vision AI) analizi yapılmamış.',
      fixSuggestion: '"Görseli Analiz Et" butonuna tıklayarak kapak resmini analiz ettirin ve SEO puanınızı artırın.'
    });
  }

  // ==========================================
  // CALCULATE TOTAL & GRADE
  // ==========================================
  const totalScore = Math.min(100, Math.max(0, Math.round(tagsScore + titleScore + descriptionScore + consistencyScore)));

  let grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F' = 'F';
  if (totalScore >= 92) grade = 'A+';
  else if (totalScore >= 82) grade = 'A';
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
      consistencyScore,
      maxTitle: 35,
      maxTags: 35,
      maxDesc: 15,
      maxConsistency: 15,
    },
    strengths,
    issues,
    matchedPoolKeywords,
    missingPoolKeywords: missingPoolKeywords.slice(0, 10),
    evaluatedAt: new Date().toISOString(),
  };
}
