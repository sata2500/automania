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
} from 'lucide-react';
import { MockupItem, DesignItem, MockupFolder } from '@/types/pod';
import { useToast } from '@/components/common/ToastContext';
import { useAuth } from '@/components/common/UserAuthContext';
import { loadSampleAppData, saveAppData, loadAppData } from '@/lib/storage-service';

interface AdminDashboardProps {
  mockups: MockupItem[];
  setMockups: React.Dispatch<React.SetStateAction<MockupItem[]>>;
  designs: DesignItem[];
  setDesigns: React.Dispatch<React.SetStateAction<DesignItem[]>>;
  folders: MockupFolder[];
  setFolders: React.Dispatch<React.SetStateAction<MockupFolder[]>>;
}

type AdminSubTab = 'overview' | 'ai' | 'users' | 'settings';

const OPENROUTER_KEY_STORAGE = 'automania_openrouter_api_key';
const OPENROUTER_MODEL_STORAGE = 'automania_openrouter_model';

const AVAILABLE_MODELS = [
  { id: 'google/gemini-2.5-flash', name: 'Google Gemini 2.5 Flash', desc: 'Önerilen — Çok Hızlı Görsel Analiz & Etiketleme' },
  { id: 'google/gemini-2.5-pro', name: 'Google Gemini 2.5 Pro', desc: 'Gelişmiş Mantıksal Analiz & Zengin Detay' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Anthropic Claude 3.5 Sonnet', desc: 'Premium SEO İçeriği & Özgün Açıklamalar' },
  { id: 'openai/gpt-4o-mini', name: 'OpenAI GPT-4o Mini', desc: 'Hızlı & Ekonomik Metin İşleme' },
];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  mockups,
  setMockups,
  designs,
  setDesigns,
  folders,
  setFolders,
}) => {
  const toast = useToast();
  const { user } = useAuth();

  // Active Sub Tab state
  const [activeSubTab, setActiveSubTab] = useState<AdminSubTab>('overview');

  // API Key & Model state
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState('google/gemini-2.5-flash');

  // Connection Test state
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; latencyMs?: number; message?: string } | null>(null);

  // Sync / Maintenance state
  const [isSyncingDb, setIsSyncingDb] = useState(false);
  const [dbStatus, setDbStatus] = useState<'connected' | 'checking' | 'error'>('connected');

  useEffect(() => {
    try {
      const savedKey = localStorage.getItem(OPENROUTER_KEY_STORAGE) || '';
      const savedModel = localStorage.getItem(OPENROUTER_MODEL_STORAGE) || 'google/gemini-2.5-flash';
      setApiKey(savedKey);
      setSelectedModel(savedModel);
    } catch (e) {
      console.error('Failed to load OpenRouter storage', e);
    }
  }, []);

  const handleSaveApiSettings = async () => {
    try {
      const trimmedKey = apiKey.trim();
      localStorage.setItem(OPENROUTER_KEY_STORAGE, trimmedKey);
      localStorage.setItem(OPENROUTER_MODEL_STORAGE, selectedModel);

      // Save to PostgreSQL DB so key syncs across mobile/desktop devices!
      await saveAppData({
        mockups,
        designs,
        folders,
        activeFolderId: null,
        selectedMockupId: null,
        openRouterKey: trimmedKey,
        openRouterModel: selectedModel,
      });

      toast.success('OpenRouter API ayarları kaydedildi ve tüm cihazlarınıza eşitlendi! 📱💻');
    } catch (e) {
      toast.error('Ayarlar kaydedilirken bir hata oluştu.');
    }
  };

  const handleTestOpenRouterConnection = async () => {
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      toast.warning('Lütfen önce bir OpenRouter API Key girin.');
      return;
    }

    setIsTestingApi(true);
    setTestResult(null);
    const startTime = Date.now();

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
          model: selectedModel,
          messages: [{ role: 'user', content: 'Ping Test. Respond with: OK' }],
          max_tokens: 10,
        }),
      });

      const latencyMs = Date.now() - startTime;

      if (res.ok) {
        setTestResult({
          success: true,
          latencyMs,
          message: 'OpenRouter API başarıyla bağlandı ve yanıt verdi!',
        });
        toast.success(`OpenRouter API Bağlantısı Başarılı! (${latencyMs}ms)`);
      } else {
        const errorData = await res.json().catch(() => ({}));
        const errMsg = errorData.error?.message || `HTTP ${res.status} Hatalı Yanıt`;
        setTestResult({
          success: false,
          message: errMsg,
        });
        toast.error(`API Hatalı: ${errMsg}`);
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Ağ bağlantı hatası oluştu.',
      });
      toast.error('OpenRouter sunucularına erişilemedi.');
    } finally {
      setIsTestingApi(false);
    }
  };

  const handleForceSyncDb = async () => {
    setIsSyncingDb(true);
    try {
      await saveAppData({
        mockups,
        designs,
        folders,
        activeFolderId: null,
        selectedMockupId: null,
        openRouterKey: apiKey.trim(),
        openRouterModel: selectedModel,
      });
      setDbStatus('connected');
      toast.success('Tüm veriler veritabanı (PostgreSQL) ve yerel hafıza ile eşitlendi!');
    } catch (err) {
      setDbStatus('error');
      toast.error('Veritabanı eşitleme hatası oluştu.');
    } finally {
      setIsSyncingDb(false);
    }
  };

  const handleRestoreFactoryData = async () => {
    if (!confirm('Tüm mevcut veriler sıfırlanıp varsayılan fabrika demo veri seti yüklensin mi? (Bu işlem geri alınamaz)')) {
      return;
    }
    const defaultData = await loadSampleAppData();
    setMockups(defaultData.mockups);
    setDesigns(defaultData.designs);
    setFolders(defaultData.folders);
    await saveAppData({
      mockups: defaultData.mockups,
      designs: defaultData.designs,
      folders: defaultData.folders,
      activeFolderId: null,
      selectedMockupId: null,
    });
    toast.info('Sistem fabrika demo ayarlarına sıfırlandı.');
  };

  const imageMockupCount = mockups.filter((m) => !m.isVideo).length;
  const videoMockupCount = mockups.filter((m) => m.isVideo).length;
  const mockupFoldersCount = folders.filter((f) => f.type !== 'design').length;
  const designFoldersCount = folders.filter((f) => f.type === 'design').length;

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
            onClick={() => setActiveSubTab('overview')}
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
            onClick={() => setActiveSubTab('ai')}
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
            onClick={() => setActiveSubTab('users')}
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
            onClick={() => setActiveSubTab('settings')}
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
            {/* Mockups Metric */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Mockup Kitaplığı
                </span>
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{mockups.length}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Toplam Görsel</span>
                </div>
                <div className="flex gap-2 text-[10px] text-slate-400 mt-2 font-medium">
                  <span>🖼️ {imageMockupCount} Fotoğraf</span>
                  <span>🎥 {videoMockupCount} Video</span>
                </div>
              </div>
              <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                <Layers className="w-6 h-6" />
              </div>
            </div>

            {/* Designs Metric */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  PNG Tasarımlar
                </span>
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{designs.length}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Aktif Tasarım</span>
                </div>
                <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-2 font-semibold">
                  Toplu üretime hazır koleksiyon
                </p>
              </div>
              <div className="p-3 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-2xl">
                <Palette className="w-6 h-6" />
              </div>
            </div>

            {/* Folders Metric */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Klasör Mimarisi
                </span>
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{folders.length}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Klasör</span>
                </div>
                <div className="flex gap-2 text-[10px] text-slate-400 mt-2 font-medium">
                  <span>📂 {mockupFoldersCount} Mockup</span>
                  <span>🎨 {designFoldersCount} Tasarım</span>
                </div>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-2xl">
                <FolderTree className="w-6 h-6" />
              </div>
            </div>

            {/* Database & Local Cache */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Veritabanı &amp; Hafıza
                </span>
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">Senkron</span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 font-medium">
                  IndexedDB + PostgreSQL Otomatik Eşitleme
                </p>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                <Database className="w-6 h-6" />
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
                <p className="text-[10px] text-slate-500">{apiKey ? `Aktif Model: ${selectedModel}` : 'API Anahtarı bekleniyor'}</p>
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

            {/* Model Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                Varsayılan Yapay Zeka Modeli Seçin:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {AVAILABLE_MODELS.map((model) => {
                  const isSelected = selectedModel === model.id;
                  return (
                    <div
                      key={model.id}
                      onClick={() => setSelectedModel(model.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-indigo-50/60 dark:bg-indigo-950/60 border-indigo-500 dark:border-indigo-400 shadow-sm ring-1 ring-indigo-400/50'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-bold ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>
                          {model.name}
                        </span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">{model.desc}</p>
                    </div>
                  );
                })}
              </div>
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

              <button
                onClick={handleTestOpenRouterConnection}
                disabled={isTestingApi}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isTestingApi ? <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" /> : <Activity className="w-4 h-4 text-emerald-500" />}
                <span>{isTestingApi ? 'Bağlantı Test Ediliyor...' : 'Bağlantıyı Test Et (Ping)'}</span>
              </button>
            </div>

            {/* Test Result Indicator Banner */}
            {testResult && (
              <div className={`p-4 rounded-2xl border flex items-start space-x-3 text-xs ${
                testResult.success
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-300'
              }`}>
                {testResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold flex items-center gap-2">
                    <span>{testResult.success ? 'Bağlantı Başarılı!' : 'Bağlantı Başarısız'}</span>
                    {testResult.latencyMs && (
                      <span className="px-2 py-0.5 bg-emerald-200 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200 rounded-md text-[10px] font-mono">
                        {testResult.latencyMs}ms
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 leading-relaxed">{testResult.message}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB TAB 3: USER MANAGEMENT */}
      {activeSubTab === 'users' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 space-y-6 shadow-sm animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-100 dark:border-emerald-800">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Kullanıcı Yönetimi &amp; Yetkilendirme</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Sistem yöneticileri ve erişim rol seviyelerini kontrol edin.
                </p>
              </div>
            </div>
            <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-xl border border-emerald-200 dark:border-emerald-800">
              Kullanıcı Kontrolü
            </span>
          </div>

          {/* User Profile Card */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 p-0.5 shadow-md">
                <img
                  src={user?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.email || 'admin'}`}
                  alt={user?.name || 'Admin'}
                  className="w-full h-full rounded-full object-cover bg-white dark:bg-slate-900"
                />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>{user?.name || 'Salih TANRISEVEN'}</span>
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{user?.email || 'salihtanriseven25@gmail.com'}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-xl border border-indigo-200 dark:border-indigo-800">
                Sistem Yöneticisi (Admin)
              </span>
            </div>
          </div>

          {/* Privilege Matrix Table */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">Admin Yetkileri &amp; Erişim Matrisi</h3>
            <div className="border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden text-xs">
              <div className="bg-slate-50 dark:bg-slate-950 p-3 font-bold text-slate-500 dark:text-slate-400 grid grid-cols-12">
                <div className="col-span-5">Modül / İşlem</div>
                <div className="col-span-4">Rol Seviyesi</div>
                <div className="col-span-3 text-right">Durum</div>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                <div className="p-3 grid grid-cols-12 items-center">
                  <div className="col-span-5 font-semibold text-slate-800 dark:text-slate-200">Admin Kumanda Merkezi</div>
                  <div className="col-span-4 text-slate-500">Sadece Admin</div>
                  <div className="col-span-3 text-right text-emerald-600 dark:text-emerald-400 font-bold">Tam Erişim ✓</div>
                </div>
                <div className="p-3 grid grid-cols-12 items-center">
                  <div className="col-span-5 font-semibold text-slate-800 dark:text-slate-200">OpenRouter API Key Değiştirme</div>
                  <div className="col-span-4 text-slate-500">Sadece Admin</div>
                  <div className="col-span-3 text-right text-emerald-600 dark:text-emerald-400 font-bold">Tam Erişim ✓</div>
                </div>
                <div className="p-3 grid grid-cols-12 items-center">
                  <div className="col-span-5 font-semibold text-slate-800 dark:text-slate-200">Veritabanı Zorla Sıfırlama &amp; Eşitleme</div>
                  <div className="col-span-4 text-slate-500">Sadece Admin</div>
                  <div className="col-span-3 text-right text-emerald-600 dark:text-emerald-400 font-bold">Tam Erişim ✓</div>
                </div>
                <div className="p-3 grid grid-cols-12 items-center">
                  <div className="col-span-5 font-semibold text-slate-800 dark:text-slate-200">Etsy &amp; Toplu Üretim İşlemleri</div>
                  <div className="col-span-4 text-slate-500">Tüm Kullanıcılar</div>
                  <div className="col-span-3 text-right text-emerald-600 dark:text-emerald-400 font-bold">Aktif ✓</div>
                </div>
              </div>
            </div>
          </div>
        </div>
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
            {/* Database Sync Card */}
            <div className="p-5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="flex items-center space-x-2">
                <Server className="w-5 h-5 text-indigo-500" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">PostgreSQL Veritabanı Senkronizasyonu</h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Tüm mockup'lar, tasarımlar, klasörler ve API anahtarları PostgreSQL veritabanınız ile manuel olarak eşitleyin.
              </p>
              <button
                onClick={handleForceSyncDb}
                disabled={isSyncingDb}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncingDb ? 'animate-spin' : ''}`} />
                <span>{isSyncingDb ? 'Eşitleniyor...' : 'Veritabanını Zorla Eşitle'}</span>
              </button>
            </div>

            {/* Factory Reset Card */}
            <div className="p-5 bg-rose-50/50 dark:bg-rose-950/30 rounded-2xl border border-rose-200/80 dark:border-rose-900/60 space-y-3">
              <div className="flex items-center space-x-2 text-rose-600 dark:text-rose-400">
                <RotateCcw className="w-5 h-5" />
                <h3 className="text-xs font-bold">Fabrika Ayarlarına Sıfırla</h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Mevcut mockup ve tasarım verilerinizi sıfırlayarak 60 parçalık demo veri setini yükler.
              </p>
              <button
                onClick={handleRestoreFactoryData}
                className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-rose-600/20"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Fabrika Demo Verisini Yükle</span>
              </button>
            </div>
          </div>
        </div>
      )}
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
