"use client"

import { useEffect, useState } from "react"
import { LoginForm } from "@/components/login-form"
import { Dashboard } from "@/components/dashboard"
import { useRealtime, useSignal } from "@/service/providers"
import { Status } from "@/service/RealtimeClient"
import { UserInfo, UserRole } from "@/service/types"
import { toast } from "@/hooks/use-toast"

export default function Home() {
  const rt = useRealtime();
  const wsConnected = useSignal(rt.status);
  const auth = useSignal(rt.getSignal('user:auth'));
  const [ userInfo, setUserInfo ] = useState<UserInfo | null>(null);
  const [ creds, setCreds ] = useState<{
    username: string
    password: string
    remember?: boolean
  } | null>(null);
  const [ loginFailed, setLoginFailed ] = useState(false);

  // Load saved credentials once on mount (only if no creds in state)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("telepresence-robot-credentials")
      if (saved) {
        const obj = JSON.parse(saved);
        if (obj?.username && obj?.password) {
          setCreds({ username: obj.username, password: obj.password, remember: true });
        }
      }
    } catch (e) {
      console.error("Failed to parse saved credentials", e)
    }
  }, []);

  // Persist credentials if the user checked "remember me". Remove otherwise.
  useEffect(() => {
    if (creds?.remember && creds.username && creds.password) {
      try {
        localStorage.setItem("telepresence-robot-credentials", JSON.stringify({
          username: creds.username,
          password: creds.password,
        }));
      } catch (e) {
        console.error("Failed to save credentials", e)
      }
    } else {
      localStorage.removeItem("telepresence-robot-credentials");
    }
  }, [ creds ]);

  useEffect(() => {
    // Authenticate with the API when websocket is connected and we have creds
    // only if we don't already have a logged-in user.
    if (wsConnected === Status.CONNECTED && creds && !userInfo?.username) {
      console.debug("Authenticating with saved credentials", creds.username);
      rt.send({
        type: 'user:auth',
        username: creds.username,
        password: creds.password,
      });
    }
  }, [ wsConnected, creds, rt ]);

  useEffect(() => {
    if (auth && auth.success === true) {
      setLoginFailed(false);
      setUserInfo({
        username: creds?.username || null,
        role: auth.role,
        name: auth.name,
      });
      toast({
        title: 'Login successful',
        description: `Welcome back, ${auth.name || auth.username || 'user'}!`,
        duration: 4000,
      });
    } else if (auth && auth.success === false) {
      setLoginFailed(true);
      setUserInfo(null);
      toast({
        title: 'Login Failed',
        description: `Please try again!`,
        variant: 'destructive',
        duration: 4000,
      });
    }
    // Do not set loginFailed if auth is undefined or null
  }, [ auth ]);

  const handleLogin = (username: string, password: string, remember: boolean) => {
    setCreds({ username, password, remember });
  }

  const handleLogout = () => {
    setCreds(null);
    setUserInfo(null);
    localStorage.removeItem("telepresence-robot-credentials");
    rt.reconnect();
  }

  console.debug("User info:", userInfo);

  if (!userInfo?.username) {
    // Not logged in
    return <LoginForm
      onLogin={handleLogin}
      initialValues={creds ?? undefined}
      loginFailed={loginFailed}
    />
  }

  return <Dashboard user={userInfo} onLogout={handleLogout} />
}
