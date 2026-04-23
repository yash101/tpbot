import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TopNav, TopNavCenter, TopNavLeft, TopNavRight } from "../components/TopNav";
import { WebsocketApiState } from "../reducer/websocket-api-reducer";
import { useSignal, useWebsocketApi } from "../service/websocket-api.provider";
import { MessageType, RobotSuccessfullyAcquiredResponse } from "../api/websocket-api.protocol";
import { WebRTCAudioVideoComponent } from "../components/WebRTCAudioVideo";

export interface ControlProps {
  state: WebsocketApiState
}

function ControlDrawer({ open }: { open: boolean }) {
  return (
    <aside
      className={`absolute right-0 top-0 z-30 flex h-full w-full max-w-sm flex-col border-l border-white/10 bg-[#111920]/95 shadow-[-24px_0_60px_rgba(0,0,0,0.4)] backdrop-blur transition-transform duration-300 ease-out ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
      aria-hidden={!open}
    >
      <div className="border-b border-white/10 px-5 py-4">
        <p className="m-0 text-xs tracking-[0.24em] text-[#9be7b5] uppercase">Drawer Skeleton</p>
        <h2 className="m-0 mt-2 text-2xl text-white">Robot Controls</h2>
      </div>

      <div className="grid flex-1 gap-4 overflow-y-auto p-5">
        <section className="rounded-2xl border border-white/10 bg-white/4 p-4">
          <p className="m-0 text-sm font-semibold text-white">Movement controls</p>
          <p className="m-0 mt-2 text-sm text-white/65">Reserved for joystick, velocity presets, and emergency stop actions.</p>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/4 p-4">
          <p className="m-0 text-sm font-semibold text-white">Camera and audio</p>
          <p className="m-0 mt-2 text-sm text-white/65">Reserved for mute, speaker, camera source, and quality settings.</p>
        </section>

        <section className="rounded-2xl border border-dashed border-white/15 bg-black/10 p-4">
          <p className="m-0 text-sm font-semibold text-white">Telemetry</p>
          <p className="m-0 mt-2 text-sm text-white/65">Reserved for battery, signal quality, latency, and robot health indicators.</p>
        </section>
      </div>
    </aside>
  );
}

export function Control({ state }: ControlProps) {
  const nav = useNavigate();
  const wsApi = useWebsocketApi();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const robotSignal = useSignal<RobotSuccessfullyAcquiredResponse | null>(wsApi.getSignal(MessageType.ROBOT_ACQUIRE_RESPONSE));

  useEffect(() => {
    if (!state.authenticated) nav("/login");
    if (!state.hasRobotControl) nav("/list-bots");
  }, [nav, state.authenticated, state.hasRobotControl]);

  return (
    <main className="relative h-screen w-full overflow-hidden bg-[#071017] text-white">
      <TopNavLeft>
        <div className="flex items-center gap-3">
          <div>
            <p className="m-0 text-xs tracking-[0.2em] text-white/45 uppercase">Robot Control</p>
            <p className="m-0 text-sm text-white/80">
              {state.username ?? "Operator"} controlling robot {robotSignal?.robotUserId ?? "(loading)"}
            </p>
          </div>
        </div>
      </TopNavLeft>

      <TopNavRight>
        <button type="button" className="px-1" onClick={() => setDrawerOpen((current) => !current)}>
          {drawerOpen ? "❌" : "⚙️"}
        </button>
      </TopNavRight>

      <TopNav />

      <div className="relative flex h-[calc(100vh-64px)] min-h-0 gap-4 px-4 pb-4 pt-3">
        <div className={`min-w-0 flex-1 transition-[margin] duration-300 ease-out ${drawerOpen ? "mr-[min(24rem,100vw)]" : "mr-0"}`}>
          <WebRTCAudioVideoComponent />
        </div>

        <ControlDrawer open={drawerOpen} />
      </div>
    </main>
  );
}
