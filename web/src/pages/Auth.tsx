// Giriş ekranı (/giris): Giriş yap · Kayıt ol · Misafir. Google ile giriş sunucuda etkinse görünür.
// /giris/tamamla: ilk Google girişinden sonra eksik profil (şirket, KVKK onayı).
import { useEffect, useMemo, useRef, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { Icon } from '../components/Icon';
import { Link } from '../lib/link';
import { useI18n } from '../lib/i18n';
import { useUi } from '../lib/ui';
import { displayName, providersQuery, useSession } from '../lib/session';
import { account as accountApi } from '../lib/api';
import a from './auth.module.css';

type Mode = 'giris' | 'kayit' | 'misafir';
const MODES: Mode[] = ['giris', 'kayit', 'misafir'];
/** Üstteki sekmeler: kayıt, giriş formunun altındaki bağlantıyla açılır. */
const TABS: Mode[] = ['giris', 'misafir'];
const EMAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i;
const COUNTRIES = ['Türkiye', 'Azerbaycan', 'Özbekistan', 'Kazakistan', 'Türkmenistan', 'Kırgızistan', 'Irak', 'İran', 'Suriye', 'Mısır', 'Cezayir', 'Fas', 'Tunus', 'Libya', 'Sudan', 'Etiyopya', 'Suudi Arabistan', 'Yemen', 'Afganistan', 'Pakistan', 'Rusya', 'Ukrayna', 'Gürcistan', 'Almanya', 'Bulgaristan', 'Romanya'];

const safeBack = (value: string | null) => (value && /^\/(?!\/)/.test(value) ? value : '/');

export default function AuthPage() {
  const [params, setParams] = useSearchParams();
  const { lang } = useI18n();
  const tr = lang === 'tr';
  const mode: Mode = MODES.includes(params.get('mod') as Mode) ? (params.get('mod') as Mode) : 'giris';
  const back = safeBack(params.get('donus'));
  const setMode = (next: Mode) => {
    const q = new URLSearchParams(params);
    if (next === 'giris') q.delete('mod'); else q.set('mod', next);
    q.delete('hata');
    setParams(q, { replace: true });
  };
  const oauthError = params.get('hata');
  useEffect(() => { document.title = `${tr ? 'Giriş' : 'Sign in'} · Barmaksan`; }, [tr]);

  return (
    <AuthFrame back={back}>
      <header className={a.head}>
        <h1 className={a.title}>
          {mode === 'giris' ? (tr ? 'Tekrar hoş geldiniz' : 'Welcome back') : mode === 'kayit' ? (tr ? 'Hesap oluşturun' : 'Create your account') : (tr ? 'Misafir olarak devam edin' : 'Continue as a guest')}
        </h1>
        <p className={a.lead}>
          {mode === 'giris' ? (tr ? 'Teknik fiş, çizim ve kılavuzlara erişmek için giriş yapın.' : 'Sign in to open sheets, drawings and manuals.')
            : mode === 'kayit' ? (tr ? 'Eski sürümler ve Kaydedilenler dahil tüm kütüphane sizin.' : 'The whole library, including older versions and Saved.')
              : (tr ? 'E-postanızı bırakın, güncel belgeleri hemen açın.' : 'Leave your e-mail and open current documents right away.')}
        </p>
      </header>
      {mode !== 'kayit' && <div className={a.tabs} role="tablist" aria-label={tr ? 'Giriş türü' : 'Sign-in type'}>
        {TABS.map((m) => (
          <button key={m} role="tab" aria-selected={m === mode} className={a.tab} data-on={m === mode || undefined} onClick={() => setMode(m)}>
            {m === 'giris' ? (tr ? 'Giriş yap' : 'Sign in') : (tr ? 'Misafir' : 'Guest')}
          </button>
        ))}
      </div>}
      {oauthError && <p className={a.alert} role="alert">{oauthError === 'google-dogrulanmamis' ? (tr ? 'Google hesabınızın e-postası doğrulanmamış.' : 'Your Google e-mail is not verified.') : (tr ? 'Google ile giriş tamamlanamadı. Tekrar deneyin.' : 'Google sign-in could not be completed. Try again.')}</p>}
      <div className={a.stage} key={mode}>
        {mode === 'giris' && <SignIn back={back} onRegister={() => setMode('kayit')} />}
        {mode === 'kayit' && <Register back={back} onSignIn={() => setMode('giris')} />}
        {mode === 'misafir' && <Guest back={back} onRegister={() => setMode('kayit')} />}
      </div>
    </AuthFrame>
  );
}

/** İki bölmeli çerçeve: solda marka ve kütüphanenin vaadi, sağda form. */
function AuthFrame({ back, children }: { back: string; children: ReactNode }) {
  const { lang } = useI18n();
  const tr = lang === 'tr';
  return (
    <div className={a.screen}>
      <aside className={a.brand}>
        <img className={a.photo} src="/hero/tesis.webp" alt="" />
        <div className={a.scrim} />
        <div className={a.brandTop}>
          <Link to="/" className={a.logos} aria-label={tr ? 'Kütüphaneye dön' : 'Back to library'}>
            <img src="/brand/barmaksan-dark.png" alt="Barmaksan" />
            <span className={a.sep} />
            <img src="/brand/ugur-dark.svg" alt="Uğur Promilling" />
          </Link>
          <p className={a.brandTitle}>{tr ? 'Bilgi Kütüphanesi' : 'Knowledge Library'}</p>
        </div>
        <div className={a.brandBottom}>
          <p className={a.claim}>{tr ? 'Her makinenin dosyası, her zaman en güncel hâliyle.' : 'Every machine’s files, always in their latest version.'}</p>
          <ul className={a.points}>
            <li><Icon name="drawing" size={18} strokeWidth={1.5} />{tr ? 'Teknik fiş ve çizimler' : 'Technical sheets and drawings'}</li>
            <li><Icon name="book" size={18} strokeWidth={1.5} />{tr ? 'Kılavuzlar, yedek parça listeleri, sertifikalar' : 'Manuals, spare-part lists, certificates'}</li>
            <li><Icon name="history" size={18} strokeWidth={1.5} />{tr ? 'Sürüm geçmişi ve bakım videoları' : 'Version history and maintenance videos'}</li>
          </ul>
          <p className={a.legal}>Barmaksan Endüstri A.Ş. · Uğur Promilling · Çorum</p>
        </div>
      </aside>
      <main className={a.panel}>
        <Link to={back} className={a.backLink}><Icon name="chevronLeft" size={16} strokeWidth={1.8} />{tr ? 'Kütüphaneye dön' : 'Back to library'}</Link>
        <div className={a.card}>{children}</div>
      </main>
    </div>
  );
}

// ── Formlar ─────────────────────────────────────────────────────────────────

function useAfterAuth(back: string) {
  const navigate = useNavigate();
  const { notify } = useUi();
  const { lang } = useI18n();
  return (me: Parameters<typeof displayName>[0]) => {
    notify(lang === 'tr' ? `Hoş geldiniz, ${displayName(me)}` : `Welcome, ${displayName(me)}`);
    navigate(back, { replace: true });
  };
}

function GoogleButton({ back }: { back: string }) {
  const { data } = useQuery(providersQuery());
  const { lang } = useI18n();
  if (!data?.google) return null;
  return (
    <>
      <a className={a.google} href={`/api/account/google?donus=${encodeURIComponent(back)}`}>
        <GoogleMark />
        <span>{lang === 'tr' ? 'Google ile devam et' : 'Continue with Google'}</span>
      </a>
      <div className={a.or}><span>{lang === 'tr' ? 'ya da' : 'or'}</span></div>
    </>
  );
}

function SignIn({ back, onRegister }: { back: string; onRegister: () => void }) {
  const { lang } = useI18n();
  const tr = lang === 'tr';
  const session = useSession();
  const done = useAfterAuth(back);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!EMAIL.test(email.trim())) { setError(tr ? 'Geçerli bir e-posta adresi girin.' : 'Enter a valid e-mail address.'); return; }
    setBusy(true);
    try { done(await session.login(email.trim(), password)); } catch (err) { setError(message(err)); } finally { setBusy(false); }
  };
  return (
    <form className={a.form} onSubmit={submit} noValidate>
      <GoogleButton back={back} />
      <Field label={tr ? 'E-posta' : 'E-mail'} type="email" inputMode="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required />
      <PasswordField label={tr ? 'Şifre' : 'Password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      {error && <p className={a.error} role="alert">{error}</p>}
      <button className={a.submit} disabled={busy}>{busy ? <Spinner /> : (tr ? 'Giriş yap' : 'Sign in')}</button>
      <p className={a.foot}>{tr ? 'Hesabınız yok mu?' : 'No account yet?'} <button type="button" className={a.linkBtn} onClick={onRegister}>{tr ? 'Hesap oluşturun' : 'Create one'}</button></p>
      <p className={a.hint}>{tr ? 'Şifrenizi unuttuysanız yöneticinizden yenilemesini isteyin.' : 'Forgot your password? Ask an administrator to reset it.'}</p>
    </form>
  );
}

