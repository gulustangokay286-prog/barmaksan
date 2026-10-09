// Kurumsal Kimlik klasörünün üst kısmı: logolar, renkler, yazı karakteri. Logolar yönetimden
// yüklenir; henüz yüklenmemişse sitenin kendi logoları gösterilir. Antetli kâğıt ve kimlik
// kılavuzu gibi diğer dosyalar sayfanın altında, her klasördeki gibi listelenir.
import { useState } from 'react';
import { Icon } from './Icon';
import { SectionTitle } from './PageHeader';
import { DateStamp } from './DateStamp';
import { Button } from './ui';
import { downloadLink, type Doc } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { copyText, useUi } from '../lib/ui';
import { LOGOS, SITE_PALETTE, isLight } from '../lib/brand';
import s from './BrandKit.module.css';

// Web sitesinin renkleri: vurgu, metin ve zeminler. Uyarı kırmızısı ve kenarlık grisi kimlik değil.
const COLOURS = ['#D9B625', '#222222', '#000000', '#FFFFFF', '#F9F9F9', '#798196', '#002456'];

export function BrandKit({ logos, folder }: { logos: Doc[]; folder: string }) {
  const { lang } = useI18n();
  const { editor, setUpload } = useUi();
  const tr = lang === 'tr';
  return (
    <>
      <section className={s.section}>
        <SectionTitle
          title={tr ? 'Logolar' : 'Logos'}
          action={editor ? (
            <Button size="sm" icon="upload" onClick={() => setUpload({ mode: 'new', folder, type: 'logo' })}>
              {tr ? 'Logo yükle' : 'Upload logo'}
            </Button>
          ) : undefined}
        />
        <ul className={s.logos}>
          {logos.length > 0
            ? logos.map((d) => <UploadedLogo key={d.id} doc={d} />)
            : LOGOS.map((l) => <SiteLogo key={l.key} logo={l} />)}
        </ul>
      </section>

      <section className={s.section}>
        <SectionTitle title={tr ? 'Renkler' : 'Colours'} />
        <ul className={s.colours}>
          {COLOURS.map((hex) => <Colour key={hex} hex={hex} />)}
        </ul>
      </section>

      <section className={s.section}>
        <SectionTitle title={tr ? 'Yazı karakteri' : 'Typeface'} />
        <p className={s.type}>
          {tr
            ? 'Web sitesinde Montserrat kullanılır. Bu kütüphanede ve ekranda okunan belgelerde sistem yazı tipi (SF Pro, Segoe UI).'
            : 'The website uses Montserrat. This library and on-screen documents use the system typeface (SF Pro, Segoe UI).'}
        </p>
      </section>
    </>
  );
}

function UploadedLogo({ doc }: { doc: Doc }) {
  const { t, pick } = useI18n();
  const v = doc.current;
  const src = v?.file?.preview ?? v?.file?.thumb ?? (v?.file?.kind === 'image' ? v.file.raw : null);
  return (
    <li className={s.logo}>
      <span className={s.stage}>
        {src ? <img src={src} alt={pick(doc.title)} draggable={false} decoding="async" /> : <Icon name="file" size={28} />}
      </span>
      <span className={s.foot}>
        <span className={s.name}>
          {pick(doc.title)}
          {v && (
            <span className={s.meta}>
              {v.file?.ext.toUpperCase()}
              {' · '}
              <DateStamp iso={v.createdAt} author={v.author} format="short" />
            </span>
          )}
        </span>
        <a className={s.download} href={downloadLink(doc.id)} aria-label={`${t('download')}: ${pick(doc.title)}`}>
          <Icon name="download" size={16} />
        </a>
      </span>
    </li>
  );
}

function SiteLogo({ logo }: { logo: (typeof LOGOS)[number] }) {
  const { t, lang } = useI18n();
  const ground = logo.ground === 'light' ? (lang === 'tr' ? 'Açık zemin' : 'Light ground') : (lang === 'tr' ? 'Koyu zemin' : 'Dark ground');
  return (
    <li className={s.logo}>
      <span className={s.stage} data-ground={logo.ground}>
        <img src={logo.src} alt={logo.brand} draggable={false} decoding="async" />
      </span>
      <span className={s.foot}>
        <span className={s.name}>
          {logo.brand}
          <span className={s.meta}>{logo.ext} · {ground}</span>
        </span>
        <a className={s.download} href={logo.src} download aria-label={`${t('download')}: ${logo.brand}, ${ground}`}>
          <Icon name="download" size={16} />
        </a>
      </span>
    </li>
  );
}

function Colour({ hex }: { hex: string }) {
  const { lang } = useI18n();
  const { notify } = useUi();
  const [copied, setCopied] = useState(false);
  const swatch = SITE_PALETTE.find((c) => c.hex === hex);
  const name = swatch ? (lang === 'tr' ? swatch.name.tr : swatch.name.en) : hex;
  const copy = async () => {
    if (!(await copyText(hex))) return;
    setCopied(true);
    notify(lang === 'tr' ? `${hex} kopyalandı` : `${hex} copied`);
    window.setTimeout(() => setCopied(false), 1400);
  };
  return (
    <li>
      <button className={s.colour} onClick={copy} aria-label={lang === 'tr' ? `${name}, ${hex}. Kopyala` : `${name}, ${hex}. Copy`}>
        <span className={s.chip} style={{ background: hex }} data-light={isLight(hex) || undefined}>
          {copied && <Icon name="check" size={16} strokeWidth={2} />}
        </span>
        <span className={s.colourName}>{name}</span>
        <span className={s.hex}>{hex}</span>
      </button>
    </li>
  );
}
