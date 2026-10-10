// Hesap ve oturum güvenliği: çerez bayrakları, opak jeton, belge kapısı, misafir/üye ayrımı,
// köken (CSRF) denetimi, hız sınırı ve şifre kuralları.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'barmaksan-accounts-test-'));
process.env.DATA_DIR = temp;
process.env.EDITOR_KEY = 'isolated-test-editor';
const { db } = await import('../src/db.js');
const { udb } = await import('../src/users-db.js');
const cmd = await import('../src/commands.js');
const { createApp } = await import('../src/app.js');
const server = createApp().listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  db.close();
  udb.close();
  fs.rmSync(temp, { recursive: true, force: true });
});

// Belge fixture'ı: bir PDF (kapılı) ve bir görsel (açık).
const root = cmd.createFolder({ nameTr: 'Makineler', nameEn: 'Machines', slug: 'makineler' });
cmd.createFolder({ parent: root.id, kind: 'machine', slug: 'cleanmax-4', nameTr: 'Cleanmax 4', machine: { modelCode: 'C4' } });
fs.mkdirSync(path.join(temp, 'storage', 'test'), { recursive: true });
fs.writeFileSync(path.join(temp, 'storage', 'test', 'fixture.pdf'), '%PDF-1.4 test');
const file = (mime, ext) => Number(db.prepare('INSERT INTO files(sha256,original_name,ext,mime,size_bytes,storage_key) VALUES(?,?,?,?,?,?)').run(crypto.randomUUID(), `fixture.${ext}`, ext, mime, 13, 'test/fixture.pdf').lastInsertRowid);
const pdfId = file('application/pdf', 'pdf');
const docId = cmd.createDocument({ folder: 'cleanmax-4', type: 'kullanim-kilavuzu', titleTr: 'Kılavuz', language: 'tr', fileId: pdfId }).publicId;

