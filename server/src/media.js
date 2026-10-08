// Dosya hattı: orijinali içerik adresiyle saklar (asla değiştirmez), görüntüleme
// için küçük resim / önizleme üretir, PDF metnini arama için çıkarır.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import { config } from './config.js';
import { db } from './db.js';

const require = createRequire(import.meta.url);
const pdfjsBase = path.dirname(require.resolve('pdfjs-dist/package.json'));
const pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs');

sharp.cache(false);

const MIME = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  tif: 'image/tiff', tiff: 'image/tiff', heic: 'image/heic', avif: 'image/avif', svg: 'image/svg+xml',
  mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
  dwg: 'application/acad', dxf: 'image/vnd.dxf', step: 'application/step', stp: 'application/step',
  zip: 'application/zip', txt: 'text/plain', csv: 'text/csv',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

// Tarayıcıda satır içi açılması güvenli olan türler. Diğerleri hep indirilir.
const INLINE_SAFE = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'video/mp4', 'video/quicktime', 'video/webm', 'text/plain']);

const RASTER = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'tif', 'tiff', 'heic', 'avif']);
const VIDEO = new Set(['mp4', 'm4v', 'mov', 'webm']);

export function fileKind(ext) {
  if (ext === 'pdf') return 'pdf';
  if (RASTER.has(ext)) return 'image';
  if (VIDEO.has(ext)) return 'video';
  return 'other';
}

export const isInlineSafe = (mime) => INLINE_SAFE.has(mime);
export const storagePath = (key) => path.join(config.storageDir, key);

function extOf(name) {
  const ext = path.extname(name).slice(1).toLowerCase();
  return /^[a-z0-9]{1,8}$/.test(ext) ? ext : 'bin';
}

async function sha256Of(filePath) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

async function moveInto(src, dest) {
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  try {
    await fsp.rename(src, dest);
  } catch (err) {
    if (err.code !== 'EXDEV') throw err;
    await fsp.copyFile(src, dest);
    await fsp.unlink(src);
  }
}

function run(cmd, args) {
  return new Promise((resolve) => {
    let stderr = '';
    let child;
    try {
      child = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    } catch {
      resolve({ code: -1, stderr: '' });
      return;
    }
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', () => resolve({ code: -1, stderr }));
    child.on('close', (code) => resolve({ code, stderr }));
  });
}

// ── PDF ─────────────────────────────────────────────────────────────────────

async function openPdf(filePath) {
  const pdfjs = await pdfjsPromise;
  const data = new Uint8Array(await fsp.readFile(filePath));
  return pdfjs.getDocument({
    data,
    standardFontDataUrl: `${pdfjsBase}/standard_fonts/`,
    cMapUrl: `${pdfjsBase}/cmaps/`,
    cMapPacked: true,
    wasmUrl: `${pdfjsBase}/wasm/`,
    iccUrl: `${pdfjsBase}/iccs/`,
    isEvalSupported: false,
    verbosity: 0,
  }).promise;
}

async function renderPdfPage(doc, pageNo, width) {
  const page = await doc.getPage(pageNo);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: width / base.width });
  const { canvas, context } = doc.canvasFactory.create(Math.round(viewport.width), Math.round(viewport.height));
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: context, canvas, viewport }).promise;
  const png = await canvas.encode('png');
  page.cleanup();
  return png;
}

const MAX_TEXT = 1_500_000;

async function pdfTextAndThumb(filePath, thumbDest) {
  const doc = await openPdf(filePath);
  try {
    const pageCount = doc.numPages;
    const png = await renderPdfPage(doc, 1, 900);
    await sharp(png).resize({ width: 640 }).webp({ quality: 82 }).toFile(thumbDest);
    let text = '';
    for (let i = 1; i <= pageCount && text.length < MAX_TEXT; i += 1) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((it) => it.str ?? '').join(' ').replace(/\s+/g, ' ') + '\n';
      page.cleanup();
    }
    return { pageCount, text: text.trim().slice(0, MAX_TEXT) };
  } finally {
    await doc.loadingTask.destroy();
  }
}

// Sayfa önizlemeleri ilk istendiğinde üretilir ve saklanır. Aynı anda tek PDF işlenir.
let pageQueue = Promise.resolve();
export function pdfPagePreview(file, pageNo) {
  const key = `derived/${file.sha256}/p-${String(pageNo).padStart(4, '0')}.webp`;
  const dest = storagePath(key);
  if (fs.existsSync(dest)) return Promise.resolve(dest);
  const job = pageQueue.then(async () => {
    if (fs.existsSync(dest)) return dest;
    const doc = await openPdf(storagePath(file.storage_key));
    try {
      const png = await renderPdfPage(doc, pageNo, 1600);
      await fsp.mkdir(path.dirname(dest), { recursive: true });
      await sharp(png).webp({ quality: 84 }).toFile(`${dest}.tmp`);
      await fsp.rename(`${dest}.tmp`, dest);
      return dest;
    } finally {
      await doc.loadingTask.destroy();
    }
  });
  pageQueue = job.catch(() => {});
  return job;
}

// ── Video ───────────────────────────────────────────────────────────────────

