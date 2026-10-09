// Her sayfanın sonunda marka ve temel gezinme bağlantıları.
import { useLocation } from 'react-router';
import { useReducedMotion } from 'motion/react';
import { Icon } from './Icon';
import { BrandLockup } from './ui';
import { Link } from '../lib/link';
import { useI18n } from '../lib/i18n';
import { useUi } from '../lib/ui';
import s from './SiteFooter.module.css';

export function SiteFooter() {
  const { t, lang } = useI18n();
  const { openSearch, editor } = useUi();
  const { pathname } = useLocation();
  const reduce = useReducedMotion();

  // Yönetim panelinde kabuk farklı; medya ve belge görüntüleyicisi kendi alt alanını yönetir.
  if (pathname.startsWith('/admin')) return null;

  const year = new Date().getFullYear();

  return (
    <footer className={s.footer}>
      <div className={s.inner}>
        <div className={s.brand}>
          <BrandLockup />
          <p className={s.about}>{t('footerAbout')}</p>
        </div>

        <nav className={s.col} aria-label={t('footerLibrary')}>
          <h3>{t('footerLibrary')}</h3>
          <Link to="/">{t('home')}</Link>
          <Link to="/son">{t('recent')}</Link>
          <Link to="/medya">{t('mediaLibrary')}</Link>
          <Link to="/kaydedilenler">{t('saved')}</Link>
          <button onClick={() => openSearch()}>{t('search')}</button>
        </nav>

        <nav className={s.col} aria-label={t('footerCompany')}>
          <h3>{t('footerCompany')}</h3>
          <Link to="/k/kurumsal">{t('corporate')}</Link>
          <Link to="/k/kurumsal-kimlik">{t('brand')}</Link>
          <a href="https://www.ugurpromilling.com" target="_blank" rel="noopener">
            {t('website')} <Icon name="external" size={11} strokeWidth={1.8} />
          </a>
          {editor && <Link to="/admin">{lang === 'tr' ? 'Yönetim paneli' : 'Administration'}</Link>}
        </nav>

      </div>

      <div className={s.bottom}>
        <span>© {year} Barmaksan Endüstri A.Ş. · Uğur Promilling</span>
        <button className={s.top} onClick={() => window.scrollTo({ top: 0, behavior: reduce ? 'instant' : 'smooth' })}>
          {t('backToTop')}
          <Icon name="arrowUp" size={13} strokeWidth={1.8} />
        </button>
      </div>
    </footer>
  );
}
