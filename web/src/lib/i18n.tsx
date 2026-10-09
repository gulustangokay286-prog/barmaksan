import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Lang, Name } from './api';

const strings = {
  library: { tr: 'Bilgi Kütüphanesi', en: 'Knowledge Library' },
  home: { tr: 'Kütüphane', en: 'Library' },
  recent: { tr: 'Son güncellenenler', en: 'Recently updated' },
  mediaLibrary: { tr: 'Medya kütüphanesi', en: 'Media library' },
  media: { tr: 'Medya', en: 'Media' },
  folders: { tr: 'Klasörler', en: 'Folders' },
  search: { tr: 'Ara', en: 'Search' },
  searchPlaceholder: { tr: 'Makine, doküman ya da parça kodu ara', en: 'Search machines, documents or part codes' },
  searchShort: { tr: 'Ara…', en: 'Search…' },
  heroLead: {
    tr: 'Barmaksan ve Uğur Promilling’in bütün teknik ve kurumsal dosyaları. Her zaman en güncel hâliyle.',
    en: 'Every technical and corporate file of Barmaksan and Uğur Promilling. Always the latest version.',
  },
  machines: { tr: 'Makineler', en: 'Machines' },
  machine: { tr: 'makine', en: 'machines' },
  documents: { tr: 'doküman', en: 'documents' },
  versions: { tr: 'sürüm', en: 'versions' },
  mediaItems: { tr: 'medya', en: 'media' },
  current: { tr: 'Güncel', en: 'Current' },
  version: { tr: 'Sürüm', en: 'Version' },
  history: { tr: 'Geçmiş', en: 'History' },
  versionHistory: { tr: 'Sürüm geçmişi', en: 'Version history' },
  open: { tr: 'Aç', en: 'Open' },
  download: { tr: 'İndir', en: 'Download' },
  downloadOriginal: { tr: 'Orijinali indir', en: 'Download original' },
  copyLink: { tr: 'Bağlantıyı kopyala', en: 'Copy link' },
  linkCopied: { tr: 'Bağlantı kopyalandı — her zaman güncel sürümü açar', en: 'Link copied — always opens the latest version' },
  permalinkHint: { tr: 'Bu bağlantı her zaman en güncel sürümü açar.', en: 'This link always opens the latest version.' },
  notUploaded: { tr: 'Henüz yüklenmedi', en: 'Not uploaded yet' },
  viewAll: { tr: 'Tümü', en: 'View all' },
  all: { tr: 'Tümü', en: 'All' },
  photos: { tr: 'Fotoğraflar', en: 'Photos' },
  videos: { tr: 'Videolar', en: 'Videos' },
  model: { tr: 'Model', en: 'Model' },
  oldVersion: { tr: 'Eski bir sürümü görüntülüyorsunuz', en: 'You are viewing an older version' },
  goCurrent: { tr: 'Güncel sürüme git', en: 'Go to current version' },
  details: { tr: 'Bilgiler', en: 'Details' },
  format: { tr: 'Biçim', en: 'Format' },
  size: { tr: 'Boyut', en: 'Size' },
  pages: { tr: 'Sayfa', en: 'Pages' },
  language: { tr: 'Dil', en: 'Language' },
  updated: { tr: 'Güncellendi', en: 'Updated' },
  uploadedBy: { tr: 'Yükleyen', en: 'Uploaded by' },
  location: { tr: 'Konum', en: 'Location' },
  dimensions: { tr: 'Çözünürlük', en: 'Resolution' },
  duration: { tr: 'Süre', en: 'Duration' },
  noResults: { tr: 'Sonuç yok', en: 'No results' },
  noResultsHint: { tr: 'Farklı bir kelime ya da parça kodunun bir kısmını deneyin.', en: 'Try another word or part of a code.' },
  searchHint: { tr: 'Makine adı, model, doküman türü ya da SPL parça kodu yazın.', en: 'Type a machine name, model, document type or SPL part code.' },
  navigate: { tr: 'gezin', en: 'navigate' },
  openKey: { tr: 'aç', en: 'open' },
  closeKey: { tr: 'kapat', en: 'close' },
  close: { tr: 'Kapat', en: 'Close' },
  back: { tr: 'Geri', en: 'Back' },
  notFound: { tr: 'Burada bir şey yok', en: 'Nothing here' },
  notFoundHint: { tr: 'Aradığınız sayfa taşınmış ya da hiç var olmamış olabilir.', en: 'The page may have moved or never existed.' },
  backHome: { tr: 'Kütüphaneye dön', en: 'Back to library' },
  inFolder: { tr: 'içinde', en: 'in' },
  today: { tr: 'Bugün', en: 'Today' },
  yesterday: { tr: 'Dün', en: 'Yesterday' },
  corporate: { tr: 'Kurumsal', en: 'Corporate' },
  latestChange: { tr: 'Son değişiklik', en: 'Latest change' },
  sheetLead: { tr: 'Teknik fiş', en: 'Technical sheet' },
  editing: { tr: 'Düzenleme', en: 'Editing' },
  editMode: { tr: 'Düzenleme modu', en: 'Edit mode' },
  editOn: { tr: 'Düzenleme açık', en: 'Editing on' },
  editKey: { tr: 'Düzenleme anahtarı', en: 'Editor key' },
  editKeyHint: { tr: 'Yükleme ve yeni sürüm yayınlama için anahtarı girin. Görüntüleme herkese açıktır.', en: 'Enter the key to upload and publish versions. Viewing is open to everyone.' },
  unlock: { tr: 'Aç', en: 'Unlock' },
  lock: { tr: 'Düzenlemeyi kapat', en: 'Turn off editing' },
  wrongKey: { tr: 'Anahtar doğru değil', en: 'Wrong key' },
  upload: { tr: 'Yükle', en: 'Upload' },
  newDocument: { tr: 'Yeni doküman', en: 'New document' },
  newVersion: { tr: 'Yeni sürüm yükle', en: 'Upload new version' },
  publish: { tr: 'Yayınla', en: 'Publish' },
  restore: { tr: 'Bu sürümü geri yükle', en: 'Restore this version' },
  changeNote: { tr: 'Ne değişti?', en: 'What changed?' },
  yourName: { tr: 'Adınız ya da biriminiz', en: 'Your name or team' },
  dropFile: { tr: 'Dosyayı buraya bırakın ya da seçin', en: 'Drop a file here or choose one' },
  originalKept: { tr: 'Orijinal dosya olduğu gibi saklanır; sıkıştırılmaz.', en: 'The original file is stored as is, never compressed.' },
  titleTr: { tr: 'Başlık (Türkçe)', en: 'Title (Turkish)' },
  titleEn: { tr: 'Başlık (İngilizce)', en: 'Title (English)' },
  type: { tr: 'Tür', en: 'Type' },
  cancel: { tr: 'Vazgeç', en: 'Cancel' },
  published: { tr: 'Yayınlandı', en: 'Published' },
  uploading: { tr: 'Yükleniyor', en: 'Uploading' },
  emptyFolder: { tr: 'Bu klasör henüz boş', en: 'This folder is empty' },
  delete: { tr: 'Sil', en: 'Delete' },
  deleteConfirm: { tr: 'Silmeyi onayla', en: 'Confirm delete' },
  deleted: { tr: 'Silindi', en: 'Deleted' },

  // Kurumsal kimlik
  brand: { tr: 'Kurumsal kimlik', en: 'Brand identity' },
  brandLead: {
    tr: 'Barmaksan ve Uğur Promilling’in renkleri, logoları ve yazı karakteri. Her şey tek yerden, kopyalanmaya hazır.',
    en: 'The colours, logos and typeface of Barmaksan and Uğur Promilling. Everything in one place, ready to copy.',
  },
  palette: { tr: 'Renk paleti', en: 'Colour palette' },
  paletteSite: { tr: 'Web sitesi paleti', en: 'Website palette' },
  paletteSiteLead: {
    tr: 'ugurpromilling.com üzerindeki stil dosyasından çıkarılan ortalama renkler. Altın birincil vurgu; geri kalanı nötr zemin ve metin.',
    en: 'Average colours extracted from the stylesheet of ugurpromilling.com. Gold is the primary accent; the rest are neutral grounds and text.',
  },
  paletteImage: { tr: 'Görsel paleti', en: 'Image palette' },
  paletteImageLead: {
    tr: 'Türkiye Projelerimiz bannerından ölçülen baskın tonlar. Fotoğraf ve harita zeminleri için.',
    en: 'Dominant tones measured from the Türkiye Projects banner. For photo and map backgrounds.',
  },
  logos: { tr: 'Logolar', en: 'Logos' },
  logosLead: { tr: 'Açık ve koyu zemin için. Oranı bozmayın, etrafında yüksekliğinin yarısı kadar boşluk bırakın.', en: 'For light and dark grounds. Keep the proportions; leave clear space equal to half the height.' },
  typography: { tr: 'Yazı karakteri', en: 'Typeface' },
  typographyLead: { tr: 'Web sitesinde Montserrat; bu kütüphanede sistem yazı tipi (SF Pro / Segoe UI).', en: 'Montserrat on the website; the system typeface (SF Pro / Segoe UI) in this library.' },
  copyHex: { tr: 'Kopyalamak için dokunun', en: 'Tap to copy' },
  copied: { tr: 'Kopyalandı', en: 'Copied' },
  usage: { tr: 'Kullanım', en: 'Usage' },
  brandVisual: { tr: 'Kurumsal görsel', en: 'Brand visual' },

  // Kaydedilenler
  saved: { tr: 'Kaydedilenler', en: 'Saved' },
  save: { tr: 'Kaydet', en: 'Save' },
  unsave: { tr: 'Kaydedilenlerden çıkar', en: 'Remove from saved' },
  savedLead: { tr: 'Sık açtığınız belgeleri burada toplayın. Liste yalnızca bu tarayıcıda saklanır.', en: 'Collect the documents you open often. The list is stored only in this browser.' },
  savedEmpty: { tr: 'Henüz kaydedilmiş belge yok', en: 'No saved documents yet' },
  savedEmptyHint: { tr: 'Bir belgenin sayfasında “Kaydet”e dokunun; buraya düşer.', en: 'Tap “Save” on any document page and it will appear here.' },
  clearAll: { tr: 'Hepsini kaldır', en: 'Clear all' },

  // Alt bilgi
  footerAbout: { tr: 'Barmaksan ve markası Uğur Promilling’in teknik ve kurumsal dosyaları, her zaman en güncel hâliyle.', en: 'Technical and corporate files from Barmaksan and its brand Uğur Promilling, always up to date.' },
  footerLibrary: { tr: 'Kütüphane', en: 'Library' },
  footerCompany: { tr: 'Şirket', en: 'Company' },
  website: { tr: 'Web sitesi', en: 'Website' },
  shortcuts: { tr: 'Kısayollar', en: 'Shortcuts' },
  backToTop: { tr: 'Başa dön', en: 'Back to top' },
} satisfies Record<string, Record<Lang, string>>;

