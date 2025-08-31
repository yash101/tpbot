"use client"

import { useState } from "react"
import { LoginForm } from "@/components/login-form"
import { Dashboard } from "@/components/dashboard"
import { WebSocketProvider } from "@/components/websocket-provider"

export default function Home() {
  const [user, setUser] = useState<{
    username: string
    role: "guest" | "user" | "admin" | "robot"
  } | null>(null)

  const handleLogin = (username: string, role: "guest" | "user" | "admin" | "robot") => {
    setUser({ username, role })
  }

  const handleLogout = () => {
    setUser(null)
  }

  if (!user) {
    return <LoginForm onLogin={handleLogin} />
  }

  return (
    <WebSocketProvider user={user}>
      <Dashboard user={user} onLogout={handleLogout} />
    </WebSocketProvider>
  )
}
