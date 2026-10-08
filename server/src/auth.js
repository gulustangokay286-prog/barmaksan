// Yönetim girişi: e-posta + şifre. Başarılı girişte rastgele bir oturum jetonu verilir;
// istemci bunu X-Editor-Key başlığıyla gönderir (eski düzenleme anahtarı da geçerli kalır).
import crypto from 'node:crypto';
import { db } from './db.js';
import { HttpError } from './commands.js';

const SESSION_DAYS = 30;

// İlk kullanıcı: ortamdan değiştirilebilir (ADMIN_EMAIL, ADMIN_PASSWORD_HASH).
const DEFAULT_EMAIL = 'salihuysal@ugurpromilling.com';
const DEFAULT_HASH = 'scrypt$adc499565216d0f189ab58aa49983e6d$4148cfce9290baccf1df700e2a8118ee13704c5538eba12138660dea0f58723c';

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt$${salt}$${crypto.scryptSync(password, salt, 32).toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [algo, salt, hex] = String(stored).split('$');
  if (algo !== 'scrypt' || !salt || !hex) return false;
  const a = crypto.scryptSync(password, salt, 32);
  const b = Buffer.from(hex, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

// Hiç kullanıcı yoksa ilk yöneticiyi oluştur. Sonrası yönetim panelinden (Hesap) yönetilir;
// silinen bir hesap yeniden başlatınca geri gelmez. ADMIN_PASSWORD_HASH verilirse o hesabın
// şifresi ona eşitlenir (şifre unutulduğunda kurtarma yolu).
const email = process.env.ADMIN_EMAIL || DEFAULT_EMAIL;
const hash = process.env.ADMIN_PASSWORD_HASH || DEFAULT_HASH;
if (!db.prepare('SELECT count(*) AS n FROM users').get().n) {
  db.prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)').run(email, 'Salih Uysal', hash);
} else if (process.env.ADMIN_PASSWORD_HASH) {
  db.prepare('UPDATE users SET password_hash = ? WHERE email = ? AND password_hash <> ?').run(hash, email, hash);
}

export function login(emailIn, password) {
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(emailIn ?? '').trim());
  // Kullanıcı yoksa da aynı süre harca (e-posta tahmini zamanlamadan anlaşılmasın).
  const ok = user ? verifyPassword(String(password ?? ''), user.password_hash) : (verifyPassword('x', DEFAULT_HASH), false);
  if (!ok) return null;
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(sha(token), user.id, expires);
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString());
  return { token, user: { email: user.email, name: user.name } };
}

/** Jeton geçerliyse kullanıcıyı döndürür. */
export function sessionUser(token) {
  if (!token || typeof token !== 'string' || token.length < 32) return null;
  const row = db.prepare(`SELECT u.id, u.email, u.name FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?`).get(sha(token), new Date().toISOString());
  return row ?? null;
}

export function logout(token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(String(token)));
}

// ── Kullanıcılar ────────────────────────────────────────────────────────────
// Bütün kullanıcılar yöneticidir. Kendi hesabının şifresi mevcut şifreyle değişir;
// başka birinin şifresi (unuttuysa) doğrudan yenilenebilir.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function checkPassword(password) {
  if (typeof password !== 'string' || password.length < 8) throw new HttpError(400, 'Şifre en az 8 karakter olmalı');
  if (password.length > 200) throw new HttpError(400, 'Şifre çok uzun');
}

function checkEmail(email, exceptId = null) {
  const e = String(email ?? '').trim();
  if (!EMAIL.test(e)) throw new HttpError(400, 'Geçerli bir e-posta girin');
  const other = db.prepare('SELECT id FROM users WHERE email = ?').get(e);
  if (other && other.id !== exceptId) throw new HttpError(409, 'Bu e-postayla bir kullanıcı zaten var');
  return e;
}

export function listUsers() {
  return db.prepare(`
    SELECT u.id, u.email, u.name, u.created_at,
           (SELECT max(s.created_at) FROM sessions s WHERE s.user_id = u.id) AS last_login
    FROM users u ORDER BY u.created_at, u.id`).all()
    .map((u) => ({ id: u.id, email: u.email, name: u.name, createdAt: u.created_at, lastLogin: u.last_login }));
}

export function createUser({ email, name, password }) {
  const e = checkEmail(email);
  checkPassword(password);
  const info = db.prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)')
    .run(e, String(name ?? '').trim().slice(0, 80) || null, hashPassword(password));
  return { id: Number(info.lastInsertRowid) };
}

/** actor: işlemi yapan kullanıcı; currentToken: kendi şifresini değiştirirken açık kalacak oturum. */
export function updateUser(id, patch, actor, currentToken) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(id));
  if (!user) throw new HttpError(404, 'Kullanıcı bulunamadı');
  const self = actor && actor.id === user.id;
  db.transaction(() => {
    if (patch.name !== undefined) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(String(patch.name ?? '').trim().slice(0, 80) || null, user.id);
    if (patch.email !== undefined) db.prepare('UPDATE users SET email = ? WHERE id = ?').run(checkEmail(patch.email, user.id), user.id);
    if (patch.password !== undefined) {
      checkPassword(patch.password);
      if (self && !verifyPassword(String(patch.currentPassword ?? ''), user.password_hash)) throw new HttpError(400, 'Mevcut şifre yanlış');
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(patch.password), user.id);
      // Şifre değişince diğer oturumlar kapanır.
      db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?').run(user.id, self && currentToken ? sha(String(currentToken)) : '');
    }
  })();
  return { id: user.id };
}

export function deleteUser(id, actor) {
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(Number(id));
  if (!user) throw new HttpError(404, 'Kullanıcı bulunamadı');
  if (actor && actor.id === user.id) throw new HttpError(400, 'Kendi hesabınızı silemezsiniz');
  if (db.prepare('SELECT count(*) AS n FROM users').get().n <= 1) throw new HttpError(400, 'Son kullanıcı silinemez');
  db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
  return { id: user.id };
}
