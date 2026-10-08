import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion, useMotionValueEvent, useTransform, type MotionValue, type Variants } from 'motion/react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { DocThumb, MachineTile, docHref } from '../components/Docs';
import { Hero, type Phases } from '../components/Hero';
import { SearchTrigger } from '../components/SearchTrigger';
import { VersionTag } from '../components/ui';
import { topSearchReveal } from '../lib/reveal';
import type { Doc } from '../lib/api';
import { Link } from '../lib/link';
import { useI18n } from '../lib/i18n';
import { useBootstrap, useChromeActions, useDocTypes, usePageChrome } from '../lib/ui';
import { folderQuery, prefetchDoc, prefetchFolder, recentQuery } from '../lib/query';
import { useSectionSettle } from '../lib/settle';
import { markMorph } from '../lib/morph';
import { formatNumber, formatRelative } from '../lib/format';
import h from './home.module.css';
import p from './pages.module.css';

const ICONS: Record<string, string> = {
  sertifikalar: 'seal', kataloglar: 'catalog', 'sirket-profilleri': 'building', 'musteri-dosyalari': 'send',
  'tanitim-videolari': 'video', 'fabrika-fotograflari': 'photo', 'drone-cekimleri': 'images', 'urun-gorselleri': 'photo',
};

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const ease = [0.22, 1, 0.36, 1] as const;

export default function Home() {
  const { t } = useI18n();
  const { data: boot } = useBootstrap();
  usePageChrome(t('library'));
  useSectionSettle();

  const { categories, collections } = useMemo(() => {
    const tree = boot?.tree ?? [];
    const kids = (id: number) => tree.filter((n) => n.parentId === id);
    const root = (slug: string) => tree.find((n) => n.slug === slug && n.parentId === null);
    const machinesRoot = root('makineler');
    const cats = machinesRoot ? kids(machinesRoot.id).map((c) => ({ ...c, machines: kids(c.id) })) : [];
    const corp = root('kurumsal');
    const med = root('medya');
    return {
      categories: cats,
      collections: [
        ...(corp ? kids(corp.id).map((c) => ({ ...c, group: 'kurumsal' as const })) : []),
        ...(med ? kids(med.id).map((c) => ({ ...c, group: 'medya' as const })) : []),
      ],
    };
  }, [boot]);

  return (
    <>
      <Hero>{(progress, phases) => <HeroContent progress={progress} phases={phases} />}</Hero>

      {/* İçerik sayfası: carousel'den sonra alttan yükselip sahnenin üstüne kapanır. */}
      <div className={h.sheet} data-settle>
        <div className={h.sheetInner}>
          <RecentSection />
          <MachinesSection categories={categories} />
          <CorporateSection collections={collections.filter((c) => c.group === 'kurumsal')} />
          <MediaSection collections={collections.filter((c) => c.group === 'medya')} />
        </div>
      </div>
    </>
  );
}

// ── Giriş metni ─────────────────────────────────────────────────────────────

