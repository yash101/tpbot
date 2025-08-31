"use client"

import { Badge } from "@/components/ui/badge"
import { Wifi, WifiOff, Loader2, AlertTriangle } from "lucide-react"
import { useWebSocketContext } from "./websocket-provider"

export function ConnectionStatus() {
  const { isConnected, connectionStatus } = useWebSocketContext()

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case "connected":
        return <Wifi className="h-3 w-3" />
      case "connecting":
        return <Loader2 className="h-3 w-3 animate-spin" />
      case "error":
        return <AlertTriangle className="h-3 w-3" />
      case "disconnected":
      default:
        return <WifiOff className="h-3 w-3" />
    }
  }

  const getStatusVariant = () => {
    switch (connectionStatus) {
      case "connected":
        return "default"
      case "connecting":
        return "secondary"
      case "error":
        return "destructive"
      case "disconnected":
      default:
        return "outline"
    }
  }

  const getStatusText = () => {
    switch (connectionStatus) {
      case "connected":
        return "Connected"
      case "connecting":
        return "Connecting..."
      case "error":
        return "Connection Error"
      case "disconnected":
      default:
        return "Disconnected"
    }
  }

  return (
    <Badge variant={getStatusVariant()} className="flex items-center gap-1">
      {getStatusIcon()}
      {getStatusText()}
    </Badge>
  )
}
