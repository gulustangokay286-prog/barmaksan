import type { Transition, Variants } from 'motion/react';

// Apple'ın "damping + response" ikilisi: bounce 0 = kritik sönüm, duration ≈ response.
export const spring = {
  /** Varsayılan: sayfa, panel, liste. Zıplama yok. */
  base: { type: 'spring', bounce: 0, duration: 0.5 } as Transition,
  /** Basma, hover, küçük durum değişimleri. */
  snappy: { type: 'spring', bounce: 0, duration: 0.28 } as Transition,
  /** Yerleşim kayması (aktif çubuk, arama yuvası). */
  layout: { type: 'spring', bounce: 0, duration: 0.42 } as Transition,
  /** Kullanıcı bir şeyi fırlattığında: hafif zıplama. */
  fling: { type: 'spring', bounce: 0.14, duration: 0.42 } as Transition,
};

/** Bulanıklıktan netleşerek gelen içerik. */
export const fadeBlur: Variants = {
  hidden: { opacity: 0, y: 10, filter: 'blur(10px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: spring.base },
  exit: { opacity: 0, filter: 'blur(6px)', transition: { duration: 0.16, ease: [0.64, 0, 0.78, 0] } },
};

export const fadeOnly: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.24 } },
  exit: { opacity: 0, transition: { duration: 0.14 } },
};

/** Liste kademesi: ilk 8 öğe sırayla, gerisi birlikte (hız). */
export const stagger = (i: number, step = 0.035) => ({ ...spring.base, delay: Math.min(i, 8) * step });

export const listParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.035, delayChildren: 0.04 } },
};
