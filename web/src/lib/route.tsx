// Ekranlar anında açılır. İskelet yalnızca veri henüz gelmemişse görünür.
import { createContext, useContext, type ReactNode } from 'react';

export const ROUTE_MS = 500;

const Ready = createContext(true);

/** Bu ekran iskeletini bıraktı mı? (Açılışta her zaman true: perde zaten bekletti.) */
export const useRouteReady = () => useContext(Ready);

export function RouteGate({ children }: { children: ReactNode }) {
  // Gezinmede yapay bekleme yok; yükleme durumu sayfanın verisine bağlıdır.
  return <Ready.Provider value={true}>{children}</Ready.Provider>;
}
