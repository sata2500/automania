# Automania POD

Etsy satıcıları için Print-on-Demand (POD) stüdyosu: mockup editörü, AI tasarım üretimi, toplu mockup render'ı, Etsy SEO asistanı, Etsy ilan yönetimi ve zamanlanmış otomasyon şablonları tek bir Next.js uygulamasında.

## Modüller

| Modül | Açıklama | Ana dosyalar |
|---|---|---|
| Mockup editörü | Mockup yükleme, baskı alanı tanımlama, klasörler | `src/components/mockup/` |
| Tasarımlar | Yükleme/optimizasyon (WebP), AI ile üretim, arka plan kaldırma, renk dönüştürme, AI analiz | `src/components/design/`, `src/app/api/designs/` |
| Toplu üretim | Mockup × tasarım eşleştirmelerini tarayıcıda canvas ile render etme, ZIP dışa aktarma | `src/components/generator/`, `src/lib/canvas-renderer.ts` |
| Etsy SEO stüdyosu | Başlık/açıklama/etiket üretimi, varyasyon matrisi, Etsy'ye taslak gönderme | `src/components/seo/`, `src/app/api/designs/generate-listing/`, `src/app/api/etsy/publish/` |
| İlan yönetimi | Etsy ilanlarını senkronize etme, SEO puanlama, AI optimizasyon | `src/components/listings/`, `src/app/api/etsy/listings/` |
| Otomasyon şablonları | Şablon bazlı tasarım + mockup üretimi; saatlik zamanlama | `src/components/templates/`, `src/lib/automation-runner.ts`, `src/app/api/cron/automation/` |
| Admin paneli | Ayarlar (şifreli anahtarlar), anahtar kelime havuzu, taksonomi, depolama bakımı | `src/components/admin/`, `src/app/api/admin/` |

## Mimari

```
Tarayıcı (React 19, IndexedDB önbellek, canvas render)
   │
   ▼
Next.js 16 (App Router)
   ├─ src/proxy.ts ............ CSP nonce, IP bazlı kaba istek sınırı
   ├─ src/app/api/** .......... Route handler'lar (her biri yetki kontrolü yapar)
   ├─ src/instrumentation.ts .. Yakalanmamış sunucu hatalarının raporlanması
   └─ src/lib/** .............. İş mantığı
        ├─ auth-server.ts ......... JWT oturum + veritabanından yetki doğrulama
        ├─ app-settings.ts ........ Ayarların tek okuma/yazma noktası (gizliler şifreli)
        ├─ secret-box.ts .......... AES-256-GCM şifreleme
        ├─ media-source.ts ........ Kullanıcı görsellerini sahiplik kontrolüyle okuma (SSRF yok)
        ├─ request-rate-limit.ts .. Upstash Redis destekli istek sınırlama
        └─ automation-runner.ts ... Otomasyon pipeline'ı
   │
   ├─ PostgreSQL (Neon) — Drizzle ORM, şema: src/db/schema.ts, migration'lar: drizzle/
   ├─ Cloudflare R2 — kullanıcı dosyaları (kullanıcıya özel önekli anahtarlar)
   ├─ Etsy OpenAPI v3 — OAuth (PKCE), ilan/stok işlemleri
   └─ Google Gemini / OpenRouter — görsel, metin ve video üretimi
```

## Kurulum

Gereksinimler: Node.js 22, bir PostgreSQL veritabanı (ör. Neon). R2, Etsy ve AI anahtarları ilgili özellikler için gereklidir.

```bash
npm ci
cp .env.example .env.local     # değerleri doldurun
npm run db:migrate             # veritabanı şemasını oluştur/güncelle
npm run seed-admin -- you@example.com   # bir kullanıcıyı admin yap (önce Google ile giriş yapın)
npm run dev
```

Uygulama `http://localhost:3000` adresinde açılır. Ortam değişkenlerinin tamamı ve açıklamaları `.env.example` dosyasındadır.

## Komutlar

| Komut | Açıklama |
|---|---|
| `npm run dev` | Geliştirme sunucusu (webpack) |
| `npm run build` / `npm start` | Production derleme / çalıştırma |
| `npm run type-check` | TypeScript kontrolü |
| `npm run lint` | ESLint |
| `npm test` | Vitest birim testleri (PGlite ile migration testleri dahil) |
| `npm run test:sqlite` | Yerel SQLite çalışma zamanı testi |
| `npm run test:e2e` | Playwright uçtan uca testleri (önce `npm run build`; `E2E_BASE_URL` ile çalışan bir sunucu da hedeflenebilir) |
| `npm run test:smoke` | Çalışan sunucuya karşı yetkisiz erişim testleri (`SMOKE_BASE_URL`) |
| `npm run verify` | type-check + test + sqlite + build |
| `npm run db:migrate` | `drizzle/` altındaki migration'ları uygular |
| `npm run db:generate -- --name <ad>` | `src/db/schema.ts` değişikliğinden yeni migration üretir |
| `npm run db:encrypt-secrets` | Mevcut düz metin gizli değerleri şifreler (`-- --apply` ile yazar) |
| `npm run db:inspect-schema` | Production şemasını salt-okunur denetler |

