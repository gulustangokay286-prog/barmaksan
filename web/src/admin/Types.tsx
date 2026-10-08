// Belge türleri: makine sayfasındaki bölümlerin adı, sırası ve ikonu; hangilerinin her makinede
// beklendiği (Eksik belgeler raporu). Yeni tür eklenir; hiç belgesi olmayan tür silinir.
import { useMemo, useState } from 'react';
import { Reorder, useDragControls } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { Spinner } from '../components/ui';
import { api, type DocType } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useBootstrap } from '../lib/ui';
import { ConfirmButton, Dialog, PageHead, useCoverageTypes, useRun } from './shared';
import a from './admin.module.css';

const ICONS = ['sheet', 'drawing', 'parts', 'book', 'wrench', 'drop', 'seal', 'catalog', 'building', 'send', 'photo', 'video', 'file', 'layers', 'folder', 'info', 'library', 'images'];
const MEDIA = { document: { tr: 'Belge', en: 'Document' }, image: { tr: 'Fotoğraf', en: 'Photo' }, video: { tr: 'Video', en: 'Video' } } as const;

export default function AdminTypes() {
  const { pick, lang } = useI18n();
  const tr = lang === 'tr';
  const { data: boot } = useBootstrap();
  const coverage = useCoverageTypes();
  const docs = useQuery({ queryKey: ['admin', 'documents'], queryFn: api.adminDocuments });
  const { run, busy, error } = useRun();
  const [editing, setEditing] = useState<DocType | 'new' | null>(null);

  const types = useMemo(() => boot?.docTypes ?? [], [boot]);
  const [order, setOrder] = useState<string[]>([]);
  const [orderFor, setOrderFor] = useState('');
  const savedOrder = types.map((t) => t.slug).join(',');
  if (savedOrder !== orderFor) {
    setOrderFor(savedOrder);
    setOrder(types.map((t) => t.slug));
  }
  const bySlug = new Map(types.map((t) => [t.slug, t]));
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of docs.data ?? []) m.set(d.type, (m.get(d.type) ?? 0) + 1);
    return m;
  }, [docs.data]);

  const toggleCoverage = (slug: string, on: boolean) => {
    const next = on ? [...coverage, slug] : coverage.filter((x) => x !== slug);
    // Raporun sütun sırası türlerin sırasıyla aynı kalsın.
    void run(`cov-${slug}`, () => api.setCoverageTypes(order.filter((s) => next.includes(s))), tr ? 'Eksik belgeler raporu güncellendi' : 'Coverage report updated');
  };
  const commitOrder = () => {
    if (order.join(',') !== savedOrder) void run('order', () => api.reorderTypes(order), tr ? 'Sıra kaydedildi' : 'Order saved');
  };

  return (
    <div className={a.page}>
      <PageHead
        title={tr ? 'Belge türleri' : 'Document types'}
        lead={tr ? 'Makine sayfasındaki bölümler bu sırayla görünür. "Her makinede beklenir" işaretli türler Eksik belgeler raporunda sütundur.' : 'Machine pages list sections in this order. Types marked as expected become columns of the Missing documents report.'}
        actions={<button className={a.primary} onClick={() => setEditing('new')}><Icon name="plus" size={16} />{tr ? 'Yeni tür' : 'New type'}</button>}
      />
      {error && <p className={a.error} role="alert">{error}</p>}
      <div className={a.typeHead}>
        <span />
        <span>{tr ? 'Tür' : 'Type'}</span>
        <span>{tr ? 'İçerik' : 'Content'}</span>
        <span>{tr ? 'Belge' : 'Files'}</span>
        <span>{tr ? 'Her makinede beklenir' : 'Expected on every machine'}</span>
        <span />
      </div>
      <Reorder.Group axis="y" values={order} onReorder={setOrder} className={a.typeList}>
        {order.map((slug) => {
          const t = bySlug.get(slug);
          if (!t) return null;
          return (
            <TypeRow key={slug} slug={slug} onDrop={commitOrder}>
              <span className={a.typeName}>
                <span className={a.typeIcon}><Icon name={t.icon} size={17} /></span>
                <span className={a.docText}>
                  <span className={a.docTitle}>{pick(t.name)}{t.short ? <span className={a.typeShort}>{t.short}</span> : null}</span>
                  <span className={a.docFolder}>{tr ? t.name.en : t.name.tr}</span>
                </span>
              </span>
              <span className={a.dim}>
                {tr ? MEDIA[t.media].tr : MEDIA[t.media].en}
                <span className={a.author}>{t.media === 'document' ? (t.versioned ? (tr ? 'Sürüm takipli' : 'Versioned') : (tr ? 'Sürümsüz' : 'Not versioned')) : ''}</span>
              </span>
              <span className={a.dim}>{counts.get(slug) ?? 0}</span>
              <label className={a.toggle}>
                <input type="checkbox" checked={coverage.includes(slug)} disabled={!!busy} onChange={(e) => toggleCoverage(slug, e.target.checked)} />
                {busy === `cov-${slug}` && <Spinner size={13} />}
              </label>
              <span className={a.rowActions}>
                <button className={a.textBtn} onClick={() => setEditing(t)}>{tr ? 'Düzenle' : 'Edit'}</button>
              </span>
            </TypeRow>
          );
        })}
      </Reorder.Group>
      <TypeDialog editing={editing} count={editing && editing !== 'new' ? counts.get(editing.slug) ?? 0 : 0} onClose={() => setEditing(null)} />
    </div>
  );
}

