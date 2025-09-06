"use client";

import React, { createContext, useContext, useMemo } from "react";
import { useRealtime } from "@/service/providers";
import { WebRTCManager } from "@/service/webrtc/WebRTCManager";

const WebRTCContext = createContext<WebRTCManager | null>(null);

export function WebRTCProvider({ children }: { children: React.ReactNode }) {
  const rt = useRealtime();
  const manager = useMemo(() => new WebRTCManager(rt), [rt]);

  return (
    <WebRTCContext.Provider value={manager}>{children}</WebRTCContext.Provider>
  );
}

export function useWebRTC() {
  const mgr = useContext(WebRTCContext);
  if (!mgr) throw new Error("useWebRTC must be used inside WebRTCProvider");
  return mgr;
}
