'use client';

import { RealtimeClient } from "@/service/RealtimeClient";
import React, { useContext, useEffect, useMemo, useSyncExternalStore } from "react";

const RTContext = React.createContext<RealtimeClient | null>(null);

export function RealtimeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const rt = useMemo(() => new RealtimeClient(process.env.NEXT_PUBLIC_REALTIME_URL || 'http://localhost:8080'), []);
  useEffect(() => {
    rt.connect();
  });

  return (
    <RTContext.Provider value={rt}>
      {children}
    </RTContext.Provider>
  );
}

export function useRealtime() {
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
    sig.subscribe.bind(sig),
    sig.get.bind(sig),
    sig.get.bind(sig),
  );
}
