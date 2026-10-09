import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useGo } from '../lib/link';
import { AnimatePresence, animate, motion, useMotionValue, useMotionValueEvent, usePresence, useReducedMotion } from 'motion/react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Icon } from './Icon';
import { Spinner } from './ui';
import { DocThumb, DocContext, docHref } from './Docs';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useDocTypes, useUi } from '../lib/ui';
import { spring } from '../lib/motion';
import s from './SearchPalette.module.css';

// Sunucudaki katlamanın aynısı: her karakter tek karaktere eşlenir.
const FOLD: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u', Ç: 'c', Ğ: 'g', I: 'i', İ: 'i', Ö: 'o', Ş: 's', Ü: 'u' };
function fold(text: string) {
  let out = '';
  for (const ch of text) {
    const m = FOLD[ch];
    if (m) out += m;
    else {
      const l = ch.toLowerCase();
      out += l.length === 1 ? (l.normalize('NFD')[0] ?? l) : ch;
    }
  }
  return out;
}

export function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>;
  const folded = fold(text);
  const ranges: [number, number][] = [];
  for (const t of terms) {
    let from = 0;
    while (t && from < folded.length) {
      const at = folded.indexOf(t, from);
      if (at === -1) break;
      ranges.push([at, at + t.length]);
      from = at + t.length;
    }
  }
  return <>{renderRanges(text, ranges)}</>;
}

function renderRanges(text: string, ranges: [number, number][]) {
  if (!ranges.length) return text;
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out: ReactNode[] = [];
  let pos = 0;
  sorted.forEach(([a, b], i) => {
    if (a < pos) return;
    if (a > pos) out.push(text.slice(pos, a));
    out.push(<mark key={i}>{text.slice(a, b)}</mark>);
    pos = b;
  });
  if (pos < text.length) out.push(text.slice(pos));
  return out;
}

const FILTERS = ['', 'teknik-fis', 'teknik-cizim', 'spl', 'kullanim-kilavuzu', 'bakim-kilavuzu', 'yaglama-tablosu', 'sertifika', 'katalog'];
const RECENT_KEY = 'bk.recentSearches';

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return v;
}

export function SearchPalette() {
  const { search, closeSearch } = useUi();
  return (
    <AnimatePresence>
      {search.open && <Palette key="palette" initial={search.query} origin={search.origin} onClose={closeSearch} />}
    </AnimatePresence>
  );
}

// ── Düğmeden büyüme (paylaşılan öğe geçişi) ─────────────────────────────────
// Panel, kendisini açan düğmenin tam üstünde ve onun boyunda doğar: üst-sol köşesi düğmeyle
// çakışık, görünen alan düğmenin dikdörtgeni (clip-path). Sonra yerine kayarken alanı büyür,
// alttaki içerik bulanıklıktan netleşir ve çok hafif bir yayla oturur. Kapanırken aynı yoldan
// düğmeye geri döner. Düğme bu sırada gizlenir: ikisi tek nesne gibi görünür.

type Morph = { dx: number; dy: number; w: number; h: number; W: number; H: number; r0: number; bg0: string };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function measureMorph(panel: HTMLElement, origin: HTMLElement | null): Morph | null {
  if (!origin || !origin.isConnected) return null;
  const S = origin.getBoundingClientRect();
  if (S.width < 4 || S.bottom < 0 || S.top > window.innerHeight) return null;
  const host = origin.closest<HTMLElement>('[data-reveal-host]');
  if (host && parseFloat(getComputedStyle(host).opacity) < 0.3) return null;
  const prevT = panel.style.transform;
  const prevC = panel.style.clipPath;
  panel.style.transform = 'none';
  panel.style.clipPath = 'none';
  const P = panel.getBoundingClientRect();
  panel.style.transform = prevT;
  panel.style.clipPath = prevC;
  const os = getComputedStyle(origin);
  return {
    dx: S.left - P.left,
    dy: S.top - P.top,
    w: Math.min(S.width, P.width),
    h: Math.min(S.height, P.height),
    W: P.width,
    H: P.height,
    r0: parseFloat(os.borderTopLeftRadius) || 12,
    bg0: os.backgroundColor,
  };
}

