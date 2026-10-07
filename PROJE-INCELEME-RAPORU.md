# Automania — Proje İnceleme ve Geliştirme Raporu

**Tarih:** 7 Ekim 2026
**İncelenen revizyon:** `b4c9b35` (feat: AI-driven Etsy listing generation…)
**Kapsam:** `src/` altındaki ~39.300 satır TypeScript/TSX, API route'ları, veritabanı şeması, yapılandırma dosyaları ve depo kökündeki yardımcı script'ler.

---

## 1. Yönetici Özeti

Automania; mockup editörü, AI tasarım üretimi, toplu (batch) render, Etsy SEO asistanı, Etsy ilan yönetimi ve "kur ve unut" otomasyon şablonlarını tek bir Next.js 16 uygulamasında birleştiren, kapsamlı ve iddialı bir POD (Print-on-Demand) platformu. Önceki sertleştirme (hardening) fazında oturum yönetimi, IDOR, upload doğrulaması ve admin yetkilendirmesi gibi konularda ciddi ilerleme kaydedilmiş; tip kontrolü ve birim testleri yeşil.

Ancak bu fazdan **sonra eklenen yeni özelliklerin (otomasyon, AI tasarım üretimi, arka plan kaldırma/yeniden renklendirme) aynı güvenlik standardına çekilmediği** görülüyor. En acil konular:

| # | Bulgu | Önem |
|---|---|---|
| 1 | `/api/automation/execute` için `INTERNAL_API_TOKEN` tanımlı değilse herkesin bildiği `'dev-internal'` değerine düşülüyor → herhangi biri, herhangi bir kullanıcı adına AI üretimi tetikleyebilir | 🔴 Kritik |
| 2 | `/api/designs/remove-bg` ve `/api/designs/recolor` kullanıcıdan gelen herhangi bir URL'yi sunucudan çekiyor (SSRF) ve isteğe **kullanıcının oturum çerezini ekleyerek** gönderiyor | 🔴 Kritik |
| 3 | Maliyetli AI uç noktalarında (`designs/generate`, `remove-bg`, `recolor`, `automation/run`) rate limit/kota yok | 🟠 Yüksek |
| 4 | Otomasyon "fire-and-forget" `fetch` ile başlatılıyor; Vercel serverless'ta yanıt döndükten sonra istek hiç gönderilmeyebilir | 🟠 Yüksek |
| 5 | Etsy access/refresh token'ları ve kullanıcı OpenRouter anahtarları veritabanında düz metin | 🟠 Yüksek |
| 6 | `next@16.3.2` için kritik, `sharp` ve `undici` için yüksek seviyeli bilinen güvenlik açıkları (`npm audit`) | 🟠 Yüksek |
| 7 | Rate limiting bellek içi (in-memory) — serverless ortamda instance'lar arası paylaşılmıyor | 🟡 Orta |

Kod kalitesi tarafında; çok büyük bileşenler (2.220 satırlık `AdminDashboard.tsx`, 1.487 satırlık `EtsySeoContext.tsx`), yüzlerce `any` kullanımı, Drizzle şeması ile gerçek veritabanı arasındaki uyumsuzluk, CI eksikliği ve depo kökünde biriken tek seferlik script'ler öne çıkan teknik borçlardır.

---

## 2. Mevcut Durum (Ölçümler)

| Kontrol | Komut | Sonuç |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | ✅ Hatasız |
| Birim testleri | `npx vitest run` | ✅ 18 dosya, 44/44 test geçti |
| ESLint | `npx eslint` | ❌ 514 sorun (314 hata, 200 uyarı) — önceki raporda 465'ti, borç artıyor |
| Bağımlılık denetimi | `npm audit --omit=dev` | ❌ 7 açık: 1 kritik (`next` 16.0.0–16.3.5), 6 yüksek (`sharp`, `undici`, `brace-expansion`, `browserslist`, `source-map-js`) |
| CI (GitHub Actions) | — | ❌ Yok (`.github/` dizini bulunmuyor) |

Önceki rapora (`RELEASE-DECISION-REPORT.md`) göre test sayısı 20'den 44'e çıkmış; bu olumlu bir gelişme. Testler ağırlıklı olarak `src/lib` altındaki saf yardımcıları ve birkaç route'u kapsıyor; otomasyon, AI üretimi ve bileşenler için test yok.

---

## 3. Güvenlik Bulguları

### 3.1 🔴 Otomasyon iç uç noktasında tahmin edilebilir varsayılan token

