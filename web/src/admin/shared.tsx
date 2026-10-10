// Yönetim panelinin ortak parçaları: sayfa başlığı, hareket satırı, iletişim kutusu,
// yan panel, onaylı düğme ve işlem çalıştırıcı (hata + bildirim + verinin tazelenmesi).
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useQueryClient } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { Spinner } from '../components/ui';
import { DateStamp } from '../components/DateStamp';
import { Link } from '../lib/link';
import { useI18n } from '../lib/i18n';
import { versionLabel } from '../lib/format';
import { useBootstrap, useUi } from '../lib/ui';
import type { Activity } from '../lib/api';
import a from './admin.module.css';

/** Makine başına beklenen belge türleri (Belge türleri ekranından değişir). */
export function useCoverageTypes() {
  const { data } = useBootstrap();
  return data?.coverageTypes ?? [];
}

export function PageHead({ title, lead, actions }: { title: string; lead?: ReactNode; actions?: ReactNode }) {
  return (
    <header className={a.pageHead}>
      <div>
        <h1 className={a.pageTitle}>{title}</h1>
        {lead && <p className={a.pageLead}>{lead}</p>}
      </div>
      {actions && <div className={a.pageActions}>{actions}</div>}
    </header>
  );
}

// ── İşlem çalıştırıcı ───────────────────────────────────────────────────────

/**
 * Bir yazma işlemini çalıştırır: sürerken `busy` o işlemin adıdır, bitince bütün veriler
 * tazelenir ve (verildiyse) bildirim çıkar. Hata metni `error`da.
 */
export function useRun() {
  const qc = useQueryClient();
  const { notify } = useUi();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (key: string, fn: () => Promise<unknown>, done?: string) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      await qc.invalidateQueries();
      if (done) notify(done);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setBusy(null);
    }
  }, [qc, notify]);
  return { run, busy, error, setError };
}

/** Geri alınamayan işlem: ilk basış sorar, ikinci basış yapar. Odak kaybolunca vazgeçer. */
export function ConfirmButton({ label, confirm, onConfirm, busy, className = a.danger, icon }: {
  label: string; confirm: string; onConfirm: () => void; busy?: boolean; className?: string; icon?: string;
}) {
  const [armed, setArmed] = useState(false);
  return (
    <button
      type="button"
      className={className}
      data-armed={armed || undefined}
      disabled={busy}
      onBlur={() => setArmed(false)}
      onClick={() => {
        if (!armed) { setArmed(true); return; }
        setArmed(false);
        onConfirm();
      }}
    >
      {busy ? <Spinner size={14} /> : icon ? <Icon name={icon} size={15} /> : null}
      {armed ? confirm : label}
    </button>
  );
}

// ── Hareket satırı ──────────────────────────────────────────────────────────

const VERBS: Record<string, { tr: string; en: string; icon: string }> = {
  'document.created': { tr: 'Yeni belge eklendi', en: 'Document added', icon: 'plus' },
  'machine.content.updated': { tr: 'Makine bilgileri güncellendi', en: 'Machine content updated', icon: 'pencil' },
  'language.created': { tr: 'İçerik dili eklendi', en: 'Content language added', icon: 'translate' },
  'version.published': { tr: 'Yeni sürüm yayınlandı', en: 'New version published', icon: 'upload' },
  'document.updated': { tr: 'Belge düzenlendi', en: 'Document edited', icon: 'pencil' },
  'document.archived': { tr: 'Belge arşivlendi', en: 'Document archived', icon: 'archive' },
  'document.restored': { tr: 'Belge arşivden çıkarıldı', en: 'Document restored', icon: 'history' },
  'document.deleted': { tr: 'Belge kalıcı olarak silindi', en: 'Document deleted', icon: 'trash' },
  'folder.created': { tr: 'Klasör oluşturuldu', en: 'Folder created', icon: 'folder' },
  'folder.updated': { tr: 'Klasör düzenlendi', en: 'Folder edited', icon: 'pencil' },
  'folder.deleted': { tr: 'Klasör silindi', en: 'Folder deleted', icon: 'trash' },
  'folder.archived': { tr: 'Klasör arşivlendi', en: 'Folder archived', icon: 'archive' },
  'folder.reordered': { tr: 'Sıra değiştirildi', en: 'Order changed', icon: 'grip' },
  'type.created': { tr: 'Belge türü eklendi', en: 'Document type added', icon: 'layers' },
  'type.updated': { tr: 'Belge türleri düzenlendi', en: 'Document types edited', icon: 'layers' },
  'type.deleted': { tr: 'Belge türü silindi', en: 'Document type deleted', icon: 'layers' },
  'home.updated': { tr: 'Ana sayfa düzenlendi', en: 'Home page edited', icon: 'home' },
  'library.imported': { tr: 'Kütüphane kuruldu', en: 'Library set up', icon: 'library' },
};

