// Okuma sorguları ve API'nin döndürdüğü şekiller (DTO). Arayüz yalnızca bu şekilleri bilir.
import { db } from './db.js';
import { fileKind } from './media.js';
import { searchIndex, excerpt } from './search.js';
import { trFold } from './text.js';
import { DEFAULT_COVERAGE_TYPES, DEFAULT_FEATURED, getSetting } from './settings.js';

// ── Şekiller ────────────────────────────────────────────────────────────────

export function fileDto(f) {
  if (!f || f.id == null) return null;
  const kind = fileKind(f.ext);
  const name = encodeURIComponent(f.original_name);
  return {
    id: f.id,
    name: f.original_name,
    ext: f.ext,
    mime: f.mime,
    kind,
    size: f.size_bytes,
    width: f.width,
    height: f.height,
    durationMs: f.duration_ms,
    pages: f.page_count,
    thumb: f.thumb_key ? `/files/${f.id}/thumb.webp` : null,
    preview: f.preview_key ? `/files/${f.id}/preview.webp` : null,
    raw: `/files/${f.id}/raw/${name}`,
  };
}

const FILE_COLS = `fi.id AS f_id, fi.original_name AS f_original_name, fi.ext AS f_ext, fi.mime AS f_mime,
  fi.size_bytes AS f_size_bytes, fi.width AS f_width, fi.height AS f_height, fi.duration_ms AS f_duration_ms,
  fi.page_count AS f_page_count, fi.thumb_key AS f_thumb_key, fi.preview_key AS f_preview_key`;

function pickFile(row, prefix = 'f_') {
  if (row[`${prefix}id`] == null) return null;
  const f = {};
  for (const k of ['id', 'original_name', 'ext', 'mime', 'size_bytes', 'width', 'height', 'duration_ms', 'page_count', 'thumb_key', 'preview_key']) {
    f[k] = row[`${prefix}${k}`];
  }
  return fileDto(f);
}

function documentDto(r) {
  return {
    id: r.public_id,
    title: { tr: r.title_tr, en: r.title_en },
    type: r.type_slug,
    language: r.language,
    description: r.description,
    tags: r.tags ? r.tags.split(/\s+/).filter(Boolean) : [],
    versionCount: r.version_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    archivedAt: r.archived_at ?? null,
    folder: { slug: r.folder_slug, kind: r.folder_kind, name: { tr: r.folder_name_tr, en: r.folder_name_en } },
    current: r.v_no == null ? null : {
      no: r.v_no, note: r.v_note, author: r.v_author, createdAt: r.v_created_at, file: pickFile(r),
    },
  };
}

const DOC_SELECT = `
  SELECT d.*, t.slug AS type_slug,
         fo.slug AS folder_slug, fo.kind AS folder_kind, fo.name_tr AS folder_name_tr, fo.name_en AS folder_name_en,
         v.version_no AS v_no, v.note AS v_note, v.author AS v_author, v.created_at AS v_created_at,
         ${FILE_COLS}
  FROM documents d
  JOIN doc_types t ON t.id = d.doc_type_id
  JOIN folders fo ON fo.id = d.folder_id
  LEFT JOIN document_versions v ON v.id = d.current_version_id
  LEFT JOIN files fi ON fi.id = v.file_id`;

// ── Sözlük ve ağaç ──────────────────────────────────────────────────────────

export function docTypes() {
  return db.prepare('SELECT slug, name_tr, name_en, short, icon, media_kind, is_versioned, sort FROM doc_types ORDER BY sort').all()
    .map((t) => ({ slug: t.slug, name: { tr: t.name_tr, en: t.name_en }, short: t.short, icon: t.icon, media: t.media_kind, versioned: !!t.is_versioned }));
}

export function tree() {
  const rows = db.prepare(`
    SELECT f.id, f.parent_id, f.kind, f.slug, f.name_tr, f.name_en, f.sort,
           m.model_code,
           (SELECT count(*) FROM documents d WHERE d.folder_id = f.id AND d.archived_at IS NULL) AS doc_count,
           ${FILE_COLS}
    FROM folders f
    LEFT JOIN machines m ON m.folder_id = f.id
    LEFT JOIN files fi ON fi.id = m.cover_file_id
    WHERE f.archived_at IS NULL
    ORDER BY f.sort, f.name_tr`).all();
  return rows.map((r) => ({
    id: r.id,
    parentId: r.parent_id,
    kind: r.kind,
    slug: r.slug,
    name: { tr: r.name_tr, en: r.name_en },
    modelCode: r.model_code,
    docCount: r.doc_count,
    cover: pickFile(r)?.thumb ?? null,
  }));
}

