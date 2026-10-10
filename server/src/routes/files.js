// Dosya teslimi. Orijinaller Range destekli (video ileri sarma), türetilmişler
// içerik adresli olduğu için kalıcı önbelleklenir. Kalıcı bağlantılar (/d/…)
// asla önbelleklenmez: her zaman o anki güncel sürümü açar.
import fs from 'node:fs';
import { Router } from 'express';
import { db } from '../db.js';
import { config } from '../config.js';
import { EXPORT_FORMATS, EXPORT_SIZES, fileKind, imageExport, isInlineSafe, pdfPagePreview, storagePath } from '../media.js';
import { safeFileName } from '../text.js';
import { isMember, viewerOf } from '../accounts.js';

export const fileRoutes = Router();

const fileById = db.prepare('SELECT * FROM files WHERE id = ?');
const IMMUTABLE = 'public, max-age=31536000, immutable';

// Belge içeriği (PDF ve sayfa önizlemeleri) misafir ya da üye oturumu ister; görseller, videolar
// ve küçük resimler herkese açık. Kapılı yanıtlar ortak önbelleklerde (CDN/vekil) tutulmaz.
const documentFile = db.prepare(`SELECT 1 FROM document_versions v JOIN documents d ON d.id = v.document_id
  JOIN doc_types t ON t.id = d.doc_type_id WHERE v.file_id = ? AND t.media_kind = 'document' LIMIT 1`);
const PRIVATE_IMMUTABLE = 'private, max-age=31536000, immutable';
function gated(req, res, file) {
  if (!documentFile.get(file.id)) return false;
  res.setHeader('Vary', 'Cookie');
  if (viewerOf(req)) return false;
  res.setHeader('Cache-Control', 'no-store');
  res.status(401).json({ error: 'Belgeyi görmek için giriş yapın ya da e-postanızla devam edin', gate: 'viewer' });
  return true;
}
function fileCache(req, file) {
  if (req.query.v !== file.sha256) return 'no-cache, must-revalidate';
  return documentFile.get(file.id) ? PRIVATE_IMMUTABLE : IMMUTABLE;
}
function staleContent(req, res, file) {
  if (req.query.v && req.query.v !== file.sha256) { res.setHeader('Cache-Control', 'no-store'); res.status(404).end(); return true; }
  return false;
}
function sendDerived(res, key, cache) {
  if (!key) return res.status(404).end();
  const p = storagePath(key);
  if (!fs.existsSync(p)) return res.status(404).end();
  res.setHeader('Cache-Control', cache);
  res.type('image/webp');
  res.sendFile(p);
}

