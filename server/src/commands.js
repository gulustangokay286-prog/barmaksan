// Yazma işlemleri. API ve seed aynı fonksiyonları kullanır; her biri tek işlemde
// (transaction) çalışır, hareket kaydı düşer ve arama dizinini günceller.
import { db, now } from './db.js';
import { newPublicId, slugify } from './text.js';
import { reindexDocument, reindexFolder } from './search.js';
import { DEFAULT_COVERAGE_TYPES, getSetting, setSetting } from './settings.js';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const LANGS = new Set(['tr', 'en', 'tr-en', 'multi', 'none']);
const FOLDER_KINDS = new Set(['category', 'machine', 'collection']);

const typeBySlug = db.prepare('SELECT * FROM doc_types WHERE slug = ?');
const folderById = db.prepare('SELECT * FROM folders WHERE id = ? AND archived_at IS NULL');
const folderBySlug = db.prepare('SELECT * FROM folders WHERE slug = ? AND archived_at IS NULL');
const docByPublicId = db.prepare('SELECT * FROM documents WHERE public_id = ? AND archived_at IS NULL');
const anyDocByPublicId = db.prepare('SELECT * FROM documents WHERE public_id = ?');
const logActivity = db.prepare(`
  INSERT INTO activity (action, folder_id, document_id, version_id, actor, detail)
  VALUES (@action, @folder_id, @document_id, @version_id, @actor, @detail)`);

function log(action, { folderId = null, documentId = null, versionId = null, actor = null, detail = null } = {}) {
  logActivity.run({
    action, folder_id: folderId, document_id: documentId, version_id: versionId,
    actor: actor || null, detail: detail ? JSON.stringify(detail) : null,
  });
}

function clean(value, max = 300) {
  if (value == null) return null;
  const s = String(value).replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, max) : null;
}

function resolveFolder(ref) {
  const f = typeof ref === 'number' || /^\d+$/.test(String(ref)) ? folderById.get(Number(ref)) : folderBySlug.get(String(ref));
  if (!f) throw new HttpError(404, 'Klasör bulunamadı');
  return f;
}

function uniquePublicId() {
  for (;;) {
    const id = newPublicId();
    if (!db.prepare('SELECT 1 FROM documents WHERE public_id = ?').get(id)) return id;
  }
}

function touchFolder(folderId, at) {
  db.prepare('UPDATE folders SET updated_at = ? WHERE id = ?').run(at, folderId);
}

/**
 * Yeni doküman + ilk sürümü.
 * @param {{ folder: string|number, type: string, titleTr: string, titleEn?: string, language?: string,
 *           description?: string, tags?: string, fileId: number, note?: string, author?: string, at?: string }} input
 */
