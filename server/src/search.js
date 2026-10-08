import { db } from './db.js';
import { trFold, terms as toTerms, excerpt } from './text.js';

const folderRow = db.prepare(`
  SELECT f.*, m.model_code, m.models_json, m.summary_tr, m.summary_en
  FROM folders f LEFT JOIN machines m ON m.folder_id = f.id WHERE f.id = ?`);
const parentChain = db.prepare(`
  WITH RECURSIVE chain(id, parent_id, name_tr, name_en, depth) AS (
    SELECT id, parent_id, name_tr, name_en, 0 FROM folders WHERE id = ?
    UNION ALL
    SELECT f.id, f.parent_id, f.name_tr, f.name_en, c.depth + 1 FROM folders f JOIN chain c ON f.id = c.parent_id
  ) SELECT name_tr, name_en FROM chain ORDER BY depth DESC`);
const documentRow = db.prepare(`
  SELECT d.*, t.name_tr AS type_tr, t.name_en AS type_en, t.short AS type_short,
         fi.original_name, fi.text_content
  FROM documents d
  JOIN doc_types t ON t.id = d.doc_type_id
  LEFT JOIN document_versions v ON v.id = d.current_version_id
  LEFT JOIN files fi ON fi.id = v.file_id
  WHERE d.id = ?`);

const del = db.prepare('DELETE FROM search_index WHERE kind = ? AND ref_id = ?');
const delTri = db.prepare('DELETE FROM search_trigram WHERE kind = ? AND ref_id = ?');
const ins = db.prepare('INSERT INTO search_index (kind, ref_id, title, context, body, codes) VALUES (?, ?, ?, ?, ?, ?)');
const insTri = db.prepare('INSERT INTO search_trigram (kind, ref_id, text) VALUES (?, ?, ?)');

function codesOf(folder) {
  if (!folder) return '';
  const models = folder.models_json ? JSON.parse(folder.models_json) : [];
  const list = [folder.model_code, ...models].filter(Boolean);
  // Bitişik yazım da bulunsun: "CLEANMAX 2" → "cleanmax2", "SCS 20864" → "scs20864".
  return [...list, ...list.map((c) => c.replace(/\s+/g, ''))].join(' ');
}

export function reindexFolder(id) {
  del.run('folder', id);
  delTri.run('folder', id);
  const f = folderRow.get(id);
  if (!f || f.archived_at) return;
  const chain = parentChain.all(id).slice(0, -1);
  const title = `${f.name_tr} ${f.name_en}`;
  const context = chain.map((c) => `${c.name_tr} ${c.name_en}`).join(' ');
  const body = [f.description_tr, f.description_en, f.summary_tr, f.summary_en].filter(Boolean).join(' ');
  const codes = codesOf(f);
  ins.run('folder', id, trFold(title), trFold(context), trFold(body), trFold(codes));
  insTri.run('folder', id, trFold(`${title} ${context} ${codes} ${body}`));
}

export function reindexDocument(id) {
  del.run('document', id);
  delTri.run('document', id);
  const d = documentRow.get(id);
  if (!d || d.archived_at) return;
  const folder = folderRow.get(d.folder_id);
  const chain = parentChain.all(d.folder_id);
  const title = [d.title_tr, d.title_en].filter(Boolean).join(' ');
  const context = [
    ...chain.map((c) => `${c.name_tr} ${c.name_en}`),
    d.type_tr, d.type_en, d.type_short,
    d.language === 'tr-en' ? 'turkce ingilizce' : d.language === 'en' ? 'ingilizce english' : d.language === 'tr' ? 'turkce turkish' : '',
  ].filter(Boolean).join(' ');
  const body = [d.description, d.tags, d.text_content].filter(Boolean).join(' ');
  const codes = [codesOf(folder), d.original_name].filter(Boolean).join(' ');
  ins.run('document', id, trFold(title), trFold(context), trFold(body), trFold(codes));
  insTri.run('document', id, trFold(`${title} ${context} ${codes} ${body}`));
}

export function reindexAll() {
  db.transaction(() => {
    db.exec('DELETE FROM search_index; DELETE FROM search_trigram;');
    for (const { id } of db.prepare('SELECT id FROM folders WHERE archived_at IS NULL').all()) reindexFolder(id);
    for (const { id } of db.prepare('SELECT id FROM documents WHERE archived_at IS NULL').all()) reindexDocument(id);
  })();
}

const quote = (t) => `"${t.replace(/"/g, '""')}"`;

/**
 * Yazdıkça arama. Önce kelime/önek eşleşmesi (FTS5, ağırlıklı), sonra parça içi
 * eşleşme (trigram) ile "GSS4" gibi kod parçaları da bulunur.
 * @returns {{ terms: string[], hits: { kind: 'folder'|'document', id: number, score: number }[] }}
 */
export function searchIndex(query, limit = 40) {
  const t = toTerms(query);
  if (t.length === 0) return { terms: [], hits: [] };
  const seen = new Map();

  // Kısa sayılar tam eşleşir: "cleanmax 2" içindeki "2", 2026 ya da 250 ile eşleşmesin.
  const ftsQuery = t.map((x) => (/^\d{1,2}$/.test(x) ? quote(x) : `${quote(x)}*`)).join(' ');
  const fts = db.prepare(`
    SELECT kind, ref_id, bm25(search_index, 0, 0, 10.0, 3.0, 1.0, 6.0) AS score
    FROM search_index WHERE search_index MATCH ? ORDER BY score LIMIT ?`).all(ftsQuery, limit * 2);
  for (const r of fts) seen.set(`${r.kind}:${r.ref_id}`, { kind: r.kind, id: r.ref_id, score: r.score });

  const longTerms = t.filter((x) => x.length >= 3);
  if (longTerms.length === t.length && seen.size < limit) {
    const tri = db.prepare(`
      SELECT kind, ref_id, rank FROM search_trigram WHERE search_trigram MATCH ? ORDER BY rank LIMIT ?`)
      .all(longTerms.map(quote).join(' AND '), limit);
    for (const r of tri) {
      const key = `${r.kind}:${r.ref_id}`;
      if (!seen.has(key)) seen.set(key, { kind: r.kind, id: r.ref_id, score: 100 + r.rank });
    }
  }

  const hits = [...seen.values()].sort((a, b) => a.score - b.score).slice(0, limit);
  return { terms: t, hits };
}

export { excerpt };
