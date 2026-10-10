// Kapı: giriş gerektiren bir şeye (belge, eski sürüm, Kaydedilenler) dokunulunca açılan pencere.
// Belgeler için en kısa yol yerinde: e-postayı yaz, onayla, belge açılsın. Ayrıca sitedeki bütün
// belge bağlantılarını tek noktadan korur: anonim ziyaretçi /d/… ya da /files/…/raw/… bağlantısına
// tıklayınca sunucuya sorulur (HEAD); kapalıysa pencere açılır, açıksa indirme olduğu gibi sürer.
import { useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { Icon } from './Icon';
import { useI18n } from '../lib/i18n';
import { useUi } from '../lib/ui';
import { gate, signInHref, useGate, useSession, type GateState } from '../lib/session';
import s from './AuthGate.module.css';

const GATED = /^\/(d\/[^/?#]+|files\/\d+\/(raw|page|preview))/;

export function AuthGate() {
  const state = useGate();
  const session = useSession();
  useGuardLinks(session.isViewer);
  // Durum özellik olarak verilir: kapanış animasyonunda (durum artık null iken) son değer kalır.
  return createPortal(<AnimatePresence>{state && <GateSheet key="gate" state={state} />}</AnimatePresence>, document.body);
}

function GateSheet({ state }: { state: NonNullable<GateState> }) {
  const { lang } = useI18n();
  const tr = lang === 'tr';
  const session = useSession();
  const navigate = useNavigate();
  const { notify } = useUi();
  const [email, setEmail] = useState('');
  const [kvkk, setKvkk] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const memberOnly = state.reason !== 'document';
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') gate.close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const go = (mode: 'giris' | 'kayit') => { gate.close(); navigate(signInHref(mode, state.back)); };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) { setError(tr ? 'Geçerli bir e-posta adresi girin.' : 'Enter a valid e-mail address.'); return; }
    if (!kvkk) { setError(tr ? 'Aydınlatma metnini onaylayın.' : 'Accept the privacy notice.'); return; }
    setBusy(true);
    try {
      await session.guest({ email: email.trim(), kvkk });
      gate.close();
      notify(tr ? 'Belgeler açıldı' : 'Documents unlocked');
      if (state.href) window.location.assign(state.href);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <motion.div className={s.scrim} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={() => gate.close()}>
      <motion.div
        className={s.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gate-title"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, transition: { duration: 0.16 } }}
        transition={{ type: 'spring', bounce: 0.18, duration: 0.5 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className={s.close} onClick={() => gate.close()} aria-label={tr ? 'Kapat' : 'Close'}><Icon name="close" size={18} strokeWidth={1.7} /></button>
        <span className={s.badge}><Icon name={memberOnly ? 'star' : 'lock'} size={22} strokeWidth={1.5} /></span>
        <h2 id="gate-title" className={s.title}>
          {state.reason === 'saved' ? (tr ? 'Kaydedilenler üyelere özel' : 'Saved is for members')
            : state.reason === 'member' ? (tr ? 'Eski sürümler üyelere açık' : 'Older versions are for members')
              : (tr ? 'Belgeyi açmak için' : 'To open this document')}
        </h2>
        <p className={s.lead}>
          {memberOnly
            ? (tr ? 'Ücretsiz bir hesapla belgeleri kaydedin, sürüm geçmişine ulaşın; her cihazda aynı liste.' : 'With a free account, save documents and reach version history on every device.')
            : (tr ? 'E-postanızı bırakıp hemen devam edin ya da giriş yapın.' : 'Leave your e-mail to continue right away, or sign in.')}
        </p>
        {!memberOnly && !session.isViewer && (
          <form className={s.quick} onSubmit={submit} noValidate>
            <div className={s.inputRow}>
              <input className={s.input} type="email" inputMode="email" autoComplete="email" placeholder={tr ? 'E-posta adresiniz' : 'Your e-mail'} value={email} onChange={(e) => setEmail(e.target.value)} autoFocus aria-label={tr ? 'E-posta' : 'E-mail'} />
              <button className={s.primary} disabled={busy}>{busy ? '…' : (tr ? 'Devam' : 'Continue')}</button>
            </div>
            <label className={s.check}>
              <input type="checkbox" checked={kvkk} onChange={(e) => setKvkk(e.target.checked)} />
              <span className={s.box}><Icon name="check" size={12} strokeWidth={2.2} /></span>
              <span>{tr ? 'KVKK aydınlatma metnini okudum, e-postamın belge erişimimi kaydetmek için işlenmesini kabul ediyorum.' : 'I accept the privacy notice and the processing of my e-mail to record document access.'}</span>
            </label>
            {error && <p className={s.error} role="alert">{error}</p>}
          </form>
        )}
        <div className={s.actions}>
          <button className={memberOnly ? s.primaryWide : s.secondary} onClick={() => go('kayit')}>{tr ? 'Hesap oluştur' : 'Create account'}</button>
          <button className={s.secondary} onClick={() => go('giris')}>{tr ? 'Giriş yap' : 'Sign in'}</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** Anonim ziyaretçi için belge bağlantılarını korur (indirme dahil). */
function useGuardLinks(isViewer: boolean) {
  useEffect(() => {
    if (isViewer) return;
    const onClick = async (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || !GATED.test(url.pathname)) return;
      e.preventDefault();
      const href = url.pathname + url.search;
      const res = await fetch(href, { method: 'HEAD', headers: { Accept: 'application/json' }, credentials: 'same-origin' }).catch(() => null);
      if (res?.status === 401) {
        gate.open(href.includes('/v/') ? 'member' : 'document', { href });
        return;
      }
      if (anchor.target === '_blank') window.open(href, '_blank', 'noopener');
      else window.location.assign(href);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [isViewer]);
}
