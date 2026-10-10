import { Fragment, useEffect, useRef, useState } from 'react';
import { useLocation, useParams, useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { Icon } from '../components/Icon';
import { DocumentSkeleton } from '../components/Skeletons';
import { Crumbs } from '../components/PageHeader';
import { DocActions } from '../components/Docs';
import { DateStamp } from '../components/DateStamp';
import { useRouteReady } from '../lib/route';
import { Button, FadeImage } from '../components/ui';
import { api, downloadLink, pdfPageLink, permalink, versionLink, type DocDetail, type FileInfo, type Version } from '../lib/api';
import { Link } from '../lib/link';
import { useI18n } from '../lib/i18n';
import { useDocTypes, usePageChrome, useUi } from '../lib/ui';
import { docQuery } from '../lib/query';
import { useBookmarks } from '../lib/bookmarks';
import { gate, signInHref, useSession } from '../lib/session';
import { formatDateTime, formatDuration, languageLabel, shortTitle, versionLabel } from '../lib/format';
import { useLargeTitle } from '../lib/useLargeTitle';
import NotFound from './NotFound';
import p from './pages.module.css';
import dc from './document.module.css';

const MAX_PAGES = 60;

/** "Klasör Adı — Teknik Fiş" → "Teknik Fiş": konum zaten üstte yazıyor. */

export default function DocumentPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const { hash } = useLocation();
  const { t, pick, lang } = useI18n();
  const types = useDocTypes();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const ready = useRouteReady();
  const { data: d, isLoading, error } = useQuery(docQuery(id));
  const session = useSession();
  const back = d?.crumbs.at(-1);
  const vParam = Number(params.get('v'));
  const viewingOld = !!d?.versions.some((v) => v.no === vParam && v.no !== d.current?.no);
  const hrefOf = (c: { kind: string; slug: string }) => (c.kind === 'machine' ? `/m/${c.slug}` : `/k/${c.slug}`);
  usePageChrome(
    d ? `${pick(d.title)}${viewingOld ? ` · ${versionLabel(vParam, lang)}` : ''}` : null,
    back ? { to: hrefOf(back), label: pick(back.name) } : null,
    d ? [...d.crumbs.map((c) => ({ label: pick(c.name), to: hrefOf(c) })), ...(viewingOld && back?.kind === 'machine' ? [{ label: lang === 'tr' ? 'Eski sürümler' : 'Older versions', to: `${hrefOf(back)}#belgeler` }] : [])] : null,
  );
  useLargeTitle(titleRef, [d?.id, ready]);

  useEffect(() => {
    if (hash === '#gecmis' && d) document.getElementById('gecmis')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash, d]);

  if (error) return <NotFound />;
  if (!ready || isLoading || !d) return <DocumentSkeleton />;

  const viewing = d.versions.find((v) => v.no === vParam) ?? d.versions[0];
  const isCurrent = viewing?.no === d.current?.no;
  const type = types.get(d.type);
  // Belge türündeki içerik (PDF vb.) misafir ya da üye oturumu ister; görsel/video herkese açık.
  const locked = type?.media === 'document' && !session.isViewer && !session.loading;

  return (
    <div className={`${p.page} fade-in`}>
      <div className={p.docLayout}>
        <div className={p.viewer}>
          {locked ? <LockedViewer d={d} /> : viewing?.file && <StableViewer key={d.id} file={viewing.file} doc={d} />}
        </div>

        <aside className={p.panel}>
          <div>
            <Crumbs items={d.crumbs} />
            <h1 ref={titleRef} className={dc.title}>{shortTitle(pick(d.title), back ? pick(back.name) : '')}</h1>
            {viewing && (
              <p className={dc.meta}>
                {[
                  type?.versioned ? versionLabel(viewing.no, lang) : null,
                  <DateStamp key="date" iso={viewing.createdAt} author={viewing.author} format="long" />,
                  viewing.file?.ext.toUpperCase(),
                  languageLabel(d.language),
                ].filter(Boolean).map((part, i) => <Fragment key={i}>{i > 0 && ' · '}{part}</Fragment>)}
              </p>
            )}
          </div>

          {!isCurrent && d.current && (
            <p className={dc.old}>
              {lang === 'tr' ? `Eski bir sürüme (${versionLabel(viewing?.no ?? 0, lang)}) bakıyorsunuz.` : `You are viewing an older version (${versionLabel(viewing?.no ?? 0, lang)}).`}{' '}
              <Link to={`/dokuman/${d.id}`} preventScrollReset replace>{t('goCurrent')}</Link>
            </p>
          )}

          <PanelActions d={d} viewing={viewing} isCurrent={isCurrent} />

          {type?.versioned && (
            <section id="gecmis" style={{ scrollMarginTop: 80 }}>
              <h2 className={dc.h2}>{t('versionHistory')}</h2>
              <Timeline d={d} viewing={viewing?.no} />
              <HiddenVersions d={d} />
            </section>
          )}

          <section>
            <h2 className={dc.h2}>{t('details')}</h2>
            <Facts d={d} file={viewing?.file ?? null} version={viewing} />
          </section>
        </aside>
      </div>
    </div>
  );
}