function Register({ back, onSignIn }: { back: string; onSignIn: () => void }) {
  const { lang } = useI18n();
  const tr = lang === 'tr';
  const session = useSession();
  const done = useAfterAuth(back);
  const [v, setV] = useState({ firstName: '', lastName: '', email: '', company: '', jobTitle: '', phone: '', country: 'Türkiye', password: '' });
  const [kvkk, setKvkk] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((s) => ({ ...s, [k]: e.target.value }));
  const problems = passwordChecks(v.password, v.email);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError('');
    if (!v.firstName.trim() || !v.lastName.trim()) { setError(tr ? 'Adınızı ve soyadınızı girin.' : 'Enter your first and last name.'); return; }
    if (!EMAIL.test(v.email.trim())) { setError(tr ? 'Geçerli bir e-posta adresi girin.' : 'Enter a valid e-mail address.'); return; }
    if (problems.some((p) => !p.ok)) { setError(tr ? 'Şifre kurallarını sağlayın.' : 'Meet the password rules.'); return; }
    if (!kvkk) { setError(tr ? 'Devam etmek için aydınlatma metnini onaylayın.' : 'Accept the privacy notice to continue.'); return; }
    setBusy(true);
    try { done(await session.register({ ...v, email: v.email.trim(), kvkk, marketing })); } catch (err) { setError(message(err)); } finally { setBusy(false); }
  };
  return (
    <form className={a.form} onSubmit={submit} noValidate>
      <GoogleButton back={back} />
      <div className={a.row}>
        <Field label={tr ? 'Ad' : 'First name'} autoComplete="given-name" value={v.firstName} onChange={set('firstName')} invalid={touched && !v.firstName.trim()} autoFocus />
        <Field label={tr ? 'Soyad' : 'Last name'} autoComplete="family-name" value={v.lastName} onChange={set('lastName')} invalid={touched && !v.lastName.trim()} />
      </div>
      <Field label={tr ? 'İş e-postası' : 'Work e-mail'} type="email" inputMode="email" autoComplete="email" value={v.email} onChange={set('email')} invalid={touched && !EMAIL.test(v.email.trim())} />
      <div className={a.row}>
        <Field label={tr ? 'Şirket' : 'Company'} optional autoComplete="organization" value={v.company} onChange={set('company')} />
        <Field label={tr ? 'Görev' : 'Job title'} optional autoComplete="organization-title" value={v.jobTitle} onChange={set('jobTitle')} />
      </div>
      <div className={a.row}>
        <Field label={tr ? 'Telefon' : 'Phone'} optional type="tel" inputMode="tel" autoComplete="tel" placeholder="+90 5xx xxx xx xx" value={v.phone} onChange={set('phone')} />
        <Field label={tr ? 'Ülke' : 'Country'} optional autoComplete="country-name" list="auth-countries" value={v.country} onChange={set('country')} />
        <datalist id="auth-countries">{COUNTRIES.map((c) => <option key={c} value={c} />)}</datalist>
      </div>
      <PasswordField label={tr ? 'Şifre' : 'Password'} autoComplete="new-password" value={v.password} onChange={set('password')} invalid={touched && problems.some((p) => !p.ok)} />
      <PasswordRules checks={problems} show={!!v.password || touched} />
      <Consent checked={kvkk} onChange={setKvkk} />
      <label className={a.check}>
        <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
        <span className={a.box}><Icon name="check" size={13} strokeWidth={2.2} /></span>
        <span>{tr ? 'Yeni makineler ve güncellemeler hakkında e-posta almak istiyorum (isteğe bağlı).' : 'Send me e-mails about new machines and updates (optional).'}</span>
      </label>
      {error && <p className={a.error} role="alert">{error}</p>}
      <button className={a.submit} disabled={busy}>{busy ? <Spinner /> : (tr ? 'Hesabı oluştur' : 'Create account')}</button>
      <p className={a.foot}>{tr ? 'Zaten hesabınız var mı?' : 'Already have an account?'} <button type="button" className={a.linkBtn} onClick={onSignIn}>{tr ? 'Giriş yapın' : 'Sign in'}</button></p>
    </form>
  );
}