async function videoPoster(filePath, posterPng) {
  const probe = await run(config.ffmpeg, ['-hide_banner', '-i', filePath]);
  const dur = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(probe.stderr);
  const size = /Video: .*?(\d{2,5})x(\d{2,5})/.exec(probe.stderr);
  const durationMs = dur ? Math.round(((+dur[1] * 60 + +dur[2]) * 60 + +dur[3]) * 1000) : null;
  const at = durationMs && durationMs > 3000 ? '1.5' : '0';
  const res = await run(config.ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-ss', at, '-i', filePath, '-frames:v', '1', posterPng]);
  return {
    durationMs,
    width: size ? +size[1] : null,
    height: size ? +size[2] : null,
    poster: res.code === 0 && fs.existsSync(posterPng) ? posterPng : null,
  };
}

// ── Kayıt ───────────────────────────────────────────────────────────────────

const findBySha = db.prepare('SELECT * FROM files WHERE sha256 = ?');
const insertFile = db.prepare(`
  INSERT INTO files (sha256, original_name, ext, mime, size_bytes, width, height, duration_ms, page_count,
                     storage_key, thumb_key, preview_key, text_content)
  VALUES (@sha256, @original_name, @ext, @mime, @size_bytes, @width, @height, @duration_ms, @page_count,
          @storage_key, @thumb_key, @preview_key, @text_content)`);

/**
 * Geçici bir dosyayı kütüphaneye alır. Aynı içerik daha önce yüklendiyse mevcut kaydı döner.
 * @param {string} tmpPath  taşınacak geçici dosya (çağrı sonrası artık yoktur)
 * @param {string} originalName
 */
export async function ingest(tmpPath, originalName) {
  const sha256 = await sha256Of(tmpPath);
  const existing = findBySha.get(sha256);
  if (existing) {
    await fsp.rm(tmpPath, { force: true });
    return existing;
  }

  const ext = extOf(originalName);
  const mime = MIME[ext] ?? 'application/octet-stream';
  const storageKey = `originals/${sha256.slice(0, 2)}/${sha256}.${ext}`;
  await moveInto(tmpPath, storagePath(storageKey));
  const { size } = await fsp.stat(storagePath(storageKey));

  const derivedDir = `derived/${sha256}`;
  await fsp.mkdir(storagePath(derivedDir), { recursive: true });
  const row = {
    sha256, original_name: originalName, ext, mime, size_bytes: size,
    width: null, height: null, duration_ms: null, page_count: null,
    storage_key: storageKey, thumb_key: null, preview_key: null, text_content: null,
  };

  const kind = fileKind(ext);
  try {
    if (kind === 'image') {
      const src = storagePath(storageKey);
      const meta = await sharp(src, { failOn: 'none' }).rotate().metadata();
      const oriented = meta.autoOrient ?? meta;
      row.width = oriented.width ?? meta.width ?? null;
      row.height = oriented.height ?? meta.height ?? null;
      await sharp(src, { failOn: 'none' }).rotate().resize({ width: 720, height: 720, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(storagePath(`${derivedDir}/thumb.webp`));
      await sharp(src, { failOn: 'none' }).rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 88 }).toFile(storagePath(`${derivedDir}/preview.webp`));
      row.thumb_key = `${derivedDir}/thumb.webp`;
      row.preview_key = `${derivedDir}/preview.webp`;
    } else if (kind === 'pdf') {
      const { pageCount, text } = await pdfTextAndThumb(storagePath(storageKey), storagePath(`${derivedDir}/thumb.webp`));
      row.page_count = pageCount;
      row.text_content = text || null;
      row.thumb_key = `${derivedDir}/thumb.webp`;
    } else if (kind === 'video') {
      const posterPng = storagePath(`${derivedDir}/poster.png`);
      const v = await videoPoster(storagePath(storageKey), posterPng);
      row.duration_ms = v.durationMs;
      row.width = v.width;
      row.height = v.height;
      if (v.poster) {
        await sharp(v.poster).resize({ width: 720, height: 720, fit: 'inside' }).webp({ quality: 82 }).toFile(storagePath(`${derivedDir}/thumb.webp`));
        await sharp(v.poster).resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 88 }).toFile(storagePath(`${derivedDir}/preview.webp`));
        await fsp.rm(v.poster, { force: true });
        row.thumb_key = `${derivedDir}/thumb.webp`;
        row.preview_key = `${derivedDir}/preview.webp`;
      }
    }
  } catch (err) {
    // Önizleme üretilemese de orijinal güvende; dosya yine de kütüphanede.
    console.warn(`[media] önizleme üretilemedi: ${originalName}: ${err.message}`);
  }

  const info = insertFile.run(row);
  return { id: Number(info.lastInsertRowid), ...row };
}

/**
 * Hiçbir sürümde ya da makine kapağında kullanılmayan dosyaları siler (kayıt + disk).
 * Yeni yüklenenlere dokunmaz: yükleme ile belge kaydı arasındaki kısa aralıkta dosya
 * henüz bağlanmamış olabilir.
 */
export async function pruneOrphanFiles() {
  const cutoff = new Date(Date.now() - 15 * 60_000).toISOString();
  const rows = db.prepare(`
    SELECT * FROM files f
    WHERE f.created_at < ?
      AND NOT EXISTS (SELECT 1 FROM document_versions v WHERE v.file_id = f.id)
      AND NOT EXISTS (SELECT 1 FROM machines m WHERE m.cover_file_id = f.id)`).all(cutoff);
  for (const f of rows) {
    db.prepare('DELETE FROM files WHERE id = ?').run(f.id);
    await fsp.rm(storagePath(f.storage_key), { force: true });
    await fsp.rm(storagePath(`derived/${f.sha256}`), { recursive: true, force: true });
  }
  return rows.length;
}
