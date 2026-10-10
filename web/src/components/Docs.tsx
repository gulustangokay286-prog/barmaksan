import { Fragment, useState } from 'react';
import { motion } from 'motion/react';
import { Icon } from './Icon';
import { Button, FadeImage, LinkButton, VersionTag, useTilt } from './ui';
import { Link, useGo } from '../lib/link';
import { useI18n } from '../lib/i18n';
import { copyText, useDocTypes, useFolderTrail, useUi } from '../lib/ui';
import { formatDuration, languageLabel, shortTitle } from '../lib/format';
import { DateStamp } from './DateStamp';
import { prefetchDoc, prefetchFolder } from '../lib/query';
import { markMorph } from '../lib/morph';
import type { Doc, DocType, FolderChild, Name } from '../lib/api';
import s from './Docs.module.css';

export const docHref = (d: Doc) => `/dokuman/${d.id}`;

/**
 * Belge eylemleri: Aç (birincil), İndir, Bağlantıyı kopyala. Hepsi aynı boyda düğme.
 * Kopyalayınca geri bildirim düğmenin kendisinde ("Kopyalandı"), genişlik oynamaz.
 */
export function DocActions({ openHref, downloadHref, copyHref, extra }: { openHref: string; downloadHref: string; copyHref: string; extra?: React.ReactNode }) {
  const { t, lang } = useI18n();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (await copyText(copyHref)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };
  return (
    <div className={s.actions}>
      <LinkButton href={openHref} variant="primary" newTab>{t('open')}</LinkButton>
      <LinkButton href={downloadHref}>{t('download')}</LinkButton>
      <Button onClick={copy} aria-live="polite">
        <span className={s.swap} data-on={copied || undefined}>
          <span>{t('copyLink')}</span>
          <span><Icon name="check" size={15} strokeWidth={1.9} />{lang === 'tr' ? 'Kopyalandı' : 'Copied'}</span>
        </span>
      </Button>
      {extra}
    </div>
  );
}

/** Küçük resim. Satıra tıklanınca (PDF ise) doküman sayfasının ilk sayfasına morph olur. */
export function DocThumb({ doc, size = 'md' }: { doc: Doc; size?: 'sm' | 'md' | 'lg' }) {
  const types = useDocTypes();
  const file = doc.current?.file;
  const type = types.get(doc.type);
  if (file?.thumb) {
    return (
      <span className={s.thumb} data-size={size} data-kind={file.kind} data-morph={file.kind === 'pdf' || undefined}>
        <FadeImage src={file.thumb} fit="cover" />
        {file.kind === 'video' && <span className={s.thumbPlay}><Icon name="play" size={12} strokeWidth={1.6} /></span>}
      </span>
    );
  }
  return (
    <span className={s.thumb} data-size={size} data-kind="icon">
      <Icon name={type?.icon ?? 'file'} size={size === 'sm' ? 16 : 20} />
    </span>
  );
}

/** Tek satırlık bağlam: klasör ya da biçim + dil. */
/** Belgenin yeri, ekmek kırıntısı gibi: "Temizleme ve Tavlama › Çöp Sasörü Cleanmax 4". */
export function FolderTrail({ slug, name }: { slug: string; name: Name }) {
  const { pick } = useI18n();
  const trail = useFolderTrail()(slug);
  const names = trail.length ? trail.map((n) => pick(n.name)) : [pick(name)];
  return (
    <>
      {names.map((n, i) => (
        <Fragment key={i}>
          {i > 0 && <span className={s.trailSep} aria-hidden="true">›</span>}
          {n}
        </Fragment>
      ))}
    </>
  );
}

export function DocContext({ doc, showFolder }: { doc: Doc; showFolder?: boolean }) {
  const file = doc.current?.file;
  const lang = languageLabel(doc.language);
  if (showFolder) return <span className={s.context}><FolderTrail slug={doc.folder.slug} name={doc.folder.name} /></span>;
  return (
    <span className={s.context}>
      {file?.ext.toUpperCase()}
      {file?.durationMs ? ` · ${formatDuration(file.durationMs)}` : ''}
      {lang ? ` · ${lang}` : ''}
    </span>
  );
}

