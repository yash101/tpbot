"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LogOut, Settings, Users, Activity } from "lucide-react"
import { RobotControlInterface } from "@/components/robot-control-interface"
import { AdminDashboard } from "@/components/admin-dashboard"
import { SystemStatus } from "@/components/system-status"
import { ConnectionStatus } from "@/components/connection-status"

interface DashboardProps {
  user: {
    username: string
    role: "guest" | "user" | "admin" | "robot"
  }
  onLogout: () => void
}

export function Dashboard({ user, onLogout }: DashboardProps) {
  const [activeView, setActiveView] = useState<"robots" | "admin" | "status">("robots")

  const getRoleBadgeVariant = (role: string) => {
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">Telepresence Control Terminal</h1>
            <Badge variant={getRoleBadgeVariant(user.role)} className="capitalize">
              {user.role}
            </Badge>
            <ConnectionStatus />
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">Welcome, {user.username}</span>
            <Button variant="outline" size="sm" onClick={onLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="border-b bg-card">
        <div className="flex px-6">
          <Button
            variant={activeView === "robots" ? "default" : "ghost"}
            onClick={() => setActiveView("robots")}
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
          >
            <Settings className="h-4 w-4 mr-2" />
            Robot Control
          </Button>

          {user.role === "admin" && (
            <Button
              variant={activeView === "admin" ? "default" : "ghost"}
              onClick={() => setActiveView("admin")}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
            >
              <Users className="h-4 w-4 mr-2" />
              Admin Panel
            </Button>
          )}

          <Button
            variant={activeView === "status" ? "default" : "ghost"}
            onClick={() => setActiveView("status")}
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
          >
            <Activity className="h-4 w-4 mr-2" />
            System Status
          </Button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="p-6">
        {activeView === "robots" && <RobotControlInterface user={user} />}
        {activeView === "admin" && user.role === "admin" && <AdminDashboard />}
        {activeView === "status" && <SystemStatus />}
      </main>
    </div>
  )
}
