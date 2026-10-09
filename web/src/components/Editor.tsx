import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useGo } from '../lib/link';
import { AnimatePresence, motion, useAnimate } from 'motion/react';
import { useQueryClient } from '@tanstack/react-query';
import { Icon } from './Icon';
import { Button, Spinner } from './ui';
import { LanguageOptions } from './LanguageOptions';
import { api, editorKey, type DocLanguage } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useBootstrap, useUi, type UploadTarget } from '../lib/ui';
import { formatSize } from '../lib/format';
import { spring } from '../lib/motion';
import s from './Editor.module.css';

function Dialog({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <div className={s.root}>
          <motion.div className={s.scrim} onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
          <motion.div
            className={s.dialog}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.99, transition: { duration: 0.14 } }}
            transition={spring.base}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ── Anahtar ─────────────────────────────────────────────────────────────────

export function EditorKeySheet() {
  const { editorSheet, setEditorSheet, setEditor, notify } = useUi();
  const { t } = useI18n();
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scope, animate] = useAnimate();
  const close = () => {
    setEditorSheet(false);
    setKey('');
    setError(null);
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!key) return;
    setBusy(true);
    const status = await api.verifyEditor(key).catch(() => 0);
    setBusy(false);
    if (status === 204) {
      editorKey.set(key);
      setEditor(true);
      close();
      notify(t('editOn'));
    } else {
      setError(status === 429 ? 'Çok fazla deneme' : t('wrongKey'));
      // Yanlış anahtar: yumuşak bir sallanma, kritik sönümlü.
      animate(scope.current, { x: [0, -8, 7, -5, 3, 0] }, { duration: 0.42 });
    }
  };
  return (
    <Dialog open={editorSheet} onClose={close} label={t('editMode')}>
      <form ref={scope} onSubmit={submit} className={s.form}>
        <div className={s.head}>
          <span className={s.headIcon}><Icon name="lock" size={20} /></span>
          <h2 className="t-title2">{t('editMode')}</h2>
          <p className="t-callout ink-2">{t('editKeyHint')}</p>
        </div>
        <label className={s.field}>
          <span>{t('editKey')}</span>
          <input type="password" autoFocus autoComplete="current-password" value={key} onChange={(e) => { setKey(e.target.value); setError(null); }} />
        </label>
        <AnimatePresence>{error && <motion.p className={s.error} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>{error}</motion.p>}</AnimatePresence>
        <div className={s.buttons}>
          <Button type="button" variant="ghost" onClick={close}>{t('cancel')}</Button>
          <Button type="submit" variant="primary" disabled={!key || busy}>{busy ? <Spinner /> : t('unlock')}</Button>
        </div>
      </form>
    </Dialog>
  );
}

// ── Yükleme ─────────────────────────────────────────────────────────────────