export function createDocument(input) {
  const folder = resolveFolder(input.folder);
  const type = typeBySlug.get(input.type);
  if (!type) throw new HttpError(400, 'Geçersiz doküman türü');
  const titleTr = clean(input.titleTr, 200);
  if (!titleTr) throw new HttpError(400, 'Başlık gerekli');
  const language = LANGS.has(input.language) ? input.language : 'tr';
  const at = input.at ?? now();

  return db.transaction(() => {
    const publicId = input.publicId ?? uniquePublicId();
    const info = db.prepare(`
      INSERT INTO documents (public_id, folder_id, doc_type_id, title_tr, title_en, language, description, tags, sort, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      publicId, folder.id, type.id, titleTr, clean(input.titleEn, 200), language,
      clean(input.description, 2000), clean(input.tags, 500) ?? '', input.sort ?? 0, at, at,
    );
    const documentId = Number(info.lastInsertRowid);
    log('document.created', { folderId: folder.id, documentId, actor: input.author });
    const version = insertVersion(documentId, input.fileId, input.note ?? 'İlk sürüm', input.author, at);
    touchFolder(folder.id, at);
    reindexDocument(documentId);
    return { publicId, documentId, versionNo: version.no };
  })();
}

function insertVersion(documentId, fileId, note, author, at) {
  const next = db.prepare('SELECT coalesce(max(version_no), 0) + 1 AS n FROM document_versions WHERE document_id = ?').get(documentId).n;
  const info = db.prepare(`
    INSERT INTO document_versions (document_id, version_no, file_id, note, author, created_at)
    VALUES (?, ?, ?, ?, ?, ?)`).run(documentId, next, fileId, clean(note, 500), clean(author, 80), at);
  const versionId = Number(info.lastInsertRowid);
  db.prepare('UPDATE documents SET current_version_id = ?, version_count = ?, updated_at = ? WHERE id = ?')
    .run(versionId, next, at, documentId);
  log('version.published', { documentId, versionId, actor: author, detail: { no: next } });
  return { id: versionId, no: next };
}

/** Yeni sürüm yayınlar; anında güncel olur. */
export function addVersion(publicId, { fileId, note, author, at }) {
  const doc = docByPublicId.get(publicId);
  if (!doc) throw new HttpError(404, 'Doküman bulunamadı');
  const stamp = at ?? now();
  return db.transaction(() => {
    const v = insertVersion(doc.id, fileId, note, author, stamp);
    touchFolder(doc.folder_id, stamp);
    reindexDocument(doc.id);
    return { publicId, versionNo: v.no };
  })();
}

/** Eski bir sürümü yeni numarayla yeniden yayınlar. Geçmiş silinmez. */
export function restoreVersion(publicId, { versionNo, note, author }) {
  const doc = docByPublicId.get(publicId);
  if (!doc) throw new HttpError(404, 'Doküman bulunamadı');
  const old = db.prepare('SELECT * FROM document_versions WHERE document_id = ? AND version_no = ?').get(doc.id, Number(versionNo));
  if (!old) throw new HttpError(404, 'Sürüm bulunamadı');
  return addVersion(publicId, { fileId: old.file_id, note: note || `v${old.version_no} geri yüklendi`, author });
}

export function updateDocument(publicId, patch, author) {
  const doc = docByPublicId.get(publicId);
  if (!doc) throw new HttpError(404, 'Doküman bulunamadı');
  const fields = {};
  if (patch.titleTr !== undefined) {
    const t = clean(patch.titleTr, 200);
    if (!t) throw new HttpError(400, 'Başlık boş olamaz');
    fields.title_tr = t;
  }
  if (patch.titleEn !== undefined) fields.title_en = clean(patch.titleEn, 200);
  if (patch.description !== undefined) fields.description = clean(patch.description, 2000);
  if (patch.tags !== undefined) fields.tags = clean(patch.tags, 500) ?? '';
  if (patch.language !== undefined) {
    if (!LANGS.has(patch.language)) throw new HttpError(400, 'Geçersiz dil');
    fields.language = patch.language;
  }
  if (patch.type !== undefined) {
    const type = typeBySlug.get(patch.type);
    if (!type) throw new HttpError(400, 'Geçersiz doküman türü');
    fields.doc_type_id = type.id;
  }
  if (patch.folder !== undefined) fields.folder_id = resolveFolder(patch.folder).id;
  if (Object.keys(fields).length === 0) return { publicId };
  const at = now();
  fields.updated_at = at;
  return db.transaction(() => {
    const sets = Object.keys(fields).map((k) => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE documents SET ${sets} WHERE id = @id`).run({ ...fields, id: doc.id });
    log('document.updated', { documentId: doc.id, folderId: fields.folder_id ?? doc.folder_id, actor: author, detail: Object.keys(fields) });
    reindexDocument(doc.id);
    return { publicId };
  })();
}

/** Arşivler (gizler). Dosyalar ve sürümler korunur. */
export function archiveDocument(publicId, author) {
  const doc = docByPublicId.get(publicId);
  if (!doc) throw new HttpError(404, 'Doküman bulunamadı');
  db.transaction(() => {
    db.prepare('UPDATE documents SET archived_at = ? WHERE id = ?').run(now(), doc.id);
    log('document.archived', { documentId: doc.id, folderId: doc.folder_id, actor: author });
    reindexDocument(doc.id);
  })();
  return { publicId };
}

