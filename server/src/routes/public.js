import { Router } from 'express';
import { isMember, viewerOf } from '../accounts.js';
import * as q from '../queries.js';
import { languages } from '../content.js';

export const publicRoutes = Router();

publicRoutes.get('/health', (_req, res) => res.json({ ok: true }));

publicRoutes.get('/bootstrap', (_req, res) => {
  res.json({ docTypes: q.docTypes(), tree: q.tree(), stats: q.stats(), home: q.home(), coverageTypes: q.coverageTypes(), languages: languages() });
});

publicRoutes.get('/languages', (_req, res) => res.json(languages()));
// Web sitesi ve kataloglar için aynı içerik kaynağı; isteğe bağlı dil seçimi.
publicRoutes.get('/catalog/machines/:slug', (req, res) => {
  const f = q.folder(req.params.slug);
  if (!f || f.kind !== 'machine') return res.status(404).json({ error: 'Makine bulunamadı' });
  const language = typeof req.query.language === 'string' ? req.query.language : null;
  if (language && !f.content.profiles[language]) return res.status(404).json({ error: 'Bu dilde makine açıklaması yok' });
  const included = new Set(['none', 'multi', language, ...(['tr','en'].includes(language) ? ['tr-en'] : [])]);
  res.json({ ...f, content: language ? { ...f.content, profiles: { [language]: f.content.profiles[language] }, maintenance: f.content.maintenance.map((c) => ({ ...c, titles: { [language]: c.titles[language] ?? '' }, topics: c.topics.filter((t) => t.translations[language]).map((t) => ({ ...t, translations: { [language]: t.translations[language] } })) })).filter((c) => c.topics.length) } : f.content, documents: language ? f.documents.filter((d) => included.has(d.language)) : f.documents });
});
publicRoutes.get('/catalog/machines', (_req, res) => res.json(q.tree().filter((f) => f.kind === 'machine').map((f) => ({ slug: f.slug, name: f.name, modelCode: f.modelCode, url: `/api/catalog/machines/${f.slug}` }))));

publicRoutes.get('/tree', (_req, res) => res.json(q.tree()));

publicRoutes.get('/folders/:slug', (req, res) => {
  const f = q.folder(req.params.slug);
  if (!f) return res.status(404).json({ error: 'Klasör bulunamadı' });
  res.json(f);
});

publicRoutes.get('/documents/:id', (req, res) => {
  const d = q.documentDetail(req.params.id);
  if (!d) return res.status(404).json({ error: 'Doküman bulunamadı' });
  // Eski sürümler üyelere açık; diğerleri yalnızca güncel sürümü ve kaç eski sürüm olduğunu görür.
  if (!isMember(viewerOf(req))) {
    const hidden = d.versions.filter((v) => v.no !== d.current?.no).length;
    return res.json({ ...d, versions: d.versions.filter((v) => v.no === d.current?.no), hiddenVersions: hidden });
  }
  res.json(d);
});

publicRoutes.get('/recent', (req, res) => {
  res.json(q.recent(Math.min(Number(req.query.limit) || 12, 50), typeof req.query.language === 'string' ? req.query.language : undefined));
});

publicRoutes.get('/media', (req, res) => {
  res.json(q.media({
    folderSlug: typeof req.query.folder === 'string' ? req.query.folder : undefined,
    kind: req.query.kind,
    language: typeof req.query.language === 'string' ? req.query.language : undefined,
    cursor: req.query.cursor,
    limit: Math.min(Number(req.query.limit) || 48, 120),
  }));
});

publicRoutes.get('/search', (req, res) => {
  const text = typeof req.query.q === 'string' ? req.query.q.slice(0, 120) : '';
  if (!text.trim()) return res.json({ query: '', terms: [], folders: [], documents: [] });
  res.json(q.search(text, {
    language: typeof req.query.language === 'string' ? req.query.language : undefined,
    type: typeof req.query.type === 'string' && req.query.type ? req.query.type : undefined,
    limit: Math.min(Number(req.query.limit) || 30, 60),
  }));
});
