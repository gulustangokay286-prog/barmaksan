# Makine içerik API'si

Makine bilgi bankası, web sitesi ve katalog üretimi için aynı veri kaynağıdır.
Başlangıç: `http://127.0.0.1:3000/api`.

## Okuma

| Uç | İçerik |
|---|---|
| `GET /languages` | Kayıtlı içerik dilleri, adları ve yazı yönleri |
| `GET /catalog/machines` | Etkin makinelerin slug, ad, model kodu ve API yolu |
| `GET /catalog/machines/cleanmax-4` | Makine, bütün dil profilleri, galeri, bakım ve güncel belgeler |
| `GET /catalog/machines/cleanmax-4?language=en` | Yalnızca İngilizce profil/bakım ve ilgili belgeler |

`content.profiles[code]`: `title`, `description`, `features[]`, `applications[]`,
`specifications[]` (başlık, sütunlar, satırlar), `productUrl`, `changeNote`,
`updatedAt`, `author`. Her dilin tarih/yazar damgası ayrı güncellenir.

`content.gallery`: sıralı belge kimlikleri. `null` makinenin bütün görsellerini
otomatik kullanır; `[]` galeriyi boş bırakır. Görsel belge dosyasında `thumb`,
`preview`, `raw`, `width`, `height` bulunur. Orijinali indirme yolu `/d/<id>/indir`.

`content.maintenance[]`: kategori kimliği, dil bazında başlıklar, sıralı konular.
Her konunun `translations[code]` kaydı başlık, açıklama, adımlar, uyarı, video
bağlantıları, ek belge kimlikleri ve değişiklik damgasını içerir. Bir bakım konusu
için sayfa bağlantısı `/m/<slug>#bakim-<topic-id>` şeklindedir. Site dilini ziyaretçi
sağ üstten seçer.

Dil seçili aktarımda `none` ve `multi` belgeleri bütün dillerde; `tr-en` belgeleri
yalnızca Türkçe/İngilizcede bulunur. Talep edilen ürün profili yoksa 404 döner.
Arşivli belgeler ve geçersiz ek bağlantıları dışarı verilmez. Görsel URL'leri
göreliyse kütüphanenin kök adresiyle birleştirilmelidir.

## Düzenleme

Yönetim girişiyle alınan oturum jetonu `X-Editor-Key` başlığıyla gönderilir.

- `POST /languages`: `code`, `label`, `nativeName`, `direction` (`ltr`/`rtl`).
- `PUT /machines/:slug/content`: son okunan içerik nesnesi, `revision` ve isteğe
  bağlı yayın `note`. İçeriğin tamamını birlikte yayınlar; eski revizyon 409 verir.
- `GET /admin/machines/:slug/history`: yayın tarihi, editör ve yayın notu.

Değişmeyen dillerin tarih/yazar damgaları korunur. Editör adı doğrulanmış oturumdan
alınır. Mevcut dosya sürümleri bu yayın işlemiyle değişmez.

## Yerel aktarımlar

`npm --prefix server run import:content`, `assets/site/product-content.json`
verisini yalnızca henüz içerik kaydı bulunmayan makinelere ekler; tekrar çalıştırma
editör değişikliklerini ezmez. İlk kurulum seed'i de bu aktarımı kullanır.

`node server/seed/import-gallery.js <slug> <yerel-görsel-klasörü>` T1…T8 gibi
orijinal görselleri içe alır. Aynı içerik ve belge tekrar oluşturulmaz. Kaynak
dosyalar korunur; önizlemeler ayrı üretilir. Gizli/henüz yayınlanmamış renderlar
yerel `data/` içinde tutulmalı; dış sunucuya aktarım ayrıca kararlaştırılmalıdır.

Doğrulama: `npm --prefix server test` ve `npm --prefix web run build`.
