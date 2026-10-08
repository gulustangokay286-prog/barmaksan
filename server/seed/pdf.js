// Örnek (mock) PDF üreticileri. Gerçek dokümanlar yüklendiğinde bunların yerine
// yeni sürüm olarak geçecekler; her sayfanın altında bunu söyleyen bir not var.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';

const here = path.dirname(fileURLToPath(import.meta.url));
const FONTS = path.join(here, 'fonts');
export const ASSETS = path.resolve(process.env.SEED_ASSETS ?? path.join(here, '..', '..', 'assets'));

const INK = '#222222';
const INK2 = '#5C5C61';
const INK3 = '#8B8B90';
const LINE = '#DADADA';
const GOLD = '#D9B625';
const ADDRESS = 'Barmaksan Endüstri A.Ş. · Organize Sanayi Bölgesi 7. Cad. No:27-31/1 Çorum / Türkiye · +90 364 235 00 26';

// ── Yardımcılar ─────────────────────────────────────────────────────────────

export function rng(seedText) {
  let h = 2166136261;
  for (const ch of seedText) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let a = h >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const between = (r, a, b) => Math.round(a + r() * (b - a));
const fmt = (n, d = 0) => n.toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d });

function create(out, { size = 'A4', layout = 'portrait', title }) {
  const doc = new PDFDocument({ size, layout, margin: 0, bufferPages: true, info: { Title: title, Author: 'Barmaksan Endüstri A.Ş.', Creator: 'Bilgi Kütüphanesi' } });
  doc.registerFont('R', path.join(FONTS, 'Montserrat-Regular.ttf'));
  doc.registerFont('M', path.join(FONTS, 'Montserrat-Medium.ttf'));
  doc.registerFont('S', path.join(FONTS, 'Montserrat-SemiBold.ttf'));
  doc.registerFont('B', path.join(FONTS, 'Montserrat-Bold.ttf'));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const stream = fs.createWriteStream(out);
  doc.pipe(stream);
  const done = new Promise((resolve, reject) => { stream.on('finish', resolve); stream.on('error', reject); });
  return { doc, done };
}

function header(doc, { kicker, rev, lang }) {
  const W = doc.page.width;
  doc.image(path.join(ASSETS, 'brand', 'barmaksan-logo.png'), 44, 30, { height: 34 });
  doc.font('M').fontSize(7.5).fillColor(INK3).text(kicker.toUpperCase(), W - 44 - 220, 36, { width: 220, align: 'right', characterSpacing: 0.8 });
  if (rev) doc.font('S').fontSize(9).fillColor(INK).text(`Rev. ${rev}${lang ? `  ·  ${lang}` : ''}`, W - 44 - 220, 50, { width: 220, align: 'right' });
  doc.moveTo(44, 78).lineTo(W - 44, 78).lineWidth(1.2).strokeColor(GOLD).stroke();
}

function footers(doc, note = true) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    const { width: W, height: H } = doc.page;
    doc.moveTo(44, H - 46).lineTo(W - 44, H - 46).lineWidth(0.5).strokeColor(LINE).stroke();
    doc.font('R').fontSize(6.5).fillColor(INK3).text(ADDRESS, 44, H - 38, { width: W - 160, lineBreak: false });
    doc.font('M').fontSize(7).fillColor(INK2).text(`${i + 1} / ${range.count}`, W - 44 - 80, H - 38, { width: 80, align: 'right', lineBreak: false });
    if (note) {
      doc.font('R').fontSize(6.5).fillColor(INK3).text('Örnek doküman — Bilgi Kütüphanesi demo verisi. Gerçek doküman yüklendiğinde yeni sürüm olarak yerini alır.', 44, H - 28, { width: W - 88, lineBreak: false });
    }
  }
}

function title(doc, tr, en, y = 100) {
  doc.font('B').fontSize(22).fillColor(INK).text(tr, 44, y, { width: doc.page.width - 88 });
  if (en) doc.font('R').fontSize(12).fillColor(INK2).text(en, 44, doc.y + 2, { width: doc.page.width - 88 });
  return doc.y;
}

/** Basit tablo. columns: [{ label, width, align }] */
function table(doc, { x = 44, y, columns, rows, rowH = 18, headH = 26, font = 7.6, zebra = true }) {
  const W = columns.reduce((s, c) => s + c.width, 0);
  let cy = y;
  const drawHead = () => {
    doc.rect(x, cy, W, headH).fill('#F3F3F1');
    let cx = x;
    for (const c of columns) {
      doc.font('S').fontSize(6.8).fillColor(INK2).text(c.label, cx + 6, cy + 6, { width: c.width - 12, align: c.align ?? 'left', height: headH - 6 });
      cx += c.width;
    }
    cy += headH;
  };
  drawHead();
  rows.forEach((row, ri) => {
    if (cy + rowH > doc.page.height - 70) {
      doc.addPage();
      cy = 96;
      drawHead();
    }
    if (zebra && ri % 2 === 1) doc.rect(x, cy, W, rowH).fill('#FAFAF8');
    let cx = x;
    row.forEach((cell, ci) => {
      const c = columns[ci];
      doc.font(c.mono ? 'M' : 'R').fontSize(font).fillColor(INK).text(String(cell ?? ''), cx + 6, cy + (rowH - font) / 2 - 1, { width: c.width - 12, align: c.align ?? 'left', lineBreak: false, ellipsis: true });
      cx += c.width;
    });
    cy += rowH;
    doc.moveTo(x, cy).lineTo(x + W, cy).lineWidth(0.4).strokeColor(LINE).stroke();
  });
  return cy;
}

