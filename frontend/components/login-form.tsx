"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Monitor, Shield, User, Bot } from "lucide-react"

interface LoginFormProps {
  onLogin: (username: string, role: "guest" | "user" | "admin" | "robot") => void
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<"guest" | "user" | "admin" | "robot">("user")
  const [rememberMe, setRememberMe] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (username.trim()) {
      onLogin(username, role)
    }
  }

  const getRoleIcon = (roleType: string) => {
    switch (roleType) {
      case "guest":
        return <User className="h-4 w-4" />
      case "user":
        return <Monitor className="h-4 w-4" />
      case "admin":
        return <Shield className="h-4 w-4" />
      case "robot":
        return <Bot className="h-4 w-4" />
      default:
        return <User className="h-4 w-4" />
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <Monitor className="h-8 w-8 text-primary mr-2" />
            <CardTitle className="text-2xl font-bold">Telepresence Control</CardTitle>
          </div>
          <CardDescription>Access the robot control terminal</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={(value: "guest" | "user" | "admin" | "robot") => setRole(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="guest">
                    <div className="flex items-center gap-2">
                      {getRoleIcon("guest")}
                      Guest
                    </div>
                  </SelectItem>
                  <SelectItem value="user">
                    <div className="flex items-center gap-2">
                      {getRoleIcon("user")}
                      User
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      {getRoleIcon("admin")}
                      Admin
                    </div>
                  </SelectItem>
                  <SelectItem value="robot">
                    <div className="flex items-center gap-2">
                      {getRoleIcon("robot")}
                      Robot
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
              />
              <Label htmlFor="remember" className="text-sm">
                Remember me
              </Label>
            </div>

            <Button type="submit" className="w-full">
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
