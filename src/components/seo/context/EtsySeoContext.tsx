// @ts-nocheck
'use client';
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
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



const EtsySeoContext = createContext<any>(null);

export const EtsySeoProvider = ({ children, renderedMatches = [] }: { children: React.ReactNode, renderedMatches?: any[] }) => {

  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'studio' | 'variations' | 'publish'>('studio');
  const isTabInitialized = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('automania_seo_active_tab');
      if (saved === 'studio' || saved === 'variations' || saved === 'publish') {
        setActiveTab(saved);
      }
    } catch {}
    // Bir sonraki tick'te initialized olduğunu kabul et
    setTimeout(() => {
      isTabInitialized.current = true;
    }, 50);
  }, []);

  useEffect(() => {
    if (!isTabInitialized.current) return;
    try {
      localStorage.setItem('automania_seo_active_tab', activeTab);
    } catch {}
  }, [activeTab]);

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

  const [dbGeneratedMockups, setDbGeneratedMockups] = useState<RenderedMatch[]>([]);
  const [allDesigns, setAllDesigns] = useState<DesignItem[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [combineAllDesigns, setCombineAllDesigns] = useState(false); // We'll keep this around in case we need it, but hide it in UI
  const [folderOrder, setFolderOrder] = useState<string[]>([]);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [deletingFolderId, setDeletingFolderId] = useState<string | null>(null);
  const [draggedFolderId, setDraggedFolderId] = useState<string | null>(null);

  const foldersWithMockups = useMemo(() => {
    const map = new Map<string, { id: string, name: string, count: number }>();
    dbGeneratedMockups.forEach(m => {
      const fId = m.folderId;
      if (!map.has(fId)) {
        map.set(fId, { id: fId, name: m.folderName || 'Bilinmeyen Klasör', count: 0 });
      }
      map.get(fId)!.count++;
    });
    const arr = Array.from(map.values());
    if (folderOrder.length > 0) {
      arr.sort((a, b) => {
        const idxA = folderOrder.indexOf(a.id);
        const idxB = folderOrder.indexOf(b.id);
        if (idxA === -1 && idxB === -1) return 0;
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
      });
    }
    return arr;
  }, [dbGeneratedMockups, folderOrder]);

  // Load user designs on mount
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
      if (data.etsyFolderOrder) setFolderOrder(data.etsyFolderOrder);

      if (data.designs && Array.isArray(data.designs)) {
        setAllDesigns(data.designs);
        setUserDesigns(data.designs); // Keep for compatibility if used elsewhere
      }
    }).catch(console.warn);
  }, []);

  // When a folder is selected or mockups load, automatically select the first folder and extract AI data
  useEffect(() => {
    if (dbGeneratedMockups.length === 0 || allDesigns.length === 0) return;

    let targetFolderId = selectedFolderId;
    if (!targetFolderId && foldersWithMockups.length > 0) {
      targetFolderId = foldersWithMockups[0].id;
      setSelectedFolderId(targetFolderId);
    }

    if (!targetFolderId) return;

    const folderMockups = dbGeneratedMockups.filter(m => m.folderId === targetFolderId);
    if (folderMockups.length === 0) return;

    const usedDesignIds = new Set(folderMockups.map(m => m.designId).filter(id => id && id !== 'static-ref'));
    const usedDesigns = allDesigns.filter(d => usedDesignIds.has(d.id));
    const designWithAi = usedDesigns.find(d => d.analysis?.description || (d.analysis?.keywords && d.analysis.keywords.length > 0));

    if (designWithAi) {
      if (selectedDesign?.id !== designWithAi.id) {
        setSelectedDesign(designWithAi);
        const cleanNicheName = extractCleanNiche(designWithAi);
        setNiche(cleanNicheName);
        if (designWithAi.analysis?.description) setDesignDescription(designWithAi.analysis.description);
        if (designWithAi.seo) {
          setGeneratedTitle(designWithAi.seo.title || '');
          setGeneratedDescription(designWithAi.seo.description || '');
          setSelectedTags(designWithAi.seo.tags || []);
        }
        toast.info(`'${foldersWithMockups.find(f=>f.id===targetFolderId)?.name}' klasörü seçildi. AI verileri: '${designWithAi.name}'`);
      }
    } else if (usedDesignIds.size > 0) {
      if (selectedDesign) {
        setSelectedDesign(null);
        setNiche('');
        setDesignDescription('');
        setGeneratedTitle('');
        setGeneratedDescription('');
        setSelectedTags([]);
        toast.warning('Seçilen klasördeki hiçbir tasarımda Yapay Zeka SEO analizi bulunamadı!');
      }
    }
  }, [selectedFolderId, dbGeneratedMockups, allDesigns, foldersWithMockups]);

  // Handler for manual folder selection
  const handleSelectFolder = (folderId: string) => {
    if (editingFolderId === folderId) return;
    setSelectedFolderId(folderId);
    // Setting to null forces the useEffect above to re-evaluate and notify the user
    setSelectedDesign(null);
  };

  const handleRenameFolder = async (folderId: string, newName: string) => {
    if (!newName.trim()) {
      setEditingFolderId(null);
      return;
    }
    const updated = dbGeneratedMockups.map(m => m.folderId === folderId ? { ...m, folderName: newName.trim() } : m);
    setDbGeneratedMockups(updated);
    
    // Save to DB
    const data = await loadAppData();
    data.etsyGeneratedMockups = updated;
    await saveAppData(data);
    toast.success('Klasör adı güncellendi.');
    setEditingFolderId(null);
  };

  const handleDeleteMockup = async (mockupId: string) => {
    const updated = dbGeneratedMockups.filter(m => m.id !== mockupId);
    setDbGeneratedMockups(updated);
    
    // Save to DB
    const data = await loadAppData();
    data.etsyGeneratedMockups = updated;
    await saveAppData(data);
    toast.success('Öğe klasörden kaldırıldı.');
  };

  const handleDeleteFolder = async (folderId: string) => {
    // Remove from folderOrder if present
    let currentOrder = [...folderOrder];
    const idx = currentOrder.indexOf(folderId);
    if (idx !== -1) {
      currentOrder.splice(idx, 1);
      setFolderOrder(currentOrder);
    }

    // Remove all mockups in this folder
    const updated = dbGeneratedMockups.filter(m => m.folderId !== folderId);
    setDbGeneratedMockups(updated);
    
    // Save to DB
    const data = await loadAppData();
    data.etsyFolderOrder = currentOrder;
    data.etsyGeneratedMockups = updated;
    await saveAppData(data);
    
    if (selectedFolderId === folderId) {
      setSelectedFolderId(null);
      setSelectedDesign(null);
    }
    setDeletingFolderId(null);
    toast.success('Klasör silindi.');
  };

  const handleFolderDragStart = (e: React.DragEvent, folderId: string) => {
    setDraggedFolderId(folderId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleFolderDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleFolderDrop = async (e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault();
    if (!draggedFolderId || draggedFolderId === targetFolderId) return;

    let currentOrder = [...folderOrder];
    // if order is empty, populate it first from foldersWithMockups
    if (currentOrder.length === 0) {
      currentOrder = foldersWithMockups.map(f => f.id);
    }
    
    const draggedIdx = currentOrder.indexOf(draggedFolderId);
    const targetIdx = currentOrder.indexOf(targetFolderId);

    if (draggedIdx === -1 || targetIdx === -1) return;

    currentOrder.splice(draggedIdx, 1);
    currentOrder.splice(targetIdx, 0, draggedFolderId);

    setFolderOrder(currentOrder);
    
    // Save to DB
    const data = await loadAppData();
    data.etsyFolderOrder = currentOrder;
    await saveAppData(data);
    
    setDraggedFolderId(null);
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
            .filter(m => m.folderId === selectedFolderId && m.previewUrl)
            .map(m => ({ url: m.previewUrl, isVideo: m.isVideo === true }))
            .slice(0, 22)
        })
      });
      const data = await res.json();
      setPublishResult(data);
      if (data.success) {
        const realErrors = (data.uploadErrors || []).filter((e: string) => !e.startsWith('Bilgi:'));
        const infoMessages = (data.uploadErrors || []).filter((e: string) => e.startsWith('Bilgi:'));
        
        if (realErrors.length > 0) {
          toast.warning(`İlan aktarıldı ancak bazı görseller yüklenemedi: ${realErrors[0]}`);
        } else {
          toast.success(data.message || 'İlan Etsy mağazanıza aktarıldı!');
        }
        if (infoMessages.length > 0) {
          setTimeout(() => toast.warning(infoMessages[0]), 1500);
        }
      } else {
        toast.error(data.error || 'İlan aktarılırken hata oluştu.');
      }
    } catch (e: any) {
      toast.error('Bağlantı hatası: ' + e.message);
    } finally {
      setIsPublishing(false);
    }
  };

  

  const contextValue = {
    activeTab, setActiveTab,
    userDesigns, setUserDesigns,
    selectedDesign, setSelectedDesign,
    sizes, setSizes,
    colors, setColors,
    variations, setVariations,
    basePrice, setBasePrice,
    niche, setNiche,
    productType, setProductType,
    designDescription, setDesignDescription,
    userNotes, setUserNotes,
    isGenerating, setIsGenerating,
    isSavingSettings, setIsSavingSettings,
    copiedKey, setCopiedKey,
    generatedTitle, setGeneratedTitle,
    generatedDescription, setGeneratedDescription,
    selectedTags, setSelectedTags,
    dbGeneratedMockups, setDbGeneratedMockups,
    allDesigns, setAllDesigns,
    selectedFolderId, setSelectedFolderId,
    combineAllDesigns, setCombineAllDesigns,
    folderOrder, setFolderOrder,
    editingFolderId, setEditingFolderId,
    editingFolderName, setEditingFolderName,
    deletingFolderId, setDeletingFolderId,
    draggedFolderId, setDraggedFolderId,
    foldersWithMockups,
    handleSelectFolder, handleRenameFolder, handleDeleteMockup, handleDeleteFolder,
    handleFolderDragStart, handleFolderDragOver, handleFolderDrop,
    handleSaveEtsySettings,
    statusFilter, setStatusFilter,
    colorFilter, setColorFilter,
    sizeFilter, setSizeFilter,
    genProduct, setGenProduct,
    genSizes, setGenSizes,
    genColors, setGenColors,
    genPrice, setGenPrice,
    genQuantity, setGenQuantity,
    newGenSizeInput, setNewGenSizeInput,
    newGenColorInput, setNewGenColorInput,
    savedCustomSizes, setSavedCustomSizes,
    savedCustomColors, setSavedCustomColors,
    handleAddCustomSize, handleDeleteCustomSize,
    handleAddCustomColor, handleDeleteCustomColor,
    defaultSizes, defaultColors,
    uniqueTableSizes, uniqueTableColors,
    handleGenerateToTable,
    dragState, setDragState,
    isPublishing, setIsPublishing,
    publishResult, setPublishResult,
    etsyConnected, setEtsyConnected,
    shippingProfiles, setShippingProfiles,
    selectedShippingProfileId, setSelectedShippingProfileId,
    readinessStates, setReadinessStates,
    selectedReadinessStateId, setSelectedReadinessStateId,
    copyToClipboard, handleGenerateAI,
    showListingsModal, setShowListingsModal,
    etsyListings, setEtsyListings,
    isFetchingListings, setIsFetchingListings,
    isFetchingInventory, setIsFetchingInventory,
    isSavingTemplate, setIsSavingTemplate,
    isSaveTemplateModalOpen, setIsSaveTemplateModalOpen,
    templateSaveName, setTemplateSaveName,
    isLoadTemplateModalOpen, setIsLoadTemplateModalOpen,
    savedTemplates, setSavedTemplates,
    isBulkSyncModalOpen, setIsBulkSyncModalOpen,
    selectedListingsForSync, setSelectedListingsForSync,
    isSyncing, setIsSyncing,
    selectedTemplateForSync, setSelectedTemplateForSync,
    handleOpenBulkSync, handleBulkSync, handleSaveCurrentTemplate,
    openLoadTemplateModal, handleLoadTemplate, handleDeleteTemplate,
    handleFetchListings, handleSelectListingTemplate,
    filteredVariations, handleDragStart, handleDragEnter,
    handlePublishToEtsy
  };

  return (
    <EtsySeoContext.Provider value={contextValue}>
      {children}
    </EtsySeoContext.Provider>
  );
};

export const useEtsySeo = () => {
  const context = useContext(EtsySeoContext);
  if (!context) {
    throw new Error('useEtsySeo must be used within an EtsySeoProvider');
  }
  return context;
};
