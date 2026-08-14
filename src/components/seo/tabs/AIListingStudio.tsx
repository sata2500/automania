// @ts-nocheck
'use client';
import React, { useState, useRef, useEffect } from 'react';
import { 
  Tag, Copy, Sparkles, Check, FileText, ShoppingBag, Layers, DollarSign, 
  Send, RefreshCw, AlertTriangle, CheckCircle, Image as ImageIcon, ChevronRight, 
  MousePointerClick, Filter, X, Folder, Edit2, Trash2, GripVertical, Download, 
  TrendingUp, Hash, Plus, ChevronDown, Settings, Info, Save, ShieldCheck, Rocket, CheckCircle2
} from 'lucide-react';
import { useEtsySeo } from '../context/EtsySeoContext';
import { EtsySerpPreview } from '../components/EtsySerpPreview';
import { TagMatrixScore } from '../components/TagMatrixScore';
import { useToast } from '@/components/common/ToastContext';

// MultiSelect Dropdown component for Etsy Taxonomy properties
const MultiSelectDropdown = ({ propItem, selectedValues = [], onChange }: { propItem: any, selectedValues: number[], onChange: (vals: number[]) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={wrapperRef}>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 text-left flex justify-between items-center"
      >
        <span className="truncate">
          {selectedValues.length > 0 ? `${selectedValues.length} seçenek işaretlendi` : 'Seçim Yapılmadı (Boş)'}
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>
      {isOpen && (
        <div className="absolute z-30 mt-1 w-full max-h-60 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg shadow-xl">
          {propItem.possible_values?.map((v: any) => (
            <label key={v.value_id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
              <input 
                type="checkbox" 
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                checked={selectedValues.includes(v.value_id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    onChange([...selectedValues, v.value_id]);
                  } else {
                    onChange(selectedValues.filter((id: number) => id !== v.value_id));
                  }
                }}
              />
              {v.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

export const AIListingStudio = () => {
  const {
    activeTab,
    foldersWithMockups,
    selectedFolderId,
    dbGeneratedMockups,
    handleFolderDragStart, handleFolderDragOver, handleFolderDrop, handleSelectFolder,
    editingFolderId, editingFolderName, setEditingFolderName, handleRenameFolder, setEditingFolderId,
    deletingFolderId, handleDeleteFolder, setDeletingFolderId, draggedFolderId,
    draggedMockupId, handleMockupDragStart, handleMockupDragOver, handleMockupDrop,
    handleDeleteMockup, 
    selectedDesign, niche, setNiche, productType, setProductType,
    userNotes, setUserNotes, isSavingSettings, handleSaveEtsySettings,
    generatedTitle, setGeneratedTitle, copyToClipboard, copiedKey,
    generatedDescription, setGeneratedDescription, selectedTags, setSelectedTags,
    enrichedKeywords, coOccurringTags,
    // Etsy Store Publishing State
    etsyConnected, selectedShippingProfileId, setSelectedShippingProfileId,
    shippingProfiles, selectedReadinessStateId, setSelectedReadinessStateId,
    readinessStates, isPublishing, handlePublishToEtsy, publishResult,
    basePrice, variations, setVariations,
    taxonomyId, whoMade, setWhoMade, whenMade, setWhenMade, isSupply, setIsSupply, materials, styles,
    productionPartnerId, setProductionPartnerId, isCustomizable, setIsCustomizable, sku, setSku,
    shopSections, selectedShopSectionId, setSelectedShopSectionId,
    returnPolicies, selectedReturnPolicyId, setSelectedReturnPolicyId,
    shouldAutoRenew, setShouldAutoRenew,
    availableTaxonomyProperties, selectedTaxonomyProperties, setSelectedTaxonomyProperties,
    savedTemplates, defaultTemplates, setDefaultTemplates
  } = useEtsySeo();
  const toast = useToast();

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedTemplateForDefault, setSelectedTemplateForDefault] = useState<string>('');

  const handleSetDefaultTemplate = async (templateId: string) => {
    if (!taxonomyId) {
      toast?.error?.('Lütfen önce bir kategori seçin.');
      return;
    }
    if (!templateId) return;

    const newDefaults = { ...defaultTemplates, [taxonomyId]: templateId };
    setDefaultTemplates(newDefaults);

    try {
      await fetch('/api/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ etsyDefaultTemplates: newDefaults })
      });
      toast?.success?.(`Seçilen şablon geçerli kategori (${taxonomyId}) için varsayılan olarak kaydedildi!`);
    } catch (e) {
      console.error(e);
    }
  };

  if (activeTab !== 'studio' && activeTab !== 'publish') return null;

  return (
    <div className="space-y-8">
      {/* 0. BATCH MOCKUP GALLERY HEADER */}
      {foldersWithMockups.length === 0 ? (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-500/30 p-4 rounded-2xl flex items-center space-x-3">
          <Sparkles className="w-5 h-5 text-amber-500 shrink-0" />
          <div className="text-xs text-amber-800 dark:text-amber-200">
            <span className="font-bold block">Henüz Toplu Üretim Yapmadınız</span>
            Mockup sekmesinde tasarımlarınızı hazırlayıp toplu üretime gönderdiğinizde, üretilen klasörler burada görüntülenecektir.
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <label className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Folder className="w-4 h-4 text-emerald-500" />
              Toplu Üretim Klasörleriniz ({foldersWithMockups.length} Adet):
            </label>
            {selectedFolderId && (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950 px-2.5 py-1 rounded-full border border-emerald-500/20">
                Seçili Klasör: {foldersWithMockups.find(f => f.id === selectedFolderId)?.name}
              </span>
            )}
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
            {foldersWithMockups.map((folder) => {
              const isSelected = selectedFolderId === folder.id;
              const thumbnailMockup = dbGeneratedMockups.find(m => m.folderId === folder.id && !m.isVideo);
              return (
                <div
                  key={folder.id}
                  draggable
                  onDragStart={(e) => handleFolderDragStart(e, folder.id)}
                  onDragOver={handleFolderDragOver}
                  onDrop={(e) => handleFolderDrop(e, folder.id)}
                  onClick={() => handleSelectFolder(folder.id)}
                  className={`relative shrink-0 w-24 h-24 rounded-xl border-2 cursor-pointer overflow-hidden transition-all group ${isSelected ? 'border-emerald-500 shadow-md ring-2 ring-emerald-500/30' : 'border-slate-200 dark:border-slate-800 hover:border-slate-400'} ${draggedFolderId === folder.id ? 'opacity-50' : ''}`}
                >
                  {thumbnailMockup ? (
                    <img 
                      src={thumbnailMockup.previewUrl} 
                      alt={folder.name} 
                      className="w-full h-full object-cover p-0.5 bg-slate-50 dark:bg-slate-950" 
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400">
                      <Folder className="w-8 h-8 mb-1" />
                    </div>
                  )}
                  
                  {editingFolderId === folder.id ? (
                    <div className="absolute inset-0 bg-white/95 dark:bg-slate-900/95 p-2 flex flex-col justify-center items-center gap-2 z-10" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="text"
                        autoFocus
                        className="w-full text-[11px] px-2 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-white rounded-md outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                        value={editingFolderName}
                        onChange={(e) => setEditingFolderName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameFolder(folder.id, editingFolderName);
                          if (e.key === 'Escape') setEditingFolderId(null);
                        }}
                      />
                      <div className="flex gap-1 w-full mt-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRenameFolder(folder.id, editingFolderName); }}
                          className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white p-1 rounded-md flex items-center justify-center transition-colors"
                          title="Kaydet"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingFolderId(null); }}
                          className="flex-1 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 p-1 rounded-md flex items-center justify-center transition-colors"
                          title="İptal"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : deletingFolderId === folder.id ? (
                    <div className="absolute inset-0 bg-red-500/95 p-2 flex flex-col justify-center items-center gap-1 z-10" onClick={(e) => e.stopPropagation()}>
                      <span className="text-[10px] text-white font-bold text-center leading-tight">Klasörü Sil?</span>
                      <div className="flex gap-1 w-full mt-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id); }}
                          className="flex-1 bg-white text-red-600 hover:bg-red-50 p-1 rounded-md flex items-center justify-center font-bold text-[10px]"
                        >
                          Evet
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeletingFolderId(null); }}
                          className="flex-1 bg-red-700 text-white hover:bg-red-800 p-1 rounded-md flex items-center justify-center font-bold text-[10px]"
                        >
                          Hayır
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="absolute inset-x-0 bottom-0 bg-black/75 backdrop-blur-xs text-[10px] text-white p-1 truncate font-semibold text-center leading-tight">
                      {folder.name}<br/>
                      <span className="text-[8px] text-slate-300">({folder.count} Görsel)</span>
                    </div>
                  )}

                  {isSelected && !editingFolderId && !deletingFolderId && (
                    <div className="absolute top-1 right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow">
                      <Check className="w-3 h-3" />
                    </div>
                  )}

                  {!editingFolderId && !deletingFolderId && (
                    <div 
                      className="absolute top-1 left-1 bg-black/50 text-white rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingFolderId(folder.id);
                        setEditingFolderName(folder.name);
                      }}
                    >
                      <Edit2 className="w-3 h-3" />
                    </div>
                  )}
                  
                  {!editingFolderId && !deletingFolderId && (
                    <div 
                      className="absolute top-1 right-1 bg-black/50 text-white rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingFolderId(folder.id);
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </div>
                  )}
                  <div className="absolute top-1 right-1/2 translate-x-1/2 opacity-0 group-hover:opacity-50 text-white cursor-grab active:cursor-grabbing">
                    <GripVertical className="w-4 h-4 drop-shadow-md" />
                  </div>
                </div>
              );
            })}
          </div>

          {selectedFolderId && dbGeneratedMockups.filter(m => m.folderId === selectedFolderId).length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <GripVertical className="w-3.5 h-3.5 text-emerald-500" />
                  Etsy'ye Gönderilecek Görseller ({dbGeneratedMockups.filter(m => m.folderId === selectedFolderId).length} Adet) - Sürükleyip Sıralayabilirsiniz:
                </label>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {dbGeneratedMockups.filter(m => m.folderId === selectedFolderId).map((mockup, idx) => {
                  const isDragged = draggedMockupId === mockup.id;
                  return (
                  <div 
                    key={mockup.id} 
                    draggable
                    onDragStart={(e) => handleMockupDragStart(e, mockup.id)}
                    onDragOver={handleMockupDragOver}
                    onDrop={(e) => handleMockupDrop(e, mockup.id)}
                    className={`group relative shrink-0 w-16 h-16 rounded-lg border-2 cursor-grab active:cursor-grabbing overflow-hidden bg-slate-50 dark:bg-slate-950 transition-all ${
                      isDragged ? 'opacity-50 border-emerald-500 scale-95' : 'border-slate-200 dark:border-slate-700 hover:border-emerald-500'
                    }`}
                  >
                    {mockup.isVideo ? (
                      <div className="w-full h-full flex items-center justify-center bg-slate-800">
                        <span className="text-[8px] font-bold text-white uppercase">VİDEO</span>
                      </div>
                    ) : (
                      <img src={mockup.previewUrl} alt={mockup.mockupName} className="w-full h-full object-cover" />
                    )}
                    <div className="absolute top-0 left-0 bg-black/60 text-white text-[8px] px-1 font-bold rounded-br-md">
                      #{idx + 1}
                    </div>
                    <a 
                      href={mockup.previewUrl} 
                      download={mockup.exportFileName || mockup.mockupName || "mockup"} 
                      target="_blank" 
                      rel="noreferrer"
                      className="absolute top-1 left-1 bg-emerald-500/80 text-white rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-emerald-600 cursor-pointer flex items-center justify-center"
                      title="İndir"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Download className="w-3 h-3" />
                    </a>
                    <div 
                      className="absolute top-1 right-1 bg-red-500/80 text-white rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 cursor-pointer flex items-center justify-center"
                      onClick={() => handleDeleteMockup(mockup.id)}
                      title="Kaldır"
                    >
                      <Trash2 className="w-3 h-3" />
                    </div>
                  </div>
                )})}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 1. ADIM: TASARIM & ÜRÜN YAPILANDIRMASI (UNIFIED SETTINGS CARD) */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-5 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-xs flex items-center justify-center font-bold">1</span>
              Tasarım & Ürün Yapılandırması
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Yapay zekanın analiz ettiği odak nişi kontrol edin; hedef kumaş/kalıp ve özel ürün talimatlarınızı belirleyin.
            </p>
          </div>

          <button
            onClick={handleSaveEtsySettings}
            disabled={isSavingSettings}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md hover:shadow-emerald-500/20 transition-all flex items-center gap-2 shrink-0 disabled:opacity-50"
          >
            {isSavingSettings ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Ayarları Veritabanına Kaydet
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Niche auto-detection box */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                Odak Niş / Tasarım Teması:
              </label>
              {selectedDesign?.analysis && (
                <span className="text-[10px] bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> AI Vision Analizi
                </span>
              )}
            </div>
            <input
              type="text"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="Örn: Cottagecore Rabbit, Vintage Botanical..."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl p-3 text-xs focus:ring-2 focus:ring-emerald-500 outline-none font-semibold"
            />
            <p className="text-[10px] text-slate-500">
              Klasör seçildiğinde yapay zekanın tespit ettiği gerçek tema/niş otomatik doldurulur.
            </p>
          </div>

          {/* Product type */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5 text-emerald-500" />
              Hedef Ürün / Kumaş / Kalıp Tipi:
            </label>
            <input
              type="text"
              value={productType}
              onChange={(e) => setProductType(e.target.value)}
              placeholder="Örn: Comfort Colors 1717 Garment-Dyed Tee, Bella Canvas 3001..."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl p-3 text-xs focus:ring-2 focus:ring-emerald-500 outline-none font-semibold"
            />
            <p className="text-[10px] text-slate-500">
              İlanda yer alacak tekstil markası ve ürün tipi açıklamaya ve SEO eşleşmesine dahil edilir.
            </p>
          </div>
        </div>

        {/* User Notes & Instructions in same card */}
        <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-emerald-500" />
            Kullanıcı Notları / Özel Ürün Talimatları (Yapay Zekanın Açıklamada Kullanacağı Bilgiler):
          </label>
          <textarea
            rows={2}
            value={userNotes}
            onChange={(e) => setUserNotes(e.target.value)}
            placeholder="Örn: Beden tablosuna göre 1 beden büyük tercih ediniz. %100 pamuk, 1-2 iş gününde kargoya verilir."
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl p-3 text-xs focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
          />
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. ADIM: YAPAY ZEKA SEO METİNLERİ & 13 ALTIN ETİKET */}
      {/* ------------------------------------------------------------- */}
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-xs flex items-center justify-center font-bold">2</span>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Yapay Zeka SEO Metinleri & 13 Altın Etiket
          </h3>
        </div>

        {/* Title Editor */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-sm">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <Tag className="w-4 h-4" />
              Etsy SEO Ürün Başlığı ({generatedTitle.length}/140 Karakter):
            </label>
            <button
              onClick={() => copyToClipboard(generatedTitle, 'title')}
              className="text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1 rounded-lg flex items-center gap-1.5 transition-colors font-medium"
            >
              {copiedKey === 'title' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              Başlığı Kopyala
            </button>
          </div>
          <input
            type="text"
            value={generatedTitle}
            maxLength={140}
            onChange={(e) => setGeneratedTitle(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl p-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Description Editor */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-sm">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <FileText className="w-4 h-4" />
              Etsy Ürün Açıklaması (Dönüşüm Odaklı Metin):
            </label>
            <button
              onClick={() => copyToClipboard(generatedDescription, 'desc')}
              className="text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1 rounded-lg flex items-center gap-1.5 transition-colors font-medium"
            >
              {copiedKey === 'desc' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              Açıklamayı Kopyala
            </button>
          </div>
          <textarea
            rows={8}
            value={generatedDescription}
            onChange={(e) => setGeneratedDescription(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl p-3 text-xs leading-relaxed outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
          />
        </div>

        {/* 13 Selected Tags Display (Moved right after Description) */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                🎯 Seçilmiş 13 Etsy Etiketi ({selectedTags.length}/13)
                <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold">≤20 Karakter Uyumlu</span>
              </h3>
              <p className="text-xs text-slate-500">Canlı matematiksel fırsat puanları en yüksek olan 13 etiket seçilmiştir.</p>
            </div>

            <button
              onClick={() => copyToClipboard(selectedTags.join(', '), 'tags')}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors shrink-0 shadow-sm"
            >
              {copiedKey === 'tags' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              Tümünü Virgülle Kopyala
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {selectedTags.map((tag, idx) => {
              const len = tag.length;
              const isOk = len <= 20;
              return (
                <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[150px]">
                    {idx + 1}. {tag}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${isOk ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'}`}>
                      {len}/20
                    </span>
                    <button 
                      onClick={() => setSelectedTags(prev => prev.filter((_, i) => i !== idx))}
                      className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                      title="Etiketi Kaldır"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Candidate Keywords & Co-Occurring Competitor Tags Panel */}
        {((enrichedKeywords && enrichedKeywords.length > 0) || (coOccurringTags && coOccurringTags.length > 0)) && (
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  Kelime Havuzu & Birlikte Kullanılan Popüler Rakip Etiketler (Co-occurring Tags)
                </h3>
                <p className="text-xs text-slate-500">
                  Aşağıdaki gerçek Etsy veritabanı puanları ve rakip etiketleri arasından listeye etiket ekleyebilirsiniz.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* 1. Candidate Keywords */}
              {enrichedKeywords && enrichedKeywords.length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5 text-emerald-500" />
                      Tasarım Anahtar Kelimeleri & Fırsat Puanları ({enrichedKeywords.length})
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                    {enrichedKeywords.map((kw: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate mr-2">
                          {kw.keyword}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {kw.total_listings > 0 && (
                            <span className="text-[10px] text-slate-400">
                              {kw.total_listings.toLocaleString('en-US')} İlan
                            </span>
                          )}
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${
                            kw.opportunity_score >= 85 ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-300' :
                            kw.opportunity_score >= 70 ? 'bg-teal-100 dark:bg-teal-950/80 text-teal-700 dark:text-teal-400' :
                            'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          }`}>
                            {kw.opportunity_score}/100
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. Co-Occurring Competitor Tags */}
              {coOccurringTags && coOccurringTags.length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      Birlikte Kullanılan Popüler Rakip Etiketler ({coOccurringTags.length})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-60 overflow-y-auto pr-1">
                    {coOccurringTags.map((item: any, i: number) => {
                      const tagStr = typeof item === 'string' ? item : (item?.keyword || '');
                      const tagScore = typeof item === 'object' ? item.opportunity_score : null;
                      const isAlreadySelected = selectedTags.includes(tagStr);
                      return (
                        <button
                          key={i}
                          onClick={() => {
                            if (isAlreadySelected) {
                              setSelectedTags((prev: string[]) => prev.filter((t: string) => t !== tagStr));
                            } else if (selectedTags.length < 13) {
                              setSelectedTags((prev: string[]) => [...prev, tagStr]);
                            }
                          }}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                            isAlreadySelected
                              ? 'bg-emerald-500 text-white border-emerald-600 shadow-xs'
                              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-emerald-400'
                          }`}
                          title={isAlreadySelected ? 'Etiketi Kaldır' : selectedTags.length >= 13 ? 'Maksimum 13 etiket seçilebilir' : '13 Etikete Ekle'}
                        >
                          <span>{tagStr}</span>
                          <span className="text-[9px] opacity-75 font-mono">({tagStr.length}/20)</span>
                          {tagScore && tagScore > 0 && (
                            <span className={`text-[9px] font-bold px-1 py-0.2 rounded font-mono ${
                              isAlreadySelected
                                ? 'bg-emerald-600 text-white'
                                : tagScore >= 85 ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}>
                              {tagScore}p
                            </span>
                          )}
                          {isAlreadySelected ? (
                            <Check className="w-3 h-3 text-white ml-0.5" />
                          ) : (
                            <Plus className="w-3 h-3 text-emerald-500 ml-0.5" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. ADIM: ETSY MAĞAZA & KATEGORİ PARAMETRELERİ */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-5 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-xs flex items-center justify-center font-bold">3</span>
              Etsy Mağaza & Kategori Parametreleri
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Etsy API v3 uyumlu kargo profili, kategori nitelikleri, iade ve mağaza bölümlerinizi yapılandırın.
            </p>
          </div>
        </div>

        {/* AI Detected Attributes Box (Only if taxonomy or analysis is present) */}
        {taxonomyId && (
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-500" />
              AI Tarafından Tespit Edilen Kategori & Üretim Nitelikleri
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-600 dark:text-slate-400">
              <div><span className="font-semibold text-slate-800 dark:text-slate-200 block text-[11px]">Kategori ID:</span> {taxonomyId}</div>
              <div><span className="font-semibold text-slate-800 dark:text-slate-200 block text-[11px]">Kim Yaptı:</span> {whoMade === 'someone_else' ? 'Üretim Ortağı' : whoMade}</div>
              <div><span className="font-semibold text-slate-800 dark:text-slate-200 block text-[11px]">Üretim Zamanı:</span> {whenMade}</div>
              <div><span className="font-semibold text-slate-800 dark:text-slate-200 block text-[11px]">Materyal:</span> {materials?.length > 0 ? materials.join(', ') : 'Pamuk'}</div>
            </div>
          </div>
        )}

        {/* Core Dropdowns Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Shipping Profile */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Kargo Profili (Zorunlu)
            </label>
            <select 
              value={selectedShippingProfileId}
              onChange={(e) => setSelectedShippingProfileId(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {shippingProfiles.map(p => (
                <option key={p.shipping_profile_id} value={p.shipping_profile_id}>
                  {p.title} (ID: {p.shipping_profile_id})
                </option>
              ))}
              {shippingProfiles.length === 0 && <option value="">Kargo profili yükleniyor...</option>}
            </select>
          </div>

          {/* Readiness State */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Üretim/Hazırlık Süresi (Zorunlu)
            </label>
            <select 
              value={selectedReadinessStateId}
              onChange={(e) => setSelectedReadinessStateId(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {readinessStates.map(r => (
                <option key={r.readiness_state_id} value={r.readiness_state_id}>
                  {r.processing_days_display_label} ({r.readiness_state})
                </option>
              ))}
              {readinessStates.length === 0 && <option value="">Profil bulunamadı...</option>}
            </select>
          </div>

          {/* Shop Section */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-500" />
              Mağaza Bölümü (Shop Section)
            </label>
            <select 
              value={selectedShopSectionId}
              onChange={(e) => setSelectedShopSectionId(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Seçim Yapılmadı (Boş)</option>
              {shopSections.map((s: any) => (
                <option key={s.shop_section_id} value={s.shop_section_id}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>

          {/* Return Policy */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              İade Politikası (İsteğe Bağlı)
            </label>
            <select 
              value={selectedReturnPolicyId}
              onChange={(e) => setSelectedReturnPolicyId(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Seçim Yapılmadı (Boş)</option>
              {returnPolicies.map((r: any) => (
                <option key={r.return_policy_id} value={r.return_policy_id}>
                  {r.title || `Policy ID: ${r.return_policy_id}`}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Variation Template Loader with Default Setting */}
          <div className="md:col-span-2 space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-emerald-500" />
              Kayıtlı Varyasyon Şablonu Yükle
            </label>
            <div className="flex gap-2">
              <select 
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedTemplateForDefault(val);
                  const t = savedTemplates?.find((st: any) => st.id === val);
                  if (t) setVariations(t.variations || []);
                }}
                className="flex-1 px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">-- Kayıtlı Şablon Seçin --</option>
                {savedTemplates?.map((t: any) => {
                  const isDefault = taxonomyId && defaultTemplates[taxonomyId] === t.id;
                  return (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.variations?.length || 0} Varyasyon) {isDefault ? ' ⭐ (VARSAYILAN)' : ''}
                    </option>
                  );
                })}
              </select>

              {taxonomyId && selectedTemplateForDefault && (
                <button
                  type="button"
                  onClick={() => handleSetDefaultTemplate(selectedTemplateForDefault)}
                  className="px-3.5 py-2 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/80 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-xl transition-all shrink-0 flex items-center gap-1.5 border border-emerald-300 dark:border-emerald-800"
                >
                  ⭐ Bu Kategoriye Varsayılan Yap
                </button>
              )}
            </div>
          </div>

          {/* Dynamic Taxonomy Properties (Only render if available) */}
          {availableTaxonomyProperties && availableTaxonomyProperties.length > 0 && availableTaxonomyProperties.map((prop: any) => (
            <div key={prop.property_id}>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-500" />
                {prop.name}
              </label>
              {prop.is_multivalued ? (
                <MultiSelectDropdown 
                  propItem={prop} 
                  selectedValues={selectedTaxonomyProperties[prop.property_id] || []}
                  onChange={(vals) => {
                    setSelectedTaxonomyProperties((prev: any) => ({
                      ...prev,
                      [prop.property_id]: vals
                    }));
                  }}
                />
              ) : (
                <select 
                  value={selectedTaxonomyProperties[prop.property_id]?.[0]?.toString() || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedTaxonomyProperties((prev: any) => ({
                      ...prev,
                      [prop.property_id]: val ? [parseInt(val, 10)] : []
                    }));
                  }}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Seçim Yapılmadı (Boş)</option>
                  {prop.possible_values?.map((v: any) => (
                    <option key={v.value_id} value={v.value_id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}

          {/* Auto-renew switch */}
          <div className="md:col-span-2">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
              <input 
                type="checkbox" 
                checked={shouldAutoRenew}
                onChange={(e) => setShouldAutoRenew(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              Otomatik Yenileme (Automatic Renewal) - Kapatmanız önerilir
            </label>
          </div>
        </div>

        {/* ADVANCED SETTINGS ACCORDION (Cleaned without duplicate default template selector) */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center justify-between w-full text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 py-1"
          >
            <span className="flex items-center gap-2"><Settings className="w-4 h-4" /> Gelişmiş Etsy Ayarları (Who Made, When Made, SKU, vb.)</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </button>
          
          {showAdvanced && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 bg-slate-50/70 dark:bg-slate-950/70 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              {/* WHO MADE */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Who Made?</label>
                <select value={whoMade} onChange={(e) => setWhoMade(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs">
                  <option value="i_did">I did (Ben yaptım)</option>
                  <option value="someone_else">Someone else (Başkası/Üretim Ortağı)</option>
                  <option value="collective">A collective (Kolektif)</option>
                </select>
              </div>

              {/* WHEN MADE */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">When Made?</label>
                <select value={whenMade} onChange={(e) => setWhenMade(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs">
                  <option value="made_to_order">Made to order (Siparişe göre)</option>
                  <option value="2020_2026">2020-2026</option>
                  <option value="2010_2019">2010-2019</option>
                </select>
              </div>

              {/* IS SUPPLY */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Is Supply? (Tedarik Malzemesi mi?)</label>
                <select value={isSupply ? "true" : "false"} onChange={(e) => setIsSupply(e.target.value === "true")} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs">
                  <option value="false">Hayır, Bitmiş Ürün</option>
                  <option value="true">Evet, Tedarik Malzemesi</option>
                </select>
              </div>

              {/* IS CUSTOMIZABLE */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Kişiselleştirilebilir mi?</label>
                <select value={isCustomizable ? "true" : "false"} onChange={(e) => setIsCustomizable(e.target.value === "true")} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs">
                  <option value="false">Hayır</option>
                  <option value="true">Evet</option>
                </select>
              </div>

              {/* PRODUCTION PARTNER */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Üretim Ortağı ID (Production Partner)</label>
                <input 
                  type="text" 
                  placeholder="Boş bırakılabilir"
                  value={productionPartnerId}
                  onChange={(e) => setProductionPartnerId(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>

              {/* SKU */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">İlan Ana SKU Kodu</label>
                <input 
                  type="text" 
                  placeholder="Örn: TSHIRT-001"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. ADIM: ETİKET SAĞLIK MATRİSİ & ÇEŞİTLİLİK DENETİMİ (MOVED) */}
      {/* ------------------------------------------------------------- */}
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-xs flex items-center justify-center font-bold">4</span>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Etiket Sağlık Matrisi & Çeşitlilik Denetimi
          </h3>
        </div>

        {/* Real-time Tag Health Matrix & Intent Distribution Score */}
        <TagMatrixScore
          tags={selectedTags}
          title={generatedTitle}
        />
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 5. ADIM: CANLI SERP ÖNİZLEME & ETSY'YE AKTARMA İSTASYONU */}
      {/* ------------------------------------------------------------- */}
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-xs flex items-center justify-center font-bold">5</span>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Canlı SERP Önizleme & Etsy'ye Aktarma İstasyonu
          </h3>
        </div>

        {/* Live Etsy SERP Search Preview Card (Mobile/Desktop) */}
        <EtsySerpPreview
          title={generatedTitle}
          imageUrl={dbGeneratedMockups.find(m => m.folderId === selectedFolderId && !m.isVideo)?.previewUrl || null}
          price={basePrice || 24.99}
        />

        {/* Publishing Actions Card */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
          {!etsyConnected ? (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="space-y-1">
                <p className="text-sm font-bold text-amber-800 dark:text-amber-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Etsy Mağazanız Henüz Bağlı Değil
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-500">
                  Otomatik ilan oluşturup yayınlayabilmek için Etsy mağaza yetkilendirmesi gereklidir.
                </p>
              </div>
              <a 
                href="/api/etsy/auth?returnUrl=/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition-colors shrink-0 shadow-sm"
              >
                Etsy Mağazamı Bağla
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    Etsy Mağaza Bağlantısı Aktif & Yayına Hazır
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Oluşturulan başlık, açıklama, 13 etiket, mockuplar ve varyasyonlar tek tıkla mağazanıza aktarılır.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  <button
                    onClick={() => handlePublishToEtsy('draft')}
                    disabled={isPublishing || !selectedShippingProfileId}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    <Send className={`w-3.5 h-3.5 ${isPublishing ? 'animate-spin' : ''}`} />
                    🚀 Etsy'ye Taslak (Draft) Olarak Aktar
                  </button>

                  <button
                    onClick={() => handlePublishToEtsy('active')}
                    disabled={isPublishing || !selectedShippingProfileId}
                    className="px-5 py-2.5 bg-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    <Rocket className={`w-3.5 h-3.5 ${isPublishing ? 'animate-spin' : ''}`} />
                    🔥 Doğrudan Canlıya Al (Active)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Publish Result Output */}
          {publishResult && (
            <div className="mt-4 bg-slate-950 text-slate-100 p-4 rounded-xl font-mono text-xs overflow-x-auto space-y-2 border border-slate-800">
              <div className="text-emerald-400 font-bold flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" />
                ETSY API YAYINLAMA RAPORU
              </div>
              <pre>{JSON.stringify(publishResult, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};