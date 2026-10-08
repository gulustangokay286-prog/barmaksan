import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(serverRoot, '..');

const dataDir = path.resolve(process.env.DATA_DIR ?? path.join(repoRoot, 'data'));

export const config = {
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? '127.0.0.1',
  dataDir,
  dbPath: path.join(dataDir, 'barmaksan.db'),
  storageDir: path.join(dataDir, 'storage'),
  tmpDir: path.join(dataDir, 'tmp'),
  schemaPath: path.join(serverRoot, 'db', 'schema.sql'),
  webDist: path.resolve(process.env.WEB_DIST ?? path.join(repoRoot, 'web', 'dist')),
  // Düzenleme anahtarı boşsa düzenleme kapalıdır (okuma her zaman açık).
  editorKey: process.env.EDITOR_KEY ?? '',
  ffmpeg: process.env.FFMPEG_PATH ?? 'ffmpeg',
  maxUploadBytes: Number(process.env.MAX_UPLOAD_MB ?? 4096) * 1024 * 1024,
  // PDF sayfa önizlemeleri istek geldikçe üretilir; bu sınırın ötesi indirilerek okunur.
  maxPreviewPages: 60,
};
