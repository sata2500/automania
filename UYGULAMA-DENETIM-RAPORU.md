# Automania — Uygulama İşleyişi, Arayüz Mantığı ve İyileştirme Denetimi

**Tarih:** 7 Ekim 2026
**İncelenen revizyon:** `32360d5` (main)
**Kapsam:** Ana uygulamanın 5 sekmesi (Mockup'lar, Tasarımlar, Toplu Üretim + Otomasyon, Etsy SEO, Etsy İlanlarım), uygulama çatısı (oturum, veri senkronizasyonu, misafir modu, PWA) ve admin paneli. İlgili tüm API route'ları ve `src/lib` servisleri dahil.
**Yöntem:** Kod satır satır okundu ve her bulgu `dosya:satır` ile kaynaklandı. En kritik bulgular ayrıca elle yeniden doğrulandı (bkz. §9). Kod değiştirilmedi; bu rapor yalnızca tespit ve öneri içerir.

---

## 1. Yönetici Özeti

Automania'nın vizyonu güçlü: mockup hazırla → tasarım yükle/üret → toplu görsel üret → AI ile SEO metni yaz → Etsy'de yayınla → ilanları analiz et. Bu uçtan uca bir POD iş akışı. Önceki aşamalarda güvenlik, CI, şifreleme ve responsive tasarım büyük ölçüde oturtuldu.

Bu denetim **"çalışıyor mu, doğru mu çalışıyor, kullanıcı ne olduğunu anlıyor mu"** sorularına odaklandı. Genel tablo:

- **Veri güvenliği en zayıf halka.** Senkronizasyon modeli değişiklikleri sessizce kaybedebiliyor. Bir senaryoda (misafir verisini hesapla birleştirme) kullanıcının kayıtlı Etsy üretim sonuçları **kalıcı olarak siliniyor**. Kayıt hataları kullanıcıya hiç gösterilmiyor; arayüz "Güncel ✓" demeye devam ediyor.
- **Etsy ile canlı mağazaya dokunan akışlar kırılgan.**
  - Aktif bir ilanın başlığı veya etiketi İlanlarım sekmesinden güncellenemiyor. Hatayı aşmanın tek yolu ilanı taslağa çekmek, yani yayından kaldırmak.
  - İlan senkronizasyonu, rate limit'e takılan tek bir sayfa yüzünden mağazada duran ilanları "kaldırıldı" olarak işaretleyebiliyor.
  - Yayınlama, yüklenemeyen görselleri sessizce atlayıp "başarılı" diyor.
- **Bazı özellikler vaat ettiğini yapmıyor.** Otomasyon şablonlarındaki ayarların çoğu (varyasyonlar, yayın modu, statik/video mockup'lar, kumaş filtresi) çalıştırıcı tarafından hiç okunmuyor. SEO ve ilan adımları da atlanıyor. Admin'in "örnek taslak" ayarı ve video modeli ayarı da etkisiz.
- **Arayüz akışı genel olarak mantıklı, ancak tutarsızlıklar kafa karıştırıyor.**
  - "Açık/Koyu" terimleri tasarım tarafında ters kodlanmış.
  - Tasarım silme onaysız, mockup silme onaylı.
  - Mockup klasörünü silmek içindekileri de siliyor; tasarım klasörünü silmek içindekileri taşıyor.
  - Misafire 4. ve 5. adımlar hiç gösterilmiyor.
  - Etsy medya limiti bir yerde 22, bir yerde 20.
- **Performans kabul edilebilir, ama büyüdükçe sorun çıkacak.**
  - Her klasör tıklaması tüm çalışma alanını sunucuya gönderiyor.
  - Toplu render ana thread'i kilitliyor.
  - Görseller küçük resim (thumbnail) yerine tam çözünürlükte yükleniyor.
  - Görsel istekleri de API rate limit'ine sayıldığı için büyük çalışma alanlarında 429 riski var.

### 1.1 En kritik 12 bulgu

| # | Bulgu | Alan | Önem |
|---|---|---|---|
| 1 | Misafir verisini "Birleştir" ile hesaba aktarmak, hesabın kayıtlı **Etsy üretim sonuçlarını siliyor** (`renderedMatches` her zaman boş geçiyor) | Çatı / Senkron | 🔴 Kritik |
| 2 | Senkron çakışma koruması fiilen kapalı: ilk kayıt ve her 409 sonrası kayıt diğer cihazın verisini kontrolsüz eziyor. Arka plan yoklaması bekleyen kaydı iptal edip yerel düzenlemeyi siliyor | Çatı / Senkron | 🔴 Kritik |
| 3 | Kayıt hataları (3,8 MB sınırı, ağ, 409) görünmez. "Güncel ✓" yanlış. Misafir verisi, sunucuya yazma başarısız olsa bile siliniyor | Çatı / Senkron | 🔴 Kritik |
| 4 | AI ile üretilen tasarımlar depoya yüklenemiyor (MIME yerine dosya adı geçiliyor) ve base64 olarak state'e giriyor. Birkaç üretimden sonra 3,8 MB aşılıyor ve **bulut senkronu sessizce tamamen duruyor** | Tasarımlar | 🔴 Kritik |
| 5 | Klasör çoğaltma görsel dosyasını paylaştırıyor. Kopyadan bir mockup silmek veya kırpmak, orijinalin görselini R2'den kalıcı olarak siliyor | Mockup'lar | 🔴 Kritik |
| 6 | İlan senkronu: 429/5xx alan sayfa sessizce bitiyor, `expired`/`sold_out` hiç çekilmiyor, 300+ ilanlı mağazada erken çıkış var. Çekilemeyen her ilan `removed` işaretleniyor | İlanlarım | 🔴 Kritik |
| 7 | İlan düzenleme: aktif ilan güncellenemiyor (sunucu yalnızca `draft` kabul ediyor, istemci her zaman `state` gönderiyor). Kullanıcı "Taslak" seçerse canlı ilan gizleniyor ve "canlı olarak güncellendi 🎉" mesajı çıkıyor | İlanlarım | 🟠 Yüksek |
| 8 | Etsy yayını: görsel yükleme hatası sessizce atlanıyor ve "başarılı" dönülüyor. 60 sn içinde sıralı 20+ yükleme yapılıyor, geri alma ve idempotency yok, Etsy hata metni kayboluyor. Varsayılan `who_made=someone_else` muhtemelen reddediliyor | Etsy SEO | 🟠 Yüksek |
| 9 | AI ilan üretimine her tasarım için sabit `'cottagecore botanical wildflower'` estetiği gönderiliyor. Konu tespiti alt dize ile yapılıyor ("vacation" → kedi). Verisi olmayan kelimelere uydurma 75/80 skor veriliyor | Etsy SEO | 🟠 Yüksek |
| 10 | Otomasyon şablon ayarlarının çoğu etkisiz, SEO ve ilan adımları atlanıyor, sayaç yine de "listing üretildi" diyor. 300 sn bütçesi videoyla aşılınca run "Çalışıyor"da kilitli kalıyor | Otomasyon | 🟠 Yüksek |
| 11 | Toplu üretim 22 görsele izin veriyor, Etsy yayını 20'de reddediyor. "Etsy'ye Gönder" kaydı başarısız olsa bile konfeti ve başarı mesajı gösteriliyor | Toplu Üretim | 🟠 Yüksek |
| 12 | Tüm `/api/*` (görseller dahil) IP başına dakikada 120 istekle sınırlı. Görseller `/api/r2` üzerinden geldiği için büyük çalışma alanında sayfa açılışı 429'a düşebiliyor | Çatı / Medya | 🟠 Yüksek |

---

## 2. Uygulama Nasıl Çalışıyor? (Genel Akış)

```
                      ┌──────────────────────── Misafir: IndexedDB (base64 görseller) ───────────────┐
                      │                                                                               │
 [1 Mockup'lar] ──► baskı alanı tanımla ──┐                                                           │
 [2 Tasarımlar] ──► yükle / AI üret /     ├──► [3 Toplu Üretim] ──► tarayıcıda canvas render          │
                    analiz / aktif yap ───┘          │                 (renderedMatches: yalnız bellek) │
                                                     │ "Etsy'ye Gönder" → R2 + etsyGeneratedMockups   │
                                                     ▼                                                │
                                   [4 Etsy SEO] AI metin + varyasyon + mağaza parametreleri ──► Etsy API (publish)
                                                                                                      │
                                   [5 İlanlarım] Etsy'den senkron → DB önbelleği → skor / vision / AI optimize / güncelle
                                                                                                      │
 [3b Otomasyon Şablonları] ── manuel ya da cron (GitHub Actions, saatlik) ──► sunucuda: AI tasarım → arka plan
                              kaldırma → 1 mockup render → Veo video → (SEO ✗, ilan ✗)                │
                      │                                                                               │
                      └──────────── Giriş yapmış: IndexedDB önbellek + /api/storage (Neon) + R2 ───────┘
```

**Veri katmanı:**
- Çalışma alanındaki mockups, designs, folders ve etsyGeneratedMockups tek bir JSON belge olarak `user_workspaces` satırında tutuluyor.
- İstemci her değişiklikte, 400 ms bekledikten sonra tüm belgeyi POST ediyor.
- Ayrıca 5 sn'de bir sürüm numarasını sorgulayıp değişiklik varsa tamamını yeniden çekiyor.
- Medya R2'de duruyor ve `/api/r2/<key>` üzerinden oturum ve sahiplik kontrolüyle sunuluyor.

**Temel tasarım sorunu:** Birçok bileşen (toplu üretim, SEO stüdyosu, admin AI ayarları, otomasyon çalıştırıcı) çalışma alanını kendi başına okuyup değiştirip yazıyor. Ortak bir kilit veya sürüm kontrolü yok. §4.1'deki veri kaybı bulgularının çoğu buradan kaynaklanıyor.

---

## 3. Arayüz Yerleşimi ve İş Akışı Mantığı (Genel Değerlendirme)

### 3.1 Güçlü yanlar
- 1→5 numaralı sekme sırası gerçek iş akışını izliyor; responsive düzen artık tüm ekranlarda sorunsuz.
- Mockup editöründe taslak/kaydet ayrımı, toplu üretimde klasör bazlı uygunluk kontrolü ve SEO'da SERP önizlemesi doğru düşünülmüş özellikler.
- Canlı yayın için yazılı onay ("YAYINLA") ve admin DB bakımı için "ONAYLA" gibi güvenlik kalıpları zaten var. Sadece her kritik yerde uygulanmıyor.

### 3.2 Akış mantığındaki sorunlar

| Sorun | Neden önemli | Öneri |
|---|---|---|
| Misafirde 4 ve 5. sekmeler **gizli**, kilitli gösterilmiyor (`Header.tsx:101,193`). Bunlara tıklayınca giriş modalını açan kod hiç tetiklenmiyor (`page.tsx:105-108`) | Kullanıcı Etsy yayınının var olduğunu bile görmüyor; giriş yapmanın değeri anlaşılmıyor | Sekmeleri kilit ikonuyla göster, tıklanınca giriş modalı açılsın |
| Üretimin gizli önkoşulları anlatılmıyor: mockup'ta baskı alanı olmalı, tasarım "aktif" olmalı, açık/koyu eşleşmesi tutmalı | "Neden hiçbir şey üretilmedi?" sorusu. Aktif tasarım yokken yalnızca statik görseller "başarıyla" üretiliyor (`canvas-renderer.ts:177-188`) | Tek bir "Başlangıç kontrol listesi" (mockup ✓, baskı alanı ✓, aktif tasarım ✓ …), aktif tasarım yoksa üret butonu kilitli |
| İlk ziyarette mobilde 3 banner üst üste (misafir, boş çalışma alanı, PWA), ikisinde aynı CTA (`page.tsx:345-441`) | İçerik ekranın altına itiliyor | Tek bir karşılama kartı |
| **"Açık/Koyu" terimleri ters:** `targetApparel:'dark'` arayüzde "Açık Kumaş" (`useDesignSelection.ts:5-9`). "Koyu Kumaş İçin Uyarla" ise "(Açık Versiyon)" adlı tasarım üretiyor (`DesignUploader.tsx:281`). Şablondaki `fabricType` doğrudan kumaş anlamında | Aynı kavram iki ekranda zıt anlamda; yanlış eşleşme riski | Tek sözlük: "Bu tasarım hangi kumaş için: Açık / Koyu / Tümü" |
| Silme davranışları tutarsız: mockup klasörü içindekileri siliyor, tasarım klasörü içindekileri köke taşıyor. Tasarım silme onaysız, mockup silme onaylı | Bir ekranda edinilen alışkanlık diğerinde veri kaybettiriyor | Ortak davranış: onay + "içerikle sil / taşı" seçimi + 5 sn "Geri al" |
| Etsy SEO alt sekmeleri: yayın butonu 1. alt sekmede, yayına giden varyasyonlar 2. alt sekmede. "AI ile üret" butonu ilgili kartta değil, en üst banner'da | "Önce yayınla, sonra varyasyon" gibi okunuyor | Tek adımlı akış: Görseller → Metin ve Etiket → Varyasyon → Mağaza ayarları → Kontrol ve Yayın |
| Yayın öncesi ne gerektiği belirsiz. Kargo profili kapalı akordiyonda otomatik seçiliyor, rozet AI çalışmasa bile "Otomatik Yapılandırıldı" diyor (`SeoStoreParamsAccordion.tsx:127`) | Yanlış kargo profiliyle canlı ilan riski | Yayın kartında ✓/✗ kontrol listesi (başlık ≤140, 13 etiket, ≤20 foto, kargo, hazırlık süresi, kategori) ve kargonun açıkça seçilmesi |
| Toplu üretimden sonra "Etsy SEO'ya git" yönlendirmesi yok; metinler "Etsy Yöneticisi" diyor, sekmenin adı "Etsy SEO" | Kullanıcı sonraki adımı arıyor | Başarı mesajında "SEO sekmesine geç" butonu |
| Otomasyon üretimleri SEO veya İlanlar sekmesine düşmüyor; sadece kartta 6 küçük resim var | "Üretilen görseller hazır", ama nerede? | Çıktılar `etsyGeneratedMockups`'a "Şablon adı · tarih" klasörüyle yazılsın |
| OAuth dönüş mesajları (`auth_error`, `etsy_success`, `etsy_error`) hiçbir yerde okunmuyor | Engellenen kullanıcı veya başarısız Etsy bağlantısı sessizce ana sayfaya dönüyor | Parametreyi okuyup toast göster |
| Giriş yapmış kullanıcı yenilediğinde ilk saniyelerde misafir banner'ı görünüyor ve kayıtlı SEO/İlanlar sekmesi Mockup'a sıfırlanıyor (`page.tsx:82-101`) | Her yenilemede kaldığı yeri kaybediyor | `authStatus: 'loading'` durumunda yönlendirme ve banner beklesin |

---

## 4. Alan Bazlı Denetim

Her alt başlıkta önce kısa işleyiş özeti, sonra bulgular (önem sırasıyla), sonra öneriler verilmiştir.

### 4.1 Uygulama Çatısı: Oturum, Senkronizasyon, Misafir Modu, PWA

**İşleyiş:**
- Google OAuth sonrası HttpOnly JWT çerezi ve localStorage'a profil yazılıyor.
- Açılışta IndexedDB'den anlık render yapılıyor, ardından sunucudan tam çekiliyor.
- Değişiklikler 400 ms sonra tam belge olarak POST ediliyor; 5 sn'de bir sürüm sorgulanıyor.
- Misafirde her şey IndexedDB'de, görseller base64 olarak tutuluyor.
- Girişte misafir verisi otomatik ya da banner üzerinden birleştiriliyor.

| Önem | Bulgu | Konum |
|---|---|---|
| 🔴 | **Birleştirme veri kaybı:** banner'a `renderedMatches` (yenilemeden sonra her zaman `[]`) geçiliyor. `existingGenerated` tanımlı olduğu için yerelden okunmuyor ve sonuç hesabın `etsyGeneratedMockups` listesini misafir verisiyle değiştiriyor | `page.tsx:339`, `storage-service.ts:259-263, 306-317, 344`, `api/storage/route.ts:177` |
| 🔴 | **Çakışma koruması kapalı:** `lastSyncTimestampRef` 0 başlıyor ve yüklemeden sonra set edilmiyor; sunucu yalnızca truthy değerde kontrol ediyor. 409 sonrası ref yine 0'a çekiliyor, değişiklik tekrar denenmiyor. Yoklama bekleyen kaydı `clearTimeout` ile iptal ediyor | `useWorkspace.ts:86, 172-177, 189-190, 221-238`; `route.ts:128` |
| 🔴 | **Görünmez hatalar:** `saveAppData` başarısızlıkta yalnızca `console.warn` yazıyor. `isSaving` her durumda false oluyor, AuthModal "Bulut Veritabanı Güncel ✓" diyor. Birleştirme, kayıt sonucunu kontrol etmeden misafir verisini siliyor. Hata `null` döndüğü için banner'ın `catch`'i hiç çalışmıyor | `storage-service.ts:743-746, 764-767, 344-347, 357-365`; `useWorkspace.ts:194`; `AuthModal.tsx:133-143` |
| 🟠 | Her klasör veya mockup tıklaması tüm çalışma alanını POST ediyor (otomatik kayıt bağımlılıklarında `activeFolderId`, `selectedMockupId` var), diğer cihazları da tam indirmeye zorluyor | `useWorkspace.ts:200` |
| 🟠 | Görsel istekleri de `/api/*` IP rate limit'ine (120/dk) sayılıyor. Her görsel bir DB oturum sorgusu ve tam bellek tamponu demek; video sarma için Range desteği yok | `proxy.ts:36-49`, `r2/[...key]/route.ts:55-66` |
| 🟠 | Ana sekmelerde ErrorBoundary yok, `app/error.tsx` ve `global-error.tsx` yok. Editördeki tek bir render hatası tüm uygulamayı beyaz ekrana düşürüyor | `page.tsx`, `src/app/` |
| 🟠 | "Tüm verileri temizle": dosyalar sunucu kaydından **önce** siliniyor, DELETE yanıtı kontrol edilmiyor, 100+ URL'de sunucu 413 dönüyor, göreli `/api/r2/` URL'leri listeye alınmıyor. Diğer cihaz açılınca "sunucu boş + yerel dolu" kuralıyla veri geri geliyor ama görseller kırık | `storage-service.ts:440-454, 652-657, 693` |
| 🟠 | Yedek indirme göreli `/api/r2` URL'lerini (varsayılan kurulum) ve `etsyGeneratedMockups`'ı içermiyor; yedek medyasız. İçe aktarma ve "Örnek taslak" mevcut veriyi onaysız eziyor | `storage-service.ts:839, 850`; `page.tsx:147-153, 192-196` |
| 🟡 | Klasörler **ada göre** tekilleştiriliyor; aynı adlı misafir klasörü atılınca içindeki öğeler var olmayan klasöre bağlı kalıyor | `storage-service.ts:283-287` |
| 🟡 | Oturum düşünce önceki kullanıcının önbellekteki verisi misafir modunda görünüyor (paylaşılan cihazda gizlilik). Çıkışta Service Worker'ın "apis" önbelleği temizlenmiyor; `/api/*` yanıtları 24 saat cihazda kalıyor | `useWorkspace.ts:109,163`; `sw.ts` (Serwist defaultCache) |
| 🟡 | Google OAuth'ta `state` parametresi yok (login CSRF) | `UserAuthContext.tsx:193`; `auth/google/callback/route.ts` |
| 🟡 | Açılışta aynı çalışma alanı 3 kez tam indiriliyor (iki `forceSync` + ref 0 olduğu için ilk yoklama) | `useWorkspace.ts:163`, `UserAuthContext.tsx` |
| 🟡 | Toast ve Auth context değerleri memo'suz; her toast tüm uygulamayı yeniden render ediyor. Bu yüzden BulkActionModal kendi durumunu sıfırlıyor (§4.7) | `ToastContext.tsx:~123`, `UserAuthContext.tsx:313-328` |

**Öneriler (öncelik sırasıyla):**
1. **Birleştirme hatasını hemen düzelt.** Banner'a `renderedMatches` geçirilmesin. Hesabın üretim sonuçları her zaman IndexedDB'den veya sunucudan okunsun. Kalıcı çözüm: yalnızca eklenen öğeleri gönderen ve sunucuda birleştiren `POST /api/storage/merge`.
2. **Senkron modelini sağlamlaştır:**
   - `loadAppData` sunucunun `updatedAt` değerini döndürsün ve ref bununla başlatılsın. Sürüm gönderilmeyen yazma reddedilsin.
   - 409 gelince "Başka cihazda değişti: yeniden yükle / benimkini koru" seçimi sunulsun.
   - Yoklama, bekleyen yerel kayıt varken veri uygulamasın (dirty flag).
   - UI seçimleri otomatik kayıttan çıkarılsın.
   - Sekmeler arası `BroadcastChannel` eklensin.
3. **Kayıt durumunu görünür yap:** "Kaydediliyor / Kaydedildi / Kaydedilemedi, tekrar dene" göstergesi. 3,8 MB aşımında hangi öğelerin base64 olduğunu listeleyen uyarı. Birleştirme, kayıt başarılı olmadan misafir verisini silmesin.
4. `/api/r2` ve `/api/uploads` rate limit'ten çıkarılsın; medya imzalı ve süreli R2 URL'leriyle sunulsun. Range desteği eklensin.
5. Sekme başına ErrorBoundary ile `error.tsx` ve `global-error.tsx` eklensin; hata ekranında "yedek indir" butonu olsun.
6. Temizleme sırası düzeltilsin: önce sunucu (yanıt kontrollü), sonra dosyalar 100'lük parçalarla, en son yerel veri. Yedek medya ve üretim sonuçlarını da içersin; içe aktarma onay istesin.

### 4.2 Sekme 1: Mockup'lar

**İşleyiş:**
- Klasör çubuğu, sol listede yükleme ve toplu işlemler, ortada tuval (sürüklenebilir baskı alanları), sağda ayarlar paneli var (mobilde alt çekmece).
- Görseller en fazla 2000 px WebP'ye optimize edilip R2'ye yükleniyor. Videolar tarayıcıda 720p webm'e kodlanıyor.
- Baskı alanı düzenlemeleri yerel taslakta tutuluyor ve "Kaydet" ile yazılıyor.

| Önem | Bulgu | Konum |
|---|---|---|
| 🔴 | Klasör çoğaltma aynı `src` URL'sini kopyalıyor. Tekil, toplu ve klasör silme ile kırpma, URL'nin başka mockup'ta kullanılıp kullanılmadığına bakmadan R2'den siliyor; diğer kopyalar kırılıyor | `MockupCanvasEditor.tsx:178-184, 205-207, 315-321, 341-347, 374-376` |
| 🟠 | Kaydedilmemiş taslak uyarısız kayboluyor: başka mockup seçmek, yükleme yapmak veya sekme değiştirmek taslağı siliyor | `useMockupDraft.ts:24-34`; `page.tsx:444` |
| 🟠 | Kırpma görseli 1500×1500 kareye çeviriyor, ama `width/height/printAreas` güncellenmiyor. Editördeki baskı alanı konumu üretimdekiyle tutmuyor; ayrıca 2000 px'ten 1500 px'e kalite kaybı oluyor | `MockupCanvasEditor.tsx:378-380`; `InteractiveCropModal.tsx:15` |
| 🟠 | "Klasör Şablon Ayarları" kategori listesini admin-only uçtan çekiyor; normal kullanıcıda boş kalıyor ve "Admin panelinden aktifleştir" diyor. Örnek klasörlerde kayıt global PK çakışmasıyla 500 veriyor | `MockupFolderTemplatePanel.tsx:132, 368-377`; `templates/folder-config/route.ts:68-74` |
| 🟡 | Seçim (`selectedIds`) klasör değişince temizlenmiyor; toplu sil/taşı/uygula ekranda görünmeyen öğeleri de etkiliyor | `MockupCanvasEditor.tsx:186` |
| 🟡 | "Tüm Mockup'lar" görünümünde yükleme sessizce ilk klasöre gidiyor (klasör yoksa var olmayan `'folder-women'` klasörüne). Yeni mockup, seçili mockup'ın kaydedilmemiş taslak alanlarını devralıyor | `useMockupUpload.ts:86, 194` |
| 🟡 | Video: Safari'de `MediaRecorder` vp9 desteklemezse promise hiç çözülmüyor ve yükleme takılıyor. Ses kayboluyor. İstemci 100 MB'a izin veriyor, sunucu 50 MB'ta kesiyor | `video-optimizer.ts:64-67`; `useMockupUpload.ts:108`; `upload-security.ts:5` |
| 🟡 | Mobilde klasör çubuğunu kaydırırken sıralama değişebiliyor (touch sürükleme tüm pill'de); `pointercancel` dinlenmiyor | `MockupFolderBar.tsx:184-186`; `useMockupTransform.ts:149-156` |
| 🟡 | Sürüklemede `transition-all` yüzünden 150 ms gecikme ("lastik" hissi) | `MockupCanvasWorkspace.tsx:173` |
| 🔵 | Baskı alanı için sayısal x/y/genişlik/yükseklik girişi ve ok tuşuyla kaydırma yok. Liste küçük resimleri tam çözünürlükte yükleniyor | `MockupSettingsPanel.tsx`; `MockupSidebarList.tsx:441-451` |

**Öneriler:**
1. Silmeden önce referans kontrolü yap: URL başka bir mockup, tasarım veya üretim sonucunda kullanılıyorsa dosya silinmesin.
2. Taslak varken "Kaydet / Vazgeç" sor (mockup değişimi, yükleme, sekme değişimi).
3. Kırpmada baskı alanlarını yeni koordinatlara dönüştür (`x' = (x·W − srcX)/srcSize`) ve boyutu güncelle; çıktı boyutu `min(srcSize, 2000)` olsun.
4. Klasör paneli için kullanıcıya açık bir "aktif kategoriler" ucu ekle; şablon kimliği `userId + folderId`'den türetilsin.
5. Yükleme hedef klasörü açıkça seçilsin; toast'ta klasör adı yazsın.
6. Sayısal konum ve boyut girişleri, ok tuşu desteği ve 256 px küçük resim üretimi ekle.

### 4.3 Sekme 2: Tasarımlar

**İşleyiş:**
- Tasarımlar sürükle-bırak ya da AI ile üretilerek ekleniyor (Gemini, yeşil arka plan, ardından chroma key).
- Kart menüsünde analiz (vision + Etsy anahtar kelime taraması), kırp, arka planı kaldır, renk uyarla, taşı ve sil var.
- Her kumaş "slotu" için tek bir aktif tasarım olabiliyor.

| Önem | Bulgu | Konum |
|---|---|---|
| 🔴 | AI tasarım kaydı `uploadMediaToServer(dataUrl, 'ai-design-….png')` ile yapılıyor; ikinci parametre MIME bekliyor. Yükleme 415/400 alıyor ve 1-2 MB base64 state'e giriyor, sonunda senkron sessizce duruyor. Ek sorunlar: boyut 1024 sabit, `targetApparel` yok, tipte olmayan `isProductionActive` alanı kullanılıyor. Bu tasarımlar slot kuralını atlıyor ve açık/koyu mockup'larla hiç eşleşmiyor | `AIDesignGeneratorModal.tsx:169-178`; `image-optimizer.ts:71,85,131`; `useDesignSelection.ts:68-75` |
| 🟠 | "Arka Planı Kaldır" yalnızca yeşil tonu siliyor (eşik parametreleri yok sayılıyor). Normal bir tasarımda arka plan kalmıyor ama yeşil/turkuaz pikseller şeffaflaşıyor. Sonuç **orijinalin üzerine yazılıyor**, onay ve geri alma yok | `chroma-key.ts:86-88, 113-122`; `DesignUploader.tsx:242-248` |
| 🟠 | "Renk Uyarla" yeni kopyaya `isSelected` ve `targetApparel` alanlarını aynen taşıyor; aynı slotta iki aktif tasarım oluşuyor, kumaş da yanlış kalıyor | `DesignUploader.tsx:278-284` |
| 🟠 | Tekil tasarım silme onaysız ve R2'den kalıcı | `DesignItemMenu.tsx:412-416` |
| 🟡 | Analiz isteği vision çağrısının ardından sıralı Etsy taraması yaptığı için 60 sn'yi aşabiliyor. Toplu analizde hata olsa bile "Tümü tamamlandı" deniyor. Analiz anahtar kelimeleri trademark filtresinden geçmiyor | `analyze/route.ts:15, 377-438`; `useDesignAnalysis.ts:78-81` |
| 🟡 | Trademark listesi: `pooh`, `winnie the pooh`'dan önce geldiği için metinde "winnie the" kalıyor. "champion", "peanuts", "yeti" gibi genel kelimeler siliniyor ("Peanuts lover tee" → "lover tee") | `trademark-shield.ts:14-15, 148-157` |
| 🟡 | Misafire AI üret, arka plan kaldır ve renk uyarla butonları görünüyor, tıklayınca İngilizce "Unauthorized" çıkıyor | `DesignItemMenu.tsx`, `DesignUploadZone.tsx` |
| 🟡 | Renk uyarlama opak (JPEG) görselde kenara çerçeve çiziyor. Kırpma modalında görsel yüklenemezse sonsuz "Yükleniyor..." kalıyor | `recolor.ts:79-81`; `InteractiveCropModal.tsx:92-102` |

**Öneriler:**
1. AI kaydında MIME düzeltilsin (`blob.type` öncelikli olsun) ve `requireDurable: true` kullanılsın. Gerçek boyutlar ve kullanıcının seçtiği kumaş alanı yazılsın.
2. Arka plan kaldırma sonucu **yeni tasarım** olarak eklensin ya da önce önizleme ve onay gösterilsin. Buton adı "Yeşil arka planı kaldır" olsun; ya da gerçek bir arka plan kaldırma modeline geçilsin.
3. Renk uyarlama `isSelected:false` ve doğru kumaş tipiyle kopyalasın.
4. Silme onaylı olsun ve "Geri al" sunulsun.
5. Analiz iki aşamaya ayrılsın: vision sonucu hemen dönsün, anahtar kelime puanları arka planda dolsun. Trademark filtresi analizde de uygulansın.
6. Misafirde AI butonları kilit ikonu ve "Giriş yapın" ipucuyla gösterilsin.

### 4.4 Sekme 3a: Toplu Üretim (Manuel)

**İşleyiş:**
- Aktif tasarımlar baskı alanlı mockup'larla kumaş tipine göre eşleştiriliyor. Statik görseller ve videolar birer kez ekleniyor.
- Tarayıcıda sırayla canvas'ta render ediliyor ve sonuçlar bellekte tutuluyor.
- "Etsy'ye Gönder" sonuçları R2'ye yükleyip `etsyGeneratedMockups`'a yazıyor; SEO sekmesi bunu okuyor.

| Önem | Bulgu | Konum |
|---|---|---|
| 🟠 | Uygunluk sınırı 22 öğe (görsel/video ayrımı yok). SEO 22 gönderiyor, preflight 20 fotoğrafta reddediyor, yayın yalnızca 1 video yüklüyor. Arayüz her yerde "20 görsel + 2 video" diyor | `useBatchGenerator.ts:52-61, 81, 143`; `EtsySeoContext.tsx:1324-1327`; `etsy-preflight.ts:4,70` |
| 🟠 | "Etsy'ye Gönder" `saveAppData` sonucunu kontrol etmiyor; kayıt başarısız olsa da konfeti çıkıyor. Yükleme hatasında diğer işçiler yüklemeye devam ediyor (sahipsiz dosyalar). Uzun yükleme öncesi alınan anlık görüntü sonradan geri yazılıyor | `useBatchGenerator.ts:311, 361-371, 379` |
| 🟠 | Sonuçlar yenilemede kayboluyor (`renderedMatches` kalıcı değil). "Yeniden Üret" kaydedilmemiş sonuçları onaysız siliyor | `useWorkspace.ts:47-48`; `BatchHeader.tsx:55-68` |
| 🟡 | Render ana thread'de, sırayla ve `toDataURL` ile yapılıyor; 22 büyük görselde arayüz saniyelerce donuyor. İlerleme yalnızca toast'ta; iptal butonu yok. Başarısız render'lar sessizce düşüyor | `canvas-renderer.ts:72-151`; `useBatchGenerator.ts:243-263` |
| 🟡 | `square` modunda mockup kareye **gerdiriliyor** (kırpma yok). WebP desteklenmezse PNG üretiliyor ama `.webp` olarak etiketleniyor | `canvas-renderer.ts:82-95, 147-150` |
| 🟡 | Üst menüdeki üretim rozeti, tasarım klasörünü yok sayarak hesaplıyor; ekrandaki sayıyla farklı çıkıyor | `page.tsx:268` |
| 🔵 | İndirme butonu yalnızca hover'da görünüyor (dokunmatikte erişilemez). "Temizle" etiketi tanımsız `xs:` breakpoint'i yüzünden hiç görünmüyor | `BatchResultCard.tsx:23-31`; `BatchHeader.tsx:101` |

**Öneriler:**
1. Etsy limitleri tek kaynaktan alınsın (`etsy-preflight.ts`): görsel ≤20, video ≤1. Tüm metinler buna göre güncellensin.
2. Kayıt sonucu kontrol edilsin; ilk hatada kuyruk dursun. Yalnızca `etsyGeneratedMockups` alanını yazan dar bir uç kullanılsın.
3. Sonuçlar IndexedDB'de Blob olarak saklansın; "Yeniden üret" onay istesin.
4. Render Web Worker'a taşınsın (OffscreenCanvas, 2-3 eşzamanlı). Sayfa içi ilerleme çubuğu ve iptal eklensin; başarısız sayısı raporlansın.
5. Kare modunda cover/contain kullanılsın; aktif tasarım yoksa üretim engellensin.

### 4.5 Sekme 3b: Otomasyon Şablonları

**İşleyiş:**
- 4 adımlı sihirbazla şablon oluşturuluyor: görseller, varyasyonlar, SEO ipuçları, zamanlama.
- "Şimdi Çalıştır" ya da saatlik GitHub Actions cron'u sunucuda pipeline'ı başlatıyor: AI tasarım → yeşil arka plan kaldırma → R2 → çalışma alanına ekleme → **ilk** mockup'ın **ilk** baskı alanına render → Veo video. SEO ve ilan adımları atlanıyor.

| Önem | Bulgu | Konum |
|---|---|---|
| 🟠 | Hiç okunmayan ayarlar: `variationConfig`, `publishMode`, `staticMockupIds`, `videoMockupIds`, `fabricType`, `multiPrintAreaSupport`, `seoHints.productType`, klasör panelindeki `variationTemplateId`/`taxonomyId`. SEO ve ilan adımları `skipped`, ama sayaç +1 ve kartta "X listing üretildi" yazıyor | `automation-runner.ts:135-201`; `TemplatesManager.tsx` |
| 🟠 | Video tek başına 5 dk'ya kadar bekliyor; toplam bütçe de 300 sn. Fonksiyon öldürülünce run "running"de kalıyor ve "Şimdi Çalıştır" kilitleniyor; yalnızca cron 30 dk sonra temizliyor | `ai-provider.ts:344-351`; `automation/run/route.ts:26`; `automation-runner.ts:214-266` |
| 🟠 | Çalışma alanına tasarım ekleme oku-değiştir-yaz yöntemiyle yapılıyor ve `updatedAt` güncellenmiyor. Paralel run'lar birbirini eziyor; istemci değişikliği görmüyor ve sonraki otomatik kaydı AI tasarımını siliyor | `automation-runner.ts:118-125` |
| 🟡 | Arayüzde "Her Pazartesi" / "Her ayın 1'i" seçenekleri var, ama zamanlayıcı yalnızca saat alanını destekliyor; bu şablonlar **hiç çalışmaz**. `listingsPerRun=10` seçilebiliyor, şema en fazla 5'e izin veriyor (400 hatası) | `automation-schedule.ts`; `ScheduleSection.tsx:51`; `validation/templates.ts:53` |
| 🟡 | Düzenleme pasif şablonu sessizce aktif ediyor (`isActive: true` sabit) | `TemplateBuilderModal.tsx:128` |
| 🟡 | Varyasyon tablosunda beden veya renk eklemek tüm matrisi baştan kuruyor; satır bazlı fiyat, stok ve SKU düzenlemeleri kayboluyor. Temel fiyat yalnızca "Tümüne uygula" ile kaydediliyor | `VariationSection.tsx:44, 51-73` |
| 🟡 | "SEO notları" alanı doluysa prompt'un **tamamı** oluyor; niş ve hedef kitle atılıyor ("şiddet içermesin" tek başına prompt olur). Aynı run'daki kopyalar aynı prompt'la neredeyse aynı tasarımları üretiyor | `automation-runner.ts:74-86` |
| 🟡 | Veo videosu tasarımdan bağımsız (yalnızca metin) ve şablon istemese de her run'da üretiliyor (maliyet). `videoBytes` varsa base64 olarak DB'ye yazılıyor | `automation-runner.ts:167-188` |
| 🔵 | Klasör paneli kaydı şablon listesinde açıklama olarak ham JSON gösteriyor; gövde doğrulanmıyor | `folder-config/route.ts:26-73` |

**Öneriler:** Hızlı dürüstlük düzeltmeleri hemen, pipeline'ın tamamlanması ayrı bir faz olarak:
1. **Hemen:**
   - Etkisiz ayarlara "yakında" rozeti konsun ya da bu ayarlar gizlensin.
   - "listing üretildi" → "çalıştırma tamamlandı".
   - 10 seçeneği ve haftalık/aylık ön ayarlar kaldırılsın.
   - `isActive` korunsun; temel fiyat anında kaydedilsin.
2. **Sağlamlık:**
   - Çalışma alanına ekleme atomik JSONB append ile yapılsın ve `updated_at` güncellensin.
   - Takılı run kontrolü "Şimdi Çalıştır" isteğinde de yapılsın; "İptal" butonu eklensin.
   - Video yalnızca istenirse üretilsin.
3. **Pipeline'ı tamamlama (öneri fazları):**
   - Faz 0: Yayın ve ilan üretim mantığını route'lardan servis katmanına taşı (`createEtsyListing`, `generateListingContent`, `analyzeDesign`). Pipeline adım adım devam ettirilebilir olsun: her çağrı bir adım çalıştırsın, durumu kaydetsin ve sonraki çağrıyı tetiklesin.
   - Faz 1: Şablona "Etsy İlan Ayarları" adımı ekle: kargo profili (zorunlu), iade, hazırlık süresi, kategori, who_made, varyasyon şablonu.
   - Faz 2: Tüm seçili mockup'ları render et; kumaş filtresi, statik ve video mockup'ları uygula. Çıktılar SEO sekmesinde görünsün.
   - Faz 3: SEO adımı: vision analizi → anahtar kelime zenginleştirme → `generateListingContent` → trademark temizliği.
   - Faz 4: İlan adımı: varsayılan **her zaman taslak**. Canlı yayın için sunucu bayrağı, şablona kayıtlı tarihli onay ve günlük kota şartı. `runId` ile idempotency.
   - Faz 5: `nextRunAt` hesaplanıp karta yazılsın, kaçırılan saatler telafi edilsin. Run detay çekmecesi (adımlar, çıktılar, Etsy bağlantısı) ve "kuru çalıştırma" eklensin.

### 4.6 Sekme 4: Etsy SEO ve Yayınlama

**İşleyiş:**
- Toplu üretim klasörleri galeri olarak gösteriliyor.
- AI metin üretimi (`generate-listing`) anahtar kelime havuzu, sezon bonusu, trademark temizliği ve Gemini/OpenRouter ile çalışıyor.
- Varyasyon matrisi (ürün × beden × renk) ve mağaza parametreleri (kargo, iade, bölüm, kategori) burada ayarlanıyor.
- Yayın sunucuda şu sırayla ilerliyor: taslak oluştur → özellikler → envanter → görseller → video → (istenirse) aktifleştir.

| Önem | Bulgu | Konum |
|---|---|---|
| 🟠 | Yayın: yüklenemeyen görsel `continue` ile atlanıyor ve hataya eklenmiyor; canlı kontrolü yalnızca "≥1 görsel" şartına bakıyor. Kısmi başarısızlıkta taslak temizlenmiyor ve `success:true` dönülüyor. Etsy hata gövdesi atılıyor. `maxDuration=60` altında sıralı 20+ yükleme, 429 yönetimi yok. Video bekleme koşulu yanlış (gereksiz 5 sn) | `etsy/publish/route.ts:20, 331-333, 449-452, 504-507, 536, 549, 665-676` |
| 🟠 | Mükerrer ilan: taslak butonu başarıdan sonra tekrar basılabiliyor ve her seferinde yeni ilan açıyor | `SeoPublishSection.tsx:94-101` |
| 🟠 | Varsayılan `who_made='someone_else'`, `is_supply=false`; sunucudaki yorum POD için `i_did` gerektiğini kendisi söylüyor. Etsy bu kombinasyonu bitmiş ürün için reddeder (Etsy dokümantasyonuyla teyit edilmeli) | `EtsySeoContext.tsx:128-130`; `publish/route.ts:271-272` |
| 🟠 | AI girdileri: sabit `primaryAesthetic: 'cottagecore botanical wildflower'`. Konu tespiti `includes` ile yapılıyor ("vacation", "education" → kedi). Sunucu filtresi "vacation tee", hatta Q4'te "christmas" etiketlerini siliyor. Verisi olmayan kelimelere 75/80 skor uyduruluyor ve UI "gerçek Etsy arama puanları" diyor | `EtsySeoContext.tsx:838-868, 902`; `generate-listing/route.ts:189, 212, 376-384`; `SeoAiCopySection.tsx:189` |
| 🟠 | Klasör değişince seçili tasarımda kayıtlı SEO yoksa önceki klasörün başlık ve etiketleri kalıyor; B klasörü A'nın metniyle yayınlanabilir. "Yeniden üret" düzenlemelerin ve varyasyon tablosunun üzerine onaysız yazıyor | `EtsySeoContext.tsx:224-228, 948-961` |
| 🟠 | Toplu varyasyon senkronu, seçili canlı ilanların envanterini önizleme ve yedek olmadan tamamen değiştiriyor. `price/quantity` için `|| 0` varsayılanı var. "Tümünü seç" kaldırılmış ilanları da seçiyor ve 100'ü geçince hata veriyor. Bu modal arkada ikinci bir modal açıyor | `update-variations/route.ts:240-241, 279-290`; `VariationModals.tsx:209-251`; `EtsySeoContext.tsx:1018-1022` |
| 🟡 | İki ayrı "SEO Skoru" algoritması var: Studio yalnızca etiketlere bakıyor ve **sıfır etiketle 60/100** veriyor; İlanlarım başlık, etiket ve açıklamaya bakıyor. Aynı ilan iki sekmede farklı puan ve harf notu alıyor | `TagMatrixScore.tsx:211-247`; `etsy-seo-evaluator.ts` |
| 🟡 | Etiket ve başlıkta Etsy karakter kuralları uygulanmıyor (etikette `&` veya virgül tüm isteği bozar). Manuel etiket ekleme alanı yok; rakip listesinden 20 karakteri aşan etiket eklenebiliyor | `publish/route.ts:231, 300, 306`; `SeoAiCopySection.tsx` |
| 🟡 | Her alt sekme değişiminde 4 Etsy proxy çağrısı ve tam ilan listesi yeniden çekiliyor. Kategori özellikleri iki kez çekiliyor ve her tuş vuruşunda istek gidiyor | `EtsySeoContext.tsx:753-817` |
| 🟡 | 1477 satırlık tek context, ~150 alan, memo yok. Başlıkta her tuş vuruşu galeriyi, akordiyonu, skor ve SERP bileşenlerini yeniden çiziyor. 400 satırlık varyasyon tablosu O(n²) | `EtsySeoContext.tsx:1356-1455`; `VariationTableView.tsx:94-97` |
| 🟡 | Sekme değişince Studio state'i (başlık, varyasyon tablosu, mağaza seçimleri) kayboluyor; taslak kalıcılığı yok | `page.tsx` (koşullu render) |
| 🔵 | `tabs/EtsyPublisher.tsx` (441 satır) hiçbir yerden kullanılmıyor (ölü kod). Kategori ham sayı input'u; varsayılanlar çelişkili (1081 / 482) | `EtsySeoContext.tsx:127, 872` |

**Öneriler:**
1. **Yayını aşamalara böl:** (1) taslak oluştur ve `listingId` dön, (2) görselleri istemci tek tek ayrı isteklerle yüklesin (ilerleme çubuğu, 60 sn sınırı yok), (3) envanter, (4) aktivasyon. Her eksik medya hataya yazılsın; canlı yayın için "beklenen = yüklenen" kuralı uygulansın. Etsy hata metni kullanıcıya gösterilsin. `klasör → listingId` eşlemesiyle mükerrer yayın engellensin ("Bu klasör zaten #123 olarak aktarıldı, güncellensin mi?").
2. `who_made` varsayılanı `i_did` olsun; geçersiz kombinasyon sunucuda reddedilsin.
3. AI girdileri düzeltilsin: tasarım analizindeki gerçek estetik kullanılsın, kelime sınırı regex'i (`\bcat\b`) uygulansın, sezon temaları filtreden muaf olsun, veri yoksa skor yerine "veri yok" yazsın.
4. Klasör değişince metin alanları temizlensin; yeniden üretimden önce onay alınsın.
5. Toplu envanter değişikliğinde önce yedek alınsın, diff önizlemesi ve yazılı onay istensin, "Geri al" sunulsun.
6. **Tek SEO skor motoru:** `evaluateEtsyListingSeo` istemcide de kullanılsın; Studio'da canlı skor gösterilsin, boş etikete 0 verilsin.
7. Yayın kartında preflight kontrol listesi olsun; kargo ve hazırlık süresi açıkça seçilsin.
8. Etsy karakter kuralları için paylaşılan bir doğrulayıcı ve manuel etiket girişi eklensin.
9. Context Gallery, Copy, StoreParams, Variations ve Publish olarak bölünsün; mağaza verileri bir kez çekilip önbelleğe alınsın; Studio taslağı klasör bazında kalıcı olsun.

### 4.7 Sekme 5: Etsy İlanlarım

**İşleyiş:**
- İlanlar Etsy'den 3 durumda (active/draft/inactive) sayfalanarak çekiliyor, SEO skoruyla DB'ye önbelleğe alınıyor; 24 saat eskiyse otomatik senkron yapılıyor.
- Detay modalında SEO analizi, vision analizi, AI optimizasyonu ve düzenleme var. Toplu işlemler istemcide parça parça çalışıyor.

| Önem | Bulgu | Konum |
|---|---|---|
| 🔴 | **Yanlış "kaldırıldı" işaretleme:** hata alan sayfa sessizce bitiyor, `expired`/`sold_out` çekilmiyor, 300+ ilanda erken çıkış var. Çekilemeyen her ilan `removed` yapılıyor; bunlar listede kalıp istatistikte "inactive" sayılıyor | `etsy/listings/route.ts:116-118, 250-275, 346-350, 527-536` |
| 🟠 | **Düzenleme akışı:** istemci her zaman `state` gönderiyor, sunucu `draft` dışını reddediyor; aktif ilan güncellenemiyor. "Taslak" seçilirse canlı ilan gizleniyor ve "canlı olarak güncellendi 🎉" yazıyor | `ListingDetailModal.tsx:107, 247, 265`; `listings/update/route.ts:35-37` |
| 🟠 | Modal açılınca açıklama, SEO kırılımı ve önceki AI önerileri boş geliyor: liste sorgusu ağır alanları dışarıda bırakıyor, detay ucu (`?listing_id=`) hiçbir bileşen tarafından çağrılmıyor | `listings/route.ts:76-100` |
| 🟠 | Toplu işlem modalı her toast'ta kendini sıfırlıyor (`selectedListings` her render'da yeni dizi, toast context'i memo'suz); ilerleme 0'a dönüyor, bitiş raporu kayboluyor. Vision ve optimize 10 istek/10 dk ile sınırlı, ama istemci sınırsız istek atıyor; 11. ilandan itibaren hepsi 429 | `BulkActionModal.tsx:46-57, 100, 129-133`; `EtsyListingManager.tsx:301` |
| 🟡 | `evaluate-seo` tarama başarısız olsa bile (metrikler 0) kaydın üzerine yazıp "taze" işaretliyor; 7 gün boyunca bozuk veri kalıyor. Bu uçta rate limit yok ve tarama 60 sn'yi aşabiliyor | `evaluate-seo/route.ts:111-137` |
| 🟡 | Vision analizi skoru hiç etkilemiyor (`consistencyScore` hesaplanmıyor), ama arayüz "skoru yenile" diyor. Havuz önerileri nişten bağımsız global kelimeler | `etsy-seo-evaluator.ts:57, 95, 501-505` |
| 🟡 | Bağlantı yoksa bu sekmede "Etsy'yi bağla" butonu yok (yalnızca SEO sekmesinde). "En yeni" sıralaması her senkronda güncellenen `updated_at`'e göre yapılıyor | `EtsyListingManager.tsx`; `listings/route.ts:190-192, 522` |
| 🔵 | Sayfalama veya sanallaştırma yok; tüm ilanlar render ediliyor. Sunucudaki filtre parametreleri kullanılmıyor | `EtsyListingManager.tsx` |

**Öneriler:**
1. **Senkron:** `removed` yalnızca tam modda ve tüm sayfalar başarılıysa (toplam sayı tutuyorsa) işaretlensin. Tüm durumlar çekilsin. 429'da `Retry-After` ile backoff yapılsın. Yanıta `partial:true` eklensin ve arayüzde gösterilsin.
2. **Düzenleme:** `state` yalnızca değiştiyse gönderilsin; durum değişikliği ayrı ve onaylı bir aksiyon olsun. Modal açılınca tam kayıt çekilsin. Göndermeden önce eski/yeni farkı gösterilsin.
3. **Toplu işlem:** reset yalnızca modal açılırken yapılsın; context'ler memoize edilsin. Kalan kota gösterilsin, 429'da durulsun, iptal butonu eklensin.
4. `evaluate-seo` hatalı taramada üzerine yazmasın; rate limit eklensin, etiket sayısı sınırlansın.
5. "Etsy'yi bağla" CTA'sı eklensin; sayfalama ve sıralama `etsy_updated_timestamp` ile yapılsın.

### 4.8 Admin Paneli

**İşleyiş:** 6 sekme var: Genel Özet, Yapay Zeka, Kelime Havuzu, Etsy Kategorileri, Kullanıcılar, Ayarlar ve Bakım. Sunucu tarafında `requireAdmin` ile korunuyor.

| Önem | Bulgu | Konum |
|---|---|---|
| 🟠 | "Mevcut çalışma alanımı genel örnek taslak yap" **etkisiz**: istemci örnek veriyi derlenmiş statik dosyadan okuyor. Uç, çalışma zamanında `src/lib/sample-data.ts` dosyasına yazmaya çalışıyor; admin'in R2 görselleri de diğer kullanıcılara 403 veriyor | `admin/sample-data/route.ts:129-176`; `storage-service.ts:607-618`; `r2/[...key]/route.ts:35` |
| 🟠 | Kullanıcı rolü ve engelleme işlemleri onaysız; toast sunucu yanıtından önce çıkıyor. Değerler doğrulanmıyor, audit log'a yazılmıyor. Kendini admin'likten düşürme ve son admin'i kaldırma koruması yok | `AdminDashboard.tsx:474-509`; `users/route.ts:51-66` |
| 🟠 | "Kullanıcıyı sil" yalnızca `users` satırını siliyor; çalışma alanı, Etsy token'ları ve R2 dosyaları kalıyor. Kullanıcı tekrar girince eski verisine kavuşuyor | `users/route.ts:159-161` |
| 🟡 | Video modeli ayarları kaydediliyor ama kullanılmıyor (yalnızca env okunuyor). AI ayarları üç kaynaktan geliyor (localStorage, kişisel çalışma alanı, global ayar) ve bunlar yarışıyor. Kayıt yanıtı kontrol edilmiyor | `ai-provider.ts:120`; `AdminAiSettingsSection.tsx:346-424, 521-536` |
| 🟡 | Varsayılan prompt'lar ilk kayıtta DB'ye yazılıyor; koddaki sonraki prompt iyileştirmeleri bir daha uygulanmıyor | `AdminAiSettingsSection.tsx:425-447` |
| 🟡 | "Tüm havuzu tara" 20'lik partiler gönderiyor, sunucu limiti 10 istek/10 dk; 200 kelimeden sonra 429 ile duruyor. Onay metni "tüm kelimeler" diyor, ama yalnızca 7 günden eski olanlar seçiliyor | `KeywordPoolManagement.tsx:263-311`; `keywords/evaluate/route.ts:16, 49-55` |
| 🟡 | Bilgi mimarisi: "Yapay Zeka" sekmesinde Etsy anahtarı, scraping ve Worker ayarları da var. "Bakım" sekmesindeki temizlik kartı "PostgreSQL kayıtlarını temizler" diyor, ama R2 dosyalarını siliyor. Üst bilgideki "PostgreSQL Aktif / OpenRouter Tanımlı" rozetleri sabit kodlanmış | `AdminSettingsSection.tsx:168-170`; `AdminDashboard.tsx:259-268` |
| 🔵 | `/api/admin/audit-logs` var ama arayüzü yok. Kullanım ve maliyet paneli, kullanıcı arama ve sayfalama yok. `/admin/taxonomy` sayfası linksiz ve "Yetki doğrulandı" yazısı yanıltıcı | — |

**Öneriler:**
1. Örnek taslak, herkese açık bir `GET /api/sample-data` ile DB'den beslensin ve medya paylaşılan bir öneke kopyalansın; ya da özellik kaldırılsın.
2. Kullanıcı işlemleri onaylı olsun; sonuç sunucu yanıtına göre gösterilsin, audit log'a yazılsın, son admin korunsun. Silme bütün kullanıcı verisini temizlesin.
3. AI ayarları için tek kaynak `app_settings` olsun. Video modeli bağlansın ya da kaldırılsın. Prompt alanı "varsayılanı kullan / özel" olarak ayrılsın.
4. Sekmeler yeniden düzenlensin: **Yapay Zeka**, **Entegrasyonlar** (Etsy, scraping, R2), **Kelime Havuzu**, **Kategoriler**, **Kullanıcılar**, **Bakım ve Denetim** (DB, R2 temizliği, audit log görüntüleyici).
5. Basit bir kullanım paneli eklensin: kullanıcı başına AI çağrısı ve depolama.

---

## 5. Performans ve Optimizasyon (Özet)

| Konu | Mevcut durum | Öneri | Beklenen etki |
|---|---|---|---|
| Otomatik kayıt | Her UI tıklamasında tam belge POST ediliyor | UI state'i kayıttan çıkar; yalnızca değişen alanları gönder | Sunucu yükü ve çakışmalar büyük ölçüde azalır |
| Açılış | Çalışma alanı 3 kez tam indiriliyor | Tek `forceSync`, ref'i sunucu sürümüyle başlat | Daha hızlı ilk yükleme |
| Yoklama | Görünür sekme başına 5 sn'de 2 DB sorgusu (günde ~35 bin) | 20–30 sn + `focus`/`visibilitychange` tetiklemesi | ~%80 daha az sorgu |
| Medya sunumu | Her görselde DB oturum sorgusu, tam tampon, rate limit sayımı | İmzalı R2/CDN URL'leri, değişmez önbellek, Range | Galeri hızı ve 429 riski ortadan kalkar |
| Küçük resimler | 48 px kart için 2000 px görsel decode ediliyor | Yüklemede 256 px thumbnail, `loading="lazy"` | Bellek ve bant genişliğinde büyük düşüş |
| Toplu render | Ana thread'de sıralı `toDataURL` | Worker + OffscreenCanvas + Blob/ObjectURL | Arayüz donması biter |
| Context'ler | Toast, Auth ve SEO context değerleri memo'suz | `useMemo`/`useCallback`, SEO context'ini bölme | Gereksiz yeniden render'lar biter |
| Admin | Her açılışta tüm R2 bucket'ı listeleniyor; büyük sekmeler statik import | Sonucu 10 dk önbelleğe al; `next/dynamic` | Admin daha hızlı açılır |
| Sunucu pikseli | chroma-key piksel başına nesne, recolor O(r²) | Typed array döngüsü, sharp ile maske | Daha kısa AI pipeline süresi |
| AI maliyeti | Vision ve optimize önbelleksiz, Veo her run'da | Görsel ve başlık hash önbelleği, video isteğe bağlı | Doğrudan maliyet tasarrufu |

## 6. Erişilebilirlik (Özet)
- Kart, klasör pill'i ve sekme gibi birçok etkileşimli öğe `div onClick`; klavye ile odaklanılamıyor. Bunlar `button` ya da `role="tab"/"option"` + `tabIndex` olmalı.
- Modalların çoğunda `role="dialog"`, Escape ve odak tuzağı yok. Ortak bir `Dialog` bileşeni kullanılmalı.
- `ConfirmModal` odağı **onay** butonuna veriyor; Enter'a basmak yıkıcı işlemi onaylıyor. Varsayılan odak "İptal" olmalı.
- Hover ile görünen kontroller (indirme, sil, sırala) dokunmatik ve klavyeyle erişilemez. `focus-within` ile ya da her zaman görünür olmalı.
- Baskı alanları ve varyasyon "sürükle-doldur" özelliği yalnızca fare ile çalışıyor; klavye alternatifi eklenmeli.
- `alert()` ve `confirm()` kullanan yerler (şablon silme, kelime havuzu, engelleme mesajları) toast ve ConfirmModal'a geçirilmeli.

---

## 7. Önerilen Yol Haritası

| Faz | Kapsam | Gerekçe | Tahmini büyüklük |
|---|---|---|---|
| **Faz 1: Veri güvenliği (acil)** | §1.1 #1–#5: birleştirme veri kaybı, OCC ve 409 akışı, görünür kayıt durumu, AI tasarım yüklemesi, paylaşılan dosya referans kontrolü, UI state'inin kayıttan çıkarılması | Kullanıcı verisi kalıcı olarak kaybolabiliyor | Orta (2–3 gün) |
| **Faz 2: Etsy güvenilirliği** | İlan senkronunda `removed` düzeltmesi, ilan düzenleme akışı, yayının aşamalara bölünmesi + eksik medya + idempotency, `who_made`, 20/1 medya limiti, toplu işlem modalı, rate limit uyumu, Etsy hata mesajları | Canlı mağazaya yanlış veya eksik işlem riski | Orta-büyük (3–5 gün) |
| **Faz 3: Arayüz tutarlılığı ve dürüstlük** | Kumaş terminolojisi, onay ve "Geri al" standardı, kilitli sekmeler, başlangıç kontrol listesi, yayın kontrol listesi, SEO adım sırası, etkisiz ayarların gizlenmesi/etiketlenmesi, admin bilgi mimarisi, OAuth mesajları, ErrorBoundary | Kullanıcının ne olduğunu anlaması ve güvenmesi | Orta (2–4 gün) |
| **Faz 4: AI kalitesi** | Sabit estetiğin kaldırılması, kelime sınırlı konu tespiti, uydurma skorların kaldırılması, tek SEO skor motoru, trademark listesi düzeltmeleri, analizde trademark filtresi | İlan kalitesi doğrudan satışa etki eder | Küçük-orta (1–2 gün) |
| **Faz 5: Otomasyonu tamamlama** | §4.5 Faz 0–5: servis katmanı, adım adım pipeline, şablonda Etsy ayarları, SEO ve ilan adımları, zamanlama telafisi, run detayları | "Kur ve unut" vaadinin gerçekleşmesi | Büyük (5–8 gün) |
| **Faz 6: Performans ve erişilebilirlik** | §5 ve §6: thumbnail, Worker render, medya CDN, context bölme, yoklama aralığı, ortak Dialog, klavye desteği | Büyüyen kullanıcı ve veri hacmine hazırlık | Orta (3–4 gün) |

Önerilen sıra: **Faz 1 → 2 → 4 → 3 → 6 → 5.** Faz 4 küçük ve etkisi yüksek olduğu için öne alınabilir. Faz 5, Faz 2'deki yayın servis katmanını yeniden kullanacağı için ondan sonra gelmeli.

---

## 8. Etsy API ile Teyit Edilmesi Gerekenler
Aşağıdaki maddelerde kodun davranışı kesin, ancak Etsy'nin bu davranışa vereceği yanıt Etsy Open API v3 dokümantasyonu veya bir test mağazasıyla doğrulanmalı:
- `who_made=someone_else` + `is_supply=false` kombinasyonunun bitmiş ürün için reddedilmesi
- `when_made` için `2020_2026` değerinin geçerliliği
- `sku_on_property: []` iken ürün bazında farklı SKU gönderilmesi
- Envanter tekliflerinde `readiness_state_id` zorunluluğu
- `updateListing` için gövde formatı (JSON veya form-urlencoded)

## 9. Doğrulama Notu
- İnceleme dört alana bölünerek yapıldı ve her bulgu kod okunarak kaynaklandı.
- Aşağıdaki kritik bulgular ayrıca elle yeniden kontrol edildi ve **doğrulandı:**
  - Birleştirme veri kaybı zinciri (`page.tsx:339` → `GuestMigrationBanner.tsx:77-81` → `storage-service.ts:259-317` → `api/storage/route.ts:177`)
  - 409 sonrası ref'in 0'a çekilmesi ve otomatik kayıt bağımlılıkları (`useWorkspace.ts:185-200`)
  - 3,8 MB'ta sessiz iptal (`storage-service.ts:742-746`)
  - AI tasarım yüklemesinde MIME yerine dosya adı (`AIDesignGeneratorModal.tsx:169`)
  - Klasör çoğaltmada paylaşılan `src` (`MockupCanvasEditor.tsx:315-321`)
  - İlan düzenlemede `state` reddi (`listings/update/route.ts:35-37` ↔ `ListingDetailModal.tsx:247`)
  - Senkronda `removed` işaretleme ve erken çıkış (`listings/route.ts:262-275, 527-536`)
  - Sabit `primaryAesthetic` (`EtsySeoContext.tsx:902`)
  - `listingsPerRun` 10 ↔ şema 5 uyuşmazlığı ve 22 ↔ 20 medya limiti
  - Görsel isteklerinin `/api/*` rate limit'ine dahil olması (`proxy.ts:36-49`)
- Satır numaraları `32360d5` revizyonuna göredir.
