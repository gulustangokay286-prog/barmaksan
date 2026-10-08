import { useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router';
import { motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { CollapsibleFolder } from '../components/CollapsibleFolder';
import { DocActions, MediaGrid, DocThumb, docHref } from '../components/Docs';
import { useTilt } from '../components/ui';
import { MachineSkeleton } from '../components/Skeletons';
import { downloadLink, permalink, type Doc } from '../lib/api';
import { Link } from '../lib/link';
import { useI18n } from '../lib/i18n';
import { useDocTypes, usePageChrome, useUi } from '../lib/ui';
import { docQuery, folderQuery, prefetchDoc } from '../lib/query';
import { useRouteReady } from '../lib/route';
import { markMorph } from '../lib/morph';
import { formatDate, formatRelative, languageLabel } from '../lib/format';
import { useLargeTitle } from '../lib/useLargeTitle';
import NotFound from './NotFound';
import p from './pages.module.css';
import m from './machine.module.css';

// Makinede olması beklenen belge türleri: eksik olan da soluk bir satır olarak görünür
// (neyin eksik olduğu bir bakışta okunur — kurum hafızası).
const MACHINE_TYPES = ['teknik-cizim', 'spl', 'kullanim-kilavuzu', 'bakim-kilavuzu', 'yaglama-tablosu', 'sertifika'];

/** "Makine Adı — Genel Görünüş" → "Genel Görünüş": makinenin sayfasında adı tekrar etmeyiz. */
function shortTitle(title: string, machine: string) {
  const parts = title.split(/\s+[—–-]\s+/);
  if (parts.length > 1 && parts[0].trim().toLocaleLowerCase('tr') === machine.trim().toLocaleLowerCase('tr')) return parts.slice(1).join(' — ');
  return title;
}

export default function Machine() {
  const { slug = '' } = useParams();
  const { t, pick, lang } = useI18n();
  const types = useDocTypes();
  const ready = useRouteReady();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { data: f, isLoading, error } = useQuery(folderQuery(slug));
  const parent = f?.crumbs.at(-2);
  usePageChrome(f ? pick(f.name) : null, parent ? { to: `/k/${parent.slug}`, label: pick(parent.name) } : null);
  useLargeTitle(titleRef, [f?.slug, ready]);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const { hash } = useLocation();

  if (error) return <NotFound />;
  if (!ready || isLoading || !f) return <MachineSkeleton />;

  const mc = f.machine;
  const name = pick(f.name);
  const sheet = f.documents.find((d) => d.type === 'teknik-fis');
  const docs = f.documents.filter((d) => d !== sheet && types.get(d.type)?.media === 'document');
  const media = f.documents.filter((d) => types.get(d.type)?.media !== 'document');
  const archived = f.documents.filter((d) => d.versionCount > 1 && types.get(d.type)?.versioned);
  const archiveCount = archived.reduce((total, d) => total + d.versionCount - 1, 0);
  const lastUpdate = f.documents.reduce((max, d) => (d.current && d.current.createdAt > max ? d.current.createdAt : max), '');

  return (
    <div className={`${p.page} fade-in`}>
      <div className={m.layout}>
        <aside className={m.aside}>
          <div className={m.stage}>
            <span className={m.float}>
              {mc?.cover?.thumb && <img src={mc.cover.thumb} alt="" decoding="sync" style={{ opacity: previewLoaded ? 0 : 1 }} />}
              {mc?.cover?.preview && (
                <img
                  src={mc.cover.preview}
                  alt={name}
                  decoding="async"
                  onLoad={() => setPreviewLoaded(true)}
                  style={{ opacity: previewLoaded ? 1 : 0, transition: 'opacity 360ms var(--ease-out)' }}
                />
              )}
            </span>
          </div>

          {parent && (
            <Link to={`/k/${parent.slug}`} className={m.category}>
              {pick(parent.name)}
              <Icon name="chevronRight" size={13} strokeWidth={1.8} />
            </Link>
          )}
          <h1 ref={titleRef} className={m.title}>{name}</h1>
          {lang === 'tr' && f.name.en && f.name.en !== f.name.tr && <p className={m.en}>{f.name.en}</p>}
          {pick(mc?.summary) && <p className={m.summary}>{pick(mc?.summary)}</p>}

          <dl className={m.specs}>
            {mc && mc.models.length > 0 && (
              <div>
                <dt>{t('model')}</dt>
                <dd className="mono">{mc.models.join(', ')}</dd>
              </div>
            )}
            <div>
              <dt>{lang === 'tr' ? 'Belgeler' : 'Documents'}</dt>
              <dd className="tabular">{docs.length + (sheet ? 1 : 0)}</dd>
            </div>
            {media.length > 0 && (
              <div>
                <dt>{lang === 'tr' ? 'Fotoğraf ve video' : 'Photos and films'}</dt>
                <dd className="tabular">{media.length}</dd>
              </div>
            )}
            {lastUpdate && (
              <div>
                <dt>{lang === 'tr' ? 'Son güncelleme' : 'Last updated'}</dt>
                <dd>{formatDate(lastUpdate, lang, { day: 'numeric', month: 'long', year: 'numeric' })}</dd>
              </div>
            )}
          </dl>
        </aside>

        <div className={m.main}>
          {sheet?.current && <SheetCard sheet={sheet} />}

          <section className={m.block}>
            <h2 className={m.h2}>{lang === 'tr' ? 'Belgeler' : 'Documents'}</h2>
            <DocTable docs={docs} machine={name} slug={f.slug} />
          </section>

          {archiveCount > 0 && (
            <div className={m.block}>
              <CollapsibleFolder id="eski-surumler" title={lang === 'tr' ? 'Eski sürümler' : 'Older versions'} count={archiveCount} defaultOpen={hash === '#eski-surumler'}>
                {archived.map((doc) => <ArchivedDocument key={doc.id} doc={doc} machine={name} />)}
              </CollapsibleFolder>
            </div>
          )}

          {media.length > 0 && (
            <section className={m.block}>
              <h2 className={m.h2}>{lang === 'tr' ? 'Fotoğraf ve video' : 'Photos and films'}</h2>
              <MediaGrid items={media} columns="dense" />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Teknik fiş: makinenin en çok açılan belgesi, en üstte ───────────────────

function SheetCard({ sheet }: { sheet: Doc }) {
  const { t, pick, lang } = useI18n();
  const { editor, setUpload } = useUi();
  const tilt = useTilt(6);
  const v = sheet.current!;
  const meta = [
    `v${v.no}`,
    formatDate(v.createdAt, lang, { day: 'numeric', month: 'long', year: 'numeric' }),
    v.file?.ext.toUpperCase(),
    languageLabel(sheet.language),
  ].filter(Boolean);
  return (
    <section className={m.sheet} aria-label={t('sheetLead')}>
      <Link
        to={docHref(sheet)}
        viewTransition
        className={m.sheetPreview}
        aria-label={pick(sheet.title)}
        onPointerEnter={(e) => { prefetchDoc(sheet.id, v.file?.id, v.file?.kind); tilt.handlers.onPointerEnter(e); }}
        onPointerMove={tilt.handlers.onPointerMove}
        onPointerLeave={tilt.handlers.onPointerLeave}
        onClick={(e) => markMorph(e.currentTarget.firstElementChild, 'doc-page')}
      >
        <motion.span className={m.sheetPage} style={tilt.style}>
          {v.file?.thumb && <img src={v.file.thumb} alt="" />}
        </motion.span>
      </Link>
      <div className={m.sheetBody}>
        <Link to={docHref(sheet)} viewTransition className={m.sheetTitle}>{t('sheetLead')}</Link>
        <p className={m.sheetMeta}>{meta.join(' · ')}</p>
        {v.no > 1 && v.note && <p className={m.sheetNote}>{v.note}</p>}
        <div className={m.sheetActions}>
          <DocActions
            openHref={`/d/${sheet.id}`}
            downloadHref={downloadLink(sheet.id)}
            copyHref={permalink(sheet.id)}
            extra={editor ? <button className={m.action} onClick={() => setUpload({ mode: 'version', docId: sheet.id, title: pick(sheet.title) })}>{t('newVersion')}</button> : undefined}
          />
        </div>
        {sheet.versionCount > 1 && (
          <Link to="#eski-surumler" preventScrollReset className={m.historyLink}>
            {lang === 'tr' ? `Sürüm geçmişi · ${sheet.versionCount} sürüm` : `Version history · ${sheet.versionCount} versions`}
          </Link>
        )}
      </div>
    </section>
  );
}

// ── Belge listesi: türe göre gruplu, her satır belge · dil · sürüm · tarih · indir ──
// Eksik türler tek satırda toplanır: neyin eksik olduğu bir bakışta okunur.

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
                  <span className={`${m.dim} ${m.right} ${m.date}`}>{v ? formatRelative(v.createdAt, lang) : ''}</span>
                  <a className={m.iconBtn} href={downloadLink(d.id)} aria-label={`${t('download')}: ${pick(d.title)}`} title={t('download')}>
                    <Icon name="download" size={16} />
                  </a>
                </div>
              );
            })}
          </div>
        );
      })}
      {!query && missing.length > 0 && (
        <p className={m.missing}>
          <span>{t('notUploaded')}:</span>
          {missing.map((slugType, i) => (
            <span key={slugType} className={m.missingItem}>
              {pick(types.get(slugType)?.name)}
              {editor && (
                <button className={m.missingAdd} onClick={() => setUpload({ mode: 'new', folder: slug, type: slugType })} aria-label={`${t('upload')}: ${pick(types.get(slugType)?.name)}`}>
                  <Icon name="plus" size={13} />
                </button>
              )}
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
            <span className={m.dim}>{formatDate(version.createdAt, lang)}</span>
          </Link>
          <a className={m.iconBtn} href={downloadLink(doc.id, version.no)} aria-label={`${t('download')}: v${version.no}`} title={t('download')}><Icon name="download" size={16} /></a>
        </li>
      ))}
    </ul>
  );
}
