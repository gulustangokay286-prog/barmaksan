import { Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../components/PageHeader';
import { DocRow } from '../components/Docs';
import { RowsSkeleton } from '../components/Skeletons';
import { useRouteReady } from '../lib/route';
import { api, type Doc } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { usePageChrome } from '../lib/ui';
import { dayKey, formatDate } from '../lib/format';
import p from './pages.module.css';

export default function Recent() {
  const { t, lang, locale } = useI18n();
  usePageChrome(t('recent'), { to: '/', label: t('home') });
  const ready = useRouteReady();
  const query = useQuery({ queryKey: ['recent', 50, locale], queryFn: () => api.recent(50, locale) });
  const data = ready ? query.data : undefined;

  const groups: { key: string; label: string; items: Doc[] }[] = [];
  const today = dayKey(new Date().toISOString());
  const yesterday = dayKey(new Date(Date.now() - 86_400_000).toISOString());
  for (const d of data ?? []) {
    if (!d.current) continue;
    const key = dayKey(d.current.createdAt);
    let g = groups.at(-1);
    if (!g || g.key !== key) {
      const label = key === today ? t('today') : key === yesterday ? t('yesterday') : formatDate(d.current.createdAt, lang, { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });
      g = { key, label, items: [] };
      groups.push(g);
    }
    g.items.push(d);
  }

  return (
    <div className={p.page}>
      <PageHeader
        title={t('recent')}
        lead={lang === 'tr' ? 'Yeni yüklenen ve yeni sürümü yayınlanan dokümanlar. Listedeki her dosya, o dokümanın en güncel hâlidir.' : 'Newly uploaded documents and new versions. Every file listed is the latest version of that document.'}
      />
      {!data && (
        <div style={{ marginTop: 28 }}>
          <RowsSkeleton count={8} />
        </div>
      )}
      {groups.map((g) => (
        <Fragment key={g.key}>
          <h2 className={p.dayHead}>{g.label}</h2>
          <ul className={p.rows}>{g.items.map((d) => <DocRow key={d.id} doc={d} showFolder />)}</ul>
        </Fragment>
      ))}
    </div>
  );
}
