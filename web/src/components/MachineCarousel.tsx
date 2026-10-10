// 3D makine carousel'i (Cover Flow mantığı): öndeki makine büyük, komşular iki yanda açılı ve
// derinlikte. Kendiliğinden ilerler; sürüklenince parmağı 1:1 takip eder, bırakınca hıza göre
// süzülüp en yakın makineye oturur (Apple projeksiyonu). `scrub` verilirse sayfa kaydırması da
// çevirir: kaydırma durunca en yakın makineye oturur. Tüm konumlar tek bir sürekli değerden
// (pos) türetilir: kare başına React çizimi yok, yalnızca transform/opacity.
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import {
  AnimatePresence, animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform,
  type AnimationPlaybackControls, type MotionValue,
} from 'motion/react';
import { Icon } from './Icon';
import { Link } from '../lib/link';
import { prefetchFolder } from '../lib/query';
import { useI18n } from '../lib/i18n';
import type { Name } from '../lib/api';
import { useViewportActive } from '../lib/viewport';
import s from './MachineCarousel.module.css';

export type CarouselItem = { slug: string; name: Name; modelCode: string | null; cover: string | null; category?: Name };

const AUTO_MS = 4800;
const mod = (v: number, n: number) => ((v % n) + n) % n;
/** i'nin ön konuma uzaklığı, sonsuz döngüde en kısa yoldan: (-n/2, n/2]. */
const wrapDist = (d: number, n: number) => mod(d + n / 2, n) - n / 2;
// Apple'ın kaydırma yavaşlama projeksiyonu.
const project = (v: number, rate = 0.995) => ((v / 1000) * rate) / (1 - rate);