function detailText(item: Activity, lang: 'tr' | 'en') {
  const d = item.detail && !Array.isArray(item.detail) ? item.detail : null;
  if (!d) return null;
  if (item.action === 'library.imported') {
    return lang === 'tr' ? `${d.machines} makine, ${d.documents} belge ve görsel aktarıldı` : `${d.machines} machines, ${d.documents} documents and images imported`;
  }
  if (typeof d.title === 'string') return d.title;
  if (typeof d.name === 'string') return d.name;
  return null;
}

export function ActivityRow({ item }: { item: Activity }) {
  const { pick, lang } = useI18n();
  const verb = VERBS[item.action] ?? { tr: item.action, en: item.action, icon: 'info' };
  const verbText = lang === 'tr' ? verb.tr : verb.en;
  const folderHref = item.folder && item.action !== 'folder.archived' ? (item.folder.kind === 'machine' ? `/m/${item.folder.slug}` : `/k/${item.folder.slug}`) : null;
  const extra = detailText(item, lang);
  let title: ReactNode;
  if (item.document) {
    title = item.action === 'document.archived'
      ? <span>{pick(item.document.title)}</span>
      : <Link to={`/dokuman/${item.document.id}`}>{pick(item.document.title)}</Link>;
  } else if (item.folder && item.action.startsWith('folder.')) {
    title = folderHref ? <Link to={folderHref}>{pick(item.folder.name)}</Link> : <span>{pick(item.folder.name)}</span>;
  } else {
    title = <span>{extra ?? verbText}</span>;
  }
  const showVerbInMeta = !!item.document || (item.folder && item.action.startsWith('folder.')) || !!extra;
  return (
    <li className={a.activity}>
      <span className={a.activityIcon} data-kind={item.action.split('.')[1]}><Icon name={verb.icon} size={15} /></span>
      <span className={a.activityBody}>
        <span className={a.activityTitle}>
          {title}
          {item.versionNo && item.action === 'version.published' ? <span className={a.versionChip}>{versionLabel(item.versionNo, lang)}</span> : null}
        </span>
        <span className={a.activityMeta}>
          {[
            showVerbInMeta ? verbText : null,
            item.folder && item.document ? pick(item.folder.name) : null,
            item.actor,
          ].filter(Boolean).join(' · ')}
        </span>
      </span>
      <DateStamp iso={item.at} className={a.activityTime} />
    </li>
  );
}

// ── İletişim kutusu ─────────────────────────────────────────────────────────

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
}

export function Dialog({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEscape(open, onClose);
  return (
    <AnimatePresence>
      {open && (
        <div className={a.dialogRoot}>
          <motion.div className={a.dialogScrim} onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} />
          <motion.div
            className={a.dialog}
            data-wide={wide || undefined}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98, transition: { duration: 0.14 } }}
            transition={{ type: 'spring', bounce: 0.12, duration: 0.4 }}
          >
            <h2 className={a.dialogTitle}>{title}</h2>
            <div className={a.dialogBody}>{children}</div>
            {footer && <div className={a.dialogFoot}>{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ── Yan panel ───────────────────────────────────────────────────────────────

/** Sağdan gelen düzenleme paneli: başlık sabit, gövde kayar, alt şerit sabit. */
export function Sheet({ open, onClose, title, subtitle, children, footer, wide }: {
  open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  const { lang } = useI18n();
  useEscape(open, onClose);
  return (
    <AnimatePresence>
      {open && (
        <div className={a.sheetRoot}>
          <motion.div className={a.dialogScrim} onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
          <motion.aside
            className={a.sheet}
            data-wide={wide || undefined}
            role="dialog"
            aria-modal="true"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%', transition: { type: 'spring', bounce: 0, duration: 0.32 } }}
            transition={{ type: 'spring', bounce: 0, duration: 0.46 }}
          >
            <header className={a.sheetHead}>
              <div className={a.sheetTitles}>
                <h2 className={a.sheetTitle}>{title}</h2>
                {subtitle && <p className={a.sheetSub}>{subtitle}</p>}
              </div>
              <button className={a.iconBtn} onClick={onClose} aria-label={lang === 'tr' ? 'Kapat' : 'Close'}>
                <Icon name="close" size={18} />
              </button>
            </header>
            <div className={a.sheetBody}>{children}</div>
            {footer && <div className={a.sheetFoot}>{footer}</div>}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

/** Panel içi bölüm: başlık + içerik, ince çizgiyle ayrılır. */
export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className={a.section}>
      <div className={a.sectionHead}>
        <h3>{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className={a.emptyNote}>{children}</p>;
}
