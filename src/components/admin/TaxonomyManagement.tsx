'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  RefreshCw, Search, CheckCircle2, XCircle, FolderTree, 
  Sparkles, Layers, Tag, ChevronRight, Check, AlertTriangle,
  SlidersHorizontal, Info, ArrowUpRight
} from 'lucide-react';
import { useToast } from '@/components/common/ToastContext';
import { ConfirmModal } from '@/components/common/ConfirmModal';

interface TaxonomyCategory {
  id: number;
  name: string;
  path: string;
  isActive: boolean;
  updatedAt?: string;
}

// Popüler Print-on-Demand (POD) Etsy Kategori ID'leri
const POPULAR_POD_IDS = [
  482,  // Clothing > Unisex Adult Clothing > Tops & Tees > T-shirts
  2202, // Clothing > Unisex Adult Clothing > Hoodies & Sweatshirts
  1853, // Home & Living > Kitchen & Dining > Drinkware > Mugs
  1062, // Art & Collectibles > Prints > Digital Prints
  153,  // Bags & Purses > Tote Bags
  101,  // Paper & Party Supplies > Paper > Posters
  1054, // Clothing > Women's Clothing > Tops & Tees > T-shirts
  475,  // Clothing > Men's Clothing > Shirts > T-shirts
  2004, // Home & Living > Home Decor > Wall Decor > Wall Hangings
  1983, // Home & Living > Bedding > Blankets & Throws
  162   // Accessories > Hats & Caps > Baseball & Trucker Caps
];

