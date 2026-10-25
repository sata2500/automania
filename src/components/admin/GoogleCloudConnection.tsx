'use client';

/**
 * Google AI bağlantı yöntemi: AI Studio API anahtarı veya Google Cloud hizmet hesabı (Vertex AI).
 * Hizmet hesabı JSON dosyası yüklendiğinde sunucu Google'a bağlanıp doğrular; anahtar şifreli saklanır
 * ve tarayıcıya hiçbir zaman geri gönderilmez.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Cloud, Upload, CheckCircle2, AlertTriangle, Trash2, ChevronDown } from 'lucide-react';
import { useToast } from '@/components/common/ToastContext';
import { useConfirmDialog } from '@/components/common/useConfirmDialog';
import { VERTEX_LOCATIONS, type GoogleModelCategory, type GoogleModelInfo } from '@/lib/google-cloud-credentials';
import { Spinner } from '@/components/common/Spinner';

export type GoogleCloudStatus = {
  mode: 'api_key' | 'vertex';
  location: string;
  serviceAccount: { projectId: string; clientEmail: string } | null;
  hasApiKey: boolean;
  encryptionConfigured: boolean;
};

export function GoogleCloudConnectionCard({ onChanged }: { onChanged?: (status: GoogleCloudStatus) => void }) {
  const toast = useToast();
  const { confirm, confirmDialog } = useConfirmDialog();
  const [status, setStatus] = useState<GoogleCloudStatus | null>(null);
  const [location, setLocation] = useState('global');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onChangedRef = useRef(onChanged);
  useEffect(() => { onChangedRef.current = onChanged; });

  const applyStatus = (next: GoogleCloudStatus) => {
    setStatus(next);
    setLocation(next.location);
    onChangedRef.current?.(next);
  };

  useEffect(() => {
    fetch('/api/admin/google-cloud')
      .then((res) => res.json())
      .then((data) => { if (data.success) applyStatus(data.status); })
      .catch(() => setError('Google Cloud bağlantı durumu okunamadı.'));
  }, []);

  const save = async (payload: { serviceAccountJson?: string; mode: 'vertex' | 'api_key'; location?: string }) => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/google-cloud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location, ...payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Kaydedilemedi.');
      applyStatus(data.status);
      toast.success(payload.mode === 'vertex'
        ? `Google Cloud bağlantısı doğrulandı${typeof data.modelCount === 'number' ? ` (${data.modelCount} model erişilebilir)` : ''}.`
        : 'Google bağlantısı API anahtarı yöntemine alındı.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kaydedilemedi.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 20_000) {
      setError('Dosya çok büyük; hizmet hesabı JSON anahtarı birkaç KB olmalıdır.');
      return;
    }
    const text = await file.text();
    await save({ serviceAccountJson: text, mode: 'vertex' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemove = async () => {
    if (!(await confirm({
      title: 'Hizmet hesabını kaldır',
      message: 'Google Cloud hizmet hesabı anahtarı silinecek ve Google çağrıları API anahtarı yöntemine dönecek. Devam edilsin mi?',
      confirmText: 'Kaldır',
    }))) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/google-cloud', { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Silinemedi.');
      applyStatus(data.status);
      toast.success('Hizmet hesabı anahtarı silindi.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Silinemedi.');
    } finally {
      setIsSaving(false);
    }
  };

  const isVertex = status?.mode === 'vertex';

  return (
    <div className="p-4 rounded-2xl border border-sky-200 dark:border-sky-900/60 bg-sky-50/40 dark:bg-sky-950/20 space-y-3">
      {confirmDialog}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Cloud className="w-4 h-4 text-sky-600 shrink-0" />
          <div>
            <p className="text-xs font-bold text-slate-900 dark:text-white">Google bağlantı yöntemi</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Gemini, Imagen ve Veo çağrıları bu yöntemle yapılır.</p>
          </div>
        </div>
        {status && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border self-start sm:self-center ${isVertex ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'}`}>
            {isVertex ? 'Aktif: Google Cloud (Vertex AI)' : 'Aktif: API anahtarı (AI Studio)'}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Google bağlantı yöntemi">
        <button
          type="button"
          role="radio"
          aria-checked={!isVertex}
          disabled={isSaving || !status}
          onClick={() => save({ mode: 'api_key' })}
          className={`text-left p-3 rounded-xl border text-xs transition-all disabled:opacity-60 ${!isVertex ? 'border-sky-400 bg-white dark:bg-slate-900 ring-2 ring-sky-500/20' : 'border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60'}`}
        >
          <span className="font-bold text-slate-900 dark:text-white">API anahtarı (AI Studio)</span>
          <span className="block text-[11px] text-slate-500 mt-0.5">Yukarıdaki &quot;Google Gemini API Key&quot; kullanılır.</span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={isVertex}
          disabled={isSaving || !status || !status.serviceAccount}
          onClick={() => save({ mode: 'vertex' })}
          title={!status?.serviceAccount ? 'Önce hizmet hesabı JSON dosyasını yükleyin' : undefined}
          className={`text-left p-3 rounded-xl border text-xs transition-all disabled:opacity-60 ${isVertex ? 'border-emerald-400 bg-white dark:bg-slate-900 ring-2 ring-emerald-500/20' : 'border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60'}`}
        >
          <span className="font-bold text-slate-900 dark:text-white">Google Cloud hizmet hesabı (Vertex AI)</span>
          <span className="block text-[11px] text-slate-500 mt-0.5">Kullanım Google Cloud kredinizden/faturanızdan düşer.</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-end">
        <div className="space-y-1">
          <label htmlFor="gcp-location" className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">Vertex AI bölgesi</label>
          <select
            id="gcp-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
          >
            {VERTEX_LOCATIONS.map((loc) => <option key={loc.id} value={loc.id}>{loc.label}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            id="gcp-key-file"
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
          <label
            htmlFor="gcp-key-file"
            className={`inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold cursor-pointer focus-within:ring-2 focus-within:ring-sky-400 ${isSaving ? 'opacity-60 pointer-events-none' : ''}`}
          >
            {isSaving ? <Spinner className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
            {status?.serviceAccount ? 'Yeni JSON yükle' : 'JSON anahtarını yükle'}
          </label>
          {status?.serviceAccount && (
            <button
              type="button"
              onClick={() => save({ mode: isVertex ? 'vertex' : 'api_key', location })}
              disabled={isSaving || location === status.location}
              className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 disabled:opacity-50"
            >
              Bölgeyi kaydet
            </button>
          )}
        </div>
      </div>

      {status?.serviceAccount && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px]">
          <div className="min-w-0 flex items-start gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-px" />
            <span className="min-w-0 break-all">
              Proje: <strong>{status.serviceAccount.projectId}</strong> · Hesap: <span className="font-mono">{status.serviceAccount.clientEmail}</span>
            </span>
          </div>
          <button type="button" onClick={handleRemove} disabled={isSaving} className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-bold shrink-0 disabled:opacity-50">
            <Trash2 className="w-3.5 h-3.5" /> Kaldır
          </button>
        </div>
      )}

      {status && !status.encryptionConfigured && (
        <p className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
          Sunucuda DATA_ENCRYPTION_KEY tanımlı değil; anahtar veritabanında şifrelenmeden saklanır. Vercel ortam değişkenlerine en az 32 karakterlik bir değer ekleyin.
        </p>
      )}
      {error && <p role="alert" className="text-[11px] text-red-600 dark:text-red-400 break-words">{error}</p>}

      <details className="text-[11px] text-slate-600 dark:text-slate-300">
        <summary className="cursor-pointer font-bold inline-flex items-center gap-1"><ChevronDown className="w-3 h-3" />JSON anahtarını nasıl alırım?</summary>
        <ol className="mt-2 list-decimal pl-5 space-y-1">
          <li>Google Cloud Console&apos;da projenizi seçin ve faturalandırma hesabına (ücretsiz deneme kredisi) bağlı olduğundan emin olun.</li>
          <li>&quot;API&apos;ler ve Hizmetler&quot; bölümünden <strong>Vertex AI API</strong>&apos;yi etkinleştirin.</li>
          <li>IAM ve Yönetici › Hizmet Hesapları › Hizmet hesabı oluştur. Role olarak <strong>Vertex AI User</strong> (roles/aiplatform.user) verin.</li>
          <li>Hesabın &quot;Anahtarlar&quot; sekmesinde Anahtar ekle › Yeni anahtar oluştur › <strong>JSON</strong> seçin; inen dosyayı buraya yükleyin.</li>
          <li>Yükleme sırasında bağlantı Google&apos;a karşı doğrulanır; başarılı olursa Gemini modelleri aşağıda Google&apos;dan güncel olarak listelenir.</li>
        </ol>
        <p className="mt-2">Not: &quot;Global&quot; bölge en yeni Gemini modellerini destekler. Imagen ve Veo modelleri için otomatik olarak us-central1 kullanılır.</p>
      </details>
    </div>
  );
}

const CATEGORY_LABELS: Record<GoogleModelCategory, string> = {
  text: 'Google\'dan güncel liste (metin ve görsel analiz)',
  image: 'Google\'dan güncel liste (görsel üretim)',
  video: 'Google\'dan güncel liste (video)',
};

/** Seçim kutusu için Google'dan çekilen güncel model seçenekleri; kayıtlı model listede yoksa da gösterilir. */
export function GoogleModelOptions({ models, category, current }: { models: GoogleModelInfo[]; category: GoogleModelCategory; current: string }) {
  const filtered = models.filter((m) => m.category === category);
  const hasCurrent = !current || filtered.some((m) => m.id === current);
  return (
    <>
      {!hasCurrent && (
        <optgroup label="Kayıtlı model">
          <option value={current}>{current} (listede yok)</option>
        </optgroup>
      )}
      <optgroup label={`${CATEGORY_LABELS[category]} · ${filtered.length}`}>
        {filtered.map((m) => (
          <option key={m.id} value={m.id}>{m.displayName === m.id ? m.id : `${m.displayName} (${m.id})`}</option>
        ))}
      </optgroup>
    </>
  );
}
