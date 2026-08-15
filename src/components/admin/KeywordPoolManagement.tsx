'use client';
import React, { useState, useEffect, useRef } from 'react';
import { 
  RefreshCw, Trash2, Search, Download, CheckSquare, Square, 
  ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, Tag, 
  Trophy, Sparkles, ShieldAlert, Globe, Info, Zap, DollarSign
} from 'lucide-react';
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
  raw_metrics?: any;
  created_at: string;
  last_evaluated_at: string | null;
}

interface EtsyStatus {
  connected: boolean;
  shopId?: string | null;
}

export default function KeywordPoolManagement() {
  const toast = useToast();
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [total, setTotal] = useState(0);
  const [etsyStatus, setEtsyStatus] = useState<EtsyStatus>({ connected: false, shopId: null });
  const [isLoading, setIsLoading] = useState(true);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'tag_eligible' | 'gold' | 'error' | 'unevaluated'>('all');
  const [evaluatingSingleId, setEvaluatingSingleId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState('created_at');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [isExporting, setIsExporting] = useState(false);

  // Bulk Progress State
  const [isBulkRunning, setIsBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, updated: 0, blocked: 0 });
  const cancelBulkRef = useRef(false);

  // Expanded details modal/popover
  const [activeDetailsKeyword, setActiveDetailsKeyword] = useState<Keyword | null>(null);

  // Test Modal
  const [showTestModal, setShowTestModal] = useState(false);
  const [testKeyword, setTestKeyword] = useState('vintage shirt');
  const [testResult, setTestResult] = useState<any>(null);
  const [isTestingScraper, setIsTestingScraper] = useState(false);
  const [testMode, setTestMode] = useState<'server' | 'browser'>('server');

  const limit = 50;

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    fetchKeywords();
    setSelectedIds(new Set());
  }, [page, sortBy, order, debouncedSearch, filter]);

  const fetchKeywords = async () => {
    setIsLoading(true);
    try {
      const offset = page * limit;
      const query = new URLSearchParams({
        search: debouncedSearch,
        filter,
        sortBy,
        order,
        limit: limit.toString(),
        offset: offset.toString()
      });
      const res = await fetch(`/api/admin/keywords?${query}`);
      const data = await res.json();
      if (data.success) {
        setKeywords(data.keywords || []);
        setTotal(data.total || 0);
        if (data.etsyStatus) {
          setEtsyStatus(data.etsyStatus);
        }
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
    if (selectedIds.size === keywords.length && keywords.length > 0) {
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

  // Evaluate a single keyword
  const handleEvaluateSingle = async (kw: Keyword) => {
    if (evaluatingSingleId || isEvaluating || isBulkRunning) return;
    setEvaluatingSingleId(kw.id);
    try {
      const res = await fetch('/api/admin/keywords/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [kw.id] })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`"${kw.keyword}" güncellendi!`);
        if (data.warning) toast.error(data.warning);
        fetchKeywords();
      } else {
        toast.error(data.error || 'Değerlendirme başarısız.');
      }
    } catch (e: any) {
      toast.error('Hata: ' + e.message);
    } finally {
      setEvaluatingSingleId(null);
    }
  };

  // Delete a single keyword
  const handleDeleteSingle = async (kw: Keyword) => {
    if (!confirm(`"${kw.keyword}" kelimesini silmek istediğinize emin misiniz?`)) return;
    try {
      const res = await fetch('/api/admin/keywords', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [kw.id] })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`"${kw.keyword}" silindi.`);
        fetchKeywords();
      } else {
        toast.error(data.error || 'Silme başarısız.');
      }
    } catch (e: any) {
      toast.error('Hata: ' + e.message);
    }
  };

  // Evaluate selected or 20 single batch
  const handleEvaluateBatch = async () => {
    if (isEvaluating || isBulkRunning) return;
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
          toast.success(`${data.evaluatedCount} kelime %100 gerçek Etsy verisi ile güncellendi!`);
          if (data.warning) {
            toast.error(data.warning);
          }
          setSelectedIds(new Set());
          fetchKeywords();
        } else {
          toast.info('Değerlendirilecek kelime bulunamadı.');
        }
      } else {
        toast.error(data.error || 'Değerlendirme başarısız.');
      }
    } catch (e) {
      toast.error('Etsy verisi çekilirken hata oluştu.');
    } finally {
      setIsEvaluating(false);
    }
  };

  // Full Pool Bulk Runner (loops batches of 25 until complete)
  const handleRunFullPoolEvaluation = async () => {
    if (isBulkRunning || isEvaluating) return;
    if (!confirm(`Kelime havuzundaki tüm kelimeler (%100 Gerçek Etsy API) taranıp güncellenecek. Başlatmak istiyor musunuz?`)) return;

    setIsBulkRunning(true);
    cancelBulkRef.current = false;
    let processedTotal = 0;
    let totalBlocked = 0;
    const batchSize = 25;

    setBulkProgress({ current: 0, total, updated: 0, blocked: 0 });

    try {
      while (!cancelBulkRef.current) {
        const res = await fetch('/api/admin/keywords/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ limit: batchSize })
        });
        const data = await res.json();

        if (!data.success) {
          toast.error(data.error || 'Toplu taramada hata oluştu.');
          break;
        }

        if (data.evaluatedCount === 0) {
          toast.success('Tüm kelime havuzu başarıyla tarandı!');
          break;
        }

        processedTotal += data.evaluatedCount;
        if (data.blockedCount) totalBlocked += data.blockedCount;

        setBulkProgress(prev => ({
          ...prev,
          current: Math.min(prev.total, processedTotal),
          updated: processedTotal,
          blocked: totalBlocked
        }));

        fetchKeywords();
        await new Promise(r => setTimeout(r, 600));
      }
    } catch (e: any) {
      toast.error('Toplu tarama sırasında bir hata oluştu: ' + e.message);
    } finally {
      setIsBulkRunning(false);
    }
  };

  const handleCancelBulk = () => {
    cancelBulkRef.current = true;
    setIsBulkRunning(false);
    toast.info('Toplu tarama durduruldu.');
  };

  const handleExportCSV = async () => {
    if (total === 0) {
      toast.info('Dışa aktarılacak kelime bulunamadı.');
      return;
    }
    
    setIsExporting(true);
    toast.info(`Toplam ${total} kelime Excel için hazırlanıyor...`);

    try {
      const searchParam = debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : '';
      const res = await fetch(`/api/admin/keywords?filter=${filter}${searchParam}&export=true&limit=100000`);
      const data = await res.json();
      
      if (!data.success || !Array.isArray(data.keywords)) {
        throw new Error(data.error || 'Veriler sunucudan alınamadı.');
      }
      
      const allKeywords: Keyword[] = data.keywords;
      
      // Turkish & European Excel Standard Headers
      const headers = [
        'Anahtar Kelime',
        'Karakter Sayısı',
        'Etiket Uygunluğu (<=20)',
        'Kullanım Sayısı',
        'Fırsat Skoru (0-100)',
        'Toplam Etsy İlan Sayısı',
        'Rekabet Seviyesi',
        'Bestseller Sayısı',
        'Etsy Önerisi (Autocomplete)',
        'Autocomplete Sırası',
        'Ortalama Fiyat ($)',
        'Birlikte Kullanılan Popüler Etiketler',
        'Kazıma Kaynağı',
        'Hata / Durum',
        'Son Değerlendirme Tarihi',
        'Oluşturulma Tarihi'
      ];

      const escapeCell = (val: any) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""').replace(/[\r\n]+/g, ' ');
        return `"${str}"`;
      };

      const rows = allKeywords.map((k: Keyword) => {
        const rm = parseRawMetrics(k.raw_metrics);
        const topTags = Array.isArray(rm?.topTags) ? rm.topTags.join(', ') : '';
        const oppScore = k.opportunity_score ?? k.etsy_score ?? 0;
        const autoRank = k.autocomplete_rank ? `#${k.autocomplete_rank}` : (k.is_etsy_suggested ? 'Önerildi' : '-');
        const avgPriceFormatted = k.avg_price ? Number(k.avg_price).toFixed(2) : '0.00';
        const sourceMethod = rm?.method || rm?.methodUsed || 'Hazır Veri';
        const errorStatus = k.last_scrape_error ? k.last_scrape_error : (k.competition_level === 'Engellendi / Hata' ? 'Engellendi' : 'Sorunsuz / Aktif');
        const evalDate = k.last_evaluated_at ? new Date(k.last_evaluated_at).toLocaleString('tr-TR') : 'Değerlendirilmedi';
        const createDate = k.created_at ? new Date(k.created_at).toLocaleString('tr-TR') : '';

        return [
          escapeCell(k.keyword),
          escapeCell(k.keyword.length),
          escapeCell(k.keyword.length <= 20 ? 'EVET' : 'HAYIR'),
          escapeCell(k.usage_count || 0),
          escapeCell(oppScore),
          escapeCell(k.total_listings || 0),
          escapeCell(k.competition_level || 'Bilinmiyor'),
          escapeCell(k.bestseller_count || 0),
          escapeCell(k.is_etsy_suggested ? 'EVET' : 'HAYIR'),
          escapeCell(autoRank),
          escapeCell(avgPriceFormatted),
          escapeCell(topTags),
          escapeCell(sourceMethod),
          escapeCell(errorStatus),
          escapeCell(evalDate),
          escapeCell(createDate)
        ];
      });
      
      const delimiter = ';';
      const csvBody = [headers.map(h => `"${h}"`).join(delimiter), ...rows.map((r: string[]) => r.join(delimiter))].join('\r\n');
      
      // UTF-8 BOM (\uFEFF) ensures Turkish characters and distinct columns open flawlessly in Microsoft Excel
      const bom = '\uFEFF';
      const blob = new Blob([bom + csvBody], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      link.download = `etsy_kelime_havuzu_tam_liste_${dateStr}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success(`Harika! Toplam ${allKeywords.length} kelime Excel uyumlu CSV olarak indirildi.`);
    } catch (e: any) {
      toast.error('CSV dışa aktarılırken hata oluştu: ' + (e?.message || ''));
    } finally {
      setIsExporting(false);
    }
  };

  const parseRawMetrics = (rm: any) => {
    if (!rm) return {};
    if (typeof rm === 'string') {
      try { return JSON.parse(rm); } catch { return {}; }
    }
    return rm;
  };

  const formatDateSafe = (d: string | null | undefined) => {
    if (!d) return null;
    try {
      const parsed = new Date(d);
      if (isNaN(parsed.getTime())) return null;
      return parsed.toLocaleDateString('tr-TR');
    } catch {
      return null;
    }
  };

  const toSafeNum = (val: any, fallback = 0): number => {
    if (val === null || val === undefined) return fallback;
    if (typeof val === 'number') return isNaN(val) ? fallback : val;
    const parsed = parseFloat(String(val));
    return isNaN(parsed) ? fallback : parsed;
  };

  const renderSourceBadge = (kw: Keyword) => {
    if (kw.last_scrape_error) {
      return (
        <span 
          title={kw.last_scrape_error}
          className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800 flex items-center gap-1 shrink-0"
        >
          <ShieldAlert className="w-3 h-3" />
          Engellendi
        </span>
      );
    }
    const rm = parseRawMetrics(kw.raw_metrics);
    const method = rm?.method || rm?.methodUsed;

    if (method === 'etsy_official_api') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1 shrink-0">
          <CheckCircle2 className="w-3 h-3" />
          Etsy Resmi API
        </span>
      );
    }
    if (method === 'scraper_api') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800 flex items-center gap-1 shrink-0">
          <Zap className="w-3 h-3" />
          Scraper API
        </span>
      );
    }
    if (method === 'cloudflare_worker' || method === 'direct_etsy') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 flex items-center gap-1 shrink-0">
          <Globe className="w-3 h-3" />
          Canlı Kazıma
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
        Hazır
      </span>
    );
  };

  const getScoreBadge = (score: number | null, isError: boolean) => {
    if (isError) {
      return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-200">0 (Hata)</span>;
    }
    if (score === null || score === 0) {
      return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">Puan Yok</span>;
    }
    if (score >= 80) return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300">🔥 {score}</span>;
    if (score >= 50) return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300">{score}</span>;
    return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300">{score}</span>;
  };

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setOrder('desc');
    }
  };

  const handleTestScraper = async () => {
    if (!testKeyword) return;
    setIsTestingScraper(true);
    setTestResult(null);
    try {
      if (testMode === 'browser') {
        const { scrapeEtsyFromBrowser } = await import('@/lib/client-etsy-scraper');
        const res = await scrapeEtsyFromBrowser('test-id', testKeyword);
        setTestResult({
          success: !res.scrapeError,
          result: res,
          diagnostics: {
            testedKeyword: testKeyword,
            executedFrom: 'Browser JS Client'
          }
        });
        if (!res.scrapeError) {
          toast.success(`Tarayıcı modunda "${testKeyword}" testi tamamlandı!`);
        } else {
          toast.error(res.scrapeError || 'Tarayıcı testinde hata/engelleme.');
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
          toast.success(`Etsy Resmi API ile "${testKeyword}" başarıyla test edildi!`);
        } else {
          toast.error(data.result?.scrapeError || 'Sunucu testinde hata alındı.');
        }
      }
    } catch (e: any) {
      toast.error('Test sırasında hata oluştu: ' + e.message);
    } finally {
      setIsTestingScraper(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header & Status Card */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h3 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500 shrink-0" />
              Kelime Havuzu &amp; Gerçek Etsy Metrikleri
            </h3>
            {etsyStatus.connected ? (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 flex items-center gap-1.5 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                🟢 Etsy Resmi API (Mağaza: {etsyStatus.shopId || 'Bağlı'})
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 flex items-center gap-1.5 shadow-sm">
                <AlertTriangle className="w-3.5 h-3.5" />
                Etsy API Bağlantısı Yok
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Tasarım etiketlerinin ve anahtar kelimelerin %100 gerçek Etsy ilan sayısı, fiyatı, autocomplete sırası ve rekabet analizi.
          </p>
        </div>
        
        {/* Action Buttons */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full lg:w-auto">
          <button 
            onClick={handleRunFullPoolEvaluation}
            disabled={isBulkRunning || isEvaluating || isExporting}
            className="col-span-2 sm:col-auto px-3.5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 min-h-[40px]"
          >
            <RefreshCw className={`w-4 h-4 ${isBulkRunning ? 'animate-spin' : ''}`} />
            <span>{isBulkRunning ? 'Tüm Havuz Taranıyor...' : '⚡ Tüm Havuzu Güncelle'}</span>
          </button>

          <button 
            onClick={handleEvaluateBatch}
            disabled={isEvaluating || isBulkRunning || isExporting}
            className="px-3 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 min-h-[40px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isEvaluating ? 'animate-spin' : ''}`} />
            <span>{selectedIds.size > 0 ? `Seçilenleri Güncelle (${selectedIds.size})` : 'Eskimişleri Tara'}</span>
          </button>
          
          <button 
            onClick={() => setShowTestModal(true)}
            className="px-3 py-2.5 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-700 dark:text-blue-300 text-xs sm:text-sm font-semibold rounded-xl border border-blue-200 dark:border-blue-800 transition-colors flex items-center justify-center gap-1.5 min-h-[40px]"
          >
            🧪 Test Et
          </button>

          <button 
            onClick={handleExportCSV}
            disabled={isExporting}
            className="px-3 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 min-h-[40px]"
            title="Tüm kelimeleri Excel uyumlu CSV olarak indir"
          >
            <Download className={`w-4 h-4 ${isExporting ? 'animate-bounce' : ''}`} />
            <span>{isExporting ? 'Hazırlanıyor...' : 'CSV İndir'}</span>
          </button>
          
          {selectedIds.size > 0 && (
            <button 
              onClick={handleDelete}
              className="col-span-2 sm:col-auto px-3 py-2.5 bg-rose-100 text-rose-700 text-xs sm:text-sm font-semibold rounded-xl hover:bg-rose-200 transition-colors flex items-center justify-center gap-1.5 min-h-[40px]"
            >
              <Trash2 className="w-4 h-4" />
              <span>Sil ({selectedIds.size})</span>
            </button>
          )}
        </div>
      </div>

      {/* Bulk Progress Bar */}
      {isBulkRunning && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-3.5 sm:p-4 space-y-2">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs sm:text-sm font-bold text-emerald-900 dark:text-emerald-200">
            <span className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-600 shrink-0" />
              Etsy API Toplu Tarama: {bulkProgress.current} / {bulkProgress.total} kelime
            </span>
            <div className="flex items-center gap-3 self-end sm:self-auto">
              <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300">
                %{Math.round((bulkProgress.current / Math.max(1, bulkProgress.total)) * 100)}
              </span>
              <button
                onClick={handleCancelBulk}
                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors"
              >
                Durdur
              </button>
            </div>
          </div>
          <div className="w-full h-2.5 bg-emerald-200 dark:bg-emerald-900 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-600 transition-all duration-300 rounded-full"
              style={{ width: `${Math.min(100, (bulkProgress.current / Math.max(1, bulkProgress.total)) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
            <span>✅ Güncellenen: {bulkProgress.updated}</span>
            {bulkProgress.blocked > 0 && <span className="text-rose-600 font-bold">⚠️ Engellenen/Hata: {bulkProgress.blocked}</span>}
          </div>
        </div>
      )}

      {/* Filter Tabs (Horizontally scrollable on mobile) */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0 sm:flex-wrap bg-slate-100 dark:bg-slate-800/60 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs">
        <button
          onClick={() => { setFilter('all'); setPage(0); }}
          className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap shrink-0 transition-colors ${filter === 'all' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
        >
          Tüm Kelimeler ({total})
        </button>
        <button
          onClick={() => { setFilter('tag_eligible'); setPage(0); }}
          className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap shrink-0 transition-colors flex items-center gap-1.5 ${filter === 'tag_eligible' ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600'}`}
        >
          <Tag className="w-3.5 h-3.5" />
          Sadece ≤20 Karakter (Etiket Uyumlu)
        </button>
        <button
          onClick={() => { setFilter('unevaluated'); setPage(0); }}
          className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap shrink-0 transition-colors flex items-center gap-1.5 ${filter === 'unevaluated' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-indigo-600'}`}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          🕒 Taranmamış / Bekleyen
        </button>
        <button
          onClick={() => { setFilter('gold'); setPage(0); }}
          className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap shrink-0 transition-colors flex items-center gap-1.5 ${filter === 'gold' ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-amber-600'}`}
        >
          <Trophy className="w-3.5 h-3.5" />
          🏆 Altın Nişler (Skor ≥70 &amp; İlan &lt; 5K)
        </button>
        <button
          onClick={() => { setFilter('error'); setPage(0); }}
          className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap shrink-0 transition-colors flex items-center gap-1.5 ${filter === 'error' ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-sm font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-rose-600'}`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          ⚠️ Engellenen / Hatalı Olanlar
        </button>
      </div>

      {/* Main Data Container (Desktop Table + Mobile Cards) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {/* Search Bar & Stats Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-slate-50 dark:bg-slate-900/50">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Kelime ara..." 
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-slate-700 dark:text-slate-200"
            />
          </div>
          
          <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-slate-500">
            {/* Mobile Select All Button */}
            <div className="block md:hidden">
              <button 
                onClick={handleSelectAll}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-emerald-600"
              >
                {selectedIds.size > 0 && selectedIds.size === keywords.length ? (
                  <CheckSquare className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>Tümünü Seç</span>
              </button>
            </div>
            <div>
              Toplam <strong>{total.toLocaleString('tr-TR')}</strong> kelime
            </div>
          </div>
        </div>

        {/* 1. Desktop & Tablet View (Rich 10-Column Table) */}
        <div className="hidden md:block overflow-x-auto w-full">
          <table className="w-full min-w-[900px] text-left text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
               <tr>
                 <th className="px-3 py-3.5 w-10 text-center cursor-pointer" onClick={handleSelectAll}>
                   {selectedIds.size > 0 && selectedIds.size === keywords.length ? (
                     <CheckSquare className="w-4 h-4 text-emerald-600 mx-auto" />
                   ) : (
                     <Square className="w-4 h-4 mx-auto" />
                   )}
                 </th>
                 <th className="px-3 py-3.5 font-semibold cursor-pointer hover:text-slate-700" onClick={() => handleSort('keyword')}>Kelime &amp; Uzunluk</th>
                 <th className="px-3 py-3.5 font-semibold cursor-pointer hover:text-slate-700 text-center" onClick={() => handleSort('usage_count')}>Kull.</th>
                 <th className="px-3 py-3.5 font-semibold cursor-pointer hover:text-slate-700" onClick={() => handleSort('total_listings')}>Gerçek Etsy İlanı</th>
                 <th className="px-3 py-3.5 font-semibold text-center">Autocomplete</th>
                 <th className="px-3 py-3.5 font-semibold text-center">Ort. Fiyat</th>
                 <th className="px-3 py-3.5 font-semibold cursor-pointer hover:text-slate-700 text-center" onClick={() => handleSort('bestseller_count')}>İlgi / Bestseller</th>
                 <th className="px-3 py-3.5 font-semibold cursor-pointer hover:text-slate-700 text-center" onClick={() => handleSort('opportunity_score')}>Fırsat Skoru</th>
                 <th className="px-3 py-3.5 font-semibold cursor-pointer hover:text-slate-700" onClick={() => handleSort('last_evaluated_at')}>Kaynak / Tarih</th>
                 <th className="px-3 py-3.5 font-semibold text-right">İşlem</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
               {isLoading ? (
                 <tr>
                   <td colSpan={10} className="p-8 text-center text-slate-500">Yükleniyor...</td>
                 </tr>
               ) : keywords.length === 0 ? (
                 <tr>
                   <td colSpan={10} className="p-8 text-center text-slate-500">Aranan kriterlere uygun kelime bulunamadı.</td>
                 </tr>
               ) : (
                 keywords.map((kw) => {
                    const rm = parseRawMetrics(kw.raw_metrics);
                    const cleanKeyword = kw.keyword || '';
                    const charLen = cleanKeyword.length;
                    const isTagOk = charLen <= 20;
                    const oppScore = toSafeNum(kw.opportunity_score ?? kw.etsy_score, 0);
                    const totalListings = toSafeNum(kw.total_listings, 0);
                    const avgPrice = toSafeNum(kw.avg_price, 0);
                    const bestsellerCount = toSafeNum(kw.bestseller_count, 0);
                    const isBlocked = !!kw.last_scrape_error || kw.competition_level === 'Engellendi / Hata';
                    const topTags = Array.isArray(rm?.topTags) ? rm.topTags : [];
                    const hasTopTags = topTags.length > 0;
                    const formattedDate = formatDateSafe(kw.last_evaluated_at);

                    return (
                      <tr key={kw.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-3 py-3.5 text-center cursor-pointer" onClick={() => handleSelect(kw.id)}>
                          {selectedIds.has(kw.id) ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600 mx-auto" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300 dark:text-slate-600 mx-auto" />
                          )}
                        </td>
                        <td className="px-3 py-3.5 font-medium text-slate-800 dark:text-slate-200">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-white">{cleanKeyword}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${isTagOk ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800'}`}>
                              {charLen}/20
                            </span>
                            {hasTopTags && (
                              <button 
                                onClick={() => setActiveDetailsKeyword(kw)}
                                title="Birlikte kullanılan popüler etiketleri gör"
                                className="text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                              >
                                <Info className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3.5 text-center font-mono">{toSafeNum(kw.usage_count, 0)}</td>
                        <td className="px-3 py-3.5">
                           {totalListings > 0 ? (
                             <div>
                               <div className="font-bold text-slate-900 dark:text-white font-mono">
                                 {totalListings.toLocaleString('tr-TR')} ilan
                               </div>
                               <div className="text-[11px] text-slate-500 font-medium">
                                 {kw.competition_level || 'Normal'}
                               </div>
                             </div>
                           ) : isBlocked ? (
                             <div>
                               <span className="text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center gap-1">
                                 <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                                 Engellendi / Hata
                               </span>
                               <span className="text-[10px] text-rose-500 block truncate max-w-[140px]" title={kw.last_scrape_error || ''}>
                                 {kw.last_scrape_error || 'Etsy Bot Koruması'}
                               </span>
                             </div>
                           ) : (
                             <span className="text-slate-400 text-xs">Taranmadı</span>
                           )}
                         </td>
                        <td className="px-3 py-3.5 text-center">
                          {kw.is_etsy_suggested ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold inline-flex items-center gap-1 border border-emerald-200 dark:border-emerald-800">
                              <CheckCircle2 className="w-3 h-3" />
                              #{toSafeNum(kw.autocomplete_rank, 1)}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-3 py-3.5 text-center font-mono font-medium">
                          {avgPrice > 0 ? (
                            <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                              ${avgPrice.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-3 py-3.5 text-center font-mono font-bold text-amber-600 dark:text-amber-400">
                          {bestsellerCount > 0 ? `${bestsellerCount} adet` : '-'}
                        </td>
                        <td className="px-3 py-3.5 text-center">
                          {getScoreBadge(oppScore, isBlocked)}
                        </td>
                        <td className="px-3 py-3.5 text-[11px] text-slate-500 whitespace-nowrap">
                          <div className="flex flex-col gap-1 items-start">
                            {renderSourceBadge(kw)}
                            {formattedDate && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                {formattedDate}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleEvaluateSingle(kw)}
                              disabled={evaluatingSingleId === kw.id || isEvaluating || isBulkRunning}
                              title="Bu kelimeyi gerçek Etsy verisiyle güncelle"
                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-lg transition-colors disabled:opacity-40"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${evaluatingSingleId === kw.id ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                              onClick={() => handleDeleteSingle(kw)}
                              title="Kelimeyi havuzdan sil"
                              className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
               )}
             </tbody>
           </table>
        </div>

        {/* 2. Mobile Cards View (Touch-Optimized, No Horizontal Overflow) */}
        <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800/80">
          {isLoading ? (
            <div className="p-8 text-center text-slate-500 text-sm">Kelimeler yükleniyor...</div>
          ) : keywords.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">Aranan kriterlere uygun kelime bulunamadı.</div>
          ) : (
            keywords.map((kw) => {
              const rm = parseRawMetrics(kw.raw_metrics);
              const cleanKeyword = kw.keyword || '';
              const charLen = cleanKeyword.length;
              const isTagOk = charLen <= 20;
              const oppScore = toSafeNum(kw.opportunity_score ?? kw.etsy_score, 0);
              const totalListings = toSafeNum(kw.total_listings, 0);
              const avgPrice = toSafeNum(kw.avg_price, 0);
              const bestsellerCount = toSafeNum(kw.bestseller_count, 0);
              const isBlocked = !!kw.last_scrape_error || kw.competition_level === 'Engellendi / Hata';
              const topTags = Array.isArray(rm?.topTags) ? rm.topTags : [];
              const hasTopTags = topTags.length > 0;
              const formattedDate = formatDateSafe(kw.last_evaluated_at);

              return (
                <div key={kw.id} className="p-3.5 space-y-2.5 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                  {/* Top Row: Checkbox, Keyword, Char Badge, Score */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <button 
                        onClick={() => handleSelect(kw.id)} 
                        className="mt-0.5 p-1 text-slate-400 hover:text-emerald-600 focus:outline-none"
                      >
                        {selectedIds.has(kw.id) ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                        )}
                      </button>
                      
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900 dark:text-white text-sm break-all">
                            {cleanKeyword}
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                            isTagOk ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200'
                          }`}>
                            {charLen}/20
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                          <span>Kullanım: {toSafeNum(kw.usage_count, 0)}</span>
                          {formattedDate && <span>• {formattedDate}</span>}
                          {renderSourceBadge(kw)}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex flex-col items-end">
                      {getScoreBadge(oppScore, isBlocked)}
                    </div>
                  </div>

                  {/* Metrics 3-Column Grid */}
                  <div className="grid grid-cols-3 gap-1.5 p-2 bg-slate-50 dark:bg-slate-950/60 rounded-xl text-[11px] border border-slate-100 dark:border-slate-800/60">
                    <div>
                      <span className="text-[9px] text-slate-400 block">Etsy İlanı</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                        {totalListings > 0 ? totalListings.toLocaleString('tr-TR') : isBlocked ? 'Hata' : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 block">Ort. Fiyat</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                        {avgPrice > 0 ? `$${avgPrice.toFixed(2)}` : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 block">Bestseller</span>
                      <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">
                        {bestsellerCount > 0 ? `${bestsellerCount} ad.` : '-'}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Row: Autocomplete & Details & Actions */}
                  <div className="flex items-center justify-between pt-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {kw.is_etsy_suggested && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200">
                          Autocomplete #{toSafeNum(kw.autocomplete_rank, 1)}
                        </span>
                      )}
                      {hasTopTags && (
                        <button
                          onClick={() => setActiveDetailsKeyword(kw)}
                          className="px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 rounded-md border border-indigo-200 dark:border-indigo-800 flex items-center gap-1"
                        >
                          <Info className="w-3 h-3" />
                          Alt Etiketler ({topTags.length})
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleEvaluateSingle(kw)}
                        disabled={evaluatingSingleId === kw.id || isEvaluating || isBulkRunning}
                        className="p-2 text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 rounded-lg border border-indigo-200 dark:border-indigo-800 transition-colors disabled:opacity-40"
                        title="Güncelle"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${evaluatingSingleId === kw.id ? 'animate-spin' : ''}`} />
                      </button>
                      <button
                        onClick={() => handleDeleteSingle(kw)}
                        className="p-2 text-rose-600 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 rounded-lg border border-rose-200 dark:border-rose-800 transition-colors"
                        title="Sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        <div className="p-3.5 sm:p-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
          <div className="text-xs text-slate-500">
            Sayfa {page + 1} / {Math.max(1, Math.ceil(total / limit))}
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-50 hover:bg-slate-100 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setPage(page + 1)}
              disabled={(page + 1) * limit >= total}
              className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-50 hover:bg-slate-100 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Top Co-Occurring Tags Details Modal */}
      {activeDetailsKeyword && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-4 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  🏷️ "{activeDetailsKeyword.keyword}" Analiz Detayları
                </h4>
                <p className="text-xs text-slate-500">Etsy'de bu kelimeyle en çok satan rakiplerin kullandığı etiketler</p>
              </div>
              <button 
                onClick={() => setActiveDetailsKeyword(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            {(() => {
               const modalRm = parseRawMetrics(activeDetailsKeyword.raw_metrics);
               const modalTopTags = Array.isArray(modalRm?.topTags) ? modalRm.topTags : [];
               const modalSuggestions = Array.isArray(modalRm?.autocomplete?.topSuggestions) ? modalRm.autocomplete.topSuggestions : [];
               const modalAvgPrice = toSafeNum(activeDetailsKeyword.avg_price, 0);
               const modalAvgFavs = toSafeNum(modalRm?.avgFavorites, 0);
               const modalAvgViews = toSafeNum(modalRm?.avgViews, 0);

               return (
                 <div className="space-y-3">
                   {modalTopTags.length > 0 && (
                     <div>
                       <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                         Birlikte Kullanılan En Popüler Etiketler (Etsy Sample):
                       </label>
                       <div className="flex flex-wrap gap-1.5">
                         {modalTopTags.map((tag: string, idx: number) => (
                           <span 
                             key={idx}
                             className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold rounded-lg border border-indigo-200 dark:border-indigo-800"
                           >
                             #{tag}
                           </span>
                         ))}
                       </div>
                     </div>
                   )}

                   {modalSuggestions.length > 0 && (
                     <div>
                       <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                         Etsy Arama Çubuğu Tamamlamaları:
                       </label>
                       <div className="flex flex-wrap gap-1.5">
                         {modalSuggestions.map((sug: string, idx: number) => (
                           <span 
                             key={idx}
                             className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-medium rounded-lg border border-emerald-200 dark:border-emerald-800"
                           >
                             {sug}
                           </span>
                         ))}
                       </div>
                     </div>
                   )}

                   <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                     <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl text-center">
                       <span className="text-slate-400 block text-[10px]">Ort. Fiyat</span>
                       <span className="font-bold text-slate-800 dark:text-slate-200">${modalAvgPrice > 0 ? modalAvgPrice.toFixed(2) : '0.00'}</span>
                     </div>
                     <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl text-center">
                       <span className="text-slate-400 block text-[10px]">Ort. Favori</span>
                       <span className="font-bold text-slate-800 dark:text-slate-200">{modalAvgFavs}</span>
                     </div>
                     <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl text-center">
                       <span className="text-slate-400 block text-[10px]">Ort. Görüntülenme</span>
                       <span className="font-bold text-slate-800 dark:text-slate-200">{modalAvgViews}</span>
                     </div>
                   </div>
                 </div>
               );
             })()}

            <div className="flex justify-end pt-2">
              <button 
                onClick={() => setActiveDetailsKeyword(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diagnostics / Test Modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full max-h-[85vh] overflow-y-auto p-4 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                🧪 Etsy Kazıyıcı &amp; Canlı API Testi
              </h3>
              <button 
                onClick={() => setShowTestModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
               <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-semibold">
                 <button
                   onClick={() => setTestMode('server')}
                   className={`flex-1 py-2 rounded-lg transition-all ${testMode === 'server' ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                 >
                   🌐 Etsy Resmi API / Sunucu Testi
                 </button>
                 <button
                   onClick={() => setTestMode('browser')}
                   className={`flex-1 py-2 rounded-lg transition-all ${testMode === 'browser' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                 >
                   ⚡ İstemci Tarayıcı Modu
                 </button>
               </div>

               <div>
                 <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                   Test Edilecek Kelime:
                 </label>
                 <div className="flex flex-col sm:flex-row gap-2">
                   <input 
                     type="text" 
                     value={testKeyword}
                     onChange={(e) => setTestKeyword(e.target.value)}
                     placeholder="Örn: vintage shirt, golden retriever"
                     className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 dark:text-slate-200"
                   />
                   <button 
                     onClick={handleTestScraper}
                     disabled={isTestingScraper}
                     className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0 min-h-[38px]"
                   >
                     <RefreshCw className={`w-3.5 h-3.5 ${isTestingScraper ? 'animate-spin' : ''}`} />
                     {testMode === 'server' ? 'Etsy API ile Test Et' : 'Tarayıcıda Test Et'}
                   </button>
                 </div>
               </div>

              {testResult && (
                <div className="mt-4 bg-slate-950 text-slate-100 p-3 sm:p-4 rounded-xl font-mono text-[11px] sm:text-xs overflow-x-auto max-h-60 sm:max-h-80 space-y-2">
                  <div className="text-emerald-400 font-bold">--- CANLI ETSY TEST RAPORU ---</div>
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
