// Paylaşılan öğe morph'u: geçiş adı yalnızca tıklanan öğeye, tıklandığı anda verilir.
// Böylece aynı makine sayfada iki yerde görünse bile ad hiçbir zaman çakışmaz
// (çakışma tarayıcının geçişi iptal etmesine yol açar).

const supported = typeof document !== 'undefined' && 'startViewTransition' in document;

export function markMorph(el: Element | null | undefined, name: 'machine-hero' | 'doc-page') {
  if (!supported || !el) return;
  document.querySelectorAll<HTMLElement>(`[data-vt-source="${name}"]`).forEach((other) => {
    other.style.viewTransitionName = '';
    delete other.dataset.vtSource;
  });
  const target = el as HTMLElement;
  target.style.viewTransitionName = name;
  target.dataset.vtSource = name;
  // Morph'lu geçişte sayfa girişi (CSS) devre dışı: iki animasyon üst üste binmesin.
  document.documentElement.dataset.morph = '1';
  window.setTimeout(() => { delete document.documentElement.dataset.morph; }, 900);
  window.setTimeout(() => {
    if (target.dataset.vtSource === name) {
      target.style.viewTransitionName = '';
      delete target.dataset.vtSource;
    }
  }, 1500);
}
