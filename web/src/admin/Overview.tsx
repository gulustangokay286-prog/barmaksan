// Genel bakış: kütüphanenin gerçek durumu — sayılar, eksikler, son hareketler, kapsama.
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { Link } from '../lib/link';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useBootstrap, useDocTypes, useUi } from '../lib/ui';
import { formatNumber, formatSize } from '../lib/format';
import { ActivityRow, EmptyNote, PageHead, useCoverageTypes } from './shared';
import a from './admin.module.css';

export default function AdminOverview() {
  const { t, pick, lang } = useI18n();
  const tr = lang === 'tr';
  const { data: boot } = useBootstrap();
  const types = useDocTypes();
  const required = useCoverageTypes();
  const { setUpload } = useUi();
  const activity = useQuery({ queryKey: ['admin', 'activity', 8], queryFn: () => api.adminActivity(8) });
  const coverage = useQuery({ queryKey: ['admin', 'coverage'], queryFn: api.adminCoverage });
  const docs = useQuery({ queryKey: ['admin', 'documents'], queryFn: api.adminDocuments });
  const today = new Intl.DateTimeFormat(tr ? 'tr-TR' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

  const perType = useMemo(() => {
    const list = coverage.data ?? [];
    return required.map((slug) => ({ slug, have: list.filter((m) => m.types.includes(slug)).length, total: list.length }));
  }, [coverage.data, required]);
  const missingTotal = useMemo(() => (coverage.data ?? []).reduce((n, m) => n + required.filter((x) => !m.types.includes(x)).length, 0), [coverage.data, required]);
  const missingSheets = perType.find((x) => x.slug === 'teknik-fis');
  const archived = (docs.data ?? []).filter((d) => d.archivedAt).length;
  const noCover = (boot?.tree ?? []).filter((n) => n.kind === 'machine' && !n.cover).length;

  const stats = boot ? [
    { label: tr ? 'Makine' : 'Machines', value: formatNumber(boot.stats.machines, lang), to: '/admin/makineler' },
    { label: tr ? 'Belge' : 'Documents', value: formatNumber(boot.stats.documents, lang), to: '/admin/belgeler' },
    { label: tr ? 'Fotoğraf ve video' : 'Photos and films', value: formatNumber(boot.stats.media, lang), to: '/admin/belgeler' },
    { label: tr ? 'Depolanan dosya' : 'Stored files', value: formatSize(boot.stats.bytes, lang), to: null },
  ] : [];

  const notices = [
    missingSheets && missingSheets.total - missingSheets.have > 0 ? {
      to: '/admin/eksikler',
      text: tr ? `${missingSheets.total - missingSheets.have} makinenin teknik fişi henüz yüklenmedi.` : `${missingSheets.total - missingSheets.have} machines have no technical sheet yet.`,
    } : null,
    missingTotal > 0 ? {
      to: '/admin/eksikler',
      text: tr ? `Makinelerde toplam ${missingTotal} beklenen belge eksik.` : `${missingTotal} expected documents are missing across machines.`,
    } : null,
    noCover > 0 ? {
      to: '/admin/makineler',
      text: tr ? `${noCover} makinenin kapak fotoğrafı yok.` : `${noCover} machines have no cover photo.`,
    } : null,
    archived > 0 ? {
      to: '/admin/belgeler?durum=arsiv',
      text: tr ? `Arşivde ${archived} belge var.` : `${archived} documents are archived.`,
    } : null,
  ].filter((n): n is { to: string; text: string } => !!n);

  return (
    <div className={a.page}>
      <PageHead
        title={tr ? 'Genel bakış' : 'Overview'}
        lead={today}
        actions={<button className={a.primary} onClick={() => setUpload({ mode: 'new', folder: '' })}><Icon name="upload" size={16} />{tr ? 'Belge yükle' : 'Upload document'}</button>}
      />

      <div className={a.stats}>
        {boot ? stats.map((s) => {
          const body = (
            <>
              <span className={a.statValue}>{s.value}</span>
              <span className={a.statLabel}>{s.label}</span>
            </>
          );
          return s.to ? <Link key={s.label} to={s.to} className={a.stat}>{body}</Link> : <div key={s.label} className={a.stat}>{body}</div>;
        }) : Array.from({ length: 4 }, (_, i) => <span key={i} className={`${a.stat} skeleton`} style={{ height: 88 }} />)}
      </div>

      {notices.length > 0 && (
        <ul className={a.notices}>
          {notices.map((n) => (
            <li key={n.text}>
              <Link to={n.to} className={a.notice}>
                <Icon name="info" size={17} />
                <span>{n.text}</span>
                <Icon name="chevronRight" size={14} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className={a.split}>
        <section className={a.card}>
          <div className={a.cardHead}>
            <h2>{tr ? 'Son hareketler' : 'Recent activity'}</h2>
            <Link to="/admin/hareketler" className={a.more}>{t('viewAll')}</Link>
          </div>
          {!activity.data ? (
            <div className={a.skelList}>{Array.from({ length: 6 }, (_, i) => <span key={i} className="skeleton" style={{ ['--i' as string]: i }} />)}</div>
          ) : (
            <>
              <ul className={a.activityList}>{activity.data.map((x) => <ActivityRow key={x.id} item={x} />)}</ul>
              {activity.data.length <= 1 && (
                <EmptyNote>
                  {tr
                    ? 'Yüklediğiniz belgeler, yayınladığınız sürümler ve yaptığınız düzenlemeler burada, kimin yaptığıyla birlikte görünür.'
                    : 'Uploads, new versions and edits appear here, with who made them.'}
                </EmptyNote>
              )}
            </>
          )}
        </section>

        <section className={a.card}>
          <div className={a.cardHead}>
            <h2>{tr ? 'Belge kapsaması' : 'Document coverage'}</h2>
            <Link to="/admin/eksikler" className={a.more}>{tr ? 'Eksikleri gör' : 'See gaps'}</Link>
          </div>
          <p className={a.cardLead}>{tr ? 'Her belge türünün kaç makinede yüklü olduğu.' : 'How many machines have each document type.'}</p>
          <ul className={a.bars}>
            {perType.map((x) => (
              <li key={x.slug}>
                <span className={a.barLabel}>{pick(types.get(x.slug)?.name)}</span>
                <span className={a.barTrack}><span style={{ transform: `scaleX(${x.total ? x.have / x.total : 0})` }} /></span>
                <span className={a.barValue}>{x.have}/{x.total}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
