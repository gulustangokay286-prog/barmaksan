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
  seed/           örnek veri (42 makine, sürüm geçmişleri, kataloglar)
deploy/   Dockerfile, docker-compose, nginx, deploy.sh
assets/   marka ve ugurpromilling.com görselleri
docs/     brief, plan, transkript
```

Veri tek klasörde: `data/barmaksan.db` + `data/storage/` (orijinaller dokunulmadan, önizlemeler ayrı). Yedek = bu klasörü kopyalamak.

## Yerelde

```bash
npm --prefix server install && npm --prefix web install
npm --prefix server run seed -- --reset      # örnek veri (FFMPEG_PATH gerekirse)
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

Login sayfası yok (Salih Abi: "şimdilik açık"). Görüntüleme herkese açık; yükleme ve yeni sürüm yayınlama sol alttaki **Düzenleme** düğmesinden, anahtarla açılır. Anahtar sunucuda `/opt/barmaksan/.env` içinde (`EDITOR_KEY`).

Sürümler yalnızca eklenir, asla silinmez. Eski bir sürüme dönmek onu yeni numarayla yeniden yayınlar. Her dokümanın kalıcı bağlantısı (`/d/<id>`) her zaman güncel dosyayı açar.