export function DocRow({ doc, showFolder = false, compact = false }: { doc: Doc; index?: number; showFolder?: boolean; compact?: boolean }) {
  const { pick } = useI18n();
  const types = useDocTypes();
  const v = doc.current;
  const versioned = types.get(doc.type)?.versioned;
  return (
    <li className={`${s.row} reveal`} data-compact={compact || undefined}>
      <Link to={docHref(doc)} aria-label={pick(doc.title)} onPointerEnter={() => prefetchDoc(doc.id)} onClick={(e) => markMorph(e.currentTarget.querySelector('[data-morph]'), 'doc-page')}><DocThumb doc={doc} size={compact ? 'sm' : 'md'} /></Link>
      <span className={s.body}>
        <Link
          to={docHref(doc)}
          viewTransition
          className={s.title}
          onPointerEnter={() => prefetchDoc(doc.id, v?.file?.id, v?.file?.kind)}
          onFocus={() => prefetchDoc(doc.id, v?.file?.id, v?.file?.kind)}
          onClick={(e) => markMorph(e.currentTarget.closest('li')?.querySelector('[data-morph]'), 'doc-page')}
        >
          {showFolder ? shortTitle(pick(doc.title), pick(doc.folder.name)) : pick(doc.title)}
        </Link>
        <DocContext doc={doc} showFolder={showFolder} />
      </span>
      {v && (
        <span className={s.side}>
          {versioned ? <VersionTag no={v.no} /> : <span className={s.sideSize}>{v.file?.ext.toUpperCase() ?? ''}</span>}
          <DateStamp iso={v.createdAt} author={v.author} className={s.sideDate} />
        </span>
      )}
    </li>
  );
}

export function EmptyRow({ type, onUpload }: { type: DocType; onUpload?: () => void }) {
  const { pick, t } = useI18n();
  return (
    <li className={s.row} data-empty>
      <span className={s.thumb} data-size="md" data-kind="empty"><Icon name={type.icon} size={20} /></span>
      <span className={s.body}>
        <span className={s.titleEmpty}>{pick(type.name)}</span>
        <span className={s.context}>{t('notUploaded')}</span>
      </span>
      {onUpload && (
        <button className={s.emptyAction} onClick={onUpload}>
          <Icon name="plus" size={16} />
          <span>{t('upload')}</span>
        </button>
      )}
    </li>
  );
}

