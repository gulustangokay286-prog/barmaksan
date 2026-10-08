// 42 makine (Salih Abi: "yaklaşık 42 tane makine var"). Adlar, görseller ve özetler
// ugurpromilling.com'dan; yazım "makine" olarak düzeltildi ("makina değil, makinedir").
// Model kodu yalnızca bilinenler: ürün adındaki marka (Cleanmax, Ultrator…) ve SCS fişindeki
// modeller. Gerisi boş; yönetim panelinden eklenir.

export const categories = [
  { slug: 'temizleme-ve-tavlama', tr: 'Temizleme ve Tavlama', en: 'Cleaning & Dampening' },
  { slug: 'ogutme', tr: 'Öğütme', en: 'Milling' },
  { slug: 'tasima', tr: 'Taşıma', en: 'Conveying' },
  { slug: 'paketleme', tr: 'Paketleme', en: 'Packaging' },
];

// [kaynak slug, kategori, TR ad, EN ad, model kodu, modeller]
const rows = [
  ['cop-sasoru-cleanmax-4', 'temizleme-ve-tavlama', 'Çöp Sasörü Cleanmax 4', 'Cleanmax 4 Separator', 'CLEANMAX 4', []],
  ['cop-sasoru-cleanmax-2', 'temizleme-ve-tavlama', 'Çöp Sasörü Cleanmax 2', 'Cleanmax 2 Separator', 'CLEANMAX 2', []],
  ['cop-sasoru-cleanmax-1', 'temizleme-ve-tavlama', 'Çöp Sasörü Cleanmax 1', 'Cleanmax 1 Separator', 'CLEANMAX 1', []],
  ['siniflandiricili-tas-ayirici-ultrator', 'temizleme-ve-tavlama', 'Sınıflandırıcılı Taş Ayırıcı Ultrator', 'Ultrator Dry Stoner and Classifier', 'ULTRATOR', []],
  ['cift-katli-tas-ayirici-unlof', 'temizleme-ve-tavlama', 'Çift Katlı Taş Ayırıcı Unlof', 'Unlof Double Deck Dry Stoner', 'UNLOF', []],
  ['triyor', 'temizleme-ve-tavlama', 'Triyör', 'Indented Cylinder', null, []],
  ['kabuk-soyucu', 'temizleme-ve-tavlama', 'Kabuk Soyucu', 'Horizontal Scourer', null, []],
  ['cebri-tav-makinesi-acili-yogun-tavlama', 'temizleme-ve-tavlama', 'Cebri Tav Makinesi', 'Inclined Intensive Dampener', null, []],
  ['otomatik-tavlama-makinesi-sistemi', 'temizleme-ve-tavlama', 'Otomatik Tavlama Sistemi', 'Automatic Dampening System', null, []],
  ['otomatik-pacal-makinesi-tahil-karistirma', 'temizleme-ve-tavlama', 'Otomatik Paçal Makinesi', 'Automatic Blending Machine', null, []],
  ['cekicli-degirmen-ogutme-makinesi', 'temizleme-ve-tavlama', 'Çekiçli Değirmen', 'Hammer Mill', null, []],
  ['jet-filtre', 'temizleme-ve-tavlama', 'Jet Filtre', 'Jet Filter', null, []],

  ['valsli-degirmen', 'ogutme', 'Valsli Değirmen Thunderoll', 'Thunderoll Roller Mill', 'THUNDEROLL', []],
  ['cift-katli-valsli-degirmen', 'ogutme', 'Çift Katlı Valsli Değirmen', 'Thunderoll Double Deck Roller Mill', 'THUNDEROLL', []],
  ['kare-elek-grandsifter', 'ogutme', 'Kare Elek Grandsifter', 'Grandsifter Square Plansifter', 'GRANDSIFTER', []],
  ['kare-elek-planmaster', 'ogutme', 'Kare Elek Planmaster', 'Planmaster Square Plansifter', 'PLANMASTER', []],
  ['irmik-sasoru', 'ogutme', 'İrmik Sasörü', 'Semolina Purifier', null, []],
  ['vibro-kepek-fircasi', 'ogutme', 'Vibro Kepek Fırçası', 'Vibro Bran Finisher', null, []],
  ['kepek-fircasi', 'ogutme', 'Kepek Fırçası', 'Bran Finisher', null, []],
  ['turbo-elek', 'ogutme', 'Turbo Elek', 'Turbo Sifter', null, []],
  ['irmik-kirici', 'ogutme', 'İrmik Kırıcı', 'Impact Detacher', null, []],
  ['tambur-irmik-kirici', 'ogutme', 'Tambur İrmik Kırıcı', 'Drum Detacher', null, []],
  ['entoleter-bocek-oldurucu', 'ogutme', 'Entoleter Böcek Öldürücü', 'Entoleter Insect Destroyer', null, []],
  ['misir-isleme-makinasi-gronamac', 'ogutme', 'Mısır İşleme Makinesi Gronamac', 'Gronamac Corn Processing Machine', 'GRONAMAC', []],
  ['pnomatik-fan', 'ogutme', 'Pnömatik Fan', 'Pneumatic Fan', null, []],
  ['randiman-kantari-loadcell', 'ogutme', 'Randıman Kantarı', 'Extraction Scale', null, []],
  ['un-ve-kepek-vidasi-vidali-tasiyici', 'ogutme', 'Un ve Kepek Vidası', 'Flour and Bran Screw Conveyor', null, []],
  ['vitamin-katki-dozaj-makinesi', 'ogutme', 'Vitamin Katkı Makinesi', 'Vitamin Dosing Machine', null, []],

  ['eklus', 'tasima', 'Eklüs', 'Rotary Valve', null, []],
  ['blower', 'tasima', 'Blower', 'Blower', null, []],
  ['kovali-elevator', 'tasima', 'Kovalı Elevatör', 'Bucket Elevator', null, []],
  ['zincirli-konveyor', 'tasima', 'Zincirli Konveyör', 'Chain Conveyor', null, []],
  ['paletli-konveyor-tasiyici', 'tasima', 'Paletli Konveyör', 'Pallet Conveyor', null, []],
  ['tup-vida-helezon-tasiyici', 'tasima', 'Tüp Vida Helezon Taşıyıcı', 'Tube Screw Conveyor', null, []],
  ['teleskopik-bant', 'tasima', 'Teleskopik Bant', 'Telescopic Conveyor Belt', null, []],
  ['cuval-tasima-ve-yukleme-bandi', 'tasima', 'Çuval Taşıma ve Yükleme Bandı', 'Bag Conveying and Loading Belt', null, []],

  ['kontrol-elegi', 'paketleme', 'Kontrol Eleği', 'Control Plansifter', 'SCS', ['SCS 20864', 'SCS 21264', 'SCS 20874', 'SCS 21874', 'SCS 22874']],
  ['karusel-paketleme-makinesi', 'paketleme', 'Karusel Paketleme Makinesi', 'Carousel Packaging Machine', null, []],
  ['otomatik-paketleme-torbalama-makinesi', 'paketleme', 'Otomatik Paketleme Makinesi', 'Automatic Bagging Machine', null, []],
  ['tonluk-paketleme-makinesi', 'paketleme', 'Tonluk Paketleme Makinesi', 'Big Bag Filling Machine', null, []],
  ['silo-bosaltici', 'paketleme', 'Silo Boşaltıcı', 'Silo Discharger', null, []],
  ['un-dagitici', 'paketleme', 'Un Dağıtıcı', 'Flour Distributor', null, []],
];

