// Kurumsal kimlik: renkler, logolar, yazı karakteri. Tek sayfa, her şey kopyalanabilir.
// Renkler ugurpromilling.com'dan ölçüldü (lib/brand.ts). Görsel, "Türkiye Projelerimiz" bannerı.
import { useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform, type Variants } from 'motion/react';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/PageHeader';
import { Segmented } from '../components/ui';
import { useI18n } from '../lib/i18n';
import { copyText, usePageChrome, useUi } from '../lib/ui';
import { BRAND_IMAGE, IMAGE_MEAN, IMAGE_PALETTE, LOGOS, SITE_PALETTE, TYPE_SCALE, isLight, rgbString, swatchName, swatchRole, type Swatch } from '../lib/brand';
import p from './pages.module.css';
import b from './brand.module.css';

const ease = [0.22, 1, 0.36, 1] as const;
const gridIn: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.045, delayChildren: 0.05 } } };
const itemIn: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.985 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease } },
};

export default function Brand() {
  const { t, lang } = useI18n();
  usePageChrome(t('brand'), { to: '/k/kurumsal', label: t('corporate') });

  return (
    <div className={`${p.page} fade-in`}>
      <PageHeader
        kicker="Barmaksan · Uğur Promilling"
        title={t('brand')}
        lead={t('brandLead')}
        meta={[
          <span key="c">{SITE_PALETTE.length + IMAGE_PALETTE.length} {lang === 'tr' ? 'renk' : 'colours'}</span>,
          <span key="l">{LOGOS.length} {lang === 'tr' ? 'logo' : 'logos'}</span>,
          <span key="s">ugurpromilling.com</span>,
        ]}
      />

      <Visual />

      <Block id="renkler" title={t('palette')} lead={t('paletteSiteLead')}>
        <Palettes />
      </Block>

      <Block id="logolar" title={t('logos')} lead={t('logosLead')}>
        <Logos />
      </Block>

      <Block id="yazi" title={t('typography')} lead={t('typographyLead')}>
        <Typography />
      </Block>

      <Block id="kullanim" title={t('usage')}>
        <Usage />
      </Block>
    </div>
  );
}

// ── Bölüm: sol başlık, sağ içerik (geniş ekranda), tek sütun (dar) ──────────

function Block({ id, title, lead, children }: { id: string; title: string; lead?: string; children: ReactNode }) {
  return (
    <section id={id} className={b.block}>
      <motion.header
        className={b.blockHead}
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.6, ease }}
      >
        <h2 className={b.blockTitle}>{title}</h2>
        {lead && <p className={b.blockLead}>{lead}</p>}
      </motion.header>
      <div className={b.blockBody}>{children}</div>
    </section>
  );
}

// ── Kurumsal görsel: banner, kaydırmaya bağlı hafif paralaks, altında ton şeridi ──

function Visual() {
  const { t, lang } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [-18, 18]);
  const total = IMAGE_PALETTE.reduce((n, s) => n + s.weight, 0);
  return (
    <motion.figure
      ref={ref}
      className={b.visual}
      initial={{ opacity: 0, y: 24, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.9, ease, delay: 0.1 }}
    >
      <div className={b.visualFrame} style={{ background: IMAGE_MEAN }}>
        <motion.picture style={{ y }}>
          <source media="(max-width: 600px)" srcSet={BRAND_IMAGE.mobile} />
          <img src={BRAND_IMAGE.src} width={BRAND_IMAGE.width} height={BRAND_IMAGE.height} alt={t('brandVisual')} decoding="async" fetchPriority="high" draggable={false} />
        </motion.picture>
      </div>
      <div className={b.tones} aria-hidden="true">
        {IMAGE_PALETTE.map((s, i) => (
          <motion.span
            key={s.hex}
            style={{ background: s.hex, flexGrow: s.weight / total }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.5, ease, delay: 0.5 + i * 0.05 }}
          />
        ))}
      </div>
      <figcaption className={b.visualCaption}>
        <span>{t('brandVisual')} · {lang === 'tr' ? 'Türkiye Projelerimiz' : 'Türkiye Projects'}</span>
        <a href="https://www.ugurpromilling.com/tr/turkiye-projelerimiz" target="_blank" rel="noopener">
          ugurpromilling.com <Icon name="external" size={12} strokeWidth={1.8} />
        </a>
      </figcaption>
    </motion.figure>
  );
}

// ── Paletler ────────────────────────────────────────────────────────────────

function Palettes() {
  const { t } = useI18n();
  const [which, setWhich] = useState<'site' | 'image'>('site');
  const list = which === 'site' ? SITE_PALETTE : IMAGE_PALETTE;
  const max = Math.max(...list.map((s) => s.weight));
  return (
    <div>
      <div className={b.paletteBar}>
        <Segmented id="palette" size="sm" value={which} onChange={setWhich} options={[{ value: 'site', label: t('paletteSite') }, { value: 'image', label: t('paletteImage') }]} />
        <span className={b.paletteHint}>{which === 'site' ? t('paletteSiteLead') : t('paletteImageLead')}</span>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.ul key={which} className={b.swatches} variants={gridIn} initial="hidden" animate="show" exit={{ opacity: 0, transition: { duration: 0.14 } }}>
          {list.map((s) => (
            <motion.li key={s.hex} variants={itemIn}>
              <SwatchCard s={s} max={max} unit={which === 'site' ? 'x' : '%'} />
            </motion.li>
          ))}
        </motion.ul>
      </AnimatePresence>
    </div>
  );
}

