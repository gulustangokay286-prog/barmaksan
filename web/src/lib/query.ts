import { QueryClient, queryOptions } from '@tanstack/react-query';
import { api } from './api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 30 * 60_000,
      retry: (count, err) => count < 2 && !(err && 'status' in err && (err as { status: number }).status === 404),
      refetchOnWindowFocus: false,
    },
  },
});

export const bootstrapQuery = () => queryOptions({ queryKey: ['bootstrap'], queryFn: api.bootstrap, staleTime: 5 * 60_000 });
export const folderQuery = (slug: string) => queryOptions({ queryKey: ['folder', slug], queryFn: () => api.folder(slug) });
export const docQuery = (id: string) => queryOptions({ queryKey: ['doc', id], queryFn: () => api.document(id) });
export const recentQuery = (limit: number) => queryOptions({ queryKey: ['recent', limit], queryFn: () => api.recent(limit) });

/** Veriyi bekler (yalnızca açılış perdesi için). Hata sayfaya bırakılır. */
export async function ensure(opts: object) {
  try {
    await queryClient.ensureQueryData(opts as never);
  } catch {
    /* sayfa hatayı kendi gösterir */
  }
  return null;
}

/**
 * Rota yükleyicisi: isteği başlatır, beklemez. Sayfa anında açılır; veri önbellekteyse
 * ilk karede gerçek içerik, değilse iskelet çizilir. Kenar çubuğunun yavaş hissetmesinin
 * asıl nedeni, geçişin ağ yanıtını beklemesiydi.
 */
export function warm(opts: object) {
  void queryClient.prefetchQuery(opts as never);
  return null;
}

/** Fareyle üzerine gelince / basınca veriyi ısıt. */
export function prefetchFolder(slug: string) {
  void queryClient.prefetchQuery(folderQuery(slug));
}

const warmed = new Set<string>();
export function prefetchDoc(id: string, fileId?: number, kind?: string) {
  void queryClient.prefetchQuery(docQuery(id));
  if (fileId && kind === 'pdf' && !warmed.has(id)) {
    warmed.add(id);
    const img = new Image();
    img.decoding = 'async';
    img.src = `/files/${fileId}/page/1.webp`;
  }
}

/**
 * Açılıştan sonra boşta kalan zamanda bütün klasör verilerini önbelleğe alır (≈250 KB, iki
 * eşzamanlı istek). Böylece kenar çubuğundaki her tıklama sıfır ağ gecikmesiyle açılır.
 */
let warmedAll = false;
export function warmEverything(tree: { slug: string }[]) {
  if (warmedAll || !tree.length) return;
  warmedAll = true;
  const slugs = tree.map((n) => n.slug);
  let i = 0;
  const pump = () => {
    if (i >= slugs.length) return;
    const slug = slugs[i++];
    const done = () => (typeof requestIdleCallback === 'function' ? requestIdleCallback(pump, { timeout: 400 }) : window.setTimeout(pump, 60));
    if (queryClient.getQueryData(['folder', slug])) return done();
    queryClient.prefetchQuery(folderQuery(slug)).finally(done);
  };
  const start = () => { pump(); pump(); };
  if (typeof requestIdleCallback === 'function') requestIdleCallback(start, { timeout: 2500 });
  else window.setTimeout(start, 1500);
}
