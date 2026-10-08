// Tema: açık / koyu. Seçim localStorage'da ('bk.theme'); varsayılan: 'dark' (koyu mod).
// index.html'deki satır içi betik ilk boyamadan önce <html data-theme> koyar (yanıp sönme olmaz);
// burası yalnızca değiştirme ve dinleme içindir.
import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';
const STORE = 'bk.theme';
const listeners = new Set<() => void>();

function defaultTheme(): Theme {
  return 'dark';
}

export function getTheme(): Theme {
  const t = document.documentElement.dataset.theme;
  return t === 'dark' || t === 'light' ? t : defaultTheme();
}

export function setTheme(next: Theme) {
  const root = document.documentElement;
  // Renkler tek seferde değil, kısa bir geçişle dönsün (yalnızca değişim anında).
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.classList.add('theme-switch');
    window.setTimeout(() => root.classList.remove('theme-switch'), 420);
  }
  root.dataset.theme = next;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'dark' ? '#2a2a2e' : '#edede9');
  try {
    localStorage.setItem(STORE, next);
  } catch {
    /* gizli sekme */
  }
  listeners.forEach((f) => f());
}

function subscribe(f: () => void) {
  listeners.add(f);
  return () => {
    listeners.delete(f);
  };
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, getTheme, () => 'dark' as Theme);
  return [theme, setTheme];
}
