'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Zap,
  Key,
  Cpu,
  RefreshCw,
  CheckCircle2,
  Activity,
  Sparkles,
  Globe,
  Lock,
  Search,
  Image as ImageIcon,
  FileText,
  Coins,
  MessageSquare,
  XCircle,
  ShoppingBag,
  ChevronDown,
  Video,
} from 'lucide-react';
import { useToast } from '@/components/common/ToastContext';
import { useAuth } from '@/components/common/UserAuthContext';
import { saveAppData, loadAppData } from '@/lib/storage-service';
import { PROMPT_DEFINITIONS, PROMPT_KEYS, resolvePrompt, type PromptKey } from '@/lib/prompt-registry';
import { AdminPromptEditor, PROMPT_VARIABLE_COUNT } from './AdminPromptEditor';
import { DialogPanel } from '@/components/common/DialogPanel';
import { GoogleCloudConnectionCard, GoogleModelOptions } from './GoogleCloudConnection';
import { normalizeVideoModel, type GoogleModelInfo } from '@/lib/google-cloud-credentials';
import { Spinner } from '@/components/common/Spinner';

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


const MODEL_VISION_STORAGE = 'automania_model_vision';
const MODEL_REASONING_STORAGE = 'automania_model_reasoning';
const MODEL_GENERATION_STORAGE = 'automania_model_generation';

function readStoredModel(key: string): string {
  try {
    return localStorage.getItem(key) || '';
  } catch (e) {
    console.error('Failed to load OpenRouter storage', e);
    return '';
  }
}

type ScrapingProvider = 'scraperapi' | 'scrapingbee' | 'zenrows';

type OpenRouterModel = {
  id: string;
  name?: string;
  context_length: number;
  pricing?: Record<string, string>;
  architecture?: { input_modalities?: string[]; output_modalities?: string[] };
  supported_parameters?: string[];
};