function paragraph(doc, text, { size = 9.2, color = INK, gap = 8, width } = {}) {
  doc.font('R').fontSize(size).fillColor(color).text(text, 44, doc.y, { width: width ?? doc.page.width - 88, lineGap: 3.2, align: 'left' });
  doc.y += gap;
}

function heading(doc, text, { size = 12.5 } = {}) {
  if (doc.y > doc.page.height - 160) doc.addPage(), (doc.y = 100);
  doc.font('S').fontSize(size).fillColor(INK).text(text, 44, doc.y + 6, { width: doc.page.width - 88 });
  doc.y += 6;
}

// ── Teknik fiş ──────────────────────────────────────────────────────────────

export async function techSheet(out, m, { rev = 1, image }) {
  const r = rng(`${m.slug}:sheet:${rev}`);
  const { doc, done } = create(out, { title: `${m.tr} — Teknik Fiş` });
  doc.y = 0;
  header(doc, { kicker: 'Teknik Fiş · Technical Sheet', rev, lang: 'TR / EN' });
  title(doc, m.tr, m.en);
  doc.font('M').fontSize(8).fillColor(INK3).text('MODEL / TYPE', 44, doc.y + 10, { characterSpacing: 0.6 });
  doc.font('B').fontSize(16).fillColor(INK).text(m.modelCode, 44, doc.y + 1);

  if (image && fs.existsSync(image)) {
    doc.image(image, 120, 210, { fit: [355, 255], align: 'center', valign: 'center' });
  }
  // Ölçü harfleri: çizim ile tablo arasındaki bağ.
  doc.font('M').fontSize(8).fillColor(INK3);
  doc.moveTo(120, 478).lineTo(475, 478).lineWidth(0.5).strokeColor(INK3).stroke();
  doc.text('A', 292, 482);
  doc.moveTo(500, 215).lineTo(500, 465).stroke();
  doc.text('B', 506, 336);

  const models = m.models.length ? m.models : [m.modelCode];
  const growth = (i) => 1 + i * (0.18 + r() * 0.08);
  const baseA = between(r, 900, 2400);
  const baseB = between(r, 700, 2100);
  const baseC = between(r, 500, 1300);
  const kw = pick(r, [0.75, 1.1, 1.5, 2.2, 3, 4, 5.5, 7.5, 11]);
  const rpm = pick(r, [750, 1000, 1500, 3000]);
  const weight = between(r, 180, 2600);
  const dims = models.map((name, i) => {
    const g = growth(i);
    return [name, fmt(Math.round(baseA * g)), fmt(Math.round(baseB * g)), fmt(Math.round(baseC * (1 + i * 0.1))),
      fmt(kw * (1 + i * 0.35), kw < 2 ? 2 : 1), fmt(rpm), fmt(Math.round(weight * g)), fmt(Math.round(weight * g * 1.12)),
      fmt(((baseA * baseB * baseC) / 1e9) * g * 1.3, 2)];
  });
  doc.font('S').fontSize(10).fillColor(INK).text('Ölçüler ve teknik değerler', 44, 512);
  doc.font('R').fontSize(8).fillColor(INK2).text('Dimensions and technical data — mm, kW, kg, m³', 44, doc.y + 1);
  table(doc, {
    y: doc.y + 8,
    columns: [
      { label: 'Model\nType', width: 86, mono: true }, { label: 'A\nmm', width: 50, align: 'right' }, { label: 'B\nmm', width: 50, align: 'right' },
      { label: 'C\nmm', width: 50, align: 'right' }, { label: 'Motor\nkW', width: 50, align: 'right' }, { label: 'Devir\nrpm', width: 50, align: 'right' },
      { label: 'Net\nkg', width: 56, align: 'right' }, { label: 'Brüt\nGross kg', width: 56, align: 'right' }, { label: 'Hacim\nm³', width: 59, align: 'right' },
    ],
    rows: dims,
    rowH: 20,
    font: 8,
  });
  doc.font('R').fontSize(7.5).fillColor(INK2).text(
    `Elektrik motoru: ${pick(r, ['AGM', 'Gamak', 'Siemens'])} ${pick(r, ['112-M4', '132 S6', '100L-4', '160L-6'])}  ·  Koruma sınıfı IP55  ·  Besleme 3~ 400 V / 50 Hz  ·  Boya: RAL 9016 / RAL 7016`,
    44, doc.y + 10, { width: doc.page.width - 88 },
  );
  footers(doc);
  doc.end();
  await done;
}

