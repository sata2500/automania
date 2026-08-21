import {
  Activity,
  FolderTree,
  Layers,
  Palette,
  RotateCcw,
  Server,
  Settings,
  Sparkles,
  Trash2,
} from 'lucide-react';

type SampleStats = {
  mockupsCount: number;
  designsCount: number;
  foldersCount: number;
};

type DbHealthResult = {
  ok: boolean;
  latencyMs: number;
};

export type AdminSettingsSectionProps = {
  sampleStats: SampleStats | null;
  isUpdatingSampleData: boolean;
  onSetMyWorkspaceAsSampleData: () => void;
  onResetSampleData: () => void;
  isTestingDb: boolean;
  dbHealthResult: DbHealthResult | null;
  onTestDatabaseHealth: () => void;
  onPurgeSystemJunkData: () => void;
};

export function AdminSettingsSection({
  sampleStats,
  isUpdatingSampleData,
  onSetMyWorkspaceAsSampleData,
  onResetSampleData,
  isTestingDb,
  dbHealthResult,
  onTestDatabaseHealth,
  onPurgeSystemJunkData,
}: AdminSettingsSectionProps) {
  return (
    <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 space-y-4 sm:space-y-6 shadow-sm animate-fadeIn">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Uygulama Ayarları &amp; Veritabanı Bakımı</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Veritabanı eşitleme, önbellek temizliği ve fabrika sıfırlama araçları.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2 p-5 bg-gradient-to-br from-indigo-50/60 via-purple-50/40 to-white dark:from-indigo-950/40 dark:via-purple-950/20 dark:to-slate-900 rounded-2xl border border-indigo-200/80 dark:border-indigo-800/60 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">Genel Örnek Taslak &amp; Şablon Kütüphanesi</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Tüm kullanıcıların &quot;Örnek Taslağı Yükle&quot; dediğinde alacağı varsayılan mockup, tasarım ve klasör veri setini yönetin.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-indigo-100 dark:border-indigo-800/60 rounded-lg text-[11px] font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5 shadow-2xs">
                <Layers className="w-3.5 h-3.5 text-indigo-500" />
                <span>{sampleStats?.mockupsCount ?? '...'} Mockup</span>
              </div>
              <div className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-purple-100 dark:border-purple-800/60 rounded-lg text-[11px] font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1.5 shadow-2xs">
                <Palette className="w-3.5 h-3.5 text-purple-500" />
                <span>{sampleStats?.designsCount ?? '...'} Tasarım</span>
              </div>
              <div className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 shadow-2xs">
                <FolderTree className="w-3.5 h-3.5 text-slate-500" />
                <span>{sampleStats?.foldersCount ?? '...'} Klasör</span>
              </div>
            </div>
          </div>

          <div className="p-3.5 bg-white/80 dark:bg-slate-950/60 rounded-xl border border-indigo-100 dark:border-indigo-900/40 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            <p>
              <strong>Nasıl Çalışır?</strong> Kendi admin hesabınızda hazırladığınız mockup&apos;ları, baskı alanlarını, videoları ve tasarımları tek tıkla sistemin genel örnek şablonu haline getirebilirsiniz. Bu işlem eski örnek taslağın üzerine yazar ve yeni sisteme dahil olan veya &quot;Örnek Taslağı Yükle&quot; butonuna basan tüm kullanıcılara sizin hazırladığınız bu seti sunar.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
            <button
              type="button"
              onClick={onSetMyWorkspaceAsSampleData}
              disabled={isUpdatingSampleData}
              className="w-full sm:w-auto flex-1 py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-600/20 disabled:opacity-50"
            >
              <Sparkles className={`w-4 h-4 text-amber-300 ${isUpdatingSampleData ? 'animate-spin' : ''}`} />
              <span>{isUpdatingSampleData ? 'Örnek Taslak Güncelleniyor...' : 'Mevcut Çalışma Alanımı Genel Örnek Taslak Yap'}</span>
            </button>

            <button
              type="button"
              onClick={onResetSampleData}
              disabled={isUpdatingSampleData}
              className="w-full sm:w-auto py-3 px-4 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 font-semibold rounded-xl text-xs border border-slate-200 dark:border-slate-700 hover:border-rose-200 dark:hover:border-rose-800/60 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Örnek Taslağı Sıfırla</span>
            </button>
          </div>
        </div>

        <div className="p-5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
          <div className="flex items-center space-x-2">
            <Server className="w-5 h-5 text-indigo-500" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">PostgreSQL Sağlık &amp; Gecikme Testi (Ping)</h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            PostgreSQL veritabanı sunucusunun canlılık durumunu, tablo yapılarını ve yanıt gecikme süresini (ping ms) test edin.
          </p>
          <button
            type="button"
            onClick={onTestDatabaseHealth}
            disabled={isTestingDb}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-600/20 disabled:opacity-50"
          >
            <Activity className={`w-4 h-4 text-emerald-300 ${isTestingDb ? 'animate-spin' : ''}`} />
            <span>{isTestingDb ? 'Bağlantı Ölçülüyor...' : 'Veritabanı Sağlığını Test Et (Ping)'}</span>
          </button>

          {dbHealthResult && (
            <div role="status" className={`p-2.5 rounded-xl border text-[11px] font-medium flex items-center justify-between ${
              dbHealthResult.ok
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 text-emerald-700 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 text-rose-700 dark:text-rose-300'
            }`}>
              <span>{dbHealthResult.ok ? 'PostgreSQL Sunucusu Erişilebilir & Sağlıklı' : 'Bağlantı Hatası'}</span>
              <span className="font-mono font-bold">{dbHealthResult.latencyMs}ms</span>
            </div>
          )}
        </div>

        <div className="p-5 bg-rose-50/50 dark:bg-rose-950/30 rounded-2xl border border-rose-200/80 dark:border-rose-900/60 space-y-3">
          <div className="flex items-center space-x-2 text-rose-600 dark:text-rose-400">
            <Trash2 className="w-5 h-5" />
            <h3 className="text-xs font-bold">Veritabanı Çöp &amp; Artık Verilerini Temizle</h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            PostgreSQL veritabanındaki tüm yetkisiz test kayıtlarını ve çöp artıkları temizler. Sistemdeki hazır demo şablon kütüphanesi olduğu gibi muhafaza edilir.
          </p>
          <button
            type="button"
            onClick={onPurgeSystemJunkData}
            className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-rose-600/20"
          >
            <Trash2 className="w-4 h-4" />
            <span>Çöp Verileri Temizle (Örnek Şablonlar Korunur)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
