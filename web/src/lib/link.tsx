// Uygulama içi bağlantılar varsayılan olarak ANINDA geçer (kenar çubuğu, kırıntı, liste).
// View Transitions yalnızca paylaşılan görsel morph'u olan bağlantılarda `viewTransition` ile açılır:
// tüm sayfayı yakalayan geçiş, sıradan gezinmede gecikme hissinin ana kaynağıydı.
import { forwardRef, useCallback } from 'react';
import { Link as RRLink, NavLink as RRNavLink, useNavigate, type LinkProps, type NavLinkProps, type NavigateOptions, type To } from 'react-router';

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(props, ref) {
  return <RRLink ref={ref} {...props} />;
});

export const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(function NavLink(props, ref) {
  return <RRNavLink ref={ref} {...props} />;
});

export function useGo() {
  const navigate = useNavigate();
  return useCallback((to: To | number, opts?: NavigateOptions) => {
    if (typeof to === 'number') return navigate(to);
    return navigate(to, opts);
  }, [navigate]);
}
