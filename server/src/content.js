import { db, now } from './db.js';
import { HttpError } from './commands.js';
import { reindexFolder } from './search.js';

export const legacyLanguages = new Set(['tr', 'en', 'tr-en', 'multi', 'none']);
export function languages() {
  return db.prepare('SELECT code, label, native_name AS nativeName, direction FROM content_languages ORDER BY sort, label').all();
}
export function checkLanguage(code) {
  if (!legacyLanguages.has(code) && !db.prepare('SELECT code FROM content_languages WHERE code = ?').get(code)) throw new HttpError(400, 'Dil önce yönetimden eklenmeli');
  return code;
}
export function addLanguage(input, author) {
  const code = String(input.code ?? '').trim().toLowerCase();
  if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(code) || legacyLanguages.has(code)) throw new HttpError(400, 'Yeni dil için fr, it, ar gibi bir dil kodu kullanın');
  try { Intl.getCanonicalLocales(code); } catch { throw new HttpError(400, 'Dil kodu geçersiz'); }
  const label = text(input.label, 80), native = text(input.nativeName, 80) || label;
  if (!label) throw new HttpError(400, 'Dil adı gerekli');
  if (db.prepare('SELECT code FROM content_languages WHERE code = ?').get(code)) throw new HttpError(409, 'Bu dil zaten var');
  db.transaction(() => {
    db.prepare('INSERT INTO content_languages(code,label,native_name,direction,sort) VALUES(?,?,?,?,(SELECT coalesce(max(sort),0)+1 FROM content_languages))').run(code, label, native, input.direction === 'rtl' ? 'rtl' : 'ltr');
    activity(null, 'language.created', author, { code });
  })();
  return { code };
}

