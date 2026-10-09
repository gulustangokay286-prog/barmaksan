// Belgeler: bütün belgeler tek tabloda (etkin / arşiv). Ara, türe ve klasöre göre süz.
// Bir belgeye basınca sağda panel açılır: bilgiler, sürümler, dosya, arşiv ve silme.
// Panel adreste tutulur (?belge=<id>): diğer ekranlardan doğrudan açılabilir.
// Çoklu seçim: satırları işaretle, alttaki çubuktan topluca arşivle / arşivden çıkar / kalıcı sil.
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { DocThumb } from '../components/Docs';
import { Spinner } from '../components/ui';
import { DateStamp } from '../components/DateStamp';
import { Link } from '../lib/link';
import { api, downloadLink, type DocDetail, type DocLanguage, type TreeNode } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useBootstrap, useDocTypes, useUi } from '../lib/ui';
import { formatDate, formatSize, languageLabel } from '../lib/format';
import { ConfirmButton, PageHead, Section, Sheet, useRun } from './shared';
import { LanguageOptions } from '../components/LanguageOptions';
import a from './admin.module.css';

const fold = (s: string) => s.toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i');

export default function AdminDocuments() {
  const { pick, lang } = useI18n();
  const types = useDocTypes();
  const { data: boot } = useBootstrap();
  const { setUpload } = useUi();
  const docs = useQuery({ queryKey: ['admin', 'documents'], queryFn: api.adminDocuments });
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [folder, setFolder] = useState('');
  const status = params.get('durum') === 'arsiv' ? 'archived' : 'active';
  const openId = params.get('belge');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const { run, busy, error, setError } = useRun();
  // Sekme değişince seçim sıfırlanır (arşiv ve kütüphane ayrı işlemler).
  useEffect(() => { setSelected(new Set()); setError(null); }, [status, setError]);

  const setParam = (key: string, value: string | null) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    if (value) next.set(key, value);
    else next.delete(key);
    return next;
  }, { replace: true, preventScrollReset: true });

  const folders = useMemo(() => (boot?.tree ?? []).filter((n) => n.kind === 'machine' || n.kind === 'collection'), [boot]);
  const counts = useMemo(() => {
    const list = docs.data ?? [];
    const archived = list.filter((d) => d.archivedAt).length;
    return { active: list.length - archived, archived };
  }, [docs.data]);
  const rows = useMemo(() => {
    const needle = fold(q.trim());
    return (docs.data ?? []).filter((d) => {
      if ((status === 'archived') !== !!d.archivedAt) return false;
      if (type && d.type !== type) return false;
      if (folder && d.folder.slug !== folder) return false;
      if (!needle) return true;
      return fold(`${d.title.tr} ${d.title.en ?? ''} ${d.folder.name.tr} ${d.id} ${d.current?.file?.name ?? ''}`).includes(needle);
    });
  }, [docs.data, q, type, folder, status]);

  // Yalnızca şu an listede görünenler seçilebilir/işlenir.
  const shown = rows.slice(0, 500);
  const chosen = shown.filter((d) => selected.has(d.id)).map((d) => d.id);
  const allChosen = shown.length > 0 && chosen.length === shown.length;
  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const toggleAll = () => setSelected(allChosen ? new Set() : new Set(shown.map((d) => d.id)));
  const bulk = (action: 'archive' | 'unarchive' | 'delete') => {
    const ids = chosen;
    const n = ids.length;
    const tr = lang === 'tr';
    const done = action === 'archive' ? (tr ? `${n} belge arşivlendi` : `${n} documents archived`)
      : action === 'unarchive' ? (tr ? `${n} belge kütüphaneye döndü` : `${n} documents restored`)
      : (tr ? `${n} belge kalıcı olarak silindi` : `${n} documents deleted`);
    void run('bulk', async () => {
      const res = await api.bulkDocuments(action, ids);
      if (res.failed.length) throw new Error(tr ? `${res.done} belge işlendi, ${res.failed.length} belge atlandı: ${res.failed[0].error}` : `${res.done} done, ${res.failed.length} skipped: ${res.failed[0].error}`);
    }, done).then(() => {
      setSelected(new Set());
      if (openId && ids.includes(openId)) setParam('belge', null);
    });
  };

  return (
    <div className={a.page}>
      <PageHead
        title={lang === 'tr' ? 'Belgeler' : 'Documents'}
        lead={lang === 'tr' ? 'Bütün belge, fotoğraf ve videolar. Bir satıra basınca bilgileri, sürümleri ve dosyası açılır.' : 'Every document, photo and film. Click a row to edit its details, versions and file.'}
        actions={<button className={a.primary} onClick={() => setUpload({ mode: 'new', folder: folder || '', type: type || undefined })}><Icon name="upload" size={16} />{lang === 'tr' ? 'Belge yükle' : 'Upload document'}</button>}
      />

      <div className={a.tabs} role="tablist">
        {(['active', 'archived'] as const).map((st) => (
          <button key={st} role="tab" aria-selected={status === st} className={a.tab} onClick={() => setParam('durum', st === 'archived' ? 'arsiv' : null)}>
            {st === 'active' ? (lang === 'tr' ? 'Kütüphanede' : 'In library') : (lang === 'tr' ? 'Arşiv' : 'Archive')}
            <span className={a.tabCount}>{docs.data ? counts[st] : ''}</span>
          </button>
        ))}
      </div>

      <div className={a.toolbar}>
        <label className={a.searchField}>
          <Icon name="search" size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={lang === 'tr' ? 'Başlık, klasör, dosya adı ya da kod ara' : 'Search title, folder, file name or code'} />
        </label>
        <select className={a.select} value={type} onChange={(e) => setType(e.target.value)} aria-label={lang === 'tr' ? 'Tür' : 'Type'}>
          <option value="">{lang === 'tr' ? 'Bütün türler' : 'All types'}</option>
          {[...types.values()].map((tp) => <option key={tp.slug} value={tp.slug}>{pick(tp.name)}</option>)}
        </select>
        <select className={a.select} value={folder} onChange={(e) => setFolder(e.target.value)} aria-label={lang === 'tr' ? 'Klasör' : 'Folder'}>
          <option value="">{lang === 'tr' ? 'Bütün klasörler' : 'All folders'}</option>
          {folders.map((f) => <option key={f.slug} value={f.slug}>{pick(f.name)}</option>)}
        </select>
        <span className={a.toolbarCount}>{rows.length}</span>
      </div>

      <div className={a.table} role="table">
        <div className={a.thead} role="row">
          <span role="columnheader" className={a.headCheck}>
            <label className={a.check} title={lang === 'tr' ? 'Görünenlerin hepsini seç' : 'Select all shown'}>
              <input
                type="checkbox"
                checked={allChosen}
                ref={(el) => { if (el) el.indeterminate = chosen.length > 0 && !allChosen; }}
                onChange={toggleAll}
                disabled={!shown.length}
                aria-label={lang === 'tr' ? 'Görünenlerin hepsini seç' : 'Select all shown'}
              />
            </label>
            {lang === 'tr' ? 'Belge' : 'Document'}
          </span>
          <span role="columnheader">{lang === 'tr' ? 'Tür' : 'Type'}</span>
          <span role="columnheader">{lang === 'tr' ? 'Dil' : 'Language'}</span>
          <span role="columnheader">{lang === 'tr' ? 'Sürüm' : 'Version'}</span>
          <span role="columnheader">{status === 'archived' ? (lang === 'tr' ? 'Arşivlendi' : 'Archived') : (lang === 'tr' ? 'Güncellendi' : 'Updated')}</span>
          <span role="columnheader" className="sr-only">{lang === 'tr' ? 'İşlemler' : 'Actions'}</span>
        </div>
        {!docs.data && Array.from({ length: 10 }, (_, i) => <div key={i} className={a.rowSkel}><span className="skeleton" style={{ ['--i' as string]: i }} /></div>)}
        {shown.map((d) => {
          const tp = types.get(d.type);
          const v = d.current;
          const isSel = selected.has(d.id);
          return (
            <div key={d.id} className={a.row} role="row" data-open={openId === d.id || undefined} data-selected={isSel || undefined}>
              <span className={a.docCell} role="cell">
                <label className={a.check}>
                  <input type="checkbox" checked={isSel} onChange={() => toggle(d.id)} aria-label={pick(d.title)} />
                </label>
                <DocThumb doc={d} size="sm" />
                <span className={a.docText}>
                  <button className={a.docTitle} onClick={() => setParam('belge', d.id)}>{pick(d.title)}</button>
                  <span className={a.docFolder}>{pick(d.folder.name)}</span>
                </span>
              </span>
              <span className={a.dim} role="cell">{pick(tp?.name)}</span>
              <span className={a.dim} role="cell">{languageLabel(d.language) || '—'}</span>
              <span className={a.dim} role="cell">{tp?.versioned && v ? `v${v.no}` : '—'}</span>
              <span className={a.dim} role="cell">
                {d.archivedAt ? <DateStamp iso={d.archivedAt} /> : v ? <DateStamp iso={v.createdAt} author={v.author} /> : '—'}
                {!d.archivedAt && v?.author ? <span className={a.author}>{v.author}</span> : null}
              </span>
              <span className={a.rowActions} role="cell">
                {!d.archivedAt && (
                  <button className={a.textBtn} onClick={() => setUpload({ mode: 'version', docId: d.id, title: pick(d.title) })}>
                    {tp?.versioned ? (lang === 'tr' ? 'Yeni sürüm' : 'New version') : (lang === 'tr' ? 'Dosyayı değiştir' : 'Replace file')}
                  </button>
                )}
                <button className={a.textBtn} onClick={() => setParam('belge', d.id)}>{lang === 'tr' ? 'Düzenle' : 'Edit'}</button>
              </span>
            </div>
          );
        })}
        {docs.data && rows.length === 0 && (
          <p className={a.empty}>
            {status === 'archived'
              ? (lang === 'tr' ? 'Arşivde belge yok.' : 'The archive is empty.')
              : (lang === 'tr' ? 'Bu süzgeçle eşleşen belge yok.' : 'No documents match these filters.')}
          </p>
        )}
      </div>

      <AnimatePresence>
        {chosen.length > 0 && (
          <motion.div
            className={a.bulkBar}
            role="toolbar"
            aria-label={lang === 'tr' ? 'Seçilen belgeler' : 'Selected documents'}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12, transition: { duration: 0.14 } }}
            transition={{ type: 'spring', bounce: 0.12, duration: 0.4 }}
          >
            <span className={a.bulkCount}>{lang === 'tr' ? `${chosen.length} belge seçildi` : `${chosen.length} selected`}</span>
            <button className={a.bulkBtn} onClick={() => bulk(status === 'active' ? 'archive' : 'unarchive')} disabled={busy === 'bulk'}>
              {busy === 'bulk' ? <Spinner size={14} /> : null}{status === 'active' ? (lang === 'tr' ? 'Arşivle' : 'Archive') : (lang === 'tr' ? 'Arşivden çıkar' : 'Restore')}
            </button>
            <ConfirmButton className={a.bulkDanger} label={lang === 'tr' ? 'Sil' : 'Delete'} confirm={lang === 'tr' ? `${chosen.length} belgeyi ve sürümlerini sil` : `Delete ${chosen.length} files and versions`} onConfirm={() => bulk('delete')} busy={busy === 'bulk'} />
            <button className={a.bulkClear} onClick={() => setSelected(new Set())}>{lang === 'tr' ? 'Seçimi kaldır' : 'Clear'}</button>
          </motion.div>
        )}
      </AnimatePresence>
      {error && <p className={a.error} role="alert">{error}</p>}

      <DocumentSheet id={openId} onClose={() => setParam('belge', null)} />
    </div>
  );
}

