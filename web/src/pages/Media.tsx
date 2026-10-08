// Medya kütüphanesi. İçerik önde, arayüz geride (Fotoğraflar uygulaması gibi):
// koleksiyonlar kendi kapaklarıyla seçilir; görseller kendi oranlarını koruyarak satırları
// tam dolduran bir ızgarada (justified) durur; tıklanan görsel lightbox'a büyür.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useInfiniteQuery, useQueries } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { FadeImage, Segmented, Spinner } from '../components/ui';
import { MediaSkeleton } from '../components/Skeletons';
import { api, type Doc } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useBootstrap, usePageChrome, useUi } from '../lib/ui';
import { folderQuery } from '../lib/query';
import { useRouteReady } from '../lib/route';
import { formatDuration, formatNumber } from '../lib/format';
import p from './pages.module.css';
import md from './media.module.css';

export default function Media() {
  const { t, pick, lang } = useI18n();
  const [params, setParams] = useSearchParams();
  const kind = (params.get('tur') ?? '') as '' | 'image' | 'video';
  const folder = params.get('klasor') ?? '';
  const { data: boot } = useBootstrap();
  const { setLightbox } = useUi();
  const ready = useRouteReady();
  usePageChrome(t('mediaLibrary'), { to: '/', label: t('home') });

  const q = useInfiniteQuery({
    queryKey: ['media', kind, folder],
    queryFn: ({ pageParam }) => api.media({ kind: kind || undefined, folder: folder || undefined, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next,
  });
  const items = useMemo(() => q.data?.pages.flatMap((pg) => pg.items) ?? [], [q.data]);
  const total = q.data?.pages[0]?.total;

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage();
    }, { rootMargin: '800px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [q]);

  // Koleksiyonlar: medya klasörleri + makine fotoğrafları.
  const collections = useMemo(() => {
    const tree = boot?.tree ?? [];
    const root = tree.find((n) => n.slug === 'medya' && n.parentId === null);
    const kids = root ? tree.filter((n) => n.parentId === root.id) : [];
    const machineCover = tree.find((n) => n.kind === 'machine' && n.cover)?.cover ?? null;
    return [
      ...kids.map((c) => ({ slug: c.slug, name: pick(c.name), count: c.docCount as number | null, cover: null as string | null })),
      { slug: 'makineler', name: t('machines'), count: null, cover: machineCover },
    ];
  }, [boot, pick, t]);
  const covers = useQueries({ queries: collections.filter((c) => c.slug !== 'makineler').map((c) => folderQuery(c.slug)) });
  const coverOf = (slug: string, fallback: string | null) => {
    const i = collections.findIndex((c) => c.slug === slug);
    const docs = covers[i]?.data?.documents;
    return docs?.map((d) => d.current?.file?.thumb).find(Boolean) ?? fallback;
  };

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  // Gruplar: "Tümü"nde koleksiyonlara göre (makine fotoğrafları tek grupta), koleksiyon
  // sırasıyla; tek koleksiyon seçiliyken tek grup. Lightbox gruplar sırasıyla gezer.
  const groups = useMemo(() => {
    if (folder) return [{ key: folder, name: '', items }];
    const order = collections.map((c) => c.slug);
    const map = new Map<string, { key: string; name: string; items: Doc[] }>();
    for (const d of items) {
      const machine = d.folder.kind === 'machine';
      const key = machine ? 'makineler' : d.folder.slug;
      const g = map.get(key) ?? { key, name: machine ? t('machines') : pick(d.folder.name), items: [] };
      g.items.push(d);
      map.set(key, g);
    }
    return [...map.values()].sort((a, b) => (order.indexOf(a.key) + 1 || 99) - (order.indexOf(b.key) + 1 || 99));
  }, [items, folder, pick, t, collections]);
  const ordered = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  const current = collections.find((c) => c.slug === folder);
  const loading = !ready || q.isLoading;

  return (
    <div className={p.page}>
      <header className={md.header}>
        <h1 className={md.title}>{t('mediaLibrary')}</h1>
        <p className={md.lead}>
          {lang === 'tr'
            ? 'Tesisten, montajdan ve makinelerden fotoğraflar ve filmler. Hepsi orijinal çözünürlükte; indirdiğiniz dosya çekilen dosyadır.'
            : 'Photos and films from the plant, assembly and machines. All in original resolution; what you download is what was shot.'}
        </p>
      </header>

      <nav className={md.collections} aria-label={lang === 'tr' ? 'Koleksiyonlar' : 'Collections'}>
        <CollectionCard
          name={t('all')}
          count={boot?.stats.media ?? null}
          cover={null}
          active={!folder}
          onClick={() => set('klasor', '')}
          mosaic={collections.slice(0, 4).map((c) => coverOf(c.slug, c.cover))}
        />
        {collections.map((c) => (
          <CollectionCard
            key={c.slug}
            name={c.name}
            count={c.count}
            cover={coverOf(c.slug, c.cover)}
            contain={c.slug === 'makineler'}
            active={folder === c.slug}
            onClick={() => set('klasor', folder === c.slug ? '' : c.slug)}
          />
        ))}
      </nav>

      <div className={md.toolbar}>
        <p className={md.toolbarTitle}>
          {current ? current.name : (lang === 'tr' ? 'Bütün medya' : 'All media')}
          {total != null && <span className="tabular">{formatNumber(total, lang)}</span>}
        </p>
        <Segmented
          id="media-kind"
          value={kind}
          onChange={(v) => set('tur', v)}
          options={[{ value: '', label: t('all') }, { value: 'image', label: t('photos') }, { value: 'video', label: t('videos') }]}
        />
      </div>

      {loading ? (
        <MediaSkeleton />
      ) : items.length === 0 ? (
        <p className={p.empty}>{t('emptyFolder')}</p>
      ) : (
        <div className="fade-in">
          {groups.map((g) => {
            const offset = ordered.indexOf(g.items[0]);
            return (
              <section key={g.key} className={md.group}>
                {g.name && (
                  <h2 className={md.groupHead}>
                    {g.name}
                    <span className="tabular">{g.items.length}</span>
                  </h2>
                )}
                <Justified items={g.items} onOpen={(i) => setLightbox({ items: ordered, index: offset + i })} />
              </section>
            );
          })}
        </div>
      )}
      <div ref={sentinel} className={p.loadMore}>{q.isFetchingNextPage && <Spinner />}</div>
    </div>
  );
}

// ── Koleksiyon kartı: kendi kapağıyla ───────────────────────────────────────

function CollectionCard({ name, count, cover, mosaic, contain, active, onClick }: {
  name: string; count: number | null; cover: string | null; mosaic?: (string | null)[]; contain?: boolean; active: boolean; onClick: () => void;
}) {
  return (
    <button className={md.card} data-active={active || undefined} onClick={onClick} aria-pressed={active}>
      <span className={md.cardImage} data-contain={contain || undefined}>
        {mosaic ? (
          <span className={md.mosaic}>
            {mosaic.map((src, i) => <span key={i}>{src && <img src={src} alt="" loading="lazy" decoding="async" draggable={false} />}</span>)}
          </span>
        ) : cover ? (
          <img src={cover} alt="" loading="lazy" decoding="async" draggable={false} />
        ) : (
          <span className="skeleton" style={{ position: 'absolute', inset: 0, borderRadius: 0 }} />
        )}
      </span>
      <span className={md.cardText}>
        <span className={md.cardName}>{name}</span>
        {count != null && <span className={md.cardCount}>{count}</span>}
      </span>
    </button>
  );
}

// ── Justified ızgara: her görsel kendi oranında, her satır tam genişlikte ────

type Row = { h: number; items: { d: Doc; w: number }[] };

function layoutRows(items: Doc[], width: number, target: number, gap: number): Row[] {
  if (width <= 0) return [];
  const rows: Row[] = [];
  let cur: { d: Doc; ar: number }[] = [];
  let sum = 0;
  for (const d of items) {
    const f = d.current?.file;
    const ar = Math.min(2.6, Math.max(0.55, f?.width && f?.height ? f.width / f.height : 4 / 3));
    cur.push({ d, ar });
    sum += ar;
    const h = (width - gap * (cur.length - 1)) / sum;
    if (h <= target) {
      rows.push({ h, items: cur.map((c) => ({ d: c.d, w: c.ar * h })) });
      cur = [];
      sum = 0;
    }
  }
  if (cur.length) {
    // Son satır gerilmez: hedef yükseklikte kalır.
    const h = Math.min(target, (width - gap * (cur.length - 1)) / sum);
    rows.push({ h, items: cur.map((c) => ({ d: c.d, w: c.ar * h })) });
  }
  return rows;
}

function Justified({ items, onOpen }: { items: Doc[]; onOpen: (i: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const small = width > 0 && width < 640;
  const gap = small ? 4 : 8;
  const rows = useMemo(() => layoutRows(items, width, small ? 150 : 250, gap), [items, width, small, gap]);
  let index = -1;
  return (
    <div ref={ref} className={md.grid} style={{ ['--gap' as string]: `${gap}px` }}>
      {rows.map((row, r) => (
        <div key={r} className={md.row} style={{ height: row.h }}>
          {row.items.map(({ d, w }) => {
            index += 1;
            const i = index;
            return <Tile key={d.id} d={d} width={w} onOpen={() => onOpen(i)} />;
          })}
        </div>
      ))}
    </div>
  );
}

function Tile({ d, width, onOpen }: { d: Doc; width: number; onOpen: () => void }) {
  const { pick } = useI18n();
  const f = d.current?.file;
  const video = f?.kind === 'video';
  return (
    <button className={md.tile} style={{ width }} onClick={onOpen} aria-label={pick(d.title)}>
      <span data-media-id={d.id} className={md.frame}>
        {f?.thumb ? <FadeImage src={f.thumb} fit="cover" /> : <Icon name={video ? 'video' : 'photo'} size={24} />}
      </span>
      {video && (
        <span className={md.badge}>
          <Icon name="play" size={11} strokeWidth={1.6} />
          {f?.durationMs ? formatDuration(f.durationMs) : ''}
        </span>
      )}
      <span className={md.caption}>{pick(d.title)}</span>
    </button>
  );
}
