"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Server,
  Bot,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Clock,
  Activity,
} from "lucide-react"
import { useRealtime, useSignal } from "@/service/providers"

interface SystemComponent {
  id: string
  name: string
  status: "connected" | "disconnected" | "warning"
  lastPing: Date | null
  responseTime: number | null
  version?: string
}

export function SystemStatus() {
  const rt = useRealtime()
  const [components, setComponents] = useState<SystemComponent[]>([
    {
      id: "backend",
      name: "Backend",
      status: "disconnected",
      lastPing: null,
      responseTime: null,
      version: "unknown",
    },
    {
      id: "llbe",
      name: "LLBE",
      status: "disconnected", 
      lastPing: null,
      responseTime: null,
      version: "unknown",
    },
  ])
  
  const [robots, setRobots] = useState<any[]>([])
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Listen for ping responses from backend
  const pingResponse = useSignal(rt.getSignal('ping:resp'))
  
  // Listen for robot list updates
  const robotList = useSignal(rt.getSignal('robot:list'))

  // Update backend status when we get ping responses
  useEffect(() => {
    if (pingResponse) {
      setComponents(prev => prev.map(comp => 
        comp.id === "backend" 
          ? {
              ...comp,
              status: "connected" as const,
              lastPing: new Date(),
              responseTime: pingResponse.incomingTimestamp ? 
                Date.now() - pingResponse.incomingTimestamp : null
            }
          : comp
      ))
    }
  }, [pingResponse])

  // Update robot list and LLBE status when we get updates
  useEffect(() => {
    if (robotList) {
      // Update robots if array is provided
      if (Array.isArray(robotList)) {
        setRobots(robotList)
      } else if (robotList.robots && Array.isArray(robotList.robots)) {
        setRobots(robotList.robots)
        
        // Update LLBE status if provided
        if (robotList.llbeStatus) {
          setComponents(prev => prev.map(comp => 
            comp.id === "llbe" 
              ? {
                  ...comp,
                  status: robotList.llbeStatus.connected ? "connected" as const : "disconnected" as const,
                  lastPing: robotList.llbeStatus.lastPing ? new Date(robotList.llbeStatus.lastPing) : null,
                  responseTime: null
                }
              : comp
          ))
        }
      }
    }
  }, [robotList])

  // Send periodic pings to test backend connectivity
  useEffect(() => {
    const sendPing = () => {
      rt.send({
        type: 'ping',
        timestamp: Date.now()
      })
    }

    // Send initial ping
    sendPing()

    // Set up interval for periodic pings
    const interval = setInterval(sendPing, 5000) // Ping every 5 seconds

    return () => clearInterval(interval)
  }, [rt])

  // Request robot list on mount and periodically
  useEffect(() => {
    const requestRobotList = () => {
      rt.send({
        type: 'robot:list'
      })
    }

    requestRobotList()
    const interval = setInterval(requestRobotList, 10000) // Update every 10 seconds

    return () => clearInterval(interval)
  }, [rt])

  const handleRefresh = () => {
    setIsRefreshing(true)
    setLastRefresh(new Date())
    
    // Send immediate ping and robot list request
    rt.send({ type: 'ping', timestamp: Date.now() })
    rt.send({ type: 'robot:list' })
    
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "connected":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case "disconnected":
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <XCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
        return "bg-green-500"
      case "warning":
        return "bg-yellow-500"
      case "disconnected":
        return "bg-red-500"
      default:
        return "bg-gray-500"
    }
  }

  const getComponentIcon = (id: string) => {
    switch (id) {
      case "backend":
        return <Server className="h-5 w-5" />
      case "llbe":
        return <Activity className="h-5 w-5" />
      default:
        return <Bot className="h-5 w-5" />
    }
  }

  const connectedCount = components.filter((c) => c.status === "connected").length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Status</h1>
          <p className="text-muted-foreground">
            Monitor the health and performance of all system components
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">Last updated: {lastRefresh.toLocaleTimeString()}</div>
          <Button onClick={handleRefresh} disabled={isRefreshing} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overall System Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">{connectedCount}</div>
              <div className="text-sm text-muted-foreground">Connected</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-500">
                {components.filter((c) => c.status === "warning").length}
              </div>
              <div className="text-sm text-muted-foreground">Warning</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-500">
                {components.filter((c) => c.status === "disconnected").length}
              </div>
              <div className="text-sm text-muted-foreground">Disconnected</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-500">
                {robots.length}
              </div>
              <div className="text-sm text-muted-foreground">Robots</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Component Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {components.map((component) => (
          <Card key={component.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getComponentIcon(component.id)}
                  {component.name}
                </div>
                <Badge variant={component.status === "connected" ? "default" : component.status === "warning" ? "secondary" : "destructive"}>
                  {getStatusIcon(component.status)}
                  {component.status}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Last Ping:</span>
                  <div className="text-muted-foreground">
                    {component.lastPing ? component.lastPing.toLocaleTimeString() : "Never"}
                  </div>
                </div>
                <div>
                  <span className="font-medium">Response Time:</span>
                  <div className="text-muted-foreground">
                    {component.responseTime ? `${component.responseTime}ms` : "N/A"}
                  </div>
                </div>
                <div>
                  <span className="font-medium">Version:</span>
                  <div className="text-muted-foreground">{component.version}</div>
                </div>
                <div>
                  <span className="font-medium">Status:</span>
                  <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(component.status)}`} />
                    <span className="text-muted-foreground">{component.status}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Robot Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Robot Status ({robots.length} robots)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {robots.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {robots.map((robot: any) => (
                <div key={robot.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{robot.name || robot.id}</span>
                    <Badge variant={robot.status === "online" ? "default" : "secondary"}>
                      {robot.status || "unknown"}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div>Battery: {robot.battery || 0}%</div>
                    <div>Signal: {robot.signal || 0}%</div>
                    {robot.controller && <div>Controller: {robot.controller}</div>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Bot className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No robots connected</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Health Summary */}
      <Card>
        <CardHeader>
          <CardTitle>System Health Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {components.map((component) => (
              <div key={component.id} className="flex items-center justify-between p-2 border rounded">
                <div className="flex items-center gap-2">
                  {getComponentIcon(component.id)}
                  <span className="font-medium">{component.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {component.responseTime && (
                    <span className="text-sm text-muted-foreground">
                      {component.responseTime}ms
                    </span>
                  )}
                  <div className="text-xs text-muted-foreground">
                    <Clock className="h-3 w-3 inline mr-1" />
                    {component.lastPing ? component.lastPing.toLocaleTimeString() : "Never"}
                  </div>
                </div>
              </div>
            ))}

            {components.every((c) => c.status === "connected") && (
              <div className="text-center py-8">
                <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="text-muted-foreground">All systems operational</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