/** Arşivden geri alır: belge yeniden kütüphanede görünür. */
export function unarchiveDocument(publicId, author) {
  const doc = anyDocByPublicId.get(publicId);
  if (!doc) throw new HttpError(404, 'Doküman bulunamadı');
  if (!doc.archived_at) return { publicId };
  if (!folderById.get(doc.folder_id)) throw new HttpError(409, 'Belgenin klasörü arşivde. Önce belgeyi başka bir klasöre taşıyın.');
  db.transaction(() => {
    db.prepare('UPDATE documents SET archived_at = NULL WHERE id = ?').run(doc.id);
    log('document.restored', { documentId: doc.id, folderId: doc.folder_id, actor: author });
    reindexDocument(doc.id);
  })();
  return { publicId };
}

/**
 * Kalıcı siler: yalnızca arşivdeki belge. Sürümleri de gider; başka yerde kullanılmayan
 * dosyalar sonra diskten temizlenir (media.pruneOrphanFiles).
 */
export function deleteDocument(publicId, author) {
  const doc = anyDocByPublicId.get(publicId);
  if (!doc) throw new HttpError(404, 'Doküman bulunamadı');
  if (!doc.archived_at) throw new HttpError(409, 'Yalnızca arşivdeki belgeler kalıcı olarak silinebilir.');
  db.transaction(() => {
    log('document.deleted', { folderId: doc.folder_id, actor: author, detail: { title: doc.title_tr, versions: doc.version_count } });
    db.prepare('UPDATE documents SET current_version_id = NULL WHERE id = ?').run(doc.id);
    db.prepare('DELETE FROM documents WHERE id = ?').run(doc.id);
    reindexDocument(doc.id);
  })();
  return { publicId };
}

/**
 * Toplu işlem: seçilen belgeleri arşivle, arşivden çıkar ya da kalıcı sil. Tek tek komutların
 * kuralları aynen geçerli (kalıcı silme yalnızca arşivdekilere). Hepsi tek işlemde (transaction);
 * kurala takılanlar atlanır ve "failed" listesinde döner.
 */
export function bulkDocuments(action, ids, author) {
  const list = Array.isArray(ids) ? [...new Set(ids.map(String))].slice(0, 2000) : [];
  if (!list.length) throw new HttpError(400, 'Belge seçilmedi');
  const fn = { archive: archiveDocument, unarchive: unarchiveDocument, delete: deleteDocument }[action];
  if (!fn) throw new HttpError(400, 'Geçersiz işlem');
  const failed = [];
  let done = 0;
  db.transaction(() => {
    for (const id of list) {
      try {
        fn(id, author);
        done += 1;
      } catch (err) {
        failed.push({ id, error: err.message });
      }
    }
  })();
  return { done, failed };
}

// ── Klasörler ───────────────────────────────────────────────────────────────

const BRANDS = new Map(db.prepare('SELECT id, slug FROM brands').all().map((b) => [b.slug, b.id]));

function subtree(id) {
  return db.prepare(`
    WITH RECURSIVE sub(id) AS (SELECT ? UNION ALL SELECT f.id FROM folders f JOIN sub ON f.parent_id = sub.id)
    SELECT id FROM sub`).all(id).map((r) => r.id);
}

/** Ad ya da konum değişince klasörün ve altındaki her şeyin arama bağlamı yenilenir. */
function reindexSubtree(id) {
  for (const fid of subtree(id)) {
    reindexFolder(fid);
    for (const d of db.prepare('SELECT id FROM documents WHERE folder_id = ?').all(fid)) reindexDocument(d.id);
  }
}

function checkParent(kind, parent, self = null) {
  if (parent.kind === 'machine') throw new HttpError(400, 'Makinenin altına klasör eklenemez');
  if (kind === 'category' && parent.kind !== 'section') throw new HttpError(400, 'Kategori yalnızca bir ana bölümün altında olabilir');
  if (self && (parent.id === self.id || subtree(self.id).includes(parent.id))) throw new HttpError(400, 'Klasör kendi altına taşınamaz');
}

function cleanModels(list) {
  const arr = Array.isArray(list) ? list : String(list ?? '').split(/[\n,]+/);
  const seen = new Set();
  const out = [];
  for (const raw of arr) {
    const m = clean(raw, 60);
    if (m && !seen.has(m.toLocaleUpperCase('tr'))) {
      seen.add(m.toLocaleUpperCase('tr'));
      out.push(m);
    }
  }
  return out.slice(0, 60);
}

