// Açılış perdesi (index.html) ile uygulama arasındaki köprü.
// Perde gerçek yükleme durumunu gösterir: paket → ilk veri → ilk görsel. Hazır olunca açılır;
// açılırken uygulama kendi giriş animasyonlarını oynatır (useAppReady).
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { bootstrapQuery, ensure, queryClient } from './query';
import type { Bootstrap } from './api';

type SplashApi = { progress(p: number): void; finish(): void; onOpen(f: () => void): void; readonly opened: boolean };
const api = () => (window as unknown as { __splash?: SplashApi }).__splash;

export const splash = {
  progress: (p: number) => api()?.progress(p),
  finish: () => api()?.finish(),
};

const Ready = createContext(true);
/** Perde ayrılmaya başladığında true olur; giriş animasyonları bunu bekler. */
export const useAppReady = () => useContext(Ready);

function decodeImage(src: string) {
  return new Promise<void>((resolve) => {
    const img = new Image();
    img.src = src;
    img.decode().then(() => resolve(), () => resolve());
  });
}

// Uygulama paketi çalışır çalışmaz başlar: React çizilmeden veri ve ilk görsel istenir.
let started: Promise<void> | null = null;
export function warmUp() {
  if (started) return started;
  splash.progress(0.3);
  const compact = window.matchMedia('(max-width: 1023px), (prefers-reduced-motion: reduce)').matches;
  const needsBackground = !compact && window.location.pathname === '/';
  // Ana sayfanın ilk fotoğrafı yönetimden gelir: önce veri, sonra o görsel çözülür.
  started = ensure(bootstrapQuery())
    .then(() => {
      splash.progress(0.7);
      const boot = queryClient.getQueryData<Bootstrap>(['bootstrap']);
      const first = needsBackground ? boot?.home?.slides?.[0]?.src : null;
      return first ? decodeImage(first) : undefined;
    })
    .then(() => { splash.progress(0.9); });
  return started;
}

export function SplashGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(() => !api() || !!api()!.opened);
  useEffect(() => {
    const s = api();
    if (!s || s.opened) {
      setReady(true);
      return;
    }
    s.onOpen(() => setReady(true));
    void warmUp().then(() => s.finish());
  }, []);
  return <Ready.Provider value={ready}>{children}</Ready.Provider>;
}