function Guest({ back, onRegister }: { back: string; onRegister: () => void }) {
  const { lang } = useI18n();
  const tr = lang === 'tr';
  const session = useSession();
  const done = useAfterAuth(back);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [kvkk, setKvkk] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!EMAIL.test(email.trim())) { setError(tr ? 'Geçerli bir e-posta adresi girin.' : 'Enter a valid e-mail address.'); return; }
    if (!kvkk) { setError(tr ? 'Devam etmek için aydınlatma metnini onaylayın.' : 'Accept the privacy notice to continue.'); return; }
    setBusy(true);
    try { done(await session.guest({ email: email.trim(), name: name.trim() || undefined, company: company.trim() || undefined, kvkk })); } catch (err) { setError(message(err)); } finally { setBusy(false); }
  };
  return (
    <form className={a.form} onSubmit={submit} noValidate>
      <Field label={tr ? 'E-posta' : 'E-mail'} type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
      <div className={a.row}>
        <Field label={tr ? 'Ad soyad' : 'Full name'} optional autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        <Field label={tr ? 'Şirket' : 'Company'} optional autoComplete="organization" value={company} onChange={(e) => setCompany(e.target.value)} />
      </div>
      <Consent checked={kvkk} onChange={setKvkk} />
      {error && <p className={a.error} role="alert">{error}</p>}
      <button className={a.submit} disabled={busy}>{busy ? <Spinner /> : (tr ? 'Belgelere geç' : 'Open documents')}</button>
      <div className={a.compare}>
        <p><Icon name="check" size={14} strokeWidth={2} />{tr ? 'Misafir: güncel belgeleri açar ve indirir.' : 'Guest: opens and downloads current documents.'}</p>
        <p><Icon name="star" size={14} strokeWidth={1.8} />{tr ? 'Üye: eski sürümler ve Kaydedilenler de açılır.' : 'Member: older versions and Saved too.'} <button type="button" className={a.linkBtn} onClick={onRegister}>{tr ? 'Hesap oluştur' : 'Create account'}</button></p>
      </div>
    </form>
  );
}

