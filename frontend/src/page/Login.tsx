import { ActiveUserRole, AuthFailureResponse, AuthRequest, AuthSuccessResponse, ClientKind, MessageType } from "../api/websocket-api.protocol";
import { useWebsocketApi, useSignal } from "@/src/service/websocket-api.provider";
import { FormEvent, useEffect, useState } from "react";
import { Status } from "../api/websocket-api.client";
import { WebsocketApiState } from "../reducer/websocket-api-reducer";
import { useNavigate } from "react-router-dom";

export interface LoginScreenProps {
  state: WebsocketApiState
}

const connectionStatusLabels: Record<Status, string> = {
  [Status.CONNECTING]: "Connecting...",
  [Status.CONNECTED]: "Connected",
  [Status.CLOSED]: "Disconnected",
};

export function LoginScreen({state}: LoginScreenProps) {
  const nav = useNavigate();
  const wsApi = useWebsocketApi();
  const connectionStatus = useSignal(wsApi.status);
  const authFailure = useSignal(wsApi.getSignal<AuthFailureResponse>(MessageType.AUTH_FAILURE));
  const authSuccess = useSignal(wsApi.getSignal<AuthSuccessResponse>(MessageType.AUTH_SUCCESS));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (authSuccess?.role) setErrorMessage(null);
    else {
      setErrorMessage('Weird, unexpected or malformed response from the server. Perhaps try again?');
      return;
    }

    switch (authSuccess?.role) {
      case ActiveUserRole.USER:
        nav('/list-bots');
        return;
      case ActiveUserRole.ROBOT_VIDEO:
        nav('/bot');
        return;
      default:
        setErrorMessage(`Weird: got an unexpected assigned role ${authSuccess!.role}`);
        return;
    }
  }, [authSuccess]);

  useEffect(() => {
    setErrorMessage(authFailure?.error ?? "Unknown error occurred");
  }, [authFailure]);


  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const data = new FormData(event.currentTarget);
    wsApi.setSignalValue(MessageType.AUTH_FAILURE, null);
    wsApi.send<AuthRequest>({
      type: MessageType.AUTH_REQUEST,
      username: String(data.get("username") ?? ""),
      password: String(data.get("password") ?? ""),
      clientKind: ClientKind.WEB,
    });
  }

  return (
    <main className="w-full">
      <main className="page narrow">
        <section className="panel">
          <p className="eyebrow">Realtime link: {connectionStatusLabels[connectionStatus] ?? "Unknown"}</p>
          <h1>Log in!</h1>

          <form className="stack" onSubmit={handleSubmit}>
            <label>
              Username
              <input name="username" autoComplete="username" required />
            </label>

            <label>
              Password
              <input name="password" type="password" autoComplete="current-password" required />
            </label>

            {authFailure ? <p className="error">{authFailure.error}</p> : null}
            {connectionStatus === Status.CONNECTING && <p className="error">Please wait, still connecting.</p>}

            <button
              type="submit"
              disabled={connectionStatus === Status.CONNECTING}
            >
              Log in
            </button>
          </form>
        </section>
      </main>
    </main>
  );
}
