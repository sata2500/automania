'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Zap,
  Key,
  Cpu,
  Database,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Activity,
  Layers,
  Palette,
  FolderTree,
  Eye,
  EyeOff,
  Sparkles,
  Server,
  HardDrive,
  RotateCcw,
  SlidersHorizontal,
  LayoutDashboard,
  Users,
  Settings,
  UserCheck,
  Globe,
  Lock,
  ChevronRight,
  Sparkle,
  Radio,
  FileCode2,
  Check,
  Search,
  Image as ImageIcon,
  FileText,
  Coins,
  MessageSquare,
  XCircle
} from 'lucide-react';
import { MockupItem, DesignItem, MockupFolder } from '@/types/pod';
import { useToast } from '@/components/common/ToastContext';
import { useAuth } from '@/components/common/UserAuthContext';
import { loadSampleAppData, saveAppData, loadAppData } from '@/lib/storage-service';
import { ConfirmModal } from '@/components/common/ConfirmModal';

type AdminSubTab = 'overview' | 'ai' | 'users' | 'settings';

const OPENROUTER_KEY_STORAGE = 'automania_openrouter_api_key';
const MODEL_VISION_STORAGE = 'automania_model_vision';
const MODEL_REASONING_STORAGE = 'automania_model_reasoning';
const MODEL_GENERATION_STORAGE = 'automania_model_generation';

