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
import { UserInfo, UserRole } from "@/service/types"
import { useRealtime, useSignal } from "@/service/providers"
import { RobotList } from "./ui/RobotList"

interface RobotControlInterfaceProps {
  user: UserInfo
}

export function RobotControlInterface({ user }: RobotControlInterfaceProps) {
  const rt = useRealtime();

  const assignedParty = useSignal(rt.getSignal('user:party_membership'));
  const robots = useSignal(rt.getSignal('robot:list'));
  // const robotTelemetry = useSignal(rt.getSignal('robot:telemetry'));
  const assignedRobot = useSignal(rt.getSignal('robot:assigned'));
  const hasRobotControl = useSignal(rt.getSignal('robot:control'));

  // TODO: remove these. They are for testing (mocks)
  const hasControl = true;
  // user.role = UserRole.USER; // for testing

  const currentRobot = (robots as Array<any> || []).find(r => r?.id === assignedRobot?.id);

  // Send requests to get initial data
  useEffect(() => {
    rt.send({
      type: 'robot:list'
    });
  }, []);

  // For testing, push some dummy data
  useEffect(() => {
    rt.getSignal('user:party_membership').set({
      id: 'party1',
    });
  }, []);

  // Keyboad control
  // useEffect(() => {
  //   const handleKeyDown = (e: KeyboardEvent) => {
  //     console.log(`[v0] Robot control: ${e.key} pressed`);
  //     switch (e.key.toLowerCase()) {
  //       case "w":
  //       case "arrowup":
  //         handleMove("forward");
  //         break;
  //       case "s":
  //       case "arrowdown":
  //         handleMove("backward");
  //         break;
  //       case "a":
  //       case "arrowleft":
  //         handleMove("left");
  //         break;
  //       case "d":
  //       case "arrowright":
  //         handleMove("right")
  //         break;
  //       default:
  //         break;
  //     }
  //   }

  //   window.addEventListener("keydown", handleKeyDown);
  //   return () => window.removeEventListener("keydown", handleKeyDown);
  // }, []);


  return (
    <div className="space-y-6">

      {/* Robot list */}
      <RobotList user={user} />

      <Tabs defaultValue="video" className="space-y-4">
        <TabsList>
          <TabsTrigger value="video">Video Feed</TabsTrigger>
          { user.role === UserRole.ADMIN && <TabsTrigger value="configuration">Robot Configuration</TabsTrigger> }
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
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Video Feed - {currentRobot?.name || 'Untitled Robot'}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      Party: {assignedParty?.id || "Untitled Party"}
                    </Badge>
                    {currentRobot?.controlled_by && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Hand className="h-3 w-3" />
                        {currentRobot?.controlled_by || 'Unknown controller'}
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
                      {currentRobot?.name} - {currentRobot?.status}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Shared with all {assignedParty?.id || "admin"} party members
                    </p>
                  </div>

                  <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-1 rounded text-sm">
                    {new Date().toLocaleTimeString()}
                  </div>

                  {/* <div className="absolute top-4 right-4 flex gap-2">
                    <div className="bg-black/50 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                      <Battery className="h-3 w-3" />
                      {Math.round(viewedRobot?.battery || 0)}%
                    </div>
                    <div className="bg-black/50 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                      <Wifi className="h-3 w-3" />
                      {Math.round(viewedRobot?.signal || 0)}%
                    </div>
                  </div> */}

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
              {/* <CardContent className="space-y-4">
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
              </CardContent> */}
            </Card>
          </div>
        </TabsContent>


        {/*

<TabsContent value="configuration">
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

        */}
      </Tabs>
    </div>
  )
}