// ── Yedek parça listesi (SPL) ───────────────────────────────────────────────

const PARTS = [
  ['ELEKTRİK MOTORU', 'ELECTRIC MOTOR', 'MTR', (r) => `${pick(r, [1.1, 2.2, 3, 4, 5.5, 7.5])} kW · ${pick(r, [1000, 1500])} rpm`],
  ['REDÜKTÖRLÜ MOTOR', 'GEAR MOTOR', 'RDK', (r) => `${pick(r, [0.55, 0.75, 1.1, 2.2])} kW · ${between(r, 18, 60)} rpm`],
  ['MOTOR KASNAĞI', 'MOTOR PULLEY', 'PLY', (r) => `Ø${between(r, 140, 560)} mm · ${between(r, 30, 60)} mm`],
  ['ROTOR KASNAĞI', 'ROTOR PULLEY', 'RPLY', (r) => `Ø${between(r, 200, 600)} mm`],
  ['KAYIŞ', 'BELT', 'BLT', (r) => `${pick(r, ['SPA', 'SPB', 'XPZ'])} ${between(r, 1200, 3200)}`],
  ['RULMAN', 'BEARING', 'BRG', (r) => pick(r, ['6206 2RS', '6308 ZZ', '22212 EK', 'UCF 210'])],
  ['RULMAN YATAĞI', 'BEARING HOUSING', 'BHS', (r) => pick(r, ['SN 512', 'UCP 208', 'SNL 516'])],
  ['HAVA KİLİDİ', 'AIR LOCK', 'ARLCK', (r) => `Ø${pick(r, [160, 200, 240])} mm`],
  ['ELEK KASASI', 'SIEVE FRAME', 'SFRM', (r) => `${between(r, 600, 1900)}×${between(r, 400, 1000)} mm`],
  ['LASTİK TOP', 'RUBBER BALL', 'RBL', (r) => `Ø${pick(r, [30, 35, 40])} mm`],
  ['YAY', 'SPRING', 'SPRNG', (r) => `Ø${between(r, 20, 45)} × ${between(r, 60, 120)} mm`],
  ['GÖZETLEME CAMI', 'SIGHT GLASS', 'SGLS', (r) => `${between(r, 160, 300)}×${between(r, 300, 800)} mm`],
  ['KONTROL KAPAĞI', 'INSPECTION COVER', 'CVR', (r) => `${between(r, 200, 500)}×${between(r, 200, 500)} mm`],
  ['MENTEŞE', 'HINGE', 'HNGE', (r) => `${between(r, 40, 70)}×${between(r, 30, 45)} mm`],
  ['BUAT', 'JUNCTION BOX', 'JBOX', () => '77×77×46 mm'],
  ['ENDÜKTİF SENSÖR', 'PROXIMITY SENSOR', 'PRX', (r) => pick(r, ['M18 PNP NO', 'M30 PNP NC'])],
  ['VİBRO MOTOR', 'VIBRO MOTOR', 'VBR', (r) => `${pick(r, [0.37, 0.55, 0.9])} kW · 1000 rpm`],
  ['ZİNCİR DİŞLİSİ', 'SPROCKET', 'SPRK', (r) => `5/8" · Z${between(r, 14, 30)}`],
  ['ZİNCİR', 'CHAIN', 'CHN', (r) => `5/8" · ${between(r, 1, 6)} m`],
  ['MİL', 'SHAFT', 'SHFT', (r) => `Ø${between(r, 30, 80)} × ${between(r, 400, 1600)} mm`],
  ['KAPLİN', 'COUPLING', 'CPL', (r) => pick(r, ['ROTEX 38', 'ROTEX 48', 'N-EUPEX B110'])],
  ['KEÇE', 'OIL SEAL', 'SEAL', (r) => `${between(r, 30, 80)}×${between(r, 50, 110)}×10`],
  ['FIRÇA', 'BRUSH', 'BRSH', (r) => `${between(r, 300, 1200)} mm`],
  ['ELEK TELİ', 'SCREEN MESH', 'MESH', (r) => `${pick(r, [180, 250, 450, 1000])} µm`],
  ['SIYIRICI', 'SCRAPER', 'SCRP', (r) => `${between(r, 600, 1250)} mm`],
  ['LED ŞERİT', 'LED STRIP', 'LED', () => '24 V · IP65'],
  ['KABLO RAKORU', 'CABLE GLAND', 'GLND', (r) => pick(r, ['M20', 'M25', 'M32'])],
  ['AYAR KLAPESİ', 'ADJUSTMENT FLAP', 'FLP', () => 'Özel imalat / Special'],
];

export function splRows(m, rev = 1) {
  const r = rng(`${m.slug}:spl:${rev}`);
  const count = between(r, 16, 26);
  const pool = [...PARTS].sort(() => r() - 0.5).slice(0, count);
  return pool.map(([tr, en, code, dim], i) => [String(i + 1), `${m.prefix}.${code}${r() > 0.6 ? between(r, 1, 9) : ''}`, tr, en, dim(r), `${between(r, 1, 6) === 6 ? between(r, 8, 32) : between(r, 1, 4)} adet`]);
}

