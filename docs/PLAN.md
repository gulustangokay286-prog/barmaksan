# Barmaksan · Bilgi Kütüphanesi — Plan

> Tek iş: Barmaksan ve Uğur Promilling'in bütün dosyaları, her zaman en güncel halleriyle, iki dokunuş mesafesinde.

Gereksinimler `docs/BRIEF.md`'de (S1–S22 Salih Abi, G1–G7 Gökay). Bu belgedeki her karar bir gereksinime bağlanıyor; bağlanmayan şey yapılmıyor (S21: "olağanüstü kapsamlı düşünme ama iyi olsun").

## 9 Ekim 2026 · Yerel devam durumu

Claude oturumu: `8390aa88-6f7e-4001-8861-ac7e17258335` — "Carousel scroll, sidebar performance, grid redesign". Son iş, 8–9 Ekim geri bildirimlerinin ilk düzeltme turuydu. Aşağıdaki güncel durum, belgenin eski tasarım kararlarından farklı olduğu yerlerde önceliklidir.

- Tam tarih, saat ve yükleyen ipucu hazır. Son güncellenenlerde kategori ve makine yolu gösteriliyor.
- Sol ağaç sırası Kurumsal → Makineler → Medya. Eksik belge türleri yalnızca düzenleme modunda görünüyor.
- Kurumsal Kimlik, Kurumsal altındaki gerçek bir klasör. Logo, antetli kâğıt ve kimlik kılavuzu yüklenebilir; logoların önizlemesi ve güncel dosyayı indirme bağlantısı var.
- Kaydedilenler menüye ve belge eylemlerine bağlandı. Belge kimliği tarayıcıda saklanıyor; listede sunucudan güncel belge ve sürüm okunuyor. Kaydetme, yenileme sonrası kalıcılık ve kaldırma yerelde doğrulandı.
- Alt bilgi tamamlandı: temel bağlantılar ve marka bilgisi; klavye ipucu şeridi yok.
- Yerel veritabanı yedeklendi; kurumsal klasör ve türler veri sıfırlanmadan eklendi. API `node --watch` ile çalışıyor. TypeScript ve üretim derlemesi geçiyor.

Devam geliştirmeleri:

- Makine sayfasının sağ tarafında ürün açıklaması, özellikleri ve kullanım alanları var. Teknik tablolar ayrı bölümde; teknik fiş diğer belgelerle aynı listede. Eski sürümler kullanıcı açana kadar kapalı.
- 42 makine için 84 dil profili ve 122 teknik tablo resmi ürün sayfalarından aktarıldı. Cleanmax 4 ve Vibro açıklamaları ürün bilgilerine dayanarak düzenlendi. Bazı kaynak sayfalardaki bozuk İngilizce tablo başlıkları düzeltildi; sayısal hücreler korunuyor. Kaynakta belirtilmeyen değerler doldurulmadı.
- Dil, ziyaretçi için yalnızca sağ üstte seçilir. Ürün açıklaması, teknik bilgiler, bakım konuları, belgeler, arama, son güncellenenler ve medya bu seçimi izler. Seçim yenilemede korunur. Yönetimden yeni içerik dilleri eklenebilir; arayüz çevirileri TR/EN, diğer dillerde İngilizce arayüz kullanılır.
- Dil profilleri ve bakım konularında bağımsız güncelleme tarihi, giriş yapan editörün adı ve değişiklik notu var. Aynı türde farklı dilde belgeler ayrı kayıtlardır; sürüm geçmişleri karışmaz. Eşzamanlı düzenlemelerde revizyon kontrolü var.
- Bakım bilgi bankası: makine → kategori → konu → açıklama, adımlar, uyarı, video bağlantıları ve video/PDF ekleri. Yönetimden ekleme, düzenleme, sıralama, dil içeriğini kaldırma; ziyaretçi tarafında arama ve açılır kategori/konu düzeni hazır. Gerçek bakım prosedürleri henüz iletilmediğinden uydurulmadı. Başlangıç kategorileri tek düğmeyle eklenebilir.
- Galeri otomatik geçiş, küçük resimler, ileri/geri, duraklatma ve lightbox içeriyor. Cleanmax 4 ve Vibro için Salih Abi'nin gönderdiği Drive klasörlerinden sekizer 7680×4320 T8 görseli alındı. 16 orijinal dosyanın toplamı yaklaşık 280 MB; orijinaller korunuyor, önizlemeler ayrı. T8 aktarımı yerel `data/` içinde tutulur ve Git'e girmez.
- Web sitesi/katalog API'si hazır: `/api/catalog/machines` ve `/api/catalog/machines/:slug?language=tr`. Ayrıntılar [CONTENT-API.md](CONTENT-API.md).
- Mevcut veritabanı ikinci kez yedeklendi (`data/backups/before-machine-content-2026-10-09.db`). Aktarım öncesindeki belge kimlikleri, güncel sürüm kimlikleri ve sürüm sayıları korunuyor. Şema yükseltmesi tekrarlanabilir; içerik aktarımı editörün kayıtlarını ezmez.
- 10 izole HTTP/veritabanı testi ve TypeScript + üretim derlemesi geçiyor. Dil filtresi sayfalama/limitten önce uygulanıyor. `Cleanmax 4` araması, başka bir modelin kapasite/motor metnindeki 4 ile eşleşmiyor.

