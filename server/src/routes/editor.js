// Düzenleme ve yönetim uçları. Yetki: yönetici rolündeki hesabın HttpOnly oturum çerezi ya da
// (yalnızca sunucu tarafı araçlar için) `X-Editor-Key` başlığında sunucunun düzenleme anahtarı.
import crypto from 'node:crypto';
import fs from 'node:fs';
import { Router } from 'express';
import multer from 'multer';
import { config } from '../config.js';
import { ingest, pruneOrphanFiles } from '../media.js';
import * as cmd from '../commands.js';
import * as q from '../queries.js';
import * as auth from '../auth.js';
import { isAdmin, login, logout, viewerOf } from '../accounts.js';
import { HttpError } from '../commands.js';
import { addLanguage, contentHistory, saveMachineContent, saveMachineLinks } from '../content.js';

export const editorRoutes = Router();

fs.mkdirSync(config.tmpDir, { recursive: true });
const upload = multer({
  dest: config.tmpDir,
  limits: { fileSize: config.maxUploadBytes, files: 1, fields: 20 },
});

// Kaba kuvvete karşı: IP başına dakikada 20 yanlış deneme.
const failures = new Map();
function tooManyFailures(ip) {
  const entry = failures.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.since > 60_000) { failures.delete(ip); return false; }
  return entry.count >= 20;
}
function recordFailure(ip) {
  const entry = failures.get(ip);
  if (!entry || Date.now() - entry.since > 60_000) failures.set(ip, { since: Date.now(), count: 1 });
  else entry.count += 1;
}

function keyMatches(given) {
  if (!config.editorKey || typeof given !== 'string') return false;
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(config.editorKey).digest();
  return crypto.timingSafeEqual(a, b);
}

function requireEditor(req, res, next) {
  const viewer = viewerOf(req);
  if (isAdmin(viewer)) {
    const a = viewer.account;
    req.editorUser = { id: a.id, email: a.email, name: [a.firstName, a.lastName].filter(Boolean).join(' ') || null };
    return next();
  }
  if (tooManyFailures(req.ip)) return res.status(429).json({ error: 'Çok fazla deneme. Bir dakika sonra tekrar deneyin.' });
  const given = req.get('x-editor-key');
  // Oturum yoksa yalnızca sunucunun düzenleme anahtarı geçerli ("session" yer tutucusu sayılmaz).
  if (!given || given === 'session' || !keyMatches(given)) {
    if (given && given !== 'session') recordFailure(req.ip);
    return res.status(401).json({ error: 'Oturum geçersiz. Yeniden giriş yapın.' });
  }
  req.editorUser = null;
  next();
}

// Giriş: e-posta + şifre → oturum jetonu.
// Yönetim girişi: yalnızca yönetici rolü. Jeton yanıtta dönmez; HttpOnly çerezde kalır. Arayüz
// eski akışla uyum için "session" yer tutucusunu saklar (gizli değildir).
editorRoutes.post('/auth/login', (req, res) => {
  const account = login(req, res, req.body ?? {}, { adminOnly: true });
  res.json({ token: 'session', user: { email: account.email, name: [account.first_name, account.last_name].filter(Boolean).join(' ') || null } });
});
editorRoutes.post('/auth/logout', (req, res) => {
  logout(req, res);
  res.status(204).end();
});

const author = (req) => req.editorUser?.name || req.editorUser?.email || (typeof req.body?.author === 'string' && req.body.author.trim() ? req.body.author.trim().slice(0, 80) : null);

editorRoutes.post('/languages', requireEditor, (req, res) => res.status(201).json(addLanguage(req.body, author(req))));
editorRoutes.put('/machines/:slug/content', requireEditor, (req, res) => res.json(saveMachineContent(req.params.slug, req.body, author(req))));
editorRoutes.put('/machines/:slug/links', requireEditor, (req, res) => res.json(saveMachineLinks(req.params.slug, req.body, author(req))));
editorRoutes.get('/admin/machines/:slug/history', requireEditor, (req, res) => res.json(contentHistory(req.params.slug)));

