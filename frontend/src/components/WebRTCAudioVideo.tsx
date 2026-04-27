import { useEffect, useRef, useState } from "react";
import {
  MessageType,
  SignalP2PAnswerRequest,
  SignalP2PIceCandidateRequest,
  SignalP2POfferRequest,
  SignalP2PPeerDisconnectedMessage,
} from "../api/websocket-api.protocol";
import { useSignal, useWebsocketApi } from "../service/websocket-api.provider";
import { getDefaultIceServers, isSupportedBrowserMedia } from "../util/webrtc";
import { SignalP2PPeerReady } from "../../../backend/src/messages";
import { StableSettingsItem } from "./settings.component";
import { AVMediaSettings, initialDevices, initialSelections, MediaDeviceLists, MediaSelections } from "./AVMediaSettings";

export type WebRTCAVStatus =
  | "idle"
  | "waiting_for_video_node"
  | "acquiring_local_media"
  | "waiting_for_offer"
  | "creating_offer"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export type WebRTCAudioVideoProps = {
  mode: "offerer" | "answerer";
  peerSessionId?: number | null;
  iceServers?: RTCIceServer[];
  onStatusChange?: (status: WebRTCAVStatus) => void;
  onError?: (error: Error) => void;
};

const statusTextMap: Record<WebRTCAVStatus, { title: string; body: string }> = {
  idle: {
    title: "Idle",
    body: "Waiting for the media session to start.",
  },
  waiting_for_video_node: {
    title: "Waiting for video node",
    body: "The robot is acquired, but there is not an active browser video endpoint to connect to yet.",
  },
  acquiring_local_media: {
    title: "Acquiring local devices",
    body: "Requesting camera and microphone access before the peer connection comes up.",
  },
  waiting_for_offer: {
    title: "Waiting for offer",
    body: "Standing by for the remote browser to initiate the WebRTC session.",
  },
  creating_offer: {
    title: "Creating offer",
    body: "Preparing the peer connection and sending the initial SDP offer.",
  },
  connecting: {
    title: "Connecting",
    body: "Exchanging session details and ICE candidates with the remote browser.",
  },
  connected: {
    title: "Connected",
    body: "Media is flowing across the browser-to-browser WebRTC session.",
  },
  disconnected: {
    title: "Disconnected",
    body: "The peer session ended or became unavailable.",
  },
  error: {
    title: "Connection error",
    body: "Something went wrong while setting up the media session.",
  },
};

