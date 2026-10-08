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
} satisfies Record<string, Record<Lang, string>>;

export type StringKey = keyof typeof strings;

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: StringKey) => string; pick: (n: Name | { tr: string | null; en: string | null } | null | undefined) => string };
const I18n = createContext<Ctx | null>(null);

const STORE = 'bk.lang';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const saved = localStorage.getItem(STORE);
      if (saved === 'tr' || saved === 'en') return saved;
    } catch {
      /* yoksay */
    }
    return navigator.language?.toLowerCase().startsWith('tr') ? 'tr' : navigator.language ? 'en' : 'tr';
  });
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORE, l);
    } catch {
      /* yoksay */
    }
  }, []);
  const value = useMemo<Ctx>(() => ({
    lang,
    setLang,
    t: (k) => strings[k][lang],
    pick: (n) => (n ? (lang === 'en' ? n.en || n.tr : n.tr || n.en) ?? '' : ''),
  }), [lang, setLang]);
  return <I18n.Provider value={value}>{children}</I18n.Provider>;
}

export function useI18n() {
  const c = useContext(I18n);
  if (!c) throw new Error('I18nProvider eksik');
  return c;
}
