"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UsersIcon, Bot, Settings, Shield, Monitor, Hand, Battery, Wifi, UserX, Plus, Edit } from "lucide-react"
import { useRealtime, useSignal } from "@/service/providers"

interface AdminUser {
  id: string
  username: string
  role: "guest" | "user" | "admin" | "robot"
  party: string | null
  status: "online" | "offline"
  lastSeen: string
  controllingRobot: string | null
}

interface Robot {
  id: string
  name: string
  status: "online" | "offline" | "busy"
  battery: number
  signal: number
  controller: string | null
  party: string | null
  location: string
  lastSeen?: string
}

interface Party {
  id: string
  name: string
  description: string
  members: string[]
  robots: string[]
  createdBy: string
}

export function AdminDashboard() {
  const rt = useRealtime()
  // Users list not implemented server-side currently; keep empty to avoid mocks
  const [users, setUsers] = useState<AdminUser[]>([])
  const [robots, setRobots] = useState<Robot[]>([])
  // Parties from backend are summarized; we'll store minimal info
  const [parties, setParties] = useState<{ partyId: string; memberCount: number }[]>([])

  // Subscribe to backend signals
  const robotListMsg = useSignal(rt.getSignal('robot:list'))
  const partyListMsg = useSignal(rt.getSignal('party:list'))

  // Request initial data and periodic refresh
  useEffect(() => {
    rt.send({ type: 'robot:list' })
    rt.send({ type: 'party:list' })

    const robotsIv = setInterval(() => rt.send({ type: 'robot:list' }), 5000)
    const partiesIv = setInterval(() => rt.send({ type: 'party:list' }), 10000)
    return () => { clearInterval(robotsIv); clearInterval(partiesIv) }
  }, [rt])

  // Handle incoming robot list
  useEffect(() => {
    if (!robotListMsg) return
    const list = Array.isArray(robotListMsg) ? robotListMsg : robotListMsg.robots
    if (Array.isArray(list)) {
      // Normalize fields to Robot type
      const normalized: Robot[] = list.map((r: any) => ({
        id: r.id,
        name: r.name || r.id,
        status: (r.status || 'offline') as Robot['status'],
        battery: typeof r.battery === 'number' ? r.battery : 0,
        signal: typeof r.signal === 'number' ? r.signal : 0,
        controller: r.controller || null,
        party: r.party || null,
        location: r.location || '',
  lastSeen: r.lastSeen || undefined,
      }))
      setRobots(normalized)
    }
  }, [robotListMsg])

  // Handle incoming party list
  useEffect(() => {
    if (!partyListMsg) return
    if (partyListMsg.success && Array.isArray(partyListMsg.parties)) {
      setParties(partyListMsg.parties)
    }
  }, [partyListMsg])

  // Remove add dialogs and mock creation to avoid fake data

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "admin":
        return <Shield className="h-4 w-4" />
      case "user":
        return <UsersIcon className="h-4 w-4" />
      case "guest":
        return <UsersIcon className="h-4 w-4" />
      case "robot":
        return <Bot className="h-4 w-4" />
      default:
        return <UsersIcon className="h-4 w-4" />
    }
  }

  const getRoleVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "destructive"
      case "user":
        return "default"
      case "guest":
        return "secondary"
      case "robot":
        return "outline"
      default:
        return "secondary"
    }
  }

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

  // User creation not supported via UI; backend recommends updating DB directly.

  // Party creation not supported from UI; omitted to avoid mocks.

  // Assignments disabled until backend endpoints are implemented.

  // Assignments disabled until backend endpoints are implemented.

  // Control assignment/release not wired to backend; disabled for now.

  // Control assignment not implemented server-side; hidden in UI.

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Admin Dashboard</h2>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="robots">Robots</TabsTrigger>
          <TabsTrigger value="parties">Parties</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UsersIcon className="h-5 w-5" />
                User Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                User listing/control is not yet exposed by the backend. Please manage users via the database directly.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="robots">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Robot Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Robot</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Battery</TableHead>
                    <TableHead>Signal</TableHead>
                    <TableHead>Controller</TableHead>
                    <TableHead>Party</TableHead>
                    <TableHead>Last Seen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {robots.map((robot) => (
                    <TableRow key={robot.id}>
                      <TableCell className="flex items-center gap-2">
                        <Monitor className="h-4 w-4" />
                        {robot.name}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${getStatusColor(robot.status)}`} />
                          <span className="capitalize">{robot.status}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Battery className="h-4 w-4" />
                          {typeof robot.battery === 'number' ? Math.round(robot.battery) : 0}%
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Wifi className="h-4 w-4" />
                          {typeof robot.signal === 'number' ? Math.round(robot.signal) : 0}%
                        </div>
                      </TableCell>
                      <TableCell>
                        {robot.controller ? (
                          <Badge variant="outline" className="flex items-center gap-1">
                            <Hand className="h-3 w-3" />
                            {robot.controller}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">None</span>
                        )}
                      </TableCell>
                      <TableCell>{robot.party || <span className="text-muted-foreground">None</span>}</TableCell>
                      <TableCell className="text-sm">{(robot as any).lastSeen || ''}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="parties">
          <div className="grid gap-4">
            {parties.map((party) => (
              <Card key={party.partyId}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{party.partyId}</span>
                    <Badge variant="outline">{party.memberCount} members</Badge>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">Active party tracked by session manager</p>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Detailed member/robot lists are not exposed by the backend yet.</p>
                </CardContent>
              </Card>
            ))}
            {parties.length === 0 && (
              <div className="text-sm text-muted-foreground">No active parties</div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
