// Hesap: kendi adınız, e-postanız ve şifreniz; yönetime giriş yapabilen diğer kişiler.
// Bütün kullanıcılar yöneticidir. Kendi şifreniz mevcut şifreyle değişir; başkasının
// şifresi (unuttuysa) buradan yenilenir. Şifre değişince o kişinin diğer oturumları kapanır.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { Spinner } from '../components/ui';
import { api, type AdminUser } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { formatRelative } from '../lib/format';
import { ConfirmButton, Dialog, EmptyNote, PageHead, useRun } from './shared';
import a from './admin.module.css';

export default function AdminAccount() {
  const { lang } = useI18n();
  const tr = lang === 'tr';
  const me = useQuery({ queryKey: ['admin', 'me'], queryFn: api.me });
  const users = useQuery({ queryKey: ['admin', 'users'], queryFn: api.adminUsers });
  const [adding, setAdding] = useState(false);
  const [resetting, setResetting] = useState<AdminUser | null>(null);
  const { run, busy, error } = useRun();

  return (
    <div className={a.page}>
      <PageHead
        title={tr ? 'Hesap' : 'Account'}
        lead={tr ? 'Hesap bilgileriniz ve yönetime giriş yapabilen kişiler.' : 'Your account and the people who can sign in to administration.'}
      />

      {me.data === null && (
        <p className={a.warn}>
          {tr
            ? 'Sunucunun düzenleme anahtarıyla giriş yaptınız. Hesap ayarları için çıkış yapıp e-posta ve şifreyle girin.'
            : 'You are signed in with the server’s editor key. Sign in with email and password to manage your account.'}
        </p>
      )}

      {me.data && <MyAccount me={me.data} />}

      <section className={a.card} style={{ marginTop: 16 }}>
        <div className={a.cardHead}>
          <h2>{tr ? 'Kullanıcılar' : 'Users'}</h2>
          <button className={a.textBtn} onClick={() => setAdding(true)}><Icon name="plus" size={14} />{tr ? 'Kullanıcı ekle' : 'Add user'}</button>
        </div>
        <p className={a.cardLead}>{tr ? 'Herkes belge yükleyebilir, düzenleyebilir ve kullanıcı ekleyebilir. Hareketlerde adlarıyla görünürler.' : 'Everyone can upload, edit and add users. Their names appear in the activity log.'}</p>
        {!users.data ? (
          <div className={a.skelList}>{Array.from({ length: 2 }, (_, i) => <span key={i} className="skeleton" style={{ ['--i' as string]: i }} />)}</div>
        ) : users.data.length === 0 ? (
          <EmptyNote>{tr ? 'Kullanıcı yok.' : 'No users.'}</EmptyNote>
        ) : (
          <ul className={a.userList}>
            {users.data.map((u) => {
              const self = me.data?.id === u.id;
              return (
                <li key={u.id}>
                  <span className={a.userAvatar} aria-hidden="true">{(u.name || u.email).trim().charAt(0).toLocaleUpperCase('tr')}</span>
                  <span className={a.docText}>
                    <span className={a.docTitle}>{u.name || u.email}{self && <span className={a.typeShort}>{tr ? 'Siz' : 'You'}</span>}</span>
                    <span className={a.docFolder}>
                      {[u.name ? u.email : null, u.lastLogin ? `${tr ? 'Son giriş' : 'Last sign-in'} ${formatRelative(u.lastLogin, lang)}` : (tr ? 'Henüz giriş yapmadı' : 'Never signed in')].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className={a.rowActions}>
                    {!self && <button className={a.textBtn} onClick={() => setResetting(u)}>{tr ? 'Şifreyi yenile' : 'Reset password'}</button>}
                    {!self && (
                      <ConfirmButton
                        className={a.textBtn}
                        label={tr ? 'Kaldır' : 'Remove'}
                        confirm={tr ? 'Kaldırmayı onayla' : 'Confirm remove'}
                        busy={busy === `del-${u.id}`}
                        onConfirm={() => run(`del-${u.id}`, () => api.deleteUser(u.id), tr ? 'Kullanıcı kaldırıldı' : 'User removed')}
                      />
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {error && <p className={a.error} role="alert">{error}</p>}
      </section>

      <AddUserDialog open={adding} onClose={() => setAdding(false)} />
      <ResetDialog user={resetting} onClose={() => setResetting(null)} />
    </div>
  );
}

function MyAccount({ me }: { me: { id: number; email: string; name: string | null } }) {
  const { lang } = useI18n();
  const tr = lang === 'tr';
  const profile = useRun();
  const pass = useRun();
  const [name, setName] = useState(me.name ?? '');
  const [email, setEmail] = useState(me.email);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const profileDirty = name !== (me.name ?? '') || email !== me.email;
  const mismatch = !!repeat && next !== repeat;
  const passReady = current && next.length >= 8 && next === repeat;

  return (
    <div className={a.split} style={{ marginTop: 0 }}>
      <section className={a.card}>
        <div className={a.cardHead}><h2>{tr ? 'Hesabım' : 'My account'}</h2></div>
        <div className={a.form} style={{ marginTop: 14 }}>
          <label className={a.field}>
            <span>{tr ? 'Ad soyad' : 'Name'}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </label>
          <label className={a.field}>
            <span>{tr ? 'E-posta' : 'Email'}</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </label>
          {profile.error && <p className={a.error} role="alert">{profile.error}</p>}
          <div className={a.formFoot}>
            <span className={a.hint}>{tr ? 'Yüklediğiniz belgelerde bu ad görünür.' : 'This name appears on your uploads.'}</span>
            <button className={a.primary} disabled={!profileDirty || !name.trim() || !!profile.busy} onClick={() => profile.run('save', () => api.updateUser(me.id, { name, email }), tr ? 'Kaydedildi' : 'Saved')}>
              {profile.busy ? <Spinner size={14} /> : (tr ? 'Kaydet' : 'Save')}
            </button>
          </div>
        </div>
      </section>

      <section className={a.card}>
        <div className={a.cardHead}><h2>{tr ? 'Şifre' : 'Password'}</h2></div>
        <form
          className={a.form}
          style={{ marginTop: 14 }}
          onSubmit={async (e) => {
            e.preventDefault();
            if (!passReady) return;
            const ok = await pass.run('save', () => api.updateUser(me.id, { password: next, currentPassword: current }), tr ? 'Şifre değiştirildi' : 'Password changed');
            if (ok) { setCurrent(''); setNext(''); setRepeat(''); }
          }}
        >
          <input type="text" autoComplete="username" value={me.email} readOnly hidden />
          <label className={a.field}>
            <span>{tr ? 'Mevcut şifre' : 'Current password'}</span>
            <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
          </label>
          <div className={a.fieldRow}>
            <label className={a.field}>
              <span>{tr ? 'Yeni şifre' : 'New password'}</span>
              <input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
            </label>
            <label className={a.field}>
              <span>{tr ? 'Yeni şifre (tekrar)' : 'Repeat new password'}</span>
              <input type="password" value={repeat} onChange={(e) => setRepeat(e.target.value)} autoComplete="new-password" aria-invalid={mismatch} />
            </label>
          </div>
          {mismatch && <p className={a.error}>{tr ? 'Yeni şifreler aynı değil.' : 'The new passwords don’t match.'}</p>}
          {pass.error && <p className={a.error} role="alert">{pass.error}</p>}
          <div className={a.formFoot}>
            <span className={a.hint}>{tr ? 'En az 8 karakter. Diğer cihazlardaki oturumlar kapanır.' : 'At least 8 characters. Other sessions are signed out.'}</span>
            <button className={a.primary} type="submit" disabled={!passReady || !!pass.busy}>
              {pass.busy ? <Spinner size={14} /> : (tr ? 'Şifreyi değiştir' : 'Change password')}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function AddUserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lang } = useI18n();
  const tr = lang === 'tr';
  const { run, busy, error, setError } = useRun();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const close = () => { setName(''); setEmail(''); setPassword(''); setError(null); onClose(); };
  const save = async () => {
    if (await run('save', () => api.createUser({ name, email, password }), tr ? 'Kullanıcı eklendi' : 'User added')) close();
  };
  return (
    <Dialog
      open={open}
      onClose={close}
      title={tr ? 'Kullanıcı ekle' : 'Add user'}
      footer={
        <>
          <span style={{ flex: 1 }} />
          <button className={a.secondary} onClick={close}>{tr ? 'Vazgeç' : 'Cancel'}</button>
          <button className={a.primary} onClick={save} disabled={!!busy || !email.trim() || password.length < 8}>{busy ? <Spinner size={14} /> : (tr ? 'Ekle' : 'Add')}</button>
        </>
      }
    >
      <div className={a.form}>
        <label className={a.field}>
          <span>{tr ? 'Ad soyad' : 'Name'}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus autoComplete="off" />
        </label>
        <label className={a.field}>
          <span>{tr ? 'E-posta' : 'Email'}</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
        </label>
        <label className={a.field}>
          <span>{tr ? 'İlk şifre' : 'Initial password'}</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </label>
        <p className={a.hint}>{tr ? 'En az 8 karakter. Kişi ilk girişten sonra Hesap ekranından değiştirebilir.' : 'At least 8 characters. They can change it from Account after signing in.'}</p>
        {error && <p className={a.error} role="alert">{error}</p>}
      </div>
    </Dialog>
  );
}

function ResetDialog({ user, onClose }: { user: AdminUser | null; onClose: () => void }) {
  const { lang } = useI18n();
  const tr = lang === 'tr';
  const { run, busy, error, setError } = useRun();
  const [password, setPassword] = useState('');
  const close = () => { setPassword(''); setError(null); onClose(); };
  return (
    <Dialog
      open={!!user}
      onClose={close}
      title={tr ? 'Şifreyi yenile' : 'Reset password'}
      footer={
        <>
          <span style={{ flex: 1 }} />
          <button className={a.secondary} onClick={close}>{tr ? 'Vazgeç' : 'Cancel'}</button>
          <button
            className={a.primary}
            disabled={!!busy || password.length < 8}
            onClick={async () => { if (user && await run('save', () => api.updateUser(user.id, { password }), tr ? 'Şifre yenilendi' : 'Password reset')) close(); }}
          >
            {busy ? <Spinner size={14} /> : (tr ? 'Yenile' : 'Reset')}
          </button>
        </>
      }
    >
      <div className={a.form}>
        <p className={a.hint}>{user ? `${user.name || user.email} · ${user.email}` : ''}</p>
        <label className={a.field}>
          <span>{tr ? 'Yeni şifre' : 'New password'}</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus autoComplete="new-password" />
        </label>
        <p className={a.hint}>{tr ? 'Kişinin açık oturumları kapanır; yeni şifreyle girer.' : 'Their open sessions are signed out.'}</p>
        {error && <p className={a.error} role="alert">{error}</p>}
      </div>
    </Dialog>
  );
}
