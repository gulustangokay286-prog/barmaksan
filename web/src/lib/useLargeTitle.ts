import { useEffect, type RefObject } from 'react';
import { useChromeActions } from './ui';

/** Öğe üst barın altına girdiğinde üst bar kompakt başlığı gösterir. */
export function useLargeTitle(ref: RefObject<HTMLElement | null>, deps: unknown[] = []) {
  const { setTitleVisible } = useChromeActions();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const bar = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--bar-h'), 10) || 56;
    const io = new IntersectionObserver(([e]) => setTitleVisible(e.isIntersecting), { rootMargin: `-${bar}px 0px 0px 0px`, threshold: 0.35 });
    io.observe(el);
    return () => {
      io.disconnect();
      setTitleVisible(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setTitleVisible, ...deps]);
}
