// Bilgi Kütüphanesi — ilk kurulum. Kullanım: `npm run seed -- --reset`
//
// Yalnızca gerçek içerik: makine adları, özetleri ve fotoğrafları (ugurpromilling.com), SCS
// Kontrol Eleği teknik fişi (Salih Abi'nin gönderdiği), Uğur kataloğları, tesis ve ürün
// görselleri. Uydurma belge, sürüm, yazar ya da tarih yoktur; eksikler yönetim panelinde
// "Eksik belgeler" ekranında görünür ve oradan yüklenir.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { config } from '../src/config.js';

const args = new Set(process.argv.slice(2));
if (args.has('--reset')) {
  for (const p of [config.dbPath, `${config.dbPath}-wal`, `${config.dbPath}-shm`]) fs.rmSync(p, { force: true });
  fs.rmSync(config.storageDir, { recursive: true, force: true });
}

const { db } = await import('../src/db.js');
const { ingest } = await import('../src/media.js');
const cmd = await import('../src/commands.js');
const { DEFAULT_FEATURED, setSetting } = await import('../src/settings.js');
const { machines: buildMachines, categories } = await import('./catalog.js');

if (db.prepare('SELECT count(*) AS n FROM folders').get().n > 0) {
  console.error('Veritabanı dolu. Sıfırdan kurmak için: npm run seed -- --reset');
  process.exit(1);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.resolve(process.env.SEED_ASSETS ?? path.join(here, '..', '..', 'assets'));
const WORK = path.join(config.dataDir, 'seed-work');
const CACHE = path.join(config.dataDir, 'seed-cache');
await fsp.mkdir(WORK, { recursive: true });
await fsp.mkdir(CACHE, { recursive: true });

const t0 = Date.now();
let workCounter = 0;
const work = (ext) => path.join(WORK, `w${(workCounter += 1)}.${ext}`);

async function ingestCopy(src, name) {
  const tmp = work(path.extname(src).slice(1) || 'bin');
  await fsp.copyFile(src, tmp);
  return ingest(tmp, name ?? path.basename(src));
}

/** Tek sürümlü belge: dosya olduğu gibi, yazar ve not yok. */
function addDocument({ folder, type, titleTr, titleEn = null, language, tags, file }) {
  return cmd.createDocument({ folder, type, titleTr, titleEn, language, tags, fileId: file.id, note: null }).publicId;
}

function download(url, name) {
  const dest = path.join(CACHE, name);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return dest;
  console.log(`  indiriliyor: ${name}`);
  const res = spawnSync('curl', ['-sSfL', '--max-time', '900', '-o', `${dest}.part`, url], { stdio: 'inherit' });
  if (res.status !== 0) { fs.rmSync(`${dest}.part`, { force: true }); return null; }
  fs.renameSync(`${dest}.part`, dest);
  return dest;
}

// ── Klasör ağacı ────────────────────────────────────────────────────────────

console.log('Klasörler…');
cmd.createFolder({ slug: 'makineler', nameTr: 'Makineler', nameEn: 'Machines', sort: 0,
  descriptionTr: 'Her makinenin teknik fişi, çizimleri, yedek parça listesi, kılavuzları, fotoğraf ve videoları.',
  descriptionEn: 'Technical sheets, drawings, spare part lists, manuals, photos and videos of every machine.' });
cmd.createFolder({ slug: 'kurumsal', nameTr: 'Kurumsal', nameEn: 'Corporate', sort: 1,
  descriptionTr: 'Sertifikalar, kataloglar, şirket profilleri ve müşteriye gönderilecek dosyalar.',
  descriptionEn: 'Certificates, catalogues, company profiles and files for customers.' });
cmd.createFolder({ slug: 'medya', nameTr: 'Medya', nameEn: 'Media', sort: 2,
  descriptionTr: 'Tanıtım videoları, fabrika ve drone çekimleri, ürün görselleri. Orijinal çözünürlükte.',
  descriptionEn: 'Promotional films, factory and drone footage, product imagery. In original resolution.' });

categories.forEach((c, i) => cmd.createFolder({ parent: 'makineler', kind: 'category', slug: c.slug, nameTr: c.tr, nameEn: c.en, sort: i }));

const collections = [
  ['kurumsal', 'sertifikalar', 'Sertifikalar', 'Certificates', 'CE belgeleri, kalite ve yönetim sistemi sertifikaları.'],
  ['kurumsal', 'kataloglar', 'Kataloglar', 'Catalogues', 'Makine, referans ve yedek parça katalogları.'],
  ['kurumsal', 'sirket-profilleri', 'Şirket Profilleri', 'Company Profiles', 'Türkçe ve İngilizce şirket tanıtım dosyaları.'],
  ['kurumsal', 'musteri-dosyalari', 'Müşteri Dosyaları', 'Customer Files', 'Tekliflere eklenen, müşteriye gönderilecek standart dosyalar.'],
  ['medya', 'tanitim-videolari', 'Tanıtım Videoları', 'Promotional Films', null],
  ['medya', 'fabrika-fotograflari', 'Fabrika Fotoğrafları', 'Factory Photos', null],
  ['medya', 'drone-cekimleri', 'Drone Çekimleri', 'Drone Footage', null],
  ['medya', 'urun-gorselleri', 'Ürün Görselleri', 'Product Imagery', 'Sosyal medya ve basın için ürün görselleri.'],
];
collections.forEach(([parent, slug, tr, en, desc], i) => cmd.createFolder({ parent, kind: 'collection', slug, nameTr: tr, nameEn: en, descriptionTr: desc, sort: i }));

// ── Makineler: ad, özet ve fotoğraf ─────────────────────────────────────────

const site = JSON.parse(await fsp.readFile(path.join(ASSETS, 'site', 'catalog.json'), 'utf8'));
const machines = buildMachines(site);

console.log(`${machines.length} makine…`);
let docCount = 0;
for (const [i, m] of machines.entries()) {
  const cover = m.image ? await ingestCopy(path.join(ASSETS, 'site', m.image), `${m.slug}.${m.image.split('.').pop()}`) : null;
  cmd.createFolder({
    parent: m.category, kind: 'machine', slug: m.slug, nameTr: m.tr, nameEn: m.en, sort: m.sort,
    machine: { brandId: 2, modelCode: m.modelCode, models: m.models, summaryTr: m.summaryTr, summaryEn: m.summaryEn, coverFileId: cover?.id ?? null },
  });
  if (cover) {
    addDocument({ folder: m.slug, type: 'fotograf', titleTr: `${m.tr} — Ürün Fotoğrafı`, titleEn: `${m.en} — Product Photo`, language: 'none', file: cover });
    docCount += 1;
  }
  process.stdout.write(`\r  ${i + 1}/${machines.length} ${m.slug.padEnd(32)}`);
}
process.stdout.write('\n');

// Kontrol Eleği teknik fişi: Salih Abi'nin gönderdiği gerçek dosya.
addDocument({
  folder: 'kontrol-elegi', type: 'teknik-fis', titleTr: 'Kontrol Eleği — Teknik Fiş', titleEn: 'Control Plansifter — Technical Sheet',
  language: 'tr-en', tags: 'scs elek plansifter',
  file: await ingestCopy(path.join(ASSETS, '..', 'docs', 'brief', 'SCS-2-kontrol-elegi.pdf'), 'SCS-2.pdf'),
});
docCount += 1;

// Thunderoll'un sitedeki çekimleri.
const photoIds = new Map();
for (const [file, dir, tr] of [['original-design.jpg', 'scenes', 'Montaj salonu'], ['export-120.jpg', 'scenes', 'Değirmen salonu'], ['thunderoll.jpg', 'products', 'Stüdyo çekimi']]) {
  const id = addDocument({ folder: 'valsli-degirmen-thunderoll', type: 'fotograf', titleTr: `Thunderoll — ${tr}`, language: 'none', file: await ingestCopy(path.join(ASSETS, 'site', dir, file)) });
  if (file === 'thunderoll.jpg') photoIds.set(file, id);
  docCount += 1;
}

// ── Kurumsal: Uğur kataloğları ──────────────────────────────────────────────

console.log('Kataloglar…');
const catalogs = [
  ['https://www.ugurpromilling.com/storage/app/media//katalog/uguryedekparca.pdf', 'Uğur Yedek Parça Kataloğu.pdf', 'Yedek Parça Kataloğu', 'Spare Parts Catalogue', 'tr-en'],
  ['https://www.ugurpromilling.com/storage/app/media//Machine%20Catalogue.pdf', 'Uğur Machine Catalogue.pdf', 'Makine Kataloğu', 'Machine Catalogue', 'en'],
  ['https://www.ugurpromilling.com/storage/app/media//Reference-catalogue.pdf', 'Uğur Reference Catalogue.pdf', 'Referans Kataloğu', 'Reference Catalogue', 'en'],
];
for (const [i, [url, name, tr, en, lang]] of catalogs.entries()) {
  if (args.has('--no-large') && i > 0) continue;
  const src = download(url, name);
  if (!src) { console.warn(`  atlandı (indirilemedi): ${name}`); continue; }
  addDocument({ folder: 'kataloglar', type: 'katalog', titleTr: tr, titleEn: en, language: lang, file: await ingestCopy(src, name) });
  docCount += 1;
}

// ── Medya: tesis ve ürün görselleri ─────────────────────────────────────────

console.log('Medya…');
const scene = (f) => path.join(ASSETS, 'site', 'scenes', f);
const photos = [
  ['fabrika-fotograflari', 'original-design.jpg', 'Thunderoll montaj salonu'],
  ['fabrika-fotograflari', 'tech-2.jpg', 'Montaj ve son kontrol'],
  ['fabrika-fotograflari', 'export-120.jpg', 'Değirmen salonu — Thunderoll hattı'],
  ['fabrika-fotograflari', 'green-field.jpg', 'Silo ve tesis'],
  ['fabrika-fotograflari', 'history-2024.jpg', 'Çatı güneş enerjisi santrali'],
  ['fabrika-fotograflari', 'tech-1.jpg', 'Yenilenebilir enerji'],
  ['fabrika-fotograflari', 'history-1955.jpg', 'Uğur Torna Atölyesi plakası, 1955'],
  ['drone-cekimleri', 'since-1955.jpg', 'Çorum OSB tesisi — kuşbakışı'],
  ['drone-cekimleri', 'about.jpg', 'Tesis girişi ve peyzaj — kuşbakışı'],
  ['urun-gorselleri', 'hero-1.jpg', 'Ürün ailesi — temizleme'],
  ['urun-gorselleri', 'hero-2.jpg', 'Ürün ailesi — öğütme'],
  ['urun-gorselleri', 'band-1.jpg', 'Ürün ailesi bandı 1'],
  ['urun-gorselleri', 'band-2.jpg', 'Ürün ailesi bandı 2'],
  ['urun-gorselleri', 'mill.png', 'Yel değirmeni illüstrasyonu'],
];
for (const [folder, f, tr] of photos) {
  const id = addDocument({ folder, type: 'fotograf', titleTr: tr, language: 'none', file: await ingestCopy(scene(f)) });
  if (!photoIds.has(f)) photoIds.set(f, id);
  docCount += 1;
}

// Ana sayfa: üstteki fotoğraflar kütüphanedeki fotoğraf belgelerine bağlı; yönetimden değişir.
setSetting('home.featured', DEFAULT_FEATURED);
setSetting('home.slides', [
  ['since-1955.jpg', 'Çorum OSB üretim tesisi', 'Çorum production campus'],
  ['export-120.jpg', 'Değirmen salonu, Thunderoll hattı', 'Mill hall, Thunderoll line'],
  ['original-design.jpg', 'Thunderoll montajı', 'Thunderoll assembly'],
  ['thunderoll.jpg', 'Thunderoll valsli değirmen', 'Thunderoll roller mill'],
  ['green-field.jpg', 'Silolar ve tesis', 'Silos and plant'],
  ['tech-2.jpg', 'Montaj ve son kontrol', 'Assembly and final inspection'],
].filter(([f]) => photoIds.has(f)).map(([f, tr, en]) => ({ doc: photoIds.get(f), tr, en })));

// Kurulumun kendisi bir kullanıcı hareketi değildir: tek kayıt bırakılır.
db.prepare('DELETE FROM activity').run();
db.prepare("INSERT INTO activity (action, detail) VALUES ('library.imported', ?)").run(JSON.stringify({ machines: machines.length, documents: docCount }));

await fsp.rm(WORK, { recursive: true, force: true });
const s = db.prepare("SELECT (SELECT count(*) FROM folders) f, (SELECT count(*) FROM documents) d, (SELECT count(*) FROM document_versions) v, (SELECT sum(size_bytes) FROM files) b").get();
console.log(`Bitti: ${s.f} klasör, ${s.d} doküman, ${s.v} sürüm, ${(s.b / 1048576).toFixed(0)} MB — ${((Date.now() - t0) / 1000).toFixed(0)} sn`);
db.pragma('wal_checkpoint(TRUNCATE)');
db.close();