## Veritabanı değişiklikleri

1. `src/db/schema.ts` dosyasını güncelleyin.
2. `npm run db:generate -- --name kisa-aciklama` ile `drizzle/` altında migration üretin ve SQL'i gözden geçirin.
3. `npm run db:migrate` ile uygulayın. Testler (`src/db/migrations.test.ts`) migration'ların boş ve eski şemalı veritabanlarında tekrar tekrar uygulanabildiğini doğrular.

İstek sırasında tablo/kolon oluşturan kod yoktur; şema yalnızca migration'larla değişir.

## Güvenlik notları

- Her API route'u bir yetki kontrolü içermek zorundadır; `src/app/api/route-auth.test.ts` bunu tüm route'lar için otomatik doğrular.
- Etsy token'ları ve admin API anahtarları `DATA_ENCRYPTION_KEY` ile şifreli saklanır. Mevcut kurulumlarda anahtarı ekledikten sonra `npm run db:encrypt-secrets -- --apply` çalıştırın.
- Sunucu, kullanıcıdan gelen görsel adreslerini doğrudan indirmez; yalnızca kullanıcının kendi depolama dosyalarını, paketli demo görsellerini ve izin verilen alan adlarını (Etsy CDN vb.) okur.
- İçerik Güvenlik Politikası (CSP) her istekte üretilen nonce ile uygulanır.

### Etsy canlı yayın güvenliği

Canlı yayın varsayılan olarak kapalıdır. Açmak için hem `ETSY_LIVE_PUBLISH_ENABLED=true` (sunucu) hem `NEXT_PUBLIC_ETSY_LIVE_PUBLISH_ENABLED=true` (istemci) gerekir; değişiklikten sonra yeniden deploy edin.

Uygulama ilanı her zaman önce taslak (draft) olarak oluşturur. Canlıya alma ancak kullanıcı `YAYINLA` yazarak açıkça onayladığında, ön kontroller geçtiğinde, en az bir görsel yüklendiğinde ve stok/medya adımları engelleyici hata vermediğinde yapılır. Yayın yalnızca kullanıcının kendi Etsy bağlantısıyla yapılır; ortamdaki genel bir token'a asla düşülmez.

Geliştirme ve CI ortamlarında bu bayrağı açmayın; testler yalnızca mock kullanır.

## Zamanlanmış otomasyon

Şablon zamanlamaları saat bazındadır ve `GET /api/cron/automation` uç noktası saatte bir çağrılmalıdır (`Authorization: Bearer <CRON_SECRET>`). Vercel Hobby planı yalnızca günlük cron desteklediğinden depo, saatlik bir GitHub Actions iş akışı içerir (`.github/workflows/scheduled-automation.yml`). Etkinleştirmek için repository secret olarak `AUTOMATION_APP_URL` ve `CRON_SECRET` ekleyin. `INTERNAL_API_TOKEN` tanımlıysa her çalıştırma ayrı bir fonksiyon çağrısında yürütülür.

## Anahtar kelime değerlendirme ve medya işleme

Başarıyla değerlendirilen anahtar kelime metrikleri yedi gün yeniden kullanılır. Sağlayıcı hataları; hata türü, yeniden denenebilirlik ve bekleme süresiyle birlikte saklanır, geçerli bir fırsat puanı gibi değerlendirilmez. Admin değerlendiricisi seçimleri en fazla 20'lik gruplar halinde gönderir.

Tasarım ve mockup görselleri kaydedilmeden önce tarayıcıda en fazla 2000 piksele küçültülür ve tarayıcı destekliyorsa WebP olarak dışa aktarılır; desteklemiyorsa kullanıcıya bildirilir.

## Dağıtım (Vercel)

1. `.env.example` içindeki değişkenleri Vercel proje ayarlarına ekleyin (en azından `DATABASE_URL`, `JWT_SECRET`, `DATA_ENCRYPTION_KEY`, Google OAuth ve R2).
2. Google OAuth ve Etsy uygulamalarında geri dönüş adreslerini kaydedin: `https://<alan-adı>/api/auth/google/callback` ve `https://<alan-adı>/api/etsy/callback`.
3. Her deploy öncesinde veya sonrasında `npm run db:migrate` çalıştırın.
4. GitHub Actions CI (`.github/workflows/ci.yml`) her PR'da type-check, lint, birim testleri, bağımlılık denetimi, build ve Playwright E2E testlerini çalıştırır.
