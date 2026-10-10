import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useLocation } from 'react-router';
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from 'motion/react';
import { Icon } from './Icon';
import { DateStamp } from './DateStamp';
import { CollapsibleFolder } from './CollapsibleFolder';
import { useI18n } from '../lib/i18n';
import { useUi } from '../lib/ui';
import { useViewportActive } from '../lib/viewport';
import { Link } from '../lib/link';
import { type Doc, type FileInfo, type MachineProfile, type MaintenanceCategory, pdfPageLink } from '../lib/api';
import s from './MachineContent.module.css';

// ── Makine galerisi ─────────────────────────────────────────────────────────
// Ana sayfadaki hero'nun dili: etkin görsel yavaşça yakınlaşıp kayar (Ken Burns). Geçişte yeni
// görsel geldiği yönden bir perde gibi açılır, içindeki fotoğraf yaylı (hafif zıplayan) bir
// yaklaşmayla oturur; giden görsel paralaksla geri çekilir. Görsel çözülmeden (decode) geçiş
// başlamaz: yarım yüklenmiş kare ya da köşede beyaz parlama olmaz. Yalnızca transform, opacity
// ve clip-path; bulanıklık filtresi yok. Otomatik ilerleme, oynat düğmesindeki halkanın kendi
// animasyonuna bağlı: halka dolunca sıradaki görsele geçilir, durunca galeri de durur.

const GALLERY_MS = 5200;
const decoded = new Map<string, Promise<void>>();
/** Görseli indirip çözer; aynı adres için tek söz (promise). */
function decodeImage(src: string) {
  let ready = decoded.get(src);
  if (!ready) {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    ready = img.decode().catch(() => undefined);
    decoded.set(src, ready);
  }
  return ready;
}
const sourceOf = (file: FileInfo) => (file.kind === 'pdf' ? pdfPageLink(file) : file.preview ?? file.thumb ?? file.raw);
const isWide = (file?: FileInfo | null) => !!(file?.width && file.height && file.width / file.height > 1.5);
const EASE_SHEET: [number, number, number, number] = [0.32, 0.72, 0, 1];

