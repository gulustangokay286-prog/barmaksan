// Kaydedilenler: kullanıcının yıldızladığı belgeler. Veri yalnızca bu tarayıcıda.
// Liste güncel bilgiyle gösterilir: her kayıt için belge yeniden çekilir (önbellekten, anında).
import { AnimatePresence, motion } from 'motion/react';
import { useQueries } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/PageHeader';
import { DocThumb, FolderTrail } from '../components/Docs';
import { DateStamp } from '../components/DateStamp';
import { Button, VersionTag } from '../components/ui';
import { Link } from '../lib/link';
import { useI18n } from '../lib/i18n';
import { useDocTypes, usePageChrome } from '../lib/ui';
import { docQuery, prefetchDoc } from '../lib/query';
import { useBookmarks, type Bookmark } from '../lib/bookmarks';
import { shortTitle } from '../lib/format';
import { spring } from '../lib/motion';
import p from './pages.module.css';
import sv from './saved.module.css';

export default function Saved() {
  const { t, lang } = useI18n();
  const { list, remove, clear } = useBookmarks();
  usePageChrome(t('saved'), { to: '/', label: t('home') });

  return (
    <div className={`${p.page} fade-in`}>
      <PageHeader
        title={t('saved')}
        lead={t('savedLead')}
        meta={list.length ? [<span key="n">{list.length} {t('documents')}</span>] : undefined}
        actions={list.length > 1 ? <Button size="sm" variant="ghost" icon="close" onClick={clear}>{t('clearAll')}</Button> : undefined}
      />

      {list.length === 0 ? (
        <motion.div className={sv.empty} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={spring.base}>
          <span className={sv.emptyIcon}><Icon name="bookmark" size={26} strokeWidth={1.3} /></span>
          <p className={sv.emptyTitle}>{t('savedEmpty')}</p>
          <p className={sv.emptyHint}>{t('savedEmptyHint')}</p>
          <Link to="/son" className={sv.emptyLink}>
            {lang === 'tr' ? 'Son güncellenenlere göz atın' : 'Browse recent updates'}
            <Icon name="arrowRight" size={14} />
          </Link>
        </motion.div>
      ) : (
        <SavedList items={list} onRemove={remove} />
      )}
    </div>
  );
}

function SavedList({ items, onRemove }: { items: Bookmark[]; onRemove: (id: string) => void }) {
  const { t, pick, lang } = useI18n();
  const types = useDocTypes();
  // Güncel sürüm ve başlık için belgeler önbellekten okunur; yoksa kayıttaki bilgi gösterilir.
  const live = useQueries({ queries: items.map((b) => ({ ...docQuery(b.id), staleTime: 0 })) });
  return (
    <motion.ul className={sv.list} initial={false}>
      <AnimatePresence initial={false}>
        {items.map((b, i) => {
          const d = live[i]?.data;
          const gone = (live[i]?.error as { status?: number } | null)?.status === 404;
          const folder = d?.folder ?? b.folder;
          const title = shortTitle(pick(d?.title ?? b.title), pick(folder.name));
          const type = types.get(d?.type ?? b.type);
          const v = d?.current;
          return (
            <motion.li
              key={b.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -24, transition: { duration: 0.18 } }}
              transition={spring.base}
              className={sv.row}
              data-gone={gone || undefined}
            >
              {d ? <DocThumb doc={d} /> : (
                <span className={sv.thumb}>{b.thumb ? <img src={b.thumb} alt="" /> : <Icon name={type?.icon ?? 'file'} size={20} />}</span>
              )}
              {gone ? <span className={sv.body}>
                <span className={sv.title}>{title}</span>
                <span className={sv.meta}>{lang === 'tr' ? 'Belge artık yok' : 'Document no longer exists'}</span>
              </span> : <Link
                to={`/dokuman/${b.id}`}
                className={sv.body}
                onPointerEnter={() => prefetchDoc(b.id, v?.file?.id, v?.file?.kind)}
              >
                <span className={sv.title}>{title}</span>
                <span className={sv.meta}>
                  <span><FolderTrail slug={folder.slug} name={folder.name} /></span>
                </span>
              </Link>}
              <span className={sv.side}>
                {!gone && v && (type?.versioned ? <VersionTag no={v.no} /> : <span>{v.file?.ext.toUpperCase()}</span>)}
                <span className={sv.date}>{lang === 'tr' ? 'Kaydedildi' : 'Saved'} · <DateStamp iso={b.savedAt} /></span>
              </span>
              <button className={sv.remove} onClick={() => onRemove(b.id)} aria-label={t('unsave')} title={t('unsave')}>
                <Icon name="close" size={15} strokeWidth={1.7} />
              </button>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </motion.ul>
  );
}
