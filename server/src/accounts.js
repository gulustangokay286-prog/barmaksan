// Hesaplar ve oturumlar. Üç seviye:
//   misafir  → e-postasını beyan eder; güncel belgeleri açar/indirir.
//   üye      → kayıtlı hesap; ek olarak eski sürümler ve Kaydedilenler.
//   yönetici → üye + yönetim paneli ve düzenleme.
// Oturum: 256 bit opak jeton, yalnızca HttpOnly çerezde; sunucuda SHA-256 özeti tutulur.
import crypto from 'node:crypto';
import { udb } from './users-db.js';
import { config } from './config.js';
import { HttpError } from './commands.js';
import {
  SESSION_COOKIE, OAUTH_COOKIE, RateLimit, burnPasswordTime, clearCookie, hashPassword, ipHash,
  newToken, passwordProblem, readCookie, setCookie, sha256, verifyPassword,
} from './security.js';

const DAY = 86_400_000;
const ACCOUNT_DAYS = 30;          // üye oturumu: 30 gün, her kullanımda uzar
const GUEST_DAYS = 14;            // misafir oturumu
const TOUCH_MS = 10 * 60_000;     // son görülme en fazla 10 dakikada bir yazılır

const iso = (ms = Date.now()) => new Date(ms).toISOString();

// ── Doğrulama ───────────────────────────────────────────────────────────────

const EMAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i;
function email(value) {
  const e = String(value ?? '').trim().toLowerCase();
  if (e.length > 254 || !EMAIL.test(e)) throw new HttpError(400, 'Geçerli bir e-posta adresi girin');
  return e;
}
function name(value, label, { required = true, max = 60 } = {}) {
  const v = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (!v) { if (required) throw new HttpError(400, `${label} gerekli`); return null; }
  if (v.length > max) throw new HttpError(400, `${label} çok uzun`);
  if (/[<>{}\\]/.test(v)) throw new HttpError(400, `${label} geçersiz karakter içeriyor`);
  return v;
}
function phone(value) {
  const v = String(value ?? '').trim();
  if (!v) return null;
  if (!/^\+?[0-9 ()-]{7,20}$/.test(v)) throw new HttpError(400, 'Telefon numarası geçersiz');
  return v;
}

// ── Hız sınırları ───────────────────────────────────────────────────────────

const loginByIp = new RateLimit(20, 15 * 60_000);
const loginByEmail = new RateLimit(6, 15 * 60_000);
const registerByIp = new RateLimit(6, 60 * 60_000);
const guestByIp = new RateLimit(20, 60 * 60_000);

function event(kind, req, { emailValue = null, accountId = null } = {}) {
  udb.prepare('INSERT INTO auth_events (kind, email, account_id, ip_hash) VALUES (?, ?, ?, ?)').run(kind, emailValue, accountId, ipHash(req.ip));
}

// ── Oturumlar ───────────────────────────────────────────────────────────────

