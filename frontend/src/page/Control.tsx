import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TopNav, TopNavLeft } from "../components/TopNav";
import { WebsocketApiState } from "../reducer/websocket-api-reducer";
import { useSignal, useWebsocketApi } from "../service/websocket-api.provider";
import { MessageType, RobotSuccessfullyAcquiredResponse } from "../api/websocket-api.protocol";
import { WebRTCAudioVideoComponent } from "../components/WebRTCAudioVideo";
import { getDefaultIceServers, isSupportedBrowserMedia } from "../util/webrtc";

export interface ControlProps {
  state: WebsocketApiState
}

export function Control({ state }: ControlProps) {
  const nav = useNavigate();
  const wsApi = useWebsocketApi();
  const robotSignal = useSignal<RobotSuccessfullyAcquiredResponse | null>(wsApi.getSignal(MessageType.ROBOT_ACQUIRE_RESPONSE));

  useEffect(() => {
    if (!state.authenticated) nav("/login");
    if (!state.hasRobotControl) nav("/list-bots");
  }, [state]);

  const isSupported = isSupportedBrowserMedia();

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

      <TopNav />

      <div className="relative flex h-[calc(100vh-64px)] min-h-0 gap-4 px-4 pb-4 pt-3">
        <div className="min-w-0 flex-1">
          {!isSupported && <h2>Error: browser does not support video / WebRTC</h2>}
          {isSupported && <WebRTCAudioVideoComponent
            mode="offerer"
            peerSessionId={robotSignal?.videoSessionId}
            iceServers={getDefaultIceServers()}
          />}
        </div>
      </div>
    </main>
  );
}
