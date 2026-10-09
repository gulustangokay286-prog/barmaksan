# Barmaksan · Bilgi Kütüphanesi

Barmaksan Endüstri A.Ş. ve Uğur Promilling'in teknik ve kurumsal dosyaları, her zaman en güncel hâliyle.

Canlı: **https://barmaksan.chenki.net**

- Ne istendiği: [docs/BRIEF.md](docs/BRIEF.md) (Salih Abi'nin sesli mesajlarından, saatleriyle)
- Nasıl kurulduğu: [docs/PLAN.md](docs/PLAN.md)
- Veritabanı yapısı: [server/db/schema.sql](server/db/schema.sql)

## Yapı

```
web/      React 19 + Vite + Motion — arayüz
server/   Node.js + Express 5 + SQLite (better-sqlite3) — API, dosyalar, arama
  db/schema.sql   veritabanının tek kaynağı
  seed/           ilk kurulum ve veri aktarımları (42 makine, ürün içerikleri, kataloglar)
deploy/   Dockerfile, docker-compose, nginx, deploy.sh
assets/   marka ve ugurpromilling.com görselleri
docs/     brief, plan, transkript
```

Veri tek klasörde: `data/barmaksan.db` + `data/storage/` (orijinaller dokunulmadan, önizlemeler ayrı). Yedek = bu klasörü kopyalamak.

## Yerelde

```bash
npm --prefix server install && npm --prefix web install
npm --prefix server run seed                 # yalnızca boş veritabanında ilk kurulum
EDITOR_KEY=deneme node server/src/index.js   # API :3000
npm --prefix web run dev                     # arayüz :5180
```

## Sunucu

`213.142.159.36` üzerinde, diğer projelerden ayrık:

| | |
|---|---|
| Konteyner | `barmaksan_api` (compose projesi `barmaksan`, ağ `barmaksan_net`) |
| Port | yalnızca `127.0.0.1:8096` |
| Veri | `/opt/barmaksan/data` |
| Kod | `/opt/barmaksan/app` |
| Ortam | `/opt/barmaksan/.env` (düzenleme anahtarı burada, `chmod 600`) |
| nginx | `/etc/nginx/sites-enabled/70-barmaksan` |
| TLS | Let's Encrypt, `barmaksan.chenki.net` |

Güncelleme: `deploy/deploy.sh` (veriye dokunmaz). Örnek veriyi sıfırdan kurmak: `deploy/deploy.sh --seed` (**veriyi siler**).

## Düzenleme

Görüntüleme herkese açık. `/admin` üzerinden e-posta ve şifreyle yönetim girişi yapılır; yükleme, yeni sürüm yayınlama, makine içerikleri ve bakım bilgi bankası buradan düzenlenir. Eski `EDITOR_KEY` desteği de sürer.

Yeni sürüm yayınlamak eski sürümleri korur. Eski bir sürüme dönmek onu yeni numarayla yeniden yayınlar. Her dokümanın kalıcı bağlantısı (`/d/<id>`) her zaman güncel dosyayı açar. Yönetimden belge kalıcı silinirse sürümleri de kaldırılır.

Site dili sağ üstten seçilir; ürün profilleri, belgeler ve bakım konuları bu dili
izler. Yönetimden yeni içerik dilleri eklenebilir. Arayüz çevirileri TR/EN'dir.
Makine bilgilerini web sitesi ve kataloglarda kullanmak için [içerik API'si](docs/CONTENT-API.md) vardır.

Mevcut verileri koruyarak resmi ürün bilgilerini ekleme: `npm --prefix server run import:content`.
Doğrulama: `npm --prefix server test` ve `npm --prefix web run build`.
