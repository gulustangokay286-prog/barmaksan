import { useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { CollapsibleFolder } from '../components/CollapsibleFolder';
import { DateStamp } from '../components/DateStamp';
import { MediaGrid, DocThumb, docHref } from '../components/Docs';
import { MachineGallery, MaintenanceBank, ProductOverview, TechnicalSpecifications } from '../components/MachineContent';
import { MachineSkeleton } from '../components/Skeletons';
import { downloadLink, type Doc } from '../lib/api';
import { Link } from '../lib/link';
import { useI18n } from '../lib/i18n';
import { useBootstrap, useDocTypes, usePageChrome, useUi } from '../lib/ui';
import { docQuery, folderQuery, prefetchDoc } from '../lib/query';
import { useRouteReady } from '../lib/route';
import { markMorph } from '../lib/morph';
import { languageLabel, matchesLanguage, shortTitle } from '../lib/format';
import { useLargeTitle } from '../lib/useLargeTitle';
import NotFound from './NotFound';
import p from './pages.module.css';
import m from './machine.module.css';

const MACHINE_TYPES = ['teknik-fis', 'teknik-cizim', 'spl', 'kullanim-kilavuzu', 'bakim-kilavuzu', 'yaglama-tablosu', 'sertifika'];

export default function Machine() {
  const { slug = '' } = useParams();
  const { pick, lang, locale: code } = useI18n();
  const { data: boot } = useBootstrap();
  const types = useDocTypes();
  const ready = useRouteReady();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { data: f, isLoading, error } = useQuery(folderQuery(slug));
  const parent = f?.crumbs.at(-2);
  usePageChrome(f ? f.content?.profiles[code]?.title || pick(f.name) : null, parent ? { to: `/k/${parent.slug}`, label: pick(parent.name) } : null);
  useLargeTitle(titleRef, [f?.slug, ready]);
  const { hash } = useLocation();
  const tr = lang === 'tr';
  if (error) return <NotFound />;
  if (!ready || isLoading || !f) return <MachineSkeleton />;
  const mc = f.machine;
  const profile = f.content?.profiles[code];
  const name = profile?.title || pick(f.name);
  const documents = f.documents.filter((d) => types.get(d.type)?.media === 'document');
  const docs = documents.filter((d) => matchesLanguage(d.language, code));
  const media = f.documents.filter((d) => types.get(d.type)?.media !== 'document' && matchesLanguage(d.language, code));
  const photos = media.filter((d) => d.current?.file?.kind === 'image');
  const selected = f.content?.gallery != null ? f.content.gallery.map((id) => photos.find((d) => d.id === id)).filter((d): d is Doc => !!d) : photos;
  const archived = docs.filter((d) => d.versionCount > 1 && types.get(d.type)?.versioned);
  const archiveCount = archived.reduce((total, d) => total + d.versionCount - 1, 0);
  const bank = f.content?.maintenance ?? [];
  const hasMaintenance = bank.some((c) => c.topics.some((topic) => topic.translations[code]));
  const direction = boot?.languages.find((l) => l.code === code)?.direction ?? 'ltr';
  return <div className={`${p.page} fade-in`}>
    <div className={m.layout}>
      <aside className={m.aside}>
        <MachineGallery photos={selected} cover={mc?.cover ?? null} name={name} />
        {parent && <Link to={`/k/${parent.slug}`} className={m.category}>{pick(parent.name)}<Icon name="chevronRight" size={13} /></Link>}
        <h1 ref={titleRef} className={m.title}>{name}</h1>
        {mc?.models.length ? <p className={m.modelNames}>{mc.models.join(' · ')}</p> : mc?.modelCode && <p className={m.modelNames}>{mc.modelCode}</p>}
        {profile?.updatedAt && <p className={m.updated}>{tr ? 'Son güncelleme' : 'Last updated'} · <DateStamp iso={profile.updatedAt} author={profile.author} format="short" action="update" /></p>}
      </aside>
      <div className={m.main} dir={direction} lang={code}>
        <nav className={m.sections} aria-label={tr ? 'Makine bölümleri' : 'Machine sections'}>
          <a href="#genel-bakis">{tr ? 'Genel bakış' : 'Overview'}</a>
          {!!profile?.specifications.length && <a href="#teknik-ozellikler">{tr ? 'Teknik özellikler' : 'Specifications'}</a>}
          <a href="#belgeler">{tr ? 'Belgeler' : 'Documents'}</a>
          {hasMaintenance && <a href="#bakim">{tr ? 'Bakım' : 'Maintenance'}</a>}
          {!!media.length && <a href="#medya">{tr ? 'Medya' : 'Media'}</a>}
        </nav>
        <ProductOverview profile={profile} />
        {!!profile?.specifications.length && <TechnicalSpecifications tables={profile.specifications} />}
        <section id="belgeler" className={m.block}>
          <h2 className={m.h2}>{tr ? 'Belgeler' : 'Documents'}</h2>
          <DocTable key={code} docs={docs} machine={name} slug={f.slug} />
          {!docs.length && <p className={m.empty}>{tr ? 'Bu dilde belge eklenmemiş.' : 'No documents have been added in this language.'}</p>}
        </section>
        {archiveCount > 0 && <div className={m.block}><CollapsibleFolder id="eski-surumler" title={tr ? 'Eski sürümler' : 'Older versions'} count={archiveCount} defaultOpen={hash === '#eski-surumler'}>{archived.map((d) => <ArchivedDocument key={d.id} doc={d} machine={name} />)}</CollapsibleFolder></div>}
        {hasMaintenance && <MaintenanceBank categories={bank} code={code} documents={f.documents} />}
        {!!media.length && <section id="medya" className={m.block}><h2 className={m.h2}>{tr ? 'Fotoğraf ve video' : 'Photos and videos'}</h2><MediaGrid items={media} columns="dense" /></section>}
      </div>
    </div>
  </div>;
}

function DocTable({ docs, machine, slug }: { docs: Doc[]; machine: string; slug: string }) {
  const { t, pick, lang } = useI18n();
  const types = useDocTypes();
  const { editor, setUpload } = useUi();
  const [search, setSearch] = useState('');
  const order = [...types.keys()];
  const groups = new Map<string, Doc[]>();
  for (const s of MACHINE_TYPES) groups.set(s, []);
  for (const d of docs) groups.set(d.type, [...(groups.get(d.type) ?? []), d]);
  const ordered = [...groups.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
  const query = search.trim().toLocaleLowerCase(lang);
  const matches = (doc: Doc) => [pick(doc.title), languageLabel(doc.language), pick(types.get(doc.type)?.name)].join(' ').toLocaleLowerCase(lang).includes(query);
  const filtered = ordered.map(([type, list]) => [type, list.filter(matches)] as const).filter(([, list]) => list.length > 0);
  const found = filtered.reduce((count, [, list]) => count + list.length, 0);
  const missing = ordered.filter(([, list]) => list.length === 0).map(([slugType]) => slugType);

  return (
    <>
      {docs.length > 0 && (
        <div className={m.docTools}>
          <label className={m.docSearch}>
            <Icon name="search" size={17} />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={lang === 'tr' ? 'Belgelerde ara…' : 'Search documents…'} aria-label={lang === 'tr' ? 'Makine belgelerinde ara' : 'Search machine documents'} />
          </label>
          <span className={m.dim} aria-live="polite">{found} / {docs.length}</span>
        </div>
      )}
    <div className={m.table}>
      {query && found === 0 && <p className={m.missing}>{lang === 'tr' ? 'Aramanıza uygun belge yok.' : 'No matching documents.'}</p>}
      {filtered.map(([slugType, list]) => {
        const type = types.get(slugType);
        if (!type) return null;
        return (
          <div key={slugType} className={m.group} role="group" aria-label={pick(type.name)}>
            <h3 className={m.groupLabel}>{pick(type.name)}</h3>
            {list.map((d) => {
              const v = d.current;
              return (
                <div key={d.id} className={m.row}>
                  <Link
                    to={docHref(d)}
                    viewTransition
                    className={m.docLink}
                    onPointerEnter={() => prefetchDoc(d.id, v?.file?.id, v?.file?.kind)}
                    onFocus={() => prefetchDoc(d.id, v?.file?.id, v?.file?.kind)}
                    onClick={(e) => markMorph(e.currentTarget.querySelector('[data-morph]'), 'doc-page')}
                  >
                    <DocThumb doc={d} size="sm" />
                    <span className={m.docName}>{shortTitle(pick(d.title), machine)}</span>
                  </Link>
                  <span className={m.dim}>{languageLabel(d.language) || ''}</span>
                  <span className={`${m.dim} ${m.right} mono`}>{v ? `v${v.no}` : ''}</span>
                  <span className={`${m.dim} ${m.right} ${m.date}`}>{v && <DateStamp iso={v.createdAt} author={v.author} />}</span>
                  <a className={m.iconBtn} href={downloadLink(d.id)} aria-label={`${t('download')}: ${pick(d.title)}`} title={t('download')}>
                    <Icon name="download" size={16} />
                  </a>
                </div>
              );
            })}
          </div>
        );
      })}
      {editor && !query && missing.length > 0 && (
        <p className={m.missing}>
          <span>{t('notUploaded')}:</span>
          {missing.map((slugType, i) => (
            <span key={slugType} className={m.missingItem}>
              {pick(types.get(slugType)?.name)}
              <button className={m.missingAdd} onClick={() => setUpload({ mode: 'new', folder: slug, type: slugType })} aria-label={`${t('upload')}: ${pick(types.get(slugType)?.name)}`}>
                <Icon name="plus" size={13} />
              </button>
              {i < missing.length - 1 ? ',' : ''}
            </span>
          ))}
        </p>
      )}
    </div>
    </>
  );
}


function ArchivedDocument({ doc, machine }: { doc: Doc; machine: string }) {
  const { pick } = useI18n();
  return (
    <CollapsibleFolder title={shortTitle(pick(doc.title), machine)} count={doc.versionCount - 1}>
      <ArchivedVersions doc={doc} />
    </CollapsibleFolder>
  );
}

function ArchivedVersions({ doc }: { doc: Doc }) {
  const { t, lang } = useI18n();
  const { data, isLoading, error, refetch } = useQuery(docQuery(doc.id));
  if (isLoading) return <p className={m.dim} role="status">{lang === 'tr' ? 'Sürümler yükleniyor…' : 'Loading versions…'}</p>;
  if (error) return <button className={m.action} onClick={() => void refetch()}>{lang === 'tr' ? 'Yüklenemedi. Yeniden dene' : 'Could not load. Try again'}</button>;
  const old = data?.versions.filter((version) => version.no !== data.current?.no) ?? [];
  return (
    <ul className={m.archiveList}>
      {old.map((version) => (
        <li key={version.no} className={m.archiveRow}>
          <Link to={`${docHref(doc)}?v=${version.no}`} className={m.archiveLink}>
            <span className="mono">v{version.no}</span>
            <span>{version.note || (lang === 'tr' ? 'Önceki sürüm' : 'Previous version')}</span>
            <DateStamp iso={version.createdAt} author={version.author} format="short" className={m.dim} />
          </Link>
          <a className={m.iconBtn} href={downloadLink(doc.id, version.no)} aria-label={`${t('download')}: v${version.no}`} title={t('download')}><Icon name="download" size={16} /></a>
        </li>
      ))}
    </ul>
  );
}