function machine(slug) {
  const row = db.prepare('SELECT f.*, m.summary_tr, m.summary_en FROM folders f JOIN machines m ON m.folder_id=f.id WHERE f.slug=? AND f.archived_at IS NULL').get(slug);
  if (!row) throw new HttpError(404, 'Makine bulunamadı');
  return row;
}
const text = (value, max = 12000) => String(value ?? '').trim().slice(0, max);
const record = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'İçerik biçimi geçersiz');
  return value;
};
const list = (value, max = 100) => {
  if (!Array.isArray(value)) throw new HttpError(400, 'Liste biçimi geçersiz');
  if (value.length > max) throw new HttpError(400, 'Listede çok fazla öğe var');
  return value;
};
export function safeUrl(value) {
  if (!value) return '';
  let url;
  try { url = new URL(String(value)); } catch { throw new HttpError(400, 'Bağlantı geçersiz'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new HttpError(400, 'Bağlantı http veya https olmalı');
  if (url.href.length > 2000) throw new HttpError(400, 'Bağlantı çok uzun');
  return url.href;
}
const strings = (value) => list(value ?? []).map((s) => text(s, 2000)).filter(Boolean);
const idOf = (value) => {
  const id = text(value, 80);
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) throw new HttpError(400, 'İçerik kimliği geçersiz');
  return id;
};
function activity(folderId, action, actor, detail) {
  db.prepare('INSERT INTO activity(action,folder_id,actor,detail) VALUES(?,?,?,?)').run(action, folderId, actor || null, JSON.stringify(detail));
}

export function machineContent(slug) {
  const f = machine(slug);
  const row = db.prepare('SELECT * FROM machine_content WHERE folder_id=?').get(f.id);
  const fallback = {};
  for (const code of ['tr', 'en']) {
    const description = f[`summary_${code}`];
    if (description) fallback[code] = { title: f[`name_${code}`], description, features: [], specifications: [], applications: [], productUrl: '', updatedAt: f.updated_at, author: null, changeNote: '' };
  }
  if (!row) return { revision: 0, profiles: fallback, gallery: null, maintenance: [], updatedAt: f.updated_at, author: null };
  const active = new Set(db.prepare('SELECT public_id FROM documents WHERE folder_id=? AND archived_at IS NULL').all(f.id).map((d) => d.public_id));
  const gallery = JSON.parse(row.gallery_json);
  const maintenance = JSON.parse(row.maintenance_json);
  for (const c of maintenance) for (const t of c.topics) for (const v of Object.values(t.translations)) v.documents = v.documents.filter((id) => active.has(id));
  return { revision: row.revision, profiles: JSON.parse(row.profiles_json), gallery: gallery?.filter((id) => active.has(id)) ?? null, maintenance, updatedAt: row.updated_at, author: row.author };
}

export function saveMachineContent(slug, input, author) {
  record(input);
  const f = machine(slug);
  const previous = machineContent(slug);
  if (input.revision !== previous.revision) throw new HttpError(409, 'İçerik başka bir yerde değişti. Sayfayı yenileyip tekrar deneyin.');
  const at = now();
  const documentIds = new Set(db.prepare('SELECT public_id FROM documents WHERE folder_id=? AND archived_at IS NULL').all(f.id).map((d) => d.public_id));
  const imageIds = new Set(db.prepare(`SELECT d.public_id FROM documents d JOIN document_versions v ON v.id=d.current_version_id JOIN files fi ON fi.id=v.file_id WHERE d.folder_id=? AND d.archived_at IS NULL AND fi.mime LIKE 'image/%'`).all(f.id).map((d) => d.public_id));
  const checkDocuments = (ids) => {
    const result = [...new Set(strings(ids))];
    if (result.some((id) => !documentIds.has(id))) throw new HttpError(400, 'Ek dosya bu makinenin etkin belgelerinden seçilmeli');
    return result;
  };
  const stamp = (value, old) => {
    const plainOld = old ? Object.fromEntries(Object.entries(old).filter(([k]) => !['updatedAt', 'author'].includes(k))) : null;
    return JSON.stringify(value) === JSON.stringify(plainOld) ? old : { ...value, updatedAt: at, author: author || null };
  };
  const profiles = {};
  if (!input.profiles || typeof input.profiles !== 'object' || Array.isArray(input.profiles)) throw new HttpError(400, 'Makine açıklamaları gerekli');
  for (const [code, value] of Object.entries(input.profiles)) {
    checkLanguage(code);
    if (!languages().some((l) => l.code === code) || !value || typeof value !== 'object') throw new HttpError(400, 'İçerik dili geçersiz');
    const specifications = list(value.specifications ?? [], 20).map((table) => {
      record(table);
      const columns = list(table.columns ?? [], 40).map((s) => text(s, 200));
      const rows = list(table.rows ?? [], 100).map((row) => list(row, 40).map((s) => text(s, 2000)));
      if (!columns.length || columns.length > 40 || rows.some((r) => r.length !== columns.length)) throw new HttpError(400, 'Teknik tabloda sütunlar ve satırlar aynı uzunlukta olmalı');
      return { title: text(table.title, 200), columns, rows };
    });
    const profile = { title: text(value.title, 200), description: text(value.description), features: strings(value.features), specifications, applications: strings(value.applications), productUrl: safeUrl(value.productUrl), changeNote: text(value.changeNote, 500) };
    profiles[code] = stamp(profile, previous.profiles[code]);
  }
  const gallery = input.gallery == null ? null : checkDocuments(input.gallery);
  if (gallery?.some((id) => !imageIds.has(id))) throw new HttpError(400, 'Galeriye yalnızca görseller eklenebilir');
  const seen = new Set();
  const topicIds = new Set();
  const maintenance = list(input.maintenance ?? [], 100).map((category) => {
    record(category);
    const id = idOf(category.id);
    if (seen.has(id)) throw new HttpError(400, 'Kategori kimliği tekrar ediyor');
    seen.add(id);
    const titles = {};
    for (const [code, title] of Object.entries(category.titles ?? {})) { if (!languages().some((l) => l.code === code)) throw new HttpError(400, 'Kategori dili geçersiz'); titles[code] = text(title, 160); }
    const topics = list(category.topics ?? [], 200).map((topic) => {
      record(topic);
      const topicId = idOf(topic.id);
      if (topicIds.has(topicId)) throw new HttpError(400, 'Konu kimliği tekrar ediyor');
      topicIds.add(topicId);
      const translations = {};
      for (const [code, value] of Object.entries(topic.translations ?? {})) {
        if (!languages().some((l) => l.code === code)) throw new HttpError(400, 'Kılavuz dili geçersiz');
        if (!value || typeof value !== 'object') throw new HttpError(400, 'Kılavuz içeriği geçersiz');
        const entry = { title: text(value.title, 200), description: text(value.description), steps: strings(value.steps), warning: text(value.warning, 3000), videos: list(value.videos ?? [], 30).map((v) => { record(v); return { title: text(v.title, 200), url: safeUrl(v.url) }; }).filter((v) => v.url), documents: checkDocuments(value.documents ?? []), changeNote: text(value.changeNote, 500) };
        if (!entry.title) throw new HttpError(400, 'Bakım konusu başlığı gerekli');
        const old = previous.maintenance.find((c) => c.id === id)?.topics.find((t) => t.id === topicId)?.translations[code];
        translations[code] = stamp(entry, old);
      }
      return { id: topicId, translations };
    });
    return { id, titles, topics };
  });
  const revision = previous.revision + 1;
  return db.transaction(() => {
    const actual = db.prepare('SELECT revision FROM machine_content WHERE folder_id=?').get(f.id)?.revision ?? 0;
    if (actual !== input.revision) throw new HttpError(409, 'İçerik başka bir yerde değişti. Yenileyin.');
    db.prepare(`INSERT INTO machine_content(folder_id,revision,profiles_json,gallery_json,maintenance_json,updated_at,author) VALUES(?,?,?,?,?,?,?) ON CONFLICT(folder_id) DO UPDATE SET revision=excluded.revision,profiles_json=excluded.profiles_json,gallery_json=excluded.gallery_json,maintenance_json=excluded.maintenance_json,updated_at=excluded.updated_at,author=excluded.author`).run(f.id, revision, JSON.stringify(profiles), JSON.stringify(gallery), JSON.stringify(maintenance), at, author || null);
    const content = { revision, profiles, gallery, maintenance, updatedAt: at, author: author || null };
    db.prepare('INSERT INTO machine_content_history(folder_id,revision,snapshot_json,note,author,created_at) VALUES(?,?,?,?,?,?)').run(f.id, revision, JSON.stringify(content), text(input.note, 500), author || null, at);
    db.prepare('UPDATE folders SET updated_at=? WHERE id=?').run(at, f.id);
    activity(f.id, 'machine.content.updated', author, { revision, languages: Object.keys(profiles), note: text(input.note, 500) });
    reindexFolder(f.id);
    return content;
  })();
}

export function contentHistory(slug) {
  return db.prepare('SELECT revision,note,author,created_at AS createdAt FROM machine_content_history WHERE folder_id=? ORDER BY revision DESC LIMIT 100').all(machine(slug).id);
}
