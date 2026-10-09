// Tam ekran görüntüleyici.
// Açılış/kapanış elle yazılmış bir paylaşılan öğe geçişi (FLIP): görsel tıklanan karenin tam
// yerinden, o karenin kırpımıyla doğar ve yerine büyür; kapanırken aynı kareye kırpılarak
// döner. Kapanış başladığı an sayfa yeniden tıklanabilir ve kaydırılabilirdir (gecikme yok).
// Kare ekranda değilse (ya da video ise) görsel yerinde küçülerek söner.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, animate, motion, useMotionValue, useMotionValueEvent, usePresence, useReducedMotion, type PanInfo, type Variants } from 'motion/react';
import { Icon } from './Icon';
import { Button, LinkButton } from './ui';
import { Link } from '../lib/link';
import { useI18n } from '../lib/i18n';
import { useUi } from '../lib/ui';
import { formatDuration } from '../lib/format';
import { downloadLink, pdfPageLink, type Doc } from '../lib/api';
import s from './Lightbox.module.css';

// Apple'ın kaydırma yavaşlama projeksiyonu: bırakılan hızdan varış noktası.
const project = (v: number, rate = 0.998) => ((v / 1000) * rate) / (1 - rate);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

const slide: Variants = {
  enter: (d: number) => ({ opacity: d === 0 ? 1 : 0, x: d * 80, scale: d === 0 ? 1 : .94, filter: d === 0 ? 'blur(0px)' : 'blur(10px)' }),
  center: { opacity: 1, x: 0, scale: 1, filter: 'blur(0px)', transition: { duration: .45, ease: [.22, 1, .36, 1] } },
  exit: (d: number) => ({ opacity: 0, x: -d * 80, scale: 1.04, filter: 'blur(10px)', transition: { duration: .32, ease: [.22, 1, .36, 1] } }),
};

// Görsel oranını koruyarak sahneye sığan kutu.
function frameSize(w?: number | null, h?: number | null) {
  const ratio = w && h ? w / h : 16 / 9;
  return { aspectRatio: String(ratio), width: `min(100%, calc((100dvh - 156px) * ${ratio.toFixed(4)}))` };
}

type Flip = { S: DOMRect; F: DOMRect; k: number; r: number };

/** Sayfadaki karşılık gelen kare (görüntüleyicinin içi hariç), ekranda görünüyorsa. */
function findTile(id: string) {
  const tiles = [...document.querySelectorAll<HTMLElement>(`[data-media-id="${CSS.escape(id)}"]`)].filter((el) => !el.closest('[data-lightbox]'));
  return tiles.find((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 4 && r.bottom > 0 && r.top < window.innerHeight;
  }) ?? null;
}

function measureFlip(id: string, media: HTMLElement | null): Flip | null {
  if (!media) return null;
  const tile = findTile(id);
  if (!tile) return null;
  const S = tile.getBoundingClientRect();
  const prevT = media.style.transform;
  const prevC = media.style.clipPath;
  media.style.transform = 'none';
  media.style.clipPath = 'none';
  const F = media.getBoundingClientRect();
  media.style.transform = prevT;
  media.style.clipPath = prevC;
  if (F.width < 4 || F.height < 4) return null;
  return { S, F, k: Math.max(S.width / F.width, S.height / F.height), r: parseFloat(getComputedStyle(tile).borderTopLeftRadius) || 10 };
}

export function Lightbox() {
  const { lightbox, setLightbox } = useUi();
  return (
    <AnimatePresence>
      {lightbox && <LightboxInner key={`${lightbox.items[lightbox.index]?.id}:${lightbox.index}`} items={lightbox.items} start={lightbox.index} onClose={() => setLightbox(null)} />}
    </AnimatePresence>
  );
}

