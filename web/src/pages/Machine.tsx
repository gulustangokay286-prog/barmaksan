import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { Icon } from '../components/Icon';
import { DateStamp } from '../components/DateStamp';
import { MediaGrid, DocThumb, docHref } from '../components/Docs';
import { MachineGallery, MaintenanceBank, ProductOverview } from '../components/MachineContent';
import { MachineSkeleton } from '../components/Skeletons';
import { Crumbs } from '../components/PageHeader';
import { api, downloadLink, type Doc, type MachineContent, type MachineLink } from '../lib/api';
import { VideoLinkEditor, VideoLinkRow, type NewVideoLink } from '../components/VideoLinks';
import { Link } from '../lib/link';
import { useI18n } from '../lib/i18n';
import { useBootstrap, useDocTypes, usePageChrome, useUi } from '../lib/ui';
import { docQuery, folderQuery, prefetchDoc, queryClient } from '../lib/query';
import { useRouteReady } from '../lib/route';
import { markMorph } from '../lib/morph';
import { languageLabel, matchesLanguage, shortTitle } from '../lib/format';
import { useLargeTitle } from '../lib/useLargeTitle';
import NotFound from './NotFound';
import p from './pages.module.css';
import m from './machine.module.css';

const MACHINE_TYPES = ['teknik-fis', 'teknik-cizim', 'spl', 'kullanim-kilavuzu', 'bakim-kilavuzu', 'yaglama-tablosu', 'sertifika'];
/** Teknik fiş ve teknik çizim aynı işi görür: tek kartta, alt alta. */
const TECHNICAL = ['teknik-fis', 'teknik-cizim'];
/** İlk bakışta açık duran kart sayısı; gerisi "Diğer belgeler" altında. */
const VISIBLE_CARDS = 4;

/**
 * Makine sayfası. Solda galeri (yapışık), sağda üstte makinenin adı ve en çok kullanılan iki
 * belgeye tek dokunuşla erişim; altında yapışık bölüm menüsü (kaydırdıkça etkin bölüm işaretlenir)
 * ve içerik. Mobilde sıra: ad, galeri, menü, içerik.
 */
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
  const tr = lang === 'tr';
  if (error) return <NotFound />;
  if (!ready || isLoading || !f) return <MachineSkeleton />;
  const mc = f.machine;
  const profile = f.content?.profiles[code];
  const name = profile?.title || pick(f.name);
  const docs = f.documents.filter((d) => types.get(d.type)?.media === 'document' && matchesLanguage(d.language, code));
  const media = f.documents.filter((d) => types.get(d.type)?.media !== 'document' && matchesLanguage(d.language, code));
  const photos = media.filter((d) => d.current?.file?.kind === 'image');
  const selected = f.content?.gallery != null ? f.content.gallery.map((id) => photos.find((d) => d.id === id)).filter((d): d is Doc => !!d) : photos;
  const bank = f.content?.maintenance ?? [];
  const hasMaintenance = bank.some((c) => c.topics.some((topic) => topic.translations[code]));
  const direction = boot?.languages.find((l) => l.code === code)?.direction ?? 'ltr';
  const technical = TECHNICAL.map((type) => docs.find((d) => d.type === type)).filter((d): d is Doc => !!d);
  const sections = [
    { id: 'genel-bakis', label: tr ? 'Genel bakış' : 'Overview' },
    { id: 'belgeler', label: tr ? 'Belgeler' : 'Documents', count: docs.length },
    ...(hasMaintenance ? [{ id: 'bakim', label: tr ? 'Bakım' : 'Maintenance' }] : []),
    ...(media.length ? [{ id: 'medya', label: tr ? 'Medya' : 'Media' }] : []),
  ];
  // Model adları yalnızca başlıkta zaten geçmiyorsa gösterilir (başlığı tekrar eden satır yok).
  const fold = (s: string) => s.toLocaleLowerCase('tr').replace(/\s+/g, '');
  const models = (mc?.models.length ? mc.models : mc?.modelCode ? [mc.modelCode] : []).filter((x) => !fold(name).includes(fold(x)));

  return <div className={`${p.page} fade-in`}>
    <div className={m.layout}>
      <header className={m.head}>
        <Crumbs items={f.crumbs.slice(0, -1)} />
        <h1 ref={titleRef} className={m.title}>{name}</h1>
        {(models.length > 0 || profile?.updatedAt) && <p className={m.meta}>
          {models.length > 0 && <span>{models.join(' · ')}</span>}
          {profile?.updatedAt && <span>{tr ? 'Güncellendi' : 'Updated'} <DateStamp iso={profile.updatedAt} author={profile.author} format="short" action="update" /></span>}
        </p>}
      </header>
      <aside className={m.aside}>
        <MachineGallery photos={selected} cover={mc?.cover ?? null} name={name} />
      </aside>
      <div className={m.main} dir={direction} lang={code}>
        <div className={m.toolbar}>
          <SectionNav sections={sections} />
          <div className={m.tools}>
            {technical.length > 0 && <TechnicalMenu docs={technical} />}
            <ShareButton title={name} />
          </div>
        </div>
        <ProductOverview profile={profile} />
        <section id="belgeler" className={m.block}>
          <h2 className={m.h2}>{tr ? 'Belgeler' : 'Documents'}</h2>
          <DocCards key={code} docs={docs} machine={name} slug={f.slug} content={f.content} all={f.documents} />
          {!docs.length && <p className={m.empty}>{tr ? 'Bu dilde belge eklenmemiş.' : 'No documents have been added in this language.'}</p>}
        </section>
        {hasMaintenance && <MaintenanceBank categories={bank} code={code} documents={f.documents} />}
        {!!media.length && <section id="medya" className={m.block}><h2 className={m.h2}>{tr ? 'Fotoğraf ve video' : 'Photos and videos'}</h2><MediaGrid items={media} columns="dense" /></section>}
      </div>
    </div>
  </div>;
}