/** Türe göre gruplanmış doküman listesi; grup başlıkları kaydırırken üstte tutunur. */
export function GroupedDocs({ docs, ensureTypes = [], onUpload }: { docs: Doc[]; ensureTypes?: string[]; onUpload?: (type: string) => void }) {
  const types = useDocTypes();
  const { pick } = useI18n();
  const groups = new Map<string, Doc[]>();
  for (const slug of ensureTypes) groups.set(slug, []);
  for (const d of docs) {
    const t = types.get(d.type);
    if (t && t.media !== 'document') continue;
    groups.set(d.type, [...(groups.get(d.type) ?? []), d]);
  }
  const order = [...types.keys()];
  const ordered = [...groups.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
  return (
    <div className={s.groups}>
      {ordered.map(([slug, list]) => {
        const type = types.get(slug);
        if (!type) return null;
        return (
          <section key={slug} className={s.group} aria-label={pick(type.name)}>
            <h3 className={s.groupHead}>
              <Icon name={type.icon} size={17} />
              <span>{pick(type.name)}</span>
              {type.short && <span className={s.groupShort}>{type.short}</span>}
              <span className={s.groupCount}>{list.length || ''}</span>
            </h3>
            <ul className={s.list}>
              {list.length === 0 ? <EmptyRow type={type} onUpload={onUpload ? () => onUpload(slug) : undefined} /> : list.map((d) => <DocRow key={d.id} doc={d} />)}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

// ── Makine kartı: 3D eğim + makine sayfasına morph ──────────────────────────

export function MachineTile({ m }: { m: Pick<FolderChild, 'slug' | 'name' | 'modelCode' | 'cover'>; index?: number }) {
  const { pick } = useI18n();
  const href = `/m/${m.slug}`;
  const tilt = useTilt(9);
  return (
    <li className="reveal-3d">
      <Link
        to={href}
        className={s.tile}
        onPointerEnter={(e) => { prefetchFolder(m.slug); tilt.handlers.onPointerEnter(e); }}
        onPointerMove={tilt.handlers.onPointerMove}
        onPointerLeave={tilt.handlers.onPointerLeave}
      >
        <motion.span className={s.tileImage} style={tilt.style}>
          <span className={s.tileFloat} data-morph>
            {m.cover ? <FadeImage src={m.cover} alt="" /> : <Icon name="parts" size={28} />}
          </span>
        </motion.span>
        <span className={s.tileName}>{pick(m.name)}</span>
        {m.modelCode && <span className={s.tileCode}>{m.modelCode}</span>}
      </Link>
    </li>
  );
}

// ── Kişiler (Yönetim) ───────────────────────────────────────────────────────

/** Unvandan katman: 0 yönetim kurulu, 1 genel müdür, 2 diğer yöneticiler (yardımcılar, direktörler). */
function tierOf(role = '') {
  const r = role.toLocaleLowerCase('tr');
  if (/yönetim kurulu|chairman|board/.test(r)) return 0;
  if (!/yardımcı|deputy|assistant/.test(r) && /genel müdür|general manager|\bceo\b/.test(r)) return 1;
  return 2;
}

/**
 * Kişi kartları, piramit düzeninde: tepede yönetim kurulu, altında katman katman yönetim; her
 * katman ortalı bir satır. Kart: portre, ad ve unvan (başlık "Ad — Unvan"). Katman içi sıra yükleme
 * sırası. Dokununca görüntüleyici açılır; oradan boyut/biçim seçilerek indirilir.
 */
export function PeopleGrid({ items }: { items: Doc[] }) {
  const { setLightbox } = useUi();
  const { pick } = useI18n();
  const people = items
    .map((d) => { const [name, role] = pick(d.title).split(/\s+—\s+/); return { d, name, role, tier: tierOf(role) }; })
    .sort((a, b) => a.tier - b.tier || a.d.createdAt.localeCompare(b.d.createdAt));
  const ordered = people.map((p) => p.d);
  const tiers = [...new Set(people.map((p) => p.tier))].map((tier) => people.filter((p) => p.tier === tier));
  return (
    <div className={s.pyramid}>
      {tiers.map((row, ti) => (
        <ul key={ti} className={s.tier} data-top={ti === 0 && tiers.length > 1 ? '' : undefined}>
          {row.map(({ d, name, role }) => {
            const f = d.current?.file;
            return (
              <li key={d.id} className={`${s.personItem} reveal-3d`}>
                <button className={s.person} onClick={() => setLightbox({ items: ordered, index: ordered.indexOf(d) })} aria-label={pick(d.title)}>
                  <span data-media-id={d.id} className={s.portrait}>
                    {f?.thumb ? <FadeImage src={f.thumb} fit="cover" /> : <Icon name="user" size={28} />}
                  </span>
                  <span className={s.personName}>{name}</span>
                  {role && <span className={s.personRole}>{role}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      ))}
    </div>
  );
}

// ── Medya ızgarası ──────────────────────────────────────────────────────────

export function MediaGrid({ items, columns = 'auto' }: { items: Doc[]; columns?: 'auto' | 'dense' }) {
  const { setLightbox } = useUi();
  const go = useGo();
  const { pick, lang } = useI18n();
  // Yalnız videolar: eşit 16:9 ızgara (sütun düzeni iki videoyu birbirinden uzaklaştırıyordu).
  const videosOnly = items.length > 0 && items.every((d) => d.current?.file?.kind === 'video');
  return (
    <ul className={s.media} data-columns={columns} data-layout={videosOnly ? 'grid' : undefined}>
      {items.map((d, i) => {
        const f = d.current?.file;
        const ratio = videosOnly ? '16 / 9' : f?.width && f?.height ? `${f.width} / ${f.height}` : '4 / 3';
        return (
          <li key={d.id} className={`${s.mediaItem} reveal-3d`}>
            <button className={s.mediaButton} onClick={() => f?.kind === 'pdf' || f?.kind === 'other' ? go(docHref(d)) : setLightbox({ items, index: i })} aria-label={pick(d.title)}>
              <span data-media-id={d.id} className={s.mediaFrame} style={{ aspectRatio: ratio }}>
                {f?.thumb ? <FadeImage src={f.thumb} fit="cover" /> : <Icon name={f?.kind === 'video' ? 'video' : 'photo'} size={24} />}
                {f?.kind === 'video' && (
                  <span className={s.mediaBadge}>
                    <Icon name="play" size={11} strokeWidth={1.6} />
                    {f.durationMs ? formatDuration(f.durationMs) : ''}
                  </span>
                )}
              </span>
              <span className={s.mediaCaption}>
                <span className={s.mediaTitle}>{pick(d.title)}</span>
                <span className={s.mediaMeta}>
                  {f?.kind === 'video' ? (lang === 'tr' ? 'Video' : 'Film') : (lang === 'tr' ? 'Fotoğraf' : 'Photo')}
                  {f?.durationMs ? ` · ${formatDuration(f.durationMs)}` : ''}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
