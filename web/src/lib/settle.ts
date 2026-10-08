// Bölüm kilidi: kaydırma durduğunda, üst kenara yaklaşmış bir bölüm başlığı yumuşakça yerine
// oturur. CSS scroll-snap yerine JS: Safari'de snap sert ve kesik; burada süre tarayıcının
// yumuşak kaydırması, yön ve mesafe kontrollü, hero'nun kendi kilidiyle çakışmaz.
//
// Hedef: [data-settle] taşıyan her öğe. Oturduğu yer: üst bar + öğenin scroll-margin-top'u.
import { useEffect } from 'react';

export function useSectionSettle() {
  useEffect(() => {
    // Native touch scrolling stays free on the compact hero layout.
    if (window.matchMedia('(max-width: 1023px), (prefers-reduced-motion: reduce)').matches) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let timer = 0;
    let gliding = false;
    let pointerDown = false;
    let lastY = window.scrollY;
    let dir = 0;

    const barH = () => parseInt(getComputedStyle(document.documentElement).getPropertyValue('--bar-h'), 10) || 56;

    const settle = () => {
      if (gliding) {
        gliding = false;
        return;
      }
      if (pointerDown || document.querySelector('[role="dialog"]')) return;
      // Hero sahnesi hâlâ sabitken onun kendi kilidi çalışır.
      const pin = document.querySelector('[data-pin]');
      if (pin && pin.getBoundingClientRect().bottom > window.innerHeight + 1) return;

      const vh = window.innerHeight;
      const bar = barH();
      // Kaydırma yönünde daha geniş, ters yönde dar bant: aşağı inerken yaklaşan başlık
      // yakalanır, az önce geçilen başlık geri çekilmez.
      const ahead = vh * 0.36;
      const behind = vh * 0.1;
      let best: { d: number } | null = null;
      let aligned = false;
      document.querySelectorAll<HTMLElement>('[data-settle]').forEach((el) => {
        const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
        const d = el.getBoundingClientRect().top - (bar + margin);
        if (Math.abs(d) <= 3) aligned = true;
        const lo = dir >= 0 ? -behind : -ahead;
        const hi = dir >= 0 ? ahead : behind;
        if (d > lo && d < hi && (!best || Math.abs(d) < Math.abs(best.d))) best = { d };
      });
      // Bir başlık zaten yerindeyse dokunma (bir sonrakine atlamasın).
      if (aligned || !best) return;
      const max = document.documentElement.scrollHeight - vh;
      const top = Math.min(max, Math.max(0, window.scrollY + (best as { d: number }).d));
      if (Math.abs(top - window.scrollY) < 3) return;
      gliding = true;
      window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
    };

    const onScroll = () => {
      const y = window.scrollY;
      if (y !== lastY) dir = y > lastY ? 1 : -1;
      lastY = y;
      window.clearTimeout(timer);
      timer = window.setTimeout(settle, 170);
    };
    const onDown = () => { pointerDown = true; };
    const onUp = () => {
      pointerDown = false;
      window.clearTimeout(timer);
      timer = window.setTimeout(settle, 170);
    };
    // Kullanıcı yeniden kaydırmaya başlarsa süzülme ona bırakılır.
    const onUserInput = () => { gliding = false; };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    window.addEventListener('wheel', onUserInput, { passive: true });
    window.addEventListener('touchstart', onUserInput, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('wheel', onUserInput);
      window.removeEventListener('touchstart', onUserInput);
    };
  }, []);
}