Geliştirmeler yerelde; canlıya dağıtım yapılmadı. QR üretimi, 3D model görüntüleyici ve harici web sitesinin bu API'ye bağlanması bu kapsamın dışında.

---

## 1. Bilgi mimarisi

### Ağaç (sol panel — S9)

```
Bilgi Kütüphanesi
├─ Makineler                         42
│  ├─ Temizleme ve Tavlama
│  │  ├─ Cleanmax 4 · Çöp Sasörü
│  │  └─ …
│  ├─ Öğütme
│  ├─ Taşıma
│  └─ Paketleme
│     └─ Kontrol Eleği · SCS         ← SCS-2.pdf burada (S22)
├─ Kurumsal
│  ├─ Sertifikalar                   CE belgeleri (S3)
│  ├─ Kataloglar
│  ├─ Şirket Profilleri
│  └─ Müşteri Dosyaları
└─ Medya
   ├─ Tanıtım Videoları
   ├─ Fabrika Fotoğrafları
   └─ Drone Çekimleri
```

Her şey klasör (S9). Makine, ek alanları olan bir klasör. Firma geneli içerik Kurumsal/Medya altında, makineye özel içerik makinenin klasöründe (S4).

### Doküman türleri (sabit sözlük)

| Tür | Kısa | Sürümlü | Nerede |
|---|---|---|---|
| Teknik Fiş | — | evet | makine |
| Teknik Çizim | — | evet | makine |
| Yedek Parça Listesi | SPL | evet | makine |
| Kullanım Kılavuzu | — | evet | makine / firma |
| Bakım Kılavuzu | — | evet | makine |
| Yağlama Tablosu | — | evet | makine |
| Sertifika | CE | evet | makine / firma |
| Katalog | — | evet | firma |
| Şirket Profili | — | evet | firma |
| Müşteri Dosyası | — | evet | firma |
| Fotoğraf | — | hayır | makine / medya |
| Video | — | hayır | makine / medya |

### Ekranlar