function HeroContent({ progress, phases }: { progress: MotionValue<number>; phases: Phases }) {
  const { t, lang } = useI18n();
  const { data: boot } = useBootstrap();
  const { setTitleVisible } = useChromeActions();
  // Metin, carousel ortaya inerken sola çekilip söner (carousel'den önce yol açar).
  const fadeEnd = phases.move + (phases.lock - phases.move) * 0.55;
  const opacity = useTransform(progress, [phases.move, fadeEnd], [1, 0]);
  const x = useTransform(progress, [phases.move, fadeEnd], [0, -64]);
  const pointerEvents = useTransform(opacity, (v) => (v < 0.4 ? 'none' : 'auto'));

  // Büyük arama söndükçe üst bardaki arama belirir (arama hiç kaybolmaz).
  const reveal = (v: number) => clamp((v - phases.move) / (fadeEnd - phases.move));
  useMotionValueEvent(progress, 'change', (v) => {
    topSearchReveal.set(reveal(v));
    setTitleVisible(v < fadeEnd);
  });
  useEffect(() => {
    topSearchReveal.set(reveal(progress.get()));
    return () => {
      topSearchReveal.set(1);
      setTitleVisible(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, setTitleVisible, phases]);

  const machines = boot ? formatNumber(boot.stats.machines, lang) : '42';
  const lead = lang === 'tr'
    ? <>Barmaksan Uğur Promilling’in <b>{machines} makinesine</b> ve şirketine ait bütün dosyalar tek yerde: teknik fiş, çizim, yedek parça listesi, kılavuz, sertifika, katalog, fotoğraf ve video. Her dosya <b>her zaman en güncel sürümüyle</b> açılır; paylaştığınız bağlantı hep doğru dosyayı gösterir.</>
    : <>Every file for Barmaksan Uğur Promilling’s <b>{machines} machines</b> and the company in one place: technical sheets, drawings, spare part lists, manuals, certificates, catalogues, photos and films. Every file <b>always opens in its latest version</b>; a shared link always shows the right file.</>;

  return (
    <motion.div className={h.heroContent} data-reveal-host style={{ opacity, x, pointerEvents }}>
      <h1 className={h.heroTitle}>{t('library')}</h1>
      <p className={h.heroLead}>{lead}</p>
      <div className={h.heroSearchWrap}>
        <SearchTrigger variant="hero" />
      </div>
      {boot && (
        <dl className={h.heroStats}>
          <div><dt>{t('machine')}</dt><dd>{formatNumber(boot.stats.machines, lang)}</dd></div>
          <div><dt>{t('documents')}</dt><dd>{formatNumber(boot.stats.documents, lang)}</dd></div>
          <div><dt>{t('versions')}</dt><dd>{formatNumber(boot.stats.versions, lang)}</dd></div>
          <div><dt>{t('mediaItems')}</dt><dd>{formatNumber(boot.stats.media, lang)}</dd></div>
        </dl>
      )}
    </motion.div>
  );
}

// ── Bölüm başlığı ───────────────────────────────────────────────────────────

function SectionHead({ title, count, lead, link }: { title: string; count?: number | null; lead?: ReactNode; link?: { to: string; label: string } }) {
  return (
    <motion.header
      className={h.head}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: 0.7, ease }}
    >
      <div className={h.headMain}>
        <h2 className={h.headTitle}>
          {title}
          {count != null && <span className={h.headCount}>{count}</span>}
        </h2>
        {lead && <p className={h.headLead}>{lead}</p>}
      </div>
      {link && (
        <Link to={link.to} className={h.headLink}>
          {link.label}
          <Icon name="arrowRight" size={15} />
        </Link>
      )}
    </motion.header>
  );
}

// ── 01 · Son güncellenenler ────────────────────────────────────────────────
// Sayfa yükselirken satırlar sırayla, hafif derinlikten gelir.

const listIn: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } } };
const rowIn: Variants = {
  hidden: { opacity: 0, y: 26, rotateX: -10 },
  show: { opacity: 1, y: 0, rotateX: 0, transition: { duration: 0.75, ease } },
};

