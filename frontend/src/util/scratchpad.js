const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });

pc.onicecandidate = e => {
  if (e.candidate) signal('ice', e.candidate);
};

const offer = pc.createOffer();
await pc.setLocalDescription(offer);

signal('offer', offer);