/** İlk Google girişinden sonra: ad, soyad, şirket ve KVKK onayı. */
export function CompleteProfile() {
  const [params] = useSearchParams();
  const back = safeBack(params.get('donus'));
  const { lang } = useI18n();
  const tr = lang === 'tr';
  const session = useSession();
  const navigate = useNavigate();
  const me = session.me.kind === 'account' ? session.me.account : null;
  const [v, setV] = useState({ firstName: '', lastName: '', company: '', jobTitle: '', phone: '', country: 'Türkiye' });
  const [kvkk, setKvkk] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const filled = useRef(false);
  useEffect(() => {
    if (me && !filled.current) {
      filled.current = true;
      setV((s) => ({ ...s, firstName: me.firstName ?? '', lastName: me.lastName ?? '', company: me.company ?? '', jobTitle: me.jobTitle ?? '', phone: me.phone ?? '', country: me.country ?? 'Türkiye' }));
    }
  }, [me]);
  useEffect(() => { if (!session.loading && session.me.kind !== 'account') navigate('/giris', { replace: true }); }, [session.loading, session.me.kind, navigate]);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((s) => ({ ...s, [k]: e.target.value }));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!v.firstName.trim() || !v.lastName.trim()) { setError(tr ? 'Adınızı ve soyadınızı girin.' : 'Enter your first and last name.'); return; }
    if (!kvkk) { setError(tr ? 'Devam etmek için aydınlatma metnini onaylayın.' : 'Accept the privacy notice to continue.'); return; }
    setBusy(true);
    try {
      await accountApi.profile({ ...v, kvkk });
      await session.refresh();
      navigate(back, { replace: true });
    } catch (err) { setError(message(err)); } finally { setBusy(false); }
  };
  return (
    <AuthFrame back={back}>
      <header className={a.head}>
        <h1 className={a.title}>{tr ? 'Son bir adım' : 'One last step'}</h1>
        <p className={a.lead}>{me?.email} · {tr ? 'Profilinizi tamamlayın.' : 'Complete your profile.'}</p>
      </header>
      <form className={a.form} onSubmit={submit} noValidate>
        <div className={a.row}>
          <Field label={tr ? 'Ad' : 'First name'} autoComplete="given-name" value={v.firstName} onChange={set('firstName')} />
          <Field label={tr ? 'Soyad' : 'Last name'} autoComplete="family-name" value={v.lastName} onChange={set('lastName')} />
        </div>
        <div className={a.row}>
          <Field label={tr ? 'Şirket' : 'Company'} optional autoComplete="organization" value={v.company} onChange={set('company')} />
          <Field label={tr ? 'Görev' : 'Job title'} optional autoComplete="organization-title" value={v.jobTitle} onChange={set('jobTitle')} />
        </div>
        <div className={a.row}>
          <Field label={tr ? 'Telefon' : 'Phone'} optional type="tel" inputMode="tel" autoComplete="tel" value={v.phone} onChange={set('phone')} />
          <Field label={tr ? 'Ülke' : 'Country'} optional autoComplete="country-name" list="auth-countries" value={v.country} onChange={set('country')} />
          <datalist id="auth-countries">{COUNTRIES.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
        <Consent checked={kvkk} onChange={setKvkk} />
        {error && <p className={a.error} role="alert">{error}</p>}
        <button className={a.submit} disabled={busy}>{busy ? <Spinner /> : (tr ? 'Kaydet ve devam et' : 'Save and continue')}</button>
      </form>
    </AuthFrame>
  );
}

