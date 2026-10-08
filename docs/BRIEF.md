# Barmaksan · Bilgi Kütüphanesi — Brief

Kaynak: Salih Abi ile WhatsApp yazışması (7 Ekim 2026, 19:43–21:47), 12 sesli mesajın tam transkripti (`docs/brief/TRANSKRIPT.md`), `SCS-2.pdf` teknik fiş örneği, ugurpromilling.com. Her madde, söylendiği mesajın saatine bağlı. Yorum değil, söylenenin kendisi.

## Ne istiyor (tek cümle)

Barmaksan Endüstri A.Ş. ve markası Uğur Promilling için, şirketin bütün teknik ve kurumsal dosyalarının **tek, her zaman en güncel** yeri olan, klasör yapılı, arama ve medya tarafı çok güçlü bir **Bilgi Kütüphanesi**.

## Salih Abi'nin gereksinimleri

| # | Gereksinim | Kaynak |
|---|---|---|
| S1 | Adı **Bilgi Kütüphanesi** ("o isimde kalabilir"). Kurumsal kütüphane mantığı. | 19:47, 20:17 |
| S2 | Her makine için (~**42 makine**): kullanım kılavuzları, sertifika belgeleri, teknik parça çizimleri, fotoğraflar, videolar. | 19:47 |
| S3 | Ek içerik türleri: **SPL (Spare Part List)**, bakım kılavuzu, **yağlama tablosu**, onlarca **CE sertifikası**, şirket tanıtım videoları, fabrika fotoğrafları, drone çekimleri, **kataloglar**, **şirket profilleri**, **müşteriye gönderilecek dosyalar**. | 20:17, 20:20, 20:21 |
| S4 | İçerik **makine/parça bazlı** da olabilir, **firma geneli** de. | 20:17 |
| S5 | Pazarlamadaki biri makinenin hangi dosyası varsa "tak tak" erişebilmeli. **Sosyal medya ajansı** da kullanabilmeli. Konan veriler zaten herkesin görebileceği nitelikte. | 19:47 |
| S6 | **Şimdilik login yok**, açık olabilir. Login fikrini sonra anlatacak. | 20:17 |
| S7 | **Versiyonlama**: Teknik fiş/çizim değişince sürüm kayıtları ve geçmiş sürümler tutulmalı. Ama **Chenkron'daki gibi karmaşık değil** ("yeni versiyonu getir falan gerek yok"), "saçma sapan AI tarzıyla değil". | 19:47, 20:17 |
| S8 | Teknik fişte sürüm yapısı olmadığı için sürümler kayboluyor; köşeye "v3" yazmak çözmüyor. Amaç: **"Bu site en günceldir kardeş" dedirtmek.** | 20:20 |
| S9 | **Klasör bazlı ama tamamen online cloud gibi.** Boğaziçi web sistemindeki **klasör yapısı, sol panel, ağaç paneli** beğenildi (iyileştirilerek). | 19:45, 20:20 |
| S10 | **Arama "agresif"**: çok iyi çalışan arama. | 20:20 |
| S11 | **Medya kütüphanesi tarafı çok iyi** olmalı. SSAB portalı sadece mantık için gönderildi; o "çok sade, sadece medya kütüphanesi, düzgün bir taraf değil". | 20:17, 20:20 |
| S12 | **Medya sıkıştırılmasın** (orijinaller korunur). Depolama büyüyen bir konu. | 20:17 |
| S13 | **Türkçe ve İngilizce.** | 20:21 |
| S14 | **Kompakt ve hızlı kullanım.** "Her şeyi dahil etmeye çalışınca sadeleştirmek çok zor — UI yeteneğini göreceğim." | 20:21 |
| S15 | Logolar: **Barmaksan ve Uğur** birlikte. | 20:15, 20:17 |
| S16 | Yazım: **"makine"**, "makina" değil ("çok bilinen bir yanlış"). | 20:21 |
| S17 | İleride **kurum hafızası** + AI ("şu dosyalar sende var mı?"). Şimdi değil; altyapı buna kapı bırakmalı. | 20:21 |
| S18 | Altyapı: **Node.js / React**. **Firebase yok**, karmaşık olmasın. **SQL / `.db` (SQLite)**; harici/uzak veritabanı yok. Mock data olabilir. | 21:45 |
| S19 | "UI tarafında kendini kısıtlama." | 21:45 |
| S20 | Süreç: **erken ve sık canlı link** (fotoğraf değil, "rastgele bir link bile olur"). "Yolun başındayken bana bir at, süreç kaybolmasın." | 20:17, 20:21 |
| S21 | Yazılı: "**AI kullan, problem değil, AI gözükmesin**." "**Olağanüstü kapsamlı düşünme ama iyi olsun.**" "Boğaziçi'nin UI iyi." | 20:14 |
| S22 | Teknik fiş örneği: **SCS Kontrol Eleği / Control Plansifter** (ölçü tablosu, eleme alanı, motor, ağırlık, paket hacmi). "Aynen o bizim elek makinesi." | 20:19, 20:21 |

Proje dışı: 19:43–19:44 mesajları Muharrem Hoca'ya (Boğaziçi) yazılacak teşekkür/mutabakat ve geri bildirim mesajıyla ilgili.

## Gökay'ın gereksinimleri

| # | Gereksinim |
|---|---|
| G1 | Apple tasarım dili; animasyon ve sadelik vazgeçilmez; fade ve blur bolca. |
| G2 | Mobilde birebir aynı içerik ve aynı his. |
| G3 | Scroll'da önemli öğeler (başlıklar, arama) kayıp gitmesin, sayfada tutunsun. |
| G4 | **Asla:** gradient, glow, AI-slop öğeler, kapsül (pill) şekiller, yeşil noktalar, kötü fontlar, baştan savma tasarım. |
| G5 | Sıra: mimari → veritabanı (`.sql` + `.db`) → backend → React. |
| G6 | Sunucu: diğer projelere dokunmadan Barmaksan API + konteyner. |
| G7 | Makineler için şimdilik mock veri; logo, renk ve görseller ugurpromilling.com'dan. |
