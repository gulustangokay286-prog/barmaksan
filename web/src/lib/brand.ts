// Kurumsal kimlik verisi. Renkler ugurpromilling.com'un stil dosyasından (style.css?v4) ve
// "Türkiye Projelerimiz" banner görselinden ölçüldü. Kullanım sıklığı stil dosyasındaki
// geçiş sayısıdır; görsel paletinde ise kapladığı alan yüzdesi.
import type { Lang } from './api';

export type Swatch = {
  hex: string;
  name: { tr: string; en: string };
  role: { tr: string; en: string };
  /** Stil dosyasında kaç kez geçtiği ya da görselde kapladığı alan (%). */
  weight: number;
  /** Üstündeki yazı için: açık renk mi (koyu metin ister) */
  light?: boolean;
};

export const SITE_PALETTE: Swatch[] = [
  { hex: '#D9B625', name: { tr: 'Altın', en: 'Gold' }, role: { tr: 'Birincil vurgu · düğme, çizgi, aktif durum', en: 'Primary accent · buttons, rules, active state' }, weight: 87 },
  { hex: '#222222', name: { tr: 'Kömür', en: 'Charcoal' }, role: { tr: 'Başlık ve gövde metni', en: 'Headings and body text' }, weight: 25 },
  { hex: '#000000', name: { tr: 'Siyah', en: 'Black' }, role: { tr: 'Koyu zemin, alt bilgi', en: 'Dark ground, footer' }, weight: 23 },
  { hex: '#FFFFFF', name: { tr: 'Beyaz', en: 'White' }, role: { tr: 'Ana zemin', en: 'Main ground' }, weight: 82, light: true },
  { hex: '#F9F9F9', name: { tr: 'Kağıt', en: 'Paper' }, role: { tr: 'İkincil zemin, bölüm ayrımı', en: 'Secondary ground, section break' }, weight: 11, light: true },
  { hex: '#EFEFEF', name: { tr: 'Gümüş', en: 'Silver' }, role: { tr: 'Kenarlık, ayraç', en: 'Borders, dividers' }, weight: 4, light: true },
  { hex: '#798196', name: { tr: 'Çelik', en: 'Steel' }, role: { tr: 'İkincil metin', en: 'Secondary text' }, weight: 3 },
  { hex: '#CE2F02', name: { tr: 'Kiremit', en: 'Brick' }, role: { tr: 'Uyarı ve hata', en: 'Warning and error' }, weight: 3 },
  { hex: '#002456', name: { tr: 'Lacivert', en: 'Navy' }, role: { tr: 'Harita ve proje zeminleri', en: 'Map and project grounds' }, weight: 2 },
];

export const IMAGE_PALETTE: Swatch[] = [
  { hex: '#014F6A', name: { tr: 'Derin deniz', en: 'Deep sea' }, role: { tr: 'Baskın ton', en: 'Dominant tone' }, weight: 23 },
  { hex: '#1BABB9', name: { tr: 'Turkuaz', en: 'Turquoise' }, role: { tr: 'Işık ve vurgu', en: 'Light and highlight' }, weight: 22 },
  { hex: '#087288', name: { tr: 'Petrol', en: 'Petrol' }, role: { tr: 'Orta ton', en: 'Mid tone' }, weight: 22 },
  { hex: '#002C4D', name: { tr: 'Gece', en: 'Night' }, role: { tr: 'Gölge', en: 'Shadow' }, weight: 18 },
  { hex: '#001C3F', name: { tr: 'Mürekkep', en: 'Ink' }, role: { tr: 'En koyu', en: 'Darkest' }, weight: 15 },
];

/** Görselin ortalama rengi (bütün pikseller). */
export const IMAGE_MEAN = '#085D76';

export const BRAND_IMAGE = { src: '/kurumsal/kimlik-banner.jpg', mobile: '/kurumsal/kimlik-banner-mobil.jpg', width: 1920, height: 540 };

export const LOGOS = [
  { key: 'barmaksan-light', brand: 'Barmaksan', ground: 'light', src: '/brand/barmaksan-light.png', ext: 'PNG' },
  { key: 'barmaksan-dark', brand: 'Barmaksan', ground: 'dark', src: '/brand/barmaksan-dark.png', ext: 'PNG' },
  { key: 'ugur-light', brand: 'Uğur Promilling', ground: 'light', src: '/brand/ugur.svg', ext: 'SVG' },
  { key: 'ugur-dark', brand: 'Uğur Promilling', ground: 'dark', src: '/brand/ugur-dark.svg', ext: 'SVG' },
] as const;

export const TYPE_SCALE = [
  { key: 'display', tr: 'Büyük başlık', en: 'Large title', size: 48, weight: 700, tracking: '-0.03em' },
  { key: 'title', tr: 'Başlık', en: 'Title', size: 28, weight: 680, tracking: '-0.02em' },
  { key: 'headline', tr: 'Alt başlık', en: 'Headline', size: 17, weight: 600, tracking: '-0.01em' },
  { key: 'body', tr: 'Gövde', en: 'Body', size: 15, weight: 400, tracking: '0' },
  { key: 'caption', tr: 'Açıklama', en: 'Caption', size: 12.5, weight: 500, tracking: '0.01em' },
];

export function hexToRgb(hex: string) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbString(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return `${r}, ${g}, ${b}`;
}

/** Üstüne koyu mu açık mı yazı gelsin? (WCAG göreli parlaklık) */
export function isLight(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) > 0.4;
}

export function swatchName(s: Swatch, lang: Lang) {
  return lang === 'tr' ? s.name.tr : s.name.en;
}
export function swatchRole(s: Swatch, lang: Lang) {
  return lang === 'tr' ? s.role.tr : s.role.en;
}
