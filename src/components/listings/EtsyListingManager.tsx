'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Image from 'next/image';
import {
  RefreshCw,
  Sparkles,
  Eye,
  TrendingUp,
  Search,
  CheckSquare,
  Square,
  ShoppingBag,
  Heart,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useToast } from '@/components/common/ToastContext';
import { useAuth } from '@/components/common/UserAuthContext';
import { ListingDetailModal } from './ListingDetailModal';
import { BulkActionModal, BulkActionType } from './BulkActionModal';

import type { StoredEtsyListing } from '@/types/etsy';
import { Spinner } from '@/components/common/Spinner';
import { TabSkeleton } from '@/components/common/LoadingScreens';
import { formatListingState } from '@/lib/etsy-format';

type EtsyListingRecord = StoredEtsyListing;
type ListingStats = {
  total: number; active: number; draft: number; inactive: number; other: number; avgScore: number;
  totalViews: number; totalFavorites: number; analyzedCount: number;
  lastSyncedAt: string | null; hoursSinceLastSync: number | null; isStale: boolean;
};

/**
 * Son yüklenen ilanlar ve istatistikler (sekmeler arası geçişte ekran beklemeden, hazır açılsın; arka planda
 * sessizce yenilenir). Yalnızca bu oturumun belleğinde tutulur.
 */
let listingsCache: { userId: string; listings: EtsyListingRecord[]; stats: ListingStats } | null = null;

