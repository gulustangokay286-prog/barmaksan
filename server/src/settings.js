// Ayarlar: settings tablosunda JSON değerler. Yalnızca bilinen anahtarlar okunur/yazılır.
import { db } from './db.js';

/** Makine sayfasında beklenen belge türleri (eksik belgeler raporu bunlara göre). */
export const DEFAULT_COVERAGE_TYPES = ['teknik-fis', 'teknik-cizim', 'spl', 'kullanim-kilavuzu', 'bakim-kilavuzu', 'yaglama-tablosu', 'sertifika'];

/** Ana sayfadaki makine vitrini: her kategoriden, görsel olarak ayırt edilebilir olanlar. */
export const DEFAULT_FEATURED = [
  'cift-katli-valsli-degirmen', 'valsli-degirmen-thunderoll', 'grandsifter', 'cleanmax-4', 'kontrol-elegi', 'irmik-sasoru', 'ultrator',
  'karusel-paketleme-makinesi', 'gronamac', 'jet-filtre', 'otomatik-paketleme-makinesi', 'kabuk-soyucu',
];

const read = db.prepare('SELECT value FROM settings WHERE key = ?');
const write = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');

export function getSetting(key, fallback) {
  const row = read.get(key);
  if (!row) return fallback;
  try {
    return JSON.parse(row.value);
  } catch {
    return fallback;
  }
}

export function setSetting(key, value) {
  write.run(key, JSON.stringify(value));
}