/** Admin paneli › AI & OpenRouter sekmesi: sağlayıcı anahtarları, model seçimi ve prompt şablonları. */
export const AdminAiSettingsSection: React.FC = () => {
  const toast = useToast();
  const { user } = useAuth();

  // 3-Tier Model System & Global Settings
  const [activeAiProvider, setActiveAiProvider] = useState<'openrouter' | 'gemini'>('openrouter');
  const [openRouterApiKey, setOpenRouterApiKey] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  
  const [etsyKeystring, setEtsyKeystring] = useState('');
  const [etsySharedSecret, setEtsySharedSecret] = useState('');

  // Scraping & Proxy Settings
  const [scrapingProvider, setScrapingProvider] = useState<ScrapingProvider>('scraperapi');
  const [scrapingApiKey, setScrapingApiKey] = useState('');
  const [cloudflareWorkerUrl, setCloudflareWorkerUrl] = useState('');
  
  // Bileşen yalnızca istemcide (ssr: false) yüklenir; kayıtlı seçimler ilk render'da okunur.
  const [modelVision, setModelVision] = useState(() => readStoredModel(MODEL_VISION_STORAGE));
  const [modelReasoning, setModelReasoning] = useState(() => readStoredModel(MODEL_REASONING_STORAGE));
  const [modelGeneration, setModelGeneration] = useState(() => readStoredModel(MODEL_GENERATION_STORAGE));
  const [modelVideo, setModelVideo] = useState('');
  
  const [geminiModelVision, setGeminiModelVision] = useState('');
  const [geminiModelReasoning, setGeminiModelReasoning] = useState('');
  const [geminiModelGeneration, setGeminiModelGeneration] = useState('');
  const [geminiModelVideo, setGeminiModelVideo] = useState('');
  const [researchWebSearch, setResearchWebSearch] = useState(true);
  const [researchModel, setResearchModel] = useState('');
  // Aktif Google bağlantısının (API anahtarı veya Vertex AI) Google'dan çekilen güncel model listesi
  const [googleModels, setGoogleModels] = useState<GoogleModelInfo[] | null>(null);
  const [googleModelsInfo, setGoogleModelsInfo] = useState<{ mode?: string; error?: string }>({});
  const [isLoadingGoogleModels, setIsLoadingGoogleModels] = useState(false);

  const fetchGoogleModels = async () => {
    setIsLoadingGoogleModels(true);
    try {
      const res = await fetch('/api/admin/google-cloud/models');
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && Array.isArray(data.models)) {
        setGoogleModels(data.models);
        setGoogleModelsInfo({ mode: data.mode });
      } else {
        setGoogleModels(null);
        setGoogleModelsInfo({ error: data.error || 'Google model listesi alınamadı.' });
      }
    } catch {
      setGoogleModels(null);
      setGoogleModelsInfo({ error: 'Google model listesi alınamadı.' });
    } finally {
      setIsLoadingGoogleModels(false);
    }
  };

  // AI Prompts State
  // Tüm talimatlar (bkz. prompt-registry); kayıtlı değer yoksa varsayılan metin gösterilir.
  const [prompts, setPrompts] = useState<Record<PromptKey, string>>(
    () => Object.fromEntries(PROMPT_DEFINITIONS.map((d) => [d.key, d.defaultValue])) as Record<PromptKey, string>,
  );

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
  const [openRouterModels, setOpenRouterModels] = useState<OpenRouterModel[]>([]);
  // Modeller bileşen açılırken yüklenir.
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Connection Test state
  const [testingModel, setTestingModel] = useState<string | null>(null);
  const [testResponseData, setTestResponseData] = useState<{model: string, content: string, imageUrl?: string} | null>(null);

  // Yeni Cihaz / Çapraz Cihaz Senkronizasyonu
  useEffect(() => {
    const syncApiSettingsFromServer = async () => {
      if (!user?.id) return;
      try {
        const res = await fetch(`/api/storage?userId=${user.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data) {
            if (data.modelVision) {
              setModelVision(data.modelVision);
              localStorage.setItem(MODEL_VISION_STORAGE, data.modelVision);
            }
            if (data.modelReasoning) {
              setModelReasoning(data.modelReasoning);
              localStorage.setItem(MODEL_REASONING_STORAGE, data.modelReasoning);
            }
            if (data.modelGeneration) {
              setModelGeneration(data.modelGeneration);
              localStorage.setItem(MODEL_GENERATION_STORAGE, data.modelGeneration);
            }
          }
        }
      } catch (e) {
        console.error("Buluttan ayarlar çekilirken hata oluştu", e);
      }
    };
    syncApiSettingsFromServer();
  }, [user?.id]);

  useEffect(() => {
    // Bileşen yalnızca AI sekmesi açıkken render edilir; ayarlar açılışta bir kez yüklenir.
    {
      fetch('/api/ai/proxy?endpoint=https://openrouter.ai/api/v1/models')
        .then(res => res.json())
        .then(data => {
          if (data && data.success && data.data.data) setOpenRouterModels(data.data.data);
        })
        .catch(() => toast.error('OpenRouter modelleri çekilirken hata oluştu.'))
        .finally(() => setIsLoadingModels(false));
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

            if (data.settings.scraping_provider) setScrapingProvider(data.settings.scraping_provider as ScrapingProvider);
            if (data.settings.scraping_api_key) setScrapingApiKey(data.settings.scraping_api_key);
            if (data.settings.cloudflare_worker_url) setCloudflareWorkerUrl(data.settings.cloudflare_worker_url);
            
            if (data.settings.openrouter_model_vision) setModelVision(data.settings.openrouter_model_vision);
            if (data.settings.openrouter_model_reasoning) setModelReasoning(data.settings.openrouter_model_reasoning);
            if (data.settings.openrouter_model_generation) setModelGeneration(data.settings.openrouter_model_generation);
            
            if (data.settings.gemini_model_vision) setGeminiModelVision(data.settings.gemini_model_vision);
            if (data.settings.gemini_model_reasoning) setGeminiModelReasoning(data.settings.gemini_model_reasoning);
            if (data.settings.gemini_model_generation) setGeminiModelGeneration(data.settings.gemini_model_generation);
            if (data.settings.gemini_model_video) setGeminiModelVideo(normalizeVideoModel(data.settings.gemini_model_video));
            setResearchWebSearch(data.settings.ai_research_web_search !== 'false');
            if (data.settings.ai_research_model) setResearchModel(data.settings.ai_research_model);
            
            if (data.settings.openrouter_model_video) setModelVideo(data.settings.openrouter_model_video);
            
            setPrompts(Object.fromEntries(PROMPT_KEYS.map((key) => [key, resolvePrompt(key, data.settings[key])])) as Record<PromptKey, string>);
          }
        })
        .catch(e => console.error("Could not fetch global settings", e));
    }
  }, [toast]);

  const handleSaveApiSettings = async () => {
    try {
      localStorage.setItem(MODEL_VISION_STORAGE, modelVision);
      localStorage.setItem(MODEL_REASONING_STORAGE, modelReasoning);
      localStorage.setItem(MODEL_GENERATION_STORAGE, modelGeneration);

      // Save global settings via Admin API
      const settingsToSave: Record<string, string> = {};
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
      if (geminiModelVideo) settingsToSave.gemini_model_video = geminiModelVideo;
      settingsToSave.ai_research_web_search = researchWebSearch ? 'true' : 'false';
      settingsToSave.ai_research_model = researchModel;
      if (modelVideo) settingsToSave.openrouter_model_video = modelVideo;

      for (const key of PROMPT_KEYS) settingsToSave[key] = prompts[key];

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

      toast.success('Yapay Zeka ve API ayarları başarıyla kaydedildi!');
    } catch {
      toast.error('Ayarlar kaydedilirken bir hata oluştu.');
    }
  };

  const handleTestSpecificModel = async (modelId: string, role: 'vision' | 'reasoning' | 'generation' | 'video', provider: 'openrouter' | 'gemini' = 'openrouter') => {
    setTestingModel(modelId);
    const startTime = Date.now();

    let messages: Array<{ role: string; content: string | Array<Record<string, unknown>> }> = [];
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
          role,
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
    } catch {
      toast.error(`Bağlantı hatası oluştu.`);
    } finally {
      setTestingModel(null);
    }
  };


  return (
    <>
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
                  {activeAiProvider === 'openrouter' ? 'OpenRouter' : 'Google Gemini'}
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
                      <div className="text-[10px] text-slate-500">Gemini, Imagen &amp; Veo (AI Studio API anahtarı veya Google Cloud Vertex AI)</div>
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

              {/* Google bağlantı yöntemi: API anahtarı veya Google Cloud hizmet hesabı (Vertex AI) */}
              <GoogleCloudConnectionCard onChanged={() => { void fetchGoogleModels(); }} />

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
                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 uppercase" lang="en">
                  {scrapingProvider}
                </span>
              </div>
            }
          >
            <div className="space-y-4 pt-3">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed space-y-1.5">
                <p className="font-semibold text-slate-800 dark:text-slate-200">Kazıma Sıralaması &amp; Çalışma Mantığı:</p>
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
                    onChange={(e) => setScrapingProvider(e.target.value as ScrapingProvider)}
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
                /* OpenRouter 4-Tier Model Cards */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
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
                        {testingModel === modelVision ? <Spinner className="w-3.5 h-3.5" /> : <Activity className="w-3.5 h-3.5" />}
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
                        {testingModel === modelReasoning ? <Spinner className="w-3.5 h-3.5" /> : <Activity className="w-3.5 h-3.5" />}
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
                        {testingModel === modelGeneration ? <Spinner className="w-3.5 h-3.5" /> : <Activity className="w-3.5 h-3.5" />}
                        Bu Modeli Test Et
                      </button>
                    )}
                  </div>

                  {/* Video Generation Model */}
                  <div className="p-4 bg-orange-50/50 dark:bg-orange-950/30 rounded-2xl border border-orange-100 dark:border-orange-900/50 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 bg-orange-100 dark:bg-orange-900/60 rounded-lg text-orange-600 dark:text-orange-400">
                          <Video className="w-4 h-4" />
                        </div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Video Üretim Modeli (T2V)</h4>
                      </div>
                      <div className="text-xs font-mono font-medium text-orange-700 dark:text-orange-400 bg-white dark:bg-slate-900 py-2 px-3 rounded-xl border border-orange-100 dark:border-orange-800 break-all shadow-2xs">
                        {modelVideo || 'Henüz Seçilmedi'}
                      </div>
                      <p className="mt-2 text-[10px] leading-snug text-orange-700/80 dark:text-orange-300/80">
                        Not: Video üretimi her zaman Google Veo ile yapılır. Bu alan kullanılmaz; video modelini Google Gemini bölümünden seçin.
                      </p>
                    </div>
                    {modelVideo && (
                      <button 
                        onClick={() => handleTestSpecificModel(modelVideo, 'video', 'openrouter')}
                        disabled={testingModel === modelVideo}
                        className="mt-3 w-full py-2 bg-orange-100/70 hover:bg-orange-200 dark:bg-orange-900/40 dark:hover:bg-orange-900/70 text-orange-700 dark:text-orange-300 rounded-xl text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {testingModel === modelVideo ? <Spinner className="w-3.5 h-3.5" /> : <Activity className="w-3.5 h-3.5" />}
                        Bu Modeli Test Et
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* Gemini 4-Tier Model Selectors */
                <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                  <span className={googleModelsInfo.error ? 'text-amber-700 dark:text-amber-400' : ''}>
                    {isLoadingGoogleModels
                      ? 'Modeller Google\'dan çekiliyor…'
                      : googleModels
                        ? `${googleModels.length} model Google'dan güncel olarak listelendi (${googleModelsInfo.mode === 'vertex' ? 'Google Cloud · Vertex AI' : 'AI Studio API anahtarı'}).`
                        : googleModelsInfo.error
                          ? `Güncel liste alınamadı: ${googleModelsInfo.error} Varsayılan liste gösteriliyor.`
                          : 'Varsayılan model listesi gösteriliyor.'}
                  </span>
                  <button
                    type="button"
                    onClick={() => { void fetchGoogleModels(); }}
                    disabled={isLoadingGoogleModels}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 font-bold shrink-0 disabled:opacity-50"
                  >
                    {isLoadingGoogleModels ? <Spinner className="w-3 h-3" /> : <RefreshCw className="w-3 h-3" />} Modelleri Google&apos;dan yenile
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
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
                        {googleModels ? (
                          <GoogleModelOptions models={googleModels} category="text" current={geminiModelVision} />
                        ) : (
                        <optgroup label="Gemini 3 Serisi (Multimodal & Vision)">
                          <option value="gemini-3.8-flash">Gemini 3.8 Flash (En Yeni & En Zeki)</option>
                          <option value="gemini-3.7-flash">Gemini 3.7 Flash (Yüksek Hız & Çoklu Yetenek)</option>
                          <option value="gemini-3.6-flash">Gemini 3.6 Flash (Dengeli & Kararlı)</option>
                          <option value="gemini-3.5-flash">Gemini 3.5 Flash (Geniş Bağlam)</option>
                          <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash-Lite (Ultra Hızlı / 0.7s)</option>
                          <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview (Gelişmiş Mantık)</option>
                        </optgroup>
                        )}
                      </select>
                    </div>
                    {geminiModelVision && (
                      <button 
                        onClick={() => handleTestSpecificModel(geminiModelVision, 'vision', 'gemini')}
                        disabled={testingModel === geminiModelVision}
                        className="w-full py-2 bg-sky-100/70 hover:bg-sky-200 dark:bg-sky-900/40 dark:hover:bg-sky-900/70 text-sky-700 dark:text-sky-300 rounded-xl text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {testingModel === geminiModelVision ? <Spinner className="w-3.5 h-3.5" /> : <Activity className="w-3.5 h-3.5" />}
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
                        {googleModels ? (
                          <GoogleModelOptions models={googleModels} category="text" current={geminiModelReasoning} />
                        ) : (
                        <optgroup label="Gemini 3 Serisi (SEO & Metin Üretimi)">
                          <option value="gemini-3.8-flash">Gemini 3.8 Flash (En Yeni & Üstün Akıl Yürütme)</option>
                          <option value="gemini-3.7-flash">Gemini 3.7 Flash (Yüksek Hız & Ajan Desteği)</option>
                          <option value="gemini-3.6-flash">Gemini 3.6 Flash (Dengeli & Güvenilir)</option>
                          <option value="gemini-3.5-flash">Gemini 3.5 Flash (Geniş Bağlam)</option>
                          <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash-Lite (Ultra Hızlı / 0.7s)</option>
                          <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview (Derin Mantık & Kod)</option>
                        </optgroup>
                        )}
                      </select>
                    </div>
                    {geminiModelReasoning && (
                      <button 
                        onClick={() => handleTestSpecificModel(geminiModelReasoning, 'reasoning', 'gemini')}
                        disabled={testingModel === geminiModelReasoning}
                        className="w-full py-2 bg-sky-100/70 hover:bg-sky-200 dark:bg-sky-900/40 dark:hover:bg-sky-900/70 text-sky-700 dark:text-sky-300 rounded-xl text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {testingModel === geminiModelReasoning ? <Spinner className="w-3.5 h-3.5" /> : <Activity className="w-3.5 h-3.5" />}
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
                        {googleModels ? (
                          <GoogleModelOptions models={googleModels} category="image" current={geminiModelGeneration} />
                        ) : (
                        <optgroup label="Google Görsel Modelleri (T2I)">
                          <option value="gemini-3.1-flash-image">Gemini 3.1 Flash Image (Nano Banana 2)</option>
                          <option value="gemini-3-pro-image">Gemini 3 Pro Image (Nano Banana 2 Pro)</option>
                          <option value="gemini-3.1-flash-lite-image">Gemini 3.1 Flash-Lite Image (Hızlı)</option>
                          <option value="gemini-2.5-flash-image">Gemini 2.5 Flash Image</option>
                        </optgroup>
                        )}
                      </select>
                    </div>
                    {geminiModelGeneration && (
                      <button 
                        onClick={() => handleTestSpecificModel(geminiModelGeneration, 'generation', 'gemini')}
                        disabled={testingModel === geminiModelGeneration}
                        className="w-full py-2 bg-sky-100/70 hover:bg-sky-200 dark:bg-sky-900/40 dark:hover:bg-sky-900/70 text-sky-700 dark:text-sky-300 rounded-xl text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {testingModel === geminiModelGeneration ? <Spinner className="w-3.5 h-3.5" /> : <Activity className="w-3.5 h-3.5" />}
                        Bu Modeli Test Et
                      </button>
                    )}
                  </div>

                  <div className="p-4 bg-sky-50/50 dark:bg-sky-950/30 rounded-2xl border border-sky-100 dark:border-sky-900/50 flex flex-col justify-between space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-1.5">
                        <Video className="w-4 h-4 text-sky-500" />
                        Video Üretim Modeli (T2V)
                      </label>
                      <select
                        value={geminiModelVideo}
                        onChange={(e) => setGeminiModelVideo(e.target.value)}
                        className="w-full p-2.5 bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-800 rounded-xl text-xs font-bold"
                      >
                        <option value="">Seçiniz</option>
                        {googleModels ? (
                          <GoogleModelOptions models={googleModels} category="video" current={geminiModelVideo} />
                        ) : (
                        <optgroup label="Google Video Modelleri">
                          <option value="gemini-omni-1.1-flash">Gemini Omni Flash (Gerçekçi)</option>
                          <option value="veo-3.1-fast-generate-001">Google Veo 3.1 Fast (Hız Odaklı)</option>
                          <option value="veo-3.1-generate-001">Google Veo 3.1 (Yüksek Kalite)</option>
                          <option value="veo-3.1-lite-generate-001">Google Veo 3.1 Lite (Ekonomik)</option>
                        </optgroup>
                        )}
                      </select>
                    </div>
                    {geminiModelVideo && (
                      <button 
                        onClick={() => handleTestSpecificModel(geminiModelVideo, 'video', 'gemini')}
                        disabled={testingModel === geminiModelVideo}
                        className="w-full py-2 bg-sky-100/70 hover:bg-sky-200 dark:bg-sky-900/40 dark:hover:bg-sky-900/70 text-sky-700 dark:text-sky-300 rounded-xl text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {testingModel === geminiModelVideo ? <Spinner className="w-3.5 h-3.5" /> : <Activity className="w-3.5 h-3.5" />}
                        Bu Modeli Test Et
                      </button>
                    )}
                  </div>
                </div>

                {/* Otomasyonun niş araştırması */}
                <div className="mt-4 p-4 bg-violet-50/50 dark:bg-violet-950/30 rounded-2xl border border-violet-100 dark:border-violet-900/50 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Search className="w-4 h-4 text-violet-500" />
                        Otomasyon Niş Araştırması
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        &quot;Konuyu yapay zekâ belirlesin&quot; seçili otomasyonlar her çalıştırmada takvimi, mağaza performansınızı ve Etsy kelime verilerini inceleyip niş seçer.
                      </p>
                    </div>
                    <label className="flex items-center gap-2 shrink-0 text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input type="checkbox" className="w-4 h-4 accent-violet-600" checked={researchWebSearch} onChange={(e) => setResearchWebSearch(e.target.checked)} />
                      Web araması
                    </label>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Web araması açıkken model Google Search ile güncel trendleri, Pinterest ve Google Trends sinyallerini de tarar (Google araması ücretlendirmesi uygulanabilir).
                  </p>
                  <div>
                    <label htmlFor="research-model" className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Araştırma modeli</label>
                    <select
                      id="research-model"
                      value={researchModel}
                      onChange={(e) => setResearchModel(e.target.value)}
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-violet-200 dark:border-violet-800 rounded-xl text-xs font-bold"
                    >
                      <option value="">Metin analiz modeliyle aynı ({geminiModelReasoning || 'varsayılan'})</option>
                      {googleModels && <GoogleModelOptions models={googleModels} category="text" current={researchModel} />}
                    </select>
                  </div>
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
                    <Spinner className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500" />
                  )}
                </div>

                <div className="h-[380px] overflow-y-auto custom-scrollbar border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/50 p-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {openRouterModels
                    .filter(m => (m.name ?? m.id).toLowerCase().includes(searchQuery.toLowerCase()) || m.id.toLowerCase().includes(searchQuery.toLowerCase()))
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
            subtitle="Yapay zekâya giden tüm talimatlar: tasarım, ilan & SEO, otomasyon ve video"
            icon={<MessageSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
            badge={
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-lg border border-indigo-200 dark:border-indigo-800">
                  {PROMPT_DEFINITIONS.length} Talimat
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-lg border border-emerald-200 dark:border-emerald-800 hidden sm:inline-block">
                  {PROMPT_VARIABLE_COUNT} Değişken
                </span>
              </div>
            }
          >
            <AdminPromptEditor values={prompts} onChange={(key, value) => setPrompts((prev) => ({ ...prev, [key]: value }))} />
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

      {/* Test Sonuç Modalı */}
      {testResponseData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
          <DialogPanel aria-labelledby="ai-test-result-title" onClose={() => setTestResponseData(null)} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg overflow-hidden animate-slideUp">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/60 rounded-lg text-indigo-600 dark:text-indigo-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 id="ai-test-result-title" className="font-bold text-slate-800 dark:text-white text-sm">Model Test Sonucu</h3>
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
          </DialogPanel>
        </div>
      )}
    </>
  );
};
