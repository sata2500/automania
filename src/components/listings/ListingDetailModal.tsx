'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Eye,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  Send,
  Copy,
  Check,
  Tag,
  FileText,
  Layers,
  Palette,
  Flame,
  ShieldCheck,
  TrendingUp,
  Maximize2
} from 'lucide-react';
import { useToast } from '@/components/common/ToastContext';

interface ListingDetailModalProps {
  listing: any | null;
  isOpen: boolean;
  onClose: () => void;
  onListingUpdated: (updated: any) => void;
}

type ModalTab = 'seo' | 'vision' | 'optimize' | 'edit';

export const ListingDetailModal: React.FC<ListingDetailModalProps> = ({
  listing,
  isOpen,
  onClose,
  onListingUpdated
}) => {
  const { success, error, warning } = useToast();
  const [activeTab, setActiveTab] = useState<ModalTab>('seo');

  // Working edit state
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [editState, setEditState] = useState('active');

  // Loading states
  const [isVisionLoading, setIsVisionLoading] = useState(false);
  const [isOptimizeLoading, setIsOptimizeLoading] = useState(false);
  const [isUpdatingEtsy, setIsUpdatingEtsy] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Sync state with incoming listing
  useEffect(() => {
    if (listing) {
      setEditTitle(listing.title || '');
      setEditDescription(listing.description || '');
      const rawTags = Array.isArray(listing.tags)
        ? listing.tags
        : typeof listing.tags === 'string'
        ? JSON.parse(listing.tags)
        : [];
      setEditTags(rawTags);
      setEditState(listing.state || 'active');
    }
  }, [listing]);

  if (!isOpen || !listing) return null;

  const evaluation = typeof listing.seo_evaluation === 'string'
    ? JSON.parse(listing.seo_evaluation)
    : listing.seo_evaluation || {};

  const vision = typeof listing.vision_analysis === 'string'
    ? JSON.parse(listing.vision_analysis)
    : listing.vision_analysis || {};

  const aiOptimizedTags: string[] = Array.isArray(listing.ai_optimized_tags)
    ? listing.ai_optimized_tags
    : typeof listing.ai_optimized_tags === 'string'
    ? JSON.parse(listing.ai_optimized_tags)
    : [];

  const score = Number(listing.seo_score || 0);
  const grade = evaluation.grade || (score >= 90 ? 'A+' : score >= 75 ? 'A' : score >= 60 ? 'B' : score >= 45 ? 'C' : 'D');

  const imageUrl = listing.primary_image_url || listing.images?.[0]?.url_570xN || listing.images?.[0]?.url_fullxfull || '/placeholder.png';

  // Handle Copy to Clipboard
  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    success('Panoya kopyalandı!');
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Add Tag
  const handleAddTag = () => {
    const trimmed = newTagInput.trim();
    if (!trimmed) return;
    if (trimmed.length > 20) {
      warning('Etiket 20 karakterden uzun olamaz!');
      return;
    }
    if (editTags.length >= 13) {
      warning('Etsy en fazla 13 etikete izin verir!');
      return;
    }
    if (editTags.map(t => t.toLowerCase()).includes(trimmed.toLowerCase())) {
      warning('Bu etiket zaten ekli!');
      return;
    }
    setEditTags([...editTags, trimmed]);
    setNewTagInput('');
  };

  // Remove Tag
  const handleRemoveTag = (indexToRemove: number) => {
    setEditTags(editTags.filter((_, i) => i !== indexToRemove));
  };

  // Apply AI Optimization to edit form
  const handleApplyAiSuggestions = () => {
    if (listing.ai_optimized_title) setEditTitle(listing.ai_optimized_title);
    if (aiOptimizedTags.length > 0) setEditTags(aiOptimizedTags);
    if (listing.ai_optimized_description) setEditDescription(listing.ai_optimized_description);
    setActiveTab('edit');
    success('AI SEO önerileri düzenleme formuna aktarıldı!');
  };

  // Trigger Vision Analysis
  const handleRunVisionAnalysis = async () => {
    setIsVisionLoading(true);
    try {
      const res = await fetch('/api/etsy/listings/analyze-vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: listing.listing_id })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Vision analizi başarısız oldu.');

      const result = data.results?.[0];
      if (result) {
        const updated = {
          ...listing,
          vision_analysis: result.visionAnalysis,
          seo_score: result.seoScore,
          seo_evaluation: result.seoEvaluation
        };
        onListingUpdated(updated);
        success('Kapak görseli Vision AI ile başarıyla analiz edildi!');
      }
    } catch (err: any) {
      error(err.message || 'Vision analizinde hata oluştu.');
    } finally {
      setIsVisionLoading(false);
    }
  };

  // Trigger AI SEO Optimization
  const handleRunAiOptimize = async () => {
    setIsOptimizeLoading(true);
    try {
      const res = await fetch('/api/etsy/listings/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: listing.listing_id })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'AI Optimizasyonu başarısız oldu.');

      const result = data.results?.[0];
      if (result) {
        const updated = {
          ...listing,
          ai_optimized_title: result.aiOptimizedTitle,
          ai_optimized_tags: result.aiOptimizedTags,
          ai_optimized_description: result.aiOptimizedDescription,
          ai_optimized_at: result.aiOptimizedAt
        };
        onListingUpdated(updated);
        success('AI SEO başlık, etiket ve açıklama başarıyla üretildi!');
      }
    } catch (err: any) {
      error(err.message || 'AI optimizasyonunda hata oluştu.');
    } finally {
      setIsOptimizeLoading(false);
    }
  };

  // Push Changes directly to Etsy API
  const handlePushToEtsy = async () => {
    if (editTags.length === 0) {
      warning('En az 1 adet etiket gereklidir.');
      return;
    }

    setIsUpdatingEtsy(true);
    try {
      const res = await fetch('/api/etsy/listings/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: listing.listing_id,
          title: editTitle,
          description: editDescription,
          tags: editTags,
          state: editState
        })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Etsy güncellemesi başarısız oldu.');

      const updated = {
        ...listing,
        title: editTitle,
        description: editDescription,
        tags: editTags,
        state: editState,
        seo_score: data.listing?.seoScore ?? listing.seo_score,
        seo_evaluation: data.listing?.seoEvaluation ?? listing.seo_evaluation
      };

      onListingUpdated(updated);
      success('🎉 İlan Etsy mağazanızda canlı olarak güncellendi!');
    } catch (err: any) {
      error(err.message || 'Etsy güncellemesinde hata oluştu.');
    } finally {
      setIsUpdatingEtsy(false);
    }
  };


  // Helper score color
  const getScoreColor = (sc: number) => {
    if (sc >= 85) return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30';
    if (sc >= 60) return 'text-amber-500 bg-amber-500/10 border-amber-500/30';
    return 'text-rose-500 bg-rose-500/10 border-rose-500/30';
  };

  const getScoreBg = (sc: number) => {
    if (sc >= 85) return 'bg-emerald-500';
    if (sc >= 60) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-800 border border-slate-700 shrink-0">
              <img src={imageUrl} alt={listing.title} className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono uppercase bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                  ID: #{listing.listing_id}
                </span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                  listing.state === 'active' 
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                    : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                }`}>
                  {listing.state === 'active' ? 'Aktif (Live)' : listing.state}
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white truncate max-w-md sm:max-w-xl mt-0.5" title={listing.title}>
                {listing.title || 'Başlıksız İlan'}
              </h3>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {listing.url && (
              <a
                href={listing.url}
                target="_blank"
                rel="noreferrer"
                className="hidden sm:flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-lg transition-all"
              >
                <span>Etsy'de Aç</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg bg-slate-800/60 hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-4 sm:px-6 gap-2 overflow-x-auto shrink-0">
          <button
            onClick={() => setActiveTab('seo')}
            className={`py-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'seo'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>1. SEO Denetimi & Skor ({score}/100)</span>
          </button>

          <button
            onClick={() => setActiveTab('vision')}
            className={`py-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'vision'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>2. Vision Görsel Analizi {vision.primarySubject ? '✓' : ''}</span>
          </button>

          <button
            onClick={() => setActiveTab('optimize')}
            className={`py-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'optimize'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>3. AI SEO Optimizasyonu {listing.ai_optimized_title ? '✓' : ''}</span>
          </button>

          <button
            onClick={() => setActiveTab('edit')}
            className={`py-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'edit'
                ? 'border-teal-500 text-teal-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>4. Düzenle & Etsy'ye Gönder</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">

          {/* TAB 1: SEO AUDIT & DIAGNOSTIC */}
          {activeTab === 'seo' && (
            <div className="space-y-6">
              {/* Score Header Card */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col items-center justify-center text-center">
                  <span className="text-xs text-slate-400 font-medium">Toplam SEO Skoru</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className={`text-4xl font-extrabold ${getScoreColor(score)} px-3 py-1 rounded-xl border`}>
                      {score}
                    </span>
                    <span className="text-sm text-slate-500 font-bold">/100</span>
                  </div>
                  <span className="text-xs font-mono mt-2 text-slate-400">
                    Not Derecesi: <strong className="text-white">{grade}</strong>
                  </span>
                </div>

                <div className="md:col-span-3 p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">SEO Puan Dağılımı</h4>
                  
                  {/* Breakdown Bars */}
                  <div className="space-y-2.5">
                    <div>
                      <div className="flex justify-between text-xs font-medium text-slate-300 mb-1">
                        <span>🏷️ 13 Etiket & Long-Tail Kalitesi</span>
                        <span>{evaluation.breakdown?.tagsScore ?? 0} / 35 Puan</span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${((evaluation.breakdown?.tagsScore ?? 0) / 35) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-medium text-slate-300 mb-1">
                        <span>📝 Başlık Uzunluğu & Odak Kelimeler</span>
                        <span>{evaluation.breakdown?.titleScore ?? 0} / 35 Puan</span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-500"
                          style={{ width: `${((evaluation.breakdown?.titleScore ?? 0) / 35) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-medium text-slate-300 mb-1">
                        <span>📄 Açıklama & Bölüm Zenginliği</span>
                        <span>{evaluation.breakdown?.descriptionScore ?? 0} / 15 Puan</span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500 rounded-full transition-all duration-500"
                          style={{ width: `${((evaluation.breakdown?.descriptionScore ?? 0) / 15) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-medium text-slate-300 mb-1">
                        <span>👁️ Görsel ve SEO Metin Uyumu</span>
                        <span>{evaluation.breakdown?.consistencyScore ?? 0} / 15 Puan</span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full transition-all duration-500"
                          style={{ width: `${((evaluation.breakdown?.consistencyScore ?? 0) / 15) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Strengths & Issues */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Strengths */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Güçlü SEO Yönleri ({evaluation.strengths?.length || 0})</span>
                  </h4>
                  {(!evaluation.strengths || evaluation.strengths.length === 0) ? (
                    <p className="text-xs text-slate-500 italic">Henüz tespit edilen güçlü yön bulunmuyor.</p>
                  ) : (
                    <ul className="space-y-2">
                      {evaluation.strengths.map((str: string, i: number) => (
                        <li key={i} className="text-xs text-slate-300 flex items-start gap-2 bg-emerald-500/5 p-2 rounded-lg border border-emerald-500/10">
                          <span className="text-emerald-400 mt-0.5">•</span>
                          <span>{str}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Issues */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-amber-400 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    <span>İyileştirme Gereken Noktalar ({evaluation.issues?.length || 0})</span>
                  </h4>
                  {(!evaluation.issues || evaluation.issues.length === 0) ? (
                    <p className="text-xs text-emerald-400 italic">Tebrikler! Belirgin bir SEO sorunu tespit edilmedi.</p>
                  ) : (
                    <ul className="space-y-2 max-h-60 overflow-y-auto">
                      {evaluation.issues.map((iss: any, i: number) => (
                        <li key={i} className={`text-xs p-2.5 rounded-lg border flex flex-col gap-1 ${
                          iss.severity === 'critical'
                            ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                            : iss.severity === 'warning'
                            ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                            : 'bg-blue-500/10 border-blue-500/20 text-blue-300'
                        }`}>
                          <div className="font-semibold flex items-center gap-1.5">
                            {iss.severity === 'critical' && <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                            {iss.severity === 'warning' && <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                            {iss.severity === 'tip' && <HelpCircle className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                            <span>{iss.message}</span>
                          </div>
                          {iss.fixSuggestion && (
                            <p className="text-[11px] opacity-80 pl-5">
                              💡 Öneri: {iss.fixSuggestion}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Missing Pool Keywords */}
              {evaluation.missingPoolKeywords && evaluation.missingPoolKeywords.length > 0 && (
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-300 flex items-center gap-2">
                      <Flame className="w-4 h-4 text-orange-400" />
                      <span>Kelime Havuzunuzdan Önerilen Yüksek Fırsatlı Kelimeler</span>
                    </h4>
                    <span className="text-[11px] text-slate-400">Tıklayarak doğrudan etiketlerinize ekleyebilirsiniz</span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {evaluation.missingPoolKeywords.map((kw: any, i: number) => (
                      <button
                        key={i}
                        onClick={() => {
                          if (editTags.length >= 13) {
                            warning('Maksimum 13 etiket ekleyebilirsiniz!');
                            return;
                          }
                          if (!editTags.includes(kw.keyword)) {
                            setEditTags([...editTags, kw.keyword]);
                            success(`"${kw.keyword}" etiketlere eklendi!`);
                          }
                        }}

                        className="px-3 py-1.5 rounded-lg text-xs bg-slate-800/80 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-slate-700 hover:border-emerald-500/40 transition-all flex items-center gap-1.5 group"
                      >
                        <span>{kw.keyword}</span>
                        <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded">
                          {kw.opportunityScore} Skoru
                        </span>
                        <span className="text-slate-500 group-hover:text-emerald-400 font-bold">+</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: VISION ANALYSIS */}
          {activeTab === 'vision' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row gap-6 items-start">
                {/* Image Preview Box */}
                <div className="w-full md:w-72 bg-slate-950 p-3 rounded-2xl border border-slate-800 shrink-0 flex flex-col items-center">
                  <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-slate-900 border border-slate-800">
                    <img src={imageUrl} alt={listing.title} className="w-full h-full object-cover" />
                  </div>
                  <button
                    onClick={handleRunVisionAnalysis}
                    disabled={isVisionLoading}
                    className="w-full mt-3 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                  >
                    <Eye className={`w-4 h-4 ${isVisionLoading ? 'animate-spin' : ''}`} />
                    {isVisionLoading ? 'Vision AI Analiz Ediyor...' : '👁️ Kapak Görselini Analiz Et'}
                  </button>
                </div>

                {/* Analysis Results Display */}
                <div className="flex-1 space-y-4">
                  {!vision.primarySubject && !vision.description ? (
                    <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-dashed border-slate-800 space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto">
                        <Eye className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-bold text-white">Bu ilan için henüz Görsel Analizi yapılmamış</h4>
                      <p className="text-xs text-slate-400 max-w-md mx-auto">
                        Admin panelinizde ayarladığınız Vision AI modeli (Google Gemini veya OpenRouter) ile kapak fotoğrafındaki tasarım konusunu, renklerini ve estetiğini otomatik çıkarın.
                      </p>
                      <button
                        onClick={handleRunVisionAnalysis}
                        disabled={isVisionLoading}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
                      >
                        Şimdi Analiz Et
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Attributes Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                          <span className="text-[11px] text-slate-400 font-medium">Ana Konu (Primary Subject)</span>
                          <p className="text-xs font-bold text-white mt-1">{vision.primarySubject || '-'}</p>
                        </div>

                        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                          <span className="text-[11px] text-slate-400 font-medium">Estetik & Tarz (Aesthetic)</span>
                          <p className="text-xs font-bold text-indigo-300 mt-1">{vision.primaryAesthetic || '-'}</p>
                        </div>

                        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                          <span className="text-[11px] text-slate-400 font-medium">Tasarım Tekniği / Stil</span>
                          <p className="text-xs font-bold text-white mt-1">{vision.detectedStyle || '-'}</p>
                        </div>

                        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                          <span className="text-[11px] text-slate-400 font-medium">Tespit Edilen Ürün Tipi</span>
                          <p className="text-xs font-bold text-teal-300 mt-1">{vision.productType || 'Apparel POD'}</p>
                        </div>
                      </div>

                      {/* Colors */}
                      {vision.detectedColors && vision.detectedColors.length > 0 && (
                        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                          <span className="text-[11px] text-slate-400 font-medium">Tespit Edilen Renkler</span>
                          <div className="flex flex-wrap gap-1.5">
                            {vision.detectedColors.map((color: string, i: number) => (
                              <span key={i} className="text-xs bg-slate-800 text-slate-200 px-2.5 py-1 rounded-lg border border-slate-700">
                                🎨 {color}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Visual Description */}
                      {vision.description && (
                        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
                          <span className="text-[11px] text-slate-400 font-medium">Görsel Betimlemesi (AI Description)</span>
                          <p className="text-xs text-slate-300 leading-relaxed">{vision.description}</p>
                        </div>
                      )}

                      {/* Keywords */}
                      {vision.keywords && vision.keywords.length > 0 && (
                        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                          <span className="text-[11px] text-slate-400 font-medium">Görselden Çıkarılan Anahtar Kelimeler</span>
                          <div className="flex flex-wrap gap-1.5">
                            {vision.keywords.map((kw: string, i: number) => (
                              <span key={i} className="text-xs bg-indigo-500/10 text-indigo-300 px-2.5 py-1 rounded-lg border border-indigo-500/20">
                                #{kw}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AI SEO OPTIMIZE & COMPARISON */}
          {activeTab === 'optimize' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span>Yapay Zeka SEO Yenileme & Karşılaştırma</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Admin panelinizdeki SEO metin yazarı AI modeli, kelime havuzunuz ve görsel analiziniz ile en yüksek arama hacimli başlık, etiket ve açıklamayı üretir.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRunAiOptimize}
                    disabled={isOptimizeLoading}
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 shrink-0"
                  >
                    <Sparkles className={`w-4 h-4 ${isOptimizeLoading ? 'animate-spin' : ''}`} />
                    {isOptimizeLoading ? 'AI SEO Üretiyor...' : '🪄 AI SEO Üret'}
                  </button>

                  {listing.ai_optimized_title && (
                    <button
                      onClick={handleApplyAiSuggestions}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 shrink-0"
                    >
                      <Check className="w-4 h-4" />
                      <span>Forma Uygula</span>
                    </button>
                  )}
                </div>
              </div>

              {!listing.ai_optimized_title ? (
                <div className="p-8 text-center bg-slate-950/40 rounded-2xl border border-dashed border-slate-800 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-white">Henüz AI Optimizasyon Önerisi Üretilmedi</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Yukarıdaki "🪄 AI SEO Üret" butonuna tıklayarak bu ilan için optimize edilmiş 140 karakterlik başlık, 13 altın etiket ve dönüşüm odaklı açıklama hazırlatabilirsiniz.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Before vs After Title */}
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-400" />
                      <span>Başlık Karşılaştırması (Title Comparison)</span>
                    </span>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Current Title */}
                      <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span className="font-semibold text-rose-400">Mevcut Etsy Başlığı</span>
                          <span>{listing.title?.length || 0} / 140 Karakter</span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed font-mono">
                          {listing.title || 'Başlık yok'}
                        </p>
                      </div>

                      {/* AI Optimized Title */}
                      <div className="p-3 bg-purple-950/20 rounded-xl border border-purple-500/30 space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-purple-300 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-purple-400" />
                            <span>AI Optimize Başlık</span>
                          </span>
                          <span className="text-purple-400">{listing.ai_optimized_title.length} / 140 Karakter</span>
                        </div>
                        <p className="text-xs text-white leading-relaxed font-mono font-medium">
                          {listing.ai_optimized_title}
                        </p>
                        <button
                          onClick={() => handleCopy(listing.ai_optimized_title, 'aiTitle')}
                          className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1 mt-1"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{copiedField === 'aiTitle' ? 'Kopyalandı!' : 'Başlığı Kopyala'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Before vs After Tags */}
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <Tag className="w-4 h-4 text-emerald-400" />
                      <span>13 Altın Etiket Karşılaştırması</span>
                    </span>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Current Tags */}
                      <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span className="font-semibold text-rose-400">Mevcut Etiketler</span>
                          <span>{editTags.length} / 13</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {editTags.map((t, i) => (
                            <span key={i} className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* AI Optimized Tags */}
                      <div className="p-3 bg-emerald-950/20 rounded-xl border border-emerald-500/30 space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-emerald-300 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-emerald-400" />
                            <span>AI 13 Altın Etiket</span>
                          </span>
                          <span className="text-emerald-400">{aiOptimizedTags.length} / 13</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {aiOptimizedTags.map((t, i) => (
                            <span key={i} className="text-xs bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30 font-medium">
                              #{t}
                            </span>
                          ))}
                        </div>
                        <button
                          onClick={() => handleCopy(aiOptimizedTags.join(', '), 'aiTags')}
                          className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 mt-1"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{copiedField === 'aiTags' ? 'Kopyalandı!' : 'Etiketleri Kopyala (Virgüllü)'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* AI Description Preview */}
                  {listing.ai_optimized_description && (
                    <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                          <FileText className="w-4 h-4 text-purple-400" />
                          <span>AI Optimize Açıklama Metni ({listing.ai_optimized_description.length} Karakter)</span>
                        </span>
                        <button
                          onClick={() => handleCopy(listing.ai_optimized_description, 'aiDesc')}
                          className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>{copiedField === 'aiDesc' ? 'Kopyalandı!' : 'Açıklamayı Kopyala'}</span>
                        </button>
                      </div>
                      <pre className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs text-slate-300 whitespace-pre-wrap font-sans max-h-48 overflow-y-auto leading-relaxed">
                        {listing.ai_optimized_description}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: EDIT & PUSH DIRECTLY TO ETSY */}
          {activeTab === 'edit' && (
            <div className="space-y-5">
              {/* Top Action Prompt */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-teal-500/10 border border-teal-500/20 p-4 rounded-xl gap-3">
                <div>
                  <h4 className="text-xs font-bold text-teal-300 flex items-center gap-1.5">
                    <Send className="w-4 h-4" />
                    <span>Etsy Mağazanızda Canlı Güncelleme</span>
                  </h4>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Aşağıdaki formu düzenleyin ve tek tıkla Etsy mağazanızdaki bu ilanı güncelleyin.
                  </p>
                </div>

                <button
                  onClick={handlePushToEtsy}
                  disabled={isUpdatingEtsy}
                  className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
                >
                  <Send className={`w-4 h-4 ${isUpdatingEtsy ? 'animate-spin' : ''}`} />
                  {isUpdatingEtsy ? 'Etsy Güncelleniyor...' : '🚀 Etsy Mağazasında Güncelle'}
                </button>
              </div>

              {/* Title Input */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-bold text-slate-300">Etsy İlan Başlığı (Title)</label>
                  <span className={`font-mono text-[11px] ${editTitle.length > 140 ? 'text-rose-400 font-bold' : 'text-slate-400'}`}>
                    {editTitle.length} / 140 Karakter
                  </span>
                </div>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  maxLength={140}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-colors"
                  placeholder="Örn: Vintage Japanese Cat T-Shirt, Retro Graphic Anime Tee..."
                />
              </div>

              {/* Tags Manager (13 slots) */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-bold text-slate-300 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Etsy 13 Altın Etiket (Tags)</span>
                  </label>
                  <span className={`font-mono text-[11px] font-bold ${editTags.length === 13 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {editTags.length} / 13 Etiket
                  </span>
                </div>

                {/* Add Tag Bar */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    maxLength={20}
                    disabled={editTags.length >= 13}
                    placeholder={editTags.length >= 13 ? '13 etiket sınırı doldu' : 'Yeni etiket yazıp Enter veya Ekle\'ye basın (max 20 char)'}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    disabled={editTags.length >= 13 || !newTagInput.trim()}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-colors disabled:opacity-40"
                  >
                    Ekle
                  </button>
                </div>

                {/* Tag Pills */}
                <div className="flex flex-wrap gap-2 p-3 bg-slate-950/60 rounded-xl border border-slate-800 min-h-[50px] items-center">
                  {editTags.length === 0 ? (
                    <span className="text-xs text-slate-500 italic">Henüz etiket eklenmemiş.</span>
                  ) : (
                    editTags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs bg-slate-800/90 text-slate-200 border border-slate-700 group hover:border-slate-600"
                      >
                        <span className="font-mono text-emerald-400 font-bold">{index + 1}.</span>
                        <span>{tag}</span>
                        <span className="text-[10px] text-slate-500 font-mono">({tag.length}k)</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(index)}
                          className="text-slate-400 hover:text-rose-400 ml-1 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Description Input */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-bold text-slate-300">Etsy Açıklama Metni (Description)</label>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {editDescription.length} Karakter
                  </span>
                </div>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={8}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-colors leading-relaxed font-sans"
                  placeholder="Ürün özelliklerini, kumaş/beden detaylarını ve bakım talimatlarını yazın..."
                />
              </div>

              {/* Status State Selector */}
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-slate-300">İlan Durumu:</label>
                <select
                  value={editState}
                  onChange={(e) => setEditState(e.target.value)}
                  className="bg-slate-950 border border-slate-700 text-white text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-teal-500"
                >
                  <option value="active">🟢 Aktif (Active - Mağazada Satışta)</option>
                  <option value="draft">📝 Taslak (Draft - Gizli)</option>
                  <option value="inactive">⏸️ Pasif (Inactive)</option>
                </select>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${getScoreColor(score)}`}>
              SEO: {score}/100 ({grade})
            </span>
            <span className="text-xs text-slate-400 hidden sm:inline">
              Son Senkron: {listing.last_synced_at ? new Date(listing.last_synced_at).toLocaleDateString('tr-TR') : 'Bugün'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
            >
              Kapat
            </button>

            {activeTab === 'edit' ? (
              <button
                onClick={handlePushToEtsy}
                disabled={isUpdatingEtsy}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <Send className={`w-3.5 h-3.5 ${isUpdatingEtsy ? 'animate-spin' : ''}`} />
                {isUpdatingEtsy ? 'Etsy Güncelleniyor...' : 'Etsy\'de Güncelle'}
              </button>
            ) : (
              <button
                onClick={() => setActiveTab('edit')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5"
              >
                <span>Düzenleme Ekranına Geç</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
