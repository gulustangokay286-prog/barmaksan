import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import { config } from './config.js';
import { publicRoutes } from './routes/public.js';
import { editorRoutes } from './routes/editor.js';
import { fileRoutes } from './routes/files.js';
import { accountRoutes } from './routes/account.js';
import { contentSecurityPolicy, sameOrigin, securityHeaders } from './security.js';
import { HttpError } from './commands.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // Önde nginx var; Docker'da istek köprü ağ geçidinden (özel ağ) gelir. Konteyner portu yalnızca
  // 127.0.0.1'e açık olduğundan bu aralıklara güvenmek güvenli: req.ip gerçek ziyaretçi, req.secure doğru.
  app.set('trust proxy', 'loopback, uniquelocal');

  app.use(securityHeaders);

  app.use('/api', express.json({ limit: '256kb' }));
  app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  app.use('/api', sameOrigin);
  app.use('/api', accountRoutes);
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
      res.setHeader('Content-Security-Policy', contentSecurityPolicy());
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
