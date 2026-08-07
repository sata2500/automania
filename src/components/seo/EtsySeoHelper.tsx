'use client';

import React, { useState, useEffect } from 'react';
import { Tag, Copy, Sparkles, Check, FileText, ShoppingBag, Layers, DollarSign, Send, RefreshCw, AlertTriangle, CheckCircle, Image as ImageIcon, ChevronRight } from 'lucide-react';
import { useToast } from '@/components/common/ToastContext';
import { loadAppData } from '@/lib/storage-service';
import { DesignItem } from '@/types/pod';

interface VariationRow {
  id: string;
  size: string;
  color: string;
  price: number;
  quantity: number;
  sku: string;
  enabled: boolean;
}

export const EtsySeoHelper: React.FC = () => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'studio' | 'variations' | 'publish'>('studio');

  // Loaded user designs
  const [userDesigns, setUserDesigns] = useState<DesignItem[]>([]);
  const [selectedDesign, setSelectedDesign] = useState<DesignItem | null>(null);

  // Input states for AI generation
  const [niche, setNiche] = useState('Vintage Retro Cat');
  const [productType, setProductType] = useState('Comfort Colors 1717 T-Shirt');
  const [designDescription, setDesignDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Load user designs on mount
  useEffect(() => {
    loadAppData().then((data) => {
      if (data.designs && data.designs.length > 0) {
        setUserDesigns(data.designs);
        // Pre-select first design if available
        const first = data.designs[0];
        setSelectedDesign(first);
        setNiche(first.name || 'Vintage Retro Design');
        if (first.analysis?.description) {
          setDesignDescription(first.analysis.description);
        }
      }
    }).catch(console.warn);
  }, []);

  // When selectedDesign changes, pre-populate details
  const handleSelectDesign = (design: DesignItem) => {
    setSelectedDesign(design);
    setNiche(design.name || 'Tasarım');
    if (design.analysis?.description) {
      setDesignDescription(design.analysis.description);
    }
    toast.info(`"${design.name}" tasarımı Etsy Studio'ya yüklendi!`);
  };

  // Generated AI Content states
  const [generatedTitle, setGeneratedTitle] = useState(
    'Vintage Retro Cat T-Shirt | Cute Cat Mom Shirt | Aesthetic Cat Lover Gift, Unisex Oversized Streetwear Graphic Tee'
  );
  const [generatedDescription, setGeneratedDescription] = useState(
    `✨ VINTAGE RETRO CAT SHIRT ✨\n\nThe perfect graphic tee for cat lovers, cat moms, and aesthetic vintage apparel fans! Printed on premium Comfort Colors 1717 super-soft cotton.\n\n🌿 PRODUCT DETAILS:\n- 100% Ring-Spun Cotton\n- Medium fabric (6.1 oz/yd²)\n- Relaxed unisex fit\n- Pre-shrunk fabric for durable wash\n\n🧼 CARE INSTRUCTIONS:\nMachine wash cold inside-out, tumble dry low or hang dry. Do not iron directly on print.\n\n🚚 SHIPPING & PROCESSING:\nProcessed and shipped from US within 2-4 business days.`
  );
  const [selectedTags, setSelectedTags] = useState<string[]>([
    'Vintage Cat Shirt', 'Cat Mom Gift', 'Retro Cat Tee', 'Cute Cat Lover',
    'Aesthetic Apparel', 'Comfort Colors 1717', 'Unisex Graphic Tee',
    'Cat Person Shirt', 'Trendy Cat Gift', 'Streetwear Shirt',
    'Summer T-Shirt', 'oversized cat tee', 'Gift For Her'
  ]);

  // Variation Matrix state
  const [sizes, setSizes] = useState<string[]>(['S', 'M', 'L', 'XL', '2XL', '3XL']);
  const [colors, setColors] = useState<string[]>(['Black', 'White', 'Navy', 'Pepper']);
  const [variations, setVariations] = useState<VariationRow[]>([]);
  const [basePrice, setBasePrice] = useState<number>(24.99);

  // Publishing state
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<any>(null);

  // Generate Variations Matrix whenever sizes or colors change
  useEffect(() => {
    const newVars: VariationRow[] = [];
    colors.forEach(color => {
      sizes.forEach(size => {
        const isPlusSize = size === '2XL' || size === '3XL';
        const price = isPlusSize ? basePrice + 3.00 : basePrice;
        newVars.push({
          id: `${color}-${size}`,
          color,
          size,
          price: Math.round(price * 100) / 100,
          quantity: 999,
          sku: `POD-${color.toUpperCase().slice(0, 3)}-${size}`,
          enabled: true
        });
      });
    });
    setVariations(newVars);
  }, [sizes, colors, basePrice]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Panoya kopyalandı!');
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleGenerateAI = async () => {
    setIsGenerating(true);
    try {
      // Mock keyword pool data for AI generator
      const mockKeywords = [
        { keyword: `${niche.slice(0,12)} shirt`, opportunity_score: 91, total_listings: 1200, is_etsy_suggested: true, autocomplete_rank: 1 },
        { keyword: 'cat mom gift', opportunity_score: 88, total_listings: 2400, is_etsy_suggested: true, autocomplete_rank: 2 },
        { keyword: 'retro cat tee', opportunity_score: 85, total_listings: 1800, is_etsy_suggested: true, autocomplete_rank: 3 },
        { keyword: 'vintage graphic tee', opportunity_score: 82, total_listings: 4500, is_etsy_suggested: true, autocomplete_rank: 4 },
        { keyword: 'aesthetic apparel', opportunity_score: 79, total_listings: 3200, is_etsy_suggested: false, autocomplete_rank: 0 },
        { keyword: 'comfort colors 1717', opportunity_score: 95, total_listings: 950, is_etsy_suggested: true, autocomplete_rank: 1 },
        { keyword: 'unisex graphic tee', opportunity_score: 76, total_listings: 6200, is_etsy_suggested: false, autocomplete_rank: 0 },
        { keyword: 'trendy cat shirt', opportunity_score: 84, total_listings: 2100, is_etsy_suggested: true, autocomplete_rank: 5 },
        { keyword: 'streetwear shirt', opportunity_score: 73, total_listings: 8900, is_etsy_suggested: false, autocomplete_rank: 0 },
        { keyword: 'gift for her', opportunity_score: 70, total_listings: 15000, is_etsy_suggested: false, autocomplete_rank: 0 },
        { keyword: 'oversized cat tee', opportunity_score: 89, total_listings: 1400, is_etsy_suggested: true, autocomplete_rank: 2 },
        { keyword: 'summer t-shirt', opportunity_score: 68, total_listings: 18000, is_etsy_suggested: false, autocomplete_rank: 0 },
        { keyword: 'cute cat lover', opportunity_score: 87, total_listings: 1900, is_etsy_suggested: true, autocomplete_rank: 3 }
      ];

      const res = await fetch('/api/designs/generate-listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          designDescription: `${niche} theme for ${productType}`,
          keywords: mockKeywords
        })
      });

      const data = await res.json();
      if (data.success && data.listing) {
        setGeneratedTitle(data.listing.title);
        setGeneratedDescription(data.listing.description);
        if (data.listing.selectedTags && Array.isArray(data.listing.selectedTags)) {
          setSelectedTags(data.listing.selectedTags);
        }
        if (data.listing.suggestedBasePrice) {
          setBasePrice(data.listing.suggestedBasePrice);
        }
        toast.success(`Yapay zeka (${data.modelUsed || 'SEO Modeli'}) ile başlık, açıklama ve 13 etiket başarıyla üretildi!`);
      } else {
        toast.error(data.error || 'İçerik üretilirken hata oluştu.');
      }
    } catch (e: any) {
      toast.error('Bağlantı hatası: ' + e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // Batch Price Rules for Variations
  const applyPriceRule = (rule: 'standard' | 'plus3' | 'custom', customVal?: number) => {
    setVariations(prev => prev.map(v => {
      const isPlus = v.size === '2XL' || v.size === '3XL';
      let p = basePrice;
      if (rule === 'plus3' && isPlus) p = basePrice + 3.00;
      if (rule === 'custom' && customVal) p = customVal;
      return { ...v, price: Math.round(p * 100) / 100 };
    }));
    toast.success('Fiyat kuralı varyasyon tablosuna uygulandı!');
  };

  const handlePublishToEtsy = async (state: 'draft' | 'active') => {
    setIsPublishing(true);
    setPublishResult(null);
    try {
      const res = await fetch('/api/etsy/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: generatedTitle,
          description: generatedDescription,
          tags: selectedTags,
          price: basePrice,
          quantity: 999,
          variations: variations.filter(v => v.enabled),
          state
        })
      });
      const data = await res.json();
      setPublishResult(data);
      if (data.success) {
        toast.success(data.message || 'İlan Etsy mağazanıza aktarıldı!');
      } else {
        toast.error(data.error || 'İlan aktarılırken hata oluştu.');
      }
    } catch (e: any) {
      toast.error('Bağlantı hatası: ' + e.message);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Studio Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Etsy Listing Studio & Varyasyon Editörü
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full uppercase font-mono">v3 Canlı</span>
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                Yapay Zeka SEO Metin Yazarı ile başlık, açıklama ve 13 altın etiket üretin; Vela tarzı matris tablosunda varyasyon fiyatlarını tek tıkla Etsy'ye aktarın.
              </p>
            </div>
          </div>

          <button
            onClick={handleGenerateAI}
            disabled={isGenerating}
            className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-lg hover:shadow-emerald-500/20 transition-all flex items-center gap-2 disabled:opacity-50 shrink-0"
          >
            <Sparkles className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
            {isGenerating ? 'SEO Modeli Üretiyor...' : '🪄 AI SEO İle Yeniden Üret'}
          </button>
        </div>

        {/* Tab Navigation Header */}
        <div className="flex bg-slate-950/80 p-1.5 rounded-xl border border-slate-800 text-xs font-semibold mt-6 gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('studio')}
            className={`flex-1 py-2.5 px-4 rounded-lg transition-all flex items-center justify-center gap-2 shrink-0 ${activeTab === 'studio' ? 'bg-emerald-500 text-white font-bold shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            <FileText className="w-4 h-4" />
            1. AI Listing Studio (Başlık, Metin & 13 Etiket)
          </button>

          <button
            onClick={() => setActiveTab('variations')}
            className={`flex-1 py-2.5 px-4 rounded-lg transition-all flex items-center justify-center gap-2 shrink-0 ${activeTab === 'variations' ? 'bg-emerald-500 text-white font-bold shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            <Layers className="w-4 h-4" />
            2. Varyasyon & Fiyat Matris Tablosu ({variations.length} Kombinasyon)
          </button>

          <button
            onClick={() => setActiveTab('publish')}
            className={`flex-1 py-2.5 px-4 rounded-lg transition-all flex items-center justify-center gap-2 shrink-0 ${activeTab === 'publish' ? 'bg-emerald-500 text-white font-bold shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            <Send className="w-4 h-4" />
            3. Etsy API v3 Mağaza Yayınlama
          </button>
        </div>
      </div>

      {/* TAB 1: AI LISTING STUDIO */}
      {activeTab === 'studio' && (
        <div className="space-y-6">
          {/* Design Selector Gallery Component */}
          {userDesigns.length > 0 && (
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-emerald-500" />
                  Kayıtlı Tasarımlarınızdan Seçin ({userDesigns.length} Tasarım):
                </label>
                {selectedDesign && (
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
                    Seçili: {selectedDesign.name}
                  </span>
                )}
              </div>

              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                {userDesigns.map((design) => {
                  const isSelected = selectedDesign?.id === design.id;
                  return (
                    <div
                      key={design.id}
                      onClick={() => handleSelectDesign(design)}
                      className={`relative shrink-0 w-24 h-24 rounded-xl border-2 cursor-pointer overflow-hidden transition-all group ${isSelected ? 'border-emerald-500 shadow-md ring-2 ring-emerald-500/30' : 'border-slate-200 dark:border-slate-800 hover:border-slate-400'}`}
                    >
                      <img 
                        src={design.src} 
                        alt={design.name} 
                        className="w-full h-full object-contain p-1 bg-slate-50 dark:bg-slate-950" 
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-black/75 backdrop-blur-xs text-[10px] text-white p-1 truncate font-semibold">
                        {design.name}
                      </div>
                      {isSelected && (
                        <div className="absolute top-1 right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                Tasarım Nişi / Teması:
              </label>
              <input
                type="text"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl p-3 text-xs focus:ring-2 focus:ring-emerald-500 outline-none font-semibold"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                Ürün Tipi / Kumaş:
              </label>
              <input
                type="text"
                value={productType}
                onChange={(e) => setProductType(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl p-3 text-xs focus:ring-2 focus:ring-emerald-500 outline-none font-semibold"
              />
            </div>
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
        </div>
      )}

      {/* TAB 2: VIRTUAL VELA-STYLE VARIATION MATRIX EDITOR */}
      {activeTab === 'variations' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-500" />
              Beden & Renk Varyasyon Ayarları
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-2">
                  Aktif Bedenler:
                </label>
                <div className="flex flex-wrap gap-2">
                  {['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'].map(size => (
                    <button
                      key={size}
                      onClick={() => setSizes(prev => prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size])}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border ${sizes.includes(size) ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-2">
                  Aktif Renkler:
                </label>
                <div className="flex flex-wrap gap-2">
                  {['Black', 'White', 'Navy', 'Pepper', 'Dark Heather', 'Pink', 'Sport Grey'].map(color => (
                    <button
                      key={color}
                      onClick={() => setColors(prev => prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color])}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border ${colors.includes(color) ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Batch Rules Bar */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-500" /> Toplu Fiyat Kuralları:
              </span>
              <button
                onClick={() => applyPriceRule('standard')}
                className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition-colors"
              >
                Tümü = ${basePrice}
              </button>
              <button
                onClick={() => applyPriceRule('plus3')}
                className="px-3 py-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs font-bold transition-colors"
              >
                2XL & 3XL = +$3.00 (${basePrice + 3})
              </button>
            </div>
          </div>

          {/* Interactive Matrix Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex justify-between items-center">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Varyasyon Tablosu ({variations.length} Adet Kombinasyon)
              </h4>
              <span className="text-xs text-slate-500 font-mono">Toplu Düzenlenebilir Elektronik Tablo</span>
            </div>

            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 border-b border-slate-200 dark:border-slate-800 font-semibold">
                  <tr>
                    <th className="p-3 text-center">Durum</th>
                    <th className="p-3">Renk</th>
                    <th className="p-3">Beden</th>
                    <th className="p-3">Fiyat ($)</th>
                    <th className="p-3">Stok Adedi</th>
                    <th className="p-3">Otomatik SKU</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  {variations.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={row.enabled}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setVariations(prev => prev.map((v, i) => i === idx ? { ...v, enabled: val } : v));
                          }}
                          className="rounded text-emerald-600 cursor-pointer"
                        />
                      </td>
                      <td className="p-3 font-semibold text-slate-800 dark:text-slate-200 font-sans">{row.color}</td>
                      <td className="p-3 font-bold text-indigo-600 dark:text-indigo-400">{row.size}</td>
                      <td className="p-3">
                        <input
                          type="number"
                          step="0.01"
                          value={row.price}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setVariations(prev => prev.map((v, i) => i === idx ? { ...v, price: val } : v));
                          }}
                          className="w-24 px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded font-bold text-emerald-600 outline-none"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          value={row.quantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 0;
                            setVariations(prev => prev.map((v, i) => i === idx ? { ...v, quantity: val } : v));
                          }}
                          className="w-20 px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-slate-700 dark:text-slate-300 outline-none"
                        />
                      </td>
                      <td className="p-3 text-slate-500 text-[11px]">{row.sku}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ETSY STORE DIRECT PUBLISH */}
      {activeTab === 'publish' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-emerald-500" />
              Etsy API v3 Mağaza İlan Senkronizasyonu
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Oluşturulan başlık, açıklama, 13 altın etiket ve varyasyon tablosu tek tıkla Etsy mağazanıza Taslak (Draft) veya Canlı (Active) ilan olarak aktarılır.
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={() => handlePublishToEtsy('draft')}
                disabled={isPublishing}
                className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-lg transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Send className={`w-4 h-4 ${isPublishing ? 'animate-spin' : ''}`} />
                🚀 Etsy'ye Taslak (Draft) Olarak Aktar
              </button>

              <button
                onClick={() => handlePublishToEtsy('active')}
                disabled={isPublishing}
                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <ShoppingBag className={`w-4 h-4 ${isPublishing ? 'animate-spin' : ''}`} />
                🔥 Doğrudan Canlıya Al (Active)
              </button>
            </div>

            {publishResult && (
              <div className="mt-6 bg-slate-950 text-slate-100 p-4 rounded-xl font-mono text-xs overflow-x-auto space-y-2">
                <div className="text-emerald-400 font-bold">--- ETSY PUBLISH RESULT ---</div>
                <pre>{JSON.stringify(publishResult, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
