import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { DateStamp } from '../components/DateStamp';
import { api, type MachineContent, type MachineProfile, type MaintenanceCategory, type MaintenanceTranslation } from '../lib/api';
import { folderQuery } from '../lib/query';
import { useBootstrap, useUi } from '../lib/ui';
import { useI18n } from '../lib/i18n';
import { ConfirmButton, Section, useRun } from './shared';
import a from './admin.module.css';
import s from './content.module.css';

const blankProfile = (): MachineProfile => ({ title: '', description: '', features: [], specifications: [], applications: [], productUrl: '', changeNote: '' });
const blankTopic = (): MaintenanceTranslation => ({ title: '', description: '', steps: [], warning: '', videos: [], documents: [], changeNote: '' });
const lines = (s: string) => s.split('\n');
const move = <T,>(items: T[], index: number, direction: number) => { const copy = [...items]; const to = index + direction; if (to < 0 || to >= copy.length) return copy; [copy[index], copy[to]] = [copy[to], copy[index]]; return copy; };

export type ContentPanel = 'profile' | 'gallery' | 'maintenance';
export function MachineContentEditor({ slug, panel, onStatus }: { slug: string; panel: ContentPanel | null; onStatus: (status: { dirty: boolean; busy: boolean }) => void }) {
  const { lang, locale, pick } = useI18n();
  const tr = lang === 'tr';
  const { data: boot } = useBootstrap();
  const { setUpload } = useUi();
  const { data: folder, error: loadError, refetch } = useQuery(folderQuery(slug));
  const history = useQuery({ queryKey: ['admin', 'contentHistory', slug], queryFn: () => api.machineContentHistory(slug) });
  const { run, busy, error } = useRun();
  const [value, setValue] = useState<MachineContent | null>(null);
  const [loaded, setLoaded] = useState('');
  const [code, setCode] = useState<string>(locale);
  const [note, setNote] = useState('');
  const stamp = `${slug}:${folder?.content?.revision}`;
  if (folder?.content && loaded !== stamp) { setValue(structuredClone(folder.content)); setLoaded(stamp); }
  const dirty = !!value && !!folder && JSON.stringify(value) !== JSON.stringify(folder.content);
  useEffect(() => onStatus({ dirty, busy: !!busy }), [dirty, busy, onStatus]);
  if (loadError) return <p className={a.error}><button type="button" onClick={() => void refetch()}>{tr ? 'Makine içeriği yüklenemedi. Yeniden dene.' : 'Could not load content. Retry.'}</button></p>;
  if (!value || !folder) return <p className={a.hint}>{tr ? 'İçerik yükleniyor…' : 'Loading content…'}</p>;
  const languages = boot?.languages ?? [{ code: 'tr', label: 'Türkçe', nativeName: 'Türkçe', direction: 'ltr' }, { code: 'en', label: 'English', nativeName: 'English', direction: 'ltr' }];
  const profile = value.profiles[code] ?? blankProfile();
  const profileChange = (patch: Partial<MachineProfile>) => setValue({ ...value, profiles: { ...value.profiles, [code]: { ...profile, ...patch } } });
  const categoryChange = (id: string, patch: Partial<MaintenanceCategory>) => setValue({ ...value, maintenance: value.maintenance.map((c) => c.id === id ? { ...c, ...patch } : c) });
  const photos = folder.documents.filter((d) => d.current?.file?.kind === 'image');
  const gallery = value.gallery ?? photos.map((d) => d.id);

  return <form id={`machine-content-${slug}`} className={s.editor} hidden={!panel} onSubmit={async (e) => {
    e.preventDefault();
    if (!dirty || busy) return;
    if (await run('content', () => api.saveMachineContent(slug, { ...value, note }), tr ? 'İçerik kaydedildi ve yayınlandı' : 'Content saved and published')) setNote('');
  }}>
    {panel !== 'gallery' && <div className={s.languageBar}>
      <label className={a.field}><span>{tr ? 'Düzenlenen dil' : 'Editing language'}</span><select value={code} onChange={(e) => setCode(e.target.value)}>{languages.map((l) => <option key={l.code} value={l.code}>{l.label} · {l.code.toUpperCase()}</option>)}</select></label>
      <p className={a.hint}>{tr ? 'Ziyaretçiler içeriği sitenin sağ üstünde seçtikleri dilde görür.' : 'Visitors see content in the language selected at the top right of the site.'}</p>
    </div>}
    <div hidden={panel !== 'profile'}>
    <Section title={tr ? 'Ürün açıklaması' : 'Product description'}>
      <div className={a.form} dir={languages.find((l) => l.code === code)?.direction ?? 'ltr'}>
        <label className={a.field}><span>{tr ? 'Ürün başlığı' : 'Product title'}</span><input value={profile.title} onChange={(e) => profileChange({ title: e.target.value })} /></label>
        <label className={a.field}><span>{tr ? 'Açıklama' : 'Description'}</span><textarea rows={6} value={profile.description} onChange={(e) => profileChange({ description: e.target.value })} /></label>
        <label className={a.field}><span>{tr ? 'Ürün özellikleri · her satıra bir özellik' : 'Product features · one per line'}</span><textarea rows={5} value={profile.features.join('\n')} onChange={(e) => profileChange({ features: lines(e.target.value) })} /></label>
        <label className={a.field}><span>{tr ? 'Kullanım alanları · her satıra bir alan' : 'Applications · one per line'}</span><textarea rows={3} value={profile.applications.join('\n')} onChange={(e) => profileChange({ applications: lines(e.target.value) })} /></label>
        <label className={a.field}><span>{tr ? 'Bu dildeki ürün sayfası bağlantısı' : 'Product page URL in this language'}</span><input type="url" value={profile.productUrl} onChange={(e) => profileChange({ productUrl: e.target.value })} /></label>
        <label className={a.field}><span>{tr ? 'Bu dilde ne değişti?' : 'What changed in this language?'}</span><input value={profile.changeNote} onChange={(e) => profileChange({ changeNote: e.target.value })} /></label>
        {value.profiles[code] && <ConfirmButton label={tr ? 'Bu dildeki ürün içeriğini kaldır' : 'Remove product content in this language'} confirm={tr ? 'Kaldırmayı onayla' : 'Confirm remove'} onConfirm={() => { const profiles = { ...value.profiles }; delete profiles[code]; setValue({ ...value, profiles }); }} />}
      </div>
    </Section>
    </div><div hidden={panel !== 'gallery'}>
    <Section title={tr ? 'Fotoğraf galerisi' : 'Photo gallery'} aside={<button type="button" className={a.textBtn} onClick={() => setUpload({ mode: 'new', folder: slug, type: 'fotograf' })}><Icon name="upload" size={14} />{tr ? 'Görsel yükle' : 'Upload image'}</button>}>
      <p className={a.hint}>{tr ? 'Görseller bu sırayla kendiliğinden geçer. Orijinal dosyalar korunur.' : 'Images rotate in this order. Original files are preserved.'}</p>
      <button type="button" className={a.textBtn} disabled={value.gallery === null} onClick={() => setValue({ ...value, gallery: null })}>{tr ? 'Tüm görselleri otomatik kullan' : 'Use all images automatically'}</button>
      <ul className={s.gallery}>{gallery.map((id, i) => { const doc = photos.find((d) => d.id === id); if (!doc) return null; return <li key={id}><img src={doc.current?.file?.thumb ?? ''} alt="" /><span>{pick(doc.title)}</span><OrderButtons index={i} length={gallery.length} move={(direction) => setValue({ ...value, gallery: move(gallery, i, direction) })} /><button type="button" className={a.textBtn} onClick={() => setValue({ ...value, gallery: gallery.filter((v) => v !== id) })}>{tr ? 'Çıkar' : 'Remove'}</button></li>; })}</ul>
      {photos.filter((d) => !gallery.includes(d.id)).map((d) => <button type="button" key={d.id} className={a.textBtn} onClick={() => setValue({ ...value, gallery: [...gallery, d.id] })}>+ {pick(d.title)}</button>)}
    </Section>
    </div><div hidden={panel !== 'maintenance'}>
    <Section title={tr ? 'Bakım bilgi bankası' : 'Maintenance knowledge base'} aside={<button type="button" className={a.textBtn} onClick={() => setValue({ ...value, maintenance: [...value.maintenance, { id: crypto.randomUUID(), titles: { [code]: '' }, topics: [] }] })}><Icon name="plus" size={14} />{tr ? 'Kategori ekle' : 'Add category'}</button>}>
      {!value.maintenance.length && <button type="button" className={a.secondary} onClick={() => setValue({ ...value, maintenance: [['Söküm ve demontaj','Removal and disassembly'],['Montaj','Assembly'],['Yağlama','Lubrication'],['Sorun giderme','Troubleshooting']].map(([tr, en]) => ({ id: crypto.randomUUID(), titles: { tr, en }, topics: [] })) })}>{tr ? 'Başlangıç kategorilerini ekle' : 'Add starter categories'}</button>}
      {value.maintenance.map((category, i) => <details key={category.id} className={s.item} open={!category.titles[code] || undefined}>
        <summary>{category.titles[code] || (tr ? 'Yeni bakım kategorisi' : 'New maintenance category')}</summary>
        <div className={s.categoryTools}>
          <label className={a.field}><span>{tr ? 'Kategori adı' : 'Category name'}</span><input value={category.titles[code] ?? ''} onChange={(e) => categoryChange(category.id, { titles: { ...category.titles, [code]: e.target.value } })} /></label>
          <OrderButtons index={i} length={value.maintenance.length} move={(direction) => setValue({ ...value, maintenance: move(value.maintenance, i, direction) })} />
          <ConfirmButton label={tr ? 'Kategoriyi kaldır' : 'Remove category'} confirm={tr ? 'Kaldırmayı onayla' : 'Confirm remove'} onConfirm={() => setValue({ ...value, maintenance: value.maintenance.filter((c) => c.id !== category.id) })} />
        </div>
        {category.topics.map((topic, ti) => {
          const entry = topic.translations[code] ?? blankTopic();
          const change = (patch: Partial<MaintenanceTranslation>) => categoryChange(category.id, { topics: category.topics.map((t) => t.id === topic.id ? { ...t, translations: { ...t.translations, [code]: { ...entry, ...patch } } } : t) });
          return <details key={topic.id} className={s.topic} open={!entry.title || undefined}>
            <summary>{entry.title || (tr ? 'Yeni konu' : 'New topic')}</summary>
            <div className={a.form}>
              <label className={a.field}><span>{tr ? 'Konu başlığı' : 'Topic title'}</span><input value={entry.title} onChange={(e) => change({ title: e.target.value })} /></label>
              <label className={a.field}><span>{tr ? 'Açıklama' : 'Description'}</span><textarea rows={3} value={entry.description} onChange={(e) => change({ description: e.target.value })} /></label>
              <label className={a.field}><span>{tr ? 'Adımlar · her satıra bir adım' : 'Steps · one per line'}</span><textarea rows={5} value={entry.steps.join('\n')} onChange={(e) => change({ steps: lines(e.target.value) })} /></label>
              <label className={a.field}><span>{tr ? 'Uyarı notu' : 'Warning note'}</span><textarea rows={2} value={entry.warning} onChange={(e) => change({ warning: e.target.value })} /></label>
              {entry.videos.map((video, vi) => <div key={vi} className={a.fieldRow}>
                <label className={a.field}><span>{tr ? 'Video başlığı' : 'Video title'}</span><input value={video.title} onChange={(e) => change({ videos: entry.videos.map((v, n) => n === vi ? { ...v, title: e.target.value } : v) })} /></label>
                <label className={a.field}><span>{tr ? 'Video bağlantısı' : 'Video URL'}</span><input type="url" value={video.url} onChange={(e) => change({ videos: entry.videos.map((v, n) => n === vi ? { ...v, url: e.target.value } : v) })} /></label>
                <button type="button" className={a.textBtn} onClick={() => change({ videos: entry.videos.filter((_, n) => n !== vi) })} aria-label={tr ? 'Videoyu kaldır' : 'Remove video'}><Icon name="close" size={15} /></button>
              </div>)}
              <button type="button" className={a.textBtn} onClick={() => change({ videos: [...entry.videos, { title: '', url: '' }] })}>+ {tr ? 'Video bağlantısı' : 'Video URL'}</button>
              <p className={a.subLabel}>{tr ? 'Video ve PDF dosyaları' : 'Video and PDF attachments'}</p>
              <button type="button" className={a.textBtn} onClick={() => setUpload({ mode: 'new', folder: slug, type: 'bakim-kilavuzu' })}>+ {tr ? 'Dosya yükle' : 'Upload file'}</button>
              {folder.documents.filter((d) => ['pdf', 'video'].includes(d.current?.file?.kind ?? '')).map((d) => <label key={d.id} className={s.check}><input type="checkbox" checked={entry.documents.includes(d.id)} onChange={(e) => change({ documents: e.target.checked ? [...entry.documents, d.id] : entry.documents.filter((id) => id !== d.id) })} />{pick(d.title)} · {d.language.toUpperCase()}</label>)}
              <label className={a.field}><span>{tr ? 'Değişiklik notu' : 'Change note'}</span><input value={entry.changeNote} onChange={(e) => change({ changeNote: e.target.value })} /></label>
              {topic.translations[code] && <ConfirmButton label={tr ? 'Bu dildeki konu içeriğini kaldır' : 'Remove topic content in this language'} confirm={tr ? 'Kaldırmayı onayla' : 'Confirm remove'} onConfirm={() => categoryChange(category.id, { topics: category.topics.map((t) => { if (t.id !== topic.id) return t; const translations = { ...t.translations }; delete translations[code]; return { ...t, translations }; }) })} />}
              <div className={s.categoryTools}><OrderButtons index={ti} length={category.topics.length} move={(direction) => categoryChange(category.id, { topics: move(category.topics, ti, direction) })} /><ConfirmButton label={tr ? 'Konuyu kaldır' : 'Remove topic'} confirm={tr ? 'Kaldırmayı onayla' : 'Confirm remove'} onConfirm={() => categoryChange(category.id, { topics: category.topics.filter((t) => t.id !== topic.id) })} /></div>
            </div>
          </details>;
        })}
        <button type="button" className={a.secondary} onClick={() => categoryChange(category.id, { topics: [...category.topics, { id: crypto.randomUUID(), translations: {} }] })}>+ {tr ? 'Bakım konusu' : 'Maintenance topic'}</button>
      </details>)}
    </Section>
    </div>
    <div className={s.saveBar}>
      <label className={a.field}><span>{tr ? 'Yayın notu' : 'Publication note'}</span><input value={note} onChange={(e) => setNote(e.target.value)} /></label>
      {error && <p className={a.error} role="alert">{error}</p>}
    </div>
    {!!history.data?.length && <details className={s.history}><summary>{tr ? 'İçerik değişiklikleri' : 'Content changes'}</summary><ul>{history.data.map((h) => <li key={h.revision}><DateStamp iso={h.createdAt} author={h.author} format="long" /> · {h.note || (tr ? 'İçerik güncellendi' : 'Content updated')}{h.author && ` · ${h.author}`}</li>)}</ul></details>}
  </form>;
}

function OrderButtons({ index, length, move }: { index: number; length: number; move: (direction: number) => void }) {
  const { lang } = useI18n();
  return <span className={s.order}><button type="button" className={a.iconBtn} disabled={index === 0} onClick={() => move(-1)} aria-label={lang === 'tr' ? 'Yukarı taşı' : 'Move up'}><Icon name="arrowUp" size={14} /></button><button type="button" className={a.iconBtn} disabled={index === length - 1} onClick={() => move(1)} aria-label={lang === 'tr' ? 'Aşağı taşı' : 'Move down'}><Icon name="chevronDown" size={14} /></button></span>;
}
