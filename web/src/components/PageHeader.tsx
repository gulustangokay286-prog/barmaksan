import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from '../lib/link';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { Icon } from './Icon';
import { useChromeActions } from '../lib/ui';
import { useI18n } from '../lib/i18n';
import type { Crumb } from '../lib/api';
import s from './PageHeader.module.css';

const hrefOf = (c: Crumb) => (c.kind === 'machine' ? `/m/${c.slug}` : `/k/${c.slug}`);

export function Crumbs({ items }: { items: Crumb[] }) {
  const { pick, t } = useI18n();
  return (
    <nav className={s.crumbs} aria-label="Konum">
      <Link to="/">{t('home')}</Link>
      {items.map((c) => (
        <span key={c.slug} className={s.crumb}>
          <Icon name="chevronRight" size={12} strokeWidth={1.8} />
          <Link to={hrefOf(c)}>{pick(c.name)}</Link>
        </span>
      ))}
    </nav>
  );
}

/** Büyük başlık. Görünmez olduğunda üst bar kompakt başlığı gösterir. */
export function PageHeader({ crumbs, kicker, title, lead, meta, actions, children }: {
  crumbs?: Crumb[]; kicker?: string; title: string; lead?: ReactNode; meta?: ReactNode; actions?: ReactNode; children?: ReactNode;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  const { setTitleVisible } = useChromeActions();
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const bar = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--bar-h'), 10) || 56;
    const io = new IntersectionObserver(([e]) => setTitleVisible(e.isIntersecting), { rootMargin: `-${bar}px 0px 0px 0px`, threshold: 0.35 });
    io.observe(el);
    return () => {
      io.disconnect();
      setTitleVisible(true);
    };
  }, [setTitleVisible]);

  // Başlık üst barın altına girerken söner ve bulanıklaşır.
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 56px', 'end 0px'] });
  const opacity = useTransform(scrollYProgress, [0, 1], [1, reduce ? 1 : 0]);
  const y = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -10]);

  return (
    <header className={s.header}>
      {crumbs && <Crumbs items={crumbs} />}
      {kicker && <span className={s.kicker}>{kicker}</span>}
      <motion.h1 ref={ref} className={`t-large ${s.title}`} style={{ opacity, y }}>
        {title}
      </motion.h1>
      {lead && <p className={s.lead}>{lead}</p>}
      {meta && <div className={s.meta}>{meta}</div>}
      {actions && <div className={s.actions}>{actions}</div>}
      {children}
    </header>
  );
}

export function SectionTitle({ title, count, action, id }: { title: string; count?: number | null; action?: ReactNode; id?: string }) {
  return (
    <div className={s.sectionTitle} id={id}>
      <h2 className="t-title2">
        {title}
        {count != null && <span className={s.sectionCount}>{count}</span>}
      </h2>
      {action}
    </div>
  );
}
