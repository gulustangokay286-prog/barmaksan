import { Link } from '../lib/link';
import { useI18n } from '../lib/i18n';
import { usePageChrome } from '../lib/ui';
import p from './pages.module.css';
import ui from '../components/ui.module.css';

export default function NotFound() {
  const { t } = useI18n();
  usePageChrome(null, { to: '/', label: t('home') });
  return (
    <div className={p.page}>
      <div className={p.center}>
        <h1 className="t-large">{t('notFound')}</h1>
        <p className="ink-2" style={{ fontSize: 17 }}>{t('notFoundHint')}</p>
        <Link to="/" className={`${ui.btn} ${ui.primary} ${ui.md}`} style={{ marginTop: 12 }}>{t('backHome')}</Link>
      </div>
    </div>
  );
}