export async function spl(out, m, { rev = 1 }) {
  const { doc, done } = create(out, { title: `${m.tr} — Yedek Parça Listesi` });
  header(doc, { kicker: 'SPL · Spare Part List', rev, lang: 'TR / EN' });
  title(doc, 'Yedek Parça Listesi', 'Spare Part List');
  doc.font('S').fontSize(10.5).fillColor(INK).text(`${m.tr}  ·  ${m.modelCode}`, 44, doc.y + 8);
  doc.font('R').fontSize(8).fillColor(INK2).text('Siparişlerde parça kodunu ve makinenin seri numarasını belirtiniz. · Please state the item code and the machine serial number when ordering.', 44, doc.y + 4, { width: doc.page.width - 88 });
  table(doc, {
    y: doc.y + 12,
    columns: [
      { label: 'Sıra\nNo', width: 34, align: 'right' }, { label: 'Parça Kodu\nItem Code', width: 118, mono: true },
      { label: 'Parça Adı', width: 108 }, { label: 'Part Name', width: 104 }, { label: 'Ölçü\nDimension', width: 92 }, { label: 'Adet\nQty', width: 51, align: 'right' },
    ],
    rows: splRows(m, rev),
    rowH: 21,
  });
  footers(doc);
  doc.end();
  await done;
}

// ── Kılavuzlar ──────────────────────────────────────────────────────────────

const MANUAL = {
  tr: {
    use: {
      kicker: 'Kullanım Kılavuzu',
      title: 'Kullanım Kılavuzu',
      sections: (m) => [
        ['1. Güvenlik', `${m.tr} yalnızca eğitim almış personel tarafından çalıştırılmalıdır. Bakım ve temizlik öncesinde makinenin enerjisi ana şalterden kesilmeli, kilitlenmeli ve etiketlenmelidir. Koruyucu kapaklar çalışma sırasında açılmamalıdır.`],
        ['2. Genel tanım', `${m.summaryTr ?? `${m.tr}, un ve irmik tesislerinde kullanılmak üzere tasarlanmıştır.`} Makine, ${m.modelCode} serisinin standart donanımıyla teslim edilir.`],
        ['3. Kurulum', 'Makine düz ve titreşimsiz bir zemine, teknik fişteki ölçülere göre yerleştirilmelidir. Ankraj bağlantıları tamamlandıktan sonra terazisi kontrol edilmelidir. Elektrik bağlantısı yetkili elektrikçi tarafından, etiket değerlerine uygun yapılmalıdır.'],
        ['4. İlk çalıştırma', 'Dönüş yönü motor üzerindeki oka göre kontrol edilir. Makine ürünsüz olarak en az 15 dakika çalıştırılır; anormal ses, titreşim ve ısınma gözlenmezse ürün beslemesi kademeli olarak açılır.'],
        ['5. Ayarlar', 'Kapasite ve ayrım kalitesi, besleme miktarı ve hava ayarı ile birlikte değerlendirilmelidir. Ayarlar küçük adımlarla yapılmalı ve her değişiklikten sonra ürün kontrol edilmelidir.'],
        ['6. Arıza giderme', 'Kapasite düşüşü: besleme ve elek yüzeyleri kontrol edilir. Aşırı titreşim: yaylar, bağlantı cıvataları ve rulmanlar kontrol edilir. Motor koruma devresinin atması: akım değerleri ve mekanik sıkışma kontrol edilir.'],
      ],
    },
    care: {
      kicker: 'Bakım Kılavuzu',
      title: 'Bakım Kılavuzu',
      sections: (m) => [
        ['1. Genel', `${m.tr} için önerilen bakım aralıkları aşağıdadır. Ağır çalışma koşullarında aralıklar kısaltılmalıdır. Yapılan her bakım, makinenin bakım kartına işlenmelidir.`],
        ['2. Periyodik kontroller', 'Bağlantı cıvatalarının sıkılığı, kayış gerginliği, rulman sıcaklığı ve sızdırmazlık elemanları düzenli olarak kontrol edilmelidir.'],
        ['3. Temizlik', 'Ürün temas yüzeyleri birikinti bırakılmadan temizlenmelidir. Basınçlı su kullanılmamalı; kuru fırça ve basınçlı hava tercih edilmelidir.'],
      ],
    },
  },
  en: {
    use: {
      kicker: 'User Manual',
      title: 'User Manual',
      sections: (m) => [
        ['1. Safety', `The ${m.en} must only be operated by trained personnel. Before maintenance or cleaning, isolate the machine at the main switch, then lock and tag it out. Guards must remain closed during operation.`],
        ['2. Description', `${m.summaryEn ?? `The ${m.en} is designed for flour and semolina mills.`} The machine is delivered with the standard equipment of the ${m.modelCode} series.`],
        ['3. Installation', 'Place the machine on a level, vibration-free floor according to the dimensions in the technical sheet. Check the levelling after anchoring. The electrical connection must be made by a qualified electrician according to the rating plate.'],
        ['4. First start-up', 'Check the direction of rotation against the arrow on the motor. Run the machine empty for at least 15 minutes; if there is no abnormal noise, vibration or heating, open the product feed gradually.'],
        ['5. Adjustments', 'Capacity and separation quality depend on feed rate and air adjustment together. Make adjustments in small steps and check the product after each change.'],
        ['6. Troubleshooting', 'Low capacity: check the feed and screen surfaces. Excessive vibration: check springs, fixing bolts and bearings. Motor protection trips: check current values and mechanical blockage.'],
      ],
    },
  },
};

