// Makineler: kapaklı ızgara. Bir makineye basınca sağda panel açılır: kapak (yükle ya da
// makinenin fotoğraflarından seç), ad, kategori, marka, model kodu ve modeller, özet;
// makinenin belgeleri ve eksik türleri. "Yeni makine" aynı paneli boş açar.
import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { DocThumb } from '../components/Docs';
import { FadeImage, Spinner } from '../components/ui';
import { Link } from '../lib/link';
import { api, type AdminFolder } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useDocTypes, useUi } from '../lib/ui';
import { ConfirmButton, EmptyNote, PageHead, Section, Sheet, useCoverageTypes, useRun } from './shared';
import a from './admin.module.css';
import { MachineContentEditor, type ContentPanel } from './MachineContent';

const fold = (s: string) => s.toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i');

export function useAdminTree() {
  return useQuery({ queryKey: ['admin', 'tree'], queryFn: api.adminTree });
}

export default function AdminMachines() {
  const { pick, lang } = useI18n();
  const tree = useAdminTree();
  const coverageTypes = useCoverageTypes();
  const coverage = useQuery({ queryKey: ['admin', 'coverage'], queryFn: api.adminCoverage });
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const open = params.get('makine');
  const tr = lang === 'tr';

  const setOpen = (slug: string | null) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    if (slug) next.set('makine', slug);
    else next.delete('makine');
    return next;
  }, { replace: true, preventScrollReset: true });

  const all = tree.data ?? [];
  const categories = all.filter((f) => f.kind === 'category');
  const byId = new Map(all.map((f) => [f.id, f]));
  const missing = useMemo(() => new Map((coverage.data ?? []).map((c) => [c.slug, coverageTypes.filter((t) => !c.types.includes(t)).length])), [coverage.data, coverageTypes]);
  const machines = useMemo(() => {
    const needle = fold(q.trim());
    return all.filter((f) => f.kind === 'machine')
      .filter((f) => !category || byId.get(f.parentId ?? -1)?.slug === category)
      .filter((f) => !needle || fold(`${f.name.tr} ${f.name.en ?? ''} ${f.machine?.modelCode ?? ''} ${f.machine?.models.join(' ') ?? ''}`).includes(needle));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, q, category]);

  return (
    <div className={a.page}>
      <PageHead
        title={tr ? 'Makineler' : 'Machines'}
        lead={tr ? 'Ürün bilgilerini, galerileri ve belgeleri tek yerden yönetin.' : 'Manage product information, galleries and documents in one place.'}
        actions={<button className={a.primary} onClick={() => setOpen('yeni')}><Icon name="plus" size={16} />{tr ? 'Yeni makine' : 'New machine'}</button>}
      />

      <div className={a.toolbar}>
        <label className={a.searchField}>
          <Icon name="search" size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr ? 'Makine adı ya da model kodu ara' : 'Search name or model code'} />
        </label>
        <select className={a.select} value={category} onChange={(e) => setCategory(e.target.value)} aria-label={tr ? 'Kategori' : 'Category'}>
          <option value="">{tr ? 'Bütün kategoriler' : 'All categories'}</option>
          {categories.map((c) => <option key={c.slug} value={c.slug}>{pick(c.name)}</option>)}
        </select>
        <span className={a.toolbarCount}>{machines.length}</span>
      </div>

      {!tree.data ? (
        <div className={a.machineGrid}>{Array.from({ length: 8 }, (_, i) => <span key={i} className={`${a.machineSkel} skeleton`} style={{ ['--i' as string]: i }} />)}</div>
      ) : (
        <ul className={a.machineGrid}>
          {machines.map((m) => {
            const gaps = missing.get(m.slug) ?? 0;
            return (
              <li key={m.slug}>
                <button className={a.machineCard} onClick={() => setOpen(m.slug)} data-open={open === m.slug || undefined}>
                  <span className={a.machineCover}>
                    {m.machine?.cover?.thumb ? <FadeImage src={m.machine.cover.thumb} /> : <Icon name="parts" size={26} />}
                  </span>
                  <span className={a.machineName}>{pick(m.name)}</span>
                  <span className={a.machineMeta}>
                    {[pick(byId.get(m.parentId ?? -1)?.name), m.machine?.modelCode].filter(Boolean).join(' · ')}
                  </span>
                  <span className={a.machineFoot}>
                    <span>{m.docCount} {tr ? 'belge' : 'files'}</span>
                    {gaps > 0 && <span className={a.machineGap}>{gaps} {tr ? 'eksik' : 'missing'}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {tree.data && machines.length === 0 && <p className={a.empty}>{tr ? 'Eşleşen makine yok.' : 'No machines match.'}</p>}

      <MachineSheet slug={open} tree={all} onClose={() => setOpen(null)} onCreated={(slug) => setOpen(slug)} />
    </div>
  );
}

// ── Makine paneli ───────────────────────────────────────────────────────────

type Form = { nameTr: string; nameEn: string; parent: string; brand: 'ugur' | 'barmaksan'; modelCode: string; models: string; summaryTr: string; summaryEn: string };

const formOf = (m: AdminFolder | null, parentSlug: string): Form => ({
  nameTr: m?.name.tr ?? '',
  nameEn: m?.name.en && m.name.en !== m.name.tr ? m.name.en : '',
  parent: parentSlug,
  brand: m?.machine?.brand ?? 'ugur',
  modelCode: m?.machine?.modelCode ?? '',
  models: m?.machine?.models.join('\n') ?? '',
  summaryTr: m?.machine?.summary.tr ?? '',
  summaryEn: m?.machine?.summary.en ?? '',
});

export function MachineSheet({ slug, tree, defaultParent: parentHint, onClose, onCreated }: {
  slug: string | null; tree: AdminFolder[]; defaultParent?: string | null; onClose: () => void; onCreated?: (slug: string) => void;
}) {
  const { pick, lang } = useI18n();
  const tr = lang === 'tr';
  const types = useDocTypes();
  const coverageTypes = useCoverageTypes();
  const { setUpload } = useUi();
  const { run, busy, error, setError } = useRun();
  const docs = useQuery({ queryKey: ['admin', 'documents'], queryFn: api.adminDocuments, enabled: !!slug });
  const fileRef = useRef<HTMLInputElement>(null);
  const creating = slug === 'yeni';
  const machine = !creating && slug ? tree.find((f) => f.slug === slug && f.kind === 'machine') ?? null : null;
  const byId = new Map(tree.map((f) => [f.id, f]));
  const parents = tree.filter((f) => f.kind === 'category' || f.kind === 'section');
  const defaultParent = machine ? byId.get(machine.parentId ?? -1)?.slug ?? '' : parentHint ?? tree.find((f) => f.kind === 'category')?.slug ?? '';

  const [panel, setPanel] = useState<'details' | 'files' | ContentPanel>('details');
  const [contentStatus, setContentStatus] = useState({ dirty: false, busy: false });
  const [form, setForm] = useState<Form | null>(null);
  const [formFor, setFormFor] = useState<string | null>(null);
  const stamp = slug ? (creating ? 'yeni' : machine ? `${machine.slug}:${machine.updatedAt}:${machine.parentId}` : null) : null;
  if (stamp && stamp !== formFor && (creating || machine)) {
    setFormFor(stamp);
    setForm(formOf(machine, defaultParent));
    if (formFor?.split(':')[0] !== slug) setPanel('details');
    setError(null);
  }
  if (!slug && formFor) setFormFor(null);

  const own = (docs.data ?? []).filter((d) => !d.archivedAt && d.folder.slug === slug);
  const photos = own.filter((d) => d.current?.file?.kind === 'image');
  const present = new Set(own.map((d) => d.type));
  const gaps = coverageTypes.filter((t) => !present.has(t));
  const dirty = !!form && JSON.stringify(form) !== JSON.stringify(formOf(machine, defaultParent));

  const save = async () => {
    if (!form) return;
    const machineFields = {
      brand: form.brand, modelCode: form.modelCode || null, models: form.models.split('\n'), summaryTr: form.summaryTr || null, summaryEn: form.summaryEn || null,
    };
    if (creating) {
      let created: { slug: string } | null = null;
      const ok = await run('save', async () => {
        created = await api.createFolder({ parent: form.parent, kind: 'machine', nameTr: form.nameTr, nameEn: form.nameEn || null, machine: machineFields });
      }, tr ? 'Makine eklendi' : 'Machine added');
      if (ok && created) onCreated?.((created as { slug: string }).slug);
      return;
    }
    if (!machine) return;
    await run('save', () => api.updateFolder(machine.slug, {
      nameTr: form.nameTr, nameEn: form.nameEn || null,
      ...(form.parent && form.parent !== byId.get(machine.parentId ?? -1)?.slug ? { parent: form.parent } : {}),
      machine: machineFields,
    }), tr ? 'Kaydedildi' : 'Saved');
  };

  const uploadCover = (file: File | undefined) => {
    if (!file || !machine) return;
    const body = new FormData();
    body.append('file', file);
    void run('cover', () => api.uploadCover(machine.slug, body), tr ? 'Kapak güncellendi' : 'Cover updated');
  };

  const cover = machine?.machine?.cover;

  return (
    <Sheet
      wide
      open={!!slug}
      onClose={onClose}
      title={creating ? (tr ? 'Yeni makine' : 'New machine') : machine ? pick(machine.name) : (tr ? 'Makine' : 'Machine')}
      subtitle={machine ? [pick(byId.get(machine.parentId ?? -1)?.name), machine.machine?.modelCode].filter(Boolean).join(' · ') : creating ? (tr ? 'Kapak ve belgeler kaydettikten sonra eklenir.' : 'Add a cover and files after saving.') : null}
      footer={form && (
        <>
          {machine && (
            <ConfirmButton
              label={tr ? 'Makineyi arşivle' : 'Archive machine'}
              confirm={tr ? 'Arşivlemeyi onayla' : 'Confirm archive'}
              icon="archive"
              busy={busy === 'archive'}
              onConfirm={async () => { if (await run('archive', () => api.archiveFolder(machine.slug), tr ? 'Makine arşivlendi' : 'Machine archived')) onClose(); }}
            />
          )}
          {machine && <ConfirmButton label={tr ? 'Sil' : 'Delete'} confirm={tr ? 'Makineyi ve belgelerini sil' : 'Delete machine and its files'} icon="trash" busy={!!busy || contentStatus.busy} onConfirm={async () => { if (await run('delete', () => api.deleteFolder(machine.slug), tr ? 'Makine ve belgeleri silindi' : 'Machine and files deleted')) onClose(); }} />}
          <span className={a.draftStatus}>{dirty || contentStatus.dirty ? (tr ? 'Kaydedilmemiş değişiklikler' : 'Unsaved changes') : (tr ? 'Güncel' : 'Up to date')}</span>
          {machine && <Link to={`/m/${machine.slug}`} className={a.textBtn}>{tr ? 'Sitede aç' : 'Open on site'}</Link>}
          {panel === 'details' && <button className={a.primary} onClick={save} disabled={!!busy || !form.nameTr.trim() || !form.parent || (!creating && !dirty)}>
            {busy === 'save' ? <Spinner size={14} /> : creating ? (tr ? 'Makineyi ekle' : 'Add machine') : (tr ? 'Bilgileri kaydet' : 'Save details')}
          </button>}
          {machine && panel !== 'details' && panel !== 'files' && <button type="submit" form={`machine-content-${machine.slug}`} className={a.primary} disabled={!contentStatus.dirty || contentStatus.busy || !!busy}>{contentStatus.busy ? <Spinner size={14} /> : <Icon name="check" size={14} />}{tr ? 'Kaydet ve yayınla' : 'Save and publish'}</button>}
        </>
      )}
    >
      {!form ? (
        <div className={a.skelList}>{Array.from({ length: 6 }, (_, i) => <span key={i} className="skeleton" style={{ ['--i' as string]: i }} />)}</div>
      ) : (
        <>
          {machine && <nav className={a.editorNav} aria-label={tr ? 'Makine düzenleme bölümleri' : 'Machine editing sections'}>
            {([['details', 'Bilgiler', 'Details', 'parts'], ['profile', 'Açıklama', 'Description', 'file'], ['gallery', 'Galeri', 'Gallery', 'images'], ['files', 'Belgeler', 'Files', 'folder'], ['maintenance', 'Bakım', 'Maintenance', 'wrench']] as const).map(([id, labelTr, labelEn, icon]) => <button key={id} className={a.editorTab} aria-pressed={panel === id} onClick={() => setPanel(id)}><Icon name={icon} size={16} />{tr ? labelTr : labelEn}{id === 'files' && <span>{own.length}</span>}</button>)}
          </nav>}
          <div hidden={panel !== 'details'}>
          {machine && (
            <Section title={tr ? 'Liste kapağı' : 'List cover'}>
              <div className={a.coverRow}>
                <span className={a.coverBox}>
                  {cover?.thumb ? <FadeImage src={cover.preview ?? cover.thumb} /> : <Icon name="parts" size={28} />}
                  {busy === 'cover' && <span className={a.coverBusy}><Spinner size={18} /></span>}
                </span>
                <div className={a.coverActions}>
                  <button className={a.secondary} onClick={() => fileRef.current?.click()} disabled={!!busy}>
                    <Icon name="upload" size={15} />{tr ? 'Görsel yükle' : 'Upload image'}
                  </button>
                  <p className={a.hint}>{tr ? 'Makine listesinde bu kapak gösterilir. Ürün içindeki galeri ayrı düzenlenir. Orijinal dosya korunur.' : 'This cover appears in the machine list. The product gallery is managed separately. The original file is preserved.'}</p>
                  <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { uploadCover(e.target.files?.[0]); e.target.value = ''; }} />
                </div>
              </div>
              {photos.length > 0 && (
                <>
                  <p className={a.subLabel}>{tr ? 'Ya da makinenin fotoğraflarından seçin' : 'Or pick one of its photos'}</p>
                  <ul className={a.pickGrid}>
                    {photos.map((p) => {
                      const f = p.current!.file!;
                      const on = f.id === cover?.id;
                      return (
                        <li key={p.id}>
                          <button className={a.pick} data-on={on || undefined} disabled={on || !!busy} onClick={() => run('cover', () => api.updateFolder(machine.slug, { machine: { coverFileId: f.id } }), tr ? 'Kapak güncellendi' : 'Cover updated')} aria-label={pick(p.title)}>
                            {f.thumb && <FadeImage src={f.thumb} fit="cover" />}
                            {on && <span className={a.pickCheck}><Icon name="check" size={14} strokeWidth={2} /></span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </Section>
          )}

          <Section title={tr ? 'Bilgiler' : 'Details'}>
            <div className={a.form}>
              <div className={a.fieldRow}>
                <label className={a.field}>
                  <span>{tr ? 'Ad (Türkçe)' : 'Name (Turkish)'}</span>
                  <input value={form.nameTr} onChange={(e) => setForm({ ...form, nameTr: e.target.value })} autoFocus={creating} />
                </label>
                <label className={a.field}>
                  <span>{tr ? 'Ad (İngilizce)' : 'Name (English)'}</span>
                  <input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} />
                </label>
              </div>
              <div className={a.fieldRow}>
                <label className={a.field}>
                  <span>{tr ? 'Kategori' : 'Category'}</span>
                  <select value={form.parent} onChange={(e) => setForm({ ...form, parent: e.target.value })}>
                    {parents.map((p) => <option key={p.slug} value={p.slug}>{p.kind === 'section' ? pick(p.name) : `${pick(byId.get(p.parentId ?? -1)?.name)} › ${pick(p.name)}`}</option>)}
                  </select>
                </label>
                <label className={a.field}>
                  <span>{tr ? 'Marka' : 'Brand'}</span>
                  <select value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value as Form['brand'] })}>
                    <option value="ugur">Uğur Promilling</option>
                    <option value="barmaksan">Barmaksan</option>
                  </select>
                </label>
              </div>
              <label className={a.field}>
                <span>{tr ? 'Model kodu' : 'Model code'}</span>
                <input value={form.modelCode} onChange={(e) => setForm({ ...form, modelCode: e.target.value })} placeholder="SCS" />
              </label>
              <label className={a.field}>
                <span>{tr ? 'Modeller (her satıra bir model)' : 'Models (one per line)'}</span>
                <textarea rows={4} value={form.models} onChange={(e) => setForm({ ...form, models: e.target.value })} placeholder={'SCS 20864\nSCS 21264'} className="mono" />
              </label>
              <label className={a.field}>
                <span>{tr ? 'Özet (Türkçe)' : 'Summary (Turkish)'}</span>
                <textarea rows={4} value={form.summaryTr} onChange={(e) => setForm({ ...form, summaryTr: e.target.value })} />
              </label>
              <label className={a.field}>
                <span>{tr ? 'Özet (İngilizce)' : 'Summary (English)'}</span>
                <textarea rows={4} value={form.summaryEn} onChange={(e) => setForm({ ...form, summaryEn: e.target.value })} />
              </label>
            </div>
          </Section>

          </div>
          <div hidden={panel !== 'files'}>
          {machine && (
            <Section
              title={tr ? 'Belgeler' : 'Files'}
              aside={<button className={a.textBtn} onClick={() => setUpload({ mode: 'new', folder: machine.slug })}><Icon name="plus" size={14} />{tr ? 'Belge yükle' : 'Upload'}</button>}
            >
              {gaps.length > 0 && (
                <div className={a.gapList}>
                  <span className={a.subLabel}>{tr ? 'Eksik' : 'Missing'}</span>
                  {gaps.map((t) => (
                    <button key={t} className={a.gapBtn} onClick={() => setUpload({ mode: 'new', folder: machine.slug, type: t })}>
                      <Icon name="plus" size={13} strokeWidth={1.8} />{pick(types.get(t)?.name)}
                    </button>
                  ))}
                </div>
              )}
              {own.length === 0 ? (
                <EmptyNote>{tr ? 'Bu makinede henüz belge yok.' : 'No files yet.'}</EmptyNote>
              ) : (
                <ul className={a.miniDocs}>
                  {own.map((d) => (
                    <li key={d.id}>
                      <DocThumb doc={d} size="sm" />
                      <span className={a.docText}>
                        <Link to={`/admin/belgeler?belge=${d.id}`} className={a.docTitle}>{pick(d.title)}</Link>
                        <span className={a.docFolder}>{pick(types.get(d.type)?.name)}{types.get(d.type)?.versioned && d.current ? ` · v${d.current.no}` : ''}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}

          </div>
          {machine && <MachineContentEditor key={machine.slug} slug={machine.slug} panel={panel !== 'details' && panel !== 'files' ? panel : null} onStatus={setContentStatus} />}
          {error && <p className={a.error} role="alert">{error}</p>}
        </>
      )}
    </Sheet>
  );
}
