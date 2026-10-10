import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'barmaksan-export-test-'));
process.env.DATA_DIR = temp;
process.env.EDITOR_KEY = 'isolated-test-editor';
const { default: sharp } = await import('sharp');
const { db } = await import('../src/db.js');
const cmd = await import('../src/commands.js');
const { createApp } = await import('../src/app.js');
const { storagePath } = await import('../src/media.js');
const { udb } = await import('../src/users-db.js');
const server = createApp().listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  db.close();
  udb.close();
  fs.rmSync(temp, { recursive: true, force: true });
});

// Gerçek bir 3000×2000 PNG (saydam) kütüphaneye konur.
const key = 'originals/te/test-photo.png';
fs.mkdirSync(path.dirname(storagePath(key)), { recursive: true });
await sharp({ create: { width: 3000, height: 2000, channels: 4, background: { r: 200, g: 40, b: 40, alpha: 0.5 } } }).png().toFile(storagePath(key));
const fileId = Number(db.prepare('INSERT INTO files(sha256,original_name,ext,mime,size_bytes,storage_key,width,height) VALUES(?,?,?,?,?,?,?,?)')
  .run('export-test-sha', 'foto.png', 'png', 'image/png', fs.statSync(storagePath(key)).size, key, 3000, 2000).lastInsertRowid);
const folder = cmd.createFolder({ nameTr: 'Makineler', slug: 'makineler' });
cmd.createFolder({ parent: folder.id, kind: 'machine', slug: 'cleanmax-4', nameTr: 'Cleanmax 4', machine: { modelCode: 'C4' } });
const photo = cmd.createDocument({ folder: 'cleanmax-4', type: 'fotograf', titleTr: 'Cleanmax 4 ön', language: 'none', fileId }).publicId;

async function download(query) {
  const res = await fetch(`${base}/d/${photo}/indir${query}`);
  return { res, body: Buffer.from(await res.arrayBuffer()) };
}

test('images download resized and converted, never enlarged; the original stays untouched', async () => {
  const small = await download('?boyut=kucuk&bicim=jpg');
  assert.equal(small.res.status, 200);
  assert.equal(small.res.headers.get('content-type'), 'image/jpeg');
  assert.match(small.res.headers.get('content-disposition'), /attachment;.*k%C3%BC%C3%A7%C3%BCk\)\.jpg/);
  const sm = await sharp(small.body).metadata();
  assert.deepEqual([sm.format, sm.width, sm.height, sm.hasAlpha], ['jpeg', 1280, 853, false]);

  const large = await sharp((await download('?boyut=buyuk&bicim=png')).body).metadata();
  assert.deepEqual([large.format, large.width, large.height], ['png', 3000, 2000]);

  const original = await download('');
  assert.equal(original.res.headers.get('content-type'), 'image/png');
  assert.deepEqual(original.body, fs.readFileSync(storagePath(key)));
});

test('unknown sizes or formats are rejected', async () => {
  assert.equal((await download('?boyut=xxl&bicim=jpg')).res.status, 400);
  assert.equal((await download('?boyut=kucuk&bicim=gif')).res.status, 400);
  assert.equal((await download('?boyut=__proto__')).res.status, 400);
});