export async function manual(out, m, { kind = 'use', lang = 'tr', rev = 1 }) {
  const spec = MANUAL[lang][kind];
  const name = lang === 'tr' ? m.tr : m.en;
  const { doc, done } = create(out, { title: `${name} — ${spec.title}` });
  header(doc, { kicker: spec.kicker, rev, lang: lang.toUpperCase() });
  title(doc, spec.title, `${name} · ${m.modelCode}`);
  doc.y += 14;
  for (const [h, body] of spec.sections(m)) {
    heading(doc, h);
    paragraph(doc, body);
  }
  if (kind === 'care') {
    heading(doc, '4. Bakım aralıkları');
    const r = rng(`${m.slug}:care`);
    const rows = [
      ['Günlük', 'Ürün temas yüzeylerinin gözle kontrolü, anormal ses ve titreşim', 'Operatör'],
      ['Haftalık', 'Kayış gerginliği ve aşınma kontrolü', 'Bakım'],
      ['Aylık', `Rulman sıcaklığı ölçümü (≤ ${between(r, 60, 75)} °C)`, 'Bakım'],
      ['3 Ayda bir', 'Cıvata sıkılık kontrolü, sızdırmazlık elemanları', 'Bakım'],
      ['6 Ayda bir', 'Yağlama tablosuna göre gresleme', 'Bakım'],
      ['Yıllık', 'Genel revizyon, aşınan parçaların SPL koduyla değişimi', 'Servis'],
    ];
    table(doc, { y: doc.y + 6, columns: [{ label: 'Periyot', width: 90 }, { label: 'İşlem', width: 300 }, { label: 'Sorumlu', width: 117 }], rows, rowH: 22 });
  }
  footers(doc);
  doc.end();
  await done;
}

export async function lubrication(out, m, { rev = 1 }) {
  const r = rng(`${m.slug}:lub:${rev}`);
  const { doc, done } = create(out, { title: `${m.tr} — Yağlama Tablosu` });
  header(doc, { kicker: 'Yağlama Tablosu · Lubrication Chart', rev, lang: 'TR / EN' });
  title(doc, 'Yağlama Tablosu', `Lubrication Chart · ${m.tr}`);
  const points = ['Ana mil rulmanları', 'Motor tarafı yatak', 'Karşı taraf yatak', 'Redüktör', 'Zincir', 'Ayar mili', 'Klape menteşeleri', 'Eksantrik grup'];
  const rows = points.slice(0, between(r, 4, 8)).map((p, i) => {
    const grease = !/Redüktör|Zincir/.test(p);
    return [String(i + 1), p, grease ? 'Lityum sabunlu gres, NLGI 2' : p === 'Redüktör' ? 'ISO VG 220 dişli yağı' : 'Zincir spreyi',
      grease ? `${between(r, 5, 30)} g` : p === 'Redüktör' ? `${fmt(between(r, 6, 30) / 10, 1)} L` : 'İnce film', grease ? `${pick(r, [500, 1000, 2000])} saat` : p === 'Redüktör' ? '10.000 saat' : 'Haftalık'];
  });
  table(doc, {
    y: doc.y + 18,
    columns: [{ label: 'No', width: 30, align: 'right' }, { label: 'Yağlama noktası', width: 150 }, { label: 'Yağ / gres tipi', width: 160 }, { label: 'Miktar', width: 70, align: 'right' }, { label: 'Periyot', width: 97, align: 'right' }],
    rows,
    rowH: 24,
    font: 8,
  });
  doc.font('R').fontSize(8).fillColor(INK2).text('Farklı gres tipleri karıştırılmamalıdır. Gresleme makine çalışırken, düşük devirde yapılmalıdır. · Do not mix different grease types.', 44, doc.y + 14, { width: doc.page.width - 88 });
  footers(doc);
  doc.end();
  await done;
}

// ── Teknik çizim (A3 yatay) ─────────────────────────────────────────────────