function SwatchCard({ s, max, unit }: { s: Swatch; max: number; unit: 'x' | '%' }) {
  const { t, lang } = useI18n();
  const { notify } = useUi();
  const [copied, setCopied] = useState<'hex' | 'rgb' | null>(null);
  const light = s.light ?? isLight(s.hex);
  const copy = async (what: 'hex' | 'rgb') => {
    const text = what === 'hex' ? s.hex : `rgb(${rgbString(s.hex)})`;
    if (await copyText(text)) {
      setCopied(what);
      notify(`${text} · ${t('copied')}`);
      window.setTimeout(() => setCopied((c) => (c === what ? null : c)), 1400);
    }
  };
  return (
    <div className={b.swatch} data-light={light || undefined}>
      <button className={b.swatchChip} style={{ background: s.hex }} onClick={() => copy('hex')} aria-label={`${s.hex} · ${t('copyHex')}`}>
        <span className={b.swatchHexOn}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={copied === 'hex' ? 'ok' : 'hex'} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
              {copied === 'hex' ? <><Icon name="check" size={13} strokeWidth={2} /> {t('copied')}</> : s.hex}
            </motion.span>
          </AnimatePresence>
        </span>
        <span className={b.swatchWeight} aria-hidden="true">
          <span style={{ transform: `scaleX(${s.weight / max})` }} />
        </span>
      </button>
      <div className={b.swatchBody}>
        <span className={b.swatchName}>{swatchName(s, lang)}</span>
        <span className={b.swatchRole}>{swatchRole(s, lang)}</span>
        <span className={b.swatchCodes}>
          <button onClick={() => copy('hex')} className="mono">{s.hex}</button>
          <button onClick={() => copy('rgb')} className="mono" data-on={copied === 'rgb' || undefined}>{copied === 'rgb' ? t('copied') : rgbString(s.hex)}</button>
          <span className={b.swatchUnit}>{s.weight}{unit}</span>
        </span>
      </div>
    </div>
  );
}

// ── Logolar ─────────────────────────────────────────────────────────────────

function Logos() {
  const { lang } = useI18n();
  return (
    <motion.ul className={b.logos} variants={gridIn} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.25 }}>
      {LOGOS.map((l) => (
        <motion.li key={l.key} variants={itemIn}>
          <div className={b.logo} data-ground={l.ground}>
            <span className={b.logoStage}>
              <img src={l.src} alt={l.brand} draggable={false} decoding="async" />
            </span>
            <span className={b.logoFoot}>
              <span className={b.logoName}>
                {l.brand}
                <span className={b.logoGround}>{l.ground === 'light' ? (lang === 'tr' ? 'açık zemin' : 'light ground') : (lang === 'tr' ? 'koyu zemin' : 'dark ground')}</span>
              </span>
              <a href={l.src} download className={b.logoDl}>
                <Icon name="download" size={14} strokeWidth={1.7} />
                {l.ext}
              </a>
            </span>
          </div>
        </motion.li>
      ))}
    </motion.ul>
  );
}

// ── Yazı karakteri ──────────────────────────────────────────────────────────

function Typography() {
  const { lang } = useI18n();
  return (
    <div className={b.type}>
      <motion.p
        className={b.typeSpecimen}
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.7, ease }}
      >
        Barmaksan
        <span>Uğur Promilling</span>
      </motion.p>
      <motion.ol className={b.typeScale} variants={gridIn} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }}>
        {TYPE_SCALE.map((row) => (
          <motion.li key={row.key} variants={itemIn} className={b.typeRow}>
            <span className={b.typeLabel}>{lang === 'tr' ? row.tr : row.en}</span>
            <span className={b.typeSample} style={{ fontSize: row.size, fontWeight: row.weight, letterSpacing: row.tracking, lineHeight: 1.1 }}>
              {lang === 'tr' ? 'Her dosya en güncel hâliyle' : 'Every file, latest version'}
            </span>
            <span className={`${b.typeMeta} mono`}>{row.size}px · {row.weight}</span>
          </motion.li>
        ))}
      </motion.ol>
      <p className={b.typeAlphabet} aria-hidden="true">
        ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ<br />abcçdefgğhıijklmnoöprsştuüvyz<br />0123456789
      </p>
    </div>
  );
}

// ── Kullanım kuralları ──────────────────────────────────────────────────────

function Usage() {
  const { lang } = useI18n();
  const rules = lang === 'tr' ? [
    ['Altın yalnızca anlam taşıdığında', 'Güncel sürüm, aktif durum, birincil eylem. Dekor olarak kullanılmaz.'],
    ['Düz zeminler', 'Gradient, parıltı ve gölge efektleri yok. Derinlik yalnızca yüzen yüzeylerde.'],
    ['Logo etrafında boşluk', 'Logonun yüksekliğinin en az yarısı kadar boş alan bırakın; oranı bozmayın.'],
    ['Fotoğraf zeminleri', 'Görsel paletindeki koyu tonlar üzerine beyaz metin; kontrast en az 4.5:1.'],
  ] : [
    ['Gold only when it means something', 'Current version, active state, primary action. Never as decoration.'],
    ['Flat grounds', 'No gradients, glows or shadow effects. Depth only on floating surfaces.'],
    ['Clear space around the logo', 'Leave at least half the logo height clear; never distort the proportions.'],
    ['Photo grounds', 'White text over the dark tones of the image palette; contrast at least 4.5:1.'],
  ];
  return (
    <motion.ol className={b.rules} variants={gridIn} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }}>
      {rules.map(([title, text], i) => (
        <motion.li key={title} variants={itemIn} className={b.rule}>
          <span className={`${b.ruleN} mono`}>{String(i + 1).padStart(2, '0')}</span>
          <span className={b.ruleBody}>
            <span className={b.ruleTitle}>{title}</span>
            <span className={b.ruleText}>{text}</span>
          </span>
        </motion.li>
      ))}
    </motion.ol>
  );
}
