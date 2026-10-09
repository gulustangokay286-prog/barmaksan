// Safe, repeatable import. Existing machine content is never overwritten.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { db } from '../src/db.js';
import { saveMachineContent } from '../src/content.js';

export function importProductContent() {
  const path = fileURLToPath(new URL('../../assets/site/product-content.json', import.meta.url));
  if (!fs.existsSync(path)) return { imported: 0, skipped: 0 };
  const catalog = JSON.parse(fs.readFileSync(path, 'utf8'));
  let imported = 0, skipped = 0;
  db.transaction(() => {
    for (const [slug, profiles] of Object.entries(catalog)) {
      const f = db.prepare("SELECT id FROM folders WHERE slug=? AND kind='machine' AND archived_at IS NULL").get(slug);
      if (!f || db.prepare('SELECT 1 FROM machine_content WHERE folder_id=?').get(f.id)) { skipped++; continue; }
      saveMachineContent(slug, { revision: 0, profiles, gallery: null, maintenance: [], note: 'Resmi ürün verilerinin ilk aktarımı' }, 'Uğur Promilling · ürün sayfası');
      imported++;
    }
  })();
  return { imported, skipped };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  console.log(importProductContent());
  db.close();
}