const slideVariants = {
  enter: (d: number) => ({ clipPath: d > 0 ? 'inset(0% 0% 0% 100% round 18px)' : 'inset(0% 100% 0% 0% round 18px)', zIndex: 2 }),
  center: { clipPath: 'inset(0% 0% 0% 0% round 18px)', zIndex: 2, transition: { duration: 0.78, ease: EASE_SHEET } },
  exit: { zIndex: 1, transition: { duration: 0.78 } },
};
const imageVariants = {
  enter: (d: number) => ({ x: `${d * 26}%`, scale: 1.16, opacity: 1 }),
  center: { x: '0%', scale: 1, opacity: 1, transition: { type: 'spring' as const, bounce: 0.34, duration: 0.95 } },
  exit: (d: number) => ({ x: `${d * -18}%`, scale: 0.94, opacity: 0.45, transition: { duration: 0.78, ease: EASE_SHEET } }),
};
const fadeVariants = {
  enter: { opacity: 0 },
  center: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

export function MachineGallery({ photos, cover, name }: { photos: Doc[]; cover: FileInfo | null; name: string }) {
  const { lang } = useI18n();
  const tr = lang === 'tr';
  const { lightbox, setLightbox } = useUi();
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const inView = useViewportActive(rootRef);
  const [{ index, dir }, setShown] = useState({ index: 0, dir: 1 });
  const [playing, setPlaying] = useState(true);
  const [hold, setHold] = useState(false);
  const ticket = useRef(0);
  const drag = useRef<{ x: number; t: number; moved: boolean } | null>(null);
  const dragX = useMotionValue(0);
  const suppressClick = useRef(false);
  const count = photos.length;
  const active = count ? index % count : 0;
  const current = photos[active];
  const file = current ? current.current?.file : cover;
  const source = file ? sourceOf(file) : null;
  // Sahne oranı galerinin çoğunluğundan: geniş render'lar kırpılmadan tam oturur, sahne zıplamaz.
  const wide = count ? photos.filter((d) => isWide(d.current?.file)).length * 2 > count : isWide(cover);

  const show = (target: number, d: number) => {
    if (count < 2) return;
    const next = ((target % count) + count) % count;
    const f = photos[next]?.current?.file;
    const id = ++ticket.current;
    const commit = () => { if (id === ticket.current) setShown({ index: next, dir: d }); };
    if (f) void decodeImage(sourceOf(f)).then(commit); else commit();
  };
  const step = (d: number) => show(active + d, d);

  // Komşular önceden çözülür: oklarla ya da kaydırarak geçişte bekleme olmaz.
  useEffect(() => {
    if (count < 2) return;
    for (const d of [1, -1]) {
      const f = photos[(active + d + count) % count]?.current?.file;
      if (f) void decodeImage(sourceOf(f));
    }
  }, [active, photos, count]);

  // Etkin küçük resim şeridin içinde görünür kalsın (sayfa kaymadan).
  useEffect(() => {
    const strip = thumbsRef.current;
    const el = strip?.children[active] as HTMLElement | undefined;
    if (!strip || !el) return;
    const left = el.offsetLeft - (strip.clientWidth - el.offsetWidth) / 2;
    strip.scrollTo({ left, behavior: reduce ? 'auto' : 'smooth' });
  }, [active, reduce]);

  const running = playing && !hold && !lightbox && inView && count > 1;

  // Sürükleme: parmağı dirençle izler, bırakınca hız ve mesafeye göre geçer ya da yerine yaylanır.
  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (count < 2 || e.button !== 0) return;
    drag.current = { x: e.clientX, t: performance.now(), moved: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) > 8) { d.moved = true; e.currentTarget.setPointerCapture(e.pointerId); }
    if (d.moved) dragX.set(dx * 0.42);
  };
  const onPointerUp = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d?.moved) return;
    suppressClick.current = true;
    window.setTimeout(() => { suppressClick.current = false; }, 60);
    const dx = e.clientX - d.x;
    const v = dx / Math.max(16, performance.now() - d.t);
    if (Math.abs(dx) > 56 || Math.abs(v) > 0.45) step(dx < 0 ? 1 : -1);
    animate(dragX, 0, { type: 'spring', bounce: 0.3, duration: 0.6 });
  };

  const alt = current ? (tr ? current.title.tr : current.title.en || current.title.tr) : name;
  const motionless = !!reduce;
  return <div ref={rootRef} className={s.gallery}>
    <div className={s.frame}>
    <button
      className={s.stage}
      data-wide={wide || undefined}
      data-media-id={current?.id}
      disabled={!current || !file}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHold(true); }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHold(false); }}
      onClick={() => { if (suppressClick.current || !current) return; setLightbox({ items: photos, index: active }); }}
      aria-label={tr ? `${name}: galeriyi aç` : `${name}: open gallery`}
    >
      <motion.span className={s.track} style={{ x: dragX }}>
        <AnimatePresence initial={false} custom={dir}>
          {file && source ? (
            <motion.span
              key={`${current?.id ?? 'cover'}:${file.cacheKey}:${source}`}
              className={s.slide}
              data-fit={isWide(file) ? 'cover' : 'contain'}
              custom={dir}
              variants={motionless ? fadeVariants : slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              <span className={s.drift} data-run={!motionless && running || undefined}>
                <motion.img
                  src={source}
                  alt={alt}
                  draggable={false}
                  custom={dir}
                  variants={motionless ? undefined : imageVariants}
                />
              </span>
            </motion.span>
          ) : <span className={s.placeholder}><Icon name="parts" size={44} /></span>}
        </AnimatePresence>
      </motion.span>
    </button>
    {count > 1 && <button
      className={s.playChip}
      onClick={() => setPlaying((p) => !p)}
      aria-label={playing ? (tr ? 'Galeriyi duraklat' : 'Pause gallery') : (tr ? 'Galeriyi oynat' : 'Play gallery')}
      aria-pressed={playing}
    >
      {playing && <svg className={s.ring} viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r="17" pathLength={1} />
        <circle
          key={`${active}:${dir}`}
          className={s.ringFill}
          cx="20" cy="20" r="17"
          pathLength={1}
          data-run={running || undefined}
          style={{ animationDuration: `${GALLERY_MS}ms` }}
          onAnimationEnd={() => step(1)}
        />
      </svg>}
      <Icon name={playing ? 'pause' : 'play'} size={14} strokeWidth={1.9} />
    </button>}
    </div>
    {count > 1 && <div className={s.galleryControls}>
      <button className={s.ctl} data-nudge="left" onClick={() => step(-1)} aria-label={tr ? 'Önceki görsel' : 'Previous image'}><Icon name="chevronLeft" size={18} /></button>
      <span className={s.counter} aria-live="off">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.span
            key={active}
            className="tabular"
            custom={dir}
            variants={{ enter: (d: number) => ({ y: d * 12, opacity: 0 }), center: { y: 0, opacity: 1 }, exit: (d: number) => ({ y: d * -12, opacity: 0 }) }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', bounce: 0.3, duration: 0.5 }}
          >{active + 1}</motion.span>
        </AnimatePresence>
        <span className={s.counterTotal}>/ {count}</span>
      </span>
      <button className={s.ctl} data-nudge="right" onClick={() => step(1)} aria-label={tr ? 'Sonraki görsel' : 'Next image'}><Icon name="chevronRight" size={18} /></button>
    </div>}
    {count > 1 && <div ref={thumbsRef} className={s.thumbs}>{photos.map((d, i) => (
      <button key={d.id} data-active={i === active || undefined} onClick={() => i !== active && show(i, i > active ? 1 : -1)} onPointerEnter={() => { const f = d.current?.file; if (f) void decodeImage(sourceOf(f)); }} aria-label={`${tr ? 'Görsel' : 'Image'} ${i + 1}`} aria-pressed={i === active}>
        <img key={d.current?.file?.cacheKey} src={d.current?.file?.thumb ?? d.current?.file?.preview ?? ''} alt="" loading="lazy" draggable={false} />
        {i === active && <motion.span layoutId={`gallery-thumb-${name}`} className={s.thumbRing} transition={{ type: 'spring', bounce: 0.32, duration: 0.55 }} />}
      </button>
    ))}</div>}
  </div>;
}

export function ProductOverview({ profile }: { profile?: MachineProfile }) {
  const { lang } = useI18n();
  const tr = lang === 'tr';
  return <section id="genel-bakis" className={s.overview}>
    <h2>{tr ? 'Genel bakış' : 'Overview'}</h2>
    {profile?.description ? <div className={s.description}>{profile.description.split(/\n\s*\n/).map((p, i) => <p key={i}>{p}</p>)}</div> : <p className={s.empty}>{tr ? 'Bu dilde ürün açıklaması eklenmemiş.' : 'A product description has not been added in this language.'}</p>}
    {!!profile?.features.length && <div className={s.part}><h3>{tr ? 'Ürün özellikleri' : 'Product features'}</h3><ul className={s.features}>{profile.features.map((f, i) => <li key={i}>{f}</li>)}</ul></div>}
    {!!profile?.applications.length && <div className={s.part}><h3>{tr ? 'Kullanım alanları' : 'Applications'}</h3><ul className={s.applications}>{profile.applications.map((f, i) => <li key={i}>{f}</li>)}</ul></div>}
  </section>;
}

export function MaintenanceBank({ categories, code, documents }: { categories: MaintenanceCategory[]; code: string; documents: Doc[] }) {
  const { lang, pick } = useI18n();
  const { hash } = useLocation();
  const tr = lang === 'tr';
  const [search, setSearch] = useState('');
  useEffect(() => {
    if (!hash.startsWith('#bakim-')) return;
    const frame = requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' }));
    return () => cancelAnimationFrame(frame);
  }, [hash, code]);
  const fold = (s: string) => s.toLocaleLowerCase(code).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i');
  const query = fold(search.trim());
  const filtered = categories.map((c) => ({ ...c, topics: c.topics.filter((t) => { const v = t.translations[code]; return v && (!query || fold(`${c.titles[code] ?? ''} ${v.title} ${v.description} ${v.steps.join(' ')}`).includes(query)); }) })).filter((c) => c.topics.length);
  return <section id="bakim" className={s.maintenance}>
    <h2>{tr ? 'Bakım bilgi bankası' : 'Maintenance knowledge base'}</h2>
    <label className={s.search}><Icon name="search" size={16} /><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr ? 'Bakım konularında ara' : 'Search maintenance topics'} aria-label={tr ? 'Bakım konularında ara' : 'Search maintenance topics'} /></label>
    {!filtered.length && <p className={s.empty}>{tr ? 'Eşleşen bakım konusu yok.' : 'No maintenance topics match.'}</p>}
    {filtered.map((category) => <CollapsibleFolder key={category.id} title={category.titles[code] || (tr ? 'Bakım' : 'Maintenance')} count={category.topics.length} defaultOpen={!!query || category.topics.some((t) => hash === `#bakim-${t.id}`)}>
      {category.topics.map((topic) => {
        const entry = topic.translations[code];
        return <details key={topic.id} id={`bakim-${topic.id}`} className={s.topic} open={hash === `#bakim-${topic.id}` || undefined}>
          <summary>{entry.title}<Icon name="chevronDown" size={15} /></summary>
          <div className={s.topicBody}>
            {entry.description && <p className={s.description}>{entry.description}</p>}
            {!!entry.steps.length && <ol className={s.steps}>{entry.steps.map((step, i) => <li key={i}>{step}</li>)}</ol>}
            {entry.warning && <div className={s.warning}><strong>{tr ? 'Uyarı' : 'Warning'}</strong><p>{entry.warning}</p></div>}
            {!!entry.videos.length && <div className={s.part}><h3>{tr ? 'Videolar' : 'Videos'}</h3>{entry.videos.map((video, i) => <a key={i} className={s.videoLink} href={video.url} target="_blank" rel="noopener noreferrer"><Icon name="play" size={16} />{video.title || (tr ? 'Videoyu izle' : 'Watch video')}<Icon name="external" size={12} /></a>)}</div>}
            {entry.documents.map((id) => { const d = documents.find((d) => d.id === id); if (!d) return null; return <div key={id} className={s.attachment}>{d.current?.file?.kind === 'video' && <video controls preload="none" poster={d.current.file.thumb ?? undefined} src={d.current.file.raw} />}<Link to={`/dokuman/${d.id}`}>{pick(d.title)}<Icon name="chevronRight" size={14} /></Link></div>; })}
            {entry.updatedAt && <p className={s.date}><DateStamp iso={entry.updatedAt} author={entry.author} format="long" action="update" />{entry.changeNote && ` · ${entry.changeNote}`}</p>}
          </div>
        </details>;
      })}
    </CollapsibleFolder>)}
  </section>;
}
