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
  XCircle,
  ShoppingBag,
  Tag,
  Plus,
  Info,
  HelpCircle,
  ChevronDown,
  Upload
} from 'lucide-react';
import { MockupItem, DesignItem, MockupFolder } from '@/types/pod';
import { useToast } from '@/components/common/ToastContext';
import { useAuth } from '@/components/common/UserAuthContext';
import { loadSampleAppData, saveAppData, loadAppData } from '@/lib/storage-service';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import KeywordPoolManagement from './KeywordPoolManagement';
import TaxonomyManagement from './TaxonomyManagement';
import { AdminSettingsSection } from './AdminSettingsSection';
import { AdminOverviewSection, type AdminGlobalStats } from './AdminOverviewSection';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { DEFAULT_ANALYZE_DESIGN_PROMPT, DEFAULT_GENERATE_LISTING_PROMPT } from '@/lib/default-prompts';

export interface PromptVariable {
  tag: string;
  label: string;
  desc: string;
  icon: string;
  badgeColor: string;
}

export const PROMPT_VARIABLES_ANALYZE: PromptVariable[] = [
  {
    tag: '{{taxonomyHint}}',
    label: 'Kategori / Taksonomi Listesi',
    desc: 'Etsy taksonomi ağacından çekilen güncel kategori ID ve başlık listesi rehberini enjekte eder. Vision AI\'ın tasarımı doğru Etsy kategorisine atamasını sağlar.',
    icon: '🏷️',
    badgeColor: 'border-indigo-200 bg-indigo-50/80 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60',
  }
];

export const PROMPT_VARIABLES_GENERATE: PromptVariable[] = [
  {
    tag: '{{designDescription}}',
    label: 'Tasarım Açıklaması',
    desc: 'Vision AI görsel analizi ile elde edilen detaylı görsel kompozisyon ve tipografi açıklaması.',
    icon: '📝',
    badgeColor: 'border-blue-200 bg-blue-50/80 text-blue-700 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60',
  },
  {
    tag: '{{primarySubject}}',
    label: 'Ana Konu / Nesne',
    desc: 'Tasarımın ana odak konusu veya nesnesi (Örn: Wildflower, Golden Retriever, Vintage Skull). Alakasız kelimelerin (halüsinasyon) elenmesinde kullanılır.',
    icon: '🎯',
    badgeColor: 'border-emerald-200 bg-emerald-50/80 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60',
  },
  {
    tag: '{{primaryAesthetic}}',
    label: 'Stil & Estetik',
    desc: 'Tasarımın görsel ve sanatsal stili (Örn: Cottagecore, Retro Boho, Minimalist Line Art, Gothic Grunge).',
    icon: '✨',
    badgeColor: 'border-purple-200 bg-purple-50/80 text-purple-700 dark:border-purple-800 dark:bg-purple-950/60 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/60',
  },
  {
    tag: '{{productType}}',
    label: 'Ürün Modeli / Tipi',
    desc: 'İlanda yer alan giyim markaları ve modelleri (Örn: Comfort Colors 1717, Bella Canvas 3001, Youth Unisex Tee).',
    icon: '👕',
    badgeColor: 'border-cyan-200 bg-cyan-50/80 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/60',
  },
  {
    tag: '{{userNotes}}',
    label: 'Özel Notlar & Kumaş',
    desc: 'Kullanıcının veya sistemin belirlediği özel ürün/kumaş/beden notları (Örn: %100 Ringspun pamuk, oversized kalıp için 1 beden büyük seçiniz).',
    icon: '📌',
    badgeColor: 'border-amber-200 bg-amber-50/80 text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60',
  },
  {
    tag: '{{seasonalityContext}}',
    label: 'Sezon & Trend Rehberi',
    desc: 'Aktif aya ve döneme ait Etsy trend dalgası ve alıcı arama davranış rehberi (Örn: Mother\'s Day, Back to School, Fall Season).',
    icon: '🍂',
    badgeColor: 'border-orange-200 bg-orange-50/80 text-orange-700 dark:border-orange-800 dark:bg-orange-950/60 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/60',
  },
  {
    tag: '{{keywords}}',
    label: 'Aday Anahtar Kelimeler',
    desc: 'Kelime Havuzu ve canlı Etsy metrikleriyle zenginleştirilmiş; Fırsat Skoru, Rekabet, Bestseller sayısı ve 20 karakter sınırına uygunluk bilgisi içeren ana aday etiketler.',
    icon: '🔑',
    badgeColor: 'border-yellow-300 bg-yellow-50/90 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/60',
  },
  {
    tag: '{{coOccurringTags}}',
    label: 'Rakip Alt Etiketleri (Co-occurring)',
    desc: 'Etsy\'de çok satan başarılı rakiplerin ilanlarında bu kelimelerle birlikte en sık kullandığı kanıtlanmış alt etiketler ve metrikleri.',
    icon: '🔗',
    badgeColor: 'border-rose-200 bg-rose-50/80 text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60',
  },
  {
    tag: '{{taxonomyId}}',
    label: 'Taksonomi ID',
    desc: 'Seçilen veya tespit edilen Etsy kategori ID numarası (Örn: 482).',
    icon: '🆔',
    badgeColor: 'border-teal-200 bg-teal-50/80 text-teal-700 dark:border-teal-800 dark:bg-teal-950/60 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/60',
  },
  {
    tag: '{{shopSections}}',
    label: 'Mağaza Reyonları',
    desc: 'Bağlı Etsy mağazanızın mevcut reyon ve bölüm listesi (AI en uygun bölümü seçmek için kullanır).',
    icon: '🏪',
    badgeColor: 'border-violet-200 bg-violet-50/80 text-violet-700 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/60',
  },
  {
    tag: '{{taxonomyProperties}}',
    label: 'Kategori Nitelikleri (Attributes)',
    desc: 'Etsy kategorisine özel nitelikler ve geçerli değer listeleri (Örn: Yaka stili, Kol tipi, Stil).',
    icon: '⚙️',
    badgeColor: 'border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700',
  },
];

