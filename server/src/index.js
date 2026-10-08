import { createApp } from './app.js';
import { config } from './config.js';
import { db } from './db.js';

const app = createApp();
const server = app.listen(config.port, config.host, () => {
  console.log(`Bilgi Kütüphanesi http://${config.host}:${config.port}  (veri: ${config.dataDir}, düzenleme: ${config.editorKey ? 'açık' : 'kapalı'})`);
});

// Büyük video yüklemeleri için uzun zaman aşımı.
server.requestTimeout = 0;
server.headersTimeout = 65_000;

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
