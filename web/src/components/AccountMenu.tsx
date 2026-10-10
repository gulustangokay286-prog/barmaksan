// Üst bardaki hesap düğmesi: girişsizken "Giriş yap"; giriş yapılmışsa baş harfler ve küçük menü
// (Kaydedilenler, yönetim paneli, çıkış). Misafirde hesap oluşturma önerisi.
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { Icon } from './Icon';
import { Link } from '../lib/link';
import { useI18n } from '../lib/i18n';
import { useUi } from '../lib/ui';
import { displayName, initials, signInHref, useSession } from '../lib/session';
import s from './AccountMenu.module.css';

export function AccountMenu() {
  const session = useSession();
  const { lang } = useI18n();
  const tr = lang === 'tr';
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const { notify } = useUi();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  if (session.loading) return <span className={s.placeholder} aria-hidden="true" />;
  if (session.me.kind === 'anonymous') {
    return (
      <Link to={signInHref('giris', pathname + search)} className={s.signIn}>
        <Icon name="user" size={17} strokeWidth={1.6} />
        <span>{tr ? 'Giriş yap' : 'Sign in'}</span>
      </Link>
    );
  }
  const me = session.me;
  const signOut = async () => {
    setOpen(false);
    await session.logout();
    notify(tr ? 'Oturum kapatıldı' : 'Signed out');
    if (pathname.startsWith('/kaydedilenler')) navigate('/');
  };
  return (
    <div ref={ref} className={s.wrap}>
      <button className={s.avatar} data-guest={me.kind === 'guest' || undefined} onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={tr ? 'Hesap' : 'Account'}>
        {initials(me)}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className={s.menu}
            role="menu"
            initial={{ opacity: 0, scale: 0.94, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -4, transition: { duration: 0.12 } }}
            transition={{ type: 'spring', bounce: 0.22, duration: 0.4 }}
          >
            <div className={s.who}>
              <span className={s.big}>{initials(me)}</span>
              <span className={s.whoText}>
                <strong>{displayName(me)}</strong>
                <small>{me.kind === 'account' ? me.account.email : (tr ? 'Misafir' : 'Guest')}{me.kind === 'account' && me.account.role === 'admin' ? (tr ? ' · Yönetici' : ' · Admin') : ''}</small>
              </span>
            </div>
            {me.kind === 'account' ? (
              <>
                <Link to="/kaydedilenler" role="menuitem" className={s.item}><Icon name="bookmark" size={17} strokeWidth={1.6} />{tr ? 'Kaydedilenler' : 'Saved'}</Link>
                {me.account.role === 'admin' && <Link to="/admin" role="menuitem" className={s.item}><Icon name="layers" size={17} strokeWidth={1.6} />{tr ? 'Yönetim paneli' : 'Admin panel'}</Link>}
              </>
            ) : (
              <Link to={signInHref('kayit', pathname)} role="menuitem" className={s.item}><Icon name="star" size={17} strokeWidth={1.6} />{tr ? 'Hesap oluştur' : 'Create account'}</Link>
            )}
            <button role="menuitem" className={s.item} onClick={() => void signOut()}><Icon name="arrowRight" size={17} strokeWidth={1.6} />{tr ? 'Çıkış yap' : 'Sign out'}</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
