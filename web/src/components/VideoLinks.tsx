// Belge kartlarındaki video bağlantıları ("Bakım videosunu izle"). Kaynak YouTube ise YouTube
// ikonu ve gizlilik modunda (youtube-nocookie) gömülü oynatıcı; makineye yüklenmiş bir video
// ise video ikonu ve sitenin kendi oynatıcısı. Editörler karttan bağlantı ekler/kaldırır.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Icon } from './Icon';
import { useI18n } from '../lib/i18n';
import type { Doc, MachineLink } from '../lib/api';
import s from './VideoLinks.module.css';

/** YouTube video kimliği (watch, youtu.be, shorts, embed, live adresleri); değilse null. */
export function youTubeId(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^(www|m|music)\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (host !== 'youtube.com' && host !== 'youtube-nocookie.com') return null;
    if (u.pathname === '/watch') return u.searchParams.get('v');
    const m = /^\/(?:shorts|embed|live)\/([\w-]{6,})/.exec(u.pathname);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}
const isVideoFile = (url: string | null) => !!url && /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url);

export function VideoLinkRow({ link, doc, onRemove }: { link: MachineLink; doc?: Doc; onRemove?: () => void }) {
  const { lang } = useI18n();
  const [open, setOpen] = useState(false);
  const yt = youTubeId(link.url);
  const playable = !!yt || !!doc || isVideoFile(link.url);
  const play = () => {
    if (playable) setOpen(true);
    else if (link.url) window.open(link.url, '_blank', 'noopener,noreferrer');
  };
  return (
    <div className={s.row}>
      <button className={s.link} data-source={yt ? 'youtube' : 'video'} onClick={play} title={yt ? 'YouTube' : undefined}>
        <Icon name={yt ? 'youtube' : 'video'} size={yt ? 20 : 18} strokeWidth={1.6} className={s.logo} />
        <span className={s.title}>{link.title}</span>
        <Icon name="chevronRight" size={14} strokeWidth={1.8} className={s.chev} />
      </button>
      {onRemove && (
        <button className={s.remove} onClick={onRemove} aria-label={lang === 'tr' ? 'Bağlantıyı kaldır' : 'Remove link'} title={lang === 'tr' ? 'Kaldır' : 'Remove'}>
          <Icon name="close" size={14} strokeWidth={1.7} />
        </button>
      )}
      <AnimatePresence>{open && <VideoPlayer link={link} doc={doc} youtube={yt} onClose={() => setOpen(false)} />}</AnimatePresence>
    </div>
  );
}

function VideoPlayer({ link, doc, youtube, onClose }: { link: MachineLink; doc?: Doc; youtube: string | null; onClose: () => void }) {
  const { lang } = useI18n();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.documentElement.style.overflow = overflow; };
  }, [onClose]);
  const file = doc?.current?.file;
  return createPortal(
    <motion.div className={s.overlay} role="dialog" aria-modal="true" aria-label={link.title} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} onClick={onClose}>
      <motion.div
        className={s.frame}
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 6, transition: { duration: 0.16 } }}
        transition={{ type: 'spring', bounce: 0.18, duration: 0.5 }}
        onClick={(e) => e.stopPropagation()}
      >
        {youtube ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtube)}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
            title={link.title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <video src={file?.raw ?? link.url ?? undefined} poster={file?.preview ?? undefined} controls autoPlay playsInline />
        )}
      </motion.div>
      <button className={s.close} onClick={onClose} aria-label={lang === 'tr' ? 'Kapat' : 'Close'}><Icon name="close" size={20} strokeWidth={1.7} /></button>
    </motion.div>,
    document.body,
  );
}

export type NewVideoLink = { title: string; url: string } | { title: string; file: File };

/** Editör: karta video bağlantısı ekleme (adres ya da dosya). */
export function VideoLinkEditor({ onClose, onSave }: { onClose: () => void; onSave: (value: NewVideoLink) => Promise<void> }) {
  const { lang } = useI18n();
  const tr = lang === 'tr';
  const [title, setTitle] = useState(tr ? 'Bakım videosunu izle' : 'Watch maintenance video');
  const [source, setSource] = useState<'url' | 'file'>('url');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const urlRef = useRef<HTMLInputElement>(null);
  useEffect(() => { urlRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (source === 'url' && !/^https?:\/\/\S+$/i.test(url.trim())) { setError(tr ? 'http(s) ile başlayan bir adres girin.' : 'Enter an address starting with http(s).'); return; }
    if (source === 'file' && !file) { setError(tr ? 'Bir video dosyası seçin.' : 'Choose a video file.'); return; }
    setBusy(true);
    try {
      await onSave(source === 'url' ? { title: title.trim(), url: url.trim() } : { title: title.trim(), file: file! });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  return createPortal(
    <motion.div className={s.overlay} data-light initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !busy && onClose()}>
      <motion.form
        className={s.sheet}
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ type: 'spring', bounce: 0.18, duration: 0.45 }}
      >
        <h2 className={s.sheetTitle}>{tr ? 'Video ekle' : 'Add video'}</h2>
        <label className={s.field}>
          <span>{tr ? 'Başlık' : 'Title'}</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
        </label>
        <div className={s.switch} role="radiogroup" aria-label={tr ? 'Kaynak' : 'Source'}>
          <button type="button" role="radio" aria-checked={source === 'url'} data-on={source === 'url' || undefined} onClick={() => setSource('url')}><Icon name="youtube" size={16} strokeWidth={1.6} />{tr ? 'Bağlantı' : 'Link'}</button>
          <button type="button" role="radio" aria-checked={source === 'file'} data-on={source === 'file' || undefined} onClick={() => setSource('file')}><Icon name="upload" size={16} strokeWidth={1.6} />{tr ? 'Dosya yükle' : 'Upload file'}</button>
        </div>
        {source === 'url' ? (
          <label className={s.field}>
            <span>{tr ? 'Video adresi' : 'Video address'}</span>
            <input ref={urlRef} type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
          </label>
        ) : (
          <label className={s.drop} data-has={!!file || undefined}>
            <Icon name="video" size={22} strokeWidth={1.5} />
            <span>{file ? file.name : (tr ? 'Video dosyası seçin (MP4, MOV, WebM)' : 'Choose a video file (MP4, MOV, WebM)')}</span>
            <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        )}
        {error && <p className={s.error} role="alert">{error}</p>}
        <div className={s.actions}>
          <button type="button" className={s.ghost} onClick={onClose} disabled={busy}>{tr ? 'Vazgeç' : 'Cancel'}</button>
          <button type="submit" className={s.primary} disabled={busy}>{busy ? (source === 'file' ? (tr ? 'Yükleniyor…' : 'Uploading…') : (tr ? 'Kaydediliyor…' : 'Saving…')) : (tr ? 'Ekle' : 'Add')}</button>
        </div>
      </motion.form>
    </motion.div>,
    document.body,
  );
}
