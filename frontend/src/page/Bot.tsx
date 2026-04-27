import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageType, RobotPeerAssignedMessage, SignalP2PPeerDisconnectedMessage } from "../api/websocket-api.protocol";
import { TopNav, TopNavLeft } from "../components/TopNav";
import { WebRTCAudioVideoComponent } from "../components/WebRTCAudioVideo";
import { WebsocketApiState } from "../reducer/websocket-api-reducer";
import { useSignal, useWebsocketApi } from "../service/websocket-api.provider";
import { getDefaultIceServers, isSupportedBrowserMedia } from "../util/webrtc";

export interface BotProps {
  state: WebsocketApiState;
}

export function BotPage({ state }: BotProps) {
  const nav = useNavigate();
  const wsApi = useWebsocketApi();
  const peerAssignedSignal = useSignal<RobotPeerAssignedMessage | null>(wsApi.getSignal(MessageType.ROBOT_PEER_ASSIGNED));
  const peerDisconnectedSignal = useSignal<SignalP2PPeerDisconnectedMessage | null>(wsApi.getSignal(MessageType.SIGNAL_PEER_DISCONNECTED));
  const [assignedPeerSessionId, setAssignedPeerSessionId] = useState<number | null>(null);

  useEffect(() => {
    if (!state.authenticated) nav("/login");
  }, [nav, state.authenticated]);

  useEffect(() => {
    if (!peerAssignedSignal?.peerSessionId) return;
    setAssignedPeerSessionId((current) => current === peerAssignedSignal.peerSessionId ? current : peerAssignedSignal.peerSessionId);
  }, [peerAssignedSignal]);

  useEffect(() => {
    if (!peerDisconnectedSignal?.targetId) return;
    setAssignedPeerSessionId((current) => current === peerDisconnectedSignal.targetId ? null : current);
  }, [peerDisconnectedSignal]);

  const isSupported = isSupportedBrowserMedia();

  return (
    <main className="relative h-screen w-full overflow-hidden bg-[#071017] text-white">
      <TopNavLeft>
        <div className="flex items-center gap-3">
          <div>
            <p className="m-0 text-xs tracking-[0.2em] text-white/45 uppercase">Robot Video</p>
            <p className="m-0 text-sm text-white/80">
              {state.username ?? "Robot"} {assignedPeerSessionId ? `paired with session ${assignedPeerSessionId}` : "waiting for controller"}
            </p>
          </div>
        </div>
      </TopNavLeft>

      <TopNav />

      <div className="relative flex h-[calc(100vh-64px)] min-h-0 gap-4 px-4 pb-4 pt-3">
        <div className="min-w-0 flex-1">
          {!isSupported && <h2>Error: browser does not support video / WebRTC</h2>}
          {isSupported && (
            <WebRTCAudioVideoComponent
              mode="answerer"
              peerSessionId={assignedPeerSessionId}
              iceServers={getDefaultIceServers()}
            />
          )}
        </div>
      </div>
    </main>
  );
}