export type StringKey = keyof typeof strings;

type Ctx = { lang: Lang; locale: string; setLang: (l: string) => void; t: (k: StringKey) => string; pick: (n: Name | { tr: string | null; en: string | null } | null | undefined) => string };
const I18n = createContext<Ctx | null>(null);

const STORE = 'bk.lang';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLangState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORE);
      if (saved && /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(saved)) { Intl.getCanonicalLocales(saved); return saved; }
    } catch {
      /* yoksay */
    }
    return navigator.language?.toLowerCase().startsWith('tr') ? 'tr' : navigator.language ? 'en' : 'tr';
  });
  // Navigation copy is currently available in TR/EN. Product content uses the
  // selected locale, including any additional language registered by editors.
  const lang: Lang = locale === 'tr' ? 'tr' : 'en';
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const setLang = useCallback((l: string) => {
    setLangState(l);
    try {
      localStorage.setItem(STORE, l);
    } catch {
      /* yoksay */
    }
  }, []);
  const value = useMemo<Ctx>(() => ({
    lang,
    locale,
    setLang,
    t: (k) => strings[k][lang],
    pick: (n) => (n ? (lang === 'en' ? n.en || n.tr : n.tr || n.en) ?? '' : ''),
  }), [lang, locale, setLang]);
  return <I18n.Provider value={value}>{children}</I18n.Provider>;
}

export function useI18n() {
  const c = useContext(I18n);
  if (!c) throw new Error('I18nProvider eksik');
  return c;
}
