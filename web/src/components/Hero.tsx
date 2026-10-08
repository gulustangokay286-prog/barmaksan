// Kütüphane girişi — kaydırmaya bağlı tek sahne.
//
//  0 ─ DİNLENME   Solda metin ve arama, sağda kendiliğinden dönen makine carousel'i.
//  1 ─ GEÇİŞ      Metin sola çekilip söner; carousel sahnenin ortasına iner ve büyür,
//                 arka plan kararır. Yarıda bırakılırsa sahne kendiliğinden kilide (ya da
//                 başa) süzülür — hiçbir zaman yarım kalmaz.
//  2 ─ KİLİT      Sayfa durur, kaydırma carousel'i çevirir: her tekerlek adımı bir makine.
//                 Sürükleme, oklar ve klavye de çalışır.
//  3 ─ BIRAKMA    İçerik bir sayfa gibi alttan yükselip sahnenin üstüne kapanır; sahne geriye
//                 çekilip kararır (iOS sayfa sunumu). Yarıda bırakılırsa sayfa ya tam açılır
//                 ya geri iner. Evre uzunlukları piksel cinsinden; oranlar ölçülerek hesaplanır.
//
// Bütün konumlar tek bir kaydırma değerinden türetilir; kare başına React çizimi yok.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AnimatePresence, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll,
  useTransform, type MotionValue,
} from 'motion/react';
import { MachineCarousel, type CarouselItem } from './MachineCarousel';
import { Icon } from './Icon';
import { Link } from '../lib/link';
import { useI18n } from '../lib/i18n';
import { useBootstrap } from '../lib/ui';
import { useAppReady } from '../lib/splash';
import { useMediaQuery, useViewportActive } from '../lib/viewport';
import s from './Hero.module.css';

// Vitrin makineleri ve üstteki fotoğraflar yönetim panelinden gelir (Ana sayfa).
// Fotoğraflar sırayla değişen yönlerde çok yavaş kayar (Ken Burns).
const DRIFT: [string, string][] = [['-2%', '-1.5%'], ['2%', '-1%'], ['-1.5%', '1%'], ['1.5%', '0%'], ['-2%', '1%'], ['1%', '-1.5%']];

function useSlides() {
  const { data: boot } = useBootstrap();
  return useMemo(() => (boot?.home.slides ?? []).map((sl, i) => ({
    key: sl.doc, src: sl.src, tr: sl.caption.tr, en: sl.caption.en, kx: DRIFT[i % DRIFT.length][0], ky: DRIFT[i % DRIFT.length][1],
  })), [boot]);
}
const INTERVAL = 6000;

/** Sahne evreleri (kaydırma ilerlemesi 0–1): geçiş başı, kilit başı, bırakma başı. */
export type Phases = { move: number; lock: number; release: number; /** kaydırmanın son makinede durduğu yer */ hold: number };
const DEFAULT_PHASES: Phases = { move: 0.02, lock: 0.2, release: 0.62, hold: 0.55 };
/** Kilit boyunca çevrilen makine sayısı: hepsi (ilk makineden sonuncuya). */
const SCRUB_MAX = 99;
// Evre uzunlukları (görünür yüksekliğe oranla). CSS'teki .pin yüksekliğiyle aynı formül.
const PRE = 0.04;
const MOVE = 0.55;
/** Son makinede bekleme: içerik yükselmeden önce son makine görülsün. */
const HOLD = 0.5;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

type HeroProps = { children: (p: MotionValue<number>, phases: Phases) => ReactNode };

function useFeaturedMachines() {
  const { data: boot } = useBootstrap();
  return useMemo<CarouselItem[]>(() => {
    const tree = boot?.tree ?? [];
    const byId = new Map(tree.map((t) => [t.id, t]));
    return (boot?.home.featured ?? []).map((slug) => tree.find((t) => t.slug === slug && t.kind === 'machine'))
      .filter((m): m is NonNullable<typeof m> => !!m?.cover)
      .map((m) => ({ slug: m.slug, name: m.name, modelCode: m.modelCode, cover: m.cover, category: m.parentId ? byId.get(m.parentId)?.name : undefined }));
  }, [boot]);
}

// Sahne her genişlikte aynı: telefonda da fotoğraflar akar, carousel kaydırdıkça ortaya gelir.
// Yalnızca "hareketi azalt" açıksa kaydırmaya bağlı olmayan sade sürüm çizilir.
export function Hero(props: HeroProps) {
  const compact = useMediaQuery('(prefers-reduced-motion: reduce)');
  return compact ? <CompactHero {...props} /> : <DesktopHero {...props} />;
}