function LightboxInner({ items, start, onClose }: { items: Doc[]; start: number; onClose: () => void }) {
  const { t, pick, lang } = useI18n();
  const reduce = useReducedMotion();
  const [isPresent, safeToRemove] = usePresence();
  const [index, setIndex] = useState(start);
  const [dir, setDir] = useState(0);
  const [closing, setClosing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const chromeRef = useRef<HTMLDivElement>(null);
  const doc = items[index];
  const file = doc.current?.file;
  const isVideo = file?.kind === 'video';
  const y = useMotionValue(0);

  // ── Geçiş: 0 = karede, 1 = açık. Stiller doğrudan yazılır (kare başına React yok). ──
  const p = useMotionValue(0);
  const flip = useRef<Flip | null>(null);
  const paint = (v: number) => {
    const c = clamp01(v);
    const chrome = chromeRef.current;
    if (chrome) chrome.style.setProperty('--chrome', String(clamp01(v * 1.4 - 0.1)));
    const media = mediaRef.current;
    if (!media) return;
    const g = flip.current;
    if (!g) {
      media.style.opacity = String(c);
      media.style.transform = c >= 0.999 ? '' : `scale(${0.94 + 0.06 * v})`;
      media.style.clipPath = '';
      return;
    }
    media.style.opacity = '';
    // Görünen bölge: karenin kırpımından (cover) görselin tamamına.
    const k = lerp(g.k, 1, v);
    const vw = lerp(g.S.width / g.k, g.F.width, c);
    const vh = lerp(g.S.height / g.k, g.F.height, c);
    const cx = lerp(g.S.left + g.S.width / 2, g.F.left + g.F.width / 2, v);
    const cy = lerp(g.S.top + g.S.height / 2, g.F.top + g.F.height / 2, v);
    const ix = Math.max(0, (g.F.width - vw) / 2);
    const iy = Math.max(0, (g.F.height - vh) / 2);
    const radius = lerp(g.r / g.k, 10, c);
    media.style.transform = c >= 0.999 && Math.abs(v - 1) < 0.001 ? '' : `translate(${cx - (g.F.left + g.F.width / 2)}px, ${cy - (g.F.top + g.F.height / 2)}px) scale(${k})`;
    media.style.clipPath = c >= 0.999 ? '' : `inset(${iy.toFixed(1)}px ${ix.toFixed(1)}px round ${radius.toFixed(1)}px)`;
  };
  useMotionValueEvent(p, 'change', paint);

  // Açılış: tıklanan kareden.
  useLayoutEffect(() => {
    flip.current = reduce || isVideo ? null : measureFlip(doc.id, mediaRef.current);
    p.set(0);
    paint(0);
    const c = animate(p, 1, flip.current ? { type: 'spring', bounce: 0.12, duration: 0.5 } : { duration: 0.22, ease: 'easeOut' });
    return () => c.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sayfa kilidi yalnızca açıkken; kapanış başlar başlamaz kalkar.
  useEffect(() => {
    if (closing) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [closing]);

  // Kapanış: o anki görselin karesine geri.
  useEffect(() => {
    if (isPresent) return;
    setClosing(true);
    videoRef.current?.pause();
    flip.current = reduce || isVideo ? null : measureFlip(doc.id, mediaRef.current);
    const yc = animate(y, 0, { type: 'spring', bounce: 0, duration: 0.3 });
    const c = animate(p, 0, flip.current ? { type: 'spring', bounce: 0, duration: 0.34 } : { duration: 0.16, ease: 'easeIn' });
    c.then(() => safeToRemove?.());
    return () => {
      c.stop();
      yc.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPresent]);

  const close = useCallback(() => onClose(), [onClose]);

  const go = useCallback((delta: number) => {
    videoRef.current?.pause();
    setDir(delta);
    setIndex((i) => Math.min(Math.max(i + delta, 0), items.length - 1));
  }, [items.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, close]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const py = info.offset.y + project(info.velocity.y);
    const px = info.offset.x + project(info.velocity.x);
    if (Math.abs(py) > 240 && Math.abs(info.offset.y) > Math.abs(info.offset.x)) close();
    else if (px < -140 && index < items.length - 1) go(1);
    else if (px > 140 && index > 0) go(-1);
  };

  return (
    <div ref={chromeRef} className={s.root} data-lightbox data-closing={closing || undefined} role="dialog" aria-modal="true" aria-label={pick(doc.title)}>
      <div className={s.scrim} onClick={close} />

      <div className={s.bar}>
        <span className={s.counter}>{index + 1} / {items.length}</span>
        <div className={s.barActions}>
          <LinkButton href={downloadLink(doc.id)} variant="ghost" icon="download" size="md">{t('downloadOriginal')}</LinkButton>
          <Button variant="ghost" icon="close" aria-label={t('close')} onClick={close} />
        </div>
      </div>

      <div className={s.stage}>
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div
            key={`${doc.id}:${file?.cacheKey}`}
            className={s.mediaWrap}
            custom={dir}
            variants={reduce ? { enter: { opacity: 0 }, center: { opacity: 1 }, exit: { opacity: 0 } } : slide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: reduce ? .1 : .45, ease: [.22, 1, .36, 1] }}
          >
            <motion.div
              className={s.dragger}
              style={{ y, ...frameSize(file?.width, file?.height) }}
              drag={isVideo ? false : true}
              dragDirectionLock
              dragSnapToOrigin
              dragElastic={0.7}
              onDragEnd={onDragEnd}
            >
              <div ref={mediaRef} className={s.media}>
                {isVideo ? (
                  <video ref={videoRef} className={s.video} src={file!.raw} poster={file!.preview ?? undefined} controls autoPlay playsInline />
                ) : (
                  <>
                    {file?.thumb && <img key={`${file.cacheKey}-thumb`} className={s.low} src={file.thumb} alt="" draggable={false} />}
                    {file && <img key={file.cacheKey} className={s.full} src={file.kind === 'pdf' ? pdfPageLink(file) : file.preview ?? file.raw} alt={pick(doc.title)} draggable={false} decoding="async" />}
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>

        {index > 0 && (
          <button className={s.nav} data-side="left" onClick={() => go(-1)} aria-label={lang === 'tr' ? 'Önceki' : 'Previous'}>
            <Icon name="chevronLeft" size={22} />
          </button>
        )}
        {index < items.length - 1 && (
          <button className={s.nav} data-side="right" onClick={() => go(1)} aria-label={lang === 'tr' ? 'Sonraki' : 'Next'}>
            <Icon name="chevronRight" size={22} />
          </button>
        )}
      </div>

      <div className={s.caption}>
        <span className={s.capTitle}>{pick(doc.title)}</span>
        <span className={s.capMeta}>
          <Link to={doc.folder.kind === 'machine' ? `/m/${doc.folder.slug}` : `/k/${doc.folder.slug}`} onClick={close}>{pick(doc.folder.name)}</Link>
          {file?.width && file?.height ? <span> · {file.width}×{file.height}</span> : null}
          {file?.durationMs ? <span> · {formatDuration(file.durationMs)}</span> : null}
        </span>
      </div>
    </div>
  );
}