`src/app/api/automation/execute/route.ts:21-25`

```ts
const internalToken = req.headers.get('X-Internal-Token');
const expectedToken = process.env.INTERNAL_API_TOKEN ?? 'dev-internal';
if (internalToken !== expectedToken) { ... }
const { runId, templateId, userId } = await req.json();
```

`INTERNAL_API_TOKEN` production'da tanımlanmamışsa, `X-Internal-Token: dev-internal` başlığı gönderen herkes istediği `userId` ile çalıştırma yapabilir. Bu uç nokta admin'in global AI anahtarıyla görsel üretiyor ve R2'ye yazıyor; yani **doğrudan maliyet ve veri bütünlüğü riski** var. Ayrıca bu route oturum doğrulaması da yapmıyor.

**Öneri:**
- `JWT_SECRET`'te yapıldığı gibi production'da token yoksa uç noktayı tamamen kapatın (fallback yok).
- Karşılaştırmayı `crypto.timingSafeEqual` ile yapın.
- Kalıcı çözüm: HTTP ile kendi kendini çağırmak yerine işi `after()` ile aynı istek içinde ya da bir kuyruk (Vercel Queues, QStash, Inngest vb.) üzerinden çalıştırın; böylece dışarıya açık bir "iç" uç noktaya hiç gerek kalmaz.

### 3.2 🔴 `remove-bg` / `recolor` uç noktalarında SSRF + çerez sızıntısı

`src/app/api/designs/remove-bg/route.ts:44-58`, `src/app/api/designs/recolor/route.ts:35-46`

```ts
const absoluteUrl = imageUrl.startsWith('/') ? new URL(imageUrl, req.nextUrl.origin).href : imageUrl;
const cookieStr = req.headers.get('cookie');
if (cookieStr) fetchHeaders['cookie'] = cookieStr;
const imageRes = await fetch(absoluteUrl, { headers: fetchHeaders });
```

Sorunlar:
1. **SSRF:** Kullanıcı `imageUrl` olarak herhangi bir adres (iç ağ, bulut metadata servisi vb.) verebilir; sunucu bu adrese istek atar.
2. **Oturum çerezi sızıntısı:** Çerez, mutlak harici URL'lere de gönderiliyor. Bir saldırgan kurbanın çalışma alanına (ör. içe aktarılan yedek dosyası veya paylaşılan bir şablon üzerinden) kendi sunucusunu gösteren bir görsel URL'si sokarsa, kurbanın `auth_token` çerezi saldırganın sunucusuna gider → **hesap ele geçirme**.
3. **Boyut sınırı yok:** Yanıt tamamen belleğe alınıyor; çok büyük bir dosya fonksiyonu çökertebilir.

**Öneri:**
- Çerezi yalnızca aynı origin'e (göreli `/api/r2/...`, `/api/uploads/...`) yapılan isteklerde ekleyin; daha iyisi, bu durumda HTTP isteği yerine R2/storage katmanından doğrudan okuyun.
- Harici URL'leri ya tamamen reddedin ya da bir allowlist ile (R2 public domain, Etsy CDN) sınırlayın. `ai/proxy` route'unda zaten bir allowlist deseni var; aynı yardımcıyı ortaklaştırın.
- `Content-Length` ve akış sırasında okunan bayt sayısı ile üst sınır (ör. 20 MB) koyun, `Content-Type`'ın `image/*` olduğunu doğrulayın, `AbortSignal.timeout()` ekleyin.

### 3.3 🟠 Maliyetli uç noktalarda rate limit yok

`consumeRateLimit` yalnızca şu route'larda kullanılıyor: `ai/proxy`, `designs/analyze`, `designs/generate-listing`, `etsy/listings/*`, `etsy/publish`, admin keyword route'ları.

Kullanılmayanlar: **`designs/generate`** (istek başına 4 görsele kadar), **`designs/remove-bg`**, **`designs/recolor`**, **`automation/run`**, `templates/*`.

**Öneri:** Kullanıcı başına dakikalık limit + günlük kota (ör. `job_runs` tablosundan sayılarak) ekleyin. Görsel üretimi en pahalı işlem olduğu için önceliklidir.

### 3.4 🟠 Yetki kontrolünde tutarsızlık (`getSession` vs `getAuthoritativeSession`)

