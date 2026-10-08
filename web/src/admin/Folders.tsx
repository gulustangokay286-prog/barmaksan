// Klasörler: kütüphanenin ağacı. Sırala (yukarı/aşağı), alt klasör ekle, adını ve açıklamasını
// düzenle, başka yere taşı, boşsa arşivle. Makine satırları makine panelini açar.
import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { Spinner } from '../components/ui';
import { Link } from '../lib/link';
import { api, type AdminFolder, type FolderKind } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { ConfirmButton, Dialog, PageHead, useRun } from './shared';
import { MachineSheet, useAdminTree } from './Machines';
import a from './admin.module.css';

const KIND_LABEL: Record<FolderKind, { tr: string; en: string }> = {
  section: { tr: 'Ana bölüm', en: 'Section' },
  category: { tr: 'Kategori', en: 'Category' },
  machine: { tr: 'Makine', en: 'Machine' },
  collection: { tr: 'Klasör', en: 'Folder' },
};

type Editing = { mode: 'edit'; folder: AdminFolder } | { mode: 'new'; parent: AdminFolder | null } | null;

export default function AdminFolders() {
  const { pick, lang } = useI18n();
  const tr = lang === 'tr';
  const tree = useAdminTree();
  const { run, busy } = useRun();
  const [editing, setEditing] = useState<Editing>(null);
  const [machine, setMachine] = useState<string | null>(null);
  // Yeni makine bir kategorinin "Alt klasör"ünden açılırsa o kategori seçili gelir.
  const [machineParent, setMachineParent] = useState<string | null>(null);
  const all = useMemo(() => tree.data ?? [], [tree.data]);
  const kids = useMemo(() => {
    const map = new Map<number | null, AdminFolder[]>();
    for (const f of all) map.set(f.parentId, [...(map.get(f.parentId) ?? []), f]);
    for (const list of map.values()) list.sort((x, y) => x.sort - y.sort || x.name.tr.localeCompare(y.name.tr, 'tr'));
    return map;
  }, [all]);
  const byId = useMemo(() => new Map(all.map((f) => [f.id, f])), [all]);

  const move = (f: AdminFolder, dir: -1 | 1) => {
    const siblings = kids.get(f.parentId) ?? [];
    const i = siblings.findIndex((x) => x.id === f.id);
    const j = i + dir;
    if (j < 0 || j >= siblings.length) return;
    const order = siblings.map((x) => x.slug);
    [order[i], order[j]] = [order[j], order[i]];
    void run(`move-${f.slug}`, () => api.reorderFolders(f.parentId ? byId.get(f.parentId)?.slug ?? null : null, order));
  };

  const Row = ({ f, depth, index, count }: { f: AdminFolder; depth: number; index: number; count: number }) => {
    const children = kids.get(f.id) ?? [];
    const href = f.kind === 'machine' ? `/m/${f.slug}` : `/k/${f.slug}`;
    return (
      <li>
        <div className={a.folderRow} style={{ paddingLeft: 14 + depth * 22 }} data-kind={f.kind}>
          <Icon name={f.kind === 'machine' ? 'parts' : 'folder'} size={16} />
          <span className={a.folderText}>
            <button className={a.folderName} onClick={() => (f.kind === 'machine' ? setMachine(f.slug) : setEditing({ mode: 'edit', folder: f }))}>{pick(f.name)}</button>
            {f.name.en && f.name.en !== f.name.tr && <span className={a.folderEn}>{f.name.en}</span>}
          </span>
          <span className={a.folderCount}>
            {[f.childCount ? `${f.childCount} ${tr ? 'klasör' : 'folders'}` : null, f.docCount ? `${f.docCount} ${tr ? 'belge' : 'files'}` : null].filter(Boolean).join(' · ')}
          </span>
          <span className={a.folderActions}>
            <button className={a.iconBtnSm} onClick={() => move(f, -1)} disabled={index === 0 || !!busy} aria-label={tr ? 'Yukarı taşı' : 'Move up'}><Icon name="arrowUp" size={15} /></button>
            <button className={a.iconBtnSm} onClick={() => move(f, 1)} disabled={index === count - 1 || !!busy} aria-label={tr ? 'Aşağı taşı' : 'Move down'}><Icon name="arrowDown" size={15} /></button>
            {f.kind !== 'machine' && (
              <button className={a.textBtn} onClick={() => setEditing({ mode: 'new', parent: f })}>{tr ? 'Alt klasör' : 'Subfolder'}</button>
            )}
            <button className={a.textBtn} onClick={() => (f.kind === 'machine' ? setMachine(f.slug) : setEditing({ mode: 'edit', folder: f }))}>{tr ? 'Düzenle' : 'Edit'}</button>
            <Link to={href} className={a.iconBtnSm} aria-label={tr ? 'Sitede aç' : 'Open on site'}><Icon name="external" size={15} /></Link>
          </span>
        </div>
        {children.length > 0 && (
          <ul>{children.map((k, i) => <Row key={k.id} f={k} depth={depth + 1} index={i} count={children.length} />)}</ul>
        )}
      </li>
    );
  };

  const roots = kids.get(null) ?? [];
  return (
    <div className={a.page}>
      <PageHead
        title={tr ? 'Klasörler' : 'Folders'}
        lead={tr ? 'Kütüphanenin ağacı: kenar çubuğundaki sıra buradaki sıradır. Ad, açıklama ve konum değişiklikleri sitede ve aramada hemen görünür.' : 'The library tree, in sidebar order. Name, description and location changes show on the site and in search right away.'}
        actions={<button className={a.secondary} onClick={() => setEditing({ mode: 'new', parent: null })}><Icon name="plus" size={16} />{tr ? 'Yeni ana bölüm' : 'New section'}</button>}
      />
      {!tree.data ? (
        <div className={a.skelList}>{Array.from({ length: 10 }, (_, i) => <span key={i} className="skeleton" style={{ ['--i' as string]: i }} />)}</div>
      ) : (
        <ul className={a.folderTree}>
          {roots.map((r, i) => <Row key={r.id} f={r} depth={0} index={i} count={roots.length} />)}
        </ul>
      )}
      <FolderDialog editing={editing} all={all} onClose={() => setEditing(null)} onMachine={(parent) => { setEditing(null); setMachineParent(parent); setMachine('yeni'); }} />
      <MachineSheet slug={machine} tree={all} defaultParent={machineParent} onClose={() => setMachine(null)} onCreated={(slug) => setMachine(slug)} />
    </div>
  );
}

