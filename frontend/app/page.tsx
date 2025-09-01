"use client"

import { useEffect, useState } from "react"
import { LoginForm } from "@/components/login-form"
import { Dashboard } from "@/components/dashboard"
import { useRealtime, useSignal } from "@/service/providers"
import { Status } from "@/service/RealtimeClient"
import { UserRole } from "@/service/types"

export default function Home() {
  const rt = useRealtime();
  const wsConnected = useSignal(rt.status);
  const auth = useSignal(rt.getSignal('user:auth'));

  const [ userInfo, setUserInfo ] = useState<{
    username: string;
    role: UserRole;
    name: string;
  } | null>(null);

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
      console.log("Authenticating with saved credentials", creds.username);
      rt.send({
        type: 'user:auth',
        username: creds.username,
        password: creds.password,
      });
    }
  }, [wsConnected, creds, rt]);

  useEffect(() => {
    if (auth?.success) {
      setLoginFailed(false);
      setUserInfo({
        username: auth.username,
        role: auth.role,
        name: auth.name,
      });
    } else {
      setLoginFailed(true);
    }
  }, [ auth ]);

  const handleLogin = (username: string, password: string, remember: boolean) => {
    setCreds({ username, password, remember });
  }

  const handleLogout = () => {
    setCreds(null);
    localStorage.removeItem("telepresence-robot-credentials");
    rt.reconnect();
    // Log out from websocket
  }

  if (!userInfo?.username) {
    // Not logged in
    return <LoginForm
      onLogin={handleLogin}
      initialValues={creds ?? undefined}
      loginFailed={loginFailed}
    />
  }

  return <Dashboard user={{username: 'placeholder', role: 'admin'}} onLogout={handleLogout} />
}
