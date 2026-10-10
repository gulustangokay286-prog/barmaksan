// Ziyaretçi oturumu: kim olduğu (anonim / misafir / üye) sunucudan sorulur; jeton tarayıcıda
// hiçbir zaman görünmez (HttpOnly çerez). Belgeye erişim gerektiğinde "kapı" penceresi açılır.
import { useCallback, useSyncExternalStore } from 'react';
import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query';
import { account, type Viewer, type RegisterInput } from './api';

export const meQuery = () => queryOptions({ queryKey: ['me'], queryFn: account.me, staleTime: 60_000 });
export const providersQuery = () => queryOptions({ queryKey: ['providers'], queryFn: account.providers, staleTime: Infinity });

export function useSession() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(meQuery());
  const me: Viewer = data ?? { kind: 'anonymous' };
  const set = useCallback((next: Viewer) => {
    qc.setQueryData(meQuery().queryKey, next);
    // Oturum değişince erişim de değişir (eski sürümler, kaydedilenler).
    void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
    return next;
  }, [qc]);
  return {
    me,
    loading: isLoading,
    isViewer: me.kind !== 'anonymous',
    isMember: me.kind === 'account',
    isGuest: me.kind === 'guest',
    isAdmin: me.kind === 'account' && me.account.role === 'admin',
    login: async (email: string, password: string) => set(await account.login(email, password)),
    register: async (input: RegisterInput) => set(await account.register(input)),
    guest: async (input: { email: string; name?: string; company?: string; kvkk: boolean }) => set(await account.guest(input)),
    logout: async () => set(await account.logout()),
    refresh: () => qc.invalidateQueries({ queryKey: meQuery().queryKey }),
  };
}

export function displayName(me: Viewer) {
  if (me.kind === 'account') return [me.account.firstName, me.account.lastName].filter(Boolean).join(' ') || me.account.email;
  if (me.kind === 'guest') return me.guest.name || me.guest.email;
  return '';
}
export function initials(me: Viewer) {
  if (me.kind === 'account') {
    const a = me.account;
    return `${a.firstName?.[0] ?? a.email[0]}${a.lastName?.[0] ?? ''}`.toLocaleUpperCase('tr');
  }
  if (me.kind === 'guest') return (me.guest.name?.[0] ?? me.guest.email[0]).toLocaleUpperCase('tr');
  return '';
}

// ── Kapı ────────────────────────────────────────────────────────────────────
// Neden açıldığı: belge (misafir yeter), eski sürüm / kaydedilenler (üyelik gerekir).

export type GateReason = 'document' | 'member' | 'saved';
export type GateState = { reason: GateReason; back: string; href?: string } | null;
let gateState: GateState = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export const gate = {
  open(reason: GateReason, options: { back?: string; href?: string } = {}) {
    gateState = { reason, back: options.back ?? window.location.pathname + window.location.search, href: options.href };
    emit();
  },
  close() { gateState = null; emit(); },
};

export function useGate() {
  return useSyncExternalStore((fn) => { listeners.add(fn); return () => listeners.delete(fn); }, () => gateState, () => null);
}

/** /giris adresi, dönüş yoluyla. */
export const signInHref = (mode: 'giris' | 'kayit' | 'misafir' = 'giris', back?: string) => {
  const q = new URLSearchParams();
  if (mode !== 'giris') q.set('mod', mode);
  if (back && back !== '/') q.set('donus', back);
  const s = q.toString();
  return `/giris${s ? `?${s}` : ''}`;
};