function attachmentHeader(res, filename, inline) {
  const encoded = encodeURIComponent(filename);
  const ascii = filename.normalize('NFKD').replace(/[^\x20-\x7e]/g, '').replace(/"/g, '') || 'dosya';
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encoded}`);
}

function sendOriginal(res, file, { download, name, cache }) {
  const p = storagePath(file.storage_key);
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'Dosya diskte bulunamadı' });
  const filename = safeFileName(name ?? file.original_name);
  const inline = !download && isInlineSafe(file.mime);
  attachmentHeader(res, filename, inline);
  res.setHeader('Content-Type', file.mime);
  // Satır içi yalnızca güvenli türler açılır (PDF, görsel, video). Geri kalanı her
  // zaman indirilir ve yalıtılır: yüklenen içerik bu alan adında betik çalıştıramaz.
  if (!inline) res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
  res.setHeader('Cache-Control', cache);
  res.sendFile(p, { acceptRanges: true, headers: { 'Content-Type': file.mime } });
}

fileRoutes.get('/files/:id/thumb.webp', (req, res) => {
  const f = fileById.get(Number(req.params.id));
  if (!f) return res.status(404).end();
  if (staleContent(req,res,f)) return;
  sendDerived(res, f.thumb_key, fileCache(req,f));
});

fileRoutes.get('/files/:id/preview.webp', (req, res) => {
  const f = fileById.get(Number(req.params.id));
  if (!f) return res.status(404).end();
  if (staleContent(req,res,f)) return;
  if (gated(req, res, f)) return;
  sendDerived(res, f.preview_key ?? f.thumb_key, fileCache(req,f));
});

fileRoutes.get('/files/:id/page/:n.webp', async (req, res, next) => {
  const f = fileById.get(Number(req.params.id));
  const n = Number(req.params.n);
  if (!f || f.ext !== 'pdf' || !Number.isInteger(n) || n < 1 || n > Math.min(f.page_count ?? 0, config.maxPreviewPages)) {
    return res.status(404).end();
  }
  try {
    if (staleContent(req,res,f)) return;
    if (gated(req, res, f)) return;
    const p = await pdfPagePreview(f, n);
    res.setHeader('Cache-Control', fileCache(req,f));
    res.type('image/webp');
    res.sendFile(p);
  } catch (err) {
    next(err);
  }
});

fileRoutes.get('/files/:id/raw/:name', (req, res) => {
  const f = fileById.get(Number(req.params.id));
  if (!f) return res.status(404).end();
  if (staleContent(req,res,f)) return;
  if (gated(req, res, f)) return;
  sendOriginal(res, f, { download: req.query.indir !== undefined, cache: fileCache(req,f) });
});

// ── Kalıcı bağlantılar ──────────────────────────────────────────────────────

const docVersion = db.prepare(`
  SELECT d.title_tr, v.version_no, t.media_kind, (v.id = d.current_version_id) AS is_current, fi.*
  FROM documents d
  JOIN doc_types t ON t.id = d.doc_type_id
  JOIN document_versions v ON v.document_id = d.id AND (CASE WHEN ? IS NULL THEN v.id = d.current_version_id ELSE v.version_no = ? END)
  JOIN files fi ON fi.id = v.file_id
  WHERE d.public_id = ? AND d.archived_at IS NULL`);

const EXPORT_LABELS = { kucuk: 'küçük', orta: 'orta', buyuk: 'büyük', tam: 'tam boyut' };

async function permalink(req, res, next, { download }) {
  const vn = req.params.n === undefined ? null : Number(req.params.n);
  const row = docVersion.get(vn, vn, req.params.pid);
  if (!row) return res.status(404).json({ error: 'Doküman ya da sürüm bulunamadı' });
  if (row.media_kind === 'document') {
    res.setHeader('Vary', 'Cookie');
    const viewer = viewerOf(req);
    // Belgeler giriş/misafir ister; eski bir sürümü açmak üyelik ister.
    if (!viewer || (!row.is_current && !isMember(viewer))) {
      res.setHeader('Cache-Control', 'no-store');
      const back = encodeURIComponent(req.originalUrl);
      if (req.accepts(['html', 'json']) === 'html') return res.redirect(302, `/giris?donus=${back}`);
      return res.status(401).json({ error: 'Belgeyi görmek için giriş yapın', gate: viewer ? 'member' : 'viewer' });
    }
  }
  const name = `${row.title_tr} v${row.version_no}.${row.ext}`;
  // Güncel sürüm bağlantısı her istekte yeniden doğrulanır; sabit sürüm değişmez.
  const cache = vn === null ? 'no-cache, must-revalidate' : (row.media_kind === 'document' ? PRIVATE_IMMUTABLE : IMMUTABLE);
  res.setHeader('X-Document-Version', String(row.version_no));
  // Görseller istenen boyut ve biçimde de indirilebilir: ?boyut=kucuk|orta|buyuk|tam&bicim=jpg|png
  if (download && (req.query.boyut !== undefined || req.query.bicim !== undefined)) {
    const size = String(req.query.boyut ?? 'tam');
    const format = String(req.query.bicim ?? 'jpg');
    if (fileKind(row.ext) !== 'image' || !Object.hasOwn(EXPORT_SIZES, size) || !Object.hasOwn(EXPORT_FORMATS, format)) {
      return res.status(400).json({ error: 'Bu dosya için geçersiz boyut ya da biçim' });
    }
    try {
      const p = await imageExport(row, size, format);
      attachmentHeader(res, safeFileName(`${row.title_tr} (${EXPORT_LABELS[size]}).${format}`), false);
      res.setHeader('Cache-Control', cache);
      res.type(EXPORT_FORMATS[format]);
      return res.sendFile(p);
    } catch (err) {
      return next(err);
    }
  }
  sendOriginal(res, row, { download, name, cache });
}

fileRoutes.get('/d/:pid', (req, res, next) => permalink(req, res, next, { download: false }));
fileRoutes.get('/d/:pid/indir', (req, res, next) => permalink(req, res, next, { download: true }));
fileRoutes.get('/d/:pid/v/:n', (req, res, next) => permalink(req, res, next, { download: false }));
fileRoutes.get('/d/:pid/v/:n/indir', (req, res, next) => permalink(req, res, next, { download: true }));
