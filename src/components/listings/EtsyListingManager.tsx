'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Image from 'next/image';
import {
  RefreshCw,
  Sparkles,
  Eye,
  TrendingUp,
  Search,
  Grid,
  List,
  CheckSquare,
  Square,
  ExternalLink,
  Tag,
  ShoppingBag
} from 'lucide-react';
import { useToast } from '@/components/common/ToastContext';
import { ListingDetailModal } from './ListingDetailModal';
import { BulkActionModal, BulkActionType } from './BulkActionModal';

import type { StoredEtsyListing } from '@/types/etsy';

type EtsyListingRecord = StoredEtsyListing;

export const EtsyListingManager: React.FC = () => {
  const { success, error, warning } = useToast();

  // Data state
  const [listings, setListings] = useState<EtsyListingRecord[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    draft: 0,
    inactive: 0,
    avgScore: 0,
    analyzedCount: 0,
    lastSyncedAt: null as string | null,
    hoursSinceLastSync: null as number | null,
    isStale: false
  });

  // UI / Filter state
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [autoSyncBanner, setAutoSyncBanner] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [scoreFilter, setScoreFilter] = useState('all');
  const [visionFilter, setVisionFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Auto-detect view mode based on device screen width (desktop: table, mobile: grid)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth < 768) {
        setViewMode('grid');
      } else {
        setViewMode('table');
      }
    }
  }, []);

  // Auto-sync trigger guard (run once on mount if stale)
  const hasCheckedAutoSyncRef = useRef(false);

  // Modals state
  const [selectedListingForModal, setSelectedListingForModal] = useState<EtsyListingRecord | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<BulkActionType | null>(null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  const initialFetchRef = useRef(false);

  // Trigger automated background synchronization if data is older than 24 hours
  const triggerAutoSync = useCallback(async () => {
    setIsSyncing(true);
    setAutoSyncBanner('Etsy verileriniz 24 saatten eski olduğu için arka planda güncelleniyor, lütfen bekleyin...');
    try {
      const res = await fetch('/api/etsy/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'smart' })
      });
      const data = await res.json();
      if (data.success) {
        success(data.message || 'Etsy verileri başarıyla güncellendi!');
        // Refresh listings and stats from DB
        const refreshRes = await fetch('/api/etsy/listings');
        const refreshData = await refreshRes.json();
        if (refreshData.success) {
          setListings(refreshData.listings || []);
          if (refreshData.stats) setStats(refreshData.stats);
        }
      } else {
        // Soft notification if token is missing or not connected
        warning(data.error || 'Etsy otomatik senkronizasyonu tamamlanamadı.');
      }
    } catch (err) {
      console.error('Auto sync error:', err);
    } finally {
      setIsSyncing(false);
      setAutoSyncBanner(null);
    }
  }, [success, warning]);

  // Fetch listings from DB cache
  const fetchListings = useCallback(async (isInitial = false) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/etsy/listings');
      const data = await res.json();

      if (data.success) {
        setListings(data.listings || []);
        if (data.stats) {
          setStats(data.stats);

          // Check if data is older than 24 hours (or never synced) on initial page load
          if (isInitial && !hasCheckedAutoSyncRef.current) {
            hasCheckedAutoSyncRef.current = true;
            if (data.stats.isStale || !data.stats.lastSyncedAt || data.stats.total === 0) {
              triggerAutoSync();
            }
          }
        }
      } else {
        error(data.error || 'İlanlar yüklenirken bir hata oluştu.');
      }
    } catch (err: unknown) {
      console.error('Listings load error:', err instanceof Error ? err.message : 'unknown error');
      error('İlanlar sunucudan alınamadı.');
    } finally {
      setIsLoading(false);
    }
  }, [error, triggerAutoSync]);

  // İlk yükleme bir kez ve hemen başlatılır. (Önceki zamanlayıcı + bayrak deseni, efekt yeniden
  // çalıştığında zamanlayıcıyı iptal edip bayrak nedeniyle tekrar denemediği için ekranı
  // "Yükleniyor" durumunda bırakabiliyordu.)
  useEffect(() => {
    if (initialFetchRef.current) return;
    initialFetchRef.current = true;
    void fetchListings(true);
  }, [fetchListings]);

  // Instant in-memory filtering and sorting for 0ms responsive interaction
  const filteredAndSortedListings = useMemo(() => {
    let result = [...listings];

    // 1. Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(item => {
        const titleMatch = (item.title || '').toLowerCase().includes(q);
        const idMatch = String(item.listing_id || '').includes(q);
        const rawTags = Array.isArray(item.tags)
          ? item.tags
          : typeof item.tags === 'string'
          ? JSON.parse(item.tags)
          : [];
        const tagMatch = (rawTags as string[]).some(t => String(t).toLowerCase().includes(q));
        return titleMatch || idMatch || tagMatch;
      });
    }

    // 2. State filter
    if (stateFilter !== 'all') {
      result = result.filter(item => item.state === stateFilter);
    }

    // 3. Score filter
    if (scoreFilter !== 'all') {
      result = result.filter(item => {
        const sc = Number(item.seo_score || 0);
        if (scoreFilter === 'critical') return sc < 50;
        if (scoreFilter === 'warning') return sc >= 50 && sc < 75;
        if (scoreFilter === 'good') return sc >= 75 && sc < 90;
        if (scoreFilter === 'excellent') return sc >= 90;
        return true;
      });
    }

    // 4. Vision filter
    if (visionFilter !== 'all') {
      result = result.filter(item => {
        const va = typeof item.vision_analysis === 'string'
          ? JSON.parse(item.vision_analysis)
          : (item.vision_analysis || {});
        const hasVision = Boolean(va && (va.primarySubject || va.description || va.analyzedAt));
        if (visionFilter === 'analyzed') return hasVision;
        if (visionFilter === 'not_analyzed') return !hasVision;
        return true;
      });
    }

    // 5. Sorting
    result.sort((a, b) => {
      if (sortBy === 'score_desc') return (Number(b.seo_score) || 0) - (Number(a.seo_score) || 0);
      if (sortBy === 'score_asc') return (Number(a.seo_score) || 0) - (Number(b.seo_score) || 0);
      if (sortBy === 'views_desc') return (Number(b.views) || 0) - (Number(a.views) || 0);
      if (sortBy === 'views_asc') return (Number(a.views) || 0) - (Number(b.views) || 0);
      if (sortBy === 'favorers_desc') return (Number(b.num_favorers) || 0) - (Number(a.num_favorers) || 0);
      if (sortBy === 'favorers_asc') return (Number(a.num_favorers) || 0) - (Number(b.num_favorers) || 0);
      if (sortBy === 'price_desc') return (Number(b.price) || 0) - (Number(a.price) || 0);
      if (sortBy === 'price_asc') return (Number(a.price) || 0) - (Number(b.price) || 0);
      if (sortBy === 'title_asc') return (a.title || '').localeCompare(b.title || '');
      if (sortBy === 'title_desc') return (b.title || '').localeCompare(a.title || '');
      const getTime = (val: unknown) => {
        if (typeof val === 'string' || typeof val === 'number') return new Date(val).getTime();
        if (val instanceof Date) return val.getTime();
        return 0;
      };

      if (sortBy === 'oldest') {
        const dateA = getTime(a.updated_at || a.created_at);
        const dateB = getTime(b.updated_at || b.created_at);
        return dateA - dateB;
      }
      // default: newest
      const dateA = getTime(a.updated_at || a.created_at);
      const dateB = getTime(b.updated_at || b.created_at);
      return dateB - dateA;
    });

    return result;
  }, [listings, searchQuery, stateFilter, scoreFilter, visionFilter, sortBy]);

  // Manual Trigger for Etsy Synchronization
  const handleSyncEtsy = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/etsy/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'smart' })
      });
      const data = await res.json();

      if (data.success) {
        success(data.message || 'Etsy ilanları başarıyla senkronize edildi!');
        fetchListings(false);
      } else {
        error(data.error || 'Etsy senkronizasyonu başarısız oldu.');
      }
    } catch (err: unknown) {
      console.error('Sync error:', err instanceof Error ? err.message : 'unknown error');
      error('Etsy senkronizasyonu sırasında hata oluştu.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Multi-select handlers
  const handleToggleSelect = (listingId: string) => {
    setSelectedIds(prev =>
      prev.includes(listingId) ? prev.filter(id => id !== listingId) : [...prev, listingId]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredAndSortedListings.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredAndSortedListings.map(l => l.listing_id));
    }
  };

  // Open Detail Modal
  const handleOpenDetail = (listing: EtsyListingRecord) => {
    setSelectedListingForModal(listing);
    setIsDetailModalOpen(true);
  };

  // Callback when a listing is updated in detail modal
  const handleListingUpdated = (updated: EtsyListingRecord) => {
    setListings(prev =>
      prev.map(l => (String(l.listing_id) === String(updated.listing_id) ? { ...l, ...updated } : l))
    );
    if (selectedListingForModal && String(selectedListingForModal.listing_id) === String(updated.listing_id)) {
      setSelectedListingForModal(updated);
    }
  };

  // Open Bulk Modal
  const handleOpenBulkModal = (type: BulkActionType) => {
    setBulkActionType(type);
    setIsBulkModalOpen(true);
  };

  // Score color helper
  const getScoreColor = (sc: number) => {
    if (sc >= 85) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (sc >= 60) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
  };

  const selectedListingsList = listings.filter(l => selectedIds.includes(l.listing_id));

  return (
    <div className="space-y-6">

      {/* 24-HOUR AUTO SYNC NOTIFICATION BANNER */}
      {autoSyncBanner && (
        <div className="bg-gradient-to-r from-indigo-900/80 via-purple-900/80 to-indigo-900/80 border border-indigo-500/50 rounded-2xl p-4 text-indigo-100 flex items-center justify-between gap-3 shadow-xl backdrop-blur animate-pulse">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-xl">
              <RefreshCw className="w-5 h-5 text-indigo-300 animate-spin" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                <span>Otomatik Arka Plan Senkronizasyonu</span>
                <span className="text-[10px] bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-full font-mono">24 Saat Kuralı</span>
              </div>
              <p className="text-xs text-indigo-200/90 mt-0.5">{autoSyncBanner}</p>
            </div>
          </div>
        </div>
      )}
      
      {/* 1. TOP STATS & HEADER BANNER */}
      <div className="bg-slate-900 text-white p-4 sm:p-6 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 relative z-10">
          <div className="flex items-start sm:items-center space-x-3.5">
            <div className="p-3 bg-gradient-to-tr from-indigo-600 to-purple-600 text-white rounded-2xl shadow-lg shadow-indigo-500/20 shrink-0">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-white">
                  Etsy İlan Yönetimi & AI SEO Denetçisi
                </h2>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded-full uppercase font-mono font-bold">
                  DB Önbellekli
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Etsy mağazanızdaki tüm ilanları senkronize edin, kapak görsellerini Vision AI ile analiz edin, SEO puanlarını 0-100 arası denetleyin ve tek tıkla yapay zeka ile güncelleyin.
              </p>
            </div>
          </div>

          {/* Action Button: Clean Single Primary Sync Button */}
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <button
              onClick={handleSyncEtsy}
              disabled={isSyncing}
              className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-lg hover:shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              title="Etsy'deki en güncel ilan, görüntülenme ve favori verilerini çeker (24 saatte bir otomatik güncellenir)"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Senkronize Ediliyor...' : '🔄 Etsy Verilerini Güncelle'}</span>
            </button>
          </div>

        </div>

        {/* 4 Metrics Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800/80">
          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-400 font-medium">Toplam İlan</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-extrabold text-white">{stats.total}</span>
              <span className="text-[10px] text-slate-500 font-mono">
                ({stats.active} Aktif / {stats.draft} Taslak)
              </span>
            </div>
          </div>

          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-400 font-medium">Ortalama Mağaza SEO Skoru</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-xl font-extrabold ${getScoreColor(stats.avgScore)}`}>
                {stats.avgScore}/100
              </span>
              <span className="text-[10px] text-slate-400">
                {stats.avgScore >= 85 ? '🌟 Mükemmel' : stats.avgScore >= 65 ? '✅ İyi' : '⚠️ Geliştirilmeli'}
              </span>
            </div>
          </div>

          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-400 font-medium">Görsel (Vision) Analizi</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-extrabold text-indigo-400">{stats.analyzedCount}</span>
              <span className="text-[10px] text-slate-500">/ {stats.total} İlan</span>
            </div>
          </div>

          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-medium">Son Senkronizasyon</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                stats.isStale ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
              }`}>
                {stats.isStale ? '🕒 Yenilenmeli' : '✅ Güncel'}
              </span>
            </div>
            <div className="text-xs font-semibold text-slate-200 mt-1 truncate">
              {stats.lastSyncedAt 
                ? `${new Date(stats.lastSyncedAt).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}${stats.hoursSinceLastSync !== null && stats.hoursSinceLastSync < 24 ? ` (${stats.hoursSinceLastSync < 1 ? 'Az önce' : `${Math.floor(stats.hoursSinceLastSync)} sa önce`})` : ''}`
                : 'Henüz senkronize edilmedi'}
            </div>
          </div>
        </div>
      </div>

      {/* 2. FILTER & SEARCH TOOLBAR */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          
          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Başlık, ID veya Etiket ara..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* State Filter */}
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-xl px-3 py-2 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">Durum: Tümü ({stats.total})</option>
              <option value="active">🟢 Aktif ({stats.active})</option>
              <option value="draft">📝 Taslak ({stats.draft})</option>
              <option value="inactive">⏸️ Pasif ({stats.inactive})</option>
            </select>

            {/* Score Filter */}
            <select
              value={scoreFilter}
              onChange={(e) => setScoreFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-xl px-3 py-2 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">SEO Skoru: Tümü</option>
              <option value="excellent">🌟 Mükemmel (90-100)</option>
              <option value="good">✅ İyi (75-89)</option>
              <option value="warning">⚠️ Geliştirilmeli (50-74)</option>
              <option value="critical">🚨 Kritik (&lt;50)</option>
            </select>

            {/* Vision Filter */}
            <select
              value={visionFilter}
              onChange={(e) => setVisionFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-xl px-3 py-2 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">Görsel Analiz: Tümü</option>
              <option value="analyzed">👁️ Analiz Edilenler ({stats.analyzedCount})</option>
              <option value="not_analyzed">⏳ Analiz Bekleyenler ({stats.total - stats.analyzedCount})</option>
            </select>

            {/* Sort Filter */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-xl px-3 py-2 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="newest">Sıralama: En Yeni</option>
              <option value="oldest">Sıralama: En Eski</option>
              <option value="views_desc">👁️ En Çok Görüntülenen</option>
              <option value="views_asc">👁️ En Az Görüntülenen</option>
              <option value="favorers_desc">❤️ En Çok Favorilenen</option>
              <option value="favorers_asc">❤️ En Az Favorilenen</option>
              <option value="score_desc">📈 SEO: Yüksekten Düşüğe</option>
              <option value="score_asc">📉 SEO: Düşükten Yükseğe</option>
              <option value="price_desc">💵 Fiyat: Yüksekten Düşüğe</option>
              <option value="price_asc">💵 Fiyat: Düşükten Yükseğe</option>
              <option value="title_asc">🔤 Başlık (A-Z)</option>
              <option value="title_desc">🔤 Başlık (Z-A)</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
                title="Kart Görünümü"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
                title="Tablo Görünümü"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Selection Action Bar */}
        {filteredAndSortedListings.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div className="flex items-center gap-3">
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-semibold"
              >
                {selectedIds.length === filteredAndSortedListings.length && filteredAndSortedListings.length > 0 ? (
                  <CheckSquare className="w-4 h-4 text-indigo-500" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>Tümünü Seç ({selectedIds.length}/{filteredAndSortedListings.length})</span>
              </button>
            </div>

            {selectedIds.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-400 font-mono text-[11px] bg-slate-800/60 px-2 py-1 rounded-md">
                  {selectedIds.length} ilan seçildi:
                </span>
                <button
                  onClick={() => handleOpenBulkModal('evaluate_seo')}
                  className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>📊 Seçilileri Puanla</span>
                </button>
                <button
                  onClick={() => handleOpenBulkModal('vision')}
                  className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>👁️ Seçilileri Analiz Et</span>
                </button>
                <button
                  onClick={() => handleOpenBulkModal('optimize')}
                  className="px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>🪄 Seçililere AI SEO Üret</span>
                </button>
                <button
                  onClick={() => setSelectedIds([])}
                  className="text-slate-400 hover:text-slate-200 text-xs underline ml-1"
                >
                  Vazgeç
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. LISTINGS CONTENT (GRID OR TABLE) */}
      {isLoading ? (
        <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
          <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">İlanlar Yükleniyor...</h4>
          <p className="text-xs text-slate-500">Veritabanından önbellek kayıtları çekiliyor</p>
        </div>
      ) : filteredAndSortedListings.length === 0 ? (
        <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mx-auto">
            <ShoppingBag className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {stats.total === 0 ? 'Veritabanında Henüz Etsy İlanı Bulunmuyor' : 'Filtreye Uygun İlan Bulunamadı'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              {stats.total === 0
                ? 'Etsy mağazanızdaki ilanları veritabanınıza çekmek için "Etsy Verilerini Güncelle" butonuna tıklayın.'
                : 'Arama veya filtre kriterlerinizi değiştirerek tekrar deneyin.'}
            </p>
          </div>
          {stats.total === 0 && (
            <button
              onClick={handleSyncEtsy}
              disabled={isSyncing}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-lg transition-all inline-flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Etsy Verileri Çekiliyor...' : '🔄 Etsy Verilerini Güncelle'}</span>
            </button>
          )}

        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAndSortedListings.map((item) => {
            const isSelected = selectedIds.includes(item.listing_id);
            const score = Number(item.seo_score || 0);
            const rawTags = Array.isArray(item.tags)
              ? item.tags
              : typeof item.tags === 'string'
              ? JSON.parse(item.tags)
              : [];
            const tagCount = rawTags.length;
            const vision = typeof item.vision_analysis === 'string'
              ? JSON.parse(item.vision_analysis)
              : item.vision_analysis || {};
            const imageUrl = item.primary_image_url || item.images?.[0]?.url_570xN || item.images?.[0]?.url_fullxfull || '/placeholder.png';

            return (
              <div
                key={item.listing_id}
                className={`bg-white dark:bg-slate-900 rounded-2xl border transition-all hover:shadow-lg flex flex-col overflow-hidden group ${
                  isSelected
                    ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                {/* Card Top: Image + Badges */}
                <div className="relative aspect-video bg-slate-950 overflow-hidden">
                  <Image
                    loader={({ src }) => src}
                    src={imageUrl}
                    alt={item.title || 'Etsy ilan görseli'}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1280px) 33vw, 25vw"
                    unoptimized
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />

                  {/* Multi-select check */}
                  <button
                    onClick={() => handleToggleSelect(item.listing_id)}
                    className="absolute top-2.5 left-2.5 z-10 p-1.5 rounded-lg bg-black/60 backdrop-blur-md text-white hover:bg-black/80 transition-colors"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-indigo-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-300" />
                    )}
                  </button>

                  {/* State badge */}
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md backdrop-blur-md uppercase tracking-wider ${
                      item.state === 'active'
                        ? 'bg-emerald-500/90 text-white'
                        : 'bg-amber-500/90 text-slate-950'
                    }`}>
                      {item.state === 'active' ? 'Aktif' : item.state}
                    </span>
                  </div>

                  {/* SEO Score Pill */}
                  <div className="absolute bottom-2.5 left-2.5">
                    <div className={`px-2.5 py-1 rounded-lg backdrop-blur-md border text-xs font-black flex items-center gap-1.5 shadow-md ${
                      score >= 85
                        ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50'
                        : score >= 60
                        ? 'bg-amber-950/90 text-amber-300 border-amber-500/50'
                        : 'bg-rose-950/90 text-rose-300 border-rose-500/50'
                    }`}>
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>SEO: {score}/100 ({score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'F'})</span>
                    </div>
                  </div>

                  {/* Views & Favs */}
                  <div className="absolute bottom-2.5 right-2.5 flex items-center gap-2 text-[10px] font-bold text-white bg-black/70 backdrop-blur-md px-2 py-1 rounded-lg">
                    <span>👁️ {item.views || 0}</span>
                    <span>❤️ {item.num_favorers || 0}</span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-mono">#{item.listing_id}</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        ${item.price} {item.currency_code}
                      </span>
                    </div>

                    <h4
                      className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug cursor-pointer hover:text-indigo-500 transition-colors"
                      onClick={() => handleOpenDetail(item)}
                      title={item.title ?? undefined}
                    >
                      {item.title || 'Başlıksız İlan'}
                    </h4>

                    {/* Vision Status / Subject pill */}
                    {vision.primarySubject ? (
                      <div className="text-[11px] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 p-2 rounded-lg border border-indigo-100 dark:border-indigo-900/40 flex items-center gap-1.5 truncate">
                        <Eye className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{vision.primarySubject}</span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <span>Görsel analizi yapılmadı</span>
                        <span className="text-indigo-500 font-semibold cursor-pointer" onClick={() => handleOpenDetail(item)}>
                          Analiz Et &rarr;
                        </span>
                      </div>
                    )}

                    {/* Tag count meter */}
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Tag className="w-3 h-3 text-slate-400" />
                        <span>Etiketler:</span>
                      </span>
                      <span className={`font-mono font-bold ${tagCount === 13 ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {tagCount}/13 {tagCount < 13 && `(${13 - tagCount} eksik)`}
                      </span>
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                    <button
                      onClick={() => handleOpenDetail(item)}
                      className="flex-1 py-2 px-3 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>İncele & SEO</span>
                    </button>

                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                        title="Etsy'de Görüntüle"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 uppercase font-mono text-[10px]">
                <tr>
                  <th className="p-3.5 w-10">
                    <button onClick={handleSelectAll}>
                      {selectedIds.length === filteredAndSortedListings.length && filteredAndSortedListings.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-indigo-500" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </th>
                  <th className="p-3.5">İlan / Görsel</th>
                  <th className="p-3.5">SEO Skoru</th>
                  <th className="p-3.5">Etiketler</th>
                  <th className="p-3.5">Vision Analizi</th>
                  <th className="p-3.5">Fiyat / Durum</th>
                  <th className="p-3.5">Görüntülenme</th>
                  <th className="p-3.5 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredAndSortedListings.map((item) => {
                  const isSelected = selectedIds.includes(item.listing_id);
                  const score = Number(item.seo_score || 0);
                  const rawTags = Array.isArray(item.tags)
                    ? item.tags
                    : typeof item.tags === 'string'
                    ? JSON.parse(item.tags)
                    : [];
                  const vision = typeof item.vision_analysis === 'string'
                    ? JSON.parse(item.vision_analysis)
                    : item.vision_analysis || {};
                  const imageUrl = item.primary_image_url || item.images?.[0]?.url_570xN || item.images?.[0]?.url_fullxfull || '/placeholder.png';

                  return (
                    <tr
                      key={item.listing_id}
                      className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors ${
                        isSelected ? 'bg-indigo-50/30 dark:bg-indigo-950/20' : ''
                      }`}
                    >
                      <td className="p-3.5">
                        <button onClick={() => handleToggleSelect(item.listing_id)}>
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-500" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                      </td>

                      <td className="p-3.5">
                        <div className="flex items-center space-x-3">
                          <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-900 border border-slate-700 shrink-0">
                            <Image
                              loader={({ src }) => src}
                              src={imageUrl}
                              alt={item.title || 'Etsy ilan görseli'}
                              fill
                              sizes="48px"
                              unoptimized
                              className="object-cover"
                            />
                          </div>
                          <div className="min-w-0 max-w-sm">
                            <div className="text-[10px] font-mono text-slate-400">#{item.listing_id}</div>
                            <div
                              onClick={() => handleOpenDetail(item)}
                              className="font-bold text-slate-900 dark:text-white truncate cursor-pointer hover:text-indigo-500"
                              title={item.title ?? undefined}
                            >
                              {item.title || 'Başlıksız İlan'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border inline-flex items-center gap-1 ${getScoreColor(score)}`}>
                          <TrendingUp className="w-3 h-3" />
                          <span>{score}/100 ({score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'F'})</span>
                        </span>
                      </td>

                      <td className="p-3.5">
                        <span className={`font-mono text-xs font-bold ${rawTags.length === 13 ? 'text-emerald-500' : 'text-amber-500'}`}>
                          {rawTags.length} / 13
                        </span>
                      </td>

                      <td className="p-3.5">
                        {vision.primarySubject ? (
                          <span className="text-xs text-indigo-400 font-medium truncate max-w-xs block" title={vision.primarySubject}>
                            👁️ {vision.primarySubject}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500 italic">Analiz Yok</span>
                        )}
                      </td>

                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 dark:text-white">
                          ${item.price} {item.currency_code}
                        </div>
                        <span className={`text-[10px] font-bold uppercase ${item.state === 'active' ? 'text-emerald-500' : 'text-amber-500'}`}>
                          {item.state}
                        </span>
                      </td>

                      <td className="p-3.5 text-slate-500 dark:text-slate-400">
                        <div>👁️ {item.views || 0}</div>
                        <div>❤️ {item.num_favorers || 0}</div>
                      </td>

                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenDetail(item)}
                            className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg font-bold text-xs transition-colors"
                          >
                            İncele & SEO
                          </button>
                          {item.url && (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 bg-slate-800 text-slate-400 hover:text-white rounded-lg"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. MODALS */}
      {/* Detail & SEO Audit Modal */}
      <ListingDetailModal
        listing={selectedListingForModal}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedListingForModal(null);
        }}
        onListingUpdated={handleListingUpdated}
      />

      {/* Bulk Operations Modal */}
      {bulkActionType && (
        <BulkActionModal
          isOpen={isBulkModalOpen}
          onClose={() => {
            setIsBulkModalOpen(false);
            setBulkActionType(null);
          }}
          actionType={bulkActionType}
          selectedListings={selectedListingsList}
          allListings={listings}
          onCompleted={() => {
            fetchListings();
            setSelectedIds([]);
          }}
        />
      )}

    </div>
  );
};
