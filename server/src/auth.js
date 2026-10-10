// Yönetici hesapları (users.db → accounts, role = 'admin'). Giriş/oturum accounts.js'te; burada
// yönetim panelindeki "Hesap" ekranının işlemleri ve kurtarma yolu var.
import { udb } from './users-db.js';
import { HttpError } from './commands.js';
import { hashPassword, passwordProblem, sha256, verifyPassword } from './security.js';
import { listAdmins } from './accounts.js';

// İlk yönetici: hiç yönetici yoksa ortamdan (ADMIN_EMAIL + ADMIN_PASSWORD_HASH) ya da varsayılandan.
// ADMIN_PASSWORD_HASH verilirse o hesabın şifresi ona eşitlenir (şifre unutulduğunda kurtarma).
const DEFAULT_EMAIL = 'salihuysal@ugurpromilling.com';
const DEFAULT_HASH = 'scrypt$adc499565216d0f189ab58aa49983e6d$4148cfce9290baccf1df700e2a8118ee13704c5538eba12138660dea0f58723c';
const adminEmail = (process.env.ADMIN_EMAIL || DEFAULT_EMAIL).toLowerCase();
if (!udb.prepare("SELECT count(*) AS n FROM accounts WHERE role = 'admin'").get().n) {
  udb.prepare(`INSERT INTO accounts (email, role, first_name, last_name, password_hash, kvkk_at) VALUES (?, 'admin', 'Salih', 'Uysal', ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(email) DO UPDATE SET role = 'admin'`).run(adminEmail, process.env.ADMIN_PASSWORD_HASH || DEFAULT_HASH);
} else if (process.env.ADMIN_PASSWORD_HASH) {
  udb.prepare("UPDATE accounts SET password_hash = ?, role = 'admin' WHERE email = ? AND coalesce(password_hash, '') <> ?").run(process.env.ADMIN_PASSWORD_HASH, adminEmail, process.env.ADMIN_PASSWORD_HASH);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function checkEmail(email, exceptId = null) {
  const e = String(email ?? '').trim().toLowerCase();
  if (!EMAIL.test(e) || e.length > 254) throw new HttpError(400, 'Geçerli bir e-posta girin');
  const other = udb.prepare('SELECT id FROM accounts WHERE email = ?').get(e);
  if (other && other.id !== exceptId) throw new HttpError(409, 'Bu e-postayla bir hesap zaten var');
  return e;
}
const splitName = (name) => {
  const [first, ...rest] = String(name ?? '').trim().replace(/\s+/g, ' ').slice(0, 80).split(' ');
  return [first || null, rest.join(' ') || null];
};

export const listUsers = listAdmins;

export function createUser({ email, name, password }) {
  const e = checkEmail(email);
  const problem = passwordProblem(password, e);
  if (problem) throw new HttpError(400, problem);
  const [first, last] = splitName(name);
  const info = udb.prepare(`INSERT INTO accounts (email, role, first_name, last_name, password_hash, kvkk_at) VALUES (?, 'admin', ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`)
    .run(e, first, last, hashPassword(password));
  return { id: Number(info.lastInsertRowid) };
}

/** actor: işlemi yapan yönetici; currentTokenHash: kendi şifresini değiştirirken açık kalacak oturum. */
export function updateUser(id, patch, actor, currentTokenHash) {
  const user = udb.prepare("SELECT * FROM accounts WHERE id = ? AND role = 'admin'").get(Number(id));
  if (!user) throw new HttpError(404, 'Kullanıcı bulunamadı');
  const self = actor && actor.id === user.id;
  udb.transaction(() => {
    if (patch.name !== undefined) {
      const [first, last] = splitName(patch.name);
      udb.prepare('UPDATE accounts SET first_name = ?, last_name = ? WHERE id = ?').run(first, last, user.id);
    }
    if (patch.email !== undefined) udb.prepare('UPDATE accounts SET email = ? WHERE id = ?').run(checkEmail(patch.email, user.id), user.id);
    if (patch.password !== undefined) {
      const problem = passwordProblem(patch.password, user.email);
      if (problem) throw new HttpError(400, problem);
      if (self && !verifyPassword(String(patch.currentPassword ?? ''), user.password_hash).ok) throw new HttpError(400, 'Mevcut şifre yanlış');
      udb.prepare('UPDATE accounts SET password_hash = ? WHERE id = ?').run(hashPassword(patch.password), user.id);
      // Şifre değişince o hesabın diğer oturumları kapanır.
      udb.prepare('DELETE FROM sessions WHERE account_id = ? AND token_hash <> ?').run(user.id, self && currentTokenHash ? currentTokenHash : '');
    }
  })();
  return { id: user.id };
}

export function deleteUser(id, actor) {
  const user = udb.prepare("SELECT id FROM accounts WHERE id = ? AND role = 'admin'").get(Number(id));
  if (!user) throw new HttpError(404, 'Kullanıcı bulunamadı');
  if (actor && actor.id === user.id) throw new HttpError(400, 'Kendi hesabınızı silemezsiniz');
  if (udb.prepare("SELECT count(*) AS n FROM accounts WHERE role = 'admin'").get().n <= 1) throw new HttpError(400, 'Son yönetici silinemez');
  udb.prepare('DELETE FROM accounts WHERE id = ?').run(user.id);
  return { id: user.id };
}

export { sha256 };