function CompactHero({ children }: HeroProps) {
  const { lang } = useI18n();
  const machines = useFeaturedMachines();
  const ref = useRef<HTMLElement>(null);
  const active = useViewportActive(ref);
  const progress = useMotionValue(0);
  useEffect(() => { progress.set(active ? 0 : 1); }, [active, progress]);
  return (
    <section ref={ref} className={s.compactHero}>
      <div className={s.compactCopy}>{children(progress, DEFAULT_PHASES)}</div>
      <div className={s.compactScene}>
        <Link to="/k/makineler" className={s.lockAll}>
          {lang === 'tr' ? 'Tüm makineler' : 'All machines'}<Icon name="chevronRight" size={14} />
        </Link>
        <MachineCarousel items={machines} active={active} />
      </div>
    </section>
  );
}

function DesktopHero({ children }: HeroProps) {
  const { pick, lang } = useI18n();
  const reduce = !!useReducedMotion();
  const ready = useAppReady();
  const sectionRef = useRef<HTMLElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const active = useViewportActive(stickyRef);
  const [sceneVisible, setSceneVisible] = useState(true);
  const [index, setIndex] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);

  const machines = useFeaturedMachines();
  const slides = useSlides();
  const slideCount = slides.length;
  const span = Math.max(1, Math.min(SCRUB_MAX, machines.length - 1));
  const [phases, setPhases] = useState<Phases>(DEFAULT_PHASES);
  const ph = useRef(phases);
  ph.current = phases;
  const moveT = (v: number) => easeInOut(clamp01((v - ph.current.move) / (ph.current.lock - ph.current.move)));
  const outT = (v: number) => clamp01((v - ph.current.release) / (1 - ph.current.release));

  // ── Arka plan görselleri ──
  const indexRef = useRef(0);
  useEffect(() => {
    if (!active || !sceneVisible || slideCount < 2) return;
    const id = window.setInterval(() => {
      const i = indexRef.current;
      indexRef.current = (i + 1) % slideCount;
      setPrev(i);
      setIndex(indexRef.current);
    }, INTERVAL);
    return () => window.clearInterval(id);
  }, [active, sceneVisible, slideCount]);
  // Fotoğraf sayısı yönetimden azaltılırsa dizin geçerli kalsın.
  if (slideCount && index >= slideCount) {
    indexRef.current = 0;
    setIndex(0);
    setPrev(null);
  }
  useEffect(() => {
    if (prev == null) return;
    const timer = window.setTimeout(() => setPrev(null), 1600);
    return () => window.clearTimeout(timer);
  }, [prev, index]);
  const goTo = (i: number) => {
    if (i === indexRef.current) return;
    setPrev(indexRef.current);
    indexRef.current = i;
    setIndex(i);
  };

  // ── Kaydırma ilerlemesi: bölüm üst barın altına değdiğinde 0, sahne bırakılırken 1 ──
  const barH = useRef(56);
  const { scrollYProgress: p } = useScroll({ target: sectionRef, offset: ['start 56px', 'end end'] });

  // ── Ölçüm: dinlenmede carousel sağ sütundaki yuvada; kilitte sahnenin ortasında. ──
  // Yuvanın merkezi ve ölçeği motion değerlerinde tutulur (React çizimi yok).
  const dx = useMotionValue(0);
  const dy = useMotionValue(0);
  const s0 = useMotionValue(0.6);
  const [geo, setGeo] = useState({ sceneW: 960, card: 360, slotH: 480 });
  useLayoutEffect(() => {
    const sticky = stickyRef.current;
    const slot = slotRef.current;
    if (!sticky || !slot) return;
    barH.current = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--bar-h'), 10) || 56;
    const measure = () => {
      const sr = sticky.getBoundingClientRect();
      const r = slot.getBoundingClientRect();
      const gutter = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--gutter'), 10) || 40;
      const sceneW = Math.min(820, sr.width - gutter * 2);
      // Kart boyu: genişlikten ve yükseklikten (başlık + alt şerit payı), hangisi darsa.
      const ratio = sceneW < 600 ? 0.6 : 0.42; // dar ekranda komşular kenardan taşabilir
      const card = Math.round(Math.max(150, Math.min(400, sceneW * ratio, (sr.height - 250) / 1.12)));
      // Tek sütunda (telefon, tablet) yuva metnin altında küçük durur: yüksekliği de ölçekle.
      const full = card * 1.12 + 76;
      const slotH = Math.round(window.matchMedia('(max-width: 1023px)').matches ? full * Math.min(1, r.width / sceneW) : full);
      setGeo((g) => (g.sceneW === sceneW && g.card === card && g.slotH === slotH ? g : { sceneW, card, slotH }));
      // Evre oranları: kaydırma mesafesi D = bölüm − sabit alan; bırakma = sabit alan kadar.
      const section = sectionRef.current;
      if (section) {
        const vh = window.innerHeight;
        const D = Math.max(1, section.offsetHeight - sr.height);
        const release = Math.max(0.5, (D - sr.height) / D);
        const next = { move: (PRE * vh) / D, lock: ((PRE + MOVE) * vh) / D, release, hold: release - (HOLD * vh) / D };
        setPhases((cur) => (Math.abs(cur.move - next.move) + Math.abs(cur.lock - next.lock) + Math.abs(cur.release - next.release) + Math.abs(cur.hold - next.hold) < 1e-4 ? cur : next));
      }
      dx.set(r.left + r.width / 2 - (sr.left + sr.width / 2));
      dy.set(r.top + r.height / 2 - (sr.top + sr.height / 2));
      s0.set(Math.min(1, r.width / sceneW));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(sticky);
    ro.observe(slot);
    return () => ro.disconnect();
  }, [dx, dy, s0, span]);

  // ── Sahne dönüşümleri ──
  const LOCK_SHIFT = 34; // kilitte başlık üstte yer alsın diye carousel biraz aşağıda durur
  const sceneX = useTransform(() => dx.get() * (1 - moveT(p.get())));
  const sceneY = useTransform(() => {
    const t = moveT(p.get());
    return dy.get() * (1 - t) + LOCK_SHIFT * t;
  });
  const sceneScale = useTransform(() => {
    const t = moveT(p.get());
    return s0.get() + (1 - s0.get()) * t;
  });
  // Bırakma: bütün sahne geriye çekilir ve kararır; içerik sayfası üstüne kapanır.
  const recedeScale = useTransform(() => 1 - outT(p.get()) * 0.07);
  const recedeY = useTransform(() => -outT(p.get()) * 36);
  const dim = useTransform(() => outT(p.get()) * 0.55);
  // Alt şerit (makine adı, oklar) ters ölçeklenir: yazı her evrede gerçek boyutunda kalır.
  const barScale = useTransform(sceneScale, (v) => 1 / Math.max(0.3, v));
  const headIn = (v: number) => clamp01((v - (ph.current.lock - (ph.current.lock - ph.current.move) * 0.35)) / ((ph.current.lock - ph.current.move) * 0.35));
  const headOpacity = useTransform(() => headIn(p.get()));
  const headY = useTransform(() => (1 - headIn(p.get())) * 12);
  const headPointer = useTransform(headOpacity, (v) => (v > 0.5 ? 'auto' : 'none'));
  const footOpacity = useTransform(() => 1 - clamp01(p.get() / (ph.current.move + (ph.current.lock - ph.current.move) * 0.4)));
  const scrub = useTransform(() => clamp01((p.get() - ph.current.lock) / (ph.current.hold - ph.current.lock)));
  const lockBar = useTransform(scrub, (v) => `scaleX(${v})`);

  // Kendiliğinden dönme yalnızca dinlenmede; kilitte carousel'i kaydırma sürer.
  const [resting, setResting] = useState(true);
  useMotionValueEvent(p, 'change', (v) => {
    setResting(v < ph.current.move);
    setSceneVisible(v < 0.99);
  });

  // A large background plane stays flat; only its opacity changes on scroll.
  const shade = useTransform(() => 0.56 + moveT(p.get()) * 0.24);

  // ── Kilit: geçiş ya da bırakma yarıda kalırsa sahne en yakın duruma süzülür ──
  useEffect(() => {
    if (!active) return;
    let timer = 0;
    let gliding = false;
    const onScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (gliding) {
          gliding = false;
          return;
        }
        const v = p.get();
        const { move, lock, release } = ph.current;
        let target: number | null = null;
        const eps = 0.004;
        // Geçiş: kilide doğru üçte birden fazla gelinmişse kilide, değilse başa.
        if (v > move + eps && v < lock - eps) target = v > move + (lock - move) * 0.3 ? lock : 0;
        // Bırakma: sayfa üçte birden fazla yükseldiyse tam açılır, değilse carousel'e döner.
        else if (v > release + eps && v < 1 - eps) target = v > release + (1 - release) * 0.5 ? 1 : release;
        if (target == null) return;
        const el = sectionRef.current;
        if (!el) return;
        const top = el.getBoundingClientRect().top + window.scrollY - barH.current;
        const dist = el.offsetHeight - (stickyRef.current?.offsetHeight ?? window.innerHeight - barH.current);
        gliding = true;
        window.scrollTo({ top: Math.round(top + target * dist), behavior: reduce ? 'auto' : 'smooth' });
      }, 150);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.clearTimeout(timer);
    };
  }, [p, reduce, active]);

  return (
    <section ref={sectionRef} className={s.pin} data-pin style={{ ['--scrub-span' as string]: span }}>
      <div
        ref={stickyRef}
        className={s.sticky}

      >
        <motion.div className={s.recede} style={{ scale: recedeScale, y: recedeY }}>
        <div className={s.stage} aria-hidden="true">
          <div className={s.plane}>
            {active && sceneVisible && slides.map((sl, i) => (i === index || i === prev) ? (
              <img
                key={sl.key}
                className={s.slide}
                data-on={i === index || undefined}
                data-prev={i === prev || undefined}
                src={sl.src}
                alt=""
                decoding="async"
                fetchPriority={i === 0 ? 'high' : 'low'}
                style={{ ['--kx' as string]: sl.kx, ['--ky' as string]: sl.ky }}
              />
            ) : null)}
          </div>
          <motion.div className={s.shade} style={{ opacity: shade }} />
        </div>

        <div className={s.layout}>
          <div className={s.copy}>{children(p, phases)}</div>
          {/* Carousel'in dinlenmedeki yeri: yalnızca ölçü için. */}
          <div ref={slotRef} className={s.slot} style={{ height: geo.slotH }} aria-hidden="true" />
        </div>

        <motion.div
          className={s.scene}
          style={{ width: geo.sceneW, x: sceneX, y: sceneY, scale: sceneScale }}
        >
          <motion.div className={s.lockHead} style={{ opacity: headOpacity, y: headY, pointerEvents: headPointer }}>
            <Link to="/k/makineler" className={s.lockAll}>
              {lang === 'tr' ? 'Tüm makineler' : 'All machines'}
              <Icon name="chevronRight" size={14} />
            </Link>
          </motion.div>
          <motion.div
            className={s.sceneIn}
            initial={{ opacity: 0, y: 24 }}
            animate={ready ? { opacity: 1, y: 0 } : undefined}
            transition={{ type: 'spring', bounce: 0, duration: 1, delay: 0.25 }}
          >
            {machines.length > 0 ? (
              <MachineCarousel items={machines} cardSize={geo.card} autoplay={resting} scrub={scrub} scrubSpan={span} barScale={barScale} active={active && sceneVisible} />
            ) : (
              <div className={s.sceneSkeleton} style={{ height: geo.card * 1.12 + 76 }} />
            )}
          </motion.div>
          <motion.div className={s.lockProgress} style={{ opacity: headOpacity }} aria-hidden="true">
            <motion.span style={{ transform: lockBar }} />
          </motion.div>
        </motion.div>

        <motion.div className={s.footer} style={{ opacity: footOpacity }}>
          <div className={s.caption} aria-live="polite">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={index}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ type: 'spring', bounce: 0, duration: 0.6 }}
              >
                {slides[index] ? pick(slides[index]) : null}
              </motion.span>
            </AnimatePresence>
          </div>
          <div className={s.bars} role="tablist" aria-label="Görseller">
            {slideCount > 1 && slides.map((sl, i) => (
              <button key={sl.key} role="tab" aria-selected={i === index} aria-label={pick(sl)} className={s.bar} onClick={() => goTo(i)}>
                <span key={i === index ? `on-${index}` : 'off'} className={s.barFill} data-on={i === index || undefined} data-done={i < index || undefined} />
              </button>
            ))}
          </div>
        </motion.div>
        </motion.div>
        <motion.div className={s.dim} style={{ opacity: dim }} aria-hidden="true" />
      </div>
    </section>
  );
}