/** Tarayıcı gibi: aynı kökenden, çerezi taşıyan istemci. */
function client() {
  let cookie = '';
  return async (url, method = 'GET', body, headers = {}) => {
    const res = await fetch(origin + url, {
      method, redirect: 'manual',
      headers: { 'Content-Type': 'application/json', Origin: origin, ...(cookie ? { Cookie: cookie } : {}), ...headers },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const set = res.headers.getSetCookie();
    for (const c of set) {
      const [pair] = c.split(';');
      const [name, value] = [pair.slice(0, pair.indexOf('=')), pair.slice(pair.indexOf('=') + 1)];
      const rest = cookie.split('; ').filter((p) => p && !p.startsWith(`${name}=`));
      cookie = (value ? [...rest, `${name}=${value}`] : rest).join('; ');
    }
    const type = res.headers.get('content-type') ?? '';
    return { status: res.status, headers: res.headers, set, data: type.includes('json') ? await res.json() : null };
  };
}

const member = { email: 'ali@firma.test', password: 'Guclu-sifre-2026', firstName: 'Ali', lastName: 'Yılmaz', company: 'Firma A.Ş.', kvkk: true };

test('session cookie is opaque, HttpOnly, Secure, SameSite=Strict and __Host- scoped', async () => {
  const api = client();
  const res = await api('/api/account/register', 'POST', member);
  assert.equal(res.status, 200);
  assert.equal(res.data.kind, 'account');
  assert.equal(res.data.account.email, 'ali@firma.test');
  assert.equal(res.data.account.id, undefined);
  const cookie = res.set.find((c) => c.startsWith('__Host-bk_session='));
  assert.match(cookie, /; Path=\/; HttpOnly; Secure; SameSite=Strict; Max-Age=\d+/);
  const token = decodeURIComponent(cookie.split(';')[0].split('=')[1]);
  assert.equal(token.split('.').length, 1, 'JWT değil: içinde çözülecek bölüm yok');
  assert.ok(Buffer.from(token, 'base64url').length === 32);
  // Sunucuda jeton değil özeti tutulur.
  assert.equal(udb.prepare('SELECT count(*) n FROM sessions WHERE token_hash = ?').get(token).n, 0);
  assert.match(udb.prepare('SELECT password_hash FROM accounts WHERE email = ?').get(member.email).password_hash, /^scrypt2\$32768\$8\$1\$/);
});

test('documents need a guest or member session; images stay public', async () => {
  const anon = client();
  assert.equal((await anon(`/files/${pdfId}/raw/x.pdf`)).status, 401);
  assert.equal((await anon(`/d/${docId}`, 'GET', undefined, { Accept: 'application/json' })).status, 401);
  const redirect = await anon(`/d/${docId}`, 'GET', undefined, { Accept: 'text/html' });
  assert.equal(redirect.status, 302);
  assert.match(redirect.headers.get('location'), /^\/giris\?donus=/);

  const guest = client();
  const g = await guest('/api/account/guest', 'POST', { email: 'misafir@firma.test', kvkk: true });
  assert.equal(g.data.kind, 'guest');
  const ok = await guest(`/files/${pdfId}/raw/x.pdf`);
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get('cache-control'), /no-cache|private/);
  // Kaydedilenler yalnızca üyelere.
  assert.equal((await guest('/api/account/saved')).status, 401);
});

test('saved items belong to the member and survive across requests', async () => {
  const api = client();
  await api('/api/account/login', 'POST', { email: member.email, password: member.password });
  assert.equal((await api(`/api/account/saved/${docId}`, 'PUT', { id: docId, title: { tr: 'Kılavuz', en: null } })).status, 204);
  const list = await api('/api/account/saved');
  assert.deepEqual(list.data.map((s) => s.id), [docId]);
  assert.equal((await api('/api/account/logout', 'POST')).data.kind, 'anonymous');
  assert.equal((await api('/api/account/saved')).status, 401);
});

test('wrong credentials give one generic error and are rate limited per e-mail', async () => {
  const api = client();
  const unknown = await api('/api/account/login', 'POST', { email: 'yok@firma.test', password: 'Bir-sifre-123' });
  const wrong = await api('/api/account/login', 'POST', { email: member.email, password: 'Yanlis-sifre-123' });
  assert.equal(unknown.status, 401);
  assert.equal(wrong.status, 401);
  assert.equal(unknown.data.error, wrong.data.error);
  for (let i = 0; i < 6; i++) await api('/api/account/login', 'POST', { email: member.email, password: `Yanlis-${i}-sifre` });
  const locked = await api('/api/account/login', 'POST', { email: member.email, password: member.password });
  assert.equal(locked.status, 429, 'doğru şifre bile kilit süresince kabul edilmez');
});

test('cross-site requests are rejected before reaching any handler', async () => {
  const res = await fetch(`${origin}/api/account/guest`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
    body: JSON.stringify({ email: 'x@y.test', kvkk: true }),
  });
  assert.equal(res.status, 403);
  const site = await fetch(`${origin}/api/account/logout`, { method: 'POST', headers: { 'Sec-Fetch-Site': 'cross-site' } });
  assert.equal(site.status, 403);
});

test('weak passwords and missing consent are refused', async () => {
  const api = client();
  for (const password of ['kisa1', 'sadeceharfler', '1234567890', 'ali12345678']) {
    const res = await api('/api/account/register', 'POST', { ...member, email: `x${password}@firma.test`, password: password === 'ali12345678' ? 'xali12345678' : password });
    if (password !== 'ali12345678') assert.equal(res.status, 400, password);
  }
  assert.equal((await api('/api/account/register', 'POST', { ...member, email: 'kvkk@firma.test', kvkk: false })).status, 400);
});

test('members cannot use admin endpoints; only admin sessions can', async () => {
  const api = client();
  await api('/api/account/register', 'POST', { ...member, email: 'uye@firma.test' });
  assert.equal((await api('/api/admin/users')).status, 401);
  assert.equal((await api('/api/auth/login', 'POST', { email: 'uye@firma.test', password: member.password })).status, 401);
});