// Kaynak slug'lar sitedeki ürün sayfalarına ait; kütüphanede daha kısa ve doğru yazımlı slug kullanılır.
const SLUG = {
  'cop-sasoru-cleanmax-4': 'cleanmax-4',
  'cop-sasoru-cleanmax-2': 'cleanmax-2',
  'cop-sasoru-cleanmax-1': 'cleanmax-1',
  'siniflandiricili-tas-ayirici-ultrator': 'ultrator',
  'cift-katli-tas-ayirici-unlof': 'unlof',
  'cebri-tav-makinesi-acili-yogun-tavlama': 'cebri-tav-makinesi',
  'otomatik-tavlama-makinesi-sistemi': 'otomatik-tavlama-sistemi',
  'otomatik-pacal-makinesi-tahil-karistirma': 'otomatik-pacal-makinesi',
  'cekicli-degirmen-ogutme-makinesi': 'cekicli-degirmen',
  'valsli-degirmen': 'valsli-degirmen-thunderoll',
  'kare-elek-grandsifter': 'grandsifter',
  'kare-elek-planmaster': 'planmaster',
  'misir-isleme-makinasi-gronamac': 'gronamac',
  'randiman-kantari-loadcell': 'randiman-kantari',
  'un-ve-kepek-vidasi-vidali-tasiyici': 'un-ve-kepek-vidasi',
  'vitamin-katki-dozaj-makinesi': 'vitamin-katki-makinesi',
  'paletli-konveyor-tasiyici': 'paletli-konveyor',
  'tup-vida-helezon-tasiyici': 'tup-vida',
  'cuval-tasima-ve-yukleme-bandi': 'cuval-yukleme-bandi',
  'otomatik-paketleme-torbalama-makinesi': 'otomatik-paketleme-makinesi',
};

// Sitedeki açıklamalar ~255 karakterde kesik geliyor: son tam cümlede bitir.
function sentence(text) {
  const t = text.replace(/\s+/g, ' ').trim();
  if (/[.!?)]$/.test(t)) return t;
  const cut = Math.max(t.lastIndexOf('. '), t.lastIndexOf('.)'));
  return cut > 60 ? t.slice(0, cut + 1) : `${t.replace(/[\s,;:–-]+\S*$/, '')}…`;
}

export function machines(siteCatalog) {
  const bySlug = new Map(siteCatalog.map((p) => [p.slug, p]));
  return rows.map(([source, category, tr, en, modelCode, models], i) => {
    const site = bySlug.get(source) ?? {};
    const fix = (s) => (s ? sentence(s.replace(/[Mm]akinas(ı|i)/g, (m) => (m[0] === 'M' ? 'Makines' : 'makines') + 'i')) : null);
    return {
      slug: SLUG[source] ?? source,
      source,
      category,
      tr,
      en,
      modelCode,
      models,
      summaryTr: fix(site.summary_tr),
      summaryEn: site.summary_en && !/[ğışçöüİ]/.test(site.summary_en) ? sentence(site.summary_en) : null,
      image: site.image ?? null,
      sort: i,
    };
  });
}
