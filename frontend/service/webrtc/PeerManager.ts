type PeerId = 'llbe' | 'robot' | 'upstream'; // for now we won't implement upstream

export class PeerManager {
  private peers = new Map<PeerId, RTCPeerConnection>();
  private rtcCfg: RTCConfiguration;

  constructor(rtcCfg: RTCConfiguration) {
    this.rtcCfg = rtcCfg;
    window.addEventListener('signal', (e: any) => {
      this.onSignal(e.detail);
    })
  }

  ensurePeer(id: PeerId): RTCPeerConnection {
    let pc = this.peers.get(id);
    if (pc)
      return pc;

    pc = new RTCPeerConnection(this.rtcCfg);

    pc.onicecandidate = event => {
      if (event.candidate) {
        this.sendSignal({
          type: 'ice',
          target: id,
          candidate: event.candidate,
        });
      }
    };

    pc.onconnectionstatechange = event => {
      if (pc!.connectionState === 'failed' || pc!.connectionState === 'disconnected') {
        pc!.restartIce();
      }
    }

    pc.ondatachannel = event => {
      const dc = event.channel;
      if (dc.label === 'robot') {
        // attach to robot handler
      }
    }

    this.peers.set(id, pc);
    return pc;
  }

  private sendSignal(msg: any) {
    window.dispatchEvent(new CustomEvent('signal', { detail: msg }));
  }
}