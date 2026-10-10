// Güvenlik yardımcıları: şifre özeti, oturum jetonu, çerezler, hız sınırı, köken (CSRF) denetimi
// ve güvenlik başlıkları. Harici bağımlılık yok; yalnızca node:crypto.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

// ── Şifreler ────────────────────────────────────────────────────────────────
// scrypt (bellek-yoğun): N=2^15, r=8, p=1 → her deneme ~32 MB ve onlarca ms. Biçim parametreleri
// taşır; eski "scrypt$tuz$özet" biçimi (N=2^14) doğrulanır ve girişte yeni biçime yükseltilir.
const SCRYPT = { N: 32768, r: 8, p: 1, maxmem: 96 * 1024 * 1024 };

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = crypto.scryptSync(String(password).normalize('NFKC'), salt, 32, SCRYPT).toString('hex');
  return `scrypt2$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt}$${key}`;
}

/** Sabit zamanlı karşılaştırma. `upgrade` true ise özet eski biçimdedir, yeniden üretilmeli. */
export function verifyPassword(password, stored) {
  const parts = String(stored ?? '').split('$');
  let key;
  let expected;
  let upgrade = false;
  try {
    if (parts[0] === 'scrypt2' && parts.length === 6) {
      const [, N, r, p, salt, hex] = parts;
      expected = Buffer.from(hex, 'hex');
      key = crypto.scryptSync(String(password).normalize('NFKC'), salt, expected.length, { N: Number(N), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem });
    } else if (parts[0] === 'scrypt' && parts.length === 3) {
      const [, salt, hex] = parts;
      expected = Buffer.from(hex, 'hex');
      key = crypto.scryptSync(String(password), salt, expected.length);
      upgrade = true;
    } else {
      return { ok: false, upgrade: false };
    }
  } catch {
    return { ok: false, upgrade: false };
  }
  const ok = key.length === expected.length && crypto.timingSafeEqual(key, expected);
  return { ok, upgrade: ok && upgrade };
}

/** Kullanıcı yokken de aynı süre harcanır: e-postanın kayıtlı olup olmadığı zamanlamadan anlaşılmaz. */
const DUMMY_HASH = hashPassword(crypto.randomBytes(16).toString('hex'));
export function burnPasswordTime(password) {
  verifyPassword(password, DUMMY_HASH);
}

const COMMON = new Set(['123456789', '1234567890', 'qwertyuiop', 'password', 'password1', 'sifre123', 'şifre123', 'barmaksan', 'barmaksan1', 'ugurpromilling', '1q2w3e4r5t', 'qwerty123', 'abc123456', '1234512345', '11111111', '00000000']);
/** Şifre kuralı: 10–200 karakter, harf + rakam, e-postanın kendisini ya da yaygın şifreleri içermez. */
export function passwordProblem(password, email = '') {
  const p = String(password ?? '');
  if (p.length < 10) return 'Şifre en az 10 karakter olmalı';
  if (p.length > 200) return 'Şifre çok uzun';
  if (!/\p{L}/u.test(p) || !/\d/.test(p)) return 'Şifre en az bir harf ve bir rakam içermeli';
  const local = String(email).split('@')[0].toLocaleLowerCase('tr');
  if (local.length >= 4 && p.toLocaleLowerCase('tr').includes(local)) return 'Şifre e-posta adresinizi içermemeli';
  if (COMMON.has(p.toLocaleLowerCase('tr'))) return 'Bu şifre çok yaygın; başka bir şifre seçin';
  return null;
}

// ── Jetonlar ve çerezler ────────────────────────────────────────────────────

/** 256 bit rastgele, opak jeton. İçinde hiçbir bilgi yok: çözülecek bir şey (JWT gibi) yoktur. */
export const newToken = () => crypto.randomBytes(32).toString('base64url');
export const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
export const ipHash = (ip) => sha256(`${ip}|${config.dataDir}`).slice(0, 24);

