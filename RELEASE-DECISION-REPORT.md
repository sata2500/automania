# Automania POD — Yayın Kararına Hazır Sürüm Raporu

**Rapor tarihi:** 22 Ağustos 2026  
**İncelenen branch:** `hardening/phase-1-baseline`  
**İncelenen kod revizyonu:** `2f61c4b` — `test: harden local acceptance flows and vercel runtime`  
**Hedef canlı adres:** [https://automania-gamma.vercel.app](https://automania-gamma.vercel.app)  
**Rapor sahibi:** **Manus AI**

## 1. Yönetici özeti

Automania POD uygulamasının bu fazdaki amacı; Next.js 16.3.2, PostgreSQL/Neon, Cloudflare R2, Google OAuth, Etsy OpenAPI v3, OpenRouter/Gemini ve ScraperAPI bileşenlerini içeren SaaS uygulamasını güvenlik, veri sahipliği, test edilebilirlik ve Vercel uyumluluğu bakımından yayın adayı seviyesine taşımaktı. Bu kapsamda P0 niteliğindeki oturum, IDOR, secret sızıntısı, SSRF, upload doğrulaması, admin yetkilendirmesi ve OAuth yönlendirmesi riskleri ele alındı.

**Net karar:** Bu branch, güvenlik açısından **yayın adayıdır**; ancak doğrudan ve koşulsuz bir canlıya alma yerine **koşullu yayın onayı** öneriyorum. Vercel ortam değişkenleri, canlı migration, Google/Etsy callback yapılandırmaları ve gerçek bir kullanıcı tarayıcısından son smoke testi tamamlanmadan production release yapılmamalıdır. Bu son operasyonel kapılar tamamlandığında sürüm yayınlanabilir. Mevcut 465 maddelik ESLint borcu ciddi bir kalite borcudur; ancak ölçülen borç ağırlıklı olarak legacy kodda bulunduğu, bu fazda değiştirilen kritik dosyalar targeted lint ve type-check’ten geçtiği ve production build başarılı olduğu için tek başına P0 yayını engelleyen bir güvenlik bulgusu olarak sınıflandırılmamıştır.

Bununla birlikte rapor, **“tüm özellikler her dış sağlayıcıyla yüzde 100 doğrulandı”** iddiasında bulunmamaktadır. Google OAuth, yerel authenticated UI, bundled demo, batch render, ZIP dışa aktarma ve admin gözlemleri doğrulanmıştır. Etsy OAuth ise uygulama tarafında doğru authorize yönlendirmesine kadar test edilmiş, fakat sandbox browser’ın Etsy DataDome anti-bot challenge’ı nedeniyle Etsy giriş ekranı ve callback/token exchange tamamlanamamıştır. Bu durum uygulama callback kusuruna değil, test cihazı/ortamı ile Etsy arasındaki erişim engeline işaret etmektedir. [2]

## 2. Kapsam ve kanıt standardı

İnceleme, güncel branch üzerinde çalışan yerel webpack runtime’ı, test komutlarını, production build’i, gerçek PostgreSQL şema denetimini ve authenticated UI kabul akışlarını kapsadı. Yerel testlerde kullanılan gerçek veritabanı ve R2 bağlantıları korunmuş; Etsy tarafında kullanıcı onayı doğrultusunda hiçbir canlı listing yayınlama işlemi yapılmamıştır. Yerel hesap için yapılan storage temizliği yalnızca uygulama çalışma alanıyla sınırlı kalmış, Etsy mağaza/listing verisine dokunmamıştır. [2]

Aşağıdaki sonuçlar, çalışma ağacının temiz olduğu ve incelenen kod revizyonunun `2f61c4b` olduğu varsayımıyla geçerlidir. Raporun teknik iddiaları, proje içindeki schema inspection, UI acceptance ve lint audit dosyalarıyla çapraz kontrol edilmiştir. [1] [2] [3]

## 3. Tamamlanan güvenlik düzeltmeleri

Aşağıdaki tablo, bu fazda kapatılan veya güvenli davranışla sınırlandırılan başlıca güvenlik kontrollerini özetlemektedir. “Durum” ifadesi, ilgili kontrolün kaynak kodu ve test akışları içinde uygulandığını; “kalan not” ise production operasyonunda ayrıca doğrulanması gereken noktayı belirtir.

| Güvenlik alanı | Uygulanan düzeltme | Durum ve kalan not |
|---|---|---|
| JWT secret | Hard-coded/fallback JWT secret kaldırıldı; secret yoksa uygulama güvenli biçimde başlatılmıyor. | **Tamamlandı.** Vercel’de `JWT_SECRET` zorunlu. |
| JWT payload | Token payload için strict doğrulama ve beklenen claim kontrolü eklendi. | **Tamamlandı.** Sahte veya eksik payload güvenilir kabul edilmiyor. |
| Authoritative session | Rol/status gibi yetkiler cookie payload’ından körlemesine alınmıyor; kullanıcı DB’den tekrar doğrulanıyor. | **Tamamlandı.** Session revocation/status değişimleri server tarafından esas alınıyor. |
| Google OAuth kullanıcı kimliği | Callback sırasında mevcut kullanıcı kaydının gerçek DB ID’si korunuyor. | **Tamamlandı.** Callback cookie’si ile authoritative session ID uyuşmazlığı giderildi. |
| Stale localStorage session | Server session doğrulanmadan localStorage profili authenticated görünmüyor; geçersiz profil temizleniyor. | **Tamamlandı.** UI, 401 durumunda anonim güvenli başlangıca dönüyor. |
| Public user upsert | `/api/users` üzerinden auth bypass ile public kullanıcı upsert edilmesi kapatıldı. | **Tamamlandı.** Kullanıcı senkronizasyonu doğrulanmış session gerektiriyor. |
| Storage IDOR | Storage kayıtlarına erişim user/workspace sahipliğiyle sınırlandı. | **Tamamlandı.** `userId` query parametresi authentication yerine geçmiyor. |
| Upload authentication | Upload endpoint’i doğrulanmış session olmadan çalışmıyor. | **Tamamlandı.** Unauthenticated smoke test kapsamına alındı. |
| Upload MIME doğrulaması | İzin verilen MIME türleri sınırlandı ve istemci beyanı tek güvenlik sinyali olarak kullanılmıyor. | **Tamamlandı.** Magic-byte kontrolüyle birlikte çalışıyor. |
| Upload magic-byte | Dosya içeriği başlık/magic-byte seviyesinde kontrol ediliyor. | **Tamamlandı.** Uzantı değiştirerek bypass etme riski azaltıldı. |
| Upload boyut limiti | Upload boyutu server tarafında sınırlandırıldı. | **Tamamlandı.** R2 ve yerel fallback kaynaklarının kötüye kullanımı azaltıldı. |
| Upload object key sahipliği | Object key’ler user-prefix ile üretiliyor. | **Tamamlandı.** Kullanıcılar arası isim çakışması ve tahmin edilebilir sahiplik riski azaltıldı. |
| Upload serving | Upload servis etme endpoint’i session ve sahiplik kontrolü uyguluyor. | **Tamamlandı.** Yetkisiz dosya okuma engellendi. |
| Blob silme | Silme işlemi session + ownership kontrolü olmadan çalışmıyor. | **Tamamlandı.** Yetkisiz veri silme riski kapatıldı. |
| R2 proxy | Cloudflare/R2 proxy erişimi doğrulanmış session ve sahiplikle sınırlandı. | **Tamamlandı.** Secret veya private object doğrudan istemciye açılmıyor. |
| OpenRouter secret | OpenRouter API key response body’ye veya UI’ya geri döndürülmüyor. | **Tamamlandı.** Admin görünümü password alanı ve server-side göstergesi kullanıyor. [2] |
| AI proxy SSRF | AI proxy endpoint’inde hedef provider/endpoint allowlist’i uygulandı. | **Tamamlandı.** Key’in arbitrary URL’ye forward edilmesi engellendi. |
| AI/scraper rate limit | AI ve scraper çağrıları kullanıcı bazlı rate limit ile sınırlandı. | **Tamamlandı.** Production gözleminde limit davranışı ayrıca izlenmeli. |
| Etsy OAuth redirect | `returnUrl`/redirect akışı allowlist ve güvenli fallback ile sınırlandı. | **Tamamlandı.** Open redirect riski azaltıldı. |
| Etsy OAuth PKCE | Etsy authorize akışı PKCE state/code challenge ile yürütülüyor. | **Uygulama tarafında doğrulandı.** Sandbox DataDome nedeniyle callback tamamlanamadı. |
| Etsy scope ve listing güvenliği | UI ve server katmanında listing işlemi yalnızca **DRAFT** state ile sınırlandı. | **Kritik kısıt korunuyor.** Etsy’de canlı yayın yapılmayacak. |
| Etsy listings auth-first | Etsy listing/sync endpoint’i bağlantı/token kontrolünü dış API çağrısından önce yapıyor. | **Tamamlandı.** Bağlı hesap yoksa 400 ve secretsız mesaj dönüyor. [2] |
| Etsy taxonomy auth-first | Taxonomy properties akışında auth kontrolü validation ve dış çağrıdan önce yapılıyor. | **Tamamlandı.** Yetkisiz taxonomy erişimi kapalı. |
| Admin authorization | Admin bulk-update ve taxonomy-sync işlemleri admin-only hale getirildi. | **Tamamlandı.** Unauthenticated smoke test’te 401/403 doğrulandı. |
| Admin settings secret safety | Admin settings API secret değerlerini maskeleyerek döndürüyor. | **Tamamlandı.** Gerçek değerler UI’ya geri dönmüyor. [2] |
| Audit log redaction | API key, token ve benzeri secret alanları audit log’a redacted biçimde yazılıyor. | **Tamamlandı.** PII ve credential sızıntısı azaltıldı. |
| Job run kayıtları | `job_runs` tablosu PostgreSQL ve SQLite bootstrap şemalarına eklendi. | **Tamamlandı.** Şema parity ile doğrulandı. [1] |
| Audit log tablosu | `audit_logs` tablosu ve indeksleri bootstrap/production şemaya eklendi. | **Tamamlandı.** Production’da tablo mevcut. [1] |
| Güvenli demo asset’leri | Silinmiş upload URL’lerine bağlı eski demo yerine bundled public SVG asset’leri kullanıldı. | **Tamamlandı.** Demo asset erişimi deterministik hale geldi. |

Bu düzeltmeler, özellikle authentication, authorization ve secret yönetiminde defense-in-depth yaklaşımı sağlar. Buna rağmen security hardening’in tamamlandığı anlamına gelmeyen iki operasyonel gereklilik vardır: production secret’larının Vercel’de doğru scope ile tanımlanması ve release sonrası gerçek tarayıcıdan callback/ownership smoke testlerinin tekrarlanması.

## 4. Test sonuçları ve kalite kapıları

İncelenen branch’te kritik işlevsel kalite kapıları yeşildir. Full ESLint geçişi ise legacy borcu nedeniyle kırmızı durumdadır ve ayrı teknik borç olarak raporlanmıştır.

| Kontrol | Komut/kanıt | Sonuç | Değerlendirme |
|---|---|---:|---|
| TypeScript doğrulaması | `npm run type-check` | **PASS** | Güncel kaynak kodu tip kontrolünden geçiyor. |
| Unit test | `npm test` | **PASS — 20/20** | 8 Vitest test dosyası geçti; bundled demo ve eşleştirme regresyonları dahil. |
| SQLite integration | `npm run test:sqlite` | **PASS** | Yerel sql.js/WASM runtime ve migration parity akışı doğrulandı. |
| Production build | `npm run build` | **PASS** | Next.js 16.3.2 webpack build başarılı; Vercel/Serwist uyumluluğu için webpack flag’i sabitlendi. |
| Unauthenticated HTTP smoke | `npm run test:smoke` | **PASS — 46/46** | Dev ve production runtime’da authenticated/admin API yüzeyleri 401/403 davranışıyla doğrulandı. |
| Dependency audit | `npm audit --omit=dev --audit-level=high` | **PASS — 0** | High seviyede bilinen production dependency açığı raporlanmadı. |
| Full ESLint | `npm run lint` | **FAIL — 465 problem** | 290 error, 175 warning; legacy teknik borç. Generated `public/sw.js` kapsam dışına alındı. |

`npm run lint` için önceki ham ölçüm generated service worker bulgularıyla birlikte 551 problem gösteriyordu. `public/sw.js` lint kapsamından ayrıştırıldıktan sonra kaynak kodu sinyali **465 probleme** indi: **290 error ve 175 warning**. Bu ayrım, kalan borcun önemli bölümünün gerçek kaynak dosyalarında bulunduğunu açıkça gösterir; dolayısıyla borç gizlenmiş değildir. Bu fazda değiştirilen kritik dosyaların targeted lint/type-check kontrollerinden geçtiği, ancak bütün repository için ESLint kapısının henüz yeşil olmadığı dikkate alınmalıdır. [3]

## 5. Canlı PostgreSQL migration ve schema parity

Gerçek production PostgreSQL üzerinde eksik `audit_logs` ve `job_runs` tabloları ile ilgili indeksler oluşturuldu. Migration işlemi kullanıcı onayıyla yürütüldü; audit kanıtına göre uygulama satırları veya Etsy listing’leri değiştirilmedi. [1]

Read-only schema inspection sonucunda beklenen sekiz tablonun tamamı ve beklenen kolon sayıları bulundu. Denetim çıktısında `missing: []` ve `status: ready` değerleri vardır. Bu sonuç, local bootstrap migration ile canlı PostgreSQL şeması arasında Phase 11 kapsamındaki parity kapısının geçtiğini gösterir. [1]

| Tablo | Beklenen kolon | Mevcut kolon | Denetim satır sayısı |
|---|---:|---:|---:|
| `users` | 6 | 6 | 1 |
| `user_workspaces` | 13 | 13 | 2 |
| `keyword_pool` | 5 | 5 | 2.289 |
| `app_settings` | 3 | 3 | Rapor çıktısında satır sayısı alınmadı |
| `etsy_taxonomy_cache` | 4 | 4 | Rapor çıktısında satır sayısı alınmadı |
| `audit_logs` | 5 | 5 | 0 |
| `job_runs` | 9 | 9 | 0 |
| `user_etsy_listings` | 5 | 5 | 167 |

Production migration’ın idempotent davranması ve release sonrası tekrar kontrol edilebilmesi için `package.json` içinde `npm run db:migrate` komutu `node create_table.mjs` olarak tanımlıdır. Schema doğrulaması için `npm run db:inspect-schema` komutu kullanılmalıdır. [4]

## 6. Authenticated UI kabul testleri

Google OAuth akışı gerçek yerel test hesabıyla tamamlandı. Callback 200 döndü; ardından `/api/users`, `/api/storage` ve `/api/storage/version` 200 sonuçları verdi. Session cookie okunmadı veya loglanmadı. İlk 401 döngüsünün callback öncesi/stale localStorage durumundan kaynaklandığı, callback ID koruma düzeltmesinden sonra server session ile kullanıcı kimliğinin uyumlandığı doğrulandı. [2]

Bundled demo paketi, silinmiş `/api/uploads` referanslarına bağımlı eski sample data akışının yerine geçti. Temiz başlangıçtan sonra authenticated UI’da iki mockup, iki tasarım ve toplam dört varyasyon görünür oldu; Light Apparel ve Dark Apparel klasörleri ikişer varyasyon hesapladı. `isSelected` düzeltmesiyle batch eşleştirme sayısının sıfır kalmasına neden olan regresyon kapatıldı. [2]

Canvas batch üretiminde dört render sonucu ve thumbnail’leri görüldü. İlk ZIP denemesinde `file-saver` dynamic import uyumsuzluğu nedeniyle `saveAs is not a function` hatası gözlendi. `file-saver` bağımlılığı kaldırılıp native Blob indirme yardımcısı eklendikten sonra aynı akış “ZIP dosyası başarıyla indirildi!” mesajıyla geçti. Etsy’ye gönderim düğmesi görünür halde bırakıldı; bu testte Etsy mutation çağrısı yapılmadı. [2]

Admin paneli authenticated admin session ile açıldı. Özet ekranı kullanıcı, global mockup/tasarım/klasör sayaçlarını ve PostgreSQL/R2 sağlık göstergelerini render etti. AI & OpenRouter ekranında secret değerleri password alanı ve “Sunucu Tabanlı” açıklamasıyla maskeli kaldı. Etsy taxonomy ekranı yerel PostgreSQL’den kategori verisini okuyabildi; test sırasında taxonomy veya global template mutation yapılmadı. [2]

Etsy listing senkronizasyonu için bağlantı yokluğu dış Etsy pagination çağrısından önce tespit edildi ve secretsız 400 yanıtı üretildi. Bu davranış güvenli olmakla birlikte, gerçek draft listing kabul testi için önce Etsy OAuth bağlantısının gerçek kullanıcı tarayıcısında tamamlanması gerekmektedir.

## 7. Etsy OAuth durumu ve bağlantı rehberi

Uygulama tarafındaki Etsy OAuth başlangıç akışı çalışmaktadır. `/api/etsy/auth?returnUrl=/` endpoint’i 307 yönlendirme üretmiş, PKCE authorize parametreleriyle Etsy’ye geçilmiştir. Ancak sandbox browser’da Etsy sign-in ekranı yerine DataDome anti-bot challenge HTML’i dönmüş ve ekran boş kalmıştır. Yerel server loglarında `/api/etsy/auth` için 307 kayıtları vardır; `/api/etsy/callback` çağrısı yoktur. Bu nedenle test, uygulamanın callback veya token exchange koduna ulaşmadan Etsy’nin anti-bot katmanında kesilmiştir. [2]

Bu bulgu, uygulama hatası kesin olarak yoktur anlamına gelmez; fakat mevcut kanıt uygulamanın authorize redirect’ini doğru ürettiğini ve problemin daha erken, dış sağlayıcı erişim katmanında oluştuğunu gösterir. Etsy bağlantısı production’da, normal kullanıcı tarayıcısından ve mümkünse farklı ağ/cihaz koşuluyla bir kez doğrulanmalıdır. DataDome challenge’ını otomatik olarak aşmaya çalışılmamalı, hesap bilgileri sandbox’a girilmemeli ve herhangi bir CAPTCHA/anti-bot koruması bypass edilmemelidir.

Production Etsy bağlantısı için Etsy Developer App’te aşağıdaki callback URL’si kayıtlı olmalıdır:

```text
https://automania-gamma.vercel.app/api/etsy/callback
```

Bağlantı tamamlandıktan sonra kabul testi sırası şu şekilde olmalıdır: önce Etsy hesabının bağlı olduğu UI’da bağlantı durumunu gözlemlemek; ardından yalnızca test amaçlı bir listing taslağı oluşturmak; listing state’in server response ve Etsy panelinde `DRAFT` olduğunu doğrulamak; son olarak **Publish/Live** işlemini kesinlikle çalıştırmamak. Uygulama içinde bulunan server-side draft kısıtı, kullanıcı arayüzündeki kontrolün yanında bağımsız güvenlik sınırı olarak korunmalıdır.

## 8. Kalan lint borcu ve teknik borç

Kaynak kodu kapsamındaki son lint ölçümü **465 problemden** oluşmaktadır: 290 error ve 175 warning. Bu sayı, generated `public/sw.js` dosyasının lint kapsamından çıkarılmasından sonraki gerçek kaynak kodu ölçümüdür. Borç; yalnızca biçimsel uyarılardan ibaret değildir. `no-explicit-any`, unused imports/variables, `prefer-const`, hook dependency ve bazı effect/state pattern ihlalleri bulunmaktadır. Bu nedenle ESLint’in production kalite kapısı olarak tamamen göz ardı edilmesi uzun vadede doğru değildir. [3]

En yoğun kümeler, audit notlarına göre `EtsyPublisher.tsx` (42), `AdminDashboard.tsx` (22), `etsy-scraper.ts` (21), `EtsySeoContext.tsx` (20) ve admin/sample-data route’u (17) çevresindedir. Ayrıca çok sayıda Etsy API route’unda tekrar eden `any` kullanımı vardır. [2] [3]

| Teknik borç | Öncelik | Yayın etkisi | Önerilen sonraki adım |
|---|---|---|---|
| Full ESLint borcu | P1 | Güvenlik P0 değil; bakım ve regresyon riski oluşturuyor. | Route’ları domain bazında bölerek `any` türlerini DTO/schema ile değiştirmek; önce admin ve Etsy kümelerini temizlemek. |
| Kalan `<img>` kullanımları | P1 | LCP, image optimization ve Vercel performansını etkileyebilir. | Kullanıcıya görünen kritik görselleri `next/image` ile taşımak; remote patterns’ı dar allowlist ile tanımlamak. |
| `AdminDashboard` monoliti | P1 | Test edilebilirlik ve değişiklik riskini düşürüyor. | Overview, settings, AI, taxonomy, users ve maintenance panellerini ayrı bileşen/hook’lara bölmek. |
| Etsy route type safety | P1 | Dış API response değişimlerinde runtime hata riski. | Etsy response DTO’ları, zod/şema doğrulaması ve merkezi error mapping eklemek. |
| Authenticated integration testleri | P1 | OAuth ve R2 gerçek sağlayıcı davranışları sınırlı test edildi. | Mock provider + staging/test account ile callback, ownership, upload ve draft create akışlarını CI’da çalıştırmak. |
| E2E/CI pipeline | P1 | Her commit’te tüm kalite kapıları otomatik korunmuyor. | Type-check, unit, SQLite, build, smoke ve lint için branch protection veya Vercel pre-deploy gate eklemek. |
| Job idempotency/observability | P2 | Uzun AI/scraper işlerinde tekrar çalıştırma ve timeout takibi iyileştirilebilir. | `job_runs` ile correlation ID, timeout, retry ve dashboard metrikleri eklemek. |
| R2/Cloudflare hata senaryoları | P2 | Sağlayıcı kesintilerinde kullanıcı deneyimi etkilenebilir. | Retry/backoff, circuit breaker ve kullanıcıya güvenli hata kodları eklemek. |

Bu borcun bir sonraki faza bırakılması kabul edilebilir; fakat release branch’ine yeni lint hatası eklenmemesi için en azından değiştirilen dosyalar üzerinde targeted lint kuralı uygulanmalı ve CI’da “new violations” kapısı oluşturulmalıdır.

## 9. Vercel canlıya alma checklist’i

Canlıya alma işlemi, aşağıdaki adımların tamamı doğrulanmadan yapılmamalıdır. Secret değerleri bu rapora yazılmamış ve Git’e eklenmemelidir.

### 9.1 Environment variables

Vercel Project Settings içinde en az aşağıdaki 15 değişken, ilgili `Production` scope’unda tanımlanmalıdır. Preview ortamı kullanılacaksa callback URL’leri ayrı uygulama konfigürasyonu ile ayrıştırılmalıdır.

| Değişken | Kullanım amacı | Kontrol |
|---|---|---|
| `DATABASE_URL` | Neon/PostgreSQL bağlantısı | Production database’e ait olmalı; değer rapora/log’a yazılmamalı. |
| `JWT_SECRET` | HS256 session imzalama | Uzun, rastgele ve yalnızca server-side secret olmalı. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth client ID | Canlı domain için doğru OAuth client kullanılmalı. |
| `GOOGLE_CLIENT_SECRET` | Google OAuth server secret | Vercel secret olarak tanımlanmalı. |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 erişim kimliği | Minimum yetki prensibi uygulanmalı. |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 secret | UI veya log’a dönmemeli. |
| `R2_ACCOUNT_ID` | Cloudflare hesabı | Doğru hesap/bucket ile eşleşmeli. |
| `R2_BUCKET_NAME` | R2 bucket | Production bucket doğrulanmalı. |
| `R2_PUBLIC_URL` | R2 public/proxy URL yapılandırması | Ownership/proxy kontrolleriyle uyumlu olmalı. |
| `OPENROUTER_API_KEY` | OpenRouter server-side çağrıları | İstemci bundle’ına açılmamalı. |
| `GEMINI_API_KEY` | Google Gemini server-side çağrıları | İstemci bundle’ına açılmamalı. |
| `SCRAPER_API_KEY` | Scraper provider erişimi | Kullanıcı bazlı rate limit ile birlikte kullanılmalı. |
| `SCRAPING_PROVIDER` | Scraper sağlayıcı seçimi | Beklenen provider adıyla eşleşmeli. |
| `CLOUDFLARE_WORKER_URL` | R2/proxy veya scraper worker endpoint’i | Allowlist ve production URL doğrulanmalı. |
| `NEXT_PUBLIC_APP_URL` | OAuth redirect ve canonical app URL | `https://automania-gamma.vercel.app` olmalı. |

Kaynak kodda ayrıca `ETSY_API_KEY`, `ETSY_SHARED_SECRET`, `ETSY_ACCESS_TOKEN` ve `ETSY_SHOP_ID` isimleri geçen legacy/alternatif yollar bulunmaktadır. Production deploy öncesinde bu değişkenlerin gerçekten gerekli olup olmadığı source/config üzerinden son kez doğrulanmalı; kullanılmayan Etsy secret’ları eklenmemeli, kullanılanlar ise yalnızca Vercel server-side secret olarak tanımlanmalıdır. Etsy OAuth callback için Developer App kaydı ile `NEXT_PUBLIC_APP_URL` birebir eşleşmelidir.

### 9.2 Migration ve deploy sırası

Önerilen operasyon sırası şöyledir:

1. Vercel’de environment variables değerlerini Production scope’unda tanımlayın. Mevcut secret’ları rotasyon politikasıyla yeniden üretmek mümkünse yayın öncesinde rotasyon yapın.
2. Güvenilir bir operatör shell’inde production `DATABASE_URL` ile `npm run db:migrate` komutunu çalıştırın. Bu komut `node create_table.mjs` bootstrap migration’ını yürütür ve eksik tabloları/indeksleri oluşturur. [4]
3. Aynı bağlantıyla `npm run db:inspect-schema` çalıştırarak sekiz tablonun kolon parity’sini, `missing: []` durumunu ve satır sayılarını kontrol edin.
4. `npm run type-check`, `npm test`, `npm run test:sqlite` ve `npm run build` komutlarını release commit’i üzerinde yeniden çalıştırın. `npm run test:smoke` ile unauthenticated yüzeyin 401/403 davranışını tekrar kontrol edin.
5. Vercel deployment’ı oluşturun. Deployment loglarında secret değerleri, OAuth code/state, JWT veya R2 credential’larının görünmediğini doğrulayın.
6. Google OAuth Console’da canlı domain’i ve aşağıdaki callback URL’sini ekleyin:

   ```text
   https://automania-gamma.vercel.app/api/auth/google/callback
   ```

7. Etsy Developer App’te aşağıdaki callback URL’sini ekleyin:

   ```text
   https://automania-gamma.vercel.app/api/etsy/callback
   ```

8. Gerçek kullanıcı tarayıcısından Google login, session refresh, storage read/write, upload ownership ve admin authorization smoke testlerini yürütün. Ardından Etsy bağlantısını deneyin; bağlantı başarısız olursa DataDome/erişim durumunu uygulama callback hatasıyla karıştırmayın.
9. Etsy hesabı bağlanırsa yalnızca bir test listing’i **DRAFT** olarak oluşturun. Listing’in canlıya taşınmadığını hem uygulama hem Etsy panelinde kontrol edin. Publish/Live kontrolünü çalıştırmayın.

### 9.3 Geri alma ve izleme

İlk production deploy sonrasında hata oranı, 401/403 dağılımı, OAuth callback sonuçları, R2 upload/delete hataları, AI/scraper rate-limit yanıtları ve job failure kayıtları izlenmelidir. Migration geri alma ihtiyacı oluşursa tablo silme gibi yıkıcı bir işlem uygulanmamalı; önce yeni deployment geri alınmalı, veritabanı değişiklikleri güvenli ve geriye uyumlu migration ile ele alınmalıdır. `audit_logs` ve `job_runs` üretimde gözlemlenebilirlik için korunmalıdır.

## 10. Yayın kararı

**Öneri: Koşullu GO — release candidate olarak kabul edilebilir; operasyonel checklist tamamlanmadan production’da “tamamlandı” ilan edilmemelidir.**

Bu kararın olumlu tarafı, P0 güvenlik yüzeylerinin kapatılmış olması, type-check/unit/SQLite/build/smoke/audit kapılarının yeşil olması ve canlı PostgreSQL şemasının parity ile doğrulanmasıdır. Ayrıca UI tarafında Google OAuth, bundled demo, batch render, ZIP indirme ve admin secret masking gibi kritik kullanıcı akışları gerçek yerel runtime’da gözlemlenmiştir. [1] [2]

Kararı koşullu yapan noktalar ise full ESLint’in hâlâ 465 problemle başarısız olması, gerçek Etsy OAuth callback/token exchange akışının DataDome nedeniyle tamamlanamaması ve Vercel production environment/callback doğrulamalarının bu raporda yalnızca checklist olarak bulunmasıdır. Bunlar çözülmeden “yüzde 100 tüm özellikler dış sağlayıcılarla doğrulandı” demek teknik olarak doğru olmayacaktır.

Yayın öncesi minimum kabul koşulları tamamlandığında sürümün canlıya alınmasını öneriyorum: **(i)** Vercel env vars ve Google/Etsy callback kayıtları doğrulanmış, **(ii)** production migration ve schema inspection geçmiş, **(iii)** gerçek tarayıcıdan Google session smoke testi geçmiş, **(iv)** Etsy bağlantısı en azından callback’e kadar gerçek ortamda denenmiş, **(v)** draft-only sınırı korunmuş, **(vi)** release sonrası izleme açık olmalıdır. ESLint borcu ise ayrı bir P1 hardening fazında azaltılmalı; yeni veya değiştirilen dosyalar için lint borcu artırılmamalıdır.

## 11. Sonuç

Automania POD, bu fazın sonunda başlangıçtaki kritik güvenlik risklerine kıyasla belirgin biçimde daha güvenli, daha deterministik ve daha test edilebilir durumdadır. Özellikle auth-first endpoint tasarımı, authoritative session, ownership kontrolleri, secret-safe logging, draft-only Etsy sınırı ve gerçek production schema parity doğrulaması yayın kararını destekleyen güçlü kanıtlardır.

Bu raporun önerisi, güvenlik düzeltmelerini ve mevcut kalite kapılarını **yayın adayı için yeterli**, ancak operasyonel son kontroller tamamlanana kadar canlıya alma kararını **koşullu** kabul etmektir. Etsy tarafında DataDome nedeniyle görülen blank screen, mevcut kanıtlarla uygulamanın callback kusuru olarak sınıflandırılmamalı; gerçek kullanıcı tarayıcısından yapılacak kontrollü son bağlantı testiyle kapatılmalıdır.

## References / Kanıtlar

[1]: ./phase11-schema-inspection.json "Phase 11 production PostgreSQL schema inspection"

[2]: ./phase11-local-ui-observation.md "Phase 11 local authenticated UI and OAuth observation log"

[3]: ./phase11-lint-final.txt "Phase 11 final source-code lint measurement"

[4]: ../automania/package.json "Automania package scripts and dependency manifest"

[5]: ../automania/create_table.mjs "Bootstrap PostgreSQL/SQLite schema migration"

[6]: ../automania/scripts/smoke-unauthenticated.ts "Unauthenticated HTTP smoke test suite"
