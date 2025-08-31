"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import {
  Server,
  Database,
  Bot,
  Zap,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Clock,
  Activity,
  Cpu,
  HardDrive,
  Network,
} from "lucide-react"

interface SystemComponent {
  id: string
  name: string
  status: "connected" | "disconnected" | "warning" | "maintenance"
  uptime: string
  lastPing: string
  responseTime: number
  version: string
  metrics?: {
    cpu?: number
    memory?: number
    disk?: number
    network?: number
  }
}

export function SystemStatus() {
  const [components, setComponents] = useState<SystemComponent[]>([
    {
      id: "backend",
      name: "Backend",
      status: "connected",
      uptime: "99.8%",
      lastPing: "2024-01-15 14:32:15",
      responseTime: 45,
      version: "v2.1.3",
      metrics: {
        cpu: 23,
        memory: 67,
        disk: 45,
        network: 89,
      },
    },
    {
      id: "llbe",
      name: "LLBE",
      status: "connected",
      uptime: "98.5%",
      lastPing: "2024-01-15 14:32:12",
      responseTime: 120,
      version: "v1.8.2",
      metrics: {
        cpu: 78,
        memory: 82,
        disk: 34,
        network: 92,
      },
    },
    {
      id: "robot",
      name: "Robot",
      status: "warning",
      uptime: "95.2%",
      lastPing: "2024-01-15 14:31:45",
      responseTime: 230,
      version: "v3.0.1",
      metrics: {
        cpu: 45,
        memory: 56,
        disk: 78,
        network: 67,
      },
    },
    {
      id: "deathstar",
      name: "Deathstar",
      status: "disconnected",
      uptime: "0%",
      lastPing: "2024-01-15 14:28:03",
      responseTime: 0,
      version: "v1.2.0",
      metrics: {
        cpu: 0,
        memory: 0,
        disk: 0,
        network: 0,
      },
    },
  ])

  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setComponents((prev) =>
        prev.map((component) => {
          if (component.status === "disconnected") return component

          const newMetrics = component.metrics
            ? {
                cpu: Math.max(0, Math.min(100, component.metrics.cpu + (Math.random() - 0.5) * 10)),
                memory: Math.max(0, Math.min(100, component.metrics.memory + (Math.random() - 0.5) * 5)),
                disk: Math.max(0, Math.min(100, component.metrics.disk + (Math.random() - 0.5) * 2)),
                network: Math.max(0, Math.min(100, component.metrics.network + (Math.random() - 0.5) * 8)),
              }
            : undefined

          return {
            ...component,
            lastPing: new Date().toLocaleString(),
            responseTime: Math.max(10, component.responseTime + (Math.random() - 0.5) * 20),
            metrics: newMetrics,
          }
        }),
      )
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "connected":
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case "disconnected":
        return <XCircle className="h-5 w-5 text-red-500" />
      case "maintenance":
        return <RefreshCw className="h-5 w-5 text-blue-500" />
      default:
        return <XCircle className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "connected":
        return "default"
      case "warning":
        return "secondary"
      case "disconnected":
        return "destructive"
      case "maintenance":
        return "outline"
      default:
        return "secondary"
    }
  }

  const getComponentIcon = (id: string) => {
    switch (id) {
      case "backend":
        return <Server className="h-6 w-6" />
      case "llbe":
        return <Database className="h-6 w-6" />
      case "robot":
        return <Bot className="h-6 w-6" />
      case "deathstar":
        return <Zap className="h-6 w-6" />
      default:
        return <Server className="h-6 w-6" />
    }
  }

  const getMetricColor = (value: number) => {
    if (value >= 80) return "text-red-500"
    if (value >= 60) return "text-yellow-500"
    return "text-green-500"
  }

  const getMetricProgressColor = (value: number) => {
    if (value >= 80) return "bg-red-500"
    if (value >= 60) return "bg-yellow-500"
    return "bg-green-500"
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    console.log("[v0] Refreshing system status...")

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))

    setLastRefresh(new Date())
    setIsRefreshing(false)
    console.log("[v0] System status refreshed")
  }

  const connectedCount = components.filter((c) => c.status === "connected").length
  const totalCount = components.length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">System Status</h2>
          <p className="text-muted-foreground">
            {connectedCount} of {totalCount} components operational
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
                {components.filter((c) => c.status === "maintenance").length}
              </div>
              <div className="text-sm text-muted-foreground">Maintenance</div>
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
                <div className="flex items-center gap-3">
                  {getComponentIcon(component.id)}
                  <span>{component.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(component.status)}
                  <Badge variant={getStatusVariant(component.status)} className="capitalize">
                    {component.status}
                  </Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Version:</span>
                  <p className="font-mono">{component.version}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Uptime:</span>
                  <p className="font-mono">{component.uptime}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Response Time:</span>
                  <p className="font-mono">{component.responseTime}ms</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Last Ping:</span>
                  <p className="font-mono text-xs">{component.lastPing}</p>
                </div>
              </div>

              {/* Metrics */}
              {component.metrics && component.status !== "disconnected" && (
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Cpu className="h-4 w-4" />
                    System Metrics
                  </h4>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <Cpu className="h-3 w-3" />
                        CPU Usage
                      </span>
                      <span className={`font-mono ${getMetricColor(component.metrics.cpu || 0)}`}>
                        {Math.round(component.metrics.cpu || 0)}%
                      </span>
                    </div>
                    <Progress value={component.metrics.cpu || 0} className="h-2" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <Activity className="h-3 w-3" />
                        Memory Usage
                      </span>
                      <span className={`font-mono ${getMetricColor(component.metrics.memory || 0)}`}>
                        {Math.round(component.metrics.memory || 0)}%
                      </span>
                    </div>
                    <Progress value={component.metrics.memory || 0} className="h-2" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <HardDrive className="h-3 w-3" />
                        Disk Usage
                      </span>
                      <span className={`font-mono ${getMetricColor(component.metrics.disk || 0)}`}>
                        {Math.round(component.metrics.disk || 0)}%
                      </span>
                    </div>
                    <Progress value={component.metrics.disk || 0} className="h-2" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <Network className="h-3 w-3" />
                        Network Usage
                      </span>
                      <span className={`font-mono ${getMetricColor(component.metrics.network || 0)}`}>
                        {Math.round(component.metrics.network || 0)}%
                      </span>
                    </div>
                    <Progress value={component.metrics.network || 0} className="h-2" />
                  </div>
                </div>
              )}

              {component.status === "disconnected" && (
                <div className="text-center py-4">
                  <XCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Component is offline</p>
                  <p className="text-xs text-muted-foreground">Last seen: {component.lastPing}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* System Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            System Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {components
              .filter((c) => c.status !== "connected")
              .map((component) => (
                <div key={component.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50">
                  {getStatusIcon(component.status)}
                  <div className="flex-1">
                    <p className="font-medium">{component.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {component.status === "disconnected"
                        ? "Component is offline and not responding"
                        : component.status === "warning"
                          ? "Component is experiencing issues"
                          : "Component is under maintenance"}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <Clock className="h-3 w-3 inline mr-1" />
                    {component.lastPing}
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