13 route hâlâ yalnızca JWT içeriğine güvenen `getSession()` kullanıyor (`designs/generate`, `designs/remove-bg`, `designs/recolor`, `automation/run`, `templates/*`, `workspace/variation-templates`). JWT 7 gün geçerli olduğundan, admin tarafından **engellenen bir kullanıcı bu süre boyunca AI üretmeye devam edebilir**.

**Öneri:** Tüm kullanıcı route'larını `getAuthoritativeSession()`'a geçirin. Tekrarı azaltmak için `withAuth(handler)` / `withAdmin(handler)` gibi bir sarmalayıcı yazın; böylece yeni route'larda unutulma ihtimali kalmaz. `scripts/smoke-unauthenticated.ts`'i, `src/app/api` altındaki tüm route'ları otomatik keşfedip 401 bekleyecek şekilde genişletin.

### 3.5 🟠 Gizli bilgilerin düz metin saklanması

- `user_workspaces.etsy_access_token`, `etsy_refresh_token` (`src/app/api/etsy/callback/route.ts:146`)
- `user_workspaces.openrouter_key`
- `user_etsy_shops.access_token`, `refresh_token`
- `app_settings` içindeki API anahtarları (maskeli dönülüyor ama düz metin saklanıyor)

Veritabanı yedeği veya okuma yetkili bir sızıntı, tüm kullanıcıların Etsy mağazalarına yazma erişimi anlamına gelir.

**Öneri:** Ortam değişkeninden alınan bir anahtarla AES-256-GCM uygulama seviyesinde şifreleme yapan küçük bir `secret-box.ts` yardımcısı ekleyin; okuma/yazmayı `etsy-token-manager.ts` ve settings katmanında merkezileştirin.

### 3.6 🟠 Bağımlılık açıkları

`npm audit --omit=dev` production bağımlılıklarında 7 açık raporluyor; önceki raporda bu sayı 0'dı, yani açıklar o tarihten sonra yayımlanmış. En önemlisi `next` 16.0.0–16.3.5 aralığındaki **kritik** açık; ayrıca `sharp <0.35.5` ve `undici` yüksek seviyede.

**Öneri:** `next` ve `eslint-config-next`'i en güncel 16.3.x yamasına, `sharp`'ı `^0.35.5`'e yükseltin, ardından `npm audit fix` çalıştırıp `npm run verify` ile doğrulayın. Dependabot veya Renovate ekleyerek bunun düzenli takip edilmesini sağlayın.

### 3.7 🟡 Etsy token yenileme yarış durumu

`src/lib/etsy-token-manager.ts` — süresi dolan token'ı aynı anda birden fazla istek yenilemeye çalışabilir. Etsy refresh token'ları tek kullanımlık olduğundan, bir isteğin yenilemesi diğerininkini geçersiz kılar ve kullanıcı "tekrar bağlanın" hatası alabilir.

**Öneri:** Yenilemeyi `UPDATE ... WHERE etsy_refresh_token = $eski RETURNING` ile koşullu yapın; satır dönmezse token'ı veritabanından yeniden okuyun.

### 3.8 🟡 Proxy (middleware) katmanı

`src/proxy.ts`:
- **Rate limit:** `x-forwarded-for` başlığının tamamı anahtar olarak kullanılıyor (istemci bu başlığa değer ekleyerek limiti atlatabilir) ve başlık yoksa limit tamamen devre dışı kalıyor. Map hiç temizlenmiyor (bellek büyümesi). Ayrıca serverless'ta her instance'ın kendi Map'i var.
- **CSP:** `script-src 'unsafe-inline' 'unsafe-eval' https: http:` ve `connect-src ... http: ws:` ile politika neredeyse etkisiz. Nonce üretiliyor ama hiçbir yerde kullanılmıyor.
- `export const middleware = proxy;` satırı Next.js 16'da gereksiz.

**Öneri:** Kalıcı rate limit için Upstash Redis / Vercel KV gibi paylaşımlı bir depo kullanın; IP için `request.ip` veya `x-forwarded-for`'un ilk değerini alın. CSP'yi nonce tabanlı hale getirip `'unsafe-eval'` ve `http:` kaynaklarını kaldırın (ffmpeg.wasm için `'wasm-unsafe-eval'` yeterli olabilir); önce `Content-Security-Policy-Report-Only` ile deneyin.

---

## 4. Mimari ve Güvenilirlik

### 4.1 Otomasyon pipeline'ı serverless için uygun değil

