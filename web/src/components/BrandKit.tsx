// Kurumsal Kimlik: Uğur Promilling görsel kılavuzunun (s.1–10) siteye uyarlanmış hâli. Sıra
// kılavuzdaki gibi: kapak, 01 logo, 02 renk paleti, 03 tipografi, 04 desen; sonra 05 kurumsal
// dosyalar (görsel kılavuz, antetli kâğıt). Yüklenmemiş dosyanın yeri boş kalmaz, yer tutucuyla
// görünür; yönetici oradan yükler. Logolar yönetimden yüklenir, yoksa sitenin kendi logoları.
import { useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import { DateStamp } from './DateStamp';
import { Button } from './ui';
import { DocRow, DocThumb, docHref } from './Docs';
import { Pervane, PervanePattern } from './Pervane';
import { Link } from '../lib/link';
import { downloadLink, type Doc } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { copyText, useDocTypes, useUi } from '../lib/ui';
import { LOGOS } from '../lib/brand';
import { languageLabel } from '../lib/format';
import s from './BrandKit.module.css';

/** Kılavuz s.5: yalnızca üç renk. */
const PALETTE = [
  { key: 'gold', name: { tr: 'Uğur altını', en: 'Uğur gold' }, hex: '#D9B625', rgb: '217 · 182 · 37', cmyk: '16 · 24 · 91 · 4', pantone: '7752 C' },
  { key: 'black', name: { tr: 'Siyah', en: 'Black' }, hex: '#000000', rgb: '0 · 0 · 0', cmyk: '75 · 68 · 67 · 90', pantone: 'Black 6C' },
  { key: 'white', name: { tr: 'Beyaz', en: 'White' }, hex: '#FFFFFF', rgb: '255 · 255 · 255', cmyk: '0 · 0 · 0 · 0', pantone: '11-0601 TPG' },
] as const;

/** Kılavuz s.7: Helvetica Now Display ailesi. */
const WEIGHTS = [
  { name: 'Thin', w: 100 }, { name: 'Light', w: 300 }, { name: 'Regular', w: 400 }, { name: 'Medium', w: 500 },
  { name: 'Bold', w: 700 }, { name: 'Extra Bold', w: 800 }, { name: 'Black', w: 900 },
];

/** Her zaman yeri görünen kurumsal dosyalar: görsel kılavuz, antetli kâğıt. */
const REQUIRED = ['kimlik-kilavuzu', 'antetli-kagit'];

export function BrandKit({ logos, docs, folder }: { logos: Doc[]; docs: Doc[]; folder: string }) {
  const { lang } = useI18n();
  const { editor, setUpload } = useUi();
  const tr = lang === 'tr';
  return (
    <>
      <Cover />

      <Section n="01" title={tr ? 'Logo' : 'Logo'}
        action={editor ? <Button size="sm" icon="upload" onClick={() => setUpload({ mode: 'new', folder, type: 'logo' })}>{tr ? 'Logo yükle' : 'Upload logo'}</Button> : undefined}>
        <ul className={s.logos}>
          {logos.length > 0 ? logos.map((d) => <UploadedLogo key={d.id} doc={d} />) : LOGOS.map((l) => <SiteLogo key={l.key} logo={l} />)}
        </ul>
      </Section>

      <Section n="02" title={tr ? 'Renk paleti' : 'Colour palette'} lead={tr ? 'Bir değere dokunun, kopyalansın.' : 'Tap a value to copy it.'}>
        <ul className={s.palette}>{PALETTE.map((c) => <Swatch key={c.key} c={c} />)}</ul>
      </Section>

      <Section n="03" title={tr ? 'Tipografi' : 'Typography'} lead={tr ? 'Tüm kurumsal materyallerde tek yazı ailesi.' : 'One typeface family across all corporate material.'}>
        <div className={s.type}>
          <div className={s.typeHead}>
            <span className={s.typeName}>Helvetica Now Display</span>
            <span className={s.typeAa} aria-hidden="true">Aa</span>
          </div>
          <ul className={s.weights}>
            {WEIGHTS.map((x) => (
              <li key={x.w} style={{ fontWeight: x.w }}>
                <span className={s.weightName}>{x.name}</span>
                <span className={s.weightSample}>ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section n="04" title={tr ? 'Desen' : 'Pattern'} lead={tr ? 'Logodaki değirmen kanadı, "pervane", tek başına desen olur.' : 'The mill sail from the logo, the "pervane", becomes the pattern.'}>
        <div className={s.patterns}>
          <figure className={s.patternTile} data-tone="gold">
            <PervanePattern className={s.patternArt} />
            <figcaption>{tr ? 'Pervane deseni' : 'Sail pattern'}</figcaption>
          </figure>
          <figure className={s.patternTile} data-tone="dark">
            <Pervane className={s.patternSail} />
            <figcaption>{tr ? 'Tek kanat · boş alanlarda' : 'Single sail · for empty space'}</figcaption>
          </figure>
        </div>
      </Section>

      <Section n="05" title={tr ? 'Kurumsal dosyalar' : 'Corporate files'}>
        <BrandFiles docs={docs} folder={folder} />
      </Section>
    </>
  );
}

/** Kapak (kılavuz s.1 gibi): koyu zemin, altın logo, soluk pervane; kılavuzun sözü. */
function Cover() {
  const { lang } = useI18n();
  return (
    <div className={s.cover}>
      <Pervane className={s.coverSail} />
      <Pervane className={s.coverSail2} />
      <img className={s.coverLogo} src="/brand/ugur-dark.svg" alt="Uğur Promilling" draggable={false} />
      <p className={s.coverLine}>
        <span>Everything in Milling</span>
        <span className={s.coverSince}>{lang === 'tr' ? "1955'den beri" : 'Since 1955'}</span>
      </p>
    </div>
  );
}

function Section({ n, title, lead, action, children }: { n: string; title: string; lead?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className={s.section}>
      <header className={s.head}>
        <span className={s.num}>{n}</span>
        <div className={s.headText}>
          <h2>{title}</h2>
          {lead && <p>{lead}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function Swatch({ c }: { c: (typeof PALETTE)[number] }) {
  const { lang } = useI18n();
  const { notify } = useUi();
  const [copied, setCopied] = useState<string | null>(null);
  const rows: [string, string][] = [['HEX', c.hex], ['RGB', c.rgb], ['CMYK', c.cmyk], ['Pantone', c.pantone]];
  const copy = async (label: string, value: string) => {
    if (!(await copyText(value.replace(/ · /g, ', ')))) return;
    setCopied(label);
    notify(lang === 'tr' ? `${label} kopyalandı` : `${label} copied`);
    window.setTimeout(() => setCopied(null), 1400);
  };
  return (
    <li className={s.swatch}>
      <span className={s.chip} data-key={c.key}><span>{c.name[lang]}</span></span>
      <dl className={s.values}>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd><button type="button" onClick={() => void copy(label, value)} aria-label={`${label} ${value}`}>{copied === label ? (lang === 'tr' ? 'Kopyalandı' : 'Copied') : value}</button></dd>
          </div>
        ))}
      </dl>
    </li>
  );
}

function BrandFiles({ docs, folder }: { docs: Doc[]; folder: string }) {
  const types = useDocTypes();
  const { pick, lang } = useI18n();
  const { editor, setUpload } = useUi();
  const tr = lang === 'tr';
  const others = docs.filter((d) => !REQUIRED.includes(d.type));
  return (
    <>
      <ul className={s.files}>
        {REQUIRED.flatMap((type) => {
          const list = docs.filter((d) => d.type === type);
          const info = types.get(type);
          if (list.length) return list.map((d) => <FileCard key={d.id} doc={d} />);
          return [(
            <li key={type} className={s.slot}>
              <Icon name={info?.icon ?? 'file'} size={22} strokeWidth={1.4} />
              <span className={s.slotName}>{pick(info?.name) || type}</span>
              <span className={s.slotNote}>{tr ? 'Henüz eklenmedi' : 'Not added yet'}</span>
              {editor && <Button size="sm" icon="upload" onClick={() => setUpload({ mode: 'new', folder, type })}>{tr ? 'Yükle' : 'Upload'}</Button>}
            </li>
          )];
        })}
      </ul>
      {others.length > 0 && <ul className={s.otherFiles}>{others.map((d) => <DocRow key={d.id} doc={d} />)}</ul>}
    </>
  );
}

function FileCard({ doc }: { doc: Doc }) {
  const types = useDocTypes();
  const { pick, lang, t } = useI18n();
  const v = doc.current;
  const f = v?.file;
  const meta = [pick(types.get(doc.type)?.name), f?.ext.toUpperCase(), f?.pages ? `${f.pages} ${lang === 'tr' ? 'sayfa' : 'pages'}` : null, languageLabel(doc.language)].filter(Boolean).join(' · ');
  return (
    <li className={s.file}>
      <Link to={docHref(doc)} className={s.fileMain}>
        <DocThumb doc={doc} size="lg" />
        <span className={s.fileText}>
          <span className={s.fileTitle}>{pick(doc.title)}</span>
          <span className={s.fileMeta}>{meta}</span>
          {v && <span className={s.fileMeta}><DateStamp iso={v.createdAt} author={v.author} format="short" /></span>}
        </span>
      </Link>
      <a className={s.download} href={downloadLink(doc.id)} aria-label={`${t('download')}: ${pick(doc.title)}`}><Icon name="download" size={17} /></a>
    </li>
  );
}

function UploadedLogo({ doc }: { doc: Doc }) {
  const { t, pick } = useI18n();
  const v = doc.current;
  const src = v?.file?.preview ?? v?.file?.thumb ?? (v?.file?.kind === 'image' ? v.file.raw : null);
  return (
    <li className={s.logo}>
      <span className={s.stage}>{src ? <img src={src} alt={pick(doc.title)} draggable={false} decoding="async" /> : <Icon name="file" size={28} />}</span>
      <span className={s.foot}>
        <span className={s.name}>{pick(doc.title)}{v && <span className={s.meta}>{v.file?.ext.toUpperCase()}</span>}</span>
        <a className={s.download} href={downloadLink(doc.id)} aria-label={`${t('download')}: ${pick(doc.title)}`}><Icon name="download" size={16} /></a>
      </span>
    </li>
  );
}

function SiteLogo({ logo }: { logo: (typeof LOGOS)[number] }) {
  const { t, lang } = useI18n();
  const ground = logo.ground === 'light' ? (lang === 'tr' ? 'Açık zemin' : 'Light ground') : (lang === 'tr' ? 'Koyu zemin' : 'Dark ground');
  return (
    <li className={s.logo}>
      <span className={s.stage} data-ground={logo.ground}><img src={logo.src} alt={logo.brand} draggable={false} decoding="async" /></span>
      <span className={s.foot}>
        <span className={s.name}>{logo.brand}<span className={s.meta}>{logo.ext} · {ground}</span></span>
        <a className={s.download} href={logo.src} download aria-label={`${t('download')}: ${logo.brand}, ${ground}`}><Icon name="download" size={16} /></a>
      </span>
    </li>
  );
}
