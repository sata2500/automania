// @ts-nocheck
'use client';
import React from 'react';
import { Tag, Copy, Sparkles, Check, FileText, ShoppingBag, Layers, DollarSign, Send, RefreshCw, AlertTriangle, CheckCircle, Image as ImageIcon, ChevronRight, MousePointerClick, Filter, X, Folder, Edit2, Trash2, GripVertical } from 'lucide-react';
import { useEtsySeo } from '../context/EtsySeoContext';

export const VariationMatrix = () => {
  const {
    activeTab,
    openLoadTemplateModal, setIsSaveTemplateModalOpen, isSavingTemplate,
    handleFetchListings, isFetchingListings, isFetchingInventory,
    handleOpenBulkSync, genProduct, setGenProduct, genSizes, defaultSizes,
    setGenSizes, savedCustomSizes, handleDeleteCustomSize, newGenSizeInput,
    setNewGenSizeInput, handleAddCustomSize, genColors, defaultColors,
    setGenColors, savedCustomColors, handleDeleteCustomColor, newGenColorInput,
    setNewGenColorInput, handleAddCustomColor, genPrice, setGenPrice,
    genQuantity, setGenQuantity, handleGenerateToTable, variations,
    filteredVariations, statusFilter, setStatusFilter, colorFilter, setColorFilter,
    uniqueTableColors, sizeFilter, setSizeFilter, uniqueTableSizes,
    dragState, handleDragEnter, handleDragStart, setVariations,
    showListingsModal, setShowListingsModal, etsyListings, handleSelectListingTemplate,
    isSaveTemplateModalOpen, templateSaveName, setTemplateSaveName, handleSaveCurrentTemplate,
    isLoadTemplateModalOpen, setIsLoadTemplateModalOpen, savedTemplates, handleDeleteTemplate, handleLoadTemplate,
    isBulkSyncModalOpen, setIsBulkSyncModalOpen, selectedTemplateForSync, setSelectedTemplateForSync,
    selectedListingsForSync, setSelectedListingsForSync, isSyncing, handleBulkSync
  } = useEtsySeo();

  if (activeTab !== 'variations') return null;

  return (
    <>
{/* TAB 2: VIRTUAL VELA-STYLE VARIATION MATRIX EDITOR */}
      <div className="space-y-6">
          {/* Controls Bar */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-500" />
                Beden & Renk Varyasyon Ayarları
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={openLoadTemplateModal}
                  className="text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Kayıtlı Şablonu Yükle
                </button>
                <button
                  onClick={() => setIsSaveTemplateModalOpen(true)}
                  disabled={isSavingTemplate}
                  className="text-xs bg-indigo-500 hover:bg-indigo-600 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Mevcut Tabloyu Şablon Kaydet
                </button>
                <button
                  onClick={handleFetchListings}
                  disabled={isFetchingListings || isFetchingInventory}
                  className="text-xs bg-orange-500 hover:bg-orange-600 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
                >
                  {isFetchingListings || isFetchingInventory ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShoppingBag className="w-3.5 h-3.5" />}
                  Etsy'den Şablon İlan Çek
                </button>
                <button
                  onClick={handleOpenBulkSync}
                  className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  Etsy İlanlarına Uygula
                </button>
              </div>
            </div>

            {/* New Variation Generator UI */}
            <div className="bg-slate-50 dark:bg-slate-950/40 p-5 rounded-xl border border-indigo-100 dark:border-indigo-900/30 space-y-4">
              <div className="flex items-center gap-2 mb-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Kombinasyon Ekleme ve Düzenleme Menüsü</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* 1. Ürün Adı */}
                <div className="md:col-span-12">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">1. Ürün / Marka Adı</label>
                  <input
                    type="text"
                    value={genProduct}
                    onChange={e => setGenProduct(e.target.value)}
                    placeholder="Örn: Bella Canvas 3001, Comfort Colors 1717"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-bold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* 2. Bedenler */}
                <div className="md:col-span-6">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">2. Bedenleri Seçin</label>
                  <div className="flex flex-wrap gap-1.5 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 min-h-[90px] content-start">
                    {defaultSizes.map(size => (
                      <button
                        key={size}
                        onClick={() => setGenSizes(prev => prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size])}
                        className={`px-2.5 py-1 rounded text-xs font-bold transition-all border ${genSizes.includes(size) ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                      >
                        {size}
                      </button>
                    ))}
                    {savedCustomSizes.map(size => (
                      <div key={size} className="relative group flex">
                        <button
                          onClick={() => setGenSizes(prev => prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size])}
                          className={`px-2.5 py-1 pr-6 rounded text-xs font-bold transition-all border ${genSizes.includes(size) ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900'}`}
                        >
                          {size}
                        </button>
                        <button 
                          onClick={() => handleDeleteCustomSize(size)} 
                          className="absolute right-1 top-1/2 -translate-y-1/2 text-indigo-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Kalıcı Sil"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center ml-auto">
                      <input
                        type="text"
                        placeholder="+ Özel"
                        value={newGenSizeInput}
                        onChange={e => setNewGenSizeInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleAddCustomSize();
                        }}
                        className="px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-l text-xs font-semibold w-20 outline-none focus:border-indigo-500"
                      />
                      <button
                        onClick={handleAddCustomSize}
                        title="Kalıcı Kaydet ve Seç"
                        className="px-2 py-1 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400 border border-l-0 border-indigo-200 dark:border-indigo-800 rounded-r text-xs font-bold hover:bg-indigo-200 dark:hover:bg-indigo-900 transition-colors"
                      >
                        Ekle
                      </button>
                    </div>
                  </div>
                </div>

                {/* 3. Renkler */}
                <div className="md:col-span-6">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">3. Renkleri Seçin</label>
                  <div className="flex flex-wrap gap-1.5 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 min-h-[90px] content-start">
                    {defaultColors.map(color => (
                      <button
                        key={color}
                        onClick={() => setGenColors(prev => prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color])}
                        className={`px-2.5 py-1 rounded text-xs font-bold transition-all border ${genColors.includes(color) ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                      >
                        {color}
                      </button>
                    ))}
                    {savedCustomColors.map(color => (
                      <div key={color} className="relative group flex">
                        <button
                          onClick={() => setGenColors(prev => prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color])}
                          className={`px-2.5 py-1 pr-6 rounded text-xs font-bold transition-all border ${genColors.includes(color) ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900'}`}
                        >
                          {color}
                        </button>
                        <button 
                          onClick={() => handleDeleteCustomColor(color)} 
                          className="absolute right-1 top-1/2 -translate-y-1/2 text-emerald-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Kalıcı Sil"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center ml-auto">
                      <input
                        type="text"
                        placeholder="+ Özel"
                        value={newGenColorInput}
                        onChange={e => setNewGenColorInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleAddCustomColor();
                        }}
                        className="px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-l text-xs font-semibold w-24 outline-none focus:border-emerald-500"
                      />
                      <button
                        onClick={handleAddCustomColor}
                        title="Kalıcı Kaydet ve Seç"
                        className="px-2 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400 border border-l-0 border-emerald-200 dark:border-emerald-800 rounded-r text-xs font-bold hover:bg-emerald-200 dark:hover:bg-emerald-900 transition-colors"
                      >
                        Ekle
                      </button>
                    </div>
                  </div>
                </div>

                {/* 4 & 5. Fiyat, Stok ve Buton */}
                <div className="md:col-span-12 flex flex-wrap items-end gap-3 mt-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Fiyat ($)</label>
                    <input
                      type="number" step="0.01"
                      value={genPrice} onChange={e => setGenPrice(e.target.value)}
                      className="w-24 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-bold outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Stok</label>
                    <input
                      type="number"
                      value={genQuantity} onChange={e => setGenQuantity(e.target.value)}
                      className="w-24 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-bold outline-none focus:border-indigo-500"
                    />
                  </div>
                  
                  <button
                    onClick={handleGenerateToTable}
                    className="ml-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-lg flex items-center gap-2 transition-colors shadow-md"
                  >
                    <Send className="w-4 h-4" />
                    Kombinasyonları Tabloya Ekle
                  </button>
                </div>
              </div>
            </div>

            </div>

          {/* Interactive Matrix Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm relative">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex justify-between items-center flex-wrap gap-2">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full ${variations.length > 380 ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400'}`}>
                  Görünen: {filteredVariations.length} | Toplam: {variations.length} / 400 Maks
                </span>
                Varyasyon Tablosu
              </h4>
              <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-500">
                <span className="flex items-center gap-1"><MousePointerClick className="w-3 h-3 text-indigo-500" /> Hücrenin sağ alt köşesinden tutup sürükle (Drag-to-fill)</span>
              </div>
            </div>

            <div className="overflow-x-auto w-full select-none" style={{ maxHeight: '600px' }}>
              <table className="w-full text-left text-xs sticky-header-table">
                <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="p-2 border-r border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900">
                      <select 
                        value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
                        className="w-full bg-transparent border-none outline-none font-bold text-[11px] uppercase tracking-wider cursor-pointer"
                      >
                        <option value="all">Durum</option>
                        <option value="active">Aktifler</option>
                        <option value="inactive">Pasifler</option>
                      </select>
                    </th>
                    <th className="p-2 border-r border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900">
                      <select 
                        value={colorFilter} onChange={e => setColorFilter(e.target.value)}
                        className="w-full bg-transparent border-none outline-none font-bold text-[11px] uppercase tracking-wider cursor-pointer"
                      >
                        <option value="all">Renk</option>
                        {uniqueTableColors.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </th>
                    <th className="p-2 border-r border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900">
                      <select 
                        value={sizeFilter} onChange={e => setSizeFilter(e.target.value)}
                        className="w-full bg-transparent border-none outline-none font-bold text-[11px] uppercase tracking-wider cursor-pointer"
                      >
                        <option value="all">Beden</option>
                        {uniqueTableSizes.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </th>
                    <th className="p-3 text-center border-r border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-[11px] uppercase tracking-wider">Fiyat ($)</th>
                    <th className="p-3 text-center bg-slate-100 dark:bg-slate-900 text-[11px] uppercase tracking-wider">Stok</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono bg-white dark:bg-slate-900">
                  {filteredVariations.map((row, idx) => {
                    // Sürükleme efekti kontrolü
                    let isPriceHighlighted = false;
                    let isQtyHighlighted = false;
                    let isStatusHighlighted = false;
                    
                    if (dragState.isDragging && dragState.startRowId && dragState.endRowId) {
                      const startIdx = filteredVariations.findIndex(v => v.id === dragState.startRowId);
                      const endIdx = filteredVariations.findIndex(v => v.id === dragState.endRowId);
                      const currentIdx = idx;
                      if (startIdx !== -1 && endIdx !== -1) {
                        const min = Math.min(startIdx, endIdx);
                        const max = Math.max(startIdx, endIdx);
                        if (currentIdx >= min && currentIdx <= max) {
                          if (dragState.field === 'price') isPriceHighlighted = true;
                          if (dragState.field === 'quantity') isQtyHighlighted = true;
                          if (dragState.field === 'enabled') isStatusHighlighted = true;
                        }
                      }
                    }

                    return (
                      <tr key={row.id} className="hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-colors group">
                        <td 
                          className={`p-2 text-center border-r border-slate-100 dark:border-slate-800 transition-colors ${isStatusHighlighted ? 'bg-indigo-100 dark:bg-indigo-900/50 ring-1 ring-inset ring-indigo-500' : ''}`}
                          onMouseEnter={() => handleDragEnter(row.id)}
                        >
                          <div className="relative flex justify-center w-full h-full group/cell">
                            <input
                              type="checkbox"
                              checked={row.enabled}
                              onChange={(e) => {
                                const val = e.target.checked;
                                setVariations(prev => prev.map(v => v.id === row.id ? { ...v, enabled: val } : v));
                              }}
                              className="rounded text-indigo-600 w-4 h-4 cursor-pointer"
                            />
                            {/* Drag handle */}
                            <div 
                              className="absolute -bottom-2 -right-2 w-3 h-3 bg-indigo-500 cursor-crosshair rounded-sm opacity-0 group-hover/cell:opacity-100 hover:scale-125 transition-all z-10 border border-white dark:border-slate-800"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleDragStart(row.id, 'enabled', row.enabled);
                              }}
                            />
                          </div>
                        </td>
                        <td className="p-2 font-semibold text-slate-800 dark:text-slate-200 font-sans border-r border-slate-100 dark:border-slate-800">{row.color}</td>
                        <td className="p-2 font-bold text-indigo-600 dark:text-indigo-400 border-r border-slate-100 dark:border-slate-800">{row.size}</td>
                        
                        <td 
                          className={`p-0 border-r border-slate-100 dark:border-slate-800 transition-colors relative ${isPriceHighlighted ? 'bg-indigo-100 dark:bg-indigo-900/50 ring-1 ring-inset ring-indigo-500' : ''}`}
                          onMouseEnter={() => handleDragEnter(row.id)}
                        >
                          <div className="w-full h-full flex items-center justify-center group/cell p-1">
                            <input
                              type="number"
                              step="0.01"
                              value={row.price}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setVariations(prev => prev.map(v => v.id === row.id ? { ...v, price: val } : v));
                              }}
                              className="w-20 px-2 py-1.5 bg-transparent border-none text-center font-bold text-emerald-600 dark:text-emerald-400 outline-none hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 rounded transition-colors"
                            />
                            {/* Drag handle */}
                            <div 
                              className="absolute bottom-0 right-0 w-3 h-3 bg-indigo-500 cursor-crosshair rounded-sm opacity-0 group-hover/cell:opacity-100 hover:scale-125 transition-all z-10 border border-white dark:border-slate-800"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleDragStart(row.id, 'price', row.price);
                              }}
                            />
                          </div>
                        </td>
                        
                        <td 
                          className={`p-0 border-r border-slate-100 dark:border-slate-800 transition-colors relative ${isQtyHighlighted ? 'bg-indigo-100 dark:bg-indigo-900/50 ring-1 ring-inset ring-indigo-500' : ''}`}
                          onMouseEnter={() => handleDragEnter(row.id)}
                        >
                          <div className="w-full h-full flex items-center justify-center group/cell p-1">
                            <input
                              type="number"
                              value={row.quantity}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10) || 0;
                                setVariations(prev => prev.map(v => v.id === row.id ? { ...v, quantity: val } : v));
                              }}
                              className="w-16 px-2 py-1.5 bg-transparent border-none text-center font-semibold text-slate-700 dark:text-slate-300 outline-none hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 rounded transition-colors"
                            />
                            {/* Drag handle */}
                            <div 
                              className="absolute bottom-0 right-0 w-3 h-3 bg-indigo-500 cursor-crosshair rounded-sm opacity-0 group-hover/cell:opacity-100 hover:scale-125 transition-all z-10 border border-white dark:border-slate-800"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleDragStart(row.id, 'quantity', row.quantity);
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredVariations.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500 font-sans">
                        Seçili filtrelere uygun varyasyon bulunamadı. Lütfen filtreleri temizleyin.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
{/* Etsy Listings Modal */}
      {showListingsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-emerald-500" />
                Etsy Mağazanızdaki İlanlar (Şablon Seçimi)
              </h3>
              <button 
                onClick={() => setShowListingsModal(false)}
                className="text-slate-500 hover:text-slate-800 dark:hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1 bg-slate-50/50 dark:bg-slate-900/50">
              {etsyListings.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-sm">
                  Mağazanızda henüz aktif veya taslak ilan bulunmuyor.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {etsyListings.map(listing => (
                    <div key={listing.listing_id} className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col justify-between transition-shadow hover:shadow-md">
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-2 mb-2">
                          {listing.title}
                        </div>
                        <div className="flex gap-2 text-[10px] mb-3">
                          <span className={`px-2 py-0.5 rounded-full font-bold ${listing.state === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                            {listing.state.toUpperCase()}
                          </span>
                          <span className="text-slate-500">ID: {listing.listing_id}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleSelectListingTemplate(listing.listing_id)}
                        disabled={isFetchingInventory}
                        className="w-full py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        {isFetchingInventory ? 'Varyasyonlar Çekiliyor...' : 'Bu İlanın Varyasyonlarını Şablon Yap'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Save Template Modal */}
      {isSaveTemplateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/50 rounded-t-2xl">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-indigo-500" />
                Yeni Şablon Olarak Kaydet
              </h3>
              <button onClick={() => setIsSaveTemplateModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Şablon Adı</label>
                <input
                  type="text"
                  value={templateSaveName}
                  onChange={e => setTemplateSaveName(e.target.value)}
                  placeholder="Örn: Kışlık Tişört Fiyatları"
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-bold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  autoFocus
                />
              </div>
              <p className="text-xs text-slate-500">Mevcut tabloda bulunan {variations.length} varyasyon bu isimle kaydedilecektir.</p>
              <button
                onClick={handleSaveCurrentTemplate}
                disabled={isSavingTemplate}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {isSavingTemplate ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Template Modal */}
      {isLoadTemplateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/50 rounded-t-2xl">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-indigo-500" />
                Kayıtlı Şablonlarınız
              </h3>
              <button onClick={() => setIsLoadTemplateModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              {savedTemplates.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm font-semibold">
                  Henüz kaydedilmiş bir şablonunuz bulunmuyor.
                </div>
              ) : (
                <div className="space-y-3">
                  {savedTemplates.map(t => (
                    <div key={t.id} className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex justify-between items-center bg-slate-50 dark:bg-slate-950/30">
                      <div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">{t.name}</h4>
                        <p className="text-xs text-slate-500 mt-1">{t.variations?.length || 0} Varyasyon • {new Date(t.updatedAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDeleteTemplate(t.id)}
                          className="px-2 py-1.5 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold transition-colors"
                        >
                          Sil
                        </button>
                        <button
                          onClick={() => handleLoadTemplate(t)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                        >
                          Yükle
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Bulk Sync Modal */}
      {isBulkSyncModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/50 rounded-t-2xl">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Send className="w-5 h-5 text-emerald-500" />
                Etsy İlanlarına Uygula
              </h3>
              <button onClick={() => setIsBulkSyncModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              <div className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-400 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/50 text-xs font-medium flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <p>Aşağıdan seçtiğiniz ilanların mevcut varyasyonları <strong>tamamen silinecek</strong> ve seçtiğiniz şablondaki varyasyonlar ile değiştirilecektir. Bu işlem geri alınamaz.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Uygulanacak Şablon
                </label>
                <select
                  value={selectedTemplateForSync}
                  onChange={(e) => setSelectedTemplateForSync(e.target.value)}
                  className="w-full text-sm border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 focus:ring-emerald-500 focus:border-emerald-500 px-3 py-2 transition-colors"
                >
                  <option value="current">Mevcut Tablodaki Varyasyonlar ({variations.length} varyasyon)</option>
                  {savedTemplates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.variations?.length || 0} varyasyon)
                    </option>
                  ))}
                </select>
              </div>

              {isFetchingListings ? (
                <div className="text-center py-8 text-slate-500 text-sm font-semibold flex flex-col items-center">
                  <RefreshCw className="w-6 h-6 animate-spin text-emerald-500 mb-2" />
                  İlanlarınız Yükleniyor...
                </div>
              ) : etsyListings.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm font-semibold">
                  Etsy hesabınızda uygun ilan bulunamadı.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">İlan Seçimi ({selectedListingsForSync.length} Seçili)</span>
                    <button 
                      onClick={() => {
                        if (selectedListingsForSync.length === etsyListings.length) setSelectedListingsForSync([]);
                        else setSelectedListingsForSync(etsyListings.map(l => l.listing_id));
                      }}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
                    >
                      {selectedListingsForSync.length === etsyListings.length ? 'Tümünü Kaldır' : 'Tümünü Seç'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {etsyListings.map((listing) => (
                      <label key={listing.listing_id} className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${selectedListingsForSync.includes(listing.listing_id) ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50'}`}>
                        <input
                          type="checkbox"
                          checked={selectedListingsForSync.includes(listing.listing_id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedListingsForSync(prev => [...prev, listing.listing_id]);
                            else setSelectedListingsForSync(prev => prev.filter(id => id !== listing.listing_id));
                          }}
                          className="mt-1 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-600 focus:ring-2"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate" title={listing.title}>{listing.title}</p>
                          <div className="flex gap-2 text-[10px] mt-1 text-slate-500">
                            <span className="uppercase">{listing.state}</span>
                            <span>ID: {listing.listing_id}</span>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 rounded-b-2xl">
              <button
                onClick={handleBulkSync}
                disabled={isSyncing || selectedListingsForSync.length === 0}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm shadow-sm"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Güncelleniyor... Lütfen bekleyin
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    {selectedListingsForSync.length} İlanı Güncelle
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    
    </>
  );
};