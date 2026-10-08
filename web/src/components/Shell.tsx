import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { AnimatePresence, animate, motion, useDragControls, useMotionValue, useReducedMotion, useTransform, type MotionValue, type PanInfo } from 'motion/react';
import { Icon } from './Icon';
import { BrandLockup, Button } from './ui';
import { SearchTrigger } from './SearchTrigger';
import { topSearchReveal } from '../lib/reveal';
import { Link, NavLink, useGo } from '../lib/link';
import { useBootstrap, useChromeState, useUi } from '../lib/ui';
import { useI18n } from '../lib/i18n';
import { useTheme } from '../lib/theme';
import { formatNumber } from '../lib/format';
import { prefetchFolder } from '../lib/query';
import { useMediaQuery } from '../lib/viewport';
import { spring } from '../lib/motion';
import type { TreeNode } from '../lib/api';
import s from './Shell.module.css';

export { topSearchReveal };

// ── Ağaç verisi ─────────────────────────────────────────────────────────────

function useTree() {
  const { data } = useBootstrap();
  return useMemo(() => {
    const nodes = data?.tree ?? [];
    const children = new Map<number | null, TreeNode[]>();
    for (const n of nodes) {
      const list = children.get(n.parentId) ?? [];
      list.push(n);
      children.set(n.parentId, list);
    }
    const bySlug = new Map(nodes.map((n) => [n.slug, n]));
    const byId = new Map(nodes.map((n) => [n.id, n]));
    return { loaded: !!data, nodes, roots: children.get(null) ?? [], children, bySlug, byId };
  }, [data]);
}

const hrefOf = (n: { kind: string; slug: string }) => (n.kind === 'machine' ? `/m/${n.slug}` : `/k/${n.slug}`);
const ROOT_ORDER = new Map([['kurumsal', 0], ['makineler', 1], ['medya', 2]]);

function activeSlugOf(pathname: string) {
  const m = /^\/(m|k)\/([^/]+)/.exec(pathname);
  return m ? decodeURIComponent(m[2]) : null;
}

// Bölüm açık/kapalı durumu kalıcı: kullanıcı kendi düzenini bir kez kurar.
const COLLAPSE_KEY = 'bk.nav.collapsed';
function useCollapsedSections() {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(COLLAPSE_KEY) ?? '[]'));
    } catch {
      return new Set();
    }
  });
  const toggle = useCallback((slug: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      try {
        localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...next]));
      } catch {
        /* yoksay */
      }
      return next;
    });
  }, []);
  return { collapsed, toggle };
}

// ── Ağaç ────────────────────────────────────────────────────────────────────
// Hız notu: seçim anında görünür (animasyon beklemez), açılıp kapanma saf CSS
// (grid-template-rows), her dal memo'lu: bir tıklama yalnızca etkilenen dalları çizer.

type LinkProps = { node: TreeNode; active: boolean; onNavigate?: () => void; count?: number | null; indent: 1 | 2 };

const TreeLink = memo(function TreeLink({ node, active, onNavigate, count, indent }: LinkProps) {
  const { pick } = useI18n();
  return (
    <Link
      to={hrefOf(node)}
      className={s.treeLink}
      data-active={active || undefined}
      data-indent={indent}
      onClick={onNavigate}
      onPointerEnter={() => prefetchFolder(node.slug)}
      onPointerDown={() => prefetchFolder(node.slug)}
      onFocus={() => prefetchFolder(node.slug)}
      aria-current={active ? 'page' : undefined}
    >
      <span className={s.treeName}>{pick(node.name)}</span>
      {count != null && <span className={s.count}>{count}</span>}
    </Link>
  );
});

type BranchProps = {
  node: TreeNode;
  kids: TreeNode[];
  /** Etkin klasör bu dalın içindeyse onun slug'ı, değilse null (memo böylece boşa çizmez). */
  active: string | null;
  open: boolean;
  onToggle: (id: number) => void;
  onNavigate?: () => void;
  count: number | null;
};

