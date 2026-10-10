// Kaydedilenler: üyelerin sık açtığı belgeler, hesapta (sunucuda) tutulur: her cihazda aynı liste.
// Üye değilse kaydetmek giriş/kayıt penceresini açar. Eskiden bu tarayıcıda (localStorage) biriken
// kayıtlar ilk girişte hesaba taşınır. Belgenin kalıcı kimliği saklanır, görüntü için başlık ve klasör de.
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { account, type Doc, type Name } from './api';
import { gate, useSession } from './session';

export type Bookmark = {
  id: string;
  title: Name;
  type: string;
  folder: { slug: string; kind: string; name: Name };
  thumb: string | null;
  savedAt: string;
};

const KEY = 'bk.saved';
const listeners = new Set<() => void>();
let cache: Bookmark[] | null = null;

function isName(value: unknown): value is Name {
  return !!value && typeof value === 'object' && 'tr' in value && typeof value.tr === 'string'
    && 'en' in value && (typeof value.en === 'string' || value.en === null);
}

function isBookmark(value: unknown): value is Bookmark {
  if (!value || typeof value !== 'object') return false;
  const b = value as Partial<Bookmark>;
  return typeof b.id === 'string' && !!b.id && isName(b.title) && typeof b.type === 'string'
    && !!b.folder && typeof b.folder.slug === 'string' && typeof b.folder.kind === 'string' && isName(b.folder.name)
    && (b.thumb === null || typeof b.thumb === 'string')
    && typeof b.savedAt === 'string' && Number.isFinite(Date.parse(b.savedAt));
}

function read(): Bookmark[] {
  if (cache) return cache;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    const seen = new Set<string>();
    cache = Array.isArray(raw) ? raw.filter(isBookmark).filter((b) => {
      if (seen.has(b.id)) return false;
      seen.add(b.id);
      return true;
    }).slice(0, 200) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(next: Bookmark[]) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* özel pencere */
  }
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) {
      cache = null;
      fn();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener('storage', onStorage);
  };
}

const EMPTY: Bookmark[] = [];

const savedKey = ['saved'] as const;
const snapshot = (doc: Doc): Bookmark => ({
  id: doc.id, title: doc.title, type: doc.type,
  folder: { slug: doc.folder.slug, kind: doc.folder.kind, name: doc.folder.name },
  thumb: doc.current?.file?.thumb ?? null, savedAt: new Date().toISOString(),
});

export function useBookmarks() {
  const { isMember } = useSession();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: savedKey, queryFn: () => account.saved<Bookmark>(), enabled: isMember, staleTime: 30_000 });
  const list = isMember ? (data ?? EMPTY).filter(isBookmark) : EMPTY;
  const local = useSyncExternalStore(subscribe, read, () => EMPTY);

  // Bu tarayıcıda kalmış eski kayıtlar ilk girişte hesaba taşınır.
  useEffect(() => {
    if (!isMember || !local.length) return;
    let cancelled = false;
    void (async () => {
      for (const b of [...local].reverse()) await account.save(b.id, b).catch(() => undefined);
      if (!cancelled) { write([]); await qc.invalidateQueries({ queryKey: savedKey }); }
    })();
    return () => { cancelled = true; };
  }, [isMember, local, qc]);

  const has = useCallback((id: string) => list.some((b) => b.id === id), [list]);
  const add = useCallback((doc: Doc) => {
    if (!isMember) { gate.open('saved'); return; }
    const item = snapshot(doc);
    qc.setQueryData<Bookmark[]>(savedKey, (cur = []) => [item, ...cur.filter((b) => b.id !== item.id)]);
    void account.save(item.id, item).catch(() => qc.invalidateQueries({ queryKey: savedKey }));
  }, [isMember, qc]);
  const remove = useCallback((id: string) => {
    if (!isMember) return;
    qc.setQueryData<Bookmark[]>(savedKey, (cur = []) => cur.filter((b) => b.id !== id));
    void account.unsave(id).catch(() => qc.invalidateQueries({ queryKey: savedKey }));
  }, [isMember, qc]);
  const toggle = useCallback((doc: Doc) => (list.some((b) => b.id === doc.id) ? remove(doc.id) : add(doc)), [list, add, remove]);
  const clear = useCallback(() => { for (const b of list) remove(b.id); }, [list, remove]);
  return { list, has, add, remove, toggle, clear, isMember };
}
