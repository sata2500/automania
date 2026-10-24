'use client'; // Error boundaries must be Client Components

/**
 * Kök düzen (layout) hata verdiğinde gösterilir. Global stiller yüklenmediği için biçimlendirme satır içidir.
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error && 'digest' in error ? String((error as Error & { digest?: string }).digest || '') : '';
  return (
    <html lang="tr">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#0f172a', color: '#e2e8f0' }}>
        <title>Automania POD — Hata</title>
        <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div role="alert" style={{ maxWidth: 420, textAlign: 'center' }}>
            <h1 style={{ fontSize: 18, margin: '0 0 8px' }}>Uygulama yüklenemedi</h1>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 16px' }}>
              Verileriniz güvende. Lütfen tekrar deneyin; sorun sürerse sayfayı yenileyin.
            </p>
            {digest && <p style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>Hata kodu: {digest}</p>}
            <button
              type="button"
              onClick={() => retry()}
              style={{ padding: '8px 16px', borderRadius: 12, border: 0, background: '#4f46e5', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
            >
              Tekrar dene
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
