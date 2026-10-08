import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import { config } from './config.js';
import { publicRoutes } from './routes/public.js';
import { editorRoutes } from './routes/editor.js';
import { fileRoutes } from './routes/files.js';
import { HttpError } from './commands.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
  });

  app.use('/api', express.json({ limit: '256kb' }));
  app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  app.use('/api', publicRoutes);
  app.use('/api', editorRoutes);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Bulunamadı' }));
  app.use(fileRoutes);

  // React uygulaması: varlıklar kalıcı önbellek, index.html her zaman taze.
  const index = path.join(config.webDist, 'index.html');
  if (fs.existsSync(index)) {
    app.use('/assets', express.static(path.join(config.webDist, 'assets'), { immutable: true, maxAge: '1y', index: false }));
    app.use(express.static(config.webDist, { index: false, maxAge: '1h' }));
    app.get(/^\/(?!api\/|files\/|d\/).*/, (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(index);
    });
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err instanceof multer.MulterError) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Dosya çok büyük' : 'Yükleme hatası';
      return res.status(413).json({ error: msg });
    }
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({ error: 'Beklenmeyen bir hata oluştu' });
  });

  return app;
}
