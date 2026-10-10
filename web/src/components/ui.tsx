import { forwardRef, useCallback, useRef, useState, type ButtonHTMLAttributes, type PointerEvent, type ReactNode } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { Icon, type IconName } from './Icon';
import { useTheme } from '../lib/theme';
import { useI18n } from '../lib/i18n';
import { versionLabel } from '../lib/format';
import s from './ui.module.css';

// ── Logolar ─────────────────────────────────────────────────────────────────

export function BrandLockup({ compact = false, onDark }: { compact?: boolean; onDark?: boolean }) {
  const [theme] = useTheme();
  const dark = onDark !== undefined ? onDark : theme === 'dark';
  return (
    <span className={s.lockup} data-compact={compact || undefined} aria-label="Barmaksan · Uğur Promilling">
      <img className={s.barmaksan} src={dark ? '/brand/barmaksan-dark.png' : '/brand/barmaksan-light.png'} alt="Barmaksan" width={836} height={272} />
      <span className={s.lockupRule} data-on-dark={dark || undefined} aria-hidden="true" />
      <img className={s.ugur} src={dark ? '/brand/ugur-dark.svg' : '/brand/ugur.svg'} alt="Uğur Promilling" width={248} height={114} />
    </span>
  );
}

// ── Buton ───────────────────────────────────────────────────────────────────

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'plain';
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName;
  iconRight?: IconName;
  children?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, iconRight, children, className, ...rest },
  ref,
) {
  return (
    <button ref={ref} className={[s.btn, s[variant], s[size], !children && s.iconOnly, className].filter(Boolean).join(' ')} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children && <span>{children}</span>}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 14 : 16} />}
    </button>
  );
});

export function LinkButton({ href, variant = 'secondary', size = 'md', icon, children, download, newTab }: {
  href: string; variant?: ButtonProps['variant']; size?: ButtonProps['size']; icon?: IconName; children?: ReactNode; download?: boolean; newTab?: boolean;
}) {
  return (
    <a
      href={href}
      className={[s.btn, s[variant], s[size], !children && s.iconOnly].filter(Boolean).join(' ')}
      download={download || undefined}
      target={newTab ? '_blank' : undefined}
      rel={newTab ? 'noopener' : undefined}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children && <span>{children}</span>}
    </a>
  );
}

// ── Segment kontrol (kayan seçim zemini) ────────────────────────────────────

export function Segmented<T extends string>({ value, options, onChange, id, size = 'md', tone }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; id: string; size?: 'sm' | 'md'; tone?: 'dark';
}) {
  return (
    <div className={s.segmented} data-size={size} data-tone={tone} role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} className={s.segment} onClick={() => onChange(o.value)}>
          {value === o.value && <motion.span layoutId={`seg-${id}`} className={s.segmentThumb} transition={{ type: 'spring', bounce: 0, duration: 0.32 }} />}
          <span className={s.segmentLabel}>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── Sürüm: yalnızca numara. "Güncel" kutusu yok; güncel olmayan açıkça yazılır. ──

export function VersionTag({ no, current = true, label }: { no: number; current?: boolean; label?: string }) {
  const { lang } = useI18n();
  return (
    <span className={s.version} data-old={!current || undefined}>
      <span>{versionLabel(no, lang)}</span>
      {label && <span className={s.versionLabel}>{label}</span>}
    </span>
  );
}

// ── Görsel: opaklıkla gelir (filtre yok — büyük yüzeyde blur kasar) ─────────

export function FadeImage({ src, alt = '', className, fit = 'contain', eager = false, style }: { src: string; alt?: string; className?: string; fit?: 'contain' | 'cover'; eager?: boolean; style?: React.CSSProperties }) {
  const [loadedSrc, setLoadedSrc] = useState('');
  const ref = useCallback((el: HTMLImageElement | null) => {
    if (el?.complete && el.naturalWidth > 0) setLoadedSrc(src);
  }, [src]);
  return (
    <img
      key={src}
      ref={ref}
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
      onLoad={() => setLoadedSrc(src)}
      className={[s.fadeImg, className].filter(Boolean).join(' ')}
      data-loaded={loadedSrc === src || undefined}
      style={{ objectFit: fit, ...style }}
    />
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className={s.kbd}>{children}</kbd>;
}

/** Etkinlik göstergesi (Apple tarzı, 8 çubuk). Renk metinden gelir. */
export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span className={s.spinner} style={{ width: size, height: size }} aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => (
        <span key={i} style={{ transform: `rotate(${i * 45}deg) translateY(-112%)`, animationDelay: `${(i - 8) * 100}ms` }} />
      ))}
    </span>
  );
}

// ── 3D eğim: imleç kartın neresindeyse kart o yöne eğilir (yaylı, kesintisiz) ──

const tiltSpring = { stiffness: 260, damping: 26, mass: 0.6 };

export function useTilt(max = 7) {
  const reduce = useReducedMotion();
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, tiltSpring);
  const sy = useSpring(py, tiltSpring);
  const rotateY = useTransform(sx, (v) => v * max);
  const rotateX = useTransform(sy, (v) => -v * max);
  const rect = useRef<DOMRect | null>(null);

  const onPointerEnter = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'mouse' || reduce) return;
    rect.current = e.currentTarget.getBoundingClientRect();
  };
  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'mouse' || reduce) return;
    const r = rect.current ?? e.currentTarget.getBoundingClientRect();
    px.set(((e.clientX - r.left) / r.width - 0.5) * 2);
    py.set(((e.clientY - r.top) / r.height - 0.5) * 2);
  };
  const onPointerLeave = () => {
    rect.current = null;
    px.set(0);
    py.set(0);
  };
  return {
    style: { rotateX, rotateY, transformPerspective: 900 },
    handlers: { onPointerEnter, onPointerMove, onPointerLeave },
  };
}
