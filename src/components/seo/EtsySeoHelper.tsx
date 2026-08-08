'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Tag, Copy, Sparkles, Check, FileText, ShoppingBag, Layers, DollarSign, Send, RefreshCw, AlertTriangle, CheckCircle, Image as ImageIcon, ChevronRight, MousePointerClick, Filter, X } from 'lucide-react';
import { useToast } from '@/components/common/ToastContext';
import { loadAppData, saveAppData } from '@/lib/storage-service';
import { DesignItem, RenderedMatch } from '@/types/pod';

interface VariationRow {
  id: string;
  size: string;
  color: string;
  price: number;
  quantity: number;
  sku: string;
  enabled: boolean;
}

function extractCleanNiche(design: DesignItem): string {
  if (!design) return '';
  const rawName = design.name ? design.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ').trim() : '';
  const isNumericOrFileId = !rawName || /^\d+$/.test(rawName) || /^(img|dsc|photo|file|image|design|export|temp)[_-]?\d+$/i.test(rawName);

  if (!isNumericOrFileId && rawName.length > 2) {
    return rawName;
  }

  // 1. Try extracting quote or primary subject from AI vision description
  if (design.analysis?.description) {
    const desc = design.analysis.description.trim();
    const quoteMatch = desc.match(/["']([^"']{3,35})["']/);
    if (quoteMatch && quoteMatch[1]) {
      return quoteMatch[1].trim();
    }
    const words = desc.replace(/[^\w\s]/gi, ' ').split(/\s+/).filter(w => w.length > 2 && !['this', 'that', 'with', 'from', 'your', 'have', 'featuring', 'design', 'tshirt', 'shirt', 'apparel', 'market', 'etsy'].includes(w.toLowerCase()));
    if (words.length >= 2) {
      return words.slice(0, 4).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
  }

  // 2. Try using top 2 keywords from AI vision analysis
  if (design.analysis?.keywords && design.analysis.keywords.length > 0) {
    return design.analysis.keywords.slice(0, 2).map(k => k.charAt(0).toUpperCase() + k.slice(1)).join(' ');
  }

  return 'Özel Tasarım Nişi';
}

export const EtsySeoHelper: React.FC<{ renderedMatches?: any[] }> = ({ renderedMatches = [] }) => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'studio' | 'variations' | 'publish'>('studio');

  // Loaded user designs
  const [userDesigns, setUserDesigns] = useState<DesignItem[]>([]);
  const [selectedDesign, setSelectedDesign] = useState<DesignItem | null>(null);

  // Variation Matrix state
  const [sizes, setSizes] = useState<string[]>(['S', 'M', 'L', 'XL', '2XL', '3XL']);
  const [colors, setColors] = useState<string[]>(['Black', 'White', 'Navy', 'Pepper']);
  const [variations, setVariations] = useState<VariationRow[]>([]);
  const [basePrice, setBasePrice] = useState<number>(24.99);

  // Input states for AI generation
  const [niche, setNiche] = useState('');
  const [productType, setProductType] = useState('');
  const [designDescription, setDesignDescription] = useState('');
  const [userNotes, setUserNotes] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Generated AI Content states
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [generatedDescription, setGeneratedDescription] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Generated Mockups State
  const [dbGeneratedMockups, setDbGeneratedMockups] = useState<RenderedMatch[]>([]);

  // Load user designs on mount & filter STRICTLY for AI-analyzed designs!
  useEffect(() => {
    loadAppData().then((data) => {
      // Load saved user notes and product types from DB if present
      if (data.etsyProductTypes) setProductType(data.etsyProductTypes);
      if (data.etsyUserNotes) setUserNotes(data.etsyUserNotes);
      if (data.etsyVariationTemplates && data.etsyVariationTemplates.length > 0) {
        // Find the most recently updated template
        const latest = [...data.etsyVariationTemplates].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
        setTimeout(() => {
          setVariations(latest.variations || []);
        }, 50);
      }
      if (data.etsyCustomSizes) setSavedCustomSizes(data.etsyCustomSizes);
      if (data.etsyCustomColors) setSavedCustomColors(data.etsyCustomColors);
      if (data.etsyGeneratedMockups) setDbGeneratedMockups(data.etsyGeneratedMockups);

      if (data.designs && Array.isArray(data.designs)) {
        // FILTER: Include any design that has AI analysis (description or keywords)!
        const analyzed = data.designs.filter(d => d.analysis && (d.analysis.description || (d.analysis.keywords && d.analysis.keywords.length > 0)));
        setUserDesigns(analyzed);

        if (analyzed.length > 0) {
          const first = analyzed[0];
          setSelectedDesign(first);
          const cleanNicheName = extractCleanNiche(first);
          setNiche(cleanNicheName);
          if (first.analysis?.description) {
            setDesignDescription(first.analysis.description);
          }
          if (first.seo) {
            setGeneratedTitle(first.seo.title || '');
            setGeneratedDescription(first.seo.description || '');
            setSelectedTags(first.seo.tags || []);
          } else {
            setGeneratedTitle('');
            setGeneratedDescription('');
            setSelectedTags([]);
          }
        }
      }
    }).catch(console.warn);
  }, []);

  // When selectedDesign changes, pre-populate details 100% automatically with AI extracted niche!
  const handleSelectDesign = (design: DesignItem) => {
    setSelectedDesign(design);
    const cleanNicheName = extractCleanNiche(design);
    setNiche(cleanNicheName);
    if (design.analysis?.description) {
      setDesignDescription(design.analysis.description);
    }
    if (design.seo) {
      setGeneratedTitle(design.seo.title || '');
      setGeneratedDescription(design.seo.description || '');
      setSelectedTags(design.seo.tags || []);
    } else {
      setGeneratedTitle('');
      setGeneratedDescription('');
      setSelectedTags([]);
    }
    toast.info(`"${cleanNicheName}" tasarımı ve Yapay Zeka analiz verileri yüklendi!`);
  };

  // Save Product Types & User Notes to Database and IndexedDB
  const handleSaveEtsySettings = async () => {
    setIsSavingSettings(true);
    try {
      const appData = await loadAppData();
      appData.etsyProductTypes = productType;
      appData.etsyUserNotes = userNotes;
      await saveAppData(appData);
      toast.success('Özel Ürün Markaları ve Kullanıcı Talimatları Veritabanına Kaydedildi!');
    } catch (e: any) {
      toast.error('Kaydetme hatası: ' + e.message);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Advanced Table Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [colorFilter, setColorFilter] = useState<string>('all');
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  // --- New Variation Generator State ---
  const [genProduct, setGenProduct] = useState('');
  const [genSizes, setGenSizes] = useState<string[]>([]);
  const [genColors, setGenColors] = useState<string[]>([]);
  const [genPrice, setGenPrice] = useState<string>(basePrice.toString());
  const [genQuantity, setGenQuantity] = useState<string>('999');

  const [newGenSizeInput, setNewGenSizeInput] = useState('');
  const [newGenColorInput, setNewGenColorInput] = useState('');

  const [savedCustomSizes, setSavedCustomSizes] = useState<string[]>([]);
  const [savedCustomColors, setSavedCustomColors] = useState<string[]>([]);

  const handleAddCustomSize = async () => {
    const trimmed = newGenSizeInput.trim();
    if (!trimmed || savedCustomSizes.includes(trimmed)) {
      if (trimmed && !genSizes.includes(trimmed)) setGenSizes(prev => [...prev, trimmed]);
      setNewGenSizeInput('');
      return;
    }
    const newSizes = [...savedCustomSizes, trimmed];
    setSavedCustomSizes(newSizes);
    setNewGenSizeInput('');
    if (!genSizes.includes(trimmed)) setGenSizes(prev => [...prev, trimmed]);
    try {
      const appData = await loadAppData();
      appData.etsyCustomSizes = newSizes;
      await saveAppData(appData);
      toast.success('Özel beden kalıcı olarak kaydedildi.');
    } catch (e: any) {
      toast.error('Kaydedilemedi: ' + e.message);
    }
  };

  const handleDeleteCustomSize = async (size: string) => {
    const newSizes = savedCustomSizes.filter(s => s !== size);
    setSavedCustomSizes(newSizes);
    setGenSizes(prev => prev.filter(s => s !== size));
    try {
      const appData = await loadAppData();
      appData.etsyCustomSizes = newSizes;
      await saveAppData(appData);
      toast.success('Özel beden silindi.');
    } catch (e: any) {
      toast.error('Silinemedi: ' + e.message);
    }
  };

  const handleAddCustomColor = async () => {
    const trimmed = newGenColorInput.trim();
    if (!trimmed || savedCustomColors.includes(trimmed)) {
      if (trimmed && !genColors.includes(trimmed)) setGenColors(prev => [...prev, trimmed]);
      setNewGenColorInput('');
      return;
    }
    const newColors = [...savedCustomColors, trimmed];
    setSavedCustomColors(newColors);
    setNewGenColorInput('');
    if (!genColors.includes(trimmed)) setGenColors(prev => [...prev, trimmed]);
    try {
      const appData = await loadAppData();
      appData.etsyCustomColors = newColors;
      await saveAppData(appData);
      toast.success('Özel renk kalıcı olarak kaydedildi.');
    } catch (e: any) {
      toast.error('Kaydedilemedi: ' + e.message);
    }
  };

  const handleDeleteCustomColor = async (color: string) => {
    const newColors = savedCustomColors.filter(c => c !== color);
    setSavedCustomColors(newColors);
    setGenColors(prev => prev.filter(c => c !== color));
    try {
      const appData = await loadAppData();
      appData.etsyCustomColors = newColors;
      await saveAppData(appData);
      toast.success('Özel renk silindi.');
    } catch (e: any) {
      toast.error('Silinemedi: ' + e.message);
    }
  };

  // Default options for quick selection
  const defaultSizes = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];
  const defaultColors = [
    'Athletic Heather', 'Bay', 'Black', 'Blossom', 'Blue Jean', 'Dark Gray Heather',
    'Dark Heather', 'Forest', 'Gold', 'Heather Light Gray', 'Heather Maroon',
    'Heather Mauve', 'Heather Navy', 'Heather Peach', 'Heather Raspberry',
    'Ivory', 'Maroon', 'Military Green', 'Moss', 'Natural', 'Navy', 'Orange',
    'Pepper', 'Pink', 'Purple', 'Red', 'Royal', 'Soft Pink', 'Sport Grey',
    'True Royal', 'White', 'Yam'
  ];

  const uniqueTableSizes = useMemo(() => Array.from(new Set(variations.map(v => v.size))), [variations]);
  const uniqueTableColors = useMemo(() => Array.from(new Set(variations.map(v => v.color))), [variations]);

  const handleGenerateToTable = () => {
    if (!genProduct.trim()) {
      toast.error('Lütfen bir Ürün/Marka adı girin (Örn: Bella Canvas 3001).');
      return;
    }
    if (genSizes.length === 0) {
      toast.error('Lütfen en az bir beden seçin.');
      return;
    }
    if (genColors.length === 0) {
      toast.error('Lütfen en az bir renk seçin.');
      return;
    }

    const priceNum = parseFloat(genPrice) || basePrice;
    const qtyNum = parseInt(genQuantity, 10) || 999;
    
    let addedCount = 0;
    let updatedCount = 0;

    const nextVars = [...variations];
    
    // First pass to count how many will be uniquely added
    let prospectiveAdds = 0;
    genSizes.forEach(size => {
      genColors.forEach(color => {
        const combinedSize = `${genProduct.trim()} - ${size}`;
        const key = `${color}-${combinedSize}`;
        if (!nextVars.find(v => v.id === key)) {
          prospectiveAdds++;
        }
      });
    });

    if (nextVars.length + prospectiveAdds > 400) {
      toast.error(`Etsy en fazla 400 varyasyon destekler. Mevcut: ${nextVars.length}, Eklenecek: ${prospectiveAdds}. Lütfen sınırın altında kalın.`);
      return;
    }
    
    genSizes.forEach(size => {
      genColors.forEach(color => {
        const combinedSize = `${genProduct.trim()} - ${size}`;
        const key = `${color}-${combinedSize}`;
        
        const existingIdx = nextVars.findIndex(v => v.id === key);
        if (existingIdx >= 0) {
          // Update existing
          nextVars[existingIdx] = {
            ...nextVars[existingIdx],
            price: priceNum,
            quantity: qtyNum,
            enabled: true
          };
          updatedCount++;
        } else {
          // Add new
          nextVars.push({
            id: key,
            color,
            size: combinedSize,
            price: priceNum,
            quantity: qtyNum,
            sku: '',
            enabled: true
          });
          addedCount++;
        }
      });
    });

    setVariations(nextVars);

    // Auto-clean generator
    setGenProduct('');
    setGenSizes([]);
    setGenColors([]);
    setGenPrice(basePrice.toString());
    setGenQuantity('999');

    if (addedCount > 0 || updatedCount > 0) {
      toast.success(`${addedCount} yeni eklendi, ${updatedCount} kayıt güncellendi!`);
    } else {
      toast.error('Herhangi bir değişiklik yapılamadı.');
    }
  };

  // Drag-to-fill state
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    startRowId: string | null;
    endRowId: string | null;
    field: 'price' | 'quantity' | 'enabled' | null;
    value: any;
  }>({
    isDragging: false,
    startRowId: null,
    endRowId: null,
    field: null,
    value: null
  });

  // Publishing state
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<any>(null);
  
  // Etsy Integration state
  const [etsyConnected, setEtsyConnected] = useState(false);
  const [shippingProfiles, setShippingProfiles] = useState<any[]>([]);
  const [selectedShippingProfileId, setSelectedShippingProfileId] = useState<string>('');
  
  const [readinessStates, setReadinessStates] = useState<any[]>([]);
  const [selectedReadinessStateId, setSelectedReadinessStateId] = useState<string>('');

  useEffect(() => {
    if (activeTab === 'publish') {
      fetch('/api/etsy/shipping-profiles')
        .then(res => res.json())
        .then(data => {
          if (data.connected) {
            setEtsyConnected(true);
            if (data.profiles && data.profiles.length > 0) {
              setShippingProfiles(data.profiles);
              setSelectedShippingProfileId(data.profiles[0].shipping_profile_id.toString());
            }
            if (data.readinessStates && data.readinessStates.length > 0) {
              setReadinessStates(data.readinessStates);
              setSelectedReadinessStateId(data.readinessStates[0].readiness_state_id.toString());
            }
          } else {
            setEtsyConnected(false);
          }
        })
        .catch(err => console.error("Error fetching shipping profiles", err));
    }
  }, [activeTab]);

  // Generate Variations Matrix whenever sizes or colors change
  useEffect(() => {
    setVariations(prev => {
      const newVars: VariationRow[] = [];
      colors.forEach(color => {
        sizes.forEach(size => {
          const id = `${color}-${size}`;
          const existing = prev.find(v => v.id === id);
          if (existing) {
            newVars.push(existing);
          } else {
            const isPlusSize = size === '2XL' || size === '3XL' || size === '4XL';
            const price = isPlusSize ? basePrice + 3.00 : basePrice;
            newVars.push({
              id,
              color,
              size,
              price: Math.round(price * 100) / 100,
              quantity: 999,
              sku: '',
              enabled: true
            });
          }
        });
      });
      return newVars;
    });
  }, [sizes, colors]); // intentionally omitted basePrice to prevent resetting manual edits

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Panoya kopyalandı!');
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleGenerateAI = async () => {
    if (!selectedDesign) {
      toast.error('Lütfen önce yukarıdaki galeriden analiz edilmiş bir tasarım seçin.');
      return;
    }

    setIsGenerating(true);
    try {
      // 1. Detect primary subject from niche & design description
      const descLower = (designDescription + ' ' + niche).toLowerCase();
      const isRabbit = descLower.includes('rabbit') || descLower.includes('bunny');
      const isDog = descLower.includes('dog');
      const isCat = descLower.includes('cat');

      // 2. Extract design's own AI vision analysis keywords
      const designKeywords = selectedDesign.analysis?.keywords || [];

      // 3. Query DB Keyword Pool to fetch real scores for design keywords
      let kwList: any[] = [];
      try {
        const kwRes = await fetch('/api/admin/keywords?limit=100&sortBy=opportunity_score&order=desc');
        const kwData = await kwRes.json();
        if (kwData.success && Array.isArray(kwData.keywords) && kwData.keywords.length > 0) {
          const dbPoolMap = new Map(kwData.keywords.map((k: any) => [k.keyword.toLowerCase(), k]));
          
          // Map design's AI keywords to DB pool metrics
          kwList = designKeywords.map(kStr => {
            const lower = kStr.toLowerCase();
            if (dbPoolMap.has(lower)) {
              return dbPoolMap.get(lower);
            }
            return { keyword: kStr, opportunity_score: 75, total_listings: 1500, tag_eligible: kStr.length <= 20 };
          });

          // Also merge top DB keywords matching design theme
          const themeMatches = kwData.keywords.filter((k: any) => {
            const kLower = k.keyword.toLowerCase();
            return designKeywords.some(dk => kLower.includes(dk.toLowerCase()) || dk.toLowerCase().includes(kLower));
          });
          kwList = [...kwList, ...themeMatches];
        }
      } catch (e) {}

      // Fallback to raw design keywords if DB fetch fails
      if (kwList.length === 0 && designKeywords.length > 0) {
        kwList = designKeywords.map(kStr => ({ keyword: kStr, opportunity_score: 80, tag_eligible: kStr.length <= 20 }));
      }

      // 4. Anti-contamination filter (e.g. remove 'dog' if design is rabbit)
      if (isRabbit) {
        kwList = kwList.filter((k: any) => !k.keyword.toLowerCase().includes('dog') && !k.keyword.toLowerCase().includes('cat'));
      } else if (isDog) {
        kwList = kwList.filter((k: any) => !k.keyword.toLowerCase().includes('cat') && !k.keyword.toLowerCase().includes('rabbit'));
      } else if (isCat) {
        kwList = kwList.filter((k: any) => !k.keyword.toLowerCase().includes('dog') && !k.keyword.toLowerCase().includes('rabbit'));
      }

      // Fallback keywords if DB pool is empty or completely filtered out
      if (kwList.length === 0) {
        kwList = [
          { keyword: `${niche.slice(0,12)} shirt`, opportunity_score: 91, total_listings: 1200, is_etsy_suggested: true, autocomplete_rank: 1 },
          { keyword: 'grow through quote', opportunity_score: 88, total_listings: 2400, is_etsy_suggested: true, autocomplete_rank: 2 },
          { keyword: 'wildflower shirt', opportunity_score: 85, total_listings: 1800, is_etsy_suggested: true, autocomplete_rank: 3 },
          { keyword: 'botanical shirt', opportunity_score: 82, total_listings: 4500, is_etsy_suggested: true, autocomplete_rank: 4 },
          { keyword: 'cottagecore shirt', opportunity_score: 95, total_listings: 950, is_etsy_suggested: true, autocomplete_rank: 1 },
          { keyword: 'self care gift', opportunity_score: 89, total_listings: 1400, is_etsy_suggested: true, autocomplete_rank: 2 },
          { keyword: 'inspirational tee', opportunity_score: 87, total_listings: 1900, is_etsy_suggested: true, autocomplete_rank: 3 }
        ];
      }

      const res = await fetch('/api/designs/generate-listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          designDescription: designDescription || `${niche} design for US market`,
          keywords: kwList,
          productType,
          userNotes,
          primarySubject: isRabbit ? 'rabbit bunny' : isDog ? 'dog' : isCat ? 'cat' : niche,
          primaryAesthetic: 'cottagecore botanical wildflower'
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
        
        // Save generated SEO to database
        try {
          const currentData = await loadAppData();
          const designIndex = currentData.designs.findIndex(d => d.id === selectedDesign.id);
          if (designIndex > -1) {
            currentData.designs[designIndex].seo = {
              title: data.listing.title,
              description: data.listing.description,
              tags: data.listing.selectedTags || [],
              generatedAt: Date.now()
            };
            await saveAppData(currentData);
            
            // Update local component state
            setSelectedDesign(currentData.designs[designIndex]);
            setUserDesigns(prev => {
              const updated = [...prev];
              const idx = updated.findIndex(d => d.id === selectedDesign.id);
              if (idx > -1) {
                updated[idx].seo = currentData.designs[designIndex].seo;
              }
              return updated;
            });
          }
        } catch (dbErr) {
          console.error("SEO verisi veritabanına kaydedilemedi:", dbErr);
        }

        toast.success(`Görsel Doğrulama Destekli AI (${data.modelUsed}) ile SEO İçerikleriniz Üretildi ve Kaydedildi!`);
      } else {
        toast.error(data.error || 'İçerik üretilirken hata oluştu.');
      }
    } catch (e: any) {
      toast.error('Bağlantı hatası: ' + e.message);
    } finally {
      setIsGenerating(false);
    }
  };
  // --- ETSY LISTING TEMPLATES ---
  const [showListingsModal, setShowListingsModal] = useState(false);
  const [etsyListings, setEtsyListings] = useState<any[]>([]);
  const [isFetchingListings, setIsFetchingListings] = useState(false);
  const [isFetchingInventory, setIsFetchingInventory] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  const [isSaveTemplateModalOpen, setIsSaveTemplateModalOpen] = useState(false);
  const [templateSaveName, setTemplateSaveName] = useState('');
  const [isLoadTemplateModalOpen, setIsLoadTemplateModalOpen] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<any[]>([]);

  // Bulk Sync States
  const [isBulkSyncModalOpen, setIsBulkSyncModalOpen] = useState(false);
  const [selectedListingsForSync, setSelectedListingsForSync] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedTemplateForSync, setSelectedTemplateForSync] = useState<string>('current');

  const handleOpenBulkSync = async () => {
    setIsBulkSyncModalOpen(true);
    if (etsyListings.length === 0) {
      await handleFetchListings();
    }
    try {
      const appData = await loadAppData();
      setSavedTemplates(appData.etsyVariationTemplates || []);
    } catch (e) {}
  };

  const handleBulkSync = async () => {
    if (selectedListingsForSync.length === 0) {
      toast.error('Lütfen güncellenecek en az bir ilan seçin.');
      return;
    }
    
    let variationsToSync = variations;
    if (selectedTemplateForSync !== 'current') {
      const template = savedTemplates.find(t => t.id === selectedTemplateForSync);
      if (template && template.variations) {
        variationsToSync = template.variations;
      }
    }

    if (variationsToSync.length === 0) {
      toast.error('Senkronize edilecek varyasyon bulunamadı. Lütfen tabloyu doldurun veya geçerli bir şablon seçin.');
      return;
    }

    setIsSyncing(true);
    try {
      const res = await fetch('/api/etsy/update-variations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingIds: selectedListingsForSync,
          variations: variationsToSync
        })
      });
      
      const data = await res.json();
      if (data.success) {
        const successCount = data.results.filter((r: any) => r.success).length;
        const failCount = data.results.filter((r: any) => !r.success).length;
        
        if (failCount === 0) {
          toast.success(`Seçilen ${successCount} ilanın varyasyonları başarıyla güncellendi!`);
          setIsBulkSyncModalOpen(false);
          setSelectedListingsForSync([]);
        } else {
          const firstError = data.results.find((r: any) => !r.success)?.error || 'Bilinmeyen hata';
          toast.error(`${successCount} başarılı, ${failCount} başarısız işlem. Hata detayı: ${firstError}`);
        }
      } else {
        toast.error('Toplu güncelleme başarısız: ' + data.error);
      }
    } catch (e: any) {
      toast.error('Bağlantı hatası: ' + e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveCurrentTemplate = async () => {
    if (!templateSaveName.trim()) {
      toast.error('Lütfen şablon için bir isim girin.');
      return;
    }
    setIsSavingTemplate(true);
    try {
      const appData = await loadAppData();
      const existing = appData.etsyVariationTemplates || [];
      const newTemplate = {
        id: crypto.randomUUID(),
        name: templateSaveName.trim(),
        updatedAt: new Date().toISOString(),
        variations: variations
      };
      appData.etsyVariationTemplates = [...existing, newTemplate];
      await saveAppData(appData);
      toast.success(`"${templateSaveName.trim()}" şablon olarak kaydedildi!`);
      setIsSaveTemplateModalOpen(false);
      setTemplateSaveName('');
    } catch (err: any) {
      toast.error('Şablon kaydedilemedi: ' + err.message);
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const openLoadTemplateModal = async () => {
    try {
      const appData = await loadAppData();
      setSavedTemplates(appData.etsyVariationTemplates || []);
      setIsLoadTemplateModalOpen(true);
    } catch (err: any) {
      toast.error('Şablonlar yüklenemedi: ' + err.message);
    }
  };

  const handleLoadTemplate = (template: any) => {
    setVariations(template.variations || []);
    setIsLoadTemplateModalOpen(false);
    toast.success(`"${template.name}" başarıyla yüklendi!`);
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      const appData = await loadAppData();
      appData.etsyVariationTemplates = (appData.etsyVariationTemplates || []).filter(t => t.id !== templateId);
      await saveAppData(appData);
      setSavedTemplates(appData.etsyVariationTemplates);
      toast.success('Şablon silindi.');
    } catch (err: any) {
      toast.error('Şablon silinemedi: ' + err.message);
    }
  };

  const handleFetchListings = async () => {
    setIsFetchingListings(true);
    setShowListingsModal(true);
    try {
      const res = await fetch('/api/etsy/listings');
      const data = await res.json();
      if (data.success) {
        setEtsyListings(data.listings || []);
      } else {
        toast.error(data.error || 'İlanlar çekilemedi.');
        setShowListingsModal(false);
      }
    } catch (e: any) {
      toast.error('Bağlantı hatası: ' + e.message);
      setShowListingsModal(false);
    } finally {
      setIsFetchingListings(false);
    }
  };

  const handleSelectListingTemplate = async (listingId: number) => {
    setIsFetchingInventory(true);
    try {
      const res = await fetch(`/api/etsy/listings?listing_id=${listingId}`);
      const data = await res.json();
      if (data.success && data.inventory) {
        const products = data.inventory.products || [];
        const newVars: VariationRow[] = [];
        products.forEach((prod: any) => {
          if (prod.is_deleted) return;
          const pv = prod.property_values || [];
          const sizeProp = pv.find((p: any) => p.property_name.toLowerCase() === 'size' || p.property_id === 513 || p.property_id === 504);
          const colorProp = pv.find((p: any) => p.property_name.toLowerCase() === 'color' || p.property_id === 514 || p.property_id === 489);
          
          const size = sizeProp ? sizeProp.values[0] : 'N/A';
          const color = colorProp ? colorProp.values[0] : 'N/A';
          
          const offering = prod.offerings && prod.offerings[0];
          const price = offering?.price?.amount ? offering.price.amount / offering.price.divisor : 24.99;
          const quantity = offering?.quantity || 999;
          
          newVars.push({
            id: `${color}-${size}`, // Important: Keep this format so useEffect doesn't overwrite it
            color,
            size,
            price,
            quantity,
            sku: '', // Kullanıcı SKU'ların gelmesini ve gösterilmesini istemiyor
            enabled: offering ? offering.is_enabled : true
          });
        });

        if (newVars.length > 0) {
          setVariations(newVars);
          // Optional: we can choose NOT to auto-save the template here, or save it as 'Etsy Import - <Listing ID>'
          // But since the user wants multiple named templates, let's not blindly overwrite etsyVariationTemplates.
          // The user can explicitly save it using the Save Template button.
          setShowListingsModal(false);
          toast.success('Varyasyon şablonu Etsy\'den başarıyla çekildi!');
        } else {
          toast.error('Bu ilanda herhangi bir varyasyon bulunamadı.');
        }
      } else {
        toast.error(data.error || 'Varyasyonlar çekilemedi.');
      }
    } catch (e: any) {
      toast.error('Bağlantı hatası: ' + e.message);
    } finally {
      setIsFetchingInventory(false);
    }
  };
  // --------------------------------
  // Advanced Spreadsheet Logic (Filtering, Drag to Fill, Bulk Actions)

  const filteredVariations = useMemo(() => {
    return variations.filter(v => {
      if (statusFilter === 'active' && !v.enabled) return false;
      if (statusFilter === 'inactive' && v.enabled) return false;
      if (colorFilter !== 'all' && v.color !== colorFilter) return false;
      if (sizeFilter !== 'all' && v.size !== sizeFilter) return false;
      return true;
    });
  }, [variations, statusFilter, colorFilter, sizeFilter]);


  // Drag to fill events
  const handleDragStart = (rowId: string, field: 'price' | 'quantity' | 'enabled', value: any) => {
    setDragState({
      isDragging: true,
      startRowId: rowId,
      endRowId: rowId,
      field,
      value
    });
  };

  const handleDragEnter = (rowId: string) => {
    if (dragState.isDragging && dragState.startRowId) {
      setDragState(prev => ({ ...prev, endRowId: rowId }));
    }
  };

  useEffect(() => {
    const handleMouseUp = () => {
      if (dragState.isDragging && dragState.startRowId && dragState.endRowId && dragState.field) {
        // Uygulanacak aralığı bul
        const startIdx = filteredVariations.findIndex(v => v.id === dragState.startRowId);
        const endIdx = filteredVariations.findIndex(v => v.id === dragState.endRowId);
        
        if (startIdx !== -1 && endIdx !== -1) {
          const minIdx = Math.min(startIdx, endIdx);
          const maxIdx = Math.max(startIdx, endIdx);
          
          const idsToUpdate = new Set();
          for (let i = minIdx; i <= maxIdx; i++) {
            idsToUpdate.add(filteredVariations[i].id);
          }
          
          setVariations(prev => prev.map(v => {
            if (idsToUpdate.has(v.id)) {
              return { ...v, [dragState.field!]: dragState.value };
            }
            return v;
          }));
          toast.success(`Değer ${idsToUpdate.size} satıra başarıyla kopyalandı.`);
        }
      }
      setDragState({ isDragging: false, startRowId: null, endRowId: null, field: null, value: null });
    };

    if (dragState.isDragging) {
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, filteredVariations]);

  const handlePublishToEtsy = async (state: 'draft' | 'active') => {
    if (!etsyConnected) {
      toast.error('Lütfen önce Etsy mağazanızı bağlayın.');
      return;
    }
    if (!selectedShippingProfileId) {
      toast.error('Lütfen bir Kargo Profili (Shipping Profile) seçin.');
      return;
    }

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
          state,
          shipping_profile_id: parseInt(selectedShippingProfileId, 10),
          readiness_state_id: selectedReadinessStateId ? parseInt(selectedReadinessStateId, 10) : undefined,
          images: dbGeneratedMockups
            .filter(m => m.designId === selectedDesign?.id && m.previewUrl)
            .map(m => m.previewUrl)
            .slice(0, 22)
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
          {userDesigns.length === 0 ? (
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-500/30 p-4 rounded-2xl flex items-center space-x-3">
              <Sparkles className="w-5 h-5 text-amber-500 shrink-0" />
              <div className="text-xs text-amber-800 dark:text-amber-200">
                <span className="font-bold block">Henüz Yapay Zeka İle Analiz Edilmiş Tasarımınız Bulunmuyor</span>
                Tasarımlar sekmesinden bir tasarım yükleyip yapay zeka analizini başlattığınızda, analiz edilen tüm tasarımlarınız bu üst galeride otomatik görüntülenecektir.
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-emerald-500" />
                  Yapay Zeka İle Analiz Edilmiş Tasarımlarınız ({userDesigns.length} Adet):
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

              {selectedDesign && dbGeneratedMockups.filter(m => m.designId === selectedDesign.id).length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">
                    Etsy'ye Gönderilecek Görseller ({dbGeneratedMockups.filter(m => m.designId === selectedDesign.id).length} Adet):
                  </label>
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                    {dbGeneratedMockups.filter(m => m.designId === selectedDesign.id).map((mockup, idx) => (
                      <div key={mockup.id} className="relative shrink-0 w-16 h-16 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-950">
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
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                Tasarım Nişi / Teması (AI Tarafından Çıkarılır):
              </label>
              <input
                type="text"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="Örn: Nature's Legacy Conservation"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl p-3 text-xs focus:ring-2 focus:ring-emerald-500 outline-none font-semibold text-emerald-600 dark:text-emerald-400"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                İlandaki Ürün Tipleri / Markalar:
              </label>
              <input
                type="text"
                value={productType}
                onChange={(e) => setProductType(e.target.value)}
                placeholder="Örn: Comfort Colors 1717, Bella Canvas 3001, Youth Unisex Tee"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl p-3 text-xs focus:ring-2 focus:ring-emerald-500 outline-none font-semibold"
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
      )}

      {/* TAB 3: ETSY STORE DIRECT PUBLISH */}
      {activeTab === 'publish' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-emerald-500" />
              Etsy API v3 Mağaza İlan Senkronizasyonu
            </h3>
            
            {!etsyConnected ? (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl space-y-3">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Etsy Mağazanız Bağlı Değil
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-500">
                  Otomatik ilan oluşturabilmek için lütfen Etsy mağazanızı yetkilendirin.
                </p>
                <a 
                  href="/api/etsy/auth"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  Etsy Mağazamı Bağla
                </a>
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Oluşturulan başlık, açıklama, 13 altın etiket ve varyasyon tablosu tek tıkla Etsy mağazanıza Taslak (Draft) veya Canlı (Active) ilan olarak aktarılır.
                </p>

                <div className="pt-2 pb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      Kargo Profili (Zorunlu)
                    </label>
                    <select 
                      value={selectedShippingProfileId}
                      onChange={(e) => setSelectedShippingProfileId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {shippingProfiles.map(p => (
                        <option key={p.shipping_profile_id} value={p.shipping_profile_id}>
                          {p.title} (ID: {p.shipping_profile_id})
                        </option>
                      ))}
                      {shippingProfiles.length === 0 && <option value="">Kargo profili bulunamadı...</option>}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      Üretim/Hazırlık Süresi (Zorunlu)
                    </label>
                    <select 
                      value={selectedReadinessStateId}
                      onChange={(e) => setSelectedReadinessStateId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {readinessStates.map(r => (
                        <option key={r.readiness_state_id} value={r.readiness_state_id}>
                          {r.processing_days_display_label} ({r.readiness_state})
                        </option>
                      ))}
                      {readinessStates.length === 0 && <option value="">Profil bulunamadı...</option>}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    onClick={() => handlePublishToEtsy('draft')}
                    disabled={isPublishing || !selectedShippingProfileId}
                    className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <Send className={`w-4 h-4 ${isPublishing ? 'animate-spin' : ''}`} />
                    🚀 Etsy'ye Taslak (Draft) Olarak Aktar
                  </button>

                  <button
                    onClick={() => handlePublishToEtsy('active')}
                    disabled={isPublishing || !selectedShippingProfileId}
                    className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <ShoppingBag className={`w-4 h-4 ${isPublishing ? 'animate-spin' : ''}`} />
                    🔥 Doğrudan Canlıya Al (Active)
                  </button>
                </div>
              </>
            )}

            {publishResult && (
              <div className="mt-6 bg-slate-950 text-slate-100 p-4 rounded-xl font-mono text-xs overflow-x-auto space-y-2">
                <div className="text-emerald-400 font-bold">--- ETSY PUBLISH RESULT ---</div>
                <pre>{JSON.stringify(publishResult, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      )}

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
    </div>
  );
};