function PanelActions({ d, viewing, isCurrent }: { d: DocDetail; viewing?: Version; isCurrent: boolean }) {
  const { t, pick } = useI18n();
  const { editor, setUpload } = useUi();
  const { has, toggle } = useBookmarks();
  const saved = has(d.id);
  const openHref = isCurrent || !viewing ? `/d/${d.id}` : versionLink(d.id, viewing.no);
  const dlHref = isCurrent || !viewing ? downloadLink(d.id) : downloadLink(d.id, viewing.no);
  return (
    <div>
      <DocActions
        openHref={openHref}
        downloadHref={dlHref}
        copyHref={permalink(d.id)}
        extra={<>
          <Button icon="bookmark" onClick={() => toggle(d)} aria-pressed={saved}>
            {saved ? t('unsave') : t('save')}
          </Button>
          {editor && <button className={dc.action} onClick={() => setUpload({ mode: 'version', docId: d.id, title: pick(d.title) })}>{t('newVersion')}</button>}
        </>}
      />
      <p className={dc.hint}>{t('permalinkHint')}</p>
    </div>
  );
}

function HiddenVersions({ d }: { d: DocDetail }) {
  const { lang } = useI18n();
  if (!d.hiddenVersions) return null;
  const tr = lang === 'tr';
  return (
    <p className={dc.hidden}>
      <Icon name="lock" size={14} strokeWidth={1.7} />
      <span>{tr ? `${d.hiddenVersions} eski sürüm üyelere açık.` : `${d.hiddenVersions} older version${d.hiddenVersions > 1 ? 's are' : ' is'} available to members.`}</span>
      <Link to={signInHref('kayit', `/dokuman/${d.id}#gecmis`)}>{tr ? 'Hesap oluştur' : 'Create account'}</Link>
    </p>
  );
}

/** Kilitli belge: küçük resim bulanık bir önizleme olur; tek düğme kapıyı açar. */
function LockedViewer({ d }: { d: DocDetail }) {
  const { lang } = useI18n();
  const tr = lang === 'tr';
  const thumb = d.current?.file?.thumb;
  return (
    <div className={dc.locked}>
      {thumb && <div className={dc.lockedBackdrop} aria-hidden="true"><img className={dc.lockedPreview} src={thumb} alt="" /></div>}
      <div className={dc.lockedCard}>
        <span className={dc.lockedBadge}><Icon name="lock" size={22} strokeWidth={1.5} /></span>
        <p className={dc.lockedTitle}>{tr ? 'Belgeyi görüntülemek için' : 'To view this document'}</p>
        <p className={dc.lockedLead}>{tr ? 'Giriş yapın ya da e-postanızı bırakıp misafir olarak devam edin.' : 'Sign in, or leave your e-mail to continue as a guest.'}</p>
        <button className={dc.lockedButton} onClick={() => gate.open('document')}>{tr ? 'Belgeyi aç' : 'Open document'}</button>
      </div>
    </div>
  );
}

