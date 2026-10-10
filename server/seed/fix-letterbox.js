// Mevcut görsellerin önizlemelerindeki gömülü siyah şeritleri kırpar. Orijinallere dokunmaz;
// yalnızca şerit bulunan görseller için yeni adlı türetilmişler yazar (thumb.lb.webp), eskileri siler.
// Tekrar çalıştırmak güvenlidir: işlenmiş görseller atlanır.
//   npm --prefix server run fix:letterbox            → uygula
//   npm --prefix server run fix:letterbox -- --dry   → yalnızca listele
import fsp from 'node:fs/promises';
import path from 'node:path';
import { db } from '../src/db.js';
import { fileKind, letterboxRegion, storagePath, writeImageDerivatives } from '../src/media.js';

const dry = process.argv.includes('--dry');
const SUFFIX = 'lb';
const files = db.prepare('SELECT id, sha256, ext, original_name, storage_key, thumb_key, preview_key FROM files WHERE thumb_key IS NOT NULL').all()
  .filter((f) => fileKind(f.ext) === 'image' && !f.thumb_key.endsWith(`.${SUFFIX}.webp`));
const update = db.prepare('UPDATE files SET thumb_key = ?, preview_key = ? WHERE id = ?');

let fixed = 0;
for (const f of files) {
  const src = storagePath(f.storage_key);
  const region = await letterboxRegion(src).catch(() => null);
  if (!region) continue;
  fixed++;
  console.log(`#${f.id} ${f.original_name} → ${region.width}×${region.height} (sol ${region.left}, üst ${region.top})`);
  if (dry) continue;
  const derivedDir = path.posix.dirname(f.thumb_key);
  const keys = await writeImageDerivatives(src, derivedDir, SUFFIX);
  update.run(keys.thumb, keys.preview, f.id);
  for (const old of [f.thumb_key, f.preview_key]) if (old) await fsp.rm(storagePath(old), { force: true });
}
console.log(`${files.length} görsel tarandı, ${fixed} görselde siyah şerit ${dry ? 'bulundu' : 'kırpıldı'}.`);