function Palette({ initial, origin, onClose }: { initial: string; origin: HTMLElement | null; onClose: () => void }) {
  const { t, pick, lang, locale } = useI18n();
  const types = useDocTypes();
  const navigate = useGo();
  const reduce = useReducedMotion();
  const [isPresent, safeToRemove] = usePresence();
  const [q, setQ] = useState(initial);
  const [type, setType] = useState('');
  const [active, setActive] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounced = useDebounced(q.trim(), 80);
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    } catch {
      return [];
    }
  });

  // ── Geçiş: tek ilerleme değeri (0 = düğme, 1 = panel); stiller doğrudan yazılır ──
  const progress = useMotionValue(0);
  const morph = useRef<{ m: Morph | null; bg1: string }>({ m: null, bg1: '' });
  const [settled, setSettled] = useState(false);
  const [closing, setClosing] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const navigatingRef = useRef(false);

  const paint = (v: number) => {
    const panel = panelRef.current;
    const body = bodyRef.current;
    if (scrimRef.current) scrimRef.current.style.opacity = String(clamp01(v));
    if (!panel) return;
    const { m, bg1 } = morph.current;
    const c = clamp01(v);
    if (body) {
      const b = clamp01((c - 0.2) / 0.7);
      body.style.opacity = String(b);
      body.style.filter = b >= 0.999 ? '' : `blur(${((1 - b) * 16).toFixed(1)}px)`;
    }
    if (!m) {
      // Üst bar / kısayol: yukarıdan hafif bir yayla iner, bulanıklıktan netleşir.
      panel.style.transform = `translateY(${(1 - v) * -14}px) scale(${0.965 + 0.035 * v})`;
      panel.style.opacity = String(c);
      panel.style.filter = c >= 0.999 ? '' : `blur(${((1 - c) * 8).toFixed(1)}px)`;
      return;
    }
    // Konum yayla (hafif taşma serbest), alan ve köşe taşmasız.
    panel.style.transform = `translate(${m.dx * (1 - v)}px, ${m.dy * (1 - v)}px)`;
    const right = (m.W - lerp(m.w, m.W, c)).toFixed(1);
    const bottom = (m.H - lerp(m.h, m.H, c)).toFixed(1);
    const radius = lerp(m.r0, 18, c).toFixed(1);
    const clip = c >= 0.999 ? 'none' : `inset(0px ${right}px ${bottom}px 0px round ${radius}px)`;
    panel.style.clipPath = clip;
    panel.style.setProperty('-webkit-clip-path', clip);
    panel.style.backgroundColor = c >= 0.999 ? '' : `color-mix(in srgb, ${m.bg0} ${Math.round((1 - c) * 100)}%, ${bg1})`;
  };
  useMotionValueEvent(progress, 'change', paint);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    morph.current = {
      // Paylaşılan öğe geçişi yalnızca giriş sahnesindeki büyük düğmeden (aynı ölçüler).
      m: reduce || origin?.dataset.searchTrigger !== 'hero' ? null : measureMorph(panel, origin),
      bg1: getComputedStyle(panel).backgroundColor,
    };
    if (morph.current.m && origin) origin.style.visibility = 'hidden';
    progress.set(0);
    paint(0);
    const c = animate(progress, 1, morph.current.m
      ? { type: 'spring', bounce: 0.16, duration: 0.6 }
      : { type: 'spring', bounce: 0.18, duration: 0.45 });
    c.then(() => setSettled(true));
    inputRef.current?.focus({ preventScroll: true });
    return () => {
      c.stop();
      if (origin) origin.style.visibility = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isPresent) return;
    if (navigatingRef.current) {
      if (origin) origin.style.visibility = '';
      safeToRemove?.();
      return;
    }
    const panel = panelRef.current;
    setSettled(false);
    setClosing(true);
    if (panel && !reduce && origin?.dataset.searchTrigger === 'hero') {
      const m = measureMorph(panel, origin);
      morph.current = { m, bg1: morph.current.bg1 };
      if (m && origin) origin.style.visibility = 'hidden';
    }
    const c = animate(progress, 0, morph.current.m
      ? { type: 'spring', bounce: 0, duration: 0.42 }
      : { type: 'spring', bounce: 0, duration: 0.26 });
    c.then(() => {
      if (origin) origin.style.visibility = '';
      safeToRemove?.();
    });
    return () => c.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPresent]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const { data, isFetching } = useQuery({
    queryKey: ['search', debounced, type, locale],
    queryFn: ({ signal }) => api.search(debounced, type || undefined, signal, locale),
    enabled: debounced.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const result = debounced ? data : undefined;

  const items = useMemo(() => {
    if (!result) return [] as { key: string; href: string }[];
    return [
      ...result.folders.filter((f) => f.kind === 'machine').map((f) => ({ key: `f-${f.slug}`, href: `/m/${f.slug}` })),
      ...result.folders.filter((f) => f.kind !== 'machine').map((f) => ({ key: `f-${f.slug}`, href: `/k/${f.slug}` })),
      ...result.documents.map((d) => ({ key: `d-${d.id}`, href: docHref(d) })),
    ];
  }, [result]);

  useEffect(() => setActive(0), [debounced, type]);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const go = (href: string) => {
    navigatingRef.current = true;
    if (origin) origin.style.visibility = '';
    if (rootRef.current) rootRef.current.style.display = 'none';
    if (debounced) {
      const next = [debounced, ...recent.filter((r) => r !== debounced)].slice(0, 6);
      setRecent(next);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* yoksay */
      }
    }
    onClose();
    navigate(href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, Math.max(items.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && items[active]) {
      e.preventDefault();
      go(items[active].href);
    }
  };

  const terms = result?.terms ?? [];
  let index = -1;
  const empty = debounced && result && result.folders.length === 0 && result.documents.length === 0;

  return (
    <div ref={rootRef} className={s.root} onKeyDown={onKeyDown}>
      <div ref={scrimRef} className={s.scrim} onClick={onClose} style={{ opacity: 0 }} />
      <div
        ref={panelRef}
        className={s.panel}
        data-settled={settled || undefined}
        data-closing={closing || undefined}
        role="dialog"
        aria-modal="true"
        aria-label={t('search')}
      >
        <div className={s.inputRow}>
          <span className={s.inputIcon}>{isFetching && debounced ? <Spinner /> : <Icon name="search" size={20} strokeWidth={1.7} />}</span>
          <input
            ref={inputRef}
            className={s.input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={lang === 'tr' ? 'Makine, belge ya da parça kodu ara' : 'Search machines, documents or part codes'}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            aria-label={t('search')}
            aria-controls="search-results"
          />
          {closing && <span className={s.ghost} aria-hidden="true">{lang === 'tr' ? 'Makine, belge ya da parça kodu ara' : 'Search machines, documents or part codes'}</span>}
          {q && (
            <button className={s.clear} onClick={() => { setQ(''); inputRef.current?.focus(); }} aria-label={lang === 'tr' ? 'Temizle' : 'Clear'}>
              <Icon name="close" size={16} />
            </button>
          )}
          <button className={s.cancel} onClick={onClose}>{t('cancel')}</button>
        </div>

        <div ref={bodyRef} className={s.body}>
          <div className={s.filters} role="tablist">
            {FILTERS.map((f) => {
              const dt = types.get(f);
              const label = f ? (dt?.short ?? pick(dt?.name)) : t('all');
              return (
                <button key={f || 'all'} role="tab" aria-selected={type === f} className={s.filter} onClick={() => { setType(f); inputRef.current?.focus(); }}>
                  {type === f && <motion.span layoutId="search-filter" className={s.filterThumb} transition={spring.snappy} />}
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          <div className={s.results} id="search-results" ref={listRef}>
            {!debounced && (
              <div className={s.idle}>
                <p className={s.hint}>{t('searchHint')}</p>
                {recent.length > 0 && (
                  <div className={s.recent}>
                    {recent.map((r) => (
                      <button key={r} className={s.recentItem} onClick={() => { setQ(r); inputRef.current?.focus(); }}>
                        <Icon name="clock" size={15} />
                        <span>{r}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {empty && (
              <div className={s.empty}>
                <p className="t-headline">{t('noResults')}</p>
                <p className="t-footnote ink-3">{t('noResultsHint')}</p>
              </div>
            )}

            {result && ([
              { key: 'm', label: t('machines'), list: result.folders.filter((f) => f.kind === 'machine') },
              { key: 'k', label: t('folders'), list: result.folders.filter((f) => f.kind !== 'machine') },
            ]).map((group) => group.list.length > 0 && (
              <section key={group.key}>
                <h3 className={s.groupLabel}>{group.label}</h3>
                <ul>
                  {group.list.map((f) => {
                    index += 1;
                    const i = index;
                    return (
                      <li key={f.slug}>
                        <button className={s.item} data-active={active === i} onMouseMove={() => setActive(i)} onClick={() => go(items[i].href)}>
                          <span className={s.folderThumb}>
                            {f.cover ? <img src={f.cover} alt="" /> : <Icon name="folder" size={18} />}
                          </span>
                          <span className={s.itemBody}>
                            <span className={s.itemTitle}><Highlight text={pick(f.name)} terms={terms} /></span>
                            <span className={s.itemMeta}>
                              {f.parent ? pick(f.parent) : ''}
                              {f.modelCode ? <span className="mono"> · {f.modelCode}</span> : null}
                            </span>
                          </span>
                          <Icon name="chevronRight" size={14} className={s.itemArrow} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}

            {result && result.documents.length > 0 && (
              <section>
                <h3 className={s.groupLabel}>{lang === 'tr' ? 'Dokümanlar' : 'Documents'}</h3>
                <ul>
                  {result.documents.map((d) => {
                    index += 1;
                    const i = index;
                    return (
                      <li key={d.id}>
                        <button className={s.item} data-active={active === i} onMouseMove={() => setActive(i)} onClick={() => go(items[i].href)}>
                          <DocThumb doc={d} size="sm" />
                          <span className={s.itemBody}>
                            <span className={s.itemTitle}><Highlight text={pick(d.title)} terms={terms} /></span>
                            <DocContext doc={d} showFolder />
                            {d.excerpt && (
                              <span className={s.excerpt}>
                                {renderRanges(d.excerpt.text, d.excerpt.highlights.map(([a, b]) => [a + (d.excerpt!.text.startsWith('…') ? 1 : 0), b + (d.excerpt!.text.startsWith('…') ? 1 : 0)]))}
                              </span>
                            )}
                          </span>
                          <Icon name="chevronRight" size={14} className={s.itemArrow} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
