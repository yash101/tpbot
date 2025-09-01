"use client"

import { useEffect, useRef, useState } from "react"
import { WebSocketService, type WebSocketMessage } from "@/services/websocket-service"

export function useWebSocketService(initialUrl?: string) {
  const ref = useRef<WebSocketService | null>(null)
  const [, setTick] = useState(0)

  if (!ref.current) ref.current = new WebSocketService(initialUrl)
  const service = ref.current

  useEffect(() => {
    const onState = () => setTick((t) => t + 1)
    service.addEventListener("state", onState)
    service.addEventListener("connect", onState)
    service.addEventListener("disconnect", onState)
    service.addEventListener("error", onState)
    return () => {
      service.removeEventListener("state", onState)
      service.removeEventListener("connect", onState)
      service.removeEventListener("disconnect", onState)
      service.removeEventListener("error", onState)
    }
  }, [service])

  return {
    service,
    connectionState: service.getState(),
    isConnected: service.getState() === "connected",
    lastMessage: service.lastMessage as WebSocketMessage | null,
    connect: (url?: string) => service.connect(url),
    disconnect: () => service.disconnect(),
    sendMessage: (m: Omit<WebSocketMessage, "timestamp">) => service.sendMessage(m),
    sendRequest: (m: Omit<WebSocketMessage, "timestamp" | "id">, timeout?: number) =>
      service.sendRequest(m, timeout),
    authenticate: (u: string, p: string) => service.authenticate(u, p),
    sendSDP: (sdp: any, targetId?: string) => service.sendSDP(sdp, targetId),
    sendIce: (c: any, targetId?: string) => service.sendIce(c, targetId),
    requestControl: (robotId: string) => service.requestControl(robotId),
    releaseControl: (robotId?: string) => service.releaseControl(robotId),
    addEventListener: (type: string, cb: EventListenerOrEventListenerObject) =>
      service.addEventListener(type, cb),
    removeEventListener: (type: string, cb: EventListenerOrEventListenerObject) =>
      service.removeEventListener(type, cb),
  }
}