function crumbs(folderId) {
  return db.prepare(`
    WITH RECURSIVE chain(id, parent_id, slug, kind, name_tr, name_en, depth) AS (
      SELECT id, parent_id, slug, kind, name_tr, name_en, 0 FROM folders WHERE id = ?
      UNION ALL
      SELECT f.id, f.parent_id, f.slug, f.kind, f.name_tr, f.name_en, c.depth + 1 FROM folders f JOIN chain c ON f.id = c.parent_id
    ) SELECT slug, kind, name_tr, name_en FROM chain ORDER BY depth DESC`).all(folderId)
    .map((c) => ({ slug: c.slug, kind: c.kind, name: { tr: c.name_tr, en: c.name_en } }));
}

// Bir klasörün altındaki (tüm derinlikteki) klasör kimlikleri.
function subtreeIds(folderId) {
  return db.prepare(`
    WITH RECURSIVE sub(id) AS (SELECT ? UNION ALL SELECT f.id FROM folders f JOIN sub ON f.parent_id = sub.id WHERE f.archived_at IS NULL)
    SELECT id FROM sub`).all(folderId).map((r) => r.id);
}

export function folder(slug) {
  const f = db.prepare(`
    SELECT f.*, m.brand_id, m.model_code, m.models_json, m.summary_tr, m.summary_en, b.slug AS brand_slug, b.name AS brand_name,
           ${FILE_COLS}
    FROM folders f
    LEFT JOIN machines m ON m.folder_id = f.id
    LEFT JOIN brands b ON b.id = m.brand_id
    LEFT JOIN files fi ON fi.id = m.cover_file_id
    WHERE f.slug = ? AND f.archived_at IS NULL`).get(slug);
  if (!f) return null;

  const children = db.prepare(`
    SELECT f.id, f.kind, f.slug, f.name_tr, f.name_en, m.model_code,
           (SELECT count(*) FROM documents d WHERE d.folder_id = f.id AND d.archived_at IS NULL) AS doc_count,
           (SELECT count(*) FROM folders c WHERE c.parent_id = f.id AND c.archived_at IS NULL) AS child_count,
           ${FILE_COLS}
    FROM folders f
    LEFT JOIN machines m ON m.folder_id = f.id
    LEFT JOIN files fi ON fi.id = m.cover_file_id
    WHERE f.parent_id = ? AND f.archived_at IS NULL
    ORDER BY f.sort, f.name_tr`).all(f.id).map((c) => ({
    slug: c.slug, kind: c.kind, name: { tr: c.name_tr, en: c.name_en }, modelCode: c.model_code,
    docCount: c.doc_count, childCount: c.child_count, cover: pickFile(c)?.thumb ?? null,
  }));

  const documents = db.prepare(`${DOC_SELECT} WHERE d.folder_id = ? AND d.archived_at IS NULL ORDER BY t.sort, d.sort, d.title_tr`)
    .all(f.id).map(documentDto);

  // Bölüm/kategori sayfaları için: alt ağaçtaki makine sayısı.
  const ids = subtreeIds(f.id);
  const machineCount = ids.length > 1
    ? db.prepare(`SELECT count(*) AS n FROM folders WHERE kind = 'machine' AND archived_at IS NULL AND id IN (${ids.map(() => '?').join(',')})`).get(...ids).n
    : 0;

  return {
    slug: f.slug,
    kind: f.kind,
    name: { tr: f.name_tr, en: f.name_en },
    description: { tr: f.description_tr, en: f.description_en },
    updatedAt: f.updated_at,
    crumbs: crumbs(f.id),
    machine: f.kind === 'machine' ? {
      brand: f.brand_slug ? { slug: f.brand_slug, name: f.brand_name } : null,
      modelCode: f.model_code,
      models: f.models_json ? JSON.parse(f.models_json) : [],
      summary: { tr: f.summary_tr, en: f.summary_en },
      cover: pickFile(f),
    } : null,
    machineCount,
    children,
    documents,
  };
}

export function documentDetail(publicId, { includeArchived = false } = {}) {
  const r = db.prepare(`${DOC_SELECT} WHERE d.public_id = ?${includeArchived ? '' : ' AND d.archived_at IS NULL'}`).get(publicId);
  if (!r) return null;
  const versions = db.prepare(`
    SELECT v.version_no, v.note, v.author, v.created_at, ${FILE_COLS}
    FROM document_versions v JOIN files fi ON fi.id = v.file_id
    WHERE v.document_id = ? ORDER BY v.version_no DESC`).all(r.id)
    .map((v) => ({ no: v.version_no, note: v.note, author: v.author, createdAt: v.created_at, file: pickFile(v) }));
  return { ...documentDto(r), crumbs: crumbs(r.folder_id), versions };
}