export const SESSION_COOKIE = '__Host-bk_session';
export const OAUTH_COOKIE = '__Host-bk_oauth';

export function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) {
      try { return decodeURIComponent(part.slice(i + 1).trim()); } catch { return null; }
    }
  }
  return null;
}

/**
 * __Host- öneki: yalnızca HTTPS'te (localhost istisna), alan adı ve yol sabit (Path=/); alt alan
 * adları çerezi ezemez. HttpOnly: sayfa betikleri okuyamaz. SameSite=Strict: başka siteden gelen
 * isteklere eklenmez (CSRF). OAuth dönüşü için kısa ömürlü çerez Lax olmak zorunda.
 */
export function setCookie(res, name, value, { maxAge, sameSite = 'Strict' }) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'Secure', `SameSite=${sameSite}`, `Max-Age=${Math.max(0, Math.floor(maxAge))}`];
  const prev = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', [...(Array.isArray(prev) ? prev : prev ? [String(prev)] : []), parts.join('; ')]);
}
export const clearCookie = (res, name) => setCookie(res, name, '', { maxAge: 0 });

// ── Hız sınırı ──────────────────────────────────────────────────────────────
// Kayan pencere; anahtar başına zaman damgaları. Bellekte (tek süreç), dakikada bir temizlenir.

export class RateLimit {
  constructor(limit, windowMs) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.hits = new Map();
    setInterval(() => this.sweep(), 60_000).unref();
  }
  /** Sınırı aşmadıysa sayar ve true döner. */
  take(key) {
    const now = Date.now();
    const list = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (list.length >= this.limit) { this.hits.set(key, list); return false; }
    list.push(now);
    this.hits.set(key, list);
    return true;
  }
  blocked(key) {
    const now = Date.now();
    return (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs).length >= this.limit;
  }
  reset(key) { this.hits.delete(key); }
  sweep() {
    const now = Date.now();
    for (const [k, list] of this.hits) if (!list.some((t) => now - t < this.windowMs)) this.hits.delete(k);
  }
}

// ── Köken denetimi (CSRF) ───────────────────────────────────────────────────
// Durum değiştiren her API isteği aynı kökenden gelmeli. Tarayıcılar başka siteden gelen
// isteklerde Origin ve Sec-Fetch-Site başlıklarını değiştirilemez biçimde gönderir.

export function sameOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const site = req.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return res.status(403).json({ error: 'İstek reddedildi' });
  const origin = req.get('origin');
  if (origin) {
    let host;
    try { host = new URL(origin).host; } catch { return res.status(403).json({ error: 'İstek reddedildi' }); }
    const allowed = new Set([req.get('host'), config.publicUrl ? new URL(config.publicUrl).host : null].filter(Boolean));
    if (!allowed.has(host)) return res.status(403).json({ error: 'İstek reddedildi' });
  }
  next();
}

// ── Güvenlik başlıkları ─────────────────────────────────────────────────────

/** index.html'deki satır içi betiklerin özetleri: CSP 'unsafe-inline' olmadan yalnızca onları çalıştırır. */
function inlineScriptHashes() {
  try {
    // HTML ayrıştırıcısı CRLF ve CR satır sonlarını LF'ye çevirir; CSP aynı metni özetlemeli.
    const html = fs.readFileSync(path.join(config.webDist, 'index.html'), 'utf8').replace(/\r\n?/g, '\n');
    return [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
      .map((m) => `'sha256-${crypto.createHash('sha256').update(m[1]).digest('base64')}'`);
  } catch {
    return [];
  }
}

let csp = null;
export function contentSecurityPolicy() {
  csp ??= [
    "default-src 'self'",
    `script-src 'self' ${inlineScriptHashes().join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "font-src 'self'",
    "connect-src 'self'",
    'frame-src https://www.youtube-nocookie.com',
    "frame-ancestors 'self'",
    "form-action 'self' https://accounts.google.com",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ');
  return csp;
}

export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()');
  if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  next();
}
