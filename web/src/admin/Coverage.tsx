// Eksik belgeler: makineler × beklenen belge türleri. Boş hücre, o makinede o türün henüz
// olmadığını gösterir; basınca yükleme o makine ve türle hazır açılır.
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { Link } from '../lib/link';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useDocTypes, useUi } from '../lib/ui';
import { PageHead, useCoverageTypes } from './shared';
import a from './admin.module.css';

export default function AdminCoverage() {
  const { pick, lang } = useI18n();
  const types = useDocTypes();
  const { setUpload } = useUi();
  const coverage = useQuery({ queryKey: ['admin', 'coverage'], queryFn: api.adminCoverage });
  const REQUIRED_TYPES = useCoverageTypes();
  const [onlyMissing, setOnlyMissing] = useState(true);

  const rows = useMemo(() => {
    const list = coverage.data ?? [];
    return onlyMissing ? list.filter((m) => REQUIRED_TYPES.some((t) => !m.types.includes(t))) : list;
  }, [coverage.data, onlyMissing, REQUIRED_TYPES]);
  const totals = REQUIRED_TYPES.map((t) => (coverage.data ?? []).filter((m) => m.types.includes(t)).length);
  const missingCount = (coverage.data ?? []).reduce((n, m) => n + REQUIRED_TYPES.filter((t) => !m.types.includes(t)).length, 0);

  return (
    <div className={a.page}>
      <PageHead
        title={lang === 'tr' ? 'Eksik belgeler' : 'Missing documents'}
        lead={coverage.data
          ? (lang === 'tr' ? `${coverage.data.length} makinede toplam ${missingCount} eksik belge. Boş hücreye basınca yükleme o makine ve türle açılır.` : `${missingCount} missing documents across ${coverage.data.length} machines. Click an empty cell to upload for that machine and type.`)
          : undefined}
        actions={
          <label className={a.toggle}>
            <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
            <span>{lang === 'tr' ? 'Yalnızca eksiği olanlar' : 'Only machines with gaps'}</span>
          </label>
        }
      />

      <div className={a.matrixWrap}>
        <table className={a.matrix}>
          <thead>
            <tr>
              <th className={a.matrixMachine}>{lang === 'tr' ? 'Makine' : 'Machine'}</th>
              {REQUIRED_TYPES.map((t, i) => (
                <th key={t}>
                  <span className={a.matrixType}>{types.get(t)?.short ?? pick(types.get(t)?.name)}</span>
                  <span className={a.matrixTotal}>{totals[i]}/{coverage.data?.length ?? 0}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.slug}>
                <td className={a.matrixMachine}>
                  <Link to={`/m/${m.slug}`}>{pick(m.name)}</Link>
                  {m.category && <span>{pick(m.category.name)}</span>}
                </td>
                {REQUIRED_TYPES.map((t) => (
                  <td key={t}>
                    {m.types.includes(t) ? (
                      <span className={a.have} aria-label={lang === 'tr' ? 'Var' : 'Present'}><Icon name="check" size={15} strokeWidth={1.8} /></span>
                    ) : (
                      <button className={a.add} onClick={() => setUpload({ mode: 'new', folder: m.slug, type: t })} aria-label={`${pick(m.name)} — ${pick(types.get(t)?.name)} ${lang === 'tr' ? 'yükle' : 'upload'}`}>
                        <Icon name="plus" size={14} strokeWidth={1.8} />
                      </button>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!coverage.data && <div className={a.skelList}>{Array.from({ length: 8 }, (_, i) => <span key={i} className="skeleton" style={{ ['--i' as string]: i }} />)}</div>}
      </div>
      <p className={a.legend}>
        {REQUIRED_TYPES.map((t) => <span key={t}><b>{types.get(t)?.short ?? pick(types.get(t)?.name)}</b> {pick(types.get(t)?.name)}</span>)}
        <Link to="/admin/turler" className={a.more}>{lang === 'tr' ? 'Beklenen türleri değiştir' : 'Change expected types'}</Link>
      </p>
    </div>
  );
}