export default function TaxonomyManagement() {
  const toast = useToast();
  const [categories, setCategories] = useState<TaxonomyCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'active' | 'inactive' | 'pod'>('all');
  
  // Confirm Modal state
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: (() => void) | null;
  }>({ isOpen: false, title: '', message: '', action: null });

  // Pagination for category list (since there can be 10,000+ items)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/taxonomy-sync');
      const data = await res.json();
      if (data.success) {
        setCategories(data.categories || []);
      } else {
        toast.error('Kategoriler alınırken hata: ' + (data.error || 'Bilinmeyen hata'));
      }
    } catch (e: any) {
      toast.error('Kategoriler yüklenirken sunucu hatası oluştu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleSyncFromEtsy = () => {
    setConfirmConfig({
      isOpen: true,
      title: 'Etsy Canlı Taksonomi Senkronizasyonu',
      message: "Etsy resmi API'sinden 10.000+ kategori ağacı çekilecek. Mevcut aktif/pasif tercihleriniz KORUNACAKTIR.\n\nDevam etmek istiyor musunuz?",
      action: async () => {
        setSyncing(true);
        try {
          const res = await fetch('/api/admin/taxonomy-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'sync' })
          });
          const data = await res.json();
          if (data.success) {
            toast.success(`Harika! Toplam ${data.count} kategori Etsy'den güncellendi.`);
            fetchCategories();
          } else {
            toast.error(`Senkronizasyon hatası: ${data.error}`);
          }
        } catch (e: any) {
          toast.error('Bağlantı hatası: ' + e.message);
        } finally {
          setSyncing(false);
        }
      }
    });
  };

  const handleToggle = async (id: number, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    // Optimistic UI update
    setCategories(prev => prev.map(c => c.id === id ? { ...c, isActive: nextStatus } : c));
    
    try {
      const res = await fetch('/api/admin/taxonomy-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', id, isActive: nextStatus })
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      toast.info(`Kategori #${id} ${nextStatus ? 'Aktifleştirildi' : 'Pasife Alındı'}.`);
    } catch (e) {
      // Revert on error
      setCategories(prev => prev.map(c => c.id === id ? { ...c, isActive: currentStatus } : c));
      toast.error('Kategori durumu güncellenemedi.');
    }
  };

  const handleActivateAllPopularPod = async () => {
    setConfirmConfig({
      isOpen: true,
      title: 'Popüler POD Kategorilerini Aktifleştir',
      message: `En sık kullanılan ${POPULAR_POD_IDS.length} adet Print-on-Demand kategorisi (T-Shirt, Sweatshirt, Kupa, Poster, Bez Çanta vb.) yapay zeka için otomatik olarak aktif hale getirilecektir.`,
      action: async () => {
        try {
          const updates = POPULAR_POD_IDS.map(id => 
            fetch('/api/admin/taxonomy-sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'update', id, isActive: true })
            })
          );
          await Promise.all(updates);
          toast.success('Popüler POD kategorileri başarıyla aktifleştirildi!');
          fetchCategories();
        } catch (e) {
          toast.error('Kategoriler aktifleştirilirken bir hata oluştu.');
        }
      }
    });
  };

  const filteredCategories = useMemo(() => {
    return categories.filter(c => {
      if (filterMode === 'active' && !c.isActive) return false;
      if (filterMode === 'inactive' && c.isActive) return false;
      if (filterMode === 'pod' && !POPULAR_POD_IDS.includes(c.id)) return false;

      if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        return (
          c.name.toLowerCase().includes(lower) || 
          c.id.toString().includes(lower) || 
          (c.path && c.path.toLowerCase().includes(lower))
        );
      }
      return true;
    });
  }, [categories, searchTerm, filterMode]);

  // Reset pagination when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterMode]);

  const totalPages = Math.max(1, Math.ceil(filteredCategories.length / itemsPerPage));
  const displayedCategories = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredCategories.slice(start, start + itemsPerPage);
  }, [filteredCategories, currentPage]);

  const activeCount = useMemo(() => categories.filter(c => c.isActive).length, [categories]);
  const podActiveCount = useMemo(() => categories.filter(c => POPULAR_POD_IDS.includes(c.id) && c.isActive).length, [categories]);

  return (
    <div className="space-y-4 sm:space-y-6 animate-fadeIn">
      {/* Header & Status Card */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="p-2.5 bg-teal-50 dark:bg-teal-950/80 text-teal-600 dark:text-teal-400 rounded-2xl border border-teal-100 dark:border-teal-800 shadow-xs">
                <FolderTree className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                    Etsy Kategori &amp; Taksonomi Yönetimi
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 uppercase tracking-wider">
                    Etsy Taxonomy V3
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Vision AI ve Yapay Zeka SEO motorunun tasarımlarınızı doğru Etsy kategorisiyle eşleştirmesi için aktif kategorileri belirleyin.
                </p>
              </div>
            </div>
          </div>

          {/* Top Quick Actions */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <button
              onClick={handleActivateAllPopularPod}
              className="flex-1 sm:flex-initial px-3.5 py-2.5 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs"
              title="T-Shirt, Sweatshirt, Kupa ve Poster gibi hazır POD kategorilerini açar"
            >
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <span>POD Şablonunu Aktifleştir</span>
            </button>

            <button 
              onClick={handleSyncFromEtsy} 
              disabled={syncing}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Etsy Senkronize Ediliyor...' : "Etsy'den Güncelle"}</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800/80">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Toplam Kategori</span>
            <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-mono">
              {categories.length > 0 ? categories.length.toLocaleString('tr-TR') : (loading ? '...' : 0)}
            </span>
          </div>

          <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-100 dark:border-emerald-900/40">
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Aktif Kategoriler</span>
            <span className="text-base sm:text-lg font-bold text-emerald-700 dark:text-emerald-300 font-mono">
              {activeCount}
            </span>
          </div>

          <div className="p-3 bg-amber-50/50 dark:bg-amber-950/30 rounded-2xl border border-amber-100 dark:border-amber-900/40">
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">Popüler POD</span>
            <span className="text-base sm:text-lg font-bold text-amber-700 dark:text-amber-300 font-mono">
              {podActiveCount} / {POPULAR_POD_IDS.length} Aktif
            </span>
          </div>

          <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/40">
            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">AI Taksonomi Rehberi</span>
            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1 mt-1">
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              <span>Prompt Entegre</span>
            </span>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Container */}
      <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Kategori adı, ID veya hiyerarşik yol ara (Örn: T-shirt, 482, Clothing)..." 
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200 placeholder-slate-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600"
              >
                Temizle
              </button>
            )}
          </div>

          <div className="text-xs text-slate-500 shrink-0">
            Gösterilen: <strong>{filteredCategories.length.toLocaleString('tr-TR')}</strong> kategori
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0 sm:flex-wrap text-xs">
          <button 
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap shrink-0 transition-colors ${
              filterMode === 'all' 
                ? 'bg-indigo-600 text-white shadow-xs font-bold' 
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Tümü ({categories.length})
          </button>
          <button 
            onClick={() => setFilterMode('active')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap shrink-0 transition-colors flex items-center gap-1.5 ${
              filterMode === 'active' 
                ? 'bg-emerald-600 text-white shadow-xs font-bold' 
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-emerald-600'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Sadece Aktif Olanlar ({activeCount})
          </button>
          <button 
            onClick={() => setFilterMode('pod')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap shrink-0 transition-colors flex items-center gap-1.5 ${
              filterMode === 'pod' 
                ? 'bg-amber-600 text-white shadow-xs font-bold' 
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-amber-600'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Popüler POD Kategorileri ({POPULAR_POD_IDS.length})
          </button>
          <button 
            onClick={() => setFilterMode('inactive')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap shrink-0 transition-colors flex items-center gap-1.5 ${
              filterMode === 'inactive' 
                ? 'bg-rose-600 text-white shadow-xs font-bold' 
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-rose-600'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            Pasif Olanlar ({categories.length - activeCount})
          </button>
        </div>
      </div>

      {/* Categories Content Container (Desktop Table + Mobile Cards) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* 1. Desktop Table View */}
        <div className="hidden md:block overflow-x-auto w-full">
          <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800 text-xs sm:text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th scope="col" className="px-5 py-3.5 font-bold uppercase tracking-wider w-24">ID</th>
                <th scope="col" className="px-5 py-3.5 font-bold uppercase tracking-wider">Kategori Adı &amp; Hiyerarşik Ağaç Yolu</th>
                <th scope="col" className="px-5 py-3.5 font-bold uppercase tracking-wider text-center w-36">Durum</th>
                <th scope="col" className="px-5 py-3.5 font-bold uppercase tracking-wider text-right w-36">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
                    Kategoriler yükleniyor...
                  </td>
                </tr>
              ) : displayedCategories.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                    <FolderTree className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    Aranan kriterlere uygun kategori bulunamadı.
                    {categories.length === 0 && (
                      <div className="mt-3">
                        <button
                          onClick={handleSyncFromEtsy}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Etsy'den Kategorileri İndir
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                displayedCategories.map((c) => {
                  const isPopularPod = POPULAR_POD_IDS.includes(c.id);
                  return (
                    <tr 
                      key={c.id} 
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                        c.isActive ? 'bg-emerald-50/20 dark:bg-emerald-950/10' : ''
                      }`}
                    >
                      <td className="px-5 py-4 whitespace-nowrap font-mono font-bold text-slate-700 dark:text-slate-300">
                        #{c.id}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white text-sm">
                            {c.name}
                          </span>
                          {isPopularPod && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 inline-flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                              POD Favori
                            </span>
                          )}
                        </div>
                        {c.path && (
                          <div className="text-xs text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1 flex-wrap font-mono">
                            {c.path.split(' > ').map((segment, idx, arr) => (
                              <React.Fragment key={idx}>
                                <span className={idx === arr.length - 1 ? 'text-slate-600 dark:text-slate-300 font-semibold' : ''}>
                                  {segment}
                                </span>
                                {idx < arr.length - 1 && <ChevronRight className="w-3 h-3 text-slate-300 dark:text-slate-700 shrink-0" />}
                              </React.Fragment>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-center">
                        {c.isActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Aktif (AI Görür)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                            <XCircle className="w-3.5 h-3.5" />
                            Pasif
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-right">
                        <button 
                          onClick={() => handleToggle(c.id, c.isActive)}
                          className={`text-xs font-bold px-3.5 py-1.5 rounded-xl border transition-all cursor-pointer ${
                            c.isActive 
                              ? 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 hover:bg-rose-100' 
                              : 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100'
                          }`}
                        >
                          {c.isActive ? 'Devre Dışı Bırak' : 'Aktifleştir'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 2. Mobile Cards View (Touch-Optimized) */}
        <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {loading ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
              Kategoriler yükleniyor...
            </div>
          ) : displayedCategories.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              Aranan kriterlere uygun kategori bulunamadı.
            </div>
          ) : (
            displayedCategories.map((c) => {
              const isPopularPod = POPULAR_POD_IDS.includes(c.id);
              return (
                <div key={c.id} className="p-4 space-y-2.5 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                          #{c.id}
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white text-sm">
                          {c.name}
                        </span>
                        {isPopularPod && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 inline-flex items-center gap-0.5">
                            <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                            POD
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {c.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200">
                          <XCircle className="w-3 h-3" />
                          Pasif
                        </span>
                      )}
                    </div>
                  </div>

                  {c.path && (
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono bg-slate-50 dark:bg-slate-950/60 p-2 rounded-xl border border-slate-100 dark:border-slate-800/60 break-words">
                      {c.path}
                    </div>
                  )}

                  <div className="flex items-center justify-end pt-1">
                    <button 
                      onClick={() => handleToggle(c.id, c.isActive)}
                      className={`w-full py-2 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                        c.isActive 
                          ? 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 hover:bg-rose-100' 
                          : 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100'
                      }`}
                    >
                      {c.isActive ? 'Devre Dışı Bırak' : 'Aktifleştir'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-3.5 sm:p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3 bg-slate-50 dark:bg-slate-900/50">
            <div className="text-xs text-slate-500">
              Sayfa <strong>{currentPage}</strong> / {totalPages} (Toplam {filteredCategories.length.toLocaleString('tr-TR')} kategori)
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 disabled:opacity-50 hover:bg-slate-100 transition-colors"
              >
                Önceki
              </button>

              <span className="text-xs font-mono text-slate-600 dark:text-slate-400 px-2">
                {currentPage} / {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 disabled:opacity-50 hover:bg-slate-100 transition-colors"
              >
                Sonraki
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={() => {
          if (confirmConfig.action) confirmConfig.action();
          setConfirmConfig({ ...confirmConfig, isOpen: false });
        }}
        onCancel={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
      />
    </div>
  );
}