function Timeline({ d, viewing }: { d: DocDetail; viewing?: number }) {
  const { t, lang } = useI18n();
  const { hash } = useLocation();
  const { editor, notify } = useUi();
  const qc = useQueryClient();
  const restore = async (no: number) => {
    await api.restoreVersion(d.id, no);
    await qc.invalidateQueries();
    notify(t('published'));
  };
  const renderVersion = (v: Version) => {
    const current = v.no === d.current?.no;
    return (
      <li key={v.no} className={dc.version} data-current={current || undefined} data-viewing={v.no === viewing || undefined}>
        <span className={dc.vNo}>{versionLabel(v.no, lang)}</span>
        <span className={dc.vBody}>
          <span className={dc.vNote}>{v.note || (lang === 'tr' ? 'İlk yayın' : 'First release')}</span>
          <span className={dc.vMeta}><DateStamp iso={v.createdAt} author={v.author} format="short" />{v.author ? ` · ${v.author}` : ''}</span>
          <span className={dc.vLinks}>
            {v.no !== viewing && <Link to={current ? `/dokuman/${d.id}` : `/dokuman/${d.id}?v=${v.no}`} preventScrollReset replace>{lang === 'tr' ? 'Görüntüle' : 'View'}</Link>}
            <a href={current ? downloadLink(d.id) : downloadLink(d.id, v.no)}>{t('download')}</a>
            {editor && !current && <button onClick={() => restore(v.no)}>{t('restore')}</button>}
          </span>
        </span>
      </li>
    );
  };
  const old = d.versions.filter((v) => v.no !== d.current?.no);
  const viewingOld = viewing != null && viewing !== d.current?.no;
  const [open, setOpen] = useState(hash === '#gecmis' || viewingOld);
  // Eski bir sürüme bağlantıyla gelindiyse liste açık olsun.
  const [wasOld, setWasOld] = useState(viewingOld);
  if (viewingOld !== wasOld) {
    setWasOld(viewingOld);
    if (viewingOld) setOpen(true);
  }
  return (
    <div>
      <ol className={dc.versions}>{d.current && renderVersion(d.current)}</ol>
      {old.length > 0 && (
        <>
          <button className={dc.older} onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="onceki-surumler">
            <span>{lang === 'tr' ? 'Önceki sürümler' : 'Earlier versions'}</span>
            <span className={dc.olderCount}>{old.length}</span>
            <Icon name="chevronDown" size={14} strokeWidth={1.8} className={dc.olderChevron} data-open={open || undefined} />
          </button>
          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                id="onceki-surumler"
                className={dc.olderWrap}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: 'spring', bounce: 0, duration: 0.42 }}
              >
                <ol className={dc.versions} data-older>{old.map(renderVersion)}</ol>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}

function Facts({ d, file, version }: { d: DocDetail; file: FileInfo | null; version?: Version }) {
  const { t, pick, lang } = useI18n();
  const rows: [string, React.ReactNode][] = [];
  if (file) rows.push([t('format'), `${file.ext.toUpperCase()}`]);
  if (file?.pages) rows.push([t('pages'), String(file.pages)]);
  if (file?.width && file.height) rows.push([t('dimensions'), `${file.width} × ${file.height}`]);
  if (file?.durationMs) rows.push([t('duration'), formatDuration(file.durationMs)]);
  const ll = languageLabel(d.language);
  if (ll) rows.push([t('language'), ll]);
  const folder = d.crumbs.at(-1);
  if (folder) rows.push([t('location'), <Link key="l" to={folder.kind === 'machine' ? `/m/${folder.slug}` : `/k/${folder.slug}`}>{pick(folder.name)}</Link>]);
  if (version) rows.push([t('updated'), formatDateTime(version.createdAt, lang)]);
  if (version?.author) rows.push([t('uploadedBy'), version.author]);
  return (
    <dl className={dc.facts}>
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Sürüm değişince yeni dosyanın ilk sayfası hazır olana kadar eski sayfalar ekranda kalır,
 * sonra yeni sürüm tek seferde yerine geçer: boş sayfa ya da yeniden yükleme görünmez.
 */
function StableViewer({ file, doc }: { file: FileInfo; doc: DocDetail }) {
  const [shown, setShown] = useState(file);
  useEffect(() => {
    if (file.id === shown.id && file.cacheKey === shown.cacheKey) return;
    let cancelled = false;
    const src = file.kind === 'pdf' ? pdfPageLink(file) : file.preview ?? file.thumb;
    if (!src) {
      setShown(file);
      return;
    }
    const img = new Image();
    img.src = src;
    img.decode().catch(() => {}).finally(() => { if (!cancelled) setShown(file); });
    return () => { cancelled = true; };
  }, [file, shown.id, shown.cacheKey]);
  return <div key={`${shown.id}:${shown.cacheKey}`} className={`${p.viewerStack} fade-in`}><Viewer file={shown} doc={doc} /></div>;
}

function Viewer({ file, doc }: { file: FileInfo; doc: DocDetail }) {
  const { t, pick } = useI18n();
  const { setLightbox } = useUi();
  const [ratio, setRatio] = useState(1 / 1.414);

  if (file.kind === 'pdf' && file.pages) {
    const shown = Math.min(file.pages, MAX_PAGES);
    return (
      <>
        {Array.from({ length: shown }, (_, i) => i + 1).map((n) => (
          <PdfPage
            key={`${file.id}:${file.cacheKey}:${n}`}
            src={pdfPageLink(file, n)}
            under={n === 1 ? file.thumb : null}
            n={n}
            total={file.pages!}
            ratio={ratio}
            onRatio={n === 1 ? setRatio : undefined}
          />
        ))}
        {file.pages > MAX_PAGES && (
          <div className={p.viewerMore}>
            {file.pages - MAX_PAGES} {t('pages').toLowerCase()} · <a href={downloadLink(doc.id)}>{t('download')}</a>
          </div>
        )}
      </>
    );
  }
  if (file.kind === 'image') {
    return (
      <button className={p.viewerMedia} style={{ aspectRatio: file.width && file.height ? `${file.width} / ${file.height}` : undefined }} onClick={() => setLightbox({ items: [doc], index: 0 })} aria-label={pick(doc.title)}>
        <FadeImage src={file.preview ?? file.raw} eager />
      </button>
    );
  }
  if (file.kind === 'video') {
    return (
      <div className={p.viewerMedia}>
        <video src={file.raw} poster={file.preview ?? undefined} controls playsInline preload="metadata" />
      </div>
    );
  }
  return (
    <div className={p.noPreview}>
      <Icon name="file" size={32} />
      <span>{file.ext.toUpperCase()} · {t('download')}</span>
    </div>
  );
}

/** Sayfa: ilk sayfa morph hedefidir; tam çözünürlük gelene kadar küçük resim altta durur. */
function PdfPage({ src, under, n, total, ratio, onRatio }: { src: string; under: string | null; n: number; total: number; ratio: number; onRatio?: (r: number) => void }) {
  const [own, setOwn] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  return (
    <div
      className={`${p.page_} ${n > 1 ? 'reveal-page' : ''}`}
      style={{ aspectRatio: String(own ?? ratio), viewTransitionName: n === 1 ? 'doc-page' : undefined }}
    >
      {under && <img className={p.pageUnder} src={under} alt="" decoding="sync" />}
      <img
        className={p.pageImg}
        src={src}
        alt={`${n} / ${total}`}
        loading={n <= 2 ? 'eager' : 'lazy'}
        decoding="async"
        data-loaded={loaded || undefined}
        onLoad={(e) => {
          const img = e.currentTarget;
          const r = img.naturalWidth / img.naturalHeight;
          setOwn(r);
          setLoaded(true);
          onRatio?.(r);
        }}
      />
      {total > 1 && <span className={p.pageNo}>{n} / {total}</span>}
    </div>
  );
}