async function ingestUpload(req) {
  if (!req.file) throw new HttpError(400, 'Dosya gerekli');
  // multer dosya adını latin1 olarak çözer; Türkçe karakterler için UTF-8'e çevir.
  const name = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
  return ingest(req.file.path, name);
}

editorRoutes.post('/editor/verify', requireEditor, (_req, res) => res.status(204).end());

editorRoutes.post('/documents', requireEditor, upload.single('file'), async (req, res, next) => {
  try {
    const file = await ingestUpload(req);
    const b = req.body;
    const result = cmd.createDocument({
      folder: b.folder, type: b.type, titleTr: b.titleTr, titleEn: b.titleEn, language: b.language,
      description: b.description, tags: b.tags, fileId: file.id, note: b.note, author: author(req),
    });
    res.status(201).json(result);
  } catch (err) {
    if (req.file?.path) fs.rm(req.file.path, { force: true }, () => { });
    next(err);
  }
});

editorRoutes.post('/documents/:id/versions', requireEditor, upload.single('file'), async (req, res, next) => {
  try {
    const file = await ingestUpload(req);
    res.status(201).json(cmd.addVersion(req.params.id, { fileId: file.id, note: req.body.note, author: author(req) }));
  } catch (err) {
    if (req.file?.path) fs.rm(req.file.path, { force: true }, () => { });
    next(err);
  }
});

editorRoutes.post('/documents/:id/restore', requireEditor, (req, res) => {
  res.status(201).json(cmd.restoreVersion(req.params.id, { versionNo: req.body?.versionNo, note: req.body?.note, author: author(req) }));
});

editorRoutes.patch('/documents/:id', requireEditor, (req, res) => {
  res.json(cmd.updateDocument(req.params.id, req.body ?? {}, author(req)));
});

editorRoutes.delete('/documents/:id', requireEditor, (req, res) => {
  res.json(cmd.archiveDocument(req.params.id, author(req)));
});

editorRoutes.post('/documents/:id/unarchive', requireEditor, (req, res) => {
  res.json(cmd.unarchiveDocument(req.params.id, author(req)));
});

// Toplu işlem (yönetimdeki çoklu seçim): arşivle / arşivden çıkar / kalıcı sil.
editorRoutes.post('/documents/bulk', requireEditor, async (req, res) => {
  const result = cmd.bulkDocuments(req.body?.action, req.body?.ids, author(req));
  if (req.body?.action === 'delete' && result.done) await pruneOrphanFiles().catch((err) => console.warn('[prune]', err.message));
  res.json(result);
});

// Kalıcı silme: kütüphanedeki ya da arşivdeki belge; kullanılmayan dosyalar diskten de temizlenir.
editorRoutes.delete('/documents/:id/permanent', requireEditor, async (req, res) => {
  const result = cmd.deleteDocument(req.params.id, author(req));
  await pruneOrphanFiles().catch((err) => console.warn('[prune]', err.message));
  res.json(result);
});

// Tek sürümü sil (son sürüm silinemez). Dosya başka yerde kullanılmıyorsa diskten temizlenir.
editorRoutes.delete('/documents/:id/versions/:no', requireEditor, async (req, res) => {
  const result = cmd.deleteVersion(req.params.id, req.params.no, author(req));
  await pruneOrphanFiles().catch((err) => console.warn('[prune]', err.message));
  res.json(result);
});

editorRoutes.post('/folders', requireEditor, (req, res) => {
  const b = req.body ?? {};
  res.status(201).json(cmd.createFolder({
    parent: b.parent, kind: b.kind, nameTr: b.nameTr, nameEn: b.nameEn,
    descriptionTr: b.descriptionTr, descriptionEn: b.descriptionEn, machine: b.machine, author: author(req),
  }));
});

