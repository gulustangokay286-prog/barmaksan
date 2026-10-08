// Hareketler: kim, ne zaman, neyi değiştirdi — güne göre gruplu (kurum hafızası).
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type Activity } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { dayKey, formatDate } from '../lib/format';
import { ActivityRow, PageHead } from './shared';
import a from './admin.module.css';

export default function AdminActivity() {
  const { t, lang } = useI18n();
  const activity = useQuery({ queryKey: ['admin', 'activity', 200], queryFn: () => api.adminActivity(200) });
  const groups = useMemo(() => {
    const out: { key: string; label: string; items: Activity[] }[] = [];
    const today = dayKey(new Date().toISOString());
    const yesterday = dayKey(new Date(Date.now() - 86_400_000).toISOString());
    for (const x of activity.data ?? []) {
      const key = dayKey(x.at);
      let g = out.at(-1);
      if (!g || g.key !== key) {
        const label = key === today ? t('today') : key === yesterday ? t('yesterday') : formatDate(x.at, lang, { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });
        g = { key, label, items: [] };
        out.push(g);
      }
      g.items.push(x);
    }
    return out;
  }, [activity.data, t, lang]);

  return (
    <div className={a.page}>
      <PageHead
        title={lang === 'tr' ? 'Hareketler' : 'Activity'}
        lead={lang === 'tr' ? 'Yüklenen belgeler, yayınlanan sürümler ve yapılan düzenlemeler.' : 'Uploaded documents, published versions and edits.'}
      />
      {!activity.data && <div className={a.skelList}>{Array.from({ length: 10 }, (_, i) => <span key={i} className="skeleton" style={{ ['--i' as string]: i }} />)}</div>}
      {groups.map((g) => (
        <section key={g.key} className={a.day}>
          <h2 className={a.dayHead}>{g.label}</h2>
          <ul className={a.activityList}>{g.items.map((x) => <ActivityRow key={x.id} item={x} />)}</ul>
        </section>
      ))}
    </div>
  );
}
