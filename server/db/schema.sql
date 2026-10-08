-- ─────────────────────────────────────────────────────────────────────────────
-- Barmaksan · Bilgi Kütüphanesi — veritabanı yapısı (SQLite 3.40+)
--
-- Tek dosya: data/barmaksan.db. Bu dosya şemanın tek kaynağıdır.
-- Zaman damgaları ISO-8601 UTC metin ('2026-10-08T09:30:00.000Z').
-- Dosyaların kendisi diskte (storage/), burada yalnızca kayıtları durur.
-- ─────────────────────────────────────────────────────────────────────────────

PRAGMA foreign_keys = ON;

-- Şema sürümü. Uygulama açılışta bakar; ileride ALTER'lar buraya sürüm ekler.
CREATE TABLE IF NOT EXISTS schema_version (
  version     INTEGER PRIMARY KEY,
  applied_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ── Markalar ────────────────────────────────────────────────────────────────
-- Barmaksan Endüstri A.Ş. ve markası Uğur Promilling.
CREATE TABLE IF NOT EXISTS brands (
  id    INTEGER PRIMARY KEY,
  slug  TEXT NOT NULL UNIQUE,          -- 'barmaksan' | 'ugur'
  name  TEXT NOT NULL
);

-- ── Dosyalar ────────────────────────────────────────────────────────────────
-- Diskteki fiziksel dosya. İçerik adresli: aynı dosya iki kez saklanmaz.
-- Orijinal asla değiştirilmez/sıkıştırılmaz; önizlemeler ayrı tutulur.
CREATE TABLE IF NOT EXISTS files (
  id             INTEGER PRIMARY KEY,
  sha256         TEXT NOT NULL UNIQUE,
  original_name  TEXT NOT NULL,                 -- yüklendiği adıyla
  ext            TEXT NOT NULL,                 -- 'pdf', 'jpg', 'mp4', 'dwg' …
  mime           TEXT NOT NULL,
  size_bytes     INTEGER NOT NULL CHECK (size_bytes >= 0),
  width          INTEGER,                       -- görsel/video
  height         INTEGER,
  duration_ms    INTEGER,                       -- video
  page_count     INTEGER,                       -- pdf
  storage_key    TEXT NOT NULL,                 -- 'originals/ab/<sha256>.pdf'
  thumb_key      TEXT,                          -- küçük resim (≈ 480px)
  preview_key    TEXT,                          -- görüntüleme (≈ 1600px / pdf sayfaları klasörü)
  text_content   TEXT,                          -- pdf'den çıkarılan düz metin (arama için)
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ── Klasör ağacı ────────────────────────────────────────────────────────────
-- Sol paneldeki her şey bir klasör:
--   section    → Makineler, Kurumsal, Medya
--   category   → Temizleme ve Tavlama, Öğütme, Taşıma, Paketleme
--   machine    → tek bir makine (ek bilgileri `machines` tablosunda)
--   collection → Sertifikalar, Kataloglar, Drone Çekimleri …
CREATE TABLE IF NOT EXISTS folders (
  id              INTEGER PRIMARY KEY,
  parent_id       INTEGER REFERENCES folders(id) ON DELETE RESTRICT,
  kind            TEXT NOT NULL CHECK (kind IN ('section', 'category', 'machine', 'collection')),
  slug            TEXT NOT NULL UNIQUE,
  name_tr         TEXT NOT NULL,
  name_en         TEXT NOT NULL,
  description_tr  TEXT,
  description_en  TEXT,
  sort            INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  archived_at     TEXT,
  CHECK (parent_id IS NOT NULL OR kind = 'section')
);
CREATE INDEX IF NOT EXISTS folders_by_parent ON folders(parent_id, sort) WHERE archived_at IS NULL;

-- ── Makineler ───────────────────────────────────────────────────────────────
-- kind = 'machine' olan klasörün ek alanları.
CREATE TABLE IF NOT EXISTS machines (
  folder_id      INTEGER PRIMARY KEY REFERENCES folders(id) ON DELETE CASCADE,
  brand_id       INTEGER NOT NULL REFERENCES brands(id),
  model_code     TEXT,                          -- 'SCS', 'CLEANMAX 4'
  models_json    TEXT NOT NULL DEFAULT '[]'     -- ["SCS 20864", "SCS 21264", …]
                 CHECK (json_valid(models_json)),
  summary_tr     TEXT,
  summary_en     TEXT,
  cover_file_id  INTEGER REFERENCES files(id) ON DELETE SET NULL
);

-- ── Doküman türleri ─────────────────────────────────────────────────────────
-- Sabit sözlük; makine sayfasındaki bölümlerin sırası `sort`tan gelir.
CREATE TABLE IF NOT EXISTS doc_types (
  id            INTEGER PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,           -- 'teknik-fis', 'spl', 'video' …
  name_tr       TEXT NOT NULL,
  name_en       TEXT NOT NULL,
  short         TEXT,                           -- 'SPL', 'CE'
  icon          TEXT NOT NULL,                  -- arayüzdeki ikon adı
  media_kind    TEXT NOT NULL CHECK (media_kind IN ('document', 'image', 'video')),
  is_versioned  INTEGER NOT NULL DEFAULT 1 CHECK (is_versioned IN (0, 1)),
  sort          INTEGER NOT NULL DEFAULT 0
);

-- ── Dokümanlar ──────────────────────────────────────────────────────────────
-- Mantıksal kayıt: "Kontrol Eleği — Teknik Fiş". Dosyası sürümlerde.
-- public_id kalıcı bağlantıdır: /d/<public_id> her zaman güncel sürümü açar.
CREATE TABLE IF NOT EXISTS documents (
  id                  INTEGER PRIMARY KEY,
  public_id           TEXT NOT NULL UNIQUE CHECK (length(public_id) BETWEEN 6 AND 16),
  folder_id           INTEGER NOT NULL REFERENCES folders(id) ON DELETE RESTRICT,
  doc_type_id         INTEGER NOT NULL REFERENCES doc_types(id),
  title_tr            TEXT NOT NULL,
  title_en            TEXT,
  language            TEXT NOT NULL DEFAULT 'tr'
                      CHECK (language IN ('tr', 'en', 'tr-en', 'multi', 'none')),
  description         TEXT,
  tags                TEXT NOT NULL DEFAULT '',  -- boşlukla ayrılmış anahtar kelimeler
  current_version_id  INTEGER REFERENCES document_versions(id) ON DELETE SET NULL,
  version_count       INTEGER NOT NULL DEFAULT 0,
  sort                INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  archived_at         TEXT
);
CREATE INDEX IF NOT EXISTS documents_by_folder  ON documents(folder_id, doc_type_id, sort) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS documents_by_updated ON documents(updated_at DESC) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS documents_by_type    ON documents(doc_type_id) WHERE archived_at IS NULL;

-- ── Sürümler ────────────────────────────────────────────────────────────────
-- Yalnızca eklenir, asla silinmez/değiştirilmez. Geri dönmek = eski dosyayı
-- yeni numarayla yeniden yayınlamak.
CREATE TABLE IF NOT EXISTS document_versions (
  id           INTEGER PRIMARY KEY,
  document_id  INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_no   INTEGER NOT NULL CHECK (version_no >= 1),
  file_id      INTEGER NOT NULL REFERENCES files(id) ON DELETE RESTRICT,
  note         TEXT,                            -- "Motor AGM-132 M6a olarak güncellendi"
  author       TEXT,                            -- login gelene kadar serbest metin
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (document_id, version_no)
);
CREATE INDEX IF NOT EXISTS versions_by_file ON document_versions(file_id);

CREATE TRIGGER IF NOT EXISTS document_versions_append_only_update
BEFORE UPDATE ON document_versions
BEGIN
  SELECT RAISE(ABORT, 'document_versions yalnızca eklenir');
END;

-- ── Hareket kaydı ───────────────────────────────────────────────────────────
-- Kurum hafızasının temeli: kim, ne zaman, neyi değiştirdi.
CREATE TABLE IF NOT EXISTS activity (
  id           INTEGER PRIMARY KEY,
  at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  action       TEXT NOT NULL,                   -- 'document.created' | 'version.published' | 'document.updated' | 'folder.created' …
  folder_id    INTEGER REFERENCES folders(id) ON DELETE SET NULL,
  document_id  INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  version_id   INTEGER REFERENCES document_versions(id) ON DELETE SET NULL,
  actor        TEXT,
  detail       TEXT CHECK (detail IS NULL OR json_valid(detail))
);
CREATE INDEX IF NOT EXISTS activity_by_time ON activity(at DESC);

-- ── Arama dizini ────────────────────────────────────────────────────────────
-- Uygulama her yazmadan sonra ilgili satırı yeniden üretir. Metinler Türkçe
-- katlanmış halde yazılır (ı→i, İ→i; diğer aksanları tokenizer siler).
--   kind:  'folder' | 'document'
--   title: ad/başlık (TR + EN)
--   context: makine adı, klasör yolu, tür, dil
--   body:  açıklama + etiketler + PDF metni
--   codes: model kodları, parça kodları, dosya adı
CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
  kind UNINDEXED,
  ref_id UNINDEXED,
  title,
  context,
  body,
  codes,
  tokenize = "unicode61 remove_diacritics 2",
  prefix = '2 3 4'
);

-- Parça içi eşleşme: "GSS4" → "SEGEGSS4.ARLCK240". Tüm metin (PDF içeriği dahil).
CREATE VIRTUAL TABLE IF NOT EXISTS search_trigram USING fts5(
  kind UNINDEXED,
  ref_id UNINDEXED,
  text,
  tokenize = "trigram"
);

-- ── Yönetim kullanıcıları ve oturumlar ──────────────────────────────────────
-- Şifre düz metin tutulmaz: scrypt$tuz$özet. Oturum jetonunun da yalnızca özeti saklanır.
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at  TEXT NOT NULL
);