/**
 * Teknik fiş ve çizim tek düğmede: tıklayınca ikisi alt alta açılır (aç / indir). Tek belge
 * varsa doğrudan onu açar.
 */
function TechnicalMenu({ docs }: { docs: Doc[] }) {
  const { t, pick, lang } = useI18n();
  const types = useDocTypes();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const label = lang === 'tr' ? 'Teknik Fiş & Çizim' : 'Sheet & Drawing';
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  if (docs.length === 1) {
    const d = docs[0];
    return <Link to={docHref(d)} viewTransition className={m.primary} onPointerEnter={() => prefetchDoc(d.id, d.current?.file?.id, d.current?.file?.kind)}><Icon name="drawing" size={17} strokeWidth={1.6} /><span>{pick(types.get(d.type)?.name)}</span></Link>;
  }
  return (
    <div ref={ref} className={m.menuWrap}>
      <button className={m.primary} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
        <Icon name="drawing" size={17} strokeWidth={1.6} />
        <span>{label}</span>
        <Icon name="chevronDown" size={14} strokeWidth={1.8} className={m.caret} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className={m.menu}
            role="menu"
            initial={{ opacity: 0, scale: 0.92, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4, transition: { duration: 0.14 } }}
            transition={{ type: 'spring', bounce: 0.28, duration: 0.42 }}
          >
            {docs.map((d) => (
              <div key={d.id} className={m.menuRow}>
                <Link to={docHref(d)} viewTransition role="menuitem" className={m.menuLink} onClick={() => setOpen(false)} onPointerEnter={() => prefetchDoc(d.id, d.current?.file?.id, d.current?.file?.kind)}>
                  <DocThumb doc={d} size="sm" />
                  <span>
                    <strong>{pick(types.get(d.type)?.name)}</strong>
                    {d.current && <small>{lang === 'tr' ? `Versiyon ${d.current.no} · Güncel` : `Version ${d.current.no} · Current`}{languageLabel(d.language) ? ` · ${languageLabel(d.language)}` : ''}</small>}
                  </span>
                </Link>
                <a className={m.iconBtn} href={downloadLink(d.id)} aria-label={`${t('download')}: ${pick(d.title)}`} title={t('download')}><Icon name="download" size={17} /></a>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Paylaş: telefonda sistemin paylaşım sayfası, masaüstünde bağlantıyı kopyalar. */
function ShareButton({ title }: { title: string }) {
  const { lang } = useI18n();
  const { notify } = useUi();
  const share = async () => {
    const url = window.location.href.split('#')[0];
    if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
      try { await navigator.share({ title, url }); } catch { /* vazgeçildi */ }
      return;
    }
    try { await navigator.clipboard.writeText(url); notify(lang === 'tr' ? 'Bağlantı kopyalandı' : 'Link copied'); } catch { /* izin yok */ }
  };
  return (
    <button className={m.secondary} onClick={() => void share()} aria-label={lang === 'tr' ? 'Paylaş' : 'Share'} title={lang === 'tr' ? 'Paylaş' : 'Share'}>
      <Icon name="share" size={17} strokeWidth={1.6} />
    </button>
  );
}

/** Bölüm menüsü: kaydırdıkça etkin bölümün altında hap yaylı kayar. */
function SectionNav({ sections }: { sections: { id: string; label: string; count?: number }[] }) {
  const { lang } = useI18n();
  const [active, setActive] = useState(sections[0]?.id);
  const ids = sections.map((sec) => sec.id).join(',');
  // Etkin bölüm: üst çizgiyi (bar + menü) geçmiş son bölüm; sayfa dibindeyse sonuncusu.
  useEffect(() => {
    const targets = ids.split(',').map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bar-h')) || 56) + 96;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      let current = targets[0]?.id;
      for (const el of targets) if (el.getBoundingClientRect().top <= line) current = el.id;
      if (atBottom && targets.length) current = targets[targets.length - 1].id;
      if (current) setActive(current);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(frame); };
  }, [ids]);
  return (
    <nav className={m.sections} aria-label={lang === 'tr' ? 'Makine bölümleri' : 'Machine sections'}>
      {sections.map((sec) => (
        <a key={sec.id} href={`#${sec.id}`} data-active={sec.id === active || undefined} aria-current={sec.id === active ? 'location' : undefined} onClick={() => setActive(sec.id)}>
          {sec.id === active && <motion.span layoutId="section-pill" className={m.sectionPill} transition={{ type: 'spring', bounce: 0.25, duration: 0.5 }} />}
          <span>{sec.label}</span>
        </a>
      ))}
    </nav>
  );
}

type Card = { key: string; title: string; icon: string; docs: Doc[]; types: string[] };

/**
 * Belgeler: tür başına bir kart (teknik fiş + çizim tek kartta). İlk kartlar açık, gerisi
 * "Diğer belgeler" altında. Her belgenin güncel sürümü açıkça işaretli; eski sürümler kartın
 * içinde, istenince açılır.
 */
function DocCards({ docs, machine, slug, content, all }: { docs: Doc[]; machine: string; slug: string; content: MachineContent | null; all: Doc[] }) {
  const { t, pick, lang } = useI18n();
  const types = useDocTypes();
  const { editor, setUpload, notify } = useUi();
  const [more, setMore] = useState(false);
  const tr = lang === 'tr';
  const order = [...types.keys()];
  const byType = new Map<string, Doc[]>();
  for (const d of docs) byType.set(d.type, [...(byType.get(d.type) ?? []), d]);
  const technical = TECHNICAL.flatMap((type) => byType.get(type) ?? []);
  const cards: Card[] = [];
  if (technical.length) cards.push({ key: 'teknik', title: tr ? 'Teknik Fiş & Çizim' : 'Technical Sheet & Drawing', icon: 'drawing', docs: technical, types: TECHNICAL });
  for (const [type, list] of [...byType.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))) {
    if (TECHNICAL.includes(type)) continue;
    const info = types.get(type);
    cards.push({ key: type, title: pick(info?.name) || type, icon: info?.icon ?? 'file', docs: list, types: [type] });
  }
  const shown = cards.slice(0, VISIBLE_CARDS);
  const hidden = cards.slice(VISIBLE_CARDS);
  const missing = MACHINE_TYPES.filter((type) => !byType.has(type));
  const links = content?.links ?? [];
  const [adding, setAdding] = useState<Card | null>(null);
  const saveLinks = async (next: MachineLink[]) => {
    await api.saveMachineLinks(slug, content?.revision ?? 0, next);
    await queryClient.invalidateQueries({ queryKey: folderQuery(slug).queryKey });
  };
  const addLink = async (card: Card, value: NewVideoLink) => {
    let document: string | null = null;
    if ('file' in value) {
      const form = new FormData();
      form.set('file', value.file);
      form.set('folder', slug);
      form.set('type', 'video');
      form.set('titleTr', value.title || value.file.name);
      form.set('language', 'none');
      document = (await api.createDocument(form)).publicId;
    }
    const id = `v${Date.now().toString(36)}`;
    await saveLinks([...links, { id, type: card.types[0], title: value.title, url: 'url' in value ? value.url : null, document }]);
    notify(tr ? 'Video eklendi' : 'Video added');
  };
  const removeLink = async (id: string) => {
    await saveLinks(links.filter((l) => l.id !== id));
    notify(tr ? 'Video kaldırıldı' : 'Video removed');
  };
  const cardProps = (card: Card) => ({
    card, machine, all,
    links: links.filter((l) => card.types.includes(l.type)),
    onAdd: editor ? () => setAdding(card) : undefined,
    onRemove: editor ? (id: string) => void removeLink(id) : undefined,
  });

  return (
    <>
      <div className={m.cards}>
        {shown.map((card) => <DocCard key={card.key} {...cardProps(card)} />)}
      </div>
      {hidden.length > 0 && (
        <>
          <AnimatePresence initial={false}>
            {more && (
              <motion.div
                className={m.moreWrap}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: 'spring', bounce: 0.12, duration: 0.55 }}
              >
                <div className={m.cards}>{hidden.map((card) => <DocCard key={card.key} {...cardProps(card)} />)}</div>
              </motion.div>
            )}
          </AnimatePresence>
          <button className={m.moreBtn} onClick={() => setMore((v) => !v)} aria-expanded={more}>
            <span>{more ? (tr ? 'Daha az göster' : 'Show less') : (tr ? `Diğer belgeler · ${hidden.length}` : `More documents · ${hidden.length}`)}</span>
            <Icon name="chevronDown" size={15} strokeWidth={1.8} style={{ transform: more ? 'rotate(180deg)' : undefined }} />
          </button>
        </>
      )}
      {editor && missing.length > 0 && (
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
      <AnimatePresence>{adding && <VideoLinkEditor onClose={() => setAdding(null)} onSave={(value) => addLink(adding, value)} />}</AnimatePresence>
    </>
  );
}

function DocCard({ card, machine, all, links, onAdd, onRemove }: { card: Card; machine: string; all: Doc[]; links: MachineLink[]; onAdd?: () => void; onRemove?: (id: string) => void }) {
  const { pick, lang } = useI18n();
  // Tek belgeli kartta belgenin adı zaten türün adıysa üst başlık tekrar olur: gösterilmez.
  const plain = card.docs.length === 1 && (shortTitle(pick(card.docs[0].title), machine) || card.title).toLocaleLowerCase('tr').startsWith(card.title.toLocaleLowerCase('tr'));
  return (
    <article className={m.card}>
      {!plain && <h3 className={m.cardHead}><Icon name={card.icon} size={18} strokeWidth={1.5} /><span>{card.title}</span></h3>}
      <ul className={m.cardList}>
        {card.docs.map((d) => <DocItem key={d.id} doc={d} machine={machine} />)}
      </ul>
      {links.map((l) => <VideoLinkRow key={l.id} link={l} doc={l.document ? all.find((d) => d.id === l.document) : undefined} onRemove={onRemove ? () => onRemove(l.id) : undefined} />)}
      {onAdd && <button className={m.addVideo} onClick={onAdd}><Icon name="plus" size={14} strokeWidth={1.7} />{lang === 'tr' ? 'Video ekle' : 'Add video'}</button>}
    </article>
  );
}

function DocItem({ doc, machine }: { doc: Doc; machine: string }) {
  const { t, pick, lang } = useI18n();
  const types = useDocTypes();
  const [open, setOpen] = useState(false);
  const tr = lang === 'tr';
  const v = doc.current;
  const typeName = pick(types.get(doc.type)?.name);
  const title = shortTitle(pick(doc.title), machine) || typeName;
  const older = doc.versionCount - 1;
  const language = languageLabel(doc.language);
  return (
    <li className={m.item}>
      <div className={m.itemRow}>
        <Link
          to={docHref(doc)}
          viewTransition
          className={m.itemLink}
          onPointerEnter={() => prefetchDoc(doc.id, v?.file?.id, v?.file?.kind)}
          onFocus={() => prefetchDoc(doc.id, v?.file?.id, v?.file?.kind)}
          onClick={(e) => markMorph(e.currentTarget.querySelector('[data-morph]'), 'doc-page')}
        >
          <DocThumb doc={doc} size="sm" />
          <span className={m.itemText}>
            <span className={m.itemName}>{title}</span>
            <span className={m.itemMeta}>
              {v && <span className={m.current}>{tr ? `Versiyon ${v.no} · Güncel` : `Version ${v.no} · Current`}</span>}
              {language && <span>{language}</span>}
              {v && <DateStamp iso={v.createdAt} author={v.author} />}
            </span>
          </span>
        </Link>
        <a className={m.iconBtn} href={downloadLink(doc.id)} aria-label={`${t('download')}: ${pick(doc.title)}`} title={t('download')}>
          <Icon name="download" size={17} />
        </a>
      </div>
      {older > 0 && (
        <>
          <button className={m.olderBtn} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            <Icon name="history" size={14} strokeWidth={1.7} />
            <span>{tr ? `${older} eski sürüm` : `${older} older version${older > 1 ? 's' : ''}`}</span>
            <Icon name="chevronDown" size={13} strokeWidth={1.8} style={{ transform: open ? 'rotate(180deg)' : undefined }} />
          </button>
          <AnimatePresence initial={false}>
            {open && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: 'spring', bounce: 0.1, duration: 0.45 }} style={{ overflow: 'hidden' }}>
                <ArchivedVersions doc={doc} />
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </li>
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
            <span>{lang === 'tr' ? `Versiyon ${version.no}` : `Version ${version.no}`}</span>
            <span>{version.note || (lang === 'tr' ? 'Önceki sürüm' : 'Previous version')}</span>
            <DateStamp iso={version.createdAt} author={version.author} format="short" className={m.dim} />
          </Link>
          <a className={m.iconBtn} href={downloadLink(doc.id, version.no)} aria-label={`${t('download')}: ${lang === 'tr' ? 'Versiyon' : 'Version'} ${version.no}`} title={t('download')}><Icon name="download" size={16} /></a>
        </li>
      ))}
    </ul>
  );
}