function startSession(req, res, { kind, accountId = null, guestId = null }) {
  const token = newToken();
  const days = kind === 'account' ? ACCOUNT_DAYS : GUEST_DAYS;
  udb.prepare(`INSERT INTO sessions (token_hash, kind, account_id, guest_id, expires_at, user_agent) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(sha256(token), kind, accountId, guestId, iso(Date.now() + days * DAY), String(req.get('user-agent') ?? '').slice(0, 200));
  // Eski oturum (ör. misafirken giriş yapıldı) kapanır: jeton sabitleme (session fixation) olmaz.
  const previous = readCookie(req, SESSION_COOKIE);
  if (previous) udb.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(previous));
  udb.prepare('DELETE FROM sessions WHERE expires_at < ?').run(iso());
  setCookie(res, SESSION_COOKIE, token, { maxAge: days * 86_400 });
  // Aynı istekte yanıt olarak yeni oturum dönebilsin.
  req.sessionToken = token;
  req.viewer = undefined;
}

const sessionRow = udb.prepare(`
  SELECT s.token_hash, s.kind, s.last_seen_at, s.expires_at,
         a.id AS a_id, a.email AS a_email, a.role, a.first_name, a.last_name, a.company, a.job_title, a.phone, a.country,
         a.kvkk_at, a.marketing, a.google_sub, a.password_hash IS NOT NULL AS has_password, a.disabled_at,
         g.id AS g_id, g.email AS g_email, g.name AS g_name
  FROM sessions s
  LEFT JOIN accounts a ON a.id = s.account_id
  LEFT JOIN guests g ON g.id = s.guest_id
  WHERE s.token_hash = ? AND s.expires_at > ?`);

/** İsteğin oturumu (yoksa null). Kullanıldıkça süresi uzar. Sonuç istek başına bir kez hesaplanır. */
export function viewerOf(req) {
  if (req.viewer !== undefined) return req.viewer;
  const token = req.sessionToken ?? readCookie(req, SESSION_COOKIE);
  let viewer = null;
  if (token && token.length >= 40 && token.length <= 64) {
    const row = sessionRow.get(sha256(token), iso());
    if (row && !(row.kind === 'account' && row.disabled_at)) {
      if (Date.now() - Date.parse(row.last_seen_at) > TOUCH_MS) {
        const days = row.kind === 'account' ? ACCOUNT_DAYS : GUEST_DAYS;
        udb.prepare('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE token_hash = ?').run(iso(), iso(Date.now() + days * DAY), row.token_hash);
      }
      viewer = row.kind === 'account'
        ? { kind: 'account', tokenHash: row.token_hash, account: {
          id: row.a_id, email: row.a_email, role: row.role, firstName: row.first_name, lastName: row.last_name,
          company: row.company, jobTitle: row.job_title, phone: row.phone, country: row.country,
          profileComplete: !!(row.first_name && row.last_name && row.kvkk_at), marketing: !!row.marketing,
          google: !!row.google_sub, hasPassword: !!row.has_password,
        } }
        : { kind: 'guest', tokenHash: row.token_hash, guest: { id: row.g_id, email: row.g_email, name: row.g_name } };
    }
  }
  req.viewer = viewer;
  return viewer;
}

export const isMember = (v) => v?.kind === 'account';
export const isAdmin = (v) => v?.kind === 'account' && v.account.role === 'admin';

/** Arayüzün gördüğü biçim: kimlik numaraları ve jeton özeti dışarı çıkmaz. */
export function meDto(v) {
  if (!v) return { kind: 'anonymous' };
  if (v.kind === 'guest') return { kind: 'guest', guest: { email: v.guest.email, name: v.guest.name } };
  const { id: _id, ...account } = v.account;
  return { kind: 'account', account };
}

export function logout(req, res) {
  const token = req.sessionToken ?? readCookie(req, SESSION_COOKIE);
  if (token) udb.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
  clearCookie(res, SESSION_COOKIE);
  req.sessionToken = '';
  req.viewer = null;
}

export function logoutEverywhere(req, res) {
  const v = viewerOf(req);
  if (isMember(v)) udb.prepare('DELETE FROM sessions WHERE account_id = ?').run(v.account.id);
  clearCookie(res, SESSION_COOKIE);
}

// ── Kayıt, giriş, misafir ───────────────────────────────────────────────────

export function register(req, res, body) {
  if (!registerByIp.take(req.ip)) throw new HttpError(429, 'Çok fazla kayıt denemesi. Bir süre sonra tekrar deneyin.');
  const e = email(body.email);
  const problem = passwordProblem(body.password, e);
  if (problem) throw new HttpError(400, problem);
  if (body.kvkk !== true) throw new HttpError(400, 'Devam etmek için aydınlatma metnini onaylayın');
  const fields = {
    first: name(body.firstName, 'Ad'), last: name(body.lastName, 'Soyad'),
    company: name(body.company, 'Şirket', { required: false, max: 120 }), jobTitle: name(body.jobTitle, 'Görev', { required: false, max: 80 }),
    phone: phone(body.phone), country: name(body.country, 'Ülke', { required: false, max: 60 }),
  };
  if (udb.prepare('SELECT 1 FROM accounts WHERE email = ?').get(e)) {
    // Kayıtlı e-posta açıkça söylenmez gibi davranmak kullanıcıyı şaşırtır; şirket içi bir sistemde
    // giriş sayfasına yönlendirmek daha doğru. Hız sınırı numaralandırmayı zaten zorlaştırır.
    throw new HttpError(409, 'Bu e-postayla bir hesap zaten var. Giriş yapın ya da şifrenizi yöneticinizden yenilemesini isteyin.');
  }
  const info = udb.prepare(`INSERT INTO accounts (email, first_name, last_name, company, job_title, phone, country, password_hash, kvkk_at, marketing, last_login_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(e, fields.first, fields.last, fields.company, fields.jobTitle, fields.phone, fields.country, hashPassword(body.password), iso(), body.marketing === true ? 1 : 0, iso());
  const accountId = Number(info.lastInsertRowid);
  event('register', req, { emailValue: e, accountId });
  startSession(req, res, { kind: 'account', accountId });
}

/** Ortak giriş: hatalar tek tip ("e-posta ya da şifre yanlış"); kullanıcı yoksa da aynı süre harcanır. */
export function login(req, res, body, { adminOnly = false } = {}) {
  const raw = String(body.email ?? '').trim().toLowerCase();
  if (!loginByIp.take(req.ip) || loginByEmail.blocked(raw)) {
    throw new HttpError(429, 'Çok fazla deneme. 15 dakika sonra tekrar deneyin.');
  }
  const account = raw ? udb.prepare('SELECT * FROM accounts WHERE email = ?').get(raw) : null;
  const password = String(body.password ?? '').slice(0, 200);
  let ok = false;
  if (account?.password_hash && !account.disabled_at) {
    const result = verifyPassword(password, account.password_hash);
    ok = result.ok;
    if (result.upgrade) udb.prepare('UPDATE accounts SET password_hash = ? WHERE id = ?').run(hashPassword(password), account.id);
  } else {
    burnPasswordTime(password);
  }
  if (ok && adminOnly && account.role !== 'admin') ok = false;
  if (!ok) {
    loginByEmail.take(raw);
    event('login_fail', req, { emailValue: raw.slice(0, 254), accountId: account?.id ?? null });
    throw new HttpError(401, 'E-posta ya da şifre yanlış');
  }
  loginByEmail.reset(raw);
  udb.prepare('UPDATE accounts SET last_login_at = ? WHERE id = ?').run(iso(), account.id);
  event('login', req, { emailValue: account.email, accountId: account.id });
  startSession(req, res, { kind: 'account', accountId: account.id });
  return account;
}

export function guest(req, res, body) {
  if (!guestByIp.take(req.ip)) throw new HttpError(429, 'Çok fazla deneme. Bir süre sonra tekrar deneyin.');
  const e = email(body.email);
  if (body.kvkk !== true) throw new HttpError(400, 'Devam etmek için aydınlatma metnini onaylayın');
  const guestName = name(body.name, 'Ad soyad', { required: false, max: 100 });
  const company = name(body.company, 'Şirket', { required: false, max: 120 });
  const existing = udb.prepare('SELECT id FROM guests WHERE email = ?').get(e);
  let guestId;
  if (existing) {
    udb.prepare('UPDATE guests SET visits = visits + 1, last_seen_at = ?, name = coalesce(?, name), company = coalesce(?, company) WHERE id = ?').run(iso(), guestName, company, existing.id);
    guestId = existing.id;
  } else {
    guestId = Number(udb.prepare('INSERT INTO guests (email, name, company, kvkk_at) VALUES (?, ?, ?, ?)').run(e, guestName, company, iso()).lastInsertRowid);
  }
  event('guest', req, { emailValue: e });
  startSession(req, res, { kind: 'guest', guestId });
}

export function updateProfile(req, body) {
  const v = viewerOf(req);
  if (!isMember(v)) throw new HttpError(401, 'Giriş gerekli');
  if (body.kvkk !== undefined && body.kvkk !== true) throw new HttpError(400, 'Aydınlatma metni onayı geri alınamaz');
  udb.prepare(`UPDATE accounts SET first_name = ?, last_name = ?, company = ?, job_title = ?, phone = ?, country = ?,
      marketing = ?, kvkk_at = coalesce(kvkk_at, ?) WHERE id = ?`)
    .run(name(body.firstName, 'Ad'), name(body.lastName, 'Soyad'), name(body.company, 'Şirket', { required: false, max: 120 }),
      name(body.jobTitle, 'Görev', { required: false, max: 80 }), phone(body.phone), name(body.country, 'Ülke', { required: false, max: 60 }),
      body.marketing === true ? 1 : 0, body.kvkk === true ? iso() : null, v.account.id);
  req.viewer = undefined;
}

export function changePassword(req, res, body) {
  const v = viewerOf(req);
  if (!isMember(v)) throw new HttpError(401, 'Giriş gerekli');
  const row = udb.prepare('SELECT * FROM accounts WHERE id = ?').get(v.account.id);
  if (row.password_hash && !verifyPassword(String(body.currentPassword ?? ''), row.password_hash).ok) throw new HttpError(400, 'Mevcut şifre yanlış');
  const problem = passwordProblem(body.password, row.email);
  if (problem) throw new HttpError(400, problem);
  udb.prepare('UPDATE accounts SET password_hash = ? WHERE id = ?').run(hashPassword(body.password), row.id);
  // Şifre değişince diğer bütün oturumlar kapanır; bu cihazda yeni jeton verilir.
  udb.prepare('DELETE FROM sessions WHERE account_id = ?').run(row.id);
  startSession(req, res, { kind: 'account', accountId: row.id });
}

// ── Kaydedilenler (yalnızca üyeler) ─────────────────────────────────────────

export function savedList(req) {
  const v = viewerOf(req);
  if (!isMember(v)) throw new HttpError(401, 'Kaydedilenler için giriş yapın');
  return udb.prepare('SELECT item_json, saved_at FROM saved WHERE account_id = ? ORDER BY saved_at DESC LIMIT 500').all(v.account.id)
    .map((r) => ({ ...JSON.parse(r.item_json), savedAt: r.saved_at }));
}

export function savedPut(req, docId, item) {
  const v = viewerOf(req);
  if (!isMember(v)) throw new HttpError(401, 'Kaydedilenler için giriş yapın');
  if (!/^[a-zA-Z0-9_-]{1,40}$/.test(docId)) throw new HttpError(400, 'Belge kimliği geçersiz');
  const json = JSON.stringify(item ?? {});
  if (json.length > 4000) throw new HttpError(400, 'Kayıt çok büyük');
  const count = udb.prepare('SELECT count(*) AS n FROM saved WHERE account_id = ?').get(v.account.id).n;
  if (count >= 500) throw new HttpError(400, 'En fazla 500 belge kaydedilebilir');
  udb.prepare('INSERT INTO saved (account_id, doc_id, item_json) VALUES (?, ?, ?) ON CONFLICT(account_id, doc_id) DO UPDATE SET item_json = excluded.item_json')
    .run(v.account.id, docId, json);
}

export function savedDelete(req, docId) {
  const v = viewerOf(req);
  if (!isMember(v)) throw new HttpError(401, 'Kaydedilenler için giriş yapın');
  udb.prepare('DELETE FROM saved WHERE account_id = ? AND doc_id = ?').run(v.account.id, String(docId));
}

// ── Google ile giriş (OAuth 2.0 yetkilendirme kodu + PKCE + state) ─────────

export const googleEnabled = () => !!(config.google.clientId && config.google.clientSecret);
const redirectUri = (req) => `${config.publicUrl || `${req.protocol}://${req.get('host')}`}/api/account/google/callback`;
const safeReturn = (value) => (typeof value === 'string' && /^\/(?!\/)[^\s\\]*$/.test(value) ? value.slice(0, 300) : '/');

export function googleStart(req, res) {
  if (!googleEnabled()) throw new HttpError(404, 'Google ile giriş etkin değil');
  const state = newToken();
  const verifier = newToken();
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  setCookie(res, OAUTH_COOKIE, JSON.stringify({ state, verifier, back: safeReturn(req.query.donus) }), { maxAge: 600, sameSite: 'Lax' });
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: config.google.clientId, redirect_uri: redirectUri(req), response_type: 'code', scope: 'openid email profile',
    state, code_challenge: challenge, code_challenge_method: 'S256', prompt: 'select_account',
  }).toString();
  res.redirect(302, url.href);
}

