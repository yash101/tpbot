"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Square,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  RotateCw,
  Battery,
  Wifi,
  Camera,
  Gamepad2,
  Hand,
  Users,
  Eye,
  Monitor,
} from "lucide-react"

interface Robot {
  id: string
  name: string
  status: "online" | "offline" | "busy"
  battery: number
  signal: number
  controller: string | null
  party: string | null
  telemetry: {
    speed: number
    heading: number
    altitude: number
    temperature: number
  }
}

interface RobotControlInterfaceProps {
  user: {
    username: string
    role: "guest" | "user" | "admin" | "robot"
  }
}

export function RobotControlInterface({ user }: RobotControlInterfaceProps) {
  const [robots, setRobots] = useState<Robot[]>([
    {
      id: "robot-001",
      name: "Explorer Alpha",
      status: "online",
      battery: 85,
      signal: 92,
      controller: null,
      party: "team-alpha",
      telemetry: { speed: 0.5, heading: 45, altitude: 1.2, temperature: 22 },
    },
    {
      id: "robot-002",
      name: "Scout Beta",
      status: "busy",
      battery: 67,
      signal: 78,
      controller: "john_doe",
      party: "team-beta",
      telemetry: { speed: 1.2, heading: 180, altitude: 0.8, temperature: 24 },
    },
    {
      id: "robot-003",
      name: "Guardian Gamma",
      status: "online",
      battery: 94,
      signal: 88,
      controller: null,
      party: "team-alpha",
      telemetry: { speed: 0, heading: 90, altitude: 1.5, temperature: 21 },
    },
  ])

  const [viewingRobot, setViewingRobot] = useState<string>(robots[0]?.id || "")
  const [controlledRobot, setControlledRobot] = useState<string | null>(null)
  const [keyboardMode, setKeyboardMode] = useState(false)

  const userParty = user.role === "admin" ? null : "team-alpha" // Simplified - in real app, get from user data
  const partyRobots = robots.filter((robot) => user.role === "admin" || robot.party === userParty)

  const viewedRobot = robots.find((r) => r.id === viewingRobot)
  const hasControl = controlledRobot === viewingRobot
  const canRequestControl = user.role !== "guest" && viewedRobot?.controller === null

  const sendMessge = () => {}; // Placeholder for sending messages to backend

  useEffect(() => {
    const interval = setInterval(() => {
      setRobots((prev) =>
        prev.map((robot) => ({
          ...robot,
          telemetry: {
            ...robot.telemetry,
            speed: Math.max(0, robot.telemetry.speed + (Math.random() - 0.5) * 0.2),
            heading: (robot.telemetry.heading + (Math.random() - 0.5) * 10) % 360,
            temperature: robot.telemetry.temperature + (Math.random() - 0.5) * 0.5,
          },
          battery: Math.max(0, robot.battery - Math.random() * 0.1),
          signal: Math.max(0, Math.min(100, robot.signal + (Math.random() - 0.5) * 5)),
        })),
      )
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!hasControl || !keyboardMode) return

    const handleKeyDown = (e: KeyboardEvent) => {
      console.log(`[v0] Robot control: ${e.key} pressed`)
      switch (e.key.toLowerCase()) {
        case "w":
        case "arrowup":
          handleMove("forward")
          break
        case "s":
        case "arrowdown":
          handleMove("backward")
          break
        case "a":
        case "arrowleft":
          handleMove("left")
          break
        case "d":
        case "arrowright":
          handleMove("right")
          break
        case "q":
          handleMove("rotate-left")
          break
        case "e":
          handleMove("rotate-right")
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [hasControl, keyboardMode])

  const handleRequestControl = () => {
    if (canRequestControl) {
      sendMessage({
        type: "control_request",
        payload: {
          robotId: viewingRobot,
          userId: user.username,
          robotName: viewedRobot?.name,
        },
      })

      setControlledRobot(viewingRobot)
      setRobots((prev) =>
        prev.map((robot) =>
          robot.id === viewingRobot ? { ...robot, controller: user.username, status: "busy" as const } : robot,
        ),
      )
    }
  }

  const handleReleaseControl = () => {
    if (controlledRobot) {
      sendMessage({
        type: "control_released",
        payload: {
          robotId: controlledRobot,
          userId: user.username,
          robotName: robots.find((r) => r.id === controlledRobot)?.name,
        },
      })

      setRobots((prev) =>
        prev.map((robot) =>
          robot.id === controlledRobot ? { ...robot, controller: null, status: "online" as const } : robot,
        ),
      )
      setControlledRobot(null)
      setKeyboardMode(false)
    }
  }

  const handleMove = useCallback(
    (direction: string) => {
      if (!hasControl || !controlledRobot) return

      sendMessage({
        type: "robot_update",
        payload: {
          robotId: controlledRobot,
          command: direction,
          userId: user.username,
        },
      })

      console.log(`[v0] Moving robot ${controlledRobot} ${direction}`)
      setRobots((prev) =>
        prev.map((robot) => {
          if (robot.id === controlledRobot) {
            const newTelemetry = { ...robot.telemetry }
            switch (direction) {
              case "forward":
                newTelemetry.speed = Math.min(2, newTelemetry.speed + 0.1)
                break
              case "backward":
                newTelemetry.speed = Math.max(0, newTelemetry.speed - 0.1)
                break
              case "left":
                newTelemetry.heading = (newTelemetry.heading - 5) % 360
                break
              case "right":
                newTelemetry.heading = (newTelemetry.heading + 5) % 360
                break
              case "rotate-left":
                newTelemetry.heading = (newTelemetry.heading - 15) % 360
                break
              case "rotate-right":
                newTelemetry.heading = (newTelemetry.heading + 15) % 360
                break
            }
            return { ...robot, telemetry: newTelemetry }
          }
          return robot
        }),
      )
    },
    [hasControl, controlledRobot, sendMessage, user.username],
  )

  useEffect(() => {
    const handleRobotUpdates = (event: CustomEvent) => {
      const updates = event.detail
      setRobots((prev) =>
        prev.map((robot) => {
          const update = updates[robot.id]
          if (update?.telemetry) {
            return {
              ...robot,
              ...update,
              telemetry: { ...robot.telemetry, ...update.telemetry },
            }
          }
          return robot
        }),
      )
    }

    window.addEventListener("robotUpdates", handleRobotUpdates as EventListener)
    return () => window.removeEventListener("robotUpdates", handleRobotUpdates as EventListener)
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "bg-green-500"
      case "busy":
        return "bg-yellow-500"
      case "offline":
        return "bg-red-500"
      default:
        return "bg-gray-500"
    }
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "online":
        return "default"
      case "busy":
        return "secondary"
      case "offline":
        return "destructive"
      default:
        return "outline"
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Party: {userParty ? `Team Alpha` : "Admin Access"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <Badge variant="outline" className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {partyRobots.length} robots available
            </Badge>
            {user.role === "admin" && <Badge variant="secondary">Admin - All robots accessible</Badge>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {partyRobots.map((robot) => (
              <Card
                key={robot.id}
                className={`cursor-pointer transition-all ${
                  viewingRobot === robot.id ? "ring-2 ring-primary" : "hover:bg-muted/50"
                }`}
                onClick={() => setViewingRobot(robot.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Monitor className="h-4 w-4" />
                      <span className="font-medium">{robot.name}</span>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(robot.status)}`} />
                  </div>

                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Battery:</span>
                      <span>{Math.round(robot.battery)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Signal:</span>
                      <span>{Math.round(robot.signal)}%</span>
                    </div>
                    {robot.controller && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Controller:</span>
                        <span className="text-xs">{robot.controller}</span>
                      </div>
                    )}
                  </div>

                  {viewingRobot === robot.id && (
                    <Badge variant="default" className="mt-2 w-full justify-center">
                      <Eye className="h-3 w-3 mr-1" />
                      Viewing
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="video" className="space-y-4">
        <TabsList>
          <TabsTrigger value="video">Video Feed</TabsTrigger>
          <TabsTrigger value="telemetry">Detailed Telemetry</TabsTrigger>
          <TabsTrigger value="control" disabled={!hasControl}>
            Robot Control{" "}
            {hasControl && (
              <Badge variant="secondary" className="ml-2">
                Active
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="video">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Video Feed - {viewedRobot?.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      Party: {viewedRobot?.party || "None"}
                    </Badge>
                    {viewedRobot?.controller && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Hand className="h-3 w-3" />
                        {viewedRobot.controller}
                      </Badge>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-green-900/20" />
                  <div className="text-center z-10">
                    <Camera className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-lg font-medium">Live Video Feed</p>
                    <p className="text-sm text-muted-foreground">
                      {viewedRobot?.name} - {viewedRobot?.status}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Shared with all {userParty || "admin"} party members
                    </p>
                  </div>

                  <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-1 rounded text-sm">
                    {new Date().toLocaleTimeString()}
                  </div>

                  <div className="absolute top-4 right-4 flex gap-2">
                    <div className="bg-black/50 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                      <Battery className="h-3 w-3" />
                      {Math.round(viewedRobot?.battery || 0)}%
                    </div>
                    <div className="bg-black/50 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                      <Wifi className="h-3 w-3" />
                      {Math.round(viewedRobot?.signal || 0)}%
                    </div>
                  </div>

                  <div className="absolute bottom-4 left-4 bg-black/50 text-white px-3 py-1 rounded text-xs">
                    <Users className="h-3 w-3 inline mr-1" />
                    Party members can view this feed
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Live Telemetry</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-xs text-muted-foreground mb-4 p-2 bg-muted rounded">
                  <Users className="h-3 w-3 inline mr-1" />
                  Telemetry shared with party members
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Battery Level</span>
                    <span>{Math.round(viewedRobot?.battery || 0)}%</span>
                  </div>
                  <Progress value={viewedRobot?.battery || 0} className="h-2" />
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Signal Strength</span>
                    <span>{Math.round(viewedRobot?.signal || 0)}%</span>
                  </div>
                  <Progress value={viewedRobot?.signal || 0} className="h-2" />
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Speed</span>
                    <p className="font-mono">{viewedRobot?.telemetry.speed.toFixed(1)} m/s</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Heading</span>
                    <p className="font-mono">{Math.round(viewedRobot?.telemetry.heading || 0)}°</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Altitude</span>
                    <p className="font-mono">{viewedRobot?.telemetry.altitude.toFixed(1)} m</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Temperature</span>
                    <p className="font-mono">{viewedRobot?.telemetry.temperature.toFixed(1)}°C</p>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  {!hasControl ? (
                    <div className="text-center space-y-3">
                      {canRequestControl ? (
                        <>
                          <p className="text-sm text-muted-foreground">
                            Request control to operate {viewedRobot?.name}
                          </p>
                          <Button onClick={handleRequestControl} size="sm" className="w-full">
                            <Hand className="h-4 w-4 mr-2" />
                            Request Control
                          </Button>
                        </>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">
                            {viewedRobot?.controller
                              ? `${viewedRobot.controller} is controlling this robot`
                              : user.role === "guest"
                                ? "Guests can view but not control robots"
                                : "Robot is not available for control"}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center space-y-2">
                      <Badge variant="default" className="flex items-center gap-1 w-fit mx-auto">
                        <Hand className="h-3 w-3" />
                        You have control
                      </Badge>
                      <Button
                        variant="outline"
                        onClick={handleReleaseControl}
                        size="sm"
                        className="w-full bg-transparent"
                      >
                        <Square className="h-4 w-4 mr-2" />
                        Release Control
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="telemetry">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {partyRobots.map((robot) => (
              <Card key={robot.id} className={viewingRobot === robot.id ? "ring-2 ring-primary" : ""}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>{robot.name}</span>
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(robot.status)}`} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Speed</span>
                      <p className="font-mono">{robot.telemetry.speed.toFixed(1)} m/s</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Heading</span>
                      <p className="font-mono">{Math.round(robot.telemetry.heading)}°</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Altitude</span>
                      <p className="font-mono">{robot.telemetry.altitude.toFixed(1)} m</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Temp</span>
                      <p className="font-mono">{robot.telemetry.temperature.toFixed(1)}°C</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span>Battery</span>
                        <span>{Math.round(robot.battery)}%</span>
                      </div>
                      <Progress value={robot.battery} className="h-1" />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span>Signal</span>
                        <span>{Math.round(robot.signal)}%</span>
                      </div>
                      <Progress value={robot.signal} className="h-1" />
                    </div>
                  </div>

                  <Button variant="outline" size="sm" onClick={() => setViewingRobot(robot.id)} className="w-full">
                    <Eye className="h-3 w-3 mr-2" />
                    View Feed
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="control">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Robot Control - {viewedRobot?.name}</span>
                <Badge variant="default" className="flex items-center gap-1">
                  <Hand className="h-3 w-3" />
                  Active Control
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <Button
                    variant={keyboardMode ? "default" : "outline"}
                    onClick={() => setKeyboardMode(!keyboardMode)}
                    size="sm"
                  >
                    <Gamepad2 className="h-4 w-4 mr-2" />
                    Keyboard Mode {keyboardMode ? "ON" : "OFF"}
                  </Button>

                  <Button variant="destructive" onClick={handleReleaseControl} size="sm">
                    <Square className="h-4 w-4 mr-2" />
                    Release Control
                  </Button>
                </div>

                {keyboardMode && (
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">Keyboard Controls:</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <span>W/↑ - Forward</span>
                      <span>S/↓ - Backward</span>
                      <span>A/← - Turn Left</span>
                      <span>D/→ - Turn Right</span>
                      <span>Q - Rotate Left</span>
                      <span>E - Rotate Right</span>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <h4 className="font-medium">On-Screen Controls</h4>

                  <div className="grid grid-cols-3 gap-2 w-fit mx-auto">
                    <div></div>
                    <Button
                      variant="outline"
                      size="lg"
                      onMouseDown={() => handleMove("forward")}
                      className="aspect-square"
                    >
                      <ArrowUp className="h-6 w-6" />
                    </Button>
                    <div></div>

                    <Button
                      variant="outline"
                      size="lg"
                      onMouseDown={() => handleMove("left")}
                      className="aspect-square"
                    >
                      <ArrowLeft className="h-6 w-6" />
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      onMouseDown={() => handleMove("backward")}
                      className="aspect-square"
                    >
                      <ArrowDown className="h-6 w-6" />
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      onMouseDown={() => handleMove("right")}
                      className="aspect-square"
                    >
                      <ArrowRight className="h-6 w-6" />
                    </Button>
                  </div>

                  <div className="flex justify-center gap-4">
                    <Button
                      variant="outline"
                      onMouseDown={() => handleMove("rotate-left")}
                      className="flex items-center gap-2"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Rotate Left
                    </Button>
                    <Button
                      variant="outline"
                      onMouseDown={() => handleMove("rotate-right")}
                      className="flex items-center gap-2"
                    >
                      <RotateCw className="h-4 w-4" />
                      Rotate Right
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
