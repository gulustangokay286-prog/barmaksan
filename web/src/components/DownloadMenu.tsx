// Görsel indirme: üstte biçim (JPEG / PNG), altında boyut satırları; her satır tek dokunuşla
// indirir. Ölçüler ve kullanım ipucu düz dille yazılır; teknik ayrıntı (metadata) gösterilmez.
// Videolar ve diğer dosyalar tek düğmeyle orijinali indirir.
import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { Button, LinkButton, Segmented } from './ui';
import { downloadLink, type Doc } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { formatSize } from '../lib/format';
import s from './DownloadMenu.module.css';

type Format = 'jpg' | 'png';
const SIZES = [
  { key: 'kucuk', edge: 1280, label: { tr: 'Küçük', en: 'Small' }, hint: { tr: 'E-posta ve sunum', en: 'Email and slides' } },
  { key: 'orta', edge: 2560, label: { tr: 'Orta', en: 'Medium' }, hint: { tr: 'Web ve sosyal medya', en: 'Web and social media' } },
  { key: 'buyuk', edge: 4096, label: { tr: 'Büyük', en: 'Large' }, hint: { tr: 'Baskı', en: 'Print' } },
] as const;

export const exportLink = (id: string, size: string, format: Format) => `${downloadLink(id)}?boyut=${size}&bicim=${format}`;

/** Uzun kenarı `edge` olacak şekilde küçültülmüş ölçüler (büyütme yok). */
function scaled(w: number, h: number, edge: number | null) {
  const k = edge ? Math.min(1, edge / Math.max(w, h)) : 1;
  return `${Math.round(w * k)} × ${Math.round(h * k)}`;
}

export function DownloadMenu({ doc }: { doc: Doc }) {
  const { lang, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<Format>('jpg');
  const ref = useRef<HTMLDivElement>(null);
  const tr = lang === 'tr';
  const file = doc.current?.file;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    // Escape önce menüyü kapatır; görüntüleyiciye ulaşmaz.
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  if (!file) return null;
  if (file.kind !== 'image' || !file.width || !file.height) {
    return <LinkButton href={downloadLink(doc.id)} variant="ghost" icon="download" size="md">{t('downloadOriginal')}</LinkButton>;
  }
  const { width: w, height: h } = file;
  const sizes = SIZES.filter((x) => x.edge < Math.max(w, h));
  const close = () => setOpen(false);

  return (
    <div ref={ref} className={s.wrap}>
      <Button variant="ghost" icon="download" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="dialog">{t('download')}</Button>
      {/* Panel hep yerinde; açılıp kapanma CSS geçişi (yarıda kesilebilir, ana iş parçacığını beklemez). */}
          <div className={s.panel} data-open={open || undefined} role="dialog" aria-label={tr ? 'İndirme seçenekleri' : 'Download options'}>
            <div className={s.head}>
              <span>{tr ? 'Biçim' : 'Format'}</span>
              <Segmented id="indir-bicim" size="sm" tone="dark" value={format} onChange={setFormat} options={[{ value: 'jpg', label: 'JPEG' }, { value: 'png', label: 'PNG' }]} />
            </div>
            <ul className={s.list}>
              {sizes.map((x) => (
                <li key={x.key}>
                  <a className={s.row} href={exportLink(doc.id, x.key, format)} download onClick={close}>
                    <span className={s.name}>{x.label[lang]}<small>{x.hint[lang]}</small></span>
                    <span className={s.dims}>{scaled(w, h, x.edge)}</span>
                    <Icon name="download" size={16} />
                  </a>
                </li>
              ))}
              <li>
                <a className={s.row} href={exportLink(doc.id, 'tam', format)} download onClick={close}>
                  <span className={s.name}>{tr ? 'Tam boyut' : 'Full size'}<small>{tr ? 'En yüksek çözünürlük' : 'Highest resolution'}</small></span>
                  <span className={s.dims}>{scaled(w, h, null)}</span>
                  <Icon name="download" size={16} />
                </a>
              </li>
            </ul>
            <a className={s.original} href={downloadLink(doc.id)} download onClick={close}>
              <span>{tr ? 'Orijinal dosya' : 'Original file'} · {file.ext.toUpperCase()} · {formatSize(file.size, lang)}</span>
              <Icon name="download" size={15} />
            </a>
          </div>
    </div>
  );
}
