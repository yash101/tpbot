import { WebsocketApiClient } from "@/src/api/websocket-api.client";
import { createContext, useContext, useEffect, useRef, useSyncExternalStore } from "react";

const RTContext = createContext<WebsocketApiClient | null>(null);

export function WebsocketApiProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const wsApiClientRef = useRef<WebsocketApiClient | null>(null);
  
  if (!wsApiClientRef.current) {
    wsApiClientRef.current = new WebsocketApiClient(import.meta.env.VITE_REALTIME_URL || 'ws://10.0.127.65:8080');
  }
  
  useEffect(() => {
    const rt = wsApiClientRef.current!;
    rt.connect();
    return () => rt.close();
  }, []);

  return (
    <RTContext.Provider value={wsApiClientRef.current}>
      {children}
    </RTContext.Provider>
  );
}

export function useWebsocketApi() {
  const rt = useContext(RTContext);
  if (!rt)
      throw new Error("useRealtime must be used within a RealtimeProvider");
  return rt;
}

export function useSignal<T>(sig: {
  get:() => T,
  subscribe: (fn: (val: T) => void) => () => void
}) {
  return useSyncExternalStore(
    (onStoreChange) => sig.subscribe(() => onStoreChange()),
    sig.get.bind(sig),
    sig.get.bind(sig),
  );
}