function TypeRow({ slug, onDrop, children }: { slug: string; onDrop: () => void; children: React.ReactNode }) {
  const { lang } = useI18n();
  const controls = useDragControls();
  return (
    <Reorder.Item value={slug} dragListener={false} dragControls={controls} onDragEnd={onDrop} className={a.typeRow} whileDrag={{ scale: 1.01, boxShadow: '0 12px 32px rgba(0,0,0,0.16)' }}>
      <button className={a.grip} onPointerDown={(e) => controls.start(e)} aria-label={lang === 'tr' ? 'Sürükleyerek sırala' : 'Drag to reorder'} type="button">
        <Icon name="grip" size={16} strokeWidth={2.4} />
      </button>
      {children}
    </Reorder.Item>
  );
}

type Form = { nameTr: string; nameEn: string; short: string; icon: string; media: DocType['media']; versioned: boolean };

function TypeDialog({ editing, count, onClose }: { editing: DocType | 'new' | null; count: number; onClose: () => void }) {
  const { lang } = useI18n();
  const tr = lang === 'tr';
  const { run, busy, error, setError } = useRun();
  const [form, setForm] = useState<Form | null>(null);
  const [formFor, setFormFor] = useState<DocType | 'new' | null>(null);
  if (editing !== formFor) {
    setFormFor(editing);
    setError(null);
    setForm(editing === 'new'
      ? { nameTr: '', nameEn: '', short: '', icon: 'file', media: 'document', versioned: true }
      : editing ? { nameTr: editing.name.tr, nameEn: editing.name.en ?? '', short: editing.short ?? '', icon: editing.icon, media: editing.media, versioned: editing.versioned } : null);
  }
  const existing = editing && editing !== 'new' ? editing : null;

  const save = async () => {
    if (!form) return;
    const body = { nameTr: form.nameTr, nameEn: form.nameEn || null, short: form.short || null, icon: form.icon, versioned: form.versioned };
    const ok = await run('save', () => (existing ? api.updateType(existing.slug, body) : api.createType({ ...body, media: form.media })), tr ? 'Kaydedildi' : 'Saved');
    if (ok) onClose();
  };

  return (
    <Dialog
      open={!!editing}
      onClose={onClose}
      title={existing ? (tr ? 'Türü düzenle' : 'Edit type') : (tr ? 'Yeni belge türü' : 'New document type')}
      footer={form && (
        <>
          {existing && (
            count > 0
              ? <span className={a.hint}>{tr ? `${count} belgede kullanılıyor; silinemez.` : `Used by ${count} files; can’t be deleted.`}</span>
              : (
                <ConfirmButton
                  label={tr ? 'Türü sil' : 'Delete type'}
                  confirm={tr ? 'Silmeyi onayla' : 'Confirm delete'}
                  busy={busy === 'delete'}
                  onConfirm={async () => { if (await run('delete', () => api.deleteType(existing.slug), tr ? 'Tür silindi' : 'Type deleted')) onClose(); }}
                />
              )
          )}
          <span style={{ flex: 1 }} />
          <button className={a.secondary} onClick={onClose}>{tr ? 'Vazgeç' : 'Cancel'}</button>
          <button className={a.primary} onClick={save} disabled={!!busy || !form.nameTr.trim()}>{busy === 'save' ? <Spinner size={14} /> : existing ? (tr ? 'Kaydet' : 'Save') : (tr ? 'Ekle' : 'Add')}</button>
        </>
      )}
    >
      {form && (
        <div className={a.form}>
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
          <div className={a.fieldRow}>
            <label className={a.field}>
              <span>{tr ? 'Kısaltma' : 'Short label'}</span>
              <input value={form.short} maxLength={8} onChange={(e) => setForm({ ...form, short: e.target.value })} placeholder="SPL" />
            </label>
            {!existing ? (
              <label className={a.field}>
                <span>{tr ? 'İçerik' : 'Content'}</span>
                <select value={form.media} onChange={(e) => setForm({ ...form, media: e.target.value as Form['media'], versioned: e.target.value === 'document' })}>
                  {(Object.keys(MEDIA) as (keyof typeof MEDIA)[]).map((k) => <option key={k} value={k}>{tr ? MEDIA[k].tr : MEDIA[k].en}</option>)}
                </select>
              </label>
            ) : <span className={a.field} />}
          </div>
          <div className={a.field}>
            <span>{tr ? 'İkon' : 'Icon'}</span>
            <div className={a.iconGrid}>
              {ICONS.map((ic) => (
                <button key={ic} type="button" className={a.iconChoice} aria-pressed={form.icon === ic} onClick={() => setForm({ ...form, icon: ic })} aria-label={ic}>
                  <Icon name={ic} size={18} />
                </button>
              ))}
            </div>
          </div>
          {form.media === 'document' && (
            <label className={a.toggle}>
              <input type="checkbox" checked={form.versioned} onChange={(e) => setForm({ ...form, versioned: e.target.checked })} />
              <span>{tr ? 'Sürüm takibi: yeni dosya yeni sürüm olarak yayınlanır, geçmiş görünür.' : 'Versioned: a new file is published as a new version with history.'}</span>
            </label>
          )}
          {error && <p className={a.error} role="alert">{error}</p>}
        </div>
      )}
    </Dialog>
  );
}
