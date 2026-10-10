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
 * Görsele gömülü siyah şeritleri (letterbox / pillarbox) bulur ve içerik alanını döner.
 * Şerit sayılması için bir çizginin hem ortalaması hem en parlak pikseli siyaha yakın olmalı;
 * böylece karanlık bir sahnenin gölgeli kenarı asla kırpılmaz. Kenar başına en çok %8.
 * @returns {Promise<{ left: number, top: number, width: number, height: number } | null>}
 */
export async function letterboxRegion(src) {
  const { data, info } = await sharp(src, { failOn: 'none' }).autoOrient()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const meta = await sharp(src, { failOn: 'none' }).autoOrient().metadata();
  const fullW = meta.autoOrient?.width ?? meta.width, fullH = meta.autoOrient?.height ?? meta.height;
  const isBar = (count, at) => {
    let sum = 0, max = 0;
    for (let i = 0; i < count; i++) { const v = data[at(i)]; sum += v; if (v > max) max = v; }
    return sum / count < 26 && max < 72;
  };
  const col = (x) => isBar(H, (y) => y * W + x);
  const row = (y) => isBar(W, (x) => y * W + x);
  const edge = (test, limit) => { let n = 0; while (n < limit && test(n)) n++; return n === limit ? 0 : n; };
  const lim = (d) => Math.floor(d * 0.08);
  const sides = {
    left: edge((i) => col(i), lim(W)),
    right: edge((i) => col(W - 1 - i), lim(W)),
    top: edge((i) => row(i), lim(H)),
    bottom: edge((i) => row(H - 1 - i), lim(H)),
  };
  if (!sides.left && !sides.right && !sides.top && !sides.bottom) return null;
  // Kenardaki yumuşatılmış geçiş çizgisi de gitsin: bulunan şeride bir çizgi pay eklenir.
  const sx = fullW / W, sy = fullH / H;
  const cut = (n, s) => (n ? Math.ceil((n + 1) * s) : 0);
  const left = cut(sides.left, sx), right = cut(sides.right, sx);
  const top = cut(sides.top, sy), bottom = cut(sides.bottom, sy);
  const width = fullW - left - right, height = fullH - top - bottom;
  if (width < fullW * 0.8 || height < fullH * 0.8) return null;
  return { left, top, width, height };
}

/**
 * Bir görselin küçük resmini ve önizlemesini yazar; gömülü siyah şeritler kırpılır.
 * `suffix` verilirse dosya adına eklenir (thumb.<suffix>.webp): önbellekteki eski hâl geçersiz olur.
 */
export async function writeImageDerivatives(src, derivedDir, suffix = '') {
  const region = await letterboxRegion(src).catch(() => null);
  const base = () => {
    const img = sharp(src, { failOn: 'none' }).autoOrient();
    return region ? img.extract(region) : img;
  };
  const name = (kind) => `${derivedDir}/${kind}${suffix ? `.${suffix}` : ''}.webp`;
  const thumb = name('thumb'), preview = name('preview');
  await base().resize({ width: 720, height: 720, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(storagePath(thumb));
  await base().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 88 }).toFile(storagePath(preview));
  return { thumb, preview, region };
}

/** İndirme boyutları (uzun kenar, px; null = tam boyut) ve biçimleri. */
export const EXPORT_SIZES = { kucuk: 1280, orta: 2560, buyuk: 4096, tam: null };
export const EXPORT_FORMATS = { jpg: 'image/jpeg', png: 'image/png' };

/**
 * Bir görselin istenen boyut/biçimdeki kopyası. İlk istekte üretilir, diskte içerik adresiyle
 * saklanır (aynı dosya + seçenek her zaman aynı kopya); orijinal asla değişmez, büyütülmez.
 */
export async function imageExport(file, size, format) {
  const key = `exports/${file.sha256}/${size}.${format}`;
  const dest = storagePath(key);
  if (fs.existsSync(dest)) return dest;
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  let img = sharp(storagePath(file.storage_key), { failOn: 'none' }).autoOrient();
  const edge = EXPORT_SIZES[size];
  if (edge) img = img.resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true });
  img = format === 'jpg' ? img.flatten({ background: '#ffffff' }).jpeg({ quality: 88, mozjpeg: true }) : img.png({ compressionLevel: 9 });
  const tmp = `${dest}.${process.pid}.${Date.now()}.tmp`;
  await img.toFile(tmp);
  await fsp.rename(tmp, dest);
  return dest;
}

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
      const keys = await writeImageDerivatives(src, derivedDir);
      row.thumb_key = keys.thumb;
      row.preview_key = keys.preview;
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