editorRoutes.post('/folders/reorder', requireEditor, (req, res) => {
  res.json(cmd.reorderFolders(req.body?.parent ?? null, req.body?.slugs, author(req)));
});

editorRoutes.patch('/folders/:ref', requireEditor, (req, res) => {
  res.json(cmd.updateFolder(req.params.ref, req.body ?? {}, author(req)));
});

editorRoutes.delete('/folders/:ref', requireEditor, (req, res) => {
  res.json(cmd.archiveFolder(req.params.ref, author(req)));
});
editorRoutes.delete('/folders/:ref/permanent', requireEditor, async (req, res) => {
  const result = cmd.deleteFolder(req.params.ref, author(req), req.body?.confirm);
  await pruneOrphanFiles().catch((err) => console.warn('[prune]', err.message));
  res.json(result);
});

// Makine kapağı: görsel yüklenir, orijinali saklanır, kapak olarak bağlanır.
editorRoutes.post('/folders/:ref/cover', requireEditor, upload.single('file'), async (req, res, next) => {
  try {
    const file = await ingestUpload(req);
    res.json(cmd.updateFolder(req.params.ref, { machine: { coverFileId: file.id } }, author(req)));
  } catch (err) {
    if (req.file?.path) fs.rm(req.file.path, { force: true }, () => { });
    next(err);
  }
});

// Belge türleri
editorRoutes.post('/types', requireEditor, (req, res) => res.status(201).json(cmd.createDocType(req.body ?? {}, author(req))));
editorRoutes.post('/types/reorder', requireEditor, (req, res) => res.json(cmd.reorderDocTypes(req.body?.slugs, author(req))));
editorRoutes.patch('/types/:slug', requireEditor, (req, res) => res.json(cmd.updateDocType(req.params.slug, req.body ?? {}, author(req))));
editorRoutes.delete('/types/:slug', requireEditor, (req, res) => res.json(cmd.deleteDocType(req.params.slug, author(req))));

// Ayarlar
editorRoutes.put('/settings/coverage', requireEditor, (req, res) => res.json(cmd.setCoverageTypes(req.body?.types, author(req))));
editorRoutes.put('/settings/home', requireEditor, (req, res) => res.json(cmd.updateHome(req.body ?? {}, author(req))));

// Kullanıcılar
editorRoutes.get('/admin/me', requireEditor, (req, res) => res.json(req.editorUser ?? null));
editorRoutes.get('/admin/users', requireEditor, (_req, res) => res.json(auth.listUsers()));
editorRoutes.post('/admin/users', requireEditor, (req, res) => res.status(201).json(auth.createUser(req.body ?? {})));
editorRoutes.patch('/admin/users/:id', requireEditor, (req, res) => {
  res.json(auth.updateUser(req.params.id, req.body ?? {}, req.editorUser, viewerOf(req)?.tokenHash));
});
editorRoutes.delete('/admin/users/:id', requireEditor, (req, res) => res.json(auth.deleteUser(req.params.id, req.editorUser)));

// ── Yönetim paneli okumaları (anahtar gerekir) ──────────────────────────────

editorRoutes.get('/admin/documents', requireEditor, (_req, res) => res.json(q.adminDocuments()));
editorRoutes.get('/admin/documents/:id', requireEditor, (req, res) => {
  const d = q.documentDetail(req.params.id, { includeArchived: true });
  if (!d) return res.status(404).json({ error: 'Doküman bulunamadı' });
  res.json(d);
});
editorRoutes.get('/admin/tree', requireEditor, (_req, res) => res.json(q.adminTree()));
editorRoutes.get('/admin/activity', requireEditor, (req, res) => res.json(q.activity(Math.min(200, Number(req.query.limit) || 60))));
editorRoutes.get('/admin/coverage', requireEditor, (_req, res) => res.json(q.coverage()));
