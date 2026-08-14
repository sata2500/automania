export interface ClientScrapeResult {
  id: string;
  keyword: string;
  charLength: number;
  tagEligible: boolean;
  totalListings: number;
  competitionLevel: string;
  bestsellerCount: number;
  isEtsySuggested: boolean;
  autocompleteRank: number;
  opportunityScore: number;
  avgPrice: number;
  scrapeError: string | null;
  rawMetrics?: any;
}

export async function scrapeEtsyFromBrowser(id: string, keyword: string): Promise<ClientScrapeResult> {
  const cleanKeyword = keyword.trim().toLowerCase();
  const charLength = cleanKeyword.length;
  const tagEligible = charLength <= 20;

  try {
    const proxyRes = await fetch(`/api/admin/keywords/proxy-fetch?q=${encodeURIComponent(cleanKeyword)}`);
    const proxyData = await proxyRes.json();

    if (proxyData.success && proxyData.data) {
      const d = proxyData.data;
      return {
        id,
        keyword: cleanKeyword,
        charLength,
        tagEligible,
        totalListings: d.totalListings || 0,
        competitionLevel: d.competitionLevel || 'Bilinmiyor',
        bestsellerCount: d.bestsellerCount || 0,
        isEtsySuggested: !!d.isEtsySuggested,
        autocompleteRank: d.autocompleteRank || 0,
        opportunityScore: d.opportunityScore || 0,
        avgPrice: d.avgPrice || 0,
        scrapeError: d.scrapeError || null,
        rawMetrics: d.rawMetrics || { method: proxyData.method }
      };
    } else {
      const errorMsg = proxyData.error || 'Etsy Bot Koruması Engeli (HTTP 403)';
      return {
        id,
        keyword: cleanKeyword,
        charLength,
        tagEligible,
        totalListings: 0,
        competitionLevel: 'Engellendi / Hata',
        bestsellerCount: 0,
        isEtsySuggested: false,
        autocompleteRank: 0,
        opportunityScore: 0,
        avgPrice: 0,
        scrapeError: errorMsg,
        rawMetrics: { method: 'error', error: errorMsg }
      };
    }
  } catch (e: any) {
    const errorMsg = `Kazıma Bağlantı Hatası: ${e.message}`;
    return {
      id,
      keyword: cleanKeyword,
      charLength,
      tagEligible,
      totalListings: 0,
      competitionLevel: 'Engellendi / Hata',
      bestsellerCount: 0,
      isEtsySuggested: false,
      autocompleteRank: 0,
      opportunityScore: 0,
      avgPrice: 0,
      scrapeError: errorMsg,
      rawMetrics: { method: 'error', error: errorMsg }
    };
  }
}
