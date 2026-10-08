import { Router } from 'express';
import * as q from '../queries.js';

export const publicRoutes = Router();

publicRoutes.get('/health', (_req, res) => res.json({ ok: true }));

publicRoutes.get('/bootstrap', (_req, res) => {
  res.json({ docTypes: q.docTypes(), tree: q.tree(), stats: q.stats(), home: q.home(), coverageTypes: q.coverageTypes() });
});

publicRoutes.get('/tree', (_req, res) => res.json(q.tree()));

publicRoutes.get('/folders/:slug', (req, res) => {
  const f = q.folder(req.params.slug);
  if (!f) return res.status(404).json({ error: 'Klasör bulunamadı' });
  res.json(f);
});

publicRoutes.get('/documents/:id', (req, res) => {
  const d = q.documentDetail(req.params.id);
  if (!d) return res.status(404).json({ error: 'Doküman bulunamadı' });
  res.json(d);
});

publicRoutes.get('/recent', (req, res) => {
  res.json(q.recent(Math.min(Number(req.query.limit) || 12, 50)));
});

publicRoutes.get('/media', (req, res) => {
  res.json(q.media({
    folderSlug: typeof req.query.folder === 'string' ? req.query.folder : undefined,
    kind: req.query.kind,
    cursor: req.query.cursor,
    limit: Math.min(Number(req.query.limit) || 48, 120),
  }));
});

publicRoutes.get('/search', (req, res) => {
  const text = typeof req.query.q === 'string' ? req.query.q.slice(0, 120) : '';
  if (!text.trim()) return res.json({ query: '', terms: [], folders: [], documents: [] });
  res.json(q.search(text, {
    type: typeof req.query.type === 'string' && req.query.type ? req.query.type : undefined,
    limit: Math.min(Number(req.query.limit) || 30, 60),
  }));
});
