import { TopNav, TopNavCenter } from "../components/TopNav";
import { WebsocketApiState } from "../reducer/websocket-api-reducer";

export interface ControlProps {
  state: WebsocketApiState
}

export function Control({ state }: ControlProps) {
  return (
    <main className="w-full">
      <TopNav />
    </main>
  );
}
