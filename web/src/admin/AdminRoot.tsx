// Yönetim paneli (/admin). Sitenin kabuğundan ayrı, aynı malzeme: dokulu koyu üst bar ve
// kenar çubuğu. Giriş e-posta + şifreyle yapılır; oturum jetonu bu tarayıcıda saklanır,
// "Çıkış" siler. Oturum sona ermişse giriş ekranına dönülür. Görüntüleme herkese açıktır.
import { useEffect, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink as RRNavLink, Outlet, ScrollRestoration } from 'react-router';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { Icon } from '../components/Icon';
import { BrandLockup, Spinner } from '../components/ui';
import { UploadSheet } from '../components/Editor';
import { api, editorKey } from '../lib/api';
import { Link } from '../lib/link';
import { useI18n } from '../lib/i18n';
import { useUi } from '../lib/ui';
import a from './admin.module.css';

export default function AdminRoot() {
  const { editor } = useUi();
  return (
    <MotionConfig reducedMotion="user">
      {editor ? <AdminShell /> : <AdminLogin />}
      <UploadSheet />
      <AdminToast />
      <ScrollRestoration />
    </MotionConfig>
  );
}

// ── Giriş ───────────────────────────────────────────────────────────────────

function AdminLogin() {
  const { lang } = useI18n();
  const { setEditor } = useUi();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.login(email.trim(), password);
      editorKey.set(res.token);
      setEditor(true);
    } catch (err) {
      const status = (err as { status?: number }).status;
      setError(status === 429
        ? (lang === 'tr' ? 'Çok fazla deneme. Bir dakika sonra tekrar deneyin.' : 'Too many attempts. Try again in a minute.')
        : status === 401
          ? (lang === 'tr' ? 'E-posta ya da şifre yanlış.' : 'Email or password is incorrect.')
          : (lang === 'tr' ? 'Sunucuya ulaşılamadı.' : 'Could not reach the server.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={a.login}>
      <motion.form
        className={a.loginCard}
        onSubmit={submit}
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', bounce: 0.12, duration: 0.6 }}
      >
        <BrandLockup onDark={false} />
        <h1 className={a.loginTitle}>{lang === 'tr' ? 'Yönetim' : 'Administration'}</h1>
        <p className={a.loginLead}>
          {lang === 'tr'
            ? 'Belge yüklemek, yeni sürüm yayınlamak ve kütüphaneyi düzenlemek için giriş yapın.'
            : 'Sign in to upload documents, publish versions and edit the library.'}
        </p>
        <label className={a.field}>
          <span>{lang === 'tr' ? 'E-posta' : 'Email'}</span>
          <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }} autoFocus autoComplete="username" aria-invalid={!!error} />
        </label>
        <label className={a.field} style={{ marginTop: 12 }}>
          <span>{lang === 'tr' ? 'Şifre' : 'Password'}</span>
          <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(null); }} autoComplete="current-password" aria-invalid={!!error} />
        </label>
        <AnimatePresence>
          {error && (
            <motion.p className={a.error} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="alert">
              {error}
            </motion.p>
          )}
        </AnimatePresence>
        <button className={a.primary} type="submit" disabled={!email.trim() || !password || busy}>
          {busy ? <Spinner size={15} /> : (lang === 'tr' ? 'Giriş yap' : 'Sign in')}
        </button>
        <Link to="/" className={a.backToSite}>
          <Icon name="chevronLeft" size={14} strokeWidth={1.8} />
          {lang === 'tr' ? 'Kütüphaneye dön' : 'Back to the library'}
        </Link>
      </motion.form>
    </div>
  );
}

// ── Kabuk ───────────────────────────────────────────────────────────────────

const NAV = [
  [
    { to: '/admin', end: true, icon: 'library', tr: 'Genel bakış', en: 'Overview' },
    { to: '/admin/belgeler', icon: 'sheet', tr: 'Belgeler', en: 'Documents' },
    { to: '/admin/makineler', icon: 'parts', tr: 'Makineler', en: 'Machines' },
    { to: '/admin/klasorler', icon: 'folder', tr: 'Klasörler', en: 'Folders' },
    { to: '/admin/eksikler', icon: 'info', tr: 'Eksik belgeler', en: 'Missing documents' },
  ],
  [
    { to: '/admin/ana-sayfa', icon: 'home', tr: 'Ana sayfa', en: 'Home page' },
    { to: '/admin/turler', icon: 'layers', tr: 'Belge türleri', en: 'Document types' },
    { to: '/admin/hareketler', icon: 'history', tr: 'Hareketler', en: 'Activity' },
    { to: '/admin/hesap', icon: 'user', tr: 'Hesap', en: 'Account' },
  ],
];

function AdminShell() {
  const { lang } = useI18n();
  const { setEditor, setUpload } = useUi();
  // Oturum geçerli mi? Süresi dolmuş ya da kapatılmışsa giriş ekranına dön.
  const me = useQuery({ queryKey: ['admin', 'me'], queryFn: api.me, retry: false, refetchOnWindowFocus: true });
  const expired = (me.error as { status?: number } | null)?.status === 401;
  useEffect(() => {
    if (expired) setEditor(false);
  }, [expired, setEditor]);
  return (
    <div className={a.shell}>
      <header className={a.topbar}>
        <div className={a.brandArea}>
          <Link to="/admin" className={a.brand} aria-label={lang === 'tr' ? 'Yönetim' : 'Administration'}>
            <BrandLockup />
          </Link>
        </div>
        <div className={a.topInner}>
          <span className={a.topTitle}>{lang === 'tr' ? 'Yönetim' : 'Administration'}</span>
          <div className={a.topRight}>
            {me.data && (
              <RRNavLink to="/admin/hesap" className={a.topLink}>
                <Icon name="user" size={15} />
                {me.data.name || me.data.email}
              </RRNavLink>
            )}
            <Link to="/" className={a.topLink}>
              {lang === 'tr' ? 'Kütüphaneyi aç' : 'Open library'}
              <Icon name="arrowRight" size={14} />
            </Link>
            <button className={a.topLink} onClick={() => { void api.logout().catch(() => {}).finally(() => setEditor(false)); }}>{lang === 'tr' ? 'Çıkış' : 'Sign out'}</button>
          </div>
        </div>
      </header>
      <div className={a.body}>
        <aside className={a.sidebar}>
          <nav className={a.nav}>
            {NAV.map((group, gi) => (
              <div key={gi} className={a.navGroup}>
                {group.map((n) => (
                  <RRNavLink key={n.to} to={n.to} end={'end' in n ? n.end : undefined} className={a.navLink}>
                    <Icon name={n.icon} size={18} />
                    <span>{lang === 'tr' ? n.tr : n.en}</span>
                  </RRNavLink>
                ))}
              </div>
            ))}
          </nav>
          <div className={a.sideFoot}>
            <button className={a.uploadBtn} onClick={() => setUpload({ mode: 'new', folder: '' })}>
              <Icon name="upload" size={17} />
              {lang === 'tr' ? 'Belge yükle' : 'Upload document'}
            </button>
          </div>
        </aside>
        <main className={a.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function AdminToast() {
  const { toast } = useUi();
  return (
    <div className={a.toastWrap} aria-live="polite">
      <AnimatePresence>
        {toast && (
          <motion.div key={toast} className={a.toast} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ type: 'spring', bounce: 0, duration: 0.4 }}>
            <Icon name="check" size={16} />
            <span>{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
