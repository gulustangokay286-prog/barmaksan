import fs from 'node:fs';
import Database from 'better-sqlite3';
import { config } from './config.js';

function open() {
  fs.mkdirSync(config.dataDir, { recursive: true });
  const db = new Database(config.dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.exec(fs.readFileSync(config.schemaPath, 'utf8'));
  migrate(db);
  return db;
}

/** Var olan veritabanlarına sonradan eklenen sütunlar (CREATE IF NOT EXISTS bunları eklemez). */
function migrate(db) {
  const columns = new Set(db.prepare('PRAGMA table_info(machine_content)').all().map((c) => c.name));
  if (!columns.has('links_json')) db.exec("ALTER TABLE machine_content ADD COLUMN links_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(links_json))");
}

export const db = open();

export const now = () => new Date().toISOString();

export function tx(fn) {
  return db.transaction(fn)();
}