// ── Parçalar ────────────────────────────────────────────────────────────────

function Field({ label, optional, invalid, ...input }: { label: string; optional?: boolean; invalid?: boolean } & InputHTMLAttributes<HTMLInputElement>) {
  const { lang } = useI18n();
  return (
    <label className={a.field} data-invalid={invalid || undefined}>
      <span className={a.label}>{label}{optional && <em>{lang === 'tr' ? 'isteğe bağlı' : 'optional'}</em>}</span>
      <input className={a.input} aria-invalid={invalid || undefined} {...input} />
    </label>
  );
}

function PasswordField({ label, invalid, ...input }: { label: string; invalid?: boolean } & InputHTMLAttributes<HTMLInputElement>) {
  const { lang } = useI18n();
  const tr = lang === 'tr';
  const [visible, setVisible] = useState(false);
  const [caps, setCaps] = useState(false);
  return (
    <label className={a.field} data-invalid={invalid || undefined}>
      <span className={a.label}>{label}</span>
      <span className={a.passWrap}>
        <input
          className={a.input}
          type={visible ? 'text' : 'password'}
          aria-invalid={invalid || undefined}
          onKeyUp={(e) => setCaps(e.getModifierState('CapsLock'))}
          onBlur={() => setCaps(false)}
          {...input}
        />
        <button type="button" className={a.eye} onClick={() => setVisible((x) => !x)} aria-label={visible ? (tr ? 'Şifreyi gizle' : 'Hide password') : (tr ? 'Şifreyi göster' : 'Show password')} aria-pressed={visible}>
          <Icon name="eye" size={18} strokeWidth={1.6} />
          {visible && <span className={a.slash} aria-hidden="true" />}
        </button>
      </span>
      {caps && <span className={a.caps}><Icon name="arrowUp" size={13} strokeWidth={2} />{tr ? 'Büyük harf kilidi açık' : 'Caps Lock is on'}</span>}
    </label>
  );
}

type Check = { ok: boolean; label: string };
function passwordChecks(password: string, email: string): Check[] {
  const local = email.split('@')[0].toLocaleLowerCase('tr');
  return [
    { ok: password.length >= 10, label: '10+' },
    { ok: /\p{L}/u.test(password) && /\d/.test(password), label: 'a1' },
    { ok: !(local.length >= 4 && password.toLocaleLowerCase('tr').includes(local)), label: '@' },
  ];
}

