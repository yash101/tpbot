import { RealtimeClient, Status } from "@/service/RealtimeClient";
import { Signal } from "@/service/Signal";

type WebRTCTarget = "robot" | "llbe";

export class WebRTCManager {
  // private readonly peers = new Map<WebRTCTarget, RTCPeerConnection>();
  // public readonly robotStream = new Signal<MediaStream | null>(null);
  // public readonly llbeChannelSignal = new Signal<any>(null);
  // public readonly llbeChannelStatus = new Signal<Status>(Status.CLOSED);

  // We need a WebRTC peer connection to LLBE
  // We need WebRTC connections for video
  //  * If we're a user, one webrtc connection is necessary for video+audio but the frontend initiates
  //  * If we're a robot, one webrtc connection is necessary for video+audio but the backend is the initiator

  private peersMap = new Map<string, RTCPeerConnection>();

  constructor(
    private readonly realtimeClient: RealtimeClient,
    private readonly rtcConfig: RTCConfiguration,
  ) {
    this.realtimeClient = realtimeClient;
    this.rtcConfig = rtcConfig;

    this.realtimeClient.getSignal('webrtc:sdp').subscribe(async (msg: any) => {
      const target: string = msg?.target as string;
      if (!target) {
        console.warn("No target in webrtc:sdp message", msg);
        return;
      }

      // Ensure we have a PeerConnection for this target
      let pc = this.peersMap.get(target);
      if (!pc) {
        pc = new RTCPeerConnection(this.rtcConfig);
        this.setupPeerHandlers(target, pc);
      }

      const sdp = msg?.sdp;
      if (!sdp) {
        console.warn("No SDP in webrtc:sdp message", msg);
        return;
      }

      await pc.setRemoteDescription(new RTCSessionDescription(sdp));

      if (sdp.type === 'offer') {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
    
        this.realtimeClient.send({
          type: 'webrtc:sdp',
          target,
          sdp: answer,
        });
      }

      console.log("Set remote description for", target, sdp);
      this.peersMap.set(target, pc);
    });

    this.realtimeClient.getSignal('webrtc:ice').subscribe((msg: any) => {
      const target: string = msg?.target as string;
      if (!target) {
        console.warn("No target in webrtc:ice message", msg);
        return;
      }

      const pc = this.peersMap.get(target)!;
      if (!pc) {
        console.warn('No peer connection for target', target);
        return;
      }
      
      const candidate = msg?.candidate;
      if (!candidate) {
        console.warn("No candidate in webrtc:ice message", msg);
        return;
      }
      
      pc.addIceCandidate(new RTCIceCandidate(candidate));
      console.log("Added ICE candidate for", target, candidate);
    });
  }

  private setupPeerHandlers(target: string, pc: RTCPeerConnection) {
    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        this.realtimeClient.send({ type: 'webrtc:ice', target, candidate: ev.candidate });
      }
    };

    pc.ondatachannel = (ev) => {
      const dc = ev.channel;
      console.log('DataChannel received from', target, dc.label);
      dc.onopen = () => console.log('DataChannel open', target);
      dc.onmessage = (e) => console.log('DataChannel message', target, e.data);
    };

    pc.ontrack = (ev) => {
      console.log('Track received from', target, ev.streams);
      // Users of WebRTCManager can enhance to set video element srcObject
    };

    this.peersMap.set(target, pc);
  }

  public async connectToDataplane() {
    const target = 'llbe';
  const peerConnection = new RTCPeerConnection(this.rtcConfig);
  this.setupPeerHandlers(target, peerConnection);

    // Setup datachannels
  const channel = peerConnection.createDataChannel('llbe-control');
  channel.onopen = () => console.log('LLBE control channel open');
  channel.onmessage = (e) => console.log('LLBE control message', e.data);

  const sdp = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(sdp);

    this.realtimeClient.send({
      type: 'webrtc:sdp',
      target,
      sdp,
    });

    // Next, the backend forwards this offer to LLBE
    // Then LLBE will set its remote description
    // Then LLBE will create an answer and send it to the backend
    // Then the backend will forward the answer to us
    // Then we set our remote description

    // peerConnection.setRemoteDescription(peerConnection, sdp);

    // Next, an event will be fired for each ICE candidate. Let's send
    // to LLBE via the backend

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.realtimeClient.send({
          type: 'webrtc:ice',
          target,
          candidate: event.candidate,
        });
      }
    };
  }

  public async connectToVideoStream() {
  }


  // public async connectToDataplane() {
  //   const target = 'llbe';
  //   const pc = this.createPeerConnection(target);
  //   // Setup datachannels
  //   const channel = pc.createDataChannel("channel");

  //   // channel.onopen = () => console.log("LLBE ctrl datachannel open");
  //   // channel.onclose = () => console.log("LLBE ctrl datachannel closed");
  //   // channel.onmessage = (e) => console.log("LLBE ctrl message:", e.data);

  //   channel.onopen = () => {
  //     console.log("LLBE ctrl datachannel open");
  //     this.llbeChannel = channel;
  //     this.llbeChannelStatus.set(Status.CONNECTED);
  //   };

  //   channel.onclose = () => {
  //     console.log("LLBE ctrl datachannel closed");
  //     this.llbeChannel = null;
  //     this.llbeChannelStatus.set(Status.CLOSED);
  //   };

  //   channel.onerror = (e) => {
  //     console.error("LLBE ctrl datachannel error:", e);
  //     this.llbeChannel = null;
  //     this.llbeChannelStatus.set(Status.CLOSED);
  //   };

  //   const offer = await pc.createOffer();
  //   await pc.setLocalDescription(offer);

  //   this.realtimeClient.send({
  //     type: "webrtc:sdp",
  //     target,
  //     sdp: offer
  //   });
  // }

  // public closeAll() {
  //   this.peers.forEach((pc, target) => {
  //     pc.close();
  //     console.log(`Closed peer connection for ${target}`);
  //   });
  //    this.peers.clear();
  //   this.robotStream.set(null);
  // }
}
