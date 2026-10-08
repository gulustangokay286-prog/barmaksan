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
  return db;
}

export const db = open();

export const now = () => new Date().toISOString();

export function tx(fn) {
  return db.transaction(fn)();
}