function dimLine(doc, x1, y1, x2, y2, label) {
  doc.lineWidth(0.5).strokeColor('#9A9A9A');
  doc.moveTo(x1, y1).lineTo(x2, y2).stroke();
  const ah = 4;
  if (y1 === y2) {
    doc.moveTo(x1, y1).lineTo(x1 + ah, y1 - 2).lineTo(x1 + ah, y1 + 2).fill('#9A9A9A');
    doc.moveTo(x2, y2).lineTo(x2 - ah, y2 - 2).lineTo(x2 - ah, y2 + 2).fill('#9A9A9A');
    doc.font('M').fontSize(8).fillColor(INK).text(label, (x1 + x2) / 2 - 40, y1 - 12, { width: 80, align: 'center' });
  } else {
    doc.moveTo(x1, y1).lineTo(x1 - 2, y1 + ah).lineTo(x1 + 2, y1 + ah).fill('#9A9A9A');
    doc.moveTo(x2, y2).lineTo(x2 - 2, y2 - ah).lineTo(x2 + 2, y2 - ah).fill('#9A9A9A');
    doc.save().rotate(-90, { origin: [x1 - 8, (y1 + y2) / 2] }).font('M').fontSize(8).fillColor(INK).text(label, x1 - 48, (y1 + y2) / 2 - 4, { width: 80, align: 'center' }).restore();
  }
}

function machineView(doc, x, y, w, h, r) {
  doc.lineWidth(1).strokeColor(INK);
  const legH = h * 0.22;
  const bodyH = h - legH;
  doc.rect(x, y + h * 0.12, w, bodyH - h * 0.12).stroke();
  // Besleme ağzı
  const hw = w * (0.2 + r() * 0.15);
  doc.moveTo(x + w / 2 - hw / 2, y).lineTo(x + w / 2 + hw / 2, y).lineTo(x + w / 2 + hw / 4, y + h * 0.12).lineTo(x + w / 2 - hw / 4, y + h * 0.12).closePath().stroke();
  // Kapaklar
  const doors = 2 + Math.floor(r() * 3);
  for (let i = 0; i < doors; i += 1) {
    const dw = (w - 24) / doors;
    doc.rect(x + 12 + i * dw + 3, y + h * 0.2, dw - 6, bodyH * 0.55).lineWidth(0.6).stroke();
    doc.circle(x + 12 + i * dw + dw - 12, y + h * 0.2 + bodyH * 0.27, 2).stroke();
  }
  // Ayaklar ve çıkış
  doc.lineWidth(1);
  doc.rect(x + 10, y + bodyH, 14, legH).stroke();
  doc.rect(x + w - 24, y + bodyH, 14, legH).stroke();
  doc.rect(x + w / 2 - 18, y + bodyH, 36, legH * 0.55).stroke();
  doc.moveTo(x - 20, y + h).lineTo(x + w + 20, y + h).lineWidth(0.4).dash(6, { space: 3 }).stroke().undash();
}

export async function drawing(out, m, { rev = 1 }) {
  const r = rng(`${m.slug}:dwg:${rev}`);
  const { doc, done } = create(out, { size: 'A3', layout: 'landscape', title: `${m.tr} — Genel Görünüş` });
  const W = doc.page.width;
  const H = doc.page.height;
  doc.rect(24, 24, W - 48, H - 48).lineWidth(1.2).strokeColor(INK).stroke();
  doc.rect(30, 30, W - 60, H - 60).lineWidth(0.4).stroke();

  const fw = between(r, 320, 420);
  const fh = between(r, 260, 360);
  const sw = between(r, 160, 240);
  machineView(doc, 110, 120, fw, fh, r);
  machineView(doc, 110 + fw + 140, 120, sw, fh, r);
  dimLine(doc, 110, 120 + fh + 30, 110 + fw, 120 + fh + 30, `A = ${fmt(between(r, 1200, 2600))}`);
  dimLine(doc, 80, 120, 80, 120 + fh, `B = ${fmt(between(r, 900, 2300))}`);
  dimLine(doc, 110 + fw + 140, 120 + fh + 30, 110 + fw + 140 + sw, 120 + fh + 30, `C = ${fmt(between(r, 600, 1400))}`);
  doc.font('S').fontSize(9).fillColor(INK).text('ÖN GÖRÜNÜŞ / FRONT VIEW', 110, 120 + fh + 52);
  doc.text('YAN GÖRÜNÜŞ / SIDE VIEW', 110 + fw + 140, 120 + fh + 52);

  // Antet
  const tbX = W - 30 - 360;
  const tbY = H - 30 - 120;
  doc.lineWidth(0.8).strokeColor(INK).rect(tbX, tbY, 360, 120).stroke();
  doc.moveTo(tbX, tbY + 40).lineTo(tbX + 360, tbY + 40).stroke();
  doc.moveTo(tbX, tbY + 80).lineTo(tbX + 360, tbY + 80).stroke();
  doc.moveTo(tbX + 180, tbY + 40).lineTo(tbX + 180, tbY + 120).stroke();
  doc.image(path.join(ASSETS, 'brand', 'barmaksan-logo.png'), tbX + 8, tbY + 6, { height: 28 });
  doc.font('B').fontSize(11).fillColor(INK).text(m.tr, tbX + 140, tbY + 8, { width: 212, align: 'right' });
  doc.font('R').fontSize(8).fillColor(INK2).text(`${m.modelCode} · Genel görünüş`, tbX + 140, tbY + 24, { width: 212, align: 'right' });
  const cell = (label, value, cx, cy) => {
    doc.font('M').fontSize(6.5).fillColor(INK3).text(label.toUpperCase(), cx + 8, cy + 7);
    doc.font('S').fontSize(10).fillColor(INK).text(value, cx + 8, cy + 19);
  };
  cell('Çizim no', `${m.prefix}-GA-${String(between(r, 100, 999))}`, tbX, tbY + 40);
  cell('Ölçek', pick(r, ['1:10', '1:15', '1:20']), tbX + 180, tbY + 40);
  cell('Malzeme', 'S235JR / AISI 304', tbX, tbY + 80);
  cell('Revizyon', `R${rev}`, tbX + 180, tbY + 80);
  doc.font('R').fontSize(7).fillColor(INK3).text('Örnek çizim — Bilgi Kütüphanesi demo verisi. Ölçüler mm.', 40, H - 46);
  doc.end();
  await done;
}

