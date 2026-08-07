import React, { useState, useEffect } from 'react';
import { RefreshCw, Trash2, Search, Download, CheckSquare, Square, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle, Tag, Trophy } from 'lucide-react';
import { useToast } from '@/components/common/ToastContext';

interface Keyword {
  id: string;
  keyword: string;
  usage_count: number;
  etsy_score: number | null;
  opportunity_score: number | null;
  total_listings: number | null;
  competition_level: string | null;
  bestseller_count: number | null;
  is_etsy_suggested: boolean | null;
  autocomplete_rank: number | null;
  char_length: number | null;
  tag_eligible: boolean | null;
  avg_price: number | null;
  last_scrape_error: string | null;
  created_at: string;
  last_evaluated_at: string | null;
}

export default function KeywordPoolManagement() {
  const toast = useToast();
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'tag_eligible' | 'gold' | 'error'>('all');
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState('created_at');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const limit = 50;

  useEffect(() => {
    fetchKeywords();
  }, [page, sortBy, order, search, filter]);

  const fetchKeywords = async () => {
    setIsLoading(true);
    try {
      const offset = page * limit;
      const query = new URLSearchParams({
        search,
        filter,
        sortBy,
        order,
        limit: limit.toString(),
        offset: offset.toString()
      });
      const res = await fetch(`/api/admin/keywords?${query}`);
      const data = await res.json();
      if (data.success) {
        setKeywords(data.keywords);
        setTotal(data.total);
      }
    } catch (e) {
      toast.error('Kelimeler yüklenirken hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === keywords.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(keywords.map(k => k.id)));
    }
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`${selectedIds.size} adet kelimeyi silmek istediğinize emin misiniz?`)) return;

    try {
      const res = await fetch('/api/admin/keywords', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${selectedIds.size} kelime silindi.`);
        setSelectedIds(new Set());
        fetchKeywords();
      } else {
        toast.error(data.error || 'Silme işlemi başarısız.');
      }
    } catch (e) {
      toast.error('Hata oluştu.');
    }
  };

  const handleEvaluateBatch = async () => {
    if (isEvaluating) return;
    setIsEvaluating(true);
    try {
      const payload = selectedIds.size > 0 
        ? { ids: Array.from(selectedIds) } 
        : { limit: 20 };

      const res = await fetch('/api/admin/keywords/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (data.success) {
        if (data.evaluatedCount > 0) {
          toast.success(`${data.evaluatedCount} kelime canlı Etsy verisi ile taranıp puanlandı!`);
          if (data.warning) {
            toast.error(data.warning);
          }
          setSelectedIds(new Set());
          fetchKeywords();
        } else {
          toast.info('Değerlendirilecek eskimiş kelime bulunamadı.');
        }
      } else {
        toast.error(data.error || 'Değerlendirme başarısız.');
      }
    } catch (e) {
      toast.error('Canlı Etsy verisi çekilirken hata oluştu.');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleExportCSV = async () => {
    if (total === 0) return;
    
    try {
      const res = await fetch(`/api/admin/keywords?filter=${filter}&limit=100000`);
      const data = await res.json();
      
      if (!data.success) throw new Error();
      
      const allKeywords = data.keywords;
      
      const headers = ['Keyword', 'Length', 'Tag Eligible (<=20)', 'Usage Count', 'Opportunity Score', 'Total Listings', 'Competition Level', 'Bestseller Count', 'Etsy Suggested', 'Avg Price', 'Bot Error', 'Last Evaluated'];
      const rows = allKeywords.map((k: Keyword) => [
        `"${k.keyword.replace(/"/g, '""')}"`,
        k.keyword.length,
        k.keyword.length <= 20 ? 'EVET' : 'HAYIR',
        k.usage_count,
        k.opportunity_score ?? k.etsy_score ?? 0,
        k.total_listings || 0,
        `"${k.competition_level || 'Bilinmiyor'}"`,
        k.bestseller_count || 0,
        k.is_etsy_suggested ? 'EVET' : 'HAYIR',
        k.avg_price || 0,
        `"${(k.last_scrape_error || '').replace(/"/g, '""')}"`,
        k.last_evaluated_at ? new Date(k.last_evaluated_at).toISOString() : ''
      ]);
      
      const csvContent = [headers.join(','), ...rows.map((r: any[]) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `etsy_keyword_pool_${new Date().toISOString().slice(0,10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      
      toast.success('Tüm gerçek Etsy verileri CSV olarak indirildi!');
    } catch (e) {
      toast.error('CSV dışa aktarılırken bir hata oluştu.');
    }
  };

  const getScoreBadge = (score: number | null) => {
    if (score === null || score === 0) {
      return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">Henüz Yok</span>;
    }
    if (score >= 80) return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-300">🔥 {score}</span>;
    if (score >= 50) return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-300">{score}</span>;
    return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-300">{score}</span>;
  };

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setOrder('desc');
    }
  };

  const [isBrowserScraping, setIsBrowserScraping] = useState(false);
  const [scrapeProgress, setScrapeProgress] = useState({ current: 0, total: 0 });
  const [testKeyword, setTestKeyword] = useState('vintage shirt');
  const [testResult, setTestResult] = useState<any>(null);
  const [isTestingScraper, setIsTestingScraper] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);

  const handleBrowserScrape = async () => {
    if (isBrowserScraping) return;
    const targetList = selectedIds.size > 0 
      ? keywords.filter(k => selectedIds.has(k.id)) 
      : keywords.slice(0, 20);

    if (targetList.length === 0) {
      toast.info('Kazınacak kelime bulunamadı.');
      return;
    }

    setIsBrowserScraping(true);
    setScrapeProgress({ current: 0, total: targetList.length });
    const scrapedResults = [];

    try {
      const { scrapeEtsyFromBrowser } = await import('@/lib/client-etsy-scraper');

      for (let i = 0; i < targetList.length; i++) {
        const item = targetList[i];
        setScrapeProgress({ current: i + 1, total: targetList.length });
        try {
          const res = await scrapeEtsyFromBrowser(item.id, item.keyword);
          scrapedResults.push(res);
          await new Promise(resolve => setTimeout(resolve, 250));
        } catch (e) {
          console.warn(`Browser scrape error for ${item.keyword}:`, e);
        }
      }

      if (scrapedResults.length > 0) {
        const res = await fetch('/api/admin/keywords/bulk-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ results: scrapedResults })
        });
        const data = await res.json();
        if (data.success) {
          toast.success(`Tarayıcınız üzerinden ${data.updatedCount} kelime canlı verilerle güncellendi!`);
          setSelectedIds(new Set());
          fetchKeywords();
        }
      }
    } catch (e) {
      toast.error('İstemci kazıma işlemi sırasında hata oluştu.');
    } finally {
      setIsBrowserScraping(false);
    }
  };

  const [testMode, setTestMode] = useState<'browser' | 'server'>('browser');

  const handleTestScraper = async () => {
    if (!testKeyword) return;
    setIsTestingScraper(true);
    setTestResult(null);
    try {
      if (testMode === 'browser') {
        const { scrapeEtsyFromBrowser } = await import('@/lib/client-etsy-scraper');
        const res = await scrapeEtsyFromBrowser('test-browser-id', testKeyword);
        setTestResult({
          success: !res.scrapeError,
          mode: 'İstemci Tarayıcı Kazıması (Client-Side Chrome)',
          result: res,
          diagnostics: {
            testedKeyword: testKeyword,
            executedFrom: 'Browser JS Client'
          }
        });
        if (!res.scrapeError) {
          toast.success(`Tarayıcı modunda "${testKeyword}" testi tamamlandı!`);
        } else {
          toast.error(res.scrapeError || 'Tarayıcı testinde hata alındı.');
        }
      } else {
        const res = await fetch('/api/admin/keywords/test-scraper', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword: testKeyword })
        });
        const data = await res.json();
        setTestResult(data);
        if (data.success) {
          toast.success(`Sunucu modunda "${testKeyword}" testi tamamlandı!`);
        } else {
          toast.error(data.result?.scrapeError || 'Sunucu testinde engellendi/hata alındı.');
        }
      }
    } catch (e: any) {
      toast.error('Test sırasında hata oluştu: ' + e.message);
    } finally {
      setIsTestingScraper(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
            Kelime Havuzu & Gerçek Zamanlı Etsy Analizi
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Tasarım analizlerinden çekilen kelimelerin canlı Etsy verileriyle (İlan Sayısı, Autocomplete, Bestseller) puanlaması.
          </p>
          <div className="mt-2 text-xs bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 p-2.5 rounded-lg border border-blue-200 dark:border-blue-800 flex items-center justify-between gap-2 flex-wrap">
            <span>💡 <strong>Ücretsiz Hibrit Kazıma:</strong> Admin paneli üzerinden kendi Chrome tarayıcınızla sınırsız veri kazıyabilir veya Cloudflare Worker Proxy kullanabilirsiniz.</span>
            <button 
              onClick={() => setShowTestModal(true)}
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-[11px] flex items-center gap-1 transition-colors"
            >
              🧪 Kazıyıcıyı Test Et
            </button>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={handleBrowserScrape}
            disabled={isBrowserScraping || isEvaluating}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${isBrowserScraping ? 'animate-spin' : ''}`} />
            {isBrowserScraping ? `Tarayıcı Kazıyor (${scrapeProgress.current}/${scrapeProgress.total})` : selectedIds.size > 0 ? `🌐 Tarayıcımdan Kazı (${selectedIds.size})` : '🌐 Tarayıcımdan Kazı (20)'}
          </button>

          <button 
            onClick={handleEvaluateBatch}
            disabled={isEvaluating || isBrowserScraping}
            className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${isEvaluating ? 'animate-spin' : ''}`} />
            {selectedIds.size > 0 ? `Sunucudan Kazı (${selectedIds.size})` : 'Sunucudan Kazı (20)'}
          </button>
          
          <button 
            onClick={handleExportCSV}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            CSV İndir
          </button>
          
          {selectedIds.size > 0 && (
            <button 
              onClick={handleDelete}
              className="px-4 py-2 bg-rose-100 text-rose-600 text-sm font-medium rounded-lg hover:bg-rose-200 transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Sil ({selectedIds.size})
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center bg-slate-100 dark:bg-slate-800/60 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs">
        <button
          onClick={() => { setFilter('all'); setPage(0); }}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${filter === 'all' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
        >
          Tüm Kelimeler
        </button>
        <button
          onClick={() => { setFilter('tag_eligible'); setPage(0); }}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${filter === 'tag_eligible' ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600'}`}
        >
          <Tag className="w-3.5 h-3.5" />
          Sadece ≤20 Karakter (Etsy Etiketi Uyumlu)
        </button>
        <button
          onClick={() => { setFilter('gold'); setPage(0); }}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${filter === 'gold' ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-amber-600'}`}
        >
          <Trophy className="w-3.5 h-3.5" />
          🏆 Altın Nişler (Skor ≥70 &amp; İlan &lt; 5K)
        </button>
        <button
          onClick={() => { setFilter('error'); setPage(0); }}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${filter === 'error' ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-sm font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-rose-600'}`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          ⚠️ Anti-Bot Engeline Takılanlar
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap justify-between items-center gap-4 bg-slate-50 dark:bg-slate-900/50">
          <div className="relative w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Kelime ara..." 
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-slate-700 dark:text-slate-200"
            />
          </div>
          
          <div className="text-sm text-slate-500">
            Filtreye uygun <strong>{total}</strong> kelime
          </div>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
               <tr>
                 <th className="px-2 py-3 sm:p-4 w-8 sm:w-12 text-center cursor-pointer" onClick={handleSelectAll}>
                   {selectedIds.size > 0 && selectedIds.size === keywords.length ? (
                     <CheckSquare className="w-4 h-4 text-emerald-600 mx-auto" />
                   ) : (
                     <Square className="w-4 h-4 mx-auto" />
                   )}
                 </th>
                 <th className="px-2 py-3 sm:p-4 font-medium cursor-pointer hover:text-slate-700" onClick={() => handleSort('keyword')}>Kelime</th>
                 <th className="px-2 py-3 sm:p-4 font-medium cursor-pointer hover:text-slate-700 text-center" onClick={() => handleSort('usage_count')}>Kull.</th>
                 <th className="px-2 py-3 sm:p-4 font-medium cursor-pointer hover:text-slate-700" onClick={() => handleSort('total_listings')}>Etsy İlan Sayısı</th>
                 <th className="px-2 py-3 sm:p-4 font-medium text-center">Autocomplete</th>
                 <th className="px-2 py-3 sm:p-4 font-medium cursor-pointer hover:text-slate-700 text-center" onClick={() => handleSort('bestseller_count')}>Bestsellers</th>
                 <th className="px-2 py-3 sm:p-4 font-medium cursor-pointer hover:text-slate-700 text-center" onClick={() => handleSort('opportunity_score')}>Fırsat Skoru</th>
                 <th className="px-2 py-3 sm:p-4 font-medium cursor-pointer hover:text-slate-700" onClick={() => handleSort('last_evaluated_at')}>Tarama / Durum</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
               {isLoading ? (
                 <tr>
                   <td colSpan={8} className="p-8 text-center text-slate-500">Yükleniyor...</td>
                 </tr>
               ) : keywords.length === 0 ? (
                 <tr>
                   <td colSpan={8} className="p-8 text-center text-slate-500">Aranan kriterlere uygun kelime bulunamadı.</td>
                 </tr>
               ) : (
                 keywords.map((kw) => {
                   const charLen = kw.keyword.length;
                   const isTagOk = charLen <= 20;
                   const oppScore = kw.opportunity_score ?? kw.etsy_score;

                   return (
                     <tr key={kw.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                       <td className="px-2 py-3 sm:p-4 text-center cursor-pointer" onClick={() => handleSelect(kw.id)}>
                         {selectedIds.has(kw.id) ? (
                           <CheckSquare className="w-4 h-4 text-emerald-600 mx-auto" />
                         ) : (
                           <Square className="w-4 h-4 text-slate-300 dark:text-slate-600 mx-auto" />
                         )}
                       </td>
                       <td className="px-2 py-3 sm:p-4 font-medium text-slate-800 dark:text-slate-200">
                         <div className="flex items-center gap-2">
                           <span className="font-semibold">{kw.keyword}</span>
                           <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${isTagOk ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-amber-50 text-amber-600 border border-amber-200'}`}>
                             {charLen}/20
                           </span>
                         </div>
                       </td>
                       <td className="px-2 py-3 sm:p-4 text-center font-mono">{kw.usage_count}</td>
                       <td className="px-2 py-3 sm:p-4">
                         {kw.total_listings ? (
                           <div>
                             <div className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                               {kw.total_listings.toLocaleString()} ilan
                             </div>
                             <div className="text-[11px] text-slate-500">
                               {kw.competition_level}
                             </div>
                           </div>
                         ) : (
                           <span className="text-slate-400 text-xs">Taranmadı</span>
                         )}
                       </td>
                       <td className="px-2 py-3 sm:p-4 text-center">
                         {kw.is_etsy_suggested ? (
                           <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-xs font-semibold inline-flex items-center gap-1">
                             <CheckCircle className="w-3 h-3" />
                             # {kw.autocomplete_rank || 1}
                           </span>
                         ) : (
                           <span className="text-slate-400 text-xs">-</span>
                         )}
                       </td>
                       <td className="px-2 py-3 sm:p-4 text-center font-mono font-bold text-amber-600">
                         {kw.bestseller_count ? `${kw.bestseller_count} adet` : '-'}
                       </td>
                       <td className="px-2 py-3 sm:p-4 text-center">
                         {getScoreBadge(oppScore)}
                       </td>
                       <td className="px-2 py-3 sm:p-4 text-[11px] text-slate-500 whitespace-nowrap">
                         {kw.last_scrape_error ? (
                           <div className="flex items-center gap-1 text-rose-600 font-bold" title={kw.last_scrape_error}>
                             <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                             <span className="truncate max-w-[120px]">Bot Engeli / Hata</span>
                           </div>
                         ) : kw.last_evaluated_at ? (
                           new Date(kw.last_evaluated_at).toLocaleDateString('tr-TR')
                         ) : (
                           'Hiç'
                         )}
                       </td>
                     </tr>
                   );
                 })
               )}
             </tbody>
           </table>
         </div>

         <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
           <div className="text-xs text-slate-500">
             Sayfa {page + 1} / {Math.max(1, Math.ceil(total / limit))}
           </div>
           <div className="flex gap-2">
             <button 
               onClick={() => setPage(Math.max(0, page - 1))}
               disabled={page === 0}
               className="p-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 disabled:opacity-50"
             >
               <ChevronLeft className="w-4 h-4" />
             </button>
             <button 
               onClick={() => setPage(page + 1)}
               disabled={(page + 1) * limit >= total}
               className="p-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 disabled:opacity-50"
             >
               <ChevronRight className="w-4 h-4" />
             </button>
           </div>
         </div>
       </div>

       {/* Test Diagnostics Modal */}
       {showTestModal && (
         <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
             <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
               <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                 🧪 Etsy Kazıyıcı & Proxy Testi
               </h3>
               <button 
                 onClick={() => setShowTestModal(false)}
                 className="text-slate-400 hover:text-slate-600 text-lg font-bold"
               >
                 ✕
               </button>
             </div>

             <div className="space-y-4">
                {/* Test Mode Selector Tabs */}
                <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-semibold">
                  <button
                    onClick={() => setTestMode('browser')}
                    className={`flex-1 py-2 rounded-lg transition-all ${testMode === 'browser' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    🌐 İstemci Tarayıcı Testi (Chrome/Edge)
                  </button>
                  <button
                    onClick={() => setTestMode('server')}
                    className={`flex-1 py-2 rounded-lg transition-all ${testMode === 'server' ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    ☁️ Sunucu / Cloudflare Proxy Testi
                  </button>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    Test Edilecek Kelime:
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={testKeyword}
                      onChange={(e) => setTestKeyword(e.target.value)}
                      placeholder="Örn: vintage shirt, cat mom gift"
                      className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button 
                      onClick={handleTestScraper}
                      disabled={isTestingScraper}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isTestingScraper ? 'animate-spin' : ''}`} />
                      {testMode === 'browser' ? 'Tarayıcıda Test Et' : 'Sunucuda Test Et'}
                    </button>
                  </div>
                </div>

               {testResult && (
                 <div className="mt-4 bg-slate-950 text-slate-100 p-4 rounded-xl font-mono text-xs overflow-x-auto max-h-80 space-y-2">
                   <div className="text-emerald-400 font-bold">--- DIAGNOSTICS & RESULT ---</div>
                   <pre>{JSON.stringify(testResult, null, 2)}</pre>
                 </div>
               )}
             </div>

             <div className="flex justify-end pt-2">
               <button 
                 onClick={() => setShowTestModal(false)}
                 className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl"
               >
                 Kapat
               </button>
             </div>
           </div>
         </div>
       )}
     </div>
   );
 }