export function WebRTCAudioVideoComponent({
  mode,
  peerSessionId,
  iceServers,
  onError,
  onStatusChange,
}: WebRTCAudioVideoProps
) {
  const wsApi = useWebsocketApi();

  const [hasMediaPermission, setHasMediaPermission] = useState<boolean>(false);
  const [isPeerReady, setIsPeerReady] = useState<boolean>(false);

  // Peer connection & transceivers
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const videoTxRx = useRef<RTCRtpTransceiver | null>(null);
  const audioTxRx = useRef<RTCRtpTransceiver | null>(null);
  const dataTxRx = useRef<RTCDataChannel | null>(null);
  const [txRxReady, setTxRxReady] = useState<boolean>(false);

  // Signals for WebRTC signalling
  const peerReadySignal = useSignal<SignalP2PPeerReady | null>(wsApi.getSignal(MessageType.SIGNAL_PEER_READY));
  const offerSignal = useSignal<SignalP2POfferRequest | null>(wsApi.getSignal(MessageType.SIGNAL_P2POFFER_REQUEST));
  const answerSignal = useSignal<SignalP2PAnswerRequest | null>(wsApi.getSignal(MessageType.SIGNAL_P2PANSWER_REQUEST));
  const iceSignal = useSignal<SignalP2PIceCandidateRequest | null>(wsApi.getSignal(MessageType.SIGNAL_P2PICECANDIDATE_REQUEST));
  const peerDisconnectedSignal = useSignal<SignalP2PPeerDisconnectedMessage | null>(wsApi.getSignal(MessageType.SIGNAL_PEER_DISCONNECTED));

  // WebRTC stuff
  const pendingIceCandidatesRef = useRef<any[] | null>([]);

  // Refs to video elements in the browser
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteStream = useRef<MediaStream>(new MediaStream());

  // TX mutes
  const [isMicMute, setIsMicMute] = useState(false);
  const [isVideoMute, setIsVideoMute] = useState(false);

  // TBD
  const [status, setStatus] = useState<WebRTCAVStatus>("idle");
  const [devices, setDevices] = useState<MediaDeviceLists>(initialDevices);
  const [selectedDevices, setSelectedDevices] = useState<MediaSelections>(initialSelections);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [localPreviewVisible, setLocalPreviewVisible] = useState(false);

  iceServers ??= getDefaultIceServers();

  // Get permissions for media
  useEffect(() => {
    if (peerSessionId === null || peerSessionId === undefined) return;
    (async () => {
      if (!isSupportedBrowserMedia()) throw new Error("This browser does not support camera and microphone access.");
      setStatus('acquiring_local_media');
      await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setHasMediaPermission(true);
    })();
  }, [peerSessionId]);

  // Update media devices
  useEffect(() => {
    const update = async () => {
      if (!navigator.mediaDevices?.enumerateDevices) return;

      const availableDevices = await navigator.mediaDevices.enumerateDevices();
      const nextDevices: MediaDeviceLists = {
        cameras: availableDevices.filter((device) => device.kind === "videoinput"),
        microphones: availableDevices.filter((device) => device.kind === "audioinput"),
        speakers: availableDevices.filter((device) => device.kind === "audiooutput"),
      };

      setDevices(nextDevices);
      setSelectedDevices((current) => ({
        cameraId: nextDevices.cameras.some((device) => device.deviceId === current.cameraId)
          ? current.cameraId
          : (nextDevices.cameras[0]?.deviceId ?? ""),
        microphoneId: nextDevices.microphones.some((device) => device.deviceId === current.microphoneId)
          ? current.microphoneId
          : (nextDevices.microphones[0]?.deviceId ?? ""),
        speakerId: nextDevices.speakers.some((device) => device.deviceId === current.speakerId)
          ? current.speakerId
          : (nextDevices.speakers[0]?.deviceId ?? ""),
      }));
    };

    void update();

    if (!hasMediaPermission) return;
    navigator.mediaDevices.addEventListener('devicechange', update);
    return () => navigator.mediaDevices.removeEventListener('devicechange', update); // gc
  }, [hasMediaPermission]);

  // Phase 1: broadcast to peer that we're ready for peer connection
  useEffect(() => {
    if (peerSessionId === null || peerSessionId === undefined) return;

    const fn = () => {
      wsApi.send<SignalP2PPeerReady>({
        type: MessageType.SIGNAL_PEER_READY,
        targetId: peerSessionId,
      });
    };

    const interval = setInterval(fn, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [peerSessionId, hasMediaPermission]);

  // Phase 2: detect when peer is ready (and cache to prevent constant state updates)
  useEffect(() => {
    if (peerReadySignal?.type !== MessageType.SIGNAL_PEER_READY) return; // undefined message
    if (isPeerReady) return; // already ready, avoid extra state update
    setIsPeerReady(true);
  }, [peerReadySignal]);

  // Phase 4: create peer connection and start ICE
  useEffect(() => {
    if (peerSessionId === null || peerSessionId === undefined) return; // no peer assigned?
    if (!isPeerReady) return; // peer isn't ready yet

    (async () => {
      const pc = new RTCPeerConnection({ iceServers });
      peerConnectionRef.current = pc;

      pc.onicecandidate = event => {
        if (event.candidate) {
          wsApi.send<SignalP2PIceCandidateRequest>({
            type: MessageType.SIGNAL_P2PICECANDIDATE_REQUEST,
            targetId: peerSessionId,
            candidate: event.candidate,
          });
        }
      };

      pc.ontrack = event => {
        const { track } = event;
        remoteStream.current.addTrack(track);

        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream.current;
      };

      videoTxRx.current = pc.addTransceiver('video', { direction: 'sendrecv' });
      audioTxRx.current = pc.addTransceiver('audio', { direction: 'sendrecv'});
      dataTxRx.current = pc.createDataChannel('control');

      setTxRxReady(true);

      switch (mode) {
        case 'offerer':
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          // Initiate by sending the offer to the peer if we're the offerer
          wsApi.send<SignalP2POfferRequest>({
            type: MessageType.SIGNAL_P2POFFER_REQUEST,
            targetId: peerSessionId,
            offer,
          });
          break;
        case 'answerer':
          break;
        default:
          throw new Error("wtf");
      }
    })();

    return () => peerConnectionRef.current?.close();
  }, [peerSessionId, isPeerReady]);

  // Listen to signalling, phase 1
  useEffect(() => {
    (async () => {
      const pc = peerConnectionRef.current;

      if (peerSessionId === null || peerSessionId === undefined) return;
      if (!offerSignal?.offer) return;

      await pc?.setRemoteDescription(offerSignal?.offer);
      const answer = await pc?.createAnswer();
      await pc?.setLocalDescription(answer);

      wsApi.send<SignalP2PAnswerRequest>({
        type: MessageType.SIGNAL_P2PANSWER_REQUEST,
        targetId: peerSessionId,
        answer: answer,
      });
    })();
  }, [offerSignal]);

  useEffect(() => {
    (async () => {
      if (!iceSignal?.candidate) return;
      const pc = peerConnectionRef.current;
      (!pendingIceCandidatesRef.current || Boolean(pc?.remoteDescription)) ?
         await pc?.addIceCandidate(iceSignal.candidate) :
        pendingIceCandidatesRef.current?.push(iceSignal.candidate);
    })();
  }, [iceSignal]);

  useEffect(() => {
    (async () => {
      if (!answerSignal?.answer?.sdp) return;
      const pc = peerConnectionRef?.current;
      // TODO: figure this out later, should be fine for PoC
      // if (pc?.signalingState !== 'stable')
      //   return console.error('Signaling isn\'t stable. Ignoring offer ', offerSignal?.offer);

      await pc?.setRemoteDescription(answerSignal.answer);
      const pendingIceCandidates = pendingIceCandidatesRef.current ?? []; // should never be null but ynk
      pendingIceCandidatesRef.current = null;
      for await (const c of pendingIceCandidates) await pc?.addIceCandidate(c);
    })();
  }, [answerSignal]);

  useEffect(() => {
    if (!hasMediaPermission) return;
    if (!videoTxRx.current || !audioTxRx.current) return;

    (async () => {
      try {
        // const localStream = await navigator.mediaDevices.getUserMedia({
        //   video: selectedDevices.cameraId ? { deviceId: selectedDevices.cameraId } : true,
        //   audio: selectedDevices.microphoneId ? { deviceId: selectedDevices.microphoneId } : true,
        // });
        const localStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        const videoTrack = localStream.getVideoTracks()[0];
        const audioTrack = localStream.getAudioTracks()[0];

        if (videoTrack && videoTxRx.current) {
          await videoTxRx.current.sender.replaceTrack(videoTrack);
          videoTxRx.current.direction = 'sendrecv';
        }

        if (audioTrack && audioTxRx.current) {
          await audioTxRx.current.sender.replaceTrack(audioTrack);
          audioTxRx.current.direction = 'sendrecv';
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
        }
      } catch (error) {
        console.error('Failed to get local media:', error);
        setErrorText('Failed to access media devices');
      }
    })();

    return () => {
      if (localVideoRef.current?.srcObject instanceof MediaStream) {
        localVideoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, [
    selectedDevices,
    hasMediaPermission,
    txRxReady
  ]);

  const quickControls = (
    <div className="absolute bottom-5 right-5 z-20 flex gap-2">
      <button
        type="button"
        className="rounded-full border border-white/15 bg-black/55 px-3 py-2 text-xs text-white backdrop-blur"
        onClick={() => setIsMicMute(!isMicMute)}
      >
        {isMicMute ? "Mute" : "Unmute"}
      </button>
      <button
        type="button"
        className="rounded-full border border-white/15 bg-black/55 px-3 py-2 text-xs text-white backdrop-blur"
        onClick={() => setIsVideoMute(!isVideoMute)}
      >
        {isVideoMute ? "Hide cam" : "Show cam"}
      </button>
    </div>
  );

  const statusCard = statusTextMap[status];

  return (
    <>
      <StableSettingsItem>
        <AVMediaSettings
          devices={devices}
          selections={selectedDevices}
          isMicMute={isMicMute}
          isVideoMute={isVideoMute}
          localPreviewVisible={localPreviewVisible}
          onSelectionChange={setSelectedDevices}
          onMicMuteChange={setIsMicMute}
          onVideoMuteChange={setIsVideoMute}
          onLocalPreviewVisibleChange={setLocalPreviewVisible}
        />
      </StableSettingsItem>

      <section className="relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden rounded-3xl border border-white/10">
        <div className="absolute inset-0" />

        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover"
        />

        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className="absolute bottom-5 left-5 z-20 h-36 w-56 rounded-2xl border border-white/15 bg-black/50 object-cover shadow-[0_18px_45px_rgba(0,0,0,0.35)]"
        />

        <div className="absolute left-5 top-5 z-20 rounded-full border border-white/10 bg-black/35 px-3 py-1 text-xs tracking-[0.24em] text-white/75 uppercase">
          {status.replaceAll("_", " ")}
        </div>

        {quickControls}

        <div className="relative z-10 grid max-w-xl gap-4 px-6 text-center">
          <p className="m-0 text-sm tracking-[0.28em] text-[#9be7b5] uppercase">WebRTC Surface</p>
          <h1 className="m-0 text-4xl text-white">{statusCard.title}</h1>
          <p className="m-0 text-base leading-7 text-white/70">
            {errorText ?? statusCard.body}
          </p>
        </div>
      </section>
    </>

  );
}
