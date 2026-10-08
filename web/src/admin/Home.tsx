// Ana sayfa: üstteki fotoğraflar (kütüphanedeki fotoğraf belgelerinden, altyazılarıyla) ve
// makine vitrini. İkisi de sürükleyerek sıralanır; "Kaydet" ile sitede hemen değişir.
import { useMemo, useState } from 'react';
import { Reorder, useDragControls } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { FadeImage, Spinner } from '../components/ui';
import { Link } from '../lib/link';
import { api, type Doc } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useBootstrap } from '../lib/ui';
import { Dialog, EmptyNote, PageHead, useRun } from './shared';
import a from './admin.module.css';

type Caption = { tr: string; en: string };
const fold = (s: string) => s.toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i');

export default function AdminHome() {
  const { pick, lang } = useI18n();
  const tr = lang === 'tr';
  const { data: boot } = useBootstrap();
  const docs = useQuery({ queryKey: ['admin', 'documents'], queryFn: api.adminDocuments });
  const { run, busy, error } = useRun();

  // Taslak: sunucudaki ayar değişince (kaydettikten sonra) yeniden kurulur.
  const saved = boot?.home;
  const savedKey = saved ? JSON.stringify(saved) : '';
  const [draftFor, setDraftFor] = useState('');
  const [order, setOrder] = useState<string[]>([]);
  const [captions, setCaptions] = useState<Record<string, Caption>>({});
  const [featured, setFeatured] = useState<string[]>([]);
  if (saved && savedKey !== draftFor) {
    setDraftFor(savedKey);
    setOrder(saved.slides.map((s) => s.doc));
    setCaptions(Object.fromEntries(saved.slides.map((s) => [s.doc, { tr: s.caption.tr, en: s.caption.en ?? '' }])));
    setFeatured(saved.featured);
  }
  const [picker, setPicker] = useState<'photo' | 'machine' | null>(null);

  const docById = useMemo(() => new Map((docs.data ?? []).map((d) => [d.id, d])), [docs.data]);
  const savedThumb = useMemo(() => new Map((saved?.slides ?? []).map((s) => [s.doc, s.thumb ?? s.src])), [saved]);
  const machines = useMemo(() => (boot?.tree ?? []).filter((n) => n.kind === 'machine'), [boot]);
  const machineBySlug = useMemo(() => new Map(machines.map((m) => [m.slug, m])), [machines]);

  const dirty = !!saved && JSON.stringify({
    slides: order.map((id) => ({ doc: id, ...captions[id] })),
    featured,
  }) !== JSON.stringify({
    slides: saved.slides.map((s) => ({ doc: s.doc, tr: s.caption.tr, en: s.caption.en ?? '' })),
    featured: saved.featured,
  });

  const save = () => run('save', () => api.setHome({
    featured,
    slides: order.map((id) => ({ doc: id, tr: captions[id]?.tr || null, en: captions[id]?.en || null })),
  }), tr ? 'Ana sayfa güncellendi' : 'Home page updated');

  const addPhoto = (d: Doc) => {
    if (order.includes(d.id)) return;
    setOrder([...order, d.id]);
    setCaptions({ ...captions, [d.id]: { tr: d.title.tr, en: d.title.en ?? '' } });
  };

  return (
    <div className={a.page}>
      <PageHead
        title={tr ? 'Ana sayfa' : 'Home page'}
        lead={tr ? 'Kütüphanenin girişindeki fotoğraflar ve makine vitrini. Sürükleyerek sıralayın, kaydedince sitede hemen değişir.' : 'The photos and the machine showcase on the library’s front page. Drag to reorder; saving updates the site right away.'}
        actions={
          <>
            <Link to="/" className={a.secondary}>{tr ? 'Ana sayfayı aç' : 'Open home page'}</Link>
            <button className={a.primary} onClick={save} disabled={!dirty || !!busy}>{busy === 'save' ? <Spinner size={14} /> : (tr ? 'Kaydet' : 'Save')}</button>
          </>
        }
      />
      {error && <p className={a.error} role="alert">{error}</p>}

      <section className={a.card}>
        <div className={a.cardHead}>
          <h2>{tr ? 'Üstteki fotoğraflar' : 'Header photos'}</h2>
          <button className={a.textBtn} onClick={() => setPicker('photo')}><Icon name="plus" size={14} />{tr ? 'Fotoğraf ekle' : 'Add photo'}</button>
        </div>
        <p className={a.cardLead}>{tr ? 'Altı saniyede bir sırayla değişir; altyazı sol altta görünür.' : 'They change every six seconds; the caption shows at the bottom left.'}</p>
        {order.length === 0 ? (
          <EmptyNote>{tr ? 'Fotoğraf yok: üst bölüm düz zeminle görünür.' : 'No photos: the header shows a plain background.'}</EmptyNote>
        ) : (
          <Reorder.Group axis="y" values={order} onReorder={setOrder} className={a.reList}>
            {order.map((id, i) => (
              <SlideItem
                key={id}
                id={id}
                index={i}
                thumb={docById.get(id)?.current?.file?.thumb ?? savedThumb.get(id) ?? null}
                source={docById.get(id) ? pick(docById.get(id)!.title) : ''}
                caption={captions[id] ?? { tr: '', en: '' }}
                onCaption={(c) => setCaptions({ ...captions, [id]: c })}
                onRemove={() => setOrder(order.filter((x) => x !== id))}
              />
            ))}
          </Reorder.Group>
        )}
      </section>

      <section className={a.card} style={{ marginTop: 16 }}>
        <div className={a.cardHead}>
          <h2>{tr ? 'Makine vitrini' : 'Machine showcase'}</h2>
          <button className={a.textBtn} onClick={() => setPicker('machine')}><Icon name="plus" size={14} />{tr ? 'Makine ekle' : 'Add machine'}</button>
        </div>
        <p className={a.cardLead}>{tr ? 'Girişte dönen makineler. Yalnızca kapak fotoğrafı olan makineler gösterilir.' : 'Machines in the front-page carousel. Only machines with a cover photo are shown.'}</p>
        {featured.length === 0 ? (
          <EmptyNote>{tr ? 'Vitrinde makine yok.' : 'The showcase is empty.'}</EmptyNote>
        ) : (
          <Reorder.Group axis="y" values={featured} onReorder={setFeatured} className={a.reList}>
            {featured.map((slug, i) => {
              const m = machineBySlug.get(slug);
              return (
                <MachineItem key={slug} slug={slug} index={i} name={m ? pick(m.name) : slug} cover={m?.cover ?? null} code={m?.modelCode ?? null} onRemove={() => setFeatured(featured.filter((x) => x !== slug))} />
              );
            })}
          </Reorder.Group>
        )}
      </section>

      <PhotoPicker open={picker === 'photo'} docs={docs.data ?? []} chosen={order} onPick={addPhoto} onClose={() => setPicker(null)} />
      <Dialog
        open={picker === 'machine'}
        onClose={() => setPicker(null)}
        title={tr ? 'Vitrine makine ekle' : 'Add to showcase'}
        wide
        footer={<><span style={{ flex: 1 }} /><button className={a.primary} onClick={() => setPicker(null)}>{tr ? 'Bitti' : 'Done'}</button></>}
      >
        <ul className={a.pickGridLg}>
          {machines.filter((m) => m.cover).map((m) => {
            const on = featured.includes(m.slug);
            return (
              <li key={m.slug}>
                <button className={a.pickCard} data-on={on || undefined} onClick={() => setFeatured(on ? featured.filter((x) => x !== m.slug) : [...featured, m.slug])}>
                  <span className={a.pickCardImg} data-contain>{m.cover && <FadeImage src={m.cover} />}</span>
                  <span className={a.pickCardName}>{pick(m.name)}</span>
                  {on && <span className={a.pickCheck}><Icon name="check" size={14} strokeWidth={2} /></span>}
                </button>
              </li>
            );
          })}
        </ul>
      </Dialog>
    </div>
  );
}