function PasswordRules({ checks, show }: { checks: Check[]; show: boolean }) {
  const { lang } = useI18n();
  const tr = lang === 'tr';
  const score = checks.filter((c) => c.ok).length;
  const labels = tr ? ['En az 10 karakter', 'Harf ve rakam', 'E-postanızı içermesin'] : ['At least 10 characters', 'Letters and digits', 'Must not contain your e-mail'];
  const strength = useMemo(() => (score === 3 ? (tr ? 'Güçlü' : 'Strong') : score === 2 ? (tr ? 'Orta' : 'Fair') : (tr ? 'Zayıf' : 'Weak')), [score, tr]);
  if (!show) return null;
  return (
    <div className={a.rules} aria-live="polite">
      <div className={a.meter} data-score={score}><i /><i /><i /><span>{strength}</span></div>
      <ul>{checks.map((c, i) => <li key={c.label} data-ok={c.ok || undefined}><Icon name={c.ok ? 'check' : 'close'} size={12} strokeWidth={2.2} />{labels[i]}</li>)}</ul>
    </div>
  );
}

function Consent({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const { lang } = useI18n();
  const tr = lang === 'tr';
  const [open, setOpen] = useState(false);
  return (
    <>
      <label className={a.check}>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className={a.box}><Icon name="check" size={13} strokeWidth={2.2} /></span>
        <span>
          {tr ? <><button type="button" className={a.linkBtn} onClick={(e) => { e.preventDefault(); setOpen(true); }}>KVKK aydınlatma metnini</button> okudum; e-posta adresimin belgelere erişimimi kaydetmek için işlenmesini kabul ediyorum.</>
            : <>I have read the <button type="button" className={a.linkBtn} onClick={(e) => { e.preventDefault(); setOpen(true); }}>privacy notice</button> and agree that my e-mail is processed to record my document access.</>}
        </span>
      </label>
      <AnimatePresence>{open && <PrivacyNotice onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
}

function PrivacyNotice({ onClose }: { onClose: () => void }) {
  const { lang } = useI18n();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <motion.div className={a.noticeScrim} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className={a.notice} role="dialog" aria-modal="true" initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 8, opacity: 0 }} transition={{ type: 'spring', bounce: 0.15, duration: 0.45 }} onClick={(e) => e.stopPropagation()}>
        <h2>{lang === 'tr' ? 'Kişisel Verilerin İşlenmesine İlişkin Aydınlatma Metni' : 'Privacy notice'}</h2>
        <div className={a.noticeBody}>
          <p><strong>Veri sorumlusu:</strong> Barmaksan Endüstri A.Ş. (Çorum).</p>
          <p><strong>İşlenen veriler:</strong> ad, soyad, e-posta, şirket, görev, telefon, ülke; giriş zamanı ve belge erişim kayıtları. IP adresi açık olarak saklanmaz.</p>
          <p><strong>Amaç ve hukuki sebep:</strong> teknik belgelere erişimin sağlanması ve kaydı, hesabın güvenliği, satış sonrası destek (KVKK m.5/2-c, m.5/2-f). Pazarlama e-postaları yalnızca ayrıca onay verirseniz gönderilir (m.5/1).</p>
          <p><strong>Aktarım:</strong> veriler yurt içindeki sunucularımızda tutulur; yasal zorunluluk dışında üçüncü kişilere aktarılmaz. Google ile girişte Google’dan yalnızca ad, e-posta ve doğrulama bilgisi alınır.</p>
          <p><strong>Saklama süresi:</strong> hesap silinene kadar; misafir kayıtları son ziyaretten itibaren 2 yıl.</p>
          <p><strong>Haklarınız (KVKK m.11):</strong> verilerinize erişme, düzeltilmesini, silinmesini isteme ve itiraz etme. Başvuru: info@ugurpromilling.com.</p>
          <p className={a.noticeDraft}>Bu metin taslaktır; yayından önce şirketin hukuk birimince gözden geçirilmelidir.</p>
        </div>
        <button className={a.submit} onClick={onClose}>{lang === 'tr' ? 'Anladım' : 'Got it'}</button>
      </motion.div>
    </motion.div>
  );
}

const Spinner = () => <span className={a.spinner} aria-hidden="true" />;
const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