-- ── Ayarlar ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);

-- ── Sabit sözlük ────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO brands (id, slug, name) VALUES
  (1, 'barmaksan', 'Barmaksan Endüstri A.Ş.'),
  (2, 'ugur',      'Uğur Promilling');

-- Türler yönetimden eklenir/silinir: sözlük yalnızca boş veritabanında bir kez yazılır
-- (her açılışta yazılsaydı yönetimden silinen tür yeniden başlatınca geri gelirdi).
INSERT INTO doc_types (id, slug, name_tr, name_en, short, icon, media_kind, is_versioned, sort)
SELECT * FROM (VALUES
  ( 1, 'teknik-fis',        'Teknik Fiş',          'Technical Sheet',     NULL,  'sheet',       'document', 1,  10),
  ( 2, 'teknik-cizim',      'Teknik Çizim',        'Technical Drawing',   NULL,  'drawing',     'document', 1,  20),
  ( 3, 'spl',               'Yedek Parça Listesi', 'Spare Part List',     'SPL', 'parts',       'document', 1,  30),
  ( 4, 'kullanim-kilavuzu', 'Kullanım Kılavuzu',   'User Manual',         NULL,  'book',        'document', 1,  40),
  ( 5, 'bakim-kilavuzu',    'Bakım Kılavuzu',      'Maintenance Manual',  NULL,  'wrench',      'document', 1,  50),
  ( 6, 'yaglama-tablosu',   'Yağlama Tablosu',     'Lubrication Chart',   NULL,  'drop',        'document', 1,  60),
  ( 7, 'sertifika',         'Sertifika',           'Certificate',         'CE',  'seal',        'document', 1,  70),
  ( 8, 'katalog',           'Katalog',             'Catalogue',           NULL,  'catalog',     'document', 1,  80),
  ( 9, 'sirket-profili',    'Şirket Profili',      'Company Profile',     NULL,  'building',    'document', 1,  90),
  (10, 'musteri-dosyasi',   'Müşteri Dosyası',     'Customer File',       NULL,  'send',        'document', 1, 100),
  (11, 'fotograf',          'Fotoğraf',            'Photo',               NULL,  'photo',       'image',    0, 110),
  (12, 'video',             'Video',               'Video',               NULL,  'video',       'video',    0, 120)
) WHERE NOT EXISTS (SELECT 1 FROM doc_types);

INSERT OR IGNORE INTO schema_version (version) VALUES (1);