export function recent(limit = 12) {
  return db.prepare(`${DOC_SELECT} WHERE d.archived_at IS NULL AND d.version_count > 0 AND t.media_kind = 'document'
    ORDER BY v.created_at DESC, d.id DESC LIMIT ?`).all(limit).map(documentDto);
}

export function media({ folderSlug, kind, cursor, limit = 48 }) {
  const where = ["d.archived_at IS NULL", "t.media_kind IN ('image', 'video')"];
  const params = [];
  if (kind === 'image' || kind === 'video') { where.push('t.media_kind = ?'); params.push(kind); }
  if (folderSlug) {
    const f = db.prepare('SELECT id FROM folders WHERE slug = ?').get(folderSlug);
    if (!f) return { items: [], next: null, total: 0 };
    const ids = subtreeIds(f.id);
    where.push(`d.folder_id IN (${ids.map(() => '?').join(',')})`);
    params.push(...ids);
  }
  const total = db.prepare(`SELECT count(*) AS n FROM documents d JOIN doc_types t ON t.id = d.doc_type_id WHERE ${where.join(' AND ')}`).get(...params).n;
  if (cursor) { where.push('d.id < ?'); params.push(Number(cursor)); }
  const rows = db.prepare(`${DOC_SELECT} WHERE ${where.join(' AND ')} ORDER BY d.id DESC LIMIT ?`).all(...params, limit + 1);
  const page = rows.slice(0, limit);
  return { items: page.map(documentDto), next: rows.length > limit ? String(page[page.length - 1].id) : null, total };
}

export function stats() {
  const one = (sql) => db.prepare(sql).get().n;
  return {
    machines: one("SELECT count(*) AS n FROM folders WHERE kind = 'machine' AND archived_at IS NULL"),
    documents: one("SELECT count(*) AS n FROM documents d JOIN doc_types t ON t.id = d.doc_type_id WHERE d.archived_at IS NULL AND t.media_kind = 'document'"),
    media: one("SELECT count(*) AS n FROM documents d JOIN doc_types t ON t.id = d.doc_type_id WHERE d.archived_at IS NULL AND t.media_kind <> 'document'"),
    versions: one('SELECT count(*) AS n FROM document_versions'),
    bytes: one('SELECT coalesce(sum(size_bytes), 0) AS n FROM files'),
  };
}

