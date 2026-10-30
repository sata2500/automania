'use client';

/**
 * Etsy'deki bir ilanın penceresi, iki adım:
 *  1. Analiz: "Analiz et" tek düğmeyle kapak görselini yapay zekâyla analiz eder, etiketleri Etsy'den puanlar ve
 *     metni değerlendirir; tam SEO puanı, eksikler ve etiket puanları burada görünür.
 *  2. İyileştir ve gönder: (analiz edilmiş ilanda) yapay zekâ önerisi önce/sonra puanıyla hazırlanır, forma
 *     uygulanır; başlık, etiket ve açıklama düzenlenip onayla Etsy'ye gönderilir. İlanın yayın durumu da buradan.
 */
import { getErrorMessage } from '@/lib/errors';
import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, RefreshCw, Send, Sparkles, Tag, TrendingUp, X } from 'lucide-react';
import { useToast } from '@/components/common/ToastContext';
import type { StoredEtsyListing } from '@/types/etsy';
import type { SeoEvaluationResult, VisionAnalysisData } from '@/lib/etsy-seo-evaluator';
import { parseJsonObject } from '@/lib/json-utils';
import { isLivePublishEnabled, LIVE_PUBLISH_CONFIRMATION } from '@/lib/etsy-publish-mode';
import { DialogPanel } from '@/components/common/DialogPanel';
import { Spinner } from '@/components/common/Spinner';
import { SeoBreakdown } from './SeoBreakdown';
import { formatListingState } from '@/lib/etsy-format';

interface ListingDetailModalProps {
  listing: StoredEtsyListing | null;
  isOpen: boolean;
  onClose: () => void;
  onListingUpdated: (updated: StoredEtsyListing) => void;
  /** İlanın açıklama, SEO kırılımı gibi ağır alanları yükleniyor. */
  isDetailLoading?: boolean;
}

type ModalTab = 'analysis' | 'improve';
type StoredEvaluation = Partial<SeoEvaluationResult> & { improvement?: { evaluation?: Partial<SeoEvaluationResult>; createdAt?: string } };

const STATE_LABELS: Record<string, string> = {
  active: 'Aktif (mağazada satışta)',
  inactive: 'Pasif (yayında değil)',
  draft: 'Taslak',
  sold_out: 'Tükendi',
  expired: 'Süresi doldu',
};

const parseTags = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(String) : typeof value === 'string' ? (JSON.parse(value) as string[]) : [];

const inputClass = 'w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30';
const cardClass = 'p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800';

const scoreColor = (score: number) =>
  score >= 80 ? 'text-emerald-600 dark:text-emerald-400' : score >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400';

