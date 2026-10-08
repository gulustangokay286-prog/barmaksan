// Dosya teslimi. Orijinaller Range destekli (video ileri sarma), türetilmişler
// içerik adresli olduğu için kalıcı önbelleklenir. Kalıcı bağlantılar (/d/…)
// asla önbelleklenmez: her zaman o anki güncel sürümü açar.
import fs from 'node:fs';
import { Router } from 'express';
import { db } from '../db.js';
import { config } from '../config.js';
import { isInlineSafe, pdfPagePreview, storagePath } from '../media.js';
import { safeFileName } from '../text.js';

export const fileRoutes = Router();

const fileById = db.prepare('SELECT * FROM files WHERE id = ?');
const IMMUTABLE = 'public, max-age=31536000, immutable';

function sendDerived(res, key) {
  if (!key) return res.status(404).end();
  const p = storagePath(key);
  if (!fs.existsSync(p)) return res.status(404).end();
  res.setHeader('Cache-Control', IMMUTABLE);
  res.type('image/webp');
  res.sendFile(p);
}

function sendOriginal(res, file, { download, name, cache }) {
  const p = storagePath(file.storage_key);
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'Dosya diskte bulunamadı' });
  const filename = safeFileName(name ?? file.original_name);
  const inline = !download && isInlineSafe(file.mime);
  const encoded = encodeURIComponent(filename);
  const ascii = filename.normalize('NFKD').replace(/[^\x20-\x7e]/g, '').replace(/"/g, '') || 'dosya';
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encoded}`);
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
  sendDerived(res, f.thumb_key);
});

fileRoutes.get('/files/:id/preview.webp', (req, res) => {
  const f = fileById.get(Number(req.params.id));
  if (!f) return res.status(404).end();
  sendDerived(res, f.preview_key ?? f.thumb_key);
});

fileRoutes.get('/files/:id/page/:n.webp', async (req, res, next) => {
  const f = fileById.get(Number(req.params.id));
  const n = Number(req.params.n);
  if (!f || f.ext !== 'pdf' || !Number.isInteger(n) || n < 1 || n > Math.min(f.page_count ?? 0, config.maxPreviewPages)) {
    return res.status(404).end();
  }
  try {
    const p = await pdfPagePreview(f, n);
    res.setHeader('Cache-Control', IMMUTABLE);
    res.type('image/webp');
    res.sendFile(p);
  } catch (err) {
    next(err);
  }
});

fileRoutes.get('/files/:id/raw/:name', (req, res) => {
  const f = fileById.get(Number(req.params.id));
  if (!f) return res.status(404).end();
  sendOriginal(res, f, { download: req.query.indir !== undefined, cache: IMMUTABLE });
});

// ── Kalıcı bağlantılar ──────────────────────────────────────────────────────

const docVersion = db.prepare(`
  SELECT d.title_tr, v.version_no, fi.*
  FROM documents d
  JOIN document_versions v ON v.document_id = d.id AND (CASE WHEN ? IS NULL THEN v.id = d.current_version_id ELSE v.version_no = ? END)
  JOIN files fi ON fi.id = v.file_id
  WHERE d.public_id = ? AND d.archived_at IS NULL`);

function permalink(req, res, { download }) {
  const vn = req.params.n === undefined ? null : Number(req.params.n);
  const row = docVersion.get(vn, vn, req.params.pid);
  if (!row) return res.status(404).json({ error: 'Doküman ya da sürüm bulunamadı' });
  const name = `${row.title_tr} v${row.version_no}.${row.ext}`;
  // Güncel sürüm bağlantısı her istekte yeniden doğrulanır; sabit sürüm değişmez.
  const cache = vn === null ? 'no-cache, must-revalidate' : IMMUTABLE;
  res.setHeader('X-Document-Version', String(row.version_no));
  sendOriginal(res, row, { download, name, cache });
}

fileRoutes.get('/d/:pid', (req, res) => permalink(req, res, { download: false }));
fileRoutes.get('/d/:pid/indir', (req, res) => permalink(req, res, { download: true }));
fileRoutes.get('/d/:pid/v/:n', (req, res) => permalink(req, res, { download: false }));
fileRoutes.get('/d/:pid/v/:n/indir', (req, res) => permalink(req, res, { download: true }));
