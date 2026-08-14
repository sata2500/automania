// @ts-nocheck
'use client';
import React from 'react';
import { Tag, Copy, Sparkles, Check, FileText, ShoppingBag, Layers, DollarSign, Send, RefreshCw, AlertTriangle, CheckCircle, Image as ImageIcon, ChevronRight, MousePointerClick, Filter, X, Folder, Edit2, Trash2, GripVertical, Download, TrendingUp, Hash, Plus } from 'lucide-react';
import { useEtsySeo } from '../context/EtsySeoContext';
import { EtsySerpPreview } from '../components/EtsySerpPreview';
import { TagMatrixScore } from '../components/TagMatrixScore';

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
    handleDeleteMockup, niche, setNiche, productType, setProductType,
    userNotes, setUserNotes, isSavingSettings, handleSaveEtsySettings,
    generatedTitle, setGeneratedTitle, copyToClipboard, copiedKey,
    generatedDescription, setGeneratedDescription, selectedTags, setSelectedTags,
    enrichedKeywords, coOccurringTags
  } = useEtsySeo();

  if (activeTab !== 'studio') return null;

  return (
    <>
{/* TAB 1: AI LISTING STUDIO */}
      <div className="space-y-6">
          {/* Design Selector Gallery Component */}
          {foldersWithMockups.length === 0 ? (
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-500/30 p-4 rounded-2xl flex items-center space-x-3">
              <Sparkles className="w-5 h-5 text-amber-500 shrink-0" />
              <div className="text-xs text-amber-800 dark:text-amber-200">
                <span className="font-bold block">Henüz Toplu Üretim Yapmadınız</span>
                Mockup sekmesinde tasarımlarınızı hazırlayıp toplu üretime gönderdiğinizde, üretilen klasörler burada görüntülenecektir.
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Folder className="w-4 h-4 text-emerald-500" />
                  Toplu Üretim Klasörleriniz ({foldersWithMockups.length} Adet):
                </label>
                {selectedFolderId && (
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
                    Seçili Klasör: {foldersWithMockups.find(f => f.id === selectedFolderId)?.name}
                  </span>
                )}
              </div>

              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                {foldersWithMockups.map((folder) => {
                  const isSelected = selectedFolderId === folder.id;
                  // Get a thumbnail from this folder's mockups
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
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                      Etsy'ye Gönderilecek Görseller ({dbGeneratedMockups.filter(m => m.folderId === selectedFolderId).length} Adet):
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
                        className={`group relative shrink-0 w-16 h-16 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-950 cursor-grab active:cursor-grabbing ${isDragged ? 'opacity-50 border-emerald-500' : ''}`}
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

          {/* Core SEO Inputs Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-sm">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                🎯 Odak Niş / Tasarım Teması:
              </label>
              <input
                type="text"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="Örn: Cottagecore Rabbit, Botanical Wildflower..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl p-3 text-xs focus:ring-2 focus:ring-emerald-500 outline-none font-semibold"
              />
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-sm">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                👕 Hedef Ürün / Kumaş / Kalıp Tipi:
              </label>
              <input
                type="text"
                value={productType}
                onChange={(e) => setProductType(e.target.value)}
                placeholder="Örn: Comfort Colors 1717 Garment Dyed Vintage Tee..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl p-3 text-xs focus:ring-2 focus:ring-emerald-500 outline-none font-semibold"
              />
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                💡 Kullanıcı Notları / Özel Ürün Talimatları (Yapay Zekanın Açıklamada Kullanacağı Bilgiler):
              </label>
              <button
                onClick={handleSaveEtsySettings}
                disabled={isSavingSettings}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm transition-colors flex items-center gap-1.5 shrink-0"
              >
                {isSavingSettings ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                💾 Ayarlarımı Veritabanına Kaydet
              </button>
            </div>
            <textarea
              rows={2}
              value={userNotes}
              onChange={(e) => setUserNotes(e.target.value)}
              placeholder="Örn: Beden tablosuna göre 1 beden büyük tercih ediniz. %100 taranmış pamuk, 1 iş gününde kargo."
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl p-3 text-xs focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
            />
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

          {/* Live Etsy SERP Search Preview Card (Mobile/Desktop) */}
          <EtsySerpPreview
            title={generatedTitle}
            imageUrl={dbGeneratedMockups.find(m => m.folderId === selectedFolderId && !m.isVideo)?.previewUrl || null}
            price={24.99}
          />

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

          {/* Real-time Tag Health Matrix & Intent Distribution Score */}
          <TagMatrixScore
            tags={selectedTags}
            title={generatedTitle}
          />

          {/* 13 Selected Tags Display */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  🎯 Seçilmiş 13 Etsy Etiketi ({selectedTags.length}/13)
                  <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">≤20 Char Uyumlu</span>
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
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${isOk ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {len}/20
                      </span>
                      <button 
                        onClick={() => setSelectedTags(prev => prev.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-rose-500 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Candidate Keywords & Co-Occurring Competitor Tags Intelligence Panel */}
          {((enrichedKeywords && enrichedKeywords.length > 0) || (coOccurringTags && coOccurringTags.length > 0)) && (
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
              <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    Kelime Havuzu & Birlikte Kullanılan Popüler Rakip Etiketler (Co-occurring Tags)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Yapay Zeka SEO modeli, aşağıdaki gerçek Etsy veritabanı puanları ve rakip etiketleri arasından en yüksek dönüşüm sağlayacak 13 etiketi seçmiştir.
                  </p>
                </div>
              </div>

              {/* Grid 2 Columns: Candidate Keywords vs Co-Occurring Tags */}
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
    </>
  );
};