// ── Sertifikalar ────────────────────────────────────────────────────────────

function watermark(doc, text = 'ÖRNEK') {
  const { width: W, height: H } = doc.page;
  doc.save();
  doc.rotate(-32, { origin: [W / 2, H / 2] });
  doc.font('B').fontSize(120).fillColor('#000000').fillOpacity(0.045).text(text, 0, H / 2 - 70, { width: W, align: 'center' });
  doc.restore();
  doc.fillOpacity(1);
}

export async function ceDeclaration(out, m) {
  const { doc, done } = create(out, { title: `${m.tr} — AB Uygunluk Beyanı` });
  watermark(doc);
  header(doc, { kicker: 'CE · AB Uygunluk Beyanı', rev: 1, lang: 'TR / EN' });
  title(doc, 'AB Uygunluk Beyanı', 'EC Declaration of Conformity');
  doc.y += 16;
  const rows = [
    ['Üretici / Manufacturer', 'Barmaksan Endüstri A.Ş. — Uğur Promilling'],
    ['Adres / Address', 'Organize Sanayi Bölgesi 7. Cad. No:27-31/1 Çorum / Türkiye'],
    ['Makine / Machine', `${m.tr} — ${m.en}`],
    ['Model / Type', m.models.join(', ')],
    ['Direktifler / Directives', '2006/42/AT Makine Emniyeti · 2014/35/AB Alçak Gerilim · 2014/30/AB EMC'],
    ['Standartlar / Standards', 'EN ISO 12100:2010 · EN 60204-1:2018 · EN ISO 13857:2019'],
  ];
  for (const [k, v] of rows) {
    doc.font('M').fontSize(7.5).fillColor(INK3).text(k.toUpperCase(), 44, doc.y + 8, { characterSpacing: 0.4 });
    doc.font('S').fontSize(10.5).fillColor(INK).text(v, 44, doc.y + 2, { width: doc.page.width - 88 });
  }
  doc.y += 18;
  paragraph(doc, 'Yukarıda tanımlanan makinenin, belirtilen direktiflerin ilgili temel sağlık ve güvenlik gerekliliklerine uygun olarak tasarlandığını ve üretildiğini beyan ederiz.', { color: INK2 });
  paragraph(doc, 'We hereby declare that the machine described above has been designed and manufactured in accordance with the relevant essential health and safety requirements of the directives listed.', { color: INK2 });
  doc.moveTo(44, doc.y + 60).lineTo(244, doc.y + 60).lineWidth(0.6).strokeColor(INK3).stroke();
  doc.font('R').fontSize(8).fillColor(INK3).text('Yetkili imza / Authorised signature', 44, doc.y + 66);
  footers(doc);
  doc.end();
  await done;
}

export async function certificate(out, { title: t, titleEn, standard, scope, scopeEn, issuer, number }) {
  const { doc, done } = create(out, { title: t });
  watermark(doc);
  const W = doc.page.width;
  doc.rect(28, 28, W - 56, doc.page.height - 56).lineWidth(0.8).strokeColor(GOLD).stroke();
  doc.image(path.join(ASSETS, 'brand', 'barmaksan-logo.png'), W / 2 - 80, 70, { height: 56 });
  doc.font('M').fontSize(9).fillColor(INK3).text('SERTİFİKA · CERTIFICATE', 44, 170, { width: W - 88, align: 'center', characterSpacing: 1.6 });
  doc.font('B').fontSize(30).fillColor(INK).text(standard, 44, 196, { width: W - 88, align: 'center' });
  doc.font('S').fontSize(14).fillColor(INK).text(t, 44, doc.y + 6, { width: W - 88, align: 'center' });
  if (titleEn) doc.font('R').fontSize(11).fillColor(INK2).text(titleEn, 44, doc.y + 2, { width: W - 88, align: 'center' });
  doc.font('R').fontSize(10).fillColor(INK2).text('Barmaksan Endüstri A.Ş.', 44, doc.y + 40, { width: W - 88, align: 'center' });
  doc.text('Organize Sanayi Bölgesi 7. Cad. No:27-31/1 Çorum / Türkiye', { width: W - 88, align: 'center' });
  doc.font('M').fontSize(8).fillColor(INK3).text('KAPSAM / SCOPE', 44, doc.y + 30, { width: W - 88, align: 'center', characterSpacing: 1 });
  doc.font('R').fontSize(10.5).fillColor(INK).text(scope, 90, doc.y + 6, { width: W - 180, align: 'center', lineGap: 3 });
  if (scopeEn) doc.font('R').fontSize(9.5).fillColor(INK2).text(scopeEn, 90, doc.y + 6, { width: W - 180, align: 'center', lineGap: 2 });
  doc.font('M').fontSize(8.5).fillColor(INK2).text(`Belge no: ${number}   ·   Düzenleyen: ${issuer}`, 44, doc.page.height - 150, { width: W - 88, align: 'center' });
  doc.font('R').fontSize(7).fillColor(INK3).text('Örnek belge — gerçek sertifika yüklendiğinde yeni sürüm olarak yerini alır.', 44, doc.page.height - 70, { width: W - 88, align: 'center' });
  doc.end();
  await done;
}

