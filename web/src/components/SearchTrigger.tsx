// Arama düğmesi (giriş sahnesi ve üst bar). Basınca arama paneli bu düğmenin kendisinden
// büyür (paylaşılan öğe geçişi, bkz. SearchPalette): düğmenin büyüteci ve yazısı panelin
// giriş satırına birebir oturur, düğme panele dönüşmüş gibi görünür.
import { Icon } from './Icon';
import { useI18n } from '../lib/i18n';
import { useUi } from '../lib/ui';
import s from './SearchTrigger.module.css';

export function SearchTrigger({ variant }: { variant: 'hero' | 'bar' }) {
  const { lang } = useI18n();
  const { openSearch } = useUi();
  const placeholder = variant === 'hero'
    ? (lang === 'tr' ? 'Makine, belge ya da parça kodu ara' : 'Search machines, documents or part codes')
    : (lang === 'tr' ? 'Ara…' : 'Search…');
  return (
    <button
      type="button"
      className={s.trigger}
      data-variant={variant}
      data-search-trigger={variant}
      onClick={(e) => openSearch('', e.currentTarget)}
      aria-label={lang === 'tr' ? 'Kütüphanede ara' : 'Search the library'}
      aria-haspopup="dialog"
    >
      <span className={s.icon}><Icon name="search" size={variant === 'hero' ? 20 : 16} strokeWidth={variant === 'hero' ? 1.7 : 1.6} /></span>
      <span className={s.placeholder}>{placeholder}</span>
    </button>
  );
}