export const AdminDashboard: React.FC = () => {
  const toast = useToast();
  const { user } = useAuth();
  const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean; title: string; message: string; action: (() => void) | null}>({ isOpen: false, title: '', message: '', action: null });

  // Active Sub Tab state
  const [activeSubTab, setActiveSubTab] = useState<AdminSubTab>('overview');

  const [globalStats, setGlobalStats] = useState<any>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  useEffect(() => {
    const fetchGlobalStats = async () => {
      setIsLoadingStats(true);
      try {
        const res = await fetch('/api/admin/stats');
        const data = await res.json();
        if (data.success) setGlobalStats(data.stats);
      } catch (err) {}
      setIsLoadingStats(false);
    };
    if (activeSubTab === 'overview') {
      fetchGlobalStats();
    }
  }, [activeSubTab]);

  useEffect(() => {
    try {
      const savedTab = localStorage.getItem('automania_admin_subtab_v1') as AdminSubTab;
      if (savedTab && ['overview', 'ai', 'users', 'settings'].includes(savedTab)) {
        setActiveSubTab(savedTab);
      }
    } catch (e) {}
  }, []);

  const handleSubTabChange = (tab: AdminSubTab) => {
    setActiveSubTab(tab);
    try {
      localStorage.setItem('automania_admin_subtab_v1', tab);
    } catch (e) {}
  };

  // API Key & Model state
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  // 3-Tier Model System
  const [modelVision, setModelVision] = useState('');
  const [modelReasoning, setModelReasoning] = useState('');
  const [modelGeneration, setModelGeneration] = useState('');

  // OpenRouter Dynamic Models State
  const [openRouterModels, setOpenRouterModels] = useState<any[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Connection Test state
  const [testingModel, setTestingModel] = useState<string | null>(null);

  // Sync / Maintenance state
  const [isSyncingDb, setIsSyncingDb] = useState(false);
  const [dbStatus, setDbStatus] = useState<'connected' | 'checking' | 'error'>('connected');

  useEffect(() => {
    try {
      const savedKey = localStorage.getItem(OPENROUTER_KEY_STORAGE) || '';
      const v = localStorage.getItem(MODEL_VISION_STORAGE) || '';
      const r = localStorage.getItem(MODEL_REASONING_STORAGE) || '';
      const g = localStorage.getItem(MODEL_GENERATION_STORAGE) || '';
      setApiKey(savedKey);
      setModelVision(v);
      setModelReasoning(r);
      setModelGeneration(g);
    } catch (e) {
      console.error('Failed to load OpenRouter storage', e);
    }
  }, []);

  const fetchOpenRouterModels = async () => {
    if (!apiKey) return;
    setIsLoadingModels(true);
    try {
      const res = await fetch('https://openrouter.ai/api/v1/models');
      const data = await res.json();
      if (data && data.data) {
        setOpenRouterModels(data.data);
      }
    } catch (e) {
      toast.error('OpenRouter modelleri çekilirken hata oluştu.');
    } finally {
      setIsLoadingModels(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'ai' && apiKey) {
      fetchOpenRouterModels();
    }
  }, [activeSubTab, apiKey]);

  const handleSaveApiSettings = async () => {
    try {
      const trimmedKey = apiKey.trim();
      localStorage.setItem(OPENROUTER_KEY_STORAGE, trimmedKey);
      localStorage.setItem(MODEL_VISION_STORAGE, modelVision);
      localStorage.setItem(MODEL_REASONING_STORAGE, modelReasoning);
      localStorage.setItem(MODEL_GENERATION_STORAGE, modelGeneration);

      const currentData = await loadAppData();
      await saveAppData({
        ...currentData,
        openRouterKey: trimmedKey,
        modelVision,
        modelReasoning,
        modelGeneration,
      });

      toast.success('OpenRouter API ayarları kaydedildi ve tüm cihazlarınıza eşitlendi! 📱💻');
    } catch (e) {
      toast.error('Ayarlar kaydedilirken bir hata oluştu.');
    }
  };

  const handleTestSpecificModel = async (modelId: string, role: 'vision' | 'reasoning' | 'generation') => {
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      toast.warning('Lütfen önce bir OpenRouter API Key girin.');
      return;
    }

    setTestingModel(modelId);
    const startTime = Date.now();

    let messages: any[] = [];
    if (role === 'vision') {
      messages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What color is this 1x1 image? Reply with 1 word.' },
            { type: 'image_url', image_url: { url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=' } }
          ]
        }
      ];
    } else if (role === 'generation') {
      messages = [{ role: 'user', content: 'A simple red circle icon' }];
    } else {
      messages = [{ role: 'user', content: 'Ping Test. Respond with: OK' }];
    }

    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${trimmedKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Automania POD Studio',
        },
        body: JSON.stringify({
          model: modelId,
          messages,
          max_tokens: 30,
        }),
      });

      const latencyMs = Date.now() - startTime;

      if (res.ok) {
        toast.success(`Bağlantı Başarılı: ${modelId} (${latencyMs}ms)`);
      } else {
        const errorData = await res.json().catch(() => ({}));
        const errMsg = errorData.error?.message || `HTTP ${res.status}`;
        toast.error(`Test Başarısız (${modelId}): ${errMsg}`);
      }
    } catch (e) {
      toast.error(`Bağlantı hatası oluştu.`);
    } finally {
      setTestingModel(null);
    }
  };

  const [isTestingDb, setIsTestingDb] = useState(false);
  const [dbHealthResult, setDbHealthResult] = useState<{ ok: boolean; latencyMs: number } | null>(null);

  const handleTestDatabaseHealth = async () => {
    setIsTestingDb(true);
    setDbHealthResult(null);
    const start = Date.now();
    try {
      const res = await fetch('/api/setup');
      const latencyMs = Date.now() - start;
      if (res.ok) {
        setDbHealthResult({ ok: true, latencyMs });
        toast.success(`PostgreSQL Veritabanı Bağlantısı Başarılı & Sağlıklı! (${latencyMs}ms)`);
      } else {
        setDbHealthResult({ ok: false, latencyMs });
        toast.error('Veritabanı sunucusuna erişilemedi.');
      }
    } catch (e) {
      toast.error('Veritabanı bağlantı testi sırasında hata oluştu.');
    } finally {
      setIsTestingDb(false);
    }
  };

  const handlePurgeSystemJunkData = async () => {
    setConfirmConfig({
      isOpen: true,
      title: 'Sistem Verilerini Temizle',
      message: 'Bu işlem PostgreSQL veritabanındaki yetkisiz test kayıtlarını ve eski veritabanı artıklarını temizleyecektir.\n\nSistemdeki hazır örnek taslak ve mockup kütüphanesi KORUNACAKTIR. Devam etmek istiyor musunuz?',
      action: async () => {
        try {
          const res = await fetch('/api/setup?action=reset');
          if (res.ok) {
            toast.success('Sistemdeki tüm çöp veriler ve veritabanı artıkları temizlendi! Örnek demo şablon kütüphanesi korundu.');
          } else {
            toast.error('Veritabanı temizleme işlemi başarısız oldu.');
          }
        } catch (err) {
          toast.error('Sistem temizleme sırasında bir hata oluştu.');
        }
      }
    });
  };



  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* Top Banner & Header Section - Soft Light-Friendly Styling */}
      <div className="bg-white dark:bg-slate-900 p-6 sm:p-7 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-center space-x-4">
            <div className="p-3.5 bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 rounded-2xl border border-indigo-100 dark:border-indigo-800 shadow-sm">
              <ShieldCheck className="w-7 h-7 text-indigo-600 dark:text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Yönetici Kumanda Merkezi
                </h1>
                <span className="px-2.5 py-0.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[10px] font-extrabold rounded-full uppercase tracking-wider">
                  Admin Privileged
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-xl">
                Uygulamanızın tüm modüllerini yönetin, OpenRouter Yapay Zeka ayarlarını yapın ve veritabanı durumunu denetleyin.
              </p>
            </div>
          </div>

          {/* Quick System Indicators */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 px-3.5 py-2 rounded-2xl text-xs font-semibold">
              <Server className="w-4 h-4 text-emerald-500" />
              <span className="text-slate-600 dark:text-slate-300">PostgreSQL:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">Aktif</span>
            </div>

            <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 px-3.5 py-2 rounded-2xl text-xs font-semibold">
              <Zap className="w-4 h-4 text-amber-500" />
              <span className="text-slate-600 dark:text-slate-300">OpenRouter:</span>
              <span className={`font-extrabold ${apiKey ? 'text-indigo-600 dark:text-amber-300' : 'text-slate-400'}`}>
                {apiKey ? 'Tanımlı (Eşitlendi)' : 'Yapılandırılmadı'}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs Bar Inside Admin Panel */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => handleSubTabChange('overview')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'overview'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>1. Genel Özet</span>
          </button>

          <button
            onClick={() => handleSubTabChange('ai')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'ai'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Cpu className="w-4 h-4 text-amber-400" />
            <span>2. Yapay Zeka &amp; OpenRouter</span>
          </button>

          <button
            onClick={() => handleSubTabChange('users')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'users'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Users className="w-4 h-4 text-emerald-400" />
            <span>3. Kullanıcı Yönetimi</span>
          </button>

          <button
            onClick={() => handleSubTabChange('settings')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'settings'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>4. Uygulama Ayarları &amp; Bakım</span>
          </button>
        </div>
      </div>

      {/* SUB TAB 1: OVERVIEW & METRICS */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Users Metric */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between hover:-translate-y-1 hover:shadow-md transition-all">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Kayıtlı Kullanıcılar
                </span>
                <div className="flex items-baseline space-x-2">
                  <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                    {isLoadingStats ? '...' : globalStats?.users?.total || 0}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase">Kullanıcı</span>
                </div>
                <div className="flex gap-2 text-[10px] font-bold mt-3">
                  <span className="text-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-100 dark:border-emerald-800">
                    🟢 {globalStats?.users?.active || 0} Aktif
                  </span>
                  <span className="text-rose-500 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded-md border border-rose-100 dark:border-rose-800">
                    🔴 {globalStats?.users?.blocked || 0} Engelli
                  </span>
                </div>
              </div>
              <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl shadow-sm border border-indigo-100 dark:border-indigo-800/50">
                <Users className="w-6 h-6" />
              </div>
            </div>

            {/* Global Mockups Metric */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between hover:-translate-y-1 hover:shadow-md transition-all">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Global Mockup Arşivi
                </span>
                <div className="flex items-baseline space-x-2">
                  <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                    {isLoadingStats ? '...' : globalStats?.assets?.mockups || 0}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase">Görsel</span>
                </div>
                <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-3 font-bold bg-purple-50 dark:bg-purple-950/50 inline-block px-2 py-0.5 rounded-md border border-purple-100 dark:border-purple-800">
                  Tüm kullanıcıların ortak üretimi
                </p>
              </div>
              <div className="p-3 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-2xl shadow-sm border border-purple-100 dark:border-purple-800/50">
                <Layers className="w-6 h-6" />
              </div>
            </div>

            {/* Global Designs Metric */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between hover:-translate-y-1 hover:shadow-md transition-all">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Global Tasarım Üretimi
                </span>
                <div className="flex items-baseline space-x-2">
                  <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                    {isLoadingStats ? '...' : globalStats?.assets?.designs || 0}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase">Tasarım</span>
                </div>
                <div className="flex gap-2 text-[10px] mt-3 font-bold">
                  <span className="text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-md border border-amber-100 dark:border-amber-800">
                    📂 {globalStats?.assets?.folders || 0} Global Klasör
                  </span>
                </div>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-2xl shadow-sm border border-amber-100 dark:border-amber-800/50">
                <Palette className="w-6 h-6" />
              </div>
            </div>

            {/* Database Health Metric */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between hover:-translate-y-1 hover:shadow-md transition-all">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Veritabanı Sağlığı
                </span>
                <div className="flex items-baseline space-x-2">
                  <span className={`text-3xl font-extrabold ${
                    globalStats?.health?.status === 'excellent' ? 'text-emerald-600 dark:text-emerald-400' :
                    globalStats?.health?.status === 'good' ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
                  }`}>
                    {isLoadingStats ? '...' : (globalStats?.health?.status === 'excellent' ? 'Mükemmel' : globalStats?.health?.status === 'good' ? 'İyi' : 'Yavaş')}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-3 font-bold bg-slate-50 dark:bg-slate-800 inline-block px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                  {isLoadingStats ? 'Ölçülüyor...' : `Gecikme (Ping): ${globalStats?.health?.dbLatencyMs || 0}ms`}
                </p>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl shadow-sm border border-emerald-100 dark:border-emerald-800/50">
                <Activity className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Quick System Info Banner */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-500" />
              <span>Sistem Çalışma Durumu &amp; Özet</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200/60 dark:border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Veritabanı Motoru</span>
                <p className="font-bold text-slate-800 dark:text-slate-200">PostgreSQL (Server DB Sync)</p>
                <p className="text-[10px] text-slate-500">Tüm cihazlarda kesintisiz veri erişimi</p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200/60 dark:border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Yapay Zeka Altyapısı</span>
                <p className="font-bold text-slate-800 dark:text-slate-200">OpenRouter Multi-Model Router</p>
                <p className="text-[10px] text-slate-500">{apiKey ? '3 Farklı Görev Modeli Aktif' : 'API Anahtarı bekleniyor'}</p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200/60 dark:border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Uygulama Sürümü</span>
                <p className="font-bold text-slate-800 dark:text-slate-200">Automania POD Studio v2.5</p>
                <p className="text-[10px] text-slate-500">Next.js 16 + Turbopack Engine</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB 2: AI & OPENROUTER CENTER */}
      {activeSubTab === 'ai' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 space-y-6 shadow-sm animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">OpenRouter Yapay Zeka &amp; API Yönetim Merkezi</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Görsel analiz, etiket üretimi ve Etsy optimizasyonu için OpenRouter API anahtarınızı yapılandırın.
                </p>
              </div>
            </div>
            <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-xl border border-indigo-200 dark:border-indigo-800">
              Projenin Beyni
            </span>
          </div>

          <div className="space-y-5">
            {/* API Key Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-indigo-500" />
                  OpenRouter API Key:
                </span>
                <span className="text-[10px] text-slate-400 font-normal">Format: sk-or-v1-...</span>
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
                <CloudSyncBadge />
                <span>Bu anahtar kaydedildiğinde telefon dahil tüm cihazlarınıza veritabanından eşitlenir.</span>
              </p>
            </div>

            {/* 3-Tier Model Assignments */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Vision Model */}
              <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/60 rounded-lg text-indigo-600 dark:text-indigo-400">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                      <h4 className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Görsel Analiz Modeli</h4>
                    </div>
                  </div>
                  <div className="text-xs font-medium text-indigo-700 dark:text-indigo-400 bg-white dark:bg-slate-900 py-1.5 px-2 rounded border border-indigo-100 dark:border-indigo-800 break-all">
                    {modelVision || 'Henüz Seçilmedi'}
                  </div>
                </div>
                {modelVision && (
                  <button 
                    onClick={() => handleTestSpecificModel(modelVision, 'vision')}
                    disabled={testingModel === modelVision}
                    className="mt-3 w-full py-1.5 bg-indigo-100/50 hover:bg-indigo-200/50 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-lg text-[10px] font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {testingModel === modelVision ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
                    Bu Modeli Test Et
                  </button>
                )}
              </div>

              {/* Reasoning Model */}
              <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-100 dark:border-emerald-900/50 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/60 rounded-lg text-emerald-600 dark:text-emerald-400">
                        <FileText className="w-4 h-4" />
                      </div>
                      <h4 className="text-[11px] font-bold text-slate-700 dark:text-slate-300">SEO Metin Yazarı (Reasoning)</h4>
                    </div>
                  </div>
                  <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-white dark:bg-slate-900 py-1.5 px-2 rounded border border-emerald-100 dark:border-emerald-800 break-all">
                    {modelReasoning || 'Henüz Seçilmedi'}
                  </div>
                </div>
                {modelReasoning && (
                  <button 
                    onClick={() => handleTestSpecificModel(modelReasoning, 'reasoning')}
                    disabled={testingModel === modelReasoning}
                    className="mt-3 w-full py-1.5 bg-emerald-100/50 hover:bg-emerald-200/50 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded-lg text-[10px] font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {testingModel === modelReasoning ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
                    Bu Modeli Test Et
                  </button>
                )}
              </div>

              {/* Generation Model */}
              <div className="p-3 bg-purple-50/50 dark:bg-purple-950/30 rounded-2xl border border-purple-100 dark:border-purple-900/50 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-purple-100 dark:bg-purple-900/60 rounded-lg text-purple-600 dark:text-purple-400">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <h4 className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Görsel Üretim Modeli</h4>
                    </div>
                  </div>
                  <div className="text-xs font-medium text-purple-700 dark:text-purple-400 bg-white dark:bg-slate-900 py-1.5 px-2 rounded border border-purple-100 dark:border-purple-800 break-all">
                    {modelGeneration || 'Henüz Seçilmedi'}
                  </div>
                </div>
                {modelGeneration && (
                  <button 
                    onClick={() => handleTestSpecificModel(modelGeneration, 'generation')}
                    disabled={testingModel === modelGeneration}
                    className="mt-3 w-full py-1.5 bg-purple-100/50 hover:bg-purple-200/50 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-lg text-[10px] font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {testingModel === modelGeneration ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
                    Bu Modeli Test Et
                  </button>
                )}
              </div>
            </div>

            {/* Model Selector & Browser */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-indigo-500" />
                OpenRouter Model Kataloğu
              </label>

              {!apiKey ? (
                <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-center text-slate-500 dark:text-slate-400 text-xs flex flex-col items-center justify-center">
                  <Lock className="w-6 h-6 mb-2 text-slate-400" />
                  <p>Modelleri görüntülemek ve atama yapmak için lütfen geçerli bir OpenRouter API anahtarı girin.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Model adı ile ara... (Örn: claude, gemini, gpt)"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {isLoadingModels && (
                      <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500 animate-spin" />
                    )}
                  </div>

                  <div className="h-[400px] overflow-y-auto custom-scrollbar border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/50 p-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {openRouterModels
                      .filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()) || m.id.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((model) => {
                        const isFree = parseFloat(model.pricing?.prompt || "1") === 0 && parseFloat(model.pricing?.completion || "1") === 0;
                        const hasVision = model.architecture?.input_modalities?.includes('image');
                        const isTextToImage = model.architecture?.output_modalities?.includes('image');

                        return (
                          <div key={model.id} className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col justify-between hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors group">
                            <div className="space-y-2 mb-3">
                              <div className="flex justify-between items-start gap-2">
                                <h5 className="text-[11px] font-bold text-slate-800 dark:text-slate-200 leading-tight">{model.name}</h5>
                                {isFree ? (
                                  <span className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-400 text-[9px] font-bold rounded shrink-0">Ücretsiz</span>
                                ) : (
                                  <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-400 text-[9px] font-bold rounded shrink-0 flex items-center gap-0.5"><Coins className="w-2.5 h-2.5"/>Ücretli</span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-1 text-[9px]">
                                <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                                  <MessageSquare className="w-2.5 h-2.5" /> {(model.context_length / 1000).toFixed(0)}K Context
                                </span>
                                {hasVision && (
                                  <span className="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                                    <ImageIcon className="w-2.5 h-2.5" /> Girdi: Görsel
                                  </span>
                                )}
                                {isTextToImage && (
                                  <span className="px-1.5 py-0.5 bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 rounded border border-purple-200 dark:border-purple-800 flex items-center gap-1">
                                    <Sparkles className="w-2.5 h-2.5" /> Çıktı: Görsel
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {/* Action Buttons */}
                            <div className="flex items-center gap-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                              <button
                                onClick={() => {
                                  if (!hasVision) {
                                    toast.error('Bu model görsel analiz (Vision) desteklemiyor!');
                                    return;
                                  }
                                  setModelVision(model.id);
                                }}
                                className={`flex-1 py-1 text-[9px] font-bold rounded-lg border transition-colors ${
                                  modelVision === model.id
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                              >
                                Analiz İçin Seç
                              </button>
                              
                              <button
                                onClick={() => setModelReasoning(model.id)}
                                className={`flex-1 py-1 text-[9px] font-bold rounded-lg border transition-colors ${
                                  modelReasoning === model.id
                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                              >
                                SEO İçin Seç
                              </button>
                              
                              <button
                                onClick={() => setModelGeneration(model.id)}
                                className={`flex-1 py-1 text-[9px] font-bold rounded-lg border transition-colors ${
                                  modelGeneration === model.id
                                    ? 'bg-purple-600 text-white border-purple-600'
                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                              >
                                Üretim İçin Seç
                              </button>
                            </div>
                          </div>
                        );
                      })
                    }
                    {openRouterModels.length === 0 && !isLoadingModels && (
                       <div className="col-span-1 md:col-span-2 text-center text-slate-500 text-xs py-10">
                         Hiç model bulunamadı veya bağlantı hatası oluştu.
                       </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Save & Test Buttons */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={handleSaveApiSettings}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-indigo-600/30 flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Ayarları Veritabanına Kaydet &amp; Eşitle</span>
              </button>
          </div>
        </div>
      )}

      {/* SUB TAB 3: USER MANAGEMENT */}
      {activeSubTab === 'users' && (
        <UserManagementSection />
      )}

      {/* SUB TAB 4: SYSTEM SETTINGS & MAINTENANCE */}
      {activeSubTab === 'settings' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 space-y-6 shadow-sm animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Uygulama Ayarları &amp; Veritabanı Bakımı</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Veritabanı eşitleme, önbellek temizliği ve fabrika sıfırlama araçları.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Database Health Card */}
            <div className="p-5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="flex items-center space-x-2">
                <Server className="w-5 h-5 text-indigo-500" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">PostgreSQL Sağlık &amp; Gecikme Testi (Ping)</h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                PostgreSQL veritabanı sunucusunun canlılık durumunu, tablo yapılarını ve yanıt gecikme süresini (ping ms) test edin.
              </p>
              <button
                onClick={handleTestDatabaseHealth}
                disabled={isTestingDb}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-600/20"
              >
                <Activity className={`w-4 h-4 text-emerald-300 ${isTestingDb ? 'animate-spin' : ''}`} />
                <span>{isTestingDb ? 'Bağlantı Ölçülüyor...' : 'Veritabanı Sağlığını Test Et (Ping)'}</span>
              </button>

              {dbHealthResult && (
                <div className={`p-2.5 rounded-xl border text-[11px] font-medium flex items-center justify-between ${
                  dbHealthResult.ok
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 text-emerald-700 dark:text-emerald-300'
                    : 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 text-rose-700 dark:text-rose-300'
                }`}>
                  <span>{dbHealthResult.ok ? 'PostgreSQL Sunucusu Erişilebilir & Sağlıklı' : 'Bağlantı Hatası'}</span>
                  <span className="font-mono font-bold">{dbHealthResult.latencyMs}ms</span>
                </div>
              )}
            </div>

            {/* System Junk Purge Card */}
            <div className="p-5 bg-rose-50/50 dark:bg-rose-950/30 rounded-2xl border border-rose-200/80 dark:border-rose-900/60 space-y-3">
              <div className="flex items-center space-x-2 text-rose-600 dark:text-rose-400">
                <Trash2 className="w-5 h-5" />
                <h3 className="text-xs font-bold">Veritabanı Çöp &amp; Artık Verilerini Temizle</h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                PostgreSQL veritabanındaki tüm yetkisiz test kayıtlarını ve çöp artıkları temizler. Sistemdeki hazır demo şablon kütüphanesi (60 mockup, tasarımlar) olduğu gibi muhafaza edilir.
              </p>
              <button
                onClick={handlePurgeSystemJunkData}
                className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-rose-600/20"
              >
                <Trash2 className="w-4 h-4" />
                <span>Çöp Verileri Temizle (Örnek Şablonlar Korunur)</span>
              </button>
            </div>
          </div>
        </div>
      )}
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
};

function CloudSyncBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold rounded-md border border-emerald-200 dark:border-emerald-800">
      <Check className="w-3 h-3" />
      Bulut Senkronize
    </span>
  );
}

function UserManagementSection() {
  const { userList, updateUserRole, toggleUserBlock, deleteUser } = useAuth();
  const toast = useToast();
  const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean; title: string; message: string; action: (() => void) | null}>({ isOpen: false, title: '', message: '', action: null });

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 space-y-6 shadow-sm animate-fadeIn">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-100 dark:border-emerald-800">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Kullanıcı Yönetimi &amp; Yetkilendirme</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Google hesaplarıyla sisteme giriş yapan tüm kullanıcılar otomatik listelenir. Rol değiştirebilir veya erişimleri engelleyebilirsiniz.
            </p>
          </div>
        </div>

        <div className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-xl border border-emerald-200 dark:border-emerald-800 shrink-0">
          Toplam Kayıtlı: {userList.length} Kullanıcı
        </div>
      </div>

      {/* Users Table */}
      <div className="border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden text-xs">
        <div className="bg-slate-50 dark:bg-slate-950 p-3 font-bold text-slate-500 dark:text-slate-400 grid grid-cols-12 items-center">
          <div className="col-span-4 sm:col-span-3">Kullanıcı &amp; E-Posta</div>
          <div className="col-span-3 sm:col-span-3">Rol Seviyesi</div>
          <div className="col-span-2 sm:col-span-2">Durum</div>
          <div className="col-span-3 sm:col-span-4 text-right">Erişim &amp; İşlemler</div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {userList.map((u) => {
            const isBlocked = u.status === 'blocked';
            return (
              <div key={u.id} className="p-3 grid grid-cols-12 items-center gap-2 hover:bg-slate-50/50 dark:hover:bg-slate-950/50 transition-colors">
                {/* User info */}
                <div className="col-span-4 sm:col-span-3 flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 shrink-0 overflow-hidden border border-slate-300 dark:border-slate-700">
                    <img
                      src={u.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(u.email)}`}
                      alt={u.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="truncate">
                    <p className="font-bold text-slate-900 dark:text-white truncate">{u.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono truncate">{u.email}</p>
                  </div>
                </div>

                {/* Role dropdown */}
                <div className="col-span-3 sm:col-span-3">
                  <select
                    value={u.role}
                    onChange={(e) => {
                      updateUserRole(u.id, e.target.value as 'admin' | 'user');
                      toast.info(`${u.name} rolü "${e.target.value === 'admin' ? 'Admin' : 'Standart Kullanıcı'}" olarak güncellendi.`);
                    }}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer focus:outline-none ${
                      u.role === 'admin'
                        ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <option value="user">Standart Kullanıcı</option>
                    <option value="admin">Yönetici (Admin)</option>
                  </select>
                </div>

                {/* Status Badge */}
                <div className="col-span-2 sm:col-span-2">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    isBlocked
                      ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                      : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  }`}>
                    {isBlocked ? 'Engellendi' : 'Aktif'}
                  </span>
                </div>

                {/* Actions */}
                <div className="col-span-3 sm:col-span-4 flex items-center justify-end space-x-2">
                  <button
                    onClick={() => {
                      toggleUserBlock(u.id);
                      toast.warning(`${u.name} erişim durumu güncellendi.`);
                    }}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                      isBlocked
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{isBlocked ? 'Engeli Kaldır' : 'Engelle'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setConfirmConfig({
                        isOpen: true,
                        title: 'Kullanıcıyı Sil',
                        message: `${u.name} kullanıcısı sistemden tamamen silinsin mi?`,
                        action: () => {
                          deleteUser(u.id);
                          toast.info(`${u.name} kullanıcısı silindi.`);
                        }
                      });
                    }}
                    className="p-1.5 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-200 dark:border-rose-800 transition-all cursor-pointer"
                    title="Kullanıcıyı Sil"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

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
