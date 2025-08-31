"use client"

import { useState } from "react"
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
  const [users, setUsers] = useState<AdminUser[]>([
    {
      id: "user-001",
      username: "john_doe",
      role: "user",
      party: "team-alpha",
      status: "online",
      lastSeen: "2024-01-15 14:30",
      controllingRobot: "robot-002",
    },
    {
      id: "user-002",
      username: "jane_smith",
      role: "admin",
      party: "team-beta",
      status: "online",
      lastSeen: "2024-01-15 14:25",
      controllingRobot: null,
    },
    {
      id: "user-003",
      username: "guest_user",
      role: "guest",
      party: "team-alpha",
      status: "offline",
      lastSeen: "2024-01-15 13:45",
      controllingRobot: null,
    },
  ])

  const [robots, setRobots] = useState<Robot[]>([
    {
      id: "robot-001",
      name: "Explorer Alpha",
      status: "online",
      battery: 85,
      signal: 92,
      controller: null,
      party: "team-alpha",
      location: "Building A - Floor 2",
    },
    {
      id: "robot-002",
      name: "Scout Beta",
      status: "busy",
      battery: 67,
      signal: 78,
      controller: "john_doe",
      party: "team-beta",
      location: "Building B - Floor 1",
    },
    {
      id: "robot-003",
      name: "Guardian Gamma",
      status: "online",
      battery: 94,
      signal: 88,
      controller: null,
      party: "team-alpha",
      location: "Outdoor Area - Zone C",
    },
  ])

  const [parties, setParties] = useState<Party[]>([
    {
      id: "team-alpha",
      name: "Team Alpha",
      description: "Primary exploration team",
      members: ["john_doe", "guest_user"],
      robots: ["robot-001", "robot-003"],
      createdBy: "jane_smith",
    },
    {
      id: "team-beta",
      name: "Team Beta",
      description: "Secondary reconnaissance team",
      members: ["jane_smith"],
      robots: ["robot-002"],
      createdBy: "jane_smith",
    },
  ])

  const [newUser, setNewUser] = useState({
    username: "",
    role: "user" as "guest" | "user" | "admin" | "robot",
    party: "",
  })

  const [newParty, setNewParty] = useState({
    name: "",
    description: "",
  })

  const [isAddUserOpen, setIsAddUserOpen] = useState(false)
  const [isAddPartyOpen, setIsAddPartyOpen] = useState(false)

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

  const handleAddUser = () => {
    if (newUser.username.trim()) {
      const user: AdminUser = {
        id: `user-${Date.now()}`,
        username: newUser.username,
        role: newUser.role,
        party: newUser.party || null,
        status: "offline",
        lastSeen: new Date().toLocaleString(),
        controllingRobot: null,
      }
      setUsers([...users, user])
      setNewUser({ username: "", role: "user", party: "" })
      setIsAddUserOpen(false)
    }
  }

  const handleAddParty = () => {
    if (newParty.name.trim()) {
      const party: Party = {
        id: `party-${Date.now()}`,
        name: newParty.name,
        description: newParty.description,
        members: [],
        robots: [],
        createdBy: "admin",
      }
      setParties([...parties, party])
      setNewParty({ name: "", description: "" })
      setIsAddPartyOpen(false)
    }
  }

  const handleAssignUserToParty = (userId: string, partyId: string) => {
    setUsers(users.map((user) => (user.id === userId ? { ...user, party: partyId || null } : user)))

    if (partyId) {
      setParties(
        parties.map((party) =>
          party.id === partyId
            ? {
                ...party,
                members: [
                  ...party.members.filter((m) => m !== users.find((u) => u.id === userId)?.username),
                  users.find((u) => u.id === userId)?.username,
                ].filter(Boolean) as string[],
              }
            : { ...party, members: party.members.filter((m) => m !== users.find((u) => u.id === userId)?.username) },
        ),
      )
    }
  }

  const handleAssignRobotToParty = (robotId: string, partyId: string) => {
    setRobots(robots.map((robot) => (robot.id === robotId ? { ...robot, party: partyId || null } : robot)))

    if (partyId) {
      setParties(
        parties.map((party) =>
          party.id === partyId
            ? { ...party, robots: [...party.robots.filter((r) => r !== robotId), robotId] }
            : { ...party, robots: party.robots.filter((r) => r !== robotId) },
        ),
      )
    }
  }

  const handleForceReleaseControl = (robotId: string) => {
    const robot = robots.find((r) => r.id === robotId)
    if (robot?.controller) {
      setUsers(users.map((user) => (user.username === robot.controller ? { ...user, controllingRobot: null } : user)))
      setRobots(robots.map((r) => (r.id === robotId ? { ...r, controller: null, status: "online" as const } : r)))
    }
  }

  const handleAssignControl = (robotId: string, username: string) => {
    // Release any existing control
    setUsers(
      users.map((user) => ({
        ...user,
        controllingRobot: user.controllingRobot === robotId ? null : user.controllingRobot,
      })),
    )
    setRobots(robots.map((robot) => ({ ...robot, controller: robot.id === robotId ? null : robot.controller })))

    // Assign new control
    if (username) {
      setUsers(users.map((user) => (user.username === username ? { ...user, controllingRobot: robotId } : user)))
      setRobots(
        robots.map((robot) =>
          robot.id === robotId ? { ...robot, controller: username, status: "busy" as const } : robot,
        ),
      )
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Admin Dashboard</h2>
        <div className="flex gap-2">
          <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
            <DialogTrigger asChild>
              <Button>
                <UsersIcon className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    placeholder="Enter username"
                  />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={newUser.role}
                    onValueChange={(value: "guest" | "user" | "admin" | "robot") =>
                      setNewUser({ ...newUser, role: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="guest">Guest</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="robot">Robot</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="party">Party (Optional)</Label>
                  <Select value={newUser.party} onValueChange={(value) => setNewUser({ ...newUser, party: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select party" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Party</SelectItem>
                      {parties.map((party) => (
                        <SelectItem key={party.id} value={party.id}>
                          {party.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddUser} className="w-full">
                  Add User
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddPartyOpen} onOpenChange={setIsAddPartyOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add Party
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Party</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="partyName">Party Name</Label>
                  <Input
                    id="partyName"
                    value={newParty.name}
                    onChange={(e) => setNewParty({ ...newParty, name: e.target.value })}
                    placeholder="Enter party name"
                  />
                </div>
                <div>
                  <Label htmlFor="partyDescription">Description</Label>
                  <Input
                    id="partyDescription"
                    value={newParty.description}
                    onChange={(e) => setNewParty({ ...newParty, description: e.target.value })}
                    placeholder="Enter party description"
                  />
                </div>
                <Button onClick={handleAddParty} className="w-full">
                  Create Party
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Party</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Controlling Robot</TableHead>
                    <TableHead>Last Seen</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="flex items-center gap-2">
                        {getRoleIcon(user.role)}
                        {user.username}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getRoleVariant(user.role)} className="capitalize">
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={user.party || "none"}
                          onValueChange={(value) => handleAssignUserToParty(user.id, value)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="No party" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Party</SelectItem>
                            {parties.map((party) => (
                              <SelectItem key={party.id} value={party.id}>
                                {party.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${getStatusColor(user.status)}`} />
                          <span className="capitalize">{user.status}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.controllingRobot ? (
                          <Badge variant="outline" className="flex items-center gap-1 w-fit">
                            <Hand className="h-3 w-3" />
                            {robots.find((r) => r.id === user.controllingRobot)?.name}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">None</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{user.lastSeen}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm">
                          <Edit className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
                    <TableHead>Location</TableHead>
                    <TableHead>Actions</TableHead>
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
                          {Math.round(robot.battery)}%
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Wifi className="h-4 w-4" />
                          {Math.round(robot.signal)}%
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {robot.controller ? (
                            <>
                              <Badge variant="outline" className="flex items-center gap-1">
                                <Hand className="h-3 w-3" />
                                {robot.controller}
                              </Badge>
                              <Button variant="outline" size="sm" onClick={() => handleForceReleaseControl(robot.id)}>
                                <UserX className="h-3 w-3" />
                              </Button>
                            </>
                          ) : (
                            <Select value="" onValueChange={(value) => handleAssignControl(robot.id, value)}>
                              <SelectTrigger className="w-32">
                                <SelectValue placeholder="Assign" />
                              </SelectTrigger>
                              <SelectContent>
                                {users
                                  .filter((user) => user.role !== "guest" && !user.controllingRobot)
                                  .map((user) => (
                                    <SelectItem key={user.id} value={user.username}>
                                      {user.username}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={robot.party || "none"}
                          onValueChange={(value) => handleAssignRobotToParty(robot.id, value)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="No party" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Party</SelectItem>
                            {parties.map((party) => (
                              <SelectItem key={party.id} value={party.id}>
                                {party.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-sm">{robot.location}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm">
                          <Settings className="h-3 w-3" />
                        </Button>
                      </TableCell>
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
              <Card key={party.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{party.name}</span>
                    <Badge variant="outline">{party.members.length} members</Badge>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{party.description}</p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium mb-2">Members</h4>
                      <div className="space-y-1">
                        {party.members.length > 0 ? (
                          party.members.map((member) => {
                            const user = users.find((u) => u.username === member)
                            return (
                              <div key={member} className="flex items-center gap-2">
                                {user && getRoleIcon(user.role)}
                                <span>{member}</span>
                                {user && (
                                  <Badge variant={getRoleVariant(user.role)} className="text-xs">
                                    {user.role}
                                  </Badge>
                                )}
                              </div>
                            )
                          })
                        ) : (
                          <p className="text-sm text-muted-foreground">No members</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Robots</h4>
                      <div className="space-y-1">
                        {party.robots.length > 0 ? (
                          party.robots.map((robotId) => {
                            const robot = robots.find((r) => r.id === robotId)
                            return (
                              <div key={robotId} className="flex items-center gap-2">
                                <Monitor className="h-4 w-4" />
                                <span>{robot?.name}</span>
                                {robot && <div className={`w-2 h-2 rounded-full ${getStatusColor(robot.status)}`} />}
                              </div>
                            )
                          })
                        ) : (
                          <p className="text-sm text-muted-foreground">No robots assigned</p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
