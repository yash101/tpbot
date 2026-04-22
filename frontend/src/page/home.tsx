import { useNavigate } from "react-router-dom";
import { WebsocketApiState } from "../reducer/websocket-api-reducer";
import { ActiveUserRole } from "../api/websocket-api.protocol";
import { useEffect } from "react";

export interface HomePageProps {
  state: WebsocketApiState;
}

export function HomePage({state}: HomePageProps) {
  const nav = useNavigate();

  useEffect(() => {
    if (!state.authenticated) nav('/login');
    if (state.role === ActiveUserRole.ROBOT_VIDEO) nav('/bot');
    if (state.role === ActiveUserRole.USER) nav('/list-bots');
  }, [ state ]);

  return (
    <main className="page">
      <h1>Loading...</h1>
    </main>
  );
}