export function MachineCarousel({ items, cardSize, autoplay = true, scrub, scrubSpan = 6, barScale, barY, active = true }: {
  items: CarouselItem[];
  /** Kart boyu (px). Verilmezse kapsayıcının genişliğinden hesaplanır. */
  cardSize?: number;
  autoplay?: boolean;
  active?: boolean;
  /** 0–1 arası dış ilerleme (sayfa kaydırması); değiştikçe carousel'i çevirir. */
  scrub?: MotionValue<number>;
  /** scrub 0→1 boyunca geçilen makine sayısı. */
  scrubSpan?: number;
  /** Carousel dışarıdan ölçekleniyorsa alt şeridin ters ölçeği (yazı okunur kalsın). */
  barScale?: MotionValue<number>;
  /** Alt şeridin ek dikey kayması (yerleşimle hizalamak için). */
  barY?: MotionValue<number>;
}) {
  const { pick, lang } = useI18n();
  const reduce = useReducedMotion();
  const n = items.length;
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useViewportActive(rootRef);
  const running = active && inView;
  const [measured, setW] = useState(250);
  const w = cardSize ?? measured;
  const pos = useMotionValue(0);
  const anim = useRef<AnimationPlaybackControls | null>(null);
  const [front, setFront] = useState(0);
  const frontRef = useRef(0);
  const paused = useRef(false);
  const drag = useRef<{ x: number; start: number; moved: boolean; samples: { t: number; x: number }[] } | null>(null);
  const suppressClick = useRef(false);
  const resumeTimer = useRef<number>(undefined);
  const snapTimer = useRef<number>(undefined);

  // Kart boyu sütun genişliğinden: hiçbir komşu görünmez bir sınırda kesilmesin.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el || cardSize) return;
    const ro = new ResizeObserver(([e]) => {
      const c = e.contentRect.width;
      setW(Math.round(Math.min(300, Math.max(150, c * 0.43))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [cardSize]);

  useMotionValueEvent(pos, 'change', (v) => {
    const f = n ? mod(Math.round(v), n) : 0;
    if (f !== frontRef.current) {
      frontRef.current = f;
      setFront(f);
    }
  });

  const goTo = (target: number, velocity = 0) => {
    anim.current?.stop();
    anim.current = animate(pos, target, reduce
      ? { duration: 0.2 }
      : { type: 'spring', bounce: velocity ? 0.1 : 0, duration: 0.8, velocity });
  };
  const step = (dir: number) => goTo(Math.round(pos.get()) + dir);

  const pauseFor = (ms: number) => {
    paused.current = true;
    window.clearTimeout(resumeTimer.current);
    resumeTimer.current = window.setTimeout(() => { paused.current = false; }, ms);
  };

  useEffect(() => {
    if (!running || !autoplay || reduce || n < 2) return;
    const id = window.setInterval(() => {
      if (!paused.current && !drag.current) step(1);
    }, AUTO_MS);
    return () => window.clearInterval(id);
    // Position is a motion value; it never closes over a stale slide index.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, autoplay, reduce, n]);

  useEffect(() => {
    if (!running) {
      anim.current?.stop();
      window.clearTimeout(snapTimer.current);
      paused.current = false;
      drag.current = null;
    }
    return () => {
      window.clearTimeout(resumeTimer.current);
      window.clearTimeout(snapTimer.current);
      anim.current?.stop();
    };
  }, [running]);

  // ── Kaydırmayla çevirme: göreli (delta) uygulanır, böylece sürükleme/oklarla çakışmaz.
  // Kaydırma durunca en yakın makineye oturur.
  useEffect(() => {
    if (!scrub || !running || n < 2) return;
    let last = scrub.get();
    const unsubscribe = scrub.on('change', (v) => {
      const delta = v - last;
      last = v;
      if (!delta || drag.current) return;
      anim.current?.stop();
      // Track scroll directly: creating a spring on every scroll event caused churn.
      pos.set(pos.get() + delta * scrubSpan);
      window.clearTimeout(snapTimer.current);
      snapTimer.current = window.setTimeout(() => goTo(Math.round(pos.get())), 160);
    });
    return () => { unsubscribe(); window.clearTimeout(snapTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrub, scrubSpan, running, n]);

  // ── Sürükleme: 1:1 takip, bırakınca hız devri ──
  const unit = w * 0.62;
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    anim.current?.stop();
    drag.current = { x: e.clientX, start: pos.get(), moved: false, samples: [{ t: performance.now(), x: e.clientX }] };
    paused.current = true;
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) > 6) {
      d.moved = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (!d.moved) return;
    pos.set(d.start - dx / unit);
    d.samples.push({ t: performance.now(), x: e.clientX });
    if (d.samples.length > 6) d.samples.shift();
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    pauseFor(AUTO_MS * 1.5);
    if (!d || !d.moved) return;
    suppressClick.current = true;
    window.setTimeout(() => { suppressClick.current = false; }, 60);
    const first = d.samples[0];
    const last = d.samples[d.samples.length - 1];
    const dt = Math.max(16, last.t - first.t);
    const vPx = ((last.x - first.x) / dt) * 1000; // px/sn
    const vPos = -vPx / unit;
    const target = Math.round(pos.get() + project(vPos) * 0.35);
    goTo(target, vPos);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); pauseFor(AUTO_MS * 2); step(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); pauseFor(AUTO_MS * 2); step(-1); }
  };

  const m = items[front];
  if (!m) return null;

  return (
    <div
      ref={rootRef}
      className={s.root}
      role="region"
      aria-roledescription="carousel"
      aria-label={lang === 'tr' ? 'Makineler' : 'Machines'}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') paused.current = true; }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse' && !drag.current) pauseFor(1200); }}
      style={{ ['--w' as string]: `${w}px` }}
    >
      <div
        className={s.track}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={(e) => { if (suppressClick.current) { e.preventDefault(); e.stopPropagation(); } }}
      >
        {running && items.map((item, i) => Math.abs(wrapDist(i - front, n)) <= 2 ? (
          <Card
            key={item.slug}
            item={item}
            i={i}
            n={n}
            pos={pos}
            w={w}
            isFront={i === front}
          />
        ) : null)}
      </div>

      <motion.div className={s.bar} style={barScale || barY ? { scale: barScale, y: barY } : undefined}>
        <button className={s.arrow} onClick={() => { pauseFor(AUTO_MS * 2); step(-1); }} aria-label={lang === 'tr' ? 'Önceki makine' : 'Previous machine'}>
          <Icon name="chevronLeft" size={18} />
        </button>
        <div className={s.caption} aria-live="polite">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={m.slug}
              className={s.captionInner}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
            >
              {m.category && <span className={s.kicker}>{pick(m.category)}</span>}
              <Link to={`/m/${m.slug}`} className={s.name} onPointerEnter={() => prefetchFolder(m.slug)}>
                {pick(m.name)}
              </Link>
              <span className={s.meta}>
                {m.modelCode && <span className="mono">{m.modelCode}</span>}
                <span className="tabular">{String(front + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}</span>
              </span>
            </motion.div>
          </AnimatePresence>
        </div>
        <button className={s.arrow} onClick={() => { pauseFor(AUTO_MS * 2); step(1); }} aria-label={lang === 'tr' ? 'Sonraki makine' : 'Next machine'}>
          <Icon name="chevronRight" size={18} />
        </button>
      </motion.div>
    </div>
  );
}

function Card({ item, i, n, pos, w, isFront }: {
  item: CarouselItem; i: number; n: number; pos: MotionValue<number>; w: number; isFront: boolean;
}) {
  const { pick } = useI18n();
  const d = useTransform(pos, (p) => wrapDist(i - p, n));
  // Cover Flow geometrisi: öndeki düz, ilk komşular 52° açılı, ikinciler daha derinde.
  const x = useTransform(d, (v) => {
    const a = Math.abs(v);
    const off = a <= 1 ? a * 0.6 : a <= 2 ? 0.6 + (a - 1) * 0.24 : 0.84 + (a - 2) * 0.08;
    return Math.sign(v) * off * w;
  });
  const z = useTransform(d, (v) => {
    const a = Math.abs(v);
    return -(Math.min(a, 1) * 190 + Math.max(0, a - 1) * 120);
  });
  const rotateY = useTransform(d, (v) => Math.max(-1, Math.min(1, -v)) * 52);
  const opacity = useTransform(d, (v) => {
    const a = Math.abs(v);
    if (a <= 1) return 1 - a * 0.08;
    if (a <= 2) return 0.92 - (a - 1) * 0.5;
    return Math.max(0, 0.42 - (a - 2) * 0.9);
  });
  // Öndekinin arkasında kalanlar kararır: öndeki makine kendiliğinden öne çıkar.
  const shade = useTransform(d, (v) => Math.min(0.5, Math.abs(v) * 0.34));
  const zIndex = useTransform(d, (v) => 100 - Math.round(Math.abs(v) * 10));
  const pointerEvents = useTransform(d, (v) => (Math.abs(v) > 2.2 ? 'none' : 'auto'));

  return (
    <motion.div className={s.card} style={{ x, z, rotateY, opacity, zIndex, pointerEvents }}>
      <Link
        to={`/m/${item.slug}`}
        className={s.face}
        data-front={isFront || undefined}
        aria-label={pick(item.name)}
        tabIndex={isFront ? 0 : -1}
        draggable={false}
        onPointerEnter={() => prefetchFolder(item.slug)}
      >
        <span className={s.image}>
          {item.cover && <img src={item.cover} alt="" decoding="async" draggable={false} />}
          <motion.span className={s.shade} style={{ opacity: shade }} aria-hidden="true" />
        </span>
      </Link>
    </motion.div>
  );
}
