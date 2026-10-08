import { Navigate, useParams } from 'react-router';
import { Link } from '../lib/link';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { PageHeader, SectionTitle } from '../components/PageHeader';
import { DocRow, GroupedDocs, MachineTile, MediaGrid } from '../components/Docs';
import { Button, FadeImage } from '../components/ui';
import { FolderSkeleton } from '../components/Skeletons';
import { useRouteReady } from '../lib/route';
import { api, type FolderChild } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useBootstrap, useDocTypes, usePageChrome, useUi } from '../lib/ui';
import { formatNumber } from '../lib/format';
import { folderQuery, prefetchFolder } from '../lib/query';
import NotFound from './NotFound';
import p from './pages.module.css';

export default function Folder() {
  const { slug = '' } = useParams();
  const { t, pick, lang } = useI18n();
  const types = useDocTypes();
  const { editor, setUpload } = useUi();
  const { data: boot } = useBootstrap();
  const ready = useRouteReady();
  const { data: f, isLoading, error } = useQuery({ queryKey: ['folder', slug], queryFn: () => api.folder(slug) });
  const parent = f?.crumbs.at(-2);
  usePageChrome(f ? pick(f.name) : null, parent ? { to: `/k/${parent.slug}`, label: pick(parent.name) } : { to: '/', label: t('home') });

  if (error) return <NotFound />;
  if (!ready || isLoading || !f) return <FolderSkeleton />;
  if (f.kind === 'machine') return <Navigate to={`/m/${f.slug}`} replace />;

  const media = f.documents.filter((d) => types.get(d.type)?.media !== 'document');
  const docs = f.documents.filter((d) => types.get(d.type)?.media === 'document');
  const machines = f.children.filter((c) => c.kind === 'machine');
  const categories = f.children.filter((c) => c.kind === 'category');
  const collections = f.children.filter((c) => c.kind === 'collection');
  const treeKids = (slugOf: string) => {
    const node = boot?.tree.find((n) => n.slug === slugOf);
    return node ? boot!.tree.filter((n) => n.parentId === node.id) : [];
  };
  const description = pick(f.description);
  const meta = [
    f.machineCount > 0 && `${formatNumber(f.machineCount, lang)} ${t('machine')}`,
    docs.length > 0 && `${docs.length} ${t('documents')}`,
    media.length > 0 && `${media.length} ${t('mediaItems')}`,
  ].filter(Boolean);

  return (
    <div className={`${p.page} fade-in`}>
      <PageHeader
        title={pick(f.name)}
        lead={description || undefined}
        meta={meta.length ? meta.map((m) => <span key={String(m)}>{m}</span>) : undefined}
        actions={editor && f.kind === 'collection' ? <Button icon="upload" variant="primary" onClick={() => setUpload({ mode: 'new', folder: f.slug })}>{t('upload')}</Button> : undefined}
      />

      {categories.length > 0 && (
        <div className={p.categories} style={{ marginTop: 32 }}>
          {categories.map((c) => (
            <div key={c.slug} className={p.category}>
              <Link to={`/k/${c.slug}`} className={p.categoryHead}>
                <h2 className="t-headline">{pick(c.name)}</h2>
                <span className={p.categoryCount}>{c.childCount}</span>
                <Icon name="chevronRight" size={14} />
              </Link>
              <ul className={p.tiles}>
                {treeKids(c.slug).map((m) => <MachineTile key={m.slug} m={m} />)}
              </ul>
            </div>
          ))}
        </div>
      )}

      {machines.length > 0 && (
        <ul className={p.tiles} style={{ marginTop: 32 }}>
          {machines.map((m) => <MachineTile key={m.slug} m={m} />)}
        </ul>
      )}

      {collections.length > 0 && (
        <ul className={p.collections}>
          {collections.map((c) => <CollectionCard key={c.slug} c={c} media={f.slug === 'medya'} />)}
        </ul>
      )}

      {docs.length > 0 && (
        <section style={{ marginTop: 32 }}>
          {f.kind === 'collection' && new Set(docs.map((d) => d.type)).size === 1 ? (
            <ul className={p.rows}>{docs.map((d) => <DocRow key={d.id} doc={d} />)}</ul>
          ) : (
            <GroupedDocs docs={docs} />
          )}
        </section>
      )}

      {media.length > 0 && (
        <section className={docs.length ? p.section : undefined} style={docs.length ? undefined : { marginTop: 32 }}>
          {docs.length > 0 && <SectionTitle title={`${t('photos')} · ${t('videos')}`} count={media.length} />}
          <MediaGrid items={media} />
        </section>
      )}

      {f.children.length === 0 && f.documents.length === 0 && <p className={p.empty}>{t('emptyFolder')}</p>}
    </div>
  );
}

const ICONS: Record<string, string> = {
  sertifikalar: 'seal', kataloglar: 'catalog', 'sirket-profilleri': 'building', 'musteri-dosyalari': 'send',
  'tanitim-videolari': 'video', 'fabrika-fotograflari': 'photo', 'drone-cekimleri': 'images', 'urun-gorselleri': 'photo',
};

/**
 * Koleksiyon: kendi içeriğiyle (ilk görsel ya da ilk PDF sayfası). Altında düz metinle ad ve sayı.
 * Kutu, ikon çipi, çerçeve yok; görsel kartın kendisi. Veri açılışta zaten ısıtılmış olur.
 */
function CollectionCard({ c, media }: { c: FolderChild; media: boolean }) {
  const { pick, t, lang } = useI18n();
  const { data } = useQuery(folderQuery(c.slug));
  const docs = data?.documents ?? [];
  const first = docs.find((d) => d.current?.file?.thumb);
  const file = first?.current?.file;
  const isPage = file?.kind === 'pdf';
  const videos = docs.length > 0 && docs.every((d) => d.current?.file?.kind === 'video');
  const unit = media ? (videos ? (lang === 'tr' ? 'video' : 'videos') : t('mediaItems')) : t('documents');
  return (
    <li>
      <Link to={`/k/${c.slug}`} className={p.collection} onPointerEnter={() => prefetchFolder(c.slug)}>
        <span className={p.collectionCover} data-page={isPage || undefined}>
          {file?.thumb ? (
            <FadeImage src={file.thumb} fit="cover" />
          ) : data ? (
            <Icon name={ICONS[c.slug] ?? 'folder'} size={26} strokeWidth={1.3} />
          ) : null}
          {videos && <span className={p.collectionPlay}><Icon name="play" size={14} strokeWidth={1.6} /></span>}
        </span>
        <span className={p.collectionName}>{pick(c.name)}</span>
        <span className={p.collectionCount}>{formatNumber(c.docCount, lang)} {unit}</span>
      </Link>
    </li>
  );
}