function Grip({ onPointerDown }: { onPointerDown: (e: React.PointerEvent) => void }) {
  const { lang } = useI18n();
  return (
    <button className={a.grip} onPointerDown={onPointerDown} aria-label={lang === 'tr' ? 'Sürükleyerek sırala' : 'Drag to reorder'} type="button">
      <Icon name="grip" size={16} strokeWidth={2.4} />
    </button>
  );
}

function SlideItem({ id, index, thumb, source, caption, onCaption, onRemove }: {
  id: string; index: number; thumb: string | null; source: string; caption: Caption; onCaption: (c: Caption) => void; onRemove: () => void;
}) {
  const { lang } = useI18n();
  const tr = lang === 'tr';
  const controls = useDragControls();
  return (
    <Reorder.Item value={id} dragListener={false} dragControls={controls} className={a.reItem} whileDrag={{ scale: 1.01, boxShadow: '0 12px 32px rgba(0,0,0,0.16)' }}>
      <Grip onPointerDown={(e) => controls.start(e)} />
      <span className={a.reIndex}>{index + 1}</span>
      <span className={a.reThumb}>{thumb && <FadeImage src={thumb} fit="cover" />}</span>
      <div className={a.reFields}>
        <input value={caption.tr} onChange={(e) => onCaption({ ...caption, tr: e.target.value })} placeholder={tr ? 'Altyazı (Türkçe)' : 'Caption (Turkish)'} aria-label={tr ? 'Altyazı (Türkçe)' : 'Caption (Turkish)'} />
        <input value={caption.en} onChange={(e) => onCaption({ ...caption, en: e.target.value })} placeholder={tr ? 'Altyazı (İngilizce)' : 'Caption (English)'} aria-label={tr ? 'Altyazı (İngilizce)' : 'Caption (English)'} />
        {source && <span className={a.reSource}>{source}</span>}
      </div>
      <button className={a.iconBtnSm} onClick={onRemove} aria-label={tr ? 'Kaldır' : 'Remove'}><Icon name="close" size={15} /></button>
    </Reorder.Item>
  );
}

