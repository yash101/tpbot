"use client"

import type React from "react"

import { createContext, useContext, useEffect, useState } from "react"
import { useWebSocket, type WebSocketMessage } from "@/hooks/use-websocket"
import { useToast } from "@/hooks/use-toast"

interface WebSocketContextType {
  isConnected: boolean
  connectionStatus: "connecting" | "connected" | "disconnected" | "error"
  sendMessage: (message: Omit<WebSocketMessage, "timestamp">) => boolean
  lastMessage: WebSocketMessage | null
}

const WebSocketContext = createContext<WebSocketContextType | null>(null)

export function useWebSocketContext() {
  const context = useContext(WebSocketContext)
  if (!context) {
    throw new Error("useWebSocketContext must be used within a WebSocketProvider")
  }
  return context
}

interface WebSocketProviderProps {
  children: React.ReactNode
  user?: {
    username: string
    role: string
  }
}

export function WebSocketProvider({ children, user }: WebSocketProviderProps) {
  const { toast } = useToast()
  const [robotUpdates, setRobotUpdates] = useState<Map<string, any>>(new Map())
  const [systemUpdates, setSystemUpdates] = useState<Map<string, any>>(new Map())

  const handleMessage = (message: WebSocketMessage) => {
    console.log("[v0] WebSocket Provider: Processing message:", message.type)

    switch (message.type) {
      case "robot_update":
        setRobotUpdates((prev) => new Map(prev.set(message.payload.robotId, message.payload)))
        break

      case "system_status":
        setSystemUpdates((prev) => new Map(prev.set(message.payload.component, message.payload)))
        break

      case "control_granted":
        toast({
          title: "Control Granted",
          description: `You now have control of ${message.payload.robotName}`,
        })
        break

      case "control_released":
        toast({
          title: "Control Released",
          description: `Control of ${message.payload.robotName} has been released`,
        })
        break

      case "party_update":
        toast({
          title: "Party Update",
          description: message.payload.message,
        })
        break

      case "user_update":
        if (message.payload.type === "user_joined") {
          toast({
            title: "User Joined",
            description: `${message.payload.username} joined the party`,
          })
        }
        break

      default:
        console.log("[v0] WebSocket Provider: Unknown message type:", message.type)
    }
  }

  const handleConnect = () => {
    console.log("[v0] WebSocket Provider: Connected to server")
    toast({
      title: "Connected",
      description: "Real-time communication established",
    })

    // Send user identification
    if (user) {
      sendMessage({
        type: "user_update",
        payload: {
          type: "user_connected",
          username: user.username,
          role: user.role,
        },
      })
    }
  }

  const handleDisconnect = () => {
    console.log("[v0] WebSocket Provider: Disconnected from server")
    toast({
      title: "Disconnected",
      description: "Real-time communication lost. Attempting to reconnect...",
      variant: "destructive",
    })
  }

  const handleError = (error: Event) => {
    console.error("[v0] WebSocket Provider: Connection error:", error)
    toast({
      title: "Connection Error",
      description: "Failed to establish real-time communication",
      variant: "destructive",
    })
  }

  const { isConnected, connectionStatus, sendMessage, lastMessage } = useWebSocket({
    onMessage: handleMessage,
    onConnect: handleConnect,
    onDisconnect: handleDisconnect,
    onError: handleError,
  })

  // Broadcast robot updates to components that need them
  useEffect(() => {
    if (robotUpdates.size > 0) {
      // Trigger custom events for components to listen to
      window.dispatchEvent(
        new CustomEvent("robotUpdates", {
          detail: Object.fromEntries(robotUpdates),
        }),
      )
    }
  }, [robotUpdates])

  useEffect(() => {
    if (systemUpdates.size > 0) {
      window.dispatchEvent(
        new CustomEvent("systemUpdates", {
          detail: Object.fromEntries(systemUpdates),
        }),
      )
    }
  }, [systemUpdates])

  return (
    <WebSocketContext.Provider
      value={{
        isConnected,
        connectionStatus,
        sendMessage,
        lastMessage,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  )
}