function checkImageFile(fileId) {
  if (fileId == null) return null;
  const f = db.prepare('SELECT id, ext FROM files WHERE id = ?').get(Number(fileId));
  if (!f) throw new HttpError(400, 'Görsel bulunamadı');
  if (!['jpg', 'jpeg', 'png', 'webp', 'gif', 'tif', 'tiff', 'heic', 'avif'].includes(f.ext)) throw new HttpError(400, 'Kapak bir görsel olmalı');
  return f.id;
}

export function createFolder({ parent, kind, nameTr, nameEn, slug, sort, descriptionTr, descriptionEn, author, machine }) {
  const parentRow = parent == null || parent === '' ? null : resolveFolder(parent);
  const k = parentRow ? (kind ?? 'collection') : 'section';
  if (parentRow && !FOLDER_KINDS.has(k)) throw new HttpError(400, 'Geçersiz klasör türü');
  if (parentRow) checkParent(k, parentRow);
  const tr = clean(nameTr, 120);
  if (!tr) throw new HttpError(400, 'Klasör adı gerekli');
  const base = slug ?? slugify(tr);
  let finalSlug = base;
  for (let i = 2; db.prepare('SELECT 1 FROM folders WHERE slug = ?').get(finalSlug); i += 1) finalSlug = `${base}-${i}`;
  const order = sort ?? db.prepare('SELECT coalesce(max(sort), -1) + 1 AS n FROM folders WHERE parent_id IS ?').get(parentRow?.id ?? null).n;
  return db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO folders (parent_id, kind, slug, name_tr, name_en, description_tr, description_en, sort)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(parentRow?.id ?? null, k, finalSlug, tr, clean(nameEn, 120) ?? tr,
      clean(descriptionTr, 1000), clean(descriptionEn, 1000), order);
    const id = Number(info.lastInsertRowid);
    if (k === 'machine') {
      db.prepare(`INSERT INTO machines (folder_id, brand_id, model_code, models_json, summary_tr, summary_en, cover_file_id)
                  VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
        id, machine?.brandId ?? BRANDS.get(machine?.brand) ?? 2, clean(machine?.modelCode, 60), JSON.stringify(cleanModels(machine?.models)),
        clean(machine?.summaryTr, 2000), clean(machine?.summaryEn, 2000), checkImageFile(machine?.coverFileId),
      );
    }
    log('folder.created', { folderId: id, actor: author });
    reindexFolder(id);
    return { id, slug: finalSlug };
  })();
}

export function updateFolder(ref, patch, author) {
  const f = resolveFolder(ref);
  return db.transaction(() => {
    const fields = {};
    const changed = [];
    if (patch.nameTr !== undefined) {
      const t = clean(patch.nameTr, 120);
      if (!t) throw new HttpError(400, 'Klasör adı boş olamaz');
      fields.name_tr = t;
    }
    if (patch.nameEn !== undefined) fields.name_en = clean(patch.nameEn, 120) ?? fields.name_tr ?? f.name_tr;
    if (patch.descriptionTr !== undefined) fields.description_tr = clean(patch.descriptionTr, 1000);
    if (patch.descriptionEn !== undefined) fields.description_en = clean(patch.descriptionEn, 1000);
    if (patch.parent !== undefined) {
      if (f.kind === 'section') throw new HttpError(400, 'Ana bölümler taşınamaz');
      const p = resolveFolder(patch.parent);
      if (p.id !== f.parent_id) {
        checkParent(f.kind, p, f);
        fields.parent_id = p.id;
        fields.sort = db.prepare('SELECT coalesce(max(sort), -1) + 1 AS n FROM folders WHERE parent_id = ?').get(p.id).n;
        changed.push('parent');
      }
    }
    if (Object.keys(fields).length) {
      fields.updated_at = now();
      const sets = Object.keys(fields).map((k) => `${k} = @${k}`).join(', ');
      db.prepare(`UPDATE folders SET ${sets} WHERE id = @id`).run({ ...fields, id: f.id });
      changed.push(...Object.keys(fields).filter((k) => k !== 'updated_at' && k !== 'parent_id' && k !== 'sort'));
    }
    if (f.kind === 'machine' && patch.machine) {
      const m = patch.machine;
      const set = (col, value) => { db.prepare(`UPDATE machines SET ${col} = ? WHERE folder_id = ?`).run(value, f.id); changed.push(col); };
      if (m.modelCode !== undefined) set('model_code', clean(m.modelCode, 60));
      if (m.models !== undefined) set('models_json', JSON.stringify(cleanModels(m.models)));
      if (m.summaryTr !== undefined) set('summary_tr', clean(m.summaryTr, 2000));
      if (m.summaryEn !== undefined) set('summary_en', clean(m.summaryEn, 2000));
      if (m.brand !== undefined) {
        const id = BRANDS.get(m.brand);
        if (!id) throw new HttpError(400, 'Geçersiz marka');
        set('brand_id', id);
      }
      if (m.coverFileId !== undefined) set('cover_file_id', checkImageFile(m.coverFileId));
      db.prepare('UPDATE folders SET updated_at = ? WHERE id = ?').run(now(), f.id);
    }
    if (changed.length) log('folder.updated', { folderId: f.id, actor: author, detail: changed });
    if (fields.name_tr || fields.name_en || fields.parent_id) reindexSubtree(f.id);
    else reindexFolder(f.id);
    return { slug: f.slug };
  })();
}

/** Aynı üst klasördeki sırayı verilen listeye göre yazar. */
export function reorderFolders(parentRef, slugs, author) {
  const parent = parentRef == null || parentRef === '' ? null : resolveFolder(parentRef);
  if (!Array.isArray(slugs)) throw new HttpError(400, 'Sıra listesi gerekli');
  db.transaction(() => {
    const stmt = db.prepare('UPDATE folders SET sort = ? WHERE slug = ? AND parent_id IS ?');
    slugs.forEach((slug, i) => stmt.run(i, String(slug), parent?.id ?? null));
    log('folder.reordered', { folderId: parent?.id ?? null, actor: author });
  })();
  return { ok: true };
}

/** Boş klasörü arşivler. İçinde belge ya da alt klasör varsa önce onlar taşınmalı. */
export function archiveFolder(ref, author) {
  const f = resolveFolder(ref);
  const kids = db.prepare('SELECT count(*) AS n FROM folders WHERE parent_id = ? AND archived_at IS NULL').get(f.id).n;
  const docs = db.prepare('SELECT count(*) AS n FROM documents WHERE folder_id = ? AND archived_at IS NULL').get(f.id).n;
  if (kids || docs) {
    throw new HttpError(409, `Klasör boş değil (${[kids && `${kids} alt klasör`, docs && `${docs} belge`].filter(Boolean).join(', ')}). Önce bunları taşıyın ya da arşivleyin.`);
  }
  db.transaction(() => {
    db.prepare('UPDATE folders SET archived_at = ? WHERE id = ?').run(now(), f.id);
    log('folder.archived', { folderId: f.id, actor: author, detail: { name: f.name_tr } });
    reindexFolder(f.id);
  })();
  return { slug: f.slug };
}

// ── Belge türleri ───────────────────────────────────────────────────────────

const MEDIA_KINDS = new Set(['document', 'image', 'video']);

export function createDocType({ nameTr, nameEn, short, icon, media, versioned }, author) {
  const tr = clean(nameTr, 60);
  if (!tr) throw new HttpError(400, 'Tür adı gerekli');
  const kind = MEDIA_KINDS.has(media) ? media : 'document';
  let slug = slugify(tr);
  for (let i = 2; typeBySlug.get(slug); i += 1) slug = `${slugify(tr)}-${i}`;
  const sort = db.prepare('SELECT coalesce(max(sort), 0) + 10 AS n FROM doc_types').get().n;
  db.prepare(`INSERT INTO doc_types (slug, name_tr, name_en, short, icon, media_kind, is_versioned, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(slug, tr, clean(nameEn, 60) ?? tr, clean(short, 8), /^[a-zA-Z]{2,24}$/.test(icon ?? '') ? icon : 'file', kind, versioned === false || kind !== 'document' ? 0 : 1, sort);
  log('type.created', { actor: author, detail: { slug, name: tr } });
  return { slug };
}

export function updateDocType(slug, patch, author) {
  const t = typeBySlug.get(slug);
  if (!t) throw new HttpError(404, 'Tür bulunamadı');
  const fields = {};
  if (patch.nameTr !== undefined) {
    const v = clean(patch.nameTr, 60);
    if (!v) throw new HttpError(400, 'Tür adı boş olamaz');
    fields.name_tr = v;
  }
  if (patch.nameEn !== undefined) fields.name_en = clean(patch.nameEn, 60) ?? fields.name_tr ?? t.name_tr;
  if (patch.short !== undefined) fields.short = clean(patch.short, 8);
  if (patch.icon !== undefined && /^[a-zA-Z]{2,24}$/.test(patch.icon)) fields.icon = patch.icon;
  if (patch.versioned !== undefined && t.media_kind === 'document') fields.is_versioned = patch.versioned ? 1 : 0;
  if (!Object.keys(fields).length) return { slug };
  db.transaction(() => {
    const sets = Object.keys(fields).map((k) => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE doc_types SET ${sets} WHERE id = @id`).run({ ...fields, id: t.id });
    log('type.updated', { actor: author, detail: { slug, name: fields.name_tr ?? t.name_tr } });
    // Tür adı aramada belge bağlamının parçası.
    if (fields.name_tr || fields.name_en || fields.short !== undefined) {
      for (const d of db.prepare('SELECT id FROM documents WHERE doc_type_id = ?').all(t.id)) reindexDocument(d.id);
    }
  })();
  return { slug };
}

export function deleteDocType(slug, author) {
  const t = typeBySlug.get(slug);
  if (!t) throw new HttpError(404, 'Tür bulunamadı');
  const used = db.prepare('SELECT count(*) AS n FROM documents WHERE doc_type_id = ?').get(t.id).n;
  if (used) throw new HttpError(409, `Bu türde ${used} belge var (arşivdekiler dahil). Önce onların türünü değiştirin.`);
  db.transaction(() => {
    db.prepare('DELETE FROM doc_types WHERE id = ?').run(t.id);
    setSetting('coverage.types', getSetting('coverage.types', DEFAULT_COVERAGE_TYPES).filter((x) => x !== slug));
    log('type.deleted', { actor: author, detail: { slug, name: t.name_tr } });
  })();
  return { slug };
}

export function reorderDocTypes(slugs, author) {
  if (!Array.isArray(slugs)) throw new HttpError(400, 'Sıra listesi gerekli');
  db.transaction(() => {
    const stmt = db.prepare('UPDATE doc_types SET sort = ? WHERE slug = ?');
    slugs.forEach((slug, i) => stmt.run((i + 1) * 10, String(slug)));
    log('type.updated', { actor: author, detail: { order: true } });
  })();
  return { ok: true };
}

/** Eksik belgeler raporunda makine başına beklenen türler. */
export function setCoverageTypes(types, author) {
  if (!Array.isArray(types)) throw new HttpError(400, 'Tür listesi gerekli');
  const valid = types.filter((x) => typeBySlug.get(String(x)));
  setSetting('coverage.types', [...new Set(valid)]);
  log('type.updated', { actor: author, detail: { coverage: true } });
  return { types: valid };
}

// ── Ana sayfa ───────────────────────────────────────────────────────────────

/**
 * featured: vitrindeki makine slug'ları (sırayla).
 * slides: üstteki fotoğraflar — fotoğraf belgesinin kimliği ve altyazısı.
 */
export function updateHome({ featured, slides }, author) {
  db.transaction(() => {
    if (featured !== undefined) {
      if (!Array.isArray(featured)) throw new HttpError(400, 'Makine listesi gerekli');
      const ok = featured.map(String).filter((slug) => db.prepare("SELECT 1 FROM folders WHERE slug = ? AND kind = 'machine' AND archived_at IS NULL").get(slug));
      setSetting('home.featured', [...new Set(ok)].slice(0, 40));
    }
    if (slides !== undefined) {
      if (!Array.isArray(slides)) throw new HttpError(400, 'Fotoğraf listesi gerekli');
      const out = [];
      for (const sl of slides.slice(0, 12)) {
        const doc = docByPublicId.get(String(sl?.doc ?? ''));
        if (!doc) continue;
        out.push({ doc: doc.public_id, tr: clean(sl.tr, 120), en: clean(sl.en, 120) });
      }
      setSetting('home.slides', out);
    }
    log('home.updated', { actor: author });
  })();
  return { ok: true };
}