export function search(q, { type, limit = 30 } = {}) {
  const { terms, hits } = searchIndex(q, 80);
  const folders = [];
  const documents = [];
  const fStmt = db.prepare(`
    SELECT f.id, f.kind, f.slug, f.name_tr, f.name_en, m.model_code, p.name_tr AS parent_tr, p.name_en AS parent_en, ${FILE_COLS}
    FROM folders f LEFT JOIN folders p ON p.id = f.parent_id
    LEFT JOIN machines m ON m.folder_id = f.id LEFT JOIN files fi ON fi.id = m.cover_file_id
    WHERE f.id = ? AND f.archived_at IS NULL`);
  const dStmt = db.prepare(`${DOC_SELECT} WHERE d.id = ? AND d.archived_at IS NULL`);
  const textStmt = db.prepare('SELECT fi.text_content FROM document_versions v JOIN files fi ON fi.id = v.file_id WHERE v.id = ?');

  // Sıralama, önem sırasıyla:
  //   1) başlıkta tam ifade ("cleanmax 2" → Çöp Sasörü Cleanmax 2),
  //   2) bütün terimler başlıkta (sayılar tam, kelimeler önek olarak),
  //   3) başlıkta eşleşen terim sayısı,
  //   4) metin skoru × tür ağırlığı (teknik fiş/SPL öne, fotoğraf/video arkaya).
  const WEIGHT = { 'teknik-fis': 1.6, spl: 1.35, 'teknik-cizim': 1.2, fotograf: 0.55, video: 0.6 };
  const docHead = db.prepare(`
    SELECT d.title_tr, d.title_en, t.slug AS type_slug, fo.name_tr AS f_tr, fo.name_en AS f_en, m.model_code, m.models_json
    FROM documents d JOIN doc_types t ON t.id = d.doc_type_id JOIN folders fo ON fo.id = d.folder_id
    LEFT JOIN machines m ON m.folder_id = fo.id WHERE d.id = ?`);
  const folderHead = db.prepare(`
    SELECT f.name_tr, f.name_en, m.model_code, m.models_json FROM folders f LEFT JOIN machines m ON m.folder_id = f.id WHERE f.id = ?`);
  const tokens = (text) => trFold(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const codes = (r) => {
    const list = [r?.model_code, ...(r?.models_json ? JSON.parse(r.models_json) : [])].filter(Boolean);
    return [...list, ...list.map((c) => c.replace(/\s+/g, ''))].join(' ');
  };
  const relevance = (head) => {
    const toks = tokens(head);
    let matched = 0;
    for (const t of terms) {
      const numeric = /^\d+$/.test(t);
      if (toks.some((k) => (numeric ? k === t : k.startsWith(t)))) matched += 1;
    }
    const joined = ` ${toks.join(' ')} `;
    const last = terms[terms.length - 1];
    const lead = terms.slice(0, -1).join(' ');
    const phrase = terms.length > 1 && (/^\d+$/.test(last)
      ? joined.includes(` ${lead} ${last} `)
      : joined.includes(` ${lead} ${last}`));
    return { phrase, all: matched === terms.length, matched };
  };
  const ranked = hits.map((h) => {
    if (h.kind !== 'document') {
      const r = folderHead.get(h.id);
      return { ...h, adj: h.score * 1.2, ...relevance(`${r?.name_tr ?? ''} ${r?.name_en ?? ''} ${codes(r)}`) };
    }
    const r = docHead.get(h.id);
    const w = WEIGHT[r?.type_slug] ?? 1;
    return {
      ...h,
      adj: h.score < 0 ? h.score * w : h.score / w,
      ...relevance(`${r?.f_tr ?? ''} ${r?.f_en ?? ''} ${r?.title_tr ?? ''} ${r?.title_en ?? ''} ${codes(r)}`),
    };
  }).sort((a, b) => (Number(b.phrase) - Number(a.phrase)) || (Number(b.all) - Number(a.all)) || (b.matched - a.matched) || (a.adj - b.adj));

  for (const h of ranked) {
    if (h.kind === 'folder' && !type && folders.length < 8) {
      const f = fStmt.get(h.id);
      if (f) folders.push({ slug: f.slug, kind: f.kind, name: { tr: f.name_tr, en: f.name_en }, modelCode: f.model_code, parent: f.parent_tr ? { tr: f.parent_tr, en: f.parent_en } : null, cover: pickFile(f)?.thumb ?? null });
    } else if (h.kind === 'document' && documents.length < limit) {
      const r = dStmt.get(h.id);
      if (!r || (type && r.type_slug !== type)) continue;
      const dto = documentDto(r);
      const text = r.current_version_id ? textStmt.get(r.current_version_id)?.text_content : null;
      dto.excerpt = excerpt(text, terms);
      documents.push(dto);
    }
  }
  return { query: q, terms, folders, documents };
}


// ── Yönetim ─────────────────────────────────────────────────────────────────

/** Bütün belgeler, arşivdekiler dahil (yönetim tablosu), son güncellenen önce. */
export function adminDocuments() {
  return db.prepare(`${DOC_SELECT} ORDER BY d.updated_at DESC, d.id DESC`).all().map(documentDto);
}

/** Yönetim ağacı: her klasörün açıklaması ve makine alanlarıyla. */
export function adminTree() {
  const rows = db.prepare(`
    SELECT f.id, f.parent_id, f.kind, f.slug, f.name_tr, f.name_en, f.description_tr, f.description_en, f.sort, f.updated_at,
           m.model_code, m.models_json, m.summary_tr, m.summary_en, b.slug AS brand_slug,
           (SELECT count(*) FROM documents d WHERE d.folder_id = f.id AND d.archived_at IS NULL) AS doc_count,
           (SELECT count(*) FROM folders c WHERE c.parent_id = f.id AND c.archived_at IS NULL) AS child_count,
           ${FILE_COLS}
    FROM folders f
    LEFT JOIN machines m ON m.folder_id = f.id
    LEFT JOIN brands b ON b.id = m.brand_id
    LEFT JOIN files fi ON fi.id = m.cover_file_id
    WHERE f.archived_at IS NULL
    ORDER BY f.sort, f.name_tr`).all();
  return rows.map((r) => ({
    id: r.id,
    parentId: r.parent_id,
    kind: r.kind,
    slug: r.slug,
    name: { tr: r.name_tr, en: r.name_en },
    description: { tr: r.description_tr, en: r.description_en },
    sort: r.sort,
    updatedAt: r.updated_at,
    docCount: r.doc_count,
    childCount: r.child_count,
    machine: r.kind === 'machine' ? {
      brand: r.brand_slug,
      modelCode: r.model_code,
      models: r.models_json ? JSON.parse(r.models_json) : [],
      summary: { tr: r.summary_tr, en: r.summary_en },
      cover: pickFile(r),
    } : null,
  }));
}

/** Ana sayfa: vitrindeki makineler ve üstteki fotoğraflar (ayarlardan). */
export function home() {
  const featured = getSetting('home.featured', DEFAULT_FEATURED);
  // Yönetimden hiç ayarlanmamışsa: medya koleksiyonlarındaki ilk fotoğraflar.
  // (Bilinçli olarak boş bırakılmış liste [] ise ona dokunulmaz.)
  const slides = getSetting('home.slides', null) ?? db.prepare(`
    SELECT d.public_id AS doc FROM documents d
    JOIN doc_types t ON t.id = d.doc_type_id
    JOIN folders f ON f.id = d.folder_id
    JOIN folders p ON p.id = f.parent_id
    WHERE d.archived_at IS NULL AND t.media_kind = 'image' AND p.slug = 'medya'
    ORDER BY f.sort, d.sort, d.id LIMIT 6`).all();
  const docStmt = db.prepare(`${DOC_SELECT} WHERE d.public_id = ? AND d.archived_at IS NULL`);
  return {
    featured,
    slides: slides.map((sl) => {
      const r = docStmt.get(sl.doc);
      const file = r ? pickFile(r) : null;
      if (!file || file.kind !== 'image') return null;
      return {
        doc: sl.doc,
        src: file.preview ?? file.thumb,
        thumb: file.thumb,
        width: file.width,
        height: file.height,
        caption: { tr: sl.tr || r.title_tr, en: sl.en || r.title_en },
      };
    }).filter(Boolean),
  };
}

export const coverageTypes = () => getSetting('coverage.types', DEFAULT_COVERAGE_TYPES);

/** Hareket kaydı: kim, ne zaman, neyi. */
export function activity(limit = 60) {
  return db.prepare(`
    SELECT a.id, a.at, a.action, a.actor, a.detail,
           d.public_id AS doc_id, d.title_tr AS doc_title_tr, d.title_en AS doc_title_en,
           v.version_no AS version_no,
           f.slug AS folder_slug, f.kind AS folder_kind, f.name_tr AS folder_name_tr, f.name_en AS folder_name_en
    FROM activity a
    LEFT JOIN documents d ON d.id = a.document_id
    LEFT JOIN document_versions v ON v.id = a.version_id
    LEFT JOIN folders f ON f.id = coalesce(a.folder_id, d.folder_id)
    ORDER BY a.at DESC, a.id DESC
    LIMIT ?`).all(limit).map((r) => ({
    id: r.id,
    at: r.at,
    action: r.action,
    actor: r.actor,
    versionNo: r.version_no,
    detail: r.detail ? JSON.parse(r.detail) : null,
    document: r.doc_id ? { id: r.doc_id, title: { tr: r.doc_title_tr, en: r.doc_title_en } } : null,
    folder: r.folder_slug ? { slug: r.folder_slug, kind: r.folder_kind, name: { tr: r.folder_name_tr, en: r.folder_name_en } } : null,
  }));
}

/** Her makinede hangi belge türleri var (eksikleri arayüz hesaplar). */
export function coverage() {
  const rows = db.prepare(`
    SELECT f.slug, f.name_tr, f.name_en, p.slug AS parent_slug, p.name_tr AS parent_tr, p.name_en AS parent_en,
           group_concat(DISTINCT t.slug) AS types
    FROM folders f
    LEFT JOIN folders p ON p.id = f.parent_id
    LEFT JOIN documents d ON d.folder_id = f.id AND d.archived_at IS NULL
    LEFT JOIN doc_types t ON t.id = d.doc_type_id
    WHERE f.kind = 'machine' AND f.archived_at IS NULL
    GROUP BY f.id
    ORDER BY p.sort, f.sort, f.name_tr`).all();
  return rows.map((r) => ({
    slug: r.slug,
    name: { tr: r.name_tr, en: r.name_en },
    category: r.parent_slug ? { slug: r.parent_slug, name: { tr: r.parent_tr, en: r.parent_en } } : null,
    types: r.types ? r.types.split(',') : [],
  }));
}
