import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Icon } from './Icon';
import { DateStamp } from './DateStamp';
import { CollapsibleFolder } from './CollapsibleFolder';
import { useI18n } from '../lib/i18n';
import { useUi } from '../lib/ui';
import { Link } from '../lib/link';
import { type Doc, type FileInfo, type MachineProfile, type MaintenanceCategory, type TechnicalTable, pdfPageLink } from '../lib/api';
import s from './MachineContent.module.css';

export function MachineGallery({ photos, cover, name }: { photos: Doc[]; cover: FileInfo | null; name: string }) {
  const { lang } = useI18n();
  const { lightbox, setLightbox } = useUi();
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [playing, setPlaying] = useState(true);
  const dragged = useRef(false);
  const count = photos.length;
  const active = index % Math.max(count, 1);
  const current = photos[active];
  const file = current ? current.current?.file : cover;
  const go = (delta: number) => { if (count < 2) return; setDirection(delta > 0 ? 1 : -1); setIndex((i) => (i + delta + count) % count); };
  const source = file?.kind === 'pdf' ? pdfPageLink(file) : file?.preview ?? file?.thumb ?? file?.raw;
  useEffect(() => {
    const next = photos[(index + 1) % Math.max(count, 1)]?.current?.file;
    if (!next) return;
    const preload = new Image(); preload.src = next.kind === 'pdf' ? pdfPageLink(next) : next.preview ?? next.thumb ?? next.raw;
  }, [index, photos, count]);
  useEffect(() => {
    if (count < 2 || !playing || lightbox) return;
    const timer = window.setInterval(() => { if (!document.hidden) { setDirection(1); setIndex((i) => (i + 1) % count); } }, 4000);
    return () => window.clearInterval(timer);
  }, [count, playing, lightbox]);
  return <div className={s.gallery}>
    <button className={s.stage} data-panorama={file?.width && file.height && file.width / file.height > 1.5 || undefined} data-media-id={current?.id} disabled={!current || !file} onPointerDown={() => { dragged.current = false; }} onClick={() => { if (dragged.current || !current) return; setLightbox({ items: photos, index: active }); }} aria-label={lang === 'tr' ? `${name}: galeriyi aç` : `${name}: open gallery`}>
      <AnimatePresence initial={false} custom={direction} mode="popLayout">
        {file && source ? <motion.img key={`${current?.id ?? 'cover'}:${file.cacheKey}`} src={source} alt={current ? (lang === 'tr' ? current.title.tr : current.title.en || current.title.tr) : name} decoding="async" draggable={false} custom={direction}
          variants={{
            enter: (dir: number) => ({ opacity: 0, x: reduce ? 0 : dir * 70, scale: reduce ? 1 : .94, rotateY: reduce ? 0 : dir * -7, filter: reduce ? 'none' : 'blur(10px)' }),
            center: { opacity: 1, x: 0, scale: 1, rotateY: 0, filter: 'blur(0px)' },
            exit: (dir: number) => ({ opacity: 0, x: reduce ? 0 : dir * -70, scale: reduce ? 1 : 1.04, rotateY: reduce ? 0 : dir * 7, filter: reduce ? 'none' : 'blur(10px)' }),
          }}
          transition={{ duration: reduce ? .1 : .48, ease: [.22, 1, .36, 1] }}
          initial="enter" animate="center" exit="exit"
          drag={count > 1 ? 'x' : false} dragConstraints={{ left: 0, right: 0 }} dragElastic={.25} dragSnapToOrigin onDragEnd={(_, info) => { dragged.current = Math.abs(info.offset.x) > 7; if (Math.abs(info.offset.x) > 40 || Math.abs(info.velocity.x) > 450) go(info.offset.x < 0 ? 1 : -1); }} /> : <Icon name="parts" size={44} />}
      </AnimatePresence>
    </button>
    {count > 1 && <div className={s.galleryControls}>
      <button onClick={() => go(-1)} aria-label={lang === 'tr' ? 'Önceki görsel' : 'Previous image'}><Icon name="chevronLeft" size={18} /></button>
      <span aria-live="off">{active + 1} / {count}</span>
      <button onClick={() => setPlaying((p) => !p)} aria-label={playing ? (lang === 'tr' ? 'Galeriyi duraklat' : 'Pause gallery') : (lang === 'tr' ? 'Galeriyi oynat' : 'Play gallery')} aria-pressed={playing}><Icon name={playing ? 'pause' : 'play'} size={15} /></button>
      <button onClick={() => go(1)} aria-label={lang === 'tr' ? 'Sonraki görsel' : 'Next image'}><Icon name="chevronRight" size={18} /></button>
    </div>}
    {count > 1 && <div className={s.thumbs}>{photos.map((d, i) => <button key={d.id} data-active={i === active || undefined} onClick={() => { setDirection(i >= active ? 1 : -1); setIndex(i); }} aria-label={`${lang === 'tr' ? 'Görsel' : 'Image'} ${i + 1}`} aria-pressed={i === active}><img key={d.current?.file?.cacheKey} src={d.current?.file?.thumb ?? d.current?.file?.preview ?? ''} alt="" /></button>)}</div>}
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

export function TechnicalSpecifications({ tables }: { tables: TechnicalTable[] }) {
  const { lang } = useI18n();
  return <section id="teknik-ozellikler" className={s.specifications}>
    <h2>{lang === 'tr' ? 'Teknik özellikler' : 'Technical specifications'}</h2>
    {tables.map((t, i) => <div key={i} className={s.tableWrap} tabIndex={0} role="region" aria-label={t.title || (lang === 'tr' ? 'Teknik özellikler tablosu' : 'Technical specification table')}>
      <table>{t.title && <caption>{t.title}</caption>}<thead><tr>{t.columns.map((c, ci) => <th key={ci} scope="col">{c}</th>)}</tr></thead><tbody>{t.rows.map((r, ri) => <tr key={ri}>{r.map((v, vi) => vi === 0 ? <th key={vi} scope="row">{v}</th> : <td key={vi}>{v}</td>)}</tr>)}</tbody></table>
    </div>)}
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
