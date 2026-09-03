'use client';

/**
 * MockupFolderTemplatePanel — Sade Şablon Ayarları Modalı
 * =========================================================
 * 3 sekme:
 *  1. Varyasyon Şablonu  — Etsy SEO sekmesinde kayıtlı varyasyon şablonlarından birini seç
 *  2. Etsy Kategorisi    — Admin panelde aktifleştirilmiş kategorilerden birini seç
 *  3. Zamanlama          — Otonom çalışma zamanı (cron)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Settings2, Layers, FolderTree, Clock,
  Save, Loader2, CheckCircle2, AlertCircle,
  RefreshCw, Search, Check
} from 'lucide-react';
import { MockupFolder } from '@/types/pod';
import { PodTemplateAutomationSchedule } from '@/types/templates';
import { ScheduleSection } from '../../templates/sections/ScheduleSection';

// ─── Types ────────────────────────────────────────────────────────────────────

interface VariationTemplate {
  id: string;
  name: string;
  updatedAt?: string;
  variations: unknown[];
}

interface TaxonomyCategory {
  id: number;
  name: string;
  path: string;
  isActive: boolean;
}

interface FolderTemplateConfig {
  variationTemplateId?: string;
  variationTemplateName?: string;
  taxonomyId?: number;
  taxonomyPath?: string;
  automationSchedule?: PodTemplateAutomationSchedule;
}

interface MockupFolderTemplatePanelProps {
  folder: MockupFolder;
  isOpen: boolean;
  onClose: () => void;
}

type PanelTab = 'variation' | 'category' | 'schedule';

const PANEL_TABS: { key: PanelTab; label: string; icon: React.ElementType }[] = [
  { key: 'variation', label: 'Varyasyon Şablonu', icon: Layers },
  { key: 'category',  label: 'Etsy Kategorisi',   icon: FolderTree },
  { key: 'schedule',  label: 'Zamanlama',          icon: Clock },
];

const DEFAULT_SCHEDULE: PodTemplateAutomationSchedule = {
  enabled: false,
  cronExpression: '0 9 * * *',
  timezone: 'Europe/Istanbul',
  nextRunAt: null,
  listingsPerRun: 1,
  publishMode: 'draft',
};

// ─── Bileşen ──────────────────────────────────────────────────────────────────

export const MockupFolderTemplatePanel: React.FC<MockupFolderTemplatePanelProps> = ({
  folder,
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<PanelTab>('variation');

  // Kaydedilmiş config (bu klasöre ait)
  const [config, setConfig] = useState<FolderTemplateConfig>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  // Varyasyon şablonları (Etsy SEO sekmesinden kaydedilmiş)
  const [variationTemplates, setVariationTemplates] = useState<VariationTemplate[]>([]);
  const [loadingVariations, setLoadingVariations] = useState(false);

  // Etsy kategorileri (admin panelde aktif olanlar)
  const [categories, setCategories] = useState<TaxonomyCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');

  // ── Mevcut config'i yükle ─────────────────────────────────────────────────
  const loadConfig = useCallback(async () => {
    if (!folder.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/templates/folder-config?folderId=${folder.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.config) {
          setConfig(data.config);
        }
      }
    } catch {
      // Yeni klasör — config yok
    } finally {
      setLoading(false);
    }
  }, [folder.id]);

  // ── Varyasyon şablonlarını yükle ─────────────────────────────────────────
  const loadVariationTemplates = useCallback(async () => {
    setLoadingVariations(true);
    try {
      const res = await fetch('/api/workspace/variation-templates');
      if (res.ok) {
        const data = await res.json();
        setVariationTemplates(data?.templates ?? []);
      }
    } catch {
      setVariationTemplates([]);
    } finally {
      setLoadingVariations(false);
    }
  }, []);

  // ── Aktif Etsy kategorilerini yükle ──────────────────────────────────────
  const loadCategories = useCallback(async () => {
    setLoadingCategories(true);
    try {
      const res = await fetch('/api/admin/taxonomy-sync');
      if (res.ok) {
        const data = await res.json();
        const all: TaxonomyCategory[] = data?.categories ?? [];
        setCategories(all.filter((c) => c.isActive));
      }
    } catch {
      setCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    loadConfig();
    loadVariationTemplates();
    loadCategories();
    setActiveTab('variation');
    setSaveStatus('idle');
  }, [isOpen, loadConfig, loadVariationTemplates, loadCategories]);

  // ── Kaydet ───────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setSaveStatus('idle');
    try {
      const res = await fetch('/api/templates/folder-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: folder.id, folderName: folder.name, config }),
      });
      if (res.ok) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
      }
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const filteredCategories = categories.filter(
    (c) =>
      !categorySearch ||
      c.name.toLowerCase().includes(categorySearch.toLowerCase()) ||
      c.path.toLowerCase().includes(categorySearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700/60 overflow-hidden flex flex-col max-h-[88vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-purple-600/10 to-indigo-600/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-purple-600/15 flex items-center justify-center">
              <Settings2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Şablon Ayarları</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">📁 {folder.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3 pb-2 border-b border-slate-100 dark:border-slate-800 overflow-x-auto shrink-0">
          {PANEL_TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === key
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
              <span className="ml-2 text-sm text-slate-500">Yükleniyor...</span>
            </div>
          ) : (
            <>
              {/* ── Sekme 1: Varyasyon Şablonu ─────────────────────────── */}
              {activeTab === 'variation' && (
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        Varyasyon Şablonu Seç
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Etsy SEO sekmesinde kaydettiğin şablonlar. Bu şablon otomasyon sırasında kullanılacak.
                      </p>
                    </div>
                    <button
                      onClick={loadVariationTemplates}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
                      title="Yenile"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingVariations ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  {loadingVariations ? (
                    <div className="text-center py-8 text-slate-400 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" />
                      Şablonlar yükleniyor...
                    </div>
                  ) : variationTemplates.length === 0 ? (
                    <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-6 text-center">
                      <Layers className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        Kayıtlı varyasyon şablonu yok
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                        Etsy SEO sekmesinde varyasyon tablosunu düzenleyip şablon olarak kaydet.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Seçim yok seçeneği */}
                      <button
                        onClick={() => setConfig(c => ({ ...c, variationTemplateId: undefined, variationTemplateName: undefined }))}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border-2 text-sm transition-all ${
                          !config.variationTemplateId
                            ? 'border-slate-400 bg-slate-50 dark:bg-slate-800/60 dark:border-slate-500'
                            : 'border-slate-200 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        <span className="text-slate-500 dark:text-slate-400 italic text-xs">
                          Şablon seçilmedi — otomasyon öncesinde belirlenecek
                        </span>
                        {!config.variationTemplateId && (
                          <Check className="w-4 h-4 text-slate-500 shrink-0" />
                        )}
                      </button>

                      {variationTemplates.map((tmpl) => {
                        const isSelected = config.variationTemplateId === tmpl.id;
                        return (
                          <button
                            key={tmpl.id}
                            onClick={() => setConfig(c => ({
                              ...c,
                              variationTemplateId: tmpl.id,
                              variationTemplateName: tmpl.name,
                            }))}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border-2 text-sm transition-all text-left ${
                              isSelected
                                ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30 dark:border-purple-600'
                                : 'border-slate-200 dark:border-slate-700/60 hover:border-purple-300 dark:hover:border-purple-700/50'
                            }`}
                          >
                            <div>
                              <span className={`font-semibold block ${isSelected ? 'text-purple-700 dark:text-purple-300' : 'text-slate-800 dark:text-slate-100'}`}>
                                {tmpl.name}
                              </span>
                              <span className="text-xs text-slate-400">
                                {Array.isArray(tmpl.variations) ? tmpl.variations.length : 0} varyasyon
                              </span>
                            </div>
                            {isSelected && (
                              <CheckCircle2 className="w-5 h-5 text-purple-500 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── Sekme 2: Etsy Kategorisi ────────────────────────────── */}
              {activeTab === 'category' && (
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        Etsy Kategorisi Seç
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Admin panelde aktifleştirilmiş kategoriler listeleniyor.
                      </p>
                    </div>
                    <button
                      onClick={loadCategories}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
                      title="Yenile"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingCategories ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  {/* Arama */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Kategori ara..."
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-purple-400 dark:focus:border-purple-500 transition-colors"
                    />
                  </div>

                  {loadingCategories ? (
                    <div className="text-center py-8 text-slate-400 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" />
                      Kategoriler yükleniyor...
                    </div>
                  ) : categories.length === 0 ? (
                    <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-6 text-center">
                      <FolderTree className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        Aktif kategori yok
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                        Admin paneli → Etsy Kategorileri bölümünden kategorileri aktifleştir.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                      {/* Seçim yok */}
                      <button
                        onClick={() => setConfig(c => ({ ...c, taxonomyId: undefined, taxonomyPath: undefined }))}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border-2 text-xs transition-all ${
                          !config.taxonomyId
                            ? 'border-slate-400 bg-slate-50 dark:bg-slate-800/60 dark:border-slate-500'
                            : 'border-slate-200 dark:border-slate-700/60 hover:border-slate-300'
                        }`}
                      >
                        <span className="text-slate-400 italic">Kategori seçilmedi</span>
                        {!config.taxonomyId && <Check className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                      </button>

                      {filteredCategories.map((cat) => {
                        const isSelected = config.taxonomyId === cat.id;
                        // Tam path'i parçalara ayır — hepsini göster
                        const pathParts = cat.path.split(' > ');
                        // İsim (son segment) + üst hiyerarşi (kalanlar)
                        const categoryName = pathParts[pathParts.length - 1] ?? cat.name;
                        const breadcrumb = pathParts.slice(0, -1).join(' › ');

                        return (
                          <button
                            key={cat.id}
                            onClick={() => setConfig(c => ({
                              ...c,
                              taxonomyId: cat.id,
                              taxonomyPath: cat.path,
                            }))}
                            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border-2 transition-all text-left ${
                              isSelected
                                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 dark:border-indigo-600'
                                : 'border-slate-200 dark:border-slate-700/60 hover:border-indigo-300 dark:hover:border-indigo-700/50'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <span className={`text-xs font-bold block ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-100'}`}>
                                {categoryName}
                              </span>
                              {breadcrumb && (
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">
                                  {breadcrumb}
                                </span>
                              )}
                              <span className="text-[10px] text-slate-300 dark:text-slate-600">
                                ID: {cat.id}
                              </span>
                            </div>
                            {isSelected && (
                              <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0 ml-2" />
                            )}
                          </button>
                        );
                      })}

                      {filteredCategories.length === 0 && categorySearch && (
                        <p className="text-center text-xs text-slate-400 py-4">
                          "{categorySearch}" için sonuç bulunamadı
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Sekme 3: Zamanlama ──────────────────────────────────── */}
              {activeTab === 'schedule' && (
                <div className="p-5">
                  <ScheduleSection
                    schedule={config.automationSchedule ?? DEFAULT_SCHEDULE}
                    onChange={(v) => setConfig(c => ({ ...c, automationSchedule: v }))}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 shrink-0">
          <div className="text-xs">
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Kaydedildi
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="flex items-center gap-1.5 text-red-500">
                <AlertCircle className="w-3.5 h-3.5" />
                Kaydetme hatası
              </span>
            )}
            {/* Seçili özet */}
            {saveStatus === 'idle' && (
              <span className="text-slate-400">
                {config.variationTemplateName
                  ? `✓ ${config.variationTemplateName}`
                  : config.taxonomyId
                  ? `✓ Kategori: ${config.taxonomyId}`
                  : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              Kapat
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 transition-all shadow-sm"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Kaydet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