const PromptVariablePill: React.FC<{
  variable: PromptVariable;
  onClick: () => void;
}> = ({ variable, onClick }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative inline-block group">
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium border transition-all cursor-pointer shadow-xs hover:scale-105 active:scale-95 ${variable.badgeColor}`}
      >
        <span>{variable.icon}</span>
        <span className="font-semibold">{variable.label}</span>
        <code className="px-1 py-0.5 bg-black/5 dark:bg-white/10 rounded font-mono text-[10px] opacity-80">
          {variable.tag}
        </code>
      </button>

      {/* Hover Info Tooltip */}
      {showTooltip && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 bg-slate-900 dark:bg-slate-800 text-white text-[11px] rounded-xl shadow-xl border border-slate-700 pointer-events-none animate-fadeIn leading-relaxed">
          <div className="flex items-center gap-1.5 font-bold mb-1 text-indigo-300">
            <span>{variable.icon}</span>
            <span>{variable.label}</span>
            <code className="text-[10px] font-mono bg-slate-800 dark:bg-slate-900 px-1 rounded text-amber-300">{variable.tag}</code>
          </div>
          <p className="text-slate-300 text-[10px]">{variable.desc}</p>
          <div className="mt-1.5 pt-1.5 border-t border-slate-700/60 text-[9px] text-emerald-400 font-semibold flex items-center gap-1">
            <Plus className="w-3 h-3" />
            <span>Tıklayınca imlecin olduğu konuma ekler</span>
          </div>
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900 dark:border-t-slate-800" />
        </div>
      )}
    </div>
  );
};

const AccordionCard: React.FC<{
  isOpen: boolean;
  onToggle: () => void;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
  headerAccent?: string;
}> = ({ isOpen, onToggle, title, subtitle, icon, badge, children, headerAccent }) => {
  return (
    <div className={`bg-white dark:bg-slate-900 rounded-3xl border transition-all shadow-xs ${
      isOpen 
        ? 'border-indigo-200/80 dark:border-indigo-900/60 ring-1 ring-indigo-500/10 dark:ring-indigo-500/20' 
        : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
    }`}>
      {/* Accordion Header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-4 sm:p-5 flex items-center justify-between gap-3 text-left transition-colors rounded-3xl cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-2.5 rounded-2xl shrink-0 ${headerAccent || 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50'}`}>
            {icon}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">{title}</h3>
              {badge}
            </div>
            {subtitle && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate hidden sm:block">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className={`p-1.5 rounded-xl border transition-transform duration-200 ${
            isOpen
              ? 'rotate-180 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
              : 'rotate-0 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
          }`}>
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
      </button>

      {/* Accordion Content */}
      {isOpen && (
        <div className="px-4 pb-5 pt-1 sm:px-6 sm:pb-6 border-t border-slate-100 dark:border-slate-800/80 animate-fadeIn">
          {children}
        </div>
      )}
    </div>
  );
};

type AdminSubTab = 'overview' | 'ai' | 'keywords' | 'taxonomy' | 'users' | 'settings';

const MODEL_VISION_STORAGE = 'automania_model_vision';
const MODEL_REASONING_STORAGE = 'automania_model_reasoning';
const MODEL_GENERATION_STORAGE = 'automania_model_generation';

export const AdminDashboard: React.FC = () => {
  const toast = useToast();
  const { user } = useAuth();
  const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean; title: string; message: string; action: (() => void) | null}>({ isOpen: false, title: '', message: '', action: null });

  // Active Sub Tab state
  const [activeSubTab, setActiveSubTab] = useState<AdminSubTab>('overview');

  const [globalStats, setGlobalStats] = useState<AdminGlobalStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [sampleStats, setSampleStats] = useState<{ mockupsCount: number; designsCount: number; foldersCount: number } | null>(null);
  const [isUpdatingSampleData, setIsUpdatingSampleData] = useState(false);
  const [storageDiagnostics, setStorageDiagnostics] = useState<{
    records?: { mockups?: number; designs?: number; generatedMockups?: number; durable?: number; temporary?: number; other?: number; missing?: number };
    referencedR2Objects?: number;
    r2?: { objectCount?: number; totalBytes?: number; orphanObjectCount?: number | null; missingReferencedObjectCount?: number | null };
  } | null>(null);
  const [isCheckingStorage, setIsCheckingStorage] = useState(false);

  const fetchGlobalStats = async (showToast: boolean = false) => {
    setIsLoadingStats(true);
    try {
      const res = await fetch(`/api/admin/stats?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store' }
      });
      const data = await res.json();
      if (data.success && data.stats) {
        setGlobalStats(data.stats);
        if (showToast) {
          toast.success(`İstatistikler güncellendi: ${data.stats.assets.mockups} Mockup, ${data.stats.assets.designs} Tasarım, ${data.stats.storage.blobCount} R2 Dosyası.`);
        }
      } else {
        if (showToast) {
          toast.error(data.message || data.error || 'İstatistikler alınamadı.');
        }
      }
    } catch (err: any) {
      if (showToast) {
        toast.error('İstatistikler yüklenirken bağlantı hatası oluştu.');
      }
    } finally {
      setIsLoadingStats(false);
    }
  };

  const handleCheckStorage = async () => {
    setIsCheckingStorage(true);
    try {
      const res = await fetch(`/api/admin/storage/diagnostics?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store' },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Storage diagnostics failed');
      }
      setStorageDiagnostics(data);
      toast.success('Depolama kayıtları doğrulandı; hiçbir dosya silinmedi.');
    } catch {
      toast.error('Depolama kayıtları doğrulanamadı.');
    } finally {
      setIsCheckingStorage(false);
    }
  };

  const fetchSampleStats = async () => {
    try {
      const res = await fetch(`/api/admin/sample-data?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      const data = await res.json();
      if (data.success && data.stats) {
        setSampleStats(data.stats);
      }
    } catch (err) {}
  };

  useEffect(() => {
    if (activeSubTab === 'overview' || activeSubTab === 'settings') {
      fetchGlobalStats();
      fetchSampleStats();
    }
  }, [activeSubTab]);

  useEffect(() => {
    try {
      const savedTab = localStorage.getItem('automania_admin_subtab_v1') as AdminSubTab;
      if (savedTab && ['overview', 'ai', 'keywords', 'taxonomy', 'users', 'settings'].includes(savedTab)) {
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

  // 3-Tier Model System & Global Settings
  const [activeAiProvider, setActiveAiProvider] = useState<'openrouter' | 'gemini'>('openrouter');
  const [openRouterApiKey, setOpenRouterApiKey] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  
  const [etsyKeystring, setEtsyKeystring] = useState('');
  const [etsySharedSecret, setEtsySharedSecret] = useState('');

  // Scraping & Proxy Settings
  const [scrapingProvider, setScrapingProvider] = useState<'scraperapi' | 'scrapingbee' | 'zenrows'>('scraperapi');
  const [scrapingApiKey, setScrapingApiKey] = useState('');
  const [cloudflareWorkerUrl, setCloudflareWorkerUrl] = useState('');
  
  const [modelVision, setModelVision] = useState('');
  const [modelReasoning, setModelReasoning] = useState('');
  const [modelGeneration, setModelGeneration] = useState('');
  
  const [geminiModelVision, setGeminiModelVision] = useState('');
  const [geminiModelReasoning, setGeminiModelReasoning] = useState('');
  const [geminiModelGeneration, setGeminiModelGeneration] = useState('');

  // AI Prompts State
  const [promptAnalyzeDesign, setPromptAnalyzeDesign] = useState('');
  const [promptGenerateListing, setPromptGenerateListing] = useState('');
  const [activePromptSubTab, setActivePromptSubTab] = useState<'both' | 'vision' | 'listing'>('both');

  // AI Tab Collapsible Sections State (Accordion)
  const [expandedAiSections, setExpandedAiSections] = useState<Record<string, boolean>>({
    keys: true,
    scraping: false,
    models: true,
    catalog: false,
    prompts: true,
  });

  const toggleAiSection = (key: string) => {
    setExpandedAiSections(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // OpenRouter Dynamic Models State
  const [openRouterModels, setOpenRouterModels] = useState<any[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Connection Test state
  const [testingModel, setTestingModel] = useState<string | null>(null);
  const [testResponseData, setTestResponseData] = useState<{model: string, content: string, imageUrl?: string} | null>(null);

  // Sync / Maintenance state
  const [isSyncingDb, setIsSyncingDb] = useState(false);
  const [dbStatus, setDbStatus] = useState<'connected' | 'checking' | 'error'>('connected');

  useEffect(() => {
    try {
      const v = localStorage.getItem(MODEL_VISION_STORAGE) || '';
      const r = localStorage.getItem(MODEL_REASONING_STORAGE) || '';
      const g = localStorage.getItem(MODEL_GENERATION_STORAGE) || '';
      setModelVision(v);
      setModelReasoning(r);
      setModelGeneration(g);
    } catch (e) {
      console.error('Failed to load OpenRouter storage', e);
    }
  }, []);

  // Yeni Cihaz / Çapraz Cihaz Senkronizasyonu
  useEffect(() => {
    const syncApiSettingsFromServer = async () => {
      if (!user?.id) return;
      try {
        const res = await fetch(`/api/storage?userId=${user.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data) {
            let updated = false;
            if (data.modelVision && data.modelVision !== modelVision) {
              setModelVision(data.modelVision);
              localStorage.setItem(MODEL_VISION_STORAGE, data.modelVision);
              updated = true;
            }
            if (data.modelReasoning && data.modelReasoning !== modelReasoning) {
              setModelReasoning(data.modelReasoning);
              localStorage.setItem(MODEL_REASONING_STORAGE, data.modelReasoning);
              updated = true;
            }
            if (data.modelGeneration && data.modelGeneration !== modelGeneration) {
              setModelGeneration(data.modelGeneration);
              localStorage.setItem(MODEL_GENERATION_STORAGE, data.modelGeneration);
              updated = true;
            }
          }
        }
      } catch (e) {
        console.error("Buluttan ayarlar çekilirken hata oluştu", e);
      }
    };
    syncApiSettingsFromServer();
  }, [user?.id]);

  const fetchOpenRouterModels = async () => {
    setIsLoadingModels(true);
    try {
      const res = await fetch('/api/ai/proxy?endpoint=https://openrouter.ai/api/v1/models');
      const data = await res.json();
      if (data && data.success && data.data.data) {
        setOpenRouterModels(data.data.data);
      }
    } catch (e) {
      toast.error('OpenRouter modelleri çekilirken hata oluştu.');
    } finally {
      setIsLoadingModels(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'ai') {
      fetchOpenRouterModels();
      // Fetch global settings
      fetch('/api/admin/settings')
        .then(res => res.json())
        .then(data => {
          if (data.settings) {
            if (data.settings.active_ai_provider) setActiveAiProvider(data.settings.active_ai_provider);
            if (data.settings.openrouter_api_key) setOpenRouterApiKey(data.settings.openrouter_api_key);
            if (data.settings.gemini_api_key) setGeminiApiKey(data.settings.gemini_api_key);
            
            if (data.settings.etsy_keystring) setEtsyKeystring(data.settings.etsy_keystring);
            if (data.settings.etsy_shared_secret) setEtsySharedSecret(data.settings.etsy_shared_secret);

            if (data.settings.scraping_provider) setScrapingProvider(data.settings.scraping_provider as any);
            if (data.settings.scraping_api_key) setScrapingApiKey(data.settings.scraping_api_key);
            if (data.settings.cloudflare_worker_url) setCloudflareWorkerUrl(data.settings.cloudflare_worker_url);
            
            if (data.settings.openrouter_model_vision) setModelVision(data.settings.openrouter_model_vision);
            if (data.settings.openrouter_model_reasoning) setModelReasoning(data.settings.openrouter_model_reasoning);
            if (data.settings.openrouter_model_generation) setModelGeneration(data.settings.openrouter_model_generation);
            
            if (data.settings.gemini_model_vision) setGeminiModelVision(data.settings.gemini_model_vision);
            if (data.settings.gemini_model_reasoning) setGeminiModelReasoning(data.settings.gemini_model_reasoning);
            if (data.settings.gemini_model_generation) setGeminiModelGeneration(data.settings.gemini_model_generation);
            
            if (data.settings.ai_prompt_analyze_design) {
              setPromptAnalyzeDesign(data.settings.ai_prompt_analyze_design);
            } else {
              setPromptAnalyzeDesign(DEFAULT_ANALYZE_DESIGN_PROMPT);
            }
            if (data.settings.ai_prompt_generate_listing) {
              setPromptGenerateListing(data.settings.ai_prompt_generate_listing);
            } else {
              setPromptGenerateListing(DEFAULT_GENERATE_LISTING_PROMPT);
            }
          }
        })
        .catch(e => console.error("Could not fetch global settings", e));
    }
  }, [activeSubTab]);

  const insertVariable = (
    setter: React.Dispatch<React.SetStateAction<string>>,
    currentValue: string,
    variable: string,
    textareaId: string,
    variableLabel?: string
  ) => {
    const textarea = document.getElementById(textareaId) as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart ?? currentValue.length;
      const end = textarea.selectionEnd ?? currentValue.length;
      const newValue = currentValue.substring(0, start) + variable + currentValue.substring(end);
      setter(newValue);
      
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 10);
    } else {
      setter(currentValue + (currentValue.endsWith('\n') || currentValue.length === 0 ? '' : '\n') + variable);
    }
    if (variableLabel) {
      toast.success(`${variableLabel} (${variable}) eklendi.`);
    }
  };

  const handleSaveApiSettings = async () => {
    try {
      localStorage.setItem(MODEL_VISION_STORAGE, modelVision);
      localStorage.setItem(MODEL_REASONING_STORAGE, modelReasoning);
      localStorage.setItem(MODEL_GENERATION_STORAGE, modelGeneration);

      // Save global settings via Admin API
      const settingsToSave: any = {};
      if (activeAiProvider) settingsToSave.active_ai_provider = activeAiProvider;
      if (openRouterApiKey !== undefined) settingsToSave.openrouter_api_key = openRouterApiKey;
      if (geminiApiKey !== undefined) settingsToSave.gemini_api_key = geminiApiKey;
      
      if (etsyKeystring) settingsToSave.etsy_keystring = etsyKeystring;
      if (etsySharedSecret) settingsToSave.etsy_shared_secret = etsySharedSecret;

      if (scrapingProvider) settingsToSave.scraping_provider = scrapingProvider;
      if (scrapingApiKey !== undefined) settingsToSave.scraping_api_key = scrapingApiKey;
      if (cloudflareWorkerUrl !== undefined) settingsToSave.cloudflare_worker_url = cloudflareWorkerUrl;
      
      if (modelVision) settingsToSave.openrouter_model_vision = modelVision;
      if (modelReasoning) settingsToSave.openrouter_model_reasoning = modelReasoning;
      if (modelGeneration) settingsToSave.openrouter_model_generation = modelGeneration;
      
      if (geminiModelVision) settingsToSave.gemini_model_vision = geminiModelVision;
      if (geminiModelReasoning) settingsToSave.gemini_model_reasoning = geminiModelReasoning;
      if (geminiModelGeneration) settingsToSave.gemini_model_generation = geminiModelGeneration;

      if (promptAnalyzeDesign !== undefined) settingsToSave.ai_prompt_analyze_design = promptAnalyzeDesign;
      if (promptGenerateListing !== undefined) settingsToSave.ai_prompt_generate_listing = promptGenerateListing;

      if (Object.keys(settingsToSave).length > 0) {
        await fetch('/api/admin/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings: settingsToSave })
        });
      }

      const currentData = await loadAppData();
      await saveAppData({
        ...currentData,
        modelVision,
        modelReasoning,
        modelGeneration,
      });

      toast.success('Yapay Zeka ve API ayarları başarıyla kaydedildi! 📱💻');
    } catch (e) {
      toast.error('Ayarlar kaydedilirken bir hata oluştu.');
    }
  };

  const handleTestSpecificModel = async (modelId: string, role: 'vision' | 'reasoning' | 'generation', provider: 'openrouter' | 'gemini' = 'openrouter') => {
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
      const res = await fetch('/api/ai/proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider,
          endpoint: provider === 'gemini' 
            ? 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
            : 'https://openrouter.ai/api/v1/chat/completions',
          model: modelId,
          messages,
          max_tokens: 30,
        }),
      });

      const latencyMs = Date.now() - startTime;

      if (res.ok) {
        const result = await res.json();
        const data = result.data;
        const content = data?.choices?.[0]?.message?.content || JSON.stringify(data);
        
        // Markdown içinden resim URL'si ayıklama (Text-to-Image modelleri için)
        const urlMatch = content.match(/!\[.*?\]\((.*?)\)/);
        const imageUrl = urlMatch ? urlMatch[1] : undefined;

        setTestResponseData({ model: modelId, content, imageUrl });
        
        if (role === 'generation' && !imageUrl) {
          toast.error(`Üretim Başarısız: Model sadece metin döndürdü, görsel üretemedi! (${latencyMs}ms)`);
        } else {
          toast.success(`Bağlantı Başarılı: ${modelId} (${latencyMs}ms)`);
        }
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
      message: 'Bu işlem, veritabanında karşılığı olmayan veya kullanılmayan tüm çöp (yetim) görselleri Cloudflare R2 / Depolama alanından tamamen silecektir.\n\nSistemdeki hazır örnek taslaklar ve kullanıcıların aktif mockupları KORUNACAKTIR. Devam etmek istiyor musunuz?',
      action: async () => {
        try {
          const res = await fetch('/api/admin/clean-blobs', { method: 'POST' });
          if (res.ok) {
            const data = await res.json();
            toast.success(data.message || 'Çöp görseller depolama alanından temizlendi.');
            fetchGlobalStats(); // Update dashboard stats after cleaning
          } else {
            toast.error('Depolama temizleme işlemi başarısız oldu.');
          }
        } catch (err) {
          toast.error('Sistem temizleme sırasında bir hata oluştu.');
        }
      }
    });
  };

  const handleSetMyWorkspaceAsSampleData = () => {
    setConfirmConfig({
      isOpen: true,
      title: 'Çalışma Alanını Genel Örnek Taslak Olarak Ata',
      message: 'Mevcut yönetici çalışma alanınızdaki tüm klasörler, mockup\'lar ve tasarımlar, sistem genelindeki tüm kullanıcılar için varsayılan "Örnek Taslak" şablonu olarak atanacaktır. Eski örnek veriler tamamen bu yeni verilerle güncellenecektir. Onaylıyor musunuz?',
      action: async () => {
        setIsUpdatingSampleData(true);
        try {
          const res = await fetch('/api/admin/sample-data', { method: 'POST' });
          const data = await res.json();
          if (data.success) {
            toast.success(data.message || 'Örnek taslak başarıyla güncellendi!');
            if (data.stats) setSampleStats(data.stats);
          } else {
            toast.error(data.error || 'Örnek taslak güncellenirken hata oluştu.');
          }
        } catch (e: any) {
          toast.error('İşlem sırasında bir hata oluştu: ' + (e.message || 'Bilinmeyen hata'));
        } finally {
          setIsUpdatingSampleData(false);
        }
      }
    });
  };

  const handleResetSampleData = () => {
    setConfirmConfig({
      isOpen: true,
      title: 'Örnek Taslak Verilerini Sıfırla',
      message: 'Sistem genelindeki örnek taslak şablonu tamamen boşaltılacaktır. Bu işlem geri alınamaz. Devam etmek istiyor musunuz?',
      action: async () => {
        setIsUpdatingSampleData(true);
        try {
          const res = await fetch('/api/admin/sample-data', { method: 'DELETE' });
          const data = await res.json();
          if (data.success) {
            toast.success(data.message || 'Örnek taslak sıfırlandı.');
            setSampleStats(data.stats || { mockupsCount: 0, designsCount: 0, foldersCount: 0 });
          } else {
            toast.error(data.error || 'Sıfırlama sırasında hata oluştu.');
          }
        } catch (e: any) {
          toast.error('Hata: ' + e.message);
        } finally {
          setIsUpdatingSampleData(false);
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
              <span className="font-extrabold text-indigo-600 dark:text-amber-300">
                Sunucuda Tanımlı
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
            onClick={() => handleSubTabChange('keywords')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'keywords'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Database className="w-4 h-4 text-pink-400" />
            <span>3. Kelime Havuzu</span>
          </button>

          <button
            onClick={() => handleSubTabChange('taxonomy')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'taxonomy'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <FolderTree className="w-4 h-4 text-teal-400" />
            <span>4. Etsy Kategorileri</span>
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
            <span>5. Kullanıcı Yönetimi</span>
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
            <span>6. Uygulama Ayarları &amp; Bakım</span>
          </button>
        </div>
      </div>

      {/* SUB TAB 1: OVERVIEW & METRICS */}
      {activeSubTab === 'overview' && (
        <AdminOverviewSection
          globalStats={globalStats}
          isLoadingStats={isLoadingStats}
          onRefresh={() => { fetchGlobalStats(true); fetchSampleStats(); }}
        />
      )}

      {/* SUB TAB 2: AI & OPENROUTER CENTER */}
      {activeSubTab === 'ai' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Main Top Banner */}
          <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-2xl border border-indigo-100 dark:border-indigo-800 shrink-0">
                <Cpu className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Yapay Zeka &amp; API Yönetim Merkezi</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 rounded-lg border border-indigo-200 dark:border-indigo-800">
                    Projenin Beyni
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Görsel analiz, etiket üretimi, canlı kazıma ve sistem promptlarını yapılandırın.
                </p>
              </div>
            </div>

            {/* Quick Accordion Toggles (Expand all / Collapse all) */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setExpandedAiSections({ keys: true, scraping: true, models: true, catalog: true, prompts: true })}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold rounded-xl transition-colors cursor-pointer"
              >
                Tümünü Aç
              </button>
              <button
                type="button"
                onClick={() => setExpandedAiSections({ keys: false, scraping: false, models: false, catalog: false, prompts: false })}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold rounded-xl transition-colors cursor-pointer"
              >
                Tümünü Kapat
              </button>
            </div>
          </div>

          {/* SECTION 1: API KEYS & PROVIDER */}
          <AccordionCard
            isOpen={expandedAiSections.keys}
            onToggle={() => toggleAiSection('keys')}
            title="1. AI Sağlayıcısı & API Anahtarları"
            subtitle="OpenRouter, Google Gemini ve Etsy Developer API anahtarları"
            icon={<Key className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
            badge={
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                  activeAiProvider === 'openrouter'
                    ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
                    : 'bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800'
                }`}>
                  {activeAiProvider === 'openrouter' ? '🟢 OpenRouter' : '🔷 Google Gemini'}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700">
                  {((openRouterApiKey ? 1 : 0) + (geminiApiKey ? 1 : 0) + (etsyKeystring ? 1 : 0) + (etsySharedSecret ? 1 : 0))}/4 Anahtar
                </span>
              </div>
            }
          >
            <div className="space-y-4 pt-3">
              {/* Provider Selection */}
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Aktif Yapay Zeka Sağlayıcısı</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                    activeAiProvider === 'openrouter'
                      ? 'bg-indigo-50/80 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 ring-2 ring-indigo-500/20'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}>
                    <input
                      type="radio"
                      name="ai_provider"
                      value="openrouter"
                      checked={activeAiProvider === 'openrouter'}
                      onChange={() => setActiveAiProvider('openrouter')}
                      className="text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">OpenRouter Router</div>
                      <div className="text-[10px] text-slate-500">200+ Çoklu Model Havuzu &amp; Özel Yönlendirme</div>
                    </div>
                  </label>

                  <label className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                    activeAiProvider === 'gemini'
                      ? 'bg-sky-50/80 dark:bg-sky-950/60 border-sky-300 dark:border-sky-700 ring-2 ring-sky-500/20'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}>
                    <input
                      type="radio"
                      name="ai_provider"
                      value="gemini"
                      checked={activeAiProvider === 'gemini'}
                      onChange={() => setActiveAiProvider('gemini')}
                      className="text-sky-600 focus:ring-sky-500 cursor-pointer"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Google Gemini Direkt</div>
                      <div className="text-[10px] text-slate-500">Gemini 3.6 &amp; 2.5 Flash / Pro (Google AI API)</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* API Key Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-indigo-500" />
                      OpenRouter API Key
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">Sunucu Tabanlı</span>
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={openRouterApiKey}
                    onFocus={() => { if (openRouterApiKey === '***') setOpenRouterApiKey(''); }}
                    onChange={(e) => setOpenRouterApiKey(e.target.value)}
                    placeholder={openRouterApiKey === '***' ? 'Mevcut key kayıtlı; değiştirmek için yeni key girin' : 'sk-or-v1-...'}
                    aria-label="OpenRouter API Key"
                    className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-sky-500" />
                      Google Gemini API Key
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">Sunucu Tabanlı</span>
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={geminiApiKey}
                    onFocus={() => { if (geminiApiKey === '***') setGeminiApiKey(''); }}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder={geminiApiKey === '***' ? 'Mevcut key kayıtlı; değiştirmek için yeni key girin' : 'AIzaSy...'}
                    aria-label="Google Gemini API Key"
                    className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <ShoppingBag className="w-3.5 h-3.5 text-orange-500" />
                      Etsy Keystring (App Key)
                    </span>
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={etsyKeystring}
                    onFocus={() => { if (etsyKeystring === '***') setEtsyKeystring(''); }}
                    onChange={(e) => setEtsyKeystring(e.target.value)}
                    placeholder={etsyKeystring === '***' ? 'Mevcut key kayıtlı; değiştirmek için yeni key girin' : 'Etsy Developer App Keystring'}
                    aria-label="Etsy Keystring"
                    className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-orange-500" />
                      Etsy Shared Secret
                    </span>
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={etsySharedSecret}
                    onFocus={() => { if (etsySharedSecret === '***') setEtsySharedSecret(''); }}
                    onChange={(e) => setEtsySharedSecret(e.target.value)}
                    placeholder={etsySharedSecret === '***' ? 'Mevcut secret kayıtlı; değiştirmek için yeni değer girin' : 'Etsy Shared Secret'}
                    aria-label="Etsy Shared Secret"
                    className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Secret değerler sunucu tarafında tutulur ve admin paneline geri döndürülmez. Değiştirmek için yeni değer girmeniz yeterlidir.</span>
              </p>
            </div>
          </AccordionCard>

          {/* SECTION 2: SCRAPING & PROXY */}
          <AccordionCard
            isOpen={expandedAiSections.scraping}
            onToggle={() => toggleAiSection('scraping')}
            title="2. Etsy Kazıma & Proxy Ayarları"
            subtitle="4 Kademeli Hibrit Kazıma, Scraper API ve Cloudflare Worker"
            icon={<Globe className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
            headerAccent="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50"
            badge={
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  4 Kademeli Hibrit Hat
                </span>
                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 uppercase">
                  {scrapingProvider}
                </span>
              </div>
            }
          >
            <div className="space-y-4 pt-3">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed space-y-1.5">
                <p className="font-semibold text-slate-800 dark:text-slate-200">📌 Kazıma Sıralaması &amp; Çalışma Mantığı:</p>
                <ul className="list-disc pl-4 space-y-1 text-[11px]">
                  <li><strong className="text-emerald-600 dark:text-emerald-400">1. Kademe (Birincil):</strong> Bağlı Etsy Mağazanızın Resmi API&apos;si (Sıfır bot engeli, anlık kesin ilan sayısı ve fiyatlar).</li>
                  <li><strong className="text-sky-600 dark:text-sky-400">2. Kademe:</strong> Tarayıcınızdan Doğrudan Canlı Kazıma (Kelime Havuzu sekmesindeki &quot;Tarayıcımdan Kazı&quot; butonu).</li>
                  <li><strong className="text-amber-600 dark:text-amber-400">3. Kademe (Proxy):</strong> Cloudflare Worker CORS Proxy (Ücretsiz kendi sunucu hattınız).</li>
                  <li><strong className="text-indigo-600 dark:text-indigo-400">4. Kademe (Anti-Bot):</strong> Scraper API konut tipi proxy (Bot korumalarını aşmak için yedek hat).</li>
                </ul>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Provider Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>Scraper API Sağlayıcısı</span>
                  </label>
                  <select
                    value={scrapingProvider}
                    onChange={(e) => setScrapingProvider(e.target.value as any)}
                    className="w-full px-3.5 py-3 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer"
                  >
                    <option value="scraperapi">ScraperAPI (scraperapi.com - 5.000 İstek/Ay Ücretsiz)</option>
                    <option value="scrapingbee">ScrapingBee (scrapingbee.com - 1.000 İstek Ücretsiz)</option>
                    <option value="zenrows">ZenRows (zenrows.com - 1.000 İstek Ücretsiz)</option>
                  </select>
                </div>

                {/* API Key */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-emerald-500" />
                      Scraper API Key
                    </span>
                    <a
                      href={scrapingProvider === 'scrapingbee' ? 'https://www.scrapingbee.com' : scrapingProvider === 'zenrows' ? 'https://www.zenrows.com' : 'https://www.scraperapi.com/signup'}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline font-bold"
                    >
                      Ücretsiz Key Al ↗
                    </a>
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={scrapingApiKey}
                    onFocus={() => { if (scrapingApiKey === '***') setScrapingApiKey(''); }}
                    onChange={(e) => setScrapingApiKey(e.target.value)}
                    placeholder={scrapingApiKey === '***' ? 'Mevcut key kayıtlı; değiştirmek için yeni key girin' : 'Scraper API Key yapıştırın...'}
                    aria-label="Scraper API Key"
                    className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                  />
                </div>

                {/* Cloudflare Worker URL */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      Cloudflare Worker URL (İsteğe Bağlı)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={cloudflareWorkerUrl}
                    onChange={(e) => setCloudflareWorkerUrl(e.target.value)}
                    placeholder="https://automania-proxy.xxx.workers.dev"
                    className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
                  />
                </div>
              </div>
            </div>
          </AccordionCard>

          {/* SECTION 3: ACTIVE MODELS & TEST */}
          <AccordionCard
            isOpen={expandedAiSections.models}
            onToggle={() => toggleAiSection('models')}
            title="3. Aktif Model Atamaları & Canlı Test"
            subtitle="Görsel Analiz (Vision), SEO Metin Yazarı (Reasoning) ve Görsel Üretim"
            icon={<Cpu className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
            badge={
              <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-lg border border-indigo-200 dark:border-indigo-800">
                {activeAiProvider === 'openrouter' ? 'OpenRouter 3-Tier Modeli' : 'Gemini Modelleri'}
              </span>
            }
          >
            <div className="space-y-4 pt-3">
              {activeAiProvider === 'openrouter' ? (
                /* OpenRouter 3-Tier Model Cards */
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Vision Model */}
                  <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/60 rounded-lg text-indigo-600 dark:text-indigo-400">
                          <ImageIcon className="w-4 h-4" />
                        </div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Görsel Analiz Modeli (Vision)</h4>
                      </div>
                      <div className="text-xs font-mono font-medium text-indigo-700 dark:text-indigo-400 bg-white dark:bg-slate-900 py-2 px-3 rounded-xl border border-indigo-100 dark:border-indigo-800 break-all shadow-2xs">
                        {modelVision || 'Henüz Seçilmedi'}
                      </div>
                    </div>
                    {modelVision && (
                      <button 
                        onClick={() => handleTestSpecificModel(modelVision, 'vision', 'openrouter')}
                        disabled={testingModel === modelVision}
                        className="mt-3 w-full py-2 bg-indigo-100/70 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:hover:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300 rounded-xl text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {testingModel === modelVision ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                        Bu Modeli Test Et
                      </button>
                    )}
                  </div>

                  {/* Reasoning Model */}
                  <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-100 dark:border-emerald-900/50 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/60 rounded-lg text-emerald-600 dark:text-emerald-400">
                          <FileText className="w-4 h-4" />
                        </div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">SEO Metin Yazarı (Reasoning)</h4>
                      </div>
                      <div className="text-xs font-mono font-medium text-emerald-700 dark:text-emerald-400 bg-white dark:bg-slate-900 py-2 px-3 rounded-xl border border-emerald-100 dark:border-emerald-800 break-all shadow-2xs">
                        {modelReasoning || 'Henüz Seçilmedi'}
                      </div>
                    </div>
                    {modelReasoning && (
                      <button 
                        onClick={() => handleTestSpecificModel(modelReasoning, 'reasoning', 'openrouter')}
                        disabled={testingModel === modelReasoning}
                        className="mt-3 w-full py-2 bg-emerald-100/70 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:hover:bg-emerald-900/70 text-emerald-700 dark:text-emerald-300 rounded-xl text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {testingModel === modelReasoning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                        Bu Modeli Test Et
                      </button>
                    )}
                  </div>

                  {/* Generation Model */}
                  <div className="p-4 bg-purple-50/50 dark:bg-purple-950/30 rounded-2xl border border-purple-100 dark:border-purple-900/50 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 bg-purple-100 dark:bg-purple-900/60 rounded-lg text-purple-600 dark:text-purple-400">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Görsel Üretim Modeli (T2I)</h4>
                      </div>
                      <div className="text-xs font-mono font-medium text-purple-700 dark:text-purple-400 bg-white dark:bg-slate-900 py-2 px-3 rounded-xl border border-purple-100 dark:border-purple-800 break-all shadow-2xs">
                        {modelGeneration || 'Henüz Seçilmedi'}
                      </div>
                    </div>
                    {modelGeneration && (
                      <button 
                        onClick={() => handleTestSpecificModel(modelGeneration, 'generation', 'openrouter')}
                        disabled={testingModel === modelGeneration}
                        className="mt-3 w-full py-2 bg-purple-100/70 hover:bg-purple-200 dark:bg-purple-900/40 dark:hover:bg-purple-900/70 text-purple-700 dark:text-purple-300 rounded-xl text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {testingModel === modelGeneration ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                        Bu Modeli Test Et
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* Gemini 3-Tier Model Selectors */
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-4 bg-sky-50/50 dark:bg-sky-950/30 rounded-2xl border border-sky-100 dark:border-sky-900/50 flex flex-col justify-between space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4 text-sky-500" />
                        Görsel Analiz Modeli (Vision)
                      </label>
                      <select
                        value={geminiModelVision}
                        onChange={(e) => setGeminiModelVision(e.target.value)}
                        className="w-full p-2.5 bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-800 rounded-xl text-xs font-bold"
                      >
                        <option value="">Seçiniz</option>
                        <optgroup label="Gemini 3 Serisi">
                          <option value="gemini-3.6-flash">Gemini 3.6 Flash (Ücretsiz)</option>
                          <option value="gemini-3.5-flash">Gemini 3.5 Flash (Ücretsiz)</option>
                          <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash-Lite (Ücretsiz)</option>
                          <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash-Lite (Ücretsiz)</option>
                          <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Preview) (Ücretsiz)</option>
                        </optgroup>
                        <optgroup label="Gemini 2.5 Serisi">
                          <option value="gemini-2.5-flash">Gemini 2.5 Flash (Ücretsiz)</option>
                          <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite (Ücretsiz)</option>
                          <option value="gemini-2.5-pro">Gemini 2.5 Pro (Ücretsiz)</option>
                        </optgroup>
                      </select>
                    </div>
                    {geminiModelVision && (
                      <button 
                        onClick={() => handleTestSpecificModel(geminiModelVision, 'vision', 'gemini')}
                        disabled={testingModel === geminiModelVision}
                        className="w-full py-2 bg-sky-100/70 hover:bg-sky-200 dark:bg-sky-900/40 dark:hover:bg-sky-900/70 text-sky-700 dark:text-sky-300 rounded-xl text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {testingModel === geminiModelVision ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                        Bu Modeli Test Et
                      </button>
                    )}
                  </div>

                  <div className="p-4 bg-sky-50/50 dark:bg-sky-950/30 rounded-2xl border border-sky-100 dark:border-sky-900/50 flex flex-col justify-between space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-sky-500" />
                        SEO Metin Modeli (Reasoning)
                      </label>
                      <select
                        value={geminiModelReasoning}
                        onChange={(e) => setGeminiModelReasoning(e.target.value)}
                        className="w-full p-2.5 bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-800 rounded-xl text-xs font-bold"
                      >
                        <option value="">Seçiniz</option>
                        <optgroup label="Gemini 3 Serisi">
                          <option value="gemini-3.6-flash">Gemini 3.6 Flash (Ücretsiz)</option>
                          <option value="gemini-3.5-flash">Gemini 3.5 Flash (Ücretsiz)</option>
                          <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash-Lite (Ücretsiz)</option>
                          <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash-Lite (Ücretsiz)</option>
                          <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Preview) (Ücretsiz)</option>
                        </optgroup>
                        <optgroup label="Gemini 2.5 Serisi">
                          <option value="gemini-2.5-flash">Gemini 2.5 Flash (Ücretsiz)</option>
                          <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite (Ücretsiz)</option>
                          <option value="gemini-2.5-pro">Gemini 2.5 Pro (Ücretsiz)</option>
                        </optgroup>
                      </select>
                    </div>
                    {geminiModelReasoning && (
                      <button 
                        onClick={() => handleTestSpecificModel(geminiModelReasoning, 'reasoning', 'gemini')}
                        disabled={testingModel === geminiModelReasoning}
                        className="w-full py-2 bg-sky-100/70 hover:bg-sky-200 dark:bg-sky-900/40 dark:hover:bg-sky-900/70 text-sky-700 dark:text-sky-300 rounded-xl text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {testingModel === geminiModelReasoning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                        Bu Modeli Test Et
                      </button>
                    )}
                  </div>

                  <div className="p-4 bg-sky-50/50 dark:bg-sky-950/30 rounded-2xl border border-sky-100 dark:border-sky-900/50 flex flex-col justify-between space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-sky-500" />
                        Görsel Üretim Modeli (T2I)
                      </label>
                      <select
                        value={geminiModelGeneration}
                        onChange={(e) => setGeminiModelGeneration(e.target.value)}
                        className="w-full p-2.5 bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-800 rounded-xl text-xs font-bold"
                      >
                        <option value="">Seçiniz</option>
                        <optgroup label="Gemini Image Modelleri">
                          <option value="gemini-3.1-flash-image">Gemini 3.1 Flash Image (Nano Banana 2) - Ücretli</option>
                          <option value="gemini-3.1-flash-lite-image">Gemini 3.1 Flash-Lite Image - Ücretli</option>
                          <option value="gemini-3-pro-image">Gemini 3 Pro Image (Nano Banana Pro) - Ücretli</option>
                          <option value="gemini-2.5-flash-image">Gemini 2.5 Flash Image - Ücretli</option>
                          <option value="imagen-4.0-generate">Imagen 4.0 - Ücretli</option>
                        </optgroup>
                      </select>
                    </div>
                    {geminiModelGeneration && (
                      <button 
                        onClick={() => handleTestSpecificModel(geminiModelGeneration, 'generation', 'gemini')}
                        disabled={testingModel === geminiModelGeneration}
                        className="w-full py-2 bg-sky-100/70 hover:bg-sky-200 dark:bg-sky-900/40 dark:hover:bg-sky-900/70 text-sky-700 dark:text-sky-300 rounded-xl text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {testingModel === geminiModelGeneration ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                        Bu Modeli Test Et
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </AccordionCard>

          {/* SECTION 4: OPENROUTER MODEL CATALOG */}
          {activeAiProvider === 'openrouter' && (
            <AccordionCard
              isOpen={expandedAiSections.catalog}
              onToggle={() => toggleAiSection('catalog')}
              title="4. OpenRouter Model Kataloğu & Tarayıcı"
              subtitle="200+ modeli arayın, filtreleyin ve tek tıkla rollere atayın"
              icon={<Search className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
              badge={
                <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700">
                  {openRouterModels.length > 0 ? `${openRouterModels.length} Model` : 'Model Listesi'}
                </span>
              }
            >
              <div className="space-y-3 pt-3">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Model adı veya sağlayıcı ile ara... (Örn: claude, gemini, gpt-4o, llama, deepseek)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {isLoadingModels && (
                    <RefreshCw className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500 animate-spin" />
                  )}
                </div>

                <div className="h-[380px] overflow-y-auto custom-scrollbar border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/50 p-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {openRouterModels
                    .filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()) || m.id.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((model) => {
                      const isFree = parseFloat(model.pricing?.prompt || "1") === 0 && parseFloat(model.pricing?.completion || "1") === 0;
                      const hasVision = model.architecture?.input_modalities?.includes('image');
                      const isTextToImage = model.architecture?.output_modalities?.includes('image');
                      const hasWebSearch = model.supported_parameters?.includes('tools') || Object.keys(model.pricing || {}).includes('web_search');

                      return (
                        <div key={model.id} className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col justify-between hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors group shadow-2xs">
                          <div className="space-y-2 mb-2.5">
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
                              {hasWebSearch && (
                                <span className="px-1.5 py-0.5 bg-sky-50 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400 rounded border border-sky-200 dark:border-sky-800 flex items-center gap-1">
                                  <Globe className="w-2.5 h-2.5" /> Web Arama
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
                                toast.success(`Görsel analiz için ${model.name} seçildi.`);
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
                              onClick={() => {
                                setModelReasoning(model.id);
                                toast.success(`SEO metin yazarı için ${model.name} seçildi.`);
                              }}
                              className={`flex-1 py-1 text-[9px] font-bold rounded-lg border transition-colors ${
                                modelReasoning === model.id
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                              }`}
                            >
                              SEO İçin Seç
                            </button>
                            
                            <button
                              onClick={() => {
                                setModelGeneration(model.id);
                                toast.success(`Görsel üretim için ${model.name} seçildi.`);
                              }}
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
            </AccordionCard>
          )}

          {/* SECTION 5: SYSTEM PROMPTS & VARIABLE CAPSULES */}
          <AccordionCard
            isOpen={expandedAiSections.prompts}
            onToggle={() => toggleAiSection('prompts')}
            title="5. Sistem Promptları & Değişken Kapsülleri"
            subtitle="Görsel Analiz ve İlan İçeriği Üretme şablonları & Türkçe değişken kapsülleri"
            icon={<MessageSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
            badge={
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-lg border border-indigo-200 dark:border-indigo-800">
                  2 Şablon
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-lg border border-emerald-200 dark:border-emerald-800 hidden sm:inline-block">
                  12 Değişken Kapsülü
                </span>
              </div>
            }
          >
            <div className="space-y-4 pt-3">
              {/* Header Info & Mobile Quick Subtab Switcher */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                  <Info className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span>Promptlar İngilizce işlenir, değişken kapsülleri Türkçe açıklanmıştır.</span>
                </div>

                {/* Sub-tab switcher for mobile/desktop ergonomics */}
                <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 self-start sm:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => setActivePromptSubTab('both')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      activePromptSubTab === 'both'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Tümü
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePromptSubTab('vision')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      activePromptSubTab === 'vision'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <ImageIcon className="w-3 h-3" />
                    Görsel Analiz
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePromptSubTab('listing')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      activePromptSubTab === 'listing'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <FileText className="w-3 h-3" />
                    İlan Üretimi
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {/* 1. Görsel Analizi Promptu */}
                {(activePromptSubTab === 'both' || activePromptSubTab === 'vision') && (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3.5 animate-fadeIn">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <ImageIcon className="w-4 h-4 text-indigo-500" />
                          <span>1. Görsel Analizi Promptu (Vision AI)</span>
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Tasarım yüklendiğinde görseli ve tipografiyi analiz edip Etsy taksonomisine eşleyen prompt şablonu.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setPromptAnalyzeDesign(DEFAULT_ANALYZE_DESIGN_PROMPT);
                          toast.info('Görsel Analizi promptu varsayılana döndürüldü.');
                        }}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                      >
                        <RotateCcw className="w-3 h-3" /> Varsayılana Sıfırla
                      </button>
                    </div>

                    {/* Değişken Kapsülleri */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-indigo-500" />
                          Desteklenen Değişken Kapsülleri (İmlecin olduğu konuma eklemek için tıklayın):
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {PROMPT_VARIABLES_ANALYZE.map((v) => (
                          <PromptVariablePill
                            key={v.tag}
                            variable={v}
                            onClick={() => insertVariable(setPromptAnalyzeDesign, promptAnalyzeDesign, v.tag, 'vision_prompt_textarea', v.label)}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="relative">
                      <textarea
                        id="vision_prompt_textarea"
                        value={promptAnalyzeDesign}
                        onChange={(e) => setPromptAnalyzeDesign(e.target.value)}
                        placeholder="Eğer boş bırakırsanız sistem varsayılan promptu kullanır..."
                        className="w-full h-48 sm:h-56 p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-mono custom-scrollbar transition-all leading-relaxed"
                      />
                    </div>
                  </div>
                )}

                {/* 2. İlan İçeriği Üretme Promptu */}
                {(activePromptSubTab === 'both' || activePromptSubTab === 'listing') && (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3.5 animate-fadeIn">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-emerald-500" />
                          <span>2. İlan İçeriği Üretme Promptu (SEO & Copywriting)</span>
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Etsy için 140 karakter SEO başlığı, 13 adet 20 karakterlik etiket, açıklama metni ve taksonomi niteliklerini üreten ana şablon.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setPromptGenerateListing(DEFAULT_GENERATE_LISTING_PROMPT);
                          toast.info('İlan İçeriği Üretme promptu varsayılana döndürüldü.');
                        }}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                      >
                        <RotateCcw className="w-3 h-3" /> Varsayılana Sıfırla
                      </button>
                    </div>

                    {/* Değişken Kapsülleri */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-emerald-500" />
                          Desteklenen Değişken Kapsülleri ({PROMPT_VARIABLES_GENERATE.length} Adet - Tıklayıp İmleç Konumuna Ekleyin):
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {PROMPT_VARIABLES_GENERATE.map((v) => (
                          <PromptVariablePill
                            key={v.tag}
                            variable={v}
                            onClick={() => insertVariable(setPromptGenerateListing, promptGenerateListing, v.tag, 'listing_prompt_textarea', v.label)}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="relative">
                      <textarea
                        id="listing_prompt_textarea"
                        value={promptGenerateListing}
                        onChange={(e) => setPromptGenerateListing(e.target.value)}
                        placeholder="Eğer boş bırakırsanız sistem varsayılan promptu kullanır..."
                        className="w-full h-64 sm:h-96 p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-mono custom-scrollbar transition-all leading-relaxed"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </AccordionCard>

          {/* Bottom Sticky / Prominent Save Bar */}
          <div className="sticky bottom-4 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 text-center sm:text-left">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Yapılan tüm AI sağlayıcı, model ve prompt ayarları veritabanı ile eşlenir.</span>
            </div>
            <button
              onClick={handleSaveApiSettings}
              className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Ayarları Veritabanına Kaydet &amp; Eşitle</span>
            </button>
          </div>
        </div>
      )}

      {/* Test Sonuç Modalı */}
      {testResponseData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg overflow-hidden animate-slideUp">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/60 rounded-lg text-indigo-600 dark:text-indigo-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-800 dark:text-white text-sm">Model Test Sonucu</h3>
              </div>
              <button onClick={() => setTestResponseData(null)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Test Edilen Model</span>
                <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-700 dark:text-slate-300">{testResponseData.model}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Modelin Yanıtı</span>
                {testResponseData.imageUrl ? (
                  <div className="space-y-3">
                    <img src={testResponseData.imageUrl} alt="Generated" className="w-full rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm" />
                    <p className="text-xs text-slate-600 dark:text-slate-400 italic">Üretilen görsel başarıyla ayıklandı.</p>
                  </div>
                ) : (
                  <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
                    {testResponseData.content}
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex justify-end">
              <button
                onClick={() => setTestResponseData(null)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB 3: KEYWORDS */}
      {activeSubTab === 'keywords' && (
        <div className="animate-fadeIn">
          <ErrorBoundary fallbackTitle="Kelime Havuzu Yüklenirken Bir Hata Oluştu">
            <KeywordPoolManagement />
          </ErrorBoundary>
        </div>
      )}

      {/* SUB TAB 4: ETSY TAXONOMY */}
      {activeSubTab === 'taxonomy' && (
        <div className="animate-fadeIn">
          <ErrorBoundary fallbackTitle="Kategori ve Taksonomi Yüklenirken Bir Hata Oluştu">
            <TaxonomyManagement />
          </ErrorBoundary>
        </div>
      )}

      {/* SUB TAB 5: USER MANAGEMENT */}
      {activeSubTab === 'users' && (
        <UserManagementSection />
      )}

      {/* SUB TAB 6: SYSTEM SETTINGS & MAINTENANCE */}
      {activeSubTab === 'settings' && (
        <AdminSettingsSection
          sampleStats={sampleStats}
          isUpdatingSampleData={isUpdatingSampleData}
          onSetMyWorkspaceAsSampleData={handleSetMyWorkspaceAsSampleData}
          onResetSampleData={handleResetSampleData}
          isTestingDb={isTestingDb}
          dbHealthResult={dbHealthResult}
          onTestDatabaseHealth={handleTestDatabaseHealth}
          storageDiagnostics={storageDiagnostics}
          isCheckingStorage={isCheckingStorage}
          onCheckStorage={handleCheckStorage}
          onPurgeSystemJunkData={handlePurgeSystemJunkData}
        />
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
    <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 space-y-4 sm:space-y-6 shadow-sm animate-fadeIn">
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
        <div className="bg-slate-50 dark:bg-slate-950 p-3 font-bold text-slate-500 dark:text-slate-400 hidden sm:grid grid-cols-12 items-center">
          <div className="col-span-4 sm:col-span-4">Kullanıcı &amp; E-Posta</div>
          <div className="col-span-3 sm:col-span-3">Rol Seviyesi</div>
          <div className="col-span-2 sm:col-span-2">Durum</div>
          <div className="col-span-3 sm:col-span-3 text-right">Erişim &amp; İşlemler</div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {userList.map((u) => {
            const isBlocked = u.status === 'blocked';
            return (
              <div key={u.id} className="p-3 sm:grid sm:grid-cols-12 flex flex-col items-start sm:items-center gap-3 sm:gap-2 hover:bg-slate-50/50 dark:hover:bg-slate-950/50 transition-colors">
                {/* User info */}
                <div className="col-span-4 w-full flex items-center space-x-2.5">
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
                <div className="col-span-3 w-full sm:w-auto flex justify-between sm:block items-center">
                  <span className="sm:hidden font-bold text-slate-500">Rol Seviyesi:</span>
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
                <div className="col-span-2 w-full sm:w-auto flex justify-between sm:block items-center">
                  <span className="sm:hidden font-bold text-slate-500">Erişim Durumu:</span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    isBlocked
                      ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                      : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  }`}>
                    {isBlocked ? 'Engellendi' : 'Aktif'}
                  </span>
                </div>

                {/* Actions */}
                <div className="col-span-3 w-full sm:w-auto flex items-center justify-end space-x-2 pt-2 sm:pt-0 border-t sm:border-0 border-slate-100 dark:border-slate-800">
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
                    <span className="sm:hidden md:inline">{isBlocked ? 'Engeli Kaldır' : 'Engelle'}</span>
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
