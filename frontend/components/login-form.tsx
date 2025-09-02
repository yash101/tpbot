"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Monitor } from "lucide-react"

interface LoginFormProps {
  onLogin: (username: string, password: string, remember: boolean) => void
  initialValues?: {
    username: string
    password: string
    remember?: boolean
  },
  loginFailed?: boolean
}

export function LoginForm({
  onLogin,
  initialValues,
  loginFailed,
}: LoginFormProps) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(false)

  useEffect(() => {
    if (initialValues) {
      setUsername(initialValues.username ?? "")
      setPassword(initialValues.password ?? "")
      setRememberMe(initialValues.remember ?? false)
    }
  }, [initialValues])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (username.trim()) {
      onLogin(username, password, rememberMe);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        { (loginFailed) && (
          <div className="text-red-500 text-center py-2">
        Login failed. Please check your credentials.
          </div>
        )}
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

            <Button type="submit" className="w-full">Sign In</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