export const ListingDetailModal: React.FC<ListingDetailModalProps> = ({ listing, isOpen, onClose, onListingUpdated, isDetailLoading = false }) => {
  const { success, error, warning } = useToast();
  const [tab, setTab] = useState<ModalTab>('analysis');
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [stateAction, setStateAction] = useState<'idle' | 'confirm-deactivate' | 'confirm-activate'>('idle');
  const [activationPhrase, setActivationPhrase] = useState('');
  const [isChangingState, setIsChangingState] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isUpdatingEtsy, setIsUpdatingEtsy] = useState(false);
  const livePublishEnabled = isLivePublishEnabled(process.env.NEXT_PUBLIC_ETSY_LIVE_PUBLISH_ENABLED);

  // İlan değişince form güncel metinle doldurulur (render sırasında, yalnızca ilan nesnesi değiştiğinde).
  const [syncedListing, setSyncedListing] = useState<typeof listing | null>(null);
  if (listing && listing !== syncedListing) {
    if (listing.listing_id !== syncedListing?.listing_id) setTab('analysis');
    setSyncedListing(listing);
    setEditTitle(listing.title || '');
    setEditDescription(listing.description || '');
    setEditTags(parseTags(listing.tags));
    setStateAction('idle');
  }

  if (!isOpen || !listing) return null;

  const originalTags = parseTags(listing.tags);
  const changedFields: string[] = [];
  if (editTitle.trim() !== (listing.title || '').trim()) changedFields.push('başlık');
  if (editDescription.trim() !== (listing.description || '').trim()) changedFields.push('açıklama');
  if (JSON.stringify(editTags) !== JSON.stringify(originalTags)) changedFields.push('etiketler');

  const evaluation = parseJsonObject<StoredEvaluation>(listing.seo_evaluation, {});
  const vision = parseJsonObject<Partial<VisionAnalysisData>>(listing.vision_analysis, {});
  const analyzed = Boolean(listing.ai_analyzed || (evaluation.confidence?.aiReviewed && evaluation.aiReview));
  const score = Number(listing.seo_score || 0);
  const improvementScore = typeof evaluation.improvement?.evaluation?.score === 'number' ? evaluation.improvement.evaluation.score : null;
  const suggestionTags = parseTags(listing.ai_optimized_tags);
  const hasSuggestion = Boolean(listing.ai_optimized_title);
  const imageUrl = listing.primary_image_url || listing.images?.[0]?.url_570xN || listing.images?.[0]?.url_fullxfull || '/placeholder.png';

  const handleAnalyze = async (refreshVision = false) => {
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/etsy/listings/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingIds: [listing.listing_id], refreshVision }),
      });
      const data = await res.json();
      const result = data.results?.[0];
      if (!result) throw new Error(data.error || 'İlan analiz edilemedi.');
      onListingUpdated({ ...listing, seo_score: result.seoScore, seo_evaluation: result.seoEvaluation, vision_analysis: result.visionAnalysis, ai_analyzed: true });
      success(`Analiz tamamlandı: SEO puanı ${result.seoScore}.`);
    } catch (err) {
      error(getErrorMessage(err) || 'İlan analiz edilemedi.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleOptimize = async () => {
    setIsOptimizing(true);
    try {
      const res = await fetch('/api/etsy/listings/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: listing.listing_id }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Öneri hazırlanamadı.');
      onListingUpdated({
        ...listing,
        ai_optimized_title: data.suggestion.title,
        ai_optimized_tags: data.suggestion.tags,
        ai_optimized_description: data.suggestion.description,
        ai_optimized_at: data.suggestion.createdAt,
        seo_score: data.before.score,
        seo_evaluation: { ...data.before.evaluation, improvement: { evaluation: data.after.evaluation, createdAt: data.suggestion.createdAt } },
      });
      success(`Öneri hazır: SEO puanı ${data.before.score} → ${data.after.score}.`);
    } catch (err) {
      error(getErrorMessage(err) || 'Öneri hazırlanamadı.');
    } finally {
      setIsOptimizing(false);
    }
  };

  const applySuggestion = () => {
    if (listing.ai_optimized_title) setEditTitle(listing.ai_optimized_title);
    if (suggestionTags.length > 0) setEditTags(suggestionTags);
    if (listing.ai_optimized_description) setEditDescription(listing.ai_optimized_description);
    success('Öneri forma uygulandı. İnceleyip "Etsy\'de güncelle" ile gönderin.');
  };

  const addTag = (raw: string) => {
    const tag = raw.replace(/\s+/g, ' ').trim();
    if (!tag) return;
    if (tag.length > 20) return warning('Etiket 20 karakterden uzun olamaz.');
    if (editTags.length >= 13) return warning('Etsy en fazla 13 etikete izin verir.');
    if (editTags.some((t) => t.toLowerCase() === tag.toLowerCase())) return warning('Bu etiket zaten ekli.');
    setEditTags([...editTags, tag]);
    setNewTagInput('');
  };

  const handlePushToEtsy = async () => {
    if (editTags.length === 0) return warning('En az 1 etiket gereklidir.');
    if (changedFields.length === 0) return warning('Gönderilecek bir değişiklik yok.');
    setIsUpdatingEtsy(true);
    try {
      const res = await fetch('/api/etsy/listings/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: listing.listing_id, title: editTitle, description: editDescription, tags: editTags }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Etsy güncellemesi başarısız oldu.');
      const newEvaluation = data.listing?.seoEvaluation;
      onListingUpdated({
        ...listing,
        title: editTitle,
        description: editDescription,
        tags: data.listing?.tags ?? editTags,
        seo_score: data.listing?.seoScore ?? listing.seo_score,
        seo_evaluation: newEvaluation ?? listing.seo_evaluation,
        ai_analyzed: Boolean(newEvaluation?.confidence?.aiReviewed),
      });
      success(`İlanın ${changedFields.join(', ')} alanları Etsy'de güncellendi.`);
    } catch (err) {
      error(getErrorMessage(err) || 'Etsy güncellemesinde hata oluştu.');
    } finally {
      setIsUpdatingEtsy(false);
    }
  };

  const handleChangeState = async (target: 'active' | 'inactive') => {
    setIsChangingState(true);
    try {
      const res = await fetch('/api/etsy/listings/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: listing.listing_id,
          state: target,
          ...(target === 'inactive' ? { confirmStateChange: true } : { confirmLivePublish: true, confirmationPhrase: activationPhrase.trim() }),
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'İlan durumu değiştirilemedi.');
      onListingUpdated({ ...listing, state: target });
      success(target === 'inactive' ? 'İlan yayından kaldırıldı.' : 'İlan yeniden yayına alındı.');
      setStateAction('idle');
      setActivationPhrase('');
    } catch (err) {
      error(getErrorMessage(err) || 'İlan durumu değiştirilemedi.');
    } finally {
      setIsChangingState(false);
    }
  };

  const issues = (evaluation.issues ?? []).filter((i) => i.severity !== 'tip').concat((evaluation.issues ?? []).filter((i) => i.severity === 'tip'));

  return (
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm">
      <DialogPanel aria-labelledby="listing-detail-title" onClose={onClose} className="bg-white dark:bg-slate-900 sm:border border-slate-200 dark:border-slate-800 w-full max-w-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col h-full sm:h-auto sm:max-h-[92vh]">
        {/* Başlık */}
        <div className="shrink-0 pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-0 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 px-4 py-3">
            <img src={imageUrl} alt="" className="w-11 h-11 rounded-xl object-cover bg-slate-100 dark:bg-slate-800 shrink-0" />
            <div className="min-w-0 flex-1">
              <h3 id="listing-detail-title" className="text-sm font-bold text-slate-900 dark:text-white truncate">{listing.title || 'Başlıksız ilan'}</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <span className={`font-bold ${listing.state === 'active' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {listing.state === 'active' ? 'Yayında' : formatListingState(listing.state)}
                </span>
                <span>·</span>
                <span className={`font-bold ${scoreColor(score)}`}>SEO {score}</span>
                {!analyzed && <span className="text-slate-400">(analiz edilmedi)</span>}
              </p>
            </div>
            {listing.url && (
              <a href={listing.url} target="_blank" rel="noreferrer" aria-label="Etsy'de aç" className="p-2 rounded-xl text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10">
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <button type="button" onClick={onClose} aria-label="Kapat" className="p-2 rounded-xl text-slate-500 bg-slate-100 dark:bg-slate-800">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div role="tablist" className="grid grid-cols-2 px-4">
            {([
              ['analysis', 'Analiz', TrendingUp],
              ['improve', 'İyileştir ve gönder', Sparkles],
            ] as const).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold border-b-2 ${tab === key ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300' : 'border-transparent text-slate-500 dark:text-slate-400'}`}
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>
        </div>

        {/* İçerik */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          {isDetailLoading && (
            <p role="status" className="flex items-center gap-2 text-xs text-slate-500"><Spinner className="w-3.5 h-3.5" /> İlan ayrıntıları yükleniyor…</p>
          )}

          {tab === 'analysis' && (
            <>
              {!analyzed && (
                <div className="p-4 rounded-2xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/70 dark:bg-indigo-500/10 space-y-2">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">Bu ilan henüz analiz edilmedi</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Analiz; kapak görselini yapay zekâyla inceler, etiketleri Etsy&apos;den puanlar ve başlık, etiket ve açıklamayı değerlendirir. Sonuçta güvenilir bir SEO puanı ve neyin düzeltilmesi gerektiği görünür (30-60 sn).
                  </p>
                  <button type="button" onClick={() => void handleAnalyze()} disabled={isAnalyzing} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-60">
                    {isAnalyzing ? <Spinner className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />} {isAnalyzing ? 'Analiz ediliyor…' : 'Analiz et'}
                  </button>
                </div>
              )}

              <div className={`${cardClass} space-y-3`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    SEO puanı: <span className={scoreColor(score)}>{score}/100</span>
                    {evaluation.grade && <span className="ml-1.5 text-xs text-slate-500">({evaluation.grade})</span>}
                  </p>
                  {analyzed && (
                    <button type="button" onClick={() => void handleAnalyze(true)} disabled={isAnalyzing} className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 disabled:opacity-60">
                      {isAnalyzing ? <Spinner className="w-3.5 h-3.5" /> : <RefreshCw className="w-3.5 h-3.5" />} Yeniden analiz et
                    </button>
                  )}
                </div>
                <SeoBreakdown evaluation={evaluation} />
              </div>

              {(vision.primarySubject || vision.description) && (
                <div className={`${cardClass} flex gap-3`}>
                  <img src={imageUrl} alt="" className="w-20 h-20 rounded-xl object-cover bg-slate-100 dark:bg-slate-800 shrink-0" />
                  <div className="min-w-0 text-xs space-y-1">
                    <p className="font-bold text-slate-800 dark:text-slate-100">Görselde ne var?</p>
                    <p className="text-slate-600 dark:text-slate-300">
                      {[vision.primarySubject, vision.primaryAesthetic, vision.productType].filter(Boolean).join(' · ')}
                    </p>
                    {vision.description && <p className="text-slate-500 dark:text-slate-400 line-clamp-3">{vision.description}</p>}
                  </div>
                </div>
              )}

              {issues.length > 0 && (
                <div className={`${cardClass} space-y-2`}>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Düzeltilecekler ({issues.length})</p>
                  <ul className="space-y-1.5">
                    {issues.map((issue, i) => (
                      <li key={i} className={`text-xs p-2 rounded-lg ${issue.severity === 'critical' ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300' : issue.severity === 'warning' ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300' : 'bg-sky-500/10 text-sky-800 dark:text-sky-300'}`}>
                        <span className="font-semibold">{issue.message}</span>
                        {issue.fixSuggestion && <span className="block opacity-80 mt-0.5">{issue.fixSuggestion}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(evaluation.strengths?.length ?? 0) > 0 && (
                <div className={`${cardClass} space-y-1.5`}>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> İyi olanlar</p>
                  {evaluation.strengths!.map((s, i) => <p key={i} className="text-xs text-slate-600 dark:text-slate-300">• {s}</p>)}
                </div>
              )}

              {(evaluation.tagBreakdown?.length ?? 0) > 0 && (
                <div className={`${cardClass} space-y-2`}>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5"><Tag className="w-3.5 h-3.5 text-emerald-500" /> Etiketlerin Etsy puanı</p>
                  <div className="flex flex-wrap gap-1.5">
                    {evaluation.tagBreakdown!.map((t) => {
                      const known = t.status !== 'unknown' && t.status !== 'invalid';
                      return (
                        <span key={t.keyword} title={t.irrelevant ? 'Yapay zekâ: tasarımla ilgisiz' : undefined} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] border ${t.irrelevant ? 'border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200'}`}>
                          {t.keyword}
                          <span className={`font-mono font-bold ${known ? scoreColor(t.opportunityScore) : 'text-slate-400'}`}>
                            {t.status === 'invalid' ? '20+' : known ? t.opportunityScore : '—'}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-slate-400">— : güncel Etsy puanı yok (analizde taranır). Kırmızı: yapay zekâya göre tasarımla ilgisiz.</p>
                </div>
              )}
            </>
          )}

          {tab === 'improve' && (
            <>
              <div className={`${cardClass} space-y-2.5`}>
                <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-purple-500" /> Yapay zekâ önerisi</p>
                {!analyzed ? (
                  <>
                    <p className="text-xs text-slate-600 dark:text-slate-300">Öneri, analiz sonucuna göre hazırlanır. Önce ilanı analiz edin.</p>
                    <button type="button" onClick={() => void handleAnalyze()} disabled={isAnalyzing} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-60">
                      {isAnalyzing ? <Spinner className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />} {isAnalyzing ? 'Analiz ediliyor…' : 'Analiz et'}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Görsel analizi, kelime havuzundaki gerçek Etsy puanları ve mağaza bilgilerinizle yeni başlık, etiket ve açıklama yazılır ve puanlanır. Etsy&apos;ye yalnızca siz gönderince gider.
                    </p>
                    {hasSuggestion && improvementScore !== null && (
                      <p className="flex items-center gap-2 text-xs font-bold">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200">Şimdi {score}</span>
                        <span className="text-slate-400">→</span>
                        <span className={`px-2 py-0.5 rounded-lg ${improvementScore > score ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'}`}>Öneri {improvementScore}</span>
                      </p>
                    )}
                    {hasSuggestion && (
                      <div className="text-xs space-y-1 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-500/30">
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{listing.ai_optimized_title}</p>
                        <p className="text-slate-500 dark:text-slate-400">{suggestionTags.join(' · ')}</p>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => void handleOptimize()} disabled={isOptimizing} className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-60">
                        {isOptimizing ? <Spinner className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                        {isOptimizing ? 'Hazırlanıyor (1-2 dk)…' : hasSuggestion ? 'Yeniden öner' : 'Öneri oluştur'}
                      </button>
                      {hasSuggestion && (
                        <button type="button" onClick={applySuggestion} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">
                          Öneriyi forma uygula
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Düzenleme formu */}
              <div className="space-y-3">
                <label className="block">
                  <span className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Başlık <span className="font-mono font-normal text-slate-400">{editTitle.length}/140</span></span>
                  <textarea rows={2} maxLength={140} value={editTitle} onChange={(e) => setEditTitle(e.target.value.replace(/\n/g, ' '))} className={`${inputClass} resize-none`} />
                </label>
                <div>
                  <span className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Etiketler <span className="font-mono font-normal text-slate-400">{editTags.length}/13</span></span>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {editTags.map((tag, i) => (
                      <span key={`${tag}-${i}`} className="inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-[11px] font-semibold text-indigo-800 dark:text-indigo-200">
                        {tag}
                        <button type="button" aria-label={`${tag} etiketini kaldır`} onClick={() => setEditTags(editTags.filter((_, j) => j !== i))} className="p-0.5"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                  {editTags.length < 13 && (
                    <input
                      value={newTagInput}
                      maxLength={20}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(newTagInput); } }}
                      onBlur={() => addTag(newTagInput)}
                      placeholder="Etiket yazıp Enter'a basın (en fazla 20 karakter)"
                      className={inputClass}
                    />
                  )}
                  {(evaluation.missingPoolKeywords?.length ?? 0) > 0 && editTags.length < 13 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-slate-500">Havuzdan öneri:</span>
                      {evaluation.missingPoolKeywords!.filter((k) => !editTags.includes(k.keyword)).slice(0, 6).map((k) => (
                        <button key={k.keyword} type="button" onClick={() => addTag(k.keyword)} className="px-2 py-1 rounded-lg border border-emerald-300 dark:border-emerald-500/40 text-[11px] text-emerald-700 dark:text-emerald-300">
                          + {k.keyword} <span className="font-mono">{k.opportunityScore}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <label className="block">
                  <span className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Açıklama <span className="font-mono font-normal text-slate-400">{editDescription.length}</span></span>
                  <textarea rows={9} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className={`${inputClass} leading-relaxed`} />
                </label>
              </div>

              {/* Yayın durumu: metin güncellemesinden bağımsız, onaylı işlem */}
              <div className={`${cardClass} space-y-2`}>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span><b className="text-slate-700 dark:text-slate-300">Durum:</b> {STATE_LABELS[listing.state || ''] || listing.state || 'Bilinmiyor'}</span>
                  {listing.state === 'active' && stateAction === 'idle' && (
                    <button type="button" onClick={() => setStateAction('confirm-deactivate')} className="px-3 py-1.5 rounded-lg border border-amber-500/40 text-amber-700 dark:text-amber-300 font-semibold">Yayından kaldır…</button>
                  )}
                  {listing.state === 'inactive' && stateAction === 'idle' && livePublishEnabled && (
                    <button type="button" onClick={() => setStateAction('confirm-activate')} className="px-3 py-1.5 rounded-lg border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-semibold">Yeniden yayına al…</button>
                  )}
                </div>
                {stateAction === 'confirm-deactivate' && (
                  <div role="alertdialog" aria-label="Yayından kaldırma onayı" className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
                    <span className="text-xs text-amber-800 dark:text-amber-200 flex-1 min-w-[180px]">İlan mağazanızda görünmez olacak ve satışa kapanacak. Emin misiniz?</span>
                    <button type="button" onClick={() => setStateAction('idle')} className="px-3 py-1.5 text-xs rounded-lg bg-slate-100 dark:bg-slate-800">Vazgeç</button>
                    <button type="button" onClick={() => void handleChangeState('inactive')} disabled={isChangingState} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-600 text-white disabled:opacity-50">
                      {isChangingState ? 'Kaldırılıyor…' : 'Evet, kaldır'}
                    </button>
                  </div>
                )}
                {stateAction === 'confirm-activate' && (
                  <div role="alertdialog" aria-label="Yayına alma onayı" className="space-y-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                    <p className="text-xs text-emerald-800 dark:text-emerald-200">İlan yeniden satışa açılır ve Etsy listeleme ücreti alınabilir. Onaylamak için <b>{LIVE_PUBLISH_CONFIRMATION}</b> yazın.</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <input value={activationPhrase} onChange={(e) => setActivationPhrase(e.target.value)} placeholder={LIVE_PUBLISH_CONFIRMATION} aria-label="Onay ifadesi" className={`${inputClass} w-32`} />
                      <button type="button" onClick={() => setStateAction('idle')} className="px-3 py-1.5 text-xs rounded-lg bg-slate-100 dark:bg-slate-800">Vazgeç</button>
                      <button type="button" onClick={() => void handleChangeState('active')} disabled={isChangingState || activationPhrase.trim() !== LIVE_PUBLISH_CONFIRMATION} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 text-white disabled:opacity-50">
                        {isChangingState ? 'Yayına alınıyor…' : 'Yayına al'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Alt çubuk: gönderim yalnızca düzenlemede */}
        {tab === 'improve' && (
          <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center gap-2">
            <span className="flex-1 text-[11px] text-slate-500">{changedFields.length > 0 ? `Değişen: ${changedFields.join(', ')}` : 'Değişiklik yok'}</span>
            <button
              type="button"
              onClick={() => void handlePushToEtsy()}
              disabled={isUpdatingEtsy || isDetailLoading || changedFields.length === 0}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
            >
              {isUpdatingEtsy ? <Spinner className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />} {isUpdatingEtsy ? 'Gönderiliyor…' : "Etsy'de güncelle"}
            </button>
          </div>
        )}
      </DialogPanel>
    </div>
  );
};
