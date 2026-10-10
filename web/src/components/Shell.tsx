import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { AnimatePresence, motion, useTransform } from 'motion/react';
import { Icon } from './Icon';
import { AccountMenu } from './AccountMenu';
import { BrandLockup, Button } from './ui';
import { SearchTrigger } from './SearchTrigger';
import { topSearchReveal } from '../lib/reveal';
import { Link, NavLink, useGoBack } from '../lib/link';
import { useBootstrap, useChromeState, useUi } from '../lib/ui';
import { useI18n } from '../lib/i18n';
import { useTheme } from '../lib/theme';
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
/** Ana bölümler birbirinden ayırt edilsin diye yalnızca bölüm başlıklarında simge; satırlar simgesiz. */
const ROOT_ICON = new Map([['kurumsal', 'briefcase'], ['makineler', 'factory'], ['medya', 'images']]);

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
  const navRef = useRef<HTMLElement>(null);

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

  // Neredeyim: açılan sayfanın satırı listede görünmüyorsa kenar çubuğu onu yumuşakça ortaya alır.
  useEffect(() => {
    if (!loaded || !active) return;
    const frame = requestAnimationFrame(() => {
      const row = navRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
      const box = row?.closest<HTMLElement>(`.${s.sidebarScroll}, .${s.sheetBody}`);
      if (!row || !box) return;
      const r = row.getBoundingClientRect(), b = box.getBoundingClientRect();
      if (r.top >= b.top + 8 && r.bottom <= b.bottom - 8) return;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      box.scrollTo({ top: box.scrollTop + r.top - b.top - b.height / 3, behavior: reduce ? 'auto' : 'smooth' });
    });
    return () => cancelAnimationFrame(frame);
  }, [loaded, active, open]);

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
    <nav ref={navRef} className={s.tree} aria-label="Klasörler">
      {orderedRoots.map((section) => {
        const isCollapsed = collapsed.has(section.slug);
        return (
          <div key={section.id} className={s.treeSection} data-collapsed={isCollapsed || undefined}>
            <div className={s.sectionHead}>
              <Link to={hrefOf(section)} className={s.sectionLabel} onClick={onNavigate} data-active={active === section.slug || undefined} aria-current={active === section.slug ? 'page' : undefined} onPointerEnter={() => prefetchFolder(section.slug)}>
                <Icon name={ROOT_ICON.get(section.slug) ?? 'folder'} size={16} strokeWidth={1.6} />
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
    { to: '/kaydedilenler', icon: 'bookmark', label: t('saved') },
    { to: '/medya', icon: 'images', label: t('mediaLibrary') },
  ];
  return (
    <ul className={s.primary}>
      {items.map((i) => (
        <li key={i.to}>
          <NavLink to={i.to} end={'end' in i ? i.end : undefined} className={s.primaryLink} onClick={onNavigate}>
            <Icon name={i.icon} size={18} />
            <span>{i.label}</span>
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

// ── Kontroller (üst bar ve mobil sayfa) ─────────────────────────────────────

/** Site genelinde arayüzü ve içerikleri yöneten tek dil seçimi. */
function LangMenu({ placement = 'down' }: { placement?: 'down' | 'up' }) {
  const { lang, locale, setLang } = useI18n();
  const { data: boot } = useBootstrap();
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
  const options = (boot?.languages ?? [{ code: 'tr', nativeName: 'Türkçe' }, { code: 'en', nativeName: 'English' }]).map((l) => ({ value: l.code, label: l.nativeName }));
  return (
    <div ref={ref} className={s.langWrap}>
      <button
        className={`${s.iconBtn} ${s.langButton}`}
        data-open={open || undefined}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={lang === 'tr' ? 'Dil' : 'Language'}
        title={lang === 'tr' ? 'Dil' : 'Language'}
      >
        <Icon name="translate" size={17} strokeWidth={1.5} />
        <span className={s.langCode}>{locale.toUpperCase()}</span>
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
              <button key={o.value} role="menuitemradio" aria-checked={locale === o.value} className={s.langItem} onClick={() => { setLang(o.value); setOpen(false); }}>
                <span>{o.label}</span>
                {locale === o.value && <Icon name="check" size={15} strokeWidth={1.8} />}
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
  const { editor, setUpload } = useUi();
  const { pathname } = useLocation();
  const folderSlug = activeSlugOf(pathname);
  return (
    <div className={s.foot}>
      {editor && (
        <button className={s.footUpload} onClick={() => setUpload({ mode: 'new', folder: folderSlug ?? '' })}>
          <Icon name="upload" size={16} strokeWidth={1.7} />
          <span>{t('upload')}</span>
          {folderSlug && <span className={s.footUploadHint}>{lang === 'tr' ? 'bu klasöre' : 'to this folder'}</span>}
        </button>
      )}
      {editor && (
        <Link to="/admin" className={s.footAdmin}>
          {lang === 'tr' ? 'Yönetim paneli' : 'Administration'}
          <Icon name="arrowRight" size={13} />
        </Link>
      )}
    </div>
  );
}

/*
 * Masaüstü kenar çubuğu: içerikle aynı CSS grid'in ilk sütunu. Aç/kapa yalnızca o sütunun genişliğini
 * değiştirir (0 ↔ 264px); panel ve içerik aynı düzen hesabında, ortak kenarı paylaşır: aralarında
 * boşluk, çizgi ya da kopma olamaz. Panelin içi 264px sabit; sütun açıldıkça görünür (yeniden dizilmez).
 */
const Sidebar = memo(function Sidebar({ open }: { open: boolean }) {
  return (
    <aside id="desktop-sidebar" className={s.sidebar} data-open={open || undefined} inert={!open} aria-hidden={!open || undefined}>
      <div className={s.sidebarInner}>
        <div className={s.sidebarScroll}>
          <PrimaryNav />
          <Tree />
        </div>
        <SidebarFoot />
      </div>
    </aside>
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

/** Geri: uygulama içinde geçmiş varsa bir önceki ekran, yoksa bir üst klasör. */
function BackButton() {
  const crumbs = useCrumbs();
  const { t } = useI18n();
  const parent = crumbs.length > 1 ? crumbs[crumbs.length - 2].to ?? '/' : '/';
  const onBack = useGoBack(parent);
  return (
    <button className={s.backBtn} onClick={onBack} aria-label={t('back')} title={t('back')}>
      <Icon name="chevronLeft" size={18} strokeWidth={1.8} />
    </button>
  );
}

/**
 * İç sayfalarda barın başlığı (iOS gezinme çubuğu): sayfanın büyük başlığı görünürken boş kalır,
 * başlık barın altına girince sayfanın adı belirir. Tam konum yolu sayfanın içinde durur ve satıra
 * sarar; barda yol olmadığı için uzun dillerde de taşmaz, kesilmez.
 */
/**
 * Üst bardaki geri: sayfanın kendi geri düğmesi (başlığın üstünde) görünürken saklanır; sayfa
 * kaydırılıp o düğme ekrandan çıkınca başlıkla birlikte belirir. Aynı anda tek geri düğmesi görünür.
 */
function BarBack() {
  const { titleVisible, inlineBack } = useChromeState();
  const hidden = inlineBack && titleVisible;
  return <span className={s.backDesk} data-hidden={hidden || undefined} aria-hidden={hidden || undefined}><BackButton /></span>;
}

function BarTitle() {
  const { title, titleVisible } = useChromeState();
  const { pathname } = useLocation();
  if (pathname === '/' || !title) return null;
  return <span className={s.barTitle} data-hidden={titleVisible || undefined} aria-hidden={titleVisible || undefined} title={title}>{title}</span>;
}

function Topbar({ expanded, onToggle, desktop }: { expanded: boolean; onToggle: () => void; desktop: boolean }) {
  const { openSearch } = useUi();
  const [played, setPlayed] = useState(false);
  const { t, lang } = useI18n();
  const { pathname } = useLocation();

  return (
    <header className={s.topbar} data-home={pathname === '/' || undefined}>
      <div className={s.brandArea}>
        <button className={`${s.iconBtn} ${s.sidebarToggle}`} onClick={() => { setPlayed(true); onToggle(); }} aria-expanded={expanded} aria-controls={desktop ? 'desktop-sidebar' : 'mobile-sidebar'} aria-label={lang === 'tr' ? 'Menü' : 'Menu'} title={lang === 'tr' ? (expanded ? 'Kenar çubuğunu kapat' : 'Kenar çubuğunu aç') : (expanded ? 'Close sidebar' : 'Open sidebar')}>
          <MenuGlyph open={expanded} played={played} />
          <span className={s.menuLabel} aria-hidden="true">{lang === 'tr' ? 'Menü' : 'Menu'}</span>
        </button>
        <Link to="/" className={s.brand} aria-label={t('library')}>
          <BrandLockup compact />
        </Link>
      </div>
      <div className={s.topbarInner}>
        <div className={s.topLeft}>

          {pathname !== '/' && <BarBack />}
          <BarTitle />
        </div>
        {/* Sağda tek sıra, hepsi 34px: arama · dil · tema · hesap. */}
        <div className={s.topRight}>
          <div className={s.topSearch}><SearchField /></div>
          <button className={s.searchMobile} data-search-trigger="mobile" onClick={(e) => openSearch('', e.currentTarget)} aria-label={t('search')}>
            <Icon name="search" size={20} />
          </button>
          <div className={s.hideSm}><LangMenu /></div>
          <div className={`${s.hideSm} ${s.themeCell}`}><ThemeToggle /></div>
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}

// ── Mobil ───────────────────────────────────────────────────────────────────

/**
 * Mobil gezinme: üç sekme (Ana sayfa, Medya, Kaydedilenler) ve sağda menü düğmesi.
 *
 * Geçiş FLIP ile ve yalnızca transform/opacity'yle yapılır (Web Animations API → bileşik katman):
 * sekmeler yeni düzene anında geçer, ikonlar ve hap eski yerlerinden yaylanarak kayar. Yeni sayfa
 * aynı anda çizilirken ana iş parçacığı meşgul olsa bile animasyon durup kalmaz. Hap üç parçadır
 * (sol uç, orta, sağ uç): genişlik değişirken yalnızca orta ölçeklenir, yuvarlak uçlar çarpılmaz.
 * Menü düğmesi klasörler, kurumsal sayfalar ve ayarların olduğu sayfayı açar; açıkken çarpıya döner.
 */
type TabGeometry = { icons: number[]; pill: { x: number; w: number } | null; label: { el: HTMLElement; x: number } | null };
const PILL_CAP = 28;
const TAB_MS = 680;
/** Yumuşak yavaşlama: aşma/geri tepme yok, sona doğru iyice süzülür. */
const TAB_EASE = 'cubic-bezier(0.25, 1, 0.3, 1)';

function TabBar() {
  const { t, lang } = useI18n();
  const { setNavOpen, navOpen } = useUi();
  const { pathname } = useLocation();
  const groupRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const before = useRef<TabGeometry | null>(null);
  const tabs = [
    { key: 'home', icon: 'home', label: t('home'), to: '/', active: pathname === '/' },
    { key: 'media', icon: 'images', label: t('media'), to: '/medya', active: pathname.startsWith('/medya') },
    { key: 'saved', icon: 'bookmark', label: t('saved'), to: '/kaydedilenler', active: pathname.startsWith('/kaydedilenler') },
  ];
  const activeIndex = tabs.findIndex((tab) => tab.active);
  const committed = useRef(activeIndex);

  /** Görünen geometri (süren animasyonlar dahil): yeni geçişin başlangıç noktası. */
  const capture = (): TabGeometry | null => {
    const group = groupRef.current;
    const pill = pillRef.current;
    if (!group || !pill) return null;
    const gx = group.getBoundingClientRect().left;
    const icons = [...group.querySelectorAll<SVGElement>('[data-tab] > svg')].map((el) => el.getBoundingClientRect().left - gx);
    const pr = pill.getBoundingClientRect();
    const right = (pill.lastElementChild as HTMLElement).getBoundingClientRect().right;
    const labelEl = group.querySelector<HTMLElement>('[data-tab-label]');
    return {
      icons,
      pill: pill.style.opacity === '0' || !pill.style.width ? null : { x: pr.left - gx, w: right - pr.left },
      label: labelEl ? { el: labelEl, x: labelEl.getBoundingClientRect().left - gx } : null,
    };
  };
  // Etkin sekme değişiyorsa, DOM henüz eski hâlindeyken başlangıç geometrisi alınır.
  if (committed.current !== activeIndex && !before.current) before.current = capture();

  useLayoutEffect(() => {
    committed.current = activeIndex;
    const group = groupRef.current;
    const pill = pillRef.current;
    const from = before.current;
    before.current = null;
    if (!group || !pill) return;
    const parts = [pill, ...Array.from(pill.children)] as HTMLElement[];
    const icons = [...group.querySelectorAll<SVGElement>('[data-tab] > svg')];
    for (const el of [...parts, ...icons]) el.getAnimations().forEach((a) => a.cancel());

    const gx = group.getBoundingClientRect().left;
    const tab = activeIndex >= 0 ? group.querySelectorAll<HTMLElement>('[data-tab]')[activeIndex] : null;
    const to = tab ? { x: tab.offsetLeft - 2, w: tab.offsetWidth + 4 } : null;
    if (to) {
      pill.style.width = `${to.w}px`;
      pill.style.transform = `translateX(${to.x}px)`;
    }
    pill.style.opacity = to ? '1' : '0';
    if (!from || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const opts: KeyframeAnimationOptions = { duration: TAB_MS, easing: TAB_EASE };
    icons.forEach((icon, i) => {
      const dx = (from.icons[i] ?? 0) - (icon.getBoundingClientRect().left - gx);
      if (Math.abs(dx) > 0.5) icon.animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }], opts);
    });
    if (to && from.pill) {
      const [, , middle, right] = parts; // parts = [hap, sol uç, orta, sağ uç]
      const span = (w: number) => Math.max(1, w - PILL_CAP * 2);
      pill.animate([{ transform: `translateX(${from.pill.x}px)` }, { transform: `translateX(${to.x}px)` }], opts);
      right.animate([{ transform: `translateX(${from.pill.w - to.w}px)` }, { transform: 'none' }], opts);
      middle.animate([{ transform: `scaleX(${span(from.pill.w) / span(to.w)})` }, { transform: 'none' }], opts);
    } else if (to) {
      pill.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 280, easing: 'ease-out' });
    }
    const label = group.querySelector<HTMLElement>('[data-tab-label]');
    label?.animate([{ opacity: 0, transform: 'translateX(-4px)' }, { opacity: 1, transform: 'none' }], { duration: 460, delay: 120, easing: TAB_EASE, fill: 'backwards' });
    // Giden etiket bir an yerinde kalıp söner; anında yok olmaz.
    if (from.label && !from.label.el.isConnected) {
      const ghost = from.label.el.cloneNode(true) as HTMLElement;
      ghost.removeAttribute('data-tab-label');
      ghost.style.cssText = `position:absolute;left:${from.label.x}px;top:50%;transform:translateY(-50%);pointer-events:none;z-index:1;color:var(--ink-3)`;
      group.appendChild(ghost);
      ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: 'ease-out' }).onfinish = () => ghost.remove();
    }
  }, [activeIndex]);

  const menuLabel = lang === 'tr' ? (navOpen ? 'Menüyü kapat' : 'Menü') : (navOpen ? 'Close menu' : 'Menu');
  return <nav className={s.tabbar} aria-label={lang === 'tr' ? 'Ana gezinme' : 'Main navigation'}>
    <div ref={groupRef} className={s.tabGroup} data-dim={navOpen || undefined}>
      <span ref={pillRef} className={s.tabPill} aria-hidden="true"><i /><i /><i /></span>
      {tabs.map((tab) => (
        <Link key={tab.key} to={tab.to} className={s.tab} data-tab data-active={tab.active || undefined} aria-label={tab.label} aria-current={tab.active ? 'page' : undefined} onClick={() => setNavOpen(false)}>
          <Icon name={tab.icon} size={23} strokeWidth={1.7} />
          {tab.active && <span className={s.tabLabel} data-tab-label>{tab.label}</span>}
        </Link>
      ))}
    </div>
    <button
      className={s.tabMenu}
      data-open={navOpen || undefined}
      onClick={() => setNavOpen(!navOpen)}
      aria-label={menuLabel}
      aria-expanded={navOpen}
      aria-controls="mobile-sidebar"
    >
      <span className={s.menuGlyph} aria-hidden="true"><span /><span /><span /></span>
    </button>
  </nav>;
}

/**
 * Mobil menü (alttan sayfa). İlk açılışta bir kez oluşturulur, sonra bellekte kalır: her açılışta
 * ağaç yeniden kurulmaz. Açılma/kapanma CSS geçişiyle (bileşik katman); sürükleyerek kapatma
 * doğrudan transform'u izler, bırakınca hız ve mesafeye göre kapanır ya da yerine döner.
 */
function NavSheet() {
  const { navOpen, setNavOpen, openSearch, editor, setUpload } = useUi();
  const { t, lang } = useI18n();
  const { pathname } = useLocation();
  const title = lang === 'tr' ? 'Menü' : 'Menu';
  const [mounted, setMounted] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; t: number; dy: number; v: number } | null>(null);
  const close = () => setNavOpen(false);
  useEffect(() => { if (navOpen) setMounted(true); }, [navOpen]);
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setNavOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen, setNavOpen]);
  if (!mounted) return null;

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as Element).closest('button')) return;
    drag.current = { y: e.clientY, t: performance.now(), dy: 0, v: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
    sheetRef.current?.setAttribute('data-dragging', '');
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const sheet = sheetRef.current;
    if (!d || !sheet) return;
    const raw = e.clientY - d.y;
    const dy = raw < 0 ? raw * 0.15 : raw;
    const now = performance.now();
    d.v = (dy - d.dy) / Math.max(1, now - d.t);
    d.dy = dy;
    d.t = now;
    sheet.style.transform = `translateY(${dy}px)`;
  };
  const onUp = () => {
    const d = drag.current;
    const sheet = sheetRef.current;
    drag.current = null;
    if (!sheet) return;
    sheet.removeAttribute('data-dragging');
    sheet.style.transform = '';
    if (d && d.dy + d.v * 220 > 200) close();
  };

  return (
    <>
      <div className={s.scrim} data-open={navOpen || undefined} onClick={close} aria-hidden="true" />
      <div
        ref={sheetRef}
        id="mobile-sidebar"
        className={s.sheet}
        data-open={navOpen || undefined}
        role="dialog"
        aria-modal={navOpen || undefined}
        aria-label={title}
        inert={!navOpen}
      >
        <div className={s.sheetHead} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <span className={s.grabber} aria-hidden="true" />
          <span className="t-headline">{title}</span>
          <div className={s.sheetActions}>
            {editor && <Button variant="ghost" icon="upload" aria-label={t('upload')} onClick={() => { close(); setUpload({ mode: 'new', folder: activeSlugOf(pathname) ?? '' }); }} />}
            <Button variant="ghost" icon="search" aria-label={t('search')} onClick={() => { close(); openSearch(); }} />
          </div>
        </div>
        <div className={s.sheetBody}>
          <PrimaryNav onNavigate={close} />
          <Tree onNavigate={close} />
          <SheetControls />
        </div>
      </div>
    </>
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
  const moveTimer = useRef(0);
  const toggleSidebar = () => {
    if (!desktop) { setNavOpen(!navOpen); return; }
    const next = !collapsed;
    try { localStorage.setItem('bk.sidebar.closed', String(next)); } catch { /* private mode */ }
    // Üst bardaki hizalama kaymaları yalnızca bu geçişte canlandırılır (pencere boyutu değişince değil).
    const html = document.documentElement;
    html.dataset.sidebarMoving = '';
    window.clearTimeout(moveTimer.current);
    moveTimer.current = window.setTimeout(() => { delete html.dataset.sidebarMoving; }, 520);
    setCollapsed(next);
  };
  const open = desktop && !collapsed;
  return (
    <div className={s.shell} data-sidebar-closed={!open || undefined}>
      <Topbar expanded={desktop ? !collapsed : navOpen} onToggle={toggleSidebar} desktop={desktop} />
      <div className={s.body}>
        {desktop && <Sidebar open={open} />}
        <main className={s.content}>
          <RouteCurtain />
          {children}
        </main>
      </div>
      <TabBar />
      <NavSheet />
      <Toast />
      {overlays}
    </div>
  );
}
