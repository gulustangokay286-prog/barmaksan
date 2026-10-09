// Kaydedilenler: kullanıcının sık açtığı belgeler. Yalnızca bu tarayıcıda (localStorage);
// sunucuya gitmez. Belgenin kalıcı kimliği saklanır, görüntü için başlık ve klasör de.
import { useCallback, useSyncExternalStore } from 'react';
import type { Doc, Name } from './api';

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

export function useBookmarks() {
  const list = useSyncExternalStore(subscribe, read, () => EMPTY);
  const has = useCallback((id: string) => list.some((b) => b.id === id), [list]);
  const add = useCallback((doc: Doc) => {
    const cur = read();
    if (cur.some((b) => b.id === doc.id)) return;
    write([{
      id: doc.id, title: doc.title, type: doc.type,
      folder: { slug: doc.folder.slug, kind: doc.folder.kind, name: doc.folder.name },
      thumb: doc.current?.file?.thumb ?? null, savedAt: new Date().toISOString(),
    }, ...cur].slice(0, 200));
  }, []);
  const remove = useCallback((id: string) => write(read().filter((b) => b.id !== id)), []);
  const toggle = useCallback((doc: Doc) => (read().some((b) => b.id === doc.id) ? remove(doc.id) : add(doc)), [add, remove]);
  const clear = useCallback(() => write([]), []);
  return { list, has, add, remove, toggle, clear };
}