`src/app/api/automation/run/route.ts:81-92` `fetch(...)` çağrısını `await` etmeden yanıt dönüyor. Vercel'de fonksiyon yanıt döndüğünde dondurulabildiği için istek hiç gitmeyebilir. Ayrıca `execute` route'unda `maxDuration` tanımlı değil; görsel üretimi + arka plan kaldırma + render varsayılan süreyi aşabilir. Yanıt mesajındaki `/api/automation/poll/[runId]` uç noktası **mevcut değil**. Şemada `cronExpression` alanı olmasına rağmen zamanlanmış tetikleyici (Vercel Cron) yapılandırması yok.

**Öneri:**
1. Kısa vadede `next/server`'dan `after()` kullanın ve `execute` mantığını bir fonksiyona taşıyıp doğrudan çağırın.
2. Orta vadede adımları kuyruk tabanlı (her adım ayrı bir iş) hale getirin; böylece zaman aşımı ve yeniden deneme yönetilebilir olur. Zaten var olan `job_runs` / `job-service.ts` altyapısını kullanın.
3. `poll` uç noktasını ekleyin veya mesajı mevcut `/api/jobs/[jobId]`'e yönlendirin.
4. `vercel.json` ile cron tanımı ekleyip `CRON_SECRET` doğrulamalı bir `/api/cron/automation` route'u yazın.
5. Takılı kalan (`running` durumunda saatlerdir bekleyen) çalıştırmaları temizleyen bir mekanizma ekleyin.

### 4.2 Şema yönetimi dağınık

- Drizzle şeması (`src/db/schema.ts`) `user_workspaces` tablosundaki `etsy_access_token`, `etsy_refresh_token`, `etsy_shop_id`, `etsy_token_expires_at` gibi kolonları içermiyor; bu yüzden bu alanlara ham SQL ile erişiliyor ve tip güvenliği kayboluyor.
- Tablo oluşturma en az dört yerde tekrar ediyor: `create_table.mjs`, `src/app/api/setup/route.ts`, `src/lib/db.ts → ensureUserEtsyListingsTable()`, `src/lib/sqlite-runtime.ts`. `setup/route.ts` ve `db.ts` içindeki tanımlar birbirinden farklı.
- `user_etsy_listings` tablosunda `(user_id, listing_id)` için **unique kısıt yok**; senkronizasyon tekrarlandığında mükerrer satır riski var.
- Kullanıcı çalışma alanı (mockup/tasarım/klasör) tek bir satırda büyük JSONB dizileri olarak tutuluyor; her kayıtta tüm dizi yeniden yazılıyor. Kullanıcı başına öğe sayısı arttıkça hem performans hem çakışma (son yazan kazanır) sorunu büyüyecek.

**Öneri:** `drizzle-kit` ile migration dosyalarına geçin (`drizzle-kit generate` / `migrate`), eksik kolonları şemaya ekleyin, diğer tüm `CREATE TABLE` kopyalarını kaldırın. Uzun vadede `designs`, `mockups`, `folders` için ayrı tablolar oluşturun.

### 4.3 Hata yönetimi

- `GET /api/storage` hata durumunda **200 ile boş veri** dönüyor (`route.ts:68`). İstemci bunu "çalışma alanı boş" olarak yorumlayıp sonraki senkronizasyonda buluttaki verinin üzerine yazabilir. 5xx dönülmeli ve istemci bu durumda yazmayı durdurmalı.
- Birçok route `e.message`'ı doğrudan istemciye yansıtıyor (ör. OpenRouter hata gövdesi). İç ayrıntıları loglayıp istemciye genel mesaj dönün.
- Hatalar yalnızca `console.error` ile loglanıyor; Sentry gibi bir hata izleme aracı eklemek production sorunlarını görünür kılar.

---

## 5. Kod Kalitesi ve Bakım Kolaylığı

### 5.1 Çok büyük dosyalar

| Dosya | Satır |
|---|---:|
| `src/components/admin/AdminDashboard.tsx` | 2.220 |
| `src/components/seo/context/EtsySeoContext.tsx` | 1.487 (80 `useState`) |
| `src/components/admin/KeywordPoolManagement.tsx` | 1.208 |
| `src/components/listings/ListingDetailModal.tsx` | 1.104 |
| `src/lib/storage-service.ts` | 978 |
| `src/components/listings/EtsyListingManager.tsx` | 958 |
| `src/app/api/designs/analyze/route.ts` | 713 |
| `src/app/api/etsy/publish/route.ts` | 680 |

