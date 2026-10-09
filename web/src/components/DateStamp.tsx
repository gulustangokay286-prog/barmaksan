// Tarih damgası: satırda kısa yazar ("5 ay önce", "6 Ağu 2026"); üzerine gelince tam tarih, saat
// ve yükleyen görünür. İpucu gövdeye çizilir (kaydırılan kutular kırpmasın), üst bara çarpacaksa
// altta açılır. Bir ipucu az önce kapandıysa sonraki gecikmesiz açılır: satırlar arasında
// gezinirken her tarih anında okunur. Dokunmatikte açılmaz; ekran okuyucu tam metni her zaman duyar.
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useI18n } from '../lib/i18n';
import { formatDate, formatRelative } from '../lib/format';
import type { Lang } from '../lib/api';
import s from './DateStamp.module.css';

const OPEN_DELAY = 360;
const WARM_MS = 700;
let lastClosed = 0;

type Format = 'relative' | 'short' | 'long';

export function DateStamp({ iso, author, format = 'relative', className, action = 'upload' }: {
  iso: string;
  author?: string | null;
  format?: Format;
  className?: string;
  action?: 'upload' | 'update';
}) {
  const { lang } = useI18n();
  const ref = useRef<HTMLTimeElement>(null);
  const timer = useRef(0);
  const openRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [focusable, setFocusable] = useState(false);
  const id = useId();

  const label = format === 'relative'
    ? formatRelative(iso, lang)
    : formatDate(iso, lang, format === 'long' ? { day: 'numeric', month: 'long', year: 'numeric' } : undefined);
  const full = fullDate(iso, lang);
  const by = author ? (lang === 'tr' ? `${author} ${action === 'update' ? 'güncelledi' : 'yükledi'}` : `${action === 'update' ? 'Updated' : 'Uploaded'} by ${author}`) : null;

  // Bağlantının içindeyse ayrıca odak almaz (iç içe etkileşim olmasın); değilse klavyeyle de açılır.
  useLayoutEffect(() => {
    setFocusable(!ref.current?.parentElement?.closest('a, button'));
  }, []);

  const show = (delay = OPEN_DELAY) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      openRef.current = true;
      setOpen(true);
    }, Date.now() - lastClosed < WARM_MS ? 0 : delay);
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    if (openRef.current) lastClosed = Date.now();
    openRef.current = false;
    setOpen(false);
  };

  // Açıkken kaydırma, Esc ya da pencere boyutu ipucunu kapatır (yerinden kopmasın).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') hide(); };
    window.addEventListener('scroll', hide, { capture: true, passive: true });
    window.addEventListener('resize', hide);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', hide, { capture: true });
      window.removeEventListener('resize', hide);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <>
      <time
        ref={ref}
        dateTime={iso}
        className={`${s.stamp} ${className ?? ''}`}
        data-open={open || undefined}
        tabIndex={focusable ? 0 : undefined}
        aria-describedby={open ? id : undefined}
        onPointerEnter={(e) => { if (e.pointerType !== 'touch') show(); }}
        onPointerLeave={hide}
        onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) show(0); }}
        onBlur={hide}
      >
        {label}
        {!open && <span className="sr-only">{` (${full}${by ? `, ${by}` : ''})`}</span>}
      </time>
      <AnimatePresence>
        {open && ref.current && (
          <Bubble key="bubble" id={id} anchor={ref.current}>
            <span className={s.full}>{full}</span>
            {by && <span className={s.by}>{by}</span>}
          </Bubble>
        )}
      </AnimatePresence>
    </>
  );
}

function Bubble({ id, anchor, children }: { id: string; anchor: HTMLElement; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number; below: boolean } | null>(null);

  // Ölç ve yerleştir: tarihin ortasına hizalı, ekran kenarından en az 12px içeride.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const a = anchor.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    const bar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bar-h')) || 56;
    const gap = 8;
    const edge = 12;
    const below = a.top - gap - b.height < bar + edge;
    const x = Math.round(Math.min(Math.max(a.left + a.width / 2 - b.width / 2, edge), window.innerWidth - edge - b.width));
    const y = Math.round(below ? a.bottom + gap : a.top - gap - b.height);
    setPos({ x, y, below });
  }, [anchor]);

  return createPortal(
    <motion.div
      ref={ref}
      id={id}
      role="tooltip"
      className={s.bubble}
      style={{
        left: pos?.x ?? 0,
        top: pos?.y ?? 0,
        visibility: pos ? 'visible' : 'hidden',
        transformOrigin: pos?.below ? '50% 0%' : '50% 100%',
      }}
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1, transition: { type: 'spring', bounce: 0.18, duration: 0.32 } }}
      exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.1 } }}
    >
      {children}
    </motion.div>,
    document.body,
  );
}

/** "6 Ağustos 2026 Perşembe · 14:32" */
function fullDate(iso: string, lang: Lang) {
  const d = new Date(iso);
  const locale = lang === 'tr' ? 'tr-TR' : 'en-GB';
  const day = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(d);
  return `${day} · ${time}`;
}
