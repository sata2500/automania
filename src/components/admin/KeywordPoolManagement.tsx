import React, { useState, useEffect } from 'react';
import { RefreshCw, Trash2, Search, Download, CheckSquare, Square, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/components/common/ToastContext';

interface Keyword {
  id: string;
  keyword: string;
  usage_count: number;
  etsy_score: number | null;
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
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState('created_at');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const limit = 50;

  useEffect(() => {
    fetchKeywords();
  }, [page, sortBy, order, search]); // Note: In a real app, debounce search

  const fetchKeywords = async () => {
    setIsLoading(true);
    try {
      const offset = page * limit;
      const query = new URLSearchParams({
        search,
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
      // If we have selected items, only evaluate those. Otherwise evaluate oldest 50.
      const payload = selectedIds.size > 0 
        ? { ids: Array.from(selectedIds) } 
        : { limit: 50 };

      const res = await fetch('/api/admin/keywords/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (data.success) {
        if (data.evaluatedCount > 0) {
          toast.success(`${data.evaluatedCount} kelime başarıyla değerlendirildi!`);
          setSelectedIds(new Set());
          fetchKeywords();
        } else {
          toast.info('Değerlendirilecek eskimiş kelime bulunamadı.');
        }
      } else {
        toast.error(data.error || 'Değerlendirme başarısız.');
      }
    } catch (e) {
      toast.error('Değerlendirme işlemi sırasında hata oluştu.');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleExportCSV = async () => {
    if (total === 0) return;
    
    try {
      // Fetch all keywords by setting a very high limit
      const res = await fetch('/api/admin/keywords?limit=100000');
      const data = await res.json();
      
      if (!data.success) throw new Error();
      
      const allKeywords = data.keywords;
      
      const headers = ['Keyword', 'Usage Count', 'Etsy Score', 'Last Evaluated', 'Created At'];
      const rows = allKeywords.map((k: Keyword) => [
        `"${k.keyword.replace(/"/g, '""')}"`,
        k.usage_count,
        k.etsy_score || 0,
        k.last_evaluated_at ? new Date(k.last_evaluated_at).toISOString() : '',
        new Date(k.created_at).toISOString()
      ]);
      
      const csvContent = [headers.join(','), ...rows.map((r: any[]) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `keyword_pool_tum_kelimeler_${new Date().toISOString().slice(0,10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      
      toast.success('Tüm kelimeler başarıyla indirildi!');
    } catch (e) {
      toast.error('CSV dışa aktarılırken bir hata oluştu.');
    }
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'bg-gray-100 text-gray-600 border-gray-200';
    if (score >= 80) return 'bg-green-100 text-green-700 border-green-200';
    if (score >= 50) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    return 'bg-red-100 text-red-700 border-red-200';
  };

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setOrder('desc');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Kelime Havuzu (Keyword Pool)</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Tasarım analizlerinden elde edilen kelimeleri ve SEO puanlarını yönetin.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={handleEvaluateBatch}
            disabled={isEvaluating}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isEvaluating ? 'animate-spin' : ''}`} />
            {selectedIds.size > 0 ? `Seçilenleri Değerlendir (${selectedIds.size})` : 'Eskiyenleri Değerlendir (50)'}
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
              className="px-4 py-2 bg-red-100 text-red-600 text-sm font-medium rounded-lg hover:bg-red-200 transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Sil ({selectedIds.size})
            </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Kelime ara..." 
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-700 dark:text-slate-200"
            />
          </div>
          
          <div className="text-sm text-slate-500">
            Toplam <strong>{total}</strong> kelime
          </div>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-4 w-12 text-center cursor-pointer" onClick={handleSelectAll}>
                  {selectedIds.size > 0 && selectedIds.size === keywords.length ? (
                    <CheckSquare className="w-4 h-4 text-blue-500 mx-auto" />
                  ) : (
                    <Square className="w-4 h-4 mx-auto" />
                  )}
                </th>
                <th className="p-4 font-medium cursor-pointer hover:text-slate-700" onClick={() => handleSort('keyword')}>Kelime</th>
                <th className="p-4 font-medium cursor-pointer hover:text-slate-700" onClick={() => handleSort('usage_count')}>Kullanım</th>
                <th className="p-4 font-medium cursor-pointer hover:text-slate-700" onClick={() => handleSort('etsy_score')}>Etsy Skoru</th>
                <th className="p-4 font-medium cursor-pointer hover:text-slate-700" onClick={() => handleSort('last_evaluated_at')}>Son Değerlendirme</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">Yükleniyor...</td>
                </tr>
              ) : keywords.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">Kelime bulunamadı.</td>
                </tr>
              ) : (
                keywords.map((kw) => (
                  <tr key={kw.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="p-4 text-center cursor-pointer" onClick={() => handleSelect(kw.id)}>
                      {selectedIds.has(kw.id) ? (
                        <CheckSquare className="w-4 h-4 text-blue-500 mx-auto" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300 dark:text-slate-600 mx-auto" />
                      )}
                    </td>
                    <td className="p-4 font-medium text-slate-800 dark:text-slate-200">{kw.keyword}</td>
                    <td className="p-4">{kw.usage_count}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getScoreColor(kw.etsy_score)}`}>
                        {kw.etsy_score !== null ? kw.etsy_score : '-'}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-slate-500">
                      {kw.last_evaluated_at ? new Date(kw.last_evaluated_at).toLocaleDateString('tr-TR') : 'Hiç'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
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
    </div>
  );
}
