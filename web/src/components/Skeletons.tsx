// Sayfa iskeletleri: veri gelene kadar sayfanın GERÇEK yerleşimini çizer (aynı ızgara, aynı
// ölçüler), böylece içerik geldiğinde hiçbir şey yerinden oynamaz. Parıltı (gradient) yok;
// bloklar sırayla nefes alır (--i ile kademeli gecikme).
import type { CSSProperties } from 'react';
import p from '../pages/pages.module.css';
import s from './Skeletons.module.css';

const i = (n: number) => ({ ['--i' as string]: n }) as CSSProperties;

export function Bone({ w, h, r, n = 0, style }: { w?: number | string; h: number | string; r?: number; n?: number; style?: CSSProperties }) {
  return <span className={`skeleton ${s.bone}`} style={{ width: w, height: h, borderRadius: r, ...i(n), ...style }} />;
}

export function HeaderSkeleton({ lead = true }: { lead?: boolean }) {
  return (
    <div className={s.header}>
      <Bone w={120} h={12} n={0} />
      <Bone w="min(420px, 70%)" h={40} r={8} n={1} />
      {lead && <Bone w="min(560px, 90%)" h={14} n={2} />}
      {lead && <Bone w="min(380px, 60%)" h={14} n={3} />}
    </div>
  );
}

export function TilesSkeleton({ count = 10 }: { count?: number }) {
  return (
    <ul className={`${p.tiles} ${s.tiles}`} aria-hidden="true">
      {Array.from({ length: count }, (_, n) => (
        <li key={n} className={s.tile}>
          <Bone h="auto" r={16} n={n} style={{ aspectRatio: '1 / 1' }} />
          <Bone w="72%" h={13} n={n} />
          <Bone w="38%" h={10} n={n} />
        </li>
      ))}
    </ul>
  );
}

export function RowsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul className={s.rows} aria-hidden="true">
      {Array.from({ length: count }, (_, n) => (
        <li key={n} className={s.row}>
          <Bone w={36} h={48} r={5} n={n} />
          <span className={s.rowBody}>
            <Bone w={`${66 - (n % 3) * 12}%`} h={14} n={n} />
            <Bone w="30%" h={10} n={n} />
          </span>
          <Bone w={44} h={12} n={n} />
        </li>
      ))}
    </ul>
  );
}

export function MediaSkeleton({ count = 12 }: { count?: number }) {
  const ratios = ['4 / 3', '3 / 4', '16 / 9', '1 / 1', '4 / 3', '16 / 10'];
  return (
    <div className={s.media} aria-hidden="true">
      {Array.from({ length: count }, (_, n) => (
        <div key={n} className={s.mediaItem}>
          <Bone h="auto" r={12} n={n} style={{ aspectRatio: ratios[n % ratios.length] }} />
          <Bone w="60%" h={12} n={n} />
        </div>
      ))}
    </div>
  );
}

export function FolderSkeleton() {
  return (
    <div className={p.page}>
      <HeaderSkeleton />
      <div style={{ marginTop: 32 }}>
        <TilesSkeleton />
      </div>
    </div>
  );
}

export function MachineSkeleton() {
  return (
    <div className={p.page} aria-busy="true">
      <div className={p.machineLayout}>
        <div className={p.machineAside}>
          <Bone h="auto" r={22} n={0} style={{ aspectRatio: '1 / 0.86' }} />
          <div className={s.stack} style={{ marginTop: 22 }}>
            <Bone w="78%" h={34} r={8} n={1} />
            <Bone w="40%" h={14} n={2} />
            <Bone w="94%" h={12} n={3} />
            <Bone w="88%" h={12} n={3} />
            <Bone w="56%" h={12} n={4} />
          </div>
        </div>
        <div className={p.machineMain}>
          <div className={s.sheet}>
            <Bone w={128} h="auto" r={8} n={1} style={{ aspectRatio: '1 / 1.414' }} />
            <div className={s.stack}>
              <Bone w={90} h={10} n={2} />
              <Bone w="70%" h={24} r={6} n={2} />
              <Bone w="45%" h={12} n={3} />
              <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                <Bone w={76} h={36} r={9} n={4} />
                <Bone w={88} h={36} r={9} n={4} />
              </div>
            </div>
          </div>
          {[0, 1, 2].map((g) => (
            <div key={g} className={s.group}>
              <Bone w={140} h={14} n={g + 3} />
              <RowsSkeleton count={g === 0 ? 2 : 1} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DocumentSkeleton() {
  return (
    <div className={p.page} aria-busy="true">
      <div className={p.docLayout}>
        <div className={p.viewer}>
          <Bone h="auto" r={6} n={0} style={{ aspectRatio: '1 / 1.414', width: '100%' }} />
        </div>
        <aside className={p.panel}>
          <div className={s.stack}>
            <Bone w={90} h={10} n={1} />
            <Bone w="90%" h={28} r={6} n={1} />
            <Bone w="60%" h={28} r={6} n={2} />
          </div>
          <div className={s.stack}>
            <Bone h={44} r={11} n={3} />
            <div style={{ display: 'flex', gap: 8 }}>
              <Bone h={36} r={9} n={3} style={{ flex: 1 }} />
              <Bone h={36} r={9} n={3} style={{ flex: 1 }} />
            </div>
            <Bone h={58} r={12} n={4} />
          </div>
          <div className={s.stack}>
            {[0, 1, 2, 3].map((n) => <Bone key={n} w={`${90 - n * 12}%`} h={12} n={5 + n} />)}
          </div>
        </aside>
      </div>
    </div>
  );
}
