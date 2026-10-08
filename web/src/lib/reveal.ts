import { motionValue } from 'motion/react';

/**
 * Üst bardaki aramanın görünürlüğü (0–1). Ana sayfada büyük arama alanı görünürken bunu
 * kaydırmaya bağlı olarak sürer; React yeniden çizilmez, yalnızca opaklık değişir.
 */
export const topSearchReveal = motionValue(1);
