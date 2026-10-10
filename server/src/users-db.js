// Kullanıcı veritabanı (data/users.db): hesaplar, oturumlar, misafirler, kaydedilenler ve giriş
// olayları. İçerik veritabanından ayrıdır; kişisel veri yalnızca burada tutulur.
import fs from 'node:fs';
import Database from 'better-sqlite3';
import { config } from './config.js';
import { db as contentDb } from './db.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS accounts (
  id             INTEGER PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE COLLATE NOCASE,
  role           TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  first_name     TEXT,
  last_name      TEXT,
  company        TEXT,
  job_title      TEXT,
  phone          TEXT,
  country        TEXT,
  password_hash  TEXT,                         -- yalnızca Google ile açılan hesapta boş
  google_sub     TEXT UNIQUE,
  kvkk_at        TEXT,                         -- KVKK aydınlatma metni onayı
  marketing      INTEGER NOT NULL DEFAULT 0 CHECK (marketing IN (0, 1)),
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_login_at  TEXT,
  disabled_at    TEXT
);
CREATE TABLE IF NOT EXISTS guests (
  id            INTEGER PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT,
  company       TEXT,
  kvkk_at       TEXT NOT NULL,
  visits        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_seen_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
-- Oturum jetonu yalnızca özetiyle (SHA-256) saklanır: veritabanı sızsa bile jeton elde edilemez.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash    TEXT PRIMARY KEY,
  kind          TEXT NOT NULL CHECK (kind IN ('account', 'guest')),
  account_id    INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
  guest_id      INTEGER REFERENCES guests(id) ON DELETE CASCADE,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_seen_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at    TEXT NOT NULL,
  user_agent    TEXT,
  CHECK ((kind = 'account') = (account_id IS NOT NULL) AND (kind = 'guest') = (guest_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS sessions_account ON sessions(account_id);
CREATE TABLE IF NOT EXISTS saved (
  account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  doc_id      TEXT NOT NULL,
  item_json   TEXT NOT NULL CHECK (json_valid(item_json)),
  saved_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (account_id, doc_id)
);
-- Giriş olayları: güvenlik denetimi ve yönetim panelindeki istatistikler. IP açık tutulmaz (özet).
CREATE TABLE IF NOT EXISTS auth_events (
  id          INTEGER PRIMARY KEY,
  at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  kind        TEXT NOT NULL,
  email       TEXT,
  account_id  INTEGER,
  ip_hash     TEXT
);
CREATE INDEX IF NOT EXISTS auth_events_at ON auth_events(at);
`;

function open() {
  fs.mkdirSync(config.dataDir, { recursive: true });
  const udb = new Database(config.usersDbPath);
  udb.pragma('journal_mode = WAL');
  udb.pragma('synchronous = NORMAL');
  udb.pragma('foreign_keys = ON');
  udb.pragma('busy_timeout = 5000');
  udb.exec(SCHEMA);
  return udb;
}

export const udb = open();

// İlk açılışta içerik veritabanındaki eski yöneticiler (şifre özetleriyle) buraya taşınır.
// Sonrasında yöneticiler de yalnızca burada yaşar.
if (!udb.prepare('SELECT count(*) AS n FROM accounts').get().n) {
  const legacy = contentDb.prepare('SELECT email, name, password_hash, created_at FROM users').all();
  const insert = udb.prepare(`INSERT INTO accounts (email, role, first_name, last_name, password_hash, kvkk_at, created_at)
    VALUES (?, 'admin', ?, ?, ?, ?, ?)`);
  udb.transaction(() => {
    for (const u of legacy) {
      const [first, ...rest] = String(u.name ?? '').trim().split(/\s+/);
      insert.run(u.email, first || null, rest.join(' ') || null, u.password_hash, u.created_at, u.created_at);
    }
  })();
}