function RecentSection() {
  const { t, lang } = useI18n();
  const recent = useQuery(recentQuery(6));
  const week = useMemo(() => {
    const now = Date.now();
    return (recent.data ?? []).filter((d) => d.current && now - Date.parse(d.current.createdAt) < 7 * 86_400_000).length;
  }, [recent.data]);

  return (
    <section className={h.section}>
      <div className={h.recentGrid}>
        <div className={h.recentAside}>
          <SectionHead
            title={t('recent')}
            lead={lang === 'tr'
              ? 'Yeni yüklenen ve yeni sürümü yayınlanan dosyalar. Listedeki her dosya, o belgenin en güncel hâlidir.'
              : 'Newly uploaded files and new versions. Every file listed is the latest version of that document.'}
            link={{ to: '/son', label: lang === 'tr' ? 'Bütün güncellemeler' : 'All updates' }}
          />
          {recent.data && (
            <motion.p className={h.recentStat} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.25 }}>
              <b className="tabular">{week}</b>
              <span>{lang === 'tr' ? 'güncelleme, son 7 günde' : 'updates in the last 7 days'}</span>
            </motion.p>
          )}
        </div>
        {recent.data ? (
          <motion.ol className={h.recentList} variants={listIn} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}>
            {recent.data.map((d, i) => (
              <motion.li key={d.id} variants={rowIn}>
                <RecentRow doc={d} n={i + 1} />
              </motion.li>
            ))}
          </motion.ol>
        ) : (
          <ol className={h.recentList} aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i} className={h.recentSkel} style={{ ['--i' as string]: i }}>
                <span className="skeleton" style={{ width: 44, height: 58, borderRadius: 6 }} />
                <span style={{ flex: 1, display: 'grid', gap: 8 }}>
                  <span className="skeleton" style={{ height: 14, width: `${70 - i * 6}%` }} />
                  <span className="skeleton" style={{ height: 10, width: '34%' }} />
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function RecentRow({ doc, n }: { doc: Doc; n: number }) {
  const { pick, lang } = useI18n();
  const types = useDocTypes();
  const v = doc.current;
  const type = types.get(doc.type);
  return (
    <Link
      to={docHref(doc)}
      viewTransition
      className={h.recentRow}
      onPointerEnter={() => prefetchDoc(doc.id, v?.file?.id, v?.file?.kind)}
      onFocus={() => prefetchDoc(doc.id, v?.file?.id, v?.file?.kind)}
      onClick={(e) => markMorph(e.currentTarget.querySelector('[data-morph]'), 'doc-page')}
    >
      <span className={h.recentN}>{String(n).padStart(2, '0')}</span>
      <DocThumb doc={doc} />
      <span className={h.recentBody}>
        <span className={h.recentTitle}>{pick(doc.title)}</span>
        <span className={h.recentMeta}>
          {type && <span>{pick(type.name)}</span>}
          <span>{pick(doc.folder.name)}</span>
        </span>
      </span>
      {v && (
        <span className={h.recentSide}>
          {type?.versioned ? <VersionTag no={v.no} /> : <span>{v.file?.ext.toUpperCase()}</span>}
          <span className={h.recentDate}>{formatRelative(v.createdAt, lang)}</span>
        </span>
      )}
      <span className={h.recentArrow}><Icon name="arrowRight" size={16} /></span>
    </Link>
  );
}

// ── 02 · Makineler ──────────────────────────────────────────────────────────
// Solda yapışık kategori dizini (kaydırdıkça bulunulan kategori), sağda makine kartları.

type Category = { id: number; slug: string; name: { tr: string; en: string | null }; machines: { id: number; slug: string; name: { tr: string; en: string | null }; modelCode: string | null; cover: string | null }[] };

