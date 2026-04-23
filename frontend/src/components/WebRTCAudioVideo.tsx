import { useEffect, useReducer, useRef } from "react";
import { WebsocketApiState } from "../reducer/websocket-api-reducer";
import { useSignal, useWebsocketApi } from "../service/websocket-api.provider";
import { Message, MessageType, RobotSuccessfullyAcquiredResponse } from "../api/websocket-api.protocol";

export interface WebRTCAudioVideoComponentProps {
  state: WebsocketApiState,
  robotUserId: number,
}

export interface WebRTCAVState {
  state: boolean;
}

const initialWebrtcAVState: WebRTCAVState = {
  state: false,
};

function webrtcAVReducer(s: WebRTCAVState, a: Message) {
  return s;
}

/**
 * Sets up and holds a WebRTC video call
 * 
 * Design goals:
 * * Robot might be acquired, but we aren't guaranteed to get the session ID of the browser to video call
 * * Session ID of browser to video call might change
 * * This component JUST handles video, we'll create a second component <WebRTCControls> which connects to the
 *   dataplane and signals the robot
 * * Need to figure out how to make config work. My thought is change the settings panel to be a provider
 *   and we can use a React hook to add controls
 * * Idk how this will handle state changes elsewhere
 * * If the state changes, we may need to disconnect. I think primarily we listen to the peer disconnect signals
 *   from the wsApi to tell us we shouldn't talk to the peer anymore if we're a robot.
 * @returns 
 */
export function WebRTCAudioVideoComponent() {
  const wsApi = useWebsocketApi();
  const robotAcqSignal = useSignal<RobotSuccessfullyAcquiredResponse | null>(wsApi.getSignal(MessageType.ROBOT_ACQUIRE_RESPONSE));
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const browserPeerConnectionRef = useRef(null);
  const [robotConfigReducer, dispatch] = useReducer(webrtcAVReducer, initialWebrtcAVState);

  useEffect(() => {
    dispatch(robotAcqSignal as Message);
  }, [robotAcqSignal]);

  return (
    <section className="relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top,#23313d_0%,#11181f_45%,#091016_100%)] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(155,231,181,0.12),transparent_30%,transparent_70%,rgba(102,178,255,0.12))]" />

      <div className="absolute left-5 top-5 rounded-full border border-white/10 bg-black/35 px-3 py-1 text-xs tracking-[0.24em] text-white/75 uppercase">
        Live feed placeholder
      </div>

      <div className="relative z-10 grid max-w-xl gap-4 px-6 text-center">
        <p className="m-0 text-sm tracking-[0.28em] text-[#9be7b5] uppercase">WebRTC Surface</p>
        <h1 className="m-0 text-4xl text-white">WebRTCAudioVideoComponent</h1>
        <p className="m-0 text-base leading-7 text-white/70">
          Replace this skeleton with the real bidirectional audio and video session when the transport layer is ready.
        </p>
      </div>
    </section>
  );
}