type Form = { nameTr: string; nameEn: string; descriptionTr: string; descriptionEn: string; parent: string; kind: FolderKind };

function FolderDialog({ editing, all, onClose, onMachine }: { editing: Editing; all: AdminFolder[]; onClose: () => void; onMachine: (parentSlug: string | null) => void }) {
  const { pick, lang } = useI18n();
  const tr = lang === 'tr';
  const { run, busy, error, setError } = useRun();
  const [form, setForm] = useState<Form | null>(null);
  const [formFor, setFormFor] = useState<Editing>(null);
  if (editing !== formFor) {
    setFormFor(editing);
    setError(null);
    if (editing?.mode === 'edit') {
      const f = editing.folder;
      setForm({
        nameTr: f.name.tr, nameEn: f.name.en && f.name.en !== f.name.tr ? f.name.en : '',
        descriptionTr: f.description.tr ?? '', descriptionEn: f.description.en ?? '',
        parent: all.find((x) => x.id === f.parentId)?.slug ?? '', kind: f.kind,
      });
    } else if (editing?.mode === 'new') {
      const p = editing.parent;
      setForm({ nameTr: '', nameEn: '', descriptionTr: '', descriptionEn: '', parent: p?.slug ?? '', kind: !p ? 'section' : p.kind === 'section' ? 'category' : 'collection' });
    } else {
      setForm(null);
    }
  }

  const folder = editing?.mode === 'edit' ? editing.folder : null;
  const byId = new Map(all.map((f) => [f.id, f]));
  // Taşınabileceği yerler: makine olmayan, kendisi ya da altı olmayan klasörler.
  const descendants = new Set<number>();
  if (folder) {
    const stack = [folder.id];
    while (stack.length) {
      const id = stack.pop()!;
      descendants.add(id);
      for (const f of all) if (f.parentId === id) stack.push(f.id);
    }
  }
  const targets = all.filter((f) => f.kind !== 'machine' && !descendants.has(f.id) && (form?.kind !== 'category' || f.kind === 'section'));
  const pathOf = (f: AdminFolder): string => (f.parentId && byId.get(f.parentId) ? `${pathOf(byId.get(f.parentId)!)} › ${pick(f.name)}` : pick(f.name));

  const save = async () => {
    if (!form) return;
    const ok = await run('save', () => (folder
      ? api.updateFolder(folder.slug, {
        nameTr: form.nameTr, nameEn: form.nameEn || null, descriptionTr: form.descriptionTr || null, descriptionEn: form.descriptionEn || null,
        ...(folder.kind !== 'section' && form.parent && form.parent !== byId.get(folder.parentId ?? -1)?.slug ? { parent: form.parent } : {}),
      })
      : api.createFolder({
        parent: form.parent || null, kind: form.kind, nameTr: form.nameTr, nameEn: form.nameEn || null,
        descriptionTr: form.descriptionTr || null, descriptionEn: form.descriptionEn || null,
      })), tr ? 'Kaydedildi' : 'Saved');
    if (ok) onClose();
  };

  const parentNode = editing?.mode === 'new' ? editing.parent : null;
  const title = folder
    ? (tr ? `${KIND_LABEL[folder.kind].tr} düzenle` : `Edit ${KIND_LABEL[folder.kind].en.toLowerCase()}`)
    : parentNode ? (tr ? `${pick(parentNode.name)} içine ekle` : `Add to ${pick(parentNode.name)}`) : (tr ? 'Yeni ana bölüm' : 'New section');

  return (
    <Dialog
      open={!!editing}
      onClose={onClose}
      title={title}
      footer={form && (
        <>
          {folder && (
            <ConfirmButton
              label={tr ? 'Arşivle' : 'Archive'}
              confirm={tr ? 'Arşivlemeyi onayla' : 'Confirm archive'}
              busy={busy === 'archive'}
              onConfirm={async () => { if (await run('archive', () => api.archiveFolder(folder.slug), tr ? 'Klasör arşivlendi' : 'Folder archived')) onClose(); }}
            />
          )}
          <span style={{ flex: 1 }} />
          <button className={a.secondary} onClick={onClose}>{tr ? 'Vazgeç' : 'Cancel'}</button>
          <button className={a.primary} onClick={save} disabled={!!busy || !form.nameTr.trim()}>{busy === 'save' ? <Spinner size={14} /> : folder ? (tr ? 'Kaydet' : 'Save') : (tr ? 'Ekle' : 'Add')}</button>
        </>
      )}
    >
      {form && (
        <div className={a.form}>
          {!folder && parentNode && (
            <div className={a.field}>
              <span>{tr ? 'Ne eklenecek?' : 'What to add?'}</span>
              <div className={a.choiceRow}>
                {(parentNode.kind === 'section' ? (['category', 'collection', 'machine'] as const) : parentNode.kind === 'category' ? (['machine', 'collection'] as const) : (['collection'] as const)).map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={a.choice}
                    aria-pressed={form.kind === k}
                    onClick={() => (k === 'machine' ? onMachine(parentNode.slug) : setForm({ ...form, kind: k }))}
                  >
                    <Icon name={k === 'machine' ? 'parts' : 'folder'} size={16} />
                    {tr ? KIND_LABEL[k].tr : KIND_LABEL[k].en}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className={a.fieldRow}>
            <label className={a.field}>
              <span>{tr ? 'Ad (Türkçe)' : 'Name (Turkish)'}</span>
              <input value={form.nameTr} onChange={(e) => setForm({ ...form, nameTr: e.target.value })} autoFocus />
            </label>
            <label className={a.field}>
              <span>{tr ? 'Ad (İngilizce)' : 'Name (English)'}</span>
              <input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} />
            </label>
          </div>
          {folder && folder.kind !== 'section' && (
            <label className={a.field}>
              <span>{tr ? 'Konum' : 'Location'}</span>
              <select value={form.parent} onChange={(e) => setForm({ ...form, parent: e.target.value })}>
                {targets.map((t) => <option key={t.slug} value={t.slug}>{pathOf(t)}</option>)}
              </select>
            </label>
          )}
          <label className={a.field}>
            <span>{tr ? 'Açıklama (Türkçe)' : 'Description (Turkish)'}</span>
            <textarea rows={3} value={form.descriptionTr} onChange={(e) => setForm({ ...form, descriptionTr: e.target.value })} />
          </label>
          <label className={a.field}>
            <span>{tr ? 'Açıklama (İngilizce)' : 'Description (English)'}</span>
            <textarea rows={3} value={form.descriptionEn} onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })} />
          </label>
          {folder && (
            <p className={a.hint}>
              {tr ? 'Arşivleme yalnızca boş klasörde yapılır: içindeki belge ve klasörleri önce taşıyın ya da arşivleyin.' : 'Only empty folders can be archived: move or archive their contents first.'}
            </p>
          )}
          {error && <p className={a.error} role="alert">{error}</p>}
        </div>
      )}
    </Dialog>
  );
}
