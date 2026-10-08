import crypto from 'node:crypto';

// Türkçe katlama: her karakter tek karaktere eşlenir, böylece katlanmış metindeki
// bir konum orijinal metinde de aynı konumdur (arama özetleri için gerekli).
const FOLD = {
  ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u',
  Ç: 'c', Ğ: 'g', I: 'i', İ: 'i', Ö: 'o', Ş: 's', Ü: 'u', Â: 'a', Î: 'i', Û: 'u',
};

function foldChar(ch) {
  const mapped = FOLD[ch];
  if (mapped) return mapped;
  const lower = ch.toLowerCase();
  if (lower.length !== 1) return ch;
  const base = lower.normalize('NFD')[0];
  return base ?? lower;
}

export function trFold(input) {
  if (!input) return '';
  let out = '';
  for (const ch of String(input)) out += ch.length === 1 ? foldChar(ch) : ch;
  return out;
}

export function terms(query) {
  return trFold(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, 8);
}

export function slugify(input) {
  return trFold(input)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'klasor';
}

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
export function newPublicId(length = 8) {
  const bytes = crypto.randomBytes(length);
  let id = '';
  for (let i = 0; i < length; i += 1) id += ALPHABET[bytes[i] % ALPHABET.length];
  return id;
}

// Orijinal metinden, eşleşen terimlerin çevresinden kısa bir alıntı çıkarır.
export function excerpt(text, queryTerms, radius = 90) {
  if (!text || queryTerms.length === 0) return null;
  const folded = trFold(text);
  let first = -1;
  for (const t of queryTerms) {
    const at = folded.indexOf(t);
    if (at !== -1 && (first === -1 || at < first)) first = at;
  }
  if (first === -1) return null;
  const start = Math.max(0, first - radius);
  const end = Math.min(text.length, first + radius * 1.6);
  const slice = text.slice(start, end).replace(/\s+/g, ' ');
  const foldedSlice = trFold(slice);
  const highlights = [];
  for (const t of queryTerms) {
    let from = 0;
    while (from < foldedSlice.length) {
      const at = foldedSlice.indexOf(t, from);
      if (at === -1) break;
      highlights.push([at, at + t.length]);
      from = at + t.length;
    }
  }
  highlights.sort((a, b) => a[0] - b[0]);
  return { text: (start > 0 ? '…' : '') + slice + (end < text.length ? '…' : ''), offset: start > 0 ? 1 : 0, highlights };
}

export function safeFileName(name) {
  return String(name)
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150) || 'dosya';
}