const Branch = memo(function Branch({ node, kids, active, open, onToggle, onNavigate, count }: BranchProps) {
  const { pick } = useI18n();
  const expandable = kids.length > 0;
  return (
    <li>
      <div className={s.rowWrap}>
        {expandable && (
          <button className={s.disclosure} onClick={() => onToggle(node.id)} aria-expanded={open} aria-label={pick(node.name)} data-open={open || undefined}>
            <Icon name="chevronRight" size={14} strokeWidth={1.8} />
          </button>
        )}
        <TreeLink node={node} active={active === node.slug} onNavigate={onNavigate} count={count} indent={1} />
      </div>
      {expandable && open && (
        <div className={s.sub} data-open={open || undefined}>
          <ul>
            {kids.map((k) => (
              <li key={k.id}>
                <TreeLink node={k} active={active === k.slug} onNavigate={onNavigate} indent={2} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
});

function Tree({ onNavigate }: { onNavigate?: () => void }) {
  const { pick } = useI18n();
  const { loaded, roots, children, bySlug, byId } = useTree();
  const orderedRoots = useMemo(() => [...roots].sort((a, b) =>
    (ROOT_ORDER.get(a.slug) ?? ROOT_ORDER.size) - (ROOT_ORDER.get(b.slug) ?? ROOT_ORDER.size)
  ), [roots]);
  const { pathname } = useLocation();
  const active = activeSlugOf(pathname);
  const { collapsed, toggle: toggleSection } = useCollapsedSections();

  // Etkin klasörün ata zinciri otomatik açılır; elle açılanlar korunur.
  const ancestors = useMemo(() => {
    const set = new Set<number>();
    let n = active ? bySlug.get(active) : undefined;
    while (n?.parentId != null) {
      set.add(n.parentId);
      n = byId.get(n.parentId);
    }
    return set;
  }, [active, bySlug, byId]);

  const [open, setOpen] = useState<Set<number>>(() => new Set());
  useEffect(() => {
    setOpen((prev) => {
      let changed = false;
      const next = new Set(prev);
      ancestors.forEach((id) => {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [ancestors]);

  const toggle = useCallback((id: number) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  }), []);

  if (!loaded) return <TreeSkeleton />;

  const count = (n: TreeNode) => {
    if (n.kind === 'category') return (children.get(n.id) ?? []).length;
    if (n.kind === 'section') {
      const kids = children.get(n.id) ?? [];
      return kids.some((k) => k.kind === 'category') ? kids.reduce((sum, k) => sum + (children.get(k.id) ?? []).length, 0) : null;
    }
    return n.docCount || null;
  };

  const within = (node: TreeNode, kids: TreeNode[]) => (active && (node.slug === active || kids.some((k) => k.slug === active)) ? active : null);

  return (
    <nav className={s.tree} aria-label="Klasörler">
      {orderedRoots.map((section) => {
        const isCollapsed = collapsed.has(section.slug);
        return (
          <div key={section.id} className={s.treeSection} data-collapsed={isCollapsed || undefined}>
            <div className={s.sectionHead}>
              <Link to={hrefOf(section)} className={s.sectionLabel} onClick={onNavigate} data-active={active === section.slug || undefined} onPointerEnter={() => prefetchFolder(section.slug)}>
                <span>{pick(section.name)}</span>
              </Link>
              <span className={s.count}>{count(section)}</span>
              <button className={s.sectionToggle} onClick={() => toggleSection(section.slug)} aria-expanded={!isCollapsed} aria-label={pick(section.name)} data-collapsed={isCollapsed || undefined}>
                <Icon name="chevronDown" size={14} strokeWidth={1.8} />
              </button>
            </div>
            {!isCollapsed && <div className={s.sectionBody} data-open>
              <ul>
                {(children.get(section.id) ?? []).map((node) => {
                  const kids = children.get(node.id) ?? [];
                  return (
                    <Branch
                      key={node.id}
                      node={node}
                      kids={kids}
                      active={within(node, kids)}
                      open={open.has(node.id)}
                      onToggle={toggle}
                      onNavigate={onNavigate}
                      count={count(node)}
                    />
                  );
                })}
              </ul>
            </div>}
          </div>
        );
      })}
    </nav>
  );
}

/** Veri gelene kadar kenar çubuğunun gerçek şeklini koruyan iskelet. */
function TreeSkeleton() {
  const widths = [64, 52, 70, 48, 58, 44, 66, 54, 60, 50];
  return (
    <div className={s.tree} aria-hidden="true">
      {[0, 1, 2].map((g) => (
        <div key={g} className={s.treeSection}>
          <div className={`${s.skelLine} ${s.skelLabel}`} style={{ ['--i' as string]: g }} />
          {widths.slice(g * 3, g * 3 + 4).map((w, i) => (
            <div key={i} className={s.skelRow}>
              <div className={s.skelLine} style={{ width: `${w}%`, ['--i' as string]: g * 3 + i }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function PrimaryNav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useI18n();
  const items = [
    { to: '/', icon: 'library', label: t('home'), end: true },
    { to: '/son', icon: 'clock', label: t('recent') },
    { to: '/medya', icon: 'images', label: t('mediaLibrary') },
  ];
  return (
    <ul className={s.primary}>
      {items.map((i) => (
        <li key={i.to}>
          <NavLink to={i.to} end={i.end} className={s.primaryLink} onClick={onNavigate}>
            <Icon name={i.icon} size={18} />
            <span>{i.label}</span>
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

// ── Kontroller (üst bar ve mobil sayfa) ─────────────────────────────────────

/** Dil: tek bir çeviri ikonu; basınca küçük bir menü (Türkçe / English). */
function LangMenu({ placement = 'down' }: { placement?: 'down' | 'up' }) {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  const options = [{ value: 'tr' as const, label: 'Türkçe' }, { value: 'en' as const, label: 'English' }];
  return (
    <div ref={ref} className={s.langWrap}>
      <button
        className={s.iconBtn}
        data-open={open || undefined}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={lang === 'tr' ? 'Dil' : 'Language'}
        title={lang === 'tr' ? 'Dil' : 'Language'}
      >
        <Icon name="translate" size={19} strokeWidth={1.5} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className={s.langMenu}
            data-placement={placement}
            role="menu"
            initial={{ opacity: 0, scale: 0.92, y: placement === 'down' ? -4 : 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.12 } }}
            transition={{ type: 'spring', bounce: 0.18, duration: 0.3 }}
          >
            {options.map((o) => (
              <button key={o.value} role="menuitemradio" aria-checked={lang === o.value} className={s.langItem} onClick={() => { setLang(o.value); setOpen(false); }}>
                <span>{o.label}</span>
                {lang === o.value && <Icon name="check" size={15} strokeWidth={1.8} />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Tema: tek dokunuşla açık / koyu. İkon bir sonraki durumu değil, şimdikini gösterir ve dönerek değişir. */
function ThemeToggle() {
  const [theme, setTheme] = useTheme();
  const { lang } = useI18n();
  const dark = theme === 'dark';
  const label = lang === 'tr' ? (dark ? 'Açık temaya geç' : 'Koyu temaya geç') : (dark ? 'Switch to light theme' : 'Switch to dark theme');
  return (
    <button className={s.iconBtn} onClick={() => setTheme(dark ? 'light' : 'dark')} aria-label={label} title={label}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={theme}
          className={s.themeIcon}
          initial={{ opacity: 0, rotate: -70, scale: 0.6 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 70, scale: 0.6 }}
          transition={{ type: 'spring', bounce: 0.2, duration: 0.42 }}
        >
          <Icon name={dark ? 'moon' : 'sun'} size={19} strokeWidth={1.5} />
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

function SheetControls() {
  return (
    <div className={s.sheetControls}>
      <ThemeToggle />
      <LangMenu placement="up" />
    </div>
  );
}

// ── Kenar çubuğu ────────────────────────────────────────────────────────────

function SidebarFoot() {
  const { t, lang } = useI18n();
  const { data } = useBootstrap();
  const { editor } = useUi();
  return (
    <div className={s.foot}>
      {data ? (
        <p className={s.footStats}>
          <span className="tabular">{formatNumber(data.stats.machines, lang)} {t('machine')}</span>
          <span className="tabular">{formatNumber(data.stats.documents, lang)} {t('documents')}</span>
        </p>
      ) : (
        <div className={s.skelLine} style={{ width: '70%', height: 10 }} />
      )}
      <p className={s.footCredit}>Barmaksan Endüstri A.Ş. · Uğur Promilling</p>
      {editor && (
        <Link to="/admin" className={s.footAdmin}>
          {lang === 'tr' ? 'Yönetim paneli' : 'Administration'}
          <Icon name="arrowRight" size={13} />
        </Link>
      )}
    </div>
  );
}

/** Kenar çubuğu açılıp kapanırken panel ve içerik aynı yayla, birlikte kayar (yalnız transform). */
// Panel ve içerik tek bir değerden sürülür (0 kapalı → 1 açık): panel kayarken içeriğin sol
// boşluğu aynı eğriyle açılır/kapanır. İçerik yerinde genişler, hiçbir an savrulmaz.
const SIDEBAR_EASE = { duration: 0.42, ease: [0.32, 0.72, 0, 1] } as const;

const Sidebar = memo(function Sidebar({ open, hidden }: { open: MotionValue<number>; hidden: boolean }) {
  const x = useTransform(open, (v) => `${(v - 1) * 100}%`);
  const visibility = useTransform(open, (v) => (v <= 0.001 ? 'hidden' : 'visible'));
  const opacity = useTransform(open, [0.35, 1], [0, 1]);
  return (
    <motion.aside id="desktop-sidebar" className={s.sidebar} style={{ x, visibility }} inert={hidden}>
      <motion.div className={s.sidebarInner} style={{ opacity }}>
        <div className={s.sidebarScroll}>
          <PrimaryNav />
          <Tree />
        </div>
        <SidebarFoot />
      </motion.div>
    </motion.aside>
  );
});

/** Üç çizgi. Her basışta çizgiler sırayla kısa bir dalga yapar; açılışta oynamaz. */
function MenuGlyph({ open, played }: { open: boolean; played: boolean }) {
  return (
    <span className={s.burger} data-state={open ? 'open' : 'closed'} data-played={played || undefined} aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

// ── Üst bar ─────────────────────────────────────────────────────────────────

function SearchField() {
  const pointerEvents = useTransform(topSearchReveal, (v) => (v < 0.2 ? 'none' : 'auto'));
  const y = useTransform(topSearchReveal, [0, 1], [-6, 0]);
  return (
    <motion.div className={s.searchWrap} data-reveal-host style={{ opacity: topSearchReveal, y, pointerEvents }}>
      <SearchTrigger variant="bar" />
    </motion.div>
  );
}

type Crumb = { label: string; to?: string };

/** Konum izi: klasör yollarında önbellekteki ağaçtan, anında; doküman sayfasında sayfanın bildirdiğinden. */
function useCrumbs(): Crumb[] {
  const { pathname } = useLocation();
  const { title, back, trail } = useChromeState();
  const { t, pick } = useI18n();
  const { bySlug, byId } = useTree();
  return useMemo(() => {
    const home: Crumb = { label: t('home'), to: '/' };
    const m = /^\/(m|k)\/([^/]+)/.exec(pathname);
    if (m) {
      const chain: Crumb[] = [];
      let n = bySlug.get(decodeURIComponent(m[2]));
      while (n) {
        chain.unshift({ label: pick(n.name), to: hrefOf(n) });
        n = n.parentId != null ? byId.get(n.parentId) : undefined;
      }
      if (chain.length) return [home, ...chain];
    }
    if (pathname === '/') return [{ label: t('library') }];
    if (pathname.startsWith('/son')) return [home, { label: t('recent') }];
    if (pathname.startsWith('/medya')) return [home, { label: t('mediaLibrary') }];
    if (pathname.startsWith('/dokuman')) {
      if (trail) return [home, ...trail, ...(title ? [{ label: title }] : [])];
      return [home, ...(back ? [{ label: back.label, to: back.to }] : []), ...(title ? [{ label: title }] : [])];
    }
    return [home];
  }, [pathname, title, back, trail, t, pick, bySlug, byId]);
}

/** Ana sayfa: hero görünürken bugünün tarihi; aşağı inince "Bilgi Kütüphanesi". */
function HomeTitle() {
  const { titleVisible } = useChromeState();
  const { t, lang } = useI18n();
  const today = useMemo(() => new Intl.DateTimeFormat(lang === 'tr' ? 'tr-TR' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()), [lang]);
  const label = titleVisible ? today : t('library');
  return (
    <span className={s.homeTitle}>
      <span className={s.crumbCurrent} data-quiet={titleVisible || undefined}>{label}</span>
    </span>
  );
}

/** Geri: uygulama içinde geçmiş varsa bir önceki ekran, yoksa bir üst klasör. */
function BackButton() {
  const crumbs = useCrumbs();
  const navigate = useGo();
  const { t } = useI18n();
  const parent = crumbs.length > 1 ? crumbs[crumbs.length - 2].to ?? '/' : '/';
  const onBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(parent);
  };
  return (
    <button className={s.backBtn} onClick={onBack} aria-label={t('back')} title={t('back')}>
      <Icon name="chevronLeft" size={18} strokeWidth={1.8} />
    </button>
  );
}

function Crumbs() {
  const crumbs = useCrumbs();
  const { pathname } = useLocation();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { if (ref.current) ref.current.scrollLeft = ref.current.scrollWidth; }, [pathname, crumbs]);
  if (pathname === '/') return <nav className={s.crumbs} aria-label="Konum"><HomeTitle /></nav>;
  return (
    <nav ref={ref} className={s.crumbs} aria-label="Konum">
      <ol>
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={`${i}-${c.label}`} data-last={last || undefined}>
              {i > 0 && <Icon name="chevronRight" size={12} strokeWidth={1.8} />}
              {c.to && !last ? <Link to={c.to} className={s.crumbLink} title={c.label}>{c.label}</Link> : <span className={s.crumbCurrent} title={c.label} aria-current={last ? 'page' : undefined}>{c.label}</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Topbar({ expanded, onToggle, desktop }: { expanded: boolean; onToggle: () => void; desktop: boolean }) {
  const { editor, setUpload, openSearch } = useUi();
  const [played, setPlayed] = useState(false);
  const { t, lang } = useI18n();
  const { pathname } = useLocation();
  const folderSlug = activeSlugOf(pathname);

  return (
    <header className={s.topbar} data-home={pathname === '/' || undefined}>
      <div className={s.brandArea}>
          <button className={`${s.iconBtn} ${s.sidebarToggle}`} onClick={() => { setPlayed(true); onToggle(); }} aria-expanded={expanded} aria-controls={desktop ? 'desktop-sidebar' : 'mobile-sidebar'} aria-label={lang === 'tr' ? (expanded ? 'Kenar çubuğunu kapat' : 'Kenar çubuğunu aç') : (expanded ? 'Close sidebar' : 'Open sidebar')} title={lang === 'tr' ? (expanded ? 'Kenar çubuğunu kapat' : 'Kenar çubuğunu aç') : (expanded ? 'Close sidebar' : 'Open sidebar')}>
            <MenuGlyph open={expanded} played={played} />
          </button>
        <Link to="/" className={s.brand} aria-label={t('library')}>
          <BrandLockup compact />
        </Link>
      </div>
      <div className={s.topbarInner}>
        <div className={s.topLeft}>

          {pathname !== '/' && <span className={s.backDesk}><BackButton /></span>}
          <Crumbs />
        </div>
        <div className={s.topRight}>
          {editor && (
            <Button size="sm" variant="primary" className={s.uploadBtn} icon="upload" onClick={() => setUpload({ mode: 'new', folder: folderSlug ?? '' })}>
              <span className={s.hideSm}>{t('upload')}</span>
            </Button>
          )}
          <div className={s.searchSlot}><SearchField /></div>
          <button className={s.searchMobile} data-search-trigger="mobile" onClick={(e) => openSearch('', e.currentTarget)} aria-label={t('search')}>
            <Icon name="search" size={20} />
          </button>
          <div className={s.hideSm}><ThemeToggle /></div>
          <div className={s.hideSm}><LangMenu /></div>
        </div>
      </div>
    </header>
  );
}

// ── Mobil ───────────────────────────────────────────────────────────────────

function TabBar() {
  const { t } = useI18n();
  const { openSearch, setNavOpen, navOpen } = useUi();
  const { pathname } = useLocation();
  const tabs = [
    { key: 'home', icon: 'library', label: t('home'), to: '/', active: pathname === '/' && !navOpen },
    { key: 'folders', icon: 'folder', label: t('folders'), onClick: () => setNavOpen(true), active: navOpen || /^\/(k|m|dokuman)\//.test(pathname) },
    { key: 'media', icon: 'images', label: t('media'), to: '/medya', active: pathname.startsWith('/medya') && !navOpen },
    { key: 'search', icon: 'search', label: t('search'), onClick: () => openSearch(), active: false },
  ];
  return (
    <nav className={s.tabbar} aria-label="Sekmeler">
      {tabs.map((tab) => {
        const inner = (
          <>
            <Icon name={tab.icon} size={22} strokeWidth={tab.active ? 1.75 : 1.5} />
            <span>{tab.label}</span>
          </>
        );
        return tab.to ? (
          <Link key={tab.key} to={tab.to} className={s.tab} data-active={tab.active || undefined} onClick={() => setNavOpen(false)}>{inner}</Link>
        ) : (
          <button key={tab.key} className={s.tab} data-active={tab.active || undefined} onClick={tab.onClick}>{inner}</button>
        );
      })}
    </nav>
  );
}

function NavSheet() {
  const { navOpen, setNavOpen } = useUi();
  const { t } = useI18n();
  const controls = useDragControls();
  const close = () => setNavOpen(false);
  const onDragEnd = (_: unknown, info: PanInfo) => {
    const projected = info.offset.y + (info.velocity.y / 1000) * (0.998 / (1 - 0.998));
    if (projected > 220) close();
  };
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setNavOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen, setNavOpen]);
  return (
    <AnimatePresence>
      {navOpen && (
        <>
          <motion.div className={s.scrim} onClick={close} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
          <motion.div
            id="mobile-sidebar"
            className={s.sheet}
            role="dialog"
            aria-modal="true"
            aria-label={t('folders')}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%', transition: { type: 'spring', bounce: 0, duration: 0.3 } }}
            transition={spring.base}
            drag="y"
            dragListener={false}
            dragControls={controls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.9 }}
            onDragEnd={onDragEnd}
          >
            <div className={s.sheetHead} onPointerDown={(e) => controls.start(e)}>
              <span className="t-headline">{t('folders')}</span>
              <Button variant="ghost" icon="close" aria-label={t('close')} onClick={close} />
            </div>
            <div className={s.sheetBody}>
              <PrimaryNav onNavigate={close} />
              <Tree onNavigate={close} />
              <SheetControls />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Toast() {
  const { toast } = useUi();
  return (
    <div className={s.toastWrap} aria-live="polite">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast}
            className={s.toast}
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            transition={spring.base}
          >
            <Icon name="check" size={16} />
            <span>{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Ekran geçişi perdesi ────────────────────────────────────────────────────

/**
 * Açılış perdesinin küçüğü: içerik alanı kapanır, Barmaksan logosu açılıştaki gibi belirir,
 * altın çizgi dolar; sonra perde logonun ekseninden ikiye ayrılıp yeni ekranı gösterir.
 * Görsel morph'lu geçişlerde (html[data-morph]) ve azaltılmış harekette çıkmaz.
 */
const CURTAIN_MS = 960;
function RouteCurtain() {
  const { pathname } = useLocation();
  const [prevPath, setPrevPath] = useState(pathname);
  const [shown, setShown] = useState<string | null>(null);
  // Yol değiştiği çizimin İÇİNDE perdeyi aç (efektte değil): yeni ekran perdesiz tek bir kare bile
  // boyanmasın. Efektle açınca sayfa önce görünüp perde bir kare geç geliyordu.
  if (pathname !== prevPath) {
    setPrevPath(pathname);
    const skip = !!document.documentElement.dataset.morph || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!skip) setShown(pathname);
  }
  useEffect(() => {
    if (!shown) return;
    const id = window.setTimeout(() => setShown((v) => (v === shown ? null : v)), CURTAIN_MS);
    return () => window.clearTimeout(id);
  }, [shown]);
  if (!shown) return null;
  const face = (
    <div className={s.cStage}>
      <div className={s.cLogo}>
        <img className={`${s.cMark} ${s.cDark}`} src="/brand/barmaksan-dark.png" alt="" draggable={false} />
        <img className={`${s.cWord} ${s.cDark}`} src="/brand/barmaksan-dark.png" alt="" draggable={false} />
        <img className={`${s.cMark} ${s.cLight}`} src="/brand/barmaksan-light.png" alt="" draggable={false} />
        <img className={`${s.cWord} ${s.cLight}`} src="/brand/barmaksan-light.png" alt="" draggable={false} />
      </div>
      <div className={s.cLine}><span /></div>
    </div>
  );
  return (
    <div key={shown} className={s.curtain} aria-hidden="true">
      <div className={`${s.cHalf} ${s.cTop}`}>{face}</div>
      <div className={`${s.cHalf} ${s.cBot}`}>{face}</div>
    </div>
  );
}

// ── Kabuk ───────────────────────────────────────────────────────────────────

export function Shell({ children, overlays }: { children: ReactNode; overlays?: ReactNode }) {
  const desktop = useMediaQuery('(min-width: 1024px)');
  const { navOpen, setNavOpen } = useUi();
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('bk.sidebar.closed') === 'true'; } catch { return false; }
  });
  const reduced = useReducedMotion();
  const open = useMotionValue(collapsed ? 0 : 1);
  // Sol boşluk doğrudan padding'e yazılır: kalıtılan bir CSS değişkeni, her karede bütün
  // içeriğin stilini yeniden hesaplatıyordu (kasma). Mobilde CSS bunu sıfırlar.
  const sideW = useMemo(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w')) || 264, []);
  const padLeft = useTransform(open, (v) => v * sideW);
  const toggleSidebar = () => {
    if (!desktop) { setNavOpen(!navOpen); return; }
    const next = !collapsed;
    try { localStorage.setItem('bk.sidebar.closed', String(next)); } catch { /* private mode */ }
    setCollapsed(next);
    if (reduced) open.set(next ? 0 : 1);
    else animate(open, next ? 0 : 1, SIDEBAR_EASE);
  };
  return (
    <div className={s.shell} data-sidebar-closed={collapsed || !desktop || undefined}>
      <Topbar expanded={desktop ? !collapsed : navOpen} onToggle={toggleSidebar} desktop={desktop} />
      <motion.div className={s.body} style={{ paddingLeft: padLeft }}>
        {desktop && <Sidebar open={open} hidden={collapsed} />}
        <main className={s.content}>
          <RouteCurtain />
          {children}
        </main>
      </motion.div>
      <TabBar />
      <NavSheet />
      <Toast />
      {overlays}
    </div>
  );
}