// ── Kurumsal ────────────────────────────────────────────────────────────────

export async function companyProfile(out, { lang = 'tr', images = [] }) {
  const tr = lang === 'tr';
  const { doc, done } = create(out, { title: tr ? 'Barmaksan Şirket Profili 2026' : 'Barmaksan Company Profile 2026' });
  const W = doc.page.width;
  const H = doc.page.height;
  // Kapak
  doc.rect(0, 0, W, H).fill('#161617');
  if (images[0]) doc.image(images[0], 0, 0, { cover: [W, H * 0.62], align: 'center', valign: 'center' });
  doc.rect(0, H * 0.62, W, H * 0.38).fill('#161617');
  doc.font('M').fontSize(9).fillColor(GOLD).text(tr ? 'ŞİRKET PROFİLİ · 2026' : 'COMPANY PROFILE · 2026', 48, H * 0.62 + 44, { characterSpacing: 1.6 });
  doc.font('B').fontSize(34).fillColor('#F2F2EF').text('Barmaksan', 48, doc.y + 10);
  doc.font('R').fontSize(14).fillColor('#A1A1A6').text(tr ? 'Uğur Promilling — 1955\'ten beri değirmen makineleri' : 'Uğur Promilling — milling machinery since 1955', 48, doc.y + 4);

  doc.addPage();
  header(doc, { kicker: tr ? 'Şirket Profili' : 'Company Profile', rev: 2026, lang: lang.toUpperCase() });
  title(doc, tr ? 'Nesilden nesile 70 yıl' : 'Seventy years, generation to generation');
  doc.y += 10;
  paragraph(doc, tr
    ? 'Uğur Promilling endüstriyel hayatına 1955 yılında Çorum\'da 60 m² alanda başladı. Yıllar içinde gelişmiş sanayi ülkeleri dahil birçok ülkeye ihracat yapan firma, bugün 40.000 m² kapalı alana sahip üretim tesisinde değirmencilik teknolojisini geliştirmeye devam ediyor. Uğur Promilling bir Barmaksan Endüstri A.Ş. markasıdır.'
    : 'Uğur Promilling started its industrial life in 1955 in Çorum, in a 60 m² workshop. Exporting to many countries including industrialised ones, the company today continues to develop milling technology in its 40,000 m² covered production facility. Uğur Promilling is a brand of Barmaksan Endüstri A.Ş.');
  const facts = tr
    ? [['70', 'yıllık tecrübe'], ['40.000 m²', 'kapalı üretim alanı'], ['500+', 'anahtar teslim proje'], ['120', 'ülkeye ihracat'], ['2–3 saat', 'yedek parça tedarik süresi']]
    : [['70', 'years of experience'], ['40,000 m²', 'covered production area'], ['500+', 'turnkey projects'], ['120', 'export countries'], ['2–3 hours', 'spare part supply time']];
  let fx = 44;
  const fy = doc.y + 18;
  for (const [n, l] of facts) {
    doc.font('B').fontSize(18).fillColor(INK).text(n, fx, fy, { width: 100 });
    doc.font('R').fontSize(8).fillColor(INK2).text(l, fx, fy + 26, { width: 96 });
    fx += 103;
  }
  doc.y = fy + 70;
  if (images[1]) doc.image(images[1], 44, doc.y, { cover: [W - 88, 220], align: 'center', valign: 'center' });
  doc.y += 236;
  heading(doc, tr ? 'Ürün grupları' : 'Product groups');
  paragraph(doc, tr
    ? 'Temizleme ve tavlama makineleri · Öğütme makineleri · Taşıma ekipmanları ve sistemleri · Paketleme makineleri ve sistemleri'
    : 'Cleaning and dampening machines · Milling machines · Conveying equipment and systems · Packaging machines and systems');
  footers(doc);
  doc.end();
  await done;
}

export async function customerDoc(out, { title: t, titleEn, sections, kicker }) {
  const { doc, done } = create(out, { title: t });
  header(doc, { kicker, rev: 1 });
  title(doc, t, titleEn);
  doc.y += 12;
  for (const [h, body] of sections) {
    heading(doc, h);
    paragraph(doc, body);
  }
  footers(doc);
  doc.end();
  await done;
}