export async function googleCallback(req, res) {
  let saved = null;
  try { saved = JSON.parse(readCookie(req, OAUTH_COOKIE) ?? 'null'); } catch { saved = null; }
  clearCookie(res, OAUTH_COOKIE);
  const fail = (code) => res.redirect(302, `/giris?hata=${code}`);
  if (!googleEnabled() || !saved?.state || typeof req.query.state !== 'string' || typeof req.query.code !== 'string') return fail('google');
  const a = Buffer.from(saved.state);
  const b = Buffer.from(req.query.state);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return fail('google');
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: req.query.code, client_id: config.google.clientId, client_secret: config.google.clientSecret,
      redirect_uri: redirectUri(req), grant_type: 'authorization_code', code_verifier: saved.verifier,
    }),
  });
  if (!tokenRes.ok) return fail('google');
  const { access_token: accessToken } = await tokenRes.json();
  // Kullanıcı bilgisi doğrudan Google'dan (TLS) alınır; kimlik jetonunu istemciden kabul etmeyiz.
  const infoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!infoRes.ok) return fail('google');
  const info = await infoRes.json();
  if (!info.sub || !info.email || info.email_verified !== true) return fail('google-dogrulanmamis');
  const e = String(info.email).toLowerCase();
  let account = udb.prepare('SELECT * FROM accounts WHERE google_sub = ?').get(String(info.sub))
    ?? udb.prepare('SELECT * FROM accounts WHERE email = ?').get(e);
  if (account?.disabled_at) return fail('hesap');
  if (account && !account.google_sub) udb.prepare('UPDATE accounts SET google_sub = ? WHERE id = ?').run(String(info.sub), account.id);
  if (!account) {
    const id = Number(udb.prepare('INSERT INTO accounts (email, first_name, last_name, google_sub) VALUES (?, ?, ?, ?)')
      .run(e, String(info.given_name ?? '').slice(0, 60) || null, String(info.family_name ?? '').slice(0, 60) || null, String(info.sub)).lastInsertRowid);
    account = udb.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
    event('register_google', req, { emailValue: e, accountId: id });
  }
  udb.prepare('UPDATE accounts SET last_login_at = ? WHERE id = ?').run(iso(), account.id);
  event('login_google', req, { emailValue: e, accountId: account.id });
  startSession(req, res, { kind: 'account', accountId: account.id });
  // Profil eksikse (ilk Google girişi: şirket, KVKK onayı) tamamlama adımına gider.
  const complete = account.first_name && account.last_name && account.kvkk_at;
  res.redirect(302, complete ? safeReturn(saved.back) : `/giris/tamamla?donus=${encodeURIComponent(safeReturn(saved.back))}`);
}

// ── Yönetici hesapları (yönetim paneli → Hesap) ─────────────────────────────

export function listAdmins() {
  return udb.prepare(`SELECT id, email, first_name, last_name, created_at, last_login_at FROM accounts WHERE role = 'admin' ORDER BY created_at, id`).all()
    .map((u) => ({ id: u.id, email: u.email, name: [u.first_name, u.last_name].filter(Boolean).join(' ') || null, createdAt: u.created_at, lastLogin: u.last_login_at }));
}

export function stats() {
  const since = iso(Date.now() - 30 * DAY);
  return {
    members: udb.prepare("SELECT count(*) AS n FROM accounts WHERE role = 'member'").get().n,
    guests: udb.prepare('SELECT count(*) AS n FROM guests').get().n,
    logins30: udb.prepare("SELECT count(*) AS n FROM auth_events WHERE kind IN ('login', 'login_google') AND at >= ?").get(since).n,
    failed30: udb.prepare("SELECT count(*) AS n FROM auth_events WHERE kind = 'login_fail' AND at >= ?").get(since).n,
  };
}