1. **Kütüphane (ana sayfa)** — büyük başlık, büyük arama alanı, makine kategorileri, kurumsal klasörler, "Son güncellenenler" akışı (S8'i her girişte hissettirir: "Kontrol Eleği — Teknik Fiş v3 · 2 gün önce").
2. **Klasör** — breadcrumb, alt klasörler, dosyalar; liste/ızgara.
3. **Makine** — kapak görseli, ad (TR/EN), model kodları; altta tür tür dokümanlar. Teknik Fiş en üstte, büyük kart: "v3 · Güncel · 7 Eki 2026". Boş türler sönük satır olarak görünür ("Henüz yüklenmedi") — eksik ne, bir bakışta (kurum hafızası, S17).
4. **Doküman** — sayfa önizlemeleri + sağ panel: bilgi, sürüm geçmişi, kalıcı bağlantı, indir.
5. **Medya kütüphanesi** — bütün fotoğraf/videolar, filtre (makine, koleksiyon, tür), masonry ızgara, tam ekran görüntüleyici (S11).
6. **Arama** — her yerden `⌘K` / `/`; yazdıkça sonuç, gruplu (Makineler · Dokümanlar · Medya). Tam sayfa arama + filtreler (S10).
7. **Düzenleme modu** — yükleme, yeni sürüm, başlık/tür/dil düzenleme. Login sayfası yok (S6); bkz. Karar 2.

---

## 2. Tasarım sistemi

### İlkeler

- **İçerik araçtır, arayüz geri çekilir.** Renk sadece anlam taşıdığında. Altın = "güncel/aktif".
- **Yoğun ama ferah.** Kompakt satırlar (S14), cömert kenar boşlukları.
- **Her değer bir karar.** Boşluklar 4'ün katı; süreler ve yaylar aşağıdaki tablodan; rastgele sayı yok.

### Renk (marka kaynaklı)

| Token | Açık | Koyu | Kaynak |
|---|---|---|---|
| `--canvas` | `#F6F6F4` | `#0E0E0F` | sıcak nötr zemin |
| `--surface` | `#FFFFFF` | `#18181A` | kart/panel |
| `--ink` | `#1F1F21` | `#F2F2EF` | metin (marka `#222222`) |
| `--ink-2` | `#5C5C61` | `#A1A1A6` | ikincil metin |
| `--ink-3` | `#8B8B90` | `#6E6E73` | üçüncül, meta |
| `--line` | `rgba(0,0,0,.08)` | `rgba(255,255,255,.09)` | saç çizgisi |
| `--gold` | `#D9B625` | `#E2BF3A` | Uğur altını — işaret, aktif çubuk |
| `--gold-ink` | `#7A6200` | `#E2BF3A` | altın metin (AA kontrast) |
| `--danger` | `#B3261E` | `#F2B8B5` | sadece hata |

Barmaksan sarısı `#ECBC30`, grileri `#4C4C50` / `#7C7C7C` yalnızca logoda yaşar. Tema sistemden gelir; açık/koyu geçişi yumuşak.

**Yasaklar (G4) — kod seviyesinde:** CSS'te `linear-gradient`/`radial-gradient` yok, `box-shadow` ile glow yok, `border-radius: 9999px` yok (pill/kapsül yok), yeşil nokta/durum noktası yok ("Güncel" bir metin etiketi, köşeli). Lint kuralı olarak repoya eklenecek.

### Tipografi

Sistem yazı tipi (Apple'da SF Pro, Windows'ta Segoe UI Variable, Android'de Roboto) — sıfır yükleme, platformun optik boyutlandırması, hız (S14). Kodlar (parça kodu, model, sürüm) için `ui-monospace` (SF Mono). Tüm sayılar `tabular-nums`.

| Stil | Boyut / satır | Ağırlık | İzleme |
|---|---|---|---|
| Large Title | 40/44 (mobil 32/36) | 700 | −0.025em |
| Title 1 | 28/32 | 650 | −0.02em |
| Title 2 | 22/28 | 600 | −0.015em |
| Headline | 17/22 | 600 | −0.01em |
| Body | 15/22 (mobil 16/24) | 400 | 0 |
| Callout | 14/20 | 400 | 0 |
| Footnote | 13/18 | 400 | +0.005em |
| Caption | 12/16 | 500 | +0.01em |

### Biçim

- Köşe: 6 (kontrol) · 10 (kart) · 14 (panel/sheet). Asla tam yuvarlak.
- Boşluk: 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 56 · 72.
- Gölge yok denecek kadar az; derinlik saç çizgisi ve malzemeyle. Sadece yüzen paneller (sheet, palet) gölgeli.
- **Malzeme:** üst bar ve yüzen paneller yarı saydam + `backdrop-filter: blur(20px) saturate(180%)`; içerik altından akar. `prefers-reduced-transparency`'de katı zemine döner.
- **İkonlar:** 20px, 1.5 çizgi, yuvarlak birleşim; elle çizilmiş küçük set (her doküman türüne bir ikon). Hazır ikon kütüphanesi yok — "AI gözükmesin" (S21).
- **Logolar:** üst barda Barmaksan | Uğur yan yana, ince ayraçla (S15). Açık/koyu temaya göre metin rengi uyarlanmış SVG.

---

## 3. Hareket sistemi (G1, G3, Apple)

Motion (Framer Motion) yayları. Varsayılan kritik sönümlü — zıplama yok; zıplama sadece kullanıcı bir şeyi fırlattığında.

| Ad | Ayar | Nerede |
|---|---|---|
| `default` | bounce 0, 0.40s | sayfa, panel, liste |
| `snappy` | bounce 0, 0.25s | basma, hover, sekme |
| `fling` | bounce 0.15, 0.35s + bırakma hızı | sheet/lightbox sürükle-bırak |

- **Giriş:** opaklık 0→1 + blur 10px→0 + y 12→0. Listelerde 35ms kademe, en fazla 8 öğe (gerisi anında — hız, S14).
- **Çıkış:** opaklık →0 + blur 6px, 180ms. Girdiği yoldan çıkar.
- **Sayfa geçişi:** blur'lu çapraz geçiş; geri gidince ters yön.
- **Tutunma (G3):**
  - Ana sayfadaki büyük arama alanı scroll'da kaybolmaz, **üst bara yerleşir** (paylaşılan yerleşim animasyonu).
  - Makine/klasör sayfasında büyük başlık scroll'la küçülüp üst bara geçer (iOS büyük başlık davranışı); başlık hiç kaybolmaz.
  - Doküman türü başlıkları (Teknik Fiş, SPL…) yapışkan; altlarından içerik blur'la akar.
  - Sol ağaç paneli sabit; seçili öğenin altın çubuğu seçimden seçime kayar.
- **Medya görüntüleyici:** küçük resimden büyür (paylaşılan öğe), aşağı sürükle-kapat hız projeksiyonuyla, sağ/sol kaydırma, klavye okları.
- **Sürüm geçmişi:** masaüstünde sağdan panel, mobilde alttan sheet (sürüklenebilir).
- **Basma geri bildirimi:** `pointerdown`'da 0.97 ölçek — bırakmayı beklemeden.
- **Azaltılmış hareket:** kayma/yay yerine kısa çapraz geçiş; blur kapalı.

---

## 4. Sürümleme (S7, S8)

Basit ve görünür. Chenkron'daki gibi arka plan mantığı yok.

- Bir **doküman** (örn. "Kontrol Eleği — Teknik Fiş") birden çok **sürüm** taşır: v1, v2, v3…
- **Yeni sürüm yükle** → dosyayı bırak → kısa not ("Motor AGM-132 M6a olarak güncellendi") → Yayınla. Yeni sürüm anında güncel olur.
- Ekranda her zaman güncel sürüm görünür; eski sürümler "Geçmiş" panelinde, tarih + not + indir ile.
- Geri dönmek = eski sürümü yeniden yayınlamak (v4 olarak). Geçmiş asla silinmez.
- **Kalıcı bağlantı:** `/d/k7m2q9` her zaman en güncel dosyayı açar. Teknik fişi WhatsApp'tan, e-postadan, projeden bu bağlantıyla paylaşırsın; dosya güncellense bile bağlantı doğruyu açar. "Bu site en günceldir" (S8) tam olarak bu.
- Eski bir sürüm açıldığında üstte net bir şerit: "Bu v2. Güncel sürüm v3 →".

---

## 5. Arama (S10)

- SQLite FTS5: başlık, makine adı, model kodu, tür, etiket, dosya adı ve **PDF'lerin içindeki metin**. SPL'deki parça kodu (`SEGEGSS4.ARLCK240`) yazıldığında ilgili makine ve sayfa bulunur.
- Türkçe katlama: `ı/i, ş/s, ğ/g, ü/u, ö/o, ç/c` eşit; "kontrol elegi" = "Kontrol Eleği".
- Ön ek + parça içi eşleşme (trigram): "GSS4" → `SEGEGSS4…`.
- Her tuşta sonuç (≤ 50ms sunucu), son aramalar, klavye ile tam kullanım.
- İleride AI (S17) aynı dizini ve metin içeriğini kullanacak — şimdi ek iş yok.

---

## 6. Mimari (S18, G5)

```
Tarayıcı (React)
   │  HTTPS
nginx (sunucuda zaten var) ── barmaksan.chenki.net
   │  127.0.0.1:8096
barmaksan_api  (Docker, Node 24)
   ├─ Express: /api/*  JSON
   ├─ /d/:id          kalıcı bağlantı → güncel dosya
   ├─ /files/*        orijinal · önizleme · küçük resim (Range destekli)
   └─ React build'i   (statik)
        │
   /opt/barmaksan/data
   ├─ barmaksan.db            SQLite (WAL)
   └─ storage/
      ├─ originals/ab/<sha256>.pdf   dokunulmamış orijinaller (S12)
      └─ previews/…                   web önizlemeleri (sadece görüntüleme için)
```

- **Backend:** Node.js 24 + Express 5 + better-sqlite3. Düz JavaScript (ESM). Firebase yok, ORM yok, harici DB yok (S18). Önizleme: `sharp` (görsel), `pdfjs-dist` (PDF sayfa görüntüsü + metin, istek geldikçe), `ffmpeg` (video kapak karesi).
- **Frontend:** React 19 + Vite + TypeScript, React Router, Motion, TanStack Query. CSS: düz CSS + token'lar (Tailwind yok — her piksel elde).
- **Veritabanı:** `server/db/schema.sql` tek kaynak; `server/db/seed.sql` mock veri. Tek dosya `.db` — yedek = dosyayı kopyalamak.
- **Dosyalar:** içerik adresli (sha256) — aynı dosya iki kez yüklenirse bir kez saklanır.

### Klasör yapısı

```
Barmaksan/
├─ web/                 React uygulaması
├─ server/
│  ├─ db/schema.sql     veritabanı yapısı
│  ├─ db/seed.sql       mock veri
│  └─ src/              API, dosya, arama
├─ deploy/              Dockerfile, compose, nginx
├─ assets/              marka ve site görselleri
└─ docs/                brief, plan, transkript
```

### API

| Metot | Yol | İş |
|---|---|---|
| GET | `/api/tree` | sol panel ağacı |
| GET | `/api/folders/:slug` | klasör/makine + içerik |
| GET | `/api/documents/:id` | doküman + sürümler |
| GET | `/api/search?q=` | arama (filtreler: tür, dil, klasör) |
| GET | `/api/recent` | son güncellenenler |
| GET | `/api/media` | medya kütüphanesi (sayfalı) |
| GET | `/d/:id`, `/d/:id/v/:n` | kalıcı bağlantı / sabit sürüm |
| POST | `/api/documents` | yeni doküman (düzenleme) |
| POST | `/api/documents/:id/versions` | yeni sürüm (düzenleme) |
| PATCH | `/api/documents/:id`, `/api/folders/:id` | düzenleme |

---

## 7. Sunucu (G6)

Mevcut: Ubuntu 24.04, host nginx (80/443), 16 konteyner, Docker 29 + Compose v2. Barmaksan **tamamen ayrık**:

- Compose projesi `barmaksan`, konteyner `barmaksan_api`, kendi ağı `barmaksan_net`.
- Port `127.0.0.1:8096` (boş; dışarı açık değil).
- Veri `/opt/barmaksan/data` — başka hiçbir klasöre yazılmaz.
- nginx'e **yeni bir dosya** eklenir: `sites-enabled/70-barmaksan`. Mevcut site dosyalarına dokunulmaz; `nginx -t` geçmeden reload yok.
- TLS: certbot ile sadece bu alan adına sertifika.
- Gerekli tek dış adım: GoDaddy DNS'te `barmaksan` A kaydı → `213.142.159.36`.

---

## 8. Yol haritası

| Faz | Çıktı | Hedef |
|---|---|---|
| 0 | Brief, transkript, plan, `schema.sql` | ✓ bu adım |
| 1 | Backend + mock veri (42 makine, gerçek SCS teknik fişi, site görselleri) | ✓ |
| 2 | React: ağaç, klasör, makine, doküman, arama, medya | ✓ |
| 3 | Sunucuya canlı link — Salih Abi'ye ilk gönderim (S20) | ✓ https://barmaksan.chenki.net |
| 4 | Düzenleme modu (yükleme, yeni sürüm, geri yükleme) | ✓ anahtarla |
| 5 | Geri bildirim turu, login fikri (S6), gerçek veriler | sıradaki |

Faz 3 Faz 4'ten önce: Salih Abi "yolun başındayken bana at" dedi; okunur halde canlıya çıkıp düzenlemeyi peşinden eklemek, süreci kaybettirmez.