export const EtsyListingManager: React.FC = () => {
  const { success, error, warning } = useToast();
  const { user } = useAuth();
  // Önbellek yalnızca aynı hesap için kullanılır.
  const cached = listingsCache && listingsCache.userId === user?.id ? listingsCache : null;

  // Data state
  const [listings, setListings] = useState<EtsyListingRecord[]>(() => cached?.listings ?? []);
  const [stats, setStats] = useState<ListingStats>(() => cached?.stats ?? {
    total: 0,
    active: 0,
    draft: 0,
    inactive: 0,
    other: 0,
    avgScore: 0,
    totalViews: 0,
    totalFavorites: 0,
    analyzedCount: 0,
    lastSyncedAt: null as string | null,
    hoursSinceLastSync: null as number | null,
    isStale: false
  });
  // İlk açılışta sayfa, ilanlar ve istatistikler hazır olunca bir kerede gösterilir.
  const [initialLoaded, setInitialLoaded] = useState(() => cached !== null);
  const openedFromCacheRef = useRef(cached !== null);
  useEffect(() => {
    if (initialLoaded && user?.id) listingsCache = { userId: user.id, listings, stats };
  }, [listings, stats, initialLoaded, user?.id]);

  // UI / Filter state
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [etsyNotConnected, setEtsyNotConnected] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [scoreFilter, setScoreFilter] = useState('all');
  const [visionFilter, setVisionFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Auto-sync trigger guard (run once on mount if stale)
  const hasCheckedAutoSyncRef = useRef(false);

  // Modals state
  const [selectedListingForModal, setSelectedListingForModal] = useState<EtsyListingRecord | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const detailRequestRef = useRef(0);
  const [bulkActionType, setBulkActionType] = useState<BulkActionType | null>(null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  const initialFetchRef = useRef(false);

  // Trigger automated background synchronization if data is older than 24 hours
  const triggerAutoSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/etsy/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'smart' })
      });
      const data = await res.json();
      if (data.success) {
        if (data.partial) warning(data.message);
        else success(data.message || 'Etsy verileri başarıyla güncellendi!');
        // Refresh listings and stats from DB
        const refreshRes = await fetch('/api/etsy/listings');
        const refreshData = await refreshRes.json();
        if (refreshData.success) {
          setListings(refreshData.listings || []);
          if (refreshData.stats) setStats(refreshData.stats);
        }
      } else {
        // Soft notification if token is missing or not connected
        if (data.notConnected) setEtsyNotConnected(true);
        warning(data.error || 'Etsy otomatik senkronizasyonu tamamlanamadı.');
      }
    } catch (err) {
      console.error('Auto sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [success, warning]);

  // Fetch listings from DB cache
  const fetchListings = useCallback(async (isInitial = false) => {
    // Önbellekten açıldıysa yenileme sessizdir (ekrandaki liste kaybolmaz).
    if (!(isInitial && openedFromCacheRef.current)) setIsLoading(true);
    try {
      const res = await fetch('/api/etsy/listings');
      const data = await res.json();

      if (data.success) {
        if (data.stats) setStats(data.stats);
        setListings(data.listings || []);
        if (data.stats) {

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
      setInitialLoaded(true);
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

      // "En yeni": ilanın Etsy'de son güncellendiği zaman (her senkronda değişen kayıt zamanı değil).
      const etsyTime = (item: EtsyListingRecord) => {
        const ts = Number(item.etsy_updated_timestamp || 0);
        return ts > 0 ? ts * 1000 : getTime(item.created_at);
      };
      if (sortBy === 'oldest') return etsyTime(a) - etsyTime(b);
      return etsyTime(b) - etsyTime(a);
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
        if (data.partial) warning(data.message);
        else success(data.message || 'Etsy ilanları başarıyla senkronize edildi!');
        setEtsyNotConnected(false);
        fetchListings(false);
      } else {
        if (data.notConnected) setEtsyNotConnected(true);
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
  const handleOpenDetail = async (listing: EtsyListingRecord) => {
    setSelectedListingForModal(listing);
    setIsDetailModalOpen(true);

    // Liste görünümü hafif alanlarla gelir; açıklama, SEO kırılımı ve AI önerileri burada yüklenir.
    const requestId = ++detailRequestRef.current;
    setIsDetailLoading(true);
    try {
      const res = await fetch(`/api/etsy/listings?listing_id=${encodeURIComponent(String(listing.listing_id))}&inventory=false`);
      const data = await res.json();
      if (requestId !== detailRequestRef.current) return;
      if (data.success && data.listing) {
        setSelectedListingForModal((current) =>
          current && String(current.listing_id) === String(listing.listing_id) ? { ...current, ...data.listing } : current
        );
      } else {
        warning(data.error || 'İlan ayrıntıları yüklenemedi; bazı alanlar boş görünebilir.');
      }
    } catch {
      if (requestId === detailRequestRef.current) warning('İlan ayrıntıları yüklenemedi; bazı alanlar boş görünebilir.');
    } finally {
      if (requestId === detailRequestRef.current) setIsDetailLoading(false);
    }
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

  const selectedListingsList = useMemo(() => listings.filter(l => selectedIds.includes(l.listing_id)), [listings, selectedIds]);

  const syncLabel = isSyncing
    ? 'Etsy ile güncelleniyor…'
    : stats.lastSyncedAt
    ? `Son güncelleme: ${formatSyncAge(stats.hoursSinceLastSync, stats.lastSyncedAt)}`
    : 'Henüz Etsy ile eşitlenmedi';
  const extraFilterCount = (scoreFilter !== 'all' ? 1 : 0) + (visionFilter !== 'all' ? 1 : 0);
  const stateChips: Array<{ key: string; label: string; count: number }> = [
    { key: 'all', label: 'Tümü', count: stats.total },
    { key: 'active', label: 'Aktif', count: stats.active },
    { key: 'draft', label: 'Taslak', count: stats.draft },
    { key: 'inactive', label: 'Pasif', count: stats.inactive },
    ...(stats.other > 0 ? [{ key: 'sold_out', label: 'Tükendi', count: 0 }, { key: 'expired', label: 'Süresi doldu', count: 0 }] : []),
  ];

  if (!initialLoaded) return <TabSkeleton label="Etsy ilanları yükleniyor" layout="list" />;

  return (
    <div className="space-y-4">
      {/* Başlık, eşitleme durumu ve özet */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-indigo-500 shrink-0" /> Etsy&apos;deki İlanlarım
            </h2>
            <p className={`text-[11px] mt-0.5 flex items-center gap-1.5 ${stats.isStale && !isSyncing ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
              {isSyncing && <Spinner className="w-3 h-3" />}
              {syncLabel}
              {!isSyncing && <span className="text-slate-400">· 24 saatte bir otomatik</span>}
            </p>
          </div>
          <button
            onClick={handleSyncEtsy}
            disabled={isSyncing}
            className="shrink-0 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 disabled:opacity-50"
            title="Etsy'deki en güncel ilan, görüntülenme ve favori verilerini çeker"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Şimdi güncelle</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatTile label="İlan" value={stats.total.toLocaleString('tr-TR')} hint={`${stats.active} aktif · ${stats.draft} taslak`} />
          <StatTile label="Görüntülenme" value={stats.totalViews.toLocaleString('tr-TR')} hint="tüm ilanlar, toplam" icon={<Eye className="w-3.5 h-3.5" />} />
          <StatTile label="Favori" value={stats.totalFavorites.toLocaleString('tr-TR')} hint="tüm ilanlar, toplam" icon={<Heart className="w-3.5 h-3.5" />} />
          <StatTile
            label="SEO ortalaması"
            value={`${stats.avgScore}/100`}
            hint={stats.active > 0 ? 'aktif ilanlar' : 'tüm ilanlar'}
            valueClassName={scoreTextColor(stats.avgScore)}
            title="Uygulamanın SEO puanlaması: başlık, 13 etiket, açıklama ve anahtar kelime havuzuna göre hesaplanır (Etsy'nin kendi puanı değildir)."
          />
        </div>
      </div>

      {/* Arama ve filtreler */}
      <div className="space-y-2.5">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              inputMode="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Başlık, etiket veya ilan no ara…"
              aria-label="İlan ara"
              className="w-full pl-9 pr-9 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery('')} aria-label="Aramayı temizle" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label="Sıralama"
            className="w-32 sm:w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs rounded-xl px-2.5 py-2 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="newest">En yeni</option>
            <option value="oldest">En eski</option>
            <option value="views_desc">En çok görüntülenen</option>
            <option value="favorers_desc">En çok favorilenen</option>
            <option value="score_asc">SEO: en düşük önce</option>
            <option value="score_desc">SEO: en yüksek önce</option>
            <option value="price_desc">Fiyat: yüksek → düşük</option>
            <option value="price_asc">Fiyat: düşük → yüksek</option>
            <option value="title_asc">Başlık (A-Z)</option>
          </select>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {stateChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => setStateFilter(chip.key)}
              aria-pressed={stateFilter === chip.key}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                stateFilter === chip.key
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
              }`}
            >
              {chip.label}{chip.key !== 'sold_out' && chip.key !== 'expired' ? <span className="ml-1 opacity-60">{chip.count}</span> : null}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowMoreFilters((v) => !v)}
            aria-expanded={showMoreFilters}
            className={`shrink-0 ml-auto px-3 py-1.5 rounded-full text-xs font-semibold border flex items-center gap-1 ${
              extraFilterCount > 0 ? 'border-indigo-400 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" /> Filtre{extraFilterCount > 0 ? ` (${extraFilterCount})` : ''}
          </button>
        </div>

        {showMoreFilters && (
          <div className="grid grid-cols-2 gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 space-y-1">
              <span>SEO puanı</span>
              <select value={scoreFilter} onChange={(e) => setScoreFilter(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-lg px-2 py-1.5 text-slate-700 dark:text-slate-200">
                <option value="all">Tümü</option>
                <option value="excellent">Mükemmel (90+)</option>
                <option value="good">İyi (75-89)</option>
                <option value="warning">Geliştirilmeli (50-74)</option>
                <option value="critical">Kritik (&lt;50)</option>
              </select>
            </label>
            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 space-y-1">
              <span>Görsel analiz ({stats.analyzedCount}/{stats.total})</span>
              <select value={visionFilter} onChange={(e) => setVisionFilter(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-lg px-2 py-1.5 text-slate-700 dark:text-slate-200">
                <option value="all">Tümü</option>
                <option value="analyzed">Analiz edilenler</option>
                <option value="not_analyzed">Analiz bekleyenler</option>
              </select>
            </label>
          </div>
        )}

        {filteredAndSortedListings.length > 0 && (
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{filteredAndSortedListings.length} ilan</span>
            <button onClick={handleSelectAll} className="flex items-center gap-1.5 font-semibold hover:text-indigo-600 dark:hover:text-indigo-400">
              {selectedIds.length === filteredAndSortedListings.length ? <CheckSquare className="w-4 h-4 text-indigo-500" /> : <Square className="w-4 h-4" />}
              {selectedIds.length > 0 ? `${selectedIds.length} seçili` : 'Tümünü seç'}
            </button>
          </div>
        )}
      </div>

      {/* İlanlar */}
      {isLoading ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
          <Spinner className="w-7 h-7 text-indigo-500 mx-auto" />
          <p className="text-xs text-slate-500">İlanlar yükleniyor…</p>
        </div>
      ) : filteredAndSortedListings.length === 0 ? (
        <div className="p-10 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 space-y-3">
          <ShoppingBag className="w-10 h-10 mx-auto text-indigo-500/60" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {stats.total === 0 ? 'Henüz Etsy ilanı yok' : 'Filtreye uygun ilan bulunamadı'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {stats.total === 0 && etsyNotConnected
              ? 'İlanlarınızı görmek için Etsy mağazanızı bağlayın.'
              : stats.total === 0
              ? 'Etsy mağazanızdaki ilanları getirmek için "Şimdi güncelle"ye dokunun.'
              : 'Arama veya filtreleri değiştirerek tekrar deneyin.'}
          </p>
          {stats.total === 0 && etsyNotConnected && (
            <a href="/api/etsy/auth?returnUrl=/" className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl inline-flex items-center gap-2">
              Etsy Mağazamı Bağla
            </a>
          )}
          {stats.total === 0 && !etsyNotConnected && (
            <button onClick={handleSyncEtsy} disabled={isSyncing} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl inline-flex items-center gap-2 disabled:opacity-50">
              {isSyncing ? <Spinner className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />} Şimdi güncelle
            </button>
          )}
        </div>
      ) : (
        // Etsy arama sonuçları gibi: telefonda iki sütun, büyük ekranda beş sütuna kadar.
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-3 gap-y-5 sm:gap-x-4">
          {filteredAndSortedListings.map((item) => {
            const isSelected = selectedIds.includes(item.listing_id);
            const score = Number(item.seo_score || 0);
            const imageUrl = item.primary_image_url || item.images?.[0]?.url_570xN || item.images?.[0]?.url_fullxfull || '/placeholder.png';
            return (
              <div key={item.listing_id} className="group relative flex flex-col min-w-0">
                <button
                  type="button"
                  onClick={() => handleToggleSelect(item.listing_id)}
                  aria-label={isSelected ? 'Seçimi kaldır' : 'İlanı seç'}
                  aria-pressed={isSelected}
                  className={`absolute top-2 left-2 z-10 p-1 rounded-md backdrop-blur-md transition-opacity ${isSelected || selectedIds.length > 0 ? 'opacity-100' : 'opacity-80 sm:opacity-0 sm:group-hover:opacity-100'} bg-black/50 text-white`}
                >
                  {isSelected ? <CheckSquare className="w-4 h-4 text-indigo-300" /> : <Square className="w-4 h-4" />}
                </button>
                <button type="button" onClick={() => handleOpenDetail(item)} className="text-left flex flex-col flex-1 min-w-0">
                  <div className={`relative aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 ring-1 transition-shadow group-hover:shadow-lg ${isSelected ? 'ring-2 ring-indigo-500' : 'ring-slate-200 dark:ring-slate-800'}`}>
                    <Image
                      loader={({ src }) => src}
                      src={imageUrl}
                      alt={item.title || 'Etsy ilan görseli'}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                      unoptimized
                      className="object-cover group-hover:scale-[1.03] transition-transform duration-300"
                    />
                    {item.state !== 'active' && (
                      <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold bg-amber-400 text-slate-950">
                        {formatListingState(item.state)}
                      </span>
                    )}
                    <span className={`absolute bottom-2 left-2 px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold flex items-center gap-1 ${scoreBadgeColor(score)}`} title="SEO puanı">
                      <TrendingUp className="w-3 h-3" /> {score}
                    </span>
                  </div>
                  <div className="pt-2 space-y-0.5 min-w-0">
                    <p className="text-xs sm:text-[13px] leading-snug text-slate-800 dark:text-slate-100 line-clamp-2">{item.title || 'Başlıksız ilan'}</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{formatPrice(item.price, item.currency_code)}</p>
                    <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2.5">
                      <span className="inline-flex items-center gap-0.5"><Eye className="w-3 h-3" aria-label="Görüntülenme" />{item.views || 0}</span>
                      <span className="inline-flex items-center gap-0.5"><Heart className="w-3 h-3" aria-label="Favori" />{item.num_favorers || 0}</span>
                    </p>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Toplu işlemler: seçim varken ekranın altında sabit */}
      {selectedIds.length > 0 && (
        <div className="fixed left-3 right-3 bottom-[calc(env(safe-area-inset-bottom)+88px)] lg:bottom-6 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-2.5 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-slate-700 dark:text-slate-200 px-1">{selectedIds.length} seçili</span>
          <button onClick={() => handleOpenBulkModal('optimize')} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> AI ile iyileştir
          </button>
          <button onClick={() => handleOpenBulkModal('ai_review')} className="px-3 py-1.5 border border-purple-200 dark:border-purple-500/40 text-purple-700 dark:text-purple-300 rounded-xl font-semibold flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> AI ile değerlendir
          </button>
          <button onClick={() => handleOpenBulkModal('evaluate_seo')} className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-semibold flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> Puanla
          </button>
          <button onClick={() => handleOpenBulkModal('vision')} className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-semibold flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" /> Görseli analiz et
          </button>
          <button onClick={() => setSelectedIds([])} aria-label="Seçimi temizle" className="ml-auto p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Ayrıntı ve SEO düzenleme */}
      <ListingDetailModal
        listing={selectedListingForModal}
        isOpen={isDetailModalOpen}
        onClose={() => {
          detailRequestRef.current++;
          setIsDetailLoading(false);
          setIsDetailModalOpen(false);
          setSelectedListingForModal(null);
        }}
        onListingUpdated={handleListingUpdated}
        isDetailLoading={isDetailLoading}
      />

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

function StatTile({ label, value, hint, icon, valueClassName, title }: { label: string; value: string; hint: string; icon?: React.ReactNode; valueClassName?: string; title?: string }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-950/60 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 min-w-0" title={title}>
      <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">{icon}{label}</span>
      <div className={`text-base sm:text-lg font-extrabold text-slate-900 dark:text-white leading-tight ${valueClassName ?? ''}`}>{value}</div>
      <span className="text-[10px] text-slate-400 truncate block">{hint}</span>
    </div>
  );
}

function scoreTextColor(score: number) {
  if (score >= 85) return '!text-emerald-600 dark:!text-emerald-400';
  if (score >= 60) return '!text-amber-600 dark:!text-amber-400';
  return '!text-rose-600 dark:!text-rose-400';
}

function scoreBadgeColor(score: number) {
  if (score >= 85) return 'bg-emerald-500/90 text-white';
  if (score >= 60) return 'bg-amber-400/90 text-slate-950';
  return 'bg-rose-500/90 text-white';
}

function formatPrice(price: unknown, currency: string | null | undefined) {
  const value = Number(price);
  if (!Number.isFinite(value)) return '';
  try {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: currency || 'USD' }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency ?? ''}`.trim();
  }
}

function formatSyncAge(hours: number | null, iso: string) {
  if (hours !== null && hours < 1) return 'az önce';
  if (hours !== null && hours < 24) return `${Math.floor(hours)} saat önce`;
  return new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
