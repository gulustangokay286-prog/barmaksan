import { useBootstrap } from '../lib/ui';
import { useI18n } from '../lib/i18n';

export function LanguageOptions() {
  const { data } = useBootstrap();
  const { lang } = useI18n();
  const languages = data?.languages ?? [{ code: 'tr', label: 'Türkçe' }, { code: 'en', label: 'English' }];
  return <>
    {languages.map((l) => <option key={l.code} value={l.code}>{l.label} · {l.code.toUpperCase()}</option>)}
    <option value="tr-en">Türkçe / English</option>
    <option value="multi">{lang === 'tr' ? 'Birden çok dil' : 'Multiple languages'}</option>
    <option value="none">{lang === 'tr' ? 'Dil bağımsız' : 'Language independent'}</option>
  </>;
}
