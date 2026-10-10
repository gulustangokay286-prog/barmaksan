// "Pervane": Uğur Promilling görsel kılavuzundaki desen — logodaki değirmen kanadının tek başına
// hâli: dış çerçeve, ortada direk, aralarında çıtalar. Renk currentColor; boyut ve açı çağıranda.
// Süs değil marka dili: boş alanlarda büyük ve soluk, köşelerden taşarak kullanılır.
import { useId, type CSSProperties } from 'react';

export function Pervane({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 120 400" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeLinecap="square">
        <rect x="14" y="14" width="92" height="372" strokeWidth="16" />
        <path d="M60 14V386" strokeWidth="10" />
        <path d="M14 88H106M14 162H106M14 236H106M14 310H106" strokeWidth="10" />
      </g>
    </svg>
  );
}

/** Desende tekrarlanan küçük kanat: 40×140, sol üst köşesi (x, y). */
function Sail({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="0" y="0" width="40" height="140" strokeWidth="5" />
      <path d="M20 0V140M0 28H40M0 56H40M0 84H40M0 112H40" strokeWidth="3.5" />
    </g>
  );
}

/**
 * Pervane deseni (kılavuz s.9): kanatlar çapraz, şaşırtmalı sıralar hâlinde. Tekrar eden bir
 * <pattern> olduğu için kap ne boyda olursa olsun aynı sıklıkta kalır.
 */
export function PervanePattern({ className, scale = 1 }: { className?: string; scale?: number }) {
  const id = `pervane-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <svg className={className} aria-hidden="true" focusable="false">
      <defs>
        <pattern id={id} width="128" height="176" patternUnits="userSpaceOnUse" patternTransform={`rotate(-40) scale(${scale})`}>
          <g fill="none" stroke="currentColor" strokeLinecap="square">
            <Sail x={12} y={18} />
            <Sail x={76} y={106} />
            <Sail x={76} y={-70} />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