**Öneri:**
- `AdminDashboard.tsx`: zaten `AdminOverviewSection` / `AdminSettingsSection` ayrılmaya başlanmış; kalan sekmeleri de ayrı dosyalara taşıyın.
- `EtsySeoContext.tsx`: 80 `useState` tek bir context'te olduğunda her değişiklik tüm tüketicileri yeniden render eder. Durumu alanlara göre (`listingDraft`, `variations`, `publishing`) bölün veya `useReducer` / Zustand gibi bir store kullanın.
- Büyük API route'larında iş mantığını `src/lib/` altına taşıyın; route dosyası yalnızca doğrulama + yetki + çağrı yapsın. Bu aynı zamanda test edilebilirliği artırır.

### 5.2 Tip güvenliği

- `src/` altında **216** `any` / `as any` kullanımı var.
- İstek gövdeleri `as { ... }` ile doğrulanmadan tip atanıyor. `zod` (veya `valibot`) ile şema doğrulaması eklemek hem güvenliği hem hata mesajlarını iyileştirir.

### 5.3 Kullanılmayan / mükerrer bağımlılıklar

| Paket | Durum |
|---|---|
| `@google/generative-ai` | `src/` içinde kullanılmıyor; `@google/genai` ile mükerrer |
| `@vercel/postgres` | Kullanılmıyor (Neon kullanılıyor) |
| `@vercel/blob` | Yalnızca eski `scripts/` altında; R2'ye geçiş tamamlandıysa kaldırılabilir |
| `jimp` | Kullanılmıyor (`sharp` kullanılıyor) |
| `@types/canvas-confetti` | `devDependencies`'e taşınmalı |
| `eslint-config-next` (16.2.12) | `next` (16.3.2) ile aynı sürüme hizalanmalı |

### 5.4 Depo düzeni

Kök dizinde tek seferlik/deneme script'leri birikmiş: `refactor.js`, `fix_mime.js`, `temp_check_urls.js`, `query_temp.mjs`, `test.mjs`, `test_db.mjs`, `test_put_inventory.mjs`, `test_etsy_listings.mjs`, `test_etsy_readiness.mjs`, `fetch_inventory.mjs`, `get-etsy-data.js`, `add_columns.mjs`, `add_generated_mockups.mjs`; ayrıca `scratch/` altında 30 dosya. Bazıları canlı Etsy envanterine yazma (`test_put_inventory.mjs`) gibi riskli işlemler içeriyor.

**Öneri:** Gerekli olanları `scripts/` altına açıklayıcı isimlerle taşıyın, geri kalanını silin; `scratch/`'i `.gitignore`'a ekleyin. `public/sw.js` build çıktısı olduğu için `.gitignore`'a eklenmeli. `.gitignore`'daki tekrarlanan `.vercel` / `.env*` satırlarını temizleyin.

### 5.5 Dokümantasyon

`README.md` hâlâ `create-next-app` şablonu. Şunları içeren bir README faydalı olur: proje amacı ve modüller, mimari diyagramı, gerekli ortam değişkenlerinin tam listesi (`DATABASE_URL`, `JWT_SECRET`, `INTERNAL_API_TOKEN`, R2, Google OAuth, Etsy…) ve bir `.env.example` dosyası, yerel geliştirme (SQLite modu) ve deploy adımları.

---

## 6. Test ve CI/CD

- **CI yok.** `npm run verify` betiği hazır; bunu her PR'da çalıştıracak bir GitHub Actions iş akışı (type-check + test + lint + build) eklemek en düşük maliyetli kalite kazanımıdır.
- **Test kapsamı:** Güvenlik açısından kritik ama testsiz alanlar — `automation/*`, `designs/generate|remove-bg|recolor`, `templates/*`, `etsy-token-manager.ts`. Özellikle her route için "oturumsuz → 401", "başka kullanıcının kaynağı → 404/403" testleri eklenmeli.
- **E2E:** Ortamda Playwright mevcut; mockup yükleme → batch render → ZIP indirme gibi ana akış için birkaç smoke E2E testi regresyonları erken yakalar.
- **Lint:** Mevcut lint borcu nedeniyle CI'da lint'i önce yalnızca değişen dosyalara uygulayın (`eslint --max-warnings` ile kademeli azaltma) veya kuralları `warn` seviyesine çekip sayıyı düşürdükçe `error`'a yükseltin.

---

## 7. Performans ve Kullanıcı Deneyimi