function upload(url: string, form: FormData, onProgress: (p: number) => void) {
  return new Promise<{ publicId: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    const key = editorKey.get();
    if (key) xhr.setRequestHeader('X-Editor-Key', key);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      let body: { publicId?: string; error?: string } = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* boş */
      }
      if (xhr.status >= 200 && xhr.status < 300 && body.publicId) resolve({ publicId: body.publicId });
      else reject(new Error(body.error ?? `Hata ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('Bağlantı hatası'));
    xhr.send(form);
  });
}

export function UploadSheet() {
  const { upload: target, setUpload } = useUi();
  const { t } = useI18n();
  return (
    <Dialog open={!!target} onClose={() => setUpload(null)} label={t('upload')}>
      {target && <UploadForm key={target.mode === 'version' ? target.docId : `${target.folder}-${target.type}`} target={target} onDone={() => setUpload(null)} />}
    </Dialog>
  );
}

function UploadForm({ target, onDone }: { target: UploadTarget; onDone: () => void }) {
  const { t, pick, locale } = useI18n();
  const { notify } = useUi();
  const { data: boot } = useBootstrap();
  const qc = useQueryClient();
  const navigate = useGo();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const folders = useMemo(() => (boot?.tree ?? []).filter((n) => n.kind === 'machine' || n.kind === 'collection'), [boot]);
  const [folder, setFolder] = useState(target.mode === 'new' && folders.some((f) => f.slug === target.folder) ? target.folder : '');
  const [type, setType] = useState(target.mode === 'new' ? target.type ?? '' : '');
  const [titleTr, setTitleTr] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [language, setLanguage] = useState<DocLanguage>(locale);
  const [note, setNote] = useState('');

  // Klasör + tür seçilince başlığı öner.
  useEffect(() => {
    if (target.mode !== 'new' || titleTr) return;
    const f = folders.find((x) => x.slug === folder);
    const ty = boot?.docTypes.find((x) => x.slug === type);
    if (f?.kind === 'machine' && ty) setTitleTr(`${f.name.tr} — ${ty.name.tr}`);
  }, [folder, type, folders, boot, target.mode, titleTr]);

  const pickFile = (f: File | undefined | null) => {
    if (!f) return;
    setFile(f);
    setError(null);
    if (target.mode === 'new' && !titleTr) setTitleTr(f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '));
    if (target.mode === 'new' && !type) {
      if (f.type.startsWith('image/')) setType('fotograf');
      else if (f.type.startsWith('video/')) setType('video');
    }
  };

  const ready = !!file && (target.mode === 'version' || (folder && type && titleTr.trim()));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready || !file) return;
    // Yazar: giriş yapan kullanıcı (sunucu oturumdan alır).
    const form = new FormData();
    form.append('note', note);
    if (target.mode === 'new') {
      form.append('folder', folder);
      form.append('type', type);
      form.append('titleTr', titleTr);
      form.append('titleEn', titleEn);
      form.append('language', language);
    }
    form.append('file', file);
    setProgress(0);
    setError(null);
    try {
      const res = await upload(target.mode === 'new' ? '/api/documents' : `/api/documents/${target.docId}/versions`, form, setProgress);
      await qc.invalidateQueries();
      notify(t('published'));
      onDone();
      // Yönetim panelinde kalınır; sitede yeni belgenin sayfası açılır.
      if (!window.location.pathname.startsWith('/admin')) navigate(`/dokuman/${res.publicId}`);
    } catch (err) {
      setProgress(null);
      setError((err as Error).message);
    }
  };

  return (
    <form className={s.form} onSubmit={submit}>
      <div className={s.head}>
        <h2 className="t-title2">{target.mode === 'new' ? t('newDocument') : t('newVersion')}</h2>
        {target.mode === 'version' && <p className="t-callout ink-2">{target.title}</p>}
      </div>

      <button
        type="button"
        className={s.drop}
        data-drag={drag || undefined}
        data-has={!!file || undefined}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); pickFile(e.dataTransfer.files[0]); }}
      >
        <Icon name={file ? 'check' : 'upload'} size={22} />
        <span className={s.dropTitle}>{file ? file.name : t('dropFile')}</span>
        <span className={s.dropHint}>{file ? formatSize(file.size, 'tr') : t('originalKept')}</span>
        <input ref={inputRef} type="file" hidden onChange={(e) => pickFile(e.target.files?.[0])} />
      </button>

      {target.mode === 'new' && (
        <div className={s.grid}>
          <label className={s.field}>
            <span>{t('folders')}</span>
            <select value={folder} onChange={(e) => setFolder(e.target.value)} required>
              <option value="" disabled>—</option>
              {folders.map((f) => <option key={f.slug} value={f.slug}>{pick(f.name)}</option>)}
            </select>
          </label>
          <label className={s.field}>
            <span>{t('type')}</span>
            <select value={type} onChange={(e) => setType(e.target.value)} required>
              <option value="" disabled>—</option>
              {boot?.docTypes.map((d) => <option key={d.slug} value={d.slug}>{pick(d.name)}</option>)}
            </select>
          </label>
          <label className={`${s.field} ${s.span2}`}>
            <span>{t('titleTr')}</span>
            <input value={titleTr} onChange={(e) => setTitleTr(e.target.value)} required />
          </label>
          <label className={`${s.field} ${s.span2}`}>
            <span>{t('titleEn')}</span>
            <input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
          </label>
          <div className={`${s.field} ${s.span2}`}>
            <span>{t('language')}</span>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} aria-label={t('language')}><LanguageOptions /></select>
          </div>
        </div>
      )}

      <div className={s.grid}>
        <label className={`${s.field} ${s.span2}`}>
          <span>{t('changeNote')}</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={target.mode === 'new' ? 'İlk sürüm' : 'Örn. motor gücü güncellendi'} />
        </label>
      </div>

      {error && <p className={s.error}>{error}</p>}
      {progress != null && (
        <div className={s.progress} aria-label={t('uploading')}>
          <motion.span className={s.progressBar} animate={{ scaleX: progress }} transition={spring.snappy} />
        </div>
      )}

      <div className={s.buttons}>
        <Button type="button" variant="ghost" onClick={onDone}>{t('cancel')}</Button>
        <Button type="submit" variant="primary" disabled={!ready || progress != null}>{progress != null ? <Spinner /> : t('publish')}</Button>
      </div>
    </form>
  );
}
