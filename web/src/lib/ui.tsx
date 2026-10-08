import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, editorKey, type Doc } from './api';

// ── Sunucudan ilk veri ──────────────────────────────────────────────────────

export function useBootstrap() {
  return useQuery({ queryKey: ['bootstrap'], queryFn: api.bootstrap, staleTime: 60_000 });
}

export function useDocTypes() {
  const { data } = useBootstrap();
  return useMemo(() => new Map((data?.docTypes ?? []).map((t) => [t.slug, t])), [data]);
}

// ── Arayüz durumu ───────────────────────────────────────────────────────────

export type UploadTarget = { mode: 'new'; folder: string; type?: string } | { mode: 'version'; docId: string; title: string };
export type LightboxState = { items: Doc[]; index: number } | null;

type UiCtx = {
  search: { open: boolean; query: string; origin: HTMLElement | null };
  /** origin: paneli açan düğme — panel ondan doğar ve ona geri döner. */
  openSearch: (query?: string, origin?: HTMLElement | null) => void;
  closeSearch: () => void;
  navOpen: boolean;
  setNavOpen: (v: boolean) => void;
  toast: string | null;
  notify: (msg: string) => void;
  editor: boolean;
  setEditor: (v: boolean) => void;
  editorSheet: boolean;
  setEditorSheet: (v: boolean) => void;
  upload: UploadTarget | null;
  setUpload: (t: UploadTarget | null) => void;
  lightbox: LightboxState;
  setLightbox: (l: LightboxState) => void;
};

const Ui = createContext<UiCtx | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [search, setSearch] = useState<UiCtx['search']>({ open: false, query: '', origin: null });
  const [navOpen, setNavOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [editor, setEditorState] = useState(() => !!editorKey.get());
  const [editorSheet, setEditorSheet] = useState(false);
  const [upload, setUpload] = useState<UploadTarget | null>(null);
  const [lightbox, setLightbox] = useState<LightboxState>(null);
  const toastTimer = useRef<number>(undefined);

  const notify = useCallback((msg: string) => {
    window.clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const setEditor = useCallback((v: boolean) => {
    if (!v) editorKey.set(null);
    setEditorState(v);
  }, []);

  const openSearch = useCallback((query = '', origin: HTMLElement | null = null) => setSearch({ open: true, query, origin }), []);
  const closeSearch = useCallback(() => setSearch((s) => ({ ...s, open: false })), []);

  // ⌘K / Ctrl+K / "/": görünen arama alanına odaklanır; görünen yoksa (mobil) arama sayfası açılır.
  useEffect(() => {
    // Kısayolla açılan panel de görünen arama düğmesinden doğar.
    const visibleTrigger = () => [...document.querySelectorAll<HTMLElement>('[data-search-trigger]')].find((el) => {
      if (!el.getClientRects().length) return false;
      const host = el.closest<HTMLElement>('[data-reveal-host]');
      const r = el.getBoundingClientRect();
      return (!host || parseFloat(getComputedStyle(host).opacity) > 0.5) && r.bottom > 0 && r.top < window.innerHeight;
    }) ?? null;
    const focusSearch = () => setSearch((s) => (s.open ? { ...s, open: false } : { open: true, query: '', origin: visibleTrigger() }));
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        focusSearch();
      } else if (e.key === '/' && !typing) {
        e.preventDefault();
        focusSearch();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const value = useMemo<UiCtx>(() => ({
    search, openSearch, closeSearch, navOpen, setNavOpen, toast, notify,
    editor, setEditor, editorSheet, setEditorSheet, upload, setUpload, lightbox, setLightbox,
  }), [search, openSearch, closeSearch, navOpen, toast, notify, editor, setEditor, editorSheet, upload, lightbox]);

  return <Ui.Provider value={value}>{children}</Ui.Provider>;
}

export function useUi() {
  const c = useContext(Ui);
  if (!c) throw new Error('UiProvider eksik');
  return c;
}

// ── Sayfa başlığı: büyük başlık kaybolunca üst bara geçer ───────────────────
// Durum ve eylemler ayrı bağlamlarda: eylemleri kullananlar (sayfalar, kök) başlık değişince
// yeniden çizilmez; yalnızca üst bar durumu dinler.

export type Trail = { label: string; to?: string }[];
type ChromeState = { title: string | null; titleVisible: boolean; back: { to: string; label: string } | null; trail: Trail | null };
type ChromeActions = {
  set: (p: { title: string | null; back?: { to: string; label: string } | null; trail?: Trail | null }) => void;
  setTitleVisible: (v: boolean) => void;
};
const ChromeStateCtx = createContext<ChromeState | null>(null);
const ChromeActionsCtx = createContext<ChromeActions | null>(null);

export function ChromeProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState<string | null>(null);
  const [back, setBack] = useState<ChromeState['back']>(null);
  const [titleVisible, setTitleVisible] = useState(true);
  const [trail, setTrail] = useState<Trail | null>(null);
  const actions = useMemo<ChromeActions>(() => ({
    set: (p) => {
      setTitle(p.title);
      setBack(p.back ?? null);
      setTrail(p.trail ?? null);
    },
    setTitleVisible,
  }), []);
  const state = useMemo(() => ({ title, back, titleVisible, trail }), [title, back, titleVisible, trail]);
  return (
    <ChromeActionsCtx.Provider value={actions}>
      <ChromeStateCtx.Provider value={state}>{children}</ChromeStateCtx.Provider>
    </ChromeActionsCtx.Provider>
  );
}

export function useChromeState() {
  const c = useContext(ChromeStateCtx);
  if (!c) throw new Error('ChromeProvider eksik');
  return c;
}
export function useChromeActions() {
  const c = useContext(ChromeActionsCtx);
  if (!c) throw new Error('ChromeProvider eksik');
  return c;
}

/** Sayfa, üst barın kompakt başlığını, geri hedefini ve (isteğe bağlı) tam konum izini bildirir. */
export function usePageChrome(title: string | null, back?: { to: string; label: string } | null, trail?: Trail | null) {
  const { set } = useChromeActions();
  const backTo = back?.to;
  const backLabel = back?.label;
  const trailKey = trail ? JSON.stringify(trail) : '';
  useEffect(() => {
    set({ title, back: backTo ? { to: backTo, label: backLabel ?? '' } : null, trail: trailKey ? JSON.parse(trailKey) : null });
  }, [title, backTo, backLabel, trailKey, set]);
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}