- **Ana sayfa tamamen istemci bileşeni** (`src/app/page.tsx` → `'use client'`). Ağır modüller `dynamic()` ile ayrılmış (iyi), ancak sayfa kabuğu ve başlık sunucu bileşeni olarak render edilebilir.
- **JSONB çalışma alanı senkronizasyonu:** Her değişiklikte büyük payload'ların gönderilmesi mobilde yavaş ağlarda sorun yaratır. Değişen öğeleri (delta) göndermek veya öğe başına uç noktalar kullanmak önerilir.
- **Erişilebilirlik:** Sekmeler arası kaydırma (swipe) mantığı özel olarak yazılmış; klavye ile sekme gezintisi ve `aria-*` etiketleri gözden geçirilmeli.
- **Uluslararasılaştırma:** Arayüz metinleri bileşenlere gömülü Türkçe. Etsy pazarı küresel olduğundan, ileride İngilizce destek planlanıyorsa metinleri şimdiden bir sözlük dosyasına taşımak sonraki maliyeti düşürür.

---

## 8. Önceliklendirilmiş Yol Haritası

### Hemen (bu hafta)
1. `automation/execute` için `'dev-internal'` fallback'ini kaldırın; Vercel'de `INTERNAL_API_TOKEN`'ın tanımlı olduğunu doğrulayın. *(3.1)*
2. `remove-bg` ve `recolor`'da harici URL'lere çerez göndermeyi durdurun, URL allowlist'i ve boyut sınırı ekleyin. *(3.2)*
3. `designs/generate`, `remove-bg`, `recolor`, `automation/run` için rate limit ekleyin. *(3.3)*
4. Kullanıcı route'larını `getAuthoritativeSession()`'a geçirin. *(3.4)*
5. `next` ve `sharp`'ı yamalı sürümlere yükseltin, `npm audit fix` çalıştırın. *(3.6)*

### Kısa vade (1–3 hafta)
6. GitHub Actions ile `verify` iş akışı. *(6)*
7. Otomasyonu `after()` / kuyruk modeline taşıyın, `maxDuration` ve eksik `poll` uç noktasını ekleyin. *(4.1)*
8. Token ve API anahtarlarını şifreleyin; token yenileme yarışını giderin. *(3.5, 3.7)*
9. `GET /api/storage` hata yanıtını düzeltin. *(4.3)*
10. Kullanılmayan bağımlılıkları ve kök dizindeki geçici script'leri temizleyin. *(5.3, 5.4)*

### Orta vade (1–2 ay)
11. Drizzle migration'larına geçiş, şema uyumsuzluğunu giderme, `user_etsy_listings` unique kısıtı. *(4.2)*
12. Paylaşımlı rate limit deposu ve sıkılaştırılmış CSP. *(3.8)*
13. `zod` ile istek doğrulaması; `any` kullanımını azaltma. *(5.2)*
14. Büyük bileşenlerin ve `EtsySeoContext`'in bölünmesi. *(5.1)*
15. README, `.env.example`, hata izleme (Sentry). *(5.5, 4.3)*

### Uzun vade
16. Çalışma alanı verisini JSONB dizilerinden ayrı tablolara taşıma. *(4.2)*
17. Kuyruk tabanlı, yeniden denenebilir otomasyon adımları ve Vercel Cron ile zamanlama. *(4.1)*
18. E2E test kapsamı ve i18n altyapısı. *(6, 7)*

---

## 9. Güçlü Yönler

Raporun eleştirel tonu, projedeki iyi işleri gölgelememeli:

- JWT secret yönetimi örnek niteliğinde: production'da secret yoksa başlamıyor, minimum uzunluk zorunlu, algoritma sabitlenmiş, payload doğrulanıyor.
- `getAuthoritativeSession()` ile rol/durum bilgisinin veritabanından doğrulanması doğru bir tasarım.
- Upload güvenliği (magic-byte, MIME, boyut, kullanıcı önekli object key) ve R2 proxy'de sahiplik kontrolü sağlam.
- Etsy canlı yayın için çok katmanlı güvenlik (varsayılan taslak, ortam bayrağı, `YAYINLA` onayı, preflight) iyi düşünülmüş.
- Audit log'larda secret redaction mevcut.
- Bileşenlerin hook'lara ayrılmaya başlanması (`useDesignUpload`, `useMockupTransform`, `useBatchGenerator`) doğru yönde bir refactor.
- SQLite yerel çalışma modu, geliştiricilerin harici servis olmadan çalışabilmesini sağlıyor.