function MachineItem({ slug, index, name, cover, code, onRemove }: { slug: string; index: number; name: string; cover: string | null; code: string | null; onRemove: () => void }) {
  const { lang } = useI18n();
  const controls = useDragControls();
  return (
    <Reorder.Item value={slug} dragListener={false} dragControls={controls} className={a.reItem} whileDrag={{ scale: 1.01, boxShadow: '0 12px 32px rgba(0,0,0,0.16)' }}>
      <Grip onPointerDown={(e) => controls.start(e)} />
      <span className={a.reIndex}>{index + 1}</span>
      <span className={a.reThumb} data-contain>{cover && <FadeImage src={cover} />}</span>
      <div className={a.reFields}>
        <span className={a.reName}>{name}</span>
        {code && <span className={a.reSource}>{code}</span>}
        {!cover && <span className={a.reSource}>{lang === 'tr' ? 'Kapak fotoğrafı yok: vitrinde görünmez.' : 'No cover: hidden from the showcase.'}</span>}
      </div>
      <button className={a.iconBtnSm} onClick={onRemove} aria-label={lang === 'tr' ? 'Kaldır' : 'Remove'}><Icon name="close" size={15} /></button>
    </Reorder.Item>
  );
}

function PhotoPicker({ open, docs, chosen, onPick, onClose }: { open: boolean; docs: Doc[]; chosen: string[]; onPick: (d: Doc) => void; onClose: () => void }) {
  const { pick, lang } = useI18n();
  const tr = lang === 'tr';
  const [q, setQ] = useState('');
  const photos = docs.filter((d) => !d.archivedAt && d.current?.file?.kind === 'image');
  const needle = fold(q.trim());
  const list = needle ? photos.filter((d) => fold(`${d.title.tr} ${d.folder.name.tr}`).includes(needle)) : photos;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={tr ? 'Fotoğraf ekle' : 'Add photo'}
      wide
      footer={<><span className={a.hint}>{tr ? 'Yeni fotoğrafı önce Belgeler’den yükleyin.' : 'Upload new photos from Documents first.'}</span><span style={{ flex: 1 }} /><button className={a.primary} onClick={onClose}>{tr ? 'Bitti' : 'Done'}</button></>}
    >
      <label className={a.searchField} style={{ marginBottom: 14 }}>
        <Icon name="search" size={16} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr ? 'Fotoğraf ya da klasör ara' : 'Search photos or folders'} />
      </label>
      <ul className={a.pickGridLg}>
        {list.map((d) => {
          const on = chosen.includes(d.id);
          return (
            <li key={d.id}>
              <button className={a.pickCard} data-on={on || undefined} disabled={on} onClick={() => onPick(d)}>
                <span className={a.pickCardImg}>{d.current?.file?.thumb && <FadeImage src={d.current.file.thumb} fit="cover" />}</span>
                <span className={a.pickCardName}>{pick(d.title)}</span>
                {on && <span className={a.pickCheck}><Icon name="check" size={14} strokeWidth={2} /></span>}
              </button>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}
