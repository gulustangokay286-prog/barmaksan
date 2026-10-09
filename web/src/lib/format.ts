import type { DocLanguage, Lang } from './api';

const locale = (lang: Lang) => (lang === 'tr' ? 'tr-TR' : 'en-GB');

export function formatSize(bytes: number, lang: Lang) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = bytes;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u += 1;
  }
  const digits = u === 0 || v >= 100 ? 0 : 1;
  return `${v.toLocaleString(locale(lang), { maximumFractionDigits: digits, minimumFractionDigits: 0 })} ${units[u]}`;
}

export function formatDate(iso: string, lang: Lang, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return new Intl.DateTimeFormat(locale(lang), opts).format(new Date(iso));
}

export function formatDateTime(iso: string, lang: Lang) {
  return new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

const DIVISIONS: [number, Intl.RelativeTimeFormatUnit][] = [
  [60, 'second'],
  [60, 'minute'],
  [24, 'hour'],
  [7, 'day'],
  [4.34524, 'week'],
  [12, 'month'],
  [Number.POSITIVE_INFINITY, 'year'],
];

export function formatRelative(iso: string, lang: Lang) {
  let duration = (new Date(iso).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale(lang), { numeric: 'auto' });
  for (const [amount, unit] of DIVISIONS) {
    if (Math.abs(duration) < amount) return rtf.format(Math.round(duration), unit);
    duration /= amount;
  }
  return formatDate(iso, lang);
}

/** "Çöp Sasörü Cleanmax 4 — Teknik Fiş" → "Teknik Fiş": belge, bulunduğu yerin adıyla başlıyorsa o kısım atılır. */
export function shortTitle(title: string, folder: string) {
  const parts = title.split(/\s+[—–-]\s+/);
  if (folder && parts.length > 1 && parts[0].trim().toLocaleLowerCase('tr') === folder.trim().toLocaleLowerCase('tr')) return parts.slice(1).join(' — ');
  return title;
}

export function formatNumber(n: number, lang: Lang) {
  return n.toLocaleString(locale(lang));
}

export function formatDuration(ms: number) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function languageLabel(l: DocLanguage) {
  switch (l) {
    case 'tr':
      return 'TR';
    case 'en':
      return 'EN';
    case 'tr-en':
      return 'TR / EN';
    case 'multi':
      return 'TR / EN / +';
    default:
      return l === 'none' ? null : l.toUpperCase();
  }
}

export function matchesLanguage(documentLanguage: string, locale: string) {
  return documentLanguage === locale || documentLanguage === 'none' || documentLanguage === 'multi' || (documentLanguage === 'tr-en' && ['tr', 'en'].includes(locale));
}

export function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
