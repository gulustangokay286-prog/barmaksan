import { useState } from 'react';
import { useBootstrap } from '../lib/ui';
import { useI18n } from '../lib/i18n';
import { api } from '../lib/api';
import { PageHead, Section, useRun } from './shared';
import a from './admin.module.css';

export default function Languages() {
  const { data } = useBootstrap();
  const { lang } = useI18n();
  const tr = lang === 'tr';
  const [form, setForm] = useState({ code: '', label: '', nativeName: '', direction: 'ltr' });
  const { run, busy, error } = useRun();
  return <div className={a.page}>
    <PageHead title={tr ? 'İçerik dilleri' : 'Content languages'} lead={tr ? 'Makine açıklamaları, belgeler ve bakım kılavuzları için diller. Her dilin içeriği ayrı güncellenir.' : 'Languages for machine profiles, documents and maintenance guides. Each language is updated independently.'} />
    <Section title={tr ? 'Kullanılabilir diller' : 'Available languages'}>
      <ul className={a.miniDocs}>{data?.languages.map((l) => <li key={l.code}><span>{l.label} · {l.nativeName}</span><span className={a.dim}>{l.code.toUpperCase()} · {l.direction.toUpperCase()}</span></li>)}</ul>
    </Section>
    <Section title={tr ? 'Yeni dil' : 'New language'}>
      <form className={a.form} onSubmit={async (e) => { e.preventDefault(); if (await run('language', () => api.addLanguage(form), tr ? 'Dil eklendi' : 'Language added')) setForm({ code: '', label: '', nativeName: '', direction: 'ltr' }); }}>
        <div className={a.fieldRow}>
          <label className={a.field}><span>{tr ? 'Dil kodu' : 'Language code'}</span><input required placeholder="fr" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
          <label className={a.field}><span>{tr ? 'Dil adı' : 'Language name'}</span><input required placeholder="Fransızca" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></label>
        </div>
        <div className={a.fieldRow}>
          <label className={a.field}><span>{tr ? 'Kendi dilindeki adı' : 'Native name'}</span><input placeholder="Français" value={form.nativeName} onChange={(e) => setForm({ ...form, nativeName: e.target.value })} /></label>
          <label className={a.field}><span>{tr ? 'Yazı yönü' : 'Writing direction'}</span><select value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}><option value="ltr">{tr ? 'Soldan sağa' : 'Left to right'}</option><option value="rtl">{tr ? 'Sağdan sola' : 'Right to left'}</option></select></label>
        </div>
        {error && <p className={a.error} role="alert">{error}</p>}
        <button className={a.primary} disabled={!!busy || !form.code.trim() || !form.label.trim()}>{tr ? 'Dil ekle' : 'Add language'}</button>
      </form>
    </Section>
  </div>;
}
