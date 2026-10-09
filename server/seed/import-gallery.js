// Imports a local directory of original renders. Source files are kept;
// identical files/documents are reused on subsequent runs.
// node seed/import-gallery.js cleanmax-4 /absolute/path/to/renders
import fs from 'node:fs/promises';
import path from 'node:path';
import { db } from '../src/db.js';
import { config } from '../src/config.js';
import { ingest } from '../src/media.js';
import { createDocument, updateFolder } from '../src/commands.js';
import { machineContent, saveMachineContent } from '../src/content.js';

const [slug, directory] = process.argv.slice(2);
const machine = db.prepare("SELECT f.* FROM folders f JOIN machines m ON m.folder_id=f.id WHERE f.slug=? AND f.archived_at IS NULL").get(slug ?? '');
if (!machine || !directory) throw new Error('Usage: node seed/import-gallery.js machine-slug /absolute/render/directory');
const names = (await fs.readdir(directory)).filter((n) => /^T\d+.*\.(png|jpg|jpeg|webp)$/i.test(n)).sort((a,b) => a.localeCompare(b, 'en', { numeric:true }));
if (!names.length) throw new Error('No render files found');
await fs.mkdir(config.tmpDir, { recursive:true });
const docs = [], files = [];
for (const name of names) {
  const temp = path.join(config.tmpDir, `render-${crypto.randomUUID()}${path.extname(name)}`);
  await fs.copyFile(path.join(directory,name),temp);
  const file = await ingest(temp,name);
  if (!file.thumb_key || !file.preview_key) throw new Error(`Preview generation failed: ${name}`);
  const existing = db.prepare('SELECT d.public_id FROM documents d JOIN document_versions v ON v.id=d.current_version_id WHERE d.folder_id=? AND v.file_id=? AND d.archived_at IS NULL').get(machine.id,file.id);
  const angle = /^T(\d+)/i.exec(name)[1];
  const id = existing?.public_id ?? createDocument({ folder:slug, type:'fotograf', titleTr:`${machine.name_tr} — T${angle}`, titleEn:`${machine.name_en} — T${angle}`, language:'none', fileId:file.id, author:null, note:'Salih Abi’nin gönderdiği T8 ürün görseli', tags:'T8 ürün görseli render' }).publicId;
  docs.push(id); files.push(file);
  console.log(`${slug} T${angle}: ${file.width}×${file.height}, ${file.size_bytes} bytes (original)`);
}
const content = machineContent(slug);
const gallery = content.gallery == null ? docs : [...new Set([...content.gallery, ...docs])];
if (JSON.stringify(gallery) !== JSON.stringify(content.gallery)) saveMachineContent(slug, { ...content, gallery, note:'T8 fotoğraf galerisi eklendi' }, null);
const currentCover = db.prepare('SELECT cover_file_id id FROM machines WHERE folder_id=?').get(machine.id);
if (!currentCover.id) updateFolder(slug, { machine:{ coverFileId:files[0].id } }, null);
console.log(`${slug}: ${docs.length} original images; gallery ready.`);
db.close();