function MachinesSection({ categories }: { categories: Category[] }) {
  const { t, pick, lang } = useI18n();
  const [active, setActive] = useState(categories[0]?.slug ?? '');
  const blocks = useRef(new Map<string, HTMLElement>());
  const lock = useRef(0);
  const total = categories.reduce((n, c) => n + c.machines.length, 0);

  useEffect(() => {
    if (!categories.length) return;
    setActive((a) => a || categories[0].slug);
    const bar = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--bar-h'), 10) || 56;
    const io = new IntersectionObserver((entries) => {
      if (Date.now() < lock.current) return;
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive((visible[0].target as HTMLElement).dataset.slug!);
    }, { rootMargin: `-${bar + 40}px 0px -55% 0px` });
    blocks.current.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [categories]);

  const goTo = (slug: string) => {
    setActive(slug);
    lock.current = Date.now() + 900;
    blocks.current.get(slug)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className={h.section} data-settle>
      <SectionHead
        title={t('machines')}
        count={total || null}
        lead={lang === 'tr'
          ? 'Un, irmik ve bakliyat tesisleri için temizleme, öğütme, taşıma ve paketleme makineleri. Bir makineyi açın; teknik fişi, çizimleri ve kılavuzları tek sayfada.'
          : 'Cleaning, milling, conveying and packing machines for flour, semolina and pulse plants. Open a machine to see its sheet, drawings and manuals on one page.'}
        link={{ to: '/k/makineler', label: lang === 'tr' ? 'Bütün makineler' : 'All machines' }}
      />
      <div className={h.machinesGrid}>
        <nav className={h.catIndex} aria-label={t('machines')}>
          <ul>
            {categories.map((c) => (
              <li key={c.id}>
                <button className={h.catLink} data-active={active === c.slug || undefined} onClick={() => goTo(c.slug)} aria-current={active === c.slug ? 'true' : undefined}>
                  <span>{pick(c.name)}</span>
                  <span className={h.catCount}>{c.machines.length}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className={h.catBlocks}>
          {categories.map((c) => (
            <div
              key={c.id}
              className={h.cat}
              data-slug={c.slug}
              data-settle
              ref={(el) => { if (el) blocks.current.set(c.slug, el); else blocks.current.delete(c.slug); }}
            >
              <Link to={`/k/${c.slug}`} className={h.catHead}>
                <h3>{pick(c.name)}</h3>
                <span className={h.catCount}>{c.machines.length}</span>
                <Icon name="chevronRight" size={14} />
              </Link>
              <ul className={`${p.tiles} ${h.tiles}`}>
                {c.machines.map((m) => <MachineTile key={m.id} m={m} />)}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Kurumsal: her koleksiyon, içindeki gerçek belgelerin ilk sayfalarından bir deste ──
// Üzerine gelince deste yelpaze gibi açılır; içerik kendini gösterir, ikon taklidi yok.

type Collection = { id: number; slug: string; name: { tr: string; en: string | null }; docCount: number; group: 'kurumsal' | 'medya' };

const COPY: Record<string, { tr: string; en: string }> = {
  sertifikalar: { tr: 'CE uygunluk beyanları ve kalite belgeleri', en: 'CE declarations and quality certificates' },
  kataloglar: { tr: 'Makine, yedek parça ve referans katalogları', en: 'Machine, spare part and reference catalogues' },
  'sirket-profilleri': { tr: 'Şirketi tanıtan sunum ve profiller', en: 'Company presentations and profiles' },
  'musteri-dosyalari': { tr: 'Teklif ve projelerde müşteriye giden dosyalar', en: 'Files sent to customers with offers and projects' },
  'tanitim-videolari': { tr: 'Tanıtım filmleri', en: 'Promotional films' },
  'fabrika-fotograflari': { tr: 'Üretim tesisi, montaj ve son kontrol', en: 'Production campus, assembly and inspection' },
  'drone-cekimleri': { tr: 'Tesis ve kurulumlar, havadan', en: 'Plant and installations from above' },
  'urun-gorselleri': { tr: 'Makinelerin stüdyo görselleri', en: 'Studio images of the machines' },
};

function useCollectionDocs(slugs: string[]) {
  const results = useQueries({ queries: slugs.map((slug) => folderQuery(slug)) });
  return slugs.map((slug, i) => ({ slug, docs: results[i]?.data?.documents }));
}

const cardsIn: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const cardIn: Variants = { hidden: { opacity: 0, y: 28 }, show: { opacity: 1, y: 0, transition: { duration: 0.8, ease } } };

function CorporateSection({ collections }: { collections: Collection[] }) {
  const { lang } = useI18n();
  const docs = useCollectionDocs(collections.map((c) => c.slug));
  return (
    <section className={h.section} data-settle>
      <SectionHead
        title={lang === 'tr' ? 'Kurumsal' : 'Corporate'}
        lead={lang === 'tr'
          ? 'Sertifikalar, kataloglar, şirket profilleri ve müşteriye gönderilecek dosyalar; hepsi en güncel sürümüyle.'
          : 'Certificates, catalogues, company profiles and files for customers; all in their latest version.'}
      />
      <motion.ul className={h.stacks} variants={cardsIn} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}>
        {collections.map((c, i) => (
          <motion.li key={c.id} variants={cardIn}>
            <StackCard c={c} docs={docs[i]?.docs} />
          </motion.li>
        ))}
      </motion.ul>
    </section>
  );
}

function StackCard({ c, docs }: { c: Collection; docs?: Doc[] }) {
  const { pick, lang } = useI18n();
  const pages = (docs ?? []).filter((d) => d.current?.file?.thumb).slice(0, 3);
  const copy = COPY[c.slug];
  return (
    <Link to={`/k/${c.slug}`} className={h.stack} onPointerEnter={() => prefetchFolder(c.slug)}>
      <span className={h.stackStage} data-count={pages.length}>
        {!docs && <span className={`skeleton ${h.stackSkel}`} />}
        {docs && pages.length === 0 && <span className={h.stackEmpty}><Icon name={ICONS[c.slug] ?? 'folder'} size={28} /></span>}
        {/* Arkadan öne: son eleman en üstte durur. */}
        {[...pages].reverse().map((d) => {
          const pos = pages.indexOf(d);
          return (
            <span key={d.id} className={h.stackPage} data-pos={pos}>
              <img src={d.current!.file!.thumb!} alt="" loading="lazy" decoding="async" draggable={false} />
            </span>
          );
        })}
      </span>
      <span className={h.stackBody}>
        <span className={h.stackName}>
          {pick(c.name)}
          <Icon name="arrowRight" size={15} className={h.stackArrow} />
        </span>
        {copy && <span className={h.stackDesc}>{copy[lang]}</span>}
        <span className={h.stackCount}>{c.docCount} {lang === 'tr' ? 'belge' : 'documents'}</span>
      </span>
    </Link>
  );
}

// ── Medya: koleksiyonlar kendi görselleriyle, bento ızgarada ────────────────

function MediaSection({ collections }: { collections: Collection[] }) {
  const { t, lang } = useI18n();
  const { data: boot } = useBootstrap();
  // En kalabalık koleksiyon büyük karede.
  const ordered = useMemo(() => [...collections].sort((a, b) => b.docCount - a.docCount), [collections]);
  const docs = useCollectionDocs(ordered.map((c) => c.slug));
  return (
    <section className={h.section} data-settle>
      <SectionHead
        title={lang === 'tr' ? 'Medya' : 'Media'}
        count={boot?.stats.media ?? null}
        lead={lang === 'tr'
          ? 'Fotoğraflar ve filmler, orijinal çözünürlükte. Hiçbiri sıkıştırılmaz; indirdiğiniz dosya çekilen dosyadır.'
          : 'Photos and films in original resolution. Nothing is compressed; what you download is what was shot.'}
        link={{ to: '/medya', label: t('mediaLibrary') }}
      />
      <motion.ul className={h.bento} variants={cardsIn} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }}>
        {ordered.map((c, i) => (
          <motion.li key={c.id} variants={cardIn}>
            <MediaTile c={c} docs={docs[i]?.docs} large={i === 0} />
          </motion.li>
        ))}
      </motion.ul>
    </section>
  );
}

function MediaTile({ c, docs, large }: { c: Collection; docs?: Doc[]; large: boolean }) {
  const { pick, lang } = useI18n();
  const cover = docs?.map((d) => d.current?.file).find((f) => f?.thumb);
  const src = large ? (cover?.preview ?? cover?.thumb) : cover?.thumb;
  const videos = docs?.filter((d) => d.current?.file?.kind === 'video').length ?? 0;
  const isVideo = videos > 0 && videos === docs?.length;
  const copy = COPY[c.slug];
  return (
    <Link to={`/k/${c.slug}`} className={h.tile} data-large={large || undefined} onPointerEnter={() => prefetchFolder(c.slug)}>
      {src ? <img className={h.tileImg} src={src} alt="" loading="lazy" decoding="async" draggable={false} /> : <span className={`skeleton ${h.tileSkel}`} />}
      {isVideo && <span className={h.tilePlay}><Icon name="play" size={16} strokeWidth={1.6} /></span>}
      <span className={h.tileLabel}>
        <span className={h.tileName}>{pick(c.name)}</span>
        <span className={h.tileMeta}>
          {c.docCount} {isVideo ? (lang === 'tr' ? 'film' : 'films') : (lang === 'tr' ? 'görsel' : 'images')}
          {large && copy ? ` · ${copy[lang]}` : ''}
        </span>
      </span>
    </Link>
  );
}
