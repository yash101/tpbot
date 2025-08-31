"use client"

import { useEffect, useRef, useState, useCallback } from "react"

export interface WebSocketMessage {
  type:
    | "robot_update"
    | "control_request"
    | "control_granted"
    | "control_released"
    | "system_status"
    | "party_update"
    | "user_update"
  payload: any
  timestamp: number
  userId?: string
}

interface UseWebSocketOptions {
  url?: string
  reconnectInterval?: number
  maxReconnectAttempts?: number
  onMessage?: (message: WebSocketMessage) => void
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Event) => void
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    url = "ws://localhost:8080/ws",
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
    onMessage,
    onConnect,
    onDisconnect,
    onError,
  } = options

  const [isConnected, setIsConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected" | "error">(
    "disconnected",
  )
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)

  const ws = useRef<WebSocket | null>(null)
  const reconnectAttempts = useRef(0)
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null)

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return

    setConnectionStatus("connecting")
    console.log("[v0] WebSocket: Attempting to connect...")

    try {
      // In a real implementation, this would connect to the actual WebSocket server
      // For demo purposes, we'll simulate the connection
      ws.current = {
        readyState: WebSocket.OPEN,
        send: (data: string) => {
          console.log("[v0] WebSocket: Sending message:", data)
          // Simulate echo response for demo
          setTimeout(() => {
            const message: WebSocketMessage = {
              type: "system_status",
              payload: { status: "message_sent", data: JSON.parse(data) },
              timestamp: Date.now(),
            }
            handleMessage(message)
          }, 100)
        },
        close: () => {
          console.log("[v0] WebSocket: Connection closed")
          setIsConnected(false)
          setConnectionStatus("disconnected")
          onDisconnect?.()
        },
      } as WebSocket

      setIsConnected(true)
      setConnectionStatus("connected")
      reconnectAttempts.current = 0
      console.log("[v0] WebSocket: Connected successfully")
      onConnect?.()

      // Simulate periodic updates
      const updateInterval = setInterval(() => {
        if (ws.current?.readyState === WebSocket.OPEN) {
          const updates: WebSocketMessage[] = [
            {
              type: "robot_update",
              payload: {
                robotId: "robot-001",
                telemetry: {
                  battery: Math.max(0, 85 - Math.random() * 2),
                  signal: Math.max(0, Math.min(100, 92 + (Math.random() - 0.5) * 10)),
                  speed: Math.random() * 0.5,
                  heading: Math.random() * 360,
                },
              },
              timestamp: Date.now(),
            },
            {
              type: "system_status",
              payload: {
                component: "backend",
                status: "connected",
                metrics: {
                  cpu: Math.random() * 30 + 20,
                  memory: Math.random() * 20 + 60,
                  responseTime: Math.random() * 20 + 40,
                },
              },
              timestamp: Date.now(),
            },
          ]

          updates.forEach((update) => {
            setTimeout(() => handleMessage(update), Math.random() * 1000)
          })
        }
      }, 5000)

      // Clean up interval when component unmounts
      return () => clearInterval(updateInterval)
    } catch (error) {
      console.error("[v0] WebSocket: Connection failed:", error)
      setConnectionStatus("error")
      onError?.(error as Event)
      scheduleReconnect()
    }
  }, [onConnect, onDisconnect, onError])

  const handleMessage = useCallback(
    (message: WebSocketMessage) => {
      console.log("[v0] WebSocket: Received message:", message)
      setLastMessage(message)
      onMessage?.(message)
    },
    [onMessage],
  )

  const scheduleReconnect = useCallback(() => {
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      console.log("[v0] WebSocket: Max reconnect attempts reached")
      setConnectionStatus("error")
      return
    }

    reconnectAttempts.current++
    console.log(`[v0] WebSocket: Scheduling reconnect attempt ${reconnectAttempts.current}/${maxReconnectAttempts}`)

    reconnectTimeout.current = setTimeout(() => {
      connect()
    }, reconnectInterval)
  }, [connect, maxReconnectAttempts, reconnectInterval])

  const sendMessage = useCallback((message: Omit<WebSocketMessage, "timestamp">) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      const fullMessage: WebSocketMessage = {
        ...message,
        timestamp: Date.now(),
      }
      ws.current.send(JSON.stringify(fullMessage))
      return true
    } else {
      console.warn("[v0] WebSocket: Cannot send message - not connected")
      return false
    }
  }, [])

  const disconnect = useCallback(() => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current)
      reconnectTimeout.current = null
    }

    if (ws.current) {
      ws.current.close()
      ws.current = null
    }

    setIsConnected(false)
    setConnectionStatus("disconnected")
  }, [])

  useEffect(() => {
    connect()

    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  return {
    isConnected,
    connectionStatus,
    lastMessage,
    sendMessage,
    connect,
    disconnect,
  }
}