// ── Belge paneli ────────────────────────────────────────────────────────────

type Form = { titleTr: string; titleEn: string; type: string; language: DocLanguage; folder: string; description: string; tags: string };
const formOf = (d: DocDetail): Form => ({
  titleTr: d.title.tr, titleEn: d.title.en ?? '', type: d.type, language: d.language, folder: d.folder.slug,
  description: d.description ?? '', tags: d.tags.join(' '),
});

/** Makineler kategorilerinin, koleksiyonlar bölümlerinin altında gruplu seçenekler. */
export function FolderOptions({ tree }: { tree: TreeNode[] }) {
  const { pick } = useI18n();
  const byId = new Map(tree.map((n) => [n.id, n]));
  const groups = new Map<string, TreeNode[]>();
  for (const n of tree) {
    if (n.kind !== 'machine' && n.kind !== 'collection') continue;
    const parent = n.parentId ? byId.get(n.parentId) : null;
    const label = parent ? pick(parent.name) : '—';
    groups.set(label, [...(groups.get(label) ?? []), n]);
  }
  return (
    <>
      {[...groups.entries()].map(([label, list]) => (
        <optgroup key={label} label={label}>
          {list.map((f) => <option key={f.slug} value={f.slug}>{pick(f.name)}</option>)}
        </optgroup>
      ))}
    </>
  );
}

function DocumentSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { pick, lang } = useI18n();
  const types = useDocTypes();
  const { data: boot } = useBootstrap();
  const { setUpload } = useUi();
  const detail = useQuery({ queryKey: ['admin', 'document', id], queryFn: () => api.adminDocument(id!), enabled: !!id });
  const d = detail.data && detail.data.id === id ? detail.data : null;
  const { run, busy, error, setError } = useRun();
  const [form, setForm] = useState<Form | null>(null);
  const [formFor, setFormFor] = useState<string | null>(null);
  // Belge (ya da kaydedilmiş hali) gelince formu doldur.
  const stamp = d ? `${d.id}:${d.updatedAt}:${d.archivedAt ?? ''}` : null;
  if (d && stamp !== formFor) {
    setFormFor(stamp);
    setForm(formOf(d));
    setError(null);
  }
  if (!id && formFor) setFormFor(null);

  const tp = d ? types.get(d.type) : undefined;
  const dirty = !!(d && form && JSON.stringify(form) !== JSON.stringify(formOf(d)));
  const archived = !!d?.archivedAt;
  const tr = lang === 'tr';

  const save = () => d && form && run('save', () => api.updateDocument(d.id, {
    titleTr: form.titleTr, titleEn: form.titleEn || null, type: form.type, language: form.language, folder: form.folder,
    description: form.description || null, tags: form.tags,
  }), tr ? 'Kaydedildi' : 'Saved');

  const file = d?.current?.file;

  return (
    <Sheet
      open={!!id}
      onClose={onClose}
      title={d ? pick(d.title) : (tr ? 'Belge' : 'Document')}
      subtitle={d ? [pick(d.folder.name), pick(tp?.name), archived ? (tr ? 'Arşivde' : 'Archived') : null].filter(Boolean).join(' · ') : null}
      footer={d && form && (
        <>
          {archived ? (
            <>
              <button className={a.secondary} disabled={!!busy} onClick={() => run('unarchive', () => api.unarchiveDocument(d.id), tr ? 'Belge kütüphaneye geri alındı' : 'Document restored')}>
                {busy === 'unarchive' ? <Spinner size={14} /> : <Icon name="history" size={15} />}
                {tr ? 'Arşivden çıkar' : 'Restore'}
              </button>
              <ConfirmButton
                label={tr ? 'Kalıcı olarak sil' : 'Delete permanently'}
                confirm={tr ? 'Silmeyi onayla' : 'Confirm delete'}
                busy={busy === 'delete'}
                onConfirm={async () => { if (await run('delete', () => api.deleteDocument(d.id), tr ? 'Belge silindi' : 'Document deleted')) onClose(); }}
              />
            </>
          ) : (
            <>
            <ConfirmButton
              label={tr ? 'Arşivle' : 'Archive'}
              confirm={tr ? 'Arşivlemeyi onayla' : 'Confirm archive'}
              icon="archive"
              busy={busy === 'archive'}
              onConfirm={() => run('archive', () => api.archiveDocument(d.id), tr ? 'Belge arşivlendi' : 'Document archived')}
            />
            <ConfirmButton label={tr ? 'Sil' : 'Delete'} confirm={tr ? 'Belge ve sürümlerini sil' : 'Delete document and versions'} icon="trash" busy={!!busy} onConfirm={async () => { if (await run('delete', () => api.deleteDocument(d.id), tr ? 'Belge silindi' : 'Document deleted')) onClose(); }} />
            </>
          )}
          <span style={{ flex: 1 }} />
          {!archived && (
            <button className={a.primary} onClick={save} disabled={!dirty || !!busy || !form.titleTr.trim()}>
              {busy === 'save' ? <Spinner size={14} /> : (tr ? 'Kaydet' : 'Save')}
            </button>
          )}
        </>
      )}
    >
      {!d || !form ? (
        detail.error ? <p className={a.error}>{(detail.error as Error).message}</p>
          : <div className={a.skelList}>{Array.from({ length: 6 }, (_, i) => <span key={i} className="skeleton" style={{ ['--i' as string]: i }} />)}</div>
      ) : (
        <>
          <div className={a.docHero}>
            <span className={a.docHeroThumb}>{d && <DocThumb doc={d} size="lg" />}</span>
            <div className={a.docHeroText}>
              <span className={a.docHeroFile}>{file?.name ?? '—'}</span>
              <span className={a.docHeroMeta}>
                {[file?.ext.toUpperCase(), file ? formatSize(file.size, lang) : null, file?.pages ? `${file.pages} ${tr ? 'sayfa' : 'pages'}` : null, file?.width && file.height ? `${file.width} × ${file.height}` : null].filter(Boolean).join(' · ')}
              </span>
              <span className={a.docHeroLinks}>
                {!archived && <Link to={`/dokuman/${d.id}`}>{tr ? 'Sitede aç' : 'Open on site'}</Link>}
                <a href={downloadLink(d.id)}>{tr ? 'İndir' : 'Download'}</a>
                {!archived && (
                  <button onClick={() => setUpload({ mode: 'version', docId: d.id, title: pick(d.title) })}>
                    {tp?.versioned ? (tr ? 'Yeni sürüm yükle' : 'Upload new version') : (tr ? 'Dosyayı değiştir' : 'Replace file')}
                  </button>
                )}
              </span>
            </div>
          </div>

          {archived && (
            <p className={a.warn}>
              {tr
                ? 'Bu belge arşivde: kütüphanede ve aramada görünmez. Arşivden çıkarabilir ya da kalıcı olarak silebilirsiniz; silinen belgenin bütün sürümleri gider.'
                : 'This document is archived: hidden from the library and search. Restore it, or delete it permanently with all its versions.'}
            </p>
          )}

          <Section title={tr ? 'Bilgiler' : 'Details'}>
            <fieldset className={a.form} disabled={archived}>
              <label className={a.field}>
                <span>{tr ? 'Başlık (Türkçe)' : 'Title (Turkish)'}</span>
                <input value={form.titleTr} onChange={(e) => setForm({ ...form, titleTr: e.target.value })} />
              </label>
              <label className={a.field}>
                <span>{tr ? 'Başlık (İngilizce)' : 'Title (English)'}</span>
                <input value={form.titleEn} onChange={(e) => setForm({ ...form, titleEn: e.target.value })} />
              </label>
              <div className={a.fieldRow}>
                <label className={a.field}>
                  <span>{tr ? 'Tür' : 'Type'}</span>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    {[...types.values()].map((t) => <option key={t.slug} value={t.slug}>{pick(t.name)}</option>)}
                  </select>
                </label>
                <label className={a.field}>
                  <span>{tr ? 'Dil' : 'Language'}</span>
                  <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value as DocLanguage })}>
                    <LanguageOptions />
                  </select>
                </label>
              </div>
              <label className={a.field}>
                <span>{tr ? 'Klasör' : 'Folder'}</span>
                <select value={form.folder} onChange={(e) => setForm({ ...form, folder: e.target.value })}>
                  <FolderOptions tree={boot?.tree ?? []} />
                </select>
              </label>
              <label className={a.field}>
                <span>{tr ? 'Açıklama' : 'Description'}</span>
                <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={tr ? 'Aramada da bulunur.' : 'Also searchable.'} />
              </label>
              <label className={a.field}>
                <span>{tr ? 'Anahtar kelimeler' : 'Keywords'}</span>
                <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder={tr ? 'Boşlukla ayırın: parça kodu, eski ad, kısaltma' : 'Separated by spaces'} />
              </label>
            </fieldset>
          </Section>

          <Section title={tr ? 'Sürümler' : 'Versions'} aside={<span className={a.sectionCount}>{d.versions.length}</span>}>
            <ol className={a.versionList}>
              {d.versions.map((v) => {
                const current = v.no === d.current?.no;
                return (
                  <li key={v.no} data-current={current || undefined}>
                    <span className={a.vNo}>v{v.no}</span>
                    <span className={a.vBody}>
                      <span className={a.vNote}>{v.note || (tr ? 'İlk sürüm' : 'First version')}</span>
                      <span className={a.vMeta}>
                        {[formatDate(v.createdAt, lang, { day: 'numeric', month: 'long', year: 'numeric' }), v.author, v.file ? formatSize(v.file.size, lang) : null, current ? (tr ? 'Güncel' : 'Current') : null].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span className={a.vActions}>
                      {!archived && <Link to={current ? `/dokuman/${d.id}` : `/dokuman/${d.id}?v=${v.no}`} className={a.textBtn}>{tr ? 'Görüntüle' : 'View'}</Link>}
                      <a className={a.textBtn} href={current ? downloadLink(d.id) : downloadLink(d.id, v.no)}>{tr ? 'İndir' : 'Download'}</a>
                      {!archived && !current && (
                        <ConfirmButton
                          className={a.textBtn}
                          label={tr ? 'Buna dön' : 'Restore'}
                          confirm={tr ? 'Yeni sürüm olarak yayınla' : 'Publish as new version'}
                          busy={busy === `restore-${v.no}`}
                          onConfirm={() => run(`restore-${v.no}`, () => api.restoreVersion(d.id, v.no), tr ? `v${v.no} yeniden yayınlandı` : `v${v.no} republished`)}
                        />
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>
            <p className={a.hint}>
              {tr
                ? 'Sürümler silinmez. Eski bir sürüme dönmek, onu yeni numarayla yeniden yayınlar; kalıcı bağlantı her zaman güncel sürümü açar.'
                : 'Versions are never deleted. Restoring republishes an old file as a new version; the permalink always opens the latest.'}
            </p>
          </Section>

          {error && <p className={a.error} role="alert">{error}</p>}
        </>
      )}
    </Sheet>
  );
}